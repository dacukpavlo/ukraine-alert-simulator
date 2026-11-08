/* UA Alert Map: geographic basemap is real, flight animation is independently fictional.
   No flight or impact position is georeferenced, and no real locations are targeted. */
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const tab=$('countryDemo'),ukr=$('countryUkraine'),rus=$('countryRussia');
  const controls=$('demoControls'),stage=$('flightDemoStage');
  const world=$('demoWorld'),sprites=$('demoFlights');
  if(!tab||!controls||!stage||!world||!sprites)return;

  const types={
    neptune:{title:'Нептун',style:'arrow',tone:'#8ee4fc',description:'Умовний символ об’єкта на схемі'},
    flamingo:{title:'Фламінго',style:'wing',tone:'#f1a8ee',description:'Стилізований літальний об’єкт'},
    palianytsia:{title:'Паляниця',style:'dart',tone:'#ffda97',description:'Малюнок для художнього сценарію'},
    drone:{title:'Дрон',style:'rotor',tone:'#a4f1d0',description:'Універсальна декоративна іконка'},
    rocket:{title:'Ракета',style:'meteor',tone:'#b1caff',description:'Абстрактна анімаційна іконка'}
  };
  const zones=[
    {name:'Логістичний сектор',x:.73,y:.21},
    {name:'Технічний сектор',x:.82,y:.48},
    {name:'Промисловий сектор',x:.71,y:.73}
  ];
  const origin={x:.17,y:.71};
  const state={running:false,paused:false,active:[],pending:[],launched:0,intercepted:0,finished:0,last:0,raf:0,serial:0};
  const reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let geoMap=null,vectorLayer=null,imageryLayer=null,labelLayer=null,sourceStyle='grid';

  // Static, hand-drawn non-technical pictograms; no photographs or technical specifications.
  const silhouettes={
    arrow:'<path d="M6 32 L76 27 L94 21 L76 17 L6 12 L19 23 Z" fill="currentColor" opacity=".9"/><path d="M18 22 L55 22" fill="none" stroke="#143854" stroke-width="3"/>',
    wing:'<path d="M8 31 L43 27 L58 8 L65 8 L59 28 L93 35 L93 41 L55 37 L39 48 L29 48 L39 35 Z" fill="currentColor" opacity=".92"/>',
    dart:'<path d="M4 38 L92 11 L72 41 L53 36 L33 48 L25 47 L41 33 Z" fill="currentColor"/><path d="M42 33 L75 26" stroke="#143854" stroke-width="3"/>',
    rotor:'<rect x="38" y="20" width="26" height="16" rx="8" fill="currentColor"/><path d="M21 15 L75 43 M75 15 L21 43" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="20" cy="14" r="9" stroke="currentColor" fill="none" stroke-width="3"/><circle cx="76" cy="14" r="9" stroke="currentColor" fill="none" stroke-width="3"/><circle cx="20" cy="44" r="9" stroke="currentColor" fill="none" stroke-width="3"/><circle cx="76" cy="44" r="9" stroke="currentColor" fill="none" stroke-width="3"/>',
    meteor:'<path d="M7 32 Q32 20 48 25 L79 13 Q90 13 94 25 Q92 35 79 37 L48 31 Q28 37 7 32 Z" fill="currentColor"/><path d="M32 20 L11 9 M31 38 L11 49" stroke="#f9d68c" stroke-width="4" stroke-linecap="round"/>'
  };
  function illustration(type){
    const data=types[type]||types.drone;
    return '<svg viewBox="0 0 100 58" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="color:'+data.tone+'">'+silhouettes[data.style]+'</svg>';
  }
  function updatePreview(){
    const type=$('demoObject').value;
    const info=types[type]||types.drone;
    const preview=$('demoObjectPreview');
    preview.innerHTML=illustration(type);
    const text=document.createElement('div'),title=document.createElement('b'),note=document.createElement('small');
    title.textContent=info.title;
    note.textContent=info.description+' · не фотографія реальної техніки';
    text.append(title,note);
    preview.append(text);
  }
  function stats(){
    $('demoLaunched').textContent=state.launched;
    $('demoIntercepted').textContent=state.intercepted;
    $('demoFinished').textContent=state.finished;
    $('demoActive').textContent=state.active.length;
  }
  function notice(message){
    const el=document.createElement('li');
    el.textContent=message;
    $('demoLog').prepend(el);
    while($('demoLog').children.length>7)$('demoLog').lastElementChild.remove();
  }
  function activeButtons(){
    $('demoPause').disabled=!state.running;
    $('demoPause').textContent=state.paused?'▶ Продовжити':'⏸ Пауза';
    $('demoStatus').textContent=state.paused?'Пауза':state.running?'Триває умовна анімація':'Готово до запуску';
  }
  function ensureGeographicMap(){
    if(geoMap){
      window.setTimeout(()=>geoMap.invalidateSize(false),80);
      return;
    }
    if(typeof L==='undefined'){
      notice('Карта не завантажилася: не вдалося отримати бібліотеку Leaflet.');
      return;
    }
    geoMap=L.map('demoGeoMap',{
      zoomControl:true,
      attributionControl:true,
      maxZoom:17,
      minZoom:3
    });
    vectorLayer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,
      attribution:'&copy; OpenStreetMap contributors'
    });
    imageryLayer=L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {maxZoom:18,attribution:'Imagery &copy; Esri and imagery partners'}
    );
    labelLayer=L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {maxZoom:18,attribution:'Place labels &copy; Esri'}
    );
    vectorLayer.addTo(geoMap);
    geoMap.fitBounds([[44,21],[61,63]],{padding:[20,20],animate:false});
    const selected=$('demoVisual').value;
    setMapStyle(selected);
    window.setTimeout(()=>geoMap.invalidateSize(false),80);
  }
  function setMapStyle(style){
    sourceStyle=style;
    if(!geoMap)return;
    if(style==='satellite'){
      if(geoMap.hasLayer(vectorLayer))geoMap.removeLayer(vectorLayer);
      if(!geoMap.hasLayer(imageryLayer))imageryLayer.addTo(geoMap);
      if(!geoMap.hasLayer(labelLayer))labelLayer.addTo(geoMap);
    }else{
      if(geoMap.hasLayer(labelLayer))geoMap.removeLayer(labelLayer);
      if(geoMap.hasLayer(imageryLayer))geoMap.removeLayer(imageryLayer);
      if(!geoMap.hasLayer(vectorLayer))vectorLayer.addTo(geoMap);
    }
  }
  function refreshMapSize(){
    if(geoMap)window.setTimeout(()=>geoMap.invalidateSize(false),80);
  }
  function reset(showNotice=true){
    state.running=false;state.paused=false;
    state.active=[];state.pending=[];
    state.launched=0;state.intercepted=0;state.finished=0;
    cancelAnimationFrame(state.raf);
    state.raf=0;state.last=0;state.serial++;
    sprites.replaceChildren();
    if(showNotice){
      $('demoLog').replaceChildren();
      notice('Анімацію очищено. Оберіть новий сценарій.');
    }
    stats();activeButtons();
  }
  function leaveDemo(destination){
    if(!document.body.classList.contains('demo-mode'))return;
    reset(false);
    document.body.classList.remove('demo-mode');
    controls.classList.add('hidden');
    tab.classList.remove('active');
    tab.setAttribute('aria-pressed','false');
    const r=destination==='ru';
    (r?rus:ukr).classList.add('active');
    (r?ukr:rus).classList.remove('active');
    $('countryChip').textContent=r?'Росія · меми':'Україна';
    $('countryNotice').textContent=r
      ?'Увімкни тривогу для міста, області або всієї Росії. Це мемний ручний режим, не реальні повідомлення.'
      :'В Україні тривоги вмикаються вручну. Реальний стан — за кнопкою нижче.';
    $('ruAllQuick').classList.toggle('hidden',!r);
    $('panelModeTitle').textContent=r?'Мемна карта Росії':'Керування картою';
    window.setTimeout(()=>{
      try{map.invalidateSize(false)}catch(e){}
    },80);
  }
  ukr.addEventListener('click',()=>leaveDemo('ua'),true);
  rus.addEventListener('click',()=>leaveDemo('ru'),true);
  tab.addEventListener('click',()=>{
    if(document.body.classList.contains('demo-mode'))return;
    try{stopAudio()}catch(e){}
    try{clearMemeFlights()}catch(e){}
    document.body.classList.add('demo-mode');
    controls.classList.remove('hidden');
    ukr.classList.remove('active');rus.classList.remove('active');
    tab.classList.add('active');
    ukr.setAttribute('aria-pressed','false');
    rus.setAttribute('aria-pressed','false');
    tab.setAttribute('aria-pressed','true');
    $('countryChip').textContent='🛰️ Карта та польоти';
    $('countryNotice').textContent='На верхній карті реальні міста; польоти й умовні сектори нижче не прив’язані до географії.';
    $('ruAllQuick').classList.add('hidden');
    $('panelModeTitle').textContent='Карта та анімація';
    ensureGeographicMap();
    notice('Відкрито карту України й сусідніх територій. Польоти показані на окремій схемі.');
  });

  // These points are fractions of the independent schematic canvas, NOT geographic coordinates.
  function position(f,p){
    const z=zones[f.zone],c={x:.41,y:.12+(f.zone*.16)};
    const q=1-p;
    return {
      x:q*q*origin.x+2*q*p*c.x+p*p*z.x,
      y:q*q*origin.y+2*q*p*c.y+p*p*z.y
    };
  }
  function spawn(item){
    const def=types[item.type];
    const node=document.createElement('div');
    node.className='demo-flyer';
    const sprite=document.createElement('div');
    sprite.className='demo-sprite';
    sprite.innerHTML=illustration(item.type);
    const label=document.createElement('span');
    label.textContent=def.title;
    node.append(sprite,label);
    sprites.append(node);
    state.active.push({
      type:item.type,
      zone:item.zone,
      node,
      progress:0,
      duration:reduced?1:6.5+Math.random()*3,
      intercepted:Math.random()<.28
    });
    state.launched++;
    stats();
    notice('▶ '+def.title+': запущено умовну анімацію.');
  }
  function finish(f){
    f.node.remove();
    if(f.intercepted)state.intercepted++;else state.finished++;
    const p=position(f,f.intercepted?.77:1);
    const halo=document.createElement('div');
    halo.className='demo-finish '+(f.intercepted?'intercepted':'');
    halo.style.left=(p.x*100)+'%';
    halo.style.top=(p.y*100)+'%';
    sprites.append(halo);
    window.setTimeout(()=>halo.remove(),950);
    notice((f.intercepted?'◇ Умовно перехоплено':'✓ Досягнуто умовного сектору')+': '+zones[f.zone].name+'.');
    stats();
  }
  function render(f){
    const p=position(f,Math.min(1,f.progress));
    f.node.style.left=(p.x*100)+'%';
    f.node.style.top=(p.y*100)+'%';
  }
  function tick(t){
    if(!state.running)return;
    if(!state.last)state.last=t;
    const dt=Math.min(.055,(t-state.last)/1000);
    state.last=t;
    if(!state.paused){
      for(let i=state.pending.length-1;i>=0;i--){
        const job=state.pending[i];
        job.wait-=dt;
        if(job.wait<=0){state.pending.splice(i,1);spawn(job)}
      }
      for(let i=state.active.length-1;i>=0;i--){
        const f=state.active[i];
        f.progress+=dt/f.duration;
        if((f.intercepted&&f.progress>=.77)||f.progress>=1){
          state.active.splice(i,1);
          finish(f);
        }else render(f);
      }
      if(!state.pending.length&&!state.active.length){
        state.running=false;state.last=0;activeButtons();
        notice('Сценарій завершено. Статистика умовна.');
        return;
      }
    }
    state.raf=requestAnimationFrame(tick);
  }
  function launch(){
    if(state.running){
      if(state.paused){state.paused=false;activeButtons()}
      return;
    }
    const type=$('demoObject').value,count=Number($('demoQuantity').value);
    if(!types[type]||!Number.isFinite(count)||count<1)return;
    const total=Math.min(12,count);
    state.pending=Array.from({length:total},(_,i)=>({
      type:type,
      zone:i%zones.length,
      wait:.1+i*.6
    }));
    state.running=true;state.paused=false;state.last=0;
    activeButtons();
    notice('Підготовлено '+total+' умовних об’єктів. Вони не нанесені на географічну карту.');
    state.raf=requestAnimationFrame(tick);
  }
  $('demoStart').addEventListener('click',launch);
  $('demoPause').addEventListener('click',()=>{
    if(!state.running)return;
    state.paused=!state.paused;
    activeButtons();
  });
  $('demoReset').addEventListener('click',()=>reset(true));
  $('demoVisual').addEventListener('change',e=>setMapStyle(e.target.value));
  $('demoObject').addEventListener('change',updatePreview);
  window.addEventListener('resize',refreshMapSize,{passive:true});
  updatePreview();
  stats();activeButtons();
})();

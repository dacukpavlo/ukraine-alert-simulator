/* UA Alert Map — decorative meme waves. No real destinations, routes, or targeting. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const tab=$('countryDemo'),ukr=$('countryUkraine'),rus=$('countryRussia');
  const controls=$('demoControls'),stage=$('flightDemoStage');
  const spriteLayer=$('waveSprites'),ticker=$('waveTicker');
  if(!tab||!controls||!stage||!spriteLayer)return;

  const catalog={
    geese:{emoji:'🪿',label:'Бойові гуси'},
    ghost:{emoji:'👻',label:'Привиди Бандери'},
    ufo:{emoji:'🛸',label:'Українські НЛО'},
    varenyky:{emoji:'🥟',label:'Вареники'},
    borsch:{emoji:'🥣',label:'Борщ'},
    watermelon:{emoji:'🍉',label:'Херсонські кавуни'},
    witch:{emoji:'🧹',label:'Конотопські відьми'}
  };
  const kinds=Object.keys(catalog);
  const reduced=!!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const state={running:false,paused:false,automatic:false,totalWaves:0,waves:0,launched:0,finished:0,active:[],pending:[],elapsed:0,nextDue:0,last:0,raf:0};
  let geoMap=null,lightLayer=null,darkLayer=null,audioContext=null;
  
  function note(message){
    const li=document.createElement('li');li.textContent=message;
    $('demoLog').prepend(li);
    while($('demoLog').children.length>7)$('demoLog').lastElementChild.remove();
  }
  function stats(){
    $('demoWaveCount').textContent=state.waves;
    $('demoLaunched').textContent=state.launched;
    $('demoActive').textContent=state.active.length;
    $('demoFinished').textContent=state.finished;
    $('demoPause').disabled=!state.running;
    $('demoPause').textContent=state.paused?'▶ Продовжити':'⏸ Пауза';
    $('demoStatus').textContent=state.paused?'⏸ На паузі':state.running?'● Мемні хвилі в русі':'Готово до запуску';
  }
  function showTicker(message){ticker.textContent=message;}
  function sound(){
    // Lighthearted short UI sound; never real warning tones.
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)return;
      if(!audioContext)audioContext=new Audio();
      if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
      const t=audioContext.currentTime;
      [330,440,550].forEach((freq,i)=>{
        const o=audioContext.createOscillator(),g=audioContext.createGain();
        o.type='sine';o.frequency.value=freq;
        g.gain.setValueAtTime(.0001,t+i*.10);
        g.gain.exponentialRampToValueAtTime(.045,t+i*.10+.015);
        g.gain.exponentialRampToValueAtTime(.0001,t+i*.10+.12);
        o.connect(g);g.connect(audioContext.destination);
        o.start(t+i*.10);o.stop(t+i*.10+.13);
      });
    }catch(e){}
  }
  function ensureMap(){
    if(geoMap){setTimeout(()=>geoMap.invalidateSize(false),60);return;}
    if(typeof L==='undefined'){note('Фонову карту не завантажено, але мемні хвилі працюють.');return;}
    geoMap=L.map('demoGeoMap',{zoomControl:true,attributionControl:true,scrollWheelZoom:false,minZoom:2,maxZoom:12});
    lightLayer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'&copy; OpenStreetMap contributors',maxZoom:19
    });
    darkLayer=L.tileLayer('https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
      attribution:'&copy; OpenStreetMap &copy; CARTO',maxZoom:19
    });
    lightLayer.addTo(geoMap);
    geoMap.setView([58,72],3,{animate:false});
    updateMapStyle();
    setTimeout(()=>geoMap.invalidateSize(false),100);
  }
  function updateMapStyle(){
    if(!geoMap)return;
    const dark=$('demoVisual').value==='dark';
    if(dark){if(geoMap.hasLayer(lightLayer))geoMap.removeLayer(lightLayer);darkLayer.addTo(geoMap);}
    else{if(geoMap.hasLayer(darkLayer))geoMap.removeLayer(darkLayer);lightLayer.addTo(geoMap);}
    stage.querySelector('.wave-map-window').classList.toggle('is-dark',dark);
  }
  function cleanupSprite(item){if(item.node)item.node.remove();}
  function reset(log=true){
    cancelAnimationFrame(state.raf);
    state.raf=0;state.running=false;state.paused=false;state.automatic=false;
    state.totalWaves=0;state.waves=0;state.launched=0;state.finished=0;
    state.elapsed=0;state.nextDue=0;state.last=0;
    state.pending.length=0;
    state.active.forEach(cleanupSprite);state.active.length=0;
    spriteLayer.replaceChildren();
    if(log){$('demoLog').replaceChildren();note('Очищено. Можна запускати нові хвилі.');}
    showTicker('🎮 Вибери кількість і запускай хвилі');
    stats();
  }
  function chooseKind(index){
    const selected=$('demoObject').value;
    const name=selected==='mixed'?kinds[(index+Math.floor(Math.random()*kinds.length))%kinds.length]:selected;
    return catalog[name]||catalog.geese;
  }
  function enqueueWave(){
    const count=Math.max(1,Math.min(12,Number($('demoQuantity').value)||6));
    const number=++state.waves;
    for(let i=0;i<count;i++){
      state.pending.push({
        at:state.elapsed+i*190,
        index:i,
        wave:number,
        def:chooseKind(i+number),
        travel:reduced?800:5400+(i%4)*620
      });
    }
    showTicker('🌊 Хвиля №'+number+' • '+count+' мемних об’єктів');
    note('🌊 Хвиля №'+number+': '+count+' об’єктів поступово з’являються на ігровій карті.');
    sound();
    stats();
  }
  function begin(){
    reset(false);
    $('demoLog').replaceChildren();
    state.running=true;state.automatic=true;state.paused=false;
    state.totalWaves=Math.min(10,Math.max(1,Number($('demoWaves').value)||3));
    state.nextDue=0;
    note('▶ Запускаються '+state.totalWaves+' мемні хвилі. Маршрути декоративні.');
    state.raf=requestAnimationFrame(tick);
    stats();
    if(window.innerWidth<850)stage.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function nextWave(){
    if(!state.running){
      reset(false);
      state.running=true;state.automatic=false;
      state.raf=requestAnimationFrame(tick);
    }
    if(state.paused)state.paused=false;
    enqueueWave();
    stats();
    if(window.innerWidth<850)stage.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function spawn(item){
    const node=document.createElement('div');
    node.className='wave-flyer';
    const icon=document.createElement('div'),caption=document.createElement('span');
    icon.className='wave-emoji';icon.textContent=item.def.emoji;
    caption.className='wave-name';caption.textContent=item.def.label;
    node.append(icon,caption);
    spriteLayer.append(node);
    item.node=node;
    item.progress=0;
    // These screen percentages are independent of Leaflet and never geographic coordinates.
    item.startY=19+(item.index%6)*12+(item.wave%2)*3;
    item.endY=Math.min(83,item.startY+8+(item.index%3)*3);
    item.curve=(item.index%2?1:-1)*(9+(item.wave%3)*3);
    state.active.push(item);
    state.launched++;
    draw(item);
    stats();
  }
  function draw(item){
    const p=Math.min(1,item.progress);
    const x=-7+p*114;
    const y=item.startY+(item.endY-item.startY)*p+Math.sin(p*Math.PI)*item.curve;
    item.node.style.left=x.toFixed(2)+'%';
    item.node.style.top=y.toFixed(2)+'%';
    item.node.style.opacity=String(Math.min(1,p*12,(1-p)*10));
    item.node.style.transform='translate(-50%,-50%) rotate('+(Math.sin(p*6)*7).toFixed(1)+'deg)';
  }
  function finish(item){
    cleanupSprite(item);
    state.finished++;
    if(!reduced){
      const star=document.createElement('div');
      star.className='wave-sparkle';star.textContent='✨';
      star.style.left='90%';star.style.top=Math.min(86,item.endY)+'%';
      spriteLayer.append(star);
      setTimeout(()=>star.remove(),1000);
    }
    stats();
  }
  function tick(t){
    if(!state.running)return;
    if(!state.last)state.last=t;
    const dt=Math.min(80,Math.max(0,t-state.last));
    state.last=t;
    if(!state.paused){
      state.elapsed+=dt;
      if(state.automatic&&state.waves<state.totalWaves&&state.elapsed>=state.nextDue){
        enqueueWave();
        state.nextDue=state.elapsed+Math.max(3000,Number($('demoPace').value)||5000);
      }
      for(let i=state.pending.length-1;i>=0;i--){
        const item=state.pending[i];
        if(item.at<=state.elapsed){state.pending.splice(i,1);spawn(item);}
      }
      for(let i=state.active.length-1;i>=0;i--){
        const item=state.active[i];
        item.progress+=dt/item.travel;
        if(item.progress>=1){
          state.active.splice(i,1);
          finish(item);
        }else draw(item);
      }
      if(!state.pending.length&&!state.active.length&&(!state.automatic||state.waves>=state.totalWaves)){
        state.running=false;state.last=0;
        showTicker('✅ Усі мемні об’єкти завершили рух');
        note('✅ Мемний раунд завершено. Жодних справжніх польотів.');
        stats();
        return;
      }
    }
    state.raf=requestAnimationFrame(tick);
  }
  function exitDemo(destination){
    if(!document.body.classList.contains('demo-mode'))return;
    reset(false);
    document.body.classList.remove('demo-mode');
    controls.classList.add('hidden');
    tab.classList.remove('active');tab.setAttribute('aria-pressed','false');
    const ru=destination==='ru';
    (ru?rus:ukr).classList.add('active');
    (ru?ukr:rus).classList.remove('active');
    $('countryChip').textContent=ru?'Росія · меми':'Україна';
    $('countryNotice').textContent=ru
      ?'Увімкни тривогу для міста, області або всієї Росії. Це мемний ручний режим.'
      :'В Україні тривоги вмикаються вручну. Реальний стан — за кнопкою нижче.';
    $('ruAllQuick').classList.toggle('hidden',!ru);
    $('panelModeTitle').textContent=ru?'Мемна карта Росії':'Керування картою';
    setTimeout(()=>{try{map.invalidateSize(false);}catch(e){}},80);
  }
  ukr.addEventListener('click',()=>exitDemo('ua'),true);
  rus.addEventListener('click',()=>exitDemo('ru'),true);
  tab.addEventListener('click',()=>{
    if(document.body.classList.contains('demo-mode'))return;
    try{stopAudio();}catch(e){}
    try{clearMemeFlights();}catch(e){}
    document.body.classList.add('demo-mode');
    controls.classList.remove('hidden');
    ukr.classList.remove('active');rus.classList.remove('active');
    tab.classList.add('active');
    ukr.setAttribute('aria-pressed','false');rus.setAttribute('aria-pressed','false');
    tab.setAttribute('aria-pressed','true');
    $('countryChip').textContent='🎮 Мемні хвилі';
    $('countryNotice').textContent='Ігровий режим: усі хвилі вигадані та не позначають справжні події.';
    $('ruAllQuick').classList.add('hidden');
    $('panelModeTitle').textContent='Керування мемними хвилями';
    ensureMap();
    note('🎮 Відкрито режим мемних хвиль. Обери об’єкти й кількість хвиль.');
  });
  $('demoStart').addEventListener('click',begin);
  $('demoNextWave').addEventListener('click',nextWave);
  $('demoPause').addEventListener('click',()=>{
    if(!state.running)return;
    state.paused=!state.paused;
    showTicker(state.paused?'⏸ Хвилі на паузі':'▶ Хвилі продовжуються');
    stats();
  });
  $('demoReset').addEventListener('click',()=>reset(true));
  $('demoVisual').addEventListener('change',updateMapStyle);
  window.addEventListener('resize',()=>{if(geoMap)setTimeout(()=>geoMap.invalidateSize(false),80)},{passive:true});
  stats();
})();

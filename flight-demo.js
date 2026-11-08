/* UA Alert Map / fictional flight showcase. No geographic coordinates, live targets or operational trajectories. */
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const tab=$('countryDemo'),ukr=$('countryUkraine'),rus=$('countryRussia');
  const control=$('demoControls'),world=$('demoWorld'),spriteLayer=$('demoFlights');
  if(!tab||!control||!world||!spriteLayer)return;
  const types={
    neptune:{title:'Нептун',icon:'🚀'},
    flamingo:{title:'Фламінго',icon:'✈️'},
    palianytsia:{title:'Паляниця',icon:'🛩️'},
    drone:{title:'Безпілотник',icon:'🛸'}
  };
  const zones=[
    {name:'Сектор Альфа',x:.73,y:.21},
    {name:'Сектор Бета',x:.82,y:.48},
    {name:'Сектор Гамма',x:.71,y:.73}
  ];
  const origin={x:.17,y:.71};
  const state={running:false,paused:false,active:[],pending:[],launched:0,intercepted:0,finished:0,last:0,raf:0,serial:0};
  const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function stats(){
    $('demoLaunched').textContent=state.launched;
    $('demoIntercepted').textContent=state.intercepted;
    $('demoFinished').textContent=state.finished;
    $('demoActive').textContent=state.active.length;
  }
  function notice(msg){
    const el=document.createElement('li');el.textContent=msg;
    $('demoLog').prepend(el);
    while($('demoLog').children.length>7)$('demoLog').lastElementChild.remove();
  }
  function activeButtons(){
    $('demoPause').disabled=!state.running;
    $('demoPause').textContent=state.paused?'▶ Продовжити':'⏸ Пауза';
    $('demoStatus').textContent=state.paused?'Пауза':state.running?'Анімація триває':'Готово до запуску';
  }
  function leaveDemo(dest){
    if(!document.body.classList.contains('demo-mode'))return;
    reset(false);
    document.body.classList.remove('demo-mode');
    control.classList.add('hidden');
    tab.classList.remove('active');
    tab.setAttribute('aria-pressed','false');
    const isRu=dest==='ru';
    const wanted=isRu?rus:ukr;
    wanted.classList.add('active');
    (isRu?ukr:rus).classList.remove('active');
    $('countryChip').textContent=isRu?'Росія · меми':'Україна';
    $('countryNotice').textContent=isRu
      ?'Увімкни тривогу для міста, області або всієї Росії. Це мемний ручний режим, не реальні повідомлення.'
      :'В Україні тривоги вмикаються вручну. Реальний стан — за кнопкою нижче.';
    $('ruAllQuick').classList.toggle('hidden',!isRu);
    $('panelModeTitle').textContent=isRu?'Мемна карта Росії':'Керування картою';
    requestAnimationFrame(()=>{try{map.invalidateSize(false)}catch(e){}});
  }
  ukr.addEventListener('click',()=>leaveDemo('ua'),true);
  rus.addEventListener('click',()=>leaveDemo('ru'),true);
  tab.addEventListener('click',()=>{
    if(document.body.classList.contains('demo-mode'))return;
    try{stopAudio()}catch(e){}
    try{clearMemeFlights()}catch(e){}
    document.body.classList.add('demo-mode');
    control.classList.remove('hidden');
    ukr.classList.remove('active');rus.classList.remove('active');
    tab.classList.add('active');
    ukr.setAttribute('aria-pressed','false');rus.setAttribute('aria-pressed','false');
    tab.setAttribute('aria-pressed','true');
    $('countryChip').textContent='Польоти · демо';
    $('countryNotice').textContent='Окрема художня анімація без справжніх координат, цілей та даних бойових дій.';
    $('ruAllQuick').classList.add('hidden');
    $('panelModeTitle').textContent='Керування анімацією';
    notice('Відкрито окремий демонстраційний режим.');
  });
  function reset(showNotice=true){
    state.running=false;state.paused=false;
    state.pending=[];state.active=[];state.launched=0;state.intercepted=0;state.finished=0;
    cancelAnimationFrame(state.raf);
    state.raf=0;state.last=0;state.serial++;
    spriteLayer.replaceChildren();
    if(showNotice){$('demoLog').replaceChildren();notice('Лічильники очищено.');}
    stats();activeButtons();
  }
  function spawn(item){
    const def=types[item.type],node=document.createElement('div');
    node.className='demo-flyer';
    const sprite=document.createElement('div');sprite.className='demo-sprite';sprite.textContent=def.icon;
    const label=document.createElement('span');label.textContent=def.title;
    node.append(sprite,label);spriteLayer.append(node);
    const flight={type:item.type,zone:item.zone,node,progress:0,duration:reduced?1:7.2+Math.random()*3.1,intercepted:Math.random()<.3};
    state.active.push(flight);state.launched++;stats();
    notice('▶ '+def.title+' — старт умовної анімації.');
  }
  function position(f,p){
    const z=zones[f.zone],c={x:.41,y:.12+(f.zone*.16)};
    const q=1-p;
    return {x:q*q*origin.x+2*q*p*c.x+p*p*z.x,y:q*q*origin.y+2*q*p*c.y+p*p*z.y};
  }
  function finish(f){
    f.node.remove();
    const result=f.intercepted?'intercepted':'finished';
    if(f.intercepted)state.intercepted++;else state.finished++;
    const p=position(f,f.intercepted?.77:1);
    const halo=document.createElement('div');
    halo.className='demo-finish '+(f.intercepted?'intercepted':'');
    halo.style.left=(p.x*100)+'%';halo.style.top=(p.y*100)+'%';
    spriteLayer.append(halo);setTimeout(()=>halo.remove(),950);
    notice((f.intercepted?'◇ Умовне перехоплення':'✓ Маршрут завершено')+' — '+zones[f.zone].name+'.');
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
    const dt=Math.min(.06,(t-state.last)/1000);
    state.last=t;
    if(!state.paused){
      for(let i=state.pending.length-1;i>=0;i--){
        const job=state.pending[i];job.wait-=dt;
        if(job.wait<=0){state.pending.splice(i,1);spawn(job)}
      }
      for(let i=state.active.length-1;i>=0;i--){
        const f=state.active[i];f.progress+=dt/f.duration;
        if(f.intercepted&&f.progress>=.77||f.progress>=1){
          state.active.splice(i,1);finish(f);
        }else render(f);
      }
      if(!state.pending.length&&!state.active.length){
        state.running=false;state.last=0;activeButtons();
        notice('Демонстрацію завершено. Усі результати умовні.');
        return;
      }
    }
    state.raf=requestAnimationFrame(tick);
  }
  $('demoStart').addEventListener('click',()=>{
    if(state.running){if(state.paused){state.paused=false;activeButtons()}return}
    const type=$('demoObject').value,count=Number($('demoQuantity').value);
    if(!types[type]||!Number.isFinite(count))return;
    state.pending=Array.from({length:Math.min(9,count)},(_,i)=>({type,zone:i%zones.length,wait:.1+i*.55}));
    state.running=true;state.paused=false;state.last=0;
    activeButtons();notice('Підготовлено '+state.pending.length+' умовних об’єктів.');
    state.raf=requestAnimationFrame(tick);
  });
  $('demoPause').addEventListener('click',()=>{state.paused=!state.paused;activeButtons()});
  $('demoReset').addEventListener('click',()=>reset(true));
  $('demoVisual').addEventListener('change',e=>world.classList.toggle('satellite',e.target.value==='satellite'));
  stats();activeButtons();
})();
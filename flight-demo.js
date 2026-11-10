/* UA Alert Map — colorful fantasy wave game. No real weapon paths or facility coordinates. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const tab=$('countryDemo'),ua=$('countryUkraine'),ru=$('countryRussia');
const drawer=$('demoControls'),panel=document.querySelector('.panel');
const stage=$('flightDemoStage'),field=$('waveBattlefield'),sprites=$('waveSprites');
if(!tab||!ua||!ru||!drawer||!panel||!stage||!field||!sprites)return;

const actors={
  goose:{emoji:'🪿',name:'Гусак'},
  ufo:{emoji:'🛸',name:'НЛО'},
  ghost:{emoji:'👻',name:'Привид'},
  plane:{emoji:'🛩️',name:'Паперовий літачок'},
  watermelon:{emoji:'🍉',name:'Кавун'},
  dumpling:{emoji:'🥟',name:'Вареник'},
  broom:{emoji:'🧹',name:'Мітла'}
};
const actorKeys=Object.keys(actors);
const reduceMotion=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
let mapBackdrop=null,audioCtx=null;
const state={
  running:false,paused:false,automatic:false,goal:0,autoSent:0,
  waves:0,launched:0,finished:0,coins:1600,points:0,
  clock:0,nextWaveAt:0,last:0,raf:0,active:[],pending:[]
};
const fmt=n=>Number(n).toLocaleString('uk-UA');
function log(line){
  const item=document.createElement('li');item.textContent=line;
  $('demoLog').prepend(item);
  while($('demoLog').children.length>7)$('demoLog').lastElementChild.remove();
}
function status(line){$('demoStatus').textContent=line;}
function ticker(line){$('waveTicker').textContent=line;}
function reflect(){
  $('demoWaveCount').textContent=fmt(state.waves);
  $('demoLaunched').textContent=fmt(state.launched);
  $('demoActive').textContent=fmt(state.active.length);
  $('demoFinished').textContent=fmt(state.finished);
  $('waveCoins').textContent=fmt(state.coins);
  $('waveScore').textContent=fmt(state.points);
  $('waveLevel').textContent=String(1+Math.floor(state.points/400));
  const button=$('demoPause');
  button.disabled=!state.running;
  button.textContent=state.paused?'▶ Продовжити':'⏸ Пауза';
  $('wavePauseQuick').textContent=state.paused?'▶':'⏸';
}
function chirp(){
  try{
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    if(!audioCtx)audioCtx=new Audio();
    if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
    const now=audioCtx.currentTime;
    [440,560,720].forEach((hz,i)=>{
      const osc=audioCtx.createOscillator(),volume=audioCtx.createGain(),start=now+i*.085;
      osc.type='sine';osc.frequency.value=hz;
      volume.gain.setValueAtTime(.0001,start);
      volume.gain.exponentialRampToValueAtTime(.028,start+.012);
      volume.gain.exponentialRampToValueAtTime(.0001,start+.095);
      osc.connect(volume);volume.connect(audioCtx.destination);
      osc.start(start);osc.stop(start+.1);
    });
  }catch(e){}
}
function setupBackdrop(){
  if(mapBackdrop){
    setTimeout(()=>mapBackdrop.invalidateSize(false),100);
    return;
  }
  if(typeof L==='undefined'){
    log('Географічна підкладка не завантажилась. Ігрові зони працюють окремо.');
    return;
  }
  try{
    mapBackdrop=L.map('demoGeoMap',{
      zoomControl:false,attributionControl:true,dragging:false,
      doubleClickZoom:false,scrollWheelZoom:false,touchZoom:false,
      boxZoom:false,keyboard:false,minZoom:3,maxZoom:8
    }).setView([54,49],4,{animate:false});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'&copy; OpenStreetMap contributors',
      maxZoom:19
    }).addTo(mapBackdrop);
    setTimeout(()=>mapBackdrop.invalidateSize(false),100);
  }catch(e){log('Карта працює без фонових плиток.');}
}
function drawerOpen(visible){
  panel.classList.toggle('wave-controls-open',visible);
  $('waveMenuToggle').setAttribute('aria-expanded',String(visible));
  if(visible)panel.scrollTop=0;
}
function clearParticles(){
  sprites.replaceChildren();
  state.active.length=0;state.pending.length=0;
}
function reset(withMessage=true){
  cancelAnimationFrame(state.raf);
  state.running=false;state.paused=false;state.automatic=false;
  state.goal=0;state.autoSent=0;state.waves=0;state.launched=0;
  state.finished=0;state.coins=1600;state.points=0;
  state.clock=0;state.nextWaveAt=0;state.last=0;state.raf=0;
  clearParticles();
  status('ГОТОВО ДО ЗАПУСКУ');
  ticker('🎮 Налаштуй хвилі в меню та запускай!');
  if(withMessage){$('demoLog').replaceChildren();log('Гру очищено. Можна почати новий раунд.');}
  reflect();
}
function getActor(index){
  const requested=$('demoObject').value;
  const key=requested==='mix'?actorKeys[(index+state.waves)%actorKeys.length]:requested;
  return actors[key]||actors.goose;
}
function queueWave(auto=false){
  const n=Math.max(1,Math.min(12,Number($('demoQuantity').value)||6));
  state.waves++;
  if(auto)state.autoSent++;
  const label=getActor(state.waves);
  for(let i=0;i<n;i++){
    state.pending.push({
      at:state.clock+i*235,
      index:i,wave:state.waves,
      actor:$('demoObject').value==='mix'?getActor(i+state.waves):label,
      duration:reduceMotion?900:5200+(i%4)*560,
      phase:(state.waves*2+i)%6
    });
  }
  status('🌊 ХВИЛЯ №'+state.waves);
  ticker('🌊 Хвиля №'+state.waves+' · '+n+' анімованих об’єктів');
  log('Хвиля №'+state.waves+': на ігровій сцені з’являються '+n+' об’єктів.');
  if(!auto)chirp();
  reflect();
}
function begin(){
  reset(false);
  $('demoLog').replaceChildren();
  state.running=true;state.automatic=true;
  state.goal=Math.max(1,Math.min(10,Number($('demoWaves').value)||3));
  state.nextWaveAt=0;
  status('ПІДГОТОВКА ХВИЛЬ');
  log('Старт гри: '+state.goal+' поступових хвиль.');
  drawerOpen(false);
  chirp();
  state.raf=requestAnimationFrame(tick);
  reflect();
}
function extraWave(){
  if(!state.running){
    state.running=true;state.last=0;state.automatic=false;
    state.raf=requestAnimationFrame(tick);
  }
  if(state.paused)state.paused=false;
  queueWave(false);
  drawerOpen(false);
  reflect();
}
function pause(){
  if(!state.running)return;
  state.paused=!state.paused;
  status(state.paused?'⏸ ПАУЗА':'▶ ХВИЛІ РУХАЮТЬСЯ');
  ticker(state.paused?'Всі об’єкти призупинено':'Гра триває');
  reflect();
}
function createVehicle(item){
  const node=document.createElement('div'),vehicle=document.createElement('span'),label=document.createElement('small');
  node.className='wave-flyer';vehicle.className='wave-vehicle';label.className='wave-caption';
  vehicle.textContent=item.actor.emoji;label.textContent=item.actor.name;
  node.append(vehicle,label);sprites.append(node);item.node=node;
  item.p=0;
  // Stage-relative decorative motion, deliberately unrelated to real map coordinates.
  item.startX=10+item.phase*2.6;
  item.endX=86+(item.index%5)*2;
  item.startY=22+(item.phase%6)*10.5;
  item.endY=22+((item.wave+item.index*2)%6)*10.5;
  item.bend=((item.index%2)?1:-1)*(8+(item.wave%3)*2);
  state.active.push(item);state.launched++;
  drawVehicle(item);
  reflect();
}
function drawVehicle(item){
  const p=Math.min(item.p,1),q=1-p;
  const x=item.startX*q+item.endX*p;
  const y=item.startY*q+item.endY*p+Math.sin(Math.PI*p)*item.bend;
  item.node.style.left=x.toFixed(2)+'%';
  item.node.style.top=y.toFixed(2)+'%';
  item.node.style.transform='translate(-50%,-50%) rotate('+(Math.sin(p*5)*8).toFixed(1)+'deg)';
  item.node.style.opacity=String(Math.max(0,Math.min(1,p*8,(1-p)*10)));
}
function complete(item){
  item.node.remove();
  state.finished++;state.coins+=12;state.points+=20;
  if(!reduceMotion){
    const sparkle=document.createElement('span');
    sparkle.className='wave-glimmer';sparkle.textContent='✨';
    sparkle.style.left=item.endX+'%';sparkle.style.top=item.endY+'%';
    sprites.append(sparkle);setTimeout(()=>sparkle.remove(),1100);
  }
  reflect();
}
function tick(now){
  if(!state.running)return;
  if(!state.last)state.last=now;
  const dt=Math.min(85,Math.max(0,now-state.last));state.last=now;
  if(!state.paused){
    state.clock+=dt;
    if(state.automatic&&state.autoSent<state.goal&&state.clock>=state.nextWaveAt){
      queueWave(true);
      state.nextWaveAt=state.clock+Math.max(3000,Number($('demoPace').value)||6000);
    }
    for(let i=state.pending.length-1;i>=0;i--){
      if(state.pending[i].at<=state.clock){
        const item=state.pending.splice(i,1)[0];
        createVehicle(item);
      }
    }
    for(let i=state.active.length-1;i>=0;i--){
      const item=state.active[i];
      item.p+=dt/item.duration;
      if(item.p>=1){state.active.splice(i,1);complete(item);}else drawVehicle(item);
    }
    if(!state.pending.length&&!state.active.length&&(!state.automatic||state.autoSent>=state.goal)){
      state.running=false;
      status('✅ РАУНД ЗАВЕРШЕНО');
      ticker('Усі вигадані об’єкти завершили рух · +'+fmt(state.points)+' очок');
      log('Раунд завершено. Ніяких справжніх польотів.');
      reflect();return;
    }
  }
  state.raf=requestAnimationFrame(tick);
}
function leaveDemo(mode){
  if(!document.body.classList.contains('demo-mode'))return;
  reset(false);drawerOpen(false);document.body.classList.remove('demo-mode');
  drawer.classList.add('hidden');
  tab.classList.remove('active');tab.setAttribute('aria-pressed','false');
  const russian=mode==='ru';
  (russian?ru:ua).classList.add('active');
  (russian?ua:ru).classList.remove('active');
  $('countryChip').textContent=russian?'Росія · меми':'Україна';
  $('countryNotice').textContent=russian
    ?'Увімкни тривогу для міста, області або всієї Росії. Це мемний ручний режим.'
    :'В Україні тривоги вмикаються вручну. Реальний стан — за кнопкою нижче.';
  $('ruAllQuick').classList.toggle('hidden',!russian);
  $('panelModeTitle').textContent=russian?'Мемна карта Росії':'Керування картою';
  setTimeout(()=>{try{map.invalidateSize(false)}catch(e){}},90);
}
ua.addEventListener('click',()=>leaveDemo('ua'),true);
ru.addEventListener('click',()=>leaveDemo('ru'),true);
tab.addEventListener('click',()=>{
  if(document.body.classList.contains('demo-mode'))return;
  try{stopAudio()}catch(e){}
  try{clearMemeFlights()}catch(e){}
  document.body.classList.add('demo-mode');
  drawer.classList.remove('hidden');
  drawerOpen(false);
  ua.classList.remove('active');ru.classList.remove('active');
  ua.setAttribute('aria-pressed','false');ru.setAttribute('aria-pressed','false');
  tab.classList.add('active');tab.setAttribute('aria-pressed','true');
  $('countryChip').textContent='🎮 Ігрова карта';
  $('countryNotice').textContent='Розважальний режим з вигаданими об’єктами.';
  $('ruAllQuick').classList.add('hidden');
  $('panelModeTitle').textContent='Керування ігровою картою';
  reset(false);setupBackdrop();
  log('Відкрий меню та обери кількість хвиль.');
});
$('waveMenuToggle').addEventListener('click',()=>drawerOpen(!panel.classList.contains('wave-controls-open')));
$('waveDrawerClose').addEventListener('click',()=>drawerOpen(false));
$('waveExit').addEventListener('click',()=>ua.click());
$('demoStart').addEventListener('click',begin);
$('waveLaunchQuick').addEventListener('click',begin);
$('demoNextWave').addEventListener('click',extraWave);
$('waveNextQuick').addEventListener('click',extraWave);
$('demoPause').addEventListener('click',pause);
$('wavePauseQuick').addEventListener('click',pause);
$('demoReset').addEventListener('click',()=>reset(true));
$('demoVisual').addEventListener('change',()=>{
  field.classList.toggle('night',$('demoVisual').value==='night');
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('demo-mode'))drawerOpen(false)});
window.addEventListener('resize',()=>{if(mapBackdrop)setTimeout(()=>mapBackdrop.invalidateSize(false),80)},{passive:true});
reflect();
})();

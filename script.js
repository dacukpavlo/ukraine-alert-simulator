const map=L.map('map',{zoomControl:true,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView([49.1,31.2],6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,minZoom:2,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);

const uaAlertBoundaryVersion='2026-10-12-border-v3';
if(localStorage.getItem('uaAlertBoundaryVersion')!==uaAlertBoundaryVersion){
  localStorage.removeItem('uaAlertSim');
  localStorage.setItem('uaAlertBoundaryVersion',uaAlertBoundaryVersion);
}
let selected=null,searchResults=[],currentCountry='ua';
const alertStorageKey=()=>currentCountry==='ru'?'ruMemeAlerts':'uaAlertSim';
let activeAlerts=JSON.parse(localStorage.getItem('uaAlertSim')||'{}');
const markers={},zones={};
const searchInput=document.getElementById('placeSearch');

function kindLabel(k){return ruById[k]?.label||{air:'Повітряна тривога',drone:'Загроза БпЛА / Shahed',missile:'Ракетна загроза',strike:'Загроза ракетного удару',chemical:'Хімічна небезпека',nuclear:'Ядерна небезпека'}[k]||k}
function colorFor(k){const type=ruById[k]?.sound||k;return type==='drone'?'#ffd21f':type==='chemical'?'#a78bfa':type==='nuclear'?'#fb923c':'#ef3340'}

const ruScenarios=[["rad","☢️ Радиационная опасность","⚠️ Загрози","nuclear","Радіаційна перевірка з мемним звуком."],["chem","☣️ Химическая угроза","⚠️ Загрози","chemical","Підозрілий запах пропаганди."],["street","⚔️ Уличные бои","⚠️ Загрози","missile","Тільки умовний тренувальний сценарій."],["air","🚨 Воздушная тревога","⚠️ Загрози","air","Тренувальний сигнал повітряної тривоги."],["artillery","💥 Артиллерийский обстрел","⚠️ Загрози","missile","Умовний звук, не повідомлення про обстріл."],["nuclear","☢️ Ядерная угроза","⚠️ Загрози","nuclear","Фантастичний сценарій — не реальна загроза."],["oreshnik","🚀 Угроза ракеты «Орешник»","⚠️ Загрози","missile","Горішки для білочки закінчилися 🌰"],["wakeup_intro","👻 Угроза пробуждения Бандеры!","👻 Бандера й меми","ghost","Бандера проснулся и вышел на прогулку!"],["wakeup","💀 Угроза пробуждения Бандеры!","👻 Бандера й меми","ghost","Мемне пробудження легенди."],["kremlin","👻 Призрак Бандеры замечен в Кремле!","👻 Бандера й меми","ghost","Привид питає, де тут вихід."],["district","🚨 Внимание! Бандера в вашем районе!","👻 Бандера й меми","alarm","Місцевий мемний патруль на зв'язку."],["apocalypse","☠️ Бандеровский апокалипсис!","👻 Бандера й меми","alarm","Кінець спокою для пельменів."],["banderization","🇺🇦 Массовая бандеризация России!","👻 Бандера й меми","tune","Усе раптом заговорило українською."],["tridents","🔱 Нашествие украинских тризубов!","👻 Бандера й меми","tune","Тризуби на мемному радарі."],["resurrection","🧟 Восстание бандеровцев!","👻 Бандера й меми","ghost","Зомбі принесли паляницю."],["nightmare","👹 Ночной кошмар Бандеры!","👻 Бандера й меми","ghost","Будильник не допомагає."],["wifi","📡 Бандера взломал российский Wi-Fi!","👻 Бандера й меми","radio","Пароль Wi-Fi: паляниця."],["ufo","🛸 Бандеровские НЛО над Москвой!","👻 Бандера й меми","ufo","НЛО просять борщ."],["fridge","🥟 Бандера захватил холодильник!","👻 Бандера й меми","boing","Пельмені в паніці."],["tv","📺 Бандера появился во всех телевизорах!","👻 Бандера й меми","radio","Телевізор змінив канал на український."],["sleepless","👻 Призрак Бандеры не спит!","👻 Бандера й меми","ghost","Привид на нічній зміні."],["door","🔔 Бандера звонит в дверь!","👻 Бандера й меми","bell","Дзвінок: відчиніть для мемів."],["pelmeni","💀 Бандера объявил охоту на пельмени!","👻 Бандера й меми","boing","Пельмені пішли в укриття."],["geese","🪿 Вторжение украинских боевых гусей!","🪿 Українські меми","goose","Га-га-га, повітряний патруль."],["mosquito","🦟 Атака украинских боевых комаров!","🪿 Українські меми","buzz","Мемні комарі в ефірі."],["witch","🧙‍♀️ Конотопская ведьма приближается!","🪿 Українські меми","magic","Мітла заряджена борщем."],["pickles","🥒 Атака летающих банок с огурцами!","🪿 Українські меми","boing","Огірки взяли курс на холодильник."],["tractor","🚜 Вторжение украинских тракторных войск!","🪿 Українські меми","march","Трактор шукає наступний мем."],["patron","🐕 Пёс Патрон объявил проверку!","🪿 Українські меми","bell","Патрон перевіряє запаси смаколиків."],["cotton","🌸 Бавовняная тревога!","🪿 Українські меми","pop","Бавовна у мемному прогнозі."],["palianytsia","🍞 Паляниця-апокалипсис!","🪿 Українські меми","boing","Складно вимовити — легко запам'ятати."],["moskva_ship","🛳️ Крейсер «Москва» снова пропал!","🪿 Українські меми","pop","Крейсер пішов шукати Wi-Fi."],["chornobaivka","🔁 Чернобаевская аномалия!","🪿 Українські меми","tune","Це вже було, знову повторимо?"],["cats","🐈 Вторжение бандеровских котов!","🪿 Українські меми","goose","Мяу-патруль на службі."],["watermelons","🍉 Нашествие херсонских арбузов!","🪿 Українські меми","boing","Кавуни зайняли всі кошики."],["borsch_apocalypse","🥣 Борщевой апокалипсис!","🪿 Українські меми","boing","Борщ переміг кетчуп."],["ducks","🦆 Секретные украинские боевые утки!","🪿 Українські меми","goose","Кря-кря, секретна місія."],["pigeons","🐦 Украинские голуби захватили небо!","🪿 Українські меми","chirp","Голуби вийшли на зв'язок."],["run","🚨 Мамулечка, надо сваливать!","🥟 Побутові жарти","alarm","Мемний будильник працює."],["varenyky","🥟 Украинские вареники захватывают Россию!","🥟 Побутові жарти","boing","Вареники оголосили день сметани."],["onion","🧅 Луковая атака! Все плачут!","🥟 Побутові жарти","pop","Цибуля зробила свою справу."],["borsch_pelmeni","🍲 Борщ уничтожил все пельмени!","🥟 Побутові жарти","boing","Кулінарний фінал."],["ukr_tv","📺 Телевизор внезапно заговорил по-украински!","🥟 Побутові жарти","radio","Канал обрав українську мову."],["red_square","🪿 Гуси захватили Красную площадь!","🥟 Побутові жарти","goose","Гуси попросили послухати ґелґотання."],["sunflowers","🌻 Украинские подсолнухи наступают!","🥟 Побутові жарти","magic","Соняшники розквітають у мемі."],["radio_hymn","🎶 Все радиоприёмники включили украинский гимн!","🥟 Побутові жарти","tune","Мемний сигнал: без відтворення реального гімну."],["potato","🥔 Картофельная катастрофа!","🥟 Побутові жарти","boing","Картопля втекла з борщу."],["salo","🐷 Свинячья паника! Сало объявило мобилизацию!","🥟 Побутові жарти","march","Сало збирає команду бутербродів."],["aliens","👽 Инопланетяне требуют украинский борщ!","🥟 Побутові жарти","ufo","Прибульці замовили подвійну порцію."],["matryoshka","🎭 Российские матрёшки превратились в вышиванки!","🥟 Побутові жарти","magic","Матрьошки оновили гардероб."],["broom","🧹 Конотопские ведьмы устроили парад мётел!","🥟 Побутові жарти","magic","Відкрито сезон мітлиних перегонів."]].map(([id,label,group,sound,caption])=>({id:'ru_'+id,label,group,sound,caption}));
const ruById=Object.fromEntries(ruScenarios.map(s=>[s.id,s]));
const ruCountryPlace={name:'Росія',display:'Вся Росія',lat:61,lng:90,osm_type:'country_sim',osm_id:60189};
const memeCaptions={
  air:'Бавовняний прогноз: головне не переплутати з погодою ☁️',
  drone:'Дрон шукає Wi-Fi, а знаходить тільки меми 🛸',
  missile:'«Орєшнік»? Горішки для білочки закінчилися 🌰',
  strike:'Ракетний мем: навігатор пропонує повернути до здорового глузду 🧭',
  chemical:'Хімічний аналіз показав: у повітрі забагато пропаганди 🧪',
  nuclear:'Щекавиця просить не бронювати місця завчасно ⛰️'
};
function memeFor(k,p){return ruById[k]?.caption||memeCaptions[k]||'Мемний прогноз від українського інтернету.'}
function safeIcon(){return L.divIcon({className:'',html:'<div class="safe-dot"></div>',iconSize:[18,18],iconAnchor:[9,9]})}
function alertIcon(k){const c=k==='drone'?'yellow':'red';return L.divIcon({className:'',html:`<div class="alert-dot ${c}"><div class="pulse"></div><div class="core"></div></div>`,iconSize:[32,32],iconAnchor:[16,16]})}
function keyOf(p){return (currentCountry==='ru'?'ru:':'')+(p.osm_type||'x')+':'+(p.osm_id||p.lat+','+p.lng)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

async function runSearch(){
  const q=searchInput.value.trim();
  if(q.length<2){document.getElementById('searchStatus').textContent='Введи мінімум 2 літери';return}
  document.getElementById('searchStatus').textContent='Пошук…';
  try{
    const u=new URL('https://nominatim.openstreetmap.org/search');
    u.searchParams.set('format','jsonv2');u.searchParams.set('q',q+(currentCountry==='ru'?', Россия':', Україна'));u.searchParams.set('countrycodes',currentCountry);u.searchParams.set('addressdetails','1');u.searchParams.set('namedetails','1');u.searchParams.set('polygon_geojson','1');u.searchParams.set('limit','10');u.searchParams.set('accept-language','uk');
    const r=await fetch(u);if(!r.ok)throw new Error();
    const d=await r.json();
    searchResults=d.map(x=>({name:(x.namedetails&&x.namedetails.name)||x.display_name.split(',')[0],display:x.display_name,lat:+x.lat,lng:+x.lon,osm_type:x.osm_type,osm_id:x.osm_id,bbox:x.boundingbox?.map(Number),geojson:x.geojson||null,type:x.type||'',class:x.class||'',addresstype:x.addresstype||'',address:x.address||{}}));
    renderSuggestions();document.getElementById('searchStatus').textContent=searchResults.length?`Знайдено: ${searchResults.length}`:'Нічого не знайдено';
  }catch(e){document.getElementById('searchStatus').textContent='Пошук тимчасово недоступний'}
}
function renderSuggestions(){
  const b=document.getElementById('suggestions');
  if(!searchResults.length){b.classList.add('hidden');return}
  b.innerHTML=searchResults.map((p,i)=>`<div class="suggestion" data-i="${i}"><b>${esc(p.name)}</b><br><small>${esc(p.display)}</small></div>`).join('');
  b.classList.remove('hidden');b.querySelectorAll('.suggestion').forEach(el=>el.onclick=()=>selectPlace(searchResults[+el.dataset.i]));
}
function selectPlace(p){selected=p;document.getElementById('selectedPlace').innerHTML=`<b>${esc(p.name)}</b><br><small>${esc(p.display)}</small>`;document.getElementById('suggestions').classList.add('hidden');map.setView([p.lat,p.lng],10,{animate:false})}
document.getElementById('searchBtn').onclick=runSearch;
searchInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runSearch()}});

function volume(){return +document.getElementById('volumeRange').value/100}
let syntheticContext=null;
let syntheticOscillators=[];
function stopSynthetic(){
  for(const osc of syntheticOscillators){try{osc.stop()}catch(e){}}
  syntheticOscillators=[];
}
function stopAudio(){
  ['airSound','droneSound','allClearSound','ruAirSound','ruDroneSound','ruMissileSound','ruChemicalSound','ruNuclearSound'].forEach(id=>{
    const a=document.getElementById(id);if(a){a.pause();a.currentTime=0}
  });
  stopSynthetic();
}
// Original short sound effects. Keep just a few notes playing in sequence even when 51
// different simulated scenarios are displayed at once, to avoid 51 overlapping sirens.
function playSyntheticSet(kinds){
  const C=window.AudioContext||window.webkitAudioContext;
  if(!C){const fallback=document.getElementById('ruAirSound');if(fallback){fallback.volume=volume();fallback.play().catch(()=>{})}return}
  try{
    if(!syntheticContext)syntheticContext=new C();
    if(syntheticContext.state==='suspended')syntheticContext.resume().catch(()=>{});
    const patterns={
      alarm:[[540,0.18],[730,0.18],[540,0.2]],
      ghost:[[470,0.2],[320,0.21],[240,0.3]],
      radio:[[790,0.08],[940,0.08],[670,0.1],[1020,0.14]],
      ufo:[[310,0.22],[520,0.22],[790,0.25]],
      boing:[[680,0.09],[280,0.26],[190,0.21]],
      goose:[[450,0.13],[590,0.11],[450,0.17]],
      buzz:[[930,0.08],[1030,0.07],[880,0.1],[980,0.12]],
      magic:[[430,0.13],[540,0.14],[670,0.16],[860,0.18]],
      march:[[360,0.13],[360,0.11],[510,0.19]],
      pop:[[760,0.06],[400,0.09],[240,0.14]],
      chirp:[[1000,0.09],[1300,0.08],[1100,0.13]],
      bell:[[900,0.13],[740,0.3]],
      tune:[[523,0.13],[659,0.13],[784,0.2]],
      air:[[520,0.25],[710,0.25]],
      missile:[[800,0.12],[480,0.19],[280,0.2]],
      chemical:[[700,0.12],[850,0.12],[580,0.22]],
      nuclear:[[330,0.27],[280,0.27],[220,0.3]]
    };
    let t=syntheticContext.currentTime+.035;
    for(const k of kinds.slice(0,5)){
      const type=ruById[k]?.sound||k;
      const sequence=patterns[type]||patterns.tune;
      for(const [frequency,duration] of sequence){
        const osc=syntheticContext.createOscillator();
        const gain=syntheticContext.createGain();
        osc.type=(type==='ghost'||type==='ufo')?'sine':(type==='buzz'?'sawtooth':'triangle');
        osc.frequency.setValueAtTime(frequency,t);
        if(type==='ufo'||type==='boing'||type==='ghost')osc.frequency.exponentialRampToValueAtTime(Math.max(90,frequency*.72),t+duration);
        gain.gain.setValueAtTime(.0001,t);
        gain.gain.exponentialRampToValueAtTime(Math.max(.0001,Math.min(.09,volume()*.09)),t+.02);
        gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
        osc.connect(gain);gain.connect(syntheticContext.destination);
        osc.start(t);osc.stop(t+duration+.01);syntheticOscillators.push(osc);
        t+=duration+.035;
      }
      t+=.13;
    }
  }catch(e){/* Browser may block sound until a user taps the button. */}
}
// Prepare audio while the click is still a user gesture. Country boundaries
// download asynchronously, and many mobile browsers block audio if we wait.
function primeAlarmAudio(){
  const C=window.AudioContext||window.webkitAudioContext;
  if(!C)return;
  try{
    if(!syntheticContext)syntheticContext=new C();
    if(syntheticContext.state==='suspended')syntheticContext.resume().catch(()=>{});
  }catch(e){/* Browsers without Web Audio use the existing recordings. */}
}

// Cinematic fictional mass-alert sound: distant rumble, eerie rising wail,
// periodic warning siren and deep impacts. Original Web Audio synthesis,
// with a gentle master level and fade-out to avoid startling volume spikes.
function playDreadAlarm(){
  const C=window.AudioContext||window.webkitAudioContext;
  if(!C){const fallback=document.getElementById('ruAirSound');if(fallback){fallback.volume=volume();fallback.play().catch(()=>{})}return}
  try{
    primeAlarmAudio();
    if(!syntheticContext)return;
    const ctx=syntheticContext;
    const t0=ctx.currentTime+.04;
    const duration=9;
    const volumeLevel=Math.min(.5,Math.max(0,volume()*.5));
    const master=ctx.createGain();
    const limiter=ctx.createDynamicsCompressor();
    limiter.threshold.value=-21;
    limiter.knee.value=13;
    limiter.ratio.value=7;
    limiter.attack.value=.006;
    limiter.release.value=.24;
    master.gain.setValueAtTime(0,t0);
    master.gain.linearRampToValueAtTime(volumeLevel,t0+.65);
    master.gain.setValueAtTime(volumeLevel,t0+duration-1);
    master.gain.linearRampToValueAtTime(0,t0+duration);
    master.connect(limiter);
    limiter.connect(ctx.destination);

    function eerieTone(type,f0,f1,offset,length,level,attack=.13){
      const start=t0+offset;
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type=type;
      osc.frequency.setValueAtTime(f0,start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(25,f1),start+length);
      gain.gain.setValueAtTime(0,start);
      gain.gain.linearRampToValueAtTime(level,start+Math.min(attack,length*.35));
      gain.gain.setValueAtTime(level,start+Math.max(attack,length-.2));
      gain.gain.linearRampToValueAtTime(0,start+length);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start+length+.02);
      syntheticOscillators.push(osc);
    }

    // Heavy, detuned subterranean drone and an uneasy falling harmony.
    eerieTone('sawtooth',59,47,0,duration,.19,.8);
    eerieTone('triangle',83,70,.12,duration-.12,.2,.9);
    eerieTone('sine',217,146,.7,7.5,.13,.7);
    eerieTone('sine',228,153,1,7.2,.11,.8);

    // Slow repeating emergency siren, with a rising and falling pitch.
    for(let i=0;i<8;i++){
      const start=t0+1.35+i*.84;
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type='sawtooth';
      osc.frequency.setValueAtTime(320,start);
      osc.frequency.exponentialRampToValueAtTime(705,start+.38);
      osc.frequency.exponentialRampToValueAtTime(315,start+.79);
      gain.gain.setValueAtTime(0,start);
      gain.gain.linearRampToValueAtTime(.085,start+.13);
      gain.gain.setValueAtTime(.085,start+.66);
      gain.gain.linearRampToValueAtTime(0,start+.81);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start+.83);
      syntheticOscillators.push(osc);
    }

    // Distant cinematic alarm impacts, softened by an envelope.
    [0.5,3.1,5.8,7.65].forEach((offset,i)=>{
      eerieTone('sine',95-i*4,36,offset,1.05,.48,.018);
      eerieTone('triangle',150,45,offset,.46,.16,.01);
    });

    // Low filtered wind-like noise for atmosphere, synthesized locally.
    const noiseLength=Math.round(ctx.sampleRate*1.8);
    const noise=ctx.createBuffer(1,noiseLength,ctx.sampleRate);
    const data=noise.getChannelData(0);
    let previous=0;
    for(let i=0;i<noiseLength;i++){
      previous=(previous*.95)+((Math.random()*2-1)*.05);
      data[i]=previous;
    }
    const wind=ctx.createBufferSource();
    const windFilter=ctx.createBiquadFilter();
    const windLevel=ctx.createGain();
    wind.buffer=noise;
    wind.loop=true;
    windFilter.type='lowpass';
    windFilter.frequency.value=690;
    windLevel.gain.value=.19;
    wind.connect(windFilter);
    windFilter.connect(windLevel);
    windLevel.connect(master);
    wind.start(t0);
    wind.stop(t0+duration+.01);
    syntheticOscillators.push(wind);
  }catch(e){/* Keep the map usable if the browser blocks generated audio. */}
}
function playThreat(k){
  stopAudio();
  const ruSounds={air:'ruAirSound',drone:'ruDroneSound',missile:'ruMissileSound',strike:'ruMissileSound',chemical:'ruChemicalSound',nuclear:'ruNuclearSound'};
  const scenario=ruById[k];
  if(scenario && !ruSounds[scenario.sound]){playSyntheticSet([k]);return}
  const type=scenario?.sound||k;
  const id=currentCountry==='ru'?(ruSounds[type]||'ruAirSound'):(type==='drone'?'droneSound':'airSound');
  const a=document.getElementById(id);
  if(a){a.volume=volume();a.play().catch(()=>playSyntheticSet([k]))}
}
function playThreatSet(kinds){
  if(kinds.length===1){playThreat(kinds[0]);return}
  stopAudio();
  if(currentCountry==='ru'&&kinds.length>=7){
    playDreadAlarm();
    return;
  }
  playSyntheticSet(kinds);
}
function playClear(){stopAudio();const a=document.getElementById('allClearSound');a.volume=volume();a.play().catch(()=>{})}
document.getElementById('volumeRange').oninput=e=>document.getElementById('volumeValue').textContent=e.target.value+'%';



const selectedRuScenarios=new Set();
const ruScenarioList=document.getElementById('ruScenarioList');
const ruScenarioSearch=document.getElementById('ruScenarioSearch');
function updateRuCount(){
  document.getElementById('ruSelectedCount').textContent='Обрано: '+selectedRuScenarios.size+' із '+ruScenarios.length;
}
function renderRuScenarioList(){
  const q=String(ruScenarioSearch.value||'').toLocaleLowerCase('uk');
  const list=ruScenarios.filter(s=>(s.label+' '+s.caption).toLocaleLowerCase('uk').includes(q));
  let previous='';
  ruScenarioList.innerHTML=list.map(s=>{
    const heading=s.group!==previous?'<h3 class="ru-picker-heading">'+esc(s.group)+'</h3>':'';
    previous=s.group;
    return heading+'<label class="ru-option"><input type="checkbox" value="'+esc(s.id)+'" '+(selectedRuScenarios.has(s.id)?'checked':'')+'><span>'+esc(s.label)+'</span></label>';
  }).join('')||'<p class="small">За таким запитом нічого не знайдено.</p>';
  ruScenarioList.querySelectorAll('input[type="checkbox"]').forEach(box=>{
    box.addEventListener('change',()=>{
      if(box.checked)selectedRuScenarios.add(box.value);
      else selectedRuScenarios.delete(box.value);
      updateRuCount();
    });
  });
  updateRuCount();
}
ruScenarioSearch.addEventListener('input',renderRuScenarioList);
document.getElementById('ruSelectAll').onclick=()=>{
  ruScenarios.forEach(s=>selectedRuScenarios.add(s.id));
  renderRuScenarioList();
};
document.getElementById('ruClearSelection').onclick=()=>{
  selectedRuScenarios.clear();
  renderRuScenarioList();
};
function refreshRuThreatSelect(){
  const sel=document.getElementById('threatSelect');
  sel.querySelectorAll('optgroup.ru-scenario-options').forEach(g=>g.remove());
  if(currentCountry==='ru'){
    let group=document.createElement('optgroup');
    group.label='🇷🇺 Мемні та спеціальні сценарії';
    group.className='ru-scenario-options';
    for(const s of ruScenarios){
      const opt=document.createElement('option');
      opt.value=s.id;opt.textContent=s.label;group.appendChild(opt);
    }
    sel.appendChild(group);
  }else if(ruById[sel.value])sel.value='air';
}
renderRuScenarioList();

const boundaryCache=new Map();

function polygonGeometry(g){
  return !!g && (g.type==='Polygon' || g.type==='MultiPolygon');
}
function normalizeName(s){
  return String(s||'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
}
function regionNameOf(p){
  const a=p.address||{};
  return a.state||a.region||a.province||
    ((String(p.display||'').match(/([^,]+ область)/i)||[])[1]||'');
}
function osmLookupId(p){
  const t={relation:'R',way:'W',node:'N'}[p.osm_type];
  return t&&p.osm_id ? t+p.osm_id : '';
}
async function fetchSelectedBoundary(p){
  if(polygonGeometry(p.geojson)) return p.geojson;
  const oid=osmLookupId(p);
  if(!oid) return null;
  try{
    const u=new URL('https://nominatim.openstreetmap.org/lookup');
    u.searchParams.set('format','jsonv2');
    u.searchParams.set('osm_ids',oid);
    u.searchParams.set('polygon_geojson','1');
    u.searchParams.set('addressdetails','1');
    u.searchParams.set('namedetails','1');
    u.searchParams.set('accept-language','uk');
    const r=await fetch(u);
    if(!r.ok) return null;
    const d=await r.json();
    return polygonGeometry(d?.[0]?.geojson)?d[0].geojson:null;
  }catch(e){ return null; }
}
async function fetchUkraineBoundaryExact(){
  const cacheKey='country:osm:R60199';
  if(boundaryCache.has(cacheKey)) return boundaryCache.get(cacheKey);
  try{
    const u=new URL('https://nominatim.openstreetmap.org/lookup');
    u.searchParams.set('format','jsonv2');
    u.searchParams.set('osm_ids','R60199');
    u.searchParams.set('polygon_geojson','1');
    u.searchParams.set('addressdetails','1');
    u.searchParams.set('accept-language','uk');
    const r=await fetch(u);
    if(!r.ok) return null;
    const d=await r.json();
    const g=d?.[0]?.geojson;
    const boundary=polygonGeometry(g)?g:null;
    boundaryCache.set(cacheKey,boundary);
    return boundary;
  }catch(e){
    return null;
  }
}

async function fetchRussiaBoundaryExact(){
  const cacheKey='country:osm:R60189:simplified';
  if(boundaryCache.has(cacheKey))return boundaryCache.get(cacheKey);
  try{
    // Russia has a very detailed multipolygon. Nominatim simplifies it while
    // preserving topology, reducing lag on phones and older laptops.
    const u=new URL('https://nominatim.openstreetmap.org/lookup');
    u.searchParams.set('format','jsonv2');
    u.searchParams.set('osm_ids','R60189');
    u.searchParams.set('polygon_geojson','1');
    u.searchParams.set('polygon_threshold','0.03');
    u.searchParams.set('accept-language','uk');
    const r=await fetch(u);if(!r.ok)throw new Error('boundary '+r.status);
    const d=await r.json(),g=d?.[0]?.geojson;
    const boundary=polygonGeometry(g)?g:null;
    if(boundary)boundaryCache.set(cacheKey,boundary);
    return boundary;
  }catch(e){return null}
}
async function searchAdminBoundary(name,context='',mode='place'){
  if(!name) return null;
  try{
    const u=new URL('https://nominatim.openstreetmap.org/search');
    u.searchParams.set('format','jsonv2');
    u.searchParams.set('q',[name,context,currentCountry==='ru'?'Россия':'Україна'].filter(Boolean).join(', '));
    u.searchParams.set('countrycodes',currentCountry);
    u.searchParams.set('addressdetails','1');
    u.searchParams.set('namedetails','1');
    u.searchParams.set('polygon_geojson','1');
    u.searchParams.set('limit','12');
    u.searchParams.set('accept-language','uk');
    const r=await fetch(u);
    if(!r.ok) return null;
    const d=await r.json();
    const target=normalizeName(name);
    const polys=d.filter(x=>polygonGeometry(x.geojson));
    polys.sort((a,b)=>{
      const an=normalizeName((a.namedetails&&a.namedetails.name)||a.display_name?.split(',')[0]);
      const bn=normalizeName((b.namedetails&&b.namedetails.name)||b.display_name?.split(',')[0]);
      const aExact=an===target?1:0,bExact=bn===target?1:0;
      const aAdmin=(a.class==='boundary'||a.type==='administrative')?1:0;
      const bAdmin=(b.class==='boundary'||b.type==='administrative')?1:0;
      const aRegion=mode==='wide' && /state|province|region|administrative/i.test(a.addresstype||'') ? 1:0;
      const bRegion=mode==='wide' && /state|province|region|administrative/i.test(b.addresstype||'') ? 1:0;
      return (bExact*8+bAdmin*4+bRegion*2)-(aExact*8+aAdmin*4+aRegion*2);
    });
    return polys[0]?.geojson||null;
  }catch(e){ return null; }
}
async function resolveBoundary(p,scope){
  const key=scope+':'+(p?.osm_type||'')+':'+(p?.osm_id||p?.name||p?.display||'ukraine');
  if(scope==='country'){
    return currentCountry==='ua'?await fetchUkraineBoundaryExact():await fetchRussiaBoundaryExact();
  }
  if(boundaryCache.has(key)) return boundaryCache.get(key);

  let boundary=null;
  const region=regionNameOf(p);

  if(scope==='wide'){
    if(region) boundary=await searchAdminBoundary(region,'','wide');
  }else{
    boundary=await fetchSelectedBoundary(p);
    if(!boundary) boundary=await searchAdminBoundary(p.name,region,'place');
  }

  boundaryCache.set(key,boundary);
  return boundary;
}

function removeZone(k){if(zones[k]){map.removeLayer(zones[k]);delete zones[k]}}
function addZone(k,a){
  const color=colorFor(a.kind),cls=a.kind==='drone'?'fx-yellow':a.kind==='chemical'?'fx-violet':a.kind==='nuclear'?'fx-orange':'fx-red';

  const boundary=a.boundary || (a.scope==='place' && polygonGeometry(a.place.geojson) ? a.place.geojson : null);

  if(a.scope==='country'){
    if(!boundary){ zones[k]=null; return; }
    zones[k]=L.geoJSON(boundary,{
      style:{
        color,
        weight:3,
        opacity:1,
        fillColor:color,
        fillOpacity:.30,
        className:cls
      }
    }).addTo(map);
    return;
  }
  if(boundary){
    zones[k]=L.geoJSON(boundary,{
      style:{
        color,
        weight:3,
        opacity:1,
        fillColor:color,
        fillOpacity:.30,
        className:cls
      }
    }).addTo(map);
    return;
  }

  // Never paint a square/large circle when an administrative boundary was requested.
  zones[k]=null;
}
function save(){
  const clean={};
  for(const [k,a] of Object.entries(activeAlerts)){
    const place={...a.place};
    delete place.geojson;
    clean[k]={...a,place};
    delete clean[k].boundary;
  }
  localStorage.setItem(alertStorageKey(),JSON.stringify(clean));
  renderActive();
}
function showBanner(a){
  const b=document.getElementById('banner');
  const kinds=a.kinds?.length?a.kinds:[a.kind];
  b.className='banner '+(a.kind==='drone'?'yellow':'red');
  const placeName=a.scope==='country'?(currentCountry==='ru'?'Вся Росія':'Вся Україна'):a.place.name;
  b.textContent=(currentCountry==='ru'?'🎭 ':'')+(kinds.length>1?kinds.length+' загроз одночасно':kindLabel(a.kind))+' — '+placeName+
    (currentCountry==='ru'&&kinds.length===1?' · '+memeFor(a.kind,a.place):'');
  setTimeout(()=>b.classList.add('hidden'),6500);
}
function refreshMarker(k,p){if(!markers[k])markers[k]=L.marker([p.lat,p.lng],{icon:safeIcon()}).addTo(map);const a=activeAlerts[k];markers[k].setIcon(a?alertIcon(a.kind):safeIcon());const kinds=a?.kinds?.length?a.kinds:[a?.kind];markers[k].bindPopup('<b>'+esc(p.name)+'</b><br>'+(a?(kinds.length>1?kinds.length+' активних сценаріїв':esc(kindLabel(a.kind))):'Немає ручної загрози')+(a&&currentCountry==='ru'?'<br><small>Мемна карта · не справжня тривога</small>':'') )}
const uaCountryPlace={name:'Україна',display:'Вся Україна',lat:49.1,lng:31.2,osm_type:'country_sim',osm_id:60199};
async function startAlert(kindsOverride=null,forcedScope=null){
  const scope=forcedScope||document.getElementById('scopeSelect').value;
  if(scope!=='country'&&!selected){
    alert('Спочатку знайди і вибери місто або район. Для всієї країни вибери «Вся Росія» або «Вся Україна».');
    return;
  }
  const place=scope==='country'?(currentCountry==='ru'?ruCountryPlace:uaCountryPlace):selected;
  const kinds=Array.isArray(kindsOverride)&&kindsOverride.length
    ? [...new Set(kindsOverride.filter(x=>currentCountry==='ru' && ruById[x]))]
    : [document.getElementById('threatSelect').value];
  if(!kinds.length){alert('Спочатку вибери хоча б один сценарій.');return}
  primeAlarmAudio();
  if(currentCountry==='ua'&&kinds.some(k=>ruById[k])){alert('Мемні сценарії доступні лише для карти Росії.');return}
  const kind=kinds[0];
  const k=scope==='country'?(currentCountry+':country'):keyOf(place);
  const btn=document.getElementById('startBtn');
  const batchBtn=document.getElementById('ruStartSelected');
  const oldText=btn.textContent;
  btn.disabled=true;batchBtn.disabled=true;
  btn.textContent=scope==='country'?'Завантаження кордону…':'Завантаження межі…';
  try{
    const modeAtStart=currentCountry;
    const boundary=await resolveBoundary(place,scope);
    if(modeAtStart!==currentCountry)return;
    if(!boundary){
      alert(scope==='country'
        ?'Не вдалося отримати межі країни. Перевір інтернет і спробуй ще раз через декілька секунд.'
        :scope==='wide'
          ?'Не вдалося знайти точну межу області. Вибери інше місто або район у пошуку.'
          :'Не вдалося знайти точну адміністративну межу цього міста або району. Вибери інший результат пошуку.');
      return;
    }
    removeZone(k);
    activeAlerts[k]={place,kind,kinds,scope,time:new Date().toISOString(),boundary};
    save();
    if(scope!=='country')refreshMarker(k,place);
    addZone(k,activeAlerts[k]);
    playThreatSet(kinds);
    showBanner(activeAlerts[k]);
    if(zones[k]&&typeof zones[k].getBounds==='function'){
      try{map.fitBounds(zones[k].getBounds(),{padding:[18,18],animate:false,maxZoom:scope==='country'?(currentCountry==='ru'?4:7):11})}
      catch(e){map.setView([place.lat,place.lng],scope==='country'?3:9,{animate:false})}
    }
  }finally{btn.disabled=false;batchBtn.disabled=false;btn.textContent=oldText}
}
function stopOne(k,play=true){
  const a=activeAlerts[k];if(!a)return;
  delete activeAlerts[k];removeZone(k);
  if(a.scope!=='country')refreshMarker(k,a.place);
  save();if(play)playClear();
}
document.getElementById('startBtn').onclick=()=>startAlert();
document.getElementById('stopBtn').onclick=()=>{
  const scope=document.getElementById('scopeSelect').value;
  if(scope==='country')stopOne(currentCountry+':country',true);
  else if(selected)stopOne(keyOf(selected),true);
};
document.getElementById('stopAllBtn').onclick=()=>{
  const ks=Object.keys(activeAlerts);
  ks.forEach(k=>stopOne(k,false));
  if(ks.length)playClear();
};
document.getElementById('ruAllQuick').onclick=async()=>{
  document.getElementById('scopeSelect').value='country';
  await startAlert(null,'country');
};
document.getElementById('ruStartSelected').onclick=async()=>{
  if(!selectedRuScenarios.size){alert('Вибери хоча б одну тривогу зі списку.');return}
  await startAlert([...selectedRuScenarios]);
};
document.getElementById('ruStopSelected').onclick=()=>{
  const scope=document.getElementById('scopeSelect').value;
  if(scope==='country')stopOne('ru:country',true);
  else if(selected)stopOne(keyOf(selected),true);
  else alert('Спочатку вибери місце або масштаб «Вся Росія».');
};
function renderActive(){
  const b=document.getElementById('activeList'),es=Object.entries(activeAlerts);
  if(!es.length){b.textContent='Немає активних загроз.';return}
  b.innerHTML=es.map(([k,a])=>{
    const kinds=a.kinds?.length?a.kinds:[a.kind];
    const main=kinds.slice(0,3).map(x=>'<div>'+esc(kindLabel(x))+'</div>').join('');
    const extras=kinds.length>3?'<details class="ru-more-threats"><summary>Показати ще '+(kinds.length-3)+' загроз</summary><div>'+kinds.slice(3).map(x=>'<div>'+esc(kindLabel(x))+'</div>').join('')+'</div></details>':'';
    const caption=currentCountry==='ru'&&kinds.length===1?'<div class="meme-caption">'+esc(memeFor(a.kind,a.place))+'</div>':'';
    return '<div class="active-item '+(a.kind==='drone'?'drone':'')+'"><b>'+esc(a.scope==='country'?(currentCountry==='ru'?'Вся Росія':'Вся Україна'):a.place.name)+'</b><div class="ru-active-count">'+kinds.length+' сценаріїв</div>'+main+extras+caption+'<button data-k="'+esc(k)+'" type="button">Відбій</button></div>';
  }).join('');
  b.querySelectorAll('button[data-k]').forEach(x=>x.onclick=()=>stopOne(x.dataset.k,true));
}

async function restoreActiveAlerts(){
  const modeAtStart=currentCountry;
  for(const [k,a] of Object.entries(activeAlerts)){
    if(currentCountry!==modeAtStart)return;
    a.boundary=await resolveBoundary(a.place,a.scope);
    if(currentCountry!==modeAtStart)return;
    if(a.scope!=='country')refreshMarker(k,a.place);
    addZone(k,a);
  }
  if(currentCountry===modeAtStart)renderActive();
}
restoreActiveAlerts();

async function switchCountry(mode){
  if(mode===currentCountry)return;
  stopAudio();
  for(const [k,z] of Object.entries(zones)){if(z&&map.hasLayer(z))map.removeLayer(z);delete zones[k]}
  for(const [k,m] of Object.entries(markers)){if(m&&map.hasLayer(m))map.removeLayer(m);delete markers[k]}
  currentCountry=mode;
  activeAlerts=JSON.parse(localStorage.getItem(alertStorageKey())||'{}');
  selected=null;searchResults=[];searchInput.value='';
  document.getElementById('suggestions').classList.add('hidden');
  document.getElementById('selectedPlace').textContent='Місце ще не вибрано';
  searchInput.placeholder=mode==='ru'?'Місто, район або область Росії':'Місто, село або район України';
  document.getElementById('searchStatus').textContent=mode==='ru'?'Шукайте місто, район або область Росії':'Введи назву і натисни «Знайти»';
  document.getElementById('countryUkraine').classList.toggle('active',mode==='ua');
  document.getElementById('countryRussia').classList.toggle('active',mode==='ru');
  document.getElementById('countryUkraine').setAttribute('aria-pressed',String(mode==='ua'));
  document.getElementById('countryRussia').setAttribute('aria-pressed',String(mode==='ru'));
  document.getElementById('countryChip').textContent=mode==='ru'?'Росія · меми':'Україна';
  document.getElementById('countryNotice').textContent=mode==='ru'?'Увімкни тривогу для міста, області або всієї Росії. Це мемний ручний режим, не реальні повідомлення.':'В Україні тривоги вмикаються вручну. Реальний стан — за кнопкою нижче.';
  document.getElementById('ukraineLiveCard').classList.toggle('hidden',mode==='ru');
  document.getElementById('russiaMemeInfo').classList.toggle('hidden',mode!=='ru');
  document.getElementById('ruMultiCard').classList.toggle('hidden',mode!=='ru');
  document.getElementById('ruAllQuick').classList.toggle('hidden',mode!=='ru');
  document.getElementById('scopeCountry').textContent=mode==='ru'?'Вся Росія':'Вся Україна';
  if(document.getElementById('scopeSelect').value==='country')document.getElementById('scopeSelect').value='place';
  refreshRuThreatSelect();
  document.getElementById('panelModeTitle').textContent=mode==='ru'?'Мемна карта Росії':'Керування картою';
  document.getElementById('mapSafetyNote').textContent=mode==='ru'?'Мемна карта · не офіційні тривоги':'Симулятор — не офіційне оповіщення';
  map.setView(mode==='ru'?[57,65]:[49.1,31.2],mode==='ru'?3:6,{animate:false});
  await restoreActiveAlerts();
}
document.getElementById('countryUkraine').addEventListener('click',()=>switchCountry('ua'));
document.getElementById('countryRussia').addEventListener('click',()=>switchCountry('ru'));

window.addEventListener('load',()=>setTimeout(()=>map.invalidateSize(false),100));



/* Compact donation panel on desktop */
const supportWrap=document.getElementById('support');
const supportToggle=document.getElementById('supportToggle');
const headerSupport=document.querySelector('.header-support');

function setSupportOpen(open){
  if(!supportWrap||!supportToggle)return;
  supportWrap.classList.toggle('open',open);
  supportToggle.setAttribute('aria-expanded',String(open));
  setTimeout(()=>map.invalidateSize(false),260);
}

supportToggle?.addEventListener('click',()=>{
  setSupportOpen(!supportWrap.classList.contains('open'));
});

headerSupport?.addEventListener('click',e=>{
  if(window.innerWidth>850){
    e.preventDefault();
    setSupportOpen(true);
  }
});

window.addEventListener('resize',()=>{
  if(window.innerWidth<=850){
    supportWrap?.classList.add('open');
  }else if(supportWrap && !supportToggle?.matches(':focus')){
    supportWrap.classList.remove('open');
    supportToggle?.setAttribute('aria-expanded','false');
  }
});

if(window.innerWidth<=850){
  supportWrap?.classList.add('open');
}

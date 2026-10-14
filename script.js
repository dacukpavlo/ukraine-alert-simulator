const map=L.map('map',{zoomControl:true,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView([49.1,31.2],6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,minZoom:4,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);

const uaAlertBoundaryVersion='2026-10-12-border-v3';
if(localStorage.getItem('uaAlertBoundaryVersion')!==uaAlertBoundaryVersion){
  localStorage.removeItem('uaAlertSim');
  localStorage.setItem('uaAlertBoundaryVersion',uaAlertBoundaryVersion);
}
let selected=null,searchResults=[],activeAlerts=JSON.parse(localStorage.getItem('uaAlertSim')||'{}');
const markers={},zones={};
const searchInput=document.getElementById('placeSearch');
const geoUkraine=document.getElementById('geoUkraine');
const geoWorld=document.getElementById('geoWorld');
const scopeSelect=document.getElementById('scopeSelect');
let geoMode=localStorage.getItem('uaAlertGeoMode')||'ukraine';

function countryNameOf(p){
  const a=p?.address||{};
  return a.country || (p?.addresstype==='country'?p.name:'') || '';
}
function applyGeoMode(mode,resetView=true){
  geoMode=mode==='world'?'world':'ukraine';
  localStorage.setItem('uaAlertGeoMode',geoMode);

  geoUkraine?.classList.toggle('active',geoMode==='ukraine');
  geoWorld?.classList.toggle('active',geoMode==='world');
  geoUkraine?.setAttribute('aria-pressed',String(geoMode==='ukraine'));
  geoWorld?.setAttribute('aria-pressed',String(geoMode==='world'));

  selected=null;
  searchResults=[];
  searchInput.value='';
  document.getElementById('suggestions')?.classList.add('hidden');
  document.getElementById('selectedPlace').textContent='Місце ще не вибрано';

  if(geoMode==='ukraine'){
    searchInput.placeholder='Місто, село або район';
    document.getElementById('searchStatus').textContent='Пошук тільки по Україні';
    scopeSelect.options[0].text='Місто / район';
    scopeSelect.options[1].text='Вся область';
    scopeSelect.options[2].text='Вся Україна';
    document.querySelector('.header-chip').innerHTML='<span class="header-dot"></span> Україна';
    if(resetView)map.setView([49.1,31.2],6,{animate:false});
  }else{
    searchInput.placeholder='Місто, село, район або країна';
    document.getElementById('searchStatus').textContent='Пошук по всьому світу';
    scopeSelect.options[0].text='Місто / район';
    scopeSelect.options[1].text='Весь регіон / штат';
    scopeSelect.options[2].text='Вся країна';
    document.querySelector('.header-chip').innerHTML='<span class="header-dot"></span> Весь світ';
    if(resetView)map.setView([20,0],2,{animate:false});
  }
}
geoUkraine?.addEventListener('click',()=>applyGeoMode('ukraine'));
geoWorld?.addEventListener('click',()=>applyGeoMode('world'));

function kindLabel(k){return {air:'Повітряна тривога',drone:'Загроза БпЛА / Shahed',missile:'Ракетна загроза',strike:'Загроза ракетного удару'}[k]||k}
function colorFor(k){return k==='drone'?'#ffd21f':'#ef3340'}
function safeIcon(){return L.divIcon({className:'',html:'<div class="safe-dot"></div>',iconSize:[18,18],iconAnchor:[9,9]})}
function alertIcon(k){const c=k==='drone'?'yellow':'red';return L.divIcon({className:'',html:`<div class="alert-dot ${c}"><div class="pulse"></div><div class="core"></div></div>`,iconSize:[32,32],iconAnchor:[16,16]})}
function keyOf(p){return (p.osm_type||'x')+':'+(p.osm_id||p.lat+','+p.lng)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

async function runSearch(){
  const q=searchInput.value.trim();
  if(q.length<2){document.getElementById('searchStatus').textContent='Введи мінімум 2 літери';return}
  document.getElementById('searchStatus').textContent='Пошук…';
  try{
    const u=new URL('https://nominatim.openstreetmap.org/search');
    u.searchParams.set('format','jsonv2');
    u.searchParams.set('q',geoMode==='ukraine'?q+', Україна':q);
    if(geoMode==='ukraine')u.searchParams.set('countrycodes','ua');
    u.searchParams.set('addressdetails','1');u.searchParams.set('namedetails','1');u.searchParams.set('polygon_geojson','1');u.searchParams.set('limit','10');u.searchParams.set('accept-language','uk,en');
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

async function selectFromMap(lat,lng){
  const status=document.getElementById('searchStatus');
  status.textContent='Визначаю місце на карті…';
  try{
    const u=new URL('https://nominatim.openstreetmap.org/reverse');
    u.searchParams.set('format','jsonv2');
    u.searchParams.set('lat',lat);
    u.searchParams.set('lon',lng);
    u.searchParams.set('zoom','10');
    u.searchParams.set('addressdetails','1');
    u.searchParams.set('namedetails','1');
    u.searchParams.set('accept-language','uk,en');
    const r=await fetch(u);
    if(!r.ok)throw new Error();
    const x=await r.json();

    const code=(x.address?.country_code||'').toLowerCase();
    if(geoMode==='ukraine' && code!=='ua'){
      status.textContent='У режимі «Україна» можна вибирати тільки територію України';
      return;
    }

    const p={
      name:(x.namedetails&&x.namedetails.name)||x.name||x.display_name?.split(',')[0]||'Вибране місце',
      display:x.display_name||'',
      lat:+x.lat,
      lng:+x.lon,
      osm_type:x.osm_type,
      osm_id:x.osm_id,
      bbox:x.boundingbox?.map(Number),
      geojson:x.geojson||null,
      type:x.type||'',
      class:x.class||'',
      addresstype:x.addresstype||'',
      address:x.address||{}
    };
    selectPlace(p);
    status.textContent='Місце вибрано з карти';
  }catch(e){
    status.textContent='Не вдалося визначити місце. Спробуй пошук за назвою';
  }
}

map.on('click',e=>{
  selectFromMap(e.latlng.lat,e.latlng.lng);
});

function volume(){return +document.getElementById('volumeRange').value/100}
function stopAudio(){['airSound','droneSound','allClearSound'].forEach(id=>{const a=document.getElementById(id);a.pause();a.currentTime=0})}
function playThreat(k){stopAudio();const a=document.getElementById(k==='drone'?'droneSound':'airSound');a.volume=volume();a.play().catch(()=>{})}
function playClear(){stopAudio();const a=document.getElementById('allClearSound');a.volume=volume();a.play().catch(()=>{})}
document.getElementById('volumeRange').oninput=e=>document.getElementById('volumeValue').textContent=e.target.value+'%';


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

async function fetchCountryBoundary(p){
  const country=countryNameOf(p);
  if(!country)return null;
  if(normalizeName(country)==='україна' || normalizeName(country)==='ukraine'){
    return await fetchUkraineBoundaryExact();
  }
  const cacheKey='country:'+normalizeName(country);
  if(boundaryCache.has(cacheKey))return boundaryCache.get(cacheKey);
  const boundary=await searchAdminBoundary(country,'','country',country);
  boundaryCache.set(cacheKey,boundary);
  return boundary;
}

async function searchAdminBoundary(name,context='',mode='place',country=''){
  if(!name) return null;
  try{
    const u=new URL('https://nominatim.openstreetmap.org/search');
    u.searchParams.set('format','jsonv2');
    const locationParts=[name,context];
    if(country && normalizeName(country)!==normalizeName(name))locationParts.push(country);
    if(!country && geoMode==='ukraine')locationParts.push('Україна');
    u.searchParams.set('q',locationParts.filter(Boolean).join(', '));
    if(geoMode==='ukraine')u.searchParams.set('countrycodes','ua');
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
async function resolveBoundary(p,scope,alertGeoMode=geoMode){
  const country=countryNameOf(p);
  const key=alertGeoMode+':'+scope+':'+(p?.osm_type||'')+':'+(p?.osm_id||p?.name||p?.display||country||'unknown');

  if(scope==='country'){
    if(alertGeoMode==='ukraine')return await fetchUkraineBoundaryExact();
    return await fetchCountryBoundary(p);
  }
  if(boundaryCache.has(key)) return boundaryCache.get(key);

  let boundary=null;
  const region=regionNameOf(p);

  if(scope==='wide'){
    if(region) boundary=await searchAdminBoundary(region,'','wide',country);
  }else{
    boundary=await fetchSelectedBoundary(p);
    if(!boundary) boundary=await searchAdminBoundary(p.name,region,'place',country);
  }

  boundaryCache.set(key,boundary);
  return boundary;
}

function removeZone(k){if(zones[k]){map.removeLayer(zones[k]);delete zones[k]}}
function addZone(k,a){
  const color=colorFor(a.kind),cls=a.kind==='drone'?'fx-yellow':'fx-red';

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
  localStorage.setItem('uaAlertSim',JSON.stringify(clean));
  renderActive();
}
function showBanner(a){const b=document.getElementById('banner');b.className='banner '+(a.kind==='drone'?'yellow':'red');b.textContent=kindLabel(a.kind)+' — '+(a.scope==='country'?(a.countryName||countryNameOf(a.place)||'Країна'):a.place.name);setTimeout(()=>b.classList.add('hidden'),5000)}
function refreshMarker(k,p){if(!markers[k])markers[k]=L.marker([p.lat,p.lng],{icon:safeIcon()}).addTo(map);const a=activeAlerts[k];markers[k].setIcon(a?alertIcon(a.kind):safeIcon());markers[k].bindPopup(`<b>${esc(p.name)}</b><br>${a?kindLabel(a.kind):'Немає ручної загрози'}`)}
async function startAlert(){
  if(!selected){alert('Спочатку знайди і вибери місце.');return}

  const k=keyOf(selected);
  const kind=document.getElementById('threatSelect').value;
  const scope=document.getElementById('scopeSelect').value;
  const btn=document.getElementById('startBtn');
  const oldText=btn.textContent;

  btn.disabled=true;
  btn.textContent=scope==='country'?'Запуск…':'Завантаження межі…';

  try{
    const boundary=await resolveBoundary(selected,scope,geoMode);

    if(!boundary){
      alert(scope==='country'
        ? (geoMode==='ukraine'
          ? 'Не вдалося завантажити точний державний кордон України. Онови сторінку й спробуй ще раз.'
          : 'Не вдалося завантажити точний кордон вибраної країни. Вибери місто або країну ще раз.')
        : scope==='wide'
          ? (geoMode==='ukraine'
            ? 'Не вдалося знайти точну межу області. Спробуй вибрати місто/район ще раз.'
            : 'Не вдалося знайти точну межу регіону або штату. Спробуй вибрати інший результат пошуку.')
          : 'Не вдалося знайти точну адміністративну межу цього міста або району. Спробуй інший результат у пошуку.');
      return;
    }

    removeZone(k);
    activeAlerts[k]={place:selected,kind,scope,time:new Date().toISOString(),boundary,geoMode,countryName:countryNameOf(selected)};
    save();
    refreshMarker(k,selected);
    addZone(k,activeAlerts[k]);
    playThreat(kind);
    showBanner(activeAlerts[k]);

    if(scope==='country' && zones[k] && typeof zones[k].getBounds==='function'){
      try{map.fitBounds(zones[k].getBounds(),{padding:[18,18],animate:false,maxZoom:7})}
      catch(e){map.setView([selected.lat,selected.lng],scope==='country'?5:9,{animate:false})}
    }else if(zones[k] && typeof zones[k].getBounds==='function'){
      try{map.fitBounds(zones[k].getBounds(),{padding:[28,28],animate:false,maxZoom:11})}
      catch(e){map.setView([selected.lat,selected.lng],9,{animate:false})}
    }
  }finally{
    btn.disabled=false;
    btn.textContent=oldText;
  }
}
function stopOne(k,play=true){const a=activeAlerts[k];if(!a)return;delete activeAlerts[k];removeZone(k);refreshMarker(k,a.place);save();if(play)playClear()}
document.getElementById('startBtn').onclick=startAlert;
document.getElementById('stopBtn').onclick=()=>{if(selected)stopOne(keyOf(selected),true)};
document.getElementById('stopAllBtn').onclick=()=>{const ks=Object.keys(activeAlerts);ks.forEach(k=>stopOne(k,false));if(ks.length)playClear()};

function renderActive(){const b=document.getElementById('activeList'),es=Object.entries(activeAlerts);if(!es.length){b.textContent='Немає активних загроз.';return}b.innerHTML=es.map(([k,a])=>`<div class="active-item ${a.kind==='drone'?'drone':''}"><b>${esc(a.place.name)}</b><br>${kindLabel(a.kind)}<br><button data-k="${esc(k)}">Відбій</button></div>`).join('');b.querySelectorAll('button').forEach(x=>x.onclick=()=>stopOne(x.dataset.k,true))}
async function restoreActiveAlerts(){
  for(const [k,a] of Object.entries(activeAlerts)){
    refreshMarker(k,a.place);
    a.boundary=await resolveBoundary(a.place,a.scope,a.geoMode||'ukraine');
    addZone(k,a);
  }
  renderActive();
}
applyGeoMode(geoMode,false);
restoreActiveAlerts();
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

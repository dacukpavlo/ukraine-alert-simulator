const map=L.map('map',{zoomControl:true,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView([49.1,31.2],6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,minZoom:4,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);

let selected=null,searchResults=[],activeAlerts=JSON.parse(localStorage.getItem('uaAlertSim')||'{}');
const markers={},zones={};
const searchInput=document.getElementById('placeSearch');

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
    u.searchParams.set('format','jsonv2');u.searchParams.set('q',q+', Україна');u.searchParams.set('countrycodes','ua');u.searchParams.set('addressdetails','1');u.searchParams.set('namedetails','1');u.searchParams.set('polygon_geojson','1');u.searchParams.set('limit','10');u.searchParams.set('accept-language','uk');
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
async function searchAdminBoundary(name,context='',mode='place'){
  if(!name) return null;
  try{
    const u=new URL('https://nominatim.openstreetmap.org/search');
    u.searchParams.set('format','jsonv2');
    u.searchParams.set('q',[name,context,'Україна'].filter(Boolean).join(', '));
    u.searchParams.set('countrycodes','ua');
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
  if(scope==='country') return null;
  const key=scope+':'+(p.osm_type||'')+':'+(p.osm_id||p.name||p.display);
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
  const color=colorFor(a.kind),cls=a.kind==='drone'?'fx-yellow':'fx-red';

  if(a.scope==='country'){
    zones[k]=L.rectangle([[44.2,22.0],[52.5,40.3]],{
      color,weight:2,fillColor:color,fillOpacity:.28,className:cls
    }).addTo(map);
    return;
  }

  const boundary=a.boundary || (a.scope==='place' && polygonGeometry(a.place.geojson) ? a.place.geojson : null);
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
function showBanner(a){const b=document.getElementById('banner');b.className='banner '+(a.kind==='drone'?'yellow':'red');b.textContent=kindLabel(a.kind)+' — '+(a.scope==='country'?'Україна':a.place.name);setTimeout(()=>b.classList.add('hidden'),5000)}
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
    const boundary=await resolveBoundary(selected,scope);

    if(scope!=='country' && !boundary){
      alert(scope==='wide'
        ? 'Не вдалося знайти точну межу області. Спробуй вибрати місто/район ще раз.'
        : 'Не вдалося знайти точну адміністративну межу цього міста або району. Спробуй інший результат у пошуку.');
      return;
    }

    removeZone(k);
    activeAlerts[k]={place:selected,kind,scope,time:new Date().toISOString(),boundary};
    save();
    refreshMarker(k,selected);
    addZone(k,activeAlerts[k]);
    playThreat(kind);
    showBanner(activeAlerts[k]);

    if(scope==='country'){
      map.setView([49.1,31.2],6,{animate:false});
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
    if(a.scope!=='country'){
      a.boundary=await resolveBoundary(a.place,a.scope);
    }
    addZone(k,a);
  }
  renderActive();
}
restoreActiveAlerts();
window.addEventListener('load',()=>setTimeout(()=>map.invalidateSize(false),100));


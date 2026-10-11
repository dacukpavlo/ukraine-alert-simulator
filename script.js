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
    u.searchParams.set('format','jsonv2');u.searchParams.set('q',q+', Україна');u.searchParams.set('countrycodes','ua');u.searchParams.set('addressdetails','1');u.searchParams.set('limit','10');u.searchParams.set('accept-language','uk');
    const r=await fetch(u);if(!r.ok)throw new Error();
    const d=await r.json();
    searchResults=d.map(x=>({name:(x.namedetails&&x.namedetails.name)||x.display_name.split(',')[0],display:x.display_name,lat:+x.lat,lng:+x.lon,osm_type:x.osm_type,osm_id:x.osm_id,bbox:x.boundingbox?.map(Number)}));
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

function removeZone(k){if(zones[k]){map.removeLayer(zones[k]);delete zones[k]}}
function addZone(k,a){
  const color=colorFor(a.kind),cls=a.kind==='drone'?'fx-yellow':'fx-red';
  if(a.scope==='country') zones[k]=L.rectangle([[44.2,22.0],[52.5,40.3]],{color,weight:2,fillColor:color,fillOpacity:.28,className:cls}).addTo(map);
  else {
    let d=a.scope==='wide'?1.05:.22;
    if(a.place.bbox&&a.scope==='place'){const b=a.place.bbox;zones[k]=L.rectangle([[b[0],b[2]],[b[1],b[3]]],{color,weight:3,fillColor:color,fillOpacity:.3,className:cls}).addTo(map)}
    else zones[k]=L.rectangle([[a.place.lat-d,a.place.lng-d],[a.place.lat+d,a.place.lng+d]],{color,weight:3,fillColor:color,fillOpacity:.3,className:cls}).addTo(map)
  }
}
function save(){localStorage.setItem('uaAlertSim',JSON.stringify(activeAlerts));renderActive()}
function showBanner(a){const b=document.getElementById('banner');b.className='banner '+(a.kind==='drone'?'yellow':'red');b.textContent=kindLabel(a.kind)+' — '+(a.scope==='country'?'Україна':a.place.name);setTimeout(()=>b.classList.add('hidden'),5000)}
function refreshMarker(k,p){if(!markers[k])markers[k]=L.marker([p.lat,p.lng],{icon:safeIcon()}).addTo(map);const a=activeAlerts[k];markers[k].setIcon(a?alertIcon(a.kind):safeIcon());markers[k].bindPopup(`<b>${esc(p.name)}</b><br>${a?kindLabel(a.kind):'Немає ручної загрози'}`)}
function startAlert(){
  if(!selected){alert('Спочатку знайди і вибери місце.');return}
  const k=keyOf(selected),kind=document.getElementById('threatSelect').value,scope=document.getElementById('scopeSelect').value;
  removeZone(k);activeAlerts[k]={place:selected,kind,scope,time:new Date().toISOString()};save();refreshMarker(k,selected);addZone(k,activeAlerts[k]);playThreat(kind);showBanner(activeAlerts[k]);
  if(scope==='country')map.setView([49.1,31.2],6,{animate:false});else map.setView([selected.lat,selected.lng],scope==='wide'?7:10,{animate:false});
}
function stopOne(k,play=true){const a=activeAlerts[k];if(!a)return;delete activeAlerts[k];removeZone(k);refreshMarker(k,a.place);save();if(play)playClear()}
document.getElementById('startBtn').onclick=startAlert;
document.getElementById('stopBtn').onclick=()=>{if(selected)stopOne(keyOf(selected),true)};
document.getElementById('stopAllBtn').onclick=()=>{const ks=Object.keys(activeAlerts);ks.forEach(k=>stopOne(k,false));if(ks.length)playClear()};

function renderActive(){const b=document.getElementById('activeList'),es=Object.entries(activeAlerts);if(!es.length){b.textContent='Немає активних загроз.';return}b.innerHTML=es.map(([k,a])=>`<div class="active-item ${a.kind==='drone'?'drone':''}"><b>${esc(a.place.name)}</b><br>${kindLabel(a.kind)}<br><button data-k="${esc(k)}">Відбій</button></div>`).join('');b.querySelectorAll('button').forEach(x=>x.onclick=()=>stopOne(x.dataset.k,true))}
for(const [k,a] of Object.entries(activeAlerts)){refreshMarker(k,a.place);addZone(k,a)}renderActive();
window.addEventListener('load',()=>setTimeout(()=>map.invalidateSize(false),100));


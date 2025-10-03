// main.js — GeoChef MVP
// Minimal dependency approach: plain JS. Designed for clarity and local testing.
// Accessibility: main interactive elements have ARIA roles.

const APP = {
  state: {
    panoramas: [], // loaded from panoramas.json
    currentIndex: 0,
    round: 1,
    roundsTotal: 5,
    score: 0,
    lowData: false,
    startTime: null,
    guessLatLon: null
  }
};

// Utilities
function el(q) { return document.querySelector(q) }
function $id(id){ return document.getElementById(id) }

// Haversine (digit-by-digit careful)
function haversine(lat1, lon1, lat2, lon2){
  const toRad = x => x * Math.PI / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.cos(toRad(lat1))*Math.cos(toRad(lat2)) *
            Math.sin(dLon/2)*Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Load panorama dataset
async function loadPanoramas(){
  try{
    const res = await fetch('panoramas.json');
    const data = await res.json();
    APP.state.panoramas = data;
  }catch(e){
    console.error('Failed to load panoramas.json', e);
    APP.state.panoramas = [];
  }
}

// Panorama viewer: uses <img> inside overflow:hidden and transforms translateX/Y
const viewer = {
  container: null,
  img: null,
  dragging: false,
  lastX: 0,
  lastY: 0,
  posX: 0,
  posY: 0,
  scale: 1,
  maxOffsetX: 0,
  maxOffsetY: 0,
  init(container){
    this.container = container;
    this.img = document.createElement('img');
    this.img.alt = 'Panorama image';
    this.img.draggable = false;
    container.appendChild(this.img);
    // pointer events
    container.addEventListener('pointerdown', this.onDown.bind(this));
    window.addEventListener('pointerup', this.onUp.bind(this));
    container.addEventListener('pointermove', this.onMove.bind(this));
    container.addEventListener('dblclick', this.onDoubleClick.bind(this));
    // keyboard
    container.addEventListener('keydown', e => {
      if(e.key === 'ArrowLeft') this.panBy(40,0);
      if(e.key === 'ArrowRight') this.panBy(-40,0);
    });
  },
  load(pano){
    // set image src then center
    this.img.onload = () => {
      // compute max offsets
      const iw = this.img.naturalWidth;
      const ih = this.img.naturalHeight;
      const cw = this.container.clientWidth;
      const ch = this.container.clientHeight;
      // We scale image to fit height
      const scale = ch / ih;
      const displayWidth = iw * scale;
      this.scale = 1;
      this.maxOffsetX = Math.max(0, displayWidth - cw);
      this.maxOffsetY = Math.max(0, 0); // we limit vertical small
      // start centered
      this.posX = -this.maxOffsetX / 2;
      this.posY = 0;
      this.update();
    };
    this.img.src = pano.image;
    this.img.alt = pano.title || 'GeoChef panorama';
  },
  update(){
    // set transform to pan/tilt/scale
    this.img.style.transform = `translate3d(${this.posX}px, ${this.posY}px, 0) scale(${this.scale})`;
  },
  onDown(e){
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.container.setPointerCapture(e.pointerId);
  },
  onUp(e){
    this.dragging = false;
  },
  onMove(e){
    if(!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.panBy(dx, dy);
  },
  panBy(dx, dy){
    // dx positive -> image should move right (look left) so subtract
    this.posX += dx;
    // clamp based on maxOffsetX (negative values allowed)
    const minX = -this.maxOffsetX;
    const maxX = 0;
    if(this.posX < minX) this.posX = minX;
    if(this.posX > maxX) this.posX = maxX;
    // small vertical clamp
    const vLimit = 100;
    this.posY += dy;
    if(this.posY < -vLimit) this.posY = -vLimit;
    if(this.posY > vLimit) this.posY = vLimit;
    this.update();
  },
  onDoubleClick(){
    // quick zoom toggle
    this.scale = this.scale > 1 ? 1 : 1.4;
    this.update();
  }
};

// App UI wiring
async function init(){
  await loadPanoramas();
  // UI refs
  const panoWrap = $id('panoContainer');
  viewer.init(panoWrap);

  // load first pano
  if(APP.state.panoramas.length){
    loadPanoByIndex(0);
  } else {
    // show placeholder
    const placeholder = {
      image: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='2048' height='1024'><rect width='100%' height='100%' fill='#eee'/><text x='50' y='60' font-size='36' fill='#666'>No panoramas loaded. Place panoramas.json in the same folder.</text></svg>`)
    };
    viewer.load(placeholder);
  }

  // buttons
  $id('startBtn').addEventListener('click', startGame);
  $id('guessBtn').addEventListener('click', openMapModal);
  $id('closeMap').addEventListener('click', () => closeModal('mapModal'));
  $id('confirmGuess').addEventListener('click', confirmGuess);
  $id('forwardBtn').addEventListener('click', forwardNode);
  $id('backBtn').addEventListener('click', backwardNode);
  $id('lowData').addEventListener('click', toggleLowData);
  $id('nextRound').addEventListener('click', nextRound);
  // map canvas click
  const canvas = $id('mapCanvas');
  canvas.addEventListener('click', mapClick);

  // load local leaderboard
  renderLeaderboard();

  // register sw
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(e => console.log('SW reg failed', e));
  }
}

function loadPanoByIndex(i){
  const pano = APP.state.panoramas[i];
  if(!pano) return;
  APP.state.currentIndex = i;
  viewer.load(pano);
  $id('roundNum').textContent = `${APP.state.round}/${APP.state.roundsTotal}`;
  // update arrow availability
  $id('forwardBtn').disabled = !(pano.links && pano.links.length);
  $id('backBtn').disabled = !(pano.links && pano.links.length);
}

function findIndexById(id){
  return APP.state.panoramas.findIndex(p => p.id === id);
}

function forwardNode(){
  const current = APP.state.panoramas[APP.state.currentIndex];
  if(current && current.links && current.links[0]){
    const idx = findIndexById(current.links[0]);
    if(idx >= 0) loadPanoByIndex(idx);
  }
}
function backwardNode(){
  const current = APP.state.panoramas[APP.state.currentIndex];
  if(current && current.links && current.links.length>1){
    const idx = findIndexById(current.links[1]);
    if(idx >= 0) loadPanoByIndex(idx);
  } else {
    // fallback to previous index
    const prev = (APP.state.currentIndex - 1 + APP.state.panoramas.length) % APP.state.panoramas.length;
    loadPanoByIndex(prev);
  }
}

function startGame(){
  const mode = $id('modeSelect').value;
  APP.state.round = 1;
  APP.state.score = 0;
  if(mode === 'standard') APP.state.roundsTotal = 5;
  if(mode === 'casual') APP.state.roundsTotal = 1;
  if(mode === 'pro') APP.state.roundsTotal = 10;
  $id('scoreVal').textContent = APP.state.score;
  // choose random start
  const idx = Math.floor(Math.random() * APP.state.panoramas.length);
  loadPanoByIndex(idx);
  APP.state.startTime = Date.now();
  // small onboarding hint
  alert('Welcome to GeoChef! Drag on the panorama to look around. When ready tap "Make Guess".');
}

function openMapModal(){
  // show simple equirectangular grid canvas and allow pin drop
  const modal = $id('mapModal');
  modal.setAttribute('aria-hidden','false');
  modal.style.display = 'flex';
  drawMapCanvas();
  APP.state.guessLatLon = null;
}

function closeModal(id){
  const modal = $id(id);
  modal.setAttribute('aria-hidden','true');
  modal.style.display = 'none';
}

function drawMapCanvas(){
  const canvas = $id('mapCanvas');
  const ctx = canvas.getContext('2d');
  // simple lat/lon grid
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#eaf6ff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  // draw grid lines
  ctx.strokeStyle = '#d7eefc';
  ctx.lineWidth = 1;
  for(let x=0;x<=360;x+=30){
    const px = (x/360)*canvas.width;
    ctx.beginPath(); ctx.moveTo(px,0); ctx.lineTo(px,canvas.height); ctx.stroke();
  }
  for(let y= -90;y<=90;y+=30){
    const py = ((90 - y)/180)*canvas.height;
    ctx.beginPath(); ctx.moveTo(0,py); ctx.lineTo(canvas.width,py); ctx.stroke();
  }
  // small world label
  ctx.fillStyle = '#0b2636';
  ctx.font = '14px sans-serif';
  ctx.fillText('World Grid (offline fallback). Tap to drop pin.', 10, 20);
  // If a pin exists, draw it
  if(APP.state.guessLatLon) drawPin(ctx, APP.state.guessLatLon.lon, APP.state.guessLatLon.lat, canvas);
}

function mapClick(evt){
  const canvas = evt.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  // convert x,y to lon/lat via simple equirectangular
  const lon = (x / canvas.width) * 360 - 180;
  const lat = 90 - (y / canvas.height) * 180;
  APP.state.guessLatLon = {lat, lon};
  drawMapCanvas();
}

function drawPin(ctx, lon, lat, canvas){
  const x = ((lon + 180) / 360) * canvas.width;
  const y = ((90 - lat) / 180) * canvas.height;
  ctx.fillStyle = 'rgba(255,69,58,0.95)';
  ctx.beginPath(); ctx.arc(x, y, 10, 0, 2*Math.PI); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font='12px sans-serif'; ctx.fillText('Here', x+14, y+4);
}

function confirmGuess(){
  if(!APP.state.guessLatLon){
    alert('Drop a pin first');
    return;
  }
  const pano = APP.state.panoramas[APP.state.currentIndex];
  const actualLat = pano.lat;
  const actualLon = pano.lon;
  const guess = APP.state.guessLatLon;
  const distanceKm = haversine(actualLat, actualLon, guess.lat, guess.lon);
  // simple scoring formula: base 5000 - distance*5, + time bonus
  const base = Math.max(0, Math.round(5000 - (distanceKm * 5)));
  const timeSec = Math.max(1, Math.round((Date.now() - APP.state.startTime) / 1000));
  const timeBonus = Math.max(0, Math.round(Math.max(0, 1000 - (timeSec * 4))));
  const total = base + timeBonus;
  APP.state.score += total;
  $id('scoreVal').textContent = APP.state.score;
  // show score modal with breakdown
  const sb = $id('scoreBreakdown');
  sb.innerHTML = `
    <div class="score-reveal"><strong>${total} pts</strong></div>
    <div>Distance: ${distanceKm.toFixed(2)} km</div>
    <div>Base: ${base} pts</div>
    <div>Time bonus: ${timeBonus} pts (took ${timeSec}s)</div>
  `;
  openScoreModal();
  // record to leaderboard localStorage after round ends
}

function openScoreModal(){
  const m = $id('scoreModal');
  m.setAttribute('aria-hidden','false'); m.style.display='flex';
}

function nextRound(){
  closeModal('scoreModal');
  APP.state.round++;
  if(APP.state.round > APP.state.roundsTotal){
    // game over, save to leaderboard
    const name = prompt('Game over! Enter a name for the leaderboard','Chef') || 'Chef';
    saveToLeaderboard(name, APP.state.score);
    renderLeaderboard();
    alert(`Game over — ${APP.state.score} pts recorded for ${name}`);
  } else {
    // pick next random panorama
    const idx = Math.floor(Math.random() * APP.state.panoramas.length);
    APP.state.startTime = Date.now();
    loadPanoByIndex(idx);
  }
}

function saveToLeaderboard(name, score){
  const key = 'geochef.leaderboard.v1';
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  list.push({name,score,date:new Date().toISOString()});
  list.sort((a,b)=>b.score - a.score);
  localStorage.setItem(key, JSON.stringify(list.slice(0,50)));
}

function renderLeaderboard(){
  const key = 'geochef.leaderboard.v1';
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  const ol = $id('leaderList');
  ol.innerHTML = '';
  list.slice(0,10).forEach(item => {
    const li = document.createElement('li');
    li.textContent = `${item.name} — ${item.score} pts`;
    ol.appendChild(li);
  });
}

function toggleLowData(){
  APP.state.lowData = !APP.state.lowData;
  $id('lowData').textContent = `Low Data: ${APP.state.lowData ? 'On' : 'Off'}`;
  // In low data mode, we could swap to tiny images; here we just show a toast
  alert('Low Data mode toggled (sample behavior). Heavy features will be disabled.');
}

// Init
document.addEventListener('DOMContentLoaded', init);

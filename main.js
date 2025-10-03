// main.js (GeoChef MVP playable update)
// Uses Pannellum (360 viewer) + Leaflet (map) + localStorage for simple accounts & leaderboard.
// This file replaces the earlier lightweight demo. No external API keys required.

const APP = {
  state: {
    panoramas: [],
    currentId: null,
    round: 1,
    roundsTotal: 5,
    score: 0,
    lowData: false,
    startTime: null,
    guessLatLon: null,
    viewer: null,
    map: null,
    mapMarker: null,
    user: null
  },
  CACHE_NAME: 'geochef-shell-v1'
};

/* ---------- Utilities ---------- */
const $ = sel => document.querySelector(sel);
const $id = id => document.getElementById(id);

// Haversine (digit-by-digit careful)
function haversine(lat1, lon1, lat2, lon2) {
  const toRad = x => x * Math.PI / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ---------- curated sample pack (uses free Wikimedia Commons thumbnails) ---------- */
const curatedPack = [
  {
    id: 'rheingau-dom',
    title: 'Rheingauer Dom, Geisenheim',
    lat: 49.9864,
    lon: 7.9685,
    links: ['eso-hq','narada-falls'],
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Rheingauer_Dom%2C_Geisenheim%2C_360_Panorama_%28Equirectangular_projection%29.jpg/960px-Rheingauer_Dom%2C_Geisenheim%2C_360_Panorama_%28Equirectangular_projection%29.jpg'
  },
  {
    id: 'eso-hq',
    title: 'ESO Headquarters, Garching (Germany)',
    lat: 48.2593,
    lon: 11.6707,
    links: ['narada-falls','rheingau-dom'],
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/360-degree_panorama_of_the_ESO_Headquarters_%28hqe-pano2%29.jpg/960px-360-degree_panorama_of_the_ESO_Headquarters_%28hqe-pano2%29.jpg'
  },
  {
    id: 'narada-falls',
    title: 'Narada Falls, Mount Rainier (USA)',
    lat: 46.77528,
    lon: -121.74528,
    links: ['rheingau-dom','eso-hq'],
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Narada_Falls%2C_Mount_Rainier_National_Park%2C_equirectangular_panorama_02.jpg/960px-Narada_Falls%2C_Mount_Rainier_National_Park%2C_equirectangular_panorama_02.jpg'
  }
];

/* ---------- Load panoramas.json, fallback to curated if placeholders ---------- */
async function loadPanoramas() {
  try {
    const r = await fetch('panoramas.json', {cache: 'no-cache'});
    if (!r.ok) throw new Error('panoramas.json fetch failed');
    const data = await r.json();
    // If it looks like placeholder SVG dataURIs or empty, replace with curated pack
    const looksLikePlaceholders = !data.length || data.every(p => typeof p.image === 'string' && p.image.startsWith('data:image/svg'));
    APP.state.panoramas = looksLikePlaceholders ? curatedPack : data;
  } catch (err) {
    console.warn('Could not load panoramas.json — using curated pack', err);
    APP.state.panoramas = curatedPack;
  }
}

/* ---------- Initialize Pannellum with scenes ---------- */
function initPannellum() {
  if (!window.pannellum) {
    console.error('Pannellum not available (check CDN).');
    return;
  }
  const scenes = {};
  APP.state.panoramas.forEach(p => {
    scenes[p.id] = {
      title: p.title,
      panorama: p.image,
      type: 'equirectangular',
      yaw: 0,
      pitch: 0,
      hfov: 100
    };
  });

  // Create viewer or update
  if (APP.state.viewer) {
    // viewer exists — clear/add scenes
    // Simple approach: destroy then recreate
    try { APP.state.viewer.destroy(); } catch (e) {}
    APP.state.viewer = null;
  }

  APP.state.viewer = pannellum.viewer('panoContainer', {
    default: {
      firstScene: APP.state.panoramas[0].id,
      sceneFadeDuration: 600
    },
    scenes
  });

  // When scene changes, update APP state
  APP.state.viewer.on('scenechange', (sceneId) => {
    APP.state.currentId = sceneId;
    // update round display
    $('#roundNum').textContent = `${APP.state.round}/${APP.state.roundsTotal}`;
    // enable/disable nav arrows
    const cur = APP.state.panoramas.find(p => p.id === sceneId);
    $id('forwardBtn').disabled = !(cur && cur.links && cur.links.length);
    $id('backBtn').disabled = !(cur && cur.links && cur.links.length);
  });
}

/* ---------- Initialize Leaflet map when modal opens ---------- */
function initMapIfNeeded() {
  if (APP.state.map) return;
  const mapEl = $id('mapid');
  APP.state.map = L.map(mapEl, { attributionControl: false }).setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(APP.state.map);

  // clicking on map sets marker
  APP.state.map.on('click', (e) => {
    if (APP.state.mapMarker) APP.state.map.removeLayer(APP.state.mapMarker);
    APP.state.mapMarker = L.marker(e.latlng, {draggable: true}).addTo(APP.state.map);
    APP.state.guessLatLon = { lat: e.latlng.lat, lon: e.latlng.lng };
    APP.state.mapMarker.on('dragend', () => {
      const p = APP.state.mapMarker.getLatLng();
      APP.state.guessLatLon = { lat: p.lat, lon: p.lng };
    });
  });
}

/* ---------- UI wiring & game flow ---------- */
async function init() {
  await loadPanoramas();
  initPannellum();

  // UI refs
  $id('startBtn').addEventListener('click', startGame);
  $id('guessBtn').addEventListener('click', () => {
    openModal('mapModal');
    setTimeout(()=>{ initMapIfNeeded(); APP.state.map.invalidateSize(); }, 200);
    // center map roughly on current pano if available
    const curr = currentPano();
    if (curr && APP.state.map) APP.state.map.setView([curr.lat || 20, curr.lon || 0], 4);
  });
  $id('closeMap').addEventListener('click', () => closeModal('mapModal'));
  $id('confirmGuess').addEventListener('click', confirmGuess);
  $id('forwardBtn').addEventListener('click', forwardNode);
  $id('backBtn').addEventListener('click', backwardNode);
  $id('lowData').addEventListener('click', toggleLowData);
  $id('nextRound').addEventListener('click', nextRound);
  $id('downloadPack').addEventListener('click', downloadSamplePack);
  $id('profileBtn').addEventListener('click', ()=>openModal('profileModal'));
  $id('closeProfile').addEventListener('click', ()=>closeModal('profileModal'));
  $id('saveProfile').addEventListener('click', saveProfile);
  $id('logoutBtn').addEventListener('click', logout);
  $id('navProfile').addEventListener('click', ()=>openModal('profileModal'));
  $id('navLeaderboard').addEventListener('click', ()=>{ window.scrollTo({top: document.getElementById('leaderboard').offsetTop, behavior:'smooth'}); });

  // load user profile (local)
  loadProfile();

  // initial UI state
  $id('roundNum').textContent = `0/0`;
  $id('scoreVal').textContent = '0';
  renderLeaderboard();
}

/* ---------- helper: current panorama ---------- */
function currentPano() {
  return APP.state.panoramas.find(p => p.id === APP.state.currentId) || APP.state.panoramas[0];
}

/* ---------- start game ---------- */
function startGame() {
  const mode = $id('modeSelect').value;
  APP.state.round = 1;
  APP.state.score = 0;
  if (mode === 'standard') APP.state.roundsTotal = 5;
  if (mode === 'casual') APP.state.roundsTotal = 1;
  if (mode === 'pro') APP.state.roundsTotal = 10;
  $id('scoreVal').textContent = APP.state.score;
  // pick random start scene
  const idx = Math.floor(Math.random() * APP.state.panoramas.length);
  const startId = APP.state.panoramas[idx].id;
  try { APP.state.viewer.loadScene(startId); }
  catch (e) { console.warn('viewer.loadScene failed', e); }
  APP.state.startTime = Date.now();
}

/* ---------- Navigation (follow links) ---------- */
function forwardNode() {
  const cur = currentPano();
  if (!cur || !cur.links || !cur.links.length) return;
  const nextId = cur.links[0];
  if (APP.state.viewer && nextId) APP.state.viewer.loadScene(nextId);
}
function backwardNode() {
  const cur = currentPano();
  if (!cur || !cur.links || !cur.links.length) {
    // fallback: previous in array
    const idx = APP.state.panoramas.findIndex(p=>p.id===APP.state.currentId);
    const prev = (idx - 1 + APP.state.panoramas.length) % APP.state.panoramas.length;
    APP.state.viewer.loadScene(APP.state.panoramas[prev].id);
    return;
  }
  const nextId = cur.links[1] || cur.links[0];
  if (APP.state.viewer && nextId) APP.state.viewer.loadScene(nextId);
}

/* ---------- Map modal helpers ---------- */
function openModal(id) {
  const modal = $id(id);
  modal.setAttribute('aria-hidden','false');
  modal.style.display = 'flex';
}
function closeModal(id) {
  const modal = $id(id);
  modal.setAttribute('aria-hidden','true');
  modal.style.display = 'none';
}

/* ---------- Confirm guess (calc distance & scoring) ---------- */
function confirmGuess() {
  if (!APP.state.guessLatLon && !APP.state.mapMarker) {
    alert('Drop a pin on the map first.');
    return;
  }
  let guess = APP.state.guessLatLon;
  if (!guess && APP.state.mapMarker) {
    const p = APP.state.mapMarker.getLatLng();
    guess = { lat: p.lat, lon: p.lng };
  }
  const pano = currentPano();
  const distanceKm = haversine(pano.lat, pano.lon, guess.lat, guess.lon);
  const base = Math.max(0, Math.round(5000 - (distanceKm * 5)));
  const timeSec = Math.max(1, Math.round((Date.now() - APP.state.startTime) / 1000));
  const timeBonus = Math.max(0, Math.round(Math.max(0, 1000 - (timeSec * 4))));
  const total = base + timeBonus;
  APP.state.score += total;
  $id('scoreVal').textContent = APP.state.score;
  $id('scoreBreakdown').innerHTML = `
    <div class="score-reveal"><strong>${total} pts</strong></div>
    <div>Distance: ${distanceKm.toFixed(2)} km</div>
    <div>Base: ${base} pts</div>
    <div>Time bonus: ${timeBonus} pts (took ${timeSec}s)</div>
  `;
  closeModal('mapModal');
  openModal('scoreModal');
}

/* ---------- Next round ---------- */
function nextRound() {
  closeModal('scoreModal');
  APP.state.round++;
  if (APP.state.round > APP.state.roundsTotal) {
    // end game -> save leaderboard (local)
    const name = APP.state.user?.name || prompt('Game over! Enter a name for the leaderboard','Chef') || 'Chef';
    saveToLeaderboard(name, APP.state.score);
    renderLeaderboard();
    alert(`Game over — ${APP.state.score} pts recorded for ${name}`);
  } else {
    // new random scene
    const idx = Math.floor(Math.random() * APP.state.panoramas.length);
    APP.state.viewer.loadScene(APP.state.panoramas[idx].id);
    APP.state.startTime = Date.now();
    APP.state.guessLatLon = null;
    if (APP.state.mapMarker) { APP.state.map.removeLayer(APP.state.mapMarker); APP.state.mapMarker = null; }
  }
}

/* ---------- Local leaderboard ---------- */
function saveToLeaderboard(name, score) {
  const key = 'geochef.leaderboard.v1';
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  list.push({ name, score, date: new Date().toISOString() });
  list.sort((a,b) => b.score - a.score);
  localStorage.setItem(key, JSON.stringify(list.slice(0,50)));
}
function renderLeaderboard() {
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

/* ---------- Low Data toggle ---------- */
function toggleLowData() {
  APP.state.lowData = !APP.state.lowData;
  $id('lowData').textContent = `Low Data: ${APP.state.lowData ? 'On' : 'Off'}`;
  alert('Low Data toggled. Heavy features will be disabled (if present).');
}

/* ---------- Download sample pack (cache panoramas) ---------- */
async function downloadSamplePack() {
  const urls = APP.state.panoramas.map(p => p.image).filter(Boolean);
  if (!('caches' in window)) { alert('Caching not supported in this browser'); return; }
  try {
    const cache = await caches.open(APP.CACHE_NAME);
    await Promise.all(urls.map(u => cache.add(u).catch(e => console.warn('cache add failed', u, e))));
    alert('Sample pack cached for offline use!');
  } catch (e) {
    console.error('downloadSamplePack failed', e);
    alert('Failed to cache pack — see console.');
  }
}

/* ---------- Profile (local-only) ---------- */
function loadProfile() {
  const user = JSON.parse(localStorage.getItem('geochef.user') || 'null');
  APP.state.user = user;
  if (user) {
    $id('username').value = user.name;
  } else {
    $id('username').value = '';
  }
}
function saveProfile() {
  const name = $id('username').value.trim() || 'Chef';
  APP.state.user = { name };
  localStorage.setItem('geochef.user', JSON.stringify(APP.state.user));
  alert('Profile saved locally as: ' + name);
  closeModal('profileModal');
}
function logout() {
  localStorage.removeItem('geochef.user');
  APP.state.user = null;
  $id('username').value = '';
  alert('Logged out (local).');
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  init().catch(e => console.error(e));
});

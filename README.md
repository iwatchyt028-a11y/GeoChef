# GeoChef (MVP)

GeoChef is a mobile-first GeoGuessr-style demo (MVP). It runs locally without paid APIs using a seeded panorama dataset.

## Quick start (local)
1. Clone or unzip this folder.
2. Serve locally (service worker requires http(s) but `localhost` is fine):
   - Python 3: `python -m http.server 8000`
   - Node: `npx serve .`
3. Open `http://localhost:8000` in your mobile browser or desktop.

## Files
- `index.html` — main UI
- `main.css` — theme & styles (Dodger Blue)
- `main.js` — app logic (panorama viewer, guess workflow)
- `panoramas.json` — seed panoramas (SVG data URIs)
- `sw.js` — service worker for offline caching
- `manifest.json` — PWA metadata
- `icons/chef-hat.svg` — logo

## Acceptance criteria (MVP)
- Play a 5-round Standard game (panorama, make guess via map modal fallback).
- Score is calculated using Haversine distance + time bonus.
- Offline: the app shell + sample panoramas work when served from localhost.
- Accessibility: controls have ARIA labels and keyboard focus.

## Upgrading to full product (notes)
- Map: swap the simple canvas grid with MapLibre GL and OSM vector tiles.
- Panorama viewer: replace the lightweight viewer with Pannellum / PhotoSphereViewer or three.js for full equirectangular mapping and node linking.
- Multiplayer: use WebRTC (P2P) with a tiny signaling function hosted in Netlify/Vercel.
- ML: integrate Tesseract.js and Tensorflow.js lazily.

## License
MIT — see LICENSE file.

Note: Everything is made with Chat GPT 5 for fun, even this text below  ⬇️

(Edit: I think I should do it my self instead of wasting hours telling AI my vision ;-;. This would be a good learning journey too. Will make an update about the final result or progress on January 2026)
(Also until then if anyone wants the name GeoChef to make such a webgame then don't hesitate to do so, it will be my pleasure spcially if that webgame is near to my vision of a unique GeoGuessr game that is completely free and funnier to play)
(I wish y'all a supercalifragilistic life and May God Bless you.)

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

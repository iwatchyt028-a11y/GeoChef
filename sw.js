// sw.js — simple service worker cache
const CACHE = 'geochef-shell-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/main.css',
  '/main.js',
  '/panoramas.json',
  '/manifest.json',
  '/icons/chef-hat.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  e.respondWith(
    caches.match(req).then(cached => {
      if(cached) return cached;
      return fetch(req).then(res => {
        // runtime cache for images, panoramas
        if(req.destination === 'image' || req.url.endsWith('.json')){
          caches.open(CACHE).then(cache => cache.put(req, res.clone()));
        }
        return res;
      }).catch(()=>caches.match('/index.html'));
    })
  );
});

/* ORBITE — service worker : le jeu reste jouable hors ligne une fois installé. */
const CACHE = 'orbite-v1';
const SHELL = [
  './',
  './index.html',
  './atelier.html',
  './manifest.webmanifest',
  './css/game.css',
  './css/atelier.css',
  './js/planet-engine.js',
  './js/planet-renderer.js',
  './js/stage.js',
  './js/sfx.js',
  './js/rules.js',
  './js/game.js',
  './js/atelier.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Réseau d'abord (pour recevoir les mises à jour), cache en secours.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});

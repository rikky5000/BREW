// Service worker: gör appen tillgänglig offline. Höj CACHE vid ny version.
const CACHE = 'waltherson-v2';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/icons.js',
  'js/equipment.js',
  'js/water.js',
  'js/storage.js',
  'js/ui.js',
  'js/chemistry.js',
  'js/chemistry-view.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Nätverk först, cache som reserv – så att nya versioner syns direkt när man är online.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))),
  );
});

const CACHE_NAME = 'huholdem-v1';
const CACHE_FILES = [
  '/HeadsUpHoldem/',
  '/HeadsUpHoldem/index.html',
  '/HeadsUpHoldem/css/style.css',
  '/HeadsUpHoldem/js/game.js',
  '/HeadsUpHoldem/js/ui.js',
  '/HeadsUpHoldem/js/advice.js',
  '/HeadsUpHoldem/manifest.json',
  '/HeadsUpHoldem/icons/icon-192.svg',
  '/HeadsUpHoldem/icons/icon-512.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).catch(() =>
        new Response('Unable to load resource while offline. Please reload the app once you have a connection.', { status: 503, statusText: 'Service Unavailable' })
      );
    })
  );
});

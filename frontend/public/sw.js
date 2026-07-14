// Pass-through Service Worker to meet PWA mobile installability requirements
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let the browser fetch resources normally (pass-through, no offline caching)
  event.respondWith(fetch(event.request));
});

const CACHE_NAME = 'codeverse-shell-v1';

// Install event - precache the main entry point shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/favicon.svg'
      ]);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches if any
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event interceptor
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Do NOT cache API endpoints to prevent stale data conflicts
  if (url.pathname.startsWith('/api')) {
    return;
  }

  // Stale-While-Revalidate caching strategy for UI Shell assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh version in the background and update the cache
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {
          // Ignore network failures quietly when offline
        });
        
        return cachedResponse;
      }
      
      // If not in cache, retrieve from network
      return fetch(event.request).then((networkResponse) => {
        // Dynamically cache compiled static assets (like main JS/CSS, images, icons)
        if (
          networkResponse.status === 200 &&
          (url.pathname.startsWith('/assets/') || 
           url.pathname.endsWith('.svg') || 
           url.pathname.endsWith('.png') || 
           url.pathname.includes('fonts.googleapis.com') ||
           url.pathname.includes('fonts.gstatic.com'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline Fallback: If navigating to any client-side route, serve index.html shell
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});

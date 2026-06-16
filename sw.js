const CACHE_NAME = 'aurahabit-cache-v6';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.png'
];

// Cache all core assets upon installation
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate listener to delete old caches automatically
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First fetching strategy with offline cache fallback
self.addEventListener('fetch', event => {
  // Bypass service worker caching for cloud database API calls
  if (event.request.url.includes('kvdb.io')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If response is valid, update the cache for offline fallback
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // If network request fails (offline), load from cache
        return caches.match(event.request);
      })
  );
});

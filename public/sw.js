/* ---------------------------------------------------------------------------
   Service Worker
   Cache-first for static assets, network-first for API calls
   --------------------------------------------------------------------------- */

const CACHE_NAME = 'smartnote-v5';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/css/reset.css',
  '/css/variables.css',
  '/css/themes.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/styles.css',
  '/js/utils.js',
  '/js/db.js',
  '/js/sm2.js',
  '/js/ai.js',
  '/js/sync.js',
  '/js/pwa.js',
  '/js/app.js',
  '/js/views/note-editor.js',
  '/js/views/note-detail.js',
  '/js/views/browse.js',
  '/js/views/review.js',
  '/js/views/stats.js',
  '/js/views/settings.js',
  '/js/charts/chart.js',
];

// Install: cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Failed to cache some assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for static, network-first for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // Navigation requests: network-first, fall back to offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        // Cache the fresh response for next time
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
      return cached || fetched;
    })
  );
});

/* TeamIQ Service Worker — network-first, offline fallback */
const CACHE    = 'teamiq-v2';
const OFFLINE  = '/offline.html';

/* Assets to pre-cache at install time */
const PRECACHE = [
  '/',
  OFFLINE,
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* API calls: network only, no cache — data must always be fresh */
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ ok: false, error: 'Offline — no network' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  /* Navigation (HTML): network-first, fall back to offline page */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE))
    );
    return;
  }

  /* Static JS/CSS — network-first so dev edits always load fresh.
     CDN assets (Chart.js) fall back to cache for offline use.       */
  const isCDN = url.hostname !== location.hostname;
  if (!isCDN) {
    // Local static assets: network-first, cache as fallback
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  /* CDN assets (Chart.js etc): cache-first for offline resilience */
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

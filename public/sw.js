// Minimal service worker — enables PWA installability and offline shell.
// Network-first for API, cache-first for static assets.

const CACHE_NAME = 'school-erp-v1';
const PRECACHE = ['/', '/dashboard', '/login', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API or auth — always go to network
  if (url.pathname.startsWith('/api/') || request.method !== 'GET') {
    return;
  }

  // Network-first with fallback to cache for everything else (HTML, JS, CSS, images)
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match('/')))
  );
});

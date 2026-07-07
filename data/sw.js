// Service worker offline-first de Heroes (lot 8.1, doc 09 Beta « PWA hors-ligne »).
// Hand-rolled, sans dépendance. Servi à /heroes/sw.js (scope /heroes/).
// Le jeu est déjà pur/déterministe + IndexedDB ; ce SW met en cache la coquille,
// les assets hashés et le contenu data-driven pour un démarrage 100 % hors-ligne.

const CACHE = 'heroes-cache-v1';
const SHELL = new URL('./', self.location).pathname; // /heroes/

self.addEventListener('install', (event) => {
  // Pré-cache la coquille de navigation ; les assets se peuplent au runtime.
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([SHELL, SHELL + 'index.html'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Purge les anciennes versions de cache, puis prend le contrôle des clients.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(request)) || (await cache.match(SHELL + 'index.html'));
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const fetching = fetch(request)
    .then((fresh) => {
      if (fresh && fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => hit);
  return hit || fetching;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // jamais le backend/CDN tiers

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request)); // coquille : frais si en ligne, sinon cache
  } else if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request)); // JS/CSS hashés : immuables
  } else {
    event.respondWith(staleWhileRevalidate(request)); // JSON de contenu, icônes, manifeste
  }
});

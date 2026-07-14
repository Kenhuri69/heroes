// Service worker offline-first de Heroes (lot 8.1, doc 09 Beta « PWA hors-ligne »).
// Hand-rolled, sans dépendance. Servi à /heroes/sw.js (scope /heroes/).
// Le jeu est déjà pur/déterministe + IndexedDB ; ce SW met en cache la coquille,
// les assets hashés et le contenu data-driven pour un démarrage 100 % hors-ligne.
// B46 : contenu JSON en network-first (plus de mélange code neuf / données
// périmées ⇒ rejets Zod), cache versionné + élagage borné des assets, repli
// cache sur réponse réseau non-ok.

const CACHE = 'heroes-cache-v2'; // bump ⇒ purge des versions précédentes à l'activate
const SHELL = new URL('./', self.location).pathname; // /heroes/

// B46b : les assets hashés changent de nom à chaque déploiement et
// s'accumuleraient sans limite. Élagage borné : au-delà d'ASSETS_MAX entrées
// `/assets/`, éviction des plus anciennes par ordre d'insertion (`cache.keys()`
// préserve cet ordre ; un asset re-servi depuis le cache n'est pas réinséré —
// LRU approché, suffisant pour borner la croissance). Appliqué à l'activate ET
// après chaque mise en cache d'un asset.
const ASSETS_MAX = 300;

async function pruneAssets() {
  // Best-effort : un échec d'élagage ne doit JAMAIS remonter (et surtout pas
  // dans un respondWith). Les deletes concurrents d'un put en cours peuvent
  // rejeter selon le navigateur — avalés.
  try {
    const cache = await caches.open(CACHE);
    const assets = (await cache.keys()).filter((req) =>
      new URL(req.url).pathname.includes('/assets/'),
    );
    const excess = assets.slice(0, Math.max(0, assets.length - ASSETS_MAX));
    await Promise.all(excess.map((req) => cache.delete(req).catch(() => false)));
  } catch {
    /* élagage différé au prochain passage */
  }
}

// Élagage DIFFÉRÉ et dédoublonné : au boot, ~150 assets s'insèrent en rafale —
// élaguer après CHAQUE insertion faisait courir des delete concurrents aux put
// en vol (rejets ⇒ net::ERR_FAILED côté page). Un seul élagage par rafale.
let prunePending = false;
function schedulePrune() {
  if (prunePending) return;
  prunePending = true;
  setTimeout(() => {
    prunePending = false;
    void pruneAssets();
  }, 3000);
}

self.addEventListener('install', (event) => {
  // Pré-cache la coquille de navigation ; les assets se peuplent au runtime.
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([SHELL, SHELL + 'index.html'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Purge les caches d'autres versions, élague les assets, puis prend le contrôle.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(pruneAssets)
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, shellFallback) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      // Mise en cache best-effort : un put qui rejette (quota, course avec un
      // delete) ne doit pas produire d'unhandled rejection dans le SW.
      cache.put(request, fresh.clone()).catch(() => undefined);
      return fresh;
    }
    // B46c : 404/500 transitoire ⇒ repli sur le cache s'il existe, sinon la
    // réponse d'erreur est rendue telle quelle (rien de mieux à servir).
    return (await cache.match(request)) || fresh;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    return shellFallback ? cache.match(SHELL + 'index.html') : self.Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) {
    // Best-effort + élagage DIFFÉRÉ (une passe par rafale) : la réponse à la
    // page ne dépend JAMAIS du succès de la mise en cache (B46b, correctif de
    // revue — l'élagage synchrone après chaque insertion rejetait respondWith
    // en rafale d'assets ⇒ net::ERR_FAILED intermittents).
    cache
      .put(request, fresh.clone())
      .then(() => schedulePrune())
      .catch(() => undefined);
  }
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // jamais le backend/CDN tiers

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, true)); // coquille : frais si en ligne, sinon cache
  } else if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request)); // JS/CSS hashés : immuables
  } else {
    // B46a : JSON de contenu, icônes, manifeste — network-first (fichiers
    // petits) : le code fraîchement déployé lit toujours des données du même
    // déploiement ; le cache ne sert qu'en repli hors-ligne.
    event.respondWith(networkFirst(request, false));
  }
});

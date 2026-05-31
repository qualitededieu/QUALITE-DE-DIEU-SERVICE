// sw.js — Service Worker PHANOS KOSMOS
// Version a incrementer a chaque deploiement Vercel

const CACHE_VERSION = "pk-v1.0.1";
const CACHE_STATIC  = "pk-v1.0.1-static";
const CACHE_DYNAMIC = "pk-v1.0.1-dynamic";

// Assets vraiment statiques : images, icones, manifest
// NE PAS inclure les fichiers JS/CSS ici (servis en networkFirst)
const STATIC_ASSETS = [
  "/icons/logo.jpg",
  "/manifest.json"
];

// --- Strategies de cache ---

// cacheFirst : pour les assets binaires stables (images, icones)
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Ressource non disponible hors-ligne.", { status: 503 });
  }
}

// networkFirst : pour HTML, JS, CSS — toujours la version la plus recente
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return (await caches.match("/")) || new Response("Hors-ligne.", { status: 503 });
  }
}

// --- Lifecycle ---

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS)
        .catch(err => console.warn("[SW] Certaines ressources non mises en cache:", err))
      )
  );
  // Activation immediate sans attendre la fermeture des onglets
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map(k => {
            console.log("[SW] Suppression ancien cache:", k);
            return caches.delete(k);
          })
      ))
      // Prendre le controle de tous les onglets ouverts immediatement
      .then(() => self.clients.claim())
  );
});

// --- Interception des requetes ---

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requetes non-GET et hors de notre origine
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // FIX CRITIQUE : JS et CSS en networkFirst
  // Evite de servir des versions obsoletes qui cassent la connexion
  if (
    path.startsWith("/js/") ||
    path.startsWith("/css/")
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets lourds et stables : cacheFirst acceptable
  // (attestation_bg et attestation_assets sont des fichiers de plusieurs Mo rarement changes)
  if (
    path.includes("attestation_bg") ||
    path.includes("attestation_assets") ||
    path.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Pages HTML et tout le reste : networkFirst
  event.respondWith(networkFirst(request));
});

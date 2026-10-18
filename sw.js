/* Deep End's offline copy: the service worker. It stays out of the way until "Save for offline" on the home page
 * has filled the cache (shared/offline.js does the downloading). From then on it answers every site and CDN request
 * from the saved copy first, so the labs open with no network. Requests made with cache: 'no-store' (the updater's)
 * always go to the network. */
importScripts('shared/offline-plan.js');
const P = self.OfflinePlan;
const BASE = new URL('./', self.location).href;

let saved = null;   // null: not known yet (the worker was just started)
const refresh = () => caches.match(BASE + P.META, { cacheName: P.CACHE }).then((r) => { saved = !!r; return saved; });

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(Promise.all([self.clients.claim(), refresh()])));
self.addEventListener('message', (e) => { if (e.data === 'changed') e.waitUntil(refresh()); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.cache === 'no-store' || saved === false) return;
  const key = P.cacheKey(req.url, BASE);
  if (key) e.respondWith(answer(req, key));
});

async function answer(req, key) {
  if (saved === null) await refresh();
  if (!saved) return fetch(req);
  const cache = await caches.open(P.CACHE);
  const hit = await cache.match(key);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok && (res.type === 'basic' || res.type === 'cors')) cache.put(key, res.clone());
    return res;
  } catch (err) {
    // /deep-end/rust (no slash) while offline: send it to the saved /deep-end/rust/
    if (req.mode === 'navigate' && !key.endsWith('/index.html') && await cache.match(key + '/index.html')) return Response.redirect(req.url.split(/[?#]/)[0] + '/', 301);
    throw err;
  }
}

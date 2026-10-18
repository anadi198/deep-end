/* Offline copy of Deep End: the pure parts, shared by sw.js (importScripts) and the Node tests.
 * offline-manifest.json, written at deploy time, lists every site file with its size and hash, plus the CDN files
 * the labs load. The service worker saves them all, then on each online visit fetches only what changed. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OfflinePlan = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CDN = [
    (u) => u.host === 'cdnjs.cloudflare.com',
    (u) => u.host === 'cdn.jsdelivr.net',
    (u) => u.host === 'fonts.googleapis.com',
    (u) => u.host === 'fonts.gstatic.com',
    (u) => u.host === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/'),
  ];
  const NEVER = new Set(['offline-manifest.json', 'sw.js']);

  // The cache key for a request, or null when the offline copy should leave it alone.
  function cacheKey(url, base) {
    const u = new URL(url), b = new URL(base);
    u.hash = '';
    if (u.origin === b.origin) {
      if (!u.pathname.startsWith(b.pathname)) return null;
      if (NEVER.has(u.pathname.slice(b.pathname.length))) return null;
      u.search = '';
      if (u.pathname.endsWith('/')) u.pathname += 'index.html';
      return u.href;
    }
    return CDN.some((ok) => ok(u)) ? u.href : null;
  }

  // What to download and delete to go from the saved manifest (null on a first save) to the new one.
  function diff(old, next) {
    const before = new Map((old ? old.files : []).map((f) => [f.path, f.hash]));
    const had = new Set(old ? old.external : []);
    const keep = new Set(next.files.map((f) => f.path));
    return {
      fetch: [...next.files.filter((f) => before.get(f.path) !== f.hash), ...next.external.filter((u) => !had.has(u)).map((url) => ({ url }))],
      remove: [...[...before.keys()].filter((p) => !keep.has(p)), ...[...had].filter((u) => !next.external.includes(u))],
    };
  }

  function fontFiles(css) {
    return [...new Set([...css.matchAll(/url\(\s*["']?(https:\/\/fonts\.gstatic\.com\/[^"')\s]+)["']?\s*\)/g)].map((m) => m[1]))];
  }

  async function sha(bytes) {
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return Array.from(d.slice(0, 8), (x) => x.toString(16).padStart(2, '0')).join('');
  }

  const megabytes = (n) => (n >= 1e7 ? Math.round(n / 1e6) : Math.round(n / 1e5) / 10) + ' MB';

  // One Cache Storage bucket; the saved manifest sits in it under META, relative to the site root.
  return { CACHE: 'deepend-offline', META: '__offline/meta.json', cacheKey, diff, fontFiles, sha, megabytes };
});

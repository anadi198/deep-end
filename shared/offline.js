/* Deep End's offline copy, page side. Every page loads this (after offline-plan.js): it registers sw.js and, once the
 * copy is saved, refreshes it in the background on online visits, then offers a reload. The home page calls
 * DeepOffline.save() / remove() / status() for its "Save for offline" panel. */
(function () {
  'use strict';
  const P = window.OfflinePlan;
  if (!P || !('serviceWorker' in navigator) || !('caches' in window) || location.protocol === 'file:') { window.DeepOffline = null; return; }

  const BASE = new URL('../', document.currentScript.src).href;
  const META = BASE + P.META;
  const CHECKED = 'deepend.offline.checked';
  const CHECK_EVERY = location.hostname === 'localhost' ? 0 : 5 * 60 * 1000;

  navigator.serviceWorker.register(BASE + 'sw.js', { scope: BASE }).catch(() => { /* private mode, or blocked */ });

  const open = () => caches.open(P.CACHE);
  const locked = (fn) => (navigator.locks ? navigator.locks.request('deepend-offline', fn) : fn());
  const tellWorker = () => navigator.serviceWorker.ready.then((r) => r.active && r.active.postMessage('changed')).catch(() => {});

  async function status() {
    const r = await caches.match(META, { cacheName: P.CACHE });
    return r ? r.json() : null;
  }
  async function manifest() {
    const r = await fetch(BASE + 'offline-manifest.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(`offline-manifest.json: HTTP ${r.status}`);
    return r.json();
  }

  const STALE = 'The site was updated a few minutes ago and the download caught it half-way. Try again in a few minutes.';
  async function download(item) {
    if (item.path) {
      const url = BASE + item.path;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error(`${item.path}: HTTP ${r.status}`);
      const buf = await r.arrayBuffer();
      if (await P.sha(buf) !== item.hash) throw new Error(STALE);
      return [[P.cacheKey(url, BASE), new Response(buf, { headers: { 'content-type': r.headers.get('content-type') || 'application/octet-stream' } })]];
    }
    const r = await fetch(item.url, { cache: 'no-store', mode: 'cors' });
    if (!r.ok) throw new Error(`${item.url}: HTTP ${r.status}`);
    const out = [[item.url, r]];
    if (new URL(item.url).host === 'fonts.googleapis.com') {
      for (const f of P.fontFiles(await r.clone().text())) {
        const fr = await fetch(f, { cache: 'no-store', mode: 'cors' });
        if (fr.ok) out.push([f, fr]);
      }
    }
    return out;
  }

  async function pool(items, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
  }

  // Brings the saved copy to the deployed version. A first save writes as it goes; an update stages everything and
  // writes it at the end, so a failed update never leaves a mix of old and new files.
  async function sync(onProgress) {
    const cache = await open();
    const old = await status();
    const next = await manifest();
    if (old && old.manifest.version === next.version) return { changed: 0, status: old };
    const plan = P.diff(old && old.manifest, next);
    const staged = [];
    let done = 0;
    if (onProgress) onProgress(0, plan.fetch.length);
    try {
      await pool(plan.fetch, 6, async (item) => {
        const pairs = await download(item);
        if (old) staged.push(...pairs); else for (const [k, r] of pairs) await cache.put(k, r);
        if (onProgress) onProgress(++done, plan.fetch.length);
      });
    } catch (e) {
      if (!old) await caches.delete(P.CACHE);
      throw e;
    }
    for (const [k, r] of staged) await cache.put(k, r);
    for (const x of plan.remove) await cache.delete(x.startsWith('https://') ? x : BASE + x);
    const now = Date.now();
    const s = { manifest: next, savedAt: old ? old.savedAt : now, updatedAt: now };
    await cache.put(META, new Response(JSON.stringify(s), { headers: { 'content-type': 'application/json' } }));
    await tellWorker();
    return { changed: plan.fetch.length + plan.remove.length, status: s };
  }

  async function save(onProgress) {
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch { /* best effort */ }
    try { localStorage.setItem(CHECKED, String(Date.now())); } catch { /* storage blocked */ }
    return locked(() => sync(onProgress));
  }
  async function remove() {
    await caches.delete(P.CACHE);
    await tellWorker();
  }

  function toast(text) {
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:12px;'
      + 'max-width:calc(100vw - 32px);background:#1B2430;color:#fff;border-radius:10px;padding:10px 12px 10px 16px;'
      + 'font:500 14px/1.35 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)';
    el.innerHTML = `<span>${text}</span><button style="flex:none;border:0;border-radius:7px;padding:7px 12px;background:#6FB3E0;color:#11151B;font:700 14px/1 system-ui,sans-serif;cursor:pointer">Reload</button>`
      + '<button aria-label="Dismiss" style="flex:none;border:0;background:none;color:#B3BAC4;font:400 20px/1 system-ui,sans-serif;padding:4px;cursor:pointer">×</button>';
    const [reload, close] = el.querySelectorAll('button');
    reload.onclick = () => location.reload();
    close.onclick = () => el.remove();
    document.body.appendChild(el);
  }

  async function autoUpdate() {
    if (navigator.onLine === false || !(await status())) return;
    try {
      if (Date.now() - Number(localStorage.getItem(CHECKED) || 0) < CHECK_EVERY) return;
      localStorage.setItem(CHECKED, String(Date.now()));
    } catch { /* storage blocked: check every visit */ }
    const r = await locked(() => sync());
    if (r.changed) toast('Deep End was updated, and your offline copy too.');
  }
  addEventListener('load', () => setTimeout(() => autoUpdate().catch(() => { /* next visit retries */ }), 2000));

  window.DeepOffline = { status, manifest, save, remove };
})();

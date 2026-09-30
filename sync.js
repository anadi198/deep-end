/* Cloud sync for the prep labs: Google sign-in (Firebase Auth) and one Firestore document per lab,
 * at users/{uid}/labs/{lab}. Free Spark plan; nothing loads until you sign in once.
 *
 * Setup: sync-config.js sets window.LAB_FIREBASE = { apiKey, authDomain, projectId, appId, ... }. That file is
 * gitignored: on GitHub Pages the deploy workflow writes it from the LAB_FIREBASE repository secret, and a
 * local copy starts from sync-config.example.js. Without it the page works and sync stays off.
 * A lab calls LabSync.init({ lab, getState, merge, apply, subscribe }):
 *   getState()          the state to upload (device-only fields already removed)
 *   merge(local, cloud) combine two copies
 *   apply(cloud)        merge a downloaded copy into the page; returns true if anything changed
 *   subscribe(fn)       call fn after every local save
 * Every upload reads the cloud copy first and merges, so two devices never overwrite each other.
 */
(function () {
  'use strict';
  const VER = '12.19.0';
  const CDN = `https://www.gstatic.com/firebasejs/${VER}`;
  const ON_KEY = 'labsync.on';
  const MAX_BYTES = 900 * 1024;   // Firestore's hard limit is 1 MiB per document

  let opts = null, fb = null, user = null, pushTimer = null, pushing = false, again = false;
  // sync-config.js either sets window.LAB_FIREBASE or is the snippet pasted from the Firebase console
  // ("const firebaseConfig = { ... };"), which declares a global binding instead of a window property.
  const config = () => window.LAB_FIREBASE || (typeof firebaseConfig !== 'undefined' ? firebaseConfig : null);
  const status = { state: 'off', at: 0, error: null, email: null };
  const listeners = new Set();
  const emit = () => { for (const f of listeners) try { f({ ...status }); } catch { /* ignore */ } };
  const set = (patch) => { Object.assign(status, patch); emit(); };
  const flag = (v) => { try { if (v) localStorage.setItem(ON_KEY, '1'); else localStorage.removeItem(ON_KEY); } catch { /* ignore */ } };
  const wasOn = () => { try { return localStorage.getItem(ON_KEY) === '1'; } catch { return false; } };

  async function load() {
    if (fb) return fb;
    const [app, auth, fs] = await Promise.all([
      import(`${CDN}/firebase-app.js`), import(`${CDN}/firebase-auth.js`), import(`${CDN}/firebase-firestore-lite.js`),
    ]);
    const a = app.initializeApp(config());
    fb = { app, auth, fs, A: auth.getAuth(a), db: fs.getFirestore(a) };
    fb.auth.onAuthStateChanged(fb.A, async (u) => {
      user = u;
      if (!u) { set({ state: 'signed-out', email: null }); return; }
      flag(true);
      set({ state: 'syncing', email: u.email || null, error: null });
      await pull();
      schedule(500);
    });
    return fb;
  }
  const ref = () => fb.fs.doc(fb.db, 'users', user.uid, 'labs', opts.lab);

  async function readCloud() {
    const snap = await fb.fs.getDoc(ref());
    if (!snap.exists()) return null;
    const d = snap.data();
    try { return JSON.parse(d.state); } catch { return null; }
  }
  async function pull() {
    if (!user) return;
    try {
      const cloud = await readCloud();
      if (cloud) opts.apply(cloud);
      set({ state: 'synced', at: Date.now(), error: null });
    } catch (e) { set({ state: 'error', error: friendly(e) }); }
  }
  function schedule(ms = 4000) {
    if (!user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, ms);
  }
  async function push() {
    if (!user) return;
    if (pushing) { again = true; return; }
    pushing = true;
    set({ state: 'syncing' });
    try {
      const cloud = await readCloud();
      if (cloud) opts.apply(cloud);   // the page now holds the merge of both copies
      let state = opts.getState();
      let json = JSON.stringify(state);
      if (json.length > MAX_BYTES) { state = shrink(state); json = JSON.stringify(state); }
      if (json.length > MAX_BYTES) throw new Error('Your saved data is too big to sync (over 900 KB).');
      await fb.fs.setDoc(ref(), { state: json, at: Date.now(), v: 1, agent: navigator.userAgent.slice(0, 120) });
      set({ state: 'synced', at: Date.now(), error: null });
    } catch (e) {
      set({ state: 'error', error: friendly(e) });
    } finally {
      pushing = false;
      if (again) { again = false; schedule(1000); }
    }
  }
  // Drop the bulkiest, least important data first: old review texts.
  function shrink(state) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.reviews) for (const id of Object.keys(s.reviews)) s.reviews[id] = s.reviews[id].slice(0, 1).map((r) => ({ ...r, text: String(r.text || '').slice(0, 2000) }));
    return s;
  }
  function friendly(e) {
    const m = String((e && (e.code || e.message)) || e);
    if (/permission-denied|insufficient permissions/i.test(m)) return 'The database refused the write. Are the Firestore rules published?';
    if (/unavailable|network|failed to fetch|offline/i.test(m)) return 'Offline. Changes are kept here and sync when you are back.';
    if (/popup-closed|cancelled-popup/i.test(m)) return 'Sign-in window was closed.';
    if (/unauthorized-domain/i.test(m)) return 'This site is not in Firebase Authentication → Settings → Authorized domains.';
    if (/operation-not-allowed/i.test(m)) return 'Google sign-in is not enabled in Firebase Authentication → Sign-in method.';
    return m.replace(/^Firebase: /, '');
  }

  const api = {
    configured: () => !!(config() && config().apiKey),
    status: () => ({ ...status }),
    onStatus(fn) { listeners.add(fn); fn({ ...status }); return () => listeners.delete(fn); },
    async init(o) {
      opts = o;
      if (!api.configured()) { set({ state: 'off' }); return; }
      set({ state: 'signed-out' });
      o.subscribe(() => schedule());
      document.addEventListener('visibilitychange', () => {
        if (!user) return;
        if (document.visibilityState === 'hidden') { clearTimeout(pushTimer); push(); } else pull();
      });
      if (wasOn()) { try { await load(); } catch (e) { set({ state: 'error', error: 'Could not load sync: ' + friendly(e) }); } }
    },
    async signIn() {
      if (!api.configured()) return;
      try {
        await load();
        const p = new fb.auth.GoogleAuthProvider();
        p.setCustomParameters({ prompt: 'select_account' });
        try { await fb.auth.signInWithPopup(fb.A, p); }
        catch (e) { if (/popup-blocked/.test(String(e.code || e))) await fb.auth.signInWithRedirect(fb.A, p); else throw e; }
      } catch (e) { set({ state: 'error', error: friendly(e) }); }
    },
    async signOut() {
      if (!fb) return;
      clearTimeout(pushTimer);
      if (user) await push();
      await fb.auth.signOut(fb.A);
      flag(false);
      set({ state: 'signed-out', email: null });
    },
    syncNow() { if (user) { clearTimeout(pushTimer); return push(); } },
  };
  window.LabSync = api;
})();

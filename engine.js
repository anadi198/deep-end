/* Rust Lab engine: your Rust compiles and runs on the official Rust Playground (play.rust-lang.org),
 * which accepts requests from any web page. One request at a time; identical requests are answered
 * from memory. Returns the Playground's JSON ({ success, exitDetail, stdout, stderr } or { error }). */
(function () {
  'use strict';
  const H = window.RustHarness;
  const BASE = 'https://play.rust-lang.org/';

  const Play = {
    state: 'idle',        // idle | busy | ok | offline
    error: null,
    version: null,
    listeners: new Set(),
    notify() { for (const f of this.listeners) f(); },
    queue: Promise.resolve(),
    memo: new Map(),
    pending: 0,

    call(kind, code) {
      const k = H.key(kind, code);
      if (this.memo.has(k)) return Promise.resolve(this.memo.get(k));
      this.pending++;
      const job = this.queue.then(() => this.send(kind, code));
      this.queue = job.catch(() => {});
      return job.then((r) => {
        this.pending--;
        if (!r.error || /timed out|deadline/i.test(r.error)) this.memo.set(k, r);
        this.state = this.pending ? 'busy' : r.error && !/timed out|deadline/i.test(r.error) ? 'offline' : 'ok';
        this.notify();
        return r;
      });
    },

    async send(kind, code) {
      const { endpoint, body } = H.request(kind, code);
      this.state = 'busy'; this.notify();
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 45000);
      try {
        const r = await fetch(BASE + endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
        let j = null;
        try { j = await r.json(); } catch { /* not json */ }
        if (r.status === 429) return { error: 'The Rust Playground is busy (rate limit). Wait a minute and try again.' };
        if (!r.ok && !(j && j.error)) return { error: `The Rust Playground answered ${r.status}. Try again in a moment.` };
        if (j && j.exit_detail && !j.exitDetail) j.exitDetail = j.exit_detail;
        this.error = null;
        return j || { error: 'The Rust Playground sent an empty answer.' };
      } catch (e) {
        this.error = ctl.signal.aborted ? 'The Rust Playground took longer than 45 seconds.' : navigator.onLine === false ? 'You are offline. Recorded outputs still show; Run needs the internet.' : 'Could not reach play.rust-lang.org.';
        return { error: this.error };
      } finally {
        clearTimeout(timer);
      }
    },

    async loadVersion() {
      try {
        const r = await fetch(BASE + 'meta/versions');
        const j = await r.json();
        this.version = j.stable && j.stable.rustc && j.stable.rustc.version;
        if (this.state === 'idle') this.state = 'ok';
      } catch { if (this.state === 'idle') { this.state = 'offline'; this.error = 'Could not reach play.rust-lang.org.'; } }
      this.notify();
      return this.version;
    },
  };

  window.RustEngine = { Play };
})();

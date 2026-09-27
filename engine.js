/* LLD Lab engines: where your Java compiles and runs.
 *   browser — javac + TeaVM compiled to WebAssembly, in web workers (works anywhere, incl. phones)
 *   local   — your JDK, through runner/server.mjs on 127.0.0.1:8789
 * Both return the same shape:
 *   { compile: { ok, ms, diagnostics: [{ file, line, col, message }] },
 *     runs: [{ stdout, ms, timedOut, trap? }] }
 */
(function () {
  'use strict';
  const RUNNER_PORT = 8789;
  const TOKEN_KEY = 'lldlab.token';

  // Pairing: the runner serves the page with the token; the hosted site pairs through #pair=…
  function pairFromHash() {
    try {
      const m = /[#&]pair=([\w-]+)/.exec(location.hash);
      if (!m) return false;
      localStorage.setItem(TOKEN_KEY, m[1]);
      history.replaceState(null, '', location.pathname + location.search + (location.hash.replace(/[#&]?pair=[\w-]+/, '') || '#/'));
      return true;
    } catch { return false; }
  }
  try { if (window.LLDLAB_LOCAL_TOKEN) localStorage.setItem(TOKEN_KEY, window.LLDLAB_LOCAL_TOKEN); } catch { /* storage blocked */ }
  if (pairFromHash()) window.LLDLAB_JUST_PAIRED = true;
  const token = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };

  /* ───────────── In-browser engine ───────────── */
  const Browser = {
    name: 'In-browser',
    state: 'idle',         // idle | loading | ready | error
    error: null,
    worker: null,
    readyPromise: null,
    pending: new Map(),
    nextId: 1,
    listeners: new Set(),
    loadMs: 0,
    notify() { for (const f of this.listeners) f(); },
    init() {
      if (this.readyPromise) return this.readyPromise;
      if (location.protocol === 'file:') {
        this.state = 'error';
        this.error = 'The in-browser compiler needs the page served over http(s). Run "node serve.mjs" and open http://localhost:8767, or use the hosted site.';
        this.notify();
        return (this.readyPromise = Promise.reject(new Error(this.error)));
      }
      if (typeof WebAssembly === 'undefined' || !WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 95, 1, 127, 0]))) {
        this.state = 'error';
        this.error = 'This browser lacks WebAssembly GC (needs Chrome/Edge 119+, Firefox 120+ or Safari 18.2+). Update it, or use "Your JDK".';
        this.notify();
        return (this.readyPromise = Promise.reject(new Error(this.error)));
      }
      this.state = 'loading'; this.notify();
      const t0 = performance.now();
      this.readyPromise = new Promise((resolve, reject) => {
        const w = new Worker(new URL('workers/compile.js', location.href), { type: 'module' });
        this.worker = w;
        w.onmessage = (e) => {
          const d = e.data;
          if ('ready' in d) {
            if (d.ready) { this.state = 'ready'; this.loadMs = performance.now() - t0; resolve(); }
            else { this.state = 'error'; this.error = 'Could not start the in-browser compiler: ' + d.error; reject(new Error(this.error)); }
            this.notify();
            return;
          }
          const p = this.pending.get(d.id);
          if (p) { this.pending.delete(d.id); p(d); }
        };
        w.onerror = (e) => {
          this.state = 'error'; this.error = 'The compiler worker failed: ' + (e.message || 'unknown error');
          for (const p of this.pending.values()) p({ ok: false, diags: [{ file: null, line: -1, message: this.error }] });
          this.pending.clear();
          this.readyPromise = null;
          this.notify();
          reject(new Error(this.error));
        };
      });
      return this.readyPromise;
    },
    async compile(files, mainClass) {
      await this.init();
      const r = await new Promise((resolve) => {
        const id = this.nextId++;
        this.pending.set(id, resolve);
        this.worker.postMessage({ id, files, mainClass });
      });
      // A crash inside the Wasm compiler can leave it unusable; start a fresh one next time.
      if (!r.ok && (r.diags || []).some((d) => d.type === 'internal')) this.restart();
      return r;
    },
    restart() {
      if (this.worker) this.worker.terminate();
      this.worker = null; this.readyPromise = null; this.state = 'idle';
      for (const p of this.pending.values()) p({ ok: false, diags: [{ type: 'internal', severity: 'error', file: null, line: -1, message: 'The compiler was restarted.' }] });
      this.pending.clear();
      this.notify();
    },
    run(wasm, args, { timeoutMs = 10000, onLines } = {}) {
      return new Promise((resolve) => {
        const w = new Worker(new URL('workers/run.js', location.href), { type: 'module' });
        const lines = [];
        const t0 = performance.now();
        let finished = false;
        const finish = (extra) => {
          if (finished) return;
          finished = true; clearTimeout(timer); w.terminate();
          resolve({ stdout: lines.join('\n'), ms: performance.now() - t0, ...extra });
        };
        const timer = setTimeout(() => finish({ timedOut: true }), timeoutMs);
        w.onmessage = (e) => {
          const d = e.data;
          if (d.lines) { lines.push(...d.lines); if (onLines) onLines(d.lines); }
          if (d.done) finish({ ms: d.ms });
          if (d.trap) finish({ trap: d.trap, ms: d.ms });
        };
        w.onerror = (e) => finish({ trap: e.message || 'worker error' });
        // copy: the same module may run several times
        w.postMessage({ wasm: wasm.slice(), args: args.map(String) });
      });
    },
    async compileRun(files, mainClass, argSets, opts = {}) {
      const c = await this.compile(files, mainClass);
      const compile = { ok: c.ok, ms: c.ms, diagnostics: (c.diags || []).filter((d) => d.severity === 'error').map((d) => ({ file: d.file, line: d.line, col: d.col, message: d.message })) };
      if (!c.ok) return { compile };
      compile.wasm = c.wasm;
      const runs = [];
      for (const args of argSets) runs.push(await this.run(c.wasm, args, opts));
      return { compile, runs };
    },
  };

  /* ───────────── Your JDK (local runner) ───────────── */
  const Local = {
    name: 'Your JDK',
    state: 'idle',       // idle | checking | ready | unpaired | down
    error: null,
    java: null,
    listeners: new Set(),
    notify() { for (const f of this.listeners) f(); },
    base: `http://127.0.0.1:${RUNNER_PORT}`,
    async check() {
      this.state = 'checking'; this.notify();
      try {
        const r = await fetch(this.base + '/api/hello', { headers: { 'x-lldlab-token': token() } });
        const j = await r.json();
        this.java = j.java;
        this.claude = j.claude || null;
        this.state = j.paired ? 'ready' : 'unpaired';
        this.error = j.paired ? null : 'The runner is up but this page is not paired with it.';
      } catch (e) {
        this.state = 'down';
        this.error = 'The LLD Lab runner is not reachable on 127.0.0.1:' + RUNNER_PORT + '.';
      }
      this.notify();
      return this.state;
    },
    async compileRun(files, mainClass, argSets, { timeoutMs = 10000 } = {}) {
      let r;
      try {
        r = await fetch(this.base + '/api/run', {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-lldlab-token': token() },
          body: JSON.stringify({ files, mainClass, args: argSets, timeoutMs }),
        });
      } catch (e) {
        this.state = 'down'; this.notify();
        throw new Error('Could not reach the runner on 127.0.0.1:' + RUNNER_PORT + '. Is it still running?');
      }
      const j = await r.json();
      if (!r.ok) { if (r.status === 401) { this.state = 'unpaired'; this.notify(); } throw new Error(j.error || ('runner error ' + r.status)); }
      if (!j.compile.ok) return { compile: { ok: false, ms: j.compile.ms, diagnostics: j.compile.diagnostics.filter((d) => d.severity === 'error'), raw: j.compile.raw } };
      return {
        compile: { ok: true, ms: j.compile.ms },
        runs: j.runs.map((x) => ({ stdout: x.stdout, ms: x.ms, timedOut: x.timedOut, stderr: x.stderr, exitCode: x.exitCode, truncated: x.truncated })),
      };
    },
    // Asks Claude (the Claude Code CLI on this computer) to review. Streams text through onText;
    // resolves with { text, error? }. abort() on the returned controller stops it.
    review(payload, onText) {
      const ctl = new AbortController();
      const done = (async () => {
        let r;
        try {
          r = await fetch(this.base + '/api/review', {
            method: 'POST', signal: ctl.signal,
            headers: { 'content-type': 'application/json', 'x-lldlab-token': token() },
            body: JSON.stringify(payload),
          });
        } catch (e) {
          if (ctl.signal.aborted) return { text: '', error: 'stopped' };
          this.state = 'down'; this.notify();
          return { text: '', error: 'Could not reach the runner on 127.0.0.1:' + RUNNER_PORT + '.' };
        }
        if (!r.ok) {
          let msg = 'runner error ' + r.status;
          try { msg = (await r.json()).error || msg; } catch { /* not json */ }
          if (r.status === 401) { this.state = 'unpaired'; this.notify(); }
          return { text: '', error: msg };
        }
        // Server-sent events: data: {"t":"text chunk"} | {"error":"..."} | {"done":true}
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = '', text = '', error = null;
        try {
          for (;;) {
            const { value, done: end } = await reader.read();
            if (end) break;
            buf += dec.decode(value, { stream: true });
            let k;
            while ((k = buf.indexOf('\n\n')) >= 0) {
              const ev = buf.slice(0, k); buf = buf.slice(k + 2);
              const line = ev.split('\n').find((l) => l.startsWith('data: '));
              if (!line) continue;
              let d; try { d = JSON.parse(line.slice(6)); } catch { continue; }
              if (d.t) { text += d.t; if (onText) onText(text, d.t); }
              if (d.error) error = d.error;
            }
          }
        } catch (e) {
          if (!ctl.signal.aborted) error = String(e.message || e);
          else error = 'stopped';
        }
        return { text, error };
      })();
      return { done, abort: () => ctl.abort() };
    },
  };

  window.LLDEngine = { Browser, Local, token, pairFromHash, RUNNER_PORT };
})();

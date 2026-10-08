/* A dependency slows down for five seconds. The caller times out and maybe retries. The dependency
 * queues every request it receives (an unbounded queue, as thread pools have by default) and keeps
 * working on requests whose caller already gave up, unless it is told their deadline.
 * A fluid model: requests move in groups that share an arrival time and an attempt number. */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const DT = 0.1, END = 60, INC_FROM = 10, INC_TO = 15, CAP = 1000, TIMEOUT = 1.0;
  const RECIPES = {
    none: { retries: 0 },
    naive: { retries: 3 },
    backoff: { retries: 3, backoff: true },
    budget: { retries: 3, backoff: true, budget: 0.1 },
    deadline: { retries: 3, backoff: true, budget: 0.1, drop: true },
    breaker: { retries: 3, backoff: true, budget: 0.1, drop: true, breaker: true },
  };

  BS.define('retry', {
    title: 'A slow dependency and a crowd of retries',
    blurb: 'Your service sends 800 requests a second to a dependency that can serve 1,000. From 10 s to 15 s the dependency slows down. Callers time out after 1 s.',
    compare: 'strategy',
    params: [
      { id: 'strategy', label: 'What callers and the dependency do', type: 'select', value: 'naive', options: [
        ['none', 'No retries'],
        ['naive', 'Retry 3 times, immediately'],
        ['backoff', 'Retry 3 times, with backoff and jitter'],
        ['budget', '… plus a retry budget (10%)'],
        ['deadline', '… plus the dependency drops expired work'],
        ['breaker', '… plus a circuit breaker'],
      ] },
      { id: 'rate', label: 'Requests per second', type: 'range', min: 200, max: 950, step: 50, value: 800 },
      { id: 'slowCap', label: 'Capacity during the slowdown', type: 'range', min: 0, max: 900, step: 50, value: 300, unit: '/s' },
    ],
    run(p) {
      const k = RECIPES[p.strategy] || RECIPES.naive;
      const r = BS.rng(3);
      const ticks = Math.round(END / DT);
      const queue = [];                 // FIFO of { t0, n, a, dead }
      const later = new Map();          // tick → Map(attempt → n)
      const schedule = (tick, n, a) => { if (n <= 0) return; const l = later.get(tick) || new Map(); l.set(a, (l.get(a) || 0) + n); later.set(tick, l); };
      let tokens = 0;
      const br = { state: 'closed', until: 0, log: [] };   // log: [ok, fail] per tick
      const sec = Array.from({ length: END }, () => ({ sent: 0, ok: 0, fail: 0 }));
      let wasted = 0, okTotal = 0, users = 0, waitedOnFailures = 0, fastFails = 0;

      for (let i = 0; i < ticks; i++) {
        const t = i * DT, s = sec[Math.floor(t + 1e-9)];
        const cap = (t >= INC_FROM && t < INC_TO ? p.slowCap : CAP) * DT;
        let okNow = 0, failNow = 0;

        // circuit breaker state
        if (k.breaker) {
          const recent = br.log.slice(-10).reduce((a, x) => [a[0] + x[0], a[1] + x[1]], [0, 0]);
          const total = recent[0] + recent[1];
          if (br.state === 'closed' && total >= 50 && recent[1] / total > 0.5) { br.state = 'open'; br.until = t + 3; }
          else if (br.state === 'open' && t >= br.until) { br.state = 'half'; br.until = t + 1; br.log = []; }
          else if (br.state === 'half' && t >= br.until) { br.state = total && recent[1] / total > 0.5 ? 'open' : 'closed'; br.until = t + 3; }
        }
        const admit = !k.breaker || br.state === 'closed' ? 1 : br.state === 'half' ? 0.1 : 0;

        // new users, and retries that are due
        const fresh = p.rate * DT;
        users += fresh;
        const arrivals = [{ n: fresh, a: 0 }, ...[...(later.get(i) || [])].map(([a, n]) => ({ n, a }))];
        later.delete(i);
        for (const g of arrivals) {
          const go = g.n * admit;
          if (g.n - go > 0) { fastFails += g.n - go; s.fail += g.n - go; }
          if (go <= 0) continue;
          if (g.a === 0 && k.budget) tokens = Math.min(tokens + go * k.budget, p.rate * k.budget);
          queue.push({ t0: t, n: go, a: g.a, dead: false });
          s.sent += go;
        }

        // callers time out; the request stays in the dependency's queue
        for (const q of queue) {
          if (q.dead || t - q.t0 < TIMEOUT - 1e-9) continue;
          q.dead = true;
          failNow += q.n;
          waitedOnFailures += q.n * TIMEOUT;
          let retry = q.a < k.retries ? q.n : 0;
          if (retry && k.budget) { const allowed = Math.min(retry, tokens); tokens -= allowed; retry = allowed; }
          s.fail += q.n - retry;
          if (!retry) continue;
          if (!k.backoff) schedule(i + 1, retry, q.a + 1);
          else {
            const span = Math.max(1, Math.round(Math.min(4, 0.2 * 2 ** (q.a + 1)) / DT));
            const off = Math.floor(r() * 3);
            for (let j = 1; j <= span; j++) schedule(i + j + (j === span ? off : 0), retry / span, q.a + 1);
          }
        }

        // the dependency works through its queue
        let c = cap;
        while (queue.length && (c > 1e-9 || (k.drop && queue[0].dead))) {
          const q = queue[0];
          if (q.dead && k.drop) { queue.shift(); continue; }
          const n = Math.min(c, q.n);
          if (q.dead) wasted += n; else { okNow += n; okTotal += n; s.ok += n; }
          q.n -= n; c -= n;
          if (q.n <= 1e-9) queue.shift();
        }
        if (k.breaker) br.log.push([okNow, failNow]);
      }

      // recovered: from this second on, at least 95% of each second's new users succeed
      const ratio = sec.map((x) => x.ok / p.rate);
      let recoveredAt = null;
      for (let j = END - 1; j >= INC_TO && ratio[j] >= 0.95; j--) recoveredAt = j;
      if (ratio[END - 1] < 0.95) recoveredAt = null;
      const recoveredAfter = recoveredAt === null ? null : recoveredAt - INC_TO;
      const peakAmplification = Math.max(...sec.map((x) => x.sent / p.rate));
      const success = okTotal / users;

      return {
        out: { recoveredAfter, peakAmplification, success, wasted, fastFails },
        stats: [
          { label: 'Requests that succeeded', value: `${(100 * success).toFixed(0)}%`, tone: success > 0.9 ? 'good' : success > 0.6 ? 'warn' : 'bad' },
          { label: 'Back to normal', value: recoveredAfter === null ? 'never (in 45 s)' : `${recoveredAfter} s after the slowdown`, tone: recoveredAfter === null ? 'bad' : recoveredAfter <= 3 ? 'good' : 'warn' },
          { label: 'Peak load sent, vs normal', value: `${peakAmplification.toFixed(1)}×`, tone: peakAmplification > 1.5 ? 'bad' : peakAmplification > 1.15 ? 'warn' : 'good' },
          { label: 'Work done for callers who had left', value: Math.round(wasted).toLocaleString('en'), tone: wasted > 1000 ? 'bad' : wasted ? 'warn' : 'good' },
          { label: 'Total time callers spent waiting on timeouts', value: `${Math.round(waitedOnFailures).toLocaleString('en')} s`, tone: 'warn' },
        ],
        chart: {
          x: sec.map((_, j) => j), xLabel: 'seconds', yLabel: 'requests per second',
          lines: [
            { name: 'Sent to the dependency', values: sec.map((x) => Math.round(x.sent)), tone: 'warn' },
            { name: 'Succeeded', values: sec.map((x) => Math.round(x.ok)), tone: 'good' },
            { name: 'Dependency capacity', values: sec.map((_, j) => (j >= INC_FROM && j < INC_TO ? p.slowCap : CAP)), tone: 'muted', dash: true },
          ],
          bands: [{ from: INC_FROM, to: INC_TO, label: 'slowdown' }],
        },
        notes: [
          recoveredAfter === null
            ? 'The slowdown ended at 15 s, but the system never came back: retries and dead work keep the queue longer than the timeout, so everything served is already abandoned. This is a metastable failure.'
            : recoveredAfter > 3 ? `It recovered, but only ${recoveredAfter} s after the cause was gone: the queue first had to drain work nobody was waiting for.` : 'It recovered within seconds of the dependency recovering.',
          k.breaker ? `The breaker failed ${Math.round(fastFails).toLocaleString('en')} requests fast instead of letting them wait a full second each.` : '',
        ].filter(Boolean),
      };
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = BS.all.retry;
})(typeof globalThis !== 'undefined' ? globalThis : this);

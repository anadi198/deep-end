/* Latency distributions: what an average hides, and how fan-out turns a rare slow call into a common
 * slow page. Each backend call is fast most of the time and occasionally hits a slow path
 * (a GC pause, a cold cache, a lock wait). A page waits for all of its parallel calls. */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const PAGES = 20000;
  const SLOW_PAGE = 500;   // ms: what a user notices
  const SESSION = 20;      // page loads in one visit
  const BUCKETS = [[0, 50], [50, 100], [100, 200], [200, 300], [300, 500], [500, 1000], [1000, 2000], [2000, Infinity]];

  function summary(xs) {
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    return { mean, p50: BS.percentile(xs, 50), p95: BS.percentile(xs, 95), p99: BS.percentile(xs, 99), p999: BS.percentile(xs, 99.9) };
  }

  BS.define('latency', {
    title: 'What the average hides',
    blurb: '20,000 page loads. Each backend call is usually fast and sometimes hits a slow path. A page waits for every call it fans out to.',
    params: [
      { id: 'slowPct', label: 'Backend calls that hit the slow path', type: 'range', min: 0, max: 10, step: 0.5, value: 2, unit: '%' },
      { id: 'slowMs', label: 'The slow path takes about', type: 'range', min: 200, max: 3000, step: 100, value: 1600, unit: 'ms' },
      { id: 'fanout', label: 'Backend calls per page (in parallel)', type: 'range', min: 1, max: 100, step: 1, value: 1 },
    ],
    run(p) {
      const r = BS.rng(11);
      const call = (slowPct) => (r() * 100 < slowPct ? p.slowMs * (0.7 + 0.6 * r()) : 50 + 40 * -Math.log(1 - r()));
      const calls = [], pages = [];
      for (let i = 0; i < PAGES; i++) {
        let worst = 0;
        for (let k = 0; k < p.fanout; k++) {
          const ms = call(p.slowPct);
          if (k === 0) calls.push(ms);
          if (ms > worst) worst = ms;
        }
        pages.push(worst);
      }
      const c = summary(calls), pg = summary(pages);
      const pageSlowShare = pages.filter((x) => x > SLOW_PAGE).length / PAGES;
      const sessionSlowShare = 1 - Math.pow(1 - pageSlowShare, SESSION);

      // two servers behind one load balancer: one healthy, one with twice the slow calls
      const a = [], b = [];
      for (let i = 0; i < PAGES / 2; i++) { a.push(call(0)); b.push(call(2 * p.slowPct)); }
      const avgOfP99s = (BS.percentile(a, 99) + BS.percentile(b, 99)) / 2;
      const pooledP99 = BS.percentile(a.concat(b), 99);

      const ms = (x) => `${Math.round(x).toLocaleString('en')} ms`;
      const pct = (x) => `${(100 * x).toFixed(x < 0.1 ? 1 : 0)}%`;
      return {
        out: { call: c, page: pg, pageSlowShare, sessionSlowShare, avgOfP99s, pooledP99 },
        stats: [
          { label: 'Average page load', value: ms(pg.mean), tone: pg.mean < 200 ? 'good' : 'warn' },
          { label: 'Median (p50)', value: ms(pg.p50), tone: 'good' },
          { label: 'p99: 1 load in 100 is slower than', value: ms(pg.p99), tone: pg.p99 > 1000 ? 'bad' : pg.p99 > SLOW_PAGE ? 'warn' : 'good' },
          { label: `Page loads over ${SLOW_PAGE} ms`, value: pct(pageSlowShare), tone: pageSlowShare > 0.05 ? 'bad' : pageSlowShare > 0.01 ? 'warn' : 'good' },
          { label: `Visits of ${SESSION} loads that hit one`, value: pct(sessionSlowShare), tone: sessionSlowShare > 0.25 ? 'bad' : sessionSlowShare > 0.05 ? 'warn' : 'good' },
        ],
        bars: {
          title: 'Where page loads actually land',
          unit: '%',
          items: BUCKETS.map(([lo, hi]) => ({
            label: hi === Infinity ? `${lo / 1000} s +` : hi <= 1000 ? `${lo}–${hi} ms` : `${lo / 1000}–${hi / 1000} s`,
            value: +(100 * pages.filter((x) => x >= lo && x < hi).length / PAGES).toFixed(2),
            tone: lo >= SLOW_PAGE ? 'bad' : lo >= 200 ? 'warn' : 'good',
          })),
        },
        table: {
          cols: ['', 'mean', 'p50', 'p95', 'p99', 'p99.9'],
          rows: [
            ['One backend call', ...['mean', 'p50', 'p95', 'p99', 'p999'].map((k) => ms(c[k]))],
            [`A page (${p.fanout} call${p.fanout === 1 ? '' : 's'})`, ...['mean', 'p50', 'p95', 'p99', 'p999'].map((k) => ms(pg[k]))],
          ],
        },
        notes: [
          `Half the page loads finish under ${ms(pg.p50)}, yet ${pct(pageSlowShare)} take more than ${SLOW_PAGE} ms. The average sits between the two groups and describes neither.`,
          p.fanout > 1 ? `With ${p.fanout} parallel calls, a page is as slow as its slowest call: the page's p50 is close to one call's p${Math.min(99.9, +(100 * (1 - 1 / p.fanout)).toFixed(1))}.` : 'Raise the fan-out to see a rare slow call become a common slow page.',
          `Two servers, one healthy and one degraded: the average of their p99s is ${ms(avgOfP99s)}, but the p99 of their combined traffic is ${ms(pooledP99)}. Percentiles do not average.`,
        ],
      };
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = BS.all.latency;
})(typeof globalThis !== 'undefined' ? globalThis : this);

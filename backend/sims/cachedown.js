/* Redis goes down. The database was sized for the cache's misses, not for all the traffic.
 * One rule for the database: past its capacity, useful throughput collapses (cap × cap / offered),
 * because every query gets a thinner slice and times out. When Redis returns it is empty and refills
 * as requests miss (hit rate climbs back with a 15 s time constant). */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const RATE = 10000, DB_CAP = 2000, DOWN = 30, BACK = 90, END = 150, WARM_TAU = 15, L1_HIT = 0.6;
  const CACHE_TIMEOUT_MS = 1000, FAST_MS = 50, BREAKER_TRIP = 2;

  BS.define('cachedown', {
    title: 'Redis goes down',
    blurb: '10,000 requests a second, a 95% cache hit rate, and a database sized for 2,000 queries a second. Redis is down from 30 s to 90 s and comes back empty.',
    compare: 'strategy',
    params: [
      { id: 'strategy', label: 'How the service reacts', type: 'select', value: 'failopen', options: [
        ['failopen', 'Fall back to the database (1 s cache timeout)'],
        ['fastfail', 'Fail fast on the cache (50 ms timeout, breaker)'],
        ['shed', '… plus shed what the database cannot take'],
        ['l1', '… plus an in-process cache for hot keys'],
      ] },
      { id: 'hit', label: 'Redis hit rate when healthy', type: 'range', min: 80, max: 99, step: 1, value: 95, unit: '%' },
    ],
    run(p) {
      const h = p.hit / 100;
      const l1 = p.strategy === 'l1';
      const shed = p.strategy === 'shed' || l1;
      const sec = [];
      let outage = 0, warm = 0, waitSum = 0, peak = 0, backAt = null;
      for (let t = 0; t < END; t++) {
        const redisHit = t < DOWN ? h : t < BACK ? 0 : h * (1 - Math.exp(-(t - BACK + 1) / WARM_TAU));
        const miss = (l1 ? 1 - L1_HIT : 1) * (1 - redisHit);
        const offered = RATE * miss;
        const served = offered <= DB_CAP ? offered : shed ? DB_CAP : (DB_CAP * DB_CAP) / offered;
        const ok = (RATE - offered + served) / RATE;
        const down = t >= DOWN && t < BACK;
        const wait = !down ? 0 : p.strategy === 'failopen' ? CACHE_TIMEOUT_MS : t - DOWN < BREAKER_TRIP ? FAST_MS : 0;
        sec.push({ ok, offered, wait });
        if (down) { outage += ok; waitSum += wait; }
        if (t >= BACK && t < BACK + 30) warm += ok;
        peak = Math.max(peak, offered / DB_CAP);
      }
      for (let t = END - 1; t >= BACK && sec[t].ok >= 0.99; t--) backAt = t;
      const outageSuccess = outage / (BACK - DOWN), warmSuccess = warm / 30;
      const addedWaitMs = Math.round(waitSum / (BACK - DOWN));
      const pct = (x) => `${(100 * x).toFixed(0)}%`;
      return {
        out: { outageSuccess, warmSuccess, addedWaitMs, peakDbLoad: peak, backAfter: backAt === null ? null : backAt - BACK },
        stats: [
          { label: 'Requests served while Redis is down', value: pct(outageSuccess), tone: outageSuccess > 0.7 ? 'good' : outageSuccess > 0.15 ? 'warn' : 'bad' },
          { label: 'Added wait per request while down', value: `${addedWaitMs} ms`, tone: addedWaitMs > 100 ? 'bad' : 'good' },
          { label: 'Peak database load, vs capacity', value: `${peak.toFixed(1)}×`, tone: peak > 1 ? 'bad' : 'good' },
          { label: 'Served in the 30 s after Redis returns', value: pct(warmSuccess), tone: warmSuccess > 0.9 ? 'good' : warmSuccess > 0.6 ? 'warn' : 'bad' },
          { label: 'Back to 99%', value: backAt === null ? 'not within the run' : `${backAt - BACK} s after Redis returns`, tone: 'warn' },
        ],
        chart: {
          x: sec.map((_, t) => t), xLabel: 'seconds', yLabel: '% of requests / database load ×100%',
          lines: [
            { name: 'Requests served (%)', values: sec.map((s) => Math.round(100 * s.ok)), tone: 'good' },
            { name: 'Database load (% of capacity)', values: sec.map((s) => Math.round((100 * s.offered) / DB_CAP)), tone: 'bad' },
            { name: 'Database capacity', values: sec.map(() => 100), tone: 'muted', dash: true },
          ],
          bands: [{ from: DOWN, to: BACK, label: 'Redis down' }, { from: BACK, to: BACK + 30, label: 'refilling' }],
        },
        notes: [
          { failopen: 'Every request now goes to the database, which can take a fifth of them. Past capacity it serves even fewer, and each request first sat out a 1 s cache timeout.',
            fastfail: 'The breaker stops the 1 s waits, so failures are quick. The database is still offered five times its capacity and collapses just the same.',
            shed: 'A concurrency limit in front of the database keeps it at full speed; requests beyond it get a fast, degraded answer. 20% is the honest ceiling without a cache.',
            l1: 'Each instance keeps its hottest keys in memory, so 60% of traffic never needed Redis. The database gets the rest, up to its limit.' }[p.strategy],
          'When Redis returns it is empty. Until the hit rate climbs back, the database is overloaded again: the outage has a second act.',
        ],
      };
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = BS.all.cachedown;
})(typeof globalThis !== 'undefined' ? globalThis : this);

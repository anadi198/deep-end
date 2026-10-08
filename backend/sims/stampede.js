/* Cache stampedes. Hot key: one popular key expires and every request that misses rebuilds it from
 * the database, which slows down as more rebuilds run at once. Mass expiry: many keys cached at the
 * same moment with the same TTL all expire together. */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const TTL = 30, INSTANCES = 10, DB_PARALLEL = 50, GRACE = 60, BUCKET = 0.05;
  const MASS = { keys: 20000, rate: 4000, ttl: 60, end: 180, tick: 0.1, dbCap: 1500 };

  function hotKey(p) {
    const r = BS.rng(5);
    const D = p.rebuild / 1000;
    const from = TTL - 5, to = TTL + 6;
    const swr = p.protect === 'swr';
    let soft = TTL, hard = swr ? TTL + GRACE : TTL;
    const jobs = [];                       // { start, end, inst, applied }
    const waits = [];                      // [from, until]
    let queries = 0, stale = 0, maxWait = 0;
    const running = (t) => jobs.filter((j) => j.start <= t && t < j.end);
    function rebuild(t, inst) {
      const n = running(t).length + 1;
      const job = { start: t, end: t + D * Math.max(1, n / DB_PARALLEL), inst, applied: false };
      jobs.push(job); queries++;
      return job;
    }
    function settle(t) {
      for (const j of jobs.filter((x) => !x.applied && x.end <= t).sort((a, b) => a.end - b.end)) {
        j.applied = true;
        if (j.end + TTL > soft) { soft = j.end + TTL; hard = swr ? soft + GRACE : soft; }
      }
    }
    const wait = (t, until) => { waits.push([t, until]); maxWait = Math.max(maxWait, until - t); };

    for (let i = 0, n = Math.round((to - from) * p.rate); i < n; i++) {
      const t = from + i / p.rate, inst = i % INSTANCES;
      settle(t);
      if (t < soft) {
        if (p.protect === 'early' && t - D * Math.log(1 - r()) >= soft && !running(t).length) rebuild(t, inst);
        continue;
      }
      if (t < hard) {
        stale++;
        if (!running(t).length) rebuild(t, inst);
        continue;
      }
      const busy = running(t);
      if (p.protect === 'none') { wait(t, rebuild(t, inst).end); continue; }
      const mine = p.protect === 'local' ? busy.find((j) => j.inst === inst) : busy[0];
      wait(t, (mine || rebuild(t, inst)).end);
    }

    const xs = [];
    for (let t = TTL - 1; t <= TTL + 5 + 1e-9; t += BUCKET) xs.push(+t.toFixed(2));
    const peakDb = Math.max(0, ...jobs.map((j) => running(j.start + 1e-9).length));
    return {
      out: { queries, peakDb, waited: waits.length, maxWait, stale },
      stats: [
        { label: 'Database queries for one expiry', value: queries.toLocaleString('en'), tone: queries > INSTANCES ? 'bad' : queries > 1 ? 'warn' : 'good' },
        { label: 'Most queries running at once', value: peakDb, tone: peakDb > DB_PARALLEL ? 'bad' : peakDb > 1 ? 'warn' : 'good', note: `the database runs ${DB_PARALLEL} at full speed` },
        { label: 'Requests that had to wait', value: waits.length.toLocaleString('en'), tone: waits.length ? 'warn' : 'good' },
        { label: 'Longest wait', value: `${Math.round(maxWait * 1000).toLocaleString('en')} ms`, tone: maxWait > 1 ? 'bad' : maxWait ? 'warn' : 'good' },
        { label: 'Answers served stale', value: stale.toLocaleString('en'), tone: stale ? 'warn' : 'good' },
      ],
      chart: {
        x: xs.map((t) => +(t - TTL).toFixed(2)), xLabel: 'seconds after the key expires', yLabel: 'count',
        lines: [
          { name: 'Database queries running', values: xs.map((t) => running(t).length), tone: 'bad' },
          { name: 'Requests waiting', values: xs.map((t) => waits.filter(([a, b]) => a <= t && t < b).length), tone: 'warn' },
        ],
        marks: [{ x: 0, label: 'key expires' }],
      },
      notes: [
        { none: `Every request that arrived before the first rebuild finished went to the database (the two lines coincide: each waiting request is running its own query). Each extra query slowed the others, which widened the window and let in more.`,
          local: `Each of the ${INSTANCES} app instances let one request through and parked the rest behind it: ${INSTANCES} queries, but every request in the window still waited.`,
          lock: 'One request rebuilt the value. Everyone else waited for it, so the database was safe but the latency spike remains.',
          swr: 'The value was past its soft TTL but still usable: requests got the old value instantly while one background rebuild ran.',
          early: 'A request shortly before expiry won the coin toss and rebuilt the value early. Nobody missed, nobody waited.' }[p.protect],
      ],
    };
  }

  function massExpiry(p) {
    const r = BS.rng(9);
    const exp = new Float64Array(MASS.keys);
    const ttl = () => MASS.ttl * (p.jitter ? 0.9 + 0.2 * r() : 1);
    for (let k = 0; k < MASS.keys; k++) exp[k] = ttl();
    const perSec = new Array(MASS.end).fill(0);
    const ticks = Math.round(MASS.end / MASS.tick), per = MASS.rate * MASS.tick;
    for (let i = 0; i < ticks; i++) {
      const t = i * MASS.tick;
      for (let q = 0; q < per; q++) {
        const k = Math.floor(r() * MASS.keys);
        if (t >= exp[k]) { perSec[Math.floor(t)]++; exp[k] = t + ttl(); }
      }
    }
    const peakQps = Math.max(...perSec);
    const over = perSec.filter((x) => x > MASS.dbCap).length;
    return {
      out: { peakQps, over },
      stats: [
        { label: 'Peak database queries per second', value: peakQps.toLocaleString('en'), tone: peakQps > MASS.dbCap ? 'bad' : 'good', note: `capacity ${MASS.dbCap.toLocaleString('en')}/s` },
        { label: 'Seconds over database capacity', value: over, tone: over ? 'bad' : 'good' },
      ],
      chart: {
        x: perSec.map((_, j) => j), xLabel: 'seconds after the cache was filled', yLabel: 'queries per second',
        lines: [
          { name: 'Cache misses sent to the database', values: perSec, tone: 'bad' },
          { name: 'Database capacity', values: perSec.map(() => MASS.dbCap), tone: 'muted', dash: true },
        ],
        marks: [{ x: MASS.ttl, label: 'TTL' }],
      },
      notes: [p.jitter
        ? 'Each key got a TTL between 54 and 66 s, so the keys expire over 12 seconds instead of in one.'
        : `All ${MASS.keys.toLocaleString('en')} keys were cached in the same second with a 60 s TTL, so they all expire in the same second. Each rebuild resets its TTL, so the next waves get smaller but keep coming.`],
    };
  }

  BS.define('stampede', {
    title: 'A cache stampede',
    blurb: 'Hot key: 10 app instances share one popular key that expires every 30 s. Mass expiry: 20,000 keys cached at the same moment.',
    compare: 'protect',
    params: [
      { id: 'scenario', label: 'Scenario', type: 'select', value: 'hot', options: [['hot', 'One hot key expires'], ['mass', 'Many keys, same TTL']] },
      { id: 'protect', label: 'Protection', type: 'select', value: 'none', when: { scenario: 'hot' }, options: [
        ['none', 'None: every miss rebuilds'],
        ['local', 'Single-flight in each instance'],
        ['lock', 'A distributed lock; others wait'],
        ['swr', 'Stale-while-revalidate'],
        ['early', 'Probabilistic early refresh'],
      ] },
      { id: 'rate', label: 'Requests per second for the key', type: 'range', min: 200, max: 5000, step: 100, value: 2000, when: { scenario: 'hot' } },
      { id: 'rebuild', label: 'Rebuilding the value takes', type: 'range', min: 50, max: 2000, step: 50, value: 300, unit: 'ms', when: { scenario: 'hot' } },
      { id: 'jitter', label: 'Add ±10% jitter to each TTL', type: 'toggle', value: false, when: { scenario: 'mass' } },
    ],
    run: (p) => (p.scenario === 'mass' ? massExpiry(p) : hotKey(p)),
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = BS.all.stampede;
})(typeof globalThis !== 'undefined' ? globalThis : this);

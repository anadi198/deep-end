/* A Kafka consumer group: 12 partitions, 6,000 records a second, each record upserted into a database.
 * How the consumer processes records (one call each, batched, or on keyed worker threads) and how keys are
 * distributed decide whether lag stays at zero. Model assumptions: a database call takes 5 ms; a batched write of
 * up to 500 records costs 5 ms plus 0.05 ms a record; keyed mode runs 16 worker threads per consumer and keeps
 * one key on one worker, so a single key never goes faster than one call at a time. */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const P = 12, RATE = 6000, CALL = 5, BATCH = 500, PER_REC = 0.05, WORKERS = 16, END = 120, HOT_SHARE = 0.3, HOT_PART = 7;
  const PER_KEY = 1000 / CALL;   // the most one key can go when its records run one call at a time

  function demand(skew) {
    const d = new Array(P).fill(RATE / P);
    if (skew === 'hot') { for (let i = 0; i < P; i++) d[i] = (RATE * (1 - HOT_SHARE)) / P; d[HOT_PART] += RATE * HOT_SHARE; }
    return d;
  }
  // range assignment: contiguous blocks; members beyond the partition count get nothing
  function assign(consumers) {
    const k = Math.min(consumers, P), base = Math.floor(P / k), extra = P % k, out = [];
    for (let m = 0; m < k; m++) for (let j = 0; j < base + (m < extra ? 1 : 0); j++) out.push(m);
    return out;
  }

  BS.define('lag', {
    title: 'Consumer lag, and the hot key',
    blurb: '12 partitions, 6,000 records a second, a database write per record. Choose how many consumers, how they process, and how keys are spread.',
    compare: 'mode',
    params: [
      { id: 'consumers', label: 'Consumers in the group', type: 'select', value: 3, options: [[3, '3'], [6, '6'], [12, '12'], [16, '16']] },
      { id: 'mode', label: 'How each consumer processes', type: 'select', value: 'serial', options: [
        ['serial', 'One record at a time, one DB call each'],
        ['batch', 'Whole poll in one batched DB write'],
        ['keyed', '16 keyed worker threads, one call per record'],
      ] },
      { id: 'skew', label: 'Keys', type: 'select', value: 'uniform', options: [['uniform', 'Spread evenly'], ['hot', 'One key is 30% of traffic']] },
    ],
    run(p) {
      const n = +p.consumers, d = demand(p.skew), owner = assign(n);
      const served = new Array(P).fill(0);
      for (let m = 0; m < Math.min(n, P); m++) {
        const parts = owner.map((o, i) => (o === m ? i : -1)).filter((i) => i >= 0);
        const D = parts.reduce((a, i) => a + d[i], 0);
        if (p.mode === 'keyed' && p.skew === 'hot' && parts.includes(HOT_PART)) {
          // the hot key is stuck at one call at a time; the other keys share what is left
          const hot = RATE * HOT_SHARE, rest = D - hot, cap = WORKERS * PER_KEY - PER_KEY;
          const k = Math.min(1, cap / rest);
          for (const i of parts) served[i] = (d[i] - (i === HOT_PART ? hot : 0)) * k + (i === HOT_PART ? PER_KEY : 0);
          continue;
        }
        const C = p.mode === 'serial' ? 1000 / CALL : p.mode === 'batch' ? BATCH / ((CALL + PER_REC * BATCH) / 1000) : WORKERS * PER_KEY;
        const k = Math.min(1, C / D);
        for (const i of parts) served[i] = d[i] * k;
      }
      const grow = d.map((x, i) => Math.max(0, x - served[i]));
      const lagAt = (t, i) => grow[i] * t;
      const x = Array.from({ length: END / 5 + 1 }, (_, k) => k * 5);
      const worst = grow.indexOf(Math.max(...grow));
      const finalLag = Math.round(grow.reduce((a, g) => a + g, 0) * END);
      const keepsUp = finalLag < 1;
      const behind = grow[worst] ? (lagAt(END, worst) / d[worst]) : 0;
      const idle = Math.max(0, n - P);
      return {
        out: { finalLag, keepsUp, worstPartition: keepsUp ? -1 : worst, hotShare: d[worst] / RATE, idle },
        stats: [
          { label: 'Lag after 2 minutes', value: finalLag.toLocaleString('en'), unit: 'records', tone: keepsUp ? 'good' : 'bad' },
          { label: 'Worst partition', value: keepsUp ? 'none behind' : `p${worst}`, tone: keepsUp ? 'good' : 'bad', note: keepsUp ? '' : `${Math.round((d[worst] / RATE) * 100)}% of all traffic lands here` },
          { label: 'How far behind it is', value: keepsUp ? 0 : Math.round(behind), unit: 's', tone: keepsUp ? 'good' : 'bad', note: keepsUp ? '' : 'and growing: lag in records hides this' },
          { label: 'Idle consumers', value: idle, tone: idle ? 'warn' : 'good', note: idle ? 'more consumers than partitions' : '' },
        ],
        chart: {
          x, xLabel: 'seconds', yLabel: 'records behind',
          lines: [
            { name: 'Total lag', values: x.map((t) => Math.round(grow.reduce((a, g) => a + g, 0) * t)), tone: 'bad' },
            { name: `Worst partition (p${worst})`, values: x.map((t) => Math.round(lagAt(t, worst))), tone: 'warn', dash: true },
          ],
        },
        notes: [
          { serial: 'One DB call per record caps each consumer at 200 records a second, whatever the hardware. Throughput comes from fewer round trips, not more threads.',
            batch: 'One write for the whole poll: the 5 ms round trip is paid once per 500 records instead of once per record.',
            keyed: 'Keyed workers parallelise inside a partition and keep per-key order, so records of different keys run side by side; commit only offsets whose records, and every record before them, are done.' }[p.mode],
          p.skew === 'hot' ? (p.mode === 'batch' ? 'The hot partition still gets 30% of traffic, but batched writes handle it.' : 'One key\'s records all land on one partition and, to keep order, run one at a time. More consumers or more partitions cannot split a single key.')
            : n > P ? 'Consumers beyond the partition count sit idle: within a group, each partition has one reader.' : 'Lag in records is easy to read but hides urgency: divide by the arrival rate to get "how far behind in time".',
        ],
      };
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { assign, demand, spec: BS.all.lag };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ALTER TABLE at peak traffic. The app sends 400 short queries a second through a pool of 100
 * connections; a request that waits more than 1 s for a connection fails. Each query needs a lock on the
 * table that only conflicts with ACCESS EXCLUSIVE. At 10 s a migration asks for ACCESS EXCLUSIVE.
 * As in PostgreSQL, a lock request queues behind earlier conflicting requests, so once the ALTER is
 * waiting, every later query waits behind it. */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const DT = 10, END = 70000, PER_TICK = 4, POOL = 100, POOL_WAIT = 1000, ALTER_AT = 10000;
  const LONG_FROM = 2000, LONG_TO = 42000, RETRY_AFTER = 5000;
  const HOLD = { instant: 10, rewrite: 60000 };
  const TIMEOUT = { none: Infinity, '2s': 2000, '200ms': 200 };

  BS.define('lockqueue', {
    title: 'ALTER TABLE at peak traffic',
    blurb: '400 queries a second through a pool of 100 connections. At 10 s a migration runs ALTER TABLE. Optionally, a 40 s report query is already running on the table.',
    compare: 'lockTimeout',
    params: [
      { id: 'alter', label: 'The ALTER', type: 'select', value: 'instant', options: [
        ['instant', 'Metadata only (ADD COLUMN, no rewrite)'],
        ['rewrite', 'Rewrites the table (ALTER COLUMN TYPE)'],
      ] },
      { id: 'long', label: 'A long report query is running (2 s to 42 s)', type: 'toggle', value: true },
      { id: 'lockTimeout', label: 'lock_timeout for the migration', type: 'select', value: 'none', options: [
        ['none', 'None (the default): wait forever'],
        ['2s', '2 s, retry every 5 s'],
        ['200ms', '200 ms, retry every 5 s'],
      ] },
    ],
    run(p) {
      const queue = [];                 // lock waiters in order: { app: true, since } | { alter: true, since }
      const running = [];               // finish times of granted queries
      const poolWait = [];              // arrival times of requests waiting for a connection
      const alter = { state: 'pending', since: 0, until: 0, attempts: 0 };
      const sec = Array.from({ length: END / 1000 }, () => ({ ok: 0, failed: 0, blocked: 0 }));
      let errors = 0, stall = 0, doneAt = null;
      const marks = [{ x: ALTER_AT / 1000, label: 'ALTER issued' }];

      for (let t = 0; t < END; t += DT) {
        const s = sec[Math.floor(t / 1000)];
        const long = p.long && t >= LONG_FROM && t < LONG_TO;
        while (running.length && running[0] <= t) { running.shift(); s.ok++; }
        if (alter.state === 'running' && t >= alter.until) { alter.state = 'done'; doneAt = t / 1000; marks.push({ x: doneAt, label: 'ALTER done' }); }
        if ((alter.state === 'pending' && t >= ALTER_AT) || (alter.state === 'backoff' && t >= alter.until)) {
          alter.state = 'waiting'; alter.since = t; alter.attempts++;
          queue.push({ alter: true, since: t });
        }
        if (alter.state === 'waiting' && t - alter.since >= TIMEOUT[p.lockTimeout]) {
          alter.state = 'backoff'; alter.until = t + RETRY_AFTER;
          queue.splice(queue.findIndex((q) => q.alter), 1);
        }

        // requests arrive and wait for a connection; a request holds its connection while it waits for the lock
        for (let k = 0; k < PER_TICK; k++) poolWait.push(t);
        let inUse = running.length + queue.filter((q) => q.app).length;
        while (poolWait.length && inUse < POOL) { queue.push({ app: true, since: poolWait.shift() }); inUse++; }
        while (poolWait.length && t - poolWait[0] >= POOL_WAIT) { poolWait.shift(); errors++; s.failed++; }

        // grant in queue order: nobody may jump ahead of an earlier request it conflicts with
        let exclusiveAhead = alter.state === 'running';
        for (let i = 0; i < queue.length; i++) {
          const q = queue[i];
          if (q.app) {
            if (exclusiveAhead) continue;
            queue.splice(i--, 1);
            running.push(t + DT);
            stall = Math.max(stall, (t - q.since) / 1000);
          } else {
            const free = !exclusiveAhead && !running.some((f) => f > t) && !long && queue.slice(0, i).every((x) => !x.app);
            if (free) { queue.splice(i--, 1); alter.state = 'running'; alter.until = t + HOLD[p.alter]; exclusiveAhead = true; }
            else exclusiveAhead = true;
          }
        }
        s.blocked = Math.max(s.blocked, queue.filter((q) => q.app).length + poolWait.length);
      }
      // queries still waiting at the end have stalled for as long as they have waited
      for (const q of queue) if (q.app) stall = Math.max(stall, (END - q.since) / 1000);

      return {
        out: { errors, stall, doneAt, attempts: alter.attempts },
        stats: [
          { label: 'Requests that failed', value: errors.toLocaleString('en'), tone: errors > 1000 ? 'bad' : errors ? 'warn' : 'good' },
          { label: 'Longest wait for the table lock', value: `${stall.toFixed(stall < 1 ? 2 : 0)} s`, tone: stall > 1 ? 'bad' : stall > 0.1 ? 'warn' : 'good' },
          { label: 'Migration attempts', value: alter.attempts, tone: 'warn' },
          { label: 'ALTER finished at', value: doneAt === null ? (p.alter === 'rewrite' ? 'still rewriting' : 'never') : `${doneAt.toFixed(1)} s`, tone: doneAt === null ? 'bad' : 'good' },
        ],
        chart: {
          x: sec.map((_, j) => j), xLabel: 'seconds', yLabel: 'requests per second',
          lines: [
            { name: 'Queries completed', values: sec.map((x) => x.ok) },
            { name: 'Requests failed (no connection)', values: sec.map((x) => x.failed) },
          ],
          bands: p.long ? [{ from: LONG_FROM / 1000, to: LONG_TO / 1000, label: 'report query' }] : [],
          marks,
        },
        notes: [
          p.alter === 'rewrite'
            ? 'Changing a column\'s type rewrites every row while holding ACCESS EXCLUSIVE. On 200 million rows that is many minutes of no reads and no writes; no timeout fixes it. Use expand and contract instead.'
            : p.lockTimeout === 'none' && p.long
              ? 'The ALTER itself needs only milliseconds, but it cannot start until the report query finishes. Waiting in the lock queue, it blocks every query that arrives after it: 32 seconds of outage for an instant change.'
              : p.long ? `Each attempt gives up after ${p.lockTimeout === '2s' ? '2 s' : '200 ms'} and gets out of the queue, letting traffic through; the ALTER lands on the first attempt after the report query ends.` : 'Nothing held the table, so the ALTER took its lock and finished in milliseconds.',
        ],
      };
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = BS.all.lockqueue;
})(typeof globalThis !== 'undefined' ? globalThis : this);

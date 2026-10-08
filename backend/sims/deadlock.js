/* Money transfers between accounts. Each transfer locks the source row, works for a moment, then locks
 * the destination row, so two transfers between the same pair in opposite directions can each hold the
 * lock the other needs. Like PostgreSQL, a waiter checks for a cycle once it has waited deadlock_timeout
 * (1 s); if it finds one, it aborts itself (SQLSTATE 40P01) and the application retries. */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const END = 30000, DEADLOCK_TIMEOUT = 1000, FINISH = 5, THINK = 5, RETRY = 10;

  BS.define('deadlock', {
    title: 'Transfers that deadlock',
    blurb: 'Workers move money between accounts for 30 s. Each transfer locks one row, does some work, then locks the other.',
    compare: 'order',
    params: [
      { id: 'order', label: 'Lock order', type: 'select', value: 'request', options: [
        ['request', 'As the request names them (from, then to)'],
        ['sorted', 'Always the lower account id first'],
      ] },
      { id: 'workers', label: 'Concurrent transfers', type: 'range', min: 1, max: 16, step: 1, value: 8 },
      { id: 'accounts', label: 'Accounts', type: 'range', min: 2, max: 50, step: 1, value: 10 },
      { id: 'hold', label: 'Work between the two locks', type: 'range', min: 1, max: 100, step: 1, value: 20, unit: 'ms' },
      { id: 'hot', label: 'Half the transfers touch account 1', type: 'toggle', value: false },
    ],
    run(p) {
      const r = BS.rng(17);
      const locks = Array.from({ length: p.accounts }, () => ({ holder: -1, queue: [] }));
      const W = Array.from({ length: p.workers }, () => ({ phase: 'idle', until: 0, pair: null, order: null, since: 0, checked: false }));
      let deadlocks = 0, committed = 0, story = null;
      const waits = [], perSec = new Array(END / 1000).fill(0);

      const pick = () => {
        const a = p.hot && r() < 0.5 ? 0 : Math.floor(r() * p.accounts);
        let b = Math.floor(r() * p.accounts);
        while (b === a) b = Math.floor(r() * p.accounts);
        return r() < 0.5 ? [a, b] : [b, a];
      };
      function grant(lock, w, t) {
        lock.holder = w;
        const x = W[w];
        waits.push(t - x.since);
        if (x.phase === 'wait1') { x.phase = 'hold1'; x.until = t + p.hold; }
        else { x.phase = 'hold2'; x.until = t + FINISH; }
      }
      function release(acct, t) {
        const lock = locks[acct];
        lock.holder = -1;
        if (lock.queue.length) grant(lock, lock.queue.shift(), t);
      }
      function acquire(w, acct, t, next) {
        const lock = locks[acct], x = W[w];
        if (lock.holder < 0) { lock.holder = w; waits.push(0); if (next === 'hold1') { x.phase = 'hold1'; x.until = t + p.hold; } else { x.phase = 'hold2'; x.until = t + FINISH; } }
        else { lock.queue.push(w); x.phase = next === 'hold1' ? 'wait1' : 'wait2'; x.since = t; x.checked = false; }
      }
      // follow "waits for the holder of" edges from w; a cycle back to w is a deadlock
      function cycle(w) {
        const path = [w];
        let cur = w;
        for (let k = 0; k <= p.workers; k++) {
          const x = W[cur];
          if (x.phase !== 'wait1' && x.phase !== 'wait2') return null;
          const acct = x.phase === 'wait1' ? x.order[0] : x.order[1];
          const h = locks[acct].holder;
          if (h < 0) return null;
          if (h === w) return path;
          path.push(h); cur = h;
        }
        return null;
      }

      for (let t = 0; t < END; t++) {
        for (let w = 0; w < p.workers; w++) {
          const x = W[w];
          if (x.phase === 'idle' && t >= x.until) {
            if (!x.pair) x.pair = pick();
            x.order = p.order === 'sorted' ? [...x.pair].sort((a, b) => a - b) : x.pair;
            acquire(w, x.order[0], t, 'hold1');
          } else if (x.phase === 'hold1' && t >= x.until) {
            acquire(w, x.order[1], t, 'hold2');
          } else if (x.phase === 'hold2' && t >= x.until) {
            release(x.order[1], t); release(x.order[0], t);
            committed++; perSec[Math.floor(t / 1000)]++;
            x.phase = 'idle'; x.until = t + THINK; x.pair = null;
          } else if (x.phase === 'wait2' && !x.checked && t - x.since >= DEADLOCK_TIMEOUT) {
            x.checked = true;
            const c = cycle(w);
            if (!c) continue;
            deadlocks++;
            if (!story) {
              const steps = c.map((v) => ({ ms: null, tag: 'cycle', what: `worker ${v + 1} holds account ${W[v].order[0] + 1} and waits for account ${W[v].order[1] + 1}` }));
              steps.unshift({ ms: x.since, what: `worker ${w + 1} starts waiting for account ${x.order[1] + 1}` });
              steps.push({ ms: t, what: `worker ${w + 1} has waited deadlock_timeout (1 s), finds the cycle and aborts itself: ERROR 40P01 deadlock detected` });
              steps.push({ ms: t, what: `its lock on account ${x.order[0] + 1} is released, the other worker proceeds, and the application retries the aborted transfer` });
              story = { title: 'The first deadlock, step by step', steps };
            }
            locks[x.order[1]].queue = locks[x.order[1]].queue.filter((v) => v !== w);
            release(x.order[0], t);
            x.phase = 'idle'; x.until = t + RETRY;
          }
        }
      }
      const p99 = waits.length ? BS.percentile(waits, 99) : 0;
      const tps = committed / (END / 1000);
      return {
        out: { deadlocks, committed, p99 },
        stats: [
          { label: 'Deadlocks', value: deadlocks, tone: deadlocks ? 'bad' : 'good' },
          { label: 'Transfers committed per second', value: Math.round(tps), tone: 'good' },
          { label: 'p99 wait for a row lock', value: `${Math.round(p99).toLocaleString('en')} ms`, tone: p99 >= DEADLOCK_TIMEOUT ? 'bad' : p99 > 100 ? 'warn' : 'good' },
          { label: 'Time lost to deadlocks', value: `${(deadlocks * DEADLOCK_TIMEOUT / 1000).toLocaleString('en')} s`, note: 'at least deadlock_timeout per victim', tone: deadlocks ? 'bad' : 'good' },
        ],
        chart: {
          x: perSec.map((_, s) => s), xLabel: 'seconds', yLabel: 'transfers committed per second',
          lines: [{ name: 'Committed per second', values: perSec }],
        },
        story,
        notes: [p.order === 'sorted'
          ? 'Every transfer takes its locks in the same global order, so no transfer can hold a lock that an earlier-ordered one is waiting for: no cycle can form. Waiting still happens; deadlock does not.'
          : 'Two transfers between the same accounts in opposite directions each lock their first row and then wait for the other\'s. Nothing breaks the cycle until one of them has waited deadlock_timeout and aborts.'],
      };
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = BS.all.deadlock;
})(typeof globalThis !== 'undefined' ? globalThis : this);

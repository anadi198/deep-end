/* A Kafka consumer group: 12 partitions, 3 consumers, 100 messages/s into each partition.
 * Something changes the membership; the protocol decides which partitions stop, for how long,
 * and which move. Timings: a classic rebalance round takes 3 s here (join, then sync);
 * the new consumer protocol reconciles a moved partition in about 1 s. */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const P = 12, RATE = 100, DRAIN = 300, DT = 0.5, END = 90, ROUND = 3, RECONCILE = 1;
  const SESSION_TIMEOUT = 45, POLL_INTERVAL = 20, BATCH = 500, AUTO_COMMIT = 5;
  const NAMES = ['c1', 'c2', 'c3', 'c4'];
  const UNOWNED = -1, STUCK = -2;

  // Range assignor, one topic: contiguous blocks, the first members get the remainder. Returns member indexes.
  function range(n, members) {
    const out = [], k = members.length, base = Math.floor(n / k), extra = n % k;
    for (let m = 0; m < k; m++) for (let j = 0; j < base + (m < extra ? 1 : 0); j++) out.push(m);
    return out;
  }
  // Sticky: keep every partition where it is unless balance requires moving it. Owners are member ids.
  function sticky(before, members) {
    const live = new Set(members);
    const mine = new Map(members.map((m) => [m, before.map((o, p) => (o === m ? p : -1)).filter((p) => p >= 0)]));
    const base = Math.floor(before.length / members.length);
    let extra = before.length % members.length;
    const quota = new Map();
    for (const m of [...members].sort((a, b) => mine.get(b).length - mine.get(a).length || a - b)) quota.set(m, base + (extra-- > 0 ? 1 : 0));
    const after = before.map((o) => (live.has(o) ? o : UNOWNED));
    const free = after.map((o, p) => (o === UNOWNED ? p : -1)).filter((p) => p >= 0);
    for (const m of members) {
      const ps = mine.get(m);
      while (ps.length > quota.get(m)) { const p = ps.pop(); after[p] = UNOWNED; free.push(p); }
    }
    free.sort((a, b) => a - b);
    for (const m of members) {
      let have = after.filter((o) => o === m).length;
      while (have < quota.get(m) && free.length) { after[free.shift()] = m; have++; }
    }
    return after;
  }

  BS.define('rebalance', {
    title: 'A consumer group rebalances',
    blurb: '12 partitions, 3 consumers, 100 messages a second into each partition. Pick what happens and which rebalance protocol the group uses.',
    compare: 'protocol',
    params: [
      { id: 'event', label: 'What happens', type: 'select', value: 'scaleout', options: [
        ['scaleout', 'A fourth consumer joins at 10 s'],
        ['restart', 'Rolling restart: each consumer is down 8 s'],
        ['crash', 'c2 is killed at 12.5 s (no goodbye)'],
        ['stall', 'c2 gets stuck on a slow batch at 12.5 s'],
      ] },
      { id: 'protocol', label: 'Rebalance protocol', type: 'select', value: 'eager', options: [
        ['eager', 'Classic, eager (range assignor)'],
        ['cooperative', 'Classic, cooperative sticky'],
        ['consumer', 'New consumer protocol (KIP-848)'],
      ] },
      { id: 'static', label: 'Static membership (group.instance.id)', type: 'toggle', value: false, when: { event: 'restart' } },
    ],
    run(p) {
      const ticks = Math.round(END / DT);
      const own = Array.from({ length: P }, () => new Array(ticks).fill(0));
      const tick = (t) => Math.min(ticks, Math.max(0, Math.round(t / DT)));
      const fill = (part, from, to, v) => { for (let i = tick(from); i < tick(to); i++) own[part][i] = v; };
      let A = range(P, [0, 1, 2]);
      A.forEach((m, part) => fill(part, 0, END, m));
      let members = [0, 1, 2];
      let rebalances = 0, moved = 0, duplicates = 0;
      const marks = [];

      // the group reacts to a membership change at time t
      function rebalance(t, next, label) {
        rebalances++;
        marks.push({ x: t, label });
        members = [...next].sort((a, b) => a - b);
        if (p.protocol === 'eager') {
          const B = range(P, members).map((k) => members[k]);
          B.forEach((m, part) => { if (m !== A[part]) moved++; fill(part, t, t + ROUND, UNOWNED); fill(part, t + ROUND, END, m); });
          A = B;
          return;
        }
        const B = sticky(A, members);
        const pause = p.protocol === 'cooperative' ? ROUND : RECONCILE;
        B.forEach((m, part) => {
          if (m === A[part]) return;
          moved++;
          const orphan = !members.includes(A[part]);
          // classic cooperative: an orphan is assigned after one round; a partition taken from a live owner is revoked after round 1 and assigned after round 2
          const start = orphan || p.protocol === 'consumer' ? t : t + ROUND;
          fill(part, start, start + pause, UNOWNED);
          fill(part, start + pause, END, m);
        });
        A = B;
      }
      const partsOf = (m) => A.map((o, part) => (o === m ? part : -1)).filter((x) => x >= 0);

      if (p.event === 'scaleout') rebalance(10, [0, 1, 2, 3], 'c4 joins');
      if (p.event === 'restart') {
        [[0, 10], [1, 25], [2, 40]].forEach(([m, t]) => {
          if (p.static) { for (const part of partsOf(m)) fill(part, t, t + 8, UNOWNED); marks.push({ x: t, label: `${NAMES[m]} restarts` }); return; }
          rebalance(t, members.filter((x) => x !== m), `${NAMES[m]} leaves`);
          rebalance(t + 8, [...members, m], `${NAMES[m]} rejoins`);
        });
      }
      if (p.event === 'crash') {
        const t = 12.5, dead = partsOf(1);
        for (const part of dead) fill(part, t, END, STUCK);
        duplicates += Math.round((t - 10) * RATE * dead.length);   // processed since the last auto-commit at 10 s
        marks.push({ x: t, label: 'c2 dies' });
        rebalance(t + SESSION_TIMEOUT, [0, 2], 'session timeout');
      }
      if (p.event === 'stall') {
        const t = 12.5, stuck = partsOf(1);
        for (const part of stuck) fill(part, t, END, STUCK);
        marks.push({ x: t, label: 'c2 stuck' });
        rebalance(t + POLL_INTERVAL, [0, 2], 'poll interval passed');
        duplicates += BATCH;                                       // the batch c2 was working on; its commit is rejected
        rebalance(40, [0, 1, 2], 'c2 rejoins');
      }

      // lag: producers never stop; a reading consumer drains at 3× the arrival rate
      const lag = new Array(P).fill(0), total = [];
      let paused = 0, maxLag = 0;
      for (let i = 0; i < ticks; i++) {
        let sum = 0;
        for (let part = 0; part < P; part++) {
          lag[part] += RATE * DT;
          if (own[part][i] >= 0) lag[part] -= Math.min(lag[part], DRAIN * DT);
          else paused += DT;
          sum += lag[part];
        }
        maxLag = Math.max(maxLag, sum);
        if (i % 2 === 1) total.push(Math.round(sum));
      }

      return {
        out: { rebalances, moved, pausedPartitionSeconds: paused, duplicates, maxLag },
        stats: [
          { label: 'Rebalances', value: rebalances, tone: rebalances > 2 ? 'bad' : rebalances ? 'warn' : 'good' },
          { label: 'Partitions that changed owner', value: moved, tone: moved > 6 ? 'bad' : moved ? 'warn' : 'good' },
          { label: 'Partition-seconds with nobody reading', value: Math.round(paused), tone: paused > 30 ? 'bad' : paused ? 'warn' : 'good' },
          { label: 'Messages processed twice', value: duplicates.toLocaleString('en'), tone: duplicates ? 'bad' : 'good' },
          { label: 'Peak lag', value: Math.round(maxLag).toLocaleString('en'), unit: 'messages', tone: maxLag > 5000 ? 'bad' : maxLag > 500 ? 'warn' : 'good' },
        ],
        chart: {
          x: total.map((_, s) => s), xLabel: 'seconds', yLabel: 'messages waiting',
          lines: [{ name: 'Total lag', values: total, tone: 'bad' }],
          marks,
        },
        view: { kind: 'ownership', grid: own, names: NAMES, dt: DT },
        notes: [
          { scaleout: { eager: 'Eager: every consumer gave up every partition, waited for the group to agree, then got a fresh range assignment. Six partitions changed hands to balance one newcomer.',
                        cooperative: 'Cooperative: everyone kept reading through the first round; only the three partitions c4 needed were revoked, then assigned in a second round.',
                        consumer: 'New protocol: the broker computed the target and each consumer gave up or picked up only its own changes, with no group-wide barrier.' }[p.protocol],
            restart: p.static ? 'Static members restart without leaving the group, so nothing is reshuffled. Their partitions wait, unread, for the 8 s each restart takes (under the 45 s session timeout).' : 'Each consumer leaving and rejoining is a membership change: six rebalances for one routine deploy.',
            crash: 'A killed process sends no goodbye. The group only notices after session.timeout.ms (45 s by default); until then c2\'s partitions are assigned but unread. Then everything since its last commit is read again.',
            stall: `This run sets max.poll.interval.ms to ${POLL_INTERVAL} s to fit the chart (the default is 5 minutes). c2 was still alive, just slow; it got kicked out, its commit was rejected, and its batch of ${BATCH} was processed again by the new owner.` }[p.event],
        ],
      };
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { range, sticky, spec: BS.all.rebalance };
})(typeof globalThis !== 'undefined' ? globalThis : this);

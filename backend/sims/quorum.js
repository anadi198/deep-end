/* Tunable consistency, Cassandra style. A key is stored on RF replicas. A write succeeds once W replicas
 * acknowledge it; a read asks R replicas and returns the newest value among them. The model looks at the
 * moment right after a write is acknowledged: exactly W replicas have it, and the read picks R of the
 * live replicas at random. Exact probabilities, no sampling. */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const LEVELS = [['one', 'ONE'], ['two', 'TWO'], ['quorum', 'QUORUM'], ['all', 'ALL']];
  const level = (name, rf) => ({ one: 1, two: 2, quorum: Math.floor(rf / 2) + 1, all: rf }[name]);
  function choose(n, k) {
    if (k < 0 || k > n) return 0;
    let c = 1;
    for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
    return c;
  }
  // the chance that R random live replicas include none of the W that have the write
  const staleChance = (live, W, R) => (live < W || live < R ? null : choose(live - W, R) / choose(live, R));
  const pct = (x) => (x === null ? 'n/a' : x === 0 ? '0%' : `${(100 * x).toFixed(x < 0.1 ? 1 : 0)}%`);

  function view(r) {
    const v = r.view, n = v.rf, gap = 64, W = n * gap + 40, H = 118;
    let s = `<svg class="sim-quorum" viewBox="0 0 ${W} ${H}" role="img" aria-label="Replicas: which are down, which have the write, which the read asked">`;
    for (let i = 0; i < n; i++) {
      const x = 20 + gap / 2 + i * gap, y = 44;
      const down = i >= n - v.down, has = v.has.includes(i), read = v.read.includes(i);
      s += `<g class="rep${down ? ' down' : ''}${has ? ' has' : ''}${read ? ' read' : ''}">`;
      if (read) s += `<circle class="ring" cx="${x}" cy="${y}" r="25"/>`;
      s += `<circle class="node" cx="${x}" cy="${y}" r="19"/>`;
      s += down ? `<text class="x" x="${x}" y="${y + 5}">✕</text>` : `<text class="v" x="${x}" y="${y + 4}">${has ? 'v2' : 'v1'}</text>`;
      s += `<text class="lbl" x="${x}" y="${y + 42}">replica ${i + 1}</text></g>`;
    }
    s += '</svg>';
    return `<div class="sim-quorumwrap"><div class="sim-legend"><span><i class="q-has"></i>has the new write (v2)</span><span><i class="q-read"></i>asked by the read</span><span><i class="q-down"></i>down</span></div>${s}<p class="small">${v.caption}</p></div>`;
  }

  BS.define('quorum', {
    title: 'Quorum reads and writes',
    blurb: 'One key on RF replicas. Choose the consistency level for writes and reads, and take replicas down.',
    params: [
      { id: 'rf', label: 'Replication factor (RF)', type: 'select', value: '3', options: [['3', '3 replicas'], ['5', '5 replicas']] },
      { id: 'write', label: 'Write consistency (W)', type: 'select', value: 'quorum', options: LEVELS },
      { id: 'read', label: 'Read consistency (R)', type: 'select', value: 'quorum', options: LEVELS },
      { id: 'down', label: 'Replicas down', type: 'range', min: 0, max: 4, step: 1, value: 0 },
    ],
    view,
    run(p) {
      const rf = +p.rf, down = Math.min(+p.down, rf - 1), live = rf - down;
      const W = level(p.write, rf), R = level(p.read, rf);
      const writeOk = live >= W, readOk = live >= R, overlap = R + W > rf;
      const stale = writeOk && readOk ? staleChance(live, W, R) : null;
      const canLose = rf - Math.max(W, R);
      // worst case: the write reached the first W live replicas; the read asked the last R
      const has = writeOk ? Array.from({ length: W }, (_, i) => i) : [];
      const read = readOk ? Array.from({ length: R }, (_, i) => live - 1 - i) : [];
      const sawNew = read.some((i) => has.includes(i));
      const caption = !writeOk ? `The write fails: it needs ${W} acknowledgements and only ${live} replicas are up.`
        : !readOk ? `The read fails: it needs ${R} answers and only ${live} replicas are up.`
        : sawNew ? `Even in the worst case the read set includes a replica with v2, because R + W = ${R + W} > RF = ${rf}.`
        : `Worst case: the read asked only replicas the write has not reached yet, so it returns v1. R + W = ${R + W} is not more than RF = ${rf}.`;

      const rows = [];
      for (let d = 0; d < rf; d++) {
        const l = rf - d;
        rows.push([String(d), l >= W ? 'succeed' : 'fail', l >= R ? 'succeed' : 'fail', l >= W && l >= R ? pct(staleChance(l, W, R)) : 'n/a']);
      }
      return {
        out: { writeOk, readOk, overlap, stale, W, R, canLose },
        stats: [
          { label: 'Writes', value: writeOk ? 'succeed' : 'fail', tone: writeOk ? 'good' : 'bad', note: `need ${W} of ${live} live` },
          { label: 'Reads', value: readOk ? 'succeed' : 'fail', tone: readOk ? 'good' : 'bad', note: `need ${R} of ${live} live` },
          { label: 'R + W vs RF', value: `${R} + ${W} ${overlap ? '>' : '≤'} ${rf}`, tone: overlap ? 'good' : 'warn', note: overlap ? 'every read set meets every write set' : 'read and write sets can miss each other' },
          { label: 'Chance a read misses the latest write', value: pct(stale), tone: stale === null ? 'bad' : stale ? 'warn' : 'good' },
          { label: 'Replicas you can lose and keep both', value: Math.max(0, canLose), tone: canLose > 0 ? 'good' : 'bad' },
        ],
        view: { rf, down, has, read, caption },
        table: { cols: ['Replicas down', 'Writes', 'Reads', 'Chance a read misses the latest write'], rows },
        notes: [
          'QUORUM is a majority: floor(RF / 2) + 1. Two majorities of the same replicas always share at least one member, which is why QUORUM writes plus QUORUM reads see the latest acknowledged write.',
          'Overlap is not linearisability: two concurrent writes are ordered by timestamp (last write wins), so clock skew can still pick the wrong one. Compare-and-set needs lightweight transactions (Paxos).',
        ],
      };
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { level, staleChance, spec: BS.all.quorum };
})(typeof globalThis !== 'undefined' ? globalThis : this);

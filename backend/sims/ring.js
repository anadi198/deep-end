/* Placing 10,000 keys on N nodes, then adding or removing one node. Hash mod N reassigns almost every
 * key; a consistent-hash ring moves only the keys between the changed node's tokens and their
 * neighbours. Virtual nodes (several tokens per node) even out how many keys each node gets. */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const KEYS = 10000;

  // FNV-1a, then the MurmurHash3 finaliser so nearby strings spread over the whole 32-bit range
  function hash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  }
  function ringOf(nodes, vnodes) {
    const t = [];
    for (const n of nodes) for (let v = 0; v < vnodes; v++) t.push({ h: hash(`node-${n}#${v}`), n });
    return t.sort((a, b) => a.h - b.h);
  }
  function owner(ring, h) {
    let lo = 0, hi = ring.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (ring[mid].h < h) lo = mid + 1; else hi = mid; }
    return ring[lo === ring.length ? 0 : lo].n;
  }

  function view(r) {
    const v = r.view, R = 92, cx = 120, cy = 112, TAU = Math.PI * 2;
    let s = `<svg class="sim-ring" viewBox="0 0 240 224" role="img" aria-label="The hash ring and each node's tokens"><circle class="track" cx="${cx}" cy="${cy}" r="${R}"/>`;
    if (v.scheme === 'ring') {
      for (const t of v.tokens) {
        const a = (t.h / 4294967296) * TAU - Math.PI / 2, hot = t.n === v.changed;
        const x1 = cx + Math.cos(a) * (R - (hot ? 12 : 7)), y1 = cy + Math.sin(a) * (R - (hot ? 12 : 7));
        const x2 = cx + Math.cos(a) * (R + (hot ? 12 : 7)), y2 = cy + Math.sin(a) * (R + (hot ? 12 : 7));
        s += `<line class="tok${hot ? ' hot' : ''}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
      }
      s += `<text class="mid" x="${cx}" y="${cy - 4}">${v.tokens.length.toLocaleString('en')} tokens</text><text class="mid sub" x="${cx}" y="${cy + 12}">node ${v.changed + 1} ${v.action === 'add' ? 'added' : 'removed'}</text>`;
    } else {
      s += `<text class="mid" x="${cx}" y="${cy - 4}">hash mod ${v.before}</text><text class="mid sub" x="${cx}" y="${cy + 12}">becomes hash mod ${v.after}</text>`;
    }
    return `<div class="sim-ringwrap">${s}</svg><p class="small">${v.scheme === 'ring' ? `Each tick is a token. The highlighted ones belong to the node that was ${v.action === 'add' ? 'added' : 'removed'}; only keys hashing just before them change owner.` : 'With mod N there is no ring: changing N changes the remainder for almost every key.'}</p></div>`;
  }

  BS.define('ring', {
    title: 'Consistent hashing',
    blurb: '10,000 keys spread over N nodes. Add or remove one node and count how many keys have to move.',
    compare: 'scheme',
    params: [
      { id: 'scheme', label: 'Placement', type: 'select', value: 'ring', options: [['ring', 'Consistent-hash ring'], ['modn', 'hash(key) mod N']] },
      { id: 'nodes', label: 'Nodes', type: 'range', min: 3, max: 20, step: 1, value: 5 },
      { id: 'vnodes', label: 'Virtual nodes per node', type: 'range', min: 1, max: 256, step: 1, value: 100, when: { scheme: 'ring' } },
      { id: 'action', label: 'Change', type: 'select', value: 'add', options: [['add', 'Add a node'], ['remove', 'Remove a node']] },
    ],
    view,
    run(p) {
      const n = p.nodes, before = Array.from({ length: n }, (_, i) => i);
      const after = p.action === 'add' ? [...before, n] : before.slice(0, -1);
      const changed = p.action === 'add' ? n : n - 1;
      const v = p.scheme === 'ring' ? p.vnodes : 1;
      const r1 = ringOf(before, v), r2 = ringOf(after, v);
      const place = (ring, nodes, h) => (p.scheme === 'ring' ? owner(ring, h) : nodes[h % nodes.length]);
      const loadBefore = new Array(n + 1).fill(0), loadAfter = new Array(n + 1).fill(0);
      let moved = 0;
      for (let k = 0; k < KEYS; k++) {
        const h = hash(`user:${k}`);
        const a = place(r1, before, h), b = place(r2, after, h);
        loadBefore[a]++; loadAfter[b]++;
        if (a !== b) moved++;
      }
      const frac = moved / KEYS;
      const ideal = p.action === 'add' ? 1 / (n + 1) : 1 / n;
      const mean = KEYS / n;
      const imbalance = Math.max(...loadBefore.slice(0, n)) / mean;
      const pct = (x) => `${(100 * x).toFixed(1)}%`;
      return {
        out: { moved: frac, ideal, imbalance },
        stats: [
          { label: 'Keys that moved', value: pct(frac), tone: frac > 2 * ideal ? 'bad' : frac > 1.3 * ideal ? 'warn' : 'good' },
          { label: 'One node\'s fair share', value: pct(ideal), note: 'what an ideal add or remove moves' },
          { label: 'Busiest node vs average (before)', value: `${imbalance.toFixed(2)}×`, tone: imbalance > 1.5 ? 'bad' : imbalance > 1.15 ? 'warn' : 'good' },
        ],
        bars: {
          title: 'Keys per node after the change',
          items: after.map((id) => ({ label: `node ${id + 1}${id === changed && p.action === 'add' ? ' (new)' : ''}`, value: loadAfter[id], tone: loadAfter[id] > 1.5 * (KEYS / after.length) ? 'bad' : undefined })),
        },
        view: { scheme: p.scheme, tokens: p.scheme === 'ring' ? (p.action === 'add' ? r2 : r1) : [], changed, action: p.action, before: n, after: after.length },
        notes: [
          p.scheme === 'modn'
            ? `With mod N, ${pct(frac)} of keys changed node. For a cache that is a near-total miss storm; for a sharded store, a near-total migration.`
            : `Only ${pct(frac)} of keys moved: just the keys in the ${p.action === 'add' ? 'new' : 'removed'} node's arcs (a fair share is ${pct(ideal)}).${v < 16 ? ' With few tokens per node, though, some nodes own much bigger arcs of the ring than others: raise the virtual nodes and watch the busiest node shrink toward the average.' : ''}`,
        ],
      };
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { hash, spec: BS.all.ring };
})(typeof globalThis !== 'undefined' ? globalThis : this);

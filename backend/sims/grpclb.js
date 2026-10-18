/* 20 gRPC clients, each making 50 calls a second to a service with 4 backends. At 60 s the service scales out to 8.
 * How calls spread depends on what balances them: a TCP (L4) load balancer, the client's channel policy, the
 * server's max connection age, or a per-request (L7) proxy. Model assumptions: each client keeps one connection
 * per address it uses; with maxConnectionAge 30 s (±10% jitter, as grpc-java does) a client reconnects and
 * resolves the name again; an L7 proxy notices new backends within 5 s. */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const CLIENTS = 20, RATE = 50, BEFORE = 4, AFTER = 8, SCALE = 60, END = 150, AGE = 30, PROXY_LAG = 5;

  BS.define('grpclb', {
    title: 'Who gets the calls: gRPC load balancing',
    blurb: '20 clients, 50 calls a second each, 4 backends. At 60 s the service scales out to 8. Pick what balances the calls.',
    compare: 'strategy',
    params: [
      { id: 'strategy', label: 'What balances the calls', type: 'select', value: 'l4', options: [
        ['l4', 'A TCP (L4) load balancer in front'],
        ['pickfirst', 'Client resolves every backend; default policy (pick_first)'],
        ['rr', 'Client resolves every backend; round_robin'],
        ['rrage', 'round_robin, and the server sets maxConnectionAge 30 s'],
        ['l7', 'A per-request (L7) proxy, such as Envoy'],
      ] },
    ],
    run(p) {
      const rnd = BS.rng(7);
      // per client: which backends it sends to, and from when it switches to the scaled-out set
      const clients = Array.from({ length: CLIENTS }, (_, c) => {
        if (p.strategy === 'l4') return { early: [c % BEFORE], late: [c % BEFORE], switchAt: Infinity };
        if (p.strategy === 'pickfirst') { const b = Math.floor(rnd() * BEFORE); return { early: [b], late: [b], switchAt: Infinity }; }
        const all4 = [0, 1, 2, 3], all8 = [0, 1, 2, 3, 4, 5, 6, 7];
        if (p.strategy === 'rr') return { early: all4, late: all4, switchAt: Infinity };
        if (p.strategy === 'l7') return { early: all4, late: all8, switchAt: SCALE + PROXY_LAG };
        // rrage: reconnects every 27 to 33 s from a random start; the first reconnect after the scale-out sees 8
        const first = rnd() * AGE;
        let t = first;
        while (t < SCALE) t += AGE * (0.9 + 0.2 * rnd());
        return { early: all4, late: all8, switchAt: t };
      });
      const x = Array.from({ length: END / 5 + 1 }, (_, k) => k * 5);
      const loadAt = (t) => {
        const per = new Array(AFTER).fill(0);
        for (const c of clients) { const set = t >= c.switchAt ? c.late : c.early; for (const b of set) per[b] += RATE / set.length; }
        return per;
      };
      const share = (t) => { const per = loadAt(t); return per.slice(BEFORE).reduce((a, v) => a + v, 0) / (CLIENTS * RATE); };
      const end = loadAt(END);
      const live = end.filter((_, b) => b < AFTER);
      const avg = (CLIENTS * RATE) / AFTER;
      const imbalance = +(Math.max(...live) / avg).toFixed(2);
      const newShare = +share(END).toFixed(3);
      const reached = x.find((t) => t >= SCALE && share(t) >= 0.45);
      const pickedUpAfter = reached === undefined ? Infinity : reached - SCALE;
      return {
        out: { newShare, imbalance, pickedUpAfter },
        stats: [
          { label: 'Calls going to the 4 new backends', value: Math.round(newShare * 100), unit: '%', tone: newShare > 0.45 ? 'good' : newShare > 0 ? 'warn' : 'bad', note: 'even would be 50%' },
          { label: 'Busiest backend vs an even share', value: imbalance + '×', tone: imbalance > 1.5 ? 'bad' : imbalance > 1.1 ? 'warn' : 'good' },
          { label: 'Time for new backends to take load', value: isFinite(pickedUpAfter) ? pickedUpAfter : 'never', unit: isFinite(pickedUpAfter) ? 's' : '', tone: isFinite(pickedUpAfter) ? (pickedUpAfter > 30 ? 'warn' : 'good') : 'bad' },
        ],
        chart: { x, xLabel: 'seconds', yLabel: '% of calls on the new backends', lines: [{ name: 'Share on backends 5 to 8', values: x.map((t) => Math.round(share(t) * 100)), tone: 'good' }], marks: [{ x: SCALE, label: 'scale out to 8' }] },
        bars: { title: 'Calls a second per backend at the end', unit: '/s', items: end.map((v, b) => ({ label: `b${b + 1}${b >= BEFORE ? ' (new)' : ''}`, value: Math.round(v), tone: v > avg * 1.5 ? 'bad' : v === 0 ? 'warn' : 'good' })) },
        notes: [
          { l4: 'A TCP load balancer picks a backend per connection. gRPC sends every call over one long-lived HTTP/2 connection, so each client stays on the backend it first got, and new backends are never chosen.',
            pickfirst: 'pick_first, the default policy, connects to the first address that works and sends everything there: no balancing at all, just wherever each client landed.',
            rr: 'round_robin spreads each client\'s calls over the addresses it resolved. But the name is only resolved again when a connection breaks, and nothing breaks: the new backends stay idle.',
            rrage: 'maxConnectionAge makes the server close each connection after about 30 s (with a grace period for calls in flight). The client reconnects, resolves the name again, and sees the new backends.',
            l7: 'An L7 proxy balances each call, not each connection, and watches the backends itself. The cost is an extra hop and a proxy to run.' }[p.strategy],
        ],
      };
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { spec: BS.all.grpclb };
})(typeof globalThis !== 'undefined' ? globalThis : this);

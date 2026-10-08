/* Two services that should agree. The order service owns orders; a shipping service keeps its own copy
 * of each order's status from events: CREATED, then PAID 2 minutes later (which also sends a receipt),
 * then SHIPPED 30 minutes after creation. 20,000 orders over two hours.
 * Faults: the order service can die between committing and publishing (dual write only); the broker
 * redelivers some events; a few events arrive after the next event for the same order. */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const ORDERS = 20000, CREATE_SPAN = 120, END = 160, SETTLE = 2, RECON_EVERY = 10;
  const P_CRASH = 0.003, P_DUP = 0.01, P_REORDER = 0.005;
  const STATUS = ['', 'CREATED', 'PAID', 'SHIPPED'];

  BS.define('drift', {
    title: 'Two services disagree',
    blurb: 'An order service and a shipping service, connected by events. 20,000 orders over two hours, with crashes, redeliveries and the odd out-of-order event.',
    params: [
      { id: 'write', label: 'How the order service publishes', type: 'select', value: 'dual', options: [
        ['dual', 'Commit, then publish (dual write)'],
        ['outbox', 'Transactional outbox, relayed at least once'],
      ] },
      { id: 'consumer', label: 'How the shipping service applies events', type: 'select', value: 'naive', options: [
        ['naive', 'Apply every event as it arrives'],
        ['idempotent', 'Skip seen event ids; ignore older versions'],
      ] },
      { id: 'recon', label: 'Reconcile against the source every 10 minutes', type: 'toggle', value: false },
    ],
    run(p) {
      const r = BS.rng(23);
      const source = [];                 // per order: [ [minute, version], ... ]
      const deliveries = [];             // { at, order, version, id }
      let lost = 0, eventId = 0;
      for (let o = 0; o < ORDERS; o++) {
        const t0 = (o / ORDERS) * CREATE_SPAN;
        const evs = [[t0, 1], [t0 + 2, 2], [t0 + 30, 3]].filter(([t]) => t < END - SETTLE);
        source.push(evs);
        evs.forEach(([t, v], k) => {
          const id = ++eventId;
          if (p.write === 'dual' && r() < P_CRASH) { lost++; return; }
          const next = evs[k + 1];
          const at = next && r() < P_REORDER ? next[0] + 0.5 : t;
          deliveries.push({ at, order: o, version: v, id });
          if (r() < P_DUP) deliveries.push({ at: at + 1, order: o, version: v, id });
        });
      }
      deliveries.sort((a, b) => a.at - b.at);

      const state = new Int8Array(ORDERS), seen = new Set(), receipts = new Int32Array(ORDERS);
      const truth = (o, m) => { let v = 0; for (const [t, ver] of source[o]) if (t <= m) v = ver; return v; };
      const settledTruth = (o, m) => truth(o, m - SETTLE);
      let d = 0, repaired = 0;
      const series = [];
      for (let m = 0; m <= END; m++) {
        for (; d < deliveries.length && deliveries[d].at <= m; d++) {
          const e = deliveries[d];
          if (p.consumer === 'idempotent') {
            if (seen.has(e.id)) continue;
            seen.add(e.id);
            // the version check guards the status only: a late event's own side effect still runs, once
            if (e.version > state[e.order]) state[e.order] = e.version;
          } else state[e.order] = e.version;
          if (e.version === 2) receipts[e.order]++;
        }
        let bad = 0;
        for (let o = 0; o < ORDERS; o++) {
          const want = settledTruth(o, m);
          if (!want || state[o] === want || truth(o, m) !== want) continue;   // not settled yet, or in agreement
          if (p.recon && m > 0 && m % RECON_EVERY === 0) { state[o] = want; repaired++; } else bad++;
        }
        series.push(bad);
      }
      let endMismatch = 0;
      for (let o = 0; o < ORDERS; o++) if (state[o] !== truth(o, END)) endMismatch++;
      let dupEffects = 0, missedEffects = 0;
      for (let o = 0; o < ORDERS; o++) {
        if (receipts[o] > 1) dupEffects += receipts[o] - 1;
        if (truth(o, END) >= 2 && receipts[o] === 0) missedEffects++;
      }

      return {
        out: { endMismatch, dupEffects, missedEffects, lost, repaired },
        stats: [
          { label: 'Orders that disagree at the end', value: endMismatch.toLocaleString('en'), tone: endMismatch ? 'bad' : 'good' },
          { label: 'Duplicate receipts sent', value: dupEffects.toLocaleString('en'), tone: dupEffects ? 'bad' : 'good' },
          { label: 'Receipts never sent', value: missedEffects.toLocaleString('en'), tone: missedEffects ? 'bad' : 'good' },
          { label: 'Events lost before publishing', value: lost.toLocaleString('en'), tone: lost ? 'bad' : 'good' },
          { label: 'Repaired by reconciliation', value: repaired.toLocaleString('en'), tone: repaired ? 'warn' : 'good' },
        ],
        chart: {
          x: series.map((_, m) => m), xLabel: 'minutes', yLabel: 'orders',
          lines: [{ name: 'Orders the two services disagree on', values: series }],
        },
        notes: [
          p.write === 'dual'
            ? `${lost} events were committed in the order database but never published: the process died between the two writes. No consumer can recover an event that does not exist.`
            : 'The outbox row commits in the same transaction as the order, and a relay publishes it until it succeeds, so nothing is lost; the price is duplicates.',
          p.consumer === 'naive'
            ? 'Every duplicate PAID event sent another receipt, and an older event arriving late overwrote a newer status.'
            : 'Duplicates are skipped by event id. A late, older event cannot overwrite a newer status because its version is lower, but its own side effect (the receipt) still runs, once.',
          p.recon ? 'Reconciliation compares each settled order with the source every 10 minutes and repairs the copy: it bounds how long a disagreement lasts, but it repairs state, not missed side effects.' : '',
        ].filter(Boolean),
      };
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = BS.all.drift;
})(typeof globalThis !== 'undefined' ? globalThis : this);

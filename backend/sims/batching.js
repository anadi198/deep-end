/* A Kafka producer sending 1 KB JSON records to 12 partitions on 3 brokers. linger.ms, batch.size and compression
 * decide how records are grouped into batches, how many requests the brokers handle, and what each record waits.
 * A toy model with stated assumptions, to show the shape rather than your cluster's numbers:
 *   each request to a broker carries one batch for each of its 4 partitions; a broker handles 2,000 produce
 *   requests a second; the cluster takes in 350 MB/s; a request costs 1 ms round trip plus 1 ms of broker time,
 *   stretched by queueing as the broker gets busy; at most 5 requests are in flight per broker (the default);
 *   lz4 shrinks this JSON 2.5x and zstd 4x (repetitive JSON; your ratio will differ). */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const P = 12, BROKERS = 3, REC = 1024, RTT = 1, S0 = 1, CAP = 2000, NET = 350, W0 = 0.1, INFLIGHT = 5, CEIL = 60;
  const RATIO = { none: 1, lz4: 2.5, zstd: 4 };
  const LOADS = [10, 25, 50, 100, 150, 200, 250, 300, 350, 400, 500, 600];

  // ms until a partition's batch closes: when it is full, or when linger runs out
  function batchWait(batchBytes, recordsPerSec, lingerMs, recordBytes, ratio) {
    const fill = (batchBytes / (recordsPerSec * (recordBytes / ratio))) * 1000;
    return Math.min(lingerMs, fill);
  }

  // The steady state for one offered load: how long batches collect (w), broker utilisation, response time.
  function solve(lam, p) {
    const ratio = RATIO[p.compression], bpr = REC / ratio, r = lam / P;
    const full = batchWait(p.batch, r, Infinity, REC, ratio);
    const rhoNet = (lam * bpr) / (NET * 1e6);
    const base = p.linger > 0 ? batchWait(p.batch, r, p.linger, REC, ratio) : W0;
    const at = (w) => {
      const q = Math.min(1000 / w, lam / BROKERS);            // requests a second per broker: never more than records
      const rho = q / CAP + rhoNet;
      return { q, rho, R: rho < 0.98 ? RTT + S0 / (1 - rho) : Infinity };
    };
    const limit = () => ({ ok: false, bottleneck: rhoNet >= 1000 / full / CAP ? 'network' : 'requests' });
    // How long records must collect if batches are sent every w ms. With 5 requests already in flight the next one
    // waits, and records keep collecting meanwhile. It shrinks as w grows (fewer requests, a quieter broker), so the
    // steady state is where it crosses w; past a full batch there is no steady state.
    const need = (w) => {
      const { q, R } = at(w);
      if (!isFinite(R)) return Infinity;
      return (q * R) / 1000 > INFLIGHT ? Math.max(base, R / INFLIGHT) : base;
    };
    let w;
    if (need(base) <= base) w = base;
    else if (need(full) > full) return limit();
    else {
      let lo = base, hi = full;
      for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (need(mid) > mid) lo = mid; else hi = mid; }
      w = hi;
    }
    const { q, rho, R } = at(w);
    const wait = p.linger > 0 || w > W0 ? w / 2 : W0;
    return { ok: true, w, rho, R, p50: wait + R, requests: BROKERS * q, recordsPerBatch: Math.max(1, Math.round((r * w) / 1000)), wireMBs: (lam * bpr) / 1e6 };
  }

  function carry(p) {
    const s = solve(p.load, p);
    if (s.ok) return { ...s, throughput: p.load, bottleneck: 'none' };
    let lo = 0, hi = p.load;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (solve(mid, p).ok) lo = mid; else hi = mid; }
    const best = solve(lo, p);
    return { ...best, throughput: Math.floor(lo / 1000) * 1000, bottleneck: s.bottleneck, p50: Infinity };
  }

  BS.define('batching', {
    title: 'Producer batching: linger, batch size, compression',
    blurb: '1 KB JSON records into 12 partitions on 3 brokers. Change how the producer batches and compresses, and watch requests, bytes and latency.',
    compare: 'linger',
    params: [
      { id: 'load', label: 'Records a second', type: 'select', value: 200000, options: [[1000, '1,000'], [20000, '20,000'], [200000, '200,000'], [400000, '400,000']] },
      { id: 'linger', label: 'linger.ms', type: 'select', value: 0, options: [[0, '0 (default before 4.0)'], [5, '5 (default from 4.0)'], [20, '20'], [100, '100']] },
      { id: 'batch', label: 'batch.size', type: 'select', value: 16384, options: [[16384, '16 KB (default)'], [65536, '64 KB'], [262144, '256 KB']] },
      { id: 'compression', label: 'compression.type', type: 'select', value: 'none', options: [['none', 'none (default)'], ['lz4', 'lz4'], ['zstd', 'zstd']] },
    ],
    run(p) {
      p = { ...p, load: +p.load, linger: +p.linger, batch: +p.batch };
      const o = carry(p);
      const curve = (q) => LOADS.map((k) => { const s = solve(k * 1000, q); return s.ok ? Math.min(CEIL, +s.p50.toFixed(2)) : CEIL; });
      const firstFull = (q) => LOADS.find((k) => !solve(k * 1000, q).ok);
      const base = { ...p, linger: 0, compression: 'none', batch: 16384 };
      const marks = [];
      const f1 = firstFull(p); if (f1) marks.push({ x: f1, label: 'these settings saturate' });
      const sat = o.bottleneck !== 'none';
      return {
        out: { throughput: o.throughput, bottleneck: o.bottleneck, recordsPerBatch: o.recordsPerBatch, requests: Math.round(o.requests), p50: o.p50, wireMBs: o.wireMBs },
        stats: [
          { label: 'Records a second delivered', value: o.throughput.toLocaleString('en'), tone: sat ? 'bad' : 'good', note: sat ? `of ${p.load.toLocaleString('en')} offered: the ${o.bottleneck === 'network' ? 'network' : "brokers' request capacity"} runs out` : '' },
          { label: 'Records per batch', value: o.recordsPerBatch, tone: o.recordsPerBatch < 5 && p.load >= 20000 ? 'warn' : 'good' },
          { label: 'Produce requests a second', value: Math.round(o.requests).toLocaleString('en'), tone: o.rho > 0.8 ? 'bad' : o.rho > 0.5 ? 'warn' : 'good', note: `brokers ${Math.round(o.rho * 100)}% busy` },
          { label: 'Bytes on the wire', value: o.wireMBs.toFixed(0), unit: 'MB/s', tone: 'good' },
          { label: 'Typical latency per record', value: sat ? 'send() blocks' : o.p50.toFixed(1), unit: sat ? '' : 'ms', tone: sat ? 'bad' : o.p50 > 20 ? 'warn' : 'good' },
        ],
        chart: {
          x: LOADS, xLabel: 'thousand records a second offered', yLabel: `latency, ms (capped at ${CEIL})`,
          lines: [{ name: 'These settings', values: curve(p), tone: 'good' }, { name: 'linger 0, 16 KB, no compression', values: curve(base), tone: 'bad', dash: true }],
          marks,
        },
        notes: [
          sat ? `Past ${Math.round(o.throughput / 1000)}k records a second these settings cannot keep up: the producer's buffer (buffer.memory, 32 MB) fills, then send() blocks for up to max.block.ms (60 s) and throws.`
            : p.linger === 0 ? 'linger 0 does not mean "no batching": while 5 requests are in flight, records pile up and go out together. It means small, early batches, so more requests for the same data.'
              : 'Each batch waits up to linger.ms or until it holds batch.size bytes, whichever comes first.',
          p.load <= 1000 ? 'At light load nothing fills a batch, so linger is pure waiting: every record sits out the whole linger.' : 'Under load, fuller batches mean fewer requests, so the brokers queue less, which can pay back the linger wait.',
          p.compression === 'none' ? 'Compression works per batch, so bigger batches compress better. It costs producer CPU and saves network, disk and replication bytes.' : `${p.compression} shrinks each batch on the producer; the broker stores and replicates it compressed, and consumers decompress.`,
        ],
      };
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { batchWait, solve, spec: BS.all.batching };
})(typeof globalThis !== 'undefined' ? globalThis : this);

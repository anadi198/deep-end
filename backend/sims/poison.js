/* One partition, 50 messages a second, 40 keys, a consumer that can do 200 a second.
 * Two poison messages (they can never succeed: bad payload) arrive at 10 s and 25 s.
 * Optionally the downstream the consumer writes to is down from 40 s to 55 s (every attempt fails then). */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const RATE = 50, END = 90, DT = 0.005, KEYS = 40, POISON = [500, 1250], OUT_FROM = 40, OUT_TO = 55;
  const INPLACE_BACKOFF = [1, 2, 4], RETRY_TOPICS = [5, 30];

  BS.define('poison', {
    title: 'A message keeps failing',
    blurb: 'One partition, 50 messages a second, two poison messages (at 10 s and 25 s) that can never succeed, and optionally the downstream is down from 40 s to 55 s.',
    compare: 'strategy',
    params: [
      { id: 'strategy', label: 'What the consumer does on failure', type: 'select', value: 'forever', options: [
        ['forever', 'Retry the same message until it works'],
        ['skip', 'Log it and move on'],
        ['inplace', 'Retry 3 times in place, then dead-letter'],
        ['retrytopic', 'Send to retry topics (5 s, 30 s), then dead-letter'],
        ['classify', 'Dead-letter bad data; pause and retry on outages'],
      ] },
      { id: 'outage', label: 'Downstream outage from 40 s to 55 s', type: 'toggle', value: true },
    ],
    run(p) {
      const total = RATE * END;
      const isPoison = new Set(POISON);
      const down = (t) => p.outage && t >= OUT_FROM && t < OUT_TO;
      const fails = (m, t) => (isPoison.has(m) ? 'bad' : down(t) ? 'down' : null);
      const maxSeq = new Array(KEYS).fill(-1);
      let next = 0, wake = 0, tries = 0, processed = 0, lost = 0, dlq = 0, dlqHealthy = 0, reordered = 0, maxLag = 0;
      const parked = [];   // retry-topic entries { m, due, stage }
      const done = (m) => { processed++; const k = m % KEYS, s = Math.floor(m / KEYS); if (s < maxSeq[k]) reordered++; else maxSeq[k] = s; };
      const dead = (m) => { dlq++; if (!isPoison.has(m)) dlqHealthy++; };
      const lagS = [], dlqS = [], parkS = [];

      const steps = Math.round(END / DT);
      for (let i = 0; i < steps; i++) {
        const t = i * DT;
        const arrived = Math.min(total, Math.floor(t * RATE) + 1);
        // retry topics are read by their own consumers once each entry is due
        for (let j = parked.length - 1; j >= 0; j--) {
          const e = parked[j];
          if (e.due > t) continue;
          parked.splice(j, 1);
          if (!fails(e.m, t)) done(e.m);
          else if (e.stage + 1 < RETRY_TOPICS.length) parked.push({ m: e.m, due: t + RETRY_TOPICS[e.stage + 1], stage: e.stage + 1 });
          else dead(e.m);
        }
        // the main consumer
        if (t >= wake && next < arrived) {
          const m = next, why = fails(m, t);
          if (!why) { done(m); next++; tries = 0; }
          else if (p.strategy === 'forever') { wake = t + 1; tries++; }
          else if (p.strategy === 'skip') { lost++; next++; }
          else if (p.strategy === 'inplace') {
            if (tries < INPLACE_BACKOFF.length) { wake = t + INPLACE_BACKOFF[tries]; tries++; }
            else { dead(m); next++; tries = 0; }
          } else if (p.strategy === 'retrytopic') { parked.push({ m, due: t + RETRY_TOPICS[0], stage: 0 }); next++; }
          else if (p.strategy === 'classify') {
            if (why === 'bad') { dead(m); next++; tries = 0; }
            else { wake = t + Math.min(8, 2 ** tries); tries++; }
          }
        }
        maxLag = Math.max(maxLag, arrived - next);
        if (i % Math.round(1 / DT) === 0) { lagS.push(arrived - next); dlqS.push(dlq); parkS.push(parked.length); }
      }
      const endLag = total - next;

      return {
        out: { endLag, maxLag, processed, lost, dlq, dlqHealthy, reordered },
        stats: [
          { label: 'Lag at the end', value: endLag.toLocaleString('en'), unit: 'messages', tone: endLag > 100 ? 'bad' : 'good' },
          { label: 'Worst lag', value: maxLag.toLocaleString('en'), tone: maxLag > 2000 ? 'bad' : maxLag > 200 ? 'warn' : 'good' },
          { label: 'Lost without a trace', value: lost.toLocaleString('en'), tone: lost ? 'bad' : 'good' },
          { label: 'In the dead-letter topic', value: `${dlq}${dlqHealthy ? ` (${dlqHealthy} healthy)` : ''}`, tone: dlqHealthy ? 'bad' : dlq ? 'warn' : 'good' },
          { label: 'Processed out of order for their key', value: reordered.toLocaleString('en'), tone: reordered ? 'warn' : 'good' },
        ],
        chart: {
          x: lagS.map((_, s) => s), xLabel: 'seconds', yLabel: 'messages',
          lines: [
            { name: 'Lag on the partition', values: lagS, tone: 'bad' },
            { name: 'Waiting in retry topics', values: parkS, tone: 'warn' },
            { name: 'Dead-lettered', values: dlqS, tone: 'muted' },
          ],
          bands: p.outage ? [{ from: OUT_FROM, to: OUT_TO, label: 'downstream down' }] : [],
          marks: [{ x: 10, label: 'poison' }, { x: 25, label: 'poison' }],
        },
        notes: [
          { forever: 'The first poison message can never succeed, so the partition stops there for good. Every key behind it waits, including keys that have nothing to do with it.',
            skip: 'Nothing ever blocks, so the lag looks perfect. During the outage every message failed and was dropped: the dashboards stay green while data disappears.',
            inplace: 'Each poison message costs a 7 s stall. During the outage every message exhausts its retries, so healthy messages end up in the dead-letter topic and need replaying.',
            retrytopic: 'The partition never stops. But a message that went through a retry topic is processed after newer messages with the same key, so per-key order is gone.',
            classify: 'Bad data cannot be fixed by waiting, so it goes straight to the dead-letter topic. An outage can, so the consumer pauses and retries the same message: order kept, nothing lost, and it catches up once the downstream is back.' }[p.strategy],
        ],
      };
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = BS.all.poison;
})(typeof globalThis !== 'undefined' ? globalThis : this);

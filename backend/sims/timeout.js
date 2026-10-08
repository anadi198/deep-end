/* A payment request that times out. Each user pays once; the client may time out, retry, and send an
 * idempotency key. The server keeps working after the client gives up unless it is handed the deadline. */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const USERS = 2000;
  const BACKOFF = [300, 600];
  const REPLAY_MS = 20;    // answering a retry from the stored result
  const COMMIT_AT = 0.8;   // the charge happens 80% of the way through the work

  BS.define('timeout', {
    title: 'A payment request times out',
    blurb: '2,000 users each press Pay once. Some calls hit a slow path on the server. Watch what the user sees and what the card is actually charged.',
    compare: 'mode',
    params: [
      { id: 'mode', label: 'Client and server behaviour', type: 'select', value: 'none', options: [
        ['none', 'No retries'],
        ['retry', 'Retry on timeout, no key'],
        ['key', 'Retry with an idempotency key'],
        ['deadline', 'Key, and the server gets the deadline'],
      ] },
      { id: 'timeout', label: 'Client timeout', type: 'range', min: 200, max: 5000, step: 100, value: 1000, unit: 'ms' },
      { id: 'slowPct', label: 'Calls that hit the slow path', type: 'range', min: 0, max: 30, step: 1, value: 8, unit: '%' },
      { id: 'slowMs', label: 'Slow path takes', type: 'range', min: 500, max: 6000, step: 100, value: 2500, unit: 'ms' },
    ],
    run(p) {
      const r = BS.rng(7);
      const retries = p.mode === 'none' ? 0 : BACKOFF.length;
      const useKey = p.mode === 'key' || p.mode === 'deadline';
      const deadline = p.mode === 'deadline';
      const out = { ok: 0, cleanFail: 0, chargedButError: 0, double: 0, timeouts: 0, conflicts: 0, wasted: 0 };
      let story = null, storyRank = 0;

      for (let u = 0; u < USERS; u++) {
        const log = [];
        let t = 0, charges = 0, shownOk = false;
        let key = null;   // { state: 'running' | 'done', until: ms }
        for (let a = 0; a <= retries && !shownOk; a++) {
          if (a) t += BACKOFF[a - 1];
          const giveUp = t + p.timeout;
          log.push([t, `client sends attempt ${a + 1}${useKey ? ' with the same idempotency key' : ''}`]);
          if (key && key.state === 'running' && key.until <= t) key = { state: 'done' };
          if (key && key.state === 'done') {
            log.push([t + REPLAY_MS, 'server finds the key already completed and replays the stored success: no new charge']);
            shownOk = true;
            break;
          }
          if (key && key.state === 'running') {
            out.conflicts++;
            log.push([t + REPLAY_MS, 'server finds the key still in progress and answers 409 Conflict']);
            continue;
          }
          const slow = r() * 100 < p.slowPct;
          const L = slow ? p.slowMs * (0.8 + 0.4 * r()) : 80 + 80 * r();
          const commit = t + COMMIT_AT * L, end = t + L;
          if (L <= p.timeout) {
            charges++;
            if (useKey) key = { state: 'done' };
            log.push([commit, 'server charges the card'], [end, 'client gets 200 OK']);
            shownOk = true;
            break;
          }
          out.timeouts++;
          log.push([giveUp, `client times out after ${p.timeout} ms and stops waiting`]);
          if (deadline && commit > giveUp) {
            log.push([giveUp, 'server sees the deadline has passed and abandons the work: no charge']);
            continue;
          }
          out.wasted += end - giveUp;
          charges++;
          if (useKey) key = { state: 'running', until: commit };
          log.push([commit, 'server, still working, charges the card anyway'], [end, 'server sends 200 OK to a client that is no longer listening']);
          t = Math.max(t, giveUp);
          if (a < retries) continue;
        }
        let cat;
        if (charges >= 2) cat = 'double';
        else if (!shownOk && charges) cat = 'chargedButError';
        else if (!shownOk) cat = 'cleanFail';
        else cat = 'ok';
        out[cat]++;
        const rank = { double: 3, chargedButError: 2 }[cat] || 0;
        if (rank > storyRank) {
          storyRank = rank;
          log.push([Infinity, shownOk ? `the user saw success; the card was charged ${charges} time${charges === 1 ? '' : 's'}` : `the user saw an error; the card was charged ${charges} time${charges === 1 ? '' : 's'}`]);
          story = log.sort((x, y) => x[0] - y[0]).map(([ms, what]) => ({ ms: Number.isFinite(ms) ? Math.round(ms) : null, what }));
        }
      }
      out.wasted = Math.round(out.wasted / 1000);

      const tone = (v, bad = 'bad') => (v ? bad : 'good');
      return {
        out,
        stats: [
          { label: 'Charged twice or more', value: out.double, tone: tone(out.double) },
          { label: 'Charged, but shown an error', value: out.chargedButError, tone: tone(out.chargedButError, 'warn') },
          { label: 'Shown an error', value: out.cleanFail + out.chargedButError, tone: tone(out.cleanFail + out.chargedButError, 'warn') },
          { label: 'Server time spent after the client left', value: out.wasted, unit: 's', tone: tone(out.wasted, 'warn') },
        ],
        bars: { title: `What happened to ${USERS.toLocaleString('en')} users`, items: [
          { label: 'Paid once, saw success', value: out.ok, tone: 'good' },
          { label: 'Not charged, saw an error', value: out.cleanFail, tone: 'warn' },
          { label: 'Charged, but saw an error', value: out.chargedButError, tone: 'warn' },
          { label: 'Charged twice or more', value: out.double, tone: 'bad' },
        ] },
        story: story && { title: storyRank === 3 ? 'One double-charged user, step by step' : 'One user charged while shown an error, step by step', steps: story },
        notes: [
          out.timeouts ? `${out.timeouts} attempts timed out on the client. In ${p.mode === 'deadline' ? 'most of them the server stopped once the deadline passed' : 'every one of them the server kept working and charged the card'}.` : 'No attempt was slower than the client timeout.',
          out.conflicts ? `${out.conflicts} retries arrived while the first attempt was still running and got 409 Conflict instead of a second charge.` : '',
        ].filter(Boolean),
      };
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = BS.all.timeout;
})(typeof globalThis !== 'undefined' ? globalThis : this);

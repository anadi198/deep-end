/* One Kafka partition with replication factor 3, written at 1,000 records a second for 60 s.
 * Something fails; acks, min.insync.replicas and unclean leader election decide what an acknowledged write was worth.
 * Model assumptions (not Kafka defaults): in-sync followers trail the leader by 50 ms; a failover (detect the dead
 * broker, elect a new leader) takes 6 s; after a power cut, anything written in the last 30 s may not be on disk yet. */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const RATE = 1000, TAIL = 0.05, FAILOVER = 6, FLUSH = 30, CUT = 10, CRASH = 30, BACK = 50, END = 60;
  const P99 = { 0: 0.3, 1: 2, all: 5 };

  BS.define('acks', {
    title: 'What an acknowledged write is worth',
    blurb: 'One partition, three replicas, 1,000 records a second. Pick a failure and the producer and topic settings, then count what was acknowledged and later lost.',
    compare: 'acks',
    params: [
      { id: 'scenario', label: 'What fails', type: 'select', value: 'leader', options: [
        ['leader', 'The leader broker crashes at 30 s'],
        ['shrink', 'Both followers drop out of the in-sync set at 10 s; the leader crashes at 30 s and is back at 50 s'],
        ['power', 'Power cut at 30 s to the brokers holding the replicas; back at 50 s'],
      ] },
      { id: 'acks', label: 'Producer acks', type: 'select', value: 'all', options: [['0', 'acks=0'], ['1', 'acks=1'], ['all', 'acks=all']] },
      { id: 'minIsr', label: 'min.insync.replicas', type: 'select', value: '1', options: [['1', '1 (the default)'], ['2', '2']], when: { scenario: 'shrink' } },
      { id: 'unclean', label: 'unclean.leader.election.enable', type: 'toggle', value: false, when: { scenario: 'shrink' } },
      { id: 'spread', label: 'Replicas in three different zones', type: 'toggle', value: false, when: { scenario: 'power' } },
    ],
    run(p) {
      const acks = p.acks, minIsr = +p.minIsr || 1;
      let lost = 0, rejected = 0, offline = 0, failover = 0;
      let risk = () => (acks === 'all' ? 0 : RATE * TAIL);   // acknowledged records one failure could erase
      const marks = [];

      if (p.scenario === 'leader' || (p.scenario === 'power' && p.spread)) {
        failover = FAILOVER;
        if (acks === '1') lost = RATE * TAIL;
        if (acks === '0') lost = RATE * (TAIL + FAILOVER);
        marks.push({ x: CRASH, label: p.scenario === 'power' ? 'one zone loses power' : 'leader crashes' });
      } else if (p.scenario === 'shrink') {
        const guarded = acks === 'all' && minIsr >= 2;
        const leaderOnly = guarded ? 0 : RATE * (CRASH - CUT);
        if (guarded) rejected = RATE * (CRASH - CUT);
        risk = (t) => (t < CUT ? (acks === 'all' ? 0 : RATE * TAIL) : t < CRASH ? (guarded ? 0 : RATE * (t - CUT)) : 0);
        if (p.unclean) { lost = leaderOnly; failover = FAILOVER; } else offline = BACK - CRASH;
        if (acks === '0') lost += RATE * (p.unclean ? FAILOVER : offline);
        marks.push({ x: CUT, label: 'followers drop out' }, { x: CRASH, label: 'leader crashes' });
        if (!p.unclean) marks.push({ x: BACK, label: 'leader back' });
      } else {
        offline = BACK - CRASH;
        lost = acks === '0' ? RATE * (FLUSH + offline) : RATE * FLUSH;
        risk = (t) => RATE * Math.min(t, FLUSH);
        marks.push({ x: CRASH, label: 'power cut' }, { x: BACK, label: 'power back' });
      }

      const x = Array.from({ length: END + 1 }, (_, s) => s);
      const out = { lost, rejected, offline, failover, p99: P99[acks] };
      return {
        out,
        stats: [
          { label: 'Acknowledged writes lost', value: lost.toLocaleString('en'), tone: lost ? 'bad' : 'good', note: acks === '0' ? 'acks=0 acknowledges nothing, so every lost send counts' : '' },
          { label: 'Writes rejected', value: rejected.toLocaleString('en'), tone: rejected ? 'warn' : 'good', note: rejected ? 'the producer got NotEnoughReplicas and knows to retry' : '' },
          { label: 'Seconds the partition took no writes', value: offline + failover, unit: 's', tone: offline ? 'bad' : failover ? 'warn' : 'good' },
          { label: 'p99 produce latency (model)', value: P99[acks], unit: 'ms', tone: 'good' },
        ],
        chart: { x, xLabel: 'seconds', yLabel: 'acknowledged but erasable', lines: [{ name: 'Acknowledged writes one failure could erase', values: x.map((t) => Math.round(risk(t))), tone: 'bad' }], marks },
        notes: [
          acks === '0' ? 'acks=0: the producer never hears back, so it cannot retry. Everything sent into a dead leader or an offline partition is gone.'
            : acks === '1' ? 'acks=1: acknowledged once the leader has it. Whatever the followers had not fetched yet dies with the leader.'
              : p.scenario === 'shrink' && minIsr < 2 ? 'acks=all means "all replicas in the in-sync set". Once the set shrank to the leader alone, acks=all was no stronger than acks=1.'
                : 'acks=all: acknowledged only once every in-sync replica has it, so a single broker failure loses nothing acknowledged.',
          { leader: 'Kafka acknowledges before writing to disk: it relies on replicas, not fsync. That is why one crash is survivable only with replicas that already have the data.',
            shrink: p.unclean ? 'Unclean election picked a follower that was 20 s behind. The partition stayed available, and everything acknowledged in those 20 s vanished.'
              : 'With unclean election off (the default), no out-of-sync follower may lead: the partition waits, offline, for the old leader. Nothing is lost; nothing is written either.',
            power: p.spread ? 'With replicas in different zones, one zone losing power is just a broker failure.' : 'Every replica lost power at once, so the page cache on all of them was lost together. No acks setting helps; spreading replicas across racks or zones does.' }[p.scenario],
        ],
      };
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { spec: BS.all.acks };
})(typeof globalThis !== 'undefined' ? globalThis : this);

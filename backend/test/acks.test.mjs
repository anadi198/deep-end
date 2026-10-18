import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
require('../sims/acks.js');
const run = (p) => BS.run('acks', p).out;

test('acks: a leader crash loses the not-yet-replicated tail with acks=1, nothing with acks=all', () => {
  const one = run({ scenario: 'leader', acks: '1' });
  const all = run({ scenario: 'leader', acks: 'all' });
  assert.ok(one.lost > 0);
  assert.equal(all.lost, 0);
});

test('acks: acks=0 loses at least as much as acks=1, because nothing is ever confirmed', () => {
  assert.ok(run({ scenario: 'leader', acks: '0' }).lost >= run({ scenario: 'leader', acks: '1' }).lost);
});

test('acks: followers cut off, then the leader crashes: min.insync.replicas=1 keeps accepting writes only the leader has', () => {
  const clean = run({ scenario: 'shrink', acks: 'all', minIsr: '1', unclean: false });
  assert.equal(clean.lost, 0);
  assert.ok(clean.offline > 0, 'no in-sync replica is left, so the partition is offline until the leader returns');
  const unclean = run({ scenario: 'shrink', acks: 'all', minIsr: '1', unclean: true });
  assert.equal(unclean.lost, 20000, '20 s of acknowledged writes lived only on the leader');
  assert.equal(unclean.offline, 0);
});

test('acks: min.insync.replicas=2 turns that loss into rejected writes', () => {
  const o = run({ scenario: 'shrink', acks: 'all', minIsr: '2', unclean: true });
  assert.equal(o.lost, 0);
  assert.equal(o.rejected, 20000);
});

test('acks: min.insync.replicas does nothing for acks=1', () => {
  assert.equal(run({ scenario: 'shrink', acks: '1', minIsr: '2', unclean: true }).lost, run({ scenario: 'shrink', acks: '1', minIsr: '1', unclean: true }).lost);
});

test('acks: a power cut to every replica loses unflushed writes whatever acks says; spreading replicas avoids it', () => {
  const same = run({ scenario: 'power', acks: 'all', spread: false });
  const spread = run({ scenario: 'power', acks: 'all', spread: true });
  assert.ok(same.lost > 0);
  assert.equal(spread.lost, 0);
});

test('acks: stronger acks cost latency', () => {
  const lat = (acks) => run({ scenario: 'leader', acks }).p99;
  assert.ok(lat('0') < lat('1') && lat('1') < lat('all'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
const Q = require('../sims/quorum.js');
const run = (p) => BS.run('quorum', p).out;

test('quorum: QUORUM is a majority: 2 of 3, 3 of 5', () => {
  assert.equal(Q.level('quorum', 3), 2);
  assert.equal(Q.level('quorum', 5), 3);
  assert.equal(Q.level('all', 5), 5);
});

test('quorum: QUORUM writes and reads always overlap, so a read sees the latest acknowledged write', () => {
  const o = run({ rf: 3, write: 'quorum', read: 'quorum', down: 0 });
  assert.equal(o.overlap, true);
  assert.equal(o.stale, 0);
});

test('quorum: ONE and ONE with three replicas can miss the write two times in three', () => {
  const o = run({ rf: 3, write: 'one', read: 'one', down: 0 });
  assert.equal(o.overlap, false);
  assert.ok(Math.abs(o.stale - 2 / 3) < 1e-9, `stale ${o.stale}`);
});

test('quorum: with RF 3, QUORUM survives one replica down but not two', () => {
  assert.equal(run({ rf: 3, write: 'quorum', read: 'quorum', down: 1 }).writeOk, true);
  assert.equal(run({ rf: 3, write: 'quorum', read: 'quorum', down: 2 }).writeOk, false);
});

test('quorum: writing at ALL fails as soon as one replica is down', () => {
  assert.equal(run({ rf: 3, write: 'all', read: 'one', down: 1 }).writeOk, false);
});

test('quorum: the availability table covers every number of replicas down', () => {
  assert.equal(BS.run('quorum', { rf: 5, write: 'quorum', read: 'quorum', down: 0 }).table.rows.length, 5);
});

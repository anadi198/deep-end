import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
const R = require('../sims/rebalance.js');
const run = (p) => BS.run('rebalance', p).out;

test('rebalance: the range assignor spreads 12 partitions as contiguous blocks', () => {
  assert.deepEqual(R.range(12, ['c1', 'c2', 'c3']), [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]);
  assert.deepEqual(R.range(12, ['c1', 'c2', 'c3', 'c4']), [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3]);
});

test('rebalance: the sticky assignment moves only what balance requires', () => {
  const before = R.range(12, ['c1', 'c2', 'c3']);
  const after = R.sticky(before, [0, 1, 2, 3]);
  assert.equal(after.filter((o, i) => o !== before[i]).length, 3);
  assert.deepEqual([0, 1, 2, 3].map((c) => after.filter((o) => o === c).length), [3, 3, 3, 3]);
});

test('rebalance: adding a consumer with eager rebalancing stops all 12 partitions and moves 6', () => {
  const o = run({ event: 'scaleout', protocol: 'eager' });
  assert.equal(o.moved, 6);
  assert.equal(o.pausedPartitionSeconds, 36);
  assert.equal(o.rebalances, 1);
});

test('rebalance: cooperative rebalancing moves 3 and stops only those', () => {
  const o = run({ event: 'scaleout', protocol: 'cooperative' });
  assert.equal(o.moved, 3);
  assert.equal(o.pausedPartitionSeconds, 9);
});

test('rebalance: the new consumer protocol moves 3 and pauses them briefly', () => {
  const o = run({ event: 'scaleout', protocol: 'consumer' });
  assert.equal(o.moved, 3);
  assert.ok(o.pausedPartitionSeconds < 9);
});

test('rebalance: a rolling restart rebalances twice per consumer, unless members are static', () => {
  assert.equal(run({ event: 'restart', protocol: 'eager', static: false }).rebalances, 6);
  assert.equal(run({ event: 'restart', protocol: 'eager', static: true }).rebalances, 0);
});

test('rebalance: a crashed consumer leaves its partitions unread until the session timeout, then they are read twice', () => {
  const o = run({ event: 'crash', protocol: 'cooperative' });
  assert.ok(o.maxLag > 40 * 100, `lag ${o.maxLag}`);
  assert.ok(o.duplicates > 0);
});

test('rebalance: a consumer stuck past max.poll.interval.ms is kicked out and its batch is processed twice', () => {
  const o = run({ event: 'stall', protocol: 'cooperative' });
  assert.equal(o.duplicates, 500);
  assert.equal(o.rebalances, 2);
});

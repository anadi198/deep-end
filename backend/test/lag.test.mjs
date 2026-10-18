import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
require('../sims/lag.js');
const run = (p) => BS.run('lag', p).out;

test('lag: one record at a time with a 5 ms database call per record cannot keep up', () => {
  const o = run({ consumers: 3, mode: 'serial', skew: 'uniform' });
  assert.ok(o.finalLag > 0);
  assert.equal(o.keepsUp, false);
});

test('lag: adding consumers up to the partition count helps the serial consumer', () => {
  assert.ok(run({ consumers: 12, mode: 'serial', skew: 'uniform' }).finalLag < run({ consumers: 3, mode: 'serial', skew: 'uniform' }).finalLag);
});

test('lag: batching the database writes keeps up with 3 consumers', () => {
  const o = run({ consumers: 3, mode: 'batch', skew: 'uniform' });
  assert.equal(o.keepsUp, true);
});

test('lag: a hot key pins one partition, and more consumers cannot fix it', () => {
  const few = run({ consumers: 3, mode: 'keyed', skew: 'hot' });
  const many = run({ consumers: 12, mode: 'keyed', skew: 'hot' });
  assert.equal(many.keepsUp, false);
  assert.equal(many.worstPartition, few.worstPartition);
  assert.ok(many.hotShare >= 0.3);
});

test('lag: keyed workers inside each consumer keep up when keys are spread out', () => {
  assert.equal(run({ consumers: 3, mode: 'keyed', skew: 'uniform' }).keepsUp, true);
});

test('lag: batching gets the hot partition through, because one key no longer costs a call per record', () => {
  assert.equal(run({ consumers: 3, mode: 'batch', skew: 'hot' }).keepsUp, true);
});

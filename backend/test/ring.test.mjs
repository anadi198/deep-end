import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
require('../sims/ring.js');
const run = (p) => BS.run('ring', p).out;

test('ring: hash mod N moves most keys when a node is added', () => {
  const o = run({ scheme: 'modn', nodes: 5, action: 'add' });
  assert.ok(o.moved > 0.75, `moved ${o.moved}`);
});

test('ring: consistent hashing with virtual nodes moves about 1/(N+1) of the keys on an add', () => {
  const o = run({ scheme: 'ring', nodes: 5, vnodes: 100, action: 'add' });
  assert.ok(Math.abs(o.moved - 1 / 6) < 0.04, `moved ${o.moved}`);
});

test('ring: removing a node moves only that node\'s keys, about 1/N', () => {
  const o = run({ scheme: 'ring', nodes: 5, vnodes: 100, action: 'remove' });
  assert.ok(Math.abs(o.moved - 1 / 5) < 0.05, `moved ${o.moved}`);
});

test('ring: one token per node balances badly; many virtual nodes even it out', () => {
  assert.ok(run({ scheme: 'ring', nodes: 5, vnodes: 1 }).imbalance > run({ scheme: 'ring', nodes: 5, vnodes: 100 }).imbalance + 0.2);
});

test('ring: the hash is stable', () => {
  assert.deepEqual(run({ scheme: 'ring', nodes: 7, vnodes: 16 }), run({ scheme: 'ring', nodes: 7, vnodes: 16 }));
});

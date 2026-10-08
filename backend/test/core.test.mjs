import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');

test('rng: the same seed gives the same sequence', () => {
  const a = BS.rng(42), b = BS.rng(42);
  const xs = Array.from({ length: 5 }, () => a());
  const ys = Array.from({ length: 5 }, () => b());
  assert.deepEqual(xs, ys);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});

test('rng: different seeds differ', () => {
  assert.notEqual(BS.rng(1)(), BS.rng(2)());
});

test('percentile: nearest rank on a sorted copy', () => {
  const xs = [5, 1, 4, 2, 3, 6, 7, 8, 9, 10];
  assert.equal(BS.percentile(xs, 50), 5);
  assert.equal(BS.percentile(xs, 90), 9);
  assert.equal(BS.percentile(xs, 100), 10);
  assert.deepEqual(xs.slice(0, 3), [5, 1, 4]);
});

test('define: registers a sim with defaults read from its params', () => {
  BS.define('demo', {
    title: 'Demo',
    params: [{ id: 'n', type: 'range', min: 1, max: 9, value: 3 }, { id: 'mode', type: 'select', options: [['a', 'A'], ['b', 'B']], value: 'b' }],
    run: (p) => ({ stats: [{ label: 'n', value: p.n }], mode: p.mode }),
  });
  assert.deepEqual(BS.defaults('demo'), { n: 3, mode: 'b' });
  assert.equal(BS.run('demo', { n: 7 }).stats[0].value, 7);
  assert.equal(BS.run('demo', { n: 7 }).mode, 'b');
});

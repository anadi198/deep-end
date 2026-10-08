import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
require('../sims/deadlock.js');
const run = (p) => BS.run('deadlock', p).out;

test('deadlock: locking rows in the order each request names them deadlocks', () => {
  const o = run({ order: 'request' });
  assert.ok(o.deadlocks > 0, `deadlocks ${o.deadlocks}`);
});

test('deadlock: locking rows in one global order never deadlocks', () => {
  assert.equal(run({ order: 'sorted' }).deadlocks, 0);
  assert.equal(run({ order: 'sorted', hot: true }).deadlocks, 0);
});

test('deadlock: each deadlock costs at least deadlock_timeout, so sorted order commits more', () => {
  assert.ok(run({ order: 'sorted' }).committed > run({ order: 'request' }).committed);
});

test('deadlock: the story shows a waits-for cycle and the victim aborting with 40P01', () => {
  const r = BS.run('deadlock', { order: 'request' });
  const text = r.story.steps.map((s) => s.what).join(' ');
  assert.match(text, /waits for/);
  assert.match(text, /40P01/);
});

test('deadlock: one worker can never deadlock', () => {
  assert.equal(run({ order: 'request', workers: 1 }).deadlocks, 0);
});

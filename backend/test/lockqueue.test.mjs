import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
require('../sims/lockqueue.js');
const run = (p) => BS.run('lockqueue', p).out;

test('lockqueue: an instant ALTER queued behind a long query blocks every query that arrives after it', () => {
  const o = run({ alter: 'instant', long: true, lockTimeout: 'none' });
  assert.ok(o.errors > 5000, `errors ${o.errors}`);
  assert.ok(o.stall >= 30, `stall ${o.stall}`);
  assert.ok(o.doneAt >= 42, 'the ALTER itself only runs once the long query ends');
});

test('lockqueue: with no long query in the way, the same ALTER is invisible', () => {
  const o = run({ alter: 'instant', long: false, lockTimeout: 'none' });
  assert.equal(o.errors, 0);
  assert.ok(o.doneAt < 11);
});

test('lockqueue: a short lock_timeout with retries keeps traffic flowing and still lands the ALTER', () => {
  const o = run({ alter: 'instant', long: true, lockTimeout: '200ms' });
  assert.equal(o.errors, 0);
  assert.ok(o.attempts > 1);
  assert.ok(o.doneAt !== null);
});

test('lockqueue: a 2 s lock_timeout is too long: each attempt still exhausts the pool', () => {
  const o = run({ alter: 'instant', long: true, lockTimeout: '2s' });
  assert.ok(o.errors > 0 && o.errors < run({ alter: 'instant', long: true, lockTimeout: 'none' }).errors);
});

test('lockqueue: a rewriting ALTER holds the exclusive lock for the whole rewrite, whatever the timeout', () => {
  assert.ok(run({ alter: 'rewrite', long: false, lockTimeout: '200ms' }).errors > 10000);
});

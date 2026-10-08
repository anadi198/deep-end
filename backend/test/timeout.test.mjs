import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
require('../sims/timeout.js');
const run = (p) => BS.run('timeout', p);
const stat = (r, key) => r.out[key];

test('timeout: no retries never double-charges, but some users are charged and shown an error', () => {
  const r = run({ mode: 'none' });
  assert.equal(stat(r, 'double'), 0);
  assert.ok(stat(r, 'chargedButError') > 0, 'a timeout is not a failure: the server finished the charge');
});

test('timeout: retries without an idempotency key double-charge', () => {
  assert.ok(stat(run({ mode: 'retry' }), 'double') > 0);
});

test('timeout: retries with an idempotency key never double-charge', () => {
  const r = run({ mode: 'key' });
  assert.equal(stat(r, 'double'), 0);
  assert.ok(stat(r, 'chargedButError') < stat(run({ mode: 'none' }), 'chargedButError'));
});

test('timeout: propagating the deadline cuts the work done for callers that already gave up', () => {
  assert.ok(stat(run({ mode: 'deadline' }), 'wasted') < stat(run({ mode: 'key' }), 'wasted'));
  assert.equal(stat(run({ mode: 'deadline' }), 'double'), 0);
});

test('timeout: a client timeout above the slow path means no timeouts at all', () => {
  const r = run({ mode: 'retry', timeout: 5000, slowMs: 3000 });
  assert.equal(stat(r, 'timeouts'), 0);
  assert.equal(stat(r, 'double'), 0);
});

test('timeout: deterministic', () => {
  assert.deepEqual(run({ mode: 'retry' }).out, run({ mode: 'retry' }).out);
});

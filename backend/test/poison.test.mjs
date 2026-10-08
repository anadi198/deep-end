import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
require('../sims/poison.js');
const run = (strategy, outage = true) => BS.run('poison', { strategy, outage }).out;

test('poison: retrying in place forever blocks the partition behind the first poison message', () => {
  const o = run('forever', false);
  assert.ok(o.endLag > 3000, `lag ${o.endLag}`);
  assert.equal(o.processed < 1000, true);
});

test('poison: skipping failures keeps the lag low but silently loses every message that failed during the outage', () => {
  const o = run('skip');
  assert.ok(o.lost > 500, `lost ${o.lost}`);
  assert.ok(o.endLag < 50);
});

test('poison: bounded in-place retries then a DLQ flood the DLQ with healthy messages during an outage', () => {
  const o = run('inplace');
  assert.ok(o.dlqHealthy > 0, 'healthy messages ended up in the DLQ');
  assert.equal(o.lost, 0);
});

test('poison: retry topics keep the partition moving but process some keys out of order', () => {
  const o = run('retrytopic');
  assert.ok(o.reordered > 0);
  assert.ok(o.maxLag < run('inplace').maxLag);
});

test('poison: classifying errors sends only the poison to the DLQ, loses nothing, and keeps order', () => {
  const o = run('classify');
  assert.equal(o.dlq, 2);
  assert.equal(o.dlqHealthy, 0);
  assert.equal(o.lost, 0);
  assert.equal(o.reordered, 0);
  assert.ok(o.endLag < 50);
});

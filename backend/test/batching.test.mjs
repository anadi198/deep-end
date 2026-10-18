import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
const B = require('../sims/batching.js');
const run = (p) => BS.run('batching', p).out;

test('batching: under load, a few ms of linger fills batches, cuts requests, and costs no latency', () => {
  const a = run({ linger: 0, batch: 65536, compression: 'none', load: 200000 });
  const b = run({ linger: 5, batch: 65536, compression: 'none', load: 200000 });
  assert.equal(a.throughput, 200000);
  assert.equal(b.throughput, 200000);
  assert.ok(b.recordsPerBatch > 2 * a.recordsPerBatch);
  assert.ok(b.requests < a.requests / 2);
  assert.ok(b.p50 <= a.p50 + 1, `linger 5: ${b.p50} ms vs linger 0: ${a.p50} ms`);
});

test('batching: at light load, linger only adds latency', () => {
  const a = run({ linger: 0, batch: 16384, compression: 'none', load: 1000 });
  const b = run({ linger: 100, batch: 16384, compression: 'none', load: 1000 });
  assert.equal(a.throughput, b.throughput);
  assert.ok(b.p50 > a.p50 + 40);
});

test('batching: a small batch.size caps the batch, so linger stops helping', () => {
  const small = run({ linger: 20, batch: 16384, compression: 'none', load: 200000 });
  const big = run({ linger: 20, batch: 262144, compression: 'none', load: 200000 });
  assert.equal(small.recordsPerBatch, 16);
  assert.ok(big.recordsPerBatch > small.recordsPerBatch * 4);
});

test('batching: compression shrinks bytes on the wire and lifts the network ceiling', () => {
  const none = run({ linger: 20, batch: 262144, compression: 'none', load: 400000 });
  const zstd = run({ linger: 20, batch: 262144, compression: 'zstd', load: 400000 });
  assert.equal(none.bottleneck, 'network');
  assert.ok(none.throughput < 400000);
  assert.ok(zstd.wireMBs < none.wireMBs / 2);
  assert.equal(zstd.throughput, 400000);
});

test('batching: a batch closes when it is full or when linger runs out, whichever is first', () => {
  assert.equal(B.batchWait(1000, 10, 5, 1024, 1), 5);
  assert.equal(B.batchWait(16384, 1e6, 100, 1024, 1), 16384 / 1024 / 1e6 * 1000);
});

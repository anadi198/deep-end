import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
require('../sims/stampede.js');
const hot = (protect, extra) => BS.run('stampede', { scenario: 'hot', protect, ...extra }).out;

test('stampede: with no protection, every request in the rebuild window queries the database', () => {
  const o = hot('none');
  assert.ok(o.queries >= 500, `queries ${o.queries}`);   // 2,000 req/s × a 300 ms rebuild, and the rebuild slows under load
  assert.ok(o.peakDb > 50, 'more than the database can run at once');
});

test('stampede: single-flight per instance sends one query per instance', () => {
  assert.equal(hot('local').queries, 10);
});

test('stampede: a distributed lock sends one query, but everyone waits for it', () => {
  const o = hot('lock');
  assert.equal(o.queries, 1);
  assert.ok(o.waited > 400);
});

test('stampede: stale-while-revalidate sends one query and nobody waits', () => {
  const o = hot('swr');
  assert.equal(o.queries, 1);
  assert.equal(o.waited, 0);
  assert.ok(o.stale > 0);
});

test('stampede: probabilistic early refresh rebuilds before expiry, so nobody waits or sees stale data', () => {
  const o = hot('early');
  assert.ok(o.queries >= 1 && o.queries <= 3, `queries ${o.queries}`);
  assert.equal(o.waited, 0);
  assert.equal(o.stale, 0);
});

test('stampede: many keys with the same TTL expire together; jitter spreads the rebuilds', () => {
  const same = BS.run('stampede', { scenario: 'mass', jitter: false }).out;
  const jit = BS.run('stampede', { scenario: 'mass', jitter: true }).out;
  assert.ok(same.peakQps > 2 * jit.peakQps, `${same.peakQps} vs ${jit.peakQps}`);
});

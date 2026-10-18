import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HL = require('../highlight.js');

test('sql: keywords, strings, numbers and comments are marked; case is kept', () => {
  const h = HL.sql("select id FROM orders WHERE status = 'paid' AND total > 100; -- big ones");
  assert.match(h, /<span class="tok-k">select<\/span>/);
  assert.match(h, /<span class="tok-k">FROM<\/span>/);
  assert.match(h, /<span class="tok-s">&#39;paid&#39;<\/span>/);
  assert.match(h, /<span class="tok-n">100<\/span>/);
  assert.match(h, /<span class="tok-c">-- big ones<\/span>/);
  assert.doesNotMatch(h, /tok-k">orders/);
});

test('java: keywords and annotations are marked', () => {
  const h = HL.java('@Transactional\npublic void pay(String key) { return; }');
  assert.match(h, /<span class="tok-a">@Transactional<\/span>/);
  assert.match(h, /<span class="tok-k">public<\/span>/);
  assert.match(h, /<span class="tok-t">String<\/span>/);
});

test('code: picks the highlighter by language and escapes anything else', () => {
  assert.equal(HL.code('<b>', 'text'), '&lt;b&gt;');
  assert.match(HL.code('SELECT 1', 'sql'), /tok-k/);
});

test('props: comments, keys and values of a .properties file are marked', () => {
  const h = HL.props('# producer\nacks=all\nlinger.ms = 20\nbootstrap.servers=b1:9092');
  assert.match(h, /<span class="tok-c"># producer<\/span>/);
  assert.match(h, /<span class="tok-t">acks<\/span>=<span class="tok-s">all<\/span>/);
  assert.match(h, /<span class="tok-t">linger.ms<\/span> = <span class="tok-n">20<\/span>/);
  assert.match(h, /<span class="tok-s">b1:9092<\/span>/);
  assert.match(HL.code('a=1', 'properties'), /tok-t/);
});

test('proto: keywords, scalar types, numbers and comments of a .proto file are marked', () => {
  const h = HL.proto('message Payment {\n  reserved 3;\n  int64 amount = 2; // cents\n  repeated string tags = 4;\n}');
  assert.match(h, /<span class="tok-k">message<\/span>/);
  assert.match(h, /<span class="tok-k">reserved<\/span>/);
  assert.match(h, /<span class="tok-t">int64<\/span>/);
  assert.match(h, /<span class="tok-n">2<\/span>/);
  assert.match(h, /<span class="tok-c">\/\/ cents<\/span>/);
  assert.match(HL.code('rpc Pay(A) returns (B);', 'proto'), /<span class="tok-k">rpc<\/span>/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HL = require('../highlight.js');

test('rust: a char literal is a string token, a lifetime is its own token', () => {
  const h = HL.rust("let c = 'a'; fn f<'a>(x: &'a str) {}");
  assert.match(h, /<span class="tok-s">&#39;a&#39;<\/span>/);
  assert.match(h, /<span class="tok-l">&#39;a<\/span>&gt;/);
  assert.match(h, /&amp;<span class="tok-l">&#39;a<\/span> <span class="tok-k">str<\/span>/);
});

test('rust: keywords, types, macros, attributes, numbers, comments', () => {
  const h = HL.rust('#[derive(Debug)]\npub struct Ack { id: u32 } // note\nprintln!("{}", 0x1c_u8);');
  assert.match(h, /^<span class="tok-a">#\[derive\(Debug\)\]<\/span>/);
  assert.match(h, /<span class="tok-k">pub<\/span> <span class="tok-k">struct<\/span> <span class="tok-t">Ack<\/span>/);
  assert.match(h, /<span class="tok-k">u32<\/span>/);
  assert.match(h, /<span class="tok-c">\/\/ note<\/span>/);
  assert.match(h, /<span class="tok-m">println!<\/span>/);
  assert.match(h, /<span class="tok-n">0x1c_u8<\/span>/);
});

test('rust: not-equal is not a macro, and html is escaped', () => {
  const h = HL.rust('if a != b { x < y }');
  assert.doesNotMatch(h, /tok-m/);
  assert.match(h, /!= b/);
  assert.match(h, /x &lt; y/);
});

test('rust: byte strings and raw strings', () => {
  const h = HL.rust('let a = b"MSH"; let r = r#"a"b"#;');
  assert.match(h, /<span class="tok-s">b&quot;MSH&quot;<\/span>/);
  assert.match(h, /<span class="tok-s">r#&quot;a&quot;b&quot;#<\/span>/);
});

test('cpp: keywords, preprocessor lines, strings, numbers and comments', () => {
  const h = HL.cpp('#include <vector>\nint main() { auto v = std::vector<int>{1, 2}; // two\n  const char* s = "a<b"; return 0u; }');
  assert.match(h, /^<span class="tok-a">#include &lt;vector&gt;<\/span>/);
  assert.match(h, /<span class="tok-k">int<\/span> main/);
  assert.match(h, /<span class="tok-k">auto<\/span>/);
  assert.match(h, /<span class="tok-c">\/\/ two<\/span>/);
  assert.match(h, /<span class="tok-s">&quot;a&lt;b&quot;<\/span>/);
  assert.match(h, /<span class="tok-n">0u<\/span>/);
  assert.match(h, /<span class="tok-k">const<\/span> <span class="tok-k">char<\/span>\*/);
  assert.doesNotMatch(HL.cpp('a #b'), /tok-a/, 'a # in the middle of a line is not a directive');
});

test('rustc output: headers, arrows and help lines get classes', () => {
  const h = HL.rustc('error[E0382]: borrow of moved value: `s`\n --> src/main.rs:5:16\n  |\nhelp: consider cloning\nwarning: unused variable');
  assert.match(h, /<span class="rc-err">error\[E0382\]<\/span>: borrow of moved value: `s`/);
  assert.match(h, /<span class="rc-dim"> --&gt; src\/main.rs:5:16<\/span>/);
  assert.match(h, /<span class="rc-help">help<\/span>: consider cloning/);
  assert.match(h, /<span class="rc-warn">warning<\/span>: unused variable/);
});

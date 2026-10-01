import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const H = require('../harness.js');

test('hidden lines: "# " lines compile but do not show', () => {
  const src = '# use std::fmt;\nlet x = 1;\n#\nprintln!("{x}");';
  const r = H.splitHidden(src);
  assert.equal(r.shown, 'let x = 1;\nprintln!("{x}");');
  assert.equal(r.full, 'use std::fmt;\nlet x = 1;\n\nprintln!("{x}");');
});

test('hidden lines: attributes like #[derive] stay visible', () => {
  const src = '#[derive(Debug)]\nstruct A;\n#![allow(unused)]';
  const r = H.splitHidden(src);
  assert.equal(r.shown, src);
  assert.equal(r.full, src);
});

test('program: wraps a snippet without fn main', () => {
  assert.equal(H.programOf('let x = 1;'), 'fn main() {\nlet x = 1;\n}\n');
});

test('program: leaves a snippet with fn main alone', () => {
  const src = 'fn main() {\n    println!("hi");\n}';
  assert.equal(H.programOf(src), src + '\n');
});

test('program: keeps use lines and items outside the wrapper', () => {
  const src = 'use std::collections::HashMap;\nlet m: HashMap<u8, u8> = HashMap::new();';
  assert.equal(H.programOf(src), 'use std::collections::HashMap;\nfn main() {\nlet m: HashMap<u8, u8> = HashMap::new();\n}\n');
});

test('test crate: your code first, tests appended, line numbers unchanged', () => {
  const user = 'pub fn add(a: u8, b: u8) -> u8 {\n    a + b\n}\n\n';
  const r = H.buildTestCrate(user, [{ name: 'adds', code: 'assert_eq!(add(1, 2), 3);' }, { name: 'zero', code: 'assert_eq!(add(0, 0), 0);' }]);
  assert.equal(r.userLines, 3);
  assert.ok(r.code.startsWith('pub fn add(a: u8, b: u8) -> u8 {\n    a + b\n}\n'));
  assert.match(r.code, /#\[cfg\(test\)\]\nmod tests \{/);
  assert.match(r.code, /use super::\*;/);
  assert.match(r.code, /#\[test\]\n\s*fn t0\(\) \{\n\s*assert_eq!\(add\(1, 2\), 3\);/);
  assert.match(r.code, /fn t1\(\) \{/);
});

test('test crate: async tests run on tokio', () => {
  const r = H.buildTestCrate('pub async fn one() -> u8 { 1 }', [{ name: 'a', code: 'assert_eq!(one().await, 1);', async: true }]);
  assert.match(r.code, /#\[tokio::test\]\n\s*async fn t0\(\) \{/);
});

const fixture = (name) => JSON.parse(require('node:fs').readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8'));

test('libtest: pass, unwrap panic with output, assertion with message', () => {
  const { stdout } = fixture('libtest-mixed.json');
  const r = H.parseLibtest(stdout, 4);
  assert.equal(r[0].status, 'pass');
  assert.equal(r[1].status, 'fail');
  assert.equal(r[1].msg, 'called `Option::unwrap()` on a `None` value');
  assert.deepEqual(r[1].stdout, ['checking empty']);
  assert.equal(r[1].line, 9);
  assert.equal(r[2].status, 'fail');
  assert.equal(r[2].msg, 'assertion `left == right` failed: first byte of the frame\n  left: 1\n right: 2');
  assert.deepEqual(r[2].stdout, []);
  assert.equal(r[3].status, 'skip');
});

test('libtest: older panic line without a thread id', () => {
  const out = 'running 1 test\ntest tests::t0 ... FAILED\n\nfailures:\n\n---- tests::t0 stdout ----\nthread \'tests::t0\' panicked at src/lib.rs:3:5:\nboom\nnote: run with `RUST_BACKTRACE=1` environment variable to display a backtrace\n\n\nfailures:\n    tests::t0\n';
  const r = H.parseLibtest(out, 1);
  assert.equal(r[0].msg, 'boom');
  assert.equal(r[0].line, 3);
});

const D = fixture('diagnostics.json');

test('diagnostics: two errors and a warning, with codes and positions', () => {
  const ds = H.parseDiagnostics(D.two.stderr);
  assert.equal(ds.length, 3);
  assert.deepEqual(ds.map((d) => [d.severity, d.code, d.line, d.col]), [['error', 'E0382', 5, 16], ['error', 'E0502', 8, 5], ['warning', 'unused_variables', 2, 9]]);
  assert.equal(ds[0].message, 'borrow of moved value: `s`');
  assert.match(ds[0].text, /^error\[E0382\]: borrow of moved value/);
  assert.match(ds[0].text, /let t = s\.clone\(\);\n\s+\|\s+\+\+\+\+\+\+\+\+$/);
  assert.doesNotMatch(ds[1].text, /warning/);
});

test('diagnostics: clippy lint names', () => {
  const ds = H.parseDiagnostics(D.clippy.stderr);
  assert.deepEqual(ds.map((d) => d.code), ['clippy::needless_return', 'clippy::ptr_arg']);
});

test('clean stderr: drops cargo progress and summary lines', () => {
  const c = H.cleanStderr(D.two.stderr);
  assert.doesNotMatch(c, /Compiling playground|could not compile|generated \d+ warning|For more information/);
  assert.match(c, /^error\[E0382\]/);
  assert.equal(H.cleanStderr(D.panic.stderr), "thread 'main' panicked at src/main.rs:4:14:\nindex out of bounds: the len is 0 but the index is 3");
});

test('outcome: compile error, panic, ok, timeout', () => {
  assert.equal(H.outcome(D.two).kind, 'compile-error');
  const p = H.outcome(D.panic);
  assert.equal(p.kind, 'panic');
  assert.equal(p.stdout, 'before\n');
  assert.equal(p.panic, 'index out of bounds: the len is 0 but the index is 3');
  assert.equal(H.outcome(D.clippy).kind, 'ok');
  assert.equal(H.outcome({ success: true, exitDetail: 'Exited with status 0', stdout: 'hi\n', stderr: '' }).kind, 'ok');
  assert.equal(H.outcome(D.loop).kind, 'timeout');
});

test('predict: compile error option, with the error code checked', () => {
  const p = { options: ['It compiles', 'Compile error'], answer: 1, error: 'E0382' };
  assert.deepEqual(H.checkPredict(p, H.outcome(D.two)), { ok: true, actual: 'Compile error' });
  assert.equal(H.checkPredict({ ...p, error: 'E0499' }, H.outcome(D.two)).ok, false);
  assert.equal(H.checkPredict({ ...p, answer: 0 }, H.outcome(D.two)).ok, false);
});

test('predict: panic option', () => {
  const p = { options: ['0', 'It panics', 'Compile error'], answer: 1 };
  assert.deepEqual(H.checkPredict(p, H.outcome(D.panic)), { ok: true, actual: 'It panics' });
});

test('predict: printed output must match the chosen option exactly (trimmed)', () => {
  const ok = { success: true, exitDetail: 'Exited with status 0', stdout: 'b\na\n', stderr: '' };
  assert.equal(H.checkPredict({ options: ['a\nb', 'b\na'], answer: 1 }, H.outcome(ok)).ok, true);
  const bad = H.checkPredict({ options: ['a\nb', 'b\na'], answer: 0 }, H.outcome(ok));
  assert.deepEqual(bad, { ok: false, actual: 'b\na' });
  assert.equal(H.checkPredict({ options: ['It compiles', 'Compile error'], answer: 0 }, H.outcome(ok)).ok, true);
});

const PR = [
  'use std::sync::Arc;',
  '+pub fn size(buf: &[u8]) -> usize {',
  '+    let end = buf.iter().position(|b| *b == 0x1c).unwrap(); ⟦a⟧',
  '+    let shared = Arc::new(end); ⟦d1⟧',
  '+    let _ = std::fs::write("/tmp/x", buf);  ⟦b⟧',
  '+',
  '+    *shared',
  '+}',
].join('\n');

test('review: + marks added lines, ⟦id⟧ tags are stripped and indexed', () => {
  const r = H.parseReview(PR);
  assert.equal(r.code, 'use std::sync::Arc;\npub fn size(buf: &[u8]) -> usize {\n    let end = buf.iter().position(|b| *b == 0x1c).unwrap();\n    let shared = Arc::new(end);\n    let _ = std::fs::write("/tmp/x", buf);\n\n    *shared\n}');
  assert.deepEqual(r.lines.map((l) => l.added), [false, true, true, true, true, true, true, true]);
  assert.deepEqual(r.marks, { a: [3], d1: [4], b: [5] });
});

test('review: "# " lines compile but are neither shown nor numbered', () => {
  const r = H.parseReview([
    'use crate::tonic::Status;',
    '+pub fn f() -> Status { Status } ⟦a⟧',
    '# pub mod tonic {',
    '#     pub struct Status;',
    '# }',
  ].join('\n'));
  assert.deepEqual(r.lines.map((l) => [l.n, l.text]), [[1, 'use crate::tonic::Status;'], [2, 'pub fn f() -> Status { Status }']]);
  assert.deepEqual(r.marks, { a: [2] });
  assert.equal(r.code, 'use crate::tonic::Status;\npub fn f() -> Status { Status }\npub mod tonic {\n    pub struct Status;\n}');
});

test('review: grading finds, tag matches, false alarms and decoys', () => {
  const x = { issues: [{ id: 'a', tag: 'panic' }, { id: 'b', tag: 'swallow' }], decoys: [{ id: 'd1' }] };
  const r = H.parseReview(PR);
  const g = H.gradeReview(x, r, { 3: 'panic', 4: 'cost', 7: 'logic' });
  assert.deepEqual(g.issues.map((i) => [i.id, i.found, i.tagOk]), [['a', true, true], ['b', false, false]]);
  assert.deepEqual(g.falseAlarms, [{ n: 4, decoy: 'd1' }, { n: 7, decoy: null }]);
  assert.equal(g.found, 1);
  assert.equal(g.done, false);
  const all = H.gradeReview(x, r, { 3: 'logic', 5: 'swallow' });
  assert.equal(all.done, true);
  assert.deepEqual(all.issues.map((i) => i.tagOk), [false, true]);
});

test('request: run, test and clippy bodies for the Playground', () => {
  assert.deepEqual(H.request('run', 'fn main() {}'), { endpoint: 'execute', body: { channel: 'stable', mode: 'debug', edition: '2024', crateType: 'bin', tests: false, backtrace: false, code: 'fn main() {}' } });
  assert.deepEqual(H.request('test', 'pub fn a() {}'), { endpoint: 'execute', body: { channel: 'stable', mode: 'debug', edition: '2024', crateType: 'lib', tests: true, backtrace: false, code: 'pub fn a() {}' } });
  assert.deepEqual(H.request('clippy', 'pub fn a() {}'), { endpoint: 'clippy', body: { channel: 'stable', edition: '2024', crateType: 'lib', code: 'pub fn a() {}' } });
  assert.equal(H.request('clippy', 'fn main() {}').body.crateType, 'bin');
});

test('key: stable per kind and code', () => {
  const a = H.key('run', 'fn main() {}');
  assert.match(a, /^run:[0-9a-f]{16}$/);
  assert.equal(a, H.key('run', 'fn main() {}'));
  assert.notEqual(a, H.key('clippy', 'fn main() {}'));
  assert.notEqual(a, H.key('run', 'fn main() { }'));
  assert.notEqual(H.key('run', 'é'), H.key('run', 'è'));
});

test('fences: finds flagged rust fences in an indented body, with labels', () => {
  const body = `
        ## Moves

        ~~~rust !fail after a move
        let s = String::from("a");
        # let t = s;
        ~~~

        ~~~rust
        display only
        ~~~

        ~~~java
        String s = "a";
        ~~~

        ~~~rust !run
        println!("hi");
        ~~~
  `;
  const fs = H.fences(body);
  assert.deepEqual(fs.map((f) => [f.flag, f.label]), [['fail', 'after a move'], ['run', '']]);
  assert.equal(fs[0].src, 'let s = String::from("a");\n# let t = s;');
  assert.deepEqual(H.fenceInfo('rust !clippy what clippy says'), { lang: 'rust', flag: 'clippy', label: 'what clippy says' });
  assert.deepEqual(H.fenceInfo('rust Given'), { lang: 'rust', flag: null, label: 'Given' });
});

test('snippet: key and program agree between the page and the build', () => {
  const s = H.snippet('fail', 'let s = 1;\n# let t = s;');
  assert.equal(s.program, 'fn main() {\nlet s = 1;\nlet t = s;\n}\n');
  assert.equal(s.shown, 'let s = 1;');
  assert.equal(s.kind, 'run');
  assert.equal(s.key, H.key('run', s.program));
  assert.equal(H.snippet('clippy', 'fn main() {}').kind, 'clippy');
});

test('key: an early difference still changes both halves', () => {
  const a = H.key('run', 'a' + 'x'.repeat(60)), b = H.key('run', 'b' + 'x'.repeat(60));
  assert.notEqual(a.slice(4, 12), b.slice(4, 12));
  assert.notEqual(a.slice(12), b.slice(12));
});

test('clean stderr: shortens the Playground toolchain path in std panics', () => {
  const s = "thread 'main' (7) panicked at /playground/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/lib/rustlib/src/rust/library/core/src/iter/traits/accum.rs:206:1:\nattempt to add with overflow";
  assert.equal(H.cleanStderr(s), "thread 'main' panicked at (std) core/src/iter/traits/accum.rs:206:1:\nattempt to add with overflow");
});

test('outcome: a panicking thread in a program that exits cleanly is ok, with its stderr kept apart', () => {
  const o = H.outcome(D.threadPanic);
  assert.equal(o.kind, 'ok');
  assert.equal(o.stdout, 'crashed: true\n');
  assert.match(o.build, /^warning: unused variable: `unused`/);
  assert.doesNotMatch(o.build, /panicked/);
  assert.equal(o.err, "thread '<unnamed>' panicked at src/main.rs:4:77:\nindex out of bounds: the len is 0 but the index is 0\ndone");
});

test('record: what the page stores for a snippet', () => {
  assert.deepEqual(H.record(H.outcome(D.panic)), { k: 'panic', o: 'before\n', t: '', e: "thread 'main' panicked at src/main.rs:4:14:\nindex out of bounds: the len is 0 but the index is 3" });
  const c = H.record(H.outcome(D.two));
  assert.equal(c.k, 'compile-error');
  assert.match(c.t, /^error\[E0382\]/);
  assert.equal(c.e, '');
  assert.match(H.record(H.outcome(D.threadPanic)).t, /unused variable/);
});

test('predict: "It hangs" matches a run the Playground stopped', () => {
  const p = { options: ['0', 'It hangs', 'It panics'], answer: 1 };
  assert.deepEqual(H.checkPredict(p, H.outcome(D.loop)), { ok: true, actual: 'It hangs' });
  assert.equal(H.checkPredict(p, H.outcome(D.panic)).ok, false);
  assert.equal(H.checkPredict({ ...p, answer: 2 }, H.outcome(D.loop)).ok, false);
});

test('test crate: multi-threaded and paused-time async tests', () => {
  const r = H.buildTestCrate('pub fn a() {}', [{ name: 'm', code: 'a();', async: 'multi' }, { name: 'p', code: 'a();', async: 'paused' }]);
  assert.match(r.code, /#\[tokio::test\(flavor = "multi_thread", worker_threads = 2\)\]\n\s*async fn t0\(\)/);
  assert.match(r.code, /#\[tokio::test\(start_paused = true\)\]\n\s*async fn t1\(\)/);
});

test('fences: !hang is a flag', () => {
  assert.deepEqual(H.fenceInfo('rust !hang waits forever'), { lang: 'rust', flag: 'hang', label: 'waits forever' });
});

test('cpp fences: run, asan, check and fail fences are found; rust and unflagged ones are not', () => {
  const body = `
        ~~~cpp !asan the same in C++
        int main() {}
        ~~~

        ~~~cpp
        display only
        ~~~

        ~~~rust !run
        println!("hi");
        ~~~

        ~~~cpp !check
        struct Frame { int id; };
        ~~~
  `;
  const fs = H.cppFences(body);
  assert.deepEqual(fs.map((f) => [f.flag, f.label]), [['asan', 'the same in C++'], ['check', '']]);
  assert.equal(fs[1].src, 'struct Frame { int id; };');
  assert.equal(H.fences(body).length, 1, 'the rust fence list is unchanged');
});

test('cpp request: headers by -include, execution only for run and asan, sanitizers only for asan', () => {
  const run = H.cppRequest('run', 'int main() {}');
  assert.match(run.url, /^https:\/\/godbolt\.org\/api\/compiler\/g\d+\/compile$/);
  assert.equal(run.body.source, 'int main() {}');
  assert.match(run.body.options.userArguments, /-std=c\+\+23/);
  assert.match(run.body.options.userArguments, /-include vector/);
  assert.equal(run.body.options.filters.execute, true);
  assert.doesNotMatch(run.body.options.userArguments, /sanitize/);
  assert.match(H.cppRequest('asan', 'int main() {}').body.options.userArguments, /-fsanitize=address,undefined/);
  assert.equal(H.cppRequest('check', 'struct A {};').body.options.filters.execute, false);
  assert.equal(H.cppRequest('fail', 'struct A {};').body.options.filters.execute, false);
});

const G = {
  compileError: { code: 1, stderr: [{ text: '<source>: In function \'int main()\':' }, { text: '<source>:3:5: \u001b[01;31merror: \u001b[m\'x\' was not declared in this scope' }], stdout: [] },
  compiledOnly: { code: 0, stderr: [], stdout: [] },
  ran: { code: 0, stderr: [], execResult: { code: 0, buildResult: { code: 0 }, stdout: [{ text: '[] [lab-a]' }, { text: '-2147483648' }], stderr: [] } },
  asan: { code: 0, stderr: [], execResult: { code: 1, buildResult: { code: 0 }, stdout: [], stderr: [
    { text: '=================================================================' },
    { text: '\u001b[1m\u001b[31m==2==ERROR: AddressSanitizer: heap-use-after-free on address 0x72e2185e0010 at pc 0x000000401494 bp 0x7fffbbc36540 sp 0x7fffbbc36538' },
    { text: 'READ of size 4 at 0x72e2185e0010 thread T0' },
    { text: '    #0 0x000000401493 in main /app/example.cpp:7' },
    { text: 'SUMMARY: AddressSanitizer: heap-use-after-free /app/example.cpp:7 in main' },
  ] } },
  ubsan: { code: 0, stderr: [], execResult: { code: 0, buildResult: { code: 0 }, stdout: [{ text: '-2147483648' }], stderr: [
    { text: '/app/example.cpp:3:7: runtime error: signed integer overflow: 2147483647 + 1 cannot be represented in type \'int\'' },
  ] } },
};

test('cpp outcome: compile error, compile only, a clean run, and sanitizer reports', () => {
  const ce = H.cppOutcome(G.compileError);
  assert.equal(ce.kind, 'compile-error');
  assert.equal(ce.text, "In function 'int main()':\n3:5: error: 'x' was not declared in this scope");
  assert.equal(H.cppOutcome(G.compiledOnly).kind, 'ok');
  const ok = H.cppOutcome(G.ran);
  assert.deepEqual([ok.kind, ok.stdout], ['ok', '[] [lab-a]\n-2147483648\n']);
  const a = H.cppOutcome(G.asan);
  assert.equal(a.kind, 'sanitizer');
  assert.equal(a.text, 'AddressSanitizer: heap-use-after-free, in main at line 7');
  const u = H.cppOutcome(G.ubsan);
  assert.equal(u.kind, 'sanitizer', 'UBSan reports even when the program exits 0');
  assert.equal(u.text, "line 3: runtime error: signed integer overflow: 2147483647 + 1 cannot be represented in type 'int'");
  assert.equal(u.stdout, '-2147483648\n');
});

test('cpp outcome: the sanitizer location is the first frame in the snippet, named without its parameters', () => {
  const stack = (lines) => ({ code: 0, stderr: [], execResult: { code: 1, buildResult: { code: 0 }, stdout: [], stderr: lines.map((text) => ({ text })) } });
  const overflow = stack([
    '==1==ERROR: AddressSanitizer: stack-buffer-overflow on address 0x7ffd at pc 0x4011 bp 0x7ffd sp 0x7ffd',
    '    #0 0x401136 in byte_at(int const*, unsigned long) /app/example.cpp:2',
    '    #1 0x4011c5 in main /app/example.cpp:7',
    'Address 0x7ffd is located in stack of thread T0 at offset 48 in frame',
    '    #0 0x401150 in main /app/example.cpp:5',
  ]);
  assert.equal(H.cppOutcome(overflow).text, 'AddressSanitizer: stack-buffer-overflow, in byte_at at line 2');
  const viaLibrary = stack([
    '==1==ERROR: AddressSanitizer: heap-use-after-free on address 0x5020 at pc 0x7f12 bp 0x7ffd sp 0x7ffd',
    '    #0 0x7f12 in memcpy (/usr/lib/libasan.so.8+0x1234)',
    '    #1 0x7f13 in std::basic_ostream<char, std::char_traits<char> >& std::__ostream_insert<char, std::char_traits<char> >(std::basic_ostream<char, std::char_traits<char> >&, char const*, long) (/usr/lib/libstdc++.so.6+0x1)',
    '    #2 0x401200 in main /app/example.cpp:9',
  ]);
  assert.equal(H.cppOutcome(viaLibrary).text, 'AddressSanitizer: heap-use-after-free, in main at line 9');
});

test('cpp record: what the page stores', () => {
  assert.deepEqual(H.cppRecord(H.cppOutcome(G.ran)), { k: 'ok', o: '[] [lab-a]\n-2147483648\n', t: '', e: '' });
  assert.deepEqual(H.cppRecord(H.cppOutcome(G.compileError)), { k: 'compile-error', o: '', t: "In function 'int main()':\n3:5: error: 'x' was not declared in this scope", e: '' });
  assert.equal(H.cppRecord(H.cppOutcome(G.asan)).e, 'AddressSanitizer: heap-use-after-free, in main at line 7');
});

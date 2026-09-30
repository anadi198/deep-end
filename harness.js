/* Rust Lab harness: turns lesson snippets and exercises into Rust Playground requests, and reads
 * the compiler and test output back. Shared by the page and the build tools. */
(function (root) {
  'use strict';

  // mdBook convention: a line that is "#" or starts with "# " compiles but is not shown.
  const HIDDEN = /^\s*#(?: |$)/;
  function splitHidden(src) {
    const lines = String(src).replace(/\r/g, '').split('\n');
    return {
      shown: lines.filter((l) => !HIDDEN.test(l)).join('\n'),
      full: lines.map((l) => (HIDDEN.test(l) ? l.replace(/^(\s*)# ?/, '$1') : l)).join('\n'),
    };
  }

  // A snippet without fn main runs inside one. Leading use lines and inner attributes stay at crate level.
  function programOf(src) {
    const s = String(src).replace(/\s+$/, '');
    if (/\bfn\s+main\s*\(/.test(s)) return s + '\n';
    const lines = s.split('\n');
    let k = 0;
    while (k < lines.length && (/^\s*(?:use\s|#!\[|extern\s+crate\s)/.test(lines[k]) || (!lines[k].trim() && k > 0 && k < lines.length - 1))) k++;
    const head = lines.slice(0, k).join('\n');
    return (head ? head + '\n' : '') + 'fn main() {\n' + lines.slice(k).join('\n') + '\n}\n';
  }

  // Your code stays on top, so compiler line numbers point at your lines. Test k becomes fn t<k>.
  function buildTestCrate(userCode, tests) {
    const user = String(userCode).replace(/\r/g, '').replace(/\s+$/, '');
    const pad = (code) => String(code).replace(/\r/g, '').replace(/^\n+|\s+$/g, '').split('\n').map((l) => '        ' + l).join('\n');
    // async: true (tokio's default runtime), 'multi' (two worker threads) or 'paused' (time only moves when idle)
    const attr = (t) => (!t.async ? '#[test]' : t.async === 'multi' ? '#[tokio::test(flavor = "multi_thread", worker_threads = 2)]' : t.async === 'paused' ? '#[tokio::test(start_paused = true)]' : '#[tokio::test]');
    const fns = tests.map((t, k) => `    ${attr(t)}\n    ${t.async ? 'async ' : ''}fn t${k}() {\n${pad(t.code)}\n    }`).join('\n\n');
    return {
      code: `${user}\n\n#[cfg(test)]\nmod tests {\n    #![allow(unused)]\n    use super::*;\n\n${fns}\n}\n`,
      userLines: user.split('\n').length,
    };
  }

  // cargo test stdout → one result per test: { status: 'pass'|'fail'|'skip', msg, stdout: [], line }
  const PANIC = /^thread '[^']*'(?: \(\d+\))? panicked at src\/\w+\.rs:(\d+):\d+:$/;
  function parseLibtest(stdout, n) {
    const res = Array.from({ length: n }, () => ({ status: 'skip', stdout: [] }));
    const lines = String(stdout || '').replace(/\r/g, '').split('\n');
    for (const l of lines) {
      const m = /^test tests::t(\d+) \.\.\. (ok|FAILED|ignored)/.exec(l);
      if (m && +m[1] < n) res[+m[1]] = { status: m[2] === 'ok' ? 'pass' : m[2] === 'FAILED' ? 'fail' : 'skip', stdout: [] };
    }
    for (let i = 0; i < lines.length; i++) {
      const h = /^---- tests::t(\d+) stdout ----$/.exec(lines[i]);
      if (!h || +h[1] >= n) continue;
      const r = res[+h[1]];
      const out = [], msg = [];
      let inPanic = false;
      for (i++; i < lines.length && !/^---- tests::t\d+ stdout ----$/.test(lines[i]) && lines[i] !== 'failures:'; i++) {
        const p = PANIC.exec(lines[i]);
        if (p) { inPanic = true; r.line = +p[1]; continue; }
        if (inPanic) { if (/^note: run with `RUST_BACKTRACE/.test(lines[i])) inPanic = false; else msg.push(lines[i]); }
        else out.push(lines[i]);
      }
      i--;
      while (out.length && !out[out.length - 1].trim()) out.pop();
      while (msg.length && !msg[msg.length - 1].trim()) msg.pop();
      r.stdout = out;
      if (msg.length) r.msg = msg.join('\n');
    }
    return res;
  }

  // rustc/clippy stderr → [{ severity, code, message, file, line, col, text }]
  const HEAD = /^(error|warning)(?:\[(E\d{4})\])?: (.*)$/;
  const NOT_A_DIAG = /^(?:could not compile|aborting due to|build failed|`playground` \(|test failed, to rerun)/;
  const ENDS_BLOCK = /^(?:Some errors have detailed explanations|For more information about|\s*(?:Finished|Running|Compiling|Checking) )/;
  function parseDiagnostics(stderr) {
    const lines = String(stderr || '').replace(/\r/g, '').split('\n');
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const h = HEAD.exec(lines[i]);
      if (!h || NOT_A_DIAG.test(h[3])) continue;
      const block = [lines[i]];
      for (i++; i < lines.length && !HEAD.test(lines[i]) && !ENDS_BLOCK.test(lines[i]); i++) block.push(lines[i]);
      i--;
      while (block.length && !block[block.length - 1].trim()) block.pop();
      const text = block.join('\n');
      const at = /^\s*--> ([^:\s]+):(\d+):(\d+)/m.exec(text);
      const lint = /= note: `#\[(?:warn|deny|forbid)\(([\w:]+)\)\]`/.exec(text);
      out.push({ severity: h[1], code: h[2] || (lint ? lint[1] : null), message: h[3], file: at ? at[1] : null, line: at ? +at[2] : 0, col: at ? +at[3] : 0, text });
    }
    return out;
  }

  // What a person wants to read: no cargo progress lines, no run-to-run noise like thread ids.
  const NOISE = [
    /^\s*(?:Compiling|Checking|Finished|Running|Blocking|Downloaded|Downloading|Updating|Locking|Adding) /,
    /^error: (?:could not compile|test failed, to rerun)/, /^warning: `playground` \(/,
    /^(?:Some errors have detailed explanations|For more information about)/, /^note: run with `RUST_BACKTRACE/,
  ];
  function cleanStderr(stderr) {
    return String(stderr || '').replace(/\r/g, '').split('\n')
      .filter((l) => !NOISE.some((re) => re.test(l)))
      .map((l) => l.replace(/^(thread '[^']*') \(\d+\) panicked/, '$1 panicked').replace(/\/playground\/\.rustup\/toolchains\/[^/]+\/lib\/rustlib\/src\/rust\/library\//g, '(std) '))
      .join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\s*\n|\s+$/g, '');
  }

  // One Playground response → { kind: 'ok'|'compile-error'|'panic'|'exit'|'timeout'|'error', stdout, text, panic?, diags? }
  function outcome(resp) {
    if (!resp || resp.error) {
      const e = String((resp && resp.error) || 'no response');
      return { kind: /timed out|deadline/i.test(e) ? 'timeout' : 'error', stdout: '', text: e };
    }
    const stderr = String(resp.stderr || '');
    // cargo's own output ends at the "Running" line; after it comes whatever the program wrote to stderr
    const run = /^\s*Running [^\n]*\n?/m.exec(stderr);
    const r = {
      stdout: String(resp.stdout || ''), text: cleanStderr(stderr),
      build: cleanStderr(run ? stderr.slice(0, run.index) : stderr), err: run ? cleanStderr(stderr.slice(run.index + run[0].length)) : '',
    };
    const compiled = !!run || (/^\s*Finished /m.test(stderr) && resp.success);
    if (!compiled && /^error(?:\[E\d{4}\])?: /m.test(stderr)) return { ...r, kind: 'compile-error', diags: parseDiagnostics(stderr).filter((d) => d.severity === 'error') };
    const p = !resp.success && /panicked at [^\n]*:\n([\s\S]*?)(?:\nnote: run with `RUST_BACKTRACE|\s*$)/.exec(stderr);
    if (p) return { ...r, kind: 'panic', panic: p[1].replace(/\s+$/, '') };
    return { ...r, kind: resp.success ? 'ok' : 'exit' };
  }
  // What the page keeps for a snippet: kind, stdout, compiler text (errors or warnings), program stderr
  function record(o) {
    return { k: o.kind, o: o.stdout || '', t: (o.kind === 'compile-error' || o.kind === 'error' || o.kind === 'timeout' ? o.text : o.build) || '', e: o.err || '' };
  }

  // A predict question's options are printed output, or one of these outcomes.
  const COMPILE_ERROR = 'Compile error', PANICS = 'It panics', HANGS = 'It hangs';
  const RUNS = /^It (?:compiles|runs)\b/;
  function checkPredict(p, out) {
    const actual = out.kind === 'compile-error' ? COMPILE_ERROR : out.kind === 'panic' ? PANICS : out.kind === 'timeout' ? HANGS : out.stdout.replace(/\r/g, '').trim();
    const pick = String(p.options[p.answer]).trim();
    let ok;
    if (pick === COMPILE_ERROR) ok = out.kind === 'compile-error' && (!p.error || (out.diags || []).some((d) => d.code === p.error));
    else if (pick === PANICS) ok = out.kind === 'panic';
    else if (pick === HANGS) ok = out.kind === 'timeout';
    else if (RUNS.test(pick)) ok = out.kind === 'ok';
    else ok = out.kind === 'ok' && actual === pick;
    return { ok, actual };
  }

  // A review exercise's file: a leading "+" marks a line the PR added (as in a diff), and ⟦id⟧ or
  // ⟦id,id⟧ at the end of a line ties it to a planted issue or a decoy. Both are stripped.
  function parseReview(src) {
    const lines = [], marks = {};
    String(src).replace(/\r/g, '').replace(/^\n+|\s+$/g, '').split('\n').forEach((raw, k) => {
      const n = k + 1;
      const added = raw.startsWith('+');
      let text = added ? raw.slice(1) : raw;
      const m = /\s*⟦([\w,-]+)⟧\s*$/.exec(text);
      const ids = m ? m[1].split(',').filter(Boolean) : [];
      if (m) text = text.slice(0, m.index);
      text = text.replace(/\s+$/, '');
      for (const id of ids) (marks[id] || (marks[id] = [])).push(n);
      lines.push({ n, text, added, marks: ids });
    });
    return { code: lines.map((l) => l.text).join('\n'), lines, marks };
  }

  // flags: { lineNumber: tag } → which planted issues you found, and what else you flagged
  function gradeReview(x, parsed, flags) {
    const flagged = Object.keys(flags).map(Number).sort((a, b) => a - b);
    const issueLines = new Set();
    const issues = (x.issues || []).map((is) => {
      const lines = parsed.marks[is.id] || [];
      lines.forEach((n) => issueLines.add(n));
      const hit = lines.filter((n) => flags[n] !== undefined);
      return { id: is.id, lines, flagged: hit, found: hit.length > 0, tagOk: hit.some((n) => flags[n] === is.tag) };
    });
    const decoyIds = new Set((x.decoys || []).map((d) => d.id));
    const falseAlarms = flagged.filter((n) => !issueLines.has(n)).map((n) => {
      const line = parsed.lines[n - 1];
      return { n, decoy: (line && line.marks.find((id) => decoyIds.has(id))) || null };
    });
    const found = issues.filter((i) => i.found).length;
    return { issues, falseAlarms, found, total: issues.length, done: found === issues.length };
  }

  // Rust Playground (play.rust-lang.org) requests. It answers any origin, so the page calls it directly.
  const PLAY = { channel: 'stable', edition: '2024' };
  function request(kind, code) {
    if (kind === 'clippy') return { endpoint: 'clippy', body: { ...PLAY, crateType: /\bfn\s+main\s*\(/.test(code) ? 'bin' : 'lib', code } };
    const test = kind === 'test';
    return { endpoint: 'execute', body: { channel: PLAY.channel, mode: 'debug', edition: PLAY.edition, crateType: test ? 'lib' : 'bin', tests: test, backtrace: false, code } };
  }

  // Two independent 32-bit FNV-1a style hashes over UTF-16 code units: the same in node and the browser.
  // Both multipliers must be odd, or early characters get shifted out of the hash.
  function key(kind, code) {
    let h1 = 0x811c9dc5, h2 = 0x5bd1e995;
    const s = kind + '\u0000' + code;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ c, 0x27d4eb2d) >>> 0;
    }
    return kind + ':' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  }

  // Fence info string: "rust !run label" → { lang, flag, label }
  const FLAGS = new Set(['run', 'panic', 'fail', 'clippy', 'hang']);
  function fenceInfo(info) {
    const m = /^(\w*)\s*(?:!(\w+))?\s*(.*)$/.exec(String(info || '').trim());
    const flag = m[2] && FLAGS.has(m[2]) ? m[2] : null;
    return { lang: m[1] || '', flag, label: m[3] || '' };
  }
  function dedent(src) {
    const lines = String(src).replace(/\r/g, '').split('\n');
    const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => /^ */.exec(l)[0].length));
    return lines.map((l) => l.slice(Math.min(ind, /^ */.exec(l)[0].length)));
  }
  // Every flagged rust fence in a markdown body: [{ flag, label, src }]
  function fences(body) {
    const out = [];
    const Ls = dedent(body);
    for (let i = 0; i < Ls.length; i++) {
      const m = /^(?:```|~~~)(.*)$/.exec(Ls[i]);
      if (!m) continue;
      const buf = [];
      for (i++; i < Ls.length && !/^(?:```|~~~)\s*$/.test(Ls[i]); i++) buf.push(Ls[i]);
      const f = fenceInfo(m[1]);
      if (f.lang === 'rust' && f.flag) out.push({ flag: f.flag, label: f.label, src: buf.join('\n') });
    }
    return out;
  }
  // What the page shows, what the compiler gets, and the key its recorded output is stored under.
  function snippet(flag, src) {
    const h = splitHidden(src);
    const program = programOf(h.full);
    const kind = flag === 'clippy' ? 'clippy' : 'run';
    return { shown: h.shown, program, kind, key: key(kind, program) };
  }

  const api = { splitHidden, programOf, buildTestCrate, parseLibtest, parseDiagnostics, cleanStderr, outcome, record, checkPredict, COMPILE_ERROR, PANICS, HANGS, parseReview, gradeReview, request, key, fenceInfo, dedent, fences, snippet };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RustHarness = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

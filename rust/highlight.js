/* Rust Lab highlighting: Rust and Java source, and rustc's own output. Shared by the page and tests. */
(function (root) {
  'use strict';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const span = (cls, s) => `<span class="${cls}">${esc(s)}</span>`;

  /* ── Rust ── */
  const RUST_KW = new Set(('as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while '
    + 'u8 u16 u32 u64 u128 usize i8 i16 i32 i64 i128 isize f32 f64 bool char str').split(' '));
  const NUM_SUFFIX = '(?:_?(?:u8|u16|u32|u64|u128|usize|i8|i16|i32|i64|i128|isize|f32|f64))?';
  const RUST_RE = new RegExp([
    '(?<com>\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)',
    '(?<attr>#!?\\[[^\\]\\n]*\\])',
    '(?<raw>b?r(?<h>#*)"[\\s\\S]*?"\\k<h>)',
    '(?<str>b?"(?:[^"\\\\]|\\\\[\\s\\S])*")',
    "(?<chr>b?'(?:[^'\\\\\\n]|\\\\(?:x[0-9a-fA-F]{2}|u\\{[0-9a-fA-F]+\\}|.))')",
    "(?<life>'[A-Za-z_]\\w*)",
    `(?<num>\\b0x[0-9a-fA-F_]+${NUM_SUFFIX}\\b|\\b0[bo][0-7_]+${NUM_SUFFIX}\\b|\\b\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][+-]?\\d+)?${NUM_SUFFIX}\\b)`,
    '(?<mac>[A-Za-z_]\\w*!(?!=))',
    '(?<id>[A-Za-z_]\\w*)',
    '(?<other>[\\s\\S])',
  ].join('|'), 'g');
  function rust(src) {
    let out = '', m;
    RUST_RE.lastIndex = 0;
    while ((m = RUST_RE.exec(src))) {
      const g = m.groups;
      if (g.com) out += span('tok-c', g.com);
      else if (g.attr) out += span('tok-a', g.attr);
      else if (g.raw) out += span('tok-s', g.raw);
      else if (g.str) out += span('tok-s', g.str);
      else if (g.chr) out += span('tok-s', g.chr);
      else if (g.life) out += span('tok-l', g.life);
      else if (g.num) out += span('tok-n', g.num);
      else if (g.mac) out += span('tok-m', g.mac);
      else if (g.id) out += RUST_KW.has(g.id) ? span('tok-k', g.id) : /^[A-Z]/.test(g.id) ? span('tok-t', g.id) : esc(g.id);
      else out += esc(g.other);
    }
    return out;
  }

  /* ── Java (for side-by-side comparisons) ── */
  const JAVA_KW = new Set('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while var record yield sealed permits true false null'.split(' '));
  function java(src) {
    let out = '', m;
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\b\d[\d_]*(?:\.\d+)?[lLdDfF]?\b|\b0x[0-9a-fA-F_]+\b)|(@\w+)|([A-Za-z_$][\w$]*)|([\s\S])/g;
    while ((m = re.exec(src))) {
      if (m[1]) out += span('tok-c', m[1]);
      else if (m[2]) out += span('tok-s', m[2]);
      else if (m[3]) out += span('tok-n', m[3]);
      else if (m[4]) out += span('tok-a', m[4]);
      else if (m[5]) out += JAVA_KW.has(m[5]) ? span('tok-k', m[5]) : /^[A-Z]/.test(m[5]) ? span('tok-t', m[5]) : esc(m[5]);
      else out += esc(m[6]);
    }
    return out;
  }

  /* ── rustc output ── */
  function rustc(text) {
    return String(text || '').split('\n').map((l) => {
      let m;
      if ((m = /^(error(?:\[E\d{4}\])?)(:[\s\S]*)$/.exec(l))) return span('rc-err', m[1]) + esc(m[2]);
      if ((m = /^(warning(?:\[[\w:]+\])?)(:[\s\S]*)$/.exec(l))) return span('rc-warn', m[1]) + esc(m[2]);
      if ((m = /^(help|note)(:[\s\S]*)$/.exec(l))) return span(m[1] === 'help' ? 'rc-help' : 'rc-note', m[1]) + esc(m[2]);
      if (/^\s*--> /.test(l)) return span('rc-dim', l);
      if (/^thread '[^']*' panicked at /.test(l)) return span('rc-err', l);
      return esc(l);
    }).join('\n');
  }

  const api = { rust, java, rustc, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RustHighlight = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

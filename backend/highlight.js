/* Backend Lab highlighting: Java and SQL. Shared by the page and tests. */
(function (root) {
  'use strict';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const span = (cls, s) => `<span class="${cls}">${esc(s)}</span>`;

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

  const SQL_KW = new Set(('select from where and or not in is null as on join left right inner outer full cross using group by order having limit offset '
    + 'insert into values update set delete returning with recursive create alter drop table index concurrently unique primary key foreign references '
    + 'constraint check default add column type if exists begin commit rollback for share nowait skip locked lock mode access exclusive row '
    + 'valid validate explain analyze distinct case when then else end asc desc union all conflict do nothing transaction isolation level '
    + 'serializable repeatable read committed true false between like count sum max min now interval').split(' '));
  function sql(src) {
    let out = '', m;
    const re = /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w$]*)|([\s\S])/g;
    while ((m = re.exec(src))) {
      if (m[1]) out += span('tok-c', m[1]);
      else if (m[2]) out += span('tok-s', m[2]);
      else if (m[3]) out += span('tok-n', m[3]);
      else if (m[4]) out += SQL_KW.has(m[4].toLowerCase()) ? span('tok-k', m[4]) : esc(m[4]);
      else out += esc(m[5]);
    }
    return out;
  }

  const code = (src, lang) => (lang === 'java' ? java(src) : lang === 'sql' ? sql(src) : esc(src));

  const api = { java, sql, code, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LabHighlight = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

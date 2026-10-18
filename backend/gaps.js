/* Spot the gaps: a config file or a snippet with real problems in it. You click the lines that are wrong and
 * name what goes wrong; grade() checks you against the lesson's issues. Shared by the page and tests.
 *
 * In a lesson: gaps: [{ title, intro, lang, code, issues: [{ id, kind, title, why, fix }], decoys: [{ id, why }] }]
 * and @gaps n in the body. A line ending in ⟦id⟧ (or ⟦a,b⟧) belongs to that issue or decoy; the marker is not shown. */
(function (root) {
  'use strict';

  const KINDS = {
    loss: { label: 'Loses data', hint: 'a write that was acknowledged, or a message, can disappear' },
    dupe: { label: 'Duplicates', hint: 'the same message or effect can happen twice' },
    order: { label: 'Breaks ordering', hint: 'things for one key can be applied out of order' },
    wrong: { label: 'Leaves systems disagreeing', hint: 'one side records something the other never did, or acts at the wrong time' },
    slow: { label: 'Costs throughput or latency', hint: 'works, but far slower or heavier than it needs to be' },
    stall: { label: 'Can stall or hang', hint: 'something can block, wait forever, or get stuck' },
    ops: { label: 'Hides failures or hurts operations', hint: 'failures go unseen, or it is hard to run and debug' },
  };

  function parse(src) {
    const lines = [], marks = {};
    const rows = String(src).replace(/\r/g, '').replace(/^\n+|\s+$/g, '').split('\n');
    const indent = Math.min(...rows.filter((r) => r.trim()).map((r) => r.match(/^ */)[0].length));
    rows.map((r) => r.slice(Math.min(indent, r.match(/^ */)[0].length))).forEach((raw) => {
      const n = lines.length + 1;
      const m = /\s*⟦([\w,-]+)⟧\s*$/.exec(raw);
      const ids = m ? m[1].split(',').filter(Boolean) : [];
      const text = (m ? raw.slice(0, m.index) : raw).replace(/\s+$/, '');
      for (const id of ids) (marks[id] || (marks[id] = [])).push(n);
      lines.push({ n, text, marks: ids });
    });
    return { lines, marks };
  }

  // flags: { lineNumber: kind }
  function grade(x, parsed, flags) {
    const flagged = Object.keys(flags).map(Number).sort((a, b) => a - b);
    const onIssue = new Set();
    const issues = (x.issues || []).map((is) => {
      const lines = parsed.marks[is.id] || [];
      lines.forEach((n) => onIssue.add(n));
      const hit = lines.filter((n) => flags[n] !== undefined);
      return { id: is.id, lines, found: hit.length > 0, kindOk: hit.some((n) => flags[n] === is.kind) };
    });
    const decoyIds = new Set((x.decoys || []).map((d) => d.id));
    const falseAlarms = flagged.filter((n) => !onIssue.has(n)).map((n) => {
      const line = parsed.lines[n - 1];
      return { n, decoy: (line && line.marks.find((id) => decoyIds.has(id))) || null };
    });
    const found = issues.filter((i) => i.found).length;
    return { issues, falseAlarms, found, total: issues.length, done: found === issues.length };
  }

  const api = { KINDS, parse, grade };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LabGaps = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

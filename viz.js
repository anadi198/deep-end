/* LLD Lab visuals: Java highlighting, the step-through sequence player, and Mermaid diagrams.
 *
 * Sequence player ("~~~seq Title" fences in content). One step per line:
 *   actors: Client, Checkout, Pricing      optional; otherwise actors appear in order of first use
 *   A -> B: label                          a call
 *   B --> A: label                         a return (dashed)
 *   A -> A: label                          a call to itself
 *   state A: text                          A's state changes (shown as a badge on A's lane)
 *   note: text                             the caption for the step above it
 *   # comment
 * Mermaid ("~~~mermaid" fences) is loaded from jsDelivr the first time a page shows a diagram.
 */
(function () {
  'use strict';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ───────────── Java highlighting ───────────── */
  const KW = new Set('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while var record yield sealed permits non-sealed true false null'.split(' '));
  function highlightJava(src) {
    let out = '';
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\b\d[\d_]*(?:\.\d+)?[lLdDfF]?\b|\b0x[0-9a-fA-F_]+\b)|(@\w+)|([A-Za-z_$][\w$-]*)|([\s\S])/g;
    let m;
    while ((m = re.exec(src))) {
      if (m[1]) out += `<span class="tok-c">${esc(m[1])}</span>`;
      else if (m[2]) out += `<span class="tok-s">${esc(m[2])}</span>`;
      else if (m[3]) out += `<span class="tok-n">${esc(m[3])}</span>`;
      else if (m[4]) out += `<span class="tok-a">${esc(m[4])}</span>`;
      else if (m[5]) {
        const w = m[5];
        if (w.includes('-') && w !== 'non-sealed') { out += w.split(/(-)/).map((x) => (x === '-' ? '-' : KW.has(x) ? `<span class="tok-k">${x}</span>` : /^[A-Z]/.test(x) ? `<span class="tok-t">${x}</span>` : x)).join(''); continue; }
        out += KW.has(w) ? `<span class="tok-k">${w}</span>` : /^[A-Z]/.test(w) ? `<span class="tok-t">${w}</span>` : w;
      } else out += esc(m[6]);
    }
    return out;
  }

  /* ───────────── Sequence player ───────────── */
  function parseSeq(src) {
    const actors = [];
    const add = (a) => { a = a.trim(); if (a && !actors.includes(a)) actors.push(a); return a; };
    const steps = [];
    for (const raw of String(src).split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      let m;
      if ((m = /^actors:\s*(.+)$/i.exec(line))) { m[1].split(',').forEach(add); continue; }
      if ((m = /^note:\s*(.+)$/i.exec(line))) { if (steps.length) steps[steps.length - 1].note = m[1]; else steps.push({ kind: 'note', note: m[1] }); continue; }
      if ((m = /^state\s+([^:]+):\s*(.+)$/i.exec(line))) { steps.push({ kind: 'state', a: add(m[1]), label: m[2] }); continue; }
      if ((m = /^(.+?)\s*(-->|->)\s*(.+?):\s*(.*)$/.exec(line))) { steps.push({ kind: m[2] === '-->' ? 'ret' : 'call', a: add(m[1]), b: add(m[3]), label: m[4] }); continue; }
      steps.push({ kind: 'note', note: line });
    }
    return { actors, steps };
  }
  function seqSvg(spec, upto) {
    const { actors, steps } = spec;
    const colW = Math.max(130, Math.min(190, 760 / Math.max(1, actors.length)));
    const W = actors.length * colW, top = 46, rowH = 40;
    const H = top + steps.length * rowH + 16;
    const X = (a) => actors.indexOf(a) * colW + colW / 2;
    let s = `<svg class="seq-svg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Sequence diagram"><defs><marker id="sq-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="sq-head"/></marker></defs>`;
    actors.forEach((a) => {
      s += `<line class="sq-life" x1="${X(a)}" y1="${top - 8}" x2="${X(a)}" y2="${H - 6}"/>`;
      s += `<g class="sq-actor"><rect x="${X(a) - colW / 2 + 10}" y="4" width="${colW - 20}" height="30" rx="7"/><text x="${X(a)}" y="23">${esc(a)}</text></g>`;
    });
    steps.forEach((st, i) => {
      const y = top + i * rowH + rowH / 2 + 4;
      const cls = i > upto ? 'future' : i === upto ? 'now' : 'past';
      if (st.kind === 'note') { s += `<text class="sq-note ${cls}" x="${W / 2}" y="${y}">${esc(st.note)}</text>`; return; }
      if (st.kind === 'state') { const x = X(st.a); const w = Math.min(colW - 16, 18 + st.label.length * 6.6); s += `<g class="sq-state ${cls}"><rect x="${x - w / 2}" y="${y - 13}" width="${w}" height="22" rx="11"/><text x="${x}" y="${y + 2}">${esc(st.label)}</text></g>`; return; }
      const x1 = X(st.a), x2 = X(st.b);
      if (st.a === st.b) {
        s += `<g class="sq-msg ${st.kind} ${cls}"><path d="M${x1},${y - 10} h30 v16 h-28" marker-end="url(#sq-arr)"/><text class="lbl" x="${x1 + 36}" y="${y}" text-anchor="start">${esc(st.label)}</text></g>`;
        return;
      }
      const dir = x2 > x1 ? 1 : -1;
      s += `<g class="sq-msg ${st.kind} ${cls}"><line x1="${x1 + dir * 3}" y1="${y}" x2="${x2 - dir * 4}" y2="${y}" marker-end="url(#sq-arr)"/><text class="lbl" x="${(x1 + x2) / 2}" y="${y - 7}">${esc(st.label)}</text></g>`;
    });
    return s + '</svg>';
  }
  function mountSeq(el, src, title) {
    const spec = parseSeq(src);
    if (!spec.steps.length) { el.innerHTML = '<p class="small">empty sequence</p>'; return; }
    let k = 0;
    el.className = 'seq';
    el.tabIndex = 0;
    el.innerHTML = `<div class="seq-head"><b>${esc(title || 'Step through it')}</b><span class="seq-count"></span></div><div class="seq-stage"></div><div class="seq-cap"></div><div class="seq-ctl"><button class="btn sm" data-s="first" title="First step">⏮</button><button class="btn sm" data-s="prev">◀ Back</button><button class="btn sm primary" data-s="next">Next ▶</button><button class="btn sm quiet" data-s="all">Show all</button></div>`;
    const stage = el.querySelector('.seq-stage'), cap = el.querySelector('.seq-cap'), count = el.querySelector('.seq-count');
    const draw = () => {
      stage.innerHTML = seqSvg(spec, k);
      const st = spec.steps[Math.min(k, spec.steps.length - 1)];
      cap.innerHTML = st.note ? esc(st.note) : st.kind === 'call' ? `<b>${esc(st.a)}</b> calls <b>${esc(st.b)}</b>: ${esc(st.label)}` : st.kind === 'ret' ? `<b>${esc(st.b)}</b> gets back: ${esc(st.label)}` : st.kind === 'state' ? `<b>${esc(st.a)}</b> is now: ${esc(st.label)}` : '';
      count.textContent = `step ${Math.min(k + 1, spec.steps.length)} of ${spec.steps.length}`;
      el.querySelector('[data-s=prev]').disabled = k === 0;
      el.querySelector('[data-s=next]').disabled = k >= spec.steps.length - 1;
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      const a = b.dataset.s;
      if (a === 'next') k = Math.min(spec.steps.length - 1, k + 1);
      if (a === 'prev') k = Math.max(0, k - 1);
      if (a === 'first') k = 0;
      if (a === 'all') k = spec.steps.length - 1;
      draw();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { k = Math.min(spec.steps.length - 1, k + 1); draw(); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { k = Math.max(0, k - 1); draw(); e.preventDefault(); }
    });
    draw();
  }

  /* ───────────── Mermaid ───────────── */
  const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@12.0.0/dist/mermaid.esm.min.mjs';
  let mermaidP = null, mermaidTheme = null, seqId = 0;
  const isDark = () => (document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  function loadMermaid() {
    if (!mermaidP) mermaidP = import(MERMAID_URL).then((m) => m.default);
    return mermaidP;
  }
  async function renderMermaid(el) {
    const src = el.dataset.src;
    try {
      const mm = await loadMermaid();
      const theme = isDark() ? 'dark' : 'neutral';
      if (mermaidTheme !== theme) {
        mm.initialize({ startOnLoad: false, theme, securityLevel: 'strict', fontFamily: 'Archivo, system-ui, sans-serif', class: { hideEmptyMembersBox: true } });
        mermaidTheme = theme;
      }
      const { svg } = await mm.render('mmd' + ++seqId, src);
      el.innerHTML = svg;
      el.classList.add('ready');
    } catch (e) {
      el.innerHTML = `<pre class="mmd-fallback">${esc(src)}</pre><p class="small">Diagram could not be drawn (${esc(e && e.message ? e.message.split('\n')[0] : 'offline?')}). The text above is its source.</p>`;
    }
  }
  function mountMermaid(el) { el.classList.add('mmd'); el.innerHTML = '<div class="mmd-loading">drawing diagram…</div>'; renderMermaid(el); }
  // Redraw diagrams when the theme flips
  new MutationObserver(() => { if (mermaidTheme && mermaidTheme !== (isDark() ? 'dark' : 'neutral')) document.querySelectorAll('.mmd.ready').forEach((el) => renderMermaid(el)); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.LLDViz = { highlightJava, parseSeq, mountSeq, mountMermaid, loadMermaid, esc };
})();

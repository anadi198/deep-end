/* DSA Lab — pages beyond lessons & problems: home, cheat sheets (with flowcharts), pattern finder,
 * pattern drill, review queue and mock interviews. */
(function () {
  'use strict';
  const A = window.DSAApp, D = window.DSA;
  const { esc, md, inline, PAGES, ENHANCERS } = A;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const S = () => A.state;

  /* ───────────── Flowcharts ─────────────
   * spec: { title, w, h, nodes: { id: { t:'start'|'q'|'leaf', label, x, y, w, info } }, edges: [[from, to, label, via?]] }
   * x/y are the node centre in px on a w×h canvas. via: optional list of [x,y] bend points. */
  function wrapText(s, max) {
    const words = String(s).split(' '); const lines = []; let cur = '';
    for (const w of words) { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
    if (cur) lines.push(cur);
    return lines;
  }
  function nodeBox(n) {
    if (n.t === 'q') return { w: n.w || 132, h: n.h || 72 };
    if (n.t === 'start') return { w: n.w || 96, h: 36 };
    return { w: n.w || 128, h: n.h || 38 };
  }
  function anchor(n, side) {
    const b = nodeBox(n);
    return { top: [n.x, n.y - b.h / 2], bottom: [n.x, n.y + b.h / 2], left: [n.x - b.w / 2, n.y], right: [n.x + b.w / 2, n.y] }[side];
  }
  function edgePath(a, b, via) {
    if (via && via.length) {
      // first bend decides the exit side, last bend decides the entry side
      const f = via[0], l = via[via.length - 1];
      const exit = Math.abs(f[0] - a.x) < 2 ? (f[1] > a.y ? 'bottom' : 'top') : f[0] > a.x ? 'right' : 'left';
      const entry = Math.abs(l[0] - b.x) < 2 ? (l[1] < b.y ? 'top' : 'bottom') : l[0] < b.x ? 'left' : 'right';
      return [anchor(a, exit), ...via, anchor(b, entry)];
    }
    if (Math.abs(a.x - b.x) < 2) return a.y < b.y ? [anchor(a, 'bottom'), anchor(b, 'top')] : [anchor(a, 'top'), anchor(b, 'bottom')];
    if (Math.abs(a.y - b.y) < 2) return a.x < b.x ? [anchor(a, 'right'), anchor(b, 'left')] : [anchor(a, 'left'), anchor(b, 'right')];
    // elbow: leave sideways, then drop into the target's top
    const s = anchor(a, b.x > a.x ? 'right' : 'left');
    const t = anchor(b, b.y > a.y ? 'top' : 'bottom');
    return [s, [t[0], s[1]], t];
  }
  function renderFlow(host, spec, { walk = true } = {}) {
    const W = spec.w, Hh = spec.h, uid = Math.random().toString(36).slice(2, 7);
    const N = spec.nodes;
    let edges = '', nodes = '';
    spec.edges.forEach(([from, to, lab, via], k) => {
      const a = N[from], b = N[to]; if (!a || !b) return;
      const pts = edgePath(a, b, via);
      const d = 'M' + pts.map((p) => p.join(',')).join(' L');
      // label near the start of the edge
      const [p0, p1] = pts;
      const lx = p0[0] + (p1[0] - p0[0]) * (Math.abs(p1[0] - p0[0]) > 40 ? 0.3 : 0.5) + (p0[0] === p1[0] ? 14 : 0);
      const ly = p0[1] + (p1[1] - p0[1]) * (Math.abs(p1[1] - p0[1]) > 40 ? 0.35 : 0.5) - (p0[1] === p1[1] ? 8 : 0);
      edges += `<path class="fl-edge" data-e="${from}>${to}" d="${d}" marker-end="url(#fa${uid})"/>`;
      if (lab) edges += `<text class="fl-elab" x="${lx}" y="${ly}">${esc(lab)}</text>`;
    });
    for (const [id, n] of Object.entries(N)) {
      const b = nodeBox(n);
      const lines = wrapText(n.label, n.t === 'q' ? 17 : Math.max(10, Math.floor(b.w / 7.4)));
      const lh = 13.5, ty = n.y - ((lines.length - 1) * lh) / 2;
      const text = lines.map((l, i) => `<text x="${n.x}" y="${ty + i * lh}">${esc(l)}</text>`).join('');
      let shape;
      if (n.t === 'q') shape = `<polygon points="${n.x},${n.y - b.h / 2} ${n.x + b.w / 2},${n.y} ${n.x},${n.y + b.h / 2} ${n.x - b.w / 2},${n.y}"/>`;
      else if (n.t === 'start') shape = `<rect x="${n.x - b.w / 2}" y="${n.y - b.h / 2}" width="${b.w}" height="${b.h}" rx="18"/>`;
      else shape = `<rect x="${n.x - b.w / 2}" y="${n.y - b.h / 2}" width="${b.w}" height="${b.h}" rx="4"/>`;
      nodes += `<g class="fl-node fl-${n.t}" data-n="${id}" ${n.t === 'leaf' ? 'tabindex="0" role="button"' : ''}>${shape}${text}</g>`;
    }
    host.innerHTML = `
      <div class="flow">
        ${walk ? `<div class="flow-bar"><button class="btn sm primary" data-f="walk">Walk through it</button><button class="btn sm quiet" data-f="reset" hidden>Clear</button><span class="flow-hint">Click any blue box for details.</span></div><div class="flow-walk" hidden></div>` : ''}
        <div class="flow-canvas"><svg class="flowsvg" viewBox="0 0 ${W} ${Hh}" width="${W}" role="img" aria-label="${esc(spec.title || 'Flowchart')}">
          <defs><marker id="fa${uid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="fl-head"/></marker></defs>
          ${edges}${nodes}</svg></div>
        <div class="flow-info" hidden></div>
      </div>`;
    const info = $('.flow-info', host);
    const showInfo = (id) => {
      const n = N[id]; if (!n || n.t !== 'leaf') return;
      $$('.fl-node', host).forEach((g) => g.classList.toggle('sel', g.dataset.n === id));
      info.hidden = false;
      info.innerHTML = `<h4>${esc(n.label)}</h4>${n.info ? md(n.info) : ''}`;
      if (window.innerWidth < 900) info.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    host.addEventListener('click', (e) => {
      const g = e.target.closest('.fl-leaf'); if (g) showInfo(g.dataset.n);
    });
    host.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.fl-leaf')) { e.preventDefault(); showInfo(e.target.closest('.fl-leaf').dataset.n); } });
    if (!walk) return;
    // walk mode: answer the questions one at a time, highlighting the path
    const out = {};
    spec.edges.forEach(([f, t, lab]) => { (out[f] = out[f] || []).push({ t, lab }); });
    const start = Object.keys(N).find((k) => N[k].t === 'start');
    const walkBox = $('.flow-walk', host);
    let path = [];
    const paint = () => {
      const set = new Set(path);
      $$('.fl-node', host).forEach((g) => { g.classList.toggle('on', set.has(g.dataset.n)); g.classList.toggle('dim', path.length > 0 && !set.has(g.dataset.n)); });
      const es = new Set(path.slice(1).map((id, i) => path[i] + '>' + id));
      $$('.fl-edge', host).forEach((p) => { p.classList.toggle('on', es.has(p.dataset.e)); p.classList.toggle('dim', path.length > 0 && !es.has(p.dataset.e)); });
    };
    const stepTo = (id) => {
      path.push(id);
      let cur = id;
      // skip the start node and any single-exit pass-through
      while (N[cur].t !== 'q' && N[cur].t !== 'leaf' && out[cur] && out[cur].length === 1) { cur = out[cur][0].t; path.push(cur); }
      paint();
      const n = N[cur];
      if (n.t === 'leaf') {
        walkBox.innerHTML = `<div class="flow-q"><span>Answer:</span> <b>${esc(n.label)}</b></div>`;
        showInfo(cur);
        return;
      }
      walkBox.innerHTML = `<div class="flow-q">${n.help ? '' : ''}<b>${esc(n.label)}?</b>${n.help ? `<small>${inline(n.help)}</small>` : ''}</div><div class="flow-opts">${(out[cur] || []).map((o) => `<button class="btn" data-go="${o.t}">${esc(o.lab || 'next')}</button>`).join('')}${path.length > 1 ? '<button class="btn quiet" data-f="back">← Back</button>' : ''}</div>`;
    };
    host.addEventListener('click', (e) => {
      const f = e.target.closest('[data-f]');
      if (f && f.dataset.f === 'walk') { path = []; info.hidden = true; walkBox.hidden = false; $('[data-f=reset]', host).hidden = false; stepTo(start); }
      if (f && f.dataset.f === 'reset') { path = []; walkBox.hidden = true; info.hidden = true; f.hidden = true; paint(); $$('.fl-node', host).forEach((g) => g.classList.remove('sel')); }
      if (f && f.dataset.f === 'back') {
        // drop the last question and everything after it
        path.pop();
        while (path.length && N[path[path.length - 1]].t !== 'q') path.pop();
        const last = path.pop();
        info.hidden = true;
        if (last) stepTo(last); else stepTo(start);
      }
      const go = e.target.closest('[data-go]');
      if (go) stepTo(go.dataset.go);
    });
  }
  ENHANCERS.push((root) => {
    for (const m of $$('.flow-mount', root)) {
      const spec = (D.flows || {})[m.dataset.flow];
      const div = document.createElement('div');
      m.replaceWith(div);
      if (spec) renderFlow(div, spec); else div.textContent = 'Unknown chart ' + m.dataset.flow;
    }
  });
  window.DSAFlow = { render: renderFlow };

  /* ───────────── Home ───────────── */
  // Roadmap layout: [moduleId, col, row] on a grid, plus prerequisite edges.
  const RM = D.roadmap || { pos: {}, edges: [] };
  function roadmapSvg() {
    const cw = 172, rh = 86, bw = 150, bh = 54;
    const pos = RM.pos;
    const ids = Object.keys(pos).filter((id) => A.MOD[id]);
    if (!ids.length) return '';
    const maxC = Math.max(...ids.map((id) => pos[id][0])), maxR = Math.max(...ids.map((id) => pos[id][1]));
    const W = (maxC + 1) * cw, Hh = (maxR + 1) * rh;
    const X = (id) => pos[id][0] * cw + cw / 2, Y = (id) => pos[id][1] * rh + rh / 2;
    // "next" = first module in order that isn't complete
    const next = A.MODS.find((m) => { const s = A.modStats(m); return s.n ? s.s < s.n : s.lr < s.lessons; });
    let edges = '', nodes = '';
    for (const [a, b] of RM.edges) {
      if (!pos[a] || !pos[b]) continue;
      const x1 = X(a), y1 = Y(a) + bh / 2, x2 = X(b), y2 = Y(b) - bh / 2;
      const my = (y1 + y2) / 2;
      edges += `<path class="rm-edge" d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}"/>`;
    }
    for (const id of ids) {
      const m = A.MOD[id], s = A.modStats(m);
      const frac = s.n ? s.s / s.n : s.lessons ? s.lr / s.lessons : 0;
      const done = frac >= 1;
      nodes += `<g class="rm-node ${done ? 'done' : ''} ${next && next.id === id ? 'next' : ''}" data-href="#/m/${id}" tabindex="0" role="link" aria-label="${esc(m.title)}">
        <rect x="${X(id) - bw / 2}" y="${Y(id) - bh / 2}" width="${bw}" height="${bh}" rx="10"/>
        <text class="rm-t" x="${X(id)}" y="${Y(id) - 6}">${esc(m.short || m.title)}</text>
        <text class="rm-s" x="${X(id)}" y="${Y(id) + 11}">${s.n ? `${s.s}/${s.n} solved` : `${s.lr}/${s.lessons} read`}</text>
        <rect class="rm-bar" x="${X(id) - bw / 2 + 14}" y="${Y(id) + 18}" width="${bw - 28}" height="4" rx="2"/>
        <rect class="rm-fill" x="${X(id) - bw / 2 + 14}" y="${Y(id) + 18}" width="${(bw - 28) * frac}" height="4" rx="2"/>
      </g>`;
    }
    return `<svg class="roadmap" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Roadmap of modules">${edges}${nodes}</svg>`;
  }
  function streak() {
    const days = S().days || {};
    let n = 0; const d = new Date();
    if (!days[d.toISOString().slice(0, 10)]) d.setDate(d.getDate() - 1);
    while (days[d.toISOString().slice(0, 10)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  PAGES.home = (root) => {
    const st = S();
    const all = A.ALL_PROBLEMS;
    const solved = all.filter((p) => A.isSolved(p.id));
    const by = (d) => [solved.filter((p) => p.diff === d).length, all.filter((p) => p.diff === d).length];
    const [e1, e2] = by('easy'), [m1, m2] = by('medium'), [h1, h2] = by('hard');
    const due = A.dueList().length;
    const last = st.last && st.last.startsWith('#/') ? st.last : null;
    const lastTitle = last ? (() => { const [, k, id] = last.split('/'); return k === 'p' && A.PROBLEM[id] ? A.PROBLEM[id].title : k === 'l' && A.LESSON[id] ? A.LESSON[id].title : null; })() : null;
    const firstLesson = A.ITEMS[0];
    const drill = st.drill || { n: 0, right: 0 };
    root.innerHTML = `
      <section class="hero">
        <div>
          <div class="eyebrow">Interview prep · Java</div>
          <h1>Learn the patterns, then prove it in Java.</h1>
          <p class="lede">Most interview problems are about 20 patterns in disguise. Each module teaches one: how to spot it, the Java template, and a step-by-step visualization. Then you solve original problems here, graded by a real Java compiler, with full solutions and matching LeetCode problems for more practice.</p>
          <div class="cta">
            ${lastTitle ? `<a class="btn primary" href="${last}">Continue: ${esc(lastTitle)} →</a>` : firstLesson ? `<a class="btn primary" href="${firstLesson.kind === 'lesson' ? '#/l/' : '#/p/'}${firstLesson.id}">Start with lesson 1 →</a>` : ''}
            ${due ? `<a class="btn warn" href="#/review">${due} due for review</a>` : ''}
            <a class="btn" href="#/cheats">Cheat sheets</a>
          </div>
        </div>
        <div class="stats">
          <div class="stat"><small>Solved</small><b>${solved.length}<span style="display:inline;font-size:14px;color:var(--ink-3)"> / ${all.length}</span></b><div class="diffbar"><i style="width:${(100 * e1) / Math.max(1, all.length)}%;background:var(--easy)"></i><i style="width:${(100 * m1) / Math.max(1, all.length)}%;background:var(--medium)"></i><i style="width:${(100 * h1) / Math.max(1, all.length)}%;background:var(--hard)"></i></div><span>${e1}/${e2} easy · ${m1}/${m2} medium · ${h1}/${h2} hard</span></div>
          <div class="stat"><small>Streak</small><b>${streak()}</b><span>day${streak() === 1 ? '' : 's'} in a row with a solve</span></div>
          <div class="stat"><small>Review</small><b>${due}</b><span>${due ? 'problems due today' : Object.keys(st.review).length ? 'nothing due — nice' : 'solve a problem to start spaced review'}</span></div>
          <div class="stat"><small>Pattern drill</small><b>${drill.n ? Math.round((100 * drill.right) / drill.n) + '%' : '—'}</b><span>${drill.n ? `${drill.right}/${drill.n} recognised · best streak ${drill.best}` : 'can you spot the pattern in 10 seconds?'}</span></div>
        </div>
      </section>
      <h2 class="section-h">Roadmap</h2>
      <div class="roadmap-wrap">${roadmapSvg()}</div>
      <h2 class="section-h">Tools</h2>
      <div class="feature-row">
        <a class="feature" href="#/cheats"><span class="ic">▦</span><b>Cheat sheets</b><span>Which Java collection to use (a flowchart), a complexity table for every collection, templates, and gotchas.</span></a>
        <a class="feature" href="#/finder"><span class="ic">⑂</span><b>Which pattern?</b><span>Answer a few questions about a problem and get the likely pattern.</span></a>
        <a class="feature" href="#/drill"><span class="ic">◎</span><b>Pattern drill</b><span>Rapid-fire rounds: read a problem, name the pattern. Builds the skill interviews actually test.</span></a>
        <a class="feature" href="#/mock"><span class="ic">⏱</span><b>Mock interview</b><span>A timed problem with no tags and no solution until the time is up.</span></a>
      </div>
      <h2 class="section-h">Modules</h2>
      <div class="mod-grid">${A.MODS.map((m) => { const s = A.modStats(m); const frac = s.n ? s.s / s.n : s.lessons ? s.lr / s.lessons : 0; return `<a class="mod-card" href="#/m/${m.id}"><span class="n">${String(m.n).padStart(2, '0')}</span><h3>${esc(m.title)}</h3><p>${inline(m.blurb || '')}</p><div class="bar"><i style="width:${100 * frac}%"></i></div><small>${s.lessons} lessons · ${s.n ? `${s.s}/${s.n} problems solved` : `${s.lr}/${s.lessons} read`}</small></a>`; }).join('')}</div>`;
    root.querySelector('.roadmap') && root.querySelector('.roadmap').addEventListener('click', (e) => { const g = e.target.closest('.rm-node'); if (g) location.hash = g.dataset.href; });
    root.querySelector('.roadmap') && root.querySelector('.roadmap').addEventListener('keydown', (e) => { const g = e.target.closest('.rm-node'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); location.hash = g.dataset.href; } });
  };

  /* ───────────── Cheat sheets ───────────── */
  PAGES.cheats = (root, arg) => {
    const sheets = D.cheats || [];
    const cur = sheets.find((s) => s.id === arg);
    if (!cur) {
      root.innerHTML = `
        <div class="eyebrow">Reference</div><h1>Cheat sheets</h1>
        <p class="lede">One page each, meant to be reread before an interview. They print cleanly too (Ctrl/⌘ + P).</p>
        <div class="mod-grid">${sheets.map((s) => `<a class="mod-card" href="#/cheats/${s.id}"><span class="n">${esc(s.kind || 'Sheet')}</span><h3>${esc(s.title)}</h3><p>${inline(s.blurb || '')}</p></a>`).join('')}</div>`;
      return;
    }
    const i = sheets.indexOf(cur);
    root.innerHTML = `
      <div class="eyebrow"><a href="#/cheats">Cheat sheets</a><span class="meta">${esc(cur.kind || '')}</span></div>
      <h1>${esc(cur.title)}</h1>
      ${cur.lede ? `<p class="lede">${inline(cur.lede)}</p>` : ''}
      <div class="prose cheat">${md(cur.body, { id: 'cheat-' + cur.id, quiz: cur.quiz })}</div>
      <nav class="pager">${sheets[i - 1] ? `<a href="#/cheats/${sheets[i - 1].id}"><small>← Sheet</small><span>${esc(sheets[i - 1].title)}</span></a>` : ''}${sheets[i + 1] ? `<a class="next" href="#/cheats/${sheets[i + 1].id}"><small>Sheet →</small><span>${esc(sheets[i + 1].title)}</span></a>` : ''}</nav>`;
  };
  PAGES.quizFor = (lid) => { const s = (D.cheats || []).find((x) => 'cheat-' + x.id === lid); return s && s.quiz; };

  /* ───────────── Pattern finder ───────────── */
  PAGES.finder = (root) => {
    root.innerHTML = `
      <div class="eyebrow">Tool</div><h1>Which pattern?</h1>
      <p class="lede">Read the problem, then walk the chart: each question is a signal worth looking for in the statement or the constraints. Click an answer to see the template and the problems that use it.</p>
      <div class="prose">@@FLOW@@
      ${md(D.finderNotes || '')}</div>`;
    const html = root.innerHTML.replace('@@FLOW@@', '<div class="flow-mount" data-flow="patterns"></div>');
    root.innerHTML = html;
  };

  /* ───────────── Pattern drill ───────────── */
  const PATTERNS = D.patterns || {};
  function drillPool() {
    const pool = [];
    for (const p of A.ALL_PROBLEMS) if (p.drill) pool.push({ prompt: p.drill.prompt || p.brief, pattern: p.drill.pattern, why: p.drill.why, id: p.id });
    for (const d of D.drill || []) pool.push(d);
    return pool.filter((x) => x.prompt && PATTERNS[x.pattern]);
  }
  let drillState = null;
  PAGES.drill = (root) => {
    const pool = drillPool();
    if (!pool.length) { root.innerHTML = '<h1>Pattern drill</h1><p>No drill questions yet.</p>'; return; }
    const st = S().drill;
    const next = () => {
      // weight towards patterns you miss
      const weights = pool.map((q) => { const b = st.by[q.pattern] || [0, 0]; return 1 + (b[1] ? 2 * (1 - b[0] / b[1]) : 1); });
      let r = Math.random() * weights.reduce((a, b) => a + b, 0), k = 0;
      while (r > weights[k]) { r -= weights[k]; k++; }
      const q = pool[Math.min(k, pool.length - 1)];
      const confuse = (PATTERNS[q.pattern].confuse || []).filter((x) => PATTERNS[x]);
      const others = Object.keys(PATTERNS).filter((x) => x !== q.pattern && !confuse.includes(x)).sort(() => Math.random() - 0.5);
      const opts = [q.pattern, ...confuse.sort(() => Math.random() - 0.5).slice(0, 2), ...others].filter((x, i, a) => a.indexOf(x) === i).slice(0, 4).sort(() => Math.random() - 0.5);
      drillState = { q, opts, answered: false, t0: Date.now() };
      draw();
    };
    const draw = () => {
      const { q, opts, answered, pick } = drillState;
      const p = PATTERNS[q.pattern];
      root.innerHTML = `
        <div class="eyebrow">Tool</div><h1>Pattern drill</h1>
        <p class="lede">Read the problem and name the pattern before you think about code. Spotting the pattern fast is most of an interview.</p>
        <div class="drill-bar"><span>Score <b>${st.right}/${st.n}</b></span><span>Streak <b>${st.streak}</b></span><span>Best <b>${st.best}</b></span><span style="margin-left:auto"><button class="btn sm quiet" data-d="stats">Your accuracy by pattern</button></span></div>
        <div class="drill-card">
          <p class="prompt"><small>Which pattern fits?</small>${inline(q.prompt)}</p>
          <div class="choice-grid">${opts.map((o) => `<button class="choice ${answered ? (o === q.pattern ? 'right' : o === pick ? 'wrong' : '') : ''}" data-o="${o}" ${answered ? 'disabled' : ''}>${esc(PATTERNS[o].label)}</button>`).join('')}</div>
          ${answered ? `<div class="drill-why"><b>${pick === q.pattern ? '✓ Right.' : `✗ It's ${esc(p.label)}.`}</b> ${inline(q.why || p.signal || '')}${q.id ? ` <a href="#/p/${q.id}">Open the problem →</a>` : q.lc ? ` <a href="https://leetcode.com/problems/${q.lc}/" target="_blank" rel="noopener">Try it on LeetCode →</a>` : ''}${p.lesson ? ` · <a href="#/l/${p.lesson}">Pattern lesson</a>` : ''}</div><div style="margin-top:12px"><button class="btn primary" data-d="next">Next →</button> <span class="small" style="color:var(--ink-3);font-size:12.5px">or press Enter</span></div>` : ''}
        </div>
        <div class="drill-stats" hidden></div>`;
    };
    root.addEventListener('click', (e) => {
      const o = e.target.closest('[data-o]');
      if (o && drillState && !drillState.answered) {
        const right = o.dataset.o === drillState.q.pattern;
        drillState.answered = true; drillState.pick = o.dataset.o;
        st.n++; if (right) { st.right++; st.streak++; st.best = Math.max(st.best, st.streak); } else st.streak = 0;
        const b = st.by[drillState.q.pattern] || [0, 0]; b[1]++; if (right) b[0]++; st.by[drillState.q.pattern] = b;
        A.save(); draw();
      }
      const d = e.target.closest('[data-d]');
      if (d && d.dataset.d === 'next') next();
      if (d && d.dataset.d === 'stats') {
        const box = $('.drill-stats', root); box.hidden = !box.hidden;
        const rows = Object.entries(PATTERNS).map(([k, p]) => ({ k, p, b: st.by[k] || [0, 0] })).filter((x) => x.b[1]).sort((x, y) => x.b[0] / x.b[1] - y.b[0] / y.b[1]);
        box.innerHTML = rows.length ? `<div class="prose"><table class="t"><thead><tr><th>Pattern</th><th>Right</th><th>Accuracy</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${esc(x.p.label)}</td><td>${x.b[0]}/${x.b[1]}</td><td>${Math.round((100 * x.b[0]) / x.b[1])}%</td></tr>`).join('')}</tbody></table></div>` : '<p class="small">Answer a few first.</p>';
      }
    });
    const key = (e) => { if (!document.body.contains(root) || location.hash !== '#/drill') { document.removeEventListener('keydown', key); return; } if (e.key === 'Enter' && drillState && drillState.answered && !e.target.closest('input,textarea')) next(); if (/^[1-4]$/.test(e.key) && drillState && !drillState.answered && !e.target.closest('input,textarea,.CodeMirror')) { const b = $$('.choice', root)[+e.key - 1]; if (b) b.click(); } };
    document.addEventListener('keydown', key);
    next();
  };

  /* ───────────── Review ───────────── */
  PAGES.review = (root) => {
    const st = S();
    const due = A.dueList();
    const upcoming = Object.entries(st.review).filter(([id, r]) => A.PROBLEM[id] && r.due > Date.now()).sort((a, b) => a[1].due - b[1].due).slice(0, 30);
    const when = (t) => { const d = Math.round((t - Date.now()) / 86400000); return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`; };
    root.innerHTML = `
      <div class="eyebrow">Tool</div><h1>Review</h1>
      <p class="lede">Spaced repetition for problems. Re-solve a problem from scratch just as you're about to forget it. That's how a pattern becomes something you recognize instantly instead of something you once read.</p>
      <div class="prose">
        <h2 style="border:0;padding-top:0">Due now <span class="small">(${due.length})</span></h2>
        ${due.length ? due.map((r) => { const p = A.PROBLEM[r.id]; return `<div class="review-row"><div><a href="#/p/${p.id}">${esc(p.title)}</a><small>${esc(p.module.title)} · last rated “${esc(r.rating || '')}” · every ${Math.round(r.ivl)} days</small></div><a class="btn primary sm" href="#/p/${p.id}" data-fresh="${p.id}">Re-solve</a></div>`; }).join('') : '<p class="small">Nothing due. Solve new problems, and they will come back for review on schedule.</p>'}
        ${upcoming.length ? `<h2>Coming up</h2>${upcoming.map(([id, r]) => `<div class="review-row"><div><a href="#/p/${id}">${esc(A.PROBLEM[id].title)}</a><small>${esc(A.PROBLEM[id].module.title)}</small></div><span class="small">${when(r.due)}</span></div>`).join('')}` : ''}
        <div class="callout note"><b>How it works</b><p>When you solve a problem, you pick when to see it again: tomorrow, in 3 days, in a week or in 3 weeks. Each successful review stretches the interval. When you re-solve, start from a blank editor (the <b>Re-solve</b> button clears your old code for that problem).</p></div>
      </div>`;
    root.addEventListener('click', (e) => {
      const f = e.target.closest('[data-fresh]');
      if (f) { delete st.drafts[f.dataset.fresh]; A.save(); }
    });
  };

  /* ───────────── Mock interview ───────────── */
  function mockState() { return S().mock || null; }
  PAGES.mockState = mockState;
  PAGES.mockBar = () => {
    const m = mockState();
    return `<div class="mock-bar"><b>Mock interview</b><span class="timer" data-end="${m.end}">--:--</span><span>${m.ids.map((id, k) => `<a href="#/p/${id}">Q${k + 1}${A.isSolved(id) && (S().solved[id].at >= m.start) ? ' ✓' : ''}</a>`).join(' · ')}</span><span style="margin-left:auto"></span><a class="btn sm" href="#/mock">Finish</a></div>`;
  };
  setInterval(() => {
    for (const t of $$('.mock-bar .timer')) {
      const left = Math.max(0, +t.dataset.end - Date.now());
      const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
      t.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      t.classList.toggle('low', left < 5 * 60000);
      if (left === 0 && !t.dataset.fired) { t.dataset.fired = 1; A.toast("Time's up! Wrap up and explain your complexity.", 5000); }
    }
  }, 1000);
  PAGES.mock = (root) => {
    const st = S();
    const m = st.mock;
    if (m && m.active) {
      const solved = m.ids.filter((id) => st.solved[id] && st.solved[id].at >= m.start);
      const left = Math.max(0, m.end - Date.now());
      root.innerHTML = `
        <div class="eyebrow">Tool</div><h1>Mock interview in progress</h1>
        ${PAGES.mockBar()}
        <div class="prose">
          <p>${solved.length}/${m.ids.length} solved · ${Math.ceil(left / 60000)} minutes left.</p>
          ${A.problemList(m.ids)}
          <p><button class="btn primary" data-mk="end">End the interview &amp; see the debrief</button></p>
        </div>`;
      root.addEventListener('click', (e) => {
        if (e.target.closest('[data-mk=end]')) { m.active = false; m.finished = Date.now(); A.save(); A.route(); }
      });
      return;
    }
    const debrief = m && m.finished ? (() => {
      const solved = m.ids.filter((id) => st.solved[id] && st.solved[id].at >= m.start);
      const used = Math.round((Math.min(m.finished, m.end) - m.start) / 60000);
      return `<div class="callout ${solved.length === m.ids.length ? 'key' : 'warn'}"><b>Last mock · debrief</b><p>Solved <b>${solved.length}/${m.ids.length}</b> in ${used} of ${Math.round((m.end - m.start) / 60000)} minutes. Solutions are unlocked now. For each problem, write down the signal you missed or the bug that cost you time.</p>${A.problemList(m.ids)}</div>`;
    })() : '';
    const mods = A.MODS.filter((x) => x.problems.length);
    root.innerHTML = `
      <div class="eyebrow">Tool</div><h1>Mock interview</h1>
      <p class="lede">The real thing, minus the interviewer. You get problems you haven't solved, with no pattern tags, no hints and no solutions until time is up. Talk out loud: restate, give examples, name the brute force, then optimize.</p>
      <div class="prose">
        ${debrief}
        <h2 style="border:0;padding-top:0">Set it up</h2>
        <div class="finder">
          <div class="q"><h3>Length</h3><div class="opts">${[[1, 25, 'One problem · 25 min'], [2, 45, 'Two problems · 45 min'], [3, 60, 'Three problems · 60 min']].map(([n, t, l], k) => `<label class="btn"><input type="radio" name="len" value="${n},${t}" ${k === 1 ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
          <div class="q"><h3>Difficulty</h3><div class="opts">${[['easy,medium', 'Warm-up (easy + medium)'], ['medium', 'Typical (medium)'], ['medium,hard', 'Hard onsite (medium + hard)']].map(([v, l], k) => `<label class="btn"><input type="radio" name="diff" value="${v}" ${k === 1 ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
          <div class="q"><h3>Topics</h3><div class="opts"><label class="btn"><input type="checkbox" id="mkAll" checked> Everything</label>${mods.map((x) => `<label class="btn"><input type="checkbox" name="mod" value="${x.id}"> ${esc(x.short || x.title)}</label>`).join('')}</div></div>
        </div>
        <p style="margin-top:16px"><button class="btn primary" data-mk="start">Start the clock</button></p>
      </div>`;
    root.addEventListener('click', (e) => {
      if (!e.target.closest('[data-mk=start]')) return;
      const [n, mins] = $('input[name=len]:checked', root).value.split(',').map(Number);
      const diffs = $('input[name=diff]:checked', root).value.split(',');
      const all = $('#mkAll', root).checked;
      const picked = $$('input[name=mod]:checked', root).map((x) => x.value);
      let pool = A.ALL_PROBLEMS.filter((p) => diffs.includes(p.diff) && (all || !picked.length || picked.includes(p.module.id)));
      const fresh = pool.filter((p) => !A.isSolved(p.id));
      if (fresh.length >= n) pool = fresh;
      if (pool.length < n) { A.toast('Not enough problems for that choice.'); return; }
      const ids = pool.sort(() => Math.random() - 0.5).slice(0, n).map((p) => p.id);
      st.mock = { ids, start: Date.now(), end: Date.now() + mins * 60000, active: true };
      for (const id of ids) delete st.drafts[id];
      A.save();
      location.hash = '#/p/' + ids[0];
    });
  };

  /* ───────────── Cloud sync ───────────── */
  const syncChip = $('#syncChip');
  const agoText = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`; };
  function paintSync(st) {
    if (!syncChip) return;
    if (!window.LabSync || !window.LabSync.configured()) { syncChip.hidden = true; return; }
    syncChip.hidden = false;
    syncChip.className = 'chip sync ' + st.state;
    syncChip.textContent = st.state === 'synced' ? '☁ Synced' : st.state === 'syncing' ? '☁ Syncing…' : st.state === 'error' ? '☁ Sync problem' : '☁ Sign in to sync';
    syncChip.title = st.state === 'synced' ? `Signed in as ${st.email || ''}. Last synced ${agoText(st.at)}.` : st.error || 'Keep your progress on every device';
  }
  PAGES.syncPanel = () => {
    const L = window.LabSync;
    if (!L || !L.configured()) {
      A.modal('Cloud sync', '<p>Not configured on this copy. The deploy workflow writes the config from the <code>LAB_FIREBASE</code> repository secret; for a local copy, fill in <code>sync-config.example.js</code> and save it as <code>sync-config.js</code> (gitignored).</p>');
      return;
    }
    const st = L.status();
    const body = st.email
      ? `<p>Signed in as <b>${esc(st.email)}</b>${st.at ? ` · last synced ${agoText(st.at)}` : ''}.</p>`
      : '<p>Sign in with Google to keep solved problems, drafts, review schedules and drill stats in step across your devices. Only your account can read them.</p>';
    const err = st.error ? `<p style="color:var(--bad)">${esc(st.error)}</p>` : '';
    A.modal('Cloud sync', body + err, st.email
      ? [{ label: 'Sync now', primary: true, fn: () => { L.syncNow(); } }, { label: 'Sign out', fn: () => { L.signOut(); } }]
      : [{ label: 'Sign in with Google', primary: true, fn: () => { L.signIn(); } }]);
  };
  if (syncChip) syncChip.onclick = () => { const st = window.LabSync && window.LabSync.status(); if (st && st.state === 'signed-out') window.LabSync.signIn(); else PAGES.syncPanel(); };
  if (window.LabSync) {
    window.LabSync.onStatus(paintSync);
    window.LabSync.init({
      lab: 'dsa',
      getState: () => A.syncState(),
      merge: (a, b) => A.syncMerge(a, b),
      apply: (cloud) => A.applyCloud(cloud),
      subscribe: (fn) => A.listeners.add(fn),
    });
  }

  A.start();
})();

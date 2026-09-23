/* DSA Lab — the app: routing, outline, lessons, problems, code panel, grading, progress. */
(function () {
  'use strict';
  const H = window.DSAHarness, D = window.DSA, V = window.DSAViz, E = window.DSAEngine;
  const EXP = window.DSA_EXPECTED || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const DAY = 86400000;

  /* ───────────── State ───────────── */
  const KEY = 'dsalab.v1';
  const blank = () => ({ v: 1, solved: {}, tries: {}, drafts: {}, hints: {}, seen: {}, read: {}, review: {}, quiz: {}, custom: {}, open: {}, engine: 'browser', drill: { n: 0, right: 0, streak: 0, best: 0, by: {} }, days: {}, last: null });
  let S;
  try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || 'null') || {}); } catch { S = blank(); }
  const save = debounce(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* full or blocked */ } }, 250);
  const saveNow = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* ignore */ } };
  window.addEventListener('beforeunload', saveNow);

  /* ───────────── Content index ───────────── */
  const MODS = D.modules;
  const ITEMS = [], LESSON = {}, PROBLEM = {}, MOD = {};
  MODS.forEach((m, mi) => {
    m.n = mi; MOD[m.id] = m;
    m.lessons = []; m.problems = [];
    for (const it of m.items) {
      if (it.lesson) { const l = { ...it, id: it.lesson, module: m }; LESSON[l.id] = l; m.lessons.push(l); ITEMS.push({ kind: 'lesson', id: l.id, data: l, module: m }); }
      else if (it.problem) { const p = it.problem; p.module = m; PROBLEM[p.id] = p; m.problems.push(p); ITEMS.push({ kind: 'problem', id: p.id, data: p, module: m }); }
    }
  });
  const ALL_PROBLEMS = ITEMS.filter((x) => x.kind === 'problem').map((x) => x.data);
  const hrefOf = (it) => (it.kind === 'lesson' ? `#/l/${it.id}` : `#/p/${it.id}`);

  /* ───────────── Mini Markdown ───────────── */
  function inline(s) {
    // code spans first (escaped verbatim), then the rest
    const parts = String(s).split(/(«[^»]*»|`+[^`]*?`+)/g);
    return parts.map((p, i) => {
      if (i % 2) {
        if (p[0] === '«') return `<code>${esc(p.slice(1, -1))}</code>`;
        const m = /^(`+)([\s\S]*?)\1$/.exec(p); return `<code>${esc(m ? m[2] : p.replace(/`/g, ''))}</code>`;
      }
      let t = esc(p);
      t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m0, txt, url) => {
        const ext = /^https?:/.test(url);
        return `<a href="${url.replace(/"/g, '%22')}"${ext ? ' target="_blank" rel="noopener"' : ''}>${txt}</a>`;
      });
      t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<i>$2</i>');
      t = t.replace(/~~([^~]+)~~/g, '<s>$1</s>');
      return t;
    }).join('');
  }
  function md(src, ctx = {}) {
    if (!src) return '';
    const lines = String(src).replace(/\r/g, '').replace(/^\n+|\s+$/g, '').split('\n');
    // strip the common indentation (content is written inside indented template literals)
    const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => /^ */.exec(l)[0].length));
    const L = lines.map((l) => l.slice(Math.min(ind, /^ */.exec(l)[0].length)));
    let out = '', i = 0;
    const para = [];
    const flush = () => { if (para.length) { out += `<p>${inline(para.join(' '))}</p>`; para.length = 0; } };
    while (i < L.length) {
      const line = L[i];
      if (!line.trim()) { flush(); i++; continue; }
      let m;
      if ((m = /^(?:```|~~~)(\w*)\s*(.*)$/.exec(line))) {
        flush();
        const lang = m[1] || 'java', lbl = m[2] || '';
        const buf = []; i++;
        while (i < L.length && !/^(?:```|~~~)\s*$/.test(L[i])) buf.push(L[i++]);
        i++;
        out += codeBlock(buf.join('\n'), { lang, label: lbl, ctx });
        continue;
      }
      if ((m = /^:::(\w+)\s*(.*)$/.exec(line))) {
        flush();
        const kind = m[1], title = m[2];
        const buf = []; i++;
        let depth = 0;
        while (i < L.length) {
          if (/^:::\w/.test(L[i])) depth++;
          else if (/^:::\s*$/.test(L[i])) { if (!depth) break; depth--; }
          buf.push(L[i++]);
        }
        i++;
        out += `<div class="callout ${kind}">${title ? `<b>${inline(title)}</b>` : ''}${md(buf.join('\n'), ctx)}</div>`;
        continue;
      }
      if ((m = /^@(\w+)\s*(.*)$/.exec(line))) {
        flush(); i++;
        out += directive(m[1], m[2], ctx);
        continue;
      }
      if (/^\?\? /.test(line)) {
        // Q&A cards: "?? question" then answer lines up to a blank line; consecutive cards group together
        flush();
        let cards = '';
        while (i < L.length && /^\?\? /.test(L[i])) {
          const q = L[i].slice(3); i++;
          const ans = [];
          while (i < L.length && L[i].trim()) ans.push(L[i++]);
          while (i < L.length && !L[i].trim() && i + 1 < L.length && /^\?\? /.test(L[i + 1])) i++;
          cards += `<details class="card"><summary>${inline(q)}</summary><div class="ans">${md(ans.join('\n'), ctx)}</div></details>`;
        }
        out += `<div class="cards">${cards}</div>`;
        continue;
      }
      if ((m = /^(#{2,4})\s+(.*)$/.exec(line))) { flush(); out += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; i++; continue; }
      if (/^\|.*\|\s*$/.test(line)) {
        flush();
        const rows = [];
        while (i < L.length && /^\|.*\|\s*$/.test(L[i])) rows.push(L[i++]);
        const cells = (r) => r.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
        const head = cells(rows[0]);
        const body = rows.slice(/^\|[\s:-]+\|/.test(rows[1] || '') && /-/.test(rows[1]) ? 2 : 1).map(cells);
        out += `<div class="tablewrap"><table class="t"><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        continue;
      }
      if (/^\s*[-*] /.test(line) || /^\s*\d+\. /.test(line)) {
        flush();
        const ordered = /^\s*\d+\. /.test(line);
        const items = [];
        while (i < L.length && (/^\s*[-*] /.test(L[i]) || /^\s*\d+\. /.test(L[i]) || (/^\s{2,}\S/.test(L[i]) && items.length))) {
          if (/^\s*[-*] /.test(L[i]) || /^\s*\d+\. /.test(L[i])) items.push(L[i].replace(/^\s*(?:[-*]|\d+\.) /, ''));
          else items[items.length - 1] += ' ' + L[i].trim();
          i++;
        }
        out += `<${ordered ? 'ol' : 'ul'}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`;
        continue;
      }
      if (/^</.test(line)) { flush(); const buf = []; while (i < L.length && L[i].trim()) buf.push(L[i++]); out += buf.join('\n'); continue; }
      para.push(line.trim()); i++;
    }
    flush();
    return out;
  }
  function codeBlock(src, { lang = 'java', label = '', ctx = {} } = {}) {
    const body = lang === 'java' ? V.highlightJava(src) : esc(src);
    const id = 'cb' + Math.random().toString(36).slice(2, 8);
    CODE_SRC[id] = src;
    const canLoad = lang === 'java' && ctx.problem && /class\s+(Solution|\w+)\s*\{/.test(src);
    return `<div class="codeblock" data-id="${id}"><pre>${body}</pre><div class="cb-bar">${label ? `<span class="lbl">${esc(label)}</span>` : '<span class="lbl"></span>'}<button class="btn quiet" data-cb="copy">Copy</button>${canLoad ? '<button class="btn quiet" data-cb="load" title="Replace the editor contents with this code">Load into editor</button>' : ''}</div></div>`;
  }
  const CODE_SRC = {};
  function directive(name, rest, ctx) {
    rest = rest.trim();
    if (name === 'viz') {
      const m = /^([\w-]+)\s*(\{.*\})?\s*(.*)$/.exec(rest);
      if (!m) return '';
      return `<div class="viz-mount" data-viz="${esc(m[1])}" data-input="${esc(m[2] || '')}" data-title="${esc(m[3] || '')}"></div>`;
    }
    if (name === 'problems') return problemList(rest.split(/\s+/).filter(Boolean));
    if (name === 'flow') return `<div class="flow-mount" data-flow="${esc(rest)}"></div>`;
    if (name === 'quiz') { const q = (ctx.quiz || [])[+rest]; return q ? quizHtml(q, `${ctx.id}:${rest}`) : ''; }
    if (name === 'cheat') return `<div class="cheat-mount" data-cheat="${esc(rest)}"></div>`;
    return '';
  }
  function problemList(ids) {
    return `<div class="plist">${ids.map((id) => {
      const p = PROBLEM[id]; if (!p) return `<span class="small">unknown problem ${esc(id)}</span>`;
      const solved = !!S.solved[id];
      return `<a href="#/p/${id}"><span class="st ${solved ? 'solved' : p.diff}"></span><span>${esc(p.title)} <small>· ${esc(p.module.title)}</small></span><span class="diff ${p.diff}" style="font-size:10px;padding:3px 7px">${p.diff}</span></a>`;
    }).join('')}</div>`;
  }
  function quizHtml(q, qid) {
    const chosen = S.quiz[qid];
    return `<div class="quiz" data-qid="${esc(qid)}"><p class="q"><span class="qt">Quiz</span><span>${inline(q.q)}</span></p>${q.options.map((o, k) => `<label class="${chosen !== undefined ? (k === q.answer ? 'right' : k === chosen ? 'wrong' : '') : ''}"><input type="radio" name="${esc(qid)}" value="${k}" ${chosen === k ? 'checked' : ''} ${chosen !== undefined ? 'disabled' : ''}><span>${inline(o)}</span></label>`).join('')}<div class="why" ${chosen === undefined ? 'hidden' : ''}>${md(q.why)}</div></div>`;
  }

  /* ───────────── Elements ───────────── */
  const el = {
    app: $('#app'), nav: $('#nav'), reader: $('#reader'), pane: $('#readerPane'), code: $('#code'),
    fileName: $('#fileName'), engineSw: $('#engineSw'), engineState: $('#engineState'), resBody: $('#resBody'),
    run: $('#runBtn'), submit: $('#submitBtn'), reset: $('#resetCode'), progress: $('#progressChip'), reviewChip: $('#reviewChip'),
  };

  function toast(msg, ms = 2600) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  /* ───────────── Theme / nav / menu ───────────── */
  (function theme() {
    const saved = localStorage.getItem('dsalab.theme');
    if (saved) document.documentElement.dataset.theme = saved;
    $('#themeBtn').onclick = () => {
      const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('dsalab.theme', document.documentElement.dataset.theme); } catch { /* ignore */ }
    };
  })();
  $('#navToggle').onclick = () => {
    if (matchMedia('(max-width: 920px)').matches) el.app.classList.toggle('nav-open');
    else el.app.classList.toggle('nav-hidden');
  };
  document.addEventListener('click', (e) => {
    if (el.app.classList.contains('nav-open') && !e.target.closest('.nav') && !e.target.closest('#navToggle')) el.app.classList.remove('nav-open');
  });
  $('#menuBtn').onclick = (e) => {
    popover(e.currentTarget, `
      <button class="item" data-m="export"><b>Export progress</b><span>Copy your progress as text, to move it to another device</span></button>
      <button class="item" data-m="import"><b>Import progress</b><span>Paste progress exported from another device</span></button>
      <hr>
      <button class="item" data-m="engine"><b>Engines &amp; setup</b><span>In-browser Java vs your own JDK</span></button>
      <a class="item" href="https://github.com/anadi198/learn-dsa" target="_blank" rel="noopener"><b>Source on GitHub</b><span>anadi198/learn-dsa</span></a>
      <hr>
      <button class="item" data-m="reset"><b>Reset all progress…</b><span>Clears solved problems, drafts and reviews in this browser</span></button>`,
    (m) => {
      if (m === 'export') modal('Export progress', `<p>Copy this text and import it on another device (⋯ → Import progress).</p><textarea readonly style="width:100%;min-height:160px;font:12px/1.4 var(--f-mono)">${esc(btoa(unescape(encodeURIComponent(JSON.stringify(S)))))}</textarea>`, [{ label: 'Copy', primary: true, fn: (m2) => { navigator.clipboard.writeText($('textarea', m2).value); toast('Copied'); } }]);
      if (m === 'import') modal('Import progress', `<p>Paste exported progress. It replaces the progress in this browser.</p><textarea style="width:100%;min-height:160px;font:12px/1.4 var(--f-mono)"></textarea>`, [{ label: 'Import', primary: true, fn: (m2) => {
        try { const v = JSON.parse(decodeURIComponent(escape(atob($('textarea', m2).value.trim())))); if (!v || v.v !== 1) throw new Error('not DSA Lab progress'); S = Object.assign(blank(), v); saveNow(); location.reload(); }
        catch (err) { toast('Could not import: ' + err.message); return false; }
      } }]);
      if (m === 'engine') engineHelp();
      if (m === 'reset') modal('Reset all progress?', '<p>This clears solved problems, code drafts, hints, quiz answers and review schedules in this browser. It cannot be undone (export first if unsure).</p>', [{ label: 'Reset everything', danger: true, fn: () => { S = blank(); saveNow(); location.hash = '#/'; location.reload(); } }]);
    });
  };
  function popover(anchor, html, onPick) {
    closePop();
    const p = document.createElement('div'); p.className = 'pop'; p.innerHTML = html; document.body.appendChild(p);
    const r = anchor.getBoundingClientRect();
    p.style.top = r.bottom + 6 + 'px';
    p.style.left = Math.max(16, Math.min(window.innerWidth - p.offsetWidth - 16, r.right - p.offsetWidth)) + 'px';
    p.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) { closePop(); onPick(b.dataset.m); } });
    setTimeout(() => document.addEventListener('click', closePopOutside), 0);
  }
  function closePopOutside(e) { if (!e.target.closest('.pop')) closePop(); }
  function closePop() { $$('.pop').forEach((p) => p.remove()); document.removeEventListener('click', closePopOutside); }
  function modal(title, body, buttons = []) {
    const back = document.createElement('div'); back.className = 'modal-back';
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h3>${esc(title)}</h3>${body}<div class="row"><button class="btn quiet" data-b="close">Close</button>${buttons.map((b, k) => `<button class="btn ${b.primary ? 'primary' : ''} ${b.danger ? 'warn' : ''}" data-b="${k}">${esc(b.label)}</button>`).join('')}</div></div>`;
    document.body.appendChild(back);
    const m = $('.modal', back);
    back.addEventListener('click', (e) => {
      if (e.target === back) { back.remove(); return; }
      const b = e.target.closest('[data-b]'); if (!b) return;
      if (b.dataset.b === 'close') { back.remove(); return; }
      const r = buttons[+b.dataset.b].fn(m);
      if (r !== false) back.remove();
    });
    const onKey = (e) => { if (e.key === 'Escape') { back.remove(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    return m;
  }

  /* ───────────── Progress helpers ───────────── */
  const isSolved = (id) => !!S.solved[id];
  const dueList = () => Object.entries(S.review).filter(([id, r]) => PROBLEM[id] && r.due <= Date.now()).map(([id, r]) => ({ id, ...r })).sort((a, b) => a.due - b.due);
  function modStats(m) {
    const n = m.problems.length, s = m.problems.filter((p) => isSolved(p.id)).length;
    const lr = m.lessons.filter((l) => S.read[l.id]).length;
    return { n, s, lessons: m.lessons.length, lr };
  }
  function renderChips() {
    const n = ALL_PROBLEMS.length, s = ALL_PROBLEMS.filter((p) => isSolved(p.id)).length;
    const frac = n ? s / n : 0;
    const R = 6.5, C = 2 * Math.PI * R;
    el.progress.innerHTML = `<svg class="ring" viewBox="0 0 16 16"><circle cx="8" cy="8" r="${R}" fill="none" stroke="var(--rule)" stroke-width="2.5"/><circle cx="8" cy="8" r="${R}" fill="none" stroke="var(--good)" stroke-width="2.5" stroke-dasharray="${C * frac} ${C}" transform="rotate(-90 8 8)" stroke-linecap="round"/></svg><span>${s}<span class="lbl"> / ${n} solved</span></span>`;
    const due = dueList().length;
    el.reviewChip.hidden = !due;
    el.reviewChip.className = 'chip due';
    el.reviewChip.textContent = `${due} to review`;
    el.reviewChip.onclick = () => { location.hash = '#/review'; };
  }
  function markDay() { const d = new Date().toISOString().slice(0, 10); S.days[d] = (S.days[d] || 0) + 1; }

  /* ───────────── Nav ───────────── */
  const TOP_LINKS = [
    ['#/', '⌂', 'Home'],
    ['#/cheats', '▦', 'Cheat sheets'],
    ['#/finder', '⑂', 'Which pattern?'],
    ['#/drill', '◎', 'Pattern drill'],
    ['#/review', '↻', 'Review'],
    ['#/mock', '⏱', 'Mock interview'],
  ];
  function renderNav() {
    const cur = location.hash || '#/';
    const due = dueList().length;
    let html = `<div class="top-links">${TOP_LINKS.map(([h, ic, t]) => `<a href="${h}" class="${cur === h || (h !== '#/' && cur.startsWith(h)) ? 'active' : ''}"><span class="ic">${ic}</span>${t}${h === '#/review' && due ? `<span class="badge">${due}</span>` : ''}</a>`).join('')}</div>`;
    const active = ROUTE.id;
    for (const m of MODS) {
      const st = modStats(m);
      const open = S.open[m.id] ?? (ROUTE.module === m.id);
      html += `<div class="mod ${open ? 'open' : ''}" data-m="${m.id}"><button aria-expanded="${open}"><span class="num">${String(m.n).padStart(2, '0')}</span><span class="t">${esc(m.title)}</span><span class="c ${st.n && st.s === st.n ? 'done' : ''}">${st.n ? `${st.s}/${st.n}` : `${st.lr}/${st.lessons}`}</span><span class="bar"><i style="width:${st.n ? (100 * st.s) / st.n : st.lessons ? (100 * st.lr) / st.lessons : 0}%"></i></span></button><ul>`;
      html += `<li><a class="item ${ROUTE.view === 'module' && ROUTE.id === m.id ? 'active' : ''}" href="#/m/${m.id}"><span class="st lesson">◇</span><span>Overview</span><span></span></a></li>`;
      for (const it of m.items) {
        if (it.lesson) {
          html += `<li><a class="item ${active === it.lesson ? 'active' : ''}" href="#/l/${it.lesson}"><span class="st lesson ${S.read[it.lesson] ? 'read' : ''}">${S.read[it.lesson] ? '✓' : '▤'}</span><span>${esc(it.title)}</span><span></span></a></li>`;
        } else if (it.problem) {
          const p = it.problem;
          html += `<li><a class="item ${active === p.id ? 'active' : ''}" href="#/p/${p.id}"><span class="st dot ${p.diff} ${isSolved(p.id) ? 'solved' : ''}"></span><span>${esc(p.title)}</span><span class="lvl">${p.diff[0]}</span></a></li>`;
        }
      }
      html += '</ul></div>';
    }
    el.nav.innerHTML = html;
    const a = $('.item.active', el.nav) || $('.top-links a.active', el.nav);
    if (a && !navScrolled) { a.scrollIntoView({ block: 'center' }); navScrolled = true; }
  }
  let navScrolled = false;
  el.nav.addEventListener('click', (e) => {
    const b = e.target.closest('.mod > button');
    if (b) {
      const m = b.parentElement; const open = !m.classList.contains('open');
      m.classList.toggle('open', open); b.setAttribute('aria-expanded', open); S.open[m.dataset.m] = open; save();
      return;
    }
    if (e.target.closest('a')) el.app.classList.remove('nav-open');
  });

  /* ───────────── Router ───────────── */
  let ROUTE = { view: 'home' };
  const PAGES = {};  // extras.js registers: home, cheats, drill, finder, review, mock
  function parseRoute() {
    const h = location.hash.replace(/^#\/?/, '');
    const [a, b, c] = h.split('/');
    if (!a) return { view: 'home', page: 'home' };
    if (a === 'l' && LESSON[b]) return { view: 'lesson', id: b, module: LESSON[b].module.id };
    if (a === 'p' && PROBLEM[b]) return { view: 'problem', id: b, tab: c || 'problem', module: PROBLEM[b].module.id };
    if (a === 'm' && MOD[b]) return { view: 'module', id: b, module: b };
    if (PAGES[a]) return { view: 'page', page: a, arg: b };
    return { view: 'home', page: 'home' };
  }
  function route() {
    closePop();
    if (E.pairFromHash()) { S.engine = 'local'; save(); renderEngine(); E.Local.check().then((st) => toast(st === 'ready' ? 'Paired with your JDK runner' : 'Saved the pairing token, but the runner is not reachable')); }
    const prev = ROUTE;
    ROUTE = parseRoute();
    el.app.dataset.view = ROUTE.view === 'problem' ? 'problem' : ROUTE.view === 'lesson' || ROUTE.view === 'module' ? 'lesson' : ROUTE.view === 'page' ? 'page' : 'home';
    if (ROUTE.module && S.open[ROUTE.module] === undefined) S.open[ROUTE.module] = true;
    const sameProblem = prev.view === 'problem' && ROUTE.view === 'problem' && prev.id === ROUTE.id;
    if (ROUTE.view === 'problem') {
      if (!sameProblem) { renderProblem(PROBLEM[ROUTE.id]); loadEditor(PROBLEM[ROUTE.id]); }
      else setProblemTab(ROUTE.tab);
    } else if (ROUTE.view === 'lesson') renderLesson(LESSON[ROUTE.id]);
    else if (ROUTE.view === 'module') renderModule(MOD[ROUTE.id]);
    else {
      const page = PAGES[ROUTE.page] || PAGES.home;
      el.reader.innerHTML = '';
      if (page) page(el.reader, ROUTE.arg);
      enhance(el.reader, {});
    }
    if (!sameProblem) el.pane.scrollTop = 0;
    if (ROUTE.view !== 'page' && ROUTE.view !== 'home') { S.last = location.hash; save(); }
    if (ROUTE.view === 'problem' && !sameProblem && matchMedia('(max-width: 920px)').matches) setMobileTab('read');
    navScrolled = sameProblem;
    renderNav(); renderChips();
    document.title = (ROUTE.view === 'problem' ? PROBLEM[ROUTE.id].title : ROUTE.view === 'lesson' ? LESSON[ROUTE.id].title : ROUTE.view === 'module' ? MOD[ROUTE.id].title : 'Learn the patterns') + ' · DSA Lab';
  }
  window.addEventListener('hashchange', route);

  // mobile tabs
  const setMobileTab = (t) => { el.app.dataset.tab = t; $('#tabRead').classList.toggle('on', t === 'read'); $('#tabCode').classList.toggle('on', t === 'code'); if (t === 'code' && cm) setTimeout(() => cm.refresh(), 0); };
  $('#tabRead').onclick = () => setMobileTab('read');
  $('#tabCode').onclick = () => setMobileTab('code');

  /* ───────────── Enhancement (after rendering markdown) ───────────── */
  const ENHANCERS = [];
  function enhance(root, ctx) {
    for (const m of $$('.viz-mount', root)) {
      let input = null;
      try { input = m.dataset.input ? JSON.parse(m.dataset.input) : null; } catch { /* bad json */ }
      const div = document.createElement('div');
      if (m.dataset.title) div.dataset.title = m.dataset.title;
      m.replaceWith(div);
      V.mount(div, m.dataset.viz, input);
    }
    for (const f of ENHANCERS) f(root, ctx);
  }
  el.reader.addEventListener('click', (e) => {
    const cb = e.target.closest('[data-cb]');
    if (cb) {
      const src = CODE_SRC[cb.closest('.codeblock').dataset.id];
      if (cb.dataset.cb === 'copy') { navigator.clipboard.writeText(src).then(() => toast('Copied')); }
      if (cb.dataset.cb === 'load' && CUR) {
        modal('Replace your code?', '<p>This puts the solution code in the editor. Your current code is replaced (it is not kept).</p>', [{ label: 'Replace', primary: true, fn: () => { cm ? cm.setValue(src) : (fallback.value = src); saveDraft(); if (matchMedia('(max-width: 920px)').matches) setMobileTab('code'); } }]);
      }
      return;
    }
    const q = e.target.closest('.quiz input');
    if (q) {
      const box = q.closest('.quiz'); const qid = box.dataset.qid;
      const [lid, n] = qid.split(':');
      const quiz = (LESSON[lid] || {}).quiz || (PAGES.quizFor && PAGES.quizFor(lid)) || [];
      const spec = quiz[+n]; if (!spec) return;
      S.quiz[qid] = +q.value; save();
      $$('label', box).forEach((lab, k) => { lab.classList.toggle('right', k === spec.answer); lab.classList.toggle('wrong', k === +q.value && k !== spec.answer); $('input', lab).disabled = true; });
      $('.why', box).hidden = false;
    }
  });

  /* ───────────── Lessons & modules ───────────── */
  function pager(id) {
    const i = ITEMS.findIndex((x) => x.id === id);
    const prev = ITEMS[i - 1], next = ITEMS[i + 1];
    const lab = (x) => (x.kind === 'lesson' ? 'Lesson' : 'Problem');
    return `<nav class="pager">${prev ? `<a href="${hrefOf(prev)}"><small>← ${lab(prev)}</small><span>${esc(prev.data.title)}</span></a>` : ''}${next ? `<a class="next" href="${hrefOf(next)}"><small>${lab(next)} →</small><span>${esc(next.data.title)}</span></a>` : ''}</nav>`;
  }
  function renderLesson(l) {
    const m = l.module;
    el.reader.innerHTML = `
      <div class="eyebrow"><a href="#/m/${m.id}">${String(m.n).padStart(2, '0')} · ${esc(m.title)}</a><span class="meta">Lesson${l.mins ? ` · ${l.mins} min` : ''}</span></div>
      <h1>${esc(l.title)}</h1>
      ${l.lede ? `<p class="lede">${inline(l.lede)}</p>` : ''}
      <div class="prose">${md(l.body, { id: l.id, quiz: l.quiz })}</div>
      ${l.practice ? `<h2 class="section-h" style="margin-top:34px">Practice this pattern</h2>${problemList(l.practice)}` : ''}
      ${pager(l.id)}`;
    enhance(el.reader, { lesson: l });
    if (!S.read[l.id]) { S.read[l.id] = Date.now(); save(); }
  }
  function renderModule(m) {
    const st = modStats(m);
    const extra = m.more || [];
    el.reader.innerHTML = `
      <div class="eyebrow"><span>Module ${String(m.n).padStart(2, '0')}</span><span class="meta">${st.lessons} lessons · ${st.n} problems</span></div>
      <h1>${esc(m.title)}</h1>
      ${m.blurb ? `<p class="lede">${inline(m.blurb)}</p>` : ''}
      <div class="prose">
        ${m.intro ? md(m.intro, { id: m.id }) : ''}
        ${m.lessons.length ? `<h2>Lessons</h2><div class="plist">${m.lessons.map((l) => `<a href="#/l/${l.id}"><span class="st ${S.read[l.id] ? 'solved' : ''}" style="${S.read[l.id] ? '' : 'background:var(--accent)'}"></span><span>${esc(l.title)}${l.mins ? ` <small>· ${l.mins} min</small>` : ''}</span><span></span></a>`).join('')}</div>` : ''}
        ${m.problems.length ? `<h2>Problems <span class="small">(${st.s}/${st.n} solved)</span></h2>${problemList(m.problems.map((p) => p.id))}` : ''}
        ${extra.length ? `<h2>More practice on LeetCode</h2><p class="small">Same patterns, graded roughly easy → hard. Solve a few after the problems above; they're where the pattern becomes automatic.</p>${lcList(extra)}` : ''}
      </div>`;
    enhance(el.reader, {});
  }
  function lcList(list) {
    return `<div class="lc-list">${list.map((x) => `<a class="lc" href="https://leetcode.com/problems/${x.slug}/" target="_blank" rel="noopener"><span class="n">#${x.n}</span><span class="t">${esc(x.title)}${x.premium ? '<span class="prem">Premium</span>' : ''}${x.note ? `<small>${inline(x.note)}</small>` : ''}</span><span class="rel ${x.rel}">${esc(relLabel(x.rel))}</span></a>`).join('')}</div>`;
  }
  const relLabel = (r) => ({ same: 'Same problem', variant: 'Variant', harder: 'Harder', easier: 'Easier', similar: 'Same pattern', followup: 'Follow-up' }[r] || r);

  /* ───────────── Problem page ───────────── */
  let CUR = null;
  const paramNames = (p) => (p.fn ? p.fn.params.filter((x) => !(x[2] && x[2].hidden && x[2].show === false)).map((x) => x[1]) : []);
  function inputLines(p, t) {
    if (p.design) return [['ops', JSON.stringify(t.ops)], ['args', H.showValue(t.args, 400)]];
    return p.fn.params.map((x, i) => [x[1], H.showValue(t.args[i], 400)]);
  }
  function expectedFor(p, idx) {
    const t = p.tests[idx];
    if (t.expect !== undefined) return JSON.stringify(t.expect);
    return (EXP[p.id] || [])[idx] ?? null;
  }
  function exampleHtml(p) {
    return p.tests.map((t, idx) => ({ t, idx })).filter((x) => x.t.ex).map(({ t, idx }, k) => {
      const exp = expectedFor(p, idx);
      return `<div class="example"><span class="lbl">Example ${k + 1}</span>${inputLines(p, t).map(([n, v]) => `<div class="row"><span>${esc(n)}</span><span>${esc(v)}</span></div>`).join('')}<div class="row"><span>output</span><span>${esc(H.showOutput(exp || '?'))}</span></div>${t.why ? `<div class="why">${inline(t.why)}</div>` : ''}</div>`;
    }).join('');
  }
  function renderProblem(p) {
    CUR = p;
    const hintsShown = S.hints[p.id] || 0;
    const solved = isSolved(p.id);
    const tabs = [['problem', 'Problem'], ['hints', `Hints<span class="n">${p.hints ? p.hints.length : 0}</span>`], ['solution', 'Solution']];
    if (p.viz) tabs.push(['viz', 'Visualize']);
    if (p.lc && p.lc.length) tabs.push(['practice', `LeetCode<span class="n">${p.lc.length}</span>`]);
    const mock = PAGES.mockState && PAGES.mockState();
    const hideMeta = mock && mock.active && mock.ids.includes(p.id);
    el.reader.innerHTML = `
      ${hideMeta ? PAGES.mockBar() : ''}
      <div class="eyebrow"><a href="#/m/${p.module.id}">${String(p.module.n).padStart(2, '0')} · ${esc(p.module.title)}</a><span class="meta">Problem</span></div>
      <h1>${esc(p.title)}</h1>
      <div class="p-head"><span class="diff ${p.diff}">${p.diff}</span>${hideMeta ? '' : (p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}${solved ? '<span class="solved-pill">✓ Solved</span>' : ''}</div>
      <div class="p-tabs" role="tablist">${tabs.filter(([k]) => !(hideMeta && (k === 'solution' || k === 'practice'))).map(([k, t]) => `<button data-pt="${k}" role="tab">${t}</button>`).join('')}</div>
      <section data-panel="problem">
        <div class="statement">${md(p.statement, { problem: p })}</div>
        <div class="examples">${exampleHtml(p)}</div>
        ${p.constraints ? `<div class="section-h">Constraints</div><ul class="constraints">${p.constraints.map((c) => `<li>${inline(c)}</li>`).join('')}</ul>` : ''}
        ${p.note ? `<div class="statement">${md(p.note, { problem: p })}</div>` : ''}
        <div class="section-h">How to work it</div>
        <p class="small" style="font:14px/1.55 var(--f-ui);color:var(--ink-2);max-width:68ch">Say the brute force out loud first, then find its bottleneck. <b>Run</b> checks the examples; <b>Submit</b> adds edge cases and large inputs that catch slow solutions. Stuck for 15+ minutes? Take one hint at a time.</p>
      </section>
      <section data-panel="hints" hidden></section>
      <section data-panel="solution" hidden></section>
      ${p.viz ? '<section data-panel="viz" hidden></section>' : ''}
      ${p.lc ? `<section data-panel="practice" hidden><p class="small" style="font:14.5px/1.55 var(--f-ui);color:var(--ink-2);max-width:68ch">Practice the same idea on LeetCode. “Same problem” means the classic version of this exercise; the others reuse the pattern with a twist.</p>${lcList(p.lc)}</section>` : ''}
      ${hideMeta ? '' : pager(p.id)}`;
    renderHints(p, hintsShown);
    setProblemTab(ROUTE.tab || 'problem');
    enhance(el.reader, { problem: p });
    $('.p-tabs', el.reader).addEventListener('click', (e) => {
      const b = e.target.closest('[data-pt]'); if (!b) return;
      history.replaceState(null, '', `#/p/${p.id}${b.dataset.pt === 'problem' ? '' : '/' + b.dataset.pt}`);
      setProblemTab(b.dataset.pt);
    });
  }
  function setProblemTab(tab) {
    const p = CUR; if (!p) return;
    const panels = $$('[data-panel]', el.reader);
    if (!panels.some((x) => x.dataset.panel === tab)) tab = 'problem';
    panels.forEach((x) => { x.hidden = x.dataset.panel !== tab; });
    $$('.p-tabs [data-pt]', el.reader).forEach((b) => b.classList.toggle('on', b.dataset.pt === tab));
    if (tab === 'solution') renderSolution(p);
    if (tab === 'viz') {
      const sec = $('[data-panel="viz"]', el.reader);
      if (!sec.dataset.done) {
        sec.dataset.done = 1;
        const vs = Array.isArray(p.viz) ? p.viz : [p.viz];
        sec.innerHTML = vs.map((v) => `${v.note ? `<div class="statement">${md(v.note)}</div>` : ''}<div class="viz-mount" data-viz="${esc(v.id)}" data-input="${esc(v.input ? JSON.stringify(v.input) : '')}" data-title="${esc(v.title || '')}"></div>`).join('');
        enhance(sec, { problem: p });
      }
    }
  }
  function renderHints(p, shown) {
    const sec = $('[data-panel="hints"]', el.reader); if (!sec) return;
    const hs = p.hints || [];
    if (!hs.length) { sec.innerHTML = '<p class="small">No hints for this one.</p>'; return; }
    sec.innerHTML = `<div class="hints">${hs.slice(0, shown).map((h, k) => `<div class="hint-card"><b class="h">Hint ${k + 1}</b>${md(h)}</div>`).join('')}${shown < hs.length ? `<div class="hint-locked"><span>${shown ? `${hs.length - shown} more hint${hs.length - shown > 1 ? 's' : ''}.` : `${hs.length} hints, from a nudge to nearly the answer.`} Try for a few more minutes before you open the next one.</span><button class="btn" data-hint>Show hint ${shown + 1}</button></div>` : '<p class="small" style="font:14px var(--f-ui);color:var(--ink-3)">That’s every hint. Next stop: the Solution tab.</p>'}</div>`;
    const b = $('[data-hint]', sec);
    if (b) b.onclick = () => { S.hints[p.id] = shown + 1; save(); renderHints(p, shown + 1); };
  }
  function renderSolution(p) {
    const sec = $('[data-panel="solution"]', el.reader);
    if (!sec || sec.dataset.done) return;
    const s = p.solution;
    if (!S.seen[p.id] && !isSolved(p.id)) {
      sec.innerHTML = `<div class="gate"><p><b>Try it first?</b> Reading the solution before a real attempt turns a lesson into trivia. If you’re stuck, the hints get you there with most of the learning left intact.</p><button class="btn" data-g="hints">Show hints instead</button> <button class="btn primary" data-g="show">Show the solution</button></div>`;
      sec.onclick = (e) => {
        const g = e.target.closest('[data-g]'); if (!g) return;
        if (g.dataset.g === 'hints') { history.replaceState(null, '', `#/p/${p.id}/hints`); setProblemTab('hints'); }
        else { S.seen[p.id] = Date.now(); save(); sec.onclick = null; renderSolution(p); }
      };
      return;
    }
    sec.dataset.done = 1;
    const alts = s.alts || [];
    sec.innerHTML = `
      <div class="prose">
        ${s.pattern ? `<div class="callout key"><b>Pattern</b>${md(s.pattern)}</div>` : ''}
        ${s.intuition ? `<h2 style="border:0;padding-top:0;margin-top:6px">Intuition</h2>${md(s.intuition, { problem: p })}` : ''}
        ${s.steps ? `<h2>Algorithm</h2>${md(s.steps, { problem: p })}` : ''}
        <h2>Java solution</h2>
        ${codeBlock(s.java, { label: 'Solution.java', ctx: { problem: p } })}
        <div class="cx"><div><small>Time</small><b>${esc(s.time || '?')}</b>${s.timeWhy ? `<span>${inline(s.timeWhy)}</span>` : ''}</div><div><small>Space</small><b>${esc(s.space || '?')}</b>${s.spaceWhy ? `<span>${inline(s.spaceWhy)}</span>` : ''}</div></div>
        ${s.walk ? `<h2>Walkthrough</h2>${md(s.walk, { problem: p })}` : ''}
        ${s.why ? `<h2>Why it works</h2>${md(s.why, { problem: p })}` : ''}
        ${s.pitfalls ? `<h2>Pitfalls</h2>${md(s.pitfalls, { problem: p })}` : ''}
        ${alts.length ? `<h2>Other approaches</h2><div class="alts">${alts.map((a) => `<details><summary>${esc(a.name)}<span class="cxs">${esc(a.time || '')}${a.space ? ' time · ' + esc(a.space) + ' space' : ''}</span></summary><div class="body">${a.note ? md(a.note) : ''}${a.java ? codeBlock(a.java, { label: a.name, ctx: { problem: p } }) : ''}</div></details>`).join('')}</div>` : ''}
        ${s.followups ? `<h2>Follow-ups interviewers ask</h2>${md(s.followups, { problem: p })}` : ''}
        ${s.talk ? `<div class="callout interview"><b>Say it in the interview</b>${md(s.talk)}</div>` : ''}
      </div>`;
    enhance(sec, { problem: p });
  }

  /* ───────────── Code panel ───────────── */
  let cm = null, fallback = null;
  const touch = matchMedia('(pointer: coarse)').matches;
  function starterFor(p) {
    if (p.starter) return p.starter;
    const sig = (params) => params.filter((x) => !(x[2] && x[2].hidden)).map(([t, n]) => `${t} ${n}`).join(', ');
    if (p.design) {
      const d = p.design;
      return `class ${d.cls} {\n\n    public ${d.cls}(${sig(d.ctor || [])}) {\n        \n    }\n${Object.entries(d.methods).map(([m, s]) => `\n    public ${s.ret} ${m}(${sig(s.params || [])}) {\n        \n    }\n`).join('')}}\n`;
    }
    return `class Solution {\n    public ${p.fn.ret} ${p.fn.name}(${sig(p.fn.params)}) {\n        \n    }\n}\n`;
  }
  function initEditor() {
    const wrap = $('#editorWrap');
    if (window.CodeMirror) {
      cm = window.CodeMirror(wrap, {
        mode: 'text/x-java', lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false, smartIndent: true,
        matchBrackets: true, autoCloseBrackets: true, styleActiveLine: true, lineWrapping: false,
        inputStyle: touch ? 'contenteditable' : 'textarea', viewportMargin: 50,
        extraKeys: {
          'Ctrl-Enter': () => runCode('run'), 'Cmd-Enter': () => runCode('run'),
          'Shift-Ctrl-Enter': () => runCode('submit'), 'Shift-Cmd-Enter': () => runCode('submit'),
          'Ctrl-/': 'toggleComment', 'Cmd-/': 'toggleComment',
          Tab: (c) => (c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('    ', 'end')),
          'Shift-Tab': (c) => c.indentSelection('subtract'),
        },
      });
      cm.on('change', debounce(saveDraft, 400));
      cm.on('change', () => { if (cm.__marks) { cm.__marks.forEach((m) => m.clear()); cm.__marks = null; for (let i = 0; i < cm.lineCount(); i++) cm.removeLineClass(i, 'background', 'err-line'); } });
    } else {
      fallback = document.createElement('textarea'); fallback.className = 'fallback'; fallback.spellcheck = false; wrap.appendChild(fallback);
      fallback.addEventListener('input', debounce(saveDraft, 400));
      fallback.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runCode(e.shiftKey ? 'submit' : 'run'); }
        if (e.key === 'Tab') { e.preventDefault(); const s = fallback.selectionStart; fallback.setRangeText('    ', s, fallback.selectionEnd, 'end'); }
      });
    }
  }
  const getCode = () => (cm ? cm.getValue() : fallback.value);
  function saveDraft() {
    if (!CUR) return;
    const code = getCode();
    if (code === starterFor(CUR)) delete S.drafts[CUR.id]; else S.drafts[CUR.id] = code;
    save();
  }
  const LAST = {};  // problem id → last results html
  function loadEditor(p) {
    const code = S.drafts[p.id] ?? starterFor(p);
    el.fileName.textContent = H.mainClassOf(p) + '.java';
    if (cm) { cm.setValue(code); cm.clearHistory(); setTimeout(() => cm.refresh(), 0); }
    else fallback.value = code;
    setResTab('tests');
    el.resBody.innerHTML = LAST[p.id] || emptyResults(p);
  }
  function emptyResults(p) {
    const ex = p.tests.filter((t) => t.ex).length;
    return `<div class="res-empty"><div><b>Run</b> checks the ${ex} example${ex > 1 ? 's' : ''}. <b>Submit</b> runs all ${p.tests.length} tests.</div><div>Use <code>System.out.println</code> freely. Output shows up under each test.</div>${engine() === 'browser' && E.Browser.state !== 'ready' ? '<div>The first run loads the in-browser Java compiler (~6 MB, cached after that).</div>' : ''}</div>`;
  }
  el.reset.onclick = () => {
    if (!CUR) return;
    modal('Reset to the starter code?', '<p>Your current code for this problem is replaced by the starter code.</p>', [{ label: 'Reset', primary: true, fn: () => { const s = starterFor(CUR); cm ? cm.setValue(s) : (fallback.value = s); delete S.drafts[CUR.id]; save(); } }]);
  };

  // results tabs
  let resTab = 'tests';
  function setResTab(t) {
    resTab = t;
    $$('.res-tabs [data-rt]').forEach((b) => b.classList.toggle('on', b.dataset.rt === t));
    if (t === 'custom') renderCustom();
    else el.resBody.innerHTML = (CUR && LAST[CUR.id]) || (CUR ? emptyResults(CUR) : '');
  }
  $('.res-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-rt]'); if (b) setResTab(b.dataset.rt); });
  function defaultCustom(p) {
    const t = p.tests.find((x) => x.ex) || p.tests[0];
    if (p.design) return JSON.stringify(t.ops) + '\n' + JSON.stringify(t.args);
    return p.fn.params.map((x, i) => JSON.stringify(t.args[i])).join('\n');
  }
  function renderCustom() {
    const p = CUR; if (!p) return;
    const names = p.design ? ['operations', 'arguments'] : p.fn.params.map((x) => x[1]);
    el.resBody.innerHTML = `<div class="custom-box"><label>One JSON value per line: ${names.map((n) => `<code>${esc(n)}</code>`).join(', ')}. Add more cases below, ${names.length} lines each.</label><textarea spellcheck="false" id="customIn">${esc(S.custom[p.id] ?? defaultCustom(p))}</textarea><div class="row"><button class="tbtn go" id="customRun">Run custom input</button><button class="tbtn" id="customReset">Reset to example</button><span class="res-note">The expected answer comes from the reference solution.</span></div><div id="customOut"></div></div>`;
    $('#customIn').oninput = debounce(() => { S.custom[p.id] = $('#customIn').value; save(); }, 300);
    $('#customRun').onclick = () => runCode('custom');
    $('#customReset').onclick = () => { delete S.custom[p.id]; save(); renderCustom(); };
  }
  function parseCustom(p, text) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const per = p.design ? 2 : p.fn.params.length;
    if (!lines.length || lines.length % per) throw new Error(`expected ${per} line${per > 1 ? 's' : ''} per case, got ${lines.length}`);
    const tests = [];
    for (let i = 0; i < lines.length; i += per) {
      const vals = lines.slice(i, i + per).map((l, k) => { try { return JSON.parse(l); } catch { throw new Error(`line ${i + k + 1} is not valid JSON: ${l.slice(0, 40)}`); } });
      if (p.design) {
        if (!Array.isArray(vals[0]) || !Array.isArray(vals[1]) || vals[0].length !== vals[1].length) throw new Error('operations and arguments must be two arrays of the same length');
        if (vals[0][0] !== p.design.cls) throw new Error(`the first operation must be "${p.design.cls}"`);
        tests.push({ ops: vals[0], args: vals[1] });
      } else {
        p.fn.params.forEach(([type, name], k) => checkType(type, vals[k], name));
        tests.push({ args: vals });
      }
    }
    if (tests.length > 20) throw new Error('at most 20 custom cases at a time');
    return tests;
  }
  function checkType(type, v, name) {
    const bad = (what) => { throw new Error(`${name} should be ${what}`); };
    if (type === 'int' || type === 'long') { if (!Number.isInteger(v)) bad('an integer'); }
    else if (type === 'double') { if (typeof v !== 'number') bad('a number'); }
    else if (type === 'boolean') { if (typeof v !== 'boolean') bad('true or false'); }
    else if (type === 'String') { if (typeof v !== 'string') bad('a string in double quotes'); }
    else if (type === 'char') { if (typeof v !== 'string' || v.length !== 1) bad('a one-character string like "a"'); }
    else if (/\[\]$|^List</.test(type) || type === 'ListNode' || type === 'TreeNode') { if (!Array.isArray(v) && !(type === 'char[]' && typeof v === 'string')) bad('a JSON array'); }
  }

  /* engine switch */
  const engine = () => (S.engine === 'local' ? 'local' : 'browser');
  function renderEngine() {
    $$('#engineSw button').forEach((b) => b.classList.toggle('on', b.dataset.e === engine()));
    const st = el.engineState;
    if (engine() === 'browser') {
      const b = E.Browser;
      st.className = 'engine-state ' + (b.state === 'loading' ? 'busy' : b.state === 'error' ? 'err' : '');
      st.textContent = b.state === 'loading' ? 'loading Java compiler…' : b.state === 'ready' ? 'javac + TeaVM · in this tab' : b.state === 'error' ? 'compiler unavailable' : 'Java in this tab';
      st.title = b.error || '';
      el.run.disabled = el.submit.disabled = b.state === 'error' || running;
    } else {
      const l = E.Local;
      st.className = 'engine-state ' + (l.state === 'ready' ? 'ok' : l.state === 'checking' ? 'busy' : 'err');
      st.textContent = l.state === 'ready' ? `JDK ${l.java} · runner` : l.state === 'checking' ? 'looking for the runner…' : l.state === 'unpaired' ? 'runner found, not paired' : 'runner not running';
      st.title = l.error || '';
      el.run.disabled = el.submit.disabled = running;
    }
  }
  E.Browser.listeners.add(renderEngine);
  E.Local.listeners.add(renderEngine);
  el.engineSw.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.engine = b.dataset.e; save(); renderEngine();
    if (S.engine === 'local') {
      const st = await E.Local.check();
      if (st !== 'ready') engineHelp();
    } else E.Browser.init().catch(() => {});
  });
  function engineHelp() {
    const l = E.Local;
    const hosted = location.origin === 'https://anadi198.github.io';
    modal('Run Java with your own JDK', `
      <p><b>In-browser</b> (default) compiles with a real <code>javac</code> that runs as WebAssembly in this tab. It works on any device, and nothing leaves your browser.</p>
      <p><b>Your JDK</b> sends your code to a small runner on this computer that uses your installed JDK. Choose it for real JVM timing and full stack traces.</p>
      <p>Status: <b>${esc(l.state === 'ready' ? 'connected — JDK ' + l.java : l.state === 'unpaired' ? 'runner found but this page is not paired' : 'runner not reachable')}</b></p>
      <ol style="padding-left:20px">
        <li>Install a JDK (17 or newer) and Node.js 18+.</li>
        <li>From the <code>learn-dsa</code> folder, run:<pre>node runner/server.mjs</pre></li>
        <li>Open the link it prints. <code>http://localhost:8788/</code> comes paired already${hosted ? '. The <code>#pair=…</code> link pairs this hosted site' : ''}.</li>
      </ol>`, [{ label: 'Check again', primary: true, fn: () => { E.Local.check().then((s) => toast(s === 'ready' ? 'Connected to your JDK' : 'Still not connected')); } }]);
  }

  /* ───────────── Running & grading ───────────── */
  let running = false;
  el.run.onclick = () => runCode('run');
  el.submit.onclick = () => runCode('submit');
  const TL_MS = 2500;   // per test

  async function execute(p, files, tests, { ref = false, onProgress } = {}) {
    // Returns { compile, results[] } where each result is { status: 'ran'|'error'|'tle'|'skip', out, ns, stdout, error }
    const n = tests.length;
    const results = new Array(n).fill(null);
    const mode = ref ? 'ref' : 'user';
    if (engine() === 'local') {
      const argSets = ref ? [['0'], ['0', 'ref']] : [['0']];
      const r = await E.Local.compileRun(files, 'Main', argSets, { timeoutMs: 20000 });
      if (!r.compile.ok) return { compile: r.compile };
      const one = (run) => {
        const parsed = H.parseRun(run.stdout, n);
        const res = parsed.results.map((x) => x && { ...x });
        if (!parsed.done) {
          const t = parsed.last >= 0 ? parsed.last : res.findIndex((x) => !x || x.status === 'running');
          if (t >= 0) res[t] = { ...(res[t] || { stdout: [] }), status: run.timedOut ? 'tle' : 'error', error: run.timedOut ? 'Time limit exceeded' : (run.stderr || 'the JVM exited early').split('\n').slice(0, 6).join('\n') };
          for (let k = 0; k < n; k++) if (!res[k] || res[k].status === 'running') res[k] = { status: 'skip', stdout: [] };
        }
        return { res, stray: parsed.stray, stderr: run.stderr };
      };
      const u = one(r.runs[0]);
      const out = { compile: r.compile, results: u.res, stray: u.stray, stderr: u.stderr };
      if (ref) out.refResults = one(r.runs[1]).res;
      return out;
    }
    // in-browser
    const c = await E.Browser.compile(files, 'Main');
    const compile = { ok: c.ok, ms: c.ms, diagnostics: (c.diags || []).filter((d) => d.severity === 'error') };
    if (!c.ok) return { compile };
    const runAll = async (which) => {
      const res = new Array(n).fill(null);
      let from = 0, stray = [];
      const deadline = performance.now() + 30000;
      while (from < n) {
        const r = await E.Browser.run(c.wasm, [String(from), which], { timeoutMs: Math.max(1000, Math.min(TL_MS * 2 + 1500, deadline - performance.now())) });
        const parsed = H.parseRun(r.stdout, n);
        stray = stray.concat(parsed.stray);
        for (let k = from; k < n; k++) if (parsed.results[k]) res[k] = parsed.results[k];
        if (onProgress) onProgress(res);
        if (parsed.done) break;
        const t = parsed.last >= 0 ? parsed.last : (() => { for (let k = from; k < n; k++) if (!res[k] || res[k].status === 'running') return k; return -1; })();
        if (t < 0) break;
        if (r.timedOut) { res[t] = { ...(res[t] || { stdout: [] }), status: 'tle', error: 'Time limit exceeded' }; for (let k = t + 1; k < n; k++) res[k] = { status: 'skip', stdout: [] }; break; }
        res[t] = { ...(res[t] || { stdout: [] }), status: 'error', error: H.friendlyTrap(r.trap || 'the program stopped unexpectedly'), trap: true };
        from = t + 1;
      }
      for (let k = 0; k < n; k++) if (!res[k]) res[k] = { status: 'skip', stdout: [] };
      return { res, stray };
    };
    const u = await runAll(mode === 'ref' ? 'user' : 'user');
    const out = { compile, results: u.res, stray: u.stray };
    if (ref) out.refResults = (await runAll('ref')).res;
    return out;
  }

  function status(msg, cls = 'busy') { el.resBody.innerHTML = `<div class="res-note"><span class="spin"></span> ${msg}</div>`; }

  async function runCode(kind) {
    const p = CUR;
    if (!p || running) return;
    if (kind === 'custom' && resTab !== 'custom') setResTab('custom');
    if (kind !== 'custom') setResTab('tests');
    if (matchMedia('(max-width: 920px)').matches) setMobileTab('code');
    saveDraft();
    const code = getCode();
    let tests, idx, withRef = false;
    if (kind === 'custom') {
      try { tests = parseCustom(p, $('#customIn').value); } catch (e) { $('#customOut').innerHTML = `<div class="res-note" style="color:var(--term-bad)">${esc(e.message)}</div>`; return; }
      idx = tests.map(() => -1); withRef = true;
    } else {
      idx = p.tests.map((t, i) => i).filter((i) => kind === 'submit' || p.tests[i].ex);
      tests = idx.map((i) => p.tests[i]);
    }
    if (engine() === 'local' && E.Local.state !== 'ready') {
      const st = await E.Local.check();
      if (st !== 'ready') { engineHelp(); return; }
    }
    running = true; renderEngine();
    const target = kind === 'custom' ? $('#customOut') : el.resBody;
    const say = (m) => { target.innerHTML = `<div class="res-note"><span class="spin"></span> ${m}</div>`; };
    say(engine() === 'browser' && E.Browser.state !== 'ready' ? 'Loading the Java compiler (first run only)…' : 'Compiling…');
    const t0 = performance.now();
    try {
      const { files } = H.buildFiles(p, code, tests, { withRef, engine: engine() === 'browser' ? 'browser' : 'jdk' });
      if (engine() === 'browser') await E.Browser.init();
      say(`Compiling${engine() === 'local' ? ' with your JDK' : ''}…`);
      const r = await execute(p, files, tests, {
        ref: withRef,
        onProgress: (res) => { const done = res.filter((x) => x && x.status !== 'running').length; say(`Running tests… ${done}/${tests.length}`); },
      });
      const html = kind === 'custom' ? customHtml(p, tests, r) : resultsHtml(p, kind, tests, idx, r, performance.now() - t0);
      target.innerHTML = html;
      if (kind !== 'custom') { LAST[p.id] = html; wireResults(target); }
      if (!r.compile.ok) markErrors(r.compile.diagnostics);
    } catch (e) {
      target.innerHTML = `<div class="verdict no"><b>Could not run</b></div><div class="res-note">${esc(e.message || e)}</div>`;
      if (kind !== 'custom') LAST[p.id] = target.innerHTML;
    } finally {
      running = false; renderEngine();
    }
  }

  function markErrors(diags) {
    if (!cm) return;
    const user = H.mainClassOf(CUR) + '.java';
    cm.__marks = [];
    for (const d of diags) {
      if (d.file !== user || !(d.line > 0)) continue;
      const line = d.line - 1;
      cm.addLineClass(line, 'background', 'err-line');
      const col = Math.max(0, (d.col || 1) - 1 - (line === 0 ? H.IMPORTS.length : 0));
      const text = cm.getLine(line) || '';
      let end = col; while (end < text.length && /[\w$]/.test(text[end])) end++;
      if (end === col) end = Math.min(text.length, col + 1);
      cm.__marks.push(cm.markText({ line, ch: col }, { line, ch: end }, { className: 'err-mark' }));
    }
  }

  function diagHtml(p, diags) {
    const user = H.mainClassOf(p) + '.java';
    const sig = p.fn ? `${p.fn.name}(${p.fn.params.filter((x) => !(x[2] && x[2].hidden)).map((x) => x[0]).join(', ')})` : '';
    const shown = diags.slice(0, 12).map((d) => {
      const mine = d.file === user;
      let msg = d.message;
      let where = mine && d.line > 0 ? `line ${d.line}${d.col && d.line > 1 ? ':' + d.col : ''}` : d.file ? `${d.file}${d.line > 0 ? ':' + d.line : ''}` : 'compiler';
      if (!mine && d.file === 'Main.java') msg = `The test harness couldn't call your code: ${msg}\n→ Keep the class and method signature from the starter code${sig ? `: ${sig} returning ${p.fn.ret}` : ''}.`;
      if (d.type === 'teavm' || (!d.file && engine() === 'browser')) msg += '\n→ The in-browser Java library may not support this API. Try another approach, or switch to “Your JDK”.';
      return `<div class="diag" data-line="${mine ? d.line : ''}"><span class="where">${esc(where)}</span><pre>${esc(msg)}</pre></div>`;
    }).join('');
    return shown + (diags.length > 12 ? `<div class="res-note">… and ${diags.length - 12} more</div>` : '');
  }

  function resultsHtml(p, kind, tests, idx, r, ms) {
    if (!r.compile.ok) return `<div class="verdict no"><b>Compile error</b><span>${r.compile.diagnostics.length} error${r.compile.diagnostics.length === 1 ? '' : 's'}</span></div>${diagHtml(p, r.compile.diagnostics)}`;
    const mode = p.compare || 'exact';
    const rows = tests.map((t, k) => {
      const res = r.results[k] || { status: 'skip' };
      const i = idx[k];
      const exp = expectedFor(p, i);
      let ok = false, why = '';
      if (res.status === 'ran') {
        if (exp == null) why = 'no expected answer (run tools/build.mjs)';
        else { const c = H.compare(exp, res.out, mode, { validate: p.validate, args: t.args }); ok = c.ok; why = c.why || ''; }
        if (ok && res.ns / 1e6 > (p.tl || TL_MS) && t.big) { ok = false; res.status = 'slow'; }
      }
      return { t, k, i, res, exp, ok, why };
    });
    const pass = rows.filter((x) => x.ok).length;
    const firstBad = rows.find((x) => !x.ok);
    const totalMs = rows.reduce((a, x) => a + (x.res.ns || 0), 0) / 1e6;
    let verdict;
    if (!firstBad) verdict = `<div class="verdict ok"><b>${kind === 'submit' ? 'Accepted' : 'Examples pass'}</b><span>${pass}/${rows.length} tests · ${fmtMs(totalMs)} in your code</span></div>`;
    else {
      const st = firstBad.res.status;
      const name = st === 'error' ? 'Runtime error' : st === 'tle' || st === 'slow' ? 'Time limit exceeded' : st === 'skip' ? 'Not run' : 'Wrong answer';
      verdict = `<div class="verdict no"><b>${name}</b><span>${pass}/${rows.length} passed${kind === 'run' ? ' (examples)' : ''}</span></div>`;
    }
    let note = '';
    if (!firstBad && kind === 'run') note = `<div class="res-note">Now <b>Submit</b> to run all ${p.tests.length} tests, including edge cases and large inputs.</div>`;
    if (firstBad && (firstBad.res.status === 'tle' || firstBad.res.status === 'slow')) note = `<div class="res-note">Test ${firstBad.i + 1} ${firstBad.t.big ? 'is a large input' : ''}${firstBad.res.status === 'slow' ? ` took ${fmtMs(firstBad.res.ns / 1e6)} (limit ${fmtMs(p.tl || TL_MS)})` : ' did not finish in time'}. Look for a loop inside a loop, or repeated work you could cache.${engine() === 'browser' ? ' (The in-browser JVM is slower than a real one; a correct optimal solution still finishes well within the limit.)' : ''}</div>`;
    if (firstBad && firstBad.res.trap) note = `<div class="res-note">The in-browser engine stops the program on this error without a stack trace. <b>Your JDK</b> shows the exact line.</div>`;
    const chips = rows.map((x) => `<button class="tchip ${x.ok ? 'ok' : x.res.status === 'skip' ? 'skip' : 'no'}" data-k="${x.k}" title="${x.t.big ? 'large input' : ''}">${x.ok ? '✓' : x.res.status === 'skip' ? '·' : '✗'} ${x.i >= 0 ? x.i + 1 : x.k + 1}${x.t.big ? '·L' : ''}</button>`).join('');
    const details = rows.map((x) => `<div class="tdetail" data-k="${x.k}" hidden>${detailHtml(p, x)}</div>`).join('');
    const strayOut = (r.stray || []).filter((l) => !l.startsWith('@@@ERR')).length ? `<div class="res-note">Printed outside a test:</div><pre class="stdout">${esc(r.stray.join('\n'))}</pre>` : '';
    const html = `${verdict}${note}<div class="tchips">${chips}</div>${details}${strayOut}`;
    if (kind === 'submit' && !firstBad) setTimeout(() => onAccepted(p), 30);
    if (kind === 'submit') { S.tries[p.id] = (S.tries[p.id] || 0) + 1; save(); }
    rows.__first = firstBad ? firstBad.k : 0;
    return html.replace('<div class="tchips">', `<div class="tchips" data-first="${firstBad ? firstBad.k : 0}">`);
  }
  const fmtMs = (ms) => (ms < 1 ? `${ms.toFixed(2)} ms` : ms < 100 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`);
  function detailHtml(p, x) {
    const lines = inputLines(p, x.t).map(([n, v]) => `<div class="kv"><span>${esc(n)}</span><span>${esc(v)}</span></div>`).join('');
    const res = x.res;
    let outRow;
    if (res.status === 'ran' || res.status === 'slow') outRow = `<div class="kv ${x.ok ? 'good' : 'bad'}"><span>output</span><span>${esc(H.showOutput(res.out))}</span></div>`;
    else if (res.status === 'error') outRow = `<div class="kv bad"><span>error</span><span>${esc(res.error)}</span></div>`;
    else if (res.status === 'tle') outRow = `<div class="kv bad"><span>result</span><span>Time limit exceeded — stopped</span></div>`;
    else outRow = `<div class="kv"><span>result</span><span class="dim">not run (an earlier test stopped the program)</span></div>`;
    const expRow = `<div class="kv"><span>expected</span><span>${esc(H.showOutput(x.exp))}${p.compare && p.compare !== 'exact' ? ` <span class="dim">(any order)</span>` : ''}${p.validate ? ' <span class="dim">(any valid answer)</span>' : ''}</span></div>`;
    const why = x.why ? `<div class="kv bad"><span>why</span><span>${esc(x.why)}</span></div>` : '';
    const time = res.ns ? `<div class="kv"><span>time</span><span class="dim">${fmtMs(res.ns / 1e6)}</span></div>` : '';
    const so = res.stdout && res.stdout.length ? `<div class="kv"><span>stdout</span><pre>${esc(res.stdout.join('\n'))}</pre></div>` : '';
    return lines + outRow + expRow + why + time + so;
  }
  function wireResults(root) {
    const chips = $('.tchips', root);
    if (!chips) { $$('.diag', root).forEach((d) => d.addEventListener('click', () => { const ln = +d.dataset.line; if (ln && cm) { cm.focus(); cm.setCursor({ line: ln - 1, ch: 0 }); if (matchMedia('(max-width: 920px)').matches) setMobileTab('code'); } })); return; }
    const show = (k) => {
      $$('.tchip', root).forEach((c) => c.classList.toggle('sel', c.dataset.k === String(k)));
      $$('.tdetail', root).forEach((d) => { d.hidden = d.dataset.k !== String(k); });
    };
    chips.addEventListener('click', (e) => { const c = e.target.closest('.tchip'); if (c) show(c.dataset.k); });
    show(chips.dataset.first || 0);
  }
  el.resBody.addEventListener('click', (e) => {
    const d = e.target.closest('.diag');
    if (d && d.dataset.line && cm) { cm.focus(); cm.setCursor({ line: +d.dataset.line - 1, ch: 0 }); }
    const c = e.target.closest('.tchip');
    if (c && !c.closest('[data-wired]')) {
      const root = el.resBody;
      $$('.tchip', root).forEach((x) => x.classList.toggle('sel', x === c));
      $$('.tdetail', root).forEach((x) => { x.hidden = x.dataset.k !== c.dataset.k; });
    }
  });
  // LAST html is re-inserted as a string; re-select the first failing chip whenever results show
  new MutationObserver(() => {
    const chips = $('.tchips', el.resBody);
    if (chips && !$('.tdetail:not([hidden])', el.resBody)) {
      const k = chips.dataset.first || 0;
      $$('.tchip', el.resBody).forEach((x) => x.classList.toggle('sel', x.dataset.k === String(k)));
      $$('.tdetail', el.resBody).forEach((x) => { x.hidden = x.dataset.k !== String(k); });
    }
  }).observe(el.resBody, { childList: true });

  function customHtml(p, tests, r) {
    if (!r.compile.ok) return `<div class="verdict no"><b>Compile error</b></div>${diagHtml(p, r.compile.diagnostics)}`;
    return tests.map((t, k) => {
      const u = r.results[k] || { status: 'skip' }, ref = (r.refResults || [])[k] || { status: 'skip' };
      const mine = u.status === 'ran' ? u.out : u.status === 'error' ? 'error: ' + u.error : u.status === 'tle' ? 'time limit exceeded' : 'not run';
      const exp = ref.status === 'ran' ? ref.out : ref.status === 'error' ? `(the reference solution rejects this input: ${ref.error})` : '—';
      const same = u.status === 'ran' && ref.status === 'ran' && H.compare(ref.out, u.out, p.compare || 'exact', { validate: p.validate, args: t.args }).ok;
      return `<div class="tdetail" style="margin-top:8px">${inputLines(p, t).map(([n, v]) => `<div class="kv"><span>${esc(n)}</span><span>${esc(v)}</span></div>`).join('')}<div class="kv ${same ? 'good' : 'bad'}"><span>output</span><span>${esc(H.showOutput(mine))}</span></div><div class="kv"><span>expected</span><span>${esc(H.showOutput(exp))}</span></div>${u.ns ? `<div class="kv"><span>time</span><span class="dim">${fmtMs(u.ns / 1e6)}</span></div>` : ''}${u.stdout && u.stdout.length ? `<div class="kv"><span>stdout</span><pre>${esc(u.stdout.join('\n'))}</pre></div>` : ''}</div>`;
    }).join('');
  }

  /* ───────────── Solved + spaced review ───────────── */
  function onAccepted(p) {
    const first = !S.solved[p.id];
    const rec = S.solved[p.id] || { first: Date.now(), n: 0 };
    rec.n++; rec.at = Date.now();
    rec.hints = Math.max(rec.hints || 0, S.hints[p.id] || 0);
    rec.sawSolution = rec.sawSolution || !!S.seen[p.id];
    S.solved[p.id] = rec;
    markDay(); save();
    renderNav(); renderChips();
    const pill = $('.p-head', el.reader);
    if (pill && !$('.solved-pill', pill)) pill.insertAdjacentHTML('beforeend', '<span class="solved-pill">✓ Solved</span>');
    if (first) confetti();
    askRating(p);
  }
  function askRating(p) {
    const box = document.createElement('div');
    box.className = 'rate';
    const sug = S.seen[p.id] ? 'again' : (S.hints[p.id] || 0) >= 2 ? 'hard' : 'good';
    box.innerHTML = `<b>Solved! When should you see it again?</b>${[['again', 'Tomorrow', 'I needed the solution'], ['hard', 'In 3 days', 'Struggled'], ['good', 'In a week', 'Got it'], ['easy', 'In 3 weeks', 'Easy']].map(([k, t, s]) => `<button class="btn ${k === sug ? 'primary' : ''}" data-r="${k}" title="${s}">${t}<span class="k">${s}</span></button>`).join('')}`;
    const sec = $('[data-panel="problem"]', el.reader);
    $$('.rate', el.reader).forEach((x) => x.remove());
    if (sec) sec.prepend(box);
    const resBox = document.createElement('div'); resBox.className = 'res-note'; resBox.innerHTML = 'Scheduled for review? Pick when to see this again, at the top of the problem.';
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      schedule(p.id, b.dataset.r);
      const r = S.review[p.id];
      box.innerHTML = `<b>✓ Next review in ${Math.round(r.ivl)} day${r.ivl >= 2 ? 's' : ''}.</b> ${nextSuggestion(p)}`;
      renderChips(); renderNav();
    });
  }
  function schedule(id, rating) {
    const r = S.review[id] || { ivl: 0, reps: 0 };
    const base = { again: 1, hard: 3, good: 7, easy: 21 }[rating];
    const mult = { again: 0, hard: 1.3, good: 2.3, easy: 3.2 }[rating];
    r.ivl = r.reps && rating !== 'again' ? Math.max(base, Math.round(r.ivl * mult)) : base;
    r.reps = rating === 'again' ? 0 : r.reps + 1;
    r.last = Date.now(); r.due = Date.now() + r.ivl * DAY - 3600000; r.rating = rating;
    S.review[id] = r; save();
  }
  function nextSuggestion(p) {
    const i = ITEMS.findIndex((x) => x.id === p.id);
    const next = ITEMS.slice(i + 1).find((x) => x.kind === 'problem' && !isSolved(x.id));
    return next ? `Next up: <a href="#/p/${next.id}">${esc(next.data.title)}</a>` : '';
  }
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div'); box.className = 'confetti';
    const cols = ['#5A3EA6', '#237148', '#C17A0B', '#1F5F99', '#B3261E', '#B7A3F5'];
    for (let k = 0; k < 60; k++) {
      const i = document.createElement('i');
      i.style.left = Math.random() * 100 + 'vw'; i.style.background = cols[k % cols.length];
      i.style.animationDelay = Math.random() * 0.4 + 's'; i.style.animationDuration = 1 + Math.random() * 0.8 + 's';
      box.appendChild(i);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 2600);
  }

  /* ───────────── Splitters ───────────── */
  (function splitters() {
    const split = $('#split'), vsplit = $('#vsplit');
    const w = localStorage.getItem('dsalab.codeW'); if (w) el.app.style.setProperty('--code-w', w);
    const rh = localStorage.getItem('dsalab.resH'); if (rh) el.code.style.setProperty('--results-h', rh);
    split.addEventListener('pointerdown', (e) => {
      split.classList.add('drag'); split.setPointerCapture(e.pointerId);
      const move = (ev) => { const px = Math.max(340, Math.min(window.innerWidth - 420, window.innerWidth - ev.clientX)); el.app.style.setProperty('--code-w', px + 'px'); };
      const up = () => { split.classList.remove('drag'); split.removeEventListener('pointermove', move); try { localStorage.setItem('dsalab.codeW', el.app.style.getPropertyValue('--code-w')); } catch { /* */ } if (cm) cm.refresh(); };
      split.addEventListener('pointermove', move); split.addEventListener('pointerup', up, { once: true });
    });
    vsplit.addEventListener('pointerdown', (e) => {
      vsplit.classList.add('drag'); vsplit.setPointerCapture(e.pointerId);
      const box = el.code.getBoundingClientRect();
      const move = (ev) => { const px = Math.max(90, Math.min(box.height - 160, box.bottom - ev.clientY - 44)); el.code.style.setProperty('--results-h', px + 'px'); };
      const up = () => { vsplit.classList.remove('drag'); vsplit.removeEventListener('pointermove', move); try { localStorage.setItem('dsalab.resH', el.code.style.getPropertyValue('--results-h')); } catch { /* */ } if (cm) cm.refresh(); };
      vsplit.addEventListener('pointermove', move); vsplit.addEventListener('pointerup', up, { once: true });
    });
  })();

  /* ───────────── Self-test (run in the browser console) ───────────── */
  // await dsaSelfTest()                 every problem's reference solution on the current engine
  // await dsaSelfTest({ filter: 'two' }) only matching ids
  window.dsaSelfTest = async function ({ filter = '', quiet = false } = {}) {
    const list = ALL_PROBLEMS.filter((p) => p.id.includes(filter));
    const fails = [];
    const t0 = performance.now();
    if (engine() === 'browser') await E.Browser.init();
    for (const [k, p] of list.entries()) {
      const { files } = H.buildFiles(p, p.solution.java, p.tests, { engine: engine() === 'browser' ? 'browser' : 'jdk' });
      let r;
      try { r = await execute(p, files, p.tests); } catch (e) { fails.push({ id: p.id, why: String(e.message || e) }); continue; }
      if (!r.compile.ok) { fails.push({ id: p.id, why: 'compile: ' + r.compile.diagnostics.map((d) => `${d.file}:${d.line} ${d.message}`).join(' | ') }); continue; }
      p.tests.forEach((t, i) => {
        const res = r.results[i];
        const exp = expectedFor(p, i);
        if (!res || res.status !== 'ran') { fails.push({ id: p.id, test: i, why: res ? res.status + ' ' + (res.error || '') : 'no result' }); return; }
        const c = H.compare(exp, res.out, p.compare || 'exact', { validate: p.validate, args: t.args });
        if (!c.ok) fails.push({ id: p.id, test: i, why: `got ${H.showOutput(res.out, 120)} expected ${H.showOutput(exp, 120)}` });
        else if (t.big && res.ns / 1e6 > (p.tl || TL_MS)) fails.push({ id: p.id, test: i, why: `slow: ${Math.round(res.ns / 1e6)} ms` });
      });
      if (!quiet) console.log(`[${k + 1}/${list.length}] ${p.id} ${fails.some((f) => f.id === p.id) ? '✗' : '✓'}`);
    }
    const msg = `dsaSelfTest (${engine()}): ${list.length - new Set(fails.map((f) => f.id)).size}/${list.length} problems pass in ${((performance.now() - t0) / 1000).toFixed(0)} s`;
    console.log(msg); if (fails.length) console.table(fails);
    return { ok: !fails.length, fails, msg };
  };

  /* ───────────── Boot ───────────── */
  window.DSAApp = {
    S, save, saveNow, md, inline, esc, codeBlock, problemList, lcList, quizHtml, enhance, toast, modal, popover,
    PROBLEM, LESSON, MOD, MODS, ITEMS, ALL_PROBLEMS, PAGES, ENHANCERS, isSolved, dueList, schedule, modStats, markDay,
    route, renderNav, renderChips, relLabel, get CUR() { return CUR; }, get state() { return S; },
  };
  initEditor();
  renderEngine();
  document.addEventListener('DOMContentLoaded', () => {});
  // extras.js loads after this file and registers pages, then calls DSAApp.start()
  window.DSAApp.start = function () {
    if (window.DSALAB_JUST_PAIRED) { S.engine = 'local'; save(); setTimeout(() => toast('Paired with your JDK runner'), 300); }
    if (S.engine === 'local') E.Local.check();
    else if (location.protocol !== 'file:') setTimeout(() => E.Browser.init().catch(() => {}), 1200);
    route();
  };
})();

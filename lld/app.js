/* LLD Lab: routing, outline, lessons, exercises, code panel, grading, Claude reviews, progress. */
(function () {
  'use strict';
  const H = window.LLDHarness, L = window.LLD, V = window.LLDViz, E = window.LLDEngine;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const DAY = 86400000;
  const narrow = () => matchMedia('(max-width: 920px)').matches;

  /* ───────────── State ─────────────
   * Everything that syncs carries a timestamp so two devices can merge (see mergeState). */
  const KEY = 'lldlab.v1';
  const blank = () => ({
    v: 1, done: {}, tries: {}, drafts: {}, hints: {}, seen: {}, read: {}, cards: {}, quiz: {}, reviews: {}, weak: {},
    days: {}, last: null, drill: { n: 0, right: 0, by: {} },
    // device-only
    open: {}, engine: 'browser', focus: false, review: { model: 'opus', effort: 'medium' },
  });
  let S;
  try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || 'null') || {}); } catch { S = blank(); }
  const listeners = new Set();
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* full or blocked */ } };
  const save = debounce(() => { persist(); for (const f of listeners) f(); }, 250);
  const saveNow = () => { persist(); for (const f of listeners) f(); };
  window.addEventListener('beforeunload', persist);

  /* ───────────── Content index ───────────── */
  const MODS = L.modules;
  const ITEMS = [], LESSON = {}, EX = {}, MOD = {};
  MODS.forEach((m, mi) => {
    m.n = mi; MOD[m.id] = m;
    m.lessons = []; m.exercises = []; m.units = [];
    for (const it of m.items) {
      if (it.lesson) { const l = { ...it, id: it.lesson, module: m }; LESSON[l.id] = l; m.lessons.push(l); m.units.push(l); ITEMS.push({ kind: 'lesson', id: l.id, data: l, module: m }); }
      else if (it.exercise) { const x = it.exercise; x.module = m; x.kind = x.kind || 'build'; EX[x.id] = x; m.exercises.push(x); m.units.push(x); ITEMS.push({ kind: 'exercise', id: x.id, data: x, module: m }); }
    }
  });
  const ALL_EX = ITEMS.filter((x) => x.kind === 'exercise').map((x) => x.data);
  const hrefOf = (it) => (it.kind === 'lesson' ? `#/l/${it.id}` : `#/x/${it.id}`);
  const isDone = (id) => !!(S.done[id] || S.read[id]);
  const itemMins = (it) => it.data.mins || (it.kind === 'lesson' ? 6 : 12);
  const PATTERNS = L.patterns || {};

  /* ───────────── Mini Markdown ───────────── */
  function inline(s) {
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
    const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => /^ */.exec(l)[0].length));
    const Ls = lines.map((l) => l.slice(Math.min(ind, /^ */.exec(l)[0].length)));
    let out = '', i = 0;
    const para = [];
    const flush = () => { if (para.length) { out += `<p>${inline(para.join(' '))}</p>`; para.length = 0; } };
    while (i < Ls.length) {
      const line = Ls[i];
      if (!line.trim()) { flush(); i++; continue; }
      let m;
      if ((m = /^(?:```|~~~)(\w*)\s*(.*)$/.exec(line))) {
        flush();
        const lang = m[1] || 'java', lbl = m[2] || '';
        const buf = []; i++;
        while (i < Ls.length && !/^(?:```|~~~)\s*$/.test(Ls[i])) buf.push(Ls[i++]);
        i++;
        if (lang === 'mermaid') out += `<div class="mmd-mount" data-src="${esc(buf.join('\n'))}"></div>${lbl ? `<p class="fig-cap">${inline(lbl)}</p>` : ''}`;
        else if (lang === 'seq') out += `<div class="seq-mount" data-src="${esc(buf.join('\n'))}" data-title="${esc(lbl)}"></div>`;
        else out += codeBlock(buf.join('\n'), { lang, label: lbl, ctx });
        continue;
      }
      if ((m = /^:::(\w+)\s*(.*)$/.exec(line))) {
        flush();
        const kind = m[1], title = m[2];
        const buf = []; i++;
        let depth = 0;
        while (i < Ls.length) {
          if (/^:::\w/.test(Ls[i])) depth++;
          else if (/^:::\s*$/.test(Ls[i])) { if (!depth) break; depth--; }
          buf.push(Ls[i++]);
        }
        i++;
        out += `<div class="callout ${kind}">${title ? `<b>${inline(title)}</b>` : ''}${md(buf.join('\n'), ctx)}</div>`;
        continue;
      }
      if ((m = /^@(\w+)\s*(.*)$/.exec(line))) { flush(); i++; out += directive(m[1], m[2], ctx); continue; }
      if (/^\?\? /.test(line)) {
        flush();
        let cards = '';
        while (i < Ls.length && /^\?\? /.test(Ls[i])) {
          const q = Ls[i].slice(3); i++;
          const ans = [];
          while (i < Ls.length && Ls[i].trim()) ans.push(Ls[i++]);
          while (i < Ls.length && !Ls[i].trim() && i + 1 < Ls.length && /^\?\? /.test(Ls[i + 1])) i++;
          cards += `<details class="card"><summary>${inline(q)}</summary><div class="ans">${md(ans.join('\n'), ctx)}</div></details>`;
        }
        out += `<div class="cards">${cards}</div>`;
        continue;
      }
      if ((m = /^(#{2,4})\s+(.*)$/.exec(line))) { flush(); out += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; i++; continue; }
      if (/^\|.*\|\s*$/.test(line)) {
        flush();
        const rows = [];
        while (i < Ls.length && /^\|.*\|\s*$/.test(Ls[i])) rows.push(Ls[i++]);
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
        while (i < Ls.length && (/^\s*[-*] /.test(Ls[i]) || /^\s*\d+\. /.test(Ls[i]) || (/^\s{2,}\S/.test(Ls[i]) && items.length))) {
          if (/^\s*[-*] /.test(Ls[i]) || /^\s*\d+\. /.test(Ls[i])) items.push(Ls[i].replace(/^\s*(?:[-*]|\d+\.) /, ''));
          else items[items.length - 1] += ' ' + Ls[i].trim();
          i++;
        }
        out += `<${ordered ? 'ol' : 'ul'}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`;
        continue;
      }
      if (/^</.test(line)) { flush(); const buf = []; while (i < Ls.length && Ls[i].trim()) buf.push(Ls[i++]); out += buf.join('\n'); continue; }
      para.push(line.trim()); i++;
    }
    flush();
    return out;
  }
  const CODE_SRC = {};
  function codeBlock(src, { lang = 'java', label = '', ctx = {} } = {}) {
    const body = lang === 'java' ? V.highlightJava(src) : esc(src);
    const id = 'cb' + Math.random().toString(36).slice(2, 8);
    CODE_SRC[id] = src;
    const canLoad = lang === 'java' && ctx.exercise && ctx.loadable;
    return `<div class="codeblock" data-id="${id}"><pre>${body}</pre><div class="cb-bar">${label ? `<span class="lbl">${esc(label)}</span>` : '<span class="lbl"></span>'}<button class="btn quiet" data-cb="copy">Copy</button>${canLoad ? '<button class="btn quiet" data-cb="load" title="Replace the editor contents with this code">Load into editor</button>' : ''}</div></div>`;
  }
  function directive(name, rest, ctx) {
    rest = rest.trim();
    if (name === 'quiz') { const q = (ctx.quiz || [])[+rest]; return q ? quizHtml(q, `${ctx.id}:${rest}`) : ''; }
    if (name === 'exercises') return exList(rest.split(/\s+/).filter(Boolean));
    if (name === 'pattern') return patternCard(rest);
    if (name === 'family') return familyCard(rest);
    if (name === 'stop') return `<div class="stop-here"><span>✓</span><div><b>Good place to stop.</b> Everything so far is saved. Come back to the next part any time.</div></div>`;
    return '';
  }
  function exList(ids) {
    return `<div class="plist">${ids.map((id) => {
      const x = EX[id]; if (!x) return `<span class="small">unknown exercise ${esc(id)}</span>`;
      return `<a href="#/x/${id}"><span class="st ${S.done[id] ? 'solved' : x.diff || 'easy'}"></span><span>${esc(x.title)} <small>· ${esc(kindLabel(x))} · ${x.mins || 12} min</small></span><span class="diff ${x.diff || 'easy'}" style="font-size:10px;padding:3px 7px">${x.diff || 'easy'}</span></a>`;
    }).join('')}</div>`;
  }
  const kindLabel = (x) => ({ build: 'Build', refactor: 'Refactor', design: 'Design' }[x.kind] || 'Build') + (x.jdk ? ' · JDK' : '');
  function patternCard(id) {
    const p = PATTERNS[id]; if (!p) return '';
    const f = L.families[p.family] || {};
    return `<div class="pcard tier${p.tier}"><div class="pc-top"><span class="fam ${esc(p.family)}">${esc(f.label || p.family)}</span>${p.tier === 1 ? '<span class="tierchip">core</span>' : p.tier === 2 ? '<span class="tierchip t2">next</span>' : '<span class="tierchip t3">recognise</span>'}</div><h4>${esc(p.label)}</h4><p>${inline(p.one)}</p><p class="cue"><b>Cue:</b> ${inline(p.cue)}</p>${p.lesson && LESSON[p.lesson] ? `<a href="#/l/${p.lesson}">Lesson →</a>` : ''}</div>`;
  }
  function familyCard(id) {
    const f = L.families[id]; if (!f) return '';
    const ps = Object.entries(PATTERNS).filter(([, p]) => p.family === id && p.tier <= 2);
    return `<div class="famcard ${esc(id)}"><b>${esc(f.label)}</b><span>${inline(f.one)}</span><div>${ps.map(([k, p]) => `<span class="pchip tier${p.tier}">${esc(p.label)}</span>`).join('')}</div></div>`;
  }
  function quizHtml(q, qid) {
    const chosen = S.quiz[qid] ? S.quiz[qid].pick : undefined;
    return `<div class="quiz" data-qid="${esc(qid)}"><p class="q"><span class="qt">Quiz</span><span>${inline(q.q)}</span></p>${q.options.map((o, k) => `<label class="${chosen !== undefined ? (k === q.answer ? 'right' : k === chosen ? 'wrong' : '') : ''}"><input type="radio" name="${esc(qid)}" value="${k}" ${chosen === k ? 'checked' : ''} ${chosen !== undefined ? 'disabled' : ''}><span>${inline(o)}</span></label>`).join('')}<div class="why" ${chosen === undefined ? 'hidden' : ''}>${md(q.why)}</div></div>`;
  }

  /* ───────────── Elements ───────────── */
  const el = {
    app: $('#app'), nav: $('#nav'), reader: $('#reader'), pane: $('#readerPane'), code: $('#code'),
    fileTabs: $('#fileTabs'), engineSw: $('#engineSw'), engineState: $('#engineState'), resBody: $('#resBody'),
    run: $('#runBtn'), submit: $('#submitBtn'), reviewBtn: $('#reviewBtn'), reset: $('#resetCode'),
    progress: $('#progressChip'), todayChip: $('#todayChip'), focusBtn: $('#focusBtn'), codeHint: $('#codeHint'),
  };

  function toast(msg, ms = 2600) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  /* ───────────── Theme / nav / focus / menu ───────────── */
  (function theme() {
    const saved = localStorage.getItem('lldlab.theme');
    if (saved) document.documentElement.dataset.theme = saved;
    $('#themeBtn').onclick = () => {
      const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('lldlab.theme', document.documentElement.dataset.theme); } catch { /* ignore */ }
    };
  })();
  $('#navToggle').onclick = () => {
    if (narrow()) el.app.classList.toggle('nav-open');
    else el.app.classList.toggle('nav-hidden');
  };
  document.addEventListener('click', (e) => {
    if (el.app.classList.contains('nav-open') && !e.target.closest('.nav') && !e.target.closest('#navToggle')) el.app.classList.remove('nav-open');
  });
  function setFocus(on) {
    S.focus = !!on; save();
    el.app.classList.toggle('focus', S.focus);
    el.focusBtn.classList.toggle('on', S.focus);
    el.focusBtn.title = S.focus ? 'Leave focus mode (Esc)' : 'Focus mode: hide everything but this step';
    if (cm) setTimeout(() => cm.refresh(), 0);
  }
  el.focusBtn.onclick = () => setFocus(!S.focus);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.focus && !$('.modal-back')) setFocus(false); });

  $('#menuBtn').onclick = (e) => {
    popover(e.currentTarget, `
      <a class="item" href="#/setup"><b>Setup</b><span>Your JDK, Claude reviews and cloud sync</span></a>
      <button class="item" data-m="export"><b>Export progress</b><span>Copy your progress as text</span></button>
      <button class="item" data-m="import"><b>Import progress</b><span>Paste progress exported from another device</span></button>
      <hr>
      <a class="item" href="../"><b>All labs</b><span>Back to Deep End</span></a>
      <a class="item" href="https://github.com/anadi198/anadi198.github.io/tree/main/lld" target="_blank" rel="noopener"><b>Source on GitHub</b><span>anadi198/anadi198.github.io, folder lld</span></a>
      <hr>
      <button class="item" data-m="reset"><b>Reset all progress…</b><span>Clears exercises, drafts, reviews and cards in this browser</span></button>`,
    (m) => {
      if (m === 'export') modal('Export progress', `<p>Copy this text and import it on another device (⋯ → Import progress). Cloud sync does this for you once it is set up.</p><textarea readonly style="width:100%;min-height:160px;font:12px/1.4 var(--f-mono)">${esc(btoa(unescape(encodeURIComponent(JSON.stringify(S)))))}</textarea>`, [{ label: 'Copy', primary: true, fn: (m2) => { navigator.clipboard.writeText($('textarea', m2).value); toast('Copied'); } }]);
      if (m === 'import') modal('Import progress', '<p>Paste exported progress. It replaces the progress in this browser.</p><textarea style="width:100%;min-height:160px;font:12px/1.4 var(--f-mono)"></textarea>', [{ label: 'Import', primary: true, fn: (m2) => {
        try { const v = JSON.parse(decodeURIComponent(escape(atob($('textarea', m2).value.trim())))); if (!v || v.v !== 1) throw new Error('not LLD Lab progress'); S = Object.assign(blank(), v); saveNow(); location.reload(); }
        catch (err) { toast('Could not import: ' + err.message); return false; }
      } }]);
      if (m === 'reset') modal('Reset all progress?', '<p>This clears finished exercises, code drafts, hints, quiz answers, reviews and review cards in this browser. If cloud sync is on, sign out first or the cloud copy comes back.</p>', [{ label: 'Reset everything', danger: true, fn: () => { S = blank(); saveNow(); location.hash = '#/'; location.reload(); } }]);
    });
  };
  function popover(anchor, html, onPick) {
    closePop();
    const p = document.createElement('div'); p.className = 'pop'; p.innerHTML = html; document.body.appendChild(p);
    const r = anchor.getBoundingClientRect();
    p.style.top = r.bottom + 6 + 'px';
    p.style.left = Math.max(16, Math.min(window.innerWidth - p.offsetWidth - 16, r.right - p.offsetWidth)) + 'px';
    p.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) { closePop(); onPick(b.dataset.m); } else if (e.target.closest('a')) closePop(); });
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
  function modStats(m) {
    const n = m.units.length;
    const d = m.units.filter((u) => isDone(u.id)).length;
    return { n, d, ex: m.exercises.length, exd: m.exercises.filter((x) => S.done[x.id]).length, lessons: m.lessons.length, lr: m.lessons.filter((l) => S.read[l.id]).length };
  }
  function nextItem() {
    // resume where you stopped if that unit is unfinished, else the first unfinished unit in course order
    if (S.last && S.last.hash) {
      const [, k, id] = S.last.hash.split('/');
      const it = ITEMS.find((x) => x.id === id && (k === 'l' ? x.kind === 'lesson' : x.kind === 'exercise'));
      if (it && !isDone(it.id)) return { it, resume: true };
      if (it) { const i = ITEMS.indexOf(it); const nx = ITEMS.slice(i + 1).find((x) => !isDone(x.id)); if (nx) return { it: nx, resume: false }; }
    }
    const nx = ITEMS.find((x) => !isDone(x.id));
    return nx ? { it: nx, resume: false } : null;
  }
  function markDay() { const d = new Date().toISOString().slice(0, 10); S.days[d] = (S.days[d] || 0) + 1; }
  const cardsDue = () => (window.LLDToday ? window.LLDToday.dueCount() : 0);
  function renderChips() {
    const n = ITEMS.length, d = ITEMS.filter((x) => isDone(x.id)).length;
    const frac = n ? d / n : 0;
    const R = 6.5, C = 2 * Math.PI * R;
    el.progress.innerHTML = `<svg class="ring" viewBox="0 0 16 16"><circle cx="8" cy="8" r="${R}" fill="none" stroke="var(--rule)" stroke-width="2.5"/><circle cx="8" cy="8" r="${R}" fill="none" stroke="var(--good)" stroke-width="2.5" stroke-dasharray="${C * frac} ${C}" transform="rotate(-90 8 8)" stroke-linecap="round"/></svg><span>${d}<span class="lbl"> / ${n} steps</span></span>`;
    const due = cardsDue();
    el.todayChip.hidden = !due;
    el.todayChip.textContent = `Today: ${due} card${due === 1 ? '' : 's'}`;
    el.todayChip.onclick = () => { location.hash = '#/today'; };
  }

  /* ───────────── Nav ───────────── */
  const TOP_LINKS = [
    ['#/', '⌂', 'Home'],
    ['#/today', '☀', 'Today (5 min)'],
    ['#/patterns', '◈', 'Pattern map'],
    ['#/drill', '◎', 'Pattern drill'],
    ['#/cheats', '▦', 'Cheat sheets'],
  ];
  function renderNav() {
    const cur = location.hash || '#/';
    const due = cardsDue();
    let html = `<div class="top-links">${TOP_LINKS.map(([h, ic, t]) => `<a href="${h}" class="${cur === h || (h !== '#/' && cur.startsWith(h)) ? 'active' : ''}"><span class="ic">${ic}</span>${t}${h === '#/today' && due ? `<span class="badge">${due}</span>` : ''}</a>`).join('')}</div>`;
    const active = ROUTE.id;
    for (const m of MODS) {
      const st = modStats(m);
      const open = S.open[m.id] ?? (ROUTE.module === m.id);
      html += `<div class="mod ${open ? 'open' : ''}" data-m="${m.id}"><button aria-expanded="${open}"><span class="num">${String(m.n).padStart(2, '0')}</span><span class="t">${esc(m.title)}</span><span class="c ${st.n && st.d === st.n ? 'done' : ''}">${st.d}/${st.n}</span><span class="bar"><i style="width:${st.n ? (100 * st.d) / st.n : 0}%"></i></span></button><ul>`;
      html += `<li><a class="item ${ROUTE.view === 'module' && ROUTE.id === m.id ? 'active' : ''}" href="#/m/${m.id}"><span class="st lesson">◇</span><span>Overview</span><span></span></a></li>`;
      for (const u of m.units) {
        const isL = !!LESSON[u.id] && LESSON[u.id] === u;
        if (isL) html += `<li><a class="item ${active === u.id ? 'active' : ''}" href="#/l/${u.id}"><span class="st lesson ${S.read[u.id] ? 'read' : ''}">${S.read[u.id] ? '✓' : '▤'}</span><span>${esc(u.title)}</span><span class="lvl">${u.mins || 6}m</span></a></li>`;
        else html += `<li><a class="item ${active === u.id ? 'active' : ''}" href="#/x/${u.id}"><span class="st dot ${u.diff || 'easy'} ${S.done[u.id] ? 'solved' : ''}"></span><span>${esc(u.title)}</span><span class="lvl">${u.kind === 'design' ? 'D' : u.jdk ? 'J' : (u.diff || 'e')[0]}</span></a></li>`;
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
  const PAGES = {};  // extras.js registers: home, today, patterns, drill, cheats, setup
  function parseRoute() {
    const h = location.hash.replace(/^#\/?/, '');
    const [a, b, c] = h.split('/');
    if (!a) return { view: 'home', page: 'home' };
    if (a === 'l' && LESSON[b]) return { view: 'lesson', id: b, module: LESSON[b].module.id };
    if (a === 'x' && EX[b]) return { view: 'exercise', id: b, tab: c || 'task', module: EX[b].module.id };
    if (a === 'm' && MOD[b]) return { view: 'module', id: b, module: b };
    if (PAGES[a]) return { view: 'page', page: a, arg: b };
    return { view: 'home', page: 'home' };
  }
  function route() {
    closePop();
    if (E.pairFromHash()) { S.engine = 'local'; save(); renderEngine(); E.Local.check().then((st) => toast(st === 'ready' ? 'Paired with your JDK runner' : 'Saved the pairing token, but the runner is not reachable')); }
    const prev = ROUTE;
    ROUTE = parseRoute();
    el.app.dataset.view = ROUTE.view === 'exercise' ? 'problem' : ROUTE.view === 'lesson' || ROUTE.view === 'module' ? 'lesson' : ROUTE.view === 'page' ? 'page' : 'home';
    if (ROUTE.module && S.open[ROUTE.module] === undefined) S.open[ROUTE.module] = true;
    const same = prev.view === 'exercise' && ROUTE.view === 'exercise' && prev.id === ROUTE.id;
    if (ROUTE.view === 'exercise') {
      if (!same) { renderExercise(EX[ROUTE.id]); loadEditor(EX[ROUTE.id]); }
      else setExTab(ROUTE.tab);
    } else if (ROUTE.view === 'lesson') renderLesson(LESSON[ROUTE.id]);
    else if (ROUTE.view === 'module') renderModule(MOD[ROUTE.id]);
    else {
      CUR = null;
      const page = PAGES[ROUTE.page] || PAGES.home;
      el.reader.innerHTML = '';
      if (page) page(el.reader, ROUTE.arg);
      enhance(el.reader, {});
    }
    if (!same) el.pane.scrollTop = 0;
    if (ROUTE.view === 'lesson' || ROUTE.view === 'exercise') { S.last = { hash: location.hash.split('/').slice(0, 3).join('/'), at: Date.now() }; save(); }
    if (ROUTE.view === 'exercise' && !same && narrow()) setMobileTab('read');
    navScrolled = same;
    renderNav(); renderChips();
    document.title = (ROUTE.view === 'exercise' ? EX[ROUTE.id].title : ROUTE.view === 'lesson' ? LESSON[ROUTE.id].title : ROUTE.view === 'module' ? MOD[ROUTE.id].title : 'Low-level design, one pattern at a time') + ' · LLD Lab';
  }
  window.addEventListener('hashchange', route);

  const setMobileTab = (t) => { el.app.dataset.tab = t; $('#tabRead').classList.toggle('on', t === 'read'); $('#tabCode').classList.toggle('on', t === 'code'); if (t === 'code' && cm) setTimeout(() => cm.refresh(), 0); };
  $('#tabRead').onclick = () => setMobileTab('read');
  $('#tabCode').onclick = () => setMobileTab('code');

  /* ───────────── Enhancement (after rendering markdown) ───────────── */
  const ENHANCERS = [];
  function enhance(root, ctx) {
    for (const m of $$('.seq-mount', root)) { const d = document.createElement('div'); m.replaceWith(d); V.mountSeq(d, m.dataset.src, m.dataset.title); }
    for (const m of $$('.mmd-mount', root)) { const d = document.createElement('div'); d.dataset.src = m.dataset.src; m.replaceWith(d); V.mountMermaid(d); }
    for (const f of ENHANCERS) f(root, ctx);
  }
  el.reader.addEventListener('click', (e) => {
    const cb = e.target.closest('[data-cb]');
    if (cb) {
      const src = CODE_SRC[cb.closest('.codeblock').dataset.id];
      if (cb.dataset.cb === 'copy') navigator.clipboard.writeText(src).then(() => toast('Copied'));
      if (cb.dataset.cb === 'load' && CUR) {
        modal('Replace your code?', '<p>This puts the model answer in the editor. Your current code is replaced (it is not kept).</p>', [{ label: 'Replace', primary: true, fn: () => { setCode(src); saveDraft(); if (narrow()) setMobileTab('code'); } }]);
      }
      return;
    }
    const q = e.target.closest('.quiz input');
    if (q) {
      const box = q.closest('.quiz'); const qid = box.dataset.qid;
      const [lid, n] = qid.split(':');
      const quiz = (LESSON[lid] || {}).quiz || (PAGES.quizFor && PAGES.quizFor(lid)) || [];
      const spec = quiz[+n]; if (!spec) return;
      S.quiz[qid] = { pick: +q.value, right: +q.value === spec.answer, at: Date.now() }; save();
      $$('label', box).forEach((lab, k) => { lab.classList.toggle('right', k === spec.answer); lab.classList.toggle('wrong', k === +q.value && k !== spec.answer); $('input', lab).disabled = true; });
      $('.why', box).hidden = false;
    }
  });

  /* ───────────── Lessons & modules ───────────── */
  function pager(id) {
    const i = ITEMS.findIndex((x) => x.id === id);
    const prev = ITEMS[i - 1], next = ITEMS[i + 1];
    const lab = (x) => (x.kind === 'lesson' ? 'Lesson' : 'Exercise');
    return `<nav class="pager">${prev ? `<a href="${hrefOf(prev)}"><small>← ${lab(prev)}</small><span>${esc(prev.data.title)}</span></a>` : ''}${next ? `<a class="next" href="${hrefOf(next)}"><small>${lab(next)} →</small><span>${esc(next.data.title)}</span></a>` : ''}</nav>`;
  }
  function unitBar(m, id) {
    const k = m.units.findIndex((u) => u.id === id);
    return `<div class="unitbar" title="Where you are in this module">${m.units.map((u, j) => `<i class="${isDone(u.id) ? 'done' : ''} ${j === k ? 'here' : ''}"></i>`).join('')}<span>${k + 1} of ${m.units.length}</span></div>`;
  }
  function nextCard(id) {
    const i = ITEMS.findIndex((x) => x.id === id);
    const next = ITEMS.slice(i + 1).find((x) => !isDone(x.id)) || ITEMS[i + 1];
    const due = cardsDue();
    return `<div class="next-card">
      <div class="nc-left"><small>Next up</small>${next ? `<a href="${hrefOf(next)}" class="nc-title">${esc(next.data.title)}</a><span class="nc-meta">${next.kind === 'lesson' ? 'Lesson' : kindLabel(next.data)} · about ${itemMins(next)} min</span>` : '<span class="nc-title">You finished the course. Keep the daily review going.</span>'}</div>
      <div class="nc-right">${next ? `<a class="btn primary" href="${hrefOf(next)}">Go →</a>` : ''}${due ? `<a class="btn" href="#/today">Or: today's ${due} card${due === 1 ? '' : 's'}</a>` : ''}</div>
    </div>`;
  }
  function renderLesson(l) {
    CUR = null;
    const m = l.module;
    el.reader.innerHTML = `
      <div class="eyebrow"><a href="#/m/${m.id}">${String(m.n).padStart(2, '0')} · ${esc(m.title)}</a><span class="meta">Lesson · ${l.mins || 6} min</span></div>
      ${unitBar(m, l.id)}
      <h1>${esc(l.title)}</h1>
      ${l.remember ? `<div class="remember"><small>Remember this</small><p>${inline(l.remember)}</p></div>` : ''}
      ${l.lede ? `<p class="lede">${inline(l.lede)}</p>` : ''}
      <div class="prose">${md(l.body, { id: l.id, quiz: l.quiz })}</div>
      ${l.cue ? `<div class="cuecard"><small>Cue card</small><p>${inline(l.cue)}</p></div>` : ''}
      <div class="lesson-end" data-end="${l.id}">
        <div class="stop-here"><span>✓</span><div><b>${S.read[l.id] ? 'Done.' : 'Reached the end: marked as done.'}</b> ${l.remember || l.cue ? 'The remember line and cue card join your 5-minute daily review, so you do not have to memorise them now.' : 'Good place to stop.'}</div></div>
        ${nextCard(l.id)}
      </div>
      ${pager(l.id)}`;
    enhance(el.reader, { lesson: l });
    const end = $('.lesson-end', el.reader);
    const mark = () => { if (!S.read[l.id]) { S.read[l.id] = Date.now(); markDay(); if (window.LLDToday) window.LLDToday.seedLesson(l); save(); renderNav(); renderChips(); } };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { mark(); io.disconnect(); } }, { root: el.pane, threshold: 0.3 });
      io.observe(end);
    } else mark();
  }
  function renderModule(m) {
    CUR = null;
    const st = modStats(m);
    el.reader.innerHTML = `
      <div class="eyebrow"><span>Module ${String(m.n).padStart(2, '0')}</span><span class="meta">${st.lessons} lessons · ${st.ex} exercises · about ${m.units.reduce((a, u) => a + (u.mins || (LESSON[u.id] === u ? 6 : 12)), 0)} min</span></div>
      <h1>${esc(m.title)}</h1>
      ${m.blurb ? `<p class="lede">${inline(m.blurb)}</p>` : ''}
      <div class="prose">
        ${m.intro ? md(m.intro, { id: m.id }) : ''}
        <h2>Steps <span class="small">(${st.d}/${st.n} done)</span></h2>
        <div class="plist steps">${m.units.map((u, k) => { const isL = LESSON[u.id] === u; return `<a href="${isL ? '#/l/' : '#/x/'}${u.id}"><span class="st ${isDone(u.id) ? 'solved' : isL ? '' : u.diff || 'easy'}" style="${isDone(u.id) || !isL ? '' : 'background:var(--accent)'}"></span><span>${k + 1}. ${esc(u.title)} <small>· ${isL ? 'Lesson' : kindLabel(u)} · ${u.mins || (isL ? 6 : 12)} min</small></span><span></span></a>`; }).join('')}</div>
      </div>`;
    enhance(el.reader, {});
  }

  /* ───────────── Exercise page ───────────── */
  let CUR = null;
  function renderExercise(x) {
    CUR = x;
    const done = !!S.done[x.id];
    const tagsHidden = x.blind && !done;
    const tabs = [['task', 'Task'], ['hints', `Hints<span class="n">${x.hints ? x.hints.length : 0}</span>`], ['solution', x.kind === 'design' ? 'Model answer' : 'Solution'], ['reviews', `Reviews${(S.reviews[x.id] || []).length ? `<span class="n">${S.reviews[x.id].length}</span>` : ''}`]];
    const m = x.module;
    el.reader.innerHTML = `
      <div class="eyebrow"><a href="#/m/${m.id}">${String(m.n).padStart(2, '0')} · ${esc(m.title)}</a><span class="meta">${esc(kindLabel(x))} · about ${x.mins || 12} min</span></div>
      ${unitBar(m, x.id)}
      <h1>${esc(x.title)}</h1>
      <div class="p-head"><span class="diff ${x.diff || 'easy'}">${x.diff || 'easy'}</span>${tagsHidden ? '<span class="tag">pattern hidden until solved</span>' : (x.patterns || []).map((p) => `<span class="tag">${esc(PATTERNS[p] ? PATTERNS[p].label : p)}</span>`).join('')}${x.jdk ? '<span class="tag jdk" title="Uses real threads: runs on Your JDK only">JDK only</span>' : ''}${done ? '<span class="solved-pill">✓ Done</span>' : ''}</div>
      <div class="p-tabs" role="tablist">${tabs.map(([k, t]) => `<button data-pt="${k}" role="tab">${t}</button>`).join('')}</div>
      <section data-panel="task">
        <div class="statement prose">${md(x.statement, { exercise: x })}</div>
        ${x.given ? `<div class="section-h">Given (read-only, in <code>Given.java</code>)</div>${codeBlock(x.given.trim(), { label: 'Given.java' })}` : ''}
        ${x.rubric ? `<details class="rubric"><summary>What a strong answer covers</summary><div class="prose">${md(x.rubric)}</div></details>` : ''}
        <div class="section-h">How to work it</div>
        <p class="howto">${x.kind === 'design' ? '<b>Check</b> makes sure your design compiles. Then press <b>Review with Claude</b> for feedback, or open the model answer and compare against the checklist above.' : `<b>Run</b> checks the ${(x.tests || []).filter((t) => t.ex).length} visible tests; <b>Submit</b> runs all ${(x.tests || []).length}. Tests check behaviour, not design, so press <b>Review with Claude</b> for design feedback.`} Stuck for 10 minutes? Open one hint.</p>
        ${nextCard(x.id)}
      </section>
      <section data-panel="hints" hidden></section>
      <section data-panel="solution" hidden></section>
      <section data-panel="reviews" hidden></section>
      ${pager(x.id)}`;
    renderHints(x, S.hints[x.id] || 0);
    setExTab(ROUTE.tab || 'task');
    enhance(el.reader, { exercise: x });
    $('.p-tabs', el.reader).addEventListener('click', (e) => {
      const b = e.target.closest('[data-pt]'); if (!b) return;
      history.replaceState(null, '', `#/x/${x.id}${b.dataset.pt === 'task' ? '' : '/' + b.dataset.pt}`);
      setExTab(b.dataset.pt);
    });
  }
  function setExTab(tab) {
    const x = CUR; if (!x) return;
    const panels = $$('[data-panel]', el.reader);
    if (!panels.some((p) => p.dataset.panel === tab)) tab = 'task';
    panels.forEach((p) => { p.hidden = p.dataset.panel !== tab; });
    $$('.p-tabs [data-pt]', el.reader).forEach((b) => b.classList.toggle('on', b.dataset.pt === tab));
    if (tab === 'solution') renderSolution(x);
    if (tab === 'reviews') renderReviews(x);
  }
  function renderHints(x, shown) {
    const sec = $('[data-panel="hints"]', el.reader); if (!sec) return;
    const hs = x.hints || [];
    if (!hs.length) { sec.innerHTML = '<p class="small">No hints for this one.</p>'; return; }
    sec.innerHTML = `<div class="hints">${hs.slice(0, shown).map((h, k) => `<div class="hint-card"><b class="h">Hint ${k + 1}</b>${md(h)}</div>`).join('')}${shown < hs.length ? `<div class="hint-locked"><span>${shown ? `${hs.length - shown} more hint${hs.length - shown > 1 ? 's' : ''}.` : `${hs.length} hints, from a nudge to nearly the answer.`}</span><button class="btn" data-hint>Show hint ${shown + 1}</button></div>` : '<p class="small">That is every hint. Next stop: the solution tab.</p>'}</div>`;
    const b = $('[data-hint]', sec);
    if (b) b.onclick = () => { S.hints[x.id] = shown + 1; save(); renderHints(x, shown + 1); };
  }
  function renderSolution(x) {
    const sec = $('[data-panel="solution"]', el.reader);
    if (!sec || sec.dataset.done) return;
    const s = x.solution || {};
    if (!S.seen[x.id] && !S.done[x.id]) {
      sec.innerHTML = `<div class="gate"><p><b>Try it first?</b> Ten honest minutes on your own design is where the learning happens. If you are stuck, a hint keeps most of it intact.</p><button class="btn" data-g="hints">Show hints instead</button> <button class="btn primary" data-g="show">Show the ${x.kind === 'design' ? 'model answer' : 'solution'}</button></div>`;
      sec.onclick = (e) => {
        const g = e.target.closest('[data-g]'); if (!g) return;
        if (g.dataset.g === 'hints') { history.replaceState(null, '', `#/x/${x.id}/hints`); setExTab('hints'); }
        else { S.seen[x.id] = Date.now(); save(); sec.onclick = null; renderSolution(x); }
      };
      return;
    }
    sec.dataset.done = 1;
    sec.innerHTML = `
      <div class="prose">
        ${s.pattern ? `<div class="callout key"><b>Pattern</b>${md(s.pattern)}</div>` : ''}
        ${s.why ? md(s.why, { exercise: x }) : ''}
        ${s.java ? `<h2>${x.kind === 'design' ? 'Model answer' : 'Reference solution'}</h2>${codeBlock(s.java.trim(), { label: H.userFileOf(x), ctx: { exercise: x, loadable: true } })}` : ''}
        ${s.followups ? `<h2>Follow-ups interviewers ask</h2>${md(s.followups)}` : ''}
        ${s.talk ? `<div class="callout interview"><b>Say it in the interview</b>${md(s.talk)}</div>` : ''}
        ${x.kind === 'design' && !S.done[x.id] ? '<p><button class="btn good" data-markdone>I compared my design with this: mark as done</button></p>' : ''}
      </div>`;
    enhance(sec, { exercise: x });
    const b = $('[data-markdone]', sec);
    if (b) b.onclick = () => { markExDone(x, 'self'); b.remove(); };
  }

  /* ───────────── Code panel ───────────── */
  let cm = null, fallback = null, docs = null, curFile = 'user';
  const touch = matchMedia('(pointer: coarse)').matches;
  const starterFor = (x) => (x.starter || '').replace(/^\n+/, '');
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
      cm.on('change', debounce(() => { if (curFile === 'user') saveDraft(); }, 400));
      cm.on('change', () => clearMarks());
    } else {
      fallback = document.createElement('textarea'); fallback.className = 'fallback'; fallback.spellcheck = false; wrap.appendChild(fallback);
      fallback.addEventListener('input', debounce(saveDraft, 400));
      fallback.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runCode(e.shiftKey ? 'submit' : 'run'); }
        if (e.key === 'Tab') { e.preventDefault(); const s = fallback.selectionStart; fallback.setRangeText('    ', s, fallback.selectionEnd, 'end'); }
      });
    }
  }
  function clearMarks() { if (cm && cm.__marks) { cm.__marks.forEach((m) => m.clear()); cm.__marks = null; for (let i = 0; i < cm.lineCount(); i++) cm.removeLineClass(i, 'background', 'err-line'); } }
  const getCode = () => (docs ? docs.user.getValue() : cm ? cm.getValue() : fallback.value);
  const setCode = (src) => { if (docs) docs.user.setValue(src); else if (cm) cm.setValue(src); else fallback.value = src; };
  function saveDraft() {
    if (!CUR) return;
    const code = getCode();
    if (code === starterFor(CUR)) delete S.drafts[CUR.id]; else S.drafts[CUR.id] = { code, at: Date.now() };
    save();
  }
  const LAST = {};  // exercise id → last results html
  function loadEditor(x) {
    const d = S.drafts[x.id];
    const code = d ? (typeof d === 'string' ? d : d.code) : starterFor(x);
    const user = H.userFileOf(x);
    if (cm) {
      docs = { user: window.CodeMirror.Doc(code, 'text/x-java'), given: x.given ? window.CodeMirror.Doc(x.given.trim() + '\n', 'text/x-java') : null };
      showFile('user');
    } else fallback.value = code;
    el.fileTabs.innerHTML = `<button data-f="user" class="on">${esc(user)}</button>${x.given ? '<button data-f="given" title="Provided by the exercise. Read-only.">Given.java 🔒</button>' : ''}`;
    el.submit.textContent = '';
    el.submit.innerHTML = x.kind === 'design' ? 'Check <span class="k">⇧⌘↵</span>' : 'Submit <span class="k">⇧⌘↵</span>';
    el.run.hidden = x.kind === 'design';
    el.codeHint.innerHTML = x.jdk ? '<b>Needs Your JDK</b>: real threads' : 'Java 21 · <code>java.util.*</code> imported · classes need no <code>public</code>';
    setResTab(REVIEWING && REVIEWING.id === x.id ? 'review' : 'tests');
  }
  function showFile(f) {
    if (!cm || !docs) return;
    if (f === 'given' && !docs.given) f = 'user';
    curFile = f;
    cm.swapDoc(docs[f]);
    cm.setOption('readOnly', f === 'given');
    $$('#fileTabs button').forEach((b) => b.classList.toggle('on', b.dataset.f === f));
    setTimeout(() => cm.refresh(), 0);
  }
  el.fileTabs.addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) showFile(b.dataset.f); });
  function emptyResults(x) {
    const ex = (x.tests || []).filter((t) => t.ex).length;
    const browserNote = engine() === 'browser' && E.Browser.state !== 'ready' ? '<div>The first run loads the in-browser Java compiler (about 6 MB, cached after that).</div>' : '';
    if (x.kind === 'design') return `<div class="res-empty"><div><b>Check</b> compiles your design. There are no tests: a design is judged on responsibilities and tradeoffs.</div><div><b>Review with Claude</b> reads it against the checklist and tells you the one thing to fix.</div>${browserNote}</div>`;
    return `<div class="res-empty"><div><b>Run</b> checks ${ex} visible test${ex === 1 ? '' : 's'}. <b>Submit</b> runs all ${(x.tests || []).length}.</div><div><b>Review with Claude</b> judges the design, which tests cannot.</div>${x.jdk ? '<div>This one uses real threads, so it runs on <b>Your JDK</b> only.</div>' : browserNote}</div>`;
  }
  el.reset.onclick = () => {
    if (!CUR) return;
    modal('Reset to the starter code?', '<p>Your current code for this exercise is replaced by the starter code.</p>', [{ label: 'Reset', primary: true, fn: () => { setCode(starterFor(CUR)); delete S.drafts[CUR.id]; save(); showFile('user'); } }]);
  };

  // results tabs
  let resTab = 'tests';
  function setResTab(t) {
    resTab = t;
    $$('.res-tabs [data-rt]').forEach((b) => b.classList.toggle('on', b.dataset.rt === t));
    if (t === 'review') renderReviewPanel();
    else el.resBody.innerHTML = (CUR && LAST[CUR.id]) || (CUR ? emptyResults(CUR) : '');
  }
  $('.res-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-rt]'); if (b) setResTab(b.dataset.rt); });

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
    if (S.engine === 'local') { const st = await E.Local.check(); if (st !== 'ready') engineHelp(); }
    else E.Browser.init().catch(() => {});
  });
  function engineHelp() {
    const l = E.Local;
    modal('Run Java with your own JDK', `
      <p><b>In-browser</b> (default) compiles with a real <code>javac</code> running as WebAssembly in this tab. It works on any device, but it has no threads, so the concurrency exercises need your JDK.</p>
      <p><b>Your JDK</b> sends your code to a small runner on this computer. The same runner powers <b>Review with Claude</b>.</p>
      <p>Status: <b>${esc(l.state === 'ready' ? 'connected, JDK ' + l.java : l.state === 'unpaired' ? 'runner found but this page is not paired' : 'runner not reachable')}</b></p>
      <ol style="padding-left:20px">
        <li>Install a JDK (17 or newer) and Node.js 18+.</li>
        <li>From the Deep End folder, run:<pre>node lld/runner/server.mjs</pre></li>
        <li>Open the link it prints. <code>http://localhost:8789/lld/</code> comes paired already; the <code>#pair=…</code> link pairs the hosted site.</li>
      </ol>
      <p class="small">Full setup, including Claude sign-in and cloud sync: <a href="#/setup">Setup</a>.</p>`, [{ label: 'Check again', primary: true, fn: () => { E.Local.check().then((s) => toast(s === 'ready' ? 'Connected to your JDK' : 'Still not connected')); } }]);
  }

  /* ───────────── Running & grading ───────────── */
  let running = false;
  el.run.onclick = () => runCode('run');
  el.submit.onclick = () => runCode('submit');
  const TL_MS = 4000;

  async function execute(files, n) {
    // → { compile, results[] } where result = { status: 'pass'|'fail'|'error'|'tle'|'skip', msg, ns, stdout }
    if (engine() === 'local') {
      const r = await E.Local.compileRun(files, 'Main', [['0']], { timeoutMs: 30000 });
      if (!r.compile.ok) return { compile: r.compile };
      const run = r.runs[0];
      const parsed = H.parseRun(run.stdout, n);
      const res = parsed.results.map((x) => x && { ...x });
      if (!parsed.done) {
        const t = parsed.last >= 0 ? parsed.last : res.findIndex((x) => !x || x.status === 'running');
        if (t >= 0) res[t] = { ...(res[t] || { stdout: [] }), status: run.timedOut ? 'tle' : 'error', msg: run.timedOut ? 'Time limit exceeded (a deadlock or an endless loop?)' : (run.stderr || 'the JVM exited early').split('\n').slice(0, 6).join('\n') };
        for (let k = 0; k < n; k++) if (!res[k] || res[k].status === 'running') res[k] = { status: 'skip', stdout: [] };
      }
      return { compile: r.compile, results: res, stray: parsed.stray };
    }
    const c = await E.Browser.compile(files, 'Main');
    const compile = { ok: c.ok, ms: c.ms, diagnostics: (c.diags || []).filter((d) => d.severity === 'error') };
    if (!c.ok) return { compile };
    const res = new Array(n).fill(null);
    let from = 0, stray = [];
    const deadline = performance.now() + 30000;
    while (from < n) {
      const r = await E.Browser.run(c.wasm, [String(from)], { timeoutMs: Math.max(1000, Math.min(TL_MS * 2, deadline - performance.now())) });
      const parsed = H.parseRun(r.stdout, n);
      stray = stray.concat(parsed.stray);
      for (let k = from; k < n; k++) if (parsed.results[k]) res[k] = parsed.results[k];
      if (parsed.done) break;
      const t = parsed.last >= 0 ? parsed.last : (() => { for (let k = from; k < n; k++) if (!res[k] || res[k].status === 'running') return k; return -1; })();
      if (t < 0) break;
      if (r.timedOut) { res[t] = { ...(res[t] || { stdout: [] }), status: 'tle', msg: 'Time limit exceeded (an endless loop?)' }; for (let k = t + 1; k < n; k++) res[k] = { status: 'skip', stdout: [] }; break; }
      res[t] = { ...(res[t] || { stdout: [] }), status: 'error', msg: H.friendlyTrap(r.trap || 'the program stopped unexpectedly'), trap: true };
      from = t + 1;
    }
    for (let k = 0; k < n; k++) if (!res[k]) res[k] = { status: 'skip', stdout: [] };
    return { compile, results: res, stray };
  }

  async function runCode(kind) {
    const x = CUR;
    if (!x || running) return;
    setResTab('tests');
    if (narrow()) setMobileTab('code');
    saveDraft();
    const code = getCode();
    const all = x.tests || [];
    const idx = all.map((t, i) => i).filter((i) => kind === 'submit' || all[i].ex);
    const tests = idx.map((i) => all[i]);
    if (x.jdk && engine() !== 'local') {
      el.resBody.innerHTML = `<div class="verdict no"><b>Needs Your JDK</b><span>real threads</span></div><div class="res-note">This exercise starts real threads, and the in-browser engine has none. Start the runner (<code>node lld/runner/server.mjs</code>) and switch to <b>Your JDK</b> above. <a href="#/setup">Setup</a></div>`;
      return;
    }
    if (engine() === 'local' && E.Local.state !== 'ready') {
      const st = await E.Local.check();
      if (st !== 'ready') { engineHelp(); return; }
    }
    running = true; renderEngine();
    const say = (m) => { el.resBody.innerHTML = `<div class="res-note"><span class="spin"></span> ${m}</div>`; };
    say(engine() === 'browser' && E.Browser.state !== 'ready' ? 'Loading the Java compiler (first run only)…' : 'Compiling…');
    const t0 = performance.now();
    try {
      const built = H.buildFiles(x, code, tests, { engine: engine() === 'browser' ? 'browser' : 'jdk' });
      if (engine() === 'browser') await E.Browser.init();
      say(`Compiling${engine() === 'local' ? ' with your JDK' : ''}…`);
      const r = await execute(built.files, tests.length);
      const html = resultsHtml(x, kind, tests, idx, r, code, built, performance.now() - t0);
      el.resBody.innerHTML = html;
      LAST[x.id] = html;
      LAST_RUN[x.id] = summarizeRun(x, kind, tests, r);
      if (!r.compile.ok) markErrors(r.compile.diagnostics, built);
    } catch (e) {
      el.resBody.innerHTML = `<div class="verdict no"><b>Could not run</b></div><div class="res-note">${esc(e.message || e)}</div>`;
      LAST[x.id] = el.resBody.innerHTML;
    } finally {
      running = false; renderEngine();
    }
  }
  const LAST_RUN = {};  // exercise id → short text summary for reviews
  function summarizeRun(x, kind, tests, r) {
    if (!r.compile.ok) return 'Compile errors:\n' + r.compile.diagnostics.slice(0, 8).map((d) => `- ${d.file || ''}:${d.line} ${d.message.split('\n')[0]}`).join('\n');
    if (!tests.length) return 'It compiles (design exercise, no tests).';
    const rows = tests.map((t, k) => ({ t, res: r.results[k] || { status: 'skip' } }));
    const pass = rows.filter((z) => z.res.status === 'pass').length;
    return `${kind === 'submit' ? 'All tests' : 'Visible tests'}: ${pass}/${rows.length} passed.` + rows.filter((z) => z.res.status !== 'pass').slice(0, 6).map((z) => `\n- ${z.t.name}: ${z.res.status}${z.res.msg ? ' - ' + z.res.msg : ''}`).join('');
  }

  function markErrors(diags, built) {
    if (!cm || !docs) return;
    showFile('user');
    const user = built.userFile;
    cm.__marks = [];
    for (const d of diags) {
      if (d.file !== user || !(d.line > 0)) continue;
      const line = d.line - 1;
      cm.addLineClass(line, 'background', 'err-line');
      const col = Math.max(0, (d.col || 1) - 1 - (line === 0 ? built.importsLen : 0));
      const text = cm.getLine(line) || '';
      let end = col; while (end < text.length && /[\w$]/.test(text[end])) end++;
      if (end === col) end = Math.min(text.length, col + 1);
      cm.__marks.push(cm.markText({ line, ch: col }, { line, ch: end }, { className: 'err-mark' }));
    }
  }

  function diagHtml(x, diags, built) {
    const user = built.userFile;
    const shown = diags.slice(0, 12).map((d) => {
      const mine = d.file === user;
      let msg = d.message;
      const where = mine && d.line > 0 ? `line ${d.line}${d.col && d.line > 1 ? ':' + d.col : ''}` : d.file ? `${d.file}${d.line > 0 ? ':' + d.line : ''}` : 'compiler';
      if (!mine && d.file === 'Main.java') msg = `The tests could not call your code: ${msg}\n→ Keep the class, constructor and method names from the starter code.`;
      if (d.type === 'teavm' || (!d.file && engine() === 'browser')) msg += '\n→ The in-browser Java library may not support this API. Try another approach, or switch to "Your JDK".';
      if (/package java\.util\.concurrent\.locks|cannot find symbol[\s\S]*(ExecutorService|Executors|ReentrantLock|CompletableFuture|CountDownLatch|Semaphore|BlockingQueue)/.test(msg) && engine() === 'browser') msg += '\n→ Threads and locks exist only on "Your JDK".';
      return `<div class="diag" data-line="${mine ? d.line : ''}"><span class="where">${esc(where)}</span><pre>${esc(msg)}</pre></div>`;
    }).join('');
    return shown + (diags.length > 12 ? `<div class="res-note">… and ${diags.length - 12} more</div>` : '');
  }

  function resultsHtml(x, kind, tests, idx, r, code, built, ms) {
    if (!r.compile.ok) return `<div class="verdict no"><b>Compile error</b><span>${r.compile.diagnostics.length} error${r.compile.diagnostics.length === 1 ? '' : 's'}</span></div>${diagHtml(x, r.compile.diagnostics, built)}`;
    const notes = H.lint(x, code);
    const notesHtml = notes.length ? `<div class="design-notes"><b>Design notes</b> <span class="dim">(quick source checks, not failures)</span><ul>${notes.map((n) => `<li>${inline(n)}</li>`).join('')}</ul></div>` : '';
    const reviewNudge = `<div class="res-note">Tests check behaviour. For the design itself: <button class="tbtn review" data-go-review>Review with Claude</button></div>`;
    if (!tests.length) {
      if (kind === 'submit' && x.kind === 'design') S.tries[x.id] = (S.tries[x.id] || 0) + 1, save();
      return `<div class="verdict ok"><b>It compiles</b><span>${fmtMs(ms)}</span></div>${notesHtml}${reviewNudge}`;
    }
    const rows = tests.map((t, k) => ({ t, k, i: idx[k], res: r.results[k] || { status: 'skip' } }));
    const pass = rows.filter((z) => z.res.status === 'pass').length;
    const firstBad = rows.find((z) => z.res.status !== 'pass');
    let verdict;
    if (!firstBad) verdict = `<div class="verdict ok"><b>${kind === 'submit' ? 'All tests pass' : 'Visible tests pass'}</b><span>${pass}/${rows.length}</span></div>`;
    else {
      const st = firstBad.res.status;
      const name = st === 'error' ? 'Exception' : st === 'tle' ? 'Time limit exceeded' : st === 'skip' ? 'Not run' : 'Test failed';
      verdict = `<div class="verdict no"><b>${name}</b><span>${pass}/${rows.length} passed${kind === 'run' ? ' (visible)' : ''}</span></div>`;
    }
    let note = '';
    if (!firstBad && kind === 'run') note = `<div class="res-note">Now <b>Submit</b> to run all ${(x.tests || []).length} tests.</div>`;
    if (firstBad && firstBad.res.trap) note = '<div class="res-note">The in-browser engine stops the program on this error without a stack trace. <b>Your JDK</b> shows the exact line.</div>';
    const list = rows.map((z) => {
      const ok = z.res.status === 'pass';
      const st = z.res.status;
      const icon = ok ? '✓' : st === 'skip' ? '·' : '✗';
      const detail = !ok && st !== 'skip' ? `<div class="tmsg">${esc(z.res.msg || st)}</div>` : '';
      const so = z.res.stdout && z.res.stdout.length ? `<pre class="stdout">${esc(z.res.stdout.join('\n'))}</pre>` : '';
      const showCode = z.t.ex || S.done[x.id];
      return `<details class="trow ${ok ? 'ok' : st === 'skip' ? 'skip' : 'no'}" ${z === firstBad ? 'open' : ''}><summary><span class="ti">${icon}</span><span class="tn">${esc(z.t.name)}</span>${z.t.ex ? '' : '<span class="hid">hidden</span>'}</summary>${detail}${so}${showCode ? `<pre class="tcode">${V.highlightJava(String(z.t.code).trim())}</pre>` : '<div class="dim small">The test code shows once the exercise is solved.</div>'}</details>`;
    }).join('');
    const strayOut = (r.stray || []).length ? `<div class="res-note">Printed outside a test:</div><pre class="stdout">${esc(r.stray.join('\n'))}</pre>` : '';
    if (kind === 'submit') { S.tries[x.id] = (S.tries[x.id] || 0) + 1; save(); }
    if (kind === 'submit' && !firstBad) setTimeout(() => markExDone(x, 'tests'), 30);
    return `${verdict}${note}<div class="tlist">${list}</div>${notesHtml}${strayOut}${reviewNudge}`;
  }
  const fmtMs = (ms) => (ms < 1 ? `${ms.toFixed(2)} ms` : ms < 100 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`);
  el.resBody.addEventListener('click', (e) => {
    const d = e.target.closest('.diag');
    if (d && d.dataset.line && cm) { showFile('user'); cm.focus(); cm.setCursor({ line: +d.dataset.line - 1, ch: 0 }); }
    if (e.target.closest('[data-go-review]')) startReview();
  });

  /* ───────────── Done + celebration ───────────── */
  function markExDone(x, how) {
    const first = !S.done[x.id];
    const rec = S.done[x.id] || { first: Date.now(), n: 0 };
    rec.n++; rec.at = Date.now(); rec.how = how;
    rec.hints = Math.max(rec.hints || 0, S.hints[x.id] || 0);
    rec.sawSolution = rec.sawSolution || !!S.seen[x.id];
    S.done[x.id] = rec;
    if (window.LLDToday) window.LLDToday.seedExercise(x);
    markDay(); save();
    renderNav(); renderChips();
    const pill = $('.p-head', el.reader);
    if (pill && !$('.solved-pill', pill)) pill.insertAdjacentHTML('beforeend', '<span class="solved-pill">✓ Done</span>');
    if (first) { confetti(); toast(how === 'review' ? 'Claude signed off on it. Marked as done.' : 'Done! Next step is linked under the task.'); }
  }
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div'); box.className = 'confetti';
    const cols = ['#0F766E', '#237148', '#C17A0B', '#1F5F99', '#B3261E', '#5EEAD4'];
    for (let k = 0; k < 60; k++) {
      const i = document.createElement('i');
      i.style.left = Math.random() * 100 + 'vw'; i.style.background = cols[k % cols.length];
      i.style.animationDelay = Math.random() * 0.4 + 's'; i.style.animationDuration = 1 + Math.random() * 0.8 + 's';
      box.appendChild(i);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 2600);
  }

  /* ───────────── Claude reviews ───────────── */
  const REVIEW_GUIDE = [
    'You are reviewing a learner\'s work on LLD Lab, a low-level design and design-patterns course in Java.',
    'The learner is a senior Java backend engineer preparing for LLD interview rounds. They have ADHD and forget what they have not practised, so:',
    '* Lead with the single most important point. Keep every block short, one idea each.',
    '* At most 4 findings. Say what they can skip worrying about.',
    '* Tie each finding to the cue they should notice next time ("when you see X, reach for Y").',
    'Style: single hyphens, never em dashes. Bullets start with *. No math symbols.',
    'Judge the design, not only correctness: responsibilities, extensibility for the follow-ups an interviewer would ask, pattern fit (and over-engineering), naming, and thread safety where it matters.',
    'Do not rewrite their whole solution. Show at most one short snippet.',
    'Format:',
    '**Verdict:** one line - would this pass an LLD interview round (strong / passable / not yet) and why.',
    '**The one thing:** the most valuable fix, or the thing to keep doing.',
    'Then up to 3 more findings, each a bold plain-language title and 1 to 3 lines.',
    '**Pattern check:** which pattern fits here, whether they used it well, and the cue in the task.',
    'The very last line must be exactly: VERDICT {"score":N,"patterns":[ids],"note":"..."} where score is 1 to 5, patterns lists pattern ids (from the list below) they should practise more (empty if none), and note is under 80 characters.',
  ].join('\n');
  const plainMd = (s) => String(s || '').replace(/«([^»]*)»/g, '`$1`').replace(/~~~/g, '```').replace(/^\n+|\s+$/g, '');
  function reviewPrompt(x, code) {
    const ids = Object.keys(PATTERNS).join(', ');
    return `${REVIEW_GUIDE}

Pattern ids: ${ids}

# Exercise: ${x.title}
Kind: ${x.kind}${x.jdk ? ' (concurrency, real threads)' : ''}. Difficulty: ${x.diff || 'easy'}. Module: ${x.module.title}.
Patterns this exercise targets: ${(x.patterns || []).join(', ') || 'none in particular'}

## Task
${plainMd(x.statement)}
${x.rubric ? `\n## What a strong answer covers\n${plainMd(x.rubric)}\n` : ''}${x.given ? `\n## Given.java (provided, read-only)\n\`\`\`java\n${x.given.trim()}\n\`\`\`\n` : ''}
## The learner's ${H.userFileOf(x)}
\`\`\`java
${code.trim()}
\`\`\`

## Latest run
${LAST_RUN[x.id] || 'Not run yet.'}
${H.lint(x, code).length ? `\n## Automatic design notes\n${H.lint(x, code).map((n) => '- ' + plainMd(n)).join('\n')}\n` : ''}
Review it now.`;
  }
  let REVIEWING = null;   // { id, text, error, ctl, done }
  el.reviewBtn.onclick = () => startReview();
  async function startReview() {
    const x = CUR; if (!x) return;
    saveDraft();
    if (narrow()) setMobileTab('code');
    if (REVIEWING && !REVIEWING.done) { setResTab('review'); return; }
    const code = getCode();
    const prompt = reviewPrompt(x, code);
    if (E.Local.state !== 'ready') await E.Local.check();
    const c = E.Local.claude;
    if (E.Local.state !== 'ready' || !c || !c.found || c.loggedIn === false) { copyForClaude(x, prompt, c); return; }
    REVIEWING = { id: x.id, text: '', error: null, done: false, at: Date.now() };
    setResTab('review');
    const job = E.Local.review({ prompt, model: S.review.model, effort: S.review.effort }, (text) => { if (REVIEWING && REVIEWING.id === x.id) { REVIEWING.text = text; paintReview(); } });
    REVIEWING.ctl = job;
    const r = await job.done;
    const cur = REVIEWING;
    cur.done = true; cur.error = r.error && r.error !== 'stopped' ? r.error : null;
    cur.text = r.text || cur.text;
    if (cur.text && !cur.error) recordReview(x, cur.text);
    paintReview();
    if (cur.error && /not signed in/i.test(cur.error)) E.Local.check();
  }
  function splitVerdict(text) {
    const m = /\n?VERDICT\s*(\{[^\n]*\})\s*$/.exec(text);
    let verdict = null;
    if (m) { try { verdict = JSON.parse(m[1]); } catch { /* malformed */ } }
    const body = (m ? text.slice(0, m.index) : text).replace(/\n?VERDICT[^\n]*$/, '');
    return { body, verdict };
  }
  function recordReview(x, text) {
    const { body, verdict } = splitVerdict(text);
    const list = S.reviews[x.id] || (S.reviews[x.id] = []);
    list.unshift({ at: Date.now(), text: body.slice(0, 8000), verdict, model: S.review.model });
    list.length = Math.min(list.length, 3);
    if (verdict) {
      for (const p of verdict.patterns || []) if (PATTERNS[p]) { const w = S.weak[p] || { n: 0 }; S.weak[p] = { n: w.n + 1, at: Date.now(), note: verdict.note || '' }; }
      if (verdict.score >= 4) for (const p of x.patterns || []) if (S.weak[p]) S.weak[p] = { ...S.weak[p], n: Math.max(0, S.weak[p].n - 1), at: Date.now() };
      if (x.kind === 'design' && verdict.score >= 3 && !S.done[x.id]) markExDone(x, 'review');
    }
    save();
    if (ROUTE.view === 'exercise' && CUR === x) { const sec = $('[data-panel="reviews"]', el.reader); if (sec && !sec.hidden) renderReviews(x); const tab = $('[data-pt="reviews"]', el.reader); if (tab) tab.innerHTML = `Reviews<span class="n">${list.length}</span>`; }
  }
  function renderReviewPanel() {
    const x = CUR;
    if (!x) { el.resBody.innerHTML = ''; return; }
    const R = REVIEWING && REVIEWING.id === x.id ? REVIEWING : null;
    const past = (S.reviews[x.id] || [])[0];
    const models = [['opus', 'Deep (Opus)'], ['sonnet', 'Quick (Sonnet)']];
    const head = `<div class="rv-head"><select id="rvModel" title="Which Claude model reviews">${models.map(([v, t]) => `<option value="${v}" ${S.review.model === v ? 'selected' : ''}>${t}</option>`).join('')}</select>${R && !R.done ? '<button class="tbtn" id="rvStop">Stop</button>' : `<button class="tbtn review" id="rvGo">${R || past ? 'Review again' : 'Review with Claude'}</button>`}<button class="tbtn" id="rvCopy" title="Copy a ready-made review prompt to paste into Claude">Copy for Claude</button></div>`;
    let body;
    if (R) body = reviewBodyHtml(R);
    else if (past) body = `<div class="res-note">Last review, ${ago(past.at)}${past.verdict ? ` · score ${past.verdict.score}/5` : ''}:</div><div class="rv-text prose">${md(past.text)}</div>`;
    else body = `<div class="res-empty"><div><b>Review with Claude</b> reads the task, the checklist, your code and your latest test run, then gives you the one thing to fix.</div><div>It runs through the Claude Code CLI on your computer (the runner), so it needs <code>node lld/runner/server.mjs</code> and a one-time sign-in. Without the runner, <b>Copy for Claude</b> gives you a prompt to paste into Claude.</div></div>`;
    el.resBody.innerHTML = head + body;
    $('#rvModel').onchange = (e) => { S.review.model = e.target.value; save(); };
    const go = $('#rvGo'); if (go) go.onclick = () => startReview();
    const stop = $('#rvStop'); if (stop) stop.onclick = () => { REVIEWING.ctl && REVIEWING.ctl.abort(); };
    $('#rvCopy').onclick = () => copyForClaude(x, reviewPrompt(x, getCode()), E.Local.claude, true);
  }
  function reviewBodyHtml(R) {
    const { body, verdict } = splitVerdict(R.text);
    const waiting = !R.done && !R.text ? '<div class="res-note"><span class="spin"></span> Claude is reading your code… (usually 20 to 60 seconds)</div>' : '';
    const live = !R.done && R.text ? '<span class="spin"></span>' : '';
    const err = R.error ? `<div class="verdict no"><b>Review failed</b></div><div class="res-note">${esc(R.error)}${/not signed in/i.test(R.error) ? ' <a href="#/setup">Setup</a>' : ''}</div>` : '';
    const score = verdict ? `<div class="rv-score">Score <b>${esc(verdict.score)}/5</b>${verdict.note ? ` · ${esc(verdict.note)}` : ''}${(verdict.patterns || []).length ? ` · practise: ${verdict.patterns.map((p) => esc(PATTERNS[p] ? PATTERNS[p].label : p)).join(', ')}` : ''}</div>` : '';
    return `${waiting}${err}${score}<div class="rv-text prose">${md(body)}${live}</div>`;
  }
  const paintReview = () => { if (resTab === 'review' && CUR && REVIEWING && REVIEWING.id === CUR.id) { const box = el.resBody; const keep = box.scrollTop; renderReviewPanel(); box.scrollTop = keep; } };
  function copyForClaude(x, prompt, c, asked = false) {
    const why = asked ? '' : E.Local.state !== 'ready' ? '<p>The runner is not running, so Claude cannot review inside the page right now.</p>' : c && !c.found ? '<p>The runner could not find the Claude Code CLI on this computer.</p>' : c && c.loggedIn === false ? '<p>Claude Code on this computer is not signed in yet (see <a href="#/setup">Setup</a>).</p>' : '';
    modal('Get a review from Claude', `${why}<p>Copy this prompt and paste it into Claude (the app, or claude.ai). It has the task, the checklist, your code and your latest run.</p><textarea readonly style="width:100%;min-height:200px;font:12px/1.4 var(--f-mono)">${esc(prompt)}</textarea>`, [
      { label: 'Copy prompt', primary: true, fn: (m) => { navigator.clipboard.writeText($('textarea', m).value).then(() => toast('Copied. Paste it into Claude.')); } },
      ...(asked ? [] : [{ label: 'Open setup', fn: () => { location.hash = '#/setup'; } }]),
    ]);
  }
  function renderReviews(x) {
    const sec = $('[data-panel="reviews"]', el.reader); if (!sec) return;
    const list = S.reviews[x.id] || [];
    sec.innerHTML = list.length ? list.map((r) => `<div class="rv-past"><div class="rv-meta">${ago(r.at)}${r.verdict ? ` · score <b>${esc(r.verdict.score)}/5</b>` : ''}${r.model ? ` · ${esc(r.model)}` : ''}</div><div class="prose">${md(r.text)}</div></div>`).join('') : `<p class="small">No reviews yet. Press <b>Review with Claude</b> under the editor when you have something to show. The last three reviews are kept here.</p>`;
  }
  const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`; };

  /* ───────────── Splitters ───────────── */
  (function splitters() {
    const split = $('#split'), vsplit = $('#vsplit');
    const w = localStorage.getItem('lldlab.codeW'); if (w) el.app.style.setProperty('--code-w', w);
    const rh = localStorage.getItem('lldlab.resH'); if (rh) el.code.style.setProperty('--results-h', rh);
    split.addEventListener('pointerdown', (e) => {
      split.classList.add('drag'); split.setPointerCapture(e.pointerId);
      const move = (ev) => { const px = Math.max(340, Math.min(window.innerWidth - 420, window.innerWidth - ev.clientX)); el.app.style.setProperty('--code-w', px + 'px'); };
      const up = () => { split.classList.remove('drag'); split.removeEventListener('pointermove', move); try { localStorage.setItem('lldlab.codeW', el.app.style.getPropertyValue('--code-w')); } catch { /* */ } if (cm) cm.refresh(); };
      split.addEventListener('pointermove', move); split.addEventListener('pointerup', up, { once: true });
    });
    vsplit.addEventListener('pointerdown', (e) => {
      vsplit.classList.add('drag'); vsplit.setPointerCapture(e.pointerId);
      const box = el.code.getBoundingClientRect();
      const move = (ev) => { const px = Math.max(90, Math.min(box.height - 160, box.bottom - ev.clientY - 44)); el.code.style.setProperty('--results-h', px + 'px'); };
      const up = () => { vsplit.classList.remove('drag'); vsplit.removeEventListener('pointermove', move); try { localStorage.setItem('lldlab.resH', el.code.style.getPropertyValue('--results-h')); } catch { /* */ } if (cm) cm.refresh(); };
      vsplit.addEventListener('pointermove', move); vsplit.addEventListener('pointerup', up, { once: true });
    });
  })();

  /* ───────────── Sync support: merging two copies of the state ───────────── */
  const DEVICE_ONLY = ['open', 'engine', 'focus', 'review'];
  const newer = (a, b) => ((b && (b.at || 0)) > (a && (a.at || 0)) ? b : a);
  function mergeState(local, remote) {
    if (!remote || remote.v !== 1) return local;
    const out = { ...blank(), ...local };
    const byAt = (k) => { const a = local[k] || {}, b = remote[k] || {}; const o = { ...a }; for (const id of Object.keys(b)) o[id] = a[id] === undefined ? b[id] : newer(a[id], b[id]); out[k] = o; };
    ['done', 'drafts', 'cards', 'quiz', 'weak'].forEach(byAt);
    const maxNum = (k) => { const a = local[k] || {}, b = remote[k] || {}; const o = { ...a }; for (const id of Object.keys(b)) o[id] = Math.max(a[id] || 0, b[id] || 0); out[k] = o; };
    ['hints', 'tries', 'seen', 'read', 'days'].forEach(maxNum);
    const rv = { ...(local.reviews || {}) };
    for (const [id, list] of Object.entries(remote.reviews || {})) {
      const all = [...(rv[id] || []), ...list];
      const seen = new Set();
      rv[id] = all.filter((r) => (seen.has(r.at) ? false : seen.add(r.at))).sort((p, q) => q.at - p.at).slice(0, 3);
    }
    out.reviews = rv;
    out.last = newer(local.last, remote.last);
    const dl = local.drill || { n: 0, right: 0, by: {} }, dr = remote.drill || { n: 0, right: 0, by: {} };
    out.drill = dl.n >= dr.n ? { ...dl, by: { ...dr.by, ...dl.by } } : { ...dr, by: { ...dl.by, ...dr.by } };
    for (const k of DEVICE_ONLY) out[k] = local[k];
    return out;
  }
  const syncable = () => { const o = { ...S }; for (const k of DEVICE_ONLY) delete o[k]; return o; };
  function applyMerged(remote) {
    const merged = mergeState(S, remote);
    const strip = (o) => { const c = { ...o }; for (const k of DEVICE_ONLY) delete c[k]; return c; };
    const changed = JSON.stringify(strip(S)) !== JSON.stringify(strip(merged));
    if (!changed) return false;
    Object.keys(S).forEach((k) => delete S[k]);
    Object.assign(S, merged);
    persist();
    // redraw without losing your place: only list-like pages re-render
    renderNav(); renderChips();
    if (ROUTE.view === 'page' || ROUTE.view === 'home' || ROUTE.view === 'module') route();
    return true;
  }

  /* ───────────── Self-test (run in the browser console) ───────────── */
  // await lldSelfTest()                  every exercise's reference solution on the current engine
  // await lldSelfTest({ filter: 'strat' }) only matching ids
  window.lldSelfTest = async function ({ filter = '', quiet = false } = {}) {
    const list = ALL_EX.filter((x) => x.id.includes(filter) && x.solution && x.solution.java && !(x.jdk && engine() === 'browser'));
    const fails = [];
    const t0 = performance.now();
    if (engine() === 'browser') await E.Browser.init();
    for (const [k, x] of list.entries()) {
      const tests = x.tests || [];
      const { files } = H.buildFiles(x, x.solution.java, tests, { engine: engine() === 'browser' ? 'browser' : 'jdk' });
      let r;
      try { r = await execute(files, tests.length); } catch (e) { fails.push({ id: x.id, why: String(e.message || e) }); continue; }
      if (!r.compile.ok) { fails.push({ id: x.id, why: 'compile: ' + r.compile.diagnostics.map((d) => `${d.file}:${d.line} ${d.message}`).join(' | ') }); continue; }
      tests.forEach((t, i) => { const res = r.results[i]; if (!res || res.status !== 'pass') fails.push({ id: x.id, test: t.name, why: res ? res.status + ' ' + (res.msg || '') : 'no result' }); });
      // the starter must compile against the tests too
      const s = H.buildFiles(x, starterFor(x), tests, { engine: engine() === 'browser' ? 'browser' : 'jdk' });
      const c = engine() === 'browser' ? await E.Browser.compile(s.files, 'Main') : await E.Local.compileRun(s.files, 'Main', [['999999']]).then((z) => z.compile);
      if (!(c.ok)) fails.push({ id: x.id, why: 'starter does not compile: ' + ((c.diags || c.diagnostics || []).filter((d) => d.severity !== 'warning').map((d) => `${d.file}:${d.line} ${d.message}`).slice(0, 3).join(' | ')) });
      if (!quiet) console.log(`[${k + 1}/${list.length}] ${x.id} ${fails.some((f) => f.id === x.id) ? '✗' : '✓'}`);
    }
    const msg = `lldSelfTest (${engine()}): ${list.length - new Set(fails.map((f) => f.id)).size}/${list.length} exercises pass in ${((performance.now() - t0) / 1000).toFixed(0)} s`;
    console.log(msg); if (fails.length) console.table(fails);
    return { ok: !fails.length, fails, msg };
  };

  /* ───────────── Boot ───────────── */
  window.LLDApp = {
    get S() { return S; }, save, saveNow, md, inline, esc, codeBlock, exList, quizHtml, patternCard, familyCard, enhance, toast, modal, popover,
    EX, LESSON, MOD, MODS, ITEMS, ALL_EX, PAGES, ENHANCERS, PATTERNS, isDone, modStats, markDay, nextItem, hrefOf, itemMins, kindLabel,
    route, renderNav, renderChips, ago, listeners, mergeState, applyMerged, syncable, blank,
    get CUR() { return CUR; },
  };
  initEditor();
  renderEngine();
  setFocus(S.focus);
  window.LLDApp.start = function () {
    if (window.LLDLAB_JUST_PAIRED) { S.engine = 'local'; save(); setTimeout(() => toast('Paired with your JDK runner'), 300); }
    if (S.engine === 'local') E.Local.check();
    else {
      E.Local.check().catch(() => {});   // quietly learn whether reviews are available
      if (location.protocol !== 'file:') setTimeout(() => E.Browser.init().catch(() => {}), 1200);
    }
    route();
  };
})();

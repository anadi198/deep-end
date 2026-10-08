/* Backend Lab: renders a simulator (sims/*.js) into a lesson. Controls come from the sim's params;
 * every change re-runs the model and redraws stat tiles, a line chart (crosshair, end labels, bands,
 * marks, a data table), bars, tables, the partition-ownership grid, a step-by-step story and notes.
 * "Compare every option" runs the sim once per option of its compare param. */
(function () {
  'use strict';
  const BS = window.BackendSims;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ICON = { good: '✓', warn: '!', bad: '✕' };
  const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];
  let uid = 0;

  const visible = (q, p) => !q.when || Object.entries(q.when).every(([k, v]) => p[k] === v);
  const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('en', { maximumFractionDigits: 1 }) : esc(v));
  function parsePreset(str) {
    const out = {};
    for (const part of String(str || '').trim().split(/\s+/).filter(Boolean)) {
      const [k, v] = part.split('=');
      out[k] = v === 'true' ? true : v === 'false' ? false : v !== '' && !isNaN(+v) ? +v : v;
    }
    return out;
  }

  /* ───────────── controls ───────────── */
  function controlsHtml(spec, p) {
    return spec.params.filter((q) => visible(q, p)).map((q) => {
      const id = `sc${uid}-${q.id}`;
      if (q.type === 'select') return `<label class="sc sel" for="${id}"><span>${esc(q.label)}</span><select id="${id}" data-p="${q.id}">${q.options.map(([v, t]) => `<option value="${esc(v)}" ${String(p[q.id]) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
      if (q.type === 'toggle') return `<label class="sc tog" for="${id}"><input type="checkbox" id="${id}" data-p="${q.id}" ${p[q.id] ? 'checked' : ''}><span class="sw" aria-hidden="true"></span><span>${esc(q.label)}</span></label>`;
      return `<label class="sc rng" for="${id}"><span>${esc(q.label)} <output>${fmt(p[q.id])}${q.unit ? ` ${esc(q.unit)}` : ''}</output></span><input type="range" id="${id}" data-p="${q.id}" min="${q.min}" max="${q.max}" step="${q.step || 1}" value="${p[q.id]}"></label>`;
    }).join('');
  }

  /* ───────────── stat tiles ───────────── */
  function statsHtml(stats) {
    return `<div class="sim-stats">${stats.map((s) => `<div class="tile ${s.tone || ''}"><small>${esc(s.label)}</small><b>${s.tone ? `<i aria-hidden="true">${ICON[s.tone]}</i>` : ''}${fmt(s.value)}${s.unit ? ` <span class="u">${esc(s.unit)}</span>` : ''}</b>${s.note ? `<span class="nt">${esc(s.note)}</span>` : ''}</div>`).join('')}</div>`;
  }

  /* ───────────── line chart ───────────── */
  function nice(max) {
    if (max <= 0) return 1;
    const e = 10 ** Math.floor(Math.log10(max)), f = max / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  }
  function ticks(lo, hi, n) {
    const step = nice((hi - lo) / n);
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
    return out;
  }
  // Narrow screens get a chart drawn at their real width, so its text stays readable; the legend names the lines.
  function chartHtml(c, width) {
    const small = width < 520;
    const W = small ? Math.max(280, Math.round(width)) : 680, H = small ? 220 : 250, L = small ? 40 : 52, R = small ? 10 : 118, T = 22, B = 34;
    const xs = c.x, x0 = xs[0], x1 = xs[xs.length - 1];
    const ymax = nice(Math.max(1, ...c.lines.flatMap((l) => l.values)) * 1.05);
    const X = (v) => L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R);
    const Y = (v) => T + (1 - v / ymax) * (H - T - B);
    let s = `<svg class="sim-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.yLabel || 'chart')} over ${esc(c.xLabel || 'time')}">`;
    for (const b of c.bands || []) s += `<rect class="band" x="${X(b.from)}" y="${T}" width="${Math.max(1, X(b.to) - X(b.from))}" height="${H - T - B}"/><text class="band-l" x="${X(b.from) + 4}" y="${T + 11}">${esc(b.label)}</text>`;
    for (const v of ticks(0, ymax, 4)) s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end">${v >= 10000 ? `${v / 1000}k` : fmt(v)}</text>`;
    for (const v of ticks(x0, x1, 6)) s += `<text class="ax" x="${X(v)}" y="${H - B + 15}" text-anchor="middle">${fmt(v)}</text>`;
    s += `<line class="base" x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}"/>`;
    s += `<text class="ax t" x="${(L + W - R) / 2}" y="${H - 3}" text-anchor="middle">${esc(c.xLabel || '')}</text>`;
    let lastMarkX = -99, row = 0;
    for (const m of c.marks || []) {
      const mx = X(m.x);
      row = mx - lastMarkX < 70 ? row + 1 : 0; lastMarkX = mx;
      s += `<line class="mark" x1="${mx}" x2="${mx}" y1="${T}" y2="${H - B}"/><text class="mark-l" x="${mx + 3}" y="${T - 8 + row * 11}">${esc(m.label)}</text>`;
    }
    const ends = [];
    c.lines.forEach((ln, k) => {
      const col = ln.dash ? 'var(--ink-3)' : SERIES[k % SERIES.length];
      const d = ln.values.map((v, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(v).toFixed(1)}`).join('');
      s += `<path class="ln${ln.dash ? ' dash' : ''}" d="${d}" style="stroke:${col}"/>`;
      ends.push({ y: Y(ln.values[ln.values.length - 1]), name: ln.name, col });
    });
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 12) ends[i].y = ends[i - 1].y + 12;
    if (!small) for (const e of ends) s += `<text class="end-l" x="${W - R + 6}" y="${e.y + 3.5}" style="fill:var(--ink-2)"><tspan style="fill:${e.col}">●</tspan> ${esc(e.name.length > 22 ? e.name.slice(0, 21) + '…' : e.name)}</text>`;
    s += `<g class="xhair" visibility="hidden"><line x1="0" x2="0" y1="${T}" y2="${H - B}"/>${c.lines.map((ln, k) => `<circle r="4" style="fill:${ln.dash ? 'var(--ink-3)' : SERIES[k % SERIES.length]}"/>`).join('')}</g>`;
    s += `<rect class="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/></svg>`;
    const legend = `<div class="sim-legend">${c.lines.map((ln, k) => `<span><i class="${ln.dash ? 'dash' : ''}" style="background:${ln.dash ? 'transparent' : SERIES[k % SERIES.length]}"></i>${esc(ln.name)}</span>`).join('')}${c.yLabel ? `<span class="yl">${esc(c.yLabel)}</span>` : ''}</div>`;
    const step = Math.max(1, Math.ceil(xs.length / 30));
    const rows = xs.map((x, i) => i).filter((i) => i % step === 0 || i === xs.length - 1);
    const table = `<details class="sim-data"><summary>Data table</summary><div class="tablewrap"><table class="t"><thead><tr><th>${esc(c.xLabel || 'x')}</th>${c.lines.map((l) => `<th>${esc(l.name)}</th>`).join('')}</tr></thead><tbody>${rows.map((i) => `<tr><td>${fmt(xs[i])}</td>${c.lines.map((l) => `<td>${fmt(l.values[i])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
    return { html: `<div class="sim-chartwrap">${legend}<div class="sim-plot">${s}<div class="tip" hidden></div></div>${table}</div>`, geo: { W, L, R, X, Y, xs, x0, x1 } };
  }
  function wireChart(box, c, geo) {
    const svg = box.querySelector('svg.sim-chart'); if (!svg) return;
    const hit = svg.querySelector('.hit'), xh = svg.querySelector('.xhair'), tip = box.querySelector('.tip');
    const dots = [...xh.querySelectorAll('circle')], line = xh.querySelector('line');
    const show = (ev) => {
      const r = svg.getBoundingClientRect();
      const sx = ((ev.clientX - r.left) / r.width) * geo.W;
      const v = geo.x0 + ((sx - geo.L) / (geo.W - geo.L - geo.R)) * (geo.x1 - geo.x0);
      let i = 0, best = Infinity;
      geo.xs.forEach((x, k) => { const d = Math.abs(x - v); if (d < best) { best = d; i = k; } });
      const px = geo.X(geo.xs[i]);
      line.setAttribute('x1', px); line.setAttribute('x2', px);
      c.lines.forEach((ln, k) => { dots[k].setAttribute('cx', px); dots[k].setAttribute('cy', geo.Y(ln.values[i])); });
      xh.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.innerHTML = `<b>${fmt(geo.xs[i])} ${esc(c.xLabel || '')}</b>${c.lines.map((ln, k) => `<span><i style="background:${ln.dash ? 'var(--ink-3)' : SERIES[k % SERIES.length]}"></i>${esc(ln.name)}<em>${fmt(ln.values[i])}</em></span>`).join('')}`;
      const left = (px / geo.W) * r.width;
      tip.style.left = `${Math.min(r.width - tip.offsetWidth - 4, Math.max(4, left + 12))}px`;
    };
    const hide = () => { xh.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', hide);
  }

  /* ───────────── bars, tables, ownership grid, story ───────────── */
  function barsHtml(b) {
    const max = Math.max(1e-9, ...b.items.map((x) => x.value));
    return `<div class="sim-bars">${b.title ? `<div class="bt">${esc(b.title)}</div>` : ''}${b.items.map((x) => `<div class="br ${x.tone || ''}" title="${esc(x.label)}: ${fmt(x.value)}${b.unit ? ' ' + esc(b.unit) : ''}"><span class="bl">${x.tone ? `<i aria-hidden="true">${ICON[x.tone]}</i>` : ''}${esc(x.label)}</span><span class="bk"><i style="width:${(100 * x.value) / max}%"></i></span><span class="bv">${fmt(x.value)}${b.unit ? esc(b.unit) : ''}</span></div>`).join('')}</div>`;
  }
  function tableHtml(t) {
    return `<div class="tablewrap"><table class="t sim-t"><thead><tr>${t.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function ownershipHtml(v) {
    const rows = v.grid.length, cols = v.grid[0].length;
    const cw = 600 / cols, rh = 13, W = 640, H = rows * rh + 24;
    let s = `<svg class="sim-own" viewBox="0 0 ${W} ${H}" role="img" aria-label="Which consumer reads each partition over time"><defs><pattern id="hatch${uid}" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="5" height="5" class="stuck-bg"/><line x1="0" y1="0" x2="0" y2="5" class="stuck-ln"/></pattern></defs>`;
    for (let r = 0; r < rows; r++) {
      s += `<text class="ax" x="34" y="${r * rh + rh - 3}" text-anchor="end">p${r}</text>`;
      let c = 0;
      while (c < cols) {
        const o = v.grid[r][c];
        let e = c; while (e < cols && v.grid[r][e] === o) e++;
        const x = 40 + c * cw, w = (e - c) * cw;
        const fill = o >= 0 ? SERIES[o % SERIES.length] : o === -2 ? `url(#hatch${uid})` : 'var(--own-none)';
        s += `<rect x="${x.toFixed(1)}" y="${r * rh + 1}" width="${Math.max(0.5, w - 1).toFixed(1)}" height="${rh - 2}" rx="2" style="fill:${fill}"><title>p${r}: ${o >= 0 ? v.names[o] : o === -2 ? 'owned, but nobody is reading' : 'not assigned'} (${(c * v.dt).toFixed(1)}–${(e * v.dt).toFixed(1)} s)</title></rect>`;
        if (o >= 0 && w > 26) s += `<text class="own-l" x="${(x + w / 2).toFixed(1)}" y="${r * rh + rh - 3.5}" text-anchor="middle">${v.names[o]}</text>`;
        c = e;
      }
    }
    const secs = cols * v.dt;
    for (let t = 0; t <= secs; t += 10) s += `<text class="ax" x="${40 + (t / v.dt) * cw}" y="${H - 6}" text-anchor="middle">${t}</text>`;
    s += '</svg>';
    const used = [...new Set(v.grid.flat().filter((o) => o >= 0))].sort();
    return `<div class="sim-ownwrap"><div class="sim-legend">${used.map((o) => `<span><i style="background:${SERIES[o % SERIES.length]}"></i>${v.names[o]}</span>`).join('')}<span><i style="background:var(--own-none)"></i>not assigned</span><span><i class="hatch"></i>assigned, nobody reading</span><span class="yl">partition × seconds</span></div>${s}</div>`;
  }
  function storyHtml(st) {
    return `<details class="sim-story" open><summary>${esc(st.title)}</summary><ol>${st.steps.map((x) => `<li><span class="ms">${esc(x.tag || (x.ms === null ? 'result' : `${x.ms.toLocaleString('en')} ms`))}</span><span>${esc(x.what)}</span></li>`).join('')}</ol></details>`;
  }

  /* ───────────── compare ───────────── */
  function compareHtml(spec, p) {
    const q = spec.params.find((x) => x.id === spec.compare);
    const runs = q.options.map(([v, label]) => ({ label, cur: v === p[q.id], r: spec.run({ ...p, [q.id]: v }) }));
    const cols = runs[0].r.stats.map((s) => s.label);
    return `<div class="tablewrap"><table class="t sim-cmp"><thead><tr><th>${esc(q.label)}</th>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${runs.map((x) => `<tr class="${x.cur ? 'cur' : ''}"><td>${esc(x.label)}</td>${x.r.stats.map((s) => `<td class="${s.tone || ''}">${s.tone ? `<i aria-hidden="true">${ICON[s.tone]}</i>` : ''}${fmt(s.value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="small">Same scenario and settings for every row; only “${esc(q.label)}” changes.</p>`;
  }

  /* ───────────── mount ───────────── */
  function mount(el, name, presetStr) {
    const spec = BS && BS.all[name];
    if (!spec) { el.innerHTML = `<p class="small">Unknown simulator: ${esc(name)}</p>`; return; }
    uid++;
    const base = { ...BS.defaults(name), ...parsePreset(presetStr) };
    let p = { ...base };
    el.className = 'sim';
    el.innerHTML = `
      <div class="sim-head"><span class="tag">Simulator</span><b>${esc(spec.title)}</b><p>${esc(spec.blurb || '')}</p></div>
      <div class="sim-controls"></div>
      <div class="sim-out" aria-live="polite"></div>
      <div class="sim-foot">${spec.compare ? '<button class="btn sm" data-sim="cmp">Compare every option</button>' : ''}<button class="btn sm quiet" data-sim="reset">Reset</button><span class="small">A model, not a benchmark: same inputs, same result.</span></div>
      <div class="sim-cmpbox" hidden></div>`;
    const ctl = el.querySelector('.sim-controls'), out = el.querySelector('.sim-out'), cmp = el.querySelector('.sim-cmpbox');
    let timer = null;
    const draw = (controls = true) => {
      if (controls) ctl.innerHTML = controlsHtml(spec, p);
      let r;
      try { r = spec.run(p); } catch (e) { out.innerHTML = `<p class="small">The simulator failed: ${esc(e.message)}</p>`; return; }
      let html = r.stats ? statsHtml(r.stats) : '';
      let chart = null;
      if (r.chart) { chart = chartHtml(r.chart, out.clientWidth); html += chart.html; }
      if (r.bars) html += barsHtml(r.bars);
      if (r.view && r.view.kind === 'ownership') html += ownershipHtml(r.view);
      if (spec.view) html += spec.view(r, p);
      if (r.table) html += tableHtml(r.table);
      if (r.story) html += storyHtml(r.story);
      if (r.notes && r.notes.length) html += `<ul class="sim-notes">${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`;
      out.innerHTML = html;
      if (chart) wireChart(out, r.chart, chart.geo);
      if (!cmp.hidden) cmp.innerHTML = compareHtml(spec, p);
    };
    el.addEventListener('input', (e) => {
      const t = e.target.closest('[data-p]'); if (!t) return;
      const q = spec.params.find((x) => x.id === t.dataset.p);
      p[q.id] = q.type === 'toggle' ? t.checked : q.type === 'range' ? +t.value : t.value;
      if (q.type === 'range') {
        const o = t.parentElement.querySelector('output'); if (o) o.textContent = `${fmt(p[q.id])}${q.unit ? ` ${q.unit}` : ''}`;
        clearTimeout(timer); timer = setTimeout(() => draw(false), 90);
      } else draw();
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sim]'); if (!b) return;
      if (b.dataset.sim === 'reset') { p = { ...base }; draw(); }
      if (b.dataset.sim === 'cmp') {
        cmp.hidden = !cmp.hidden;
        b.textContent = cmp.hidden ? 'Compare every option' : 'Hide the comparison';
        if (!cmp.hidden) cmp.innerHTML = compareHtml(spec, p);
      }
    });
    draw();
    let wasSmall = out.clientWidth < 520;
    if ('ResizeObserver' in window) new ResizeObserver(() => { const small = out.clientWidth < 520; if (small !== wasSmall) { wasSmall = small; draw(false); } }).observe(out);
  }

  window.SimUI = { mount, parsePreset };
})();

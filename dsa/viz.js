/* DSA Lab visualizer: a step-through player for algorithm traces.
 *
 * A tracer is registered with DSAViz.add(id, { title, sub, inputs, code, run }).
 *   inputs: [{ key, label, type: 'ints'|'int'|'str'|'strs'|'matrix'|'grid'|'json', def }]
 *   code:   Java source shown beside the stage; frames point at a 1-based line
 *   run(input, t): calls t.step(line, msg, views) for every frame
 * Views are plain objects, rendered fresh for each frame:
 *   array  { t:'array', label, a:[...], ptr:{name: i | [i, 'bot', colour]}, cls:{i:'active'|'cmp'|'ok'|'bad'|'blue'|'dim'|'range'}, range:[lo,hi], bars, water:[...] }
 *   stack  { t:'stack', label, a:[...], cls:{i:cls}, kind:'stack'|'queue'|'deque'|'list' }
 *   map    { t:'map', label, e:[[k,v],...], cls:{k:cls} }
 *   vars   { t:'vars', v:{name:value}, chg:[names] }
 *   grid   { t:'grid', label, g:[[...]], cls:{'r,c':cls}, rh:[...], ch:[...], w, h }
 *   tree   { t:'tree', label, root, nodes:{id:{v,l,r}}, cls:{id:cls}, ptr:{name:id}, sub:{id:text} }
 *   graph  { t:'graph', label, nodes:[{id,x,y,label}], edges:[{a,b,w,dir}], cls:{id:cls}, ecls:{'a-b':cls}, sub:{id:text}, dir }
 *   list   { t:'list', label, nodes:[{id,v}], next:{id:id|null}, ptr:{name:id}, cls:{id:cls} }
 *   rtree  { t:'rtree', label, nodes:[{id,parent,text,cls,edge}] }   (layout comes from the final frame)
 *   ivals  { t:'ivals', label, a:[[s,e],...], cls:{i:cls}, sweep, lo, hi, rows:[i→row] }
 *   bits   { t:'bits', rows:[{label, v, w, hl:[bits], dec}] }
 *   note   { t:'note', html }
 *   row    { t:'row', items:[view, view] }
 */
(function () {
  'use strict';
  const REG = {};
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v) => (v === Infinity || v === Number.MAX_SAFE_INTEGER ? '∞' : v === -Infinity ? '−∞' : v === null || v === undefined ? '·' : Array.isArray(v) ? '[' + v.map(fmt).join(',') + ']' : typeof v === 'number' && !Number.isInteger(v) ? (+v.toFixed(2)).toString() : String(v));

  /* ───────────── Input parsing ───────────── */
  const PARSE = {
    int(s) { const v = Number(String(s).trim()); if (!Number.isInteger(v)) throw new Error('expected an integer'); return v; },
    ints(s) { const v = JSON.parse(s); if (!Array.isArray(v) || v.some((x) => typeof x !== 'number')) throw new Error('expected [1,2,3]'); return v; },
    str(s) { return String(s); },
    strs(s) { const v = JSON.parse(s); if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new Error('expected ["a","b"]'); return v; },
    matrix(s) { const v = JSON.parse(s); if (!Array.isArray(v) || v.some((r) => !Array.isArray(r))) throw new Error('expected [[1,2],[3,4]]'); return v; },
    grid(s) { const v = JSON.parse(s); if (!Array.isArray(v)) throw new Error('expected ["10","01"]'); return v.map((r) => (Array.isArray(r) ? r.map(String) : String(r).split(''))); },
    json(s) { return JSON.parse(s); },
  };
  const SHOW = {
    int: String, str: String, ints: JSON.stringify, strs: JSON.stringify, matrix: JSON.stringify, json: JSON.stringify,
    grid: (g) => JSON.stringify(g.map((r) => (Array.isArray(r) ? r.join('') : r))),
  };

  /* ───────────── Tracer context ───────────── */
  class Tracer {
    constructor(limit = 1500) { this.frames = []; this.limit = limit; }
    step(line, msg, views) {
      if (this.frames.length >= this.limit) { if (this.frames.length === this.limit) { this.frames.push({ line, msg: 'Stopped after ' + this.limit + ' steps — try a smaller input.', views: this.frames[this.frames.length - 1].views }); } throw new StopTrace(); }
      this.frames.push({ line, msg, views: JSON.parse(JSON.stringify(views)) });
    }
  }
  class StopTrace extends Error {}

  /* ───────────── Renderers ───────────── */
  const R = {};
  const label = (v) => (v.label ? `<div class="vlabel">${v.label}${v.note ? ` <span>${v.note}</span>` : ''}</div>` : '');

  R.array = (v) => {
    const n = v.a.length;
    const w = v.cw || Math.max(34, Math.min(46, ...v.a.map((x) => 14 + String(fmt(x)).length * 9)));
    const cls = v.cls || {};
    const inRange = (i) => v.range && i >= v.range[0] && i <= v.range[1];
    const x = (i) => i * (w + 4) + w / 2;
    let bars = '';
    if (v.bars) {
      const max = Math.max(1, ...v.a.map((y) => Math.abs(+y || 0)), ...(v.water || []).map((y, i) => (+v.a[i] || 0) + (+y || 0)));
      bars = `<div class="bars">${v.a.map((y, i) => {
        const h = Math.round((Math.max(0, +y || 0) / max) * 110);
        const wh = v.water ? Math.round(((+v.water[i] || 0) / max) * 110) : 0;
        return `<div style="display:flex;flex-direction:column;justify-content:flex-end;height:120px">${wh ? `<i class="water" style="height:${wh}px;border-radius:4px 4px 0 0"></i>` : ''}<i style="height:${h}px;${wh ? 'border-radius:0' : ''}"></i></div>`;
      }).join('')}</div>`;
    }
    const cells = v.a.map((y, i) => `<div class="cell ${cls[i] || ''} ${inRange(i) && !cls[i] ? 'range' : ''}">${esc(fmt(y))}${v.noIdx ? '' : `<span class="ix">${v.idx ? v.idx[i] : i}</span>`}</div>`).join('');
    const top = [], bot = [];
    let ci = 0;
    for (const [name, p] of Object.entries(v.ptr || {})) {
      const [i, pos, c] = Array.isArray(p) ? p : [p, 'top', null];
      ci++;
      if (i === null || i === undefined || i < -1 || i > n) continue;
      const html = `<span class="ptr c${c || ((ci - 1) % 5) + 1}" style="left:${x(i)}px">${esc(name)}</span>`;
      (pos === 'bot' ? bot : top).push(html);
    }
    // stack pointers at the same index vertically
    const stackPtrs = (arr) => {
      const seen = {};
      return arr.map((h) => { const m = /left:([\d.-]+)px/.exec(h); const k = m[1]; seen[k] = (seen[k] || 0) + 1; return seen[k] > 1 ? h.replace('style="', `style="margin-top:${-(seen[k] - 1) * 13}px;`) : h; });
    };
    const bracket = v.range && v.range[1] >= v.range[0] && !v.noBracket ? `<div class="bracket" style="left:${x(v.range[0]) - w / 2}px;width:${(v.range[1] - v.range[0]) * (w + 4) + w}px"></div>` : '';
    return `${label(v)}<div class="varr" style="--cw:${w}px"><div class="ptrs top">${stackPtrs(top).join('')}</div>${bars}<div class="cells">${cells || '<span class="vstack"><span class="empty">empty</span></span>'}</div><div class="ptrs bot">${stackPtrs(bot).join('')}</div>${bracket}</div>`;
  };

  R.stack = (v) => {
    const cls = v.cls || {};
    const kind = v.kind || 'stack';
    const items = v.a.map((y, i) => `<span class="cell ${cls[i] || ''}">${esc(fmt(y))}</span>`).join('');
    const ends = { stack: ['bottom', 'top ⟶'], queue: ['⟵ front', 'back'], deque: ['front', 'back'], list: ['', ''] }[kind];
    return `${label(v)}<div class="vstack">${v.a.length ? `<span class="end">${ends[0]}</span>${items}<span class="end">${ends[1]}</span>` : '<span class="empty">empty</span>'}</div>`;
  };

  R.map = (v) => {
    const cls = v.cls || {};
    const e = v.e || [];
    return `${label(v)}<div class="vmap">${e.length ? e.map(([k, val]) => `<span class="kv ${cls[k] || ''}"><span>${esc(fmt(k))}</span>${val === undefined ? '' : `<span>${esc(fmt(val))}</span>`}</span>`).join('') : '<span class="empty">empty</span>'}</div>`;
  };

  R.vars = (v) => {
    const chg = new Set(v.chg || []);
    return `<div class="vvars">${Object.entries(v.v).map(([k, val]) => `<span class="${chg.has(k) ? 'chg' : ''}"><b>${esc(k)} =</b> ${esc(fmt(val))}</span>`).join('')}</div>`;
  };

  R.note = (v) => `<div class="vvars" style="font-family:var(--f-ui)">${v.html}</div>`;

  R.grid = (v) => {
    const rows = v.g.length, cols = rows ? Math.max(...v.g.map((r) => r.length)) : 0;
    const cls = v.cls || {};
    const w = v.w || Math.max(30, Math.min(44, 14 + Math.max(1, ...v.g.flat().map((x) => String(fmt(x)).length)) * 8));
    const h = v.h || Math.min(w, 34);
    const hasRh = !!v.rh, hasCh = !!v.ch;
    let html = '';
    if (hasCh) { if (hasRh) html += '<div class="h"></div>'; for (let c = 0; c < cols; c++) html += `<div class="h">${esc(v.ch[c] ?? '')}</div>`; }
    for (let r = 0; r < rows; r++) {
      if (hasRh) html += `<div class="h">${esc(v.rh[r] ?? '')}</div>`;
      for (let c = 0; c < cols; c++) {
        const val = v.g[r][c];
        const k = cls[r + ',' + c] || '';
        html += `<div class="g ${k} ${v.base ? v.base(val) : ''}">${v.hideVals ? '' : esc(val === undefined ? '' : fmt(val))}</div>`;
      }
    }
    return `${label(v)}<div class="vgrid" style="grid-template-columns:repeat(${cols + (hasRh ? 1 : 0)}, var(--gw));--gw:${w}px;--gh:${h}px">${html}</div>`;
  };

  // Binary tree: x = in-order position, y = depth.
  R.tree = (v) => {
    const nodes = v.nodes || {};
    if (v.root === null || v.root === undefined || !nodes[v.root]) return `${label(v)}<div class="vstack"><span class="empty">empty tree</span></div>`;
    const pos = {}; let order = 0, maxD = 0;
    (function walk(id, d) { if (id === null || id === undefined || !nodes[id]) return; walk(nodes[id].l, d + 1); pos[id] = { x: order++, d }; maxD = Math.max(maxD, d); walk(nodes[id].r, d + 1); })(v.root, 0);
    const dx = v.dx || 46, dy = 62, r = 18, pad = 26;
    const W = order * dx + pad * 2, Hh = maxD * dy + pad * 2 + 30;
    const X = (id) => pad + pos[id].x * dx + dx / 2 - 10, Y = (id) => pad + 8 + pos[id].d * dy;
    const cls = v.cls || {}, ecls = v.ecls || {};
    let edges = '', ns = '', labels = '';
    for (const id of Object.keys(pos)) {
      for (const ch of [nodes[id].l, nodes[id].r]) if (ch !== null && ch !== undefined && pos[ch]) edges += `<line class="edge ${ecls[id + '-' + ch] || ''}" x1="${X(id)}" y1="${Y(id)}" x2="${X(ch)}" y2="${Y(ch)}"/>`;
      ns += `<g class="node ${cls[id] || ''}"><circle cx="${X(id)}" cy="${Y(id)}" r="${r}"/><text x="${X(id)}" y="${Y(id)}">${esc(fmt(nodes[id].v))}</text>${v.sub && v.sub[id] !== undefined ? `<text class="sub" x="${X(id)}" y="${Y(id) + r + 11}">${esc(v.sub[id])}</text>` : ''}</g>`;
    }
    const byNode = {};
    for (const [name, id] of Object.entries(v.ptr || {})) if (pos[id]) (byNode[id] = byNode[id] || []).push(name);
    let pi = 0;
    for (const [id, names] of Object.entries(byNode)) labels += `<text class="plabel c${(pi++ % 5) + 1}" x="${X(id)}" y="${Y(id) - r - 6}">${esc(names.join(','))}</text>`;
    return `${label(v)}<svg class="vsvg" viewBox="0 0 ${W} ${Hh}" width="${W}" style="max-width:100%">${edges}${ns}${labels}</svg>`;
  };

  function arrowDefs(uid) {
    return `<defs><marker id="ah${uid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker><marker id="aha${uid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrowhead active"/></marker></defs>`;
  }
  let uidN = 0;

  R.graph = (v) => {
    const uid = ++uidN;
    const n = v.nodes.length;
    const W = v.W || 520, Hh = v.H || 300, r = 19;
    const P = {};
    v.nodes.forEach((nd, i) => {
      const x = nd.x !== undefined ? nd.x : 0.5 + 0.42 * Math.cos((2 * Math.PI * i) / n - Math.PI / 2);
      const y = nd.y !== undefined ? nd.y : 0.5 + 0.42 * Math.sin((2 * Math.PI * i) / n - Math.PI / 2);
      P[nd.id] = { x: 30 + x * (W - 60), y: 26 + y * (Hh - 52) };
    });
    const cls = v.cls || {}, ecls = v.ecls || {};
    let edges = '', ns = '';
    for (const e of v.edges) {
      const a = P[e.a], b = P[e.b]; if (!a || !b) continue;
      const k = ecls[e.a + '-' + e.b] || (!v.dir ? ecls[e.b + '-' + e.a] : '') || '';
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const x1 = a.x + (dx / len) * r, y1 = a.y + (dy / len) * r, x2 = b.x - (dx / len) * (r + (v.dir ? 3 : 0)), y2 = b.y - (dy / len) * (r + (v.dir ? 3 : 0));
      const curve = v.dir && v.edges.some((f) => f.a === e.b && f.b === e.a);
      if (curve) {
        const mx = (x1 + x2) / 2 - (dy / len) * 16, my = (y1 + y2) / 2 + (dx / len) * 16;
        edges += `<path class="edge ${k}" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" ${v.dir ? `marker-end="url(#${k === 'active' || k === 'ok' ? 'aha' : 'ah'}${uid})"` : ''}/>`;
        if (e.w !== undefined) edges += `<text class="elabel" x="${mx}" y="${my}">${esc(e.w)}</text>`;
      } else {
        edges += `<line class="edge ${k}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${v.dir ? `marker-end="url(#${k === 'active' || k === 'ok' ? 'aha' : 'ah'}${uid})"` : ''}/>`;
        if (e.w !== undefined) edges += `<text class="elabel" x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2}">${esc(e.w)}</text>`;
      }
    }
    for (const nd of v.nodes) {
      const p = P[nd.id];
      ns += `<g class="node ${cls[nd.id] || ''}"><circle cx="${p.x}" cy="${p.y}" r="${r}"/><text x="${p.x}" y="${p.y}">${esc(nd.label ?? nd.id)}</text>${v.sub && v.sub[nd.id] !== undefined ? `<text class="sub" x="${p.x}" y="${p.y + r + 11}">${esc(fmt(v.sub[nd.id]))}</text>` : ''}</g>`;
    }
    return `${label(v)}<svg class="vsvg" viewBox="0 0 ${W} ${Hh}" width="${W}" style="max-width:100%">${arrowDefs(uid)}${edges}${ns}</svg>`;
  };

  R.list = (v) => {
    const uid = ++uidN;
    const dx = 74, y = 58, bw = 44, bh = 32, pad = 24;
    const idx = {}; v.nodes.forEach((nd, i) => { idx[nd.id] = i; });
    const W = Math.max(1, v.nodes.length) * dx + pad * 2 + 40, Hh = 128;
    const X = (i) => pad + i * dx;
    const cls = v.cls || {};
    let edges = '', ns = '', labels = '';
    for (const nd of v.nodes) {
      const i = idx[nd.id];
      ns += `<g class="node ${cls[nd.id] || ''}"><rect x="${X(i)}" y="${y - bh / 2}" width="${bw}" height="${bh}" rx="7"/><text x="${X(i) + bw / 2}" y="${y}">${esc(fmt(nd.v))}</text></g>`;
      const to = v.next ? v.next[nd.id] : undefined;
      if (to === null) edges += `<text class="elabel" x="${X(i) + bw + 14}" y="${y}">∅</text>`;
      else if (to !== undefined && idx[to] !== undefined) {
        const j = idx[to];
        const active = (v.ecls || {})[nd.id] || '';
        if (j === i + 1) edges += `<line class="edge ${active}" x1="${X(i) + bw}" y1="${y}" x2="${X(j) - 3}" y2="${y}" marker-end="url(#${active ? 'aha' : 'ah'}${uid})"/>`;
        else {
          const x1 = X(i) + bw / 2, x2 = X(j) + bw / 2, up = j < i;
          const yy = up ? y + bh / 2 : y - bh / 2, cy = up ? y + bh / 2 + 34 : y - bh / 2 - 30;
          edges += `<path class="edge ${active}" d="M${x1},${yy} C${x1},${cy} ${x2},${cy} ${x2},${yy + (up ? 3 : -3)}" marker-end="url(#${active ? 'aha' : 'ah'}${uid})"/>`;
        }
      }
    }
    const byNode = {};
    for (const [name, id] of Object.entries(v.ptr || {})) {
      if (id === null) { (byNode.__null = byNode.__null || []).push(name); continue; }
      if (idx[id] !== undefined) (byNode[id] = byNode[id] || []).push(name);
    }
    let pi = 0;
    for (const [id, names] of Object.entries(byNode)) {
      const x = id === '__null' ? X(v.nodes.length) + bw / 2 : X(idx[id]) + bw / 2;
      labels += `<text class="plabel c${(pi++ % 5) + 1}" x="${x}" y="${y - bh / 2 - 10}">${esc(names.join(','))}</text>`;
      if (id === '__null') labels += `<text class="elabel" x="${x}" y="${y}">null</text>`;
    }
    return `${label(v)}<svg class="vsvg" viewBox="0 0 ${W} ${Hh}" width="${W}" style="max-width:100%">${arrowDefs(uid)}${edges}${ns}${labels}</svg>`;
  };

  // Recursion tree; `layout` (from the last frame) keeps node positions stable while it grows.
  function rtreeLayout(v) {
    const kids = {}, roots = [];
    for (const nd of v.nodes) { if (nd.parent === null || nd.parent === undefined) roots.push(nd.id); else (kids[nd.parent] = kids[nd.parent] || []).push(nd.id); }
    const pos = {}; let leaf = 0, maxD = 0;
    (function walk(ids, d) {
      for (const id of ids) {
        maxD = Math.max(maxD, d);
        const ch = kids[id] || [];
        if (!ch.length) pos[id] = { x: leaf++, d };
        else { walk(ch, d + 1); pos[id] = { x: (pos[ch[0]].x + pos[ch[ch.length - 1]].x) / 2, d }; }
      }
    })(roots, 0);
    return { pos, leaves: Math.max(1, leaf), maxD };
  }
  R.rtree = (v, layout) => {
    const L = layout || rtreeLayout(v);
    const texts = v.nodes.map((n) => String(n.text));
    const bw = Math.max(34, Math.min(120, 12 + Math.max(...texts.map((t) => t.length)) * 7.4));
    const dx = bw + 8, dy = 56, pad = 16;
    const W = L.leaves * dx + pad * 2, Hh = L.maxD * dy + pad * 2 + 30;
    const X = (id) => pad + L.pos[id].x * dx + dx / 2, Y = (id) => pad + 14 + L.pos[id].d * dy;
    let edges = '', ns = '';
    for (const nd of v.nodes) {
      if (!L.pos[nd.id]) continue;
      if (nd.parent !== null && nd.parent !== undefined && L.pos[nd.parent]) {
        edges += `<line class="edge ${nd.ecls || ''}" x1="${X(nd.parent)}" y1="${Y(nd.parent) + 13}" x2="${X(nd.id)}" y2="${Y(nd.id) - 13}"/>`;
        if (nd.edge) edges += `<text class="elabel" x="${(X(nd.parent) + X(nd.id)) / 2}" y="${(Y(nd.parent) + Y(nd.id)) / 2}">${esc(nd.edge)}</text>`;
      }
      ns += `<g class="node ${nd.cls || ''}"><rect x="${X(nd.id) - bw / 2}" y="${Y(nd.id) - 13}" width="${bw}" height="26" rx="6"/><text x="${X(nd.id)}" y="${Y(nd.id)}" style="font-size:12px">${esc(nd.text)}</text></g>`;
    }
    return `${label(v)}<svg class="vsvg" viewBox="0 0 ${W} ${Hh}" width="${W}" style="max-width:100%">${edges}${ns}</svg>`;
  };

  R.ivals = (v) => {
    const lo = v.lo ?? Math.min(...v.a.map((x) => x[0])), hi = v.hi ?? Math.max(...v.a.map((x) => x[1]));
    const span = Math.max(1, hi - lo);
    const W = v.W || 560;
    const X = (t) => ((t - lo) / span) * (W - 20) + 10;
    const cls = v.cls || {};
    const rows = v.rows || v.a.map((_, i) => i);
    const nRows = Math.max(1, ...rows.map((r) => r + 1));
    let html = '';
    for (let r = 0; r < nRows; r++) {
      html += `<div class="row">${v.a.map((iv, i) => (rows[i] === r ? `<div class="bar ${cls[i] || ''}" style="left:${X(iv[0])}px;width:${Math.max(18, X(iv[1]) - X(iv[0]))}px">${esc(v.text ? v.text[i] : iv[0] + '–' + iv[1])}</div>` : '')).join('')}</div>`;
    }
    const ticks = [];
    const step = Math.max(1, Math.ceil(span / 12));
    for (let t = lo; t <= hi; t += step) ticks.push(`<span style="left:${X(t)}px">${t}</span>`);
    const sweep = v.sweep !== undefined && v.sweep !== null ? `<div class="sweep" style="left:${X(v.sweep)}px"></div>` : '';
    return `${label(v)}<div class="vtl" style="width:${W}px">${html}<div class="axis">${ticks.join('')}</div>${sweep}</div>`;
  };

  R.bits = (v) => `${label(v)}<div class="vbits">${v.rows.map((row) => {
    const w = row.w || 8;
    const val = row.v >>> 0;
    let cells = '';
    for (let b = w - 1; b >= 0; b--) cells += `<span class="b ${(val >>> b) & 1 ? 'one' : ''} ${(row.hl || []).includes(b) ? 'hl' : ''}">${(val >>> b) & 1}</span>`;
    return `<div class="brow"><span class="lab">${esc(row.label)}</span>${cells}<span class="dec">${esc(row.dec !== undefined ? row.dec : row.v)}</span></div>`;
  }).join('')}</div>`;

  R.row = (v, layouts, vid) => `<div style="display:flex;gap:28px;flex-wrap:wrap;align-items:flex-start">${v.items.map((x, i) => `<div class="vview">${renderView(x, layouts, vid + '.' + i)}</div>`).join('')}</div>`;

  function renderView(v, layouts, vid) {
    const f = R[v.t];
    if (!f) return `<div class="vvars">unknown view ${esc(v.t)}</div>`;
    return f(v, layouts && layouts[vid], layouts, vid);
  }

  /* ───────────── Java highlighting (shared with the app) ───────────── */
  const KW = new Set('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while var record yield true false null'.split(' '));
  function highlightJava(src) {
    let out = '';
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\b\d[\d_]*(?:\.\d+)?[lLdDfF]?\b|\b0x[0-9a-fA-F_]+\b)|(@\w+)|([A-Za-z_$][\w$]*)|([\s\S])/g;
    let m;
    while ((m = re.exec(src))) {
      if (m[1]) out += `<span class="tok-c">${esc(m[1])}</span>`;
      else if (m[2]) out += `<span class="tok-s">${esc(m[2])}</span>`;
      else if (m[3]) out += `<span class="tok-n">${esc(m[3])}</span>`;
      else if (m[4]) out += `<span class="tok-a">${esc(m[4])}</span>`;
      else if (m[5]) out += KW.has(m[5]) ? `<span class="tok-k">${m[5]}</span>` : /^[A-Z]/.test(m[5]) ? `<span class="tok-t">${m[5]}</span>` : m[5];
      else out += esc(m[6]);
    }
    return out;
  }

  /* ───────────── Player ───────────── */
  function computeLayouts(frames) {
    // For rtree views, lay out the largest version so nodes don't jump as the tree grows.
    const layouts = {};
    const visit = (views, prefix) => views.forEach((v, i) => {
      const vid = prefix + i;
      if (v.t === 'rtree') { if (!layouts[vid] || v.nodes.length > layouts[vid].__n) { layouts[vid] = rtreeLayout(v); layouts[vid].__n = v.nodes.length; } }
      if (v.t === 'row') v.items.forEach((x, j) => { if (x.t === 'rtree') { const k = vid + '.' + j; if (!layouts[k] || x.nodes.length > layouts[k].__n) { layouts[k] = rtreeLayout(x); layouts[k].__n = x.nodes.length; } } });
    });
    for (const f of frames) visit(f.views, 'v');
    return layouts;
  }

  function mount(el, id, override) {
    const spec = REG[id];
    if (!spec) { el.innerHTML = `<div class="viz-msg">Visualizer “${esc(id)}” not found.</div>`; return; }
    const input = {};
    for (const inp of spec.inputs || []) input[inp.key] = inp.def;
    Object.assign(input, override || {});
    const hasCode = !!spec.code;
    el.classList.add('viz');
    if (hasCode) el.classList.add('with-code');
    const title = el.dataset.title || spec.title;
    el.innerHTML = `
      <div class="viz-top">
        <div class="ttl">${esc(title)}${spec.sub ? `<small>${spec.sub}</small>` : ''}</div>
        <span class="spacer"></span>
        ${(spec.inputs || []).length ? `<button class="btn sm quiet" data-a="edit" title="Change the input">Edit input</button>` : ''}
        ${hasCode ? `<button class="btn sm quiet" data-a="code" title="Show or hide the Java code">Code</button>` : ''}
      </div>
      <div class="viz-input" hidden style="padding:10px 14px;border-bottom:1px solid var(--rule);background:var(--panel-2)">
        ${(spec.inputs || []).map((inp) => `<label>${esc(inp.label || inp.key)} <input data-k="${esc(inp.key)}" value="${esc(SHOW[inp.type](input[inp.key]))}" size="${Math.min(46, Math.max(4, SHOW[inp.type](input[inp.key]).length + 2))}" spellcheck="false"></label>`).join('')}
        <button class="btn sm primary" data-a="apply">Run</button><span class="viz-err" style="color:var(--bad);font-size:12.5px"></span>
      </div>
      <div class="viz-body"><div class="viz-stage" tabindex="0" aria-live="polite"></div>${hasCode ? `<div class="viz-code">${spec.code.replace(/^\n+|\s+$/g, '').split('\n').map((l) => `<div>${highlightJava(l) || ' '}</div>`).join('')}</div>` : ''}</div>
      <div class="viz-msg"></div>
      <div class="viz-ctrl">
        <button class="btn" data-a="first" title="First step" aria-label="First step">⏮</button>
        <button class="btn" data-a="prev" title="Previous step (←)" aria-label="Previous step">◀</button>
        <button class="btn primary" data-a="play" title="Play / pause (space)" aria-label="Play">▶ Play</button>
        <button class="btn" data-a="next" title="Next step (→)" aria-label="Next step">▶|</button>
        <button class="btn" data-a="last" title="Last step" aria-label="Last step">⏭</button>
        <input type="range" class="scrub" min="0" max="0" value="0" aria-label="Step">
        <span class="step"></span>
        <select title="Speed" aria-label="Speed"><option value="1400">0.5×</option><option value="800" selected>1×</option><option value="400">2×</option><option value="150">5×</option></select>
      </div>`;
    const stage = el.querySelector('.viz-stage'), msg = el.querySelector('.viz-msg'), scrub = el.querySelector('.scrub'), stepEl = el.querySelector('.step');
    const codeLines = hasCode ? [...el.querySelectorAll('.viz-code div')] : [];
    const playBtn = el.querySelector('[data-a=play]'), speed = el.querySelector('select');
    if (hasCode && (el.dataset.code === 'hide' || window.innerWidth < 700)) el.querySelector('.viz-code').hidden = true;
    let frames = [], layouts = {}, i = 0, timer = null;

    function build() {
      const t = new Tracer(spec.limit || 1500);
      try { spec.run(JSON.parse(JSON.stringify(input)), t); }
      catch (e) { if (!(e instanceof StopTrace)) { t.frames.push({ line: 0, msg: `<span style="color:var(--bad)">Could not trace this input: ${esc(e.message)}</span>`, views: [] }); } }
      frames = t.frames.length ? t.frames : [{ line: 0, msg: 'Nothing to show.', views: [] }];
      layouts = computeLayouts(frames);
      scrub.max = frames.length - 1;
      go(0);
    }
    function go(k) {
      i = Math.max(0, Math.min(frames.length - 1, k));
      const f = frames[i];
      stage.innerHTML = f.views.map((v, j) => `<div class="vview">${renderView(v, layouts, 'v' + j)}</div>`).join('');
      msg.innerHTML = f.msg || '';
      scrub.value = i;
      stepEl.textContent = `${i + 1} / ${frames.length}`;
      codeLines.forEach((d, n) => d.classList.toggle('on', n + 1 === f.line));
      const on = codeLines[f.line - 1];
      if (on && !on.parentElement.hidden) { const box = on.parentElement; const top = on.offsetTop - box.offsetTop; if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 30) box.scrollTop = top - box.clientHeight / 3; }
      if (i === frames.length - 1) stop();
    }
    function play() {
      if (i >= frames.length - 1) go(0);
      playBtn.textContent = '❚❚ Pause'; playBtn.setAttribute('aria-label', 'Pause');
      clearInterval(timer);
      timer = setInterval(() => { if (!document.body.contains(el)) { clearInterval(timer); return; } go(i + 1); }, +speed.value);
    }
    function stop() { clearInterval(timer); timer = null; playBtn.textContent = '▶ Play'; playBtn.setAttribute('aria-label', 'Play'); }
    speed.onchange = () => { if (timer) play(); };
    scrub.oninput = () => { stop(); go(+scrub.value); };
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      const act = a.dataset.a;
      if (act === 'first') { stop(); go(0); }
      else if (act === 'prev') { stop(); go(i - 1); }
      else if (act === 'next') { stop(); go(i + 1); }
      else if (act === 'last') { stop(); go(frames.length - 1); }
      else if (act === 'play') { timer ? stop() : play(); }
      else if (act === 'edit') { const box = el.querySelector('.viz-input'); box.hidden = !box.hidden; if (!box.hidden) box.querySelector('input').focus(); }
      else if (act === 'code') { const c = el.querySelector('.viz-code'); c.hidden = !c.hidden; }
      else if (act === 'apply') apply();
    });
    function apply() {
      const err = el.querySelector('.viz-err'); err.textContent = '';
      const next = { ...input };
      for (const box of el.querySelectorAll('.viz-input input')) {
        const inp = spec.inputs.find((x) => x.key === box.dataset.k);
        try { next[inp.key] = PARSE[inp.type](box.value); box.classList.remove('bad'); }
        catch (e) { box.classList.add('bad'); err.textContent = `${inp.label || inp.key}: ${e.message}`; return; }
      }
      if (spec.check) { const why = spec.check(next); if (why) { err.textContent = why; return; } }
      Object.assign(input, next); stop(); build();
    }
    el.querySelector('.viz-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { stop(); go(i + 1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { stop(); go(i - 1); e.preventDefault(); }
      else if (e.key === ' ') { timer ? stop() : play(); e.preventDefault(); }
    });
    build();
  }

  /* ───────────── Helpers for tracers ───────────── */
  const H = {
    // index → class map from pairs like [[i,'active'], [j,'cmp']] (later wins)
    cls(...pairs) { const o = {}; for (const [k, c] of pairs) if (k !== null && k !== undefined && k !== false) o[k] = c; return o; },
    // binary tree from level order [1,2,null,3] → { root, nodes }
    tree(level) {
      const nodes = {}; if (!level.length || level[0] === null) return { root: null, nodes };
      let id = 0; const mk = (v) => { const k = 'n' + id++; nodes[k] = { v, l: null, r: null }; return k; };
      const root = mk(level[0]); const q = [root]; let i = 1;
      while (q.length && i < level.length) {
        const n = q.shift();
        if (i < level.length && level[i] !== null) { nodes[n].l = mk(level[i]); q.push(nodes[n].l); } i++;
        if (i < level.length && level[i] !== null) { nodes[n].r = mk(level[i]); q.push(nodes[n].r); } i++;
      }
      return { root, nodes };
    },
    range(n) { return Array.from({ length: n }, (_, i) => i); },
  };

  window.DSAViz = { add(id, spec) { REG[id] = spec; }, mount, has: (id) => !!REG[id], list: () => Object.keys(REG), highlightJava, H, fmt, esc, render: renderView };
})();

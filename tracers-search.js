/* DSA Lab — tracers for backtracking and graphs. */
(function () {
  'use strict';
  const V = window.DSAViz, add = V.add;

  /* ═════════════ Backtracking ═════════════ */
  add('subsetsTree', {
    title: 'Subsets: the recursion tree', sub: 'Every node is a partial answer (and here, every node is also a subset). Children extend it with a later element.',
    inputs: [{ key: 'nums', label: 'nums', type: 'ints', def: [1, 2, 3] }],
    check: ({ nums }) => (nums.length > 4 ? 'at most 4 elements (the tree doubles each time)' : null),
    code: `
List<List<Integer>> subsets(int[] nums) {
    List<List<Integer>> res = new ArrayList<>();
    backtrack(nums, 0, new ArrayList<>(), res);
    return res;
}

void backtrack(int[] nums, int start, List<Integer> path, List<List<Integer>> res) {
    res.add(new ArrayList<>(path));          // every node is a subset
    for (int i = start; i < nums.length; i++) {
        path.add(nums[i]);                   // choose
        backtrack(nums, i + 1, path, res);   // explore
        path.remove(path.size() - 1);        // un-choose
    }
}`,
    run({ nums }, t) {
      const nodes = []; const res = []; let id = 0;
      const view = (cur) => [{ t: 'rtree', label: 'decision tree (edges show the element chosen)', nodes: nodes.map((n) => ({ ...n, cls: n.id === cur ? 'active' : n.cls })) }, { t: 'stack', label: `subsets found (${res.length})`, a: res.map((s) => `[${s}]`), kind: 'list' }];
      (function bt(start, path, parent, edge) {
        const me = 'n' + id++;
        nodes.push({ id: me, parent, text: `[${path}]`, edge, cls: 'ok' });
        res.push(path.slice());
        t.step(9, `Node [${path}]: record it as a subset.`, view(me));
        for (let i = start; i < nums.length; i++) {
          path.push(nums[i]);
          t.step(11, `Choose ${nums[i]} (only elements after index ${i - 1 < start ? start - 1 : i - 1}, so no subset appears twice).`, view(me));
          bt(i + 1, path, me, String(nums[i]));
          path.pop();
          t.step(13, `Un-choose ${nums[i]}: back to [${path}].`, view(me));
        }
      })(0, [], null, '');
      t.step(9, `${res.length} = 2^${nums.length} subsets. Each takes O(n) to copy, so O(n · 2ⁿ) in total.`, view(null));
    },
  });

  add('permTree', {
    title: 'Permutations: choose any unused element', sub: 'A used[] array tracks what’s already in the path; leaves are complete permutations.',
    inputs: [{ key: 'nums', label: 'nums', type: 'ints', def: [1, 2, 3] }],
    check: ({ nums }) => (nums.length > 4 ? 'at most 4 elements' : null),
    code: `
void backtrack(int[] nums, boolean[] used, List<Integer> path, List<List<Integer>> res) {
    if (path.size() == nums.length) { res.add(new ArrayList<>(path)); return; }
    for (int i = 0; i < nums.length; i++) {
        if (used[i]) continue;
        used[i] = true; path.add(nums[i]);          // choose
        backtrack(nums, used, path, res);            // explore
        used[i] = false; path.remove(path.size() - 1); // un-choose
    }
}`,
    run({ nums }, t) {
      const nodes = []; const res = []; let id = 0; const used = nums.map(() => false);
      const view = (cur) => [{ t: 'rtree', label: 'decision tree', nodes: nodes.map((n) => ({ ...n, cls: n.id === cur ? 'active' : n.cls })) }, { t: 'array', label: 'used[]', a: used.map((u) => (u ? 'T' : 'F')), cls: Object.fromEntries(used.map((u, i) => [i, u ? 'cmp' : ''])), cw: 30 }, { t: 'stack', label: `permutations (${res.length})`, a: res.map((s) => `[${s}]`), kind: 'list' }];
      (function bt(path, parent, edge) {
        const me = 'n' + id++;
        const leaf = path.length === nums.length;
        nodes.push({ id: me, parent, text: `[${path}]`, edge, cls: leaf ? 'ok' : '' });
        if (leaf) { res.push(path.slice()); t.step(2, `Complete: record [${path}].`, view(me)); return; }
        t.step(3, `At [${path}]: try every unused element.`, view(me));
        for (let i = 0; i < nums.length; i++) {
          if (used[i]) continue;
          used[i] = true; path.push(nums[i]);
          bt(path, me, String(nums[i]));
          used[i] = false; path.pop();
        }
      })([], null, '');
      t.step(2, `${res.length} = ${nums.length}! permutations: O(n · n!) with the copies.`, view(null));
    },
  });

  add('combSumTree', {
    title: 'Combination sum with pruning', sub: 'Sort the candidates; once a candidate overshoots the remaining target, every later (bigger) one does too, so stop the loop.',
    inputs: [{ key: 'cands', label: 'candidates', type: 'ints', def: [2, 3, 6, 7] }, { key: 'target', label: 'target', type: 'int', def: 7 }],
    check: ({ cands, target }) => (cands.length > 5 || target > 12 || cands.some((c) => c <= 0) ? 'up to 5 positive candidates, target ≤ 12' : null),
    code: `
void backtrack(int[] c, int start, int remaining, List<Integer> path, List<List<Integer>> res) {
    if (remaining == 0) { res.add(new ArrayList<>(path)); return; }
    for (int i = start; i < c.length; i++) {
        if (c[i] > remaining) break;                    // sorted: all later ones are too big
        path.add(c[i]);
        backtrack(c, i, remaining - c[i], path, res);   // i, not i + 1: reuse allowed
        path.remove(path.size() - 1);
    }
}`,
    run({ cands, target }, t) {
      const c = cands.slice().sort((a, b) => a - b);
      const nodes = []; const res = []; let id = 0;
      const view = (cur) => [{ t: 'rtree', label: `target ${target}; nodes show the remaining amount`, nodes: nodes.map((n) => ({ ...n, cls: n.id === cur ? 'active' : n.cls })) }, { t: 'stack', label: 'combinations', a: res.map((s) => `[${s}]`), kind: 'list' }];
      (function bt(start, rem, path, parent, edge) {
        const me = 'n' + id++;
        nodes.push({ id: me, parent, text: rem === 0 ? `✓ [${path}]` : `${rem}`, edge, cls: rem === 0 ? 'ok' : '' });
        if (rem === 0) { res.push(path.slice()); t.step(2, `Remaining 0: record [${path}].`, view(me)); return; }
        t.step(3, `Remaining ${rem}: try candidates from ${c[start]} upward.`, view(me));
        for (let i = start; i < c.length; i++) {
          if (c[i] > rem) {
            const pid = 'x' + id++; nodes.push({ id: pid, parent: me, text: '✂', edge: String(c[i]), cls: 'bad' });
            t.step(4, `${c[i]} &gt; ${rem}: <b>prune</b>. The list is sorted, so every later candidate is too big as well.`, view(pid));
            break;
          }
          path.push(c[i]); bt(i, rem - c[i], path, me, String(c[i])); path.pop();
        }
      })(0, target, [], null, '');
      t.step(2, `${res.length} combination(s). Starting each loop at i (not 0) prevents permutations of the same combination; the break prunes whole subtrees.`, view(null));
    },
  });

  add('nQueens', {
    title: 'N-Queens: place row by row', sub: 'One queen per row. A placement is safe if its column and both diagonals are free (sets give O(1) checks).',
    inputs: [{ key: 'n', label: 'n', type: 'int', def: 5 }],
    check: ({ n }) => (n < 1 || n > 6 ? 'n between 1 and 6' : null),
    code: `
void place(int r, int n, int[] col, boolean[] usedCol, boolean[] d1, boolean[] d2, List<int[]> res) {
    if (r == n) { res.add(col.clone()); return; }
    for (int c = 0; c < n; c++) {
        if (usedCol[c] || d1[r + c] || d2[r - c + n - 1]) continue;   // attacked
        col[r] = c; usedCol[c] = d1[r + c] = d2[r - c + n - 1] = true;
        place(r + 1, n, col, usedCol, d1, d2, res);
        usedCol[c] = d1[r + c] = d2[r - c + n - 1] = false;          // backtrack
    }
}`,
    limit: 900,
    run({ n }, t) {
      const col = Array(n).fill(-1); let found = 0;
      const usedCol = Array(n).fill(false), d1 = Array(2 * n).fill(false), d2 = Array(2 * n).fill(false);
      const board = (hl) => {
        const g = Array.from({ length: n }, () => Array(n).fill(''));
        const cls = {};
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (usedCol[c] || d1[r + c] || d2[r - c + n - 1]) cls[r + ',' + c] = 'attacked';
        for (let r = 0; r < n; r++) if (col[r] >= 0) cls[r + ',' + col[r]] = 'queen';
        if (hl) cls[hl] = (cls[hl] || '') + ' ' + (hl.cls || '');
        return { t: 'grid', label: `board (${found} solution${found === 1 ? '' : 's'} found)`, g, cls, w: 38, h: 38, hideVals: true };
      };
      (function place(r) {
        if (r === n) { found++; t.step(2, `All ${n} rows filled: solution #${found}.`, [board()]); return; }
        for (let c = 0; c < n; c++) {
          if (usedCol[c] || d1[r + c] || d2[r - c + n - 1]) { t.step(4, `Row ${r}, column ${c} is attacked. Skip.`, [{ ...board(), cls: { ...board().cls, [r + ',' + c]: 'bad' } }]); continue; }
          col[r] = c; usedCol[c] = d1[r + c] = d2[r - c + n - 1] = true;
          t.step(5, `Place a queen at row ${r}, column ${c}.`, [board()]);
          place(r + 1);
          usedCol[c] = d1[r + c] = d2[r - c + n - 1] = false; col[r] = -1;
          t.step(7, `Backtrack: remove the queen from row ${r}, column ${c}.`, [board()]);
        }
      })(0);
      t.step(2, `${found} solution(s) for n = ${n}. Checks are O(1), so the work is roughly the number of partial placements explored (well under n!).`, [board()]);
    },
  });

  add('wordSearchGrid', {
    title: 'Word search: DFS with in-place visited marks', sub: 'Mark a cell while it is on the current path, and unmark it when you backtrack.',
    inputs: [{ key: 'grid', label: 'board rows', type: 'grid', def: ['ABCE', 'SFCS', 'ADEE'] }, { key: 'word', label: 'word', type: 'str', def: 'ABCCED' }],
    check: ({ grid, word }) => (grid.length > 5 || grid[0].length > 6 ? 'at most 5 × 6' : word.length > 12 ? 'word up to 12 letters' : null),
    code: `
boolean dfs(char[][] b, String w, int i, int r, int c) {
    if (i == w.length()) return true;
    if (r < 0 || c < 0 || r >= b.length || c >= b[0].length || b[r][c] != w.charAt(i)) return false;
    char saved = b[r][c];
    b[r][c] = '#';                                   // on the current path
    boolean found = dfs(b, w, i + 1, r + 1, c) || dfs(b, w, i + 1, r - 1, c)
                 || dfs(b, w, i + 1, r, c + 1) || dfs(b, w, i + 1, r, c - 1);
    b[r][c] = saved;                                 // backtrack
    return found;
}`,
    limit: 800,
    run({ grid, word }, t) {
      const g = grid.map((r) => r.slice()); const R = g.length, C = g[0].length;
      const path = [];
      const view = (hl, c = 'active') => [{ t: 'grid', label: `looking for "${word}"`, g: grid, cls: { ...Object.fromEntries(path.map(([r, cc], k) => [r + ',' + cc, 'ok'])), ...(hl ? { [hl]: c } : {}) }, w: 38, h: 38 }, { t: 'vars', v: { matched: word.slice(0, path.length) } }];
      let found = false;
      const dfs = (i, r, c) => {
        if (i === word.length) return true;
        if (r < 0 || c < 0 || r >= R || c >= C) return false;
        if (g[r][c] !== word[i]) { if (g[r][c] !== '#') t.step(3, `(${r},${c}) is '${g[r][c]}', not '${word[i]}'.`, view(r + ',' + c, 'bad')); return false; }
        g[r][c] = '#'; path.push([r, c]);
        t.step(5, `(${r},${c}) matches '${word[i]}'. Mark it as used and search its neighbours for '${word[i + 1] || '✓'}'.`, view(r + ',' + c));
        const ok = dfs(i + 1, r + 1, c) || dfs(i + 1, r - 1, c) || dfs(i + 1, r, c + 1) || dfs(i + 1, r, c - 1);
        g[r][c] = grid[r][c];
        if (!ok) { path.pop(); t.step(8, `Dead end from (${r},${c}). Unmark it and backtrack.`, view(r + ',' + c, 'dim')); }
        return ok;
      };
      outer: for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (dfs(0, r, c)) { found = true; break outer; }
      t.step(9, found ? `Found "${word}" along the green path.` : `"${word}" is not in the grid.`, view());
    },
  });

  /* ═════════════ Graphs ═════════════ */
  add('floodFill', {
    title: 'Counting islands with DFS flood fill', sub: 'Scan the grid; each unvisited land cell starts a new island, and a DFS sinks all of it.',
    inputs: [{ key: 'grid', label: 'grid rows (1 = land)', type: 'grid', def: ['11000', '11010', '00100', '00011', '10011'] }],
    check: ({ grid }) => (grid.length > 8 || grid[0].length > 10 ? 'at most 8 × 10' : grid.flat().some((x) => x !== '0' && x !== '1') ? 'use 0 and 1' : null),
    code: `
int numIslands(char[][] grid) {
    int count = 0;
    for (int r = 0; r < grid.length; r++)
        for (int c = 0; c < grid[0].length; c++)
            if (grid[r][c] == '1') { count++; sink(grid, r, c); }
    return count;
}

void sink(char[][] g, int r, int c) {
    if (r < 0 || c < 0 || r >= g.length || c >= g[0].length || g[r][c] != '1') return;
    g[r][c] = '0';                                  // visited
    sink(g, r + 1, c); sink(g, r - 1, c); sink(g, r, c + 1); sink(g, r, c - 1);
}`,
    limit: 1000,
    run({ grid }, t) {
      const g = grid.map((r) => r.slice()); const R = g.length, C = g[0].length;
      const island = {}; let count = 0;
      const colors = ['ok', 'blue', 'cmp', 'active', 'bad'];
      const view = (hl) => [{ t: 'grid', label: `islands found: ${count}`, g: grid, cls: { ...Object.fromEntries(Object.entries(island).map(([k, v]) => [k, colors[(v - 1) % colors.length]])), ...(hl ? { [hl]: 'path' } : {}) }, base: (v) => (v === '1' ? 'land' : 'water'), w: 34, h: 34 }];
      const sink = (r, c) => {
        if (r < 0 || c < 0 || r >= R || c >= C || g[r][c] !== '1') return;
        g[r][c] = '0'; island[r + ',' + c] = count;
        t.step(11, `Sink (${r},${c}) into island #${count}, then visit its 4 neighbours.`, view(r + ',' + c));
        sink(r + 1, c); sink(r - 1, c); sink(r, c + 1); sink(r, c - 1);
      };
      t.step(3, 'Scan every cell. Land (1) that hasn’t been sunk yet begins a new island.', view());
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (g[r][c] === '1') { count++; t.step(5, `(${r},${c}) is unvisited land: island #${count}.`, view(r + ',' + c)); sink(r, c); }
      t.step(6, `${count} island(s). Every cell is visited O(1) times: O(rows × cols).`, view());
    },
  });

  add('multiSourceBFS', {
    title: 'Multi-source BFS (rotting oranges)', sub: 'Start the queue with every source at once; BFS layers are minutes.',
    inputs: [{ key: 'grid', label: 'grid (0 empty, 1 fresh, 2 rotten)', type: 'matrix', def: [[2, 1, 1, 0], [1, 1, 0, 1], [0, 1, 1, 1], [1, 0, 1, 2]] }],
    check: ({ grid }) => (grid.length > 8 || grid[0].length > 10 ? 'at most 8 × 10' : null),
    code: `
int orangesRotting(int[][] grid) {
    Deque<int[]> q = new ArrayDeque<>();
    int fresh = 0;
    for (int r = 0; r < grid.length; r++) for (int c = 0; c < grid[0].length; c++) {
        if (grid[r][c] == 2) q.offer(new int[]{r, c});   // every source, level 0
        else if (grid[r][c] == 1) fresh++;
    }
    int minutes = 0;
    int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1}};
    while (!q.isEmpty() && fresh > 0) {
        minutes++;
        for (int s = q.size(); s > 0; s--) {              // one minute = one BFS layer
            int[] cur = q.poll();
            for (int[] d : dirs) {
                int r = cur[0] + d[0], c = cur[1] + d[1];
                if (r < 0 || c < 0 || r >= grid.length || c >= grid[0].length || grid[r][c] != 1) continue;
                grid[r][c] = 2; fresh--;
                q.offer(new int[]{r, c});
            }
        }
    }
    return fresh == 0 ? minutes : -1;
}`,
    run({ grid }, t) {
      const g = grid.map((r) => r.slice()); const R = g.length, C = g[0].length;
      let q = [], fresh = 0; const when = {};
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { if (g[r][c] === 2) { q.push([r, c]); when[r + ',' + c] = 0; } else if (g[r][c] === 1) fresh++; }
      const view = (newly = []) => [{ t: 'grid', label: 'minute each orange rotted', g: g.map((row, r) => row.map((v, c) => (v === 0 ? '' : when[r + ',' + c] !== undefined ? when[r + ',' + c] : '·'))), cls: { ...Object.fromEntries(Object.keys(when).map((k) => [k, 'bad'])), ...Object.fromEntries(g.flatMap((row, r) => row.map((v, c) => [r + ',' + c, v === 1 ? 'land' : v === 0 ? 'water' : '']))), ...Object.fromEntries(newly.map(([r, c]) => [r + ',' + c, 'cmp'])) }, w: 34, h: 34 }, { t: 'vars', v: { fresh, minutes } }];
      let minutes = 0;
      t.step(6, `All ${q.length} rotten oranges go into the queue together: they spread simultaneously. Fresh: ${fresh}.`, view());
      while (q.length && fresh > 0) {
        minutes++; const next = [];
        for (const [r0, c0] of q) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const r = r0 + dr, c = c0 + dc;
          if (r < 0 || c < 0 || r >= R || c >= C || g[r][c] !== 1) continue;
          g[r][c] = 2; fresh--; when[r + ',' + c] = minutes; next.push([r, c]);
        }
        q = next;
        t.step(20, `Minute ${minutes}: ${next.length} orange(s) rot. They form the next BFS layer.`, view(next));
      }
      t.step(24, fresh === 0 ? `Everything rotted after <b>${minutes}</b> minute(s). O(rows × cols).` : `${fresh} fresh orange(s) can never be reached → −1.`, view());
    },
  });

  const edgesOf = (list) => list.map(([a, b, w]) => ({ a: String(a), b: String(b), w }));

  add('topoKahn', {
    title: 'Topological sort (Kahn’s algorithm)', sub: 'Repeatedly take a node with in-degree 0; removing it lowers its neighbours’ in-degrees.',
    inputs: [{ key: 'n', label: 'nodes', type: 'int', def: 6 }, { key: 'edges', label: 'edges [from, to]', type: 'matrix', def: [[5, 2], [5, 0], [4, 0], [4, 1], [2, 3], [3, 1]] }],
    check: ({ n, edges }) => (n > 10 ? 'at most 10 nodes' : edges.some(([a, b]) => a >= n || b >= n || a < 0 || b < 0) ? 'edge endpoints must be < n' : null),
    code: `
int[] topoSort(int n, int[][] edges) {
    List<List<Integer>> adj = new ArrayList<>();
    for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
    int[] indeg = new int[n];
    for (int[] e : edges) { adj.get(e[0]).add(e[1]); indeg[e[1]]++; }
    Deque<Integer> q = new ArrayDeque<>();
    for (int i = 0; i < n; i++) if (indeg[i] == 0) q.offer(i);   // no prerequisites
    int[] order = new int[n]; int k = 0;
    while (!q.isEmpty()) {
        int u = q.poll();
        order[k++] = u;
        for (int v : adj.get(u)) if (--indeg[v] == 0) q.offer(v);
    }
    return k == n ? order : new int[0];                          // k < n: there's a cycle
}`,
    run({ n, edges }, t) {
      const indeg = Array(n).fill(0), adj = Array.from({ length: n }, () => []);
      for (const [a, b] of edges) { adj[a].push(b); indeg[b]++; }
      const nodes = Array.from({ length: n }, (_, i) => ({ id: String(i) }));
      const done = {}; const order = []; const q = [];
      const view = (cur, ecls = {}) => [{ t: 'graph', label: 'in-degree under each node', nodes, edges: edgesOf(edges), dir: true, cls: { ...done, ...Object.fromEntries(q.map((x) => [String(x), 'cmp'])), ...(cur !== undefined ? { [cur]: 'active' } : {}) }, ecls, sub: Object.fromEntries(indeg.map((d, i) => [String(i), done[i] ? '' : 'in=' + d])) }, { t: 'row', items: [{ t: 'stack', label: 'queue (in-degree 0)', a: q.slice(), kind: 'queue' }, { t: 'stack', label: 'order', a: order.slice(), kind: 'list' }] }];
      for (let i = 0; i < n; i++) if (indeg[i] === 0) q.push(i);
      t.step(8, `Nodes with no incoming edges (${q.join(', ') || 'none'}) can go first.`, view());
      while (q.length) {
        const u = q.shift(); order.push(u); done[u] = 'ok';
        const ec = Object.fromEntries(adj[u].map((v) => [`${u}-${v}`, 'active']));
        for (const v of adj[u]) { indeg[v]--; if (indeg[v] === 0) q.push(v); }
        t.step(13, `Take ${u}; remove its edges. ${adj[u].length ? adj[u].map((v) => `${v}→in=${indeg[v]}`).join(', ') : 'No outgoing edges.'}`, view(String(u), ec));
      }
      t.step(15, order.length === n ? `Topological order: ${order.join(' → ')}. O(V + E).` : `Only ${order.length} of ${n} nodes could be ordered: the rest sit on a <b>cycle</b>.`, view());
    },
  });

  add('unionFind', {
    title: 'Union-Find with path compression', sub: 'Each set is a tree; find walks to the root (and flattens the path); union links the smaller tree under the larger.',
    inputs: [{ key: 'n', label: 'nodes', type: 'int', def: 8 }, { key: 'edges', label: 'unions [a, b]', type: 'matrix', def: [[0, 1], [2, 3], [1, 3], [4, 5], [6, 7], [5, 7], [3, 7], [0, 6]] }],
    check: ({ n, edges }) => (n > 12 ? 'at most 12 nodes' : edges.some(([a, b]) => a >= n || b >= n) ? 'endpoints must be < n' : null),
    code: `
int[] parent, size;

int find(int x) {
    if (parent[x] != x) parent[x] = find(parent[x]);   // path compression
    return parent[x];
}

boolean union(int a, int b) {
    int ra = find(a), rb = find(b);
    if (ra == rb) return false;                        // already connected: a cycle edge
    if (size[ra] < size[rb]) { int t = ra; ra = rb; rb = t; }
    parent[rb] = ra;                                   // attach the smaller tree
    size[ra] += size[rb];
    return true;
}`,
    run({ n, edges }, t) {
      const parent = Array.from({ length: n }, (_, i) => i), size = Array(n).fill(1);
      let comps = n;
      const view = (hl = {}, ecls = {}) => {
        const e = []; for (let i = 0; i < n; i++) if (parent[i] !== i) e.push({ a: String(i), b: String(parent[i]) });
        return [{ t: 'graph', label: `forest: arrows point to the parent (${comps} component${comps === 1 ? '' : 's'})`, nodes: Array.from({ length: n }, (_, i) => ({ id: String(i) })), edges: e, dir: true, cls: { ...Object.fromEntries(parent.map((p, i) => [String(i), p === i ? 'blue' : ''])), ...hl }, ecls }, { t: 'array', label: 'parent[]', a: parent.slice(), cw: 30 }];
      };
      const find = (x, trail) => { trail.push(x); if (parent[x] !== x) parent[x] = find(parent[x], trail); return parent[x]; };
      t.step(1, `Every node starts as its own set (root = blue).`, view());
      for (const [a, b] of edges) {
        const ta = [], tb = [];
        const ra = find(a, ta), rb = find(b, tb);
        t.step(5, `union(${a}, ${b}): find(${a}) = ${ra} via ${ta.join('→')}; find(${b}) = ${rb} via ${tb.join('→')}. Path compression pointed every visited node straight at its root.`, view({ [ra]: 'cmp', [rb]: 'cmp', [a]: 'active', [b]: 'active' }));
        if (ra === rb) { t.step(11, `Same root: ${a} and ${b} are already connected. This edge would close a <b>cycle</b>.`, view({ [ra]: 'bad' })); continue; }
        let x = ra, y = rb; if (size[x] < size[y]) [x, y] = [y, x];
        parent[y] = x; size[x] += size[y]; comps--;
        t.step(13, `Attach root ${y} (size ${size[y]}) under root ${x} (now size ${size[x]}). Components: ${comps}.`, view({ [x]: 'ok' }, { [`${y}-${x}`]: 'active' }));
      }
      t.step(15, `Done: ${comps} component(s). With union by size plus path compression, each operation is nearly O(1): O(α(n)), the inverse Ackermann function.`, view());
    },
  });

  add('dijkstra', {
    title: 'Dijkstra’s shortest paths', sub: 'Always settle the unsettled node with the smallest known distance; relax its edges. A PQ with lazy deletion.',
    inputs: [{ key: 'n', label: 'nodes', type: 'int', def: 6 }, { key: 'edges', label: 'edges [u, v, w] (directed)', type: 'matrix', def: [[0, 1, 7], [0, 2, 9], [0, 5, 14], [1, 2, 10], [1, 3, 15], [2, 3, 11], [2, 5, 2], [3, 4, 6], [5, 4, 9]] }, { key: 'src', label: 'source', type: 'int', def: 0 }],
    check: ({ n, edges, src }) => (n > 10 ? 'at most 10 nodes' : edges.some((e) => e[0] >= n || e[1] >= n || e[2] < 0) ? 'endpoints < n and weights ≥ 0' : src >= n ? 'source < n' : null),
    code: `
int[] dijkstra(int n, List<int[]>[] adj, int src) {
    int[] dist = new int[n];
    Arrays.fill(dist, Integer.MAX_VALUE);
    dist[src] = 0;
    PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> Integer.compare(a[1], b[1]));
    pq.offer(new int[]{src, 0});
    while (!pq.isEmpty()) {
        int[] top = pq.poll();
        int u = top[0];
        if (top[1] > dist[u]) continue;              // stale entry: already settled cheaper
        for (int[] e : adj[u]) {                     // e = {v, w}
            int v = e[0], nd = dist[u] + e[1];
            if (nd < dist[v]) { dist[v] = nd; pq.offer(new int[]{v, nd}); }
        }
    }
    return dist;
}`,
    run({ n, edges, src }, t) {
      const adj = Array.from({ length: n }, () => []); for (const [u, v, w] of edges) adj[u].push([v, w]);
      const dist = Array(n).fill(Infinity); dist[src] = 0; const settled = {}; const pq = [[src, 0]]; const via = {};
      const view = (cur, ecls = {}) => [{ t: 'graph', label: 'dist under each node', nodes: Array.from({ length: n }, (_, i) => ({ id: String(i) })), edges: edgesOf(edges), dir: true, cls: { ...Object.fromEntries(Object.keys(settled).map((k) => [k, 'ok'])), ...(cur !== undefined ? { [cur]: 'active' } : {}) }, ecls: { ...Object.fromEntries(Object.entries(via).map(([v, u]) => [`${u}-${v}`, 'ok'])), ...ecls }, sub: Object.fromEntries(dist.map((d, i) => [String(i), d === Infinity ? '∞' : d])) }, { t: 'stack', label: 'priority queue [node:dist] (sorted for display)', a: pq.slice().sort((a, b) => a[1] - b[1]).map(([u, d]) => `${u}:${d}`) }];
      t.step(4, `dist[${src}] = 0; everything else ∞.`, view());
      while (pq.length) {
        pq.sort((a, b) => a[1] - b[1]); const [u, d] = pq.shift();
        if (d > dist[u]) { t.step(10, `Pop ${u}:${d}, but dist[${u}] is already ${dist[u]}, so it's stale. Skip it (lazy deletion).`, view(String(u))); continue; }
        settled[u] = true;
        t.step(9, `Settle ${u} at distance ${d}: no cheaper path can appear later, because every other route leaves from a node at distance ≥ ${d} and weights are non-negative.`, view(String(u)));
        for (const [v, w] of adj[u]) {
          const nd = dist[u] + w;
          if (nd < dist[v]) { dist[v] = nd; via[v] = u; pq.push([v, nd]); t.step(13, `Relax ${u}→${v}: ${dist[u]} + ${w} = ${nd} &lt; old distance. Update and push.`, view(String(u), { [`${u}-${v}`]: 'active' })); }
          else t.step(12, `${u}→${v}: ${dist[u]} + ${w} = ${nd} ≥ ${dist[v]}. No improvement.`, view(String(u), { [`${u}-${v}`]: 'cmp' }));
        }
      }
      t.step(16, `Final distances: ${dist.map((d, i) => `${i}:${d === Infinity ? '∞' : d}`).join(', ')}. Green edges form the shortest-path tree. O((V + E) log V).`, view());
    },
  });

  add('kruskal', {
    title: 'Kruskal’s minimum spanning tree', sub: 'Take edges from cheapest to most expensive; keep one unless it would close a cycle (Union-Find decides).',
    inputs: [{ key: 'n', label: 'nodes', type: 'int', def: 6 }, { key: 'edges', label: 'edges [u, v, w]', type: 'matrix', def: [[0, 1, 4], [0, 2, 3], [1, 2, 1], [1, 3, 2], [2, 3, 4], [3, 4, 2], [4, 5, 6], [3, 5, 5], [2, 4, 7]] }],
    check: ({ n, edges }) => (n > 10 ? 'at most 10 nodes' : edges.some((e) => e[0] >= n || e[1] >= n) ? 'endpoints must be < n' : null),
    code: `
int mst(int n, int[][] edges) {
    Arrays.sort(edges, (a, b) -> Integer.compare(a[2], b[2]));   // cheapest first
    UnionFind uf = new UnionFind(n);
    int cost = 0, used = 0;
    for (int[] e : edges) {
        if (uf.union(e[0], e[1])) {        // joins two components: keep it
            cost += e[2];
            if (++used == n - 1) break;    // a tree has n - 1 edges
        }                                  // else: it would close a cycle
    }
    return used == n - 1 ? cost : -1;      // -1: the graph is disconnected
}`,
    run({ n, edges }, t) {
      const sorted = edges.slice().sort((a, b) => a[2] - b[2]);
      const parent = Array.from({ length: n }, (_, i) => i);
      const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
      const kept = {}, rejected = {}; let cost = 0, used = 0;
      const view = (cur) => [{ t: 'graph', label: `MST cost so far: ${cost}`, nodes: Array.from({ length: n }, (_, i) => ({ id: String(i) })), edges: edgesOf(edges), ecls: { ...Object.fromEntries(Object.keys(kept).map((k) => [k, 'ok'])), ...Object.fromEntries(Object.keys(rejected).map((k) => [k, 'bad'])), ...(cur ? { [cur]: 'active' } : {}) }, cls: {} }, { t: 'stack', label: 'edges by weight', a: sorted.map((e) => `${e[0]}-${e[1]}:${e[2]}`), cls: Object.fromEntries(sorted.map((e, i) => [i, kept[`${e[0]}-${e[1]}`] ? 'ok' : rejected[`${e[0]}-${e[1]}`] ? 'bad' : ''])), kind: 'list' }];
      t.step(2, 'Sort the edges by weight.', view());
      for (const [u, v, w] of sorted) {
        const k = `${u}-${v}`;
        const ru = find(u), rv = find(v);
        if (ru !== rv) { parent[ru] = rv; kept[k] = true; cost += w; used++; t.step(7, `Edge ${u}-${v} (${w}) joins two components: keep it. Cost = ${cost}.`, view(k)); if (used === n - 1) break; }
        else { rejected[k] = true; t.step(9, `Edge ${u}-${v} (${w}) would close a cycle, since ${u} and ${v} are already connected. Skip it.`, view(k)); }
      }
      t.step(12, used === n - 1 ? `MST complete: ${n - 1} edges, total cost <b>${cost}</b>. O(E log E), dominated by the sort.` : 'The graph is disconnected, so there is no spanning tree.', view());
    },
  });

  add('bellmanFordK', {
    title: 'Bellman–Ford, limited to k stops', sub: 'Round i finds the cheapest paths using at most i edges. Relax from a snapshot of the previous round.',
    inputs: [{ key: 'n', label: 'cities', type: 'int', def: 5 }, { key: 'flights', label: 'flights [from, to, price]', type: 'matrix', def: [[0, 1, 100], [1, 2, 100], [2, 4, 100], [0, 3, 500], [3, 4, 50], [1, 3, 150]] }, { key: 'src', label: 'src', type: 'int', def: 0 }, { key: 'dst', label: 'dst', type: 'int', def: 4 }, { key: 'k', label: 'max stops k', type: 'int', def: 1 }],
    check: ({ n, flights }) => (n > 9 ? 'at most 9 cities' : flights.some((e) => e[0] >= n || e[1] >= n) ? 'endpoints must be < n' : null),
    code: `
int findCheapestPrice(int n, int[][] flights, int src, int dst, int k) {
    int[] cost = new int[n];
    Arrays.fill(cost, Integer.MAX_VALUE);
    cost[src] = 0;
    for (int round = 0; round <= k; round++) {         // k stops = k + 1 edges
        int[] next = cost.clone();                     // snapshot: use only last round's values
        for (int[] f : flights)
            if (cost[f[0]] != Integer.MAX_VALUE && cost[f[0]] + f[2] < next[f[1]])
                next[f[1]] = cost[f[0]] + f[2];
        cost = next;
    }
    return cost[dst] == Integer.MAX_VALUE ? -1 : cost[dst];
}`,
    run({ n, flights, src, dst, k }, t) {
      let cost = Array(n).fill(Infinity); cost[src] = 0;
      const view = (next, hl) => [{ t: 'graph', label: 'best price with the edges allowed so far', nodes: Array.from({ length: n }, (_, i) => ({ id: String(i) })), edges: edgesOf(flights), dir: true, cls: { [src]: 'blue', [dst]: 'cmp' }, ecls: hl ? { [hl]: 'active' } : {}, sub: Object.fromEntries((next || cost).map((d, i) => [String(i), d === Infinity ? '∞' : d])) }];
      t.step(3, `Start: price 0 at ${src}.`, view());
      for (let round = 0; round <= k; round++) {
        const next = cost.slice();
        for (const [u, v, w] of flights) {
          if (cost[u] !== Infinity && cost[u] + w < next[v]) { next[v] = cost[u] + w; t.step(10, `Round ${round + 1} (≤ ${round + 1} flights): ${u}→${v} gives ${cost[u]} + ${w} = ${next[v]}.`, view(next, `${u}-${v}`)); }
        }
        cost = next;
        t.step(11, `After round ${round + 1}: the best prices using at most ${round + 1} flight(s).`, view());
      }
      t.step(13, cost[dst] === Infinity ? `No route to ${dst} within ${k} stop(s) → −1.` : `Cheapest with ≤ ${k} stop(s): <b>${cost[dst]}</b>. The snapshot keeps a single round from chaining two new edges. O(k · E).`, view());
    },
  });
})();

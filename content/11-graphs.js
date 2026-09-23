(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
// prerequisite pairs [course, prereq] forming a DAG over n courses; optionally add one back edge (cycle)
function prereqs(n, m, seed, cycle = false) {
  const r = rng(seed); const perm = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const out = []; const seen = new Set();
  while (out.length < m) {
    let a = Math.floor(r() * n), b = Math.floor(r() * n); if (a === b) continue;
    if (a > b) [a, b] = [b, a];
    const key = a + ',' + b; if (seen.has(key)) continue; seen.add(key);
    out.push([perm[b], perm[a]]);                 // perm[b] requires perm[a]
  }
  if (cycle) { const [c, p] = out[0]; out.push([p, c]); }
  return out;
}
function ladderWords(len, alpha, seed, drop) {
  const r = rng(seed); const words = [];
  const rec = (s) => { if (s.length === len) { if (r() >= drop) words.push(s); return; } for (const ch of alpha) rec(s + ch); };
  rec('');
  return words;
}
function accountsBig(people, seed) {
  const r = rng(seed); const names = ['Ana', 'Ben', 'Chen', 'Dev', 'Eli', 'Fay'];
  const acc = [];
  for (let p = 0; p < people; p++) {
    const name = names[p % names.length]; const emails = Array.from({ length: 2 + Math.floor(r() * 4) }, (_, k) => `p${p}e${k}@mail.com`);
    // split this person's emails over several accounts that overlap by one email
    let i = 0;
    while (i < emails.length) { const take = 1 + Math.floor(r() * 2); acc.push([name, ...emails.slice(Math.max(0, i - 1), i + take)]); i += take; }
  }
  for (let i = acc.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [acc[i], acc[j]] = [acc[j], acc[i]]; }
  return acc;
}
function alienWords(nWords, seed) {
  const r = rng(seed); const letters = 'abcdefghij'.split('');
  for (let i = letters.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [letters[i], letters[j]] = [letters[j], letters[i]]; }
  const rank = Object.fromEntries(letters.map((c, i) => [c, i]));
  const words = Array.from({ length: nWords }, () => Array.from({ length: 1 + Math.floor(r() * 5) }, () => letters[Math.floor(r() * letters.length)]).join(''));
  words.sort((a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return rank[a[i]] - rank[b[i]]; return a.length - b.length; });
  return words;
}
function edgesTree(n, extra, seed) { const r = rng(seed); const e = []; for (let i = 1; i < n; i++) e.push([Math.floor(r() * i), i]); for (let k = 0; k < extra; k++) { const a = Math.floor(r() * n), b = Math.floor(r() * n); if (a !== b) e.push([a, b]); } return e; }

const topoValid = ({ args, got, expected }) => {
  const [n, pre] = args;
  if (!Array.isArray(got)) return 'not an array';
  if (expected && expected.length === 0) return got.length === 0 ? true : 'a cycle exists, so the answer must be []';
  if (got.length !== n) return `expected all ${n} courses, got ${got.length}`;
  const pos = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) { const c = got[i]; if (!Number.isInteger(c) || c < 0 || c >= n || pos[c] !== -1) return 'not a permutation of 0..n−1'; pos[c] = i; }
  for (const [a, b] of pre) if (pos[b] > pos[a]) return `course ${a} is scheduled before its prerequisite ${b}`;
  return true;
};

DSA.module({
  id: 'graphs', title: 'Graphs: BFS, DFS, Topological Sort, Union-Find', short: 'Graphs',
  blurb: 'Grids and networks as graphs: flood fill, shortest paths in unweighted graphs, dependency ordering, and dynamic connectivity.',
  intro: M`
    Most graph interview problems don't hand you a graph. They give you a **grid**, a list of **dependencies**, **words** that differ by one letter, or **accounts** that share emails. The first step is always to model the problem: what are the nodes, what are the edges, directed or undirected? After that, four algorithms cover nearly everything: **DFS** (reachability, components), **BFS** (fewest steps), **topological sort** (ordering with dependencies) and **Union-Find** (merging groups).
  `,
  more: [
    lc(733, 'flood-fill', 'Flood Fill', 'easier'),
    lc(1971, 'find-if-path-exists-in-graph', 'Find if Path Exists in Graph', 'easier'),
    lc(547, 'number-of-provinces', 'Number of Provinces', 'similar'),
    lc(133, 'clone-graph', 'Clone Graph', 'similar'),
    lc(286, 'walls-and-gates', 'Walls and Gates', 'similar', { premium: true }),
    lc(542, '01-matrix', '01 Matrix', 'similar'),
    lc(1020, 'number-of-enclaves', 'Number of Enclaves', 'similar'),
    lc(785, 'is-graph-bipartite', 'Is Graph Bipartite?', 'similar'),
    lc(1926, 'nearest-exit-from-entrance-in-maze', 'Nearest Exit from Entrance in Maze', 'similar'),
    lc(752, 'open-the-lock', 'Open the Lock', 'harder'),
    lc(802, 'find-eventual-safe-states', 'Find Eventual Safe States', 'harder'),
    lc(1462, 'course-schedule-iv', 'Course Schedule IV', 'harder'),
    lc(990, 'satisfiability-of-equality-equations', 'Satisfiability of Equality Equations', 'similar'),
    lc(1202, 'smallest-string-with-swaps', 'Smallest String With Swaps', 'harder'),
    lc(329, 'longest-increasing-path-in-a-matrix', 'Longest Increasing Path in a Matrix', 'harder'),
  ],
  items: [
    { lesson: 'graph-basics', title: 'Graph modelling, DFS and BFS', mins: 16,
      lede: 'Build an adjacency list, mark visited nodes at the right moment, and pick DFS for reachability or BFS for the fewest steps.',
      body: M`
        ## Modelling: what are the nodes and edges?
        | Problem | Nodes | Edges |
        |---|---|---|
        | Islands, mazes, flood fill | grid cells | 4 (or 8) neighbouring cells |
        | Course prerequisites | courses | prereq → course (directed) |
        | Word ladder | words | words differing by one letter |
        | Accounts merge | emails (or accounts) | "appear in the same account" |
        | Network / cities | the given nodes | the given edge list |

        ## Building an adjacency list in Java
        ~~~java
        List<List<Integer>> adj = new ArrayList<>();
        for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
        for (int[] e : edges) {
            adj.get(e[0]).add(e[1]);
            adj.get(e[1]).add(e[0]);        // omit for directed graphs
        }
        // grid neighbours
        int[][] DIRS = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        for (int[] d : DIRS) { int nr = r + d[0], nc = c + d[1]; if (nr >= 0 && nr < R && nc >= 0 && nc < C) ... }
        ~~~
        An adjacency list uses O(V + E) memory, and iterating a node's neighbours costs its degree. An adjacency matrix («boolean[n][n]») is O(V²): only use it for dense graphs or when n ≤ ~1000.

        ## DFS: explore as deep as possible
        Use it for reachability, connected components, flood fill, cycle detection and path existence. Recursive DFS is the shortest code, but its depth can reach V. On a 300 × 300 grid that's 90,000 frames, which can overflow the stack. An explicit stack or BFS avoids that.

        @viz floodFill

        ~~~java Template: count connected components (grid)
        int count = 0;
        for (int r = 0; r < R; r++)
            for (int c = 0; c < C; c++)
                if (grid[r][c] == '1') { count++; dfs(grid, r, c); }   // dfs marks the whole component
        ~~~

        ## BFS: explore in rings of distance
        A queue visits nodes in order of distance from the start, so the **first time BFS reaches a node is along a shortest path**, as long as every edge costs the same. Use it for "minimum steps", "fewest moves", "nearest X".

        ~~~java Template: BFS shortest path (unweighted)
        Deque<int[]> q = new ArrayDeque<>();
        boolean[][] seen = new boolean[R][C];
        q.offer(new int[]{sr, sc}); seen[sr][sc] = true;       // mark when ENQUEUED
        for (int steps = 0; !q.isEmpty(); steps++) {
            for (int k = q.size(); k > 0; k--) {               // one ring at a time
                int[] cur = q.poll();
                if (isTarget(cur)) return steps;
                for (int[] d : DIRS) { /* bounds + open + !seen: mark seen, then offer */ }
            }
        }
        return -1;
        ~~~

        :::warn Mark visited when you enqueue, not when you dequeue
        If you only mark a node when you pop it, the same node can be enqueued many times by different neighbours before it's processed. That multiplies the work, which is O(E) extra in general and exponential blow-ups in word-ladder-style graphs. Marking at enqueue time guarantees each node enters the queue once.
        :::

        ## Multi-source BFS
        When there are several starting points (all rotten oranges, all gates, all land cells), put **all of them in the queue at distance 0** before starting. BFS then computes, for every cell, the distance to its *nearest* source, in one O(V + E) pass instead of one BFS per source.

        @viz multiSourceBFS

        ## Border tricks
        "Regions not connected to the border" (surrounded regions, enclaves) and "cells that can reach both oceans": start the search **from the border** and mark what's reachable, instead of asking each cell whether it can reach the border.

        ## Signals
        - Grid of cells with "islands / regions / connected" → DFS or BFS flood fill.
        - "Minimum number of steps / moves / transformations" with equal-cost moves → BFS.
        - Several simultaneous sources, "spread", "nearest" → multi-source BFS.
        - "Can reach the border / both oceans" → search backwards from the border.
        - Implicit graph (words, lock combinations, states) → generate neighbours on the fly and BFS.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'Why does BFS find shortest paths in an unweighted graph but DFS doesn’t?',
          options: ['BFS is faster', 'BFS visits nodes in non-decreasing order of distance, so the first visit is via a shortest path; DFS may reach a node first along a long detour', 'DFS can’t detect paths', 'They both find shortest paths'],
          answer: 1, why: 'The queue processes all nodes at distance d before any at distance d + 1. DFS commits to one branch and can arrive by a long route first.' },
        { q: 'In a word ladder BFS you mark words as visited when you **dequeue** them. What goes wrong?',
          options: ['Nothing', 'The same word can be enqueued many times by different neighbours at the same level, massively increasing work', 'It returns wrong distances', 'It can loop forever'],
          answer: 1, why: 'The distances are still correct, but a popular word may enter the queue once per neighbour. Marking at enqueue time keeps every node in the queue at most once.' },
      ],
      practice: ['number-of-islands', 'max-area-island', 'rotting-oranges', 'pacific-atlantic', 'surrounded-regions', 'shortest-path-binary-matrix', 'word-ladder'],
    },

    { problem: {
      id: 'number-of-islands', title: 'Number of Islands', diff: 'medium',
      tags: ['grid DFS', 'components'],
      statement: M`
        «grid» is a map of «'1'» (land) and «'0'» (water). An **island** is a group of land cells connected horizontally or vertically. Everything outside the grid is water. Return the number of islands.
      `,
      fn: { name: 'numIslands', params: [['char[][]', 'grid']], ret: 'int' },
      tests: [
        { args: [[['1', '1', '1', '1', '0'], ['1', '1', '0', '1', '0'], ['1', '1', '0', '0', '0'], ['0', '0', '0', '0', '0']]], ex: true, expect: 1 },
        { args: [[['1', '1', '0', '0', '0'], ['1', '1', '0', '0', '0'], ['0', '0', '1', '0', '0'], ['0', '0', '0', '1', '1']]], ex: true, expect: 3 },
        { args: [[['0']]], expect: 0 },
        { args: [[['1']]], expect: 1 },
        { args: [[['1', '0', '1', '0', '1']]], expect: 3 },
        { args: [[['1', '0'], ['0', '1']]], expect: 2, why: 'Diagonal cells aren’t connected.' },
        { args: [[['1', '1', '1'], ['0', '1', '0'], ['1', '1', '1']]], expect: 1 },
        { args: [{ $gen: 'grid', args: [150, 150, '01', 40, 151] }], big: true },
        { args: [{ $gen: 'grid', args: [40, 40, '01', 100, 152] }], big: true, expect: 1 },
      ],
      constraints: ['1 ≤ m, n ≤ 300 (large tests: 150 × 150)', "grid[i][j] is '0' or '1'"],
      hints: [
        'Each island is a connected component of land cells. How do you visit a whole component?',
        'Scan the grid. When you find unvisited land, that’s a new island; run DFS or BFS from it to mark every connected land cell.',
        "Marking can be done in place: set visited land to «'0'» (sink it).",
      ],
      solution: {
        pattern: '**Connected components by flood fill:** scan, and launch a DFS/BFS from each unvisited node, counting the launches.',
        intuition: 'Every island is found exactly once: the first time the scan touches any of its cells, the flood fill marks the whole island, so later scans skip it.',
        java: J`class Solution {
    public int numIslands(char[][] grid) {
        int count = 0;
        for (int r = 0; r < grid.length; r++)
            for (int c = 0; c < grid[0].length; c++)
                if (grid[r][c] == '1') { count++; sink(grid, r, c); }
        return count;
    }

    private void sink(char[][] g, int r, int c) {
        if (r < 0 || c < 0 || r >= g.length || c >= g[0].length || g[r][c] != '1') return;
        g[r][c] = '0';                                  // mark visited
        sink(g, r + 1, c); sink(g, r - 1, c); sink(g, r, c + 1); sink(g, r, c - 1);
    }
}`,
        time: 'O(m · n)', space: 'O(m · n) worst-case recursion',
        pitfalls: M`
          - Mutating the input: fine here, but say so (or use a «visited» array).
          - Deep recursion: a grid that's all land makes the DFS depth up to m·n. The BFS version below uses a queue instead.
          - Counting land cells instead of components.
        `,
        alts: [
          { name: 'BFS flood fill (no deep recursion)', time: 'O(m · n)', space: 'O(min(m, n)) queue', java: J`class Solution {
    public int numIslands(char[][] grid) {
        int R = grid.length, C = grid[0].length, count = 0;
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        Deque<int[]> q = new ArrayDeque<>();
        for (int r = 0; r < R; r++) for (int c = 0; c < C; c++) {
            if (grid[r][c] != '1') continue;
            count++;
            grid[r][c] = '0'; q.offer(new int[]{r, c});
            while (!q.isEmpty()) {
                int[] cur = q.poll();
                for (int[] d : dirs) {
                    int nr = cur[0] + d[0], nc = cur[1] + d[1];
                    if (nr < 0 || nc < 0 || nr >= R || nc >= C || grid[nr][nc] != '1') continue;
                    grid[nr][nc] = '0'; q.offer(new int[]{nr, nc});
                }
            }
        }
        return count;
    }
}` },
          { name: 'Union-Find over land cells', time: '≈O(m · n)', space: 'O(m · n)', note: 'Union each land cell with its land neighbours, then count distinct roots. It’s overkill here, but it shines for the online version (Number of Islands II, where land is added over time).' },
        ],
        followups: M`
          - **Largest island / island perimeter / distinct island shapes**: the same flood fill, collecting more info.
          - **Land added one cell at a time** (LeetCode 305): Union-Find, updating the count per addition.
        `,
        talk: 'Scan the grid; each unvisited land cell starts a new island, and a flood fill (DFS or BFS) sinks all connected land so it’s not counted again. O(m·n). I’d use BFS if the grid can be huge, to avoid deep recursion.',
      },
      viz: { id: 'floodFill' },
      lc: [lc(200, 'number-of-islands', 'Number of Islands', 'same'), lc(695, 'max-area-of-island', 'Max Area of Island', 'variant'), lc(463, 'island-perimeter', 'Island Perimeter', 'easier'), lc(305, 'number-of-islands-ii', 'Number of Islands II', 'harder', { premium: true })],
      drill: { prompt: 'Count groups of horizontally/vertically connected 1s in a grid.', pattern: 'graph-traversal', why: 'Connected components: flood fill (DFS/BFS) from each unvisited land cell.' },
    } },

    { problem: {
      id: 'max-area-island', title: 'Largest Island Area', diff: 'medium',
      tags: ['grid DFS', 'component size'],
      statement: M`
        «grid» contains «0» (water) and «1» (land). Return the area (number of cells) of the **largest** island, where islands connect horizontally and vertically. Return «0» if there's no land.
      `,
      fn: { name: 'maxAreaOfIsland', params: [['int[][]', 'grid']], ret: 'int' },
      tests: [
        { args: [[[0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0], [0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0], [0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0], [0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0]]], ex: true, expect: 6 },
        { args: [[[0, 0, 0, 0, 0, 0, 0, 0]]], ex: true, expect: 0 },
        { args: [[[1]]], expect: 1 },
        { args: [[[1, 1], [1, 0]]], expect: 3 },
        { args: [[[1, 0, 1], [0, 1, 0], [1, 0, 1]]], expect: 1 },
        { args: [{ $gen: 'binGrid', args: [150, 150, 40, 153] }], big: true },
        { args: [{ $gen: 'binGrid', args: [40, 40, 100, 154] }], big: true, expect: 1600 },
      ],
      constraints: ['1 ≤ m, n ≤ 50 (large tests: 150 × 150)'],
      hints: [
        'Same traversal as counting islands. What should the DFS return?',
        'The number of cells it visited: 1 + the areas returned by the four recursive calls.',
        'Track the maximum over all DFS launches.',
      ],
      solution: {
        pattern: '**Flood fill that returns a size:** DFS returns 1 + the sum of its neighbours’ results.',
        intuition: 'Each DFS launch covers exactly one island; counting the cells it marks gives that island’s area.',
        java: J`class Solution {
    public int maxAreaOfIsland(int[][] grid) {
        int best = 0;
        for (int r = 0; r < grid.length; r++)
            for (int c = 0; c < grid[0].length; c++)
                if (grid[r][c] == 1) best = Math.max(best, area(grid, r, c));
        return best;
    }

    private int area(int[][] g, int r, int c) {
        if (r < 0 || c < 0 || r >= g.length || c >= g[0].length || g[r][c] != 1) return 0;
        g[r][c] = 0;
        return 1 + area(g, r + 1, c) + area(g, r - 1, c) + area(g, r, c + 1) + area(g, r, c - 1);
    }
}`,
        time: 'O(m · n)', space: 'O(m · n) recursion worst case',
        alts: [
          { name: 'Iterative stack', time: 'O(m · n)', space: 'O(m · n)', java: J`class Solution {
    public int maxAreaOfIsland(int[][] grid) {
        int R = grid.length, C = grid[0].length, best = 0;
        Deque<int[]> st = new ArrayDeque<>();
        for (int r = 0; r < R; r++) for (int c = 0; c < C; c++) {
            if (grid[r][c] != 1) continue;
            int area = 0; grid[r][c] = 0; st.push(new int[]{r, c});
            while (!st.isEmpty()) {
                int[] p = st.pop(); area++;
                int[][] nb = {{p[0] + 1, p[1]}, {p[0] - 1, p[1]}, {p[0], p[1] + 1}, {p[0], p[1] - 1}};
                for (int[] q : nb) if (q[0] >= 0 && q[1] >= 0 && q[0] < R && q[1] < C && grid[q[0]][q[1]] == 1) { grid[q[0]][q[1]] = 0; st.push(q); }
            }
            best = Math.max(best, area);
        }
        return best;
    }
}` },
        ],
        talk: 'Flood fill from each unvisited land cell, where the DFS returns 1 plus its neighbours’ areas and marks cells visited. Keep the max. O(m·n).',
      },
      lc: [lc(695, 'max-area-of-island', 'Max Area of Island', 'same'), lc(827, 'making-a-large-island', 'Making A Large Island', 'harder'), lc(200, 'number-of-islands', 'Number of Islands', 'similar')],
      drill: { prompt: 'Size of the largest connected region of 1s in a grid.', pattern: 'graph-traversal', why: 'A flood fill that returns component size; take the max.' },
    } },

    { problem: {
      id: 'rotting-oranges', title: 'Rotting Oranges', diff: 'medium',
      tags: ['multi-source BFS', 'levels'],
      statement: M`
        Each cell of «grid» is «0» (empty), «1» (a fresh orange) or «2» (a rotten orange). Every minute, each fresh orange next to a rotten one (up, down, left, right) becomes rotten.

        Return the minimum number of minutes until no fresh orange remains, or «−1» if that's impossible.
      `,
      fn: { name: 'orangesRotting', params: [['int[][]', 'grid']], ret: 'int' },
      tests: [
        { args: [[[2, 1, 1], [1, 1, 0], [0, 1, 1]]], ex: true, expect: 4 },
        { args: [[[2, 1, 1], [0, 1, 1], [1, 0, 1]]], ex: true, expect: -1, why: 'The bottom-left orange is cut off.' },
        { args: [[[0, 2]]], ex: true, expect: 0, why: 'No fresh oranges at the start.' },
        { args: [[[0]]], expect: 0 },
        { args: [[[1]]], expect: -1 },
        { args: [[[2, 1, 1, 1, 1, 1, 2]]], expect: 3, why: 'Both ends rot inward simultaneously.' },
        { args: [[[2, 2], [1, 1], [0, 0], [2, 0]]], expect: 1 },
        { args: [{ $gen: 'matrix', args: [150, 150, 0, 2, 155] }], big: true },
      ],
      constraints: ['1 ≤ m, n ≤ 10 (large test: 150 × 150)', 'grid[i][j] ∈ {0, 1, 2}'],
      hints: [
        'Rot spreads outward from *all* rotten oranges at once. Running a BFS from each one separately would be wrong (and slow).',
        'Put every rotten orange in the queue before starting (multi-source BFS), and count fresh oranges.',
        'Process the queue level by level; each level is one minute. At the end, if any fresh orange remains, return −1.',
      ],
      solution: {
        pattern: '**Multi-source BFS:** start with every source in the queue; BFS levels become time steps.',
        intuition: 'An orange rots at minute t exactly when its distance to the *nearest* rotten orange is t. Seeding the queue with all rotten oranges makes BFS compute these nearest distances in one pass. The answer is the largest distance.',
        java: J`class Solution {
    public int orangesRotting(int[][] grid) {
        int R = grid.length, C = grid[0].length, fresh = 0;
        Deque<int[]> q = new ArrayDeque<>();
        for (int r = 0; r < R; r++) for (int c = 0; c < C; c++) {
            if (grid[r][c] == 2) q.offer(new int[]{r, c});
            else if (grid[r][c] == 1) fresh++;
        }
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        int minutes = 0;
        while (!q.isEmpty() && fresh > 0) {
            minutes++;
            for (int k = q.size(); k > 0; k--) {
                int[] cur = q.poll();
                for (int[] d : dirs) {
                    int r = cur[0] + d[0], c = cur[1] + d[1];
                    if (r < 0 || c < 0 || r >= R || c >= C || grid[r][c] != 1) continue;
                    grid[r][c] = 2;           // mark when enqueued
                    fresh--;
                    q.offer(new int[]{r, c});
                }
            }
        }
        return fresh == 0 ? minutes : -1;
    }
}`,
        time: 'O(m · n)', space: 'O(m · n)',
        pitfalls: M`
          - Looping while the queue is non-empty and incrementing minutes each round counts one extra minute after the last orange rots. Stop when «fresh == 0», as above.
          - Rotting oranges in place during the level loop: correct only because each newly rotted orange is enqueued for the *next* level, which the size snapshot guarantees.
        `,
        alts: [
          { name: 'Simulate minute by minute with grid copies', time: 'O((m·n)²)', space: 'O(m·n)', note: 'Each minute, scan the whole grid for fresh oranges next to rotten ones. Correct, but quadratic.', check: false },
        ],
        followups: M`
          - **Walls and gates / 01 matrix**: the same multi-source BFS computing the distance to the nearest source for every cell.
        `,
        talk: 'Multi-source BFS: enqueue every rotten orange and count the fresh ones. Each BFS level is a minute; rot neighbours, decrement fresh, enqueue. Stop when fresh hits zero; −1 if some remain. O(m·n).',
      },
      viz: { id: 'multiSourceBFS' },
      lc: [lc(994, 'rotting-oranges', 'Rotting Oranges', 'same'), lc(542, '01-matrix', '01 Matrix', 'variant'), lc(286, 'walls-and-gates', 'Walls and Gates', 'variant', { premium: true }), lc(1162, 'as-far-from-land-as-possible', 'As Far from Land as Possible', 'variant')],
      drill: { prompt: 'Rot spreads each minute from every rotten cell to fresh neighbours: how long until all are rotten?', pattern: 'bfs-shortest', why: 'Multi-source BFS: all sources start in the queue; levels are minutes.' },
    } },

    { problem: {
      id: 'pacific-atlantic', title: 'Water Flowing to Both Oceans', diff: 'medium',
      tags: ['reverse search', 'border BFS/DFS'],
      statement: M`
        «heights» is an island map. The **Pacific** touches the top and left edges and the **Atlantic** touches the bottom and right edges. Rain flows from a cell to a neighbour (up, down, left, right) whose height is **less than or equal to** its own, and flows off the island from edge cells into the adjacent ocean.

        Return the coordinates «[r, c]» of every cell from which water can reach **both** oceans, in any order.
      `,
      fn: { name: 'pacificAtlantic', params: [['int[][]', 'heights']], ret: 'List<List<Integer>>' },
      compare: 'unordered',
      tests: [
        { args: [[[1, 2, 2, 3, 5], [3, 2, 3, 4, 4], [2, 4, 5, 3, 1], [6, 7, 1, 4, 5], [5, 1, 1, 2, 4]]], ex: true, expect: [[0, 4], [1, 3], [1, 4], [2, 2], [3, 0], [3, 1], [4, 0]] },
        { args: [[[1]]], ex: true, expect: [[0, 0]] },
        { args: [[[1, 1], [1, 1]]], expect: [[0, 0], [0, 1], [1, 0], [1, 1]] },
        { args: [[[3, 3, 3], [3, 1, 3], [3, 3, 3]]], expect: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]] },
        { args: [[[1, 2, 3], [8, 9, 4], [7, 6, 5]]], expect: [[0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]] },
        { args: [{ $gen: 'matrix', args: [120, 120, 0, 1000, 157] }], big: true },
      ],
      constraints: ['1 ≤ m, n ≤ 200 (large test: 120 × 120)', '0 ≤ heights[r][c] ≤ 10⁵'],
      hints: [
        'Asking "can this cell reach the ocean?" for every cell repeats a lot of work.',
        'Reverse the question: start from the ocean edges and climb uphill (to neighbours with height ≥ current). Everything you reach can drain to that ocean.',
        'Do two searches, one from the Pacific edges and one from the Atlantic edges, and return the cells marked by both.',
      ],
      solution: {
        pattern: '**Reverse search from the targets:** instead of searching from every cell to a boundary, search once from the boundary with reversed edges.',
        intuition: M`
          Water flows downhill from a cell to the ocean. Reversing that, the ocean "climbs" uphill into every cell that can drain into it. One BFS/DFS from all Pacific border cells, moving only to neighbours at least as high, marks exactly the cells that can reach the Pacific. The same from the Atlantic border, then intersect.
        `,
        java: J`class Solution {
    private static final int[][] DIRS = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

    public List<List<Integer>> pacificAtlantic(int[][] h) {
        int R = h.length, C = h[0].length;
        boolean[][] pac = new boolean[R][C], atl = new boolean[R][C];
        Deque<int[]> pq = new ArrayDeque<>(), aq = new ArrayDeque<>();
        for (int r = 0; r < R; r++) { mark(pac, pq, r, 0); mark(atl, aq, r, C - 1); }
        for (int c = 0; c < C; c++) { mark(pac, pq, 0, c); mark(atl, aq, R - 1, c); }
        climb(h, pac, pq);
        climb(h, atl, aq);
        List<List<Integer>> res = new ArrayList<>();
        for (int r = 0; r < R; r++) for (int c = 0; c < C; c++) if (pac[r][c] && atl[r][c]) res.add(List.of(r, c));
        return res;
    }

    private void mark(boolean[][] seen, Deque<int[]> q, int r, int c) {
        if (!seen[r][c]) { seen[r][c] = true; q.offer(new int[]{r, c}); }
    }

    private void climb(int[][] h, boolean[][] seen, Deque<int[]> q) {       // multi-source BFS uphill
        while (!q.isEmpty()) {
            int[] cur = q.poll();
            for (int[] d : DIRS) {
                int r = cur[0] + d[0], c = cur[1] + d[1];
                if (r < 0 || c < 0 || r >= h.length || c >= h[0].length || seen[r][c]) continue;
                if (h[r][c] < h[cur[0]][cur[1]]) continue;                   // can't flow back down to cur
                seen[r][c] = true;
                q.offer(new int[]{r, c});
            }
        }
    }
}`,
        time: 'O(m · n)', space: 'O(m · n)',
        pitfalls: M`
          - Searching from every cell: O((m·n)²).
          - Reversing the comparison: when climbing from the ocean, move to neighbours **≥** the current height (water can flow from them down to here).
        `,
        alts: [
          { name: 'DFS from every cell', time: 'O((m·n)²)', space: 'O(m·n)', note: 'For each cell, DFS downhill and check whether both oceans are reached. Correct, but far too slow for 200 × 200.',
            java: J`class Solution {
    public List<List<Integer>> pacificAtlantic(int[][] h) {
        int R = h.length, C = h[0].length;
        List<List<Integer>> res = new ArrayList<>();
        for (int r = 0; r < R; r++) for (int c = 0; c < C; c++) {
            boolean[] ocean = new boolean[2];
            dfs(h, r, c, new boolean[R][C], ocean);
            if (ocean[0] && ocean[1]) res.add(List.of(r, c));
        }
        return res;
    }
    private void dfs(int[][] h, int r, int c, boolean[][] seen, boolean[] ocean) {
        if (seen[r][c]) return;
        seen[r][c] = true;
        if (r == 0 || c == 0) ocean[0] = true;
        if (r == h.length - 1 || c == h[0].length - 1) ocean[1] = true;
        int[][] d = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        for (int[] x : d) {
            int nr = r + x[0], nc = c + x[1];
            if (nr >= 0 && nc >= 0 && nr < h.length && nc < h[0].length && h[nr][nc] <= h[r][c]) dfs(h, nr, nc, seen, ocean);
        }
    }
}` },
        ],
        talk: 'Reverse the flow: multi-source BFS from each ocean’s border cells, moving to neighbours at least as high, marks every cell that drains to that ocean. Return the intersection. Two O(m·n) passes.',
      },
      lc: [lc(417, 'pacific-atlantic-water-flow', 'Pacific Atlantic Water Flow', 'same'), lc(130, 'surrounded-regions', 'Surrounded Regions', 'similar'), lc(1020, 'number-of-enclaves', 'Number of Enclaves', 'similar')],
      drill: { prompt: 'Which cells of a height map can drain water to both the top/left and bottom/right edges?', pattern: 'graph-traversal', why: 'Reverse search: BFS/DFS uphill from each border, then intersect.' },
    } },

    { problem: {
      id: 'surrounded-regions', title: 'Capture Surrounded Regions', diff: 'medium',
      tags: ['border search', 'in place'],
      statement: M`
        «board» contains «'X'» and «'O'». A region of «'O'»s (connected horizontally or vertically) is **captured** if it doesn't touch the border of the board; capturing turns all its cells into «'X'». Modify «board» in place (the method returns nothing).
      `,
      fn: { name: 'solve', params: [['char[][]', 'board']], ret: 'void' },
      tests: [
        { args: [[['X', 'X', 'X', 'X'], ['X', 'O', 'O', 'X'], ['X', 'X', 'O', 'X'], ['X', 'O', 'X', 'X']]], ex: true, expect: [['X', 'X', 'X', 'X'], ['X', 'X', 'X', 'X'], ['X', 'X', 'X', 'X'], ['X', 'O', 'X', 'X']], why: 'The bottom «O» touches the border, so it survives.' },
        { args: [[['X']]], ex: true, expect: [['X']] },
        { args: [[['O']]], expect: [['O']] },
        { args: [[['O', 'O'], ['O', 'O']]], expect: [['O', 'O'], ['O', 'O']] },
        { args: [[['X', 'O', 'X'], ['O', 'X', 'O'], ['X', 'O', 'X']]], expect: [['X', 'O', 'X'], ['O', 'X', 'O'], ['X', 'O', 'X']] },
        { args: [[['X', 'X', 'X', 'X', 'X'], ['X', 'O', 'O', 'O', 'X'], ['X', 'O', 'X', 'O', 'X'], ['X', 'O', 'O', 'O', 'X'], ['X', 'X', 'X', 'X', 'X']]], expect: [['X', 'X', 'X', 'X', 'X'], ['X', 'X', 'X', 'X', 'X'], ['X', 'X', 'X', 'X', 'X'], ['X', 'X', 'X', 'X', 'X'], ['X', 'X', 'X', 'X', 'X']] },
        { args: [{ $gen: 'grid', args: [150, 150, 'XO', 40, 159] }], big: true },
      ],
      constraints: ['1 ≤ m, n ≤ 200 (large test: 150 × 150)'],
      hints: [
        'Which «O» cells are safe? Exactly those connected to a border «O».',
        "Flood fill from every border «O», marking the safe cells with a temporary symbol like «'S'».",
        'Then sweep: remaining «O» → «X» (captured), «S» → «O» (restored).',
      ],
      solution: {
        pattern: '**Mark from the border, then sweep:** the complement trick. Find what survives, and everything else changes.',
        intuition: 'A region is captured iff it has no path to the border. Rather than testing each region, flood from the border: whatever is reached survives, and everything else is captured.',
        java: J`class Solution {
    public void solve(char[][] b) {
        int R = b.length, C = b[0].length;
        for (int r = 0; r < R; r++) { keep(b, r, 0); keep(b, r, C - 1); }
        for (int c = 0; c < C; c++) { keep(b, 0, c); keep(b, R - 1, c); }
        for (int r = 0; r < R; r++)
            for (int c = 0; c < C; c++)
                b[r][c] = b[r][c] == 'S' ? 'O' : 'X';     // S survived; any other O is captured
    }

    private void keep(char[][] b, int r, int c) {          // iterative flood fill from a border cell
        if (b[r][c] != 'O') return;
        Deque<int[]> st = new ArrayDeque<>();
        b[r][c] = 'S'; st.push(new int[]{r, c});
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        while (!st.isEmpty()) {
            int[] cur = st.pop();
            for (int[] d : dirs) {
                int nr = cur[0] + d[0], nc = cur[1] + d[1];
                if (nr < 0 || nc < 0 || nr >= b.length || nc >= b[0].length || b[nr][nc] != 'O') continue;
                b[nr][nc] = 'S'; st.push(new int[]{nr, nc});
            }
        }
    }
}`,
        time: 'O(m · n)', space: 'O(m · n)',
        pitfalls: M`
          - Capturing regions as you find them from the inside forces you to know the whole region first: messy. The border-first approach avoids that.
          - A recursive flood fill from the border can go very deep on large all-«O» boards. This version uses an explicit stack.
        `,
        alts: [
          { name: 'Union-Find with a virtual border node', time: '≈O(m·n)', space: 'O(m·n)', note: 'Union every border O with a dummy node and every O with its O neighbours; O cells not connected to the dummy get captured.', check: false },
        ],
        talk: 'Flood fill from every border O, marking safe cells; then sweep the board: marked cells go back to O, and every other O is captured and becomes X. O(m·n).',
      },
      lc: [lc(130, 'surrounded-regions', 'Surrounded Regions', 'same'), lc(1020, 'number-of-enclaves', 'Number of Enclaves', 'variant'), lc(1254, 'number-of-closed-islands', 'Number of Closed Islands', 'variant')],
      drill: { prompt: 'Flip every O region that does not touch the border to X.', pattern: 'graph-traversal', why: 'Flood fill from the border to mark the survivors, then sweep.' },
    } },

    { problem: {
      id: 'shortest-path-binary-matrix', title: 'Shortest Clear Path in a Grid', diff: 'medium',
      tags: ['BFS', '8 directions'],
      statement: M`
        In an «n × n» binary grid, «0» is open and «1» is blocked. Find the length (in **cells**) of the shortest path from the top-left to the bottom-right corner that uses only open cells, moving in any of the **8 directions**. Return «−1» if there is no such path.
      `,
      fn: { name: 'shortestPathBinaryMatrix', params: [['int[][]', 'grid']], ret: 'int' },
      tests: [
        { args: [[[0, 1], [1, 0]]], ex: true, expect: 2 },
        { args: [[[0, 0, 0], [1, 1, 0], [1, 1, 0]]], ex: true, expect: 4 },
        { args: [[[1, 0, 0], [1, 1, 0], [1, 1, 0]]], ex: true, expect: -1, why: 'The start cell is blocked.' },
        { args: [[[0]]], expect: 1 },
        { args: [[[0, 0], [0, 1]]], expect: -1 },
        { args: [[[0, 1, 1], [1, 0, 1], [1, 1, 0]]], expect: 3, why: 'Straight down the diagonal.' },
        { args: [[[0, 0, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 1, 1, 0]]], expect: 6, why: 'Row 1 is only open at its last cell, so every path detours through it.' },
        { args: [{ $gen: 'binGrid', args: [200, 200, 25, 161] }], big: true },
        { args: [{ $gen: 'binGrid', args: [200, 200, 0, 162] }], big: true, expect: 200 },
      ],
      constraints: ['1 ≤ n ≤ 100 (large tests: 200)', 'grid[i][j] ∈ {0, 1}'],
      hints: [
        'All moves cost the same (one cell), so the fewest moves means BFS.',
        'Start from (0, 0) with distance 1 (it counts as a cell). Explore all 8 neighbours.',
        'Check that both corners are open. Mark cells visited when enqueuing (you can overwrite the grid with 1).',
      ],
      solution: {
        pattern: '**BFS for unweighted shortest paths:** the first time you reach the target is optimal.',
        intuition: 'BFS explores cells in rings of increasing path length. When the bottom-right cell is first dequeued, no shorter path can exist, because all shorter rings were already exhausted.',
        java: J`class Solution {
    public int shortestPathBinaryMatrix(int[][] grid) {
        int n = grid.length;
        if (grid[0][0] == 1 || grid[n - 1][n - 1] == 1) return -1;
        Deque<int[]> q = new ArrayDeque<>();
        q.offer(new int[]{0, 0});
        grid[0][0] = 1;                                   // visited
        for (int dist = 1; !q.isEmpty(); dist++) {
            for (int k = q.size(); k > 0; k--) {
                int[] cur = q.poll();
                if (cur[0] == n - 1 && cur[1] == n - 1) return dist;
                for (int dr = -1; dr <= 1; dr++)
                    for (int dc = -1; dc <= 1; dc++) {
                        int r = cur[0] + dr, c = cur[1] + dc;
                        if (r < 0 || c < 0 || r >= n || c >= n || grid[r][c] != 0) continue;
                        grid[r][c] = 1;
                        q.offer(new int[]{r, c});
                    }
            }
        }
        return -1;
    }
}`,
        time: 'O(n²)', space: 'O(n²)',
        pitfalls: M`
          - Path length counts cells, not moves: a 1 × 1 grid has length 1.
          - DFS finds *a* path, not the shortest one.
          - Marking visited at dequeue time lets cells be enqueued up to 8 times.
        `,
        alts: [
          { name: 'A* with Chebyshev distance', time: 'O(n² log n)', space: 'O(n²)', note: 'A priority queue ordered by distance + max(|dr|, |dc|) to the target reaches it faster on open grids. It’s a good follow-up mention, though BFS is already optimal in the worst case.', check: false },
        ],
        talk: 'Unit-cost moves, so BFS from the top-left with distance 1, over 8 neighbours, marking cells visited on enqueue. The first time the bottom-right is dequeued gives the answer. O(n²).',
      },
      lc: [lc(1091, 'shortest-path-in-binary-matrix', 'Shortest Path in Binary Matrix', 'same'), lc(1926, 'nearest-exit-from-entrance-in-maze', 'Nearest Exit from Entrance in Maze', 'similar'), lc(1293, 'shortest-path-in-a-grid-with-obstacles-elimination', 'Shortest Path in a Grid with Obstacles Elimination', 'harder')],
      drill: { prompt: 'Fewest cells on a path through open cells from one corner of a grid to the other (8-directional).', pattern: 'bfs-shortest', why: 'Unit-cost moves: BFS finds the shortest path.' },
    } },

    { problem: {
      id: 'word-ladder', title: 'Word Ladder', diff: 'hard',
      tags: ['BFS', 'implicit graph'],
      statement: M`
        A **transformation sequence** from «beginWord» to «endWord» changes one letter at a time, and every intermediate word (and «endWord») must be in «wordList». Return the **number of words** in the shortest such sequence (including «beginWord»), or «0» if none exists.
      `,
      fn: { name: 'ladderLength', params: [['String', 'beginWord'], ['String', 'endWord'], ['List<String>', 'wordList']], ret: 'int' },
      tests: [
        { args: ['hit', 'cog', ['hot', 'dot', 'dog', 'lot', 'log', 'cog']], ex: true, expect: 5, why: 'hit → hot → dot → dog → cog.' },
        { args: ['hit', 'cog', ['hot', 'dot', 'dog', 'lot', 'log']], ex: true, expect: 0, why: '«cog» isn’t in the list.' },
        { args: ['a', 'c', ['a', 'b', 'c']], expect: 2 },
        { args: ['hot', 'dog', ['hot', 'dog']], expect: 0 },
        { args: ['lost', 'cost', ['most', 'fist', 'lost', 'cost', 'fish']], expect: 2 },
        { args: ['red', 'tax', ['ted', 'tex', 'red', 'tax', 'tad', 'den', 'rex', 'pee']], expect: 4 },
        { args: ['aaaaa', 'eeeee', ladderWords(5, 'abcde', 163, 0.35)], big: true },
      ],
      constraints: ['1 ≤ word length ≤ 10', '1 ≤ wordList.length ≤ 5000 (large test ≈ 2000)', 'All words have the same length, lowercase'],
      hints: [
        'Words are nodes; an edge joins words that differ in exactly one letter. You want the fewest edges: BFS.',
        'Don’t compare every pair of words (O(N² · L)). Generate neighbours instead: for each position, try all 26 letters and check a HashSet.',
        'Remove words from the set when you enqueue them (visited marking), and count levels.',
      ],
      solution: {
        pattern: '**BFS on an implicit graph:** generate neighbours on the fly, look them up in a hash set, and mark on enqueue.',
        intuition: M`
          The graph is never built explicitly. A word's neighbours are its one-letter mutations that exist in the dictionary. BFS from «beginWord» finds the fewest transformations, level by level. Removing words from the dictionary as they're enqueued doubles as the visited set.
        `,
        java: J`class Solution {
    public int ladderLength(String beginWord, String endWord, List<String> wordList) {
        Set<String> dict = new HashSet<>(wordList);
        if (!dict.contains(endWord)) return 0;
        Deque<String> q = new ArrayDeque<>();
        q.offer(beginWord);
        dict.remove(beginWord);
        for (int len = 1; !q.isEmpty(); len++) {
            for (int k = q.size(); k > 0; k--) {
                char[] w = q.poll().toCharArray();
                if (new String(w).equals(endWord)) return len;
                for (int i = 0; i < w.length; i++) {
                    char orig = w[i];
                    for (char c = 'a'; c <= 'z'; c++) {
                        if (c == orig) continue;
                        w[i] = c;
                        String next = new String(w);
                        if (dict.remove(next)) q.offer(next);    // remove = mark visited
                    }
                    w[i] = orig;
                }
            }
        }
        return 0;
    }
}`,
        time: 'O(N · L² · 26)', space: 'O(N · L)', timeWhy: 'N words, L letters; building each neighbour string costs O(L)',
        pitfalls: M`
          - Comparing all pairs of words to build edges is O(N² · L), which is too slow for N = 5000.
          - Returning the number of *moves* instead of *words*: the answer counts beginWord too.
          - Not marking visited until dequeue lets popular words be enqueued many times.
        `,
        alts: [
          { name: 'Bidirectional BFS', time: 'much faster in practice', space: 'O(N · L)', note: 'Expand from both ends, always growing the smaller frontier, and stop when the frontiers meet. It cuts the explored area dramatically. A great follow-up answer.',
            java: J`class Solution {
    public int ladderLength(String beginWord, String endWord, List<String> wordList) {
        Set<String> dict = new HashSet<>(wordList);
        if (!dict.contains(endWord)) return 0;
        Set<String> a = new HashSet<>(Set.of(beginWord)), b = new HashSet<>(Set.of(endWord));
        dict.remove(beginWord); dict.remove(endWord);
        for (int len = 2; !a.isEmpty() && !b.isEmpty(); len++) {
            if (a.size() > b.size()) { Set<String> t = a; a = b; b = t; }
            Set<String> next = new HashSet<>();
            for (String s : a) {
                char[] w = s.toCharArray();
                for (int i = 0; i < w.length; i++) {
                    char o = w[i];
                    for (char c = 'a'; c <= 'z'; c++) {
                        w[i] = c;
                        String t = new String(w);
                        if (b.contains(t)) return len;
                        if (dict.remove(t)) next.add(t);
                    }
                    w[i] = o;
                }
            }
            a = next;
        }
        return 0;
    }
}` },
          { name: 'Wildcard buckets', time: 'O(N · L²)', space: 'O(N · L²)', note: 'Precompute a map from patterns like «h*t» to their words; a word’s neighbours are the words in its L buckets. Useful when the alphabet is large.' },
        ],
        followups: M`
          - **Return all shortest sequences** (Word Ladder II, LeetCode 126): BFS recording parents per level, then backtrack the paths.
        `,
        talk: 'Words are nodes with edges between one-letter differences. BFS from beginWord, generating neighbours by trying 26 letters at each position and checking a HashSet; removing a word from the set marks it visited. Count levels. Bidirectional BFS speeds this up a lot.',
      },
      lc: [lc(127, 'word-ladder', 'Word Ladder', 'same'), lc(126, 'word-ladder-ii', 'Word Ladder II', 'harder'), lc(433, 'minimum-genetic-mutation', 'Minimum Genetic Mutation', 'easier'), lc(752, 'open-the-lock', 'Open the Lock', 'similar')],
      drill: { prompt: 'Fewest single-letter changes (each intermediate word in a dictionary) from one word to another.', pattern: 'bfs-shortest', why: 'BFS on an implicit graph of words, generating neighbours on the fly.' },
    } },

    { lesson: 'topological-sort', title: 'Topological sort and cycle detection', mins: 11,
      lede: 'Order the nodes of a directed graph so every edge points forward. Possible exactly when there’s no cycle.',
      body: M`
        ## When you need it
        Prerequisites, build systems, task pipelines, spreadsheet formulas, and deriving an alphabet from sorted words: whenever "A must come before B", draw an edge A → B and find an order that respects every edge. Such an order exists **iff the graph is a DAG** (a directed acyclic graph).

        ## Kahn's algorithm (BFS on in-degrees)
        @viz topoKahn

        ~~~java Template: Kahn's algorithm
        int[] indeg = new int[n];
        List<List<Integer>> adj = ...;          // adj.get(u) = nodes that depend on u
        for (int[] e : edges) { adj.get(e[0]).add(e[1]); indeg[e[1]]++; }
        Deque<Integer> q = new ArrayDeque<>();
        for (int i = 0; i < n; i++) if (indeg[i] == 0) q.offer(i);
        List<Integer> order = new ArrayList<>();
        while (!q.isEmpty()) {
            int u = q.poll();
            order.add(u);
            for (int v : adj.get(u)) if (--indeg[v] == 0) q.offer(v);
        }
        // order.size() < n  ⇔  there is a cycle
        ~~~
        Why the cycle check works: nodes on a cycle always keep in-degree ≥ 1 (each is waiting on the previous one), so they never enter the queue.

        :::key Want a specific order among valid ones?
        Replace the queue with a «PriorityQueue» to get the **lexicographically smallest** topological order, which is useful when an answer must be unique (Alien Dictionary here). The cost rises to O((V + E) log V).
        :::

        ## DFS with three colours
        The alternative: DFS, and append each node to the order **after** all its descendants are finished (post-order), then reverse. To detect cycles, colour nodes: 0 = unvisited, 1 = on the current DFS path, 2 = done. Meeting a node coloured 1 means a **back edge**, which is a cycle.
        ~~~java
        boolean hasCycle(int u) {                 // colour: 0 new, 1 in progress, 2 done
            colour[u] = 1;
            for (int v : adj.get(u)) {
                if (colour[v] == 1) return true;  // back edge: v is an ancestor on the path
                if (colour[v] == 0 && hasCycle(v)) return true;
            }
            colour[u] = 2;
            return false;
        }
        ~~~
        A plain «visited» boolean isn't enough for directed graphs: reaching an already-finished node (colour 2) through another route is fine, not a cycle.

        ## Edge direction: get it right
        LeetCode's «prerequisites[i] = [a, b]» means "to take a you must first take b", which is the edge **b → a**. Mixing up the direction reverses your order.

        ## Signals
        - "Prerequisites", "dependencies", "must happen before", "build order", "can all tasks be finished?"
        - "Detect a cycle in a directed graph."
        - "Derive an ordering" from comparisons (alien dictionary, sequence reconstruction).
        - Longest path or DP in a DAG: process nodes in topological order.

        @quiz 0
      `,
      quiz: [
        { q: 'Kahn’s algorithm processed 7 of 10 nodes before the queue emptied. What can you conclude?',
          options: ['The graph is disconnected', 'There’s a cycle: the remaining 3 nodes (or some of them plus their dependants) never reached in-degree 0', 'Kahn’s algorithm failed and you should use DFS', 'The order is still valid for 10 nodes'],
          answer: 1, why: 'Nodes stuck with positive in-degree are on a cycle or depend on one. Disconnected DAGs are handled fine, since every component’s sources start in the queue.' },
      ],
      practice: ['course-schedule', 'course-schedule-ii', 'alien-order'],
    },

    { problem: {
      id: 'course-schedule', title: 'Can You Finish All Courses?', diff: 'medium',
      tags: ['topological sort', 'cycle detection'],
      statement: M`
        There are «numCourses» courses labelled «0 … numCourses − 1». Each pair «[a, b]» in «prerequisites» means you must take course «b» before course «a». Return whether it's possible to finish **every** course.
      `,
      fn: { name: 'canFinish', params: [['int', 'numCourses'], ['int[][]', 'prerequisites']], ret: 'boolean' },
      tests: [
        { args: [2, [[1, 0]]], ex: true, expect: true },
        { args: [2, [[1, 0], [0, 1]]], ex: true, expect: false, why: 'Each course requires the other: a cycle.' },
        { args: [1, []], expect: true },
        { args: [3, [[0, 1], [1, 2], [2, 0]]], expect: false },
        { args: [4, [[1, 0], [2, 0], [3, 1], [3, 2]]], expect: true },
        { args: [3, [[1, 1]]], expect: false, why: 'A self-loop.' },
        { args: [5, [[1, 4], [2, 4], [3, 1], [3, 2]]], expect: true },
        { args: [3000, prereqs(3000, 5000, 165)], big: true, expect: true },
        { args: [3000, prereqs(3000, 5000, 166, true)], big: true, expect: false },
      ],
      constraints: ['1 ≤ numCourses ≤ 2000 (large tests: 3000)', '0 ≤ prerequisites.length ≤ 5000'],
      hints: [
        'Model it as a directed graph with edges b → a. When is it impossible to finish?',
        'Exactly when there’s a cycle.',
        'Kahn’s algorithm: repeatedly take courses with no remaining prerequisites. If you can take all of them, return true.',
      ],
      solution: {
        pattern: '**Cycle detection via topological sort:** Kahn’s algorithm counts how many nodes can be ordered.',
        intuition: 'A course is available when all its prerequisites are done (in-degree 0). Taking available courses unlocks others. If you get stuck before taking everything, the remaining courses wait on each other in a cycle.',
        java: J`class Solution {
    public boolean canFinish(int numCourses, int[][] prerequisites) {
        List<List<Integer>> adj = new ArrayList<>();
        for (int i = 0; i < numCourses; i++) adj.add(new ArrayList<>());
        int[] indeg = new int[numCourses];
        for (int[] p : prerequisites) { adj.get(p[1]).add(p[0]); indeg[p[0]]++; }   // b -> a

        Deque<Integer> q = new ArrayDeque<>();
        for (int i = 0; i < numCourses; i++) if (indeg[i] == 0) q.offer(i);
        int taken = 0;
        while (!q.isEmpty()) {
            int u = q.poll();
            taken++;
            for (int v : adj.get(u)) if (--indeg[v] == 0) q.offer(v);
        }
        return taken == numCourses;
    }
}`,
        time: 'O(V + E)', space: 'O(V + E)',
        pitfalls: M`
          - Edge direction: «[a, b]» is b → a.
          - DFS with only a boolean «visited» can't tell a back edge (a cycle) from a cross edge to a finished node. Use three colours.
        `,
        alts: [
          { name: 'DFS three-colour cycle check', time: 'O(V + E)', space: 'O(V + E)', java: J`class Solution {
    private List<List<Integer>> adj;
    private int[] colour;                       // 0 new, 1 on path, 2 done
    public boolean canFinish(int n, int[][] pre) {
        adj = new ArrayList<>();
        for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
        for (int[] p : pre) adj.get(p[1]).add(p[0]);
        colour = new int[n];
        for (int i = 0; i < n; i++) if (colour[i] == 0 && cyclic(i)) return false;
        return true;
    }
    private boolean cyclic(int u) {
        colour[u] = 1;
        for (int v : adj.get(u)) {
            if (colour[v] == 1) return true;
            if (colour[v] == 0 && cyclic(v)) return true;
        }
        colour[u] = 2;
        return false;
    }
}` },
        ],
        talk: 'It’s cycle detection in a directed graph with edges prereq → course. Kahn’s algorithm: start from in-degree-zero courses, take them, and decrement their dependants. If every course gets taken there’s no cycle. O(V + E).',
      },
      viz: { id: 'topoKahn' },
      lc: [lc(207, 'course-schedule', 'Course Schedule', 'same'), lc(210, 'course-schedule-ii', 'Course Schedule II', 'variant'), lc(802, 'find-eventual-safe-states', 'Find Eventual Safe States', 'similar'), lc(1462, 'course-schedule-iv', 'Course Schedule IV', 'harder')],
      drill: { prompt: 'Given course prerequisite pairs, can every course be completed?', pattern: 'topo-sort', why: 'It’s cycle detection in a directed graph: topological sort (Kahn) or DFS colours.' },
    } },

    { problem: {
      id: 'course-schedule-ii', title: 'Course Order', diff: 'medium',
      tags: ['topological sort'],
      statement: M`
        Same setup as before («[a, b]» means b before a). Return **any** order in which you can take all «numCourses» courses, or an **empty array** if it's impossible. Any valid order is accepted.
      `,
      fn: { name: 'findOrder', params: [['int', 'numCourses'], ['int[][]', 'prerequisites']], ret: 'int[]' },
      validate: topoValid,
      tests: [
        { args: [2, [[1, 0]]], ex: true, why: 'The only valid order is [0, 1].' },
        { args: [4, [[1, 0], [2, 0], [3, 1], [3, 2]]], ex: true, why: '[0,1,2,3] and [0,2,1,3] are both correct.' },
        { args: [1, []], ex: true },
        { args: [2, [[0, 1], [1, 0]]], why: 'A cycle, so the answer must be [].' },
        { args: [3, []] },
        { args: [6, [[1, 0], [2, 1], [3, 2], [4, 3], [5, 4]]] },
        { args: [3, [[0, 1], [0, 2], [1, 2]]] },
        { args: [2000, prereqs(2000, 4000, 167)], big: true },
        { args: [2000, prereqs(2000, 4000, 168, true)], big: true },
      ],
      constraints: ['1 ≤ numCourses ≤ 2000', '0 ≤ prerequisites.length ≤ 4000'],
      hints: [
        'Kahn’s algorithm produces an order as a by-product: the order in which nodes leave the queue.',
        'Record each polled course. If fewer than numCourses were recorded, there’s a cycle.',
        'Return «new int[0]» in that case.',
      ],
      solution: {
        pattern: '**Kahn’s algorithm**, collecting the dequeue order.',
        intuition: 'Every course enters the queue only after all its prerequisites have been dequeued, so the dequeue order respects every edge.',
        java: J`class Solution {
    public int[] findOrder(int numCourses, int[][] prerequisites) {
        List<List<Integer>> adj = new ArrayList<>();
        for (int i = 0; i < numCourses; i++) adj.add(new ArrayList<>());
        int[] indeg = new int[numCourses];
        for (int[] p : prerequisites) { adj.get(p[1]).add(p[0]); indeg[p[0]]++; }
        Deque<Integer> q = new ArrayDeque<>();
        for (int i = 0; i < numCourses; i++) if (indeg[i] == 0) q.offer(i);
        int[] order = new int[numCourses];
        int k = 0;
        while (!q.isEmpty()) {
            int u = q.poll();
            order[k++] = u;
            for (int v : adj.get(u)) if (--indeg[v] == 0) q.offer(v);
        }
        return k == numCourses ? order : new int[0];
    }
}`,
        time: 'O(V + E)', space: 'O(V + E)',
        alts: [
          { name: 'DFS post-order, reversed', time: 'O(V + E)', space: 'O(V + E)', note: 'Append each node after its dependants are finished, then reverse. Use three colours to detect cycles.',
            java: J`class Solution {
    private List<List<Integer>> adj; private int[] colour; private List<Integer> post = new ArrayList<>();
    public int[] findOrder(int n, int[][] pre) {
        adj = new ArrayList<>();
        for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
        for (int[] p : pre) adj.get(p[1]).add(p[0]);
        colour = new int[n];
        for (int i = 0; i < n; i++) if (colour[i] == 0 && !dfs(i)) return new int[0];
        int[] res = new int[n];
        for (int i = 0; i < n; i++) res[i] = post.get(n - 1 - i);
        return res;
    }
    private boolean dfs(int u) {
        colour[u] = 1;
        for (int v : adj.get(u)) { if (colour[v] == 1) return false; if (colour[v] == 0 && !dfs(v)) return false; }
        colour[u] = 2; post.add(u);
        return true;
    }
}` },
        ],
        talk: 'Kahn’s algorithm: the order courses leave the queue is a valid schedule. If fewer than n come out, there’s a cycle and I return an empty array. O(V + E).',
      },
      viz: { id: 'topoKahn' },
      lc: [lc(210, 'course-schedule-ii', 'Course Schedule II', 'same'), lc(207, 'course-schedule', 'Course Schedule', 'easier'), lc(1203, 'sort-items-by-groups-respecting-dependencies', 'Sort Items by Groups Respecting Dependencies', 'harder'), lc(2115, 'find-all-possible-recipes-from-given-supplies', 'Find All Possible Recipes from Given Supplies', 'similar')],
      drill: { prompt: 'Return a valid order to take all courses given prerequisite pairs (or none if impossible).', pattern: 'topo-sort', why: 'Topological sort (Kahn’s dequeue order); fewer than n nodes means a cycle.' },
    } },

    { problem: {
      id: 'alien-order', title: 'Alien Alphabet', diff: 'hard',
      tags: ['topological sort', 'graph building'],
      statement: M`
        An alien language uses lowercase English letters in an unknown order. You're given «words», sorted **lexicographically by the alien alphabet**. Deduce an ordering of **all letters that appear** in the words.

        Return the order as a string. If several orders are consistent, return the **alphabetically smallest** one (using normal a–z order to break ties). If the input is inconsistent (no valid order), return «""».

        *(LeetCode’s version accepts any valid order; requiring the smallest makes the answer unique.)*
      `,
      fn: { name: 'alienOrder', params: [['String[]', 'words']], ret: 'String' },
      tests: [
        { args: [['wrt', 'wrf', 'er', 'ett', 'rftt']], ex: true, expect: 'wertf', why: 't < f (wrt < wrf), w < e, r < t, e < r.' },
        { args: [['z', 'x']], ex: true, expect: 'zx' },
        { args: [['z', 'x', 'z']], ex: true, expect: '', why: 'z < x and x < z: contradiction.' },
        { args: [['abc', 'ab']], expect: '', why: 'A longer word can’t come before its own prefix.' },
        { args: [['ab', 'adc']], expect: 'abcd', why: 'Only b < d is known; the rest is ordered alphabetically.' },
        { args: [['z']], expect: 'z' },
        { args: [['ba', 'bc', 'ac', 'cab']], expect: 'bac' },
        { args: [alienWords(3000, 169)], big: true },
      ],
      constraints: ['1 ≤ words.length ≤ 100 (large test: 3000)', '1 ≤ words[i].length ≤ 100', 'Lowercase letters'],
      hints: [
        'Compare adjacent words only. The first position where they differ gives one edge: letter in the first word → letter in the second.',
        'If one word is a proper prefix of the previous word (like «abc» before «ab»), the input is invalid.',
        'Topologically sort the letters that appear, using a min-heap instead of a queue to get the alphabetically smallest order. If not every letter is output, there’s a cycle.',
      ],
      solution: {
        pattern: '**Build a graph from comparisons, then topological sort.** A priority queue makes the order canonical (lexicographically smallest).',
        intuition: M`
          In a sorted dictionary, each adjacent pair of words tells you exactly one thing: at their first differing position, the first word's letter comes earlier. (Pairs further apart add nothing new, by transitivity.) That produces a DAG over letters if the input is consistent. A topological order is an alphabet, and choosing the smallest available letter at each step gives the unique smallest one.
        `,
        java: J`class Solution {
    public String alienOrder(String[] words) {
        boolean[] present = new boolean[26];
        for (String w : words) for (char c : w.toCharArray()) present[c - 'a'] = true;
        boolean[][] edge = new boolean[26][26];
        int[] indeg = new int[26];
        for (int i = 0; i + 1 < words.length; i++) {
            String a = words[i], b = words[i + 1];
            int j = 0;
            while (j < a.length() && j < b.length() && a.charAt(j) == b.charAt(j)) j++;
            if (j == Math.min(a.length(), b.length())) {
                if (a.length() > b.length()) return "";        // "abc" before "ab": invalid
                continue;
            }
            int u = a.charAt(j) - 'a', v = b.charAt(j) - 'a';
            if (!edge[u][v]) { edge[u][v] = true; indeg[v]++; }
        }
        PriorityQueue<Integer> pq = new PriorityQueue<>();      // smallest available letter first
        int letters = 0;
        for (int c = 0; c < 26; c++) if (present[c]) { letters++; if (indeg[c] == 0) pq.offer(c); }
        StringBuilder sb = new StringBuilder();
        while (!pq.isEmpty()) {
            int u = pq.poll();
            sb.append((char) ('a' + u));
            for (int v = 0; v < 26; v++) if (edge[u][v] && --indeg[v] == 0) pq.offer(v);
        }
        return sb.length() == letters ? sb.toString() : "";    // leftover letters = cycle
    }
}`,
        time: 'O(total characters + 26² log 26)', space: 'O(26²)',
        pitfalls: M`
          - Adding the same edge twice double-counts the in-degree. Dedupe with the boolean matrix.
          - Forgetting the prefix case: «["abc", "ab"]» is invalid.
          - Only the **first** differing letter of each adjacent pair matters; later letters carry no information.
          - Letters that appear but have no constraints must still be output.
        `,
        alts: [
          { name: 'DFS topological sort (any valid order)', time: 'O(C)', space: 'O(26²)', note: 'The LeetCode version accepts any order, and a DFS with three colours is common there. Here the canonical smallest order needs Kahn’s algorithm with a heap.', check: false },
        ],
        talk: 'Adjacent words give one edge at their first differing letter; a prefix that comes after its extension is invalid. Then Kahn’s algorithm over the present letters, with a min-heap to take the smallest available letter first. If any letter is left over there’s a cycle, so return empty.',
      },
      lc: [lc(269, 'alien-dictionary', 'Alien Dictionary', 'same', { premium: true }), lc(953, 'verifying-an-alien-dictionary', 'Verifying an Alien Dictionary', 'easier'), lc(444, 'sequence-reconstruction', 'Sequence Reconstruction', 'similar', { premium: true })],
      drill: { prompt: 'Given words sorted in an unknown alphabet, recover the letter order.', pattern: 'topo-sort', why: 'Adjacent words yield ordering edges; topologically sort the letters.' },
    } },

    { lesson: 'union-find', title: 'Union-Find (Disjoint Set Union)', mins: 10,
      lede: 'Merge groups and ask “same group?” in nearly O(1): connectivity, cycle detection, and clustering.',
      body: M`
        ## The data structure
        Each element points to a **parent**; following parents leads to the set's **root**, its representative. Two operations:
        - «find(x)»: return x's root.
        - «union(a, b)»: link the root of one set under the root of the other.

        @viz unionFind

        ~~~java Template: Union-Find with path compression and union by size
        class DSU {
            int[] parent, size;
            int components;
            DSU(int n) {
                parent = new int[n]; size = new int[n]; components = n;
                for (int i = 0; i < n; i++) { parent[i] = i; size[i] = 1; }
            }
            int find(int x) {
                while (parent[x] != x) {
                    parent[x] = parent[parent[x]];   // path halving: point to the grandparent
                    x = parent[x];
                }
                return x;
            }
            boolean union(int a, int b) {
                int ra = find(a), rb = find(b);
                if (ra == rb) return false;          // already connected
                if (size[ra] < size[rb]) { int t = ra; ra = rb; rb = t; }
                parent[rb] = ra;                     // smaller tree under the larger
                size[ra] += size[rb];
                components--;
                return true;
            }
        }
        ~~~
        With both optimizations (path compression and union by size or rank), each operation costs **O(α(n))**, where α is the inverse Ackermann function: at most 4 for any realistic n. Effectively constant. Without them, trees can degenerate into chains and «find» becomes O(n).

        ## Union-Find vs DFS/BFS
        | Use Union-Find when… | Use DFS/BFS when… |
        |---|---|
        | Edges arrive **over time** and you query connectivity in between | The whole graph is known up front and you traverse it once |
        | You need "does this edge create a cycle?" in an **undirected** graph | You need paths, distances or an ordering |
        | Grouping by an equivalence ("same email", "can swap") | Directed graphs (Union-Find ignores direction) |

        ## Signals
        - "Number of connected components / provinces / groups", especially with incremental edges.
        - "Redundant connection", "does adding this edge form a cycle?", "is it a valid tree?" (undirected).
        - "Merge accounts / similar strings / equations" (equivalence classes).
        - Kruskal's minimum spanning tree (next module) is sort + Union-Find.

        @quiz 0
      `,
      quiz: [
        { q: 'You call union(a, b) and it returns false (they already share a root). In an undirected graph, what does the edge (a, b) mean?',
          options: ['It’s a duplicate node', 'It would create a cycle, since a and b were already connected', 'The graph is disconnected', 'Nothing'],
          answer: 1, why: 'a and b already have a path between them; adding the edge closes a cycle. That’s exactly Redundant Connection and the tree-validity check.' },
      ],
      practice: ['connected-components', 'redundant-connection', 'graph-valid-tree', 'accounts-merge'],
    },

    { problem: {
      id: 'connected-components', title: 'Count Connected Components', diff: 'medium',
      tags: ['union-find', 'components'],
      statement: M`
        A graph has «n» nodes labelled «0 … n − 1» and a list of **undirected** «edges». Return the number of **connected components**.
      `,
      fn: { name: 'countComponents', params: [['int', 'n'], ['int[][]', 'edges']], ret: 'int' },
      tests: [
        { args: [5, [[0, 1], [1, 2], [3, 4]]], ex: true, expect: 2 },
        { args: [5, [[0, 1], [1, 2], [2, 3], [3, 4]]], ex: true, expect: 1 },
        { args: [1, []], expect: 1 },
        { args: [4, []], expect: 4 },
        { args: [4, [[0, 1], [1, 0], [2, 3], [3, 2]]], expect: 2 },
        { args: [6, [[0, 1], [1, 2], [2, 0], [3, 4]]], expect: 3 },
        { args: [100000, { $gen: 'edges', args: [100000, 60000, 0, 0, 0, 171] }], big: true },
      ],
      constraints: ['1 ≤ n ≤ 2000 (large test: 10⁵)', '0 ≤ edges.length ≤ 5000 (large test: 60 000)'],
      hints: [
        'Every edge merges two groups (unless they’re already one group).',
        'Start with n components; each successful union reduces the count by one.',
        'Or: build an adjacency list and count DFS/BFS launches.',
      ],
      solution: {
        pattern: '**Union-Find component counting:** start with n singletons; each union that merges two different roots removes one component.',
        intuition: 'Components only ever merge. Tracking merges with a DSU gives the count directly, with no traversal needed, and it keeps working if edges keep arriving.',
        java: J`class Solution {
    private int[] parent, size;

    public int countComponents(int n, int[][] edges) {
        parent = new int[n]; size = new int[n];
        for (int i = 0; i < n; i++) { parent[i] = i; size[i] = 1; }
        int components = n;
        for (int[] e : edges) if (union(e[0], e[1])) components--;
        return components;
    }

    private int find(int x) {
        while (parent[x] != x) { parent[x] = parent[parent[x]]; x = parent[x]; }
        return x;
    }

    private boolean union(int a, int b) {
        int ra = find(a), rb = find(b);
        if (ra == rb) return false;
        if (size[ra] < size[rb]) { int t = ra; ra = rb; rb = t; }
        parent[rb] = ra; size[ra] += size[rb];
        return true;
    }
}`,
        time: 'O((n + E) · α(n))', space: 'O(n)',
        alts: [
          { name: 'DFS/BFS over an adjacency list', time: 'O(n + E)', space: 'O(n + E)', java: J`class Solution {
    public int countComponents(int n, int[][] edges) {
        List<List<Integer>> adj = new ArrayList<>();
        for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
        for (int[] e : edges) { adj.get(e[0]).add(e[1]); adj.get(e[1]).add(e[0]); }
        boolean[] seen = new boolean[n];
        int count = 0;
        Deque<Integer> st = new ArrayDeque<>();
        for (int s = 0; s < n; s++) {
            if (seen[s]) continue;
            count++; seen[s] = true; st.push(s);
            while (!st.isEmpty()) { int u = st.pop(); for (int v : adj.get(u)) if (!seen[v]) { seen[v] = true; st.push(v); } }
        }
        return count;
    }
}` },
        ],
        talk: 'Union-Find: start with n components and decrement on every union that joins two different roots. Path compression plus union by size makes it nearly linear. DFS counting the launches works too.',
      },
      viz: { id: 'unionFind' },
      lc: [lc(323, 'number-of-connected-components-in-an-undirected-graph', 'Number of Connected Components in an Undirected Graph', 'same', { premium: true }), lc(547, 'number-of-provinces', 'Number of Provinces', 'variant'), lc(1319, 'number-of-operations-to-make-network-connected', 'Number of Operations to Make Network Connected', 'harder')],
      drill: { prompt: 'Number of connected groups in an undirected graph given as an edge list.', pattern: 'union-find', why: 'Union-Find: start with n components and decrement on each merging union (or count DFS launches).' },
    } },

    { problem: {
      id: 'redundant-connection', title: 'Redundant Connection', diff: 'medium',
      tags: ['union-find', 'cycle'],
      statement: M`
        A tree with «n» nodes (labelled «1 … n») had **one extra edge** added, creating exactly one cycle. «edges» lists all n edges in order. Return an edge you can remove so that the result is a tree again. If several answers work, return the one that appears **last** in «edges».
      `,
      fn: { name: 'findRedundantConnection', params: [['int[][]', 'edges']], ret: 'int[]' },
      tests: [
        { args: [[[1, 2], [1, 3], [2, 3]]], ex: true, expect: [2, 3] },
        { args: [[[1, 2], [2, 3], [3, 4], [1, 4], [1, 5]]], ex: true, expect: [1, 4] },
        { args: [[[1, 2], [2, 1]]], expect: [2, 1] },
        { args: [[[3, 4], [1, 2], [2, 4], [3, 5], [2, 5]]], expect: [2, 5] },
        { args: [[[1, 4], [3, 4], [1, 3], [1, 2], [4, 5]]], expect: [1, 3] },
        { args: [(() => { const e = edgesTree(1000, 0, 172).map(([a, b]) => [a + 1, b + 1]); e.splice(500, 0, [e[700][1], e[20][0]]); return e; })()], big: true },
      ],
      constraints: ['3 ≤ n ≤ 1000', 'edges.length == n', 'No repeated edges; the graph is connected'],
      hints: [
        'Add edges one by one. When does an edge create a cycle?',
        'When its two endpoints are already connected by earlier edges.',
        'Union-Find: the first edge whose endpoints already share a root is the answer. (It’s also the last edge of the cycle in input order.)',
      ],
      solution: {
        pattern: '**Union-Find cycle detection:** the first union that finds both endpoints already connected closes the cycle.',
        intuition: M`
          Process the edges in order. Before the cycle-closing edge, all edges form a forest. The edge that closes the cycle is the first one whose endpoints are already in the same component, and removing it restores a tree. Every other cycle edge appears earlier in the input, so this one is the last removable candidate, as the problem asks.
        `,
        java: J`class Solution {
    public int[] findRedundantConnection(int[][] edges) {
        int[] parent = new int[edges.length + 1];
        for (int i = 0; i < parent.length; i++) parent[i] = i;
        for (int[] e : edges) {
            int ra = find(parent, e[0]), rb = find(parent, e[1]);
            if (ra == rb) return e;                 // already connected: this edge closes the cycle
            parent[ra] = rb;
        }
        return new int[0];
    }

    private int find(int[] p, int x) {
        while (p[x] != x) { p[x] = p[p[x]]; x = p[x]; }
        return x;
    }
}`,
        time: 'O(n · α(n))', space: 'O(n)',
        alts: [
          { name: 'DFS reachability before each insertion', time: 'O(n²)', space: 'O(n)', note: 'Before adding edge (u, v), check whether v is already reachable from u. Correct, but quadratic.',
            java: J`class Solution {
    public int[] findRedundantConnection(int[][] edges) {
        int n = edges.length;
        List<List<Integer>> adj = new ArrayList<>();
        for (int i = 0; i <= n; i++) adj.add(new ArrayList<>());
        for (int[] e : edges) {
            if (reach(adj, e[0], e[1], new boolean[n + 1])) return e;
            adj.get(e[0]).add(e[1]); adj.get(e[1]).add(e[0]);
        }
        return new int[0];
    }
    private boolean reach(List<List<Integer>> adj, int u, int t, boolean[] seen) {
        if (u == t) return true;
        seen[u] = true;
        for (int v : adj.get(u)) if (!seen[v] && reach(adj, v, t, seen)) return true;
        return false;
    }
}` },
        ],
        followups: M`
          - **Directed version** (LeetCode 685, hard): also handle a node with two parents.
        `,
        talk: 'Union-Find over the edges in order: the first edge whose endpoints already share a root closes the cycle, so return it. It’s also the last cycle edge in input order. Nearly O(n).',
      },
      lc: [lc(684, 'redundant-connection', 'Redundant Connection', 'same'), lc(685, 'redundant-connection-ii', 'Redundant Connection II', 'harder'), lc(261, 'graph-valid-tree', 'Graph Valid Tree', 'similar', { premium: true })],
      drill: { prompt: 'A tree plus one extra edge: which edge can be removed to restore a tree?', pattern: 'union-find', why: 'Union-Find: the first edge joining two already-connected nodes closes the cycle.' },
    } },

    { problem: {
      id: 'graph-valid-tree', title: 'Is It a Tree?', diff: 'medium',
      tags: ['union-find', 'tree check'],
      statement: M`
        Given «n» nodes («0 … n − 1») and a list of undirected «edges», return whether they form a valid **tree**: connected, and with no cycles.
      `,
      fn: { name: 'validTree', params: [['int', 'n'], ['int[][]', 'edges']], ret: 'boolean' },
      tests: [
        { args: [5, [[0, 1], [0, 2], [0, 3], [1, 4]]], ex: true, expect: true },
        { args: [5, [[0, 1], [1, 2], [2, 3], [1, 3], [1, 4]]], ex: true, expect: false, why: '1-2-3 forms a cycle.' },
        { args: [1, []], expect: true },
        { args: [2, []], expect: false, why: 'Disconnected.' },
        { args: [4, [[0, 1], [2, 3]]], expect: false },
        { args: [3, [[0, 1], [1, 2], [2, 0]]], expect: false },
        { args: [4, [[0, 1], [0, 2], [0, 3]]], expect: true },
        { args: [20000, edgesTree(20000, 0, 173)], big: true, expect: true },
        { args: [20000, edgesTree(20000, 1, 174)], big: true, expect: false },
      ],
      constraints: ['1 ≤ n ≤ 2000 (large tests: 20 000)', 'No self-loops or repeated edges'],
      hints: [
        'A tree with n nodes has exactly n − 1 edges. What does that rule out?',
        'With exactly n − 1 edges, "connected" and "acyclic" imply each other. Check one of them.',
        'Union-Find: if any edge joins nodes that are already connected, there’s a cycle.',
      ],
      solution: {
        pattern: '**Edge count + Union-Find:** n − 1 edges and no cycle ⇒ tree.',
        intuition: 'A graph with n nodes is a tree iff it has n − 1 edges and no cycles (or equivalently n − 1 edges and connected). So check the count, then run Union-Find looking for a cycle.',
        java: J`class Solution {
    public boolean validTree(int n, int[][] edges) {
        if (edges.length != n - 1) return false;       // too few: disconnected; too many: a cycle
        int[] parent = new int[n];
        for (int i = 0; i < n; i++) parent[i] = i;
        for (int[] e : edges) {
            int ra = find(parent, e[0]), rb = find(parent, e[1]);
            if (ra == rb) return false;                // cycle
            parent[ra] = rb;
        }
        return true;                                   // n - 1 edges, no cycle => connected
    }

    private int find(int[] p, int x) {
        while (p[x] != x) { p[x] = p[p[x]]; x = p[x]; }
        return x;
    }
}`,
        time: 'O(n · α(n))', space: 'O(n)',
        alts: [
          { name: 'DFS: count reachable nodes (with the edge-count check)', time: 'O(n)', space: 'O(n)', java: J`class Solution {
    public boolean validTree(int n, int[][] edges) {
        if (edges.length != n - 1) return false;
        List<List<Integer>> adj = new ArrayList<>();
        for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
        for (int[] e : edges) { adj.get(e[0]).add(e[1]); adj.get(e[1]).add(e[0]); }
        boolean[] seen = new boolean[n];
        Deque<Integer> st = new ArrayDeque<>();
        st.push(0); seen[0] = true; int count = 1;
        while (!st.isEmpty()) { int u = st.pop(); for (int v : adj.get(u)) if (!seen[v]) { seen[v] = true; count++; st.push(v); } }
        return count == n;
    }
}` },
        ],
        talk: 'A tree has exactly n−1 edges; with that many, being acyclic implies being connected. So check the count, then Union-Find: any edge within one component means a cycle. Nearly O(n).',
      },
      lc: [lc(261, 'graph-valid-tree', 'Graph Valid Tree', 'same', { premium: true }), lc(684, 'redundant-connection', 'Redundant Connection', 'similar'), lc(1361, 'validate-binary-tree-nodes', 'Validate Binary Tree Nodes', 'similar')],
      drill: { prompt: 'Do n nodes and an undirected edge list form a single tree?', pattern: 'union-find', why: 'Exactly n−1 edges, and Union-Find finds no cycle.' },
    } },

    { problem: {
      id: 'accounts-merge', title: 'Merge Accounts by Shared Email', diff: 'medium',
      tags: ['union-find', 'grouping'],
      statement: M`
        Each account is «[name, email1, email2, …]». Two accounts belong to the **same person** if they share any email (possibly through a chain of accounts). Accounts with the same name may still belong to different people.

        Merge the accounts. Return each person as «[name, sorted distinct emails…]»; the people may be listed in any order.
      `,
      fn: { name: 'accountsMerge', params: [['List<List<String>>', 'accounts']], ret: 'List<List<String>>' },
      compare: 'unordered',
      tests: [
        { args: [[['John', 'johnsmith@mail.com', 'john_newyork@mail.com'], ['John', 'johnsmith@mail.com', 'john00@mail.com'], ['Mary', 'mary@mail.com'], ['John', 'johnnybravo@mail.com']]], ex: true, expect: [['John', 'john00@mail.com', 'john_newyork@mail.com', 'johnsmith@mail.com'], ['Mary', 'mary@mail.com'], ['John', 'johnnybravo@mail.com']] },
        { args: [[['A', 'a1@x', 'a2@x'], ['A', 'a3@x'], ['A', 'a2@x', 'a3@x']]], ex: true, expect: [['A', 'a1@x', 'a2@x', 'a3@x']], why: 'The third account links the first two.' },
        { args: [[['Z', 'z@z']]], expect: [['Z', 'z@z']] },
        { args: [[['B', 'b@b', 'b@b']]], expect: [['B', 'b@b']], why: 'Duplicate emails inside one account.' },
        { args: [[['Al', 'a@m'], ['Al', 'b@m'], ['Al', 'c@m', 'a@m'], ['Al', 'd@m', 'b@m'], ['Al', 'c@m', 'd@m']]], expect: [['Al', 'a@m', 'b@m', 'c@m', 'd@m']] },
        { args: [accountsBig(600, 175)], big: true },
      ],
      constraints: ['1 ≤ accounts.length ≤ 1000 (large test ≈ 1500)', 'Each account has 1–10 emails'],
      hints: [
        'Emails are the things that link accounts. Think of each email as a node.',
        'Within one account, union every email with the account’s first email. Across accounts, shared emails connect the components automatically.',
        'Then group emails by their root, sort each group, and prepend the owner’s name (remember one name per email).',
      ],
      solution: {
        pattern: '**Union-Find over entities that link records:** union within each record, then group by root.',
        intuition: 'Accounts are connected through shared emails, so connectivity lives on the emails. Unioning all emails of an account makes them one set; a shared email joins sets from different accounts. Each final set is one person.',
        java: J`class Solution {
    private final Map<String, String> parent = new HashMap<>();

    private String find(String x) {
        String p = parent.get(x);
        if (!p.equals(x)) { p = find(p); parent.put(x, p); }    // path compression
        return p;
    }

    public List<List<String>> accountsMerge(List<List<String>> accounts) {
        Map<String, String> owner = new HashMap<>();
        for (List<String> acc : accounts)
            for (int i = 1; i < acc.size(); i++) {
                parent.putIfAbsent(acc.get(i), acc.get(i));
                owner.put(acc.get(i), acc.get(0));
                parent.put(find(acc.get(i)), find(acc.get(1)));   // union with the first email
            }
        Map<String, TreeSet<String>> groups = new HashMap<>();
        for (String email : parent.keySet())
            groups.computeIfAbsent(find(email), k -> new TreeSet<>()).add(email);
        List<List<String>> res = new ArrayList<>();
        for (TreeSet<String> emails : groups.values()) {
            List<String> person = new ArrayList<>();
            person.add(owner.get(emails.first()));
            person.addAll(emails);
            res.add(person);
        }
        return res;
    }
}`,
        time: 'O(E log E)', space: 'O(E)', timeWhy: 'E = total emails; the sorting dominates',
        pitfalls: M`
          - Merging by **name** is wrong: two different Johns stay separate unless they share an email.
          - Duplicate emails within or across accounts must appear only once, which a «TreeSet» handles.
          - Recursive «find» on long chains could go deep. Path compression keeps chains short in practice.
        `,
        alts: [
          { name: 'Graph of emails + DFS', time: 'O(E log E)', space: 'O(E)', note: 'Connect each account’s first email to its other emails, then DFS from each unvisited email to collect a component.',
            java: J`class Solution {
    public List<List<String>> accountsMerge(List<List<String>> accounts) {
        Map<String, List<String>> adj = new HashMap<>();
        Map<String, String> owner = new HashMap<>();
        for (List<String> acc : accounts) {
            String first = acc.get(1);
            for (int i = 1; i < acc.size(); i++) {
                String e = acc.get(i);
                owner.put(e, acc.get(0));
                adj.computeIfAbsent(e, k -> new ArrayList<>());
                adj.computeIfAbsent(first, k -> new ArrayList<>());
                adj.get(first).add(e); adj.get(e).add(first);
            }
        }
        Set<String> seen = new HashSet<>();
        List<List<String>> res = new ArrayList<>();
        for (String s : adj.keySet()) {
            if (!seen.add(s)) continue;
            List<String> comp = new ArrayList<>();
            Deque<String> st = new ArrayDeque<>(); st.push(s);
            while (!st.isEmpty()) { String u = st.pop(); comp.add(u); for (String v : adj.get(u)) if (seen.add(v)) st.push(v); }
            Collections.sort(comp);
            comp.add(0, owner.get(s));
            res.add(comp);
        }
        return res;
    }
}` },
        ],
        talk: 'Emails are the nodes. Union all emails within an account; shared emails then connect accounts automatically. Group emails by root, sort each group, and prepend the owner’s name. Merging by name alone would be wrong.',
      },
      lc: [lc(721, 'accounts-merge', 'Accounts Merge', 'same'), lc(839, 'similar-string-groups', 'Similar String Groups', 'harder'), lc(1202, 'smallest-string-with-swaps', 'Smallest String With Swaps', 'harder')],
      drill: { prompt: 'Merge user accounts that share any email address (possibly transitively).', pattern: 'union-find', why: 'Union-Find over emails, then group by root.' },
    } },
  ],
});
})();

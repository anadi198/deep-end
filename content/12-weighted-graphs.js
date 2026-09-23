(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
// directed weighted edges on nodes base..base+n-1; a random spanning arborescence from `root` (if connect) plus extras
function wEdges(n, extra, lo, hi, seed, base = 0, connect = true) {
  const r = rng(seed); const out = []; const seen = new Set();
  const add = (u, v) => { const k = u + ',' + v; if (u === v || seen.has(k)) return; seen.add(k); out.push([u + base, v + base, lo + Math.floor(r() * (hi - lo + 1))]); };
  if (connect) for (let v = 1; v < n; v++) add(Math.floor(r() * v), v);
  for (let k = 0; k < extra; k++) add(Math.floor(r() * n), Math.floor(r() * n));
  return out;
}
function pts(n, range, seed) { const r = rng(seed); const s = new Set(); const out = []; while (out.length < n) { const x = Math.floor(r() * (2 * range + 1)) - range, y = Math.floor(r() * (2 * range + 1)) - range; if (s.has(x + ',' + y)) continue; s.add(x + ',' + y); out.push([x, y]); } return out; }
function heightGrid(R, C, maxH, seed) { const r = rng(seed); return Array.from({ length: R }, () => Array.from({ length: C }, () => Math.floor(r() * (maxH + 1)))); }
function permGrid(n, seed) { const r = rng(seed); const a = Array.from({ length: n * n }, (_, i) => i); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return Array.from({ length: n }, (_, i) => a.slice(i * n, i * n + n)); }
const PROB = (() => { const r = rng(77); const e = wEdges(2000, 6000, 1, 100, 78, 0, true).map(([u, v]) => [u, v]); return { edges: e, probs: e.map(() => Math.round((0.5 + r() * 0.5) * 1000) / 1000) }; })();

DSA.module({
  id: 'weighted-graphs', title: 'Weighted Graphs: Shortest Paths & MST', short: 'Weighted graphs',
  blurb: 'When edges have costs: Dijkstra with a priority queue, Bellman–Ford for hop limits, Floyd–Warshall for all pairs, and minimum spanning trees.',
  intro: M`
    Once edges carry weights, BFS no longer finds shortest paths: a path with more edges can be cheaper. This module covers the standard toolkit and, just as important, **when to use which**. In interviews, Dijkstra is by far the most common. Know its Java implementation cold, including the stale-entry check.
  `,
  more: [
    lc(1514, 'path-with-maximum-probability', 'Path with Maximum Probability', 'similar'),
    lc(1976, 'number-of-ways-to-arrive-at-destination', 'Number of Ways to Arrive at Destination', 'harder'),
    lc(1368, 'minimum-cost-to-make-at-least-one-valid-path-in-a-grid', 'Minimum Cost to Make at Least One Valid Path in a Grid', 'harder'),
    lc(2290, 'minimum-obstacle-removal-to-reach-corner', 'Minimum Obstacle Removal to Reach Corner', 'harder'),
    lc(1135, 'connecting-cities-with-minimum-cost', 'Connecting Cities With Minimum Cost', 'variant', { premium: true }),
    lc(1168, 'optimize-water-distribution-in-a-village', 'Optimize Water Distribution in a Village', 'harder', { premium: true }),
    lc(1489, 'find-critical-and-pseudo-critical-edges-in-minimum-spanning-tree', 'Find Critical and Pseudo-Critical Edges in Minimum Spanning Tree', 'harder'),
    lc(882, 'reachable-nodes-in-subdivided-graph', 'Reachable Nodes In Subdivided Graph', 'harder'),
    lc(505, 'the-maze-ii', 'The Maze II', 'similar', { premium: true }),
    lc(332, 'reconstruct-itinerary', 'Reconstruct Itinerary', 'harder'),
  ],
  items: [
    { lesson: 'dijkstra', title: 'Shortest paths with weights', mins: 15,
      lede: 'Dijkstra for non-negative weights, 0-1 BFS for 0/1 weights, Bellman–Ford for hop limits or negatives, Floyd–Warshall for all pairs.',
      body: M`
        ## Dijkstra: greedy by distance
        Keep a tentative distance for every node. Repeatedly **settle** the unsettled node with the smallest tentative distance, then **relax** its outgoing edges: «if (dist[u] + w < dist[v]) dist[v] = dist[u] + w».

        @viz dijkstra

        :::key Why settling is safe (the exchange argument)
        When u has the smallest tentative distance d among unsettled nodes, any other route to u must leave the settled region through some unsettled node x with dist[x] ≥ d, then continue with **non-negative** edges, so it costs ≥ d. Hence d is final. This is exactly why Dijkstra **fails with negative edges**: a later negative edge could undercut a settled node.
        :::

        ~~~java Template: Dijkstra with a PriorityQueue (lazy deletion)
        int[] dist = new int[n];
        Arrays.fill(dist, Integer.MAX_VALUE);
        dist[src] = 0;
        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> Integer.compare(a[1], b[1])); // {node, dist}
        pq.offer(new int[]{src, 0});
        while (!pq.isEmpty()) {
            int[] top = pq.poll();
            int u = top[0], d = top[1];
            if (d > dist[u]) continue;                 // stale: u was already settled with a smaller d
            for (int[] e : adj.get(u)) {               // e = {v, w}
                int v = e[0], nd = d + e[1];
                if (nd < dist[v]) { dist[v] = nd; pq.offer(new int[]{v, nd}); }
            }
        }
        ~~~
        Java's «PriorityQueue» has no decrease-key, so push a new entry whenever a distance improves and **skip stale entries** when they're polled. The cost is O((V + E) log V). Use «long» distances when weights × path length can exceed «int».

        ## Variants of the same idea
        - **Minimize the maximum edge on a path** (min effort, swim in rising water): the "distance" of a path is its largest edge; relax with «max(d, w)» instead of «d + w». Dijkstra still works, because the path cost never decreases along a path.
        - **Maximize a product of probabilities:** use a max-heap and relax with «d · p» (all p ≤ 1, so the value never increases along a path).
        - **Stop early:** if you only need dist[target], return when the target is polled.
        - **State graphs:** a node can be (city, stops used) or (cell, obstacles removed). Run Dijkstra or BFS over the states.

        ## 0-1 BFS
        If weights are only 0 or 1, use a **deque**: push 0-weight neighbours to the front and 1-weight neighbours to the back. That's O(V + E), with no heap.

        ## Bellman–Ford: relax every edge, V − 1 times
        After round i, «dist» holds the best paths using **at most i edges**. It handles negative weights, detects negative cycles (a V-th round still improves something), and naturally answers "cheapest with at most k stops". Keep a copy of the previous round's distances so a single round can't chain two new edges.

        @viz bellmanFordK

        ## Floyd–Warshall: all pairs in O(V³)
        ~~~java
        for (int k = 0; k < n; k++)                   // allow k as an intermediate node
            for (int i = 0; i < n; i++)
                for (int j = 0; j < n; j++)
                    if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];   // guard ∞ + ∞ overflow
        ~~~
        Use it for n ≤ ~400, when many pairs are queried, or when transitive closure is needed.

        ## Choosing
        | Situation | Algorithm | Cost |
        |---|---|---|
        | Unweighted (all edges equal) | BFS | O(V + E) |
        | Weights 0 or 1 | 0-1 BFS | O(V + E) |
        | Non-negative weights, one source | Dijkstra | O((V + E) log V) |
        | Negative weights, or "at most k edges" | Bellman–Ford | O(k · E) or O(V · E) |
        | All pairs, small V | Floyd–Warshall | O(V³) |
        | DAG (any weights) | DP in topological order | O(V + E) |

        ## Signals
        - "Minimum cost / time / distance" on a graph with **weights** → Dijkstra.
        - "Within k stops / at most k edges" → Bellman–Ford rounds (or BFS over (node, stops) states).
        - "Minimize the maximum" along a path → Dijkstra with max, or binary search + BFS.
        - "Distance between every pair", "threshold distance for all cities" → Floyd–Warshall.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'Why does the Dijkstra loop contain «if (d > dist[u]) continue;»?',
          options: ['To handle negative edges', 'A node may be in the heap several times with outdated distances; only the entry matching dist[u] should be processed', 'To stop at the target', 'Java requires it'],
          answer: 1, why: 'Each improvement pushes a new entry (there’s no decrease-key), so older entries remain. Skipping stale ones prevents redundant relaxations.' },
        { q: 'Cheapest flight with at most k stops, positive prices. Why can plain Dijkstra on (city) give the wrong answer?',
          options: ['It can’t handle cycles', 'The cheapest route might use too many stops; once a city is settled with that route, a slightly pricier route with fewer stops is discarded', 'Dijkstra needs undirected graphs', 'It’s always correct'],
          answer: 1, why: 'The hop limit makes the state (city, stops) matter. Use Bellman–Ford with k + 1 rounds, or Dijkstra/BFS over (city, stops) states.' },
      ],
      practice: ['network-delay', 'cheapest-flights-k', 'min-effort-path', 'swim-rising-water', 'max-probability-path', 'city-threshold'],
    },

    { problem: {
      id: 'network-delay', title: 'Network Delay Time', diff: 'medium',
      tags: ['Dijkstra'],
      statement: M`
        A network has «n» nodes labelled «1 … n». «times[i] = [u, v, w]» means a signal takes «w» time units to travel from «u» to «v» (directed). A signal is sent from node «k». Return the time until **all** nodes have received it, or «−1» if some node never does.
      `,
      fn: { name: 'networkDelayTime', params: [['int[][]', 'times'], ['int', 'n'], ['int', 'k']], ret: 'int' },
      tests: [
        { args: [[[2, 1, 1], [2, 3, 1], [3, 4, 1]], 4, 2], ex: true, expect: 2 },
        { args: [[[1, 2, 1]], 2, 1], ex: true, expect: 1 },
        { args: [[[1, 2, 1]], 2, 2], ex: true, expect: -1 },
        { args: [[], 1, 1], expect: 0 },
        { args: [[[1, 2, 5], [1, 3, 1], [3, 2, 1]], 3, 1], expect: 2, why: 'The two-hop path 1 → 3 → 2 beats the direct edge.' },
        { args: [[[1, 2, 1], [2, 3, 2], [1, 3, 4]], 3, 1], expect: 3 },
        { args: [[[1, 2, 1], [2, 1, 3]], 2, 2], expect: 3 },
        { args: [wEdges(2000, 8000, 1, 100, 181, 1), 2000, 1], big: true },
        { args: [wEdges(2000, 3000, 1, 100, 182, 1, false), 2000, 1], big: true },
      ],
      constraints: ['1 ≤ k ≤ n ≤ 100 (large tests: 2000)', '1 ≤ times.length ≤ 6000 (large: 10⁴)', '0 ≤ w ≤ 100'],
      hints: [
        'The time for node x to receive the signal is the shortest-path distance from k to x.',
        'Weights are non-negative, so use Dijkstra from k.',
        'The answer is the maximum distance over all nodes, or −1 if any node is unreachable.',
      ],
      solution: {
        pattern: '**Single-source Dijkstra**, then aggregate (max) over the distances.',
        intuition: 'The signal travels every path at once, so each node hears it at its shortest-path distance. All nodes have it once the farthest of them does.',
        java: J`class Solution {
    public int networkDelayTime(int[][] times, int n, int k) {
        List<List<int[]>> adj = new ArrayList<>();
        for (int i = 0; i <= n; i++) adj.add(new ArrayList<>());
        for (int[] t : times) adj.get(t[0]).add(new int[]{t[1], t[2]});

        int[] dist = new int[n + 1];
        Arrays.fill(dist, Integer.MAX_VALUE);
        dist[k] = 0;
        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> Integer.compare(a[1], b[1]));
        pq.offer(new int[]{k, 0});
        while (!pq.isEmpty()) {
            int[] top = pq.poll();
            int u = top[0], d = top[1];
            if (d > dist[u]) continue;
            for (int[] e : adj.get(u)) {
                int nd = d + e[1];
                if (nd < dist[e[0]]) { dist[e[0]] = nd; pq.offer(new int[]{e[0], nd}); }
            }
        }
        int ans = 0;
        for (int i = 1; i <= n; i++) {
            if (dist[i] == Integer.MAX_VALUE) return -1;
            ans = Math.max(ans, dist[i]);
        }
        return ans;
    }
}`,
        time: 'O((V + E) log V)', space: 'O(V + E)',
        pitfalls: M`
          - Nodes are 1-indexed: size the arrays n + 1 and skip index 0 in the final loop.
          - BFS gives wrong answers here: example 5 has a cheaper two-hop path.
        `,
        alts: [
          { name: 'Bellman–Ford', time: 'O(V · E)', space: 'O(V)', note: 'Relax all edges n − 1 times. Simpler, fine for n ≤ 100, and it would also handle negative weights.',
            java: J`class Solution {
    public int networkDelayTime(int[][] times, int n, int k) {
        long[] dist = new long[n + 1];
        Arrays.fill(dist, Long.MAX_VALUE / 2);
        dist[k] = 0;
        for (int i = 1; i < n; i++) {
            boolean changed = false;
            for (int[] t : times) if (dist[t[0]] + t[2] < dist[t[1]]) { dist[t[1]] = dist[t[0]] + t[2]; changed = true; }
            if (!changed) break;
        }
        long ans = 0;
        for (int i = 1; i <= n; i++) { if (dist[i] >= Long.MAX_VALUE / 2) return -1; ans = Math.max(ans, dist[i]); }
        return (int) ans;
    }
}` },
        ],
        talk: 'Each node receives the signal at its shortest-path distance from k, so I run Dijkstra (non-negative weights) with a PQ and lazy deletion. The answer is the max distance, or −1 if any node is unreachable. O((V+E) log V).',
      },
      viz: { id: 'dijkstra' },
      lc: [lc(743, 'network-delay-time', 'Network Delay Time', 'same'), lc(1514, 'path-with-maximum-probability', 'Path with Maximum Probability', 'variant'), lc(1976, 'number-of-ways-to-arrive-at-destination', 'Number of Ways to Arrive at Destination', 'harder')],
      drill: { prompt: 'Signal broadcast from one node over weighted directed links: when has every node received it?', pattern: 'dijkstra', why: 'Single-source shortest paths with non-negative weights (Dijkstra); take the max.' },
    } },

    { problem: {
      id: 'cheapest-flights-k', title: 'Cheapest Flight Within k Stops', diff: 'medium',
      tags: ['Bellman–Ford', 'hop limit'],
      statement: M`
        There are «n» cities («0 … n − 1») and flights «[from, to, price]». Find the cheapest price from «src» to «dst» using **at most «k» stops** (that is, at most k + 1 flights). Return «−1» if there's no such route.
      `,
      fn: { name: 'findCheapestPrice', params: [['int', 'n'], ['int[][]', 'flights'], ['int', 'src'], ['int', 'dst'], ['int', 'k']], ret: 'int' },
      tests: [
        { args: [4, [[0, 1, 100], [1, 2, 100], [2, 0, 100], [1, 3, 600], [2, 3, 200]], 0, 3, 1], ex: true, expect: 700, why: '0 → 1 → 3 (one stop). The cheaper 0 → 1 → 2 → 3 needs two stops.' },
        { args: [3, [[0, 1, 100], [1, 2, 100], [0, 2, 500]], 0, 2, 1], ex: true, expect: 200 },
        { args: [3, [[0, 1, 100], [1, 2, 100], [0, 2, 500]], 0, 2, 0], ex: true, expect: 500 },
        { args: [2, [[0, 1, 5]], 1, 0, 3], expect: -1 },
        { args: [5, [[0, 1, 5], [1, 2, 5], [0, 3, 2], [3, 1, 2], [1, 4, 1], [4, 2, 1]], 0, 2, 2], expect: 7 },
        { args: [4, [[0, 1, 1], [0, 2, 5], [1, 2, 1], [2, 3, 1]], 0, 3, 1], expect: 6, why: 'The cheapest route overall (0 → 1 → 2 → 3, cost 3) has two stops, too many for k = 1.' },
        { args: [3, [[0, 1, 2], [1, 2, 1], [2, 0, 10]], 1, 2, 1], expect: 1 },
        { args: [100, wEdges(100, 1500, 1, 1000, 183), 0, 99, 10], big: true },
      ],
      constraints: ['1 ≤ n ≤ 100', '0 ≤ flights.length ≤ n(n − 1)/2', '1 ≤ price ≤ 10⁴', '0 ≤ k < n'],
      hints: [
        'Dijkstra by price alone fails: the cheapest way into a city may use too many stops.',
        'Bellman–Ford after i rounds knows the cheapest routes using at most i flights. You need k + 1 rounds.',
        'Relax from a **copy** of the previous round’s prices, so one round can’t chain two flights.',
      ],
      solution: {
        pattern: '**Bellman–Ford limited to k + 1 rounds:** round i gives the best cost with at most i edges.',
        intuition: M`
          The hop limit makes a route's number of edges part of the state. Bellman–Ford is organized by edge count: after round i, «cost[v]» is the cheapest price to v using at most i flights, provided each round only extends routes from the *previous* round (hence the snapshot). Run exactly k + 1 rounds.
        `,
        java: J`class Solution {
    public int findCheapestPrice(int n, int[][] flights, int src, int dst, int k) {
        int[] cost = new int[n];
        Arrays.fill(cost, Integer.MAX_VALUE);
        cost[src] = 0;
        for (int round = 0; round <= k; round++) {           // k stops = k + 1 flights
            int[] next = cost.clone();
            for (int[] f : flights) {
                int u = f[0], v = f[1], p = f[2];
                if (cost[u] != Integer.MAX_VALUE && cost[u] + p < next[v]) next[v] = cost[u] + p;
            }
            cost = next;
        }
        return cost[dst] == Integer.MAX_VALUE ? -1 : cost[dst];
    }
}`,
        time: 'O(k · E)', space: 'O(n)',
        pitfalls: M`
          - Relaxing in place (without the «clone»): one round can then chain several flights and silently exceed the stop limit.
          - Adding to «Integer.MAX_VALUE» overflows. Check reachability first.
        `,
        alts: [
          { name: 'Dijkstra / BFS over (city, stops) states', time: 'O(k · E · log(k·n))', space: 'O(k · n)', note: 'Push (cost, city, stops) into a min-heap and never expand beyond k + 1 flights; track the best cost per (city, stops) to prune. Also correct, and it generalizes to other state constraints.',
            java: J`class Solution {
    public int findCheapestPrice(int n, int[][] flights, int src, int dst, int k) {
        List<List<int[]>> adj = new ArrayList<>();
        for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
        for (int[] f : flights) adj.get(f[0]).add(new int[]{f[1], f[2]});
        int[] bestStops = new int[n];
        Arrays.fill(bestStops, Integer.MAX_VALUE);
        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0])); // {cost, city, flights}
        pq.offer(new int[]{0, src, 0});
        while (!pq.isEmpty()) {
            int[] cur = pq.poll();
            int c = cur[0], u = cur[1], used = cur[2];
            if (u == dst) return c;
            if (used > k || used >= bestStops[u]) continue;   // a cheaper state already had fewer or equal flights
            bestStops[u] = used;
            for (int[] e : adj.get(u)) pq.offer(new int[]{c + e[1], e[0], used + 1});
        }
        return -1;
    }
}` },
        ],
        talk: 'The stop limit makes edge count part of the state, so I run Bellman–Ford for k+1 rounds; each round relaxes all flights from a snapshot of the previous round, so round i means at most i flights. O(k·E).',
      },
      viz: { id: 'bellmanFordK' },
      lc: [lc(787, 'cheapest-flights-within-k-stops', 'Cheapest Flights Within K Stops', 'same'), lc(743, 'network-delay-time', 'Network Delay Time', 'similar'), lc(1928, 'minimum-cost-to-reach-destination-in-time', 'Minimum Cost to Reach Destination in Time', 'harder')],
      drill: { prompt: 'Cheapest route between two cities using at most k intermediate stops.', pattern: 'dijkstra', why: 'Weighted shortest path with a hop limit: Bellman–Ford for k+1 rounds (or Dijkstra over (node, stops) states).' },
    } },

    { problem: {
      id: 'min-effort-path', title: 'Path With Minimum Effort', diff: 'medium',
      tags: ['Dijkstra (minimax)', 'grid'],
      statement: M`
        «heights» is a grid of altitudes. You walk from the top-left to the bottom-right cell, moving up, down, left or right. A route's **effort** is the maximum absolute height difference between two consecutive cells on it. Return the minimum effort needed.
      `,
      fn: { name: 'minimumEffortPath', params: [['int[][]', 'heights']], ret: 'int' },
      tests: [
        { args: [[[1, 2, 2], [3, 8, 2], [5, 3, 5]]], ex: true, expect: 2 },
        { args: [[[1, 2, 3], [3, 8, 4], [5, 3, 5]]], ex: true, expect: 1 },
        { args: [[[1, 2, 1, 1, 1], [1, 2, 1, 2, 1], [1, 2, 1, 2, 1], [1, 2, 1, 2, 1], [1, 1, 1, 2, 1]]], ex: true, expect: 0 },
        { args: [[[7]]], expect: 0 },
        { args: [[[1, 10]]], expect: 9 },
        { args: [[[1, 10, 6, 7, 9, 10, 4, 9]]], expect: 9 },
        { args: [heightGrid(100, 100, 1000000, 185)], big: true },
      ],
      constraints: ['1 ≤ rows, cols ≤ 100', '1 ≤ heights[i][j] ≤ 10⁶'],
      hints: [
        'This isn’t a sum of costs; a path costs its single worst step. Does Dijkstra still apply?',
        'Yes: define dist[cell] = the minimum possible maximum-step to reach it, and relax with «max(dist[u], |h[u] − h[v]|)». Path costs never decrease as a path grows.',
        'Alternatively, binary-search the effort limit E and check reachability with BFS using only steps ≤ E.',
      ],
      solution: {
        pattern: '**Dijkstra with a bottleneck (minimax) cost:** replace «+» with «max». It works whenever extending a path never reduces its cost.',
        intuition: 'Dijkstra only needs path costs to be monotone: extending a path can’t make it cheaper. The maximum step along a path has that property, so the greedy settling argument goes through unchanged.',
        java: J`class Solution {
    public int minimumEffortPath(int[][] h) {
        int R = h.length, C = h[0].length;
        int[][] best = new int[R][C];
        for (int[] row : best) Arrays.fill(row, Integer.MAX_VALUE);
        best[0][0] = 0;
        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> Integer.compare(a[2], b[2]));  // {r, c, effort}
        pq.offer(new int[]{0, 0, 0});
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        while (!pq.isEmpty()) {
            int[] cur = pq.poll();
            int r = cur[0], c = cur[1], e = cur[2];
            if (e > best[r][c]) continue;
            if (r == R - 1 && c == C - 1) return e;               // settled target
            for (int[] d : dirs) {
                int nr = r + d[0], nc = c + d[1];
                if (nr < 0 || nc < 0 || nr >= R || nc >= C) continue;
                int ne = Math.max(e, Math.abs(h[nr][nc] - h[r][c]));
                if (ne < best[nr][nc]) { best[nr][nc] = ne; pq.offer(new int[]{nr, nc, ne}); }
            }
        }
        return 0;
    }
}`,
        time: 'O(RC log(RC))', space: 'O(RC)',
        pitfalls: M`
          - Summing the differences solves a different problem.
          - Plain BFS or DFS without a priority queue doesn't find the minimum bottleneck.
        `,
        alts: [
          { name: 'Binary search on effort + BFS', time: 'O(RC log maxH)', space: 'O(RC)', note: 'Feasibility ("can I reach the end using only steps ≤ E?") is monotone in E, the "binary search on the answer" pattern from Module 06.',
            java: J`class Solution {
    public int minimumEffortPath(int[][] h) {
        int lo = 0, hi = 1_000_000;
        while (lo < hi) { int mid = (lo + hi) >>> 1; if (ok(h, mid)) hi = mid; else lo = mid + 1; }
        return lo;
    }
    private boolean ok(int[][] h, int lim) {
        int R = h.length, C = h[0].length;
        boolean[][] seen = new boolean[R][C];
        Deque<int[]> q = new ArrayDeque<>();
        q.offer(new int[]{0, 0}); seen[0][0] = true;
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        while (!q.isEmpty()) {
            int[] p = q.poll();
            if (p[0] == R - 1 && p[1] == C - 1) return true;
            for (int[] d : dirs) {
                int r = p[0] + d[0], c = p[1] + d[1];
                if (r < 0 || c < 0 || r >= R || c >= C || seen[r][c] || Math.abs(h[r][c] - h[p[0]][p[1]]) > lim) continue;
                seen[r][c] = true; q.offer(new int[]{r, c});
            }
        }
        return false;
    }
}` },
          { name: 'Union-Find over sorted edges', time: 'O(RC log(RC))', space: 'O(RC)', note: 'Sort all neighbour edges by difference and union them in order until start and end connect. The last edge added is the answer (a Kruskal-style bottleneck path).', check: false },
        ],
        talk: 'Dijkstra where a path’s cost is its largest step: relax with max(cost, |Δh|) instead of addition, which still works because extending a path never lowers its cost. Return when the target is polled. Binary search on the limit plus BFS also works.',
      },
      lc: [lc(1631, 'path-with-minimum-effort', 'Path With Minimum Effort', 'same'), lc(778, 'swim-in-rising-water', 'Swim in Rising Water', 'variant'), lc(1102, 'path-with-maximum-minimum-value', 'Path With Maximum Minimum Value', 'variant', { premium: true })],
      drill: { prompt: 'Route across a height grid minimizing the largest single-step height difference.', pattern: 'dijkstra', why: 'Minimax path: Dijkstra relaxing with max instead of + (or binary search + BFS).' },
    } },

    { problem: {
      id: 'swim-rising-water', title: 'Swim in Rising Water', diff: 'hard',
      tags: ['Dijkstra (minimax)', 'grid'],
      statement: M`
        «grid» is «n × n», and «grid[r][c]» is the elevation of cell (r, c). All values are distinct and form a permutation of «0 … n² − 1». At time «t» the water level is «t», and you can swim between adjacent cells (4 directions) if both elevations are ≤ «t». Swimming takes no time.

        Return the least time «t» at which you can get from the top-left to the bottom-right cell.
      `,
      fn: { name: 'swimInWater', params: [['int[][]', 'grid']], ret: 'int' },
      tests: [
        { args: [[[0, 2], [1, 3]]], ex: true, expect: 3 },
        { args: [[[0, 1, 2, 3, 4], [24, 23, 22, 21, 5], [12, 13, 14, 15, 16], [11, 17, 18, 19, 20], [10, 9, 8, 7, 6]]], ex: true, expect: 16 },
        { args: [[[0]]], expect: 0 },
        { args: [[[3, 2], [0, 1]]], expect: 3, why: 'You can’t leave the start before its own elevation is covered.' },
        { args: [[[0, 3], [2, 1]]], expect: 2 },
        { args: [permGrid(50, 187)], big: true },
      ],
      constraints: ['1 ≤ n ≤ 50', 'grid is a permutation of 0 … n² − 1'],
      hints: [
        'The time needed for a path is the maximum elevation along it (including the start and end).',
        'So you want the path from corner to corner that minimizes its maximum cell, the same shape as the previous problem, with the cost on cells instead of edges.',
        'Dijkstra with «max», starting at «grid[0][0]». Or binary search on t with BFS, or add cells in increasing order with Union-Find.',
      ],
      solution: {
        pattern: '**Minimax path on cells:** Dijkstra where a path’s cost is the highest cell it visits.',
        intuition: 'You can only move once the water covers every cell on your path, so a path becomes usable at time = its highest cell. Minimizing that maximum is the bottleneck-path problem, and Dijkstra with max handles it.',
        java: J`class Solution {
    public int swimInWater(int[][] grid) {
        int n = grid.length;
        boolean[][] seen = new boolean[n][n];
        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));   // {time, r, c}
        pq.offer(new int[]{grid[0][0], 0, 0});
        seen[0][0] = true;
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        while (true) {
            int[] cur = pq.poll();
            int t = cur[0], r = cur[1], c = cur[2];
            if (r == n - 1 && c == n - 1) return t;
            for (int[] d : dirs) {
                int nr = r + d[0], nc = c + d[1];
                if (nr < 0 || nc < 0 || nr >= n || nc >= n || seen[nr][nc]) continue;
                seen[nr][nc] = true;                 // cell costs are fixed, so the first push is the best one
                pq.offer(new int[]{Math.max(t, grid[nr][nc]), nr, nc});
            }
        }
    }
}`,
        time: 'O(n² log n)', space: 'O(n²)',
        why: 'Here the cost to enter a cell is its own elevation, and a cell’s best time is max(best time of the neighbour it was entered from, its elevation). The PQ pops cells in non-decreasing time, so the first time a cell is pushed via the lowest current frontier gives its optimum. Marking on push is safe for this particular cost.',
        pitfalls: M`
          - Starting the time at 0 instead of «grid[0][0]».
          - Summing elevations, or doing plain BFS by steps.
        `,
        alts: [
          { name: 'Binary search on t + DFS', time: 'O(n² log n²)', space: 'O(n²)', java: J`class Solution {
    public int swimInWater(int[][] g) {
        int n = g.length, lo = g[0][0], hi = n * n - 1;
        while (lo < hi) { int mid = (lo + hi) >>> 1; if (can(g, mid)) hi = mid; else lo = mid + 1; }
        return lo;
    }
    private boolean can(int[][] g, int t) {
        int n = g.length;
        boolean[][] seen = new boolean[n][n];
        Deque<int[]> st = new ArrayDeque<>();
        st.push(new int[]{0, 0}); seen[0][0] = true;
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        while (!st.isEmpty()) {
            int[] p = st.pop();
            if (p[0] == n - 1 && p[1] == n - 1) return true;
            for (int[] d : dirs) {
                int r = p[0] + d[0], c = p[1] + d[1];
                if (r < 0 || c < 0 || r >= n || c >= n || seen[r][c] || g[r][c] > t) continue;
                seen[r][c] = true; st.push(new int[]{r, c});
            }
        }
        return false;
    }
}` },
          { name: 'Union-Find, cells in increasing order', time: 'O(n² α)', space: 'O(n²)', note: 'Because the grid is a permutation, activate cells in order of elevation (index by value), union each with its active neighbours, and stop when the corners connect. That elevation is the answer.', check: false },
        ],
        talk: 'A path is usable at the time equal to its highest cell, so it’s a minimax path: Dijkstra from the start with time max(current, cell elevation), returning when the corner pops. Binary search on t with DFS, or Union-Find in elevation order, work too.',
      },
      lc: [lc(778, 'swim-in-rising-water', 'Swim in Rising Water', 'same'), lc(1631, 'path-with-minimum-effort', 'Path With Minimum Effort', 'easier'), lc(407, 'trapping-rain-water-ii', 'Trapping Rain Water II', 'harder')],
      drill: { prompt: 'Grid of elevations: earliest time t when you can swim corner to corner through cells ≤ t.', pattern: 'dijkstra', why: 'Minimize the maximum cell on a path: Dijkstra with max, binary search + BFS, or Union-Find.' },
    } },

    { problem: {
      id: 'max-probability-path', title: 'Path With Maximum Probability', diff: 'medium',
      tags: ['Dijkstra (max-product)'],
      statement: M`
        An undirected graph has «n» nodes; edge «edges[i] = [a, b]» succeeds with probability «succProb[i]». Find the path from «start» to «end» with the **highest probability of success** (the product of its edge probabilities) and return that probability, or «0» if no path exists. Answers within 10⁻⁵ are accepted.
      `,
      fn: { name: 'maxProbability', params: [['int', 'n'], ['int[][]', 'edges'], ['double[]', 'succProb'], ['int', 'start'], ['int', 'end']], ret: 'double' },
      tests: [
        { args: [3, [[0, 1], [1, 2], [0, 2]], [0.5, 0.5, 0.2], 0, 2], ex: true, expect: 0.25 },
        { args: [3, [[0, 1], [1, 2], [0, 2]], [0.5, 0.5, 0.3], 0, 2], ex: true, expect: 0.3 },
        { args: [3, [[0, 1]], [0.5], 0, 2], ex: true, expect: 0.0 },
        { args: [2, [[0, 1]], [1.0], 1, 0], expect: 1.0 },
        { args: [4, [[0, 1], [1, 3], [0, 2], [2, 3]], [0.9, 0.9, 0.99, 0.8], 0, 3], expect: 0.81 },
        { args: [5, [[1, 4], [2, 4], [0, 4], [0, 3], [0, 2], [2, 3]], [0.37, 0.17, 0.93, 0.23, 0.39, 0.04], 3, 4], expect: 0.2139 },
        { args: [2000, PROB.edges, PROB.probs, 0, 1999], big: true },
      ],
      constraints: ['2 ≤ n ≤ 10⁴', '0 ≤ edges.length ≤ 2·10⁴', '0 ≤ succProb[i] ≤ 1'],
      hints: [
        'Multiplying probabilities (each ≤ 1) can only keep a value the same or shrink it as a path grows. That’s the property Dijkstra needs, mirrored.',
        'Use a **max**-heap on probability and relax with «prob[u] · p».',
        'Alternatively, maximize a product = minimize the sum of «−log p», which is standard Dijkstra.',
      ],
      solution: {
        pattern: '**Dijkstra on a multiplicative cost:** a max-heap, relaxing with ×, valid because factors are ≤ 1.',
        intuition: 'Dijkstra works when path quality only gets worse as the path extends. With probabilities ≤ 1, a product never increases, so the best unsettled node (highest probability) is final when popped, the same argument with the inequality flipped.',
        java: J`class Solution {
    public double maxProbability(int n, int[][] edges, double[] succProb, int start, int end) {
        List<List<double[]>> adj = new ArrayList<>();
        for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
        for (int i = 0; i < edges.length; i++) {
            adj.get(edges[i][0]).add(new double[]{edges[i][1], succProb[i]});
            adj.get(edges[i][1]).add(new double[]{edges[i][0], succProb[i]});
        }
        double[] best = new double[n];
        best[start] = 1.0;
        PriorityQueue<double[]> pq = new PriorityQueue<>((a, b) -> Double.compare(b[1], a[1]));   // max-heap
        pq.offer(new double[]{start, 1.0});
        while (!pq.isEmpty()) {
            double[] cur = pq.poll();
            int u = (int) cur[0];
            double p = cur[1];
            if (p < best[u]) continue;                 // stale
            if (u == end) return p;
            for (double[] e : adj.get(u)) {
                int v = (int) e[0];
                double np = p * e[1];
                if (np > best[v]) { best[v] = np; pq.offer(new double[]{v, np}); }
            }
        }
        return 0.0;
    }
}`,
        time: 'O((V + E) log V)', space: 'O(V + E)',
        pitfalls: M`
          - A min-heap here explores the worst paths first.
          - Comparing doubles for staleness with «<» is fine; exact equality is only needed conceptually.
        `,
        alts: [
          { name: 'Bellman–Ford style relaxation', time: 'O(V · E)', space: 'O(V)', note: 'Repeatedly relax all edges in both directions until nothing improves. Simple but slower.', check: false },
        ],
        talk: 'Probabilities multiply and never increase along a path, so Dijkstra works with a max-heap and relaxation p·w. Return when the end node pops. Equivalently, minimize the sum of −log p.',
      },
      lc: [lc(1514, 'path-with-maximum-probability', 'Path with Maximum Probability', 'same'), lc(743, 'network-delay-time', 'Network Delay Time', 'similar'), lc(1631, 'path-with-minimum-effort', 'Path With Minimum Effort', 'similar')],
      drill: { prompt: 'Most reliable route when each link has a success probability (maximize the product).', pattern: 'dijkstra', why: 'Dijkstra with a max-heap and multiplication (all factors ≤ 1).' },
    } },

    { problem: {
      id: 'city-threshold', title: 'City With the Fewest Reachable Neighbours', diff: 'medium',
      tags: ['Floyd–Warshall', 'all pairs'],
      statement: M`
        There are «n» cities and weighted **undirected** roads «[a, b, w]». For each city, count the other cities reachable with total distance **≤ distanceThreshold**. Return the city with the **smallest** count; on ties, return the one with the **largest** index.
      `,
      fn: { name: 'findTheCity', params: [['int', 'n'], ['int[][]', 'edges'], ['int', 'distanceThreshold']], ret: 'int' },
      tests: [
        { args: [4, [[0, 1, 3], [1, 2, 1], [1, 3, 4], [2, 3, 1]], 4], ex: true, expect: 3 },
        { args: [5, [[0, 1, 2], [0, 4, 8], [1, 2, 3], [1, 4, 2], [2, 3, 1], [3, 4, 1]], 2], ex: true, expect: 0 },
        { args: [2, [[0, 1, 5]], 4], expect: 1, why: 'Neither can reach the other; the tie goes to the larger index.' },
        { args: [3, [[0, 1, 1], [1, 2, 1]], 1], expect: 2 },
        { args: [6, [[0, 1, 10], [0, 2, 1], [2, 3, 1], [1, 3, 1], [1, 4, 1], [4, 5, 10]], 20], expect: 5 },
        { args: [100, wEdges(100, 300, 1, 100, 189).filter((e) => e[0] !== e[1]), 150], big: true },
      ],
      constraints: ['2 ≤ n ≤ 100', '1 ≤ edges.length ≤ n(n − 1)/2', '1 ≤ w, distanceThreshold ≤ 10⁴'],
      hints: [
        'You need shortest distances between **every** pair of cities.',
        'With n ≤ 100, Floyd–Warshall (O(n³) = 10⁶) is the simplest tool.',
        'Then count for each city how many others are within the threshold; iterate cities in increasing order and use «≤» to prefer larger indices on ties.',
      ],
      solution: {
        pattern: '**Floyd–Warshall for all-pairs shortest paths:** three nested loops, with k (the allowed intermediate node) outermost.',
        intuition: 'dist[i][j] allowing intermediates from {0..k} is either the best path not using k, or the best path to k plus the best path from k. Growing k from 0 to n − 1 builds all-pairs distances in O(n³).',
        java: J`class Solution {
    public int findTheCity(int n, int[][] edges, int distanceThreshold) {
        final int INF = 1_000_000_000;
        int[][] d = new int[n][n];
        for (int[] row : d) Arrays.fill(row, INF);
        for (int i = 0; i < n; i++) d[i][i] = 0;
        for (int[] e : edges) { d[e[0]][e[1]] = Math.min(d[e[0]][e[1]], e[2]); d[e[1]][e[0]] = Math.min(d[e[1]][e[0]], e[2]); }
        for (int k = 0; k < n; k++)
            for (int i = 0; i < n; i++)
                for (int j = 0; j < n; j++)
                    if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];   // INF + INF < 2^31
        int best = -1, bestCount = Integer.MAX_VALUE;
        for (int i = 0; i < n; i++) {
            int cnt = 0;
            for (int j = 0; j < n; j++) if (i != j && d[i][j] <= distanceThreshold) cnt++;
            if (cnt <= bestCount) { bestCount = cnt; best = i; }                    // <=: prefer larger index
        }
        return best;
    }
}`,
        time: 'O(n³)', space: 'O(n²)',
        pitfalls: M`
          - Putting the «k» loop inside: it must be outermost.
          - «Integer.MAX_VALUE» as infinity overflows in «d[i][k] + d[k][j]». Use 10⁹ (the sum 2·10⁹ still fits).
          - Tie-breaking: the largest index wins.
        `,
        alts: [
          { name: 'Dijkstra from every city', time: 'O(n · E log n)', space: 'O(n + E)', note: 'Better for sparse graphs with larger n; also stops exploring beyond the threshold.', check: false },
        ],
        talk: 'All pairs are needed and n ≤ 100, so Floyd–Warshall: for each intermediate k, relax every pair i, j through k. Then count the neighbours within the threshold per city, keeping the last city with the minimum count. O(n³).',
      },
      lc: [lc(1334, 'find-the-city-with-the-smallest-number-of-neighbors-at-a-threshold-distance', 'Find the City With the Smallest Number of Neighbors at a Threshold Distance', 'same'), lc(1462, 'course-schedule-iv', 'Course Schedule IV', 'similar'), lc(2976, 'minimum-cost-to-convert-string-i', 'Minimum Cost to Convert String I', 'similar')],
      drill: { prompt: 'For every city, count the others within a distance threshold; n ≤ 100.', pattern: 'dijkstra', why: 'All-pairs shortest paths: Floyd–Warshall (or Dijkstra from each node).' },
    } },

    { lesson: 'mst', title: 'Minimum spanning trees', mins: 8,
      lede: 'Connect every node at minimum total cost. Kruskal sorts the edges and uses Union-Find; Prim grows a tree with a heap.',
      body: M`
        ## The problem
        Given a connected, weighted, undirected graph, choose edges that connect **all** nodes with **minimum total weight**. The result is a tree with V − 1 edges. Classic phrasings: connect all cities, points or houses as cheaply as possible.

        ## Kruskal: cheapest edges first, skip cycles
        @viz kruskal

        ~~~java Template: Kruskal
        Arrays.sort(edges, (a, b) -> Integer.compare(a[2], b[2]));
        DSU dsu = new DSU(n);
        int cost = 0, used = 0;
        for (int[] e : edges)
            if (dsu.union(e[0], e[1])) { cost += e[2]; if (++used == n - 1) break; }
        ~~~
        **Why it's correct (the cut property):** the cheapest edge crossing any cut between two groups of nodes belongs to some MST. Kruskal only ever adds the cheapest edge joining two components, which is such an edge.

        ## Prim: grow one tree with a min-heap
        Start from any node. Repeatedly add the cheapest edge leaving the tree. For **dense** graphs (complete graphs of points), use the O(V²) array version: keep «minDist[v]» (the cheapest edge from the tree to v) and scan for the minimum each step, with no heap and no edge list.
        ~~~java Template: Prim, O(V²), for dense graphs
        int[] minDist = new int[n]; Arrays.fill(minDist, Integer.MAX_VALUE); minDist[0] = 0;
        boolean[] inTree = new boolean[n];
        int cost = 0;
        for (int it = 0; it < n; it++) {
            int u = -1;
            for (int v = 0; v < n; v++) if (!inTree[v] && (u == -1 || minDist[v] < minDist[u])) u = v;
            inTree[u] = true; cost += minDist[u];
            for (int v = 0; v < n; v++) if (!inTree[v]) minDist[v] = Math.min(minDist[v], weight(u, v));
        }
        ~~~

        | | Kruskal | Prim (heap) | Prim (array) |
        |---|---|---|---|
        | Cost | O(E log E) | O(E log V) | O(V²) |
        | Best for | sparse edge lists | adjacency lists | dense / complete graphs |

        ## Signals
        - "Connect all nodes / cities / points with minimum total cost."
        - "Minimum cost to make the network connected."
        - Edges given as a list with weights, and the answer is a set of edges forming a tree.
        - Don't confuse it with shortest paths: an MST minimizes the **total** edge weight, not the distance between two particular nodes.

        @quiz 0
      `,
      quiz: [
        { q: 'For 1000 points where every pair is connected (cost = Manhattan distance), which MST algorithm is best?',
          options: ['Kruskal: sort all ~500,000 edges', 'Prim with the O(V²) array version: about 10⁶ steps and no edge list', 'Dijkstra', 'Floyd–Warshall'],
          answer: 1, why: 'The graph is complete (E ≈ V²/2). Array Prim does O(V²) work, computing weights on the fly, with no sorting and no memory for edges.' },
      ],
      practice: ['min-cost-connect-points'],
    },

    { problem: {
      id: 'min-cost-connect-points', title: 'Connect All Points Cheaply', diff: 'medium',
      tags: ['MST', 'Prim', 'Kruskal'],
      statement: M`
        Given points on a 2-D plane, the cost to connect two points is their **Manhattan distance**, «|x1 − x2| + |y1 − y2|». Return the minimum total cost to connect all points so that there's a path between every pair.
      `,
      fn: { name: 'minCostConnectPoints', params: [['int[][]', 'points']], ret: 'int' },
      tests: [
        { args: [[[0, 0], [2, 2], [3, 10], [5, 2], [7, 0]]], ex: true, expect: 20 },
        { args: [[[3, 12], [-2, 5], [-4, 1]]], ex: true, expect: 18 },
        { args: [[[0, 0]]], expect: 0 },
        { args: [[[0, 0], [1, 1], [1, 0], [-1, 1]]], expect: 4 },
        { args: [[[-1000000, -1000000], [1000000, 1000000]]], expect: 4000000 },
        { args: [[[2, -3], [-17, -8], [13, 8], [-17, -15]]], expect: 53 },
        { args: [pts(1000, 1000000, 191)], big: true },
      ],
      constraints: ['1 ≤ points.length ≤ 1000', '−10⁶ ≤ x, y ≤ 10⁶', 'Points are distinct'],
      hints: [
        'Every pair of points could be connected: it’s a complete graph, and you want its minimum spanning tree.',
        'Kruskal needs all ~n²/2 edges sorted, O(n² log n). Prim on a dense graph can be O(n²) with no heap.',
        'Keep «minDist[v]» = the cheapest connection from the current tree to v; each round, add the closest outside point and update the others.',
      ],
      solution: {
        pattern: '**MST on a complete graph:** array-based Prim, O(n²) time and O(n) memory, with weights computed on the fly.',
        intuition: 'Prim grows one tree, always attaching the outside point with the cheapest connection. Tracking each outside point’s best connection in an array, and scanning it, costs O(n) per step, which beats a heap when there are n² edges.',
        java: J`class Solution {
    public int minCostConnectPoints(int[][] points) {
        int n = points.length;
        int[] minDist = new int[n];
        Arrays.fill(minDist, Integer.MAX_VALUE);
        minDist[0] = 0;
        boolean[] inTree = new boolean[n];
        int cost = 0;
        for (int it = 0; it < n; it++) {
            int u = -1;
            for (int v = 0; v < n; v++)
                if (!inTree[v] && (u == -1 || minDist[v] < minDist[u])) u = v;   // closest outside point
            inTree[u] = true;
            cost += minDist[u];
            for (int v = 0; v < n; v++) {
                if (inTree[v]) continue;
                int d = Math.abs(points[u][0] - points[v][0]) + Math.abs(points[u][1] - points[v][1]);
                if (d < minDist[v]) minDist[v] = d;
            }
        }
        return cost;
    }
}`,
        time: 'O(n²)', space: 'O(n)',
        pitfalls: M`
          - Building and sorting all n² edges for Kruskal works (≈ 500k edges), but uses much more memory and time.
          - Total cost: up to 999 edges × 4·10⁶ ≈ 4·10⁹ would overflow an «int» in a worst-case layout. LeetCode's answers fit, but mention «long».
        `,
        alts: [
          { name: 'Kruskal over all pairs', time: 'O(n² log n)', space: 'O(n²)', java: J`class Solution {
    public int minCostConnectPoints(int[][] p) {
        int n = p.length;
        List<int[]> edges = new ArrayList<>();
        for (int i = 0; i < n; i++) for (int j = i + 1; j < n; j++) edges.add(new int[]{Math.abs(p[i][0] - p[j][0]) + Math.abs(p[i][1] - p[j][1]), i, j});
        edges.sort((a, b) -> Integer.compare(a[0], b[0]));
        int[] parent = new int[n];
        for (int i = 0; i < n; i++) parent[i] = i;
        int cost = 0, used = 0;
        for (int[] e : edges) {
            int a = find(parent, e[1]), b = find(parent, e[2]);
            if (a == b) continue;
            parent[a] = b; cost += e[0];
            if (++used == n - 1) break;
        }
        return cost;
    }
    private int find(int[] p, int x) { while (p[x] != x) { p[x] = p[p[x]]; x = p[x]; } return x; }
}` },
          { name: 'Prim with a heap', time: 'O(n² log n)', space: 'O(n²)', note: 'The heap version is standard for sparse graphs, but here it pushes O(n²) entries.', check: false },
        ],
        talk: 'It’s the MST of the complete graph under Manhattan distance. The graph is dense, so I use array Prim: keep each outside point’s cheapest link to the tree, add the closest one, and update the rest. O(n²) time, O(n) memory.',
      },
      viz: { id: 'kruskal' },
      lc: [lc(1584, 'min-cost-to-connect-all-points', 'Min Cost to Connect All Points', 'same'), lc(1135, 'connecting-cities-with-minimum-cost', 'Connecting Cities With Minimum Cost', 'variant', { premium: true }), lc(1168, 'optimize-water-distribution-in-a-village', 'Optimize Water Distribution in a Village', 'harder', { premium: true }), lc(1489, 'find-critical-and-pseudo-critical-edges-in-minimum-spanning-tree', 'Find Critical and Pseudo-Critical Edges in Minimum Spanning Tree', 'harder')],
      drill: { prompt: 'Minimum total wiring cost to connect all points (Manhattan distance between any two).', pattern: 'mst', why: 'A minimum spanning tree of the complete graph (Prim O(n²) or Kruskal).' },
    } },
  ],
});
})();

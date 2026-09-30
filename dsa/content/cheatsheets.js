/* Cheat sheets and flowcharts.
 * DSA.flows[id] = { title, w, h, nodes, edges }   (rendered by extras.js; nodes are centred at x/y)
 * DSA.cheats = [{ id, title, kind, blurb, lede, body, quiz }]
 * DSA.finderNotes = Markdown shown under the pattern finder chart. */
(() => {
const J = String.raw, M = String.raw;

/* ───────────── Layout helper ─────────────
 * A vertical chain of yes/no questions at column x: "yes" goes right to a leaf, "no" goes down to the
 * next question, and the last "no" ends in a leaf under the column. Returns the first question's id. */
function chain(flow, { prefix, x, y, pitch = 100, dx = 180, qw = 140, qh = 76, lw = 150, lh = 44 }, steps, end) {
  steps.forEach((s, i) => {
    const q = prefix + i, leaf = prefix + 'L' + i, yy = y + i * pitch;
    flow.nodes[q] = { t: 'q', label: s.q, help: s.help, x, y: yy, w: qw, h: s.qh || qh };
    flow.nodes[leaf] = { t: 'leaf', label: s.leaf, info: s.info, x: x + dx, y: yy, w: s.lw || lw, h: s.lh || lh };
    flow.edges.push([q, leaf, s.yes || 'yes']);
    flow.edges.push([q, i + 1 < steps.length ? prefix + (i + 1) : prefix + 'E', s.no || 'no']);
  });
  flow.nodes[prefix + 'E'] = { t: 'leaf', label: end.leaf, info: end.info, x, y: y + steps.length * pitch, w: end.lw || lw, h: end.lh || lh };
  return prefix + '0';
}

/* ───────────── Pattern leaves (built from DSA.patterns + the problems that use them) ───────────── */
const P = DSA.patterns || {};
const probsFor = (keys, n = 4) => {
  const out = [];
  for (const m of DSA.modules) for (const it of m.items) {
    const p = it.problem;
    if (p && p.drill && keys.includes(p.drill.pattern) && out.length < n) out.push(`[${p.title}](#/p/${p.id})`);
  }
  return out.join(' · ');
};
const lessonTitle = (id) => { for (const m of DSA.modules) for (const it of m.items) if (it.lesson === id) return it.title; return 'Lesson'; };
function patInfo(keys, extra) {
  keys = [].concat(keys);
  const p = P[keys[0]] || {};
  const lessons = [...new Set(keys.map((k) => P[k] && P[k].lesson).filter(Boolean))];
  return M`
    ${p.signal ? '**Signal:** ' + p.signal : ''}

    ${extra || ''}

    ${lessons.map((l) => `[${lessonTitle(l)} →](#/l/${l})`).join(' · ')}${probsFor(keys) ? ' · Practice: ' + probsFor(keys) : ''}
  `;
}

DSA.flows = DSA.flows || {};

/* ═══════════════ 1. Which Java collection? ═══════════════ */
{
  const f = { title: 'Which Java collection?', w: 1020, h: 830, nodes: {}, edges: [] };
  f.nodes.start = { t: 'start', label: 'Start', x: 414, y: 34 };
  f.nodes.root = { t: 'q', label: 'What will you store', help: 'Pick the closest: lookups by key, a set of distinct values, or items you process in some order.', x: 414, y: 130, w: 170, h: 84 };
  f.edges.push(['start', 'root']);

  const A = chain(f, { prefix: 'A', x: 74, y: 290, dx: 176 }, [
    { q: 'Keys are small ints or chars', help: 'Letters («c − \'a\'»), ids 0..n−1, values up to about 10⁶.', leaf: 'int[] indexed by key',
      info: M`
        ~~~java
        int[] count = new int[26];
        for (char c : s.toCharArray()) count[c - 'a']++;
        ~~~
        O(1) with no hashing or boxing, often 5–10× faster than a HashMap. Use «boolean[]» for presence, «int[128]» for ASCII, and «EnumMap» when the keys are an enum.

        Practice: [Valid Anagram](#/p/valid-anagram) · [Permutation in String](#/p/permutation-in-string) · [Minimum Window Substring](#/p/min-window-substring)
      ` },
    { q: 'Need keys in sorted order', help: 'Smallest or largest key, floor / ceiling, range queries, or iterating in key order.', leaf: 'TreeMap<K, V>',
      info: M`
        A **red-black tree**: «get / put / remove / containsKey» are O(log n).

        | Method | Returns |
        |---|---|
        | «firstKey()», «lastKey()» | smallest / largest key |
        | «floorKey(k)», «ceilingKey(k)» | largest ≤ k / smallest ≥ k (or null) |
        | «lowerKey(k)», «higherKey(k)» | strictly < k / > k |
        | «headMap(k)», «tailMap(k)», «subMap(a, b)» | live views of a key range |
        | «pollFirstEntry()» | removes and returns the smallest entry |

        Several values per key: «TreeMap<K, List<V>>». Counts (a sorted multiset): «TreeMap<K, Integer>».

        [How it works →](#/l/treemap-internals) · Practice: [My Calendar](#/p/my-calendar) · [Time-Based Key-Value Store](#/p/time-map) · [Hand of Straights](#/p/hand-of-straights)
      ` },
    { q: 'Need insertion or access order', help: 'Iterate in the order keys were added, or evict the least recently used entry.', leaf: 'LinkedHashMap<K, V>',
      info: M`
        A HashMap whose entries are also threaded on a **doubly linked list**: O(1) operations with predictable iteration order.

        ~~~java
        // LRU cache in six lines: access order + eviction hook
        Map<Integer, Integer> lru = new LinkedHashMap<>(16, 0.75f, true) {
            protected boolean removeEldestEntry(Map.Entry<Integer, Integer> e) { return size() > capacity; }
        };
        ~~~
        In an interview, expect to be asked to build the list yourself as well.

        [How it works →](#/l/linkedhashmap-lru) · Practice: [LRU Cache](#/p/lru-cache)
      ` },
    { q: 'Several values per key', help: 'Grouping: anagram buckets, adjacency lists, positions of each value.', leaf: 'HashMap<K, List<V>>', lw: 160,
      info: M`
        ~~~java
        Map<String, List<String>> groups = new HashMap<>();
        groups.computeIfAbsent(key, k -> new ArrayList<>()).add(word);
        ~~~
        «computeIfAbsent» creates the list only on the first use, so there's no containsKey dance. The same idiom builds graph adjacency lists.

        Practice: [Group Anagrams](#/p/group-anagrams) · [Accounts Merge](#/p/accounts-merge) · [Course Schedule](#/p/course-schedule)
      ` },
  ], { leaf: 'HashMap<K, V>',
    info: M`
      A **hash table**: an array of buckets (power-of-two size, resized ×2 past a load factor of 0.75); long collision chains become red-black trees. «get / put / remove / containsKey» are O(1) on average.

      ~~~java
      map.merge(x, 1, Integer::sum);          // count
      int c = map.getOrDefault(x, 0);
      for (Map.Entry<K, V> e : map.entrySet()) { e.getKey(); e.getValue(); }
      ~~~
      Keys need consistent «equals» and «hashCode»: String, Integer, List, record all work. **Arrays don't** (identity hash). Never mutate a key after inserting it. Iteration order is unspecified.

      [How it works →](#/l/hashmap-internals) · Practice: [Two Sum](#/p/two-sum) · [Subarray Sum Equals K](#/p/subarray-sum-k)
    ` });

  const B = chain(f, { prefix: 'B', x: 414, y: 290, dx: 176 }, [
    { q: 'Values are small ints', help: 'A dense range such as 0..n or 0..10⁶.', leaf: 'boolean[] or BitSet',
      info: M`
        «boolean[]» uses a byte per value; «BitSet» uses one bit and adds «nextSetBit», «cardinality», «and/or/xor». For up to 64 values a single «long» mask is enough: «mask |= 1L << v».

        Practice: [First Missing Positive](#/p/first-missing-positive) · [Missing Number](#/p/missing-number)
      ` },
    { q: 'Duplicates allowed', help: 'You need to know how many copies of each value are present (a multiset).', leaf: 'Map<E, Integer> counts', lw: 160,
      info: M`
        Java has no multiset, so use a count map: «HashMap» when order doesn't matter, «TreeMap» when you need min / max / floor.

        ~~~java
        TreeMap<Integer, Integer> bag = new TreeMap<>();
        bag.merge(x, 1, Integer::sum);                              // add one copy
        if (bag.merge(x, -1, Integer::sum) == 0) bag.remove(x);     // remove one copy
        int smallest = bag.firstKey();
        ~~~

        Practice: [Hand of Straights](#/p/hand-of-straights) · [Top K Frequent Elements](#/p/top-k-frequent)
      ` },
    { q: 'Need sorted order', help: 'Min / max, floor / ceiling, next larger value, iterate sorted.', leaf: 'TreeSet<E>',
      info: M`
        A TreeMap without values: O(log n) «add / remove / contains», plus «first», «last», «floor», «ceiling», «higher», «lower», «pollFirst», «headSet / tailSet / subSet».

        No duplicates: to allow them, store «(value, index)» pairs with a tie-breaking comparator, or use a count map.

        [How it works →](#/l/treemap-internals) · Practice: [Contains Duplicate Within K](#/p/contains-nearby-duplicate) · [My Calendar](#/p/my-calendar)
      ` },
    { q: 'Keep insertion order', help: 'Iterate distinct values in the order they first appeared.', leaf: 'LinkedHashSet<E>',
      info: M`
        HashSet + a linked list through the entries: O(1) operations, iteration in insertion order. Handy for "deduplicate but keep order".

        ~~~java
        List<Integer> unique = new ArrayList<>(new LinkedHashSet<>(list));
        ~~~
      ` },
  ], { leaf: 'HashSet<E>',
    info: M`
      A HashMap with dummy values: O(1) average «add / remove / contains».

      ~~~java
      Set<Integer> seen = new HashSet<>();
      if (!seen.add(x)) { /* x was already present */ }
      ~~~
      «add» returning false is the cleanest duplicate check. The same «equals / hashCode» rules as HashMap keys apply.

      Practice: [Longest Consecutive Sequence](#/p/longest-consecutive) · [Longest Substring Without Repeating](#/p/longest-no-repeat)
    ` });

  const C = chain(f, { prefix: 'C', x: 754, y: 290, dx: 176 }, [
    { q: 'Newest item out first', help: 'LIFO: matching brackets, undo, DFS, monotonic stack.', leaf: 'ArrayDeque (stack)',
      info: M`
        ~~~java
        Deque<Integer> st = new ArrayDeque<>();
        st.push(x); st.peek(); st.pop(); st.isEmpty();
        ~~~
        A circular array: O(1) amortized. **Don't use «java.util.Stack»**: it extends Vector (synchronized, legacy). No null elements.

        [Lesson →](#/l/stacks) · Practice: [Valid Parentheses](#/p/valid-parentheses) · [Daily Temperatures](#/p/daily-temperatures)
      ` },
    { q: 'Oldest item out first', help: 'FIFO: BFS, task queues, level-order traversal.', leaf: 'ArrayDeque (queue)',
      info: M`
        ~~~java
        Queue<int[]> q = new ArrayDeque<>();
        q.offer(new int[]{r, c}); int[] cur = q.poll(); q.peek();
        ~~~
        «LinkedList» also implements Queue but allocates a node per element. ArrayDeque is faster and uses less memory.

        [Lesson →](#/l/graph-basics) · Practice: [Rotting Oranges](#/p/rotting-oranges) · [Level Order Traversal](#/p/level-order)
      ` },
    { q: 'Smallest or largest out first', help: 'Best-first: top-k, Dijkstra, merge k sorted lists, scheduling.', leaf: 'PriorityQueue<E>',
      info: M`
        A **binary heap** in an array: «offer / poll» O(log n), «peek» O(1), «remove(obj)» and «contains» O(n). Min-heap by default.

        ~~~java
        PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Comparator.reverseOrder());
        PriorityQueue<int[]> byDist = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));
        ~~~
        Iterating a PriorityQueue is **not** in sorted order. To update or delete arbitrary items, use a TreeSet (with a tie-breaker) or lazy deletion.

        [How it works →](#/l/deque-heap-internals) · Practice: [Kth Largest Element](#/p/kth-largest-array) · [Network Delay Time](#/p/network-delay)
      ` },
    { q: 'Add or remove at both ends', help: 'Sliding-window maximum, palindrome checks, 0-1 BFS.', leaf: 'ArrayDeque (deque)',
      info: M`
        ~~~java
        Deque<Integer> dq = new ArrayDeque<>();
        dq.offerLast(i); dq.pollFirst(); dq.peekLast(); dq.pollLast();
        ~~~
        All ends O(1). The monotonic deque (keep indices with decreasing values) gives the sliding-window max in O(n).

        [How it works →](#/l/deque-heap-internals) · Practice: [Sliding Window Maximum](#/p/sliding-window-max) · [Design Circular Deque](#/p/circular-deque)
      ` },
    { q: 'Many inserts in the middle', help: 'Through an iterator you already hold, never by index.', leaf: 'LinkedList (rarely)',
      info: M`
        O(1) insert or remove **at an iterator's position**, but O(n) «get(i)», about 24 extra bytes per node, and poor cache locality. It's rarely the right choice. When an interview needs O(1) unlinking (LRU cache), you write your own node class with a HashMap pointing at nodes.

        [Lesson →](#/l/linkedhashmap-lru)
      ` },
  ], { leaf: 'ArrayList<E> or array',
    info: M`
      A resizable «Object[]» that grows 1.5× when full: «get / set» O(1), «add» at the end amortized O(1), «add(i, x) / remove(i)» O(n) (shifting).

      Prefer a plain «int[]» when the size is known: no boxing, less memory. Watch out: «list.remove(i)» with an int removes **by index**. Use «list.remove(Integer.valueOf(x))» to remove a value.

      [How it works →](#/l/arraylist-internals)
    ` });

  f.edges.push(['root', A, 'key → value', [[74, 130]]]);
  f.edges.push(['root', B, 'unique values']);
  f.edges.push(['root', C, 'a work list', [[754, 130]]]);
  DSA.flows['java-collections'] = f;
}

/* ═══════════════ 2. Which pattern? (the finder page) ═══════════════ */
{
  const f = { title: 'Which pattern?', w: 1150, h: 1200, nodes: {}, edges: [] };
  const col = { dx: 150, qw: 136, qh: 78, lw: 116, lh: 44 };
  f.nodes.start = { t: 'start', label: 'Start', x: 650, y: 30 };
  f.nodes.root = { t: 'q', label: 'What does the input look like', help: 'Choose the closest description. A grid of cells counts as a graph.', x: 650, y: 122, w: 160, h: 84 };
  f.edges.push(['start', 'root']);

  // Trees vs graphs
  f.nodes.QT = { t: 'q', label: 'It is a tree', help: 'Rooted, no cycles, every node has one parent (binary trees, BSTs, N-ary trees).', x: 74, y: 262, w: 136, h: 70 };
  const T = chain(f, { prefix: 'T', x: 74, y: 372, ...col }, [
    { q: 'Level by level or nearest root', help: 'Per-level results, right side view, minimum depth, zigzag.', leaf: 'Tree BFS', info: patInfo('tree-bfs', M`Queue of nodes; process «q.size()» nodes per level.`) },
    { q: 'Sorted order matters (BST)', help: 'Search, validate, kth smallest, range queries on a binary search tree.', leaf: 'BST property', info: patInfo('bst', M`In-order traversal visits values in sorted order; go left or right using the value.`) },
  ], { leaf: 'Tree DFS', info: patInfo('tree-dfs', M`Recursion: decide what each call returns (post-order: height, diameter, balance) or what it receives (pre-order: path so far, bounds).`) });
  const G = chain(f, { prefix: 'G', x: 362, y: 262, ...col }, [
    { q: 'Fewest steps, equal costs', help: 'Shortest path in a maze or grid, word ladder, minimum moves.', leaf: 'BFS', info: patInfo('bfs-shortest', M`BFS visits nodes in order of distance, so the first time you reach the target is optimal. Multi-source: seed the queue with every start.`) },
    { q: 'Shortest path with weights', help: 'Costs, times or probabilities on the edges.', leaf: 'Dijkstra', info: patInfo('dijkstra', M`Min-heap of (distance, node); skip stale entries. Negative edges or a limit on the number of edges → Bellman-Ford.`) },
    { q: 'Order tasks with prerequisites', help: 'Course schedules, build order, detecting a cycle in a directed graph.', leaf: 'Topological sort', info: patInfo('topo-sort', M`Kahn: queue the nodes with in-degree 0; if you can’t output every node, there’s a cycle.`) },
    { q: 'Connect all at minimum cost', help: 'Cheapest set of edges that joins all nodes.', leaf: 'MST', info: patInfo('mst', M`Kruskal: sort edges, add each one that joins two components (union-find). Prim: grow from a node with a heap.`) },
    { q: 'Groups merge as edges arrive', help: 'Connectivity queries, redundant edges, grouping equivalent items.', leaf: 'Union-Find', info: patInfo('union-find', M`«find» with path compression + «union» by size: nearly O(1) per operation.`) },
  ], { leaf: 'DFS / BFS traversal', lh: 46, info: patInfo('graph-traversal', M`Visit every reachable node once with a visited set: islands, components, flood fill, cycle detection.`) });
  f.edges.push(['QT', T, 'yes']);
  f.edges.push(['QT', G, 'no: a graph']);

  // Arrays and strings
  const C = chain(f, { prefix: 'C', x: 650, y: 262, ...col }, [
    { q: 'List every subset or ordering', help: '“Return all combinations / permutations / subsets”, and n is small (≤ 20 or so).', leaf: 'Backtracking', info: patInfo('backtracking', M`choose → recurse → un-choose. Prune early; sort first to skip duplicates.`) },
    { q: 'Optimal value or count of ways', help: 'Min cost, max profit, number of ways, where earlier choices affect later ones (a greedy choice has a counterexample).', leaf: 'Dynamic programming', lh: 46, info: patInfo(['dp-1d', 'dp-2d', 'knapsack'], M`Name the state in words, write the transition from smaller states, set base cases, pick the fill order.`) },
    { q: 'Sorted, or monotone yes/no answer', help: '“Minimum capacity such that …”, “find in a rotated array”, O(log n) required.', leaf: 'Binary search', info: patInfo(['binary-search', 'bs-answer'], M`On an index: lower bound. On the answer: binary search the smallest value where «feasible(x)» becomes true.`) },
    { q: 'Longest/shortest contiguous window', help: 'Substring or subarray satisfying a condition that grows or shrinks monotonically.', leaf: 'Sliding window', info: patInfo('sliding-window', M`Expand the right end; while the window is invalid, shrink from the left; record the best.`) },
    { q: 'Subarray sums or range sums', help: 'Sum equals k (negatives allowed), many range-sum queries, balanced counts.', leaf: 'Prefix sums', info: patInfo('prefix-sum', M`sum(i..j) = P[j+1] − P[i]. Count earlier prefixes in a hash map: «count += seen.get(P − k)».`) },
    { q: 'Pairs or partitions, sorted array', help: 'Pair or triplet sums, in-place dedupe, partition, reverse, palindromes.', leaf: 'Two pointers', info: patInfo('two-pointers', M`Opposite ends moving inward (sorted pair sum), or a read/write pair moving forward (in-place compaction).`) },
    { q: 'Top k, kth, or repeated min/max', help: 'k largest, k closest, merge k sorted, running median, scheduling.', leaf: 'Heap', info: patInfo(['heap-topk', 'two-heaps', 'kway-merge'], M`Keep a size-k min-heap for the k largest. Two heaps for a running median.`) },
    { q: 'Next greater/smaller or nesting', help: 'Previous/next greater element, histogram areas, parsing, undo.', leaf: 'Monotonic stack', lh: 46, info: patInfo(['mono-stack', 'stack'], M`Keep indices whose values are monotone. Each pop answers “next greater” for the popped index.`) },
    { q: 'A locally best step is safe', help: 'Reach, jumps, fuel, scheduling. You can argue by exchange.', leaf: 'Greedy', info: patInfo('greedy', M`Make the best local choice; justify it with an exchange argument or “stays ahead”. Try a counterexample first.`) },
  ], { leaf: 'Hash map / counting', lh: 46, info: patInfo(['hash-lookup', 'counting'], M`Trade space for time: remember what you have seen (complements, counts, first index) for O(1) lookups.`) });

  // Other structures
  const E = chain(f, { prefix: 'E', x: 938, y: 262, ...col }, [
    { q: 'A linked list', help: 'Reverse, merge, find the middle, detect a cycle, reorder.', leaf: 'Fast & slow pointers', lh: 46, info: patInfo(['fast-slow', 'linked-list'], M`A dummy head avoids special cases; fast/slow pointers find the middle or a cycle.`) },
    { q: 'Ranges [start, end]', help: 'Merge, insert, overlaps, meeting rooms, arrows.', leaf: 'Intervals', info: patInfo('intervals', M`Sort by start to merge; sort by end to keep the most non-overlapping; a heap of ends counts rooms.`) },
    { q: 'Prefix queries on many words', help: 'Autocomplete, starts-with, many words searched in a grid.', leaf: 'Trie', info: patInfo('trie', M`A node per prefix with 26 children and an end flag.`) },
    { q: 'Design a class, fast operations', help: 'LRU cache, min stack, time-keyed store.', leaf: 'Map + linked list', lh: 46, info: patInfo('design', M`Combine structures so every operation is O(1) or O(log n): a hash map for lookup, a list or heap for order.`) },
  ], { leaf: 'Bits & math tricks', lh: 46, info: patInfo(['bits', 'matrix'], M`XOR cancels pairs, «n & (n − 1)» drops a bit; matrices: transpose + reverse, four walls for spirals.`) });

  f.edges.push(['root', 'QT', 'tree / graph / grid', [[74, 122]]]);
  f.edges.push(['root', C, 'array / string']);
  f.edges.push(['root', E, 'other inputs', [[938, 122]]]);
  DSA.flows.patterns = f;
}

/* ═══════════════ 3. Graph algorithm chooser ═══════════════ */
{
  const f = { title: 'Which graph algorithm?', w: 900, h: 780, nodes: {}, edges: [] };
  f.nodes.start = { t: 'start', label: 'Start', x: 335, y: 34 };
  f.nodes.root = { t: 'q', label: 'Edges have weights', help: 'Costs, times, distances or probabilities on the edges (a plain grid is unweighted).', x: 335, y: 126, w: 150, h: 80 };
  f.edges.push(['start', 'root']);
  const U = chain(f, { prefix: 'U', x: 110, y: 270, dx: 185, lw: 160 }, [
    { q: 'Need the fewest steps', help: 'Shortest path when every edge counts as 1.', leaf: 'BFS', info: M`
        O(V + E). The first time BFS reaches a node is along a shortest path. For a grid, the neighbours are the four directions; multi-source BFS seeds the queue with every source.

        [Lesson →](#/l/graph-basics) · [Word Ladder](#/p/word-ladder) · [Shortest Path in Binary Matrix](#/p/shortest-path-binary-matrix) · [Rotting Oranges](#/p/rotting-oranges)
      ` },
    { q: 'Directed, with dependencies', help: 'An order that respects prerequisites, or whether a cycle exists.', leaf: 'Topological sort', info: M`
        O(V + E). Kahn’s algorithm: repeatedly remove nodes with in-degree 0. Fewer than V removed means a cycle. DFS alternative: post-order, reversed; a back edge (gray node) means a cycle.

        [Lesson →](#/l/topological-sort) · [Course Schedule II](#/p/course-schedule-ii) · [Alien Dictionary](#/p/alien-order)
      ` },
    { q: 'Edges arrive and groups merge', help: 'Connectivity queries interleaved with unions; the first edge that makes a cycle.', leaf: 'Union-Find', info: M`
        Near O(1) amortized per operation with path compression and union by size. It can’t delete edges; process them offline in reverse if needed.

        [Lesson →](#/l/union-find) · [Redundant Connection](#/p/redundant-connection) · [Accounts Merge](#/p/accounts-merge)
      ` },
  ], { leaf: 'DFS / BFS traversal', lw: 160, info: M`
      O(V + E). Components, flood fill, reachability, bipartite checks (2-coloring), cycle detection in undirected graphs (a visited neighbour that isn’t the parent).

      [Lesson →](#/l/graph-basics) · [Number of Islands](#/p/number-of-islands) · [Pacific Atlantic](#/p/pacific-atlantic)
    ` });
  const W = chain(f, { prefix: 'W', x: 560, y: 270, dx: 185, lw: 160 }, [
    { q: 'Connect all at minimum cost', help: 'A spanning tree, not a path between two nodes.', leaf: 'MST (Kruskal / Prim)', lh: 46, info: M`
        Kruskal: sort edges, O(E log E), add an edge when union-find says it joins two components. Prim: O(E log V) with a heap, or O(V²) for dense graphs (all pairs of points).

        [Lesson →](#/l/mst) · [Min Cost to Connect All Points](#/p/min-cost-connect-points)
      ` },
    { q: 'Weights are only 0 or 1', help: 'Free moves and moves that cost 1.', leaf: '0-1 BFS (deque)', info: M`
        O(V + E). Use a deque: push a 0-weight neighbour to the front and a 1-weight neighbour to the back. It’s Dijkstra without the heap.
      ` },
    { q: 'Negative weights or ≤ k edges', help: 'Cheapest route with at most k stops; detecting a negative cycle.', leaf: 'Bellman-Ford', info: M`
        O(V · E): relax every edge V − 1 times (or k + 1 times for “at most k stops”, copying the distances each round). An improvement in round V means a negative cycle.

        [Lesson →](#/l/dijkstra) · [Cheapest Flights Within K Stops](#/p/cheapest-flights-k)
      ` },
    { q: 'All pairs, and V is small', help: 'Distances between every pair of nodes, V ≤ about 400.', leaf: 'Floyd–Warshall', info: M`
        O(V³): «for k, for i, for j: d[i][j] = min(d[i][j], d[i][k] + d[k][j])». The k loop must be outermost.

        Practice: [Find the City](#/p/city-threshold)
      ` },
  ], { leaf: 'Dijkstra', lw: 160, info: M`
      O((V + E) log V) with a binary heap; non-negative weights only. Pop the closest node; skip it if the popped distance is stale; relax its edges. For a DAG, relaxing in topological order is O(V + E), with no heap.

      [Lesson →](#/l/dijkstra) · [Network Delay Time](#/p/network-delay) · [Path With Minimum Effort](#/p/min-effort-path) · [Swim in Rising Water](#/p/swim-rising-water)
    ` });
  f.edges.push(['root', U, 'no', [[110, 126]]]);
  f.edges.push(['root', W, 'yes', [[560, 126]]]);
  DSA.flows['graph-algos'] = f;
}

/* ═══════════════ Cheat sheets ═══════════════ */
DSA.cheats = [
  { id: 'collections', kind: 'Flowchart', title: 'Which Java collection?',
    blurb: 'The Java answer to the classic STL container chart: a few questions lead you to the right collection, with the methods and costs you need.',
    lede: 'Answer the questions about what you store and how you take it out. Click any blue box for the declaration, the key methods, how it works inside, and problems that use it.',
    body: M`
      @flow java-collections

      ## The ten you actually use
      | Need | Declaration | Core methods | Cost |
      |---|---|---|---|
      | dynamic array | «List<Integer> a = new ArrayList<>()» | «add, get, set, size, remove(i)» | O(1) / O(1) / O(n) middle |
      | key → value | «Map<K, V> m = new HashMap<>()» | «put, get, getOrDefault, merge, containsKey, remove» | O(1) avg |
      | sorted map | «TreeMap<K, V> t = new TreeMap<>()» | «floorKey, ceilingKey, firstKey, lastKey, pollFirstEntry» | O(log n) |
      | set | «Set<T> s = new HashSet<>()» | «add (false if present), contains, remove» | O(1) avg |
      | sorted set | «TreeSet<T> t = new TreeSet<>()» | «first, last, floor, ceiling, higher, lower» | O(log n) |
      | stack | «Deque<T> st = new ArrayDeque<>()» | «push, pop, peek, isEmpty» | O(1) |
      | queue | «Queue<T> q = new ArrayDeque<>()» | «offer, poll, peek» | O(1) |
      | deque | «Deque<T> d = new ArrayDeque<>()» | «offerFirst/Last, pollFirst/Last, peekFirst/Last» | O(1) |
      | heap | «PriorityQueue<T> pq = new PriorityQueue<>(cmp)» | «offer, poll, peek, size» | O(log n) / O(1) peek |
      | ordered map (LRU) | «new LinkedHashMap<>(16, 0.75f, true)» | «get, put, removeEldestEntry» | O(1) |

      :::key Interfaces on the left, classes on the right
      Declare with the interface («List», «Map», «Deque», «Queue») and construct the class. Use «TreeMap» / «TreeSet» as the declared type when you need the navigation methods («floorKey»…), because those aren't on «Map».
      :::

      ## Deep dives
      How each one works inside (array growth, hashing and treeified bins, red-black rotations, heap sift-up and sift-down, circular buffers) is in [Java Collections, Under the Hood](#/m/java), with step-by-step visualizations.

      @quiz 0
      @quiz 1
    `,
    quiz: [
      { q: 'You need the largest key ≤ x among keys that change over time. Which structure?', options: ['HashMap', 'TreeMap with floorKey', 'PriorityQueue', 'LinkedHashMap'], answer: 1, why: 'Only a sorted structure answers floor queries in O(log n). A heap only exposes its min or max.' },
      { q: 'Why is «new ArrayDeque<>()» preferred over «new Stack<>()»?', options: ['Stack can’t pop', 'Stack is a synchronized legacy class built on Vector; ArrayDeque is faster and has a cleaner interface', 'ArrayDeque allows nulls', 'They are identical'], answer: 1, why: 'Stack extends Vector (every method synchronized) and exposes index-based methods that break stack discipline. The Java docs themselves recommend Deque.' },
    ],
  },

  { id: 'complexity', kind: 'Table', title: 'Collections: complexity and internals',
    blurb: 'Every common operation on every common collection, with what’s underneath and the memory cost.',
    lede: 'Average-case costs unless noted. “n” is the number of elements.',
    body: M`
      ## Lists and deques
      | Operation | ArrayList | LinkedList | ArrayDeque |
      |---|---|---|---|
      | get(i) / set(i) | **O(1)** | O(n) | not supported |
      | add at the end | O(1) amortized | O(1) | O(1) amortized |
      | add / remove at the front | O(n) | O(1) | **O(1)** |
      | add / remove at index i | O(n) shift | O(n) to reach, O(1) to link | not supported |
      | contains / indexOf | O(n) | O(n) | O(n) |
      | inside | «Object[]», grows 1.5× | doubly linked nodes | circular array, power-of-two size |
      | memory per element | one reference (+ the boxed value) | ~24 B node + value | one reference |

      ## Maps and sets
      | Operation | HashMap / HashSet | LinkedHashMap / Set | TreeMap / TreeSet |
      |---|---|---|---|
      | get / put / remove / contains | **O(1)** avg; O(log n) worst (tree bins) | O(1) avg | O(log n) |
      | min / max | O(n) | O(1) first (insertion order) | O(log n) |
      | floor / ceiling / range view | not supported | not supported | **O(log n)** |
      | iteration order | unspecified | insertion (or access) order | sorted by key |
      | iterate everything | O(capacity + n) | O(n) | O(n) |
      | null key | one allowed | one allowed | not allowed |
      | inside | bucket array, load factor 0.75, doubles; buckets of ≥ 8 become red-black trees | HashMap + doubly linked list | red-black tree |

      ## Priority queue
      | Operation | PriorityQueue |
      |---|---|
      | offer / poll | O(log n) |
      | peek | O(1) |
      | remove(Object) / contains | O(n) |
      | build from a collection | O(n) (heapify) |
      | iteration | O(n), **not sorted** |
      | inside | binary heap in an array: children of i at 2i+1 and 2i+2 |

      ## Arrays, strings, sorting
      | Operation | Cost | Note |
      |---|---|---|
      | «Arrays.sort(int[])» | O(n log n) | dual-pivot quicksort, not stable (primitives don't need stability) |
      | «Arrays.sort(T[], cmp)», «Collections.sort», «list.sort» | O(n log n) | TimSort: stable, fast on nearly sorted data |
      | «Arrays.binarySearch», «Collections.binarySearch» | O(log n) | returns «−(insertion point) − 1» when absent |
      | «String.substring», «String.valueOf(char[])» | O(k) | copies (since Java 7u6) |
      | «s1 + s2» in a loop | O(n²) total | use «StringBuilder» |
      | «StringBuilder.append» | O(1) amortized | «insert(0, …)» and «deleteCharAt(0)» are O(n) |
      | «String.equals», «hashCode» | O(n) | the hash is cached after the first call |
      | «Arrays.fill», «Arrays.copyOf», «clone()» | O(n) | «clone» on «int[][]» is shallow |

      ## Boxing costs
      Collections hold objects, so «List<Integer>» stores references to «Integer» objects (16 bytes each, plus the reference). An «int[]» of the same size is 4–5× smaller and much faster to scan. Autoboxing also makes «==» compare references: «Integer» values outside −128..127 aren't cached, so «a == b» can be false for equal values. Use «equals» or unbox.

      ## Iterators are fail-fast
      Structurally modifying a collection while iterating it with for-each throws «ConcurrentModificationException». Use «iterator.remove()», «removeIf», or collect the changes and apply them afterwards.
    `,
  },

  { id: 'java-api', kind: 'Reference', title: 'Everyday Java API for interviews',
    blurb: 'The idioms that save lines: merge, computeIfAbsent, comparators, conversions between arrays and lists, StringBuilder, Character helpers, streams.',
    lede: 'Everything here compiles as-is (with «import java.util.*;»). Copy the idiom, not the whole block.',
    body: M`
      ## Maps
      ~~~java maps
      map.merge(key, 1, Integer::sum);                           // count
      map.put(key, map.getOrDefault(key, 0) + 1);                // same, the long way
      map.computeIfAbsent(key, k -> new ArrayList<>()).add(v);   // multimap
      map.putIfAbsent(key, 0);
      if (map.merge(key, -1, Integer::sum) == 0) map.remove(key); // decrement and clean up
      for (Map.Entry<String, Integer> e : map.entrySet()) { String k = e.getKey(); int v = e.getValue(); }
      map.entrySet().removeIf(e -> e.getValue() == 0);
      int best = Collections.max(map.entrySet(), Map.Entry.comparingByValue()).getKey();
      ~~~

      ## Comparators
      ~~~java comparators
      Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));            // int[][] by first column
      Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]));               // same
      people.sort(Comparator.comparing(Person::age).thenComparing(Person::name));
      words.sort(Comparator.comparingInt(String::length).reversed());
      PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[1] != b[1] ? Integer.compare(b[1], a[1]) : Integer.compare(a[0], b[0]));
      PriorityQueue<Integer> max = new PriorityQueue<>(Collections.reverseOrder());
      ~~~
      Never write «(a, b) -> a − b» for arbitrary ints: the subtraction can overflow and flip the sign.

      ## Arrays
      ~~~java arrays
      int[] a = new int[n];               Arrays.fill(a, -1);
      int[][] g = new int[r][c];          for (int[] row : g) Arrays.fill(row, Integer.MAX_VALUE);
      int[] b = a.clone();                int[] c2 = Arrays.copyOfRange(a, lo, hi);    // [lo, hi)
      Arrays.sort(a);                     Arrays.sort(a, lo, hi);
      boolean same = Arrays.equals(a, b); String show = Arrays.toString(a);          // Arrays.deepToString for 2-D
      int sum = Arrays.stream(a).sum();   int mx = Arrays.stream(a).max().getAsInt();
      Integer[] boxed = {3, 1, 2};        Arrays.sort(boxed, Collections.reverseOrder());  // descending needs boxes
      ~~~

      ## Conversions
      ~~~java conversions
      List<Integer> list = Arrays.stream(a).boxed().collect(Collectors.toList());   // int[] → List
      int[] back = list.stream().mapToInt(Integer::intValue).toArray();              // List → int[]
      int[][] arr = listOfPairs.toArray(new int[0][]);                               // List<int[]> → int[][]
      List<String> fixed = Arrays.asList("a", "b");   // fixed size: add() throws
      List<String> copy = new ArrayList<>(Arrays.asList("a", "b"));
      List<Integer> immutable = List.of(1, 2, 3);     // no nulls, no changes
      char[] cs = s.toCharArray();  String t = new String(cs);  String u = String.valueOf(cs);
      int n = Integer.parseInt("123");  String bin = Integer.toBinaryString(5);  int v = Integer.parseInt("101", 2);
      ~~~

      ## Strings and characters
      | Task | Code |
      |---|---|
      | build a string | «StringBuilder sb = new StringBuilder(); sb.append(x); sb.reverse(); sb.toString()» |
      | char ↔ index | «c − 'a'», «(char) ('a' + i)» |
      | digit value | «c − '0'» or «Character.getNumericValue(c)» |
      | classify | «Character.isDigit», «isLetter», «isLetterOrDigit», «isUpperCase», «isWhitespace» |
      | case | «Character.toLowerCase(c)», «s.toLowerCase()» |
      | compare | «s.equals(t)», «s.compareTo(t)» (lexicographic), never «==» |
      | split / join | «s.trim().split("\\s+")», «String.join(",", list)» |
      | repeat / search | «"ab".repeat(3)», «s.indexOf("x", from)», «s.startsWith(p)», «s.contains(t)» |
      | sort characters | «char[] c = s.toCharArray(); Arrays.sort(c); new String(c)» |

      ## Math
      | Need | Code |
      |---|---|
      | safe midpoint | «lo + (hi − lo) / 2» |
      | ceiling division (positive) | «(a + b − 1) / b» or «Math.ceilDiv(a, b)» (Java 18+) |
      | modulo that is never negative | «Math.floorMod(a, m)» |
      | overflow-checked math | «Math.addExact», «Math.multiplyExact» |
      | limits | «Integer.MAX_VALUE» (≈ 2.1·10⁹), «Long.MAX_VALUE» (≈ 9.2·10¹⁸) |
      | bits | «Integer.bitCount», «Integer.highestOneBit», «Integer.numberOfTrailingZeros» |
      | gcd | «BigInteger.valueOf(a).gcd(BigInteger.valueOf(b))», or write the two-line Euclid |

      ## Deques, heaps, iteration
      ~~~java misc
      Deque<Integer> st = new ArrayDeque<>();   st.push(1); st.peek(); st.pop();
      Queue<int[]> q = new ArrayDeque<>();      q.offer(new int[]{0, 0}); q.poll();
      for (int k = q.size(); k > 0; k--) { /* one BFS level */ }
      Iterator<Integer> it = list.iterator(); while (it.hasNext()) if (it.next() < 0) it.remove();
      int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
      ~~~
    `,
  },

  { id: 'java-gotchas', kind: 'List', title: 'Java gotchas that cost interviews',
    blurb: 'Integer caching, overflow, comparator subtraction, remove(int) vs remove(Object), array keys in a HashMap, and the rest.',
    lede: 'Each of these has failed a real submission. Skim before every interview.',
    body: M`
      ## Equality and boxing
      1. **«Integer == Integer»** compares references. It happens to work for −128..127 (cached) and fails above. Use «.equals», or compare «int»s: «map.get(a).intValue() == map.get(b)».
      2. **«String == String»** compares references. Use «equals».
      3. **Arrays as HashMap keys** use identity: «map.put(new int[]{1, 2}, x)» can never be found again. Use «List.of(1, 2)», a «String» key like «r + "," + c», or «(long) r * C + c».
      4. **«list.remove(i)»** on a «List<Integer>» removes **index** i. To remove the value, «list.remove(Integer.valueOf(i))».
      5. **Unboxing null:** «int c = map.get(k);» throws NullPointerException when k is absent. Use «getOrDefault».

      ## Overflow
      6. **«a * b»** for ints overflows silently past ≈ 2.1·10⁹. Cast first: «(long) a * b», not «(long) (a * b)».
      7. **«(lo + hi) / 2»** can overflow; use «lo + (hi − lo) / 2» or «(lo + hi) >>> 1».
      8. **Comparator subtraction** «(a, b) -> a − b» overflows for widely spread values. Use «Integer.compare».
      9. **«Math.abs(Integer.MIN_VALUE)»** is still negative, and «−Integer.MIN_VALUE» overflows. Copy to a long first.
      10. **Sums of many ints**: 10⁵ values up to 10⁹ need a «long» accumulator.
      11. **Infinity sentinels**: «Integer.MAX_VALUE + 1» wraps to negative. Use «MAX_VALUE / 2» or check before adding.

      ## Integer arithmetic
      12. **Division truncates toward zero**: «−7 / 2 == −3» and «−7 % 2 == −1». Use «Math.floorDiv / floorMod» for mathematical floor and modulo.
      13. **«char + int»** is an int: «'a' + 1» is 98. Cast back: «(char) ('a' + 1)». «"" + c1 + c2» concatenates, but «c1 + c2 + ""» adds them first.
      14. **«1 << 31»** is negative, and «1 << 32 == 1» (the shift is mod 32). Use «1L << k» for long masks.

      ## Collections
      15. **Modifying while iterating** throws ConcurrentModificationException. Use an iterator's «remove», «removeIf», or a copy.
      16. **«Arrays.asList(int[])»** gives a «List<int[]>» with one element, not a list of ints. Use «Arrays.stream(a).boxed()».
      17. **«Arrays.asList»** is fixed-size; «List.of» is immutable. Wrap in «new ArrayList<>(…)» to modify.
      18. **«Arrays.fill(arr, new ArrayList<>())»** puts the **same** list in every slot. Loop and create one per index.
      19. **PriorityQueue iteration** isn't sorted. Only «poll» returns elements in order.
      20. **TreeSet / TreeMap with a comparator** treat «compare == 0» as a duplicate. Sorting pairs by distance only will silently drop ties. Add a tie-breaker.
      21. **«int[][] copy = grid.clone()»** is shallow: the rows are shared. Clone each row.
      22. **HashMap iteration order** isn't insertion order. Use LinkedHashMap when order matters.

      ## Strings
      23. **String concatenation in a loop** is O(n²). Use StringBuilder.
      24. **«s.split(".")»** splits on a regex: «.» matches everything. Use «split("\\.")». Trailing empty strings are dropped.
      25. **«substring»** copies. Pass indices instead of substrings in recursion when performance matters.

      ## Recursion
      26. **Stack depth**: the default JVM stack handles roughly 10⁴ frames of a simple recursive method. A 10⁵-node linked list or a skewed tree may need iteration (or an explicit stack).
      27. **Mutable shared state in backtracking**: add a **copy** («new ArrayList<>(path)») to the results, not the path itself.

      @quiz 0
      @quiz 1
    `,
    quiz: [
      { q: '«Integer a = 1000, b = 1000;» What is «a == b»?', options: ['true', 'false (usually): they are different Integer objects', 'compile error', 'NullPointerException'], answer: 1, why: 'Only −128..127 are cached by Integer.valueOf. Outside that range autoboxing creates distinct objects, and == compares references.' },
      { q: 'Which key works correctly in a «HashMap» for grid cell (r, c)?', options: ['new int[]{r, c}', 'List.of(r, c) or r * cols + c', 'new Object()', 'Both A and B'], answer: 1, why: 'Arrays use identity hashCode and equals, so a new array never matches. List.of has value-based equals and hashCode; an encoded long or int works too.' },
    ],
  },

  { id: 'constraints', kind: 'Table', title: 'Read the constraints: n → target complexity',
    blurb: 'The input size tells you the algorithm class before you read the story. Java-specific operation budgets included.',
    lede: 'Assume roughly 10⁸ simple operations per second in Java, and a limit of about a second. The constraints are a hint the setter left for you.',
    body: M`
      | n up to | Target | Typical techniques |
      |---|---|---|
      | 10–12 | O(n!) | permutations, brute-force orderings |
      | 20–25 | O(2ⁿ) or O(2ⁿ · n) | subsets, bitmask DP, meet in the middle (n ≈ 40) |
      | 100 | O(n³) or O(n⁴) small | Floyd–Warshall, interval DP, triple loops |
      | 500–1,000 | O(n²) up to O(n² log n) | 2-D DP, all pairs, per-element BFS on small grids |
      | 10⁴–10⁵ | O(n log n) (O(n√n) at a stretch) | sorting, heaps, binary search, TreeMap, divide and conquer |
      | 10⁶–10⁷ | O(n) or O(n log n) with small constants | two pointers, sliding window, prefix sums, counting sort, linear DP |
      | 10⁹ and up | O(log n) or O(1) | binary search on the answer, math, fast power, digit tricks |

      :::tip Read them in both directions
      “n ≤ 20” is practically an announcement of backtracking or bitmask DP. “n ≤ 10⁵” rules out O(n²). “values up to 10⁹” means counting arrays won't fit but sorting will, and sums need «long». “Return the answer modulo 10⁹ + 7” means the count is astronomically large, which almost always means DP.
      :::

      ## Memory in Java
      | Structure | Rough size |
      |---|---|
      | «int[10⁶]» | 4 MB |
      | «long[10⁶]» | 8 MB |
      | «boolean[10⁶]» | 1 MB (a byte each) |
      | «int[5000][5000]» | 100 MB (usually too much: roll the rows) |
      | «List<Integer>» of 10⁶ | ≈ 20 MB (references + Integer objects) |
      | «HashMap<Integer, Integer>» of 10⁶ | ≈ 50–80 MB |

      ## Time budget per structure (10⁶ operations)
      | Operation × 10⁶ | Relative cost |
      |---|---|
      | array index | 1× |
      | ArrayList get | ~2× |
      | HashMap get/put (Integer keys) | ~10–20× (hashing, boxing, cache misses) |
      | TreeMap get/put | ~30–60× (log n pointer hops) |
      | PriorityQueue offer/poll | ~20–40× |

      So an O(n log n) solution with a TreeMap can be slower than an O(n log n) sort-and-scan by a large constant factor. When two approaches have the same Big-O, prefer arrays.
    `,
  },

  { id: 'templates', kind: 'Templates', title: 'Pattern templates in Java',
    blurb: 'The skeleton of every core pattern, ready to adapt: two pointers, sliding window, binary search, BFS, DFS, backtracking, topo sort, union-find, Dijkstra, monotonic stack, trie, DP.',
    lede: 'Each template is the smallest complete version. Learn the shape, and the problem-specific part becomes the only thing you think about.',
    body: M`
      ## Two pointers (sorted array, pair sum)
      ~~~java two-pointers
      int i = 0, j = a.length - 1;
      while (i < j) {
          int s = a[i] + a[j];
          if (s == target) return new int[]{i, j};
          if (s < target) i++; else j--;
      }
      ~~~

      ## Sliding window (variable size)
      ~~~java sliding-window
      int[] count = new int[128];
      int best = 0;
      for (int left = 0, right = 0; right < s.length(); right++) {
          count[s.charAt(right)]++;                   // 1. expand
          while (/* window invalid */ count[s.charAt(right)] > 1)
              count[s.charAt(left++)]--;              // 2. shrink until valid
          best = Math.max(best, right - left + 1);    // 3. record
      }
      ~~~

      ## Binary search: lower bound, and on the answer
      ~~~java binary-search
      int lo = 0, hi = a.length;                      // first index with a[i] >= target
      while (lo < hi) {
          int mid = (lo + hi) >>> 1;
          if (a[mid] < target) lo = mid + 1; else hi = mid;
      }
      // On the answer: smallest x in [lo, hi] where feasible(x) is true (monotone)
      while (lo < hi) {
          int mid = lo + (hi - lo) / 2;
          if (feasible(mid)) hi = mid; else lo = mid + 1;
      }
      ~~~

      ## Prefix sums + hash map (subarrays summing to k)
      ~~~java prefix-sum
      Map<Integer, Integer> seen = new HashMap<>();
      seen.put(0, 1);
      int prefix = 0, count = 0;
      for (int x : nums) {
          prefix += x;
          count += seen.getOrDefault(prefix - k, 0);
          seen.merge(prefix, 1, Integer::sum);
      }
      ~~~

      ## Monotonic stack (next greater element)
      ~~~java mono-stack
      int[] next = new int[n];
      Arrays.fill(next, -1);
      Deque<Integer> st = new ArrayDeque<>();         // indices, values decreasing
      for (int i = 0; i < n; i++) {
          while (!st.isEmpty() && a[st.peek()] < a[i]) next[st.pop()] = a[i];
          st.push(i);
      }
      ~~~

      ## BFS on a grid (shortest steps)
      ~~~java bfs
      int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
      Queue<int[]> q = new ArrayDeque<>();
      boolean[][] seen = new boolean[R][C];
      q.offer(new int[]{sr, sc}); seen[sr][sc] = true;
      for (int steps = 0; !q.isEmpty(); steps++) {
          for (int k = q.size(); k > 0; k--) {        // one level = one step
              int[] cur = q.poll();
              if (cur[0] == tr && cur[1] == tc) return steps;
              for (int[] d : dirs) {
                  int r = cur[0] + d[0], c = cur[1] + d[1];
                  if (r < 0 || c < 0 || r >= R || c >= C || seen[r][c] || grid[r][c] == 1) continue;
                  seen[r][c] = true;                  // mark when enqueuing, not when polling
                  q.offer(new int[]{r, c});
              }
          }
      }
      return -1;
      ~~~

      ## Tree DFS (return a value up)
      ~~~java tree-dfs
      int height(TreeNode node) {
          if (node == null) return 0;
          int l = height(node.left), r = height(node.right);
          best = Math.max(best, l + r);               // use both children here (e.g. diameter)
          return 1 + Math.max(l, r);                  // return one path up
      }
      ~~~

      ## Backtracking
      ~~~java backtracking
      void go(int start, List<Integer> path) {
          res.add(new ArrayList<>(path));             // record a copy
          for (int i = start; i < nums.length; i++) {
              if (i > start && nums[i] == nums[i - 1]) continue;   // skip duplicates (sorted input)
              path.add(nums[i]);                      // choose
              go(i + 1, path);                        // explore
              path.remove(path.size() - 1);           // un-choose
          }
      }
      ~~~

      ## Topological sort (Kahn)
      ~~~java topo
      int[] indeg = new int[n];
      List<List<Integer>> adj = new ArrayList<>();
      for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
      for (int[] e : edges) { adj.get(e[0]).add(e[1]); indeg[e[1]]++; }
      Queue<Integer> q = new ArrayDeque<>();
      for (int i = 0; i < n; i++) if (indeg[i] == 0) q.offer(i);
      List<Integer> order = new ArrayList<>();
      while (!q.isEmpty()) {
          int u = q.poll(); order.add(u);
          for (int v : adj.get(u)) if (--indeg[v] == 0) q.offer(v);
      }
      boolean hasCycle = order.size() < n;
      ~~~

      ## Union-Find
      ~~~java union-find
      int[] parent = new int[n], size = new int[n];
      for (int i = 0; i < n; i++) { parent[i] = i; size[i] = 1; }
      int find(int x) { while (parent[x] != x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
      boolean union(int a, int b) {
          a = find(a); b = find(b);
          if (a == b) return false;                   // already connected
          if (size[a] < size[b]) { int t = a; a = b; b = t; }
          parent[b] = a; size[a] += size[b];
          return true;
      }
      ~~~

      ## Dijkstra
      ~~~java dijkstra
      int[] dist = new int[n];
      Arrays.fill(dist, Integer.MAX_VALUE);
      dist[src] = 0;
      PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));
      pq.offer(new int[]{0, src});
      while (!pq.isEmpty()) {
          int[] cur = pq.poll();
          int d = cur[0], u = cur[1];
          if (d > dist[u]) continue;                  // stale entry
          for (int[] e : adj.get(u)) {                // e = {v, w}
              if (d + e[1] < dist[e[0]]) { dist[e[0]] = d + e[1]; pq.offer(new int[]{dist[e[0]], e[0]}); }
          }
      }
      ~~~

      ## Top-k with a heap
      ~~~java top-k
      PriorityQueue<Integer> heap = new PriorityQueue<>();   // min-heap holds the k largest
      for (int x : nums) {
          heap.offer(x);
          if (heap.size() > k) heap.poll();
      }
      int kthLargest = heap.peek();
      ~~~

      ## Trie
      ~~~java trie
      class Node { Node[] next = new Node[26]; boolean end; }
      void insert(Node root, String w) {
          Node cur = root;
          for (char ch : w.toCharArray()) {
              if (cur.next[ch - 'a'] == null) cur.next[ch - 'a'] = new Node();
              cur = cur.next[ch - 'a'];
          }
          cur.end = true;
      }
      ~~~

      ## Dynamic programming (bottom-up)
      ~~~java dp
      // 1-D: dp[i] from a few earlier entries
      int[] dp = new int[n + 1];
      dp[0] = base;
      for (int i = 1; i <= n; i++) dp[i] = Math.max(dp[i - 1], (i >= 2 ? dp[i - 2] : 0) + a[i - 1]);
      // 2-D over two strings: dp[i][j] for prefixes a[0..i), b[0..j)
      int[][] t = new int[m + 1][k + 1];
      for (int i = 1; i <= m; i++)
          for (int j = 1; j <= k; j++)
              t[i][j] = s.charAt(i - 1) == u.charAt(j - 1) ? t[i - 1][j - 1] + 1 : Math.max(t[i - 1][j], t[i][j - 1]);
      ~~~
    `,
  },

  { id: 'graphs', kind: 'Flowchart', title: 'Which graph algorithm?',
    blurb: 'BFS, DFS, topological sort, union-find, Dijkstra, 0-1 BFS, Bellman-Ford, Floyd–Warshall, MST: pick by weights and question.',
    lede: 'Two questions decide almost everything: are the edges weighted, and what exactly is being asked (a path, an order, connectivity, or a spanning tree)?',
    body: M`
      @flow graph-algos

      ## Complexity at a glance
      | Algorithm | Time | Space | Works when |
      |---|---|---|---|
      | BFS / DFS | O(V + E) | O(V) | unweighted, or just visiting |
      | Topological sort (Kahn) | O(V + E) | O(V) | directed; detects cycles |
      | Union-Find | ≈ O(α(n)) per op | O(V) | edges only added |
      | 0-1 BFS | O(V + E) | O(V) | weights 0 or 1 |
      | Dijkstra (binary heap) | O((V + E) log V) | O(V + E) | non-negative weights |
      | Bellman-Ford | O(V · E) | O(V) | negative weights, ≤ k edges |
      | Floyd–Warshall | O(V³) | O(V²) | all pairs, small V |
      | Kruskal / Prim | O(E log E) / O(E log V) | O(V + E) | minimum spanning tree |

      ## Representations in Java
      ~~~java graphs
      List<List<Integer>> adj = new ArrayList<>();          // unweighted
      for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
      for (int[] e : edges) { adj.get(e[0]).add(e[1]); adj.get(e[1]).add(e[0]); }

      List<List<int[]>> wadj = new ArrayList<>();           // weighted: {neighbour, weight}
      Map<String, List<String>> named = new HashMap<>();    // string nodes
      int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};   // grids: neighbours computed on the fly
      ~~~

      :::warn Mark visited when you enqueue
      In BFS, mark a node as visited when you **add** it to the queue, not when you poll it. Otherwise the same node is enqueued many times, and on dense grids the queue explodes.
      :::
    `,
  },

  { id: 'dp', kind: 'Reference', title: 'Dynamic programming patterns',
    blurb: 'The recurring DP families with their state, transition and fill order, plus a checklist for deriving new ones.',
    lede: 'Almost every interview DP is one of these shapes. Identify the shape, then write the state in plain words before any code.',
    body: M`
      ## The derivation checklist
      1. **State in words:** "dp[i] = the best answer for the first i items" or "dp[i][j] = … for prefixes i and j".
      2. **Transition:** what was the last decision? Express dp[state] from smaller states, one term per choice.
      3. **Base cases:** empty prefix, zero capacity, first row and column.
      4. **Order:** fill so every dependency is computed first (by index, by length for intervals).
      5. **Answer:** which cell? (dp[n], max over all dp[i], dp[0][n−1]…)
      6. **Optimize:** keep only the rows you read. Reconstruct the choices from the full table if asked.

      ## Families
      | Family | State | Transition | Examples |
      |---|---|---|---|
      | Fibonacci-style | dp[i] = ways/best to reach i | dp[i−1], dp[i−2] | [Climbing Stairs](#/p/climbing-stairs), [Decode Ways](#/p/decode-ways) |
      | Take or skip | dp[i] = best using the first i | max(skip dp[i−1], take dp[i−2] + a[i]) | [House Robber](#/p/house-robber) |
      | Unbounded choices | dp[x] = best for amount x | min over coins c of dp[x − c] + 1 | [Coin Change](#/p/coin-change), [Word Break](#/p/word-break) |
      | Ending here | dp[i] = best ending exactly at i | extend or restart | [Max Subarray](#/p/max-subarray), [Max Product](#/p/max-product-subarray), [LIS](#/p/lis) |
      | Grid | dp[r][c] | from above and from the left | [Unique Paths II](#/p/unique-paths-obstacles), [Min Path Sum](#/p/min-path-sum) |
      | Two sequences | dp[i][j] over prefixes | match → diagonal; else combine up / left | [LCS](#/p/lcs), [Edit Distance](#/p/edit-distance), [Regex Matching](#/p/regex-matching) |
      | 0/1 knapsack | dp[cap] | loop capacity **downward**: dp[c] = dp[c] ⊕ dp[c − w] | [Partition Equal Subset](#/p/partition-equal-subset), [Target Sum](#/p/target-sum) |
      | Unbounded knapsack | dp[cap] | loop capacity **upward** | [Coin Change II](#/p/coin-change-ii) |
      | State machine | dp[i][state] | one term per arrow between states | [Stock With Cooldown](#/p/stock-cooldown) |
      | Interval | dp[i][j] over a range | choose the split or the last element k | [Burst Balloons](#/p/burst-balloons), [Palindromic Substrings](#/p/palindromic-substrings) |
      | Bitmask | dp[mask][i] | add one element not in mask | TSP-style, «n ≤ 20» |

      :::key Top-down or bottom-up?
      **Memoized recursion** is faster to write and only visits reachable states. Say it first, then convert if asked. **Bottom-up** avoids recursion depth limits (Java's stack is ~10⁴ frames by default) and allows rolling-array space optimization.
      :::

      ## DP or greedy?
      If you can find a small counterexample to the greedy choice in a minute (coins «[1, 3, 4]», amount 6), it's DP. If an exchange argument works ("swapping in the greedy choice never hurts"), greedy is simpler and faster.

      ## Loop orders that change the meaning
      | Code | Counts |
      |---|---|
      | «for coin: for amount ↑» | combinations (each multiset once) |
      | «for amount: for coin» | permutations (orderings counted separately) |
      | «for item: for cap ↓» | 0/1 knapsack (each item once) |
      | «for item: for cap ↑» | unbounded knapsack (reuse allowed) |
    `,
  },

  { id: 'searching', kind: 'Reference', title: 'Sorting and binary search in Java',
    blurb: 'Comparators that never overflow, stable vs unstable sorts, the three binary search templates, and what Arrays.binarySearch really returns.',
    lede: 'Most off-by-one bugs come from mixing templates. Pick one convention (half-open [lo, hi)) and stick to it.',
    body: M`
      ## Sorting
      | Call | Algorithm | Stable | Note |
      |---|---|---|---|
      | «Arrays.sort(int[])» | dual-pivot quicksort | no | fastest; ascending only |
      | «Arrays.sort(Integer[], cmp)» | TimSort | yes | descending needs boxing: «Collections.reverseOrder()» |
      | «list.sort(cmp)», «Collections.sort» | TimSort | yes | |
      | «Arrays.sort(int[][], cmp)» | TimSort | yes | rows are objects |

      Descending «int[]» without boxing: sort ascending, then reverse in place, or negate the values before and after.

      ## Comparators that never overflow
      ~~~java comparators
      Comparator<int[]> byStart = (a, b) -> Integer.compare(a[0], b[0]);
      Comparator<int[]> byEndThenStart = Comparator.<int[]>comparingInt(a -> a[1]).thenComparingInt(a -> a[0]);
      Comparator<String> byLenDesc = Comparator.comparingInt(String::length).reversed();
      ~~~

      ## Three binary search templates
      ~~~java lower-bound
      // 1. Lower bound: first index with a[i] >= x (returns a.length if none). Half-open [lo, hi).
      int lo = 0, hi = a.length;
      while (lo < hi) { int mid = (lo + hi) >>> 1; if (a[mid] < x) lo = mid + 1; else hi = mid; }
      // Upper bound (first a[i] > x): change '<' to '<='.
      ~~~
      ~~~java exact
      // 2. Exact match on a closed range [lo, hi].
      int lo = 0, hi = a.length - 1;
      while (lo <= hi) {
          int mid = lo + (hi - lo) / 2;
          if (a[mid] == x) return mid;
          if (a[mid] < x) lo = mid + 1; else hi = mid - 1;
      }
      return -1;
      ~~~
      ~~~java on-the-answer
      // 3. On the answer: smallest value v in [lo, hi] with ok(v) true, where ok is monotone (false…false true…true).
      long lo = minPossible, hi = maxPossible;
      while (lo < hi) { long mid = lo + (hi - lo) / 2; if (ok(mid)) hi = mid; else lo = mid + 1; }
      return lo;
      ~~~

      :::warn What the library returns
      «Arrays.binarySearch(a, x)» returns the index if x is found (**any** index among duplicates), otherwise «−(insertionPoint) − 1». So the insertion point is «−r − 1». For "first occurrence" or "count in range", write the lower-bound template instead.
      :::

      ## Sorted containers do binary search for you
      | Question | TreeSet / TreeMap |
      |---|---|
      | largest ≤ x | «floor(x)», «floorKey(x)» |
      | smallest ≥ x | «ceiling(x)», «ceilingKey(x)» |
      | strictly smaller / larger | «lower(x)», «higher(x)» |
      | count in [a, b] | «subSet(a, true, b, true).size()», which is O(size). Use a Fenwick tree for many queries |
    `,
  },
];

DSA.finderNotes = M`
  ## Reading a problem in 60 seconds
  1. **Look at the constraints first.** They bound the complexity: n ≤ 20 suggests exponential search, n ≤ 10⁵ needs O(n log n), and values up to 10⁹ with a "minimum possible maximum" question suggest binary search on the answer. See [Read the constraints](#/cheats/constraints).
  2. **Find the verb.** "Return all …" → backtracking. "Minimum / maximum / number of ways" → DP or greedy. "Shortest / fewest" → BFS or Dijkstra. "Is it possible" → often greedy, BFS, or DP on booleans.
  3. **Find the shape.** Contiguous → window or prefix sums. Pairs in sorted data → two pointers. Nested or matching → stack. Ranges → intervals. Prerequisites → topological sort.

  :::tip When two patterns fit
  Sliding window needs the condition to be monotone as the window grows (all non-negative numbers). With negative numbers in a sum, switch to prefix sums with a hash map. If a greedy choice seems right, spend a minute on a counterexample before trusting it. If you find one, it's DP.
  :::

  Train the recognition itself with the [pattern drill](#/drill): it shows a one-line problem and you name the pattern.
`;
})();

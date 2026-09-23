/* DSA Lab — tracers for trees, heaps and tries. */
(function () {
  'use strict';
  const V = window.DSAViz, add = V.add;
  const levelCheck = ({ tree }) => (!Array.isArray(tree) || tree.length > 31 ? 'level order like [3,9,20,null,null,15,7], up to 31 slots' : tree.some((x) => x !== null && typeof x !== 'number') ? 'numbers or null only' : null);

  /* ═════════════ Trees ═════════════ */
  add('treeTraversal', {
    title: 'DFS traversal orders', sub: 'The same recursion; only where you "visit" the node changes: before (pre), between (in) or after (post) the children.',
    inputs: [{ key: 'tree', label: 'tree (level order)', type: 'json', def: [4, 2, 6, 1, 3, 5, 7] }, { key: 'order', label: 'order: pre / in / post', type: 'str', def: 'in' }],
    check: (x) => levelCheck(x) || (['pre', 'in', 'post'].includes(x.order) ? null : 'order must be pre, in or post'),
    code: `
void dfs(TreeNode node, List<Integer> out) {
    if (node == null) return;
    // pre-order: out.add(node.val) here
    dfs(node.left, out);
    // in-order:  out.add(node.val) here
    dfs(node.right, out);
    // post-order: out.add(node.val) here
}`,
    run({ tree, order }, t) {
      const T = V.H.tree(tree);
      const out = [], stack = [], done = {};
      const visitLine = { pre: 3, in: 5, post: 7 }[order];
      const view = (cur, extra = {}) => [
        { t: 'tree', label: `${order}-order`, root: T.root, nodes: T.nodes, cls: { ...done, ...(cur ? { [cur]: 'active' } : {}), ...extra }, ptr: cur ? { node: cur } : {} },
        { t: 'row', items: [{ t: 'stack', label: 'call stack (top = right)', a: stack.map((k) => T.nodes[k].v) }, { t: 'stack', label: 'output', a: out.slice(), kind: 'list' }] },
      ];
      const visit = (k) => { out.push(T.nodes[k].v); done[k] = 'ok'; t.step(visitLine, `Visit <b>${T.nodes[k].v}</b> (${order}-order position) → output.`, view(k)); };
      (function dfs(k) {
        if (k === null || k === undefined) return;
        stack.push(k);
        t.step(2, `Enter dfs(${T.nodes[k].v}).`, view(k));
        if (order === 'pre') visit(k);
        if (T.nodes[k].l) { t.step(4, `Go left from ${T.nodes[k].v}.`, view(k, { [T.nodes[k].l]: 'cmp' })); }
        dfs(T.nodes[k].l);
        if (order === 'in') visit(k);
        if (T.nodes[k].r) { t.step(6, `Go right from ${T.nodes[k].v}.`, view(k, { [T.nodes[k].r]: 'cmp' })); }
        dfs(T.nodes[k].r);
        if (order === 'post') visit(k);
        stack.pop();
        t.step(8, `Return from dfs(${T.nodes[k].v}).`, view(stack[stack.length - 1]));
      })(T.root);
      t.step(8, `${order}-order: [${out.join(', ')}]. ${order === 'in' ? 'For a BST this is sorted order.' : order === 'post' ? 'Children before parents, which is what bottom-up computations like height and diameter need.' : 'Parents before children, which is what copying or serializing a tree needs.'} O(n) time, O(height) stack.`, view(null));
    },
  });

  add('treeBFS', {
    title: 'Level-order traversal (BFS)', sub: 'Snapshot the queue size at the start of each level, then pop exactly that many nodes.',
    inputs: [{ key: 'tree', label: 'tree (level order)', type: 'json', def: [3, 9, 20, null, null, 15, 7, null, null, 1] }],
    check: levelCheck,
    code: `
List<List<Integer>> levelOrder(TreeNode root) {
    List<List<Integer>> res = new ArrayList<>();
    Queue<TreeNode> q = new ArrayDeque<>();
    if (root != null) q.offer(root);
    while (!q.isEmpty()) {
        int size = q.size();                 // nodes on this level
        List<Integer> level = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            TreeNode n = q.poll();
            level.add(n.val);
            if (n.left != null) q.offer(n.left);
            if (n.right != null) q.offer(n.right);
        }
        res.add(level);
    }
    return res;
}`,
    run({ tree }, t) {
      const T = V.H.tree(tree);
      const q = T.root ? [T.root] : []; const res = []; const done = {};
      const view = (cur, lvl) => [
        { t: 'tree', label: 'tree', root: T.root, nodes: T.nodes, cls: { ...done, ...Object.fromEntries(q.map((k) => [k, 'cmp'])), ...(cur ? { [cur]: 'active' } : {}) } },
        { t: 'stack', label: 'queue (front → back)', a: q.map((k) => T.nodes[k].v), kind: 'queue' },
        { t: 'stack', label: 'levels so far', a: [...res.map((l) => `[${l}]`), ...(lvl ? [`[${lvl}…]`] : [])], kind: 'list' },
      ];
      t.step(4, 'Start with the root in the queue.', view());
      while (q.length) {
        const size = q.length; const level = [];
        t.step(6, `Level ${res.length}: the queue holds exactly this level's ${size} node(s). Snapshot size = ${size}.`, view());
        for (let i = 0; i < size; i++) {
          const k = q.shift(); level.push(T.nodes[k].v); done[k] = 'ok';
          if (T.nodes[k].l) q.push(T.nodes[k].l);
          if (T.nodes[k].r) q.push(T.nodes[k].r);
          t.step(10, `Pop ${T.nodes[k].v}, add it to the level, and enqueue its children${T.nodes[k].l || T.nodes[k].r ? '' : ' (none)'}.`, view(k, level.join(',')));
        }
        res.push(level);
        t.step(15, `Level done: [${level.join(', ')}].`, view());
      }
      t.step(17, `${res.length} level(s). Each node is enqueued and dequeued once: O(n) time, O(width) space.`, view());
    },
  });

  add('validateBST', {
    title: 'Validating a BST with bounds', sub: 'Each node must lie strictly inside the (low, high) range inherited from its ancestors, not just beat its parent.',
    inputs: [{ key: 'tree', label: 'tree (level order)', type: 'json', def: [8, 4, 12, 2, 6, 10, 14, null, null, 5, 9] }],
    check: levelCheck,
    code: `
boolean isValidBST(TreeNode root) { return valid(root, Long.MIN_VALUE, Long.MAX_VALUE); }

boolean valid(TreeNode n, long lo, long hi) {
    if (n == null) return true;
    if (n.val <= lo || n.val >= hi) return false;      // outside the allowed range
    return valid(n.left, lo, n.val)                    // left subtree: < n.val
        && valid(n.right, n.val, hi);                  // right subtree: > n.val
}`,
    run({ tree }, t) {
      const T = V.H.tree(tree);
      const sub = {}, cls = {};
      const f = (x) => (x === -Infinity ? '−∞' : x === Infinity ? '∞' : x);
      const view = (cur) => [{ t: 'tree', label: 'range shown under each checked node', root: T.root, nodes: T.nodes, cls: { ...cls, ...(cur ? { [cur]: cls[cur] === 'bad' ? 'bad' : 'active' } : {}) }, sub, ptr: cur ? { n: cur } : {} }];
      let ok = true;
      (function valid(k, lo, hi) {
        if (!ok || !k) return;
        const v = T.nodes[k].v;
        sub[k] = `(${f(lo)},${f(hi)})`;
        if (v <= lo || v >= hi) { cls[k] = 'bad'; ok = false; t.step(5, `${v} is outside (${f(lo)}, ${f(hi)}) → <b>not a BST</b>. ${v > lo && v < hi ? '' : `It may be fine relative to its parent, but an ancestor forbids it.`}`, view(k)); return; }
        cls[k] = 'ok';
        t.step(5, `${v} is inside (${f(lo)}, ${f(hi)}). Its left subtree must be in (${f(lo)}, ${v}) and its right subtree in (${v}, ${f(hi)}).`, view(k));
        valid(T.nodes[k].l, lo, v);
        valid(T.nodes[k].r, v, hi);
      })(T.root, -Infinity, Infinity);
      if (ok) t.step(8, 'Every node respects its range: a valid BST. O(n) time, O(height) stack.', view());
    },
  });

  add('treeHeights', {
    title: 'Post-order: heights and the diameter', sub: 'Each call returns its height; at every node, left height + right height is a candidate diameter.',
    inputs: [{ key: 'tree', label: 'tree (level order)', type: 'json', def: [1, 2, 3, 4, 5, null, null, 8, null, null, 7, 9] }],
    check: levelCheck,
    code: `
int best = 0;
int diameterOfBinaryTree(TreeNode root) { height(root); return best; }

int height(TreeNode n) {                   // number of nodes on the longest downward path
    if (n == null) return 0;
    int l = height(n.left), r = height(n.right);
    best = Math.max(best, l + r);          // longest path THROUGH n, in edges
    return 1 + Math.max(l, r);             // what the parent needs
}`,
    run({ tree }, t) {
      const T = V.H.tree(tree);
      const sub = {}, cls = {}; let best = 0, bestAt = null;
      const view = (cur) => [{ t: 'tree', label: 'height under each finished node', root: T.root, nodes: T.nodes, cls: { ...cls, ...(cur ? { [cur]: 'active' } : {}), ...(bestAt ? { [bestAt]: 'ok' } : {}) }, sub, ptr: cur ? { n: cur } : {} }, { t: 'vars', v: { best } }];
      (function h(k) {
        if (!k) return 0;
        t.step(5, `height(${T.nodes[k].v}): first compute both children.`, view(k));
        const l = h(T.nodes[k].l), r = h(T.nodes[k].r);
        if (l + r > best) { best = l + r; bestAt = k; }
        sub[k] = `h=${1 + Math.max(l, r)}`; cls[k] = 'done';
        t.step(7, `At ${T.nodes[k].v}: left height ${l}, right height ${r}, so the path through it has ${l + r} edges${l + r === best ? ` (best = ${best})` : ''}. Return height ${1 + Math.max(l, r)}.`, view(k));
        return 1 + Math.max(l, r);
      })(T.root);
      t.step(4, `Diameter = <b>${best}</b> edges, through the highlighted node. The function returns one thing (height) and updates another (best), a very common tree-DP shape.`, view());
    },
  });

  add('lcaTrace', {
    title: 'Lowest common ancestor (binary tree)', sub: 'Each call returns p, q, the LCA, or null; the first node that gets non-null from both sides is the answer.',
    inputs: [{ key: 'tree', label: 'tree (level order, distinct)', type: 'json', def: [3, 5, 1, 6, 2, 0, 8, null, null, 7, 4] }, { key: 'p', label: 'p', type: 'int', def: 7 }, { key: 'q', label: 'q', type: 'int', def: 4 }],
    check: (x) => levelCheck(x) || (x.tree.includes(x.p) && x.tree.includes(x.q) ? null : 'p and q must be in the tree'),
    code: `
TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
    if (root == null || root == p || root == q) return root;
    TreeNode l = lowestCommonAncestor(root.left, p, q);
    TreeNode r = lowestCommonAncestor(root.right, p, q);
    if (l != null && r != null) return root;   // p and q are on different sides
    return l != null ? l : r;                  // pass up whatever was found
}`,
    run({ tree, p, q }, t) {
      const T = V.H.tree(tree);
      const sub = {}, cls = {};
      for (const [k, n] of Object.entries(T.nodes)) if (n.v === p || n.v === q) cls[k] = 'blue';
      const view = (cur) => [{ t: 'tree', label: `p = ${p}, q = ${q} (returned values shown under nodes)`, root: T.root, nodes: T.nodes, cls: { ...cls, ...(cur ? { [cur]: 'active' } : {}) }, sub }];
      let answer = null;
      (function lca(k) {
        if (!k) return null;
        const v = T.nodes[k].v;
        if (v === p || v === q) { sub[k] = `→${v}`; t.step(2, `${v} is ${v === p ? 'p' : 'q'}: return it immediately. The other target might be below it, and then this node is the LCA.`, view(k)); return v; }
        t.step(3, `At ${v}: search both subtrees.`, view(k));
        const l = lca(T.nodes[k].l), r = lca(T.nodes[k].r);
        if (l !== null && r !== null) { sub[k] = `LCA`; cls[k] = 'ok'; answer = v; t.step(5, `${v} got ${l} from the left and ${r} from the right: p and q split here, so <b>${v} is the LCA</b>.`, view(k)); return v; }
        const ret = l !== null ? l : r;
        sub[k] = ret === null ? '→null' : `→${ret}`;
        t.step(6, `${v} passes up ${ret === null ? 'null' : ret}.`, view(k));
        return ret;
      })(T.root);
      if (answer === null) t.step(6, `No split point: the answer is the node that was returned all the way up (one target is an ancestor of the other).`, view());
    },
  });

  /* ═════════════ Heaps ═════════════ */
  const heapView = (q, label, c = {}) => {
    const nodes = {};
    q.forEach((v, i) => { nodes['h' + i] = { v, l: 2 * i + 1 < q.length ? 'h' + (2 * i + 1) : null, r: 2 * i + 2 < q.length ? 'h' + (2 * i + 2) : null }; });
    const tc = {}; for (const [i, k] of Object.entries(c)) tc['h' + i] = k;
    return { t: 'tree', label, root: q.length ? 'h0' : null, nodes, cls: tc, dx: 40 };
  };
  const push = (q, v, less) => { q.push(v); let k = q.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (!less(q[k], q[p])) break; [q[k], q[p]] = [q[p], q[k]]; k = p; } };
  const pop = (q, less) => { const top = q[0]; const last = q.pop(); if (q.length) { q[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let s = k; if (l < q.length && less(q[l], q[s])) s = l; if (r < q.length && less(q[r], q[s])) s = r; if (s === k) break; [q[k], q[s]] = [q[s], q[k]]; k = s; } } return top; };

  add('topKHeap', {
    title: 'Top-K with a size-k min-heap', sub: 'The heap holds the k largest seen so far; its root is the smallest of them, which is the first to go.',
    inputs: [{ key: 'nums', label: 'nums', type: 'ints', def: [3, 2, 1, 5, 6, 4, 8, 7] }, { key: 'k', label: 'k', type: 'int', def: 3 }],
    check: ({ nums, k }) => (k < 1 || k > nums.length ? 'need 1 ≤ k ≤ n' : null),
    code: `
int findKthLargest(int[] nums, int k) {
    PriorityQueue<Integer> heap = new PriorityQueue<>();   // min-heap
    for (int x : nums) {
        heap.offer(x);
        if (heap.size() > k) heap.poll();   // drop the smallest: it can't be in the top k
    }
    return heap.peek();                     // smallest of the k largest = k-th largest
}`,
    run({ nums, k }, t) {
      const q = []; const less = (a, b) => a < b;
      nums.forEach((x, i) => {
        push(q, x, less);
        t.step(4, `offer(${x}).`, [{ t: 'array', label: 'nums', a: nums, ptr: { i }, cls: { [i]: 'active' } }, heapView(q, `min-heap (size ${q.length})`, { [q.indexOf(x)]: 'active' })]);
        if (q.length > k) {
          const out = q[0];
          t.step(5, `Size ${q.length} &gt; k: poll the root ${out}. ${out} is smaller than k others, so it can't be in the top ${k}.`, [{ t: 'array', label: 'nums', a: nums, ptr: { i } }, heapView(q, 'min-heap', { 0: 'bad' })]);
          pop(q, less);
        }
      });
      t.step(7, `The heap holds the ${k} largest: [${[...q].sort((a, b) => b - a).join(', ')}]. Its root <b>${q[0]}</b> is the ${k}-th largest. O(n log k) time, O(k) space.`, [{ t: 'array', label: 'nums', a: nums }, heapView(q, 'min-heap', { 0: 'ok' })]);
    },
  });

  add('twoHeapsMedian', {
    title: 'Running median with two heaps', sub: 'A max-heap holds the smaller half and a min-heap the larger half. Keep them balanced; the median sits at the tops.',
    inputs: [{ key: 'nums', label: 'stream', type: 'ints', def: [5, 15, 1, 3, 8, 7, 9, 10, 6] }],
    code: `
PriorityQueue<Integer> low = new PriorityQueue<>(Collections.reverseOrder()); // max-heap
PriorityQueue<Integer> high = new PriorityQueue<>();                          // min-heap

void addNum(int x) {
    low.offer(x);
    high.offer(low.poll());                 // move low's max across: keeps every low <= every high
    if (high.size() > low.size())
        low.offer(high.poll());             // rebalance: low may have one extra
}

double findMedian() {
    return low.size() > high.size() ? low.peek() : (low.peek() + high.peek()) / 2.0;
}`,
    run({ nums }, t) {
      const low = [], high = []; const gt = (a, b) => a > b, lt = (a, b) => a < b;
      const view = (msgExtra) => [
        { t: 'row', items: [heapView(low, `low: max-heap (${low.length})`, { 0: 'blue' }), heapView(high, `high: min-heap (${high.length})`, { 0: 'cmp' })] },
        { t: 'vars', v: { median: low.length ? (low.length > high.length ? low[0] : (low[0] + high[0]) / 2) : '—', ...(msgExtra || {}) } },
      ];
      nums.forEach((x) => {
        push(low, x, gt);
        t.step(5, `add ${x}: push it into low.`, view());
        const m = pop(low, gt); push(high, m, lt);
        t.step(6, `Move low's max (${m}) to high, so everything in low ≤ everything in high.`, view());
        if (high.length > low.length) { const n = pop(high, lt); push(low, n, gt); t.step(8, `high is bigger: move its min (${n}) back to low.`, view()); }
        t.step(12, `Median = ${low.length > high.length ? `low's top ${low[0]}` : `(${low[0]} + ${high[0]}) / 2`} = <b>${low.length > high.length ? low[0] : (low[0] + high[0]) / 2}</b>.`, view());
      });
      t.step(12, 'Each add is O(log n) and each median read O(1). A sorted list would need O(n) inserts.', view());
    },
  });

  add('kWayMerge', {
    title: 'K-way merge with a heap', sub: 'The heap holds the current head of each list; pop the smallest, then push that list’s next element.',
    inputs: [{ key: 'lists', label: 'sorted lists', type: 'matrix', def: [[1, 4, 7, 10], [2, 5, 8], [3, 6, 9, 12]] }],
    check: ({ lists }) => (lists.length > 6 || lists.flat().length > 24 ? 'at most 6 lists, 24 values' : null),
    code: `
ListNode mergeKLists(ListNode[] lists) {
    PriorityQueue<ListNode> pq = new PriorityQueue<>((a, b) -> Integer.compare(a.val, b.val));
    for (ListNode head : lists) if (head != null) pq.offer(head);
    ListNode dummy = new ListNode(0), tail = dummy;
    while (!pq.isEmpty()) {
        ListNode n = pq.poll();              // smallest head overall
        tail.next = n; tail = n;
        if (n.next != null) pq.offer(n.next);
    }
    return dummy.next;
}`,
    run({ lists }, t) {
      const idx = lists.map(() => 0); const q = []; const out = [];
      const less = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
      const view = () => [
        { t: 'row', items: lists.map((l, i) => ({ t: 'stack', label: `list ${i}`, a: l.slice(idx[i]), kind: 'list', cls: { 0: 'cmp' } })) },
        heapView(q.map((e) => e[0]), `heap of heads (${q.length})`, { 0: 'active' }),
        { t: 'stack', label: 'merged', a: out.slice(), kind: 'list' },
      ];
      lists.forEach((l, i) => { if (l.length) push(q, [l[0], i], less); });
      t.step(3, `Push the head of each of the ${lists.length} lists.`, view());
      while (q.length) {
        const [v, i] = pop(q, less); out.push(v); idx[i]++;
        if (idx[i] < lists[i].length) push(q, [lists[i][idx[i]], i], less);
        t.step(7, `Pop ${v} (from list ${i}) → append it. ${idx[i] < lists[i].length ? `Push list ${i}'s next value, ${lists[i][idx[i]]}.` : `List ${i} is exhausted.`}`, view());
      }
      t.step(11, `Merged ${out.length} values. Every value goes through the heap once: O(N log k), where k is the number of lists.`, view());
    },
  });

  /* ═════════════ Tries ═════════════ */
  add('trieBuild', {
    title: 'Building and searching a trie', sub: 'Each edge is a character; words share nodes for shared prefixes. Filled nodes mark the end of a word.',
    inputs: [{ key: 'words', label: 'insert', type: 'strs', def: ['car', 'cart', 'care', 'cat', 'dog', 'do'] }, { key: 'query', label: 'search / startsWith', type: 'str', def: 'car' }],
    check: ({ words }) => (words.length > 10 || words.some((w) => !/^[a-z]{1,8}$/.test(w)) ? 'up to 10 lowercase words, 1–8 letters' : null),
    code: `
class Trie {
    private final Trie[] next = new Trie[26];
    private boolean end;                          // a word ends here

    void insert(String w) {
        Trie node = this;
        for (char c : w.toCharArray()) {
            if (node.next[c - 'a'] == null) node.next[c - 'a'] = new Trie();
            node = node.next[c - 'a'];
        }
        node.end = true;
    }

    boolean search(String w) { Trie n = walk(w); return n != null && n.end; }
    boolean startsWith(String p) { return walk(p) != null; }

    private Trie walk(String s) {
        Trie node = this;
        for (char c : s.toCharArray()) { node = node.next[c - 'a']; if (node == null) return null; }
        return node;
    }
}`,
    run({ words, query }, t) {
      const nodes = [{ id: 'r', parent: null, text: '•', end: false, ch: {} }];
      const byId = { r: nodes[0] }; let n = 0;
      const view = (path = [], extra = {}) => [{ t: 'rtree', label: 'trie (root = •)', nodes: nodes.map((x) => ({ id: x.id, parent: x.parent, text: x.text, cls: [x.end ? 'done' : '', path.includes(x.id) ? 'active' : '', extra[x.id] || ''].join(' ') })) }];
      for (const w of words) {
        let cur = 'r'; const path = ['r']; let created = 0;
        for (const c of w) {
          if (!byId[cur].ch[c]) { const id = 'n' + n++; const node = { id, parent: cur, text: c, end: false, ch: {} }; nodes.push(node); byId[id] = node; byId[cur].ch[c] = id; created++; }
          cur = byId[cur].ch[c]; path.push(cur);
        }
        byId[cur].end = true;
        t.step(10, `insert("${w}"): ${created ? `${w.length - created} existing node(s) reused (shared prefix), ${created} new.` : 'every node already existed; just mark the end.'}`, view(path));
      }
      let cur = 'r'; const path = ['r'];
      for (const c of query) { const nx = byId[cur].ch[c]; if (!nx) { t.step(21, `search("${query}"): there's no '${c}' edge after "${query.slice(0, path.length - 1)}", so not found, and no word starts with it either.`, view(path)); return; } cur = nx; path.push(cur); }
      t.step(15, `Walked "${query}" in ${query.length} steps. startsWith → <b>true</b>; search → <b>${byId[cur].end}</b> ${byId[cur].end ? '(an end-of-word node)' : '(it’s only a prefix)'}. Time depends on the word length, not the number of words.`, view(path, { [cur]: byId[cur].end ? 'ok' : 'cmp' }));
    },
  });
})();

(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

// Deterministic random trees for large tests (level-order arrays like LeetCode's).
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function toLevel(nodes, root) {
  const out = [], q = [root];
  while (q.length) { const k = q.shift(); if (k === -1) { out.push(null); continue; } out.push(nodes[k].v); q.push(nodes[k].l, nodes[k].r); }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}
// random shape; values: 'perm' (distinct 1..n) or [lo, hi]
function randTree(n, seed, vals = 'perm') {
  const r = rng(seed); const nodes = [];
  const perm = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const val = (i) => (vals === 'perm' ? perm[i] : vals[0] + Math.floor(r() * (vals[1] - vals[0] + 1)));
  nodes.push({ v: val(0), l: -1, r: -1 });
  const open = [0];
  for (let i = 1; i < n; i++) {
    const oi = Math.floor(r() * open.length), p = open[oi];
    nodes.push({ v: val(i), l: -1, r: -1 });
    if (nodes[p].l === -1 && (nodes[p].r !== -1 || r() < 0.5)) nodes[p].l = i; else nodes[p].r = i;
    if (nodes[p].l !== -1 && nodes[p].r !== -1) { open[oi] = open[open.length - 1]; open.pop(); }
    open.push(i);
  }
  return { level: toLevel(nodes, 0), nodes };
}
function balancedBST(values) {
  const nodes = [];
  const build = (lo, hi) => { if (lo > hi) return -1; const m = (lo + hi) >> 1; const k = nodes.length; nodes.push({ v: values[m], l: -1, r: -1 }); nodes[k].l = build(lo, m - 1); nodes[k].r = build(m + 1, hi); return k; };
  const root = build(0, values.length - 1);
  return toLevel(nodes, root);
}
function orders(nodes) {
  const pre = [], ino = [];
  const walk = (k) => { if (k === -1) return; pre.push(nodes[k].v); walk(nodes[k].l); ino.push(nodes[k].v); walk(nodes[k].r); };
  walk(0);
  return [pre, ino];
}
const BIG = randTree(3000, 11), BIG2 = randTree(3000, 12);
const BST_BIG = balancedBST(Array.from({ length: 4095 }, (_, i) => 2 * i + 1));

DSA.module({
  id: 'trees', title: 'Trees: DFS, BFS & BSTs', short: 'Trees',
  blurb: 'Recursive thinking on binary trees: what each call returns, carrying state down vs results up, level-order traversal, and the binary-search-tree invariant.',
  intro: M`
    Tree problems are recursion problems. The single most useful habit: before writing code, say **what your function returns for a subtree**. Once that's clear, the code is usually five lines: handle null, recurse left, recurse right, combine. This module drills that habit, then adds breadth-first traversal and binary search trees.

    **Input format** (as on LeetCode): trees are given in level order with «null» for missing children. «[3,9,20,null,null,15,7]» is 3 with children 9 and 20, where 20 has children 15 and 7.
  `,
  more: [
    lc(144, 'binary-tree-preorder-traversal', 'Binary Tree Preorder Traversal', 'easier'),
    lc(94, 'binary-tree-inorder-traversal', 'Binary Tree Inorder Traversal', 'easier'),
    lc(101, 'symmetric-tree', 'Symmetric Tree', 'easier'),
    lc(572, 'subtree-of-another-tree', 'Subtree of Another Tree', 'similar'),
    lc(112, 'path-sum', 'Path Sum', 'easier'),
    lc(111, 'minimum-depth-of-binary-tree', 'Minimum Depth of Binary Tree', 'similar'),
    lc(103, 'binary-tree-zigzag-level-order-traversal', 'Binary Tree Zigzag Level Order Traversal', 'variant'),
    lc(662, 'maximum-width-of-binary-tree', 'Maximum Width of Binary Tree', 'harder'),
    lc(437, 'path-sum-iii', 'Path Sum III', 'harder'),
    lc(337, 'house-robber-iii', 'House Robber III', 'harder'),
    lc(450, 'delete-node-in-a-bst', 'Delete Node in a BST', 'harder'),
    lc(108, 'convert-sorted-array-to-binary-search-tree', 'Convert Sorted Array to Binary Search Tree', 'easier'),
    lc(173, 'binary-search-tree-iterator', 'Binary Search Tree Iterator', 'similar'),
    lc(987, 'vertical-order-traversal-of-a-binary-tree', 'Vertical Order Traversal of a Binary Tree', 'harder'),
  ],
  items: [
    { lesson: 'tree-dfs', title: 'Tree recursion: what does my function return?', mins: 15,
      lede: 'Trust the recursion: assume the calls on the children work, and only decide how to combine their answers.',
      body: M`
        ## The node and the shape of every solution
        ~~~java
        public class TreeNode { int val; TreeNode left, right; }

        R solve(TreeNode node) {
            if (node == null) return BASE;          // 1. empty tree
            R l = solve(node.left);                  // 2. trust it works for the left subtree
            R r = solve(node.right);                 //    and the right
            return combine(node.val, l, r);          // 3. build this node's answer
        }
        ~~~
        The leap of faith is step 2. Don't trace the recursion all the way down in your head. Define what «solve» returns, assume it's true for the children, and check that «combine» makes it true for «node». That is an induction proof, and it's also how you explain the code to an interviewer.

        ## Traversal orders
        Where you "do the work" relative to the recursive calls gives the classic orders:

        @viz treeTraversal

        | Order | Visit node… | Typical use |
        |---|---|---|
        | Pre-order | before the children | copy or serialize a tree, pass information **down** (path sums, depth) |
        | In-order | between left and right | BSTs: produces **sorted order** |
        | Post-order | after the children | compute from children **up** (height, diameter, balanced, subtree sums) |

        ## Two directions of information
        **Top-down (pass state down as parameters).** The node needs something from its ancestors: current depth, path sum so far, the max value on the path, the allowed BST range. Pass it as an argument.
        ~~~java
        void dfs(TreeNode n, int depth, int maxSoFar) { ... dfs(n.left, depth + 1, Math.max(maxSoFar, n.val)); ... }
        ~~~
        **Bottom-up (return results up).** The node's answer depends on its subtrees: height, size, "is balanced", the best path. Return it.

        **Both at once, via a field.** Sometimes the value the *parent* needs differs from the global answer. Diameter is the classic: each call returns its height, while the best diameter seen anywhere is kept in a field (or a one-element array).

        @viz treeHeights

        :::key The "return one thing, record another" pattern
        Diameter, maximum path sum, longest univalue path, and binary tree cameras all look alike: the function returns the best **downward** path (which can extend to the parent), while a global tracks the best path that **bends** at the node (left + node + right), which can't extend further.
        :::

        ## Complexity
        Each node is visited once: O(n) time. The space is the recursion depth, O(h): O(log n) for balanced trees and O(n) for skewed ones. Mention that a skewed tree with 10⁵ nodes can overflow Java's stack, and that an iterative version with an explicit «ArrayDeque» fixes it.

        ## Signals
        - "Depth / height / diameter / balanced / count nodes" → post-order, return values.
        - "Path from root", "ancestors", "good nodes", "within range" → pre-order, parameters.
        - "Same tree / symmetric / subtree" → recurse on pairs of nodes.
        - "Path between any two nodes" (it may bend) → return the downward best, record the bending best globally.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'You need, for each node, whether its value is ≥ every value on the path from the root to it. Which direction should information flow?',
          options: ['Bottom-up: return the max from subtrees', 'Top-down: pass the max-so-far along the path as a parameter', 'Level-order BFS only', 'In-order traversal'],
          answer: 1, why: 'The condition depends on **ancestors**, so carry the running max down as a parameter. That’s LeetCode 1448, Count Good Nodes.' },
        { q: 'In the diameter solution, why doesn’t the function simply return the diameter of its subtree?',
          options: ['It could, but it would be slower', 'The parent needs the longest downward path (height) to extend; a path that bends at the child can’t be extended through the parent', 'Recursion can only return ints', 'Diameter requires BFS'],
          answer: 1, why: 'A bending path uses both children of a node and can’t continue upward. So return the height for the parent, and track bending paths in a separate global.' },
      ],
      practice: ['max-depth', 'invert-tree', 'same-tree', 'diameter', 'balanced-tree', 'count-good-nodes', 'path-sum-ii', 'max-path-sum'],
    },

    { problem: {
      id: 'max-depth', title: 'Maximum Depth', diff: 'easy',
      tags: ['tree DFS', 'post-order'],
      statement: M`
        Return the **maximum depth** of a binary tree: the number of nodes on the longest path from the root down to a leaf. An empty tree has depth 0.
      `,
      fn: { name: 'maxDepth', params: [['TreeNode', 'root']], ret: 'int' },
      tests: [
        { args: [[3, 9, 20, null, null, 15, 7]], ex: true, expect: 3 },
        { args: [[1, null, 2]], ex: true, expect: 2 },
        { args: [[]], expect: 0 },
        { args: [[0]], expect: 1 },
        { args: [[1, 2, 3, 4, null, null, 5, 6]], expect: 4 },
        { args: [{ $gen: 'chain', args: [2000, 1] }], big: true, expect: 2000, why: 'A completely skewed tree: depth = n.' },
        { args: [BIG.level], big: true },
      ],
      constraints: ['0 ≤ nodes ≤ 10⁴', '−100 ≤ val ≤ 100'],
      hints: [
        'If you knew the depths of the left and right subtrees, what’s the depth of the whole tree?',
        '«1 + max(leftDepth, rightDepth)». An empty tree has depth 0.',
        'That’s the entire recursion. For an iterative version, use BFS and count levels.',
      ],
      solution: {
        pattern: '**Post-order return value:** the simplest example of "combine the children’s answers".',
        intuition: 'The longest root-to-leaf path goes through the root and then down whichever subtree is deeper.',
        java: J`class Solution {
    public int maxDepth(TreeNode root) {
        if (root == null) return 0;
        return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
    }
}`,
        time: 'O(n)', space: 'O(h) stack',
        alts: [
          { name: 'BFS counting levels', time: 'O(n)', space: 'O(width)', note: 'Process the tree level by level; the number of levels is the depth. No recursion, so no stack overflow on skewed trees.',
            java: J`class Solution {
    public int maxDepth(TreeNode root) {
        if (root == null) return 0;
        Queue<TreeNode> q = new ArrayDeque<>();
        q.offer(root);
        int depth = 0;
        while (!q.isEmpty()) {
            depth++;
            for (int i = q.size(); i > 0; i--) {
                TreeNode n = q.poll();
                if (n.left != null) q.offer(n.left);
                if (n.right != null) q.offer(n.right);
            }
        }
        return depth;
    }
}` },
        ],
        followups: M`
          - **Minimum depth** (LeetCode 111): careful, a node with one child isn't a leaf, so «min(l, r)» needs special handling. BFS finds the first leaf level directly.
        `,
        talk: 'Depth of a tree is 1 plus the larger depth of its two subtrees, and 0 for null. O(n) time, O(h) stack; BFS avoids recursion if the tree may be very deep.',
      },
      viz: { id: 'treeHeights', input: { tree: [3, 9, 20, null, null, 15, 7] }, note: 'Heights are exactly depths measured from each node down: watch the value returned at the root.' },
      lc: [lc(104, 'maximum-depth-of-binary-tree', 'Maximum Depth of Binary Tree', 'same'), lc(111, 'minimum-depth-of-binary-tree', 'Minimum Depth of Binary Tree', 'variant'), lc(559, 'maximum-depth-of-n-ary-tree', 'Maximum Depth of N-ary Tree', 'variant')],
      drill: { prompt: 'Number of nodes on the longest root-to-leaf path of a binary tree.', pattern: 'tree-dfs', why: 'Post-order: 1 + max(depth(left), depth(right)).' },
    } },

    { problem: {
      id: 'invert-tree', title: 'Mirror a Tree', diff: 'easy',
      tags: ['tree DFS'],
      statement: M`
        Invert a binary tree: every node's left and right children swap places, at every level. Return the root.
      `,
      fn: { name: 'invertTree', params: [['TreeNode', 'root']], ret: 'TreeNode' },
      tests: [
        { args: [[4, 2, 7, 1, 3, 6, 9]], ex: true, expect: [4, 7, 2, 9, 6, 3, 1] },
        { args: [[2, 1, 3]], ex: true, expect: [2, 3, 1] },
        { args: [[]], expect: [] },
        { args: [[1]], expect: [1] },
        { args: [[1, 2]], expect: [1, null, 2] },
        { args: [[1, 2, 3, 4, null, null, 5]], expect: [1, 3, 2, 5, null, null, 4] },
        { args: [BIG.level], big: true },
      ],
      constraints: ['0 ≤ nodes ≤ 100 (large test: 3000)'],
      hints: [
        'What does the mirror of a tree look like in terms of the mirrors of its subtrees?',
        'The root stays; its new left is the mirrored old right, and its new right is the mirrored old left.',
        'Swap the children, then recurse into both (or recurse first, then swap).',
      ],
      solution: {
        pattern: '**Structural recursion:** transform the node and let recursion handle the subtrees.',
        intuition: 'Mirroring the whole tree = swap the root’s children + mirror each child subtree. Any order works as long as every node gets swapped exactly once.',
        java: J`class Solution {
    public TreeNode invertTree(TreeNode root) {
        if (root == null) return null;
        TreeNode left = invertTree(root.left);
        root.left = invertTree(root.right);
        root.right = left;
        return root;
    }
}`,
        time: 'O(n)', space: 'O(h)',
        pitfalls: M`
          - «root.left = invertTree(root.right); root.right = invertTree(root.left);» is a bug: the second line reads the *already replaced* «left». Save one side first.
        `,
        alts: [
          { name: 'Iterative with a queue', time: 'O(n)', space: 'O(width)', java: J`class Solution {
    public TreeNode invertTree(TreeNode root) {
        Queue<TreeNode> q = new ArrayDeque<>();
        if (root != null) q.offer(root);
        while (!q.isEmpty()) {
            TreeNode n = q.poll();
            TreeNode t = n.left; n.left = n.right; n.right = t;
            if (n.left != null) q.offer(n.left);
            if (n.right != null) q.offer(n.right);
        }
        return root;
    }
}` },
        ],
        talk: 'Recursively invert both subtrees and swap them. Saving one side first avoids overwriting. O(n) time, O(h) stack.',
      },
      lc: [lc(226, 'invert-binary-tree', 'Invert Binary Tree', 'same'), lc(101, 'symmetric-tree', 'Symmetric Tree', 'similar'), lc(951, 'flip-equivalent-binary-trees', 'Flip Equivalent Binary Trees', 'harder')],
      drill: { prompt: 'Swap every node’s left and right children in a binary tree.', pattern: 'tree-dfs', why: 'Structural recursion: swap and recurse on both subtrees.' },
    } },

    { problem: {
      id: 'same-tree', title: 'Identical Trees', diff: 'easy',
      tags: ['tree DFS', 'pairs'],
      statement: M`
        Given two binary trees, return «true» if they are **identical**: the same shape, with equal values in corresponding nodes.
      `,
      fn: { name: 'isSameTree', params: [['TreeNode', 'p'], ['TreeNode', 'q']], ret: 'boolean' },
      tests: [
        { args: [[1, 2, 3], [1, 2, 3]], ex: true, expect: true },
        { args: [[1, 2], [1, null, 2]], ex: true, expect: false },
        { args: [[1, 2, 1], [1, 1, 2]], ex: true, expect: false },
        { args: [[], []], expect: true },
        { args: [[1], []], expect: false },
        { args: [[5, 4, 6], [5, 4, 7]], expect: false },
        { args: [BIG.level, BIG.level], big: true, expect: true },
        { args: [BIG.level, BIG2.level], big: true, expect: false },
      ],
      constraints: ['0 ≤ nodes ≤ 100 (large tests: 3000)'],
      hints: [
        'Recurse on pairs of nodes at the same position.',
        'Both null → true. Exactly one null → false. Values differ → false.',
        'Otherwise both subtree pairs must be identical.',
      ],
      solution: {
        pattern: '**Recursion on pairs of nodes:** the template for same tree, symmetric tree, subtree check and merging trees.',
        intuition: 'Two trees are identical exactly when their roots match and their left subtrees are identical and their right subtrees are identical.',
        java: J`class Solution {
    public boolean isSameTree(TreeNode p, TreeNode q) {
        if (p == null || q == null) return p == q;        // both null, or exactly one
        return p.val == q.val && isSameTree(p.left, q.left) && isSameTree(p.right, q.right);
    }
}`,
        time: 'O(n)', space: 'O(h)',
        alts: [
          { name: 'Compare serializations', time: 'O(n)', space: 'O(n)', note: 'Serialize both with explicit nulls and compare strings. It’s the usual trick for "subtree of another tree" too (with separators to avoid «12» vs «1,2» confusions).',
            java: J`class Solution {
    public boolean isSameTree(TreeNode p, TreeNode q) {
        StringBuilder a = new StringBuilder(), b = new StringBuilder();
        ser(p, a); ser(q, b);
        return a.toString().equals(b.toString());
    }
    private void ser(TreeNode n, StringBuilder sb) {
        if (n == null) { sb.append("#,"); return; }        // null markers make the encoding unambiguous
        sb.append(n.val).append(',');
        ser(n.left, sb);
        ser(n.right, sb);
    }
}` },
        ],
        followups: M`
          - **Symmetric tree:** compare «(left.left, right.right)» and «(left.right, right.left)».
          - **Subtree of another tree:** run «isSameTree» at every node (O(m·n)), or compare serializations with a string search (O(m + n)).
        `,
        talk: 'Recurse on pairs: if either is null, they must both be null; otherwise the values match and both child pairs are identical. O(n).',
      },
      lc: [lc(100, 'same-tree', 'Same Tree', 'same'), lc(101, 'symmetric-tree', 'Symmetric Tree', 'variant'), lc(572, 'subtree-of-another-tree', 'Subtree of Another Tree', 'harder')],
      drill: { prompt: 'Decide whether two binary trees have identical structure and values.', pattern: 'tree-dfs', why: 'Recursion on pairs of nodes.' },
    } },

    { problem: {
      id: 'diameter', title: 'Diameter of a Tree', diff: 'easy',
      tags: ['post-order', 'global answer'],
      statement: M`
        The **diameter** of a binary tree is the number of **edges** on the longest path between any two nodes. The path may or may not pass through the root. Return it.
      `,
      fn: { name: 'diameterOfBinaryTree', params: [['TreeNode', 'root']], ret: 'int' },
      tests: [
        { args: [[1, 2, 3, 4, 5]], ex: true, expect: 3, why: '4 → 2 → 1 → 3 (or 5 → 2 → 1 → 3).' },
        { args: [[1, 2]], ex: true, expect: 1 },
        { args: [[1]], expect: 0 },
        { args: [[1, 2, null, 3, 4, 5, null, null, 6, 7, null, null, 8]], expect: 6, why: 'The longest path doesn’t touch the root.' },
        { args: [[4, -7, -3, null, null, -9, -3, 9, -7, -4, null, 6, null, -6, -6, null, null, 0, 6, 5, null, 9, null, null, -1, -4, null, null, null, -2]], expect: 8 },
        { args: [{ $gen: 'chain', args: [2000, 0] }], big: true, expect: 1999 },
        { args: [BIG.level], big: true },
      ],
      constraints: ['1 ≤ nodes ≤ 10⁴', '−100 ≤ val ≤ 100'],
      hints: [
        'Any path has a highest node where it "bends". Through that node, how long can it be?',
        '(Height of the left subtree) + (height of the right subtree), counting edges.',
        'Write a height function that returns heights, and have it update a global «best» with «left + right» at every node.',
      ],
      solution: {
        pattern: '**Return one thing, record another:** the recursion returns heights, and a global records the best path bending at any node.',
        intuition: M`
          Every path has a topmost node. The longest path topped at node «n» goes down the deepest branch on each side: «height(left) + height(right)» edges, where height counts nodes. Computing heights bottom-up visits every node as a potential top, so the maximum over all nodes is the diameter.
        `,
        java: J`class Solution {
    private int best = 0;

    public int diameterOfBinaryTree(TreeNode root) {
        height(root);
        return best;
    }

    private int height(TreeNode n) {               // nodes on the longest downward path
        if (n == null) return 0;
        int l = height(n.left), r = height(n.right);
        best = Math.max(best, l + r);              // edges on the path bending at n
        return 1 + Math.max(l, r);
    }
}`,
        time: 'O(n)', space: 'O(h)',
        pitfalls: M`
          - Returning «l + r» from the helper (the diameter) instead of the height: the parent can't extend a bending path.
          - Edges vs nodes: «l + r» with node-count heights gives edges. Check against «[1, 2]» → 1.
          - Computing height separately at every node is O(n²) on skewed trees.
        `,
        alts: [
          { name: 'Height recomputed at every node', time: 'O(n²) worst', space: 'O(h)', note: 'diameter(n) = max(h(l) + h(r), diameter(l), diameter(r)), recomputing h each time. Correct but quadratic on chains.',
            java: J`class Solution {
    public int diameterOfBinaryTree(TreeNode root) {
        if (root == null) return 0;
        return Math.max(h(root.left) + h(root.right), Math.max(diameterOfBinaryTree(root.left), diameterOfBinaryTree(root.right)));
    }
    private int h(TreeNode n) { return n == null ? 0 : 1 + Math.max(h(n.left), h(n.right)); }
}` },
        ],
        followups: M`
          - **Binary tree maximum path sum** (hard, below): the same structure with values, where negative branches are dropped.
          - **Diameter of an N-ary tree or a general tree:** track the top two child heights.
        `,
        talk: 'Every path bends at some top node, where its length is left height + right height. A height function returns 1 + max(l, r) and updates a global with l + r at each node. One pass, O(n).',
      },
      viz: { id: 'treeHeights' },
      lc: [lc(543, 'diameter-of-binary-tree', 'Diameter of Binary Tree', 'same'), lc(124, 'binary-tree-maximum-path-sum', 'Binary Tree Maximum Path Sum', 'harder'), lc(687, 'longest-univalue-path', 'Longest Univalue Path', 'variant'), lc(1522, 'diameter-of-n-ary-tree', 'Diameter of N-Ary Tree', 'variant', { premium: true })],
      drill: { prompt: 'Length (in edges) of the longest path between any two nodes of a binary tree.', pattern: 'tree-dfs', why: 'Post-order heights; at each node, left + right is a candidate recorded globally.' },
    } },

    { problem: {
      id: 'balanced-tree', title: 'Height-Balanced Check', diff: 'easy',
      tags: ['post-order', 'sentinel'],
      statement: M`
        A binary tree is **height-balanced** if, at **every** node, the heights of the left and right subtrees differ by at most 1. Return whether the given tree is balanced.
      `,
      fn: { name: 'isBalanced', params: [['TreeNode', 'root']], ret: 'boolean' },
      tests: [
        { args: [[3, 9, 20, null, null, 15, 7]], ex: true, expect: true },
        { args: [[1, 2, 2, 3, 3, null, null, 4, 4]], ex: true, expect: false },
        { args: [[]], ex: true, expect: true },
        { args: [[1, 2, 2, 3, null, null, 3, 4, null, null, 4]], expect: false, why: 'The root’s subtrees have equal heights, but deeper nodes are unbalanced.' },
        { args: [[1, null, 2]], expect: true },
        { args: [[1, null, 2, null, 3]], expect: false },
        { args: [BST_BIG], big: true, expect: true },
        { args: [{ $gen: 'chain', args: [2000, 1] }], big: true, expect: false },
      ],
      constraints: ['0 ≤ nodes ≤ 5000'],
      hints: [
        'Checking "|height(left) − height(right)| ≤ 1" at every node with a separate height function is O(n²). Can one pass compute heights and check balance?',
        'Let the height function return −1 when a subtree is unbalanced, and propagate that −1 upward.',
        'At each node: if either child returned −1, or the heights differ by more than 1, return −1; otherwise return the height.',
      ],
      solution: {
        pattern: '**Post-order with a sentinel:** fold "is it valid?" into the returned value (−1 = invalid) so one pass does both jobs.',
        intuition: 'Balance at a node needs the children’s heights, which the height recursion computes anyway. Encode "already unbalanced somewhere below" as a special height, −1, and stop comparing once it appears.',
        java: J`class Solution {
    public boolean isBalanced(TreeNode root) {
        return height(root) != -1;
    }

    private int height(TreeNode n) {                // -1 means "unbalanced below"
        if (n == null) return 0;
        int l = height(n.left);
        if (l == -1) return -1;
        int r = height(n.right);
        if (r == -1 || Math.abs(l - r) > 1) return -1;
        return 1 + Math.max(l, r);
    }
}`,
        time: 'O(n)', space: 'O(h)',
        pitfalls: M`
          - Checking balance only at the root misses deeper imbalance (test 4).
          - Top-down: calling «height» inside «isBalanced» at every node recomputes heights, O(n²).
        `,
        alts: [
          { name: 'Top-down with repeated heights', time: 'O(n²) worst, O(n log n) balanced', space: 'O(h)', java: J`class Solution {
    public boolean isBalanced(TreeNode root) {
        if (root == null) return true;
        return Math.abs(h(root.left) - h(root.right)) <= 1 && isBalanced(root.left) && isBalanced(root.right);
    }
    private int h(TreeNode n) { return n == null ? 0 : 1 + Math.max(h(n.left), h(n.right)); }
}` },
        ],
        talk: 'One post-order pass: the helper returns the height, or −1 if any subtree is unbalanced, propagating −1 upward. O(n) instead of the O(n²) top-down version.',
      },
      lc: [lc(110, 'balanced-binary-tree', 'Balanced Binary Tree', 'same'), lc(1382, 'balance-a-binary-search-tree', 'Balance a Binary Search Tree', 'harder'), lc(104, 'maximum-depth-of-binary-tree', 'Maximum Depth of Binary Tree', 'easier')],
      drill: { prompt: 'Is a binary tree balanced (subtree heights differ by ≤ 1 at every node)?', pattern: 'tree-dfs', why: 'Post-order heights with −1 as an “unbalanced” sentinel: one pass.' },
    } },

    { problem: {
      id: 'count-good-nodes', title: 'Count Good Nodes', diff: 'medium',
      tags: ['top-down', 'parameters'],
      statement: M`
        A node is **good** if no node on the path from the root to it (including the root) has a **greater** value. Return the number of good nodes. The root is always good.
      `,
      fn: { name: 'goodNodes', params: [['TreeNode', 'root']], ret: 'int' },
      tests: [
        { args: [[3, 1, 4, 3, null, 1, 5]], ex: true, expect: 4, why: '3 (root), 4, 5, and the left 3 (the path 3 → 1 → 3 has max 3).' },
        { args: [[3, 3, null, 4, 2]], ex: true, expect: 3 },
        { args: [[1]], expect: 1 },
        { args: [[9, 8, 7, 6]], expect: 1 },
        { args: [[1, 2, 3, 4, 5, 6, 7]], expect: 7 },
        { args: [[-1, 5, -2, 4, 4, 2, -2, null, null, -4, null, -2, 3, null, -2, 0, null, -1, null, -3, null, -4, -3, 3, null, null, null, null, null, null, null, 3, -3]], expect: 5 },
        { args: [randTree(3000, 13, [-10000, 10000]).level], big: true },
      ],
      constraints: ['1 ≤ nodes ≤ 10⁵ (large test: 3000)', '−10⁴ ≤ val ≤ 10⁴'],
      hints: [
        'Whether a node is good depends on its **ancestors**, not its descendants.',
        'Pass the maximum value seen on the path so far down as a parameter.',
        'good += (node.val ≥ maxSoFar); recurse with «max(maxSoFar, node.val)».',
      ],
      solution: {
        pattern: '**Top-down state:** carry path information down as arguments. It’s the counterpart to returning results up.',
        intuition: 'Each node only needs one fact about its path: the largest value above it. The caller knows that fact and hands it down, updating it with its own value.',
        java: J`class Solution {
    public int goodNodes(TreeNode root) {
        return count(root, Integer.MIN_VALUE);
    }

    private int count(TreeNode n, int maxSoFar) {
        if (n == null) return 0;
        int good = n.val >= maxSoFar ? 1 : 0;
        int m = Math.max(maxSoFar, n.val);
        return good + count(n.left, m) + count(n.right, m);
    }
}`,
        time: 'O(n)', space: 'O(h)',
        pitfalls: M`
          - «>» instead of «>=»: equal values still count as good.
          - Starting maxSoFar at 0 wrongly excludes negative roots.
        `,
        alts: [
          { name: 'Iterative DFS with (node, max) pairs', time: 'O(n)', space: 'O(h)', java: J`class Solution {
    public int goodNodes(TreeNode root) {
        Deque<Object[]> st = new ArrayDeque<>();
        st.push(new Object[]{root, Integer.MIN_VALUE});
        int good = 0;
        while (!st.isEmpty()) {
            Object[] top = st.pop();
            TreeNode n = (TreeNode) top[0]; int m = (Integer) top[1];
            if (n == null) continue;
            if (n.val >= m) good++;
            int nm = Math.max(m, n.val);
            st.push(new Object[]{n.left, nm}); st.push(new Object[]{n.right, nm});
        }
        return good;
    }
}` },
        ],
        talk: 'Pass the max value on the root-to-node path as a parameter. A node is good if its value is at least that max; recurse with the updated max. O(n).',
      },
      lc: [lc(1448, 'count-good-nodes-in-binary-tree', 'Count Good Nodes in Binary Tree', 'same'), lc(1026, 'maximum-difference-between-node-and-ancestor', 'Maximum Difference Between Node and Ancestor', 'variant'), lc(129, 'sum-root-to-leaf-numbers', 'Sum Root to Leaf Numbers', 'similar')],
      drill: { prompt: 'Count nodes whose value is ≥ every value on the path from the root to them.', pattern: 'tree-dfs', why: 'Top-down DFS carrying the path maximum as a parameter.' },
    } },

    { problem: {
      id: 'path-sum-ii', title: 'All Root-to-Leaf Paths With a Sum', diff: 'medium',
      tags: ['DFS', 'backtracking on a tree'],
      statement: M`
        Return every **root-to-leaf** path whose node values add up to «targetSum». Each path is a list of values from the root to the leaf. Paths may be returned in any order.
      `,
      fn: { name: 'pathSum', params: [['TreeNode', 'root'], ['int', 'targetSum']], ret: 'List<List<Integer>>' },
      compare: 'unordered',
      tests: [
        { args: [[5, 4, 8, 11, null, 13, 4, 7, 2, null, null, 5, 1], 22], ex: true, expect: [[5, 4, 11, 2], [5, 8, 4, 5]] },
        { args: [[1, 2, 3], 5], ex: true, expect: [] },
        { args: [[1, 2], 0], expect: [] },
        { args: [[], 0], expect: [] },
        { args: [[1, 2], 1], expect: [], why: 'The root isn’t a leaf here, so the path must end at node 2.' },
        { args: [[-2, null, -3], -5], expect: [[-2, -3]] },
        { args: [[1, -2, -3, 1, 3, -2, null, -1], -1], expect: [[1, -2, 1, -1]] },
        { args: [[0, 1, 1], 1], expect: [[0, 1], [0, 1]] },
        { args: [randTree(3000, 14, [-3, 3]).level, 4], big: true },
      ],
      constraints: ['0 ≤ nodes ≤ 5000', '−1000 ≤ val, targetSum ≤ 1000'],
      hints: [
        'Walk down from the root keeping the current path and the remaining sum.',
        'At a leaf, if the remaining sum equals the leaf’s value, record a **copy** of the path.',
        'Add the node to the path before recursing and remove it afterwards (backtrack), so a single list serves the whole traversal.',
      ],
      solution: {
        pattern: '**DFS with a shared path and backtracking:** add on the way down, remove on the way up, and copy on success.',
        intuition: 'Every root-to-leaf path is one branch of the DFS. Maintain the current path in one list, append the node when entering, and remove it when leaving. The list then always equals the path to the current node.',
        java: J`class Solution {
    public List<List<Integer>> pathSum(TreeNode root, int targetSum) {
        List<List<Integer>> res = new ArrayList<>();
        dfs(root, targetSum, new ArrayList<>(), res);
        return res;
    }

    private void dfs(TreeNode n, int remaining, List<Integer> path, List<List<Integer>> res) {
        if (n == null) return;
        path.add(n.val);
        if (n.left == null && n.right == null && remaining == n.val) res.add(new ArrayList<>(path)); // copy!
        else {
            dfs(n.left, remaining - n.val, path, res);
            dfs(n.right, remaining - n.val, path, res);
        }
        path.remove(path.size() - 1);                                                        // backtrack
    }
}`,
        time: 'O(n · h)', space: 'O(h) besides the output', timeWhy: 'copying a path costs O(h), up to once per leaf',
        pitfalls: M`
          - Adding «path» itself instead of a copy: every result aliases the same list, which ends up empty.
          - «path.remove(Integer)» vs «remove(int)»: remove by **index** («size() − 1»).
          - Checking the sum at null children counts paths that end at a node with one child. Only leaves count.
        `,
        alts: [
          { name: 'New list per call (no backtracking)', time: 'O(n · h)', space: 'O(n · h)', note: 'Pass «new ArrayList<>(path)» into each child. Simpler, but copies at every node.',
            java: J`class Solution {
    public List<List<Integer>> pathSum(TreeNode root, int targetSum) {
        List<List<Integer>> res = new ArrayList<>();
        go(root, targetSum, new ArrayList<>(), res);
        return res;
    }
    private void go(TreeNode n, int rem, List<Integer> path, List<List<Integer>> res) {
        if (n == null) return;
        List<Integer> p = new ArrayList<>(path); p.add(n.val);
        if (n.left == null && n.right == null) { if (rem == n.val) res.add(p); return; }
        go(n.left, rem - n.val, p, res); go(n.right, rem - n.val, p, res);
    }
}` },
        ],
        followups: M`
          - **Paths may start and end anywhere going downward** (LeetCode 437): prefix sums along the path plus a hash map, the Module 02 trick on a tree.
        `,
        talk: 'DFS carrying the remaining sum and a shared path list. Add the node, record a copy at a matching leaf, recurse into the children, then remove the node (backtrack). O(n·h) including the copies.',
      },
      lc: [lc(113, 'path-sum-ii', 'Path Sum II', 'same'), lc(112, 'path-sum', 'Path Sum', 'easier'), lc(437, 'path-sum-iii', 'Path Sum III', 'harder'), lc(257, 'binary-tree-paths', 'Binary Tree Paths', 'easier')],
      drill: { prompt: 'List every root-to-leaf path in a tree whose values sum to a target.', pattern: 'backtracking', why: 'DFS with a shared path list: add, recurse, remove (backtracking on a tree).' },
    } },

    { problem: {
      id: 'max-path-sum', title: 'Maximum Path Sum', diff: 'hard',
      tags: ['post-order', 'global answer'],
      statement: M`
        A **path** is a sequence of nodes where each adjacent pair is connected by an edge, and no node appears twice. It doesn't have to pass through the root, and it has at least one node. Return the **maximum sum** of node values over all paths. Values can be negative.
      `,
      fn: { name: 'maxPathSum', params: [['TreeNode', 'root']], ret: 'int' },
      tests: [
        { args: [[1, 2, 3]], ex: true, expect: 6 },
        { args: [[-10, 9, 20, null, null, 15, 7]], ex: true, expect: 42, why: '15 → 20 → 7.' },
        { args: [[-3]], expect: -3, why: 'All negative: the best path is the single largest node.' },
        { args: [[2, -1]], expect: 2 },
        { args: [[-2, -1]], expect: -1 },
        { args: [[5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1]], expect: 48 },
        { args: [[1, -2, -3, 1, 3, -2, null, -1]], expect: 3 },
        { args: [[9, 6, -3, null, null, -6, 2, null, null, 2, null, -6, -6, -6]], expect: 16 },
        { args: [randTree(3000, 15, [-1000, 1000]).level], big: true },
      ],
      constraints: ['1 ≤ nodes ≤ 3·10⁴', '−1000 ≤ val ≤ 1000'],
      hints: [
        'Like the diameter: every path has a topmost node where it bends. What’s the best path topped at node n?',
        '«n.val + (best downward gain on the left) + (best downward gain on the right)», where a negative gain should be replaced by 0 (skip that side).',
        'Return to the parent only one branch: «n.val + max(0, leftGain, rightGain)»; record the bending sum globally.',
      ],
      solution: {
        pattern: '**Return one thing, record another,** with values: return the best downward gain (clamped at 0), and record the best bending path.',
        intuition: M`
          A path bending at «n» uses n plus optionally the best downward path into each child. "Optionally" matters: a subtree whose best downward sum is negative only hurts, so clamp it to 0. The parent can only extend one branch through n, so return «n.val + max(left, right)» (with both clamped).
        `,
        java: J`class Solution {
    private int best = Integer.MIN_VALUE;

    public int maxPathSum(TreeNode root) {
        gain(root);
        return best;
    }

    private int gain(TreeNode n) {                     // best sum of a path going DOWN from n
        if (n == null) return 0;
        int l = Math.max(0, gain(n.left));              // negative branches: skip them
        int r = Math.max(0, gain(n.right));
        best = Math.max(best, n.val + l + r);           // path bending at n
        return n.val + Math.max(l, r);                  // only one side can continue upward
    }
}`,
        time: 'O(n)', space: 'O(h)',
        pitfalls: M`
          - Initialising «best» to 0 fails on all-negative trees. Start at «Integer.MIN_VALUE», or at the root's value.
          - Clamping the returned value at 0 as well («return max(0, …)») is fine, as long as you still count «n.val» in «best» on its own.
        `,
        alts: [
          { name: 'Recompute downward gains everywhere', time: 'O(n²) worst', space: 'O(h)', note: 'For each node, compute max downward sums of its children separately. The same idea without memoization.', check: false },
        ],
        followups: M`
          - **Longest univalue path**, **binary tree cameras**, **house robber III**: the same "return downward state, record the global" structure.
        `,
        talk: 'Each path bends at a top node: value plus the best non-negative downward gains from both children, recorded globally. The helper returns value + max(left, right), since only one branch can extend to the parent. Negative gains are clamped to 0. O(n).',
      },
      lc: [lc(124, 'binary-tree-maximum-path-sum', 'Binary Tree Maximum Path Sum', 'same'), lc(543, 'diameter-of-binary-tree', 'Diameter of Binary Tree', 'easier'), lc(687, 'longest-univalue-path', 'Longest Univalue Path', 'similar'), lc(2246, 'longest-path-with-different-adjacent-characters', 'Longest Path With Different Adjacent Characters', 'harder')],
      drill: { prompt: 'Maximum sum of values along any path (any start/end, may bend) in a tree with negative values.', pattern: 'tree-dfs', why: 'Post-order: return the best downward gain (clamped at 0), record the best bending path globally.' },
    } },

    { lesson: 'tree-bfs', title: 'Breadth-first: level by level', mins: 7,
      lede: 'A queue visits nodes in order of distance from the root. Snapshot its size to process one level at a time.',
      body: M`
        ## The template
        @viz treeBFS

        ~~~java Template: level-order traversal
        Queue<TreeNode> q = new ArrayDeque<>();
        if (root != null) q.offer(root);
        while (!q.isEmpty()) {
            int size = q.size();                  // everything in the queue right now is one level
            for (int i = 0; i < size; i++) {
                TreeNode n = q.poll();
                // ... process n (first on its level when i == 0, last when i == size - 1) ...
                if (n.left != null) q.offer(n.left);
                if (n.right != null) q.offer(n.right);
            }
            // ... end of level ...
        }
        ~~~
        The «size» snapshot is the key: children added during the loop belong to the next level and wait their turn.

        ## BFS vs DFS on trees
        | Prefer BFS when… | Prefer DFS when… |
        |---|---|
        | The answer is **per level** (averages, right side view, zigzag) | The answer combines subtrees (height, diameter, paths) |
        | You want the **shallowest** something (minimum depth, nearest leaf): BFS stops early | You need ancestor state on the path |
        | The tree is very deep (recursion might overflow) | The tree is very wide (the queue holds a whole level) |

        Many level problems can also be done with DFS by passing the depth and writing into «res.get(depth)». Right side view is "the first node you see at each new depth" in a right-first DFS.

        ## Signals
        - "Level order", "each level", "zigzag", "average of levels", "largest value in each row" → BFS with the size snapshot.
        - "Right/left side view" → last/first node of each level.
        - "Minimum depth", "nearest leaf", "fewest steps" → BFS, which stops at the first hit.

        @quiz 0
      `,
      quiz: [
        { q: 'Why is BFS a better fit than DFS for "minimum depth of a binary tree"?',
          options: ['BFS uses less memory', 'BFS reaches nodes in order of depth, so the first leaf it meets is the answer and it can stop immediately', 'DFS can’t compute depths', 'They are equivalent in every case'],
          answer: 1, why: 'DFS must explore every branch to be sure it found the shallowest leaf; BFS finds it first and stops.' },
      ],
      practice: ['level-order', 'right-side-view'],
    },

    { problem: {
      id: 'level-order', title: 'Level Order Traversal', diff: 'medium',
      tags: ['BFS', 'queue'],
      statement: M`
        Return the values of a binary tree **level by level**: a list of levels, each listing its values from left to right.
      `,
      fn: { name: 'levelOrder', params: [['TreeNode', 'root']], ret: 'List<List<Integer>>' },
      tests: [
        { args: [[3, 9, 20, null, null, 15, 7]], ex: true, expect: [[3], [9, 20], [15, 7]] },
        { args: [[1]], ex: true, expect: [[1]] },
        { args: [[]], ex: true, expect: [] },
        { args: [[1, 2, 3, 4, null, null, 5]], expect: [[1], [2, 3], [4, 5]] },
        { args: [[1, null, 2, null, 3]], expect: [[1], [2], [3]] },
        { args: [BIG.level], big: true },
      ],
      constraints: ['0 ≤ nodes ≤ 2000 (large test: 3000)'],
      hints: [
        'Visit nodes in order of their distance from the root. Which data structure gives first-in, first-out?',
        'A queue. The trick is knowing where one level ends and the next begins.',
        'At the start of each level, «size = queue.size()» is exactly the number of nodes on it. Poll that many.',
      ],
      solution: {
        pattern: '**BFS with a level-size snapshot:** the template for every per-level tree question.',
        intuition: 'A queue processes nodes in the order they were discovered, which for a tree is level by level. Snapshotting the size separates the levels.',
        java: J`class Solution {
    public List<List<Integer>> levelOrder(TreeNode root) {
        List<List<Integer>> res = new ArrayList<>();
        Queue<TreeNode> q = new ArrayDeque<>();
        if (root != null) q.offer(root);
        while (!q.isEmpty()) {
            int size = q.size();
            List<Integer> level = new ArrayList<>(size);
            for (int i = 0; i < size; i++) {
                TreeNode n = q.poll();
                level.add(n.val);
                if (n.left != null) q.offer(n.left);
                if (n.right != null) q.offer(n.right);
            }
            res.add(level);
        }
        return res;
    }
}`,
        time: 'O(n)', space: 'O(width)',
        pitfalls: M`
          - Using «q.size()» directly in the for-loop condition: it changes as you offer children.
          - «ArrayDeque» rejects nulls, so check children before offering (as above).
        `,
        alts: [
          { name: 'DFS with a depth index', time: 'O(n)', space: 'O(h)', note: 'Recurse with depth; when «depth == res.size()», add a new level list. Pre-order (left before right) keeps left-to-right order within levels.',
            java: J`class Solution {
    public List<List<Integer>> levelOrder(TreeNode root) {
        List<List<Integer>> res = new ArrayList<>();
        dfs(root, 0, res);
        return res;
    }
    private void dfs(TreeNode n, int d, List<List<Integer>> res) {
        if (n == null) return;
        if (d == res.size()) res.add(new ArrayList<>());
        res.get(d).add(n.val);
        dfs(n.left, d + 1, res);
        dfs(n.right, d + 1, res);
    }
}` },
        ],
        followups: M`
          - **Zigzag** (LeetCode 103): add to the front of the level list on odd levels (use a «LinkedList» or reverse).
          - **Bottom-up** (LeetCode 107): reverse the result, or add levels at the front.
          - **Connect next pointers** (LeetCode 116): link nodes within each level.
        `,
        talk: 'BFS with a queue; at the start of each level I snapshot the queue size and poll exactly that many nodes, collecting values and enqueueing children. O(n).',
      },
      viz: { id: 'treeBFS', input: { tree: [3, 9, 20, null, null, 15, 7] } },
      lc: [lc(102, 'binary-tree-level-order-traversal', 'Binary Tree Level Order Traversal', 'same'), lc(103, 'binary-tree-zigzag-level-order-traversal', 'Binary Tree Zigzag Level Order Traversal', 'variant'), lc(637, 'average-of-levels-in-binary-tree', 'Average of Levels in Binary Tree', 'easier'), lc(116, 'populating-next-right-pointers-in-each-node', 'Populating Next Right Pointers in Each Node', 'variant')],
      drill: { prompt: 'Group a binary tree’s values by depth, left to right.', pattern: 'tree-bfs', why: 'BFS with a queue, snapshotting the size at each level.' },
    } },

    { problem: {
      id: 'right-side-view', title: 'Right Side View', diff: 'medium',
      tags: ['BFS', 'last of level'],
      statement: M`
        Imagine standing to the right of a binary tree. Return the values you can see, from top to bottom: the **rightmost** node of each level.
      `,
      fn: { name: 'rightSideView', params: [['TreeNode', 'root']], ret: 'List<Integer>' },
      tests: [
        { args: [[1, 2, 3, null, 5, null, 4]], ex: true, expect: [1, 3, 4] },
        { args: [[1, 2, 3, 4, null, null, null, 5]], ex: true, expect: [1, 3, 4, 5], why: 'Level 3 is only visible through the left subtree.' },
        { args: [[1, null, 3]], expect: [1, 3] },
        { args: [[]], expect: [] },
        { args: [[1, 2]], expect: [1, 2] },
        { args: [BIG.level], big: true },
      ],
      constraints: ['0 ≤ nodes ≤ 100 (large test: 3000)'],
      hints: [
        '"Visible from the right" means the last node of each level, which is not necessarily in the right subtree.',
        'Level-order traversal: record the node when it’s the last one polled on its level.',
        'Or DFS visiting the right child first: the first node reached at each new depth is the visible one.',
      ],
      solution: {
        pattern: '**BFS, last node of each level.** Any "view" question (left, right, top, bottom) is picking a specific node per level or per column.',
        intuition: 'Each level contributes exactly one visible node, its rightmost. Level-order traversal visits each level left to right, so the last node polled at each level is the answer for that level.',
        java: J`class Solution {
    public List<Integer> rightSideView(TreeNode root) {
        List<Integer> res = new ArrayList<>();
        Queue<TreeNode> q = new ArrayDeque<>();
        if (root != null) q.offer(root);
        while (!q.isEmpty()) {
            int size = q.size();
            for (int i = 0; i < size; i++) {
                TreeNode n = q.poll();
                if (i == size - 1) res.add(n.val);     // rightmost on this level
                if (n.left != null) q.offer(n.left);
                if (n.right != null) q.offer(n.right);
            }
        }
        return res;
    }
}`,
        time: 'O(n)', space: 'O(width)',
        pitfalls: M`
          - Walking only right children: a deeper level may exist only on the left (example 2).
        `,
        alts: [
          { name: 'Right-first DFS with depth', time: 'O(n)', space: 'O(h)', java: J`class Solution {
    public List<Integer> rightSideView(TreeNode root) {
        List<Integer> res = new ArrayList<>();
        dfs(root, 0, res);
        return res;
    }
    private void dfs(TreeNode n, int d, List<Integer> res) {
        if (n == null) return;
        if (d == res.size()) res.add(n.val);      // first node seen at this depth
        dfs(n.right, d + 1, res);
        dfs(n.left, d + 1, res);
    }
}` },
        ],
        talk: 'Level-order BFS, taking the last node of each level. Equivalently, a DFS that visits right before left and records the first node at each new depth. O(n).',
      },
      lc: [lc(199, 'binary-tree-right-side-view', 'Binary Tree Right Side View', 'same'), lc(513, 'find-bottom-left-tree-value', 'Find Bottom Left Tree Value', 'variant'), lc(515, 'find-largest-value-in-each-tree-row', 'Find Largest Value in Each Tree Row', 'similar')],
      drill: { prompt: 'Values visible when looking at a binary tree from its right side.', pattern: 'tree-bfs', why: 'Level-order traversal; take the last node of each level.' },
    } },

    { lesson: 'bst', title: 'Binary search trees', mins: 10,
      lede: 'Left < node < right, everywhere. In-order traversal is sorted, and every query walks a single root-to-leaf path.',
      body: M`
        ## The invariant (stated precisely)
        For every node, **all** values in its left subtree are smaller and **all** values in its right subtree are larger. Checking only a node against its direct children isn't enough: a node deep in the left subtree must still be smaller than the root.

        @viz validateBST

        ## Two superpowers
        1. **In-order traversal gives sorted order.** "k-th smallest", "validate", "two-sum in a BST", "recover swapped nodes" all become array problems on the in-order sequence, often without building the array (iterate with a counter or a «prev» pointer).
        2. **Search walks one path.** Compare with the node and go left or right: O(h) for search, insert, delete, floor/ceiling and LCA. That's O(log n) if balanced (TreeMap guarantees it) and O(n) if the tree is a chain.

        ~~~java Template: iterative in-order (the k-th smallest element, early exit)
        Deque<TreeNode> st = new ArrayDeque<>();
        TreeNode cur = root;
        while (cur != null || !st.isEmpty()) {
            while (cur != null) { st.push(cur); cur = cur.left; }   // go as far left as possible
            cur = st.pop();
            // visit cur: values arrive in increasing order
            cur = cur.right;
        }
        ~~~

        ## LCA: BST vs general tree
        In a BST, the LCA of p and q is the first node on the root's path whose value lies **between** them: walk left while both are smaller, right while both are larger. That's O(h) and needs no recursion. In a general binary tree, you need the post-order "who found what" recursion:

        @viz lcaTrace

        ## Signals
        - "BST" in the statement → use the ordering: in-order, or single-path search.
        - "k-th smallest/largest", "closest value", "range sum in a BST" → in-order or pruned DFS.
        - "Validate a BST" → pass (low, high) bounds down, or check the in-order sequence is increasing.
        - "Build a balanced BST from sorted data" → take the middle as the root and recurse (like binary search).

        @quiz 0
      `,
      quiz: [
        { q: 'Tree [5, 1, 7, null, null, 4, 8]: node 7’s children are 4 and 8, and 1 < 5 < 7. Is it a valid BST?',
          options: ['Yes: every node beats its children', 'No: 4 is in the root’s right subtree but smaller than 5', 'No: 1 is too small', 'Yes, since in-order is 1,5,4,7,8'],
          answer: 1, why: 'Every value in 5’s right subtree must exceed 5, and 4 doesn’t. The in-order sequence 1, 5, 4, 7, 8 isn’t sorted either, which confirms it.' },
      ],
      practice: ['validate-bst', 'kth-smallest-bst', 'lca-bst', 'lca-binary-tree', 'build-tree-pre-in', 'serialize-tree'],
    },

    { problem: {
      id: 'validate-bst', title: 'Validate a Binary Search Tree', diff: 'medium',
      tags: ['BST', 'bounds'],
      statement: M`
        Return «true» if the tree is a valid **binary search tree**: for every node, every value in its left subtree is **strictly less** and every value in its right subtree is **strictly greater** than the node's value.
      `,
      fn: { name: 'isValidBST', params: [['TreeNode', 'root']], ret: 'boolean' },
      tests: [
        { args: [[2, 1, 3]], ex: true, expect: true },
        { args: [[5, 1, 4, null, null, 3, 6]], ex: true, expect: false },
        { args: [[5, 4, 6, null, null, 3, 7]], ex: true, expect: false, why: '3 is in 5’s right subtree but smaller than 5, even though it’s fine relative to its parent 6.' },
        { args: [[1]], expect: true },
        { args: [[1, 1]], expect: false, why: 'Duplicates violate "strictly less".' },
        { args: [[2147483647]], expect: true },
        { args: [[-2147483648, null, 2147483647]], expect: true, why: 'Bounds must not use Integer.MIN/MAX as sentinels.' },
        { args: [[10, 5, 15, null, null, 6, 20]], expect: false },
        { args: [BST_BIG], big: true, expect: true },
        { args: [BIG.level], big: true, expect: false },
      ],
      constraints: ['1 ≤ nodes ≤ 10⁴', '−2³¹ ≤ val ≤ 2³¹ − 1'],
      hints: [
        'Comparing each node with its children isn’t enough (example 3). What constraint does a node inherit from its ancestors?',
        'A range (low, high). Going left, high becomes the node’s value; going right, low becomes the node’s value.',
        'Use «long» bounds (or nullable Integers), since node values can be «Integer.MIN_VALUE» or «MAX_VALUE».',
      ],
      solution: {
        pattern: '**Top-down bounds:** each node must lie in an open interval narrowed by its ancestors. Equivalently, in-order must be strictly increasing.',
        intuition: 'The root may be anything. Its left subtree must be below it, the right-then-left grandchild must be between the root and the right child, and so on. Carrying (low, high) down encodes all ancestor constraints at once.',
        java: J`class Solution {
    public boolean isValidBST(TreeNode root) {
        return valid(root, Long.MIN_VALUE, Long.MAX_VALUE);
    }

    private boolean valid(TreeNode n, long lo, long hi) {
        if (n == null) return true;
        if (n.val <= lo || n.val >= hi) return false;
        return valid(n.left, lo, n.val) && valid(n.right, n.val, hi);
    }
}`,
        time: 'O(n)', space: 'O(h)',
        pitfalls: M`
          - Only checking «left.val < node.val < right.val»: misses violations against ancestors.
          - «int» sentinels: a node equal to «Integer.MAX_VALUE» would be rejected. Use «long» or «null» bounds.
          - Allowing equal values: the problem says strictly less/greater.
        `,
        alts: [
          { name: 'In-order must be strictly increasing', time: 'O(n)', space: 'O(h)', note: 'Iterative in-order with a «prev» value; any «cur ≤ prev» fails.',
            java: J`class Solution {
    public boolean isValidBST(TreeNode root) {
        Deque<TreeNode> st = new ArrayDeque<>();
        TreeNode cur = root;
        Long prev = null;
        while (cur != null || !st.isEmpty()) {
            while (cur != null) { st.push(cur); cur = cur.left; }
            cur = st.pop();
            if (prev != null && cur.val <= prev) return false;
            prev = (long) cur.val;
            cur = cur.right;
        }
        return true;
    }
}` },
        ],
        talk: 'Pass down an open interval (low, high): the root has (−∞, ∞), left children tighten high to the parent’s value, right children tighten low. Any node outside its interval fails. I use long bounds to handle Integer extremes. O(n).',
      },
      viz: { id: 'validateBST', input: { tree: [5, 4, 6, null, null, 3, 7] } },
      lc: [lc(98, 'validate-binary-search-tree', 'Validate Binary Search Tree', 'same'), lc(99, 'recover-binary-search-tree', 'Recover Binary Search Tree', 'harder'), lc(1373, 'maximum-sum-bst-in-binary-tree', 'Maximum Sum BST in Binary Tree', 'harder')],
      drill: { prompt: 'Check whether a binary tree satisfies the BST property everywhere (not just parent vs child).', pattern: 'bst', why: 'Pass (low, high) bounds down, or check that in-order is strictly increasing.' },
    } },

    { problem: {
      id: 'kth-smallest-bst', title: 'k-th Smallest in a BST', diff: 'medium',
      tags: ['BST', 'in-order'],
      statement: M`
        Given the root of a binary search tree and an integer «k», return the «k»-th smallest value (1-indexed).
      `,
      fn: { name: 'kthSmallest', params: [['TreeNode', 'root'], ['int', 'k']], ret: 'int' },
      tests: [
        { args: [[3, 1, 4, null, 2], 1], ex: true, expect: 1 },
        { args: [[5, 3, 6, 2, 4, null, null, 1], 3], ex: true, expect: 3 },
        { args: [[1], 1], expect: 1 },
        { args: [[2, 1, 3], 3], expect: 3 },
        { args: [[5, 3, 6, 2, 4, null, null, 1], 6], expect: 6 },
        { args: [BST_BIG, 1000], big: true, expect: 1999 },
        { args: [BST_BIG, 4095], big: true, expect: 8189 },
      ],
      constraints: ['1 ≤ k ≤ nodes ≤ 10⁴'],
      hints: [
        'What order does an in-order traversal of a BST produce?',
        'Ascending. So the k-th element visited in-order is the answer.',
        'Count as you traverse and stop at k. The iterative version with a stack stops cleanly.',
      ],
      solution: {
        pattern: '**In-order = sorted:** order statistics on a BST are in-order traversals with an early exit.',
        intuition: 'In-order visits values from smallest to largest, so stop at the k-th visit. The iterative form only walks O(h + k) nodes.',
        java: J`class Solution {
    public int kthSmallest(TreeNode root, int k) {
        Deque<TreeNode> st = new ArrayDeque<>();
        TreeNode cur = root;
        while (true) {
            while (cur != null) { st.push(cur); cur = cur.left; }
            cur = st.pop();
            if (--k == 0) return cur.val;
            cur = cur.right;
        }
    }
}`,
        time: 'O(h + k)', space: 'O(h)',
        alts: [
          { name: 'Recursive in-order with a counter', time: 'O(n)', space: 'O(h)', java: J`class Solution {
    private int k, ans;
    public int kthSmallest(TreeNode root, int k) { this.k = k; walk(root); return ans; }
    private void walk(TreeNode n) {
        if (n == null || k == 0) return;
        walk(n.left);
        if (--k == 0) { ans = n.val; return; }
        walk(n.right);
    }
}` },
        ],
        followups: M`
          - **Frequent queries with inserts and deletes:** store subtree sizes in each node, then walk down in O(h) (an order-statistic tree).
        `,
        talk: 'In-order traversal of a BST is sorted, so I do an iterative in-order with a stack and return the k-th popped node. O(h + k) time.',
      },
      viz: { id: 'treeTraversal', input: { tree: [5, 3, 6, 2, 4, null, null, 1], order: 'in' } },
      lc: [lc(230, 'kth-smallest-element-in-a-bst', 'Kth Smallest Element in a BST', 'same'), lc(173, 'binary-search-tree-iterator', 'Binary Search Tree Iterator', 'variant'), lc(653, 'two-sum-iv-input-is-a-bst', 'Two Sum IV - Input is a BST', 'similar')],
      drill: { prompt: 'Return the k-th smallest value stored in a binary search tree.', pattern: 'bst', why: 'In-order traversal of a BST is sorted; stop at the k-th node.' },
    } },

    { problem: {
      id: 'lca-bst', title: 'Lowest Common Ancestor in a BST', diff: 'medium',
      tags: ['BST', 'single path'],
      statement: M`
        Given a binary **search** tree and two nodes «p» and «q» in it, return their **lowest common ancestor**: the deepest node that has both as descendants (a node counts as its own descendant). The grader passes node values in the tests and prints the value of the node you return.
      `,
      fn: { name: 'lowestCommonAncestor', params: [['TreeNode', 'root'], ['TreeNode', 'p', { node: 0 }], ['TreeNode', 'q', { node: 0 }]], ret: 'TreeNode' },
      post: 'r == null ? null : r.val',
      tests: [
        { args: [[6, 2, 8, 0, 4, 7, 9, null, null, 3, 5], 2, 8], ex: true, expect: 6 },
        { args: [[6, 2, 8, 0, 4, 7, 9, null, null, 3, 5], 2, 4], ex: true, expect: 2, why: '2 is an ancestor of 4 (and of itself).' },
        { args: [[2, 1], 2, 1], expect: 2 },
        { args: [[6, 2, 8, 0, 4, 7, 9, null, null, 3, 5], 3, 5], expect: 4 },
        { args: [[6, 2, 8, 0, 4, 7, 9, null, null, 3, 5], 0, 5], expect: 2 },
        { args: [[6, 2, 8, 0, 4, 7, 9, null, null, 3, 5], 7, 9], expect: 8 },
        { args: [BST_BIG, 1, 8189], big: true },
        { args: [BST_BIG, 4001, 4011], big: true },
      ],
      constraints: ['2 ≤ nodes ≤ 10⁵', 'All values are distinct; p ≠ q; both exist in the tree'],
      hints: [
        'Use the BST ordering: if both p and q are smaller than the current node, where must their LCA be?',
        'In the left subtree. If both are larger, in the right subtree.',
        'Otherwise they split here (or one of them is here), so the current node is the LCA. That’s one path from the root, no recursion needed.',
      ],
      solution: {
        pattern: '**Single-path BST walk:** the ordering tells you which way to go, so no need to search both subtrees.',
        intuition: 'Walking down from the root, as long as p and q are on the same side, the LCA is further down that side. The first node where they fall on different sides (or that equals one of them) is the split point, the LCA.',
        java: J`class Solution {
    public TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
        TreeNode cur = root;
        while (cur != null) {
            if (p.val < cur.val && q.val < cur.val) cur = cur.left;
            else if (p.val > cur.val && q.val > cur.val) cur = cur.right;
            else return cur;                        // they split here (or cur is p or q)
        }
        return null;
    }
}`,
        time: 'O(h)', space: 'O(1)',
        alts: [
          { name: 'General binary-tree LCA', time: 'O(n)', space: 'O(h)', note: 'Works on any tree, but ignores the BST property (next problem).', java: J`class Solution {
    public TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
        if (root == null || root == p || root == q) return root;
        TreeNode l = lowestCommonAncestor(root.left, p, q), r = lowestCommonAncestor(root.right, p, q);
        return l == null ? r : r == null ? l : root;
    }
}` },
        ],
        talk: 'In a BST, while both values are smaller go left, while both are larger go right; the first node where they split, or that equals one of them, is the LCA. O(h) time, O(1) space.',
      },
      lc: [lc(235, 'lowest-common-ancestor-of-a-binary-search-tree', 'Lowest Common Ancestor of a Binary Search Tree', 'same'), lc(236, 'lowest-common-ancestor-of-a-binary-tree', 'Lowest Common Ancestor of a Binary Tree', 'harder'), lc(1644, 'lowest-common-ancestor-of-a-binary-tree-ii', 'Lowest Common Ancestor of a Binary Tree II', 'variant', { premium: true })],
      drill: { prompt: 'Deepest node that is an ancestor of both p and q in a binary search tree.', pattern: 'bst', why: 'Walk from the root: go left if both are smaller, right if both are larger, else stop.' },
    } },

    { problem: {
      id: 'lca-binary-tree', title: 'Lowest Common Ancestor in Any Binary Tree', diff: 'medium',
      tags: ['post-order', 'returning found nodes'],
      statement: M`
        Same question, but the tree is an ordinary binary tree (no ordering). Given nodes «p» and «q» that both exist, return their lowest common ancestor. As before, tests pass node values and the grader prints the returned node's value.
      `,
      fn: { name: 'lowestCommonAncestor', params: [['TreeNode', 'root'], ['TreeNode', 'p', { node: 0 }], ['TreeNode', 'q', { node: 0 }]], ret: 'TreeNode' },
      post: 'r == null ? null : r.val',
      tests: [
        { args: [[3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], 5, 1], ex: true, expect: 3 },
        { args: [[3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], 5, 4], ex: true, expect: 5 },
        { args: [[1, 2], 1, 2], expect: 1 },
        { args: [[3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], 7, 4], expect: 2 },
        { args: [[3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], 6, 4], expect: 5 },
        { args: [[3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], 0, 8], expect: 1 },
        { args: [BIG.level, 1, 2], big: true },
        { args: [BIG.level, 2999, 17], big: true },
      ],
      constraints: ['2 ≤ nodes ≤ 10⁵ (large tests: 3000)', 'Values are distinct; p ≠ q; both exist'],
      hints: [
        'Recurse into both subtrees. What should a call report back to its parent?',
        'Return p or q if you find one (or the LCA if you found both below). Return null if neither is in the subtree.',
        'At a node: if both sides return non-null, p and q are on different sides, so this node is the LCA. Otherwise pass up whichever side is non-null.',
      ],
      solution: {
        pattern: '**Post-order "what did you find?":** each call returns a found target (or the answer), and the first node that hears back from both sides is the answer.',
        intuition: M`
          Define «lca(n)» as: the LCA if both p and q are in n's subtree, the one that is present if only one is, and null otherwise. If n is p or q itself, return n: either the other one is below (then n is the LCA) or elsewhere (then n just reports "found one"). Combining the children's results is then a three-way case.
        `,
        java: J`class Solution {
    public TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
        if (root == null || root == p || root == q) return root;
        TreeNode l = lowestCommonAncestor(root.left, p, q);
        TreeNode r = lowestCommonAncestor(root.right, p, q);
        if (l != null && r != null) return root;    // one on each side
        return l != null ? l : r;                   // pass up what was found (or null)
    }
}`,
        time: 'O(n)', space: 'O(h)',
        why: 'The first node whose left and right calls both return non-null has p in one subtree and q in the other, which makes it the lowest common ancestor. If one target is an ancestor of the other, that target is returned immediately and propagated to the top.',
        pitfalls: M`
          - Comparing values instead of references works here (distinct values), but in general compare nodes.
          - This version assumes both nodes exist. If they might not (LeetCode 1644), count what was found.
        `,
        alts: [
          { name: 'Parent pointers + ancestor set', time: 'O(n)', space: 'O(n)', note: 'BFS to record each node’s parent, collect p’s ancestors in a set, then walk up from q until you hit one. Good when many queries share the tree.',
            java: J`class Solution {
    public TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
        Map<TreeNode, TreeNode> parent = new HashMap<>();
        Deque<TreeNode> st = new ArrayDeque<>();
        parent.put(root, null); st.push(root);
        while (!parent.containsKey(p) || !parent.containsKey(q)) {
            TreeNode n = st.pop();
            if (n.left != null) { parent.put(n.left, n); st.push(n.left); }
            if (n.right != null) { parent.put(n.right, n); st.push(n.right); }
        }
        Set<TreeNode> anc = new HashSet<>();
        for (TreeNode x = p; x != null; x = parent.get(x)) anc.add(x);
        TreeNode y = q;
        while (!anc.contains(y)) y = parent.get(y);
        return y;
    }
}` },
        ],
        talk: 'Post-order: return the node if it’s p or q; otherwise combine the children’s results. If both are non-null the targets split here and this node is the LCA; otherwise pass up the non-null one. O(n).',
      },
      viz: { id: 'lcaTrace' },
      lc: [lc(236, 'lowest-common-ancestor-of-a-binary-tree', 'Lowest Common Ancestor of a Binary Tree', 'same'), lc(1650, 'lowest-common-ancestor-of-a-binary-tree-iii', 'Lowest Common Ancestor of a Binary Tree III', 'variant', { premium: true }), lc(1123, 'lowest-common-ancestor-of-deepest-leaves', 'Lowest Common Ancestor of Deepest Leaves', 'harder')],
      drill: { prompt: 'Lowest common ancestor of two nodes in a general (unordered) binary tree.', pattern: 'tree-dfs', why: 'Post-order: return what each subtree found; the node hearing from both sides is the LCA.' },
    } },

    { problem: {
      id: 'build-tree-pre-in', title: 'Rebuild a Tree From Two Traversals', diff: 'medium',
      tags: ['divide and conquer', 'hash map'],
      statement: M`
        Given the **pre-order** and **in-order** traversals of a binary tree with **distinct** values, reconstruct the tree and return its root.
      `,
      fn: { name: 'buildTree', params: [['int[]', 'preorder'], ['int[]', 'inorder']], ret: 'TreeNode' },
      tests: [
        { args: [[3, 9, 20, 15, 7], [9, 3, 15, 20, 7]], ex: true, expect: [3, 9, 20, null, null, 15, 7] },
        { args: [[-1], [-1]], ex: true, expect: [-1] },
        { args: [[1, 2], [2, 1]], expect: [1, 2] },
        { args: [[1, 2], [1, 2]], expect: [1, null, 2] },
        { args: [[1, 2, 4, 5, 3, 6, 7], [4, 2, 5, 1, 6, 3, 7]], expect: [1, 2, 3, 4, 5, 6, 7] },
        { args: [[3, 1, 2, 4], [1, 2, 3, 4]], expect: [3, 1, 4, null, 2] },
        { args: orders(randTree(3000, 16).nodes), big: true },
      ],
      constraints: ['1 ≤ nodes ≤ 3000', 'Values are distinct'],
      hints: [
        'The first element of the pre-order is the root. Where is the root in the in-order sequence, and what’s to its left and right?',
        'Everything left of the root in in-order is the left subtree (and its size tells you how much of the pre-order belongs to it).',
        'Recurse with index ranges instead of copying arrays, and use a hash map from value to in-order index for O(1) root lookups.',
      ],
      solution: {
        pattern: '**Divide and conquer on traversal ranges:** pre-order gives the root, in-order gives the split. A hash map makes each split O(1).',
        intuition: M`
          Pre-order is «root, [left subtree], [right subtree]»; in-order is «[left subtree], root, [right subtree]». The root comes first in pre-order; finding it in in-order tells you the left subtree has «k» nodes, so the next k pre-order values are the left subtree and the rest are the right. Recurse on both halves.
        `,
        java: J`class Solution {
    private int[] pre;
    private int preIdx = 0;
    private final Map<Integer, Integer> inPos = new HashMap<>();

    public TreeNode buildTree(int[] preorder, int[] inorder) {
        pre = preorder;
        for (int i = 0; i < inorder.length; i++) inPos.put(inorder[i], i);
        return build(0, inorder.length - 1);
    }

    // builds the subtree whose in-order values are inorder[lo..hi]; pre-order roots are consumed left to right
    private TreeNode build(int lo, int hi) {
        if (lo > hi) return null;
        TreeNode root = new TreeNode(pre[preIdx++]);
        int mid = inPos.get(root.val);
        root.left = build(lo, mid - 1);                // left subtree comes next in pre-order
        root.right = build(mid + 1, hi);
        return root;
    }
}`,
        time: 'O(n)', space: 'O(n)',
        pitfalls: M`
          - Building the right subtree before the left consumes pre-order values in the wrong order.
          - Copying subarrays at each level («Arrays.copyOfRange») and scanning for the root is O(n²).
          - Duplicate values make the split ambiguous, which is why the problem guarantees distinct values.
        `,
        alts: [
          { name: 'Copy subarrays and scan for the root', time: 'O(n²)', space: 'O(n²)', java: J`class Solution {
    public TreeNode buildTree(int[] pre, int[] in) {
        if (pre.length == 0) return null;
        TreeNode root = new TreeNode(pre[0]);
        int k = 0;
        while (in[k] != pre[0]) k++;
        root.left = buildTree(Arrays.copyOfRange(pre, 1, k + 1), Arrays.copyOfRange(in, 0, k));
        root.right = buildTree(Arrays.copyOfRange(pre, k + 1, pre.length), Arrays.copyOfRange(in, k + 1, in.length));
        return root;
    }
}` },
        ],
        followups: M`
          - **Post-order + in-order** (LeetCode 106): the root is the *last* post-order value; build the right subtree first.
          - **Pre-order + post-order** (LeetCode 889): not unique in general, but any valid answer works.
        `,
        talk: 'The next pre-order value is the root; its position in in-order (via a HashMap) splits the left and right subtrees. I recurse on in-order index ranges, consuming pre-order left to right, building left before right. O(n).',
      },
      lc: [lc(105, 'construct-binary-tree-from-preorder-and-inorder-traversal', 'Construct Binary Tree from Preorder and Inorder Traversal', 'same'), lc(106, 'construct-binary-tree-from-inorder-and-postorder-traversal', 'Construct Binary Tree from Inorder and Postorder Traversal', 'variant'), lc(1008, 'construct-binary-search-tree-from-preorder-traversal', 'Construct Binary Search Tree from Preorder Traversal', 'similar')],
      drill: { prompt: 'Reconstruct a binary tree from its preorder and inorder traversals.', pattern: 'tree-dfs', why: 'Divide and conquer: the preorder head is the root, and its inorder position splits the subtrees.' },
    } },

    { problem: {
      id: 'serialize-tree', title: 'Serialize and Deserialize a Tree', diff: 'hard',
      tags: ['design', 'pre-order', 'parsing'],
      statement: M`
        Design a «Codec» that converts a binary tree to a «String» («serialize») and back («deserialize»). Any format works as long as «deserialize(serialize(root))» rebuilds an identical tree.

        The grader round-trips each test tree through your codec and compares the result with the original.
      `,
      fn: { name: 'roundTrip', params: [['TreeNode', 'root']], ret: 'TreeNode' },
      call: 'new Codec().deserialize(new Codec().serialize(a0))',
      classes: ['Codec'],
      starter: `class Codec {

    // Encodes a tree to a single string.
    public String serialize(TreeNode root) {

    }

    // Decodes your encoded data to a tree.
    public TreeNode deserialize(String data) {

    }
}
`,
      tests: [
        { args: [[1, 2, 3, null, null, 4, 5]], ex: true, expect: [1, 2, 3, null, null, 4, 5] },
        { args: [[]], ex: true, expect: [] },
        { args: [[1]], expect: [1] },
        { args: [[-1000, 1000]], expect: [-1000, 1000] },
        { args: [[1, null, 2, null, 3]], expect: [1, null, 2, null, 3] },
        { args: [[5, 4, 7, 3, null, 2, null, -1, null, 9]], expect: [5, 4, 7, 3, null, 2, null, -1, null, 9] },
        { args: [randTree(3000, 17, [-1000, 1000]).level], big: true },
      ],
      constraints: ['0 ≤ nodes ≤ 10⁴', '−1000 ≤ val ≤ 1000'],
      hints: [
        'Pre-order alone can’t rebuild a tree. What extra information makes it unambiguous?',
        'Record the null children explicitly (e.g. «#»). Pre-order with null markers identifies the tree uniquely.',
        'Deserialize by consuming tokens left to right with a recursive function: read a token; «#» means null, otherwise make a node and build its left, then its right.',
      ],
      solution: {
        pattern: '**Pre-order with null markers.** Adding the nulls makes a single traversal enough to rebuild the tree, and the decoder mirrors the encoder.',
        intuition: 'A pre-order listing that includes null children is a complete description: each value is followed by its left subtree’s listing, then its right’s. Reading tokens in the same order with the same recursion rebuilds exactly the same shape.',
        java: J`class Codec {
    public String serialize(TreeNode root) {
        StringBuilder sb = new StringBuilder();
        write(root, sb);
        return sb.toString();
    }

    private void write(TreeNode n, StringBuilder sb) {
        if (n == null) { sb.append("#,"); return; }
        sb.append(n.val).append(',');
        write(n.left, sb);
        write(n.right, sb);
    }

    public TreeNode deserialize(String data) {
        Deque<String> tokens = new ArrayDeque<>(Arrays.asList(data.split(",")));
        return read(tokens);
    }

    private TreeNode read(Deque<String> tokens) {
        String t = tokens.poll();
        if (t == null || t.equals("#")) return null;
        TreeNode n = new TreeNode(Integer.parseInt(t));
        n.left = read(tokens);
        n.right = read(tokens);
        return n;
    }
}`,
        time: 'O(n) each way', space: 'O(n)',
        pitfalls: M`
          - Without null markers, different trees serialize the same way («1,2» could be 2 as a left or a right child).
          - Without separators, «12» and «1,2» collide.
          - String concatenation in the recursion is O(n²). Use a «StringBuilder».
          - Recursion depth equals the tree height. A 10⁴-node chain can overflow. The BFS format below is iterative.
        `,
        alts: [
          { name: 'Level-order (LeetCode style) with a queue', time: 'O(n)', space: 'O(n)', note: 'Serialize BFS with «#» for missing children; deserialize by pairing each queued node with the next two tokens. Iterative, so no stack depth issues.',
            java: J`class Codec {
    public String serialize(TreeNode root) {
        if (root == null) return "";
        StringBuilder sb = new StringBuilder();
        Queue<TreeNode> q = new LinkedList<>();
        q.offer(root);
        while (!q.isEmpty()) {
            TreeNode n = q.poll();
            if (n == null) { sb.append("#,"); continue; }
            sb.append(n.val).append(',');
            q.offer(n.left); q.offer(n.right);          // LinkedList allows nulls
        }
        return sb.toString();
    }
    public TreeNode deserialize(String data) {
        if (data.isEmpty()) return null;
        String[] t = data.split(",");
        TreeNode root = new TreeNode(Integer.parseInt(t[0]));
        Queue<TreeNode> q = new ArrayDeque<>();
        q.offer(root);
        int i = 1;
        while (!q.isEmpty() && i < t.length) {
            TreeNode n = q.poll();
            if (!t[i].equals("#")) { n.left = new TreeNode(Integer.parseInt(t[i])); q.offer(n.left); }
            i++;
            if (i < t.length && !t[i].equals("#")) { n.right = new TreeNode(Integer.parseInt(t[i])); q.offer(n.right); }
            i++;
        }
        return root;
    }
}` },
        ],
        followups: M`
          - **BST only** (LeetCode 449): nulls aren't needed. Pre-order plus value bounds rebuild it, so the encoding is more compact.
          - **N-ary trees** (LeetCode 428): write each node's child count.
        `,
        talk: 'Pre-order with explicit null markers and comma separators uniquely encodes the tree. Deserialize with the same recursion over a token queue: “#” is null, otherwise create the node, then read its left and right. O(n) both ways; level order is the iterative alternative.',
      },
      lc: [lc(297, 'serialize-and-deserialize-binary-tree', 'Serialize and Deserialize Binary Tree', 'same'), lc(449, 'serialize-and-deserialize-bst', 'Serialize and Deserialize BST', 'variant'), lc(428, 'serialize-and-deserialize-n-ary-tree', 'Serialize and Deserialize N-ary Tree', 'variant', { premium: true }), lc(652, 'find-duplicate-subtrees', 'Find Duplicate Subtrees', 'similar')],
      drill: { prompt: 'Convert a binary tree to a string and back so the structure is preserved exactly.', pattern: 'tree-dfs', why: 'Pre-order DFS with null markers; decode with the same recursion over tokens.' },
    } },
  ],
});
})();

/* Extra pattern-drill prompts: one-line paraphrases of well-known LeetCode problems that aren't in the
 * curriculum. Each has { prompt, pattern (a DSA.patterns key), why, lc (LeetCode slug) }. The drill
 * also draws from every curriculum problem's own `drill` entry. */
(() => {
const d = (pattern, lc, prompt, why) => ({ pattern, lc, prompt, why });

DSA.drill = [
  // hashing and counting
  d('hash-lookup', 'contains-duplicate', 'Does any value appear at least twice in the array?', 'A HashSet: add returns false on a repeat.'),
  d('hash-lookup', 'isomorphic-strings', 'Can the characters of s be consistently replaced to get t (a one-to-one mapping)?', 'Two maps (s→t and t→s) checked character by character.'),
  d('counting', 'ransom-note', 'Can the letters of one string be taken from another (each letter used once)?', 'Count letters in an int[26]; decrement and check for negatives.'),
  d('counting', 'find-all-anagrams-in-a-string', 'Return every start index where some anagram of p begins in s.', 'A fixed-size window with letter counts compared as it slides.'),
  d('hash-lookup', 'valid-sudoku', 'Is a partly filled 9×9 board free of repeats in every row, column and box?', 'Sets keyed by row, column and box index.'),
  d('prefix-sum', 'continuous-subarray-sum', 'Is there a subarray of length ≥ 2 whose sum is a multiple of k?', 'Prefix sums mod k in a map of first index: equal remainders mean a multiple.'),
  d('prefix-sum', 'find-pivot-index', 'Find an index where the sum to its left equals the sum to its right.', 'Total sum and a running left sum: right = total − left − a[i].'),

  // two pointers and windows
  d('two-pointers', 'move-zeroes', 'Move all zeros to the end in place, keeping the order of the other elements.', 'A write pointer for non-zeros, then fill the rest with zeros.'),
  d('two-pointers', 'merge-sorted-array', 'Merge a sorted array into another sorted array that has room at the end, in place.', 'Three pointers filling from the back, so nothing is overwritten.'),
  d('two-pointers', 'boats-to-save-people', 'Boats carry at most two people under a weight limit: minimum boats?', 'Sort; pair the heaviest with the lightest when they fit.'),
  d('sliding-window', 'max-consecutive-ones-iii', 'Longest run of 1s if you may flip at most k zeros.', 'A variable window that holds at most k zeros.'),
  d('sliding-window', 'maximum-points-you-can-obtain-from-cards', 'Take exactly k cards from either end to maximize the total.', 'Equivalently, minimize a window of n − k cards in the middle.'),

  // stacks
  d('stack', 'simplify-path', 'Normalize a Unix path with “.”, “..” and repeated slashes.', 'Split on “/” and use a stack of directory names.'),
  d('stack', 'basic-calculator-ii', 'Evaluate an expression with + − × ÷ and no parentheses.', 'A stack of signed terms; apply × and ÷ immediately.'),
  d('mono-stack', 'online-stock-span', 'For each new price, how many consecutive days (ending today) had price ≤ today’s?', 'A monotonic stack of (price, span) pairs merges smaller spans.'),
  d('mono-stack', 'remove-k-digits', 'Delete k digits from a number string to make it as small as possible.', 'A monotonic increasing stack: pop larger digits while deletions remain.'),
  d('mono-stack', 'car-fleet', 'Cars drive to a target at different speeds and bunch up behind slower ones. How many fleets arrive?', 'Sort by position; a stack of arrival times keeps only slower fleets ahead.'),

  // binary search
  d('binary-search', 'search-insert-position', 'Index of target in a sorted array, or where it would be inserted.', 'Lower bound: first index with a[i] ≥ target.'),
  d('binary-search', 'find-k-closest-elements', 'In a sorted array, find the k elements closest to x.', 'Binary search the left edge of the size-k window.'),
  d('bs-answer', 'split-array-largest-sum', 'Split an array into k contiguous parts minimizing the largest part sum.', 'Binary search the answer; greedy count of parts is the feasibility test.'),
  d('bs-answer', 'minimum-number-of-days-to-make-m-bouquets', 'Earliest day when you can make m bouquets of k adjacent bloomed flowers.', 'Binary search the day; count bouquets greedily.'),
  d('bs-answer', 'magnetic-force-between-two-balls', 'Place m balls in given positions to maximize the minimum distance between any two.', 'Binary search the distance; place greedily left to right.'),

  // linked lists
  d('linked-list', 'odd-even-linked-list', 'Group the odd-positioned nodes before the even-positioned ones, in place.', 'Two chains (odd, even) woven in one pass, then joined.'),
  d('fast-slow', 'find-the-duplicate-number', 'n + 1 numbers in 1..n, one repeated: find it without modifying the array, in O(1) space.', 'Treat i → nums[i] as a linked list; Floyd’s cycle start is the duplicate.'),
  d('fast-slow', 'happy-number', 'Repeatedly replace a number by the sum of its digits’ squares: does it reach 1?', 'The sequence either hits 1 or cycles; detect the cycle with fast and slow.'),
  d('linked-list', 'copy-list-with-random-pointer', 'Deep-copy a list where each node also has a random pointer.', 'A map from old node to new node (or interleave copies in the list).'),

  // trees
  d('tree-dfs', 'subtree-of-another-tree', 'Is one binary tree an exact subtree of another?', 'At each node, run a same-tree check.'),
  d('tree-dfs', 'sum-root-to-leaf-numbers', 'Each root-to-leaf path spells a number: return the sum of all of them.', 'DFS carrying the number so far (value × 10 + digit).'),
  d('tree-bfs', 'binary-tree-zigzag-level-order-traversal', 'Level order, but alternate left-to-right and right-to-left.', 'BFS by levels; reverse every other level.'),
  d('tree-bfs', 'minimum-depth-of-binary-tree', 'Depth of the shallowest leaf.', 'BFS stops at the first leaf it meets.'),
  d('bst', 'convert-sorted-array-to-binary-search-tree', 'Build a height-balanced BST from a sorted array.', 'The middle element is the root; recurse on the halves.'),
  d('bst', 'delete-node-in-a-bst', 'Remove a key from a BST and return the new root.', 'Find it by value; replace with the in-order successor if it has two children.'),

  // heaps
  d('heap-topk', 'reorganize-string', 'Rearrange letters so no two adjacent are equal (or say it’s impossible).', 'A max-heap by count: place the two most frequent letters alternately.'),
  d('kway-merge', 'find-k-pairs-with-smallest-sums', 'From two sorted arrays, list the k pairs with the smallest sums.', 'A min-heap seeded with (i, 0) pairs, advancing j like merging k lists.'),
  d('kway-merge', 'kth-smallest-element-in-a-sorted-matrix', 'kth smallest value in a matrix whose rows and columns are sorted.', 'Merge the rows with a heap (or binary search on the value).'),
  d('two-heaps', 'sliding-window-median', 'Median of every window of size k.', 'Two heaps (or two TreeMaps) with lazy removal as the window slides.'),

  // backtracking
  d('backtracking', 'combinations', 'All ways to choose k numbers from 1..n.', 'Choose, recurse from the next number, un-choose; prune when too few remain.'),
  d('backtracking', 'restore-ip-addresses', 'All valid IP addresses formed by inserting three dots into a digit string.', 'Backtrack over segment lengths 1–3 with validity checks.'),
  d('backtracking', 'sudoku-solver', 'Fill a Sudoku board.', 'Backtracking cell by cell with row/column/box sets.'),
  d('backtracking', 'partition-to-k-equal-sum-subsets', 'Can the array be split into k groups with equal sums?', 'Backtracking into k buckets with heavy pruning (or bitmask DP).'),

  // graphs
  d('graph-traversal', 'clone-graph', 'Deep-copy a connected undirected graph.', 'DFS or BFS with a map from original node to copy.'),
  d('graph-traversal', 'is-graph-bipartite', 'Can the nodes be colored with two colors so every edge joins different colors?', 'BFS/DFS 2-coloring; a same-colored edge means no.'),
  d('graph-traversal', 'keys-and-rooms', 'Starting in room 0 with keys found in rooms, can you visit every room?', 'Reachability from node 0 with DFS or BFS.'),
  d('bfs-shortest', '01-matrix', 'Distance from each cell to the nearest 0.', 'Multi-source BFS from all zeros at once.'),
  d('bfs-shortest', 'open-the-lock', 'Fewest wheel turns to reach a target combination while avoiding dead ends.', 'BFS over the 10⁴ lock states.'),
  d('bfs-shortest', 'snakes-and-ladders', 'Fewest dice rolls to finish a snakes-and-ladders board.', 'BFS over squares, following snakes and ladders as edges.'),
  d('topo-sort', 'minimum-height-trees', 'Which roots give a tree of minimum height?', 'Peel leaves layer by layer (topological trimming) until 1–2 nodes remain.'),
  d('topo-sort', 'parallel-courses', 'Minimum number of semesters to take all courses with prerequisites.', 'Kahn’s algorithm level by level; the number of levels is the answer.'),
  d('union-find', 'number-of-provinces', 'Count groups of directly or indirectly connected cities from an adjacency matrix.', 'Union-find (or DFS) and count the roots.'),
  d('union-find', 'most-stones-removed-with-same-row-or-column', 'Remove stones that share a row or column with another stone: how many can go?', 'Union rows with columns; answer = stones − components.'),
  d('union-find', 'satisfiability-of-equality-equations', 'Given “a==b” and “a!=b” constraints, can all be satisfied?', 'Union all equalities, then check no inequality is inside one set.'),
  d('dijkstra', 'the-maze-ii', 'A ball rolls until it hits a wall: shortest distance to a destination.', 'Dijkstra where each roll is an edge weighted by its length.'),
  d('mst', 'find-critical-and-pseudo-critical-edges-in-minimum-spanning-tree', 'Which edges appear in every minimum spanning tree, and which in only some?', 'Run Kruskal with each edge excluded, then forced, and compare the totals.'),
  d('mst', 'connecting-cities-with-minimum-cost', 'Minimum total cost to connect all cities given possible roads.', 'Kruskal with union-find (or Prim).'),

  // dynamic programming
  d('dp-1d', 'perfect-squares', 'Fewest perfect squares that sum to n.', 'Unbounded coin change where the coins are squares.'),
  d('dp-1d', 'delete-and-earn', 'Taking value x earns x but deletes every x−1 and x+1: maximize earnings.', 'Bucket totals by value, then house robber over values.'),
  d('dp-2d', 'maximal-square', 'Largest square of 1s in a binary matrix.', 'dp[r][c] = 1 + min(up, left, diagonal).'),
  d('dp-2d', 'longest-palindromic-subsequence', 'Length of the longest palindromic subsequence of a string.', 'Interval DP, or the LCS of the string and its reverse.'),
  d('dp-2d', 'distinct-subsequences', 'How many distinct subsequences of s equal t?', 'Two-sequence DP: match → use it or skip it; mismatch → skip.'),
  d('dp-2d', 'longest-increasing-path-in-a-matrix', 'Longest strictly increasing path moving in four directions in a matrix.', 'DFS with memoization (the grid is a DAG ordered by value).'),
  d('knapsack', 'ones-and-zeroes', 'Largest subset of binary strings with at most m zeros and n ones in total.', '0/1 knapsack with two capacities (loop both downward).'),
  d('knapsack', 'last-stone-weight-ii', 'Smash stones together pairwise: smallest possible final weight.', 'Split into two groups with the smallest difference: subset sum up to total/2.'),
  d('knapsack', 'combination-sum-iv', 'Count ordered sequences of numbers (reuse allowed) that sum to a target.', 'Amount-outer, number-inner loops count permutations.'),

  // greedy and intervals
  d('greedy', 'assign-cookies', 'Give each child at most one cookie big enough for their greed: maximize content children.', 'Sort both; match the smallest sufficient cookie greedily.'),
  d('greedy', 'candy', 'Children in a row get candies so a higher rating beats each neighbour: minimum total.', 'Two passes (left-to-right and right-to-left), taking the max.'),
  d('greedy', 'best-time-to-buy-and-sell-stock-ii', 'Maximum profit with unlimited transactions (one share at a time).', 'Add every positive day-to-day increase.'),
  d('greedy', 'valid-parenthesis-string', 'Is a string of “(”, “)” and “*” (which can be either or empty) balanced?', 'Track the range [lo, hi] of possible open counts.'),
  d('intervals', 'interval-list-intersections', 'Intersect two sorted lists of disjoint intervals.', 'Two pointers; advance whichever interval ends first.'),
  d('intervals', 'remove-covered-intervals', 'Count intervals that aren’t covered by another interval.', 'Sort by start ascending, end descending; track the max end.'),
  d('intervals', 'employee-free-time', 'Common free time across all employees’ sorted schedules.', 'Merge all intervals; the gaps are the answer.'),

  // tries, bits, design, matrix
  d('trie', 'replace-words', 'Replace each word in a sentence by its shortest root from a dictionary.', 'A trie of roots; walk each word until a root ends.'),
  d('trie', 'longest-word-in-dictionary', 'Longest word that can be built one letter at a time from other words in the list.', 'Trie + DFS through nodes that are all word ends.'),
  d('bits', 'power-of-two', 'Is n a power of two?', 'n > 0 && (n & (n − 1)) == 0.'),
  d('bits', 'single-number-iii', 'Exactly two elements appear once and the rest twice: find both.', 'XOR all, split by the lowest set bit of the result, XOR each group.'),
  d('bits', 'hamming-distance', 'Number of positions where two integers’ bits differ.', 'bitCount(x ^ y).'),
  d('design', 'insert-delete-getrandom-o1', 'A set with O(1) insert, delete and getRandom.', 'An ArrayList of values + a map from value to index; swap with the last on delete.'),
  d('design', 'design-twitter', 'Post, follow, and fetch the 10 most recent tweets from followed users.', 'Per-user lists with timestamps, merged with a heap (k-way merge).'),
  d('matrix', 'game-of-life', 'Compute the next Game of Life state in place.', 'Encode old and new states in two bits of each cell, then shift.'),
  d('matrix', 'spiral-matrix-ii', 'Fill an n×n matrix with 1..n² in spiral order.', 'Four shrinking boundaries, writing instead of reading.'),
];
})();

(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

DSA.module({
  id: 'backtracking', title: 'Backtracking', short: 'Backtracking',
  blurb: 'Generate every subset, permutation, combination or board by walking a decision tree: choose, explore, un-choose, and prune early.',
  intro: M`
    Backtracking is structured brute force: explore a **decision tree** depth-first, keep one mutable partial answer, and undo each choice on the way back up. It's the right tool when the problem asks for **all** solutions, or when n is small (≤ 15–20) and no clever structure exists. The skill is choosing the decisions, avoiding duplicates, and pruning branches that can't succeed.
  `,
  more: [
    lc(77, 'combinations', 'Combinations', 'easier'),
    lc(784, 'letter-case-permutation', 'Letter Case Permutation', 'easier'),
    lc(47, 'permutations-ii', 'Permutations II', 'variant'),
    lc(216, 'combination-sum-iii', 'Combination Sum III', 'variant'),
    lc(93, 'restore-ip-addresses', 'Restore IP Addresses', 'similar'),
    lc(52, 'n-queens-ii', 'N-Queens II', 'variant'),
    lc(37, 'sudoku-solver', 'Sudoku Solver', 'harder'),
    lc(698, 'partition-to-k-equal-sum-subsets', 'Partition to K Equal Sum Subsets', 'harder'),
    lc(1239, 'maximum-length-of-a-concatenated-string-with-unique-characters', 'Maximum Length of a Concatenated String with Unique Characters', 'similar'),
    lc(473, 'matchsticks-to-square', 'Matchsticks to Square', 'harder'),
    lc(301, 'remove-invalid-parentheses', 'Remove Invalid Parentheses', 'harder'),
    lc(1219, 'path-with-maximum-gold', 'Path with Maximum Gold', 'similar'),
  ],
  items: [
    { lesson: 'backtracking', title: 'Backtracking: choose, explore, un-choose', mins: 16,
      lede: 'Every backtracking solution is the same recursive skeleton. The decisions, the duplicate rule and the pruning are what change.',
      body: M`
        ## The skeleton
        ~~~java Template: backtracking
        void backtrack(State state, List<Result> res) {
            if (isComplete(state)) { res.add(copyOf(state)); return; }   // a leaf: record a COPY
            for (Choice c : choicesFrom(state)) {
                if (!valid(state, c)) continue;                          // prune
                apply(state, c);                                         // choose
                backtrack(state, res);                                   // explore
                undo(state, c);                                          // un-choose
            }
        }
        ~~~
        One mutable «path» (a list or char array) is shared by the whole search. Because every choice is undone, the path at any moment describes exactly the node you're at. Copy it only when you record a result.

        ## Three canonical decision trees
        **Subsets / combinations: "which later element comes next?"** Pass a «start» index, so each element is only considered after the ones before it. That way «[1,2]» and «[2,1]» never both appear.

        @viz subsetsTree

        **Permutations: "which unused element comes next?"** Order matters, so every unused element is a candidate at every level. Track usage with «boolean[] used».

        @viz permTree

        **Constraint placement: "where does the next piece go?"** N-Queens, Sudoku and word search place one item per level and check constraints incrementally with O(1) lookups (sets or arrays for columns and diagonals, in-place visited marks).

        @viz nQueens

        ## Handling duplicate inputs
        With repeated values («[1, 2, 2]»), two branches can build the same combination. The fix: **sort**, then at each level skip a value equal to the previous candidate at that same level:
        ~~~java
        for (int i = start; i < nums.length; i++) {
            if (i > start && nums[i] == nums[i - 1]) continue;   // same value, same level: skip
            ...
        }
        ~~~
        For permutations with duplicates: «if (i > 0 && nums[i] == nums[i − 1] && !used[i − 1]) continue;».

        ## Pruning
        Pruning is what makes backtracking practical. Cut a branch as soon as it provably can't lead to a solution:
        - **Sorted candidates + target:** once a candidate exceeds the remaining target, every later one does too, so «break».
        - **Counting constraints:** in Generate Parentheses, never close more than you've opened, and never open more than n.
        - **Feasibility bounds:** in Partition to K Subsets, if the remaining elements can't fill the buckets, stop.

        @viz combSumTree

        ## Complexity
        Count the nodes of the decision tree:
        | Problem | Leaves | Total cost |
        |---|---|---|
        | Subsets | 2ⁿ | O(n · 2ⁿ) (copying each subset) |
        | Permutations | n! | O(n · n!) |
        | Combinations C(n, k) | C(n, k) | O(k · C(n, k)) |
        | Letter combinations | 4ⁿ worst case | O(n · 4ⁿ) |
        That's why these problems have tiny limits (n ≤ 10–20). If n were 10⁵, backtracking would be the wrong tool; look for DP or greedy.

        ## Backtracking vs DP
        Both explore choices. Use **DP** when you need a *count* or an *optimum*, and subproblems repeat (overlapping states). Use **backtracking** when you must *list* every solution, or when states rarely repeat. If a backtracking solution recomputes the same (index, remaining) state often, memoize it, and it becomes DP.

        ## Signals
        - "Return **all** subsets / permutations / combinations / partitions / boards / paths."
        - Small n (≤ 15–20), exponential output, "generate".
        - Constraint satisfaction: queens, sudoku, placing items without conflicts.
        - "Find a word in a grid", "reach a target by choosing items" where n is small.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'In the subsets template, what does passing «i + 1» (not «0») as the next start index achieve?',
          options: ['It makes the recursion faster only', 'Each combination is built in one canonical order (increasing index), so no subset is generated twice', 'It allows reusing elements', 'It sorts the output'],
          answer: 1, why: 'Only allowing later indices means [1,2] can be built but [2,1] can’t: exactly one ordering per subset. Passing «i» (same index) would allow reuse, as in Combination Sum.' },
        { q: 'For «nums = [1, 2, 2]», the skip rule «i > start && nums[i] == nums[i−1]» prevents…',
          options: ['using the value 2 twice in one subset', 'choosing the second 2 as the next element at the same level where the first 2 was already tried', 'any subset containing 2', 'nothing, since duplicates are allowed'],
          answer: 1, why: '[2, 2] is still generated (the second 2 is chosen at a *deeper* level, where i == start). What’s skipped is starting the same branch twice at one level, which would duplicate everything below it.' },
      ],
      practice: ['subsets', 'subsets-ii', 'permutations', 'combination-sum', 'combination-sum-ii', 'letter-combinations', 'generate-parentheses', 'word-search', 'palindrome-partitioning', 'n-queens'],
    },

    { problem: {
      id: 'subsets', title: 'All Subsets', diff: 'medium',
      tags: ['backtracking', 'power set'],
      statement: M`
        Given an array of **distinct** integers «nums», return every possible subset (the power set). Don't include duplicates. Subsets may be returned in any order, and so may the elements inside each subset.
      `,
      fn: { name: 'subsets', params: [['int[]', 'nums']], ret: 'List<List<Integer>>' },
      compare: 'unordered-deep',
      tests: [
        { args: [[1, 2, 3]], ex: true, expect: [[], [1], [2], [1, 2], [3], [1, 3], [2, 3], [1, 2, 3]] },
        { args: [[0]], ex: true, expect: [[], [0]] },
        { args: [[-1, 5]], expect: [[], [-1], [5], [-1, 5]] },
        { args: [[4, 1, 0]] },
        { args: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10 (large test: 15)', 'All values are distinct'],
      hints: [
        'Each element is either in a subset or not: 2ⁿ subsets in total.',
        'Backtracking: at each node, record the current path; then try adding each element at index ≥ start and recurse with start = i + 1.',
        'Remember to add a **copy** of the path, and to remove the last element after recursing.',
      ],
      solution: {
        pattern: '**Subset backtracking with a start index:** every node of the decision tree is an answer.',
        intuition: 'Build subsets in increasing index order. The node for path P can extend with any later element, so every subset is reached exactly once, by adding its elements in index order.',
        java: J`class Solution {
    public List<List<Integer>> subsets(int[] nums) {
        List<List<Integer>> res = new ArrayList<>();
        backtrack(nums, 0, new ArrayList<>(), res);
        return res;
    }

    private void backtrack(int[] nums, int start, List<Integer> path, List<List<Integer>> res) {
        res.add(new ArrayList<>(path));                 // every node is a subset
        for (int i = start; i < nums.length; i++) {
            path.add(nums[i]);
            backtrack(nums, i + 1, path, res);
            path.remove(path.size() - 1);
        }
    }
}`,
        time: 'O(n · 2ⁿ)', space: 'O(n) recursion (plus the output)',
        pitfalls: M`
          - «res.add(path)» without copying: every entry points to the same list, which ends up empty.
          - «path.remove(Integer.valueOf(x))» searches for the value. Remove by the last index instead.
        `,
        alts: [
          { name: 'Include/exclude recursion', time: 'O(n · 2ⁿ)', space: 'O(n)', note: 'At index i, branch twice: skip nums[i] or take it. Leaves (i == n) are the subsets. The same tree drawn as a binary decision per element.',
            java: J`class Solution {
    public List<List<Integer>> subsets(int[] nums) {
        List<List<Integer>> res = new ArrayList<>();
        go(nums, 0, new ArrayList<>(), res);
        return res;
    }
    private void go(int[] nums, int i, List<Integer> path, List<List<Integer>> res) {
        if (i == nums.length) { res.add(new ArrayList<>(path)); return; }
        go(nums, i + 1, path, res);                       // exclude nums[i]
        path.add(nums[i]);
        go(nums, i + 1, path, res);                       // include nums[i]
        path.remove(path.size() - 1);
    }
}` },
          { name: 'Bitmask enumeration', time: 'O(n · 2ⁿ)', space: 'O(1) extra', note: 'Every integer mask in [0, 2ⁿ) is a subset: bit i set means include nums[i]. Iterative, and a common trick in bit manipulation.',
            java: J`class Solution {
    public List<List<Integer>> subsets(int[] nums) {
        List<List<Integer>> res = new ArrayList<>();
        for (int mask = 0; mask < (1 << nums.length); mask++) {
            List<Integer> s = new ArrayList<>();
            for (int i = 0; i < nums.length; i++) if ((mask >> i & 1) == 1) s.add(nums[i]);
            res.add(s);
        }
        return res;
    }
}` },
          { name: 'Iterative doubling', time: 'O(n · 2ⁿ)', space: 'O(1) extra', note: 'Start with [[]]; for each number, copy every existing subset and add the number to the copies.' },
        ],
        talk: 'Backtracking with a start index: record the current path at every node, then extend with each later element and undo. That generates each of the 2ⁿ subsets once. O(n·2ⁿ) with the copies.',
      },
      viz: { id: 'subsetsTree' },
      lc: [lc(78, 'subsets', 'Subsets', 'same'), lc(90, 'subsets-ii', 'Subsets II', 'harder'), lc(77, 'combinations', 'Combinations', 'similar'), lc(1863, 'sum-of-all-subset-xor-totals', 'Sum of All Subset XOR Totals', 'easier')],
      drill: { prompt: 'Return every subset of a set of distinct integers.', pattern: 'backtracking', why: 'Enumerate a decision tree (start index, choose/explore/un-choose), or use bitmasks.' },
    } },

    { problem: {
      id: 'subsets-ii', title: 'Subsets With Duplicates', diff: 'medium',
      tags: ['backtracking', 'dedupe'],
      statement: M`
        «nums» may contain **duplicates**. Return every **distinct** subset (as multisets, «[1,2]» and «[2,1]» are the same). Order doesn't matter.
      `,
      fn: { name: 'subsetsWithDup', params: [['int[]', 'nums']], ret: 'List<List<Integer>>' },
      compare: 'unordered-deep',
      tests: [
        { args: [[1, 2, 2]], ex: true, expect: [[], [1], [1, 2], [1, 2, 2], [2], [2, 2]] },
        { args: [[0]], ex: true, expect: [[], [0]] },
        { args: [[2, 2, 2]], expect: [[], [2], [2, 2], [2, 2, 2]] },
        { args: [[4, 4, 4, 1, 4]] },
        { args: [[3, 1, 2, 3]] },
        { args: [[1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10 (large test: 14)', '−10 ≤ nums[i] ≤ 10'],
      hints: [
        'Plain subset backtracking produces duplicates like [1,2] twice (using either 2). How can you make equal values interchangeable?',
        'Sort first, so equal values are adjacent.',
        'At each level of the loop, skip «nums[i]» if it equals «nums[i − 1]» and «i > start»: that branch was already explored with the first copy.',
      ],
      solution: {
        pattern: '**Sort + skip equal siblings:** the standard way to deduplicate in backtracking without a HashSet.',
        intuition: M`
          After sorting, the copies of a value form a block. At one level of the tree, choosing the first copy or the second copy leads to identical subtrees, so only the first copy may start a branch at that level. Deeper levels can still use the second copy (i == start there), which is how «[2, 2]» still appears.
        `,
        java: J`class Solution {
    public List<List<Integer>> subsetsWithDup(int[] nums) {
        Arrays.sort(nums);
        List<List<Integer>> res = new ArrayList<>();
        backtrack(nums, 0, new ArrayList<>(), res);
        return res;
    }

    private void backtrack(int[] nums, int start, List<Integer> path, List<List<Integer>> res) {
        res.add(new ArrayList<>(path));
        for (int i = start; i < nums.length; i++) {
            if (i > start && nums[i] == nums[i - 1]) continue;   // same value at the same level
            path.add(nums[i]);
            backtrack(nums, i + 1, path, res);
            path.remove(path.size() - 1);
        }
    }
}`,
        time: 'O(n · 2ⁿ)', space: 'O(n)',
        pitfalls: M`
          - «i > 0» instead of «i > start» over-prunes: it would forbid «[2, 2]».
          - Forgetting to sort makes the skip rule meaningless.
        `,
        alts: [
          { name: 'Generate everything, dedupe with a Set', time: 'O(n · 2ⁿ)', space: 'O(n · 2ⁿ)', note: 'Sort first so equal subsets become equal lists, then use a HashSet<List<Integer>>. Correct, but wasteful and it hides the skill.',
            java: J`class Solution {
    public List<List<Integer>> subsetsWithDup(int[] nums) {
        Arrays.sort(nums);
        Set<List<Integer>> set = new HashSet<>();
        for (int mask = 0; mask < (1 << nums.length); mask++) {
            List<Integer> s = new ArrayList<>();
            for (int i = 0; i < nums.length; i++) if ((mask >> i & 1) == 1) s.add(nums[i]);
            set.add(s);
        }
        return new ArrayList<>(set);
    }
}` },
        ],
        talk: 'Sort, then run subset backtracking, skipping nums[i] when it equals nums[i−1] at the same level (i > start). Equal values then start only one branch per level, so there are no duplicate subsets and no HashSet.',
      },
      lc: [lc(90, 'subsets-ii', 'Subsets II', 'same'), lc(78, 'subsets', 'Subsets', 'easier'), lc(47, 'permutations-ii', 'Permutations II', 'similar'), lc(40, 'combination-sum-ii', 'Combination Sum II', 'similar')],
      drill: { prompt: 'All distinct subsets of an array that contains repeated values.', pattern: 'backtracking', why: 'Sort, then skip equal values at the same recursion level.' },
    } },

    { problem: {
      id: 'permutations', title: 'All Permutations', diff: 'medium',
      tags: ['backtracking', 'used[]'],
      statement: M`
        Given an array of **distinct** integers, return all possible orderings (permutations), in any order.
      `,
      fn: { name: 'permute', params: [['int[]', 'nums']], ret: 'List<List<Integer>>' },
      compare: 'unordered',
      tests: [
        { args: [[1, 2, 3]], ex: true, expect: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]] },
        { args: [[0, 1]], ex: true, expect: [[0, 1], [1, 0]] },
        { args: [[1]], ex: true, expect: [[1]] },
        { args: [[5, -1, 3, 0]] },
        { args: [[1, 2, 3, 4, 5, 6, 7, 8]], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 6 (large test: 8)', 'All values are distinct'],
      hints: [
        'Build a permutation position by position. Which elements can go in the next position?',
        'Any element not already used. Track usage with a «boolean[]».',
        'When the path has n elements, record a copy.',
      ],
      solution: {
        pattern: '**Permutation backtracking:** at each level, try every unused element; a «used[]» array makes the check O(1).',
        intuition: 'A permutation is a sequence of choices: which element goes first, which of the remaining goes second, and so on. The decision tree has n choices at the top, n − 1 below, and so on: n! leaves.',
        java: J`class Solution {
    public List<List<Integer>> permute(int[] nums) {
        List<List<Integer>> res = new ArrayList<>();
        backtrack(nums, new boolean[nums.length], new ArrayList<>(), res);
        return res;
    }

    private void backtrack(int[] nums, boolean[] used, List<Integer> path, List<List<Integer>> res) {
        if (path.size() == nums.length) { res.add(new ArrayList<>(path)); return; }
        for (int i = 0; i < nums.length; i++) {
            if (used[i]) continue;
            used[i] = true; path.add(nums[i]);
            backtrack(nums, used, path, res);
            used[i] = false; path.remove(path.size() - 1);
        }
    }
}`,
        time: 'O(n · n!)', space: 'O(n)',
        pitfalls: M`
          - Using «path.contains(x)» to check usage is O(n) per check. Fine for n ≤ 6, but «used[]» is the clean version.
          - Forgetting to reset «used[i]» on the way back.
        `,
        alts: [
          { name: 'Swap-based (in place)', time: 'O(n · n!)', space: 'O(n)', note: 'Fix position k by swapping each later element into it, recurse on k + 1, then swap back. There’s no used[] array and the array itself is the path.',
            java: J`class Solution {
    public List<List<Integer>> permute(int[] nums) {
        List<List<Integer>> res = new ArrayList<>();
        go(nums, 0, res);
        return res;
    }
    private void go(int[] a, int k, List<List<Integer>> res) {
        if (k == a.length) { List<Integer> p = new ArrayList<>(); for (int x : a) p.add(x); res.add(p); return; }
        for (int i = k; i < a.length; i++) {
            int t = a[k]; a[k] = a[i]; a[i] = t;
            go(a, k + 1, res);
            t = a[k]; a[k] = a[i]; a[i] = t;
        }
    }
}` },
        ],
        followups: M`
          - **With duplicates** (LeetCode 47): sort, and skip «nums[i]» if «nums[i] == nums[i − 1] && !used[i − 1]».
          - **Next permutation** (LeetCode 31): an O(n) in-place trick, not backtracking.
          - **k-th permutation** (LeetCode 60): the factorial number system, O(n²).
        `,
        talk: 'Backtracking: at each position, try every unused element (a used[] array), recurse, then undo. Record a copy when the path is full. n! leaves, O(n·n!).',
      },
      viz: { id: 'permTree' },
      lc: [lc(46, 'permutations', 'Permutations', 'same'), lc(47, 'permutations-ii', 'Permutations II', 'harder'), lc(31, 'next-permutation', 'Next Permutation', 'similar'), lc(60, 'permutation-sequence', 'Permutation Sequence', 'harder')],
      drill: { prompt: 'Generate every ordering of a list of distinct numbers.', pattern: 'backtracking', why: 'Permutation backtracking: choose any unused element at each position.' },
    } },

    { problem: {
      id: 'combination-sum', title: 'Combination Sum (Reuse Allowed)', diff: 'medium',
      tags: ['backtracking', 'pruning'],
      statement: M`
        Given **distinct** positive integers «candidates» and a «target», return every unique combination of candidates that sums to «target». Each candidate can be used **any number of times**. Two combinations are the same if they use the same multiset of numbers. Order doesn't matter.
      `,
      fn: { name: 'combinationSum', params: [['int[]', 'candidates'], ['int', 'target']], ret: 'List<List<Integer>>' },
      compare: 'unordered-deep',
      tests: [
        { args: [[2, 3, 6, 7], 7], ex: true, expect: [[2, 2, 3], [7]] },
        { args: [[2, 3, 5], 8], ex: true, expect: [[2, 2, 2, 2], [2, 3, 3], [3, 5]] },
        { args: [[2], 1], ex: true, expect: [] },
        { args: [[1], 2], expect: [[1, 1]] },
        { args: [[7, 3, 2], 18] },
        { args: [[8, 7, 4, 3], 11], expect: [[3, 4, 4], [3, 8], [4, 7]] },
        { args: [[2, 3, 5, 7, 11, 13], 40], big: true },
      ],
      constraints: ['1 ≤ candidates.length ≤ 30', '2 ≤ candidates[i] ≤ 40, distinct', '1 ≤ target ≤ 40'],
      hints: [
        'Backtracking over "which candidate next", with the remaining target shrinking.',
        'To avoid permutations of the same combination, only allow candidates at index ≥ the current one, and recurse with the **same** index (reuse is allowed).',
        'Sort the candidates so you can stop the loop («break») as soon as a candidate exceeds the remaining target.',
      ],
      solution: {
        pattern: '**Combination backtracking with reuse:** recurse with «i» (not «i + 1»), sort, and break on overshoot.',
        intuition: 'Build each combination in non-decreasing order, which is the canonical form of a multiset. Staying at index i allows another copy of the same candidate; moving right never goes back, so no permutation appears twice. Sorting lets one comparison prune all larger candidates.',
        java: J`class Solution {
    public List<List<Integer>> combinationSum(int[] candidates, int target) {
        Arrays.sort(candidates);
        List<List<Integer>> res = new ArrayList<>();
        backtrack(candidates, 0, target, new ArrayList<>(), res);
        return res;
    }

    private void backtrack(int[] c, int start, int remaining, List<Integer> path, List<List<Integer>> res) {
        if (remaining == 0) { res.add(new ArrayList<>(path)); return; }
        for (int i = start; i < c.length; i++) {
            if (c[i] > remaining) break;                    // sorted: the rest are too big too
            path.add(c[i]);
            backtrack(c, i, remaining - c[i], path, res);   // i: the same candidate may repeat
            path.remove(path.size() - 1);
        }
    }
}`,
        time: 'O(n^(T/m)) worst', space: 'O(T/m) depth', timeWhy: 'T = target, m = smallest candidate',
        pitfalls: M`
          - Recursing with «0» instead of «i» generates permutations ([2,3,2], [3,2,2]…).
          - Recursing with «i + 1» forbids reuse (that's Combination Sum II).
          - Without sorting, you can't «break», only «continue».
        `,
        alts: [
          { name: 'Take / skip each candidate', time: 'exponential', space: 'O(T/m)', note: 'At index i: either take c[i] (stay at i) or move to i + 1. The same tree, as binary decisions.',
            java: J`class Solution {
    public List<List<Integer>> combinationSum(int[] c, int target) {
        List<List<Integer>> res = new ArrayList<>();
        go(c, 0, target, new ArrayList<>(), res);
        return res;
    }
    private void go(int[] c, int i, int rem, List<Integer> path, List<List<Integer>> res) {
        if (rem == 0) { res.add(new ArrayList<>(path)); return; }
        if (i == c.length || rem < 0) return;
        path.add(c[i]); go(c, i, rem - c[i], path, res); path.remove(path.size() - 1);  // take c[i]
        go(c, i + 1, rem, path, res);                                                  // skip it
    }
}` },
        ],
        followups: M`
          - **Only count the combinations:** that's Coin Change II, a DP (the 2-D DP module). Listing needs backtracking; counting needs DP.
        `,
        talk: 'Sort, then backtrack with a start index. Each call tries candidates from start onward, recursing with the same index since reuse is allowed, and breaks as soon as a candidate exceeds the remaining target. Non-decreasing order avoids duplicate combinations.',
      },
      viz: { id: 'combSumTree' },
      lc: [lc(39, 'combination-sum', 'Combination Sum', 'same'), lc(40, 'combination-sum-ii', 'Combination Sum II', 'variant'), lc(216, 'combination-sum-iii', 'Combination Sum III', 'variant'), lc(518, 'coin-change-ii', 'Coin Change II', 'similar')],
      drill: { prompt: 'List every multiset of given distinct numbers (reuse allowed) that sums to a target.', pattern: 'backtracking', why: 'Combination backtracking recursing on the same index, with sorted early break.' },
    } },

    { problem: {
      id: 'combination-sum-ii', title: 'Combination Sum (Use Each Once)', diff: 'medium',
      tags: ['backtracking', 'dedupe', 'pruning'],
      statement: M`
        «candidates» may contain **duplicates**. Return every unique combination that sums to «target», using each array element **at most once**. The result must not contain duplicate combinations.
      `,
      fn: { name: 'combinationSum2', params: [['int[]', 'candidates'], ['int', 'target']], ret: 'List<List<Integer>>' },
      compare: 'unordered-deep',
      tests: [
        { args: [[10, 1, 2, 7, 6, 1, 5], 8], ex: true, expect: [[1, 1, 6], [1, 2, 5], [1, 7], [2, 6]] },
        { args: [[2, 5, 2, 1, 2], 5], ex: true, expect: [[1, 2, 2], [5]] },
        { args: [[1, 1, 1, 1], 2], expect: [[1, 1]] },
        { args: [[3], 2], expect: [] },
        { args: [[4, 4, 2, 1, 4, 2, 2, 1, 3], 6] },
        { args: [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 27], expect: [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]], why: 'Without deduplication this explodes: C(30, 27) branches.' },
        { args: [[5, 3, 8, 2, 7, 1, 6, 4, 9, 10, 3, 5, 7, 2, 8, 1, 6, 4, 9, 10, 2, 3, 4, 5, 6], 25], big: true },
      ],
      constraints: ['1 ≤ candidates.length ≤ 100', '1 ≤ candidates[i] ≤ 50', '1 ≤ target ≤ 30'],
      hints: [
        'Like Combination Sum, but each element is used at most once, so recurse with «i + 1».',
        'Duplicates in the input create duplicate combinations. Use the Subsets II trick.',
        'Sort; skip «candidates[i]» when «i > start» and it equals «candidates[i − 1]»; break when a candidate exceeds the remaining target.',
      ],
      solution: {
        pattern: '**Combination backtracking + sort-and-skip dedupe + sorted pruning:** three techniques in one short loop.',
        intuition: 'Sorting groups equal values and enables the overshoot «break». At each level, only the first copy of a value may start a branch; deeper levels may still take the next copy. Moving to «i + 1» enforces "each element at most once".',
        java: J`class Solution {
    public List<List<Integer>> combinationSum2(int[] candidates, int target) {
        Arrays.sort(candidates);
        List<List<Integer>> res = new ArrayList<>();
        backtrack(candidates, 0, target, new ArrayList<>(), res);
        return res;
    }

    private void backtrack(int[] c, int start, int remaining, List<Integer> path, List<List<Integer>> res) {
        if (remaining == 0) { res.add(new ArrayList<>(path)); return; }
        for (int i = start; i < c.length; i++) {
            if (i > start && c[i] == c[i - 1]) continue;   // duplicate value at the same level
            if (c[i] > remaining) break;                   // sorted pruning
            path.add(c[i]);
            backtrack(c, i + 1, remaining - c[i], path, res);
            path.remove(path.size() - 1);
        }
    }
}`,
        time: 'O(2ⁿ) worst', space: 'O(n)',
        pitfalls: M`
          - Deduplicating with a HashSet after generating is exponentially slow on inputs like thirty 1s (test 6).
          - The skip condition must be «i > start», not «i > 0».
        `,
        alts: [
          { name: 'Counts of each distinct value', time: 'exponential', space: 'O(distinct)', note: 'Compress to (value, count) pairs and choose how many copies of each value (0…count) to take. It naturally avoids duplicates.',
            java: J`class Solution {
    public List<List<Integer>> combinationSum2(int[] candidates, int target) {
        TreeMap<Integer, Integer> cnt = new TreeMap<>();
        for (int c : candidates) cnt.merge(c, 1, Integer::sum);
        List<int[]> items = new ArrayList<>();
        for (Map.Entry<Integer, Integer> e : cnt.entrySet()) items.add(new int[]{e.getKey(), e.getValue()});
        List<List<Integer>> res = new ArrayList<>();
        go(items, 0, target, new ArrayList<>(), res);
        return res;
    }
    private void go(List<int[]> items, int i, int rem, List<Integer> path, List<List<Integer>> res) {
        if (rem == 0) { res.add(new ArrayList<>(path)); return; }
        if (i == items.size() || items.get(i)[0] > rem) return;
        int v = items.get(i)[0], c = items.get(i)[1];
        go(items, i + 1, rem, path, res);                         // take 0 copies
        int k = 0;
        while (k < c && rem - v * (k + 1) >= 0) { path.add(v); k++; go(items, i + 1, rem - v * k, path, res); }
        for (int j = 0; j < k; j++) path.remove(path.size() - 1);
    }
}` },
        ],
        talk: 'Sort, backtrack with i+1 (each element once), skip equal values at the same level to avoid duplicate combinations, and break once a candidate exceeds what’s left.',
      },
      lc: [lc(40, 'combination-sum-ii', 'Combination Sum II', 'same'), lc(39, 'combination-sum', 'Combination Sum', 'variant'), lc(90, 'subsets-ii', 'Subsets II', 'similar')],
      drill: { prompt: 'Unique combinations summing to target, each array element used at most once, input has duplicates.', pattern: 'backtracking', why: 'Sort, recurse with i+1, skip equal values at the same level, and break on overshoot.' },
    } },

    { problem: {
      id: 'letter-combinations', title: 'Phone Keypad Combinations', diff: 'medium',
      tags: ['backtracking', 'cartesian product'],
      statement: M`
        Each digit 2–9 maps to letters as on a phone keypad: 2 → abc, 3 → def, 4 → ghi, 5 → jkl, 6 → mno, 7 → pqrs, 8 → tuv, 9 → wxyz. Given a string of digits, return every letter combination it could represent, in any order. Return an empty list for empty input.
      `,
      fn: { name: 'letterCombinations', params: [['String', 'digits']], ret: 'List<String>' },
      compare: 'unordered',
      tests: [
        { args: ['23'], ex: true, expect: ['ad', 'ae', 'af', 'bd', 'be', 'bf', 'cd', 'ce', 'cf'] },
        { args: [''], ex: true, expect: [] },
        { args: ['2'], ex: true, expect: ['a', 'b', 'c'] },
        { args: ['79'] },
        { args: ['234'] },
        { args: ['99999999'], big: true },
      ],
      constraints: ['0 ≤ digits.length ≤ 4 (large test: 8)', 'digits[i] ∈ 2..9'],
      hints: [
        'One letter per digit, and the choices are independent: a cartesian product.',
        'Recurse over digit positions; at position i, try each letter mapped to digits[i].',
        'Build the string in a «StringBuilder» or «char[]» and undo each choice.',
      ],
      solution: {
        pattern: '**Backtracking as a cartesian product:** one level per position, one branch per option.',
        intuition: 'The tree has one level per digit and 3–4 branches per level. Every leaf is one full combination.',
        java: J`class Solution {
    private static final String[] KEYS = {"", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"};

    public List<String> letterCombinations(String digits) {
        List<String> res = new ArrayList<>();
        if (digits.isEmpty()) return res;
        backtrack(digits, 0, new StringBuilder(), res);
        return res;
    }

    private void backtrack(String d, int i, StringBuilder sb, List<String> res) {
        if (i == d.length()) { res.add(sb.toString()); return; }
        for (char c : KEYS[d.charAt(i) - '0'].toCharArray()) {
            sb.append(c);
            backtrack(d, i + 1, sb, res);
            sb.deleteCharAt(sb.length() - 1);
        }
    }
}`,
        time: 'O(n · 4ⁿ)', space: 'O(n)',
        pitfalls: M`
          - Empty input must return «[]», not «[""]».
          - String concatenation in the recursion («s + c») works (short strings) but creates garbage; «StringBuilder» with undo is the idiomatic version.
        `,
        alts: [
          { name: 'Iterative BFS over positions', time: 'O(n · 4ⁿ)', space: 'O(4ⁿ)', java: J`class Solution {
    public List<String> letterCombinations(String digits) {
        if (digits.isEmpty()) return new ArrayList<>();
        String[] keys = {"", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"};
        List<String> res = new ArrayList<>(List.of(""));
        for (char d : digits.toCharArray()) {
            List<String> next = new ArrayList<>();
            for (String prefix : res) for (char c : keys[d - '0'].toCharArray()) next.add(prefix + c);
            res = next;
        }
        return res;
    }
}` },
        ],
        talk: 'Backtracking over digit positions: for each letter of the current digit, append, recurse, remove. Leaves are the combinations. O(n·4ⁿ).',
      },
      lc: [lc(17, 'letter-combinations-of-a-phone-number', 'Letter Combinations of a Phone Number', 'same'), lc(784, 'letter-case-permutation', 'Letter Case Permutation', 'similar'), lc(401, 'binary-watch', 'Binary Watch', 'similar')],
      drill: { prompt: 'All letter strings a phone-keypad digit sequence could spell.', pattern: 'backtracking', why: 'A cartesian product via backtracking, one level per digit.' },
    } },

    { problem: {
      id: 'generate-parentheses', title: 'Generate Balanced Parentheses', diff: 'medium',
      tags: ['backtracking', 'counting constraint'],
      statement: M`
        Given «n», return every string of «n» pairs of parentheses that is **well-formed** (balanced), in any order.
      `,
      fn: { name: 'generateParenthesis', params: [['int', 'n']], ret: 'List<String>' },
      compare: 'unordered',
      tests: [
        { args: [3], ex: true, expect: ['((()))', '(()())', '(())()', '()(())', '()()()'] },
        { args: [1], ex: true, expect: ['()'] },
        { args: [2], expect: ['(())', '()()'] },
        { args: [4] },
        { args: [11], big: true },
      ],
      constraints: ['1 ≤ n ≤ 8 (large test: 11)'],
      hints: [
        'Generating all 2²ⁿ strings and filtering valid ones works but wastes time. When is it legal to add "(" or ")"?',
        'Add "(" while you have used fewer than n. Add ")" only if it closes something: close < open.',
        'With those two rules, every leaf of length 2n is valid automatically.',
      ],
      solution: {
        pattern: '**Backtracking with counting constraints:** prune invalid prefixes as you build, so every leaf is a solution.',
        intuition: 'A prefix can be completed to a valid string exactly when it never closes more than it has opened, and never opens more than n. Enforcing these two conditions at every step means you never explore a dead branch.',
        java: J`class Solution {
    public List<String> generateParenthesis(int n) {
        List<String> res = new ArrayList<>();
        build(new char[2 * n], 0, 0, 0, n, res);
        return res;
    }

    private void build(char[] buf, int pos, int open, int close, int n, List<String> res) {
        if (pos == buf.length) { res.add(new String(buf)); return; }
        if (open < n) { buf[pos] = '('; build(buf, pos + 1, open + 1, close, n, res); }
        if (close < open) { buf[pos] = ')'; build(buf, pos + 1, open, close + 1, n, res); }
    }
}`,
        time: 'O(4ⁿ / √n)', space: 'O(n)', timeWhy: 'the n-th Catalan number of results, each of length 2n',
        pitfalls: M`
          - With a «char[]» of fixed size there's nothing to "undo": the next write overwrites the slot.
          - «close <= open» allows closing more than you opened.
        `,
        alts: [
          { name: 'Generate all, filter valid', time: 'O(2²ⁿ · n)', space: 'O(n)', note: 'Correct, but exponentially wasteful. It’s why pruning matters.', check: false },
          { name: 'DP by first matching pair', time: 'O(4ⁿ / √n)', space: 'large', note: 'Every valid string is «(A)B», where A has k pairs and B has n − 1 − k, so combine smaller results. It’s the Catalan recurrence made executable.',
            java: J`class Solution {
    public List<String> generateParenthesis(int n) {
        List<List<String>> dp = new ArrayList<>();
        dp.add(List.of(""));
        for (int m = 1; m <= n; m++) {
            List<String> cur = new ArrayList<>();
            for (int k = 0; k < m; k++)
                for (String a : dp.get(k)) for (String b : dp.get(m - 1 - k)) cur.add("(" + a + ")" + b);
            dp.add(cur);
        }
        return dp.get(n);
    }
}` },
        ],
        talk: 'Backtracking with two counts: add “(” while open < n, and add “)” while close < open. That prunes every invalid prefix, so every full-length string is valid. The count of results is the Catalan number.',
      },
      lc: [lc(22, 'generate-parentheses', 'Generate Parentheses', 'same'), lc(20, 'valid-parentheses', 'Valid Parentheses', 'easier'), lc(301, 'remove-invalid-parentheses', 'Remove Invalid Parentheses', 'harder')],
      drill: { prompt: 'List every balanced string of n pairs of parentheses.', pattern: 'backtracking', why: 'Build character by character, adding “(” while open < n and “)” while close < open.' },
    } },

    { problem: {
      id: 'word-search', title: 'Word Search in a Grid', diff: 'medium',
      tags: ['grid DFS', 'backtracking'],
      statement: M`
        Given an «m × n» grid of letters and a «word», return «true» if the word can be traced through **adjacent** cells (up, down, left, right), using each cell at most once.
      `,
      fn: { name: 'exist', params: [['char[][]', 'board'], ['String', 'word']], ret: 'boolean' },
      tests: [
        { args: [[['A', 'B', 'C', 'E'], ['S', 'F', 'C', 'S'], ['A', 'D', 'E', 'E']], 'ABCCED'], ex: true, expect: true },
        { args: [[['A', 'B', 'C', 'E'], ['S', 'F', 'C', 'S'], ['A', 'D', 'E', 'E']], 'SEE'], ex: true, expect: true },
        { args: [[['A', 'B', 'C', 'E'], ['S', 'F', 'C', 'S'], ['A', 'D', 'E', 'E']], 'ABCB'], ex: true, expect: false, why: 'B would be reused.' },
        { args: [[['a']], 'a'], expect: true },
        { args: [[['a', 'b'], ['c', 'd']], 'abdc'], expect: true },
        { args: [[['a', 'b'], ['c', 'd']], 'abcd'], expect: false },
        { args: [[['a', 'a', 'a'], ['a', 'a', 'a'], ['a', 'a', 'a']], 'aaaaaaaaaa'], expect: false, why: '10 letters but only 9 cells. Pruning by counts helps here.' },
        { args: [[['A', 'A', 'A', 'A', 'A', 'A'], ['A', 'A', 'A', 'A', 'A', 'A'], ['A', 'A', 'A', 'A', 'A', 'A'], ['A', 'A', 'A', 'A', 'A', 'A'], ['A', 'A', 'A', 'A', 'A', 'A'], ['A', 'A', 'A', 'A', 'A', 'A']], 'AAAAAAAAAAAAAAB'], big: true, expect: false },
      ],
      constraints: ['1 ≤ m, n ≤ 6', '1 ≤ word.length ≤ 15', 'Letters are English upper/lower case'],
      hints: [
        'Try every cell as a starting point, then DFS matching one letter per step.',
        'You must not reuse a cell on the current path. Mark it before recursing and unmark it after.',
        "Marking in place («board[r][c] = '#'») avoids a separate visited array. Restore the letter when backtracking.",
      ],
      solution: {
        pattern: '**Grid DFS with backtracking:** mark a cell while it’s on the path, and unmark it when you return.',
        intuition: 'The word is a path in the grid graph with no repeated cells. DFS from each start, extending letter by letter. The "no reuse" rule applies only to the current path, so visited marks must be undone on backtrack; a cell may be used by a different attempt later.',
        java: J`class Solution {
    public boolean exist(char[][] board, String word) {
        for (int r = 0; r < board.length; r++)
            for (int c = 0; c < board[0].length; c++)
                if (dfs(board, word, 0, r, c)) return true;
        return false;
    }

    private boolean dfs(char[][] b, String w, int i, int r, int c) {
        if (i == w.length()) return true;
        if (r < 0 || c < 0 || r >= b.length || c >= b[0].length || b[r][c] != w.charAt(i)) return false;
        char saved = b[r][c];
        b[r][c] = '#';                                   // on the current path
        boolean found = dfs(b, w, i + 1, r + 1, c) || dfs(b, w, i + 1, r - 1, c)
                     || dfs(b, w, i + 1, r, c + 1) || dfs(b, w, i + 1, r, c - 1);
        b[r][c] = saved;                                 // backtrack
        return found;
    }
}`,
        time: 'O(m · n · 3^L)', space: 'O(L)', timeWhy: 'each step has at most 3 new directions; L = word length',
        pitfalls: M`
          - A global «visited» that's never reset makes later starting points fail.
          - Forgetting to restore the cell (or returning early before restoring) corrupts the board for other starts.
        `,
        alts: [
          { name: 'Plus pruning by letter counts', time: 'same worst case', space: 'O(1) extra', note: 'Before searching, check the grid has enough of each letter. Also, start from whichever end of the word has the rarer letter (reverse the word if needed). That turns the pathological test from exponential into instant.',
            java: J`class Solution {
    public boolean exist(char[][] board, String word) {
        int[] have = new int[128], need = new int[128];
        for (char[] row : board) for (char ch : row) have[ch]++;
        for (char ch : word.toCharArray()) if (++need[ch] > have[ch]) return false;
        if (have[word.charAt(0)] > have[word.charAt(word.length() - 1)]) word = new StringBuilder(word).reverse().toString();
        for (int r = 0; r < board.length; r++)
            for (int c = 0; c < board[0].length; c++)
                if (dfs(board, word, 0, r, c)) return true;
        return false;
    }
    private boolean dfs(char[][] b, String w, int i, int r, int c) {
        if (i == w.length()) return true;
        if (r < 0 || c < 0 || r >= b.length || c >= b[0].length || b[r][c] != w.charAt(i)) return false;
        char s = b[r][c]; b[r][c] = '#';
        boolean f = dfs(b, w, i + 1, r + 1, c) || dfs(b, w, i + 1, r - 1, c) || dfs(b, w, i + 1, r, c + 1) || dfs(b, w, i + 1, r, c - 1);
        b[r][c] = s;
        return f;
    }
}` },
        ],
        followups: M`
          - **Many words at once** (Word Search II, LeetCode 212): build a trie of the words and DFS once, pruning by trie prefixes (Tries module).
        `,
        talk: 'DFS from every cell matching the word letter by letter; mark the cell as used while it’s on the path and restore it on the way back. O(m·n·3^L). Pruning by letter counts and starting from the rarer end helps a lot in practice.',
      },
      viz: { id: 'wordSearchGrid' },
      lc: [lc(79, 'word-search', 'Word Search', 'same'), lc(212, 'word-search-ii', 'Word Search II', 'harder'), lc(1219, 'path-with-maximum-gold', 'Path with Maximum Gold', 'similar')],
      drill: { prompt: 'Can a word be traced through adjacent grid cells without reusing a cell?', pattern: 'backtracking', why: 'Grid DFS with backtracking: mark a cell on the path, unmark it on return.' },
    } },

    { problem: {
      id: 'palindrome-partitioning', title: 'Palindrome Partitioning', diff: 'medium',
      tags: ['backtracking', 'partition'],
      statement: M`
        Partition a string «s» into pieces so that **every piece is a palindrome**. Return all such partitions, each as a list of pieces in order. The order of the partitions doesn't matter.
      `,
      fn: { name: 'partition', params: [['String', 's']], ret: 'List<List<String>>' },
      compare: 'unordered',
      tests: [
        { args: ['aab'], ex: true, expect: [['a', 'a', 'b'], ['aa', 'b']] },
        { args: ['a'], ex: true, expect: [['a']] },
        { args: ['racecar'] },
        { args: ['abba'], expect: [['a', 'b', 'b', 'a'], ['a', 'bb', 'a'], ['abba']] },
        { args: ['abc'], expect: [['a', 'b', 'c']] },
        { args: ['aaaaaaaaaaaaaa'], big: true },
      ],
      constraints: ['1 ≤ s.length ≤ 16 (large test: 14 identical letters)', 'Lowercase letters'],
      hints: [
        'Decide the first piece, then partition the rest. The first piece can be any palindromic prefix.',
        'Backtrack over the end index of the next piece: for «end» from start to n − 1, if «s[start..end]» is a palindrome, take it and recurse from «end + 1».',
        'Precompute «isPal[i][j]» with DP (or expand around centres) so each check is O(1).',
      ],
      solution: {
        pattern: '**Partition backtracking:** choose the next cut point. A precomputed palindrome table makes each choice O(1).',
        intuition: 'Every partition has a first piece, and that piece must be a palindromic prefix. After choosing it, what remains is the same problem on a shorter suffix. The decision tree branches on where the next cut goes.',
        java: J`class Solution {
    public List<List<String>> partition(String s) {
        int n = s.length();
        boolean[][] pal = new boolean[n][n];               // pal[i][j]: s[i..j] is a palindrome
        for (int i = n - 1; i >= 0; i--)
            for (int j = i; j < n; j++)
                pal[i][j] = s.charAt(i) == s.charAt(j) && (j - i < 2 || pal[i + 1][j - 1]);
        List<List<String>> res = new ArrayList<>();
        backtrack(s, 0, pal, new ArrayList<>(), res);
        return res;
    }

    private void backtrack(String s, int start, boolean[][] pal, List<String> path, List<List<String>> res) {
        if (start == s.length()) { res.add(new ArrayList<>(path)); return; }
        for (int end = start; end < s.length(); end++) {
            if (!pal[start][end]) continue;
            path.add(s.substring(start, end + 1));
            backtrack(s, end + 1, pal, path, res);
            path.remove(path.size() - 1);
        }
    }
}`,
        time: 'O(n · 2ⁿ)', space: 'O(n²)',
        pitfalls: M`
          - Checking palindromes by building reversed substrings each time adds an O(n) factor and garbage.
          - The DP table must fill i from the end, because «pal[i][j]» depends on «pal[i + 1][j − 1]».
        `,
        alts: [
          { name: 'Check palindromes on the fly', time: 'O(n² · 2ⁿ)', space: 'O(n)', java: J`class Solution {
    public List<List<String>> partition(String s) {
        List<List<String>> res = new ArrayList<>();
        go(s, 0, new ArrayList<>(), res);
        return res;
    }
    private void go(String s, int start, List<String> path, List<List<String>> res) {
        if (start == s.length()) { res.add(new ArrayList<>(path)); return; }
        for (int end = start; end < s.length(); end++) {
            if (!isPal(s, start, end)) continue;
            path.add(s.substring(start, end + 1));
            go(s, end + 1, path, res);
            path.remove(path.size() - 1);
        }
    }
    private boolean isPal(String s, int i, int j) { while (i < j) if (s.charAt(i++) != s.charAt(j--)) return false; return true; }
}` },
        ],
        followups: M`
          - **Minimum number of cuts** (LeetCode 132): the same palindrome table plus a 1-D DP. Counting and optimizing call for DP, listing calls for backtracking.
        `,
        talk: 'Precompute a palindrome table with DP. Then backtrack over the end of the next piece: if s[start..end] is a palindrome, add it and recurse from end+1. Record a copy when start reaches the end.',
      },
      lc: [lc(131, 'palindrome-partitioning', 'Palindrome Partitioning', 'same'), lc(132, 'palindrome-partitioning-ii', 'Palindrome Partitioning II', 'harder'), lc(93, 'restore-ip-addresses', 'Restore IP Addresses', 'similar')],
      drill: { prompt: 'All ways to cut a string into pieces that are each palindromes.', pattern: 'backtracking', why: 'Backtracking over cut positions, with a precomputed palindrome table.' },
    } },

    { problem: {
      id: 'n-queens', title: 'N-Queens', diff: 'hard',
      tags: ['backtracking', 'constraint sets'],
      statement: M`
        Place «n» queens on an «n × n» chessboard so that no two attack each other (no shared row, column or diagonal). Return every distinct solution. Each solution is a list of «n» strings, one per row, using «'Q'» for a queen and «'.'» for an empty square. Solutions may be in any order.
      `,
      fn: { name: 'solveNQueens', params: [['int', 'n']], ret: 'List<List<String>>' },
      compare: 'unordered',
      tests: [
        { args: [4], ex: true, expect: [['.Q..', '...Q', 'Q...', '..Q.'], ['..Q.', 'Q...', '...Q', '.Q..']] },
        { args: [1], ex: true, expect: [['Q']] },
        { args: [2], expect: [] },
        { args: [3], expect: [] },
        { args: [5] },
        { args: [6] },
        { args: [9], big: true },
      ],
      constraints: ['1 ≤ n ≤ 9'],
      hints: [
        'Every row has exactly one queen, so place them row by row. The decision at row r is the column.',
        'A square (r, c) is attacked if its column is taken, or its "↘" diagonal (r − c) or "↙" diagonal (r + c) is taken.',
        'Keep three boolean arrays (columns, r + c, r − c + n − 1) for O(1) checks; set them when placing, clear them when backtracking.',
      ],
      solution: {
        pattern: '**Constraint-satisfaction backtracking:** one decision per row, with O(1) conflict checks from column and diagonal sets.',
        intuition: M`
          Row-by-row placement removes the row constraint entirely. For the others: squares on the same "↘" diagonal share «r − c», and squares on the same "↙" diagonal share «r + c». Three boolean arrays answer "is this square attacked?" in O(1), and updating them on place/unplace is O(1).
        `,
        java: J`class Solution {
    public List<List<String>> solveNQueens(int n) {
        List<List<String>> res = new ArrayList<>();
        char[][] board = new char[n][n];
        for (char[] row : board) Arrays.fill(row, '.');
        place(0, board, new boolean[n], new boolean[2 * n], new boolean[2 * n], res);
        return res;
    }

    private void place(int r, char[][] b, boolean[] cols, boolean[] d1, boolean[] d2, List<List<String>> res) {
        int n = b.length;
        if (r == n) {
            List<String> sol = new ArrayList<>();
            for (char[] row : b) sol.add(new String(row));
            res.add(sol);
            return;
        }
        for (int c = 0; c < n; c++) {
            if (cols[c] || d1[r + c] || d2[r - c + n]) continue;      // attacked
            cols[c] = d1[r + c] = d2[r - c + n] = true;
            b[r][c] = 'Q';
            place(r + 1, b, cols, d1, d2, res);
            b[r][c] = '.';
            cols[c] = d1[r + c] = d2[r - c + n] = false;
        }
    }
}`,
        time: 'O(n!)', space: 'O(n²) board', timeWhy: 'far fewer nodes than n! in practice, thanks to pruning',
        pitfalls: M`
          - Checking attacks by scanning the board is O(n) per check. The sets make it O(1).
          - «r − c» can be negative, so offset it by n.
        `,
        alts: [
          { name: 'Bitmask columns and diagonals', time: 'O(n!)', space: 'O(n)', note: 'Represent the three constraint sets as int bitmasks and shift the diagonal masks by one each row. Very fast; the classic "N-Queens II count" solution.', check: false },
        ],
        followups: M`
          - **Only count the solutions** (LeetCode 52): the same search with a counter. Bitmasks make it very fast.
          - **Sudoku solver** (LeetCode 37): the same idea with row, column and box sets.
        `,
        talk: 'Place one queen per row. For each column, check three boolean arrays (column, r+c, r−c+n) in O(1); place, recurse, then clear. Record the board when every row is filled.',
      },
      viz: { id: 'nQueens' },
      lc: [lc(51, 'n-queens', 'N-Queens', 'same'), lc(52, 'n-queens-ii', 'N-Queens II', 'variant'), lc(37, 'sudoku-solver', 'Sudoku Solver', 'harder')],
      drill: { prompt: 'Place n queens on an n×n board so none attack each other; list every arrangement.', pattern: 'backtracking', why: 'Row-by-row backtracking with column and diagonal sets for O(1) conflict checks.' },
    } },
  ],
});
})();

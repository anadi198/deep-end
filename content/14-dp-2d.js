(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

DSA.module({
  id: 'dp-2d', title: 'Dynamic Programming II: Grids, Strings & Knapsack', short: '2-D DP',
  blurb: 'Two indices of state: paths through grids, two strings compared prefix by prefix, subset-sum knapsacks, state machines, and intervals.',
  intro: M`
    When one index isn't enough to describe a subproblem, add a second: a position in a second string, a remaining capacity, a holding/not-holding flag, or the other end of an interval. The recipe doesn't change. Name the state in words, write the transition, set the base cases, choose the fill order. What changes is recognizing **which family** you're in. There are five, and each has a template.
  `,
  more: [
    lc(62, 'unique-paths', 'Unique Paths', 'easier'),
    lc(120, 'triangle', 'Triangle', 'easier'),
    lc(221, 'maximal-square', 'Maximal Square', 'similar'),
    lc(931, 'minimum-falling-path-sum', 'Minimum Falling Path Sum', 'similar'),
    lc(583, 'delete-operation-for-two-strings', 'Delete Operation for Two Strings', 'similar'),
    lc(516, 'longest-palindromic-subsequence', 'Longest Palindromic Subsequence', 'similar'),
    lc(115, 'distinct-subsequences', 'Distinct Subsequences', 'harder'),
    lc(474, 'ones-and-zeroes', 'Ones and Zeroes', 'harder'),
    lc(1049, 'last-stone-weight-ii', 'Last Stone Weight II', 'harder'),
    lc(714, 'best-time-to-buy-and-sell-stock-with-transaction-fee', 'Best Time to Buy and Sell Stock with Transaction Fee', 'similar'),
    lc(188, 'best-time-to-buy-and-sell-stock-iv', 'Best Time to Buy and Sell Stock IV', 'harder'),
    lc(1039, 'minimum-score-triangulation-of-polygon', 'Minimum Score Triangulation of Polygon', 'harder'),
    lc(44, 'wildcard-matching', 'Wildcard Matching', 'harder'),
    lc(329, 'longest-increasing-path-in-a-matrix', 'Longest Increasing Path in a Matrix', 'harder'),
  ],
  items: [
    { lesson: 'dp-2d', title: 'The five 2-D DP families', mins: 18,
      lede: 'Grid paths, two sequences, knapsack, state machines and intervals. Recognize the family and the transition almost writes itself.',
      body: M`
        ## 1. Grid paths: dp[r][c] from above and from the left
        Movement is restricted (right and down), so a cell depends only on cells already computed.

        @viz gridPathsDP

        Count paths with «dp[r][c] = dp[r−1][c] + dp[r][c−1]»; find a minimum cost with «grid[r][c] + min(up, left)». Only the previous row is needed, so one rolling array gives O(cols) space.

        ## 2. Two sequences: dp[i][j] over prefixes
        When comparing two strings (LCS, edit distance, interleaving, regex), let «dp[i][j]» describe the first i characters of one and the first j of the other. The transition looks at the **last characters** «a[i−1]» and «b[j−1]»:
        - they match → usually «dp[i−1][j−1]» plus something;
        - they don't → combine «dp[i−1][j]» (drop a character of a) and «dp[i][j−1]» (drop a character of b).

        @viz lcsTable

        The extra row and column for empty prefixes (size «(m+1) × (n+1)») hold the base cases and remove all the index special cases.

        @viz editDistance

        ## 3. Knapsack: items × capacity
        "Pick a subset of items to hit, or stay within, a capacity" (subset sum, partition, target sum, coin change). The classic table is «dp[i][cap]» = the best (or whether possible, or how many ways) using the first i items. Compress it to one row, and **the loop direction encodes the rules**:

        | Variant | Inner loop over capacity | Why |
        |---|---|---|
        | **0/1** (each item at most once) | high → low | each dp[cap − w] read is still from the *previous* item |
        | **Unbounded** (reuse allowed) | low → high | dp[cap − w] may already include this item again |

        @viz knapsack01

        :::key Combinations vs permutations (the coin change II trap)
        Counting ways to make an amount:
        - **Coins outer, amounts inner** counts **combinations**: each multiset once, because coins are considered in a fixed order.
        - **Amounts outer, coins inner** counts **permutations**: 1+2 and 2+1 are counted separately (LeetCode 377).

        Same code, loops swapped, different answer. Say which one you mean.
        :::

        ## 4. State machines: dp[i][state]
        When each step has a mode (holding a stock or not, in cooldown, k transactions left), make the mode part of the state. Draw the states as nodes with transitions («hold → sell → cooldown → rest → buy → hold»), and each transition becomes one max/min term. Keep one variable per state per day, which is O(1) space.

        ## 5. Intervals: dp[i][j] over a subarray, filled by length
        For problems about merging, splitting or bursting a range («burst balloons», «matrix chain», «palindrome subsequence»), use «dp[i][j]» = the answer for the subarray i..j. Fill by increasing length. The key trick is often to choose the element that is processed **last** in the range: that choice splits the range into independent halves.

        ## Space optimization and reconstruction
        - If row i only reads row i − 1, keep two rows (or one, carefully ordered).
        - To reconstruct the actual answer (the LCS string, the edit operations, the chosen items), keep the full table and walk back from the final cell, following the choice that produced each value.

        ## Signals
        - Grid plus "number of paths / minimum path sum", moving right and down → grid DP.
        - Two strings plus "common / distance / transform / interleave / match" → two-sequence DP.
        - "Subset", "partition into two equal sums", "assign + or −", "ways to make an amount" → knapsack.
        - "Buy and sell with cooldown / fee / at most k transactions" → state machine.
        - "Burst", "merge stones", "cut a stick", "best way to parenthesize" → interval DP.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'In a one-row 0/1 knapsack («dp[cap] |= dp[cap − w]»), what goes wrong if you loop capacity from low to high?',
          options: ['Nothing', 'An item can be counted several times, because dp[cap − w] may already include the same item from this pass', 'It becomes O(n³)', 'It throws'],
          answer: 1, why: 'Low → high turns it into the unbounded knapsack. For "each item at most once", iterate from high to low so dp[cap − w] still reflects the previous items only.' },
        { q: 'Coins [1, 2], amount 3. Loop order coins-outer/amount-inner gives 2 (1+1+1, 1+2). What does amount-outer/coins-inner give?',
          options: ['2', '3: it counts 1+2 and 2+1 separately', '1', '4'],
          answer: 1, why: 'Amount-outer lets every coin be the "last" coin at every amount, so different orderings count separately: 1+1+1, 1+2 and 2+1.' },
      ],
      practice: ['unique-paths-obstacles', 'min-path-sum', 'lcs', 'edit-distance', 'partition-equal-subset', 'coin-change-ii', 'target-sum', 'stock-cooldown', 'interleaving-string', 'burst-balloons', 'regex-matching'],
    },

    { problem: {
      id: 'unique-paths-obstacles', title: 'Unique Paths With Obstacles', diff: 'medium',
      tags: ['grid DP'],
      statement: M`
        A robot starts at the top-left of an «m × n» grid and wants to reach the bottom-right, moving only **right** or **down**. Cells with «1» are obstacles. Return the number of distinct paths (it fits in an int).
      `,
      fn: { name: 'uniquePathsWithObstacles', params: [['int[][]', 'grid']], ret: 'int' },
      tests: [
        { args: [[[0, 0, 0], [0, 1, 0], [0, 0, 0]]], ex: true, expect: 2 },
        { args: [[[0, 1], [0, 0]]], ex: true, expect: 1 },
        { args: [[[1]]], expect: 0 },
        { args: [[[0]]], expect: 1 },
        { args: [[[0, 0], [1, 1], [0, 0]]], expect: 0 },
        { args: [[[0, 0, 0, 0, 0, 0, 0]]], expect: 1 },
        { args: [[[0, 0, 0], [0, 0, 0], [0, 0, 0]]], expect: 6 },
        { args: [Array.from({ length: 16 }, () => Array(17).fill(0))], expect: 300540195, why: 'C(31, 15), with no obstacles.' },
        { args: [Array.from({ length: 100 }, (_, r) => Array.from({ length: 100 }, (_, c) => (r - c === 0 || r - c === 1 || (r - c === -1 && r < 30) ? 0 : 1)))], big: true, expect: 1073741824,
          why: 'A diagonal corridor: 2 choices per step for the first 30 diagonal steps, then 1. That makes 2³⁰ paths.' },
      ],
      constraints: ['1 ≤ m, n ≤ 100', 'grid[i][j] ∈ {0, 1}', 'The answer is ≤ 2·10⁹ for the official tests'],
      hints: [
        'Every path into a cell arrives from the cell above or the cell to the left.',
        'dp[r][c] = dp[r−1][c] + dp[r][c−1], or 0 if the cell is an obstacle. The start has 1 path (if open).',
        'One row suffices: «dp[c] += dp[c−1]», resetting dp[c] = 0 on obstacles.',
      ],
      solution: {
        pattern: '**Grid DP (counting):** each cell sums the counts of the cells that can move into it.',
        intuition: 'The last move into (r, c) is either down from (r−1, c) or right from (r, c−1). Those path sets are disjoint and cover everything, so the counts add. Obstacles have 0 paths.',
        java: J`class Solution {
    public int uniquePathsWithObstacles(int[][] grid) {
        int R = grid.length, C = grid[0].length;
        long[] dp = new long[C];                    // long guards the intermediate sums
        dp[0] = grid[0][0] == 1 ? 0 : 1;
        for (int r = 0; r < R; r++)
            for (int c = 0; c < C; c++) {
                if (grid[r][c] == 1) dp[c] = 0;
                else if (c > 0) dp[c] += dp[c - 1];    // old dp[c] = from above; dp[c-1] = from the left
            }
        return (int) dp[C - 1];
    }
}`,
        time: 'O(m · n)', space: 'O(n)',
        pitfalls: M`
          - The first row and column need care in the 2-D version: past an obstacle, everything along that edge is 0. The 1-D version handles this automatically.
          - An obstacle at the start or the end means 0.
        `,
        alts: [
          { name: '2-D table', time: 'O(m · n)', space: 'O(m · n)', java: J`class Solution {
    public int uniquePathsWithObstacles(int[][] g) {
        int R = g.length, C = g[0].length;
        long[][] dp = new long[R][C];
        for (int r = 0; r < R; r++) for (int c = 0; c < C; c++) {
            if (g[r][c] == 1) { dp[r][c] = 0; continue; }
            if (r == 0 && c == 0) { dp[r][c] = 1; continue; }
            dp[r][c] = (r > 0 ? dp[r - 1][c] : 0) + (c > 0 ? dp[r][c - 1] : 0);
        }
        return (int) dp[R - 1][C - 1];
    }
}` },
          { name: 'Combinatorics (no obstacles)', time: 'O(min(m, n))', space: 'O(1)', note: 'Without obstacles, the answer is C(m + n − 2, m − 1): choose which moves are "down".', check: false },
        ],
        talk: 'dp[r][c] = paths from above + from the left, 0 on obstacles, 1 at the start. Rolling one row: dp[c] += dp[c−1]. O(m·n) time, O(n) space.',
      },
      viz: { id: 'gridPathsDP' },
      lc: [lc(63, 'unique-paths-ii', 'Unique Paths II', 'same'), lc(62, 'unique-paths', 'Unique Paths', 'easier'), lc(980, 'unique-paths-iii', 'Unique Paths III', 'harder')],
      drill: { prompt: 'Count right/down paths from corner to corner of a grid with blocked cells.', pattern: 'dp-2d', why: 'Grid DP: paths(r, c) = paths(up) + paths(left).' },
    } },

    { problem: {
      id: 'min-path-sum', title: 'Minimum Path Sum', diff: 'medium',
      tags: ['grid DP'],
      statement: M`
        Given an «m × n» grid of non-negative numbers, find a path from the top-left to the bottom-right, moving only **right** or **down**, that minimizes the sum of the numbers along it. Return that sum.
      `,
      fn: { name: 'minPathSum', params: [['int[][]', 'grid']], ret: 'int' },
      tests: [
        { args: [[[1, 3, 1], [1, 5, 1], [4, 2, 1]]], ex: true, expect: 7, why: '1 → 3 → 1 → 1 → 1.' },
        { args: [[[1, 2, 3], [4, 5, 6]]], ex: true, expect: 12 },
        { args: [[[5]]], expect: 5 },
        { args: [[[1, 2], [1, 1]]], expect: 3 },
        { args: [[[0, 0, 9], [9, 0, 9], [9, 0, 0]]], expect: 0 },
        { args: [[[1], [2], [3]]], expect: 6 },
        { args: [{ $gen: 'matrix', args: [200, 200, 0, 200, 215] }], big: true },
      ],
      constraints: ['1 ≤ m, n ≤ 200', '0 ≤ grid[i][j] ≤ 200'],
      hints: [
        'The best path to (r, c) comes from the better of the best paths to (r−1, c) and (r, c−1).',
        'dp[r][c] = grid[r][c] + min(dp[r−1][c], dp[r][c−1]), with only one option on the first row and column.',
        'Keep a single row, or overwrite the grid in place.',
      ],
      solution: {
        pattern: '**Grid DP (minimum):** the cell’s cost plus the min over its predecessors.',
        intuition: 'Any optimal path to (r, c) arrives from above or from the left, and its prefix must itself be optimal (otherwise you could swap in a cheaper prefix).',
        java: J`class Solution {
    public int minPathSum(int[][] grid) {
        int R = grid.length, C = grid[0].length;
        int[] dp = new int[C];
        for (int r = 0; r < R; r++)
            for (int c = 0; c < C; c++) {
                if (r == 0 && c == 0) dp[c] = grid[0][0];
                else if (r == 0) dp[c] = dp[c - 1] + grid[r][c];            // only from the left
                else if (c == 0) dp[c] = dp[c] + grid[r][c];                // only from above
                else dp[c] = Math.min(dp[c], dp[c - 1]) + grid[r][c];
            }
        return dp[C - 1];
    }
}`,
        time: 'O(m · n)', space: 'O(n)',
        pitfalls: M`
          - Greedy (always step to the cheaper neighbour) fails, because it can walk into an expensive corner.
          - Dijkstra works too, but it's unnecessary: movement is only right and down, so the grid order is already a topological order.
        `,
        alts: [
          { name: 'In place on the grid', time: 'O(m · n)', space: 'O(1)', java: J`class Solution {
    public int minPathSum(int[][] g) {
        int R = g.length, C = g[0].length;
        for (int r = 0; r < R; r++) for (int c = 0; c < C; c++) {
            if (r == 0 && c == 0) continue;
            int up = r > 0 ? g[r - 1][c] : Integer.MAX_VALUE, left = c > 0 ? g[r][c - 1] : Integer.MAX_VALUE;
            g[r][c] += Math.min(up, left);
        }
        return g[R - 1][C - 1];
    }
}` },
        ],
        talk: 'dp[r][c] = grid value + min(from above, from the left), with single-choice edges. Rolling one row, O(m·n) time, O(n) space.',
      },
      lc: [lc(64, 'minimum-path-sum', 'Minimum Path Sum', 'same'), lc(120, 'triangle', 'Triangle', 'similar'), lc(931, 'minimum-falling-path-sum', 'Minimum Falling Path Sum', 'similar'), lc(174, 'dungeon-game', 'Dungeon Game', 'harder')],
      drill: { prompt: 'Cheapest right/down path through a grid of costs.', pattern: 'dp-2d', why: 'Grid DP: cost + min(from above, from the left).' },
    } },

    { problem: {
      id: 'lcs', title: 'Longest Common Subsequence', diff: 'medium',
      tags: ['two sequences'],
      statement: M`
        Return the length of the longest **common subsequence** of «text1» and «text2»: a sequence that appears in both, in order, but not necessarily contiguously. Return 0 if there is none.
      `,
      fn: { name: 'longestCommonSubsequence', params: [['String', 'text1'], ['String', 'text2']], ret: 'int' },
      tests: [
        { args: ['abcde', 'ace'], ex: true, expect: 3 },
        { args: ['abc', 'abc'], ex: true, expect: 3 },
        { args: ['abc', 'def'], ex: true, expect: 0 },
        { args: ['a', 'a'], expect: 1 },
        { args: ['bsbininm', 'jmjkbkjkv'], expect: 1 },
        { args: ['oxcpqrsvwf', 'shmtulqrypy'], expect: 2 },
        { args: ['AGGTAB', 'GXTXAYB'], expect: 4 },
        { args: [{ $gen: 'str', args: [1000, 'abcd', 217] }, { $gen: 'str', args: [1000, 'abcd', 218] }], big: true },
      ],
      constraints: ['1 ≤ lengths ≤ 1000'],
      hints: [
        'Let dp[i][j] be the LCS length of the first i characters of text1 and the first j of text2.',
        'If the last characters match, they can end the common subsequence: dp[i−1][j−1] + 1. Otherwise drop one of them: max(dp[i−1][j], dp[i][j−1]).',
        'An (m+1) × (n+1) table with zeros for empty prefixes. Two rows are enough for the length alone.',
      ],
      solution: {
        pattern: '**Two-sequence DP:** dp over prefix pairs, comparing the last characters.',
        intuition: M`
          Look at the last characters. If they're equal, some LCS uses them as its final element, and the rest is the LCS of the two shorter prefixes. If they differ, at least one of them isn't in the LCS, so the answer is the better of dropping either one.
        `,
        java: J`class Solution {
    public int longestCommonSubsequence(String a, String b) {
        int m = a.length(), n = b.length();
        int[][] dp = new int[m + 1][n + 1];
        for (int i = 1; i <= m; i++)
            for (int j = 1; j <= n; j++)
                dp[i][j] = a.charAt(i - 1) == b.charAt(j - 1)
                        ? dp[i - 1][j - 1] + 1
                        : Math.max(dp[i - 1][j], dp[i][j - 1]);
        return dp[m][n];
    }
}`,
        time: 'O(m · n)', space: 'O(m · n) (O(min) with two rows)',
        pitfalls: M`
          - Confusing subsequence with substring (the longest common *substring* resets to 0 on a mismatch).
          - Indexing: dp is 1-based over prefixes, while characters are «charAt(i − 1)».
        `,
        alts: [
          { name: 'Two rolling rows', time: 'O(m · n)', space: 'O(n)', java: J`class Solution {
    public int longestCommonSubsequence(String a, String b) {
        int n = b.length();
        int[] prev = new int[n + 1], cur = new int[n + 1];
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= n; j++)
                cur[j] = a.charAt(i - 1) == b.charAt(j - 1) ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
            int[] t = prev; prev = cur; cur = t;
        }
        return prev[n];
    }
}` },
          { name: 'Memoized recursion', time: 'O(m · n)', space: 'O(m · n)', check: false, note: 'lcs(i, j) over suffixes, the same recurrence top-down. Recursion depth m + n.' },
        ],
        followups: M`
          - **Reconstruct the LCS string:** walk back from dp[m][n], taking the diagonal on matches.
          - **Shortest common supersequence** (LeetCode 1092): m + n − LCS, built by merging along the LCS.
          - **Delete operations to make two strings equal** (LeetCode 583): m + n − 2·LCS.
        `,
        talk: 'dp[i][j] = LCS of the prefixes: on a match, diagonal + 1; otherwise max(up, left). An (m+1)×(n+1) table with empty-prefix zeros; two rows suffice for the length. O(m·n).',
      },
      viz: { id: 'lcsTable' },
      lc: [lc(1143, 'longest-common-subsequence', 'Longest Common Subsequence', 'same'), lc(583, 'delete-operation-for-two-strings', 'Delete Operation for Two Strings', 'variant'), lc(1092, 'shortest-common-supersequence', 'Shortest Common Supersequence', 'harder'), lc(516, 'longest-palindromic-subsequence', 'Longest Palindromic Subsequence', 'similar')],
      drill: { prompt: 'Length of the longest sequence appearing (in order, gaps allowed) in both strings.', pattern: 'dp-2d', why: 'Two-sequence DP over prefix pairs: diagonal + 1 on a match, else max(up, left).' },
    } },

    { problem: {
      id: 'edit-distance', title: 'Edit Distance', diff: 'medium',
      tags: ['two sequences'],
      statement: M`
        Return the minimum number of operations to convert «word1» into «word2», where each operation **inserts**, **deletes** or **replaces** one character.
      `,
      fn: { name: 'minDistance', params: [['String', 'word1'], ['String', 'word2']], ret: 'int' },
      tests: [
        { args: ['horse', 'ros'], ex: true, expect: 3, why: 'horse → rorse (replace) → rose (delete) → ros (delete).' },
        { args: ['intention', 'execution'], ex: true, expect: 5 },
        { args: ['', 'abc'], expect: 3 },
        { args: ['abc', ''], expect: 3 },
        { args: ['', ''], expect: 0 },
        { args: ['kitten', 'sitting'], expect: 3 },
        { args: ['abc', 'abc'], expect: 0 },
        { args: [{ $gen: 'str', args: [500, 'abcde', 219] }, { $gen: 'str', args: [500, 'abcde', 220] }], big: true },
      ],
      constraints: ['0 ≤ lengths ≤ 500'],
      hints: [
        'dp[i][j] = the minimum operations to turn the first i characters of word1 into the first j of word2.',
        'If the last characters match, it’s dp[i−1][j−1]. Otherwise 1 + min(replace dp[i−1][j−1], delete dp[i−1][j], insert dp[i][j−1]).',
        'Base cases: dp[i][0] = i (delete everything), dp[0][j] = j (insert everything).',
      ],
      solution: {
        pattern: '**Two-sequence DP with three moves:** replace = diagonal, delete = up, insert = left.',
        intuition: M`
          Consider what happens to the last character of each prefix. If they already match, no operation is needed there. Otherwise the last operation either replaces word1's last character with word2's (diagonal), deletes word1's last character (up), or inserts word2's last character (left). Take the cheapest.
        `,
        java: J`class Solution {
    public int minDistance(String a, String b) {
        int m = a.length(), n = b.length();
        int[][] dp = new int[m + 1][n + 1];
        for (int i = 0; i <= m; i++) dp[i][0] = i;
        for (int j = 0; j <= n; j++) dp[0][j] = j;
        for (int i = 1; i <= m; i++)
            for (int j = 1; j <= n; j++)
                dp[i][j] = a.charAt(i - 1) == b.charAt(j - 1)
                        ? dp[i - 1][j - 1]
                        : 1 + Math.min(dp[i - 1][j - 1], Math.min(dp[i - 1][j], dp[i][j - 1]));
        return dp[m][n];
    }
}`,
        time: 'O(m · n)', space: 'O(m · n) (O(n) with rolling rows)',
        pitfalls: M`
          - Forgetting the base row and column: turning a prefix into the empty string costs its length.
          - Mixing up insert and delete directions doesn't change the value (the operations are symmetric), but explaining them correctly matters.
        `,
        alts: [
          { name: 'Rolling row', time: 'O(m · n)', space: 'O(n)', java: J`class Solution {
    public int minDistance(String a, String b) {
        int n = b.length();
        int[] dp = new int[n + 1];
        for (int j = 0; j <= n; j++) dp[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            int diag = dp[0];                  // dp[i-1][j-1]
            dp[0] = i;
            for (int j = 1; j <= n; j++) {
                int up = dp[j];                // dp[i-1][j]
                dp[j] = a.charAt(i - 1) == b.charAt(j - 1) ? diag : 1 + Math.min(diag, Math.min(up, dp[j - 1]));
                diag = up;
            }
        }
        return dp[n];
    }
}` },
        ],
        followups: M`
          - **One edit apart?** (LeetCode 161): O(n) with two pointers, no DP needed.
          - **Different costs per operation:** weight each term.
          - Used in spell-checkers, DNA alignment (with scoring), and fuzzy search.
        `,
        talk: 'dp[i][j] = edits to turn a[0..i) into b[0..j). A match copies the diagonal; otherwise 1 + min(replace diagonal, delete up, insert left). Base row and column are i and j. O(m·n) time; one row suffices.',
      },
      viz: { id: 'editDistance' },
      lc: [lc(72, 'edit-distance', 'Edit Distance', 'same'), lc(583, 'delete-operation-for-two-strings', 'Delete Operation for Two Strings', 'easier'), lc(161, 'one-edit-distance', 'One Edit Distance', 'easier', { premium: true }), lc(712, 'minimum-ascii-delete-sum-for-two-strings', 'Minimum ASCII Delete Sum for Two Strings', 'variant')],
      drill: { prompt: 'Minimum inserts, deletes and replacements to turn one word into another.', pattern: 'dp-2d', why: 'Two-sequence DP: diagonal on a match, else 1 + min(diagonal, up, left).' },
    } },

    { problem: {
      id: 'partition-equal-subset', title: 'Partition Into Equal Sums', diff: 'medium',
      tags: ['0/1 knapsack', 'subset sum'],
      statement: M`
        Given an array of positive integers «nums», return «true» if it can be split into **two subsets with equal sums**.
      `,
      fn: { name: 'canPartition', params: [['int[]', 'nums']], ret: 'boolean' },
      tests: [
        { args: [[1, 5, 11, 5]], ex: true, expect: true, why: '[1, 5, 5] and [11].' },
        { args: [[1, 2, 3, 5]], ex: true, expect: false },
        { args: [[1, 1]], expect: true },
        { args: [[2]], expect: false },
        { args: [[3, 3, 3, 4, 5]], expect: true },
        { args: [[1, 2, 5]], expect: false },
        { args: [[100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 99, 97]], expect: false },
        { args: [{ $gen: 'ints', args: [200, 1, 100, 221] }], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 200', '1 ≤ nums[i] ≤ 100'],
      hints: [
        'If the total is odd, it’s impossible. Otherwise, can some subset sum to total / 2?',
        'Subset sum: dp[s] = true if some subset of the items seen so far sums to s.',
        'For each number x, update «dp[s] |= dp[s − x]» for s from target **down to** x (each number is used at most once).',
      ],
      solution: {
        pattern: '**0/1 knapsack as subset sum:** a boolean dp over sums, with capacity iterated downward.',
        intuition: 'Two equal halves means one subset sums to exactly half the total. Track every reachable sum as you consider items one at a time. Iterating sums from high to low makes each item count at most once.',
        java: J`class Solution {
    public boolean canPartition(int[] nums) {
        int total = 0;
        for (int x : nums) total += x;
        if (total % 2 == 1) return false;
        int target = total / 2;
        boolean[] dp = new boolean[target + 1];
        dp[0] = true;
        for (int x : nums)
            for (int s = target; s >= x; s--)          // downward: 0/1 (each item once)
                dp[s] = dp[s] || dp[s - x];
        return dp[target];
    }
}`,
        time: 'O(n · sum)', space: 'O(sum)',
        pitfalls: M`
          - Looping s upward lets one number be used repeatedly: wrong for 0/1.
          - Greedy (sort and fill) fails.
        `,
        alts: [
          { name: 'BitSet shift trick', time: 'O(n · sum / 64)', space: 'O(sum)', note: 'reachable |= reachable << x processes all sums at once, 64 per machine word.',
            java: J`class Solution {
    public boolean canPartition(int[] nums) {
        int total = Arrays.stream(nums).sum();
        if (total % 2 == 1) return false;
        BitSet bs = new BitSet(total + 1);
        bs.set(0);
        for (int x : nums) {
            BitSet shifted = new BitSet(total + 1);
            for (int i = bs.nextSetBit(0); i >= 0 && i + x <= total; i = bs.nextSetBit(i + 1)) shifted.set(i + x);
            bs.or(shifted);
        }
        return bs.get(total / 2);
    }
}` },
          { name: 'Memoized DFS (index, remaining)', time: 'O(n · sum)', space: 'O(n · sum)', check: false, note: 'can(i, rem) = can(i+1, rem) || can(i+1, rem − nums[i]). The same states, top-down.' },
        ],
        followups: M`
          - **Minimize the difference between the two subsets** (Last Stone Weight II, LeetCode 1049): the largest reachable sum ≤ total/2.
          - **k equal subsets** (LeetCode 698): backtracking with pruning, or bitmask DP.
        `,
        talk: 'An odd total is impossible; otherwise, is there a subset summing to total/2? A boolean dp over sums, updating from high to low for each number so each is used once. O(n·sum).',
      },
      viz: { id: 'knapsack01' },
      lc: [lc(416, 'partition-equal-subset-sum', 'Partition Equal Subset Sum', 'same'), lc(698, 'partition-to-k-equal-sum-subsets', 'Partition to K Equal Sum Subsets', 'harder'), lc(1049, 'last-stone-weight-ii', 'Last Stone Weight II', 'variant'), lc(494, 'target-sum', 'Target Sum', 'similar')],
      drill: { prompt: 'Can the array be split into two groups with equal sums?', pattern: 'knapsack', why: '0/1 knapsack / subset sum to total/2, iterating capacity downward.' },
    } },

    { problem: {
      id: 'coin-change-ii', title: 'Coin Change II (Count the Ways)', diff: 'medium',
      tags: ['unbounded knapsack', 'combinations'],
      statement: M`
        Given coin denominations «coins» (unlimited supply) and an «amount», return the number of **combinations** that make up the amount: different orders of the same coins count once. Return 0 if none. The answer fits in a signed 32-bit int.
      `,
      fn: { name: 'change', params: [['int', 'amount'], ['int[]', 'coins']], ret: 'int' },
      tests: [
        { args: [5, [1, 2, 5]], ex: true, expect: 4, why: '5; 2+2+1; 2+1+1+1; 1+1+1+1+1.' },
        { args: [3, [2]], ex: true, expect: 0 },
        { args: [10, [10]], ex: true, expect: 1 },
        { args: [0, [7]], expect: 1, why: 'One way to make 0: choose nothing.' },
        { args: [3, [1, 2]], expect: 2, why: '1+1+1 and 1+2. Not 3; order doesn’t matter.' },
        { args: [100, [1, 5, 10, 25, 50]], expect: 292 },
        { args: [500, [3, 5, 7, 8, 9, 10, 11]], expect: 35502874 },
        { args: [5000, [11, 24, 37, 50, 63, 76, 89, 102]], big: true },
      ],
      constraints: ['1 ≤ coins.length ≤ 300', '1 ≤ coins[i] ≤ 5000, distinct', '0 ≤ amount ≤ 5000'],
      hints: [
        'dp[a] = number of ways to make amount a. How do you avoid counting 1+2 and 2+1 separately?',
        'Process the coins one at a time in the **outer** loop. Each combination then gets built in a fixed coin order, exactly once.',
        'For each coin c, for a from c up to amount: «dp[a] += dp[a − c]». dp[0] = 1. (Upward, because coins can repeat.)',
      ],
      solution: {
        pattern: '**Unbounded knapsack counting combinations:** coins in the outer loop, amounts inner (low → high).',
        intuition: M`
          After processing coins c₁…cₖ, dp[a] counts the multisets of those coins summing to a. Adding coin cₖ₊₁ extends each existing way by any number of that coin. Iterating a upward lets dp[a − c] already include copies of c. Because coins are introduced in a fixed order, a multiset is never counted twice.
        `,
        java: J`class Solution {
    public int change(int amount, int[] coins) {
        int[] dp = new int[amount + 1];
        dp[0] = 1;
        for (int c : coins)                        // coins OUTER: combinations, not permutations
            for (int a = c; a <= amount; a++)      // upward: coin c may repeat
                dp[a] += dp[a - c];
        return dp[amount];
    }
}`,
        time: 'O(amount × coins)', space: 'O(amount)',
        pitfalls: M`
          - Swapping the loops (amounts outer) counts **ordered** sequences: 1+2 and 2+1 separately. That's LeetCode 377, a different problem.
          - dp[0] = 1, not 0. The empty selection is the one way to make zero.
        `,
        alts: [
          { name: '2-D table dp[i][a]', time: 'O(amount × coins)', space: 'O(amount × coins)', note: 'dp[i][a] = ways using the first i coin types = dp[i−1][a] (don’t use coin i) + dp[i][a − c] (use it at least once). The 1-D version is this, compressed.',
            java: J`class Solution {
    public int change(int amount, int[] coins) {
        int n = coins.length;
        int[][] dp = new int[n + 1][amount + 1];
        for (int i = 0; i <= n; i++) dp[i][0] = 1;
        for (int i = 1; i <= n; i++)
            for (int a = 1; a <= amount; a++)
                dp[i][a] = dp[i - 1][a] + (a >= coins[i - 1] ? dp[i][a - coins[i - 1]] : 0);
        return dp[n][amount];
    }
}` },
        ],
        talk: 'Unbounded knapsack counting: dp[0] = 1, and for each coin (outer loop), for amounts from coin upward, dp[a] += dp[a−coin]. Coins-outer counts combinations, where swapping the loops would count permutations. O(amount × coins).',
      },
      lc: [lc(518, 'coin-change-ii', 'Coin Change II', 'same'), lc(377, 'combination-sum-iv', 'Combination Sum IV', 'variant'), lc(322, 'coin-change', 'Coin Change', 'similar'), lc(39, 'combination-sum', 'Combination Sum', 'similar')],
      drill: { prompt: 'Number of distinct combinations of coins (unlimited) that sum to an amount.', pattern: 'knapsack', why: 'Unbounded knapsack counting: coins in the outer loop so each multiset is counted once.' },
    } },

    { problem: {
      id: 'target-sum', title: 'Target Sum', diff: 'medium',
      tags: ['knapsack counting', 'math transform'],
      statement: M`
        Put a «+» or «−» in front of every number in «nums» and evaluate the expression. Return how many sign assignments evaluate to «target».
      `,
      fn: { name: 'findTargetSumWays', params: [['int[]', 'nums'], ['int', 'target']], ret: 'int' },
      tests: [
        { args: [[1, 1, 1, 1, 1], 3], ex: true, expect: 5 },
        { args: [[1], 1], ex: true, expect: 1 },
        { args: [[1], 2], expect: 0 },
        { args: [[0, 0, 0], 0], expect: 8, why: 'Each 0 can be +0 or −0: both count.' },
        { args: [[2, 3], -1], expect: 1 },
        { args: [[7, 9, 3, 8, 0, 2, 4, 8, 3, 9], 0], expect: 0 },
        { args: [[1, 2, 7, 9, 981], 1000000000], expect: 0 },
        { args: [{ $gen: 'ints', args: [20, 0, 50, 223] }, 7], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 20', '0 ≤ nums[i] ≤ 1000', 'sum(nums) ≤ 1000', '−1000 ≤ target ≤ 1000'],
      hints: [
        'Brute force tries 2ⁿ sign patterns. For n = 20 that works, but there’s a cleaner DP.',
        'Let P be the set with «+» and N the set with «−». Then P − N = target and P + N = total, so P = (total + target) / 2.',
        'Count the subsets summing to P: a 0/1 knapsack count (capacity downward). Check that total + target is even and non-negative.',
      ],
      solution: {
        pattern: '**Transform into subset-sum counting:** algebra turns a ± assignment into "choose a subset with sum P".',
        intuition: M`
          Assigning signs splits the numbers into a plus-group and a minus-group. With «P − N = target» and «P + N = total», the plus-group must sum to «(total + target) / 2». So count the subsets with that sum, the 0/1 knapsack in counting form.
        `,
        java: J`class Solution {
    public int findTargetSumWays(int[] nums, int target) {
        int total = 0;
        for (int x : nums) total += x;
        if (Math.abs(target) > total || (total + target) % 2 != 0) return 0;
        int p = (total + target) / 2;
        int[] dp = new int[p + 1];
        dp[0] = 1;
        for (int x : nums)
            for (int s = p; s >= x; s--)          // 0/1: downward
                dp[s] += dp[s - x];
        return dp[p];
    }
}`,
        time: 'O(n · total)', space: 'O(total)',
        pitfalls: M`
          - Zeros: the downward loop with «s >= x» (x = 0) doubles dp[s] for each zero, which is correct, since ±0 are distinct choices.
          - Check parity and range before dividing, or the index goes negative.
        `,
        alts: [
          { name: 'DP over reachable sums (offset)', time: 'O(n · total)', space: 'O(total)', note: 'dp[sum + total] = ways to reach sum after i numbers. Update with both signs each step. It’s the direct formulation, without the algebra.',
            java: J`class Solution {
    public int findTargetSumWays(int[] nums, int target) {
        int total = Arrays.stream(nums).sum();
        if (Math.abs(target) > total) return 0;
        int[] dp = new int[2 * total + 1];
        dp[total] = 1;
        for (int x : nums) {
            int[] next = new int[2 * total + 1];
            for (int s = 0; s <= 2 * total; s++) if (dp[s] != 0) {
                if (s + x <= 2 * total) next[s + x] += dp[s];
                if (s - x >= 0) next[s - x] += dp[s];
            }
            dp = next;
        }
        return dp[target + total];
    }
}` },
          { name: 'Backtracking all 2ⁿ patterns', time: 'O(2ⁿ)', space: 'O(n)', java: J`class Solution {
    public int findTargetSumWays(int[] nums, int target) { return go(nums, 0, target); }
    private int go(int[] a, int i, int rem) {
        if (i == a.length) return rem == 0 ? 1 : 0;
        return go(a, i + 1, rem - a[i]) + go(a, i + 1, rem + a[i]);
    }
}` },
        ],
        talk: 'With P the plus-group sum, P − N = target and P + N = total give P = (total + target)/2. So count the subsets summing to P with a 0/1 knapsack count, after checking parity and range. O(n·total).',
      },
      lc: [lc(494, 'target-sum', 'Target Sum', 'same'), lc(416, 'partition-equal-subset-sum', 'Partition Equal Subset Sum', 'similar'), lc(1049, 'last-stone-weight-ii', 'Last Stone Weight II', 'similar')],
      drill: { prompt: 'Count ways to assign + or − to each number so the expression equals a target.', pattern: 'knapsack', why: 'Algebra reduces it to counting subsets with sum (total + target)/2: a 0/1 knapsack count.' },
    } },

    { problem: {
      id: 'stock-cooldown', title: 'Stock Trading With Cooldown', diff: 'medium',
      tags: ['state machine DP'],
      statement: M`
        «prices[i]» is a stock's price on day «i». You may complete as many buy-then-sell transactions as you like (holding at most one share at a time), but after you **sell** you must wait one day (**cooldown**) before buying again. Return the maximum profit.
      `,
      fn: { name: 'maxProfit', params: [['int[]', 'prices']], ret: 'int' },
      tests: [
        { args: [[1, 2, 3, 0, 2]], ex: true, expect: 3, why: 'buy, sell, cooldown, buy, sell.' },
        { args: [[1]], ex: true, expect: 0 },
        { args: [[1, 2]], expect: 1 },
        { args: [[2, 1]], expect: 0 },
        { args: [[1, 2, 4]], expect: 3 },
        { args: [[6, 1, 3, 2, 4, 7]], expect: 6 },
        { args: [[1, 4, 2, 7]], expect: 6, why: 'Selling at 4 would force a cooldown on the day priced 2; holding from 1 to 7 is better.' },
        { args: [{ $gen: 'ints', args: [5000, 0, 1000, 225] }], big: true },
      ],
      constraints: ['1 ≤ prices.length ≤ 5000', '0 ≤ prices[i] ≤ 1000'],
      hints: [
        'On each day you’re in one of a few situations: holding a share, just sold (cooldown next), or free to buy.',
        'Track the best profit ending in each state: hold, sold, rest. Write the transitions between them.',
        'hold = max(hold, rest − price); sold = hold + price; rest = max(rest, sold). Update from the previous day’s values.',
      ],
      solution: {
        pattern: '**State-machine DP:** one variable per state, updated each day from the previous day’s states.',
        intuition: M`
          Draw it: «rest» (no share, allowed to buy) → buy → «hold» → sell → «sold» → forced rest → «rest». Each day, each state's best profit is the max over the arrows leading into it. Because the cooldown is exactly one day, "sold yesterday" can't go straight to hold.
        `,
        java: J`class Solution {
    public int maxProfit(int[] prices) {
        int hold = Integer.MIN_VALUE / 2, sold = 0, rest = 0;   // best profit ending the day in each state
        for (int p : prices) {
            int prevSold = sold;
            sold = hold + p;                    // sell today (must have held)
            hold = Math.max(hold, rest - p);    // keep holding, or buy today from rest
            rest = Math.max(rest, prevSold);    // stay idle, or finish yesterday's cooldown
        }
        return Math.max(sold, rest);
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - Buying from «sold» (yesterday's sale) would violate the cooldown. Only «rest» can buy.
          - Update order: compute every new state from the *previous* day's values (save «sold» first).
          - Start «hold» at minus infinity (you can't hold before buying), but avoid «Integer.MIN_VALUE + p» overflow.
        `,
        alts: [
          { name: 'dp arrays with i − 2', time: 'O(n)', space: 'O(n)', note: 'buy[i] = max(buy[i−1], sell[i−2] − p[i]); sell[i] = max(sell[i−1], buy[i−1] + p[i]). The i − 2 encodes the cooldown.',
            java: J`class Solution {
    public int maxProfit(int[] p) {
        int n = p.length;
        if (n < 2) return 0;
        int[] buy = new int[n], sell = new int[n];
        buy[0] = -p[0];
        for (int i = 1; i < n; i++) {
            buy[i] = Math.max(buy[i - 1], (i >= 2 ? sell[i - 2] : 0) - p[i]);
            sell[i] = Math.max(sell[i - 1], buy[i - 1] + p[i]);
        }
        return sell[n - 1];
    }
}` },
        ],
        followups: M`
          - **Transaction fee** (LeetCode 714): two states, subtracting the fee on sell.
          - **At most k transactions** (LeetCode 188): states hold[j], free[j] for j = 0..k.
        `,
        talk: 'A state machine with three states per day: hold, sold (cooldown next), rest. hold = max(hold, rest − p); sold = hold + p; rest = max(rest, previous sold). Answer max(sold, rest). O(n), O(1).',
      },
      lc: [lc(309, 'best-time-to-buy-and-sell-stock-with-cooldown', 'Best Time to Buy and Sell Stock with Cooldown', 'same'), lc(714, 'best-time-to-buy-and-sell-stock-with-transaction-fee', 'Best Time to Buy and Sell Stock with Transaction Fee', 'variant'), lc(123, 'best-time-to-buy-and-sell-stock-iii', 'Best Time to Buy and Sell Stock III', 'harder'), lc(188, 'best-time-to-buy-and-sell-stock-iv', 'Best Time to Buy and Sell Stock IV', 'harder')],
      drill: { prompt: 'Max stock profit with unlimited trades but a one-day cooldown after each sale.', pattern: 'dp-2d', why: 'State-machine DP: hold / sold / rest per day.' },
    } },

    { problem: {
      id: 'interleaving-string', title: 'Interleaving String', diff: 'medium',
      tags: ['two sequences'],
      statement: M`
        Return «true» if «s3» is formed by **interleaving** «s1» and «s2»: all characters of both, each string's characters kept in their original order, merged together.
      `,
      fn: { name: 'isInterleave', params: [['String', 's1'], ['String', 's2'], ['String', 's3']], ret: 'boolean' },
      tests: [
        { args: ['aabcc', 'dbbca', 'aadbbcbcac'], ex: true, expect: true },
        { args: ['aabcc', 'dbbca', 'aadbbbaccc'], ex: true, expect: false },
        { args: ['', '', ''], ex: true, expect: true },
        { args: ['a', '', 'a'], expect: true },
        { args: ['', 'b', 'a'], expect: false },
        { args: ['ab', 'ab', 'aabb'], expect: true },
        { args: ['abc', 'def', 'abcdefx'], expect: false, why: 'The lengths must add up.' },
        { args: [{ $gen: 'repeatStr', args: ['ab', 100] }, { $gen: 'repeatStr', args: ['ba', 100] }, { $gen: 'repeatStr', args: ['abba', 100] }], big: true },
      ],
      constraints: ['0 ≤ s1.length, s2.length ≤ 100', 's3.length ≤ 200'],
      hints: [
        'Greedy (take from s1 whenever it matches) fails when both strings could supply the next character.',
        'dp[i][j] = whether s3’s first i + j characters can be formed from s1’s first i and s2’s first j.',
        'dp[i][j] = (dp[i−1][j] && s1[i−1] == s3[i+j−1]) || (dp[i][j−1] && s2[j−1] == s3[i+j−1]).',
      ],
      solution: {
        pattern: '**Two-sequence DP with a derived third index:** the position in s3 is always i + j.',
        intuition: 'The last character of s3’s prefix of length i + j came from either s1 (its i-th character) or s2 (its j-th). In the first case the rest must be an interleaving of (i−1, j); in the second, of (i, j−1).',
        java: J`class Solution {
    public boolean isInterleave(String s1, String s2, String s3) {
        int m = s1.length(), n = s2.length();
        if (m + n != s3.length()) return false;
        boolean[] dp = new boolean[n + 1];           // dp[j] for the current i
        for (int i = 0; i <= m; i++)
            for (int j = 0; j <= n; j++) {
                if (i == 0 && j == 0) { dp[j] = true; continue; }
                boolean fromS1 = i > 0 && dp[j] && s1.charAt(i - 1) == s3.charAt(i + j - 1);      // dp[j] = previous row
                boolean fromS2 = j > 0 && dp[j - 1] && s2.charAt(j - 1) == s3.charAt(i + j - 1);  // dp[j-1] = current row
                dp[j] = fromS1 || fromS2;
            }
        return dp[n];
    }
}`,
        time: 'O(m · n)', space: 'O(n)',
        pitfalls: M`
          - Check the length first, or «s3.charAt(i + j − 1)» can go out of bounds.
          - Greedy matching is wrong: «s1 = "ab"», «s2 = "ab"», «s3 = "aabb"» requires switching.
        `,
        alts: [
          { name: 'Memoized DFS (i, j)', time: 'O(m · n)', space: 'O(m · n)', java: J`class Solution {
    private Boolean[][] memo;
    public boolean isInterleave(String a, String b, String c) {
        if (a.length() + b.length() != c.length()) return false;
        memo = new Boolean[a.length() + 1][b.length() + 1];
        return go(a, b, c, 0, 0);
    }
    private boolean go(String a, String b, String c, int i, int j) {
        if (i == a.length() && j == b.length()) return true;
        if (memo[i][j] != null) return memo[i][j];
        boolean r = (i < a.length() && a.charAt(i) == c.charAt(i + j) && go(a, b, c, i + 1, j))
                 || (j < b.length() && b.charAt(j) == c.charAt(i + j) && go(a, b, c, i, j + 1));
        return memo[i][j] = r;
    }
}` },
        ],
        talk: 'dp[i][j] = can s1[0..i) and s2[0..j) interleave into s3[0..i+j)? The last character comes from s1 or s2 if it matches and the corresponding smaller state is true. One row suffices. O(m·n). Greedy fails when both strings offer the same character.',
      },
      lc: [lc(97, 'interleaving-string', 'Interleaving String', 'same'), lc(1143, 'longest-common-subsequence', 'Longest Common Subsequence', 'similar'), lc(72, 'edit-distance', 'Edit Distance', 'similar')],
      drill: { prompt: 'Is string s3 a merge of s1 and s2 that keeps each string’s internal order?', pattern: 'dp-2d', why: 'Two-sequence DP: dp[i][j] from dp[i−1][j] or dp[i][j−1] when the next character matches.' },
    } },

    { problem: {
      id: 'burst-balloons', title: 'Burst Balloons', diff: 'hard',
      tags: ['interval DP', 'choose the last'],
      statement: M`
        Balloons are labelled with numbers «nums». Bursting balloon «i» earns «left × nums[i] × right» coins, where «left» and «right» are the values of its current **neighbours** (treat missing neighbours as 1). After bursting, its neighbours become adjacent. Burst all balloons and return the maximum total coins.
      `,
      fn: { name: 'maxCoins', params: [['int[]', 'nums']], ret: 'int' },
      tests: [
        { args: [[3, 1, 5, 8]], ex: true, expect: 167, why: 'Burst 1, 5, 3, 8: 3·1·5 + 3·5·8 + 1·3·8 + 1·8·1 = 167.' },
        { args: [[1, 5]], ex: true, expect: 10 },
        { args: [[7]], expect: 7 },
        { args: [[0, 0]], expect: 0 },
        { args: [[9, 76, 64, 21]], expect: 116718 },
        { args: [[2, 3, 7, 9, 1]], expect: 279 },
        { args: [{ $gen: 'ints', args: [300, 0, 100, 227] }], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 300', '0 ≤ nums[i] ≤ 100'],
      hints: [
        'Choosing the *first* balloon to burst doesn’t split the problem: its neighbours change, so the halves aren’t independent.',
        'Instead choose the balloon burst **last** in a range (i, j): when it bursts, its neighbours are exactly the boundaries i and j.',
        'Pad nums with 1 at both ends. dp[i][j] = max over k in (i, j) of dp[i][k] + a[i]·a[k]·a[j] + dp[k][j], filled by increasing interval length.',
      ],
      solution: {
        pattern: '**Interval DP, "choose the last element":** picking what happens last in a range makes the subranges independent.',
        intuition: M`
          Think about the open interval (i, j) with i and j still present as boundaries. If balloon k is the last one burst in that interval, then when it bursts its neighbours are exactly a[i] and a[j], earning a[i]·a[k]·a[j]. Before that, the balloons in (i, k) and (k, j) were burst with k as a fixed wall between them, which are two independent subproblems.
        `,
        java: J`class Solution {
    public int maxCoins(int[] nums) {
        int n = nums.length + 2;
        int[] a = new int[n];
        a[0] = a[n - 1] = 1;
        for (int i = 0; i < nums.length; i++) a[i + 1] = nums[i];
        int[][] dp = new int[n][n];                  // dp[i][j]: best for balloons strictly between i and j
        for (int len = 2; len < n; len++)            // j - i
            for (int i = 0; i + len < n; i++) {
                int j = i + len;
                for (int k = i + 1; k < j; k++)      // k is the LAST balloon burst in (i, j)
                    dp[i][j] = Math.max(dp[i][j], dp[i][k] + a[i] * a[k] * a[j] + dp[k][j]);
            }
        return dp[0][n - 1];
    }
}`,
        time: 'O(n³)', space: 'O(n²)',
        pitfalls: M`
          - Choosing the first burst: the neighbours of later bursts change, so the subproblems overlap badly.
          - The fill order must go by interval length, because «dp[i][j]» needs all shorter intervals first.
        `,
        alts: [
          { name: 'Memoized recursion over (i, j)', time: 'O(n³)', space: 'O(n²)', java: J`class Solution {
    private int[] a; private int[][] memo;
    public int maxCoins(int[] nums) {
        int n = nums.length + 2;
        a = new int[n]; a[0] = a[n - 1] = 1;
        for (int i = 0; i < nums.length; i++) a[i + 1] = nums[i];
        memo = new int[n][n];
        for (int[] r : memo) Arrays.fill(r, -1);
        return best(0, n - 1);
    }
    private int best(int i, int j) {
        if (j - i < 2) return 0;
        if (memo[i][j] >= 0) return memo[i][j];
        int r = 0;
        for (int k = i + 1; k < j; k++) r = Math.max(r, best(i, k) + a[i] * a[k] * a[j] + best(k, j));
        return memo[i][j] = r;
    }
}` },
          { name: 'Try all burst orders', time: 'O(n!)', space: 'O(n)', check: false, note: 'The exponential baseline that motivates the interval insight.' },
        ],
        followups: M`
          - Same trick: **minimum cost to merge stones** (LeetCode 1000), **matrix chain multiplication**, **minimum cost to cut a stick** (LeetCode 1547), **polygon triangulation** (LeetCode 1039).
        `,
        talk: 'Pad with 1s. dp[i][j] is the best for the balloons strictly between i and j. If k is the last one burst there, its neighbours are a[i] and a[j], and the two sides are independent: dp[i][k] + a[i]·a[k]·a[j] + dp[k][j]. Fill by length. O(n³).',
      },
      lc: [lc(312, 'burst-balloons', 'Burst Balloons', 'same'), lc(1547, 'minimum-cost-to-cut-a-stick', 'Minimum Cost to Cut a Stick', 'similar'), lc(1039, 'minimum-score-triangulation-of-polygon', 'Minimum Score Triangulation of Polygon', 'similar'), lc(1000, 'minimum-cost-to-merge-stones', 'Minimum Cost to Merge Stones', 'harder')],
      drill: { prompt: 'Order the popping of balloons (earning left·self·right) to maximize the total.', pattern: 'dp-2d', why: 'Interval DP: choose the element processed last in each range, so the halves become independent.' },
    } },

    { problem: {
      id: 'regex-matching', title: 'Regular Expression Matching', diff: 'hard',
      tags: ['two sequences', 'pattern matching'],
      statement: M`
        Implement matching for patterns with «.» (matches any single character) and «*» (matches **zero or more** of the preceding element). The match must cover the **entire** input string «s». «p» is always valid: every «*» follows a letter or «.».
      `,
      fn: { name: 'isMatch', params: [['String', 's'], ['String', 'p']], ret: 'boolean' },
      tests: [
        { args: ['aa', 'a'], ex: true, expect: false },
        { args: ['aa', 'a*'], ex: true, expect: true },
        { args: ['ab', '.*'], ex: true, expect: true },
        { args: ['aab', 'c*a*b'], expect: true, why: '«c*» matches zero c’s.' },
        { args: ['mississippi', 'mis*is*p*.'], expect: false },
        { args: ['', 'a*b*'], expect: true },
        { args: ['a', 'ab*'], expect: true },
        { args: ['aaa', 'a*a'], expect: true },
        { args: ['ab', '.*c'], expect: false },
        { args: ['aaaaaaaaaaaaaaaaaaab', 'a*a*a*a*a*a*a*a*a*a*b'], expect: true },
        { args: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaac', 'a*a*a*a*a*a*a*a*a*a*b'], big: true, expect: false, why: 'Naive backtracking is exponential here.' },
      ],
      constraints: ['1 ≤ s.length ≤ 20 (large test: 30)', '1 ≤ p.length ≤ 20 (large test: 21)', 's: lowercase letters; p: lowercase letters, «.» and «*»'],
      hints: [
        'dp[i][j] = does s’s first i characters match p’s first j characters?',
        'If p[j−1] is a letter or «.»: it must match s[i−1], and then dp[i−1][j−1].',
        'If p[j−1] is «*»: either use zero copies (dp[i][j−2]), or, if s[i−1] matches p[j−2], consume one character and stay on the star (dp[i−1][j]).',
      ],
      solution: {
        pattern: '**Two-sequence DP with a star case:** "zero copies" skips two pattern characters, and "one more copy" consumes a string character without advancing the pattern.',
        intuition: M`
          The only hard part is «x*». It can match the empty string (so drop «x*» from the pattern), or it can match one «x» at the end of s and still be available for more (so drop the last character of s and keep «x*»). Those two options cover "zero or more". Everything else is the ordinary character-by-character match.
        `,
        java: J`class Solution {
    public boolean isMatch(String s, String p) {
        int m = s.length(), n = p.length();
        boolean[][] dp = new boolean[m + 1][n + 1];
        dp[0][0] = true;
        for (int j = 2; j <= n; j++)                       // empty s: only "x*y*..." patterns match
            dp[0][j] = p.charAt(j - 1) == '*' && dp[0][j - 2];
        for (int i = 1; i <= m; i++)
            for (int j = 1; j <= n; j++) {
                char pc = p.charAt(j - 1);
                if (pc == '*') {
                    char prev = p.charAt(j - 2);
                    dp[i][j] = dp[i][j - 2]                                               // zero copies
                            || ((prev == '.' || prev == s.charAt(i - 1)) && dp[i - 1][j]);    // one more copy
                } else {
                    dp[i][j] = (pc == '.' || pc == s.charAt(i - 1)) && dp[i - 1][j - 1];
                }
            }
        return dp[m][n];
    }
}`,
        time: 'O(m · n)', space: 'O(m · n)',
        pitfalls: M`
          - Initializing «dp[0][j]»: patterns like «a*b*» match the empty string.
          - Treating «*» as matching any sequence of anything: that's wildcard matching (LeetCode 44), a different problem.
          - Plain recursion without memoization is exponential (the large test).
        `,
        alts: [
          { name: 'Memoized recursion', time: 'O(m · n)', space: 'O(m · n)', java: J`class Solution {
    private Boolean[][] memo;
    public boolean isMatch(String s, String p) { memo = new Boolean[s.length() + 1][p.length() + 1]; return m(s, p, 0, 0); }
    private boolean m(String s, String p, int i, int j) {
        if (j == p.length()) return i == s.length();
        if (memo[i][j] != null) return memo[i][j];
        boolean first = i < s.length() && (p.charAt(j) == '.' || p.charAt(j) == s.charAt(i));
        boolean r;
        if (j + 1 < p.length() && p.charAt(j + 1) == '*') r = m(s, p, i, j + 2) || (first && m(s, p, i + 1, j));
        else r = first && m(s, p, i + 1, j + 1);
        return memo[i][j] = r;
    }
}` },
        ],
        talk: 'dp[i][j] = s[0..i) matches p[0..j). For a normal character or “.”, it needs a match plus dp[i−1][j−1]. For “x*”, either zero copies, dp[i][j−2], or, when s[i−1] matches x, one more copy, dp[i−1][j]. Initialize row 0 for patterns like a*b*. O(m·n).',
      },
      lc: [lc(10, 'regular-expression-matching', 'Regular Expression Matching', 'same'), lc(44, 'wildcard-matching', 'Wildcard Matching', 'variant'), lc(72, 'edit-distance', 'Edit Distance', 'similar')],
      drill: { prompt: 'Full-string match of a pattern with “.” (any char) and “*” (zero or more of the previous element).', pattern: 'dp-2d', why: 'Two-sequence DP with the star case: skip “x*” or consume one matching character.' },
    } },
  ],
});
})();

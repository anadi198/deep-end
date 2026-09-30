(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

DSA.module({
  id: 'dp-1d', title: 'Dynamic Programming I: 1-D', short: '1-D DP',
  blurb: 'From exponential recursion to linear time: define the state, write the recurrence, fill a table, then keep only what you need.',
  intro: M`
    DP intimidates people because solutions look like magic formulas. They aren't. Every DP solution comes from the same four questions: **what is the state, what are the choices, what are the base cases, and in what order do you fill it?** This module answers them for one-dimensional problems (an index into an array or string), and the next module adds a second dimension.
  `,
  more: [
    lc(509, 'fibonacci-number', 'Fibonacci Number', 'easier'),
    lc(1137, 'n-th-tribonacci-number', 'N-th Tribonacci Number', 'easier'),
    lc(740, 'delete-and-earn', 'Delete and Earn', 'similar'),
    lc(279, 'perfect-squares', 'Perfect Squares', 'similar'),
    lc(377, 'combination-sum-iv', 'Combination Sum IV', 'similar'),
    lc(1143, 'longest-common-subsequence', 'Longest Common Subsequence', 'harder'),
    lc(673, 'number-of-longest-increasing-subsequence', 'Number of Longest Increasing Subsequence', 'harder'),
    lc(354, 'russian-doll-envelopes', 'Russian Doll Envelopes', 'harder'),
    lc(918, 'maximum-sum-circular-subarray', 'Maximum Sum Circular Subarray', 'harder'),
    lc(983, 'minimum-cost-for-tickets', 'Minimum Cost For Tickets', 'similar'),
    lc(2466, 'count-ways-to-build-good-strings', 'Count Ways To Build Good Strings', 'similar'),
    lc(140, 'word-break-ii', 'Word Break II', 'harder'),
  ],
  items: [
    { lesson: 'dp-intro', title: 'Dynamic programming from first principles', mins: 18,
      lede: 'DP is recursion that remembers. Learn the four-step recipe and the refactoring path from brute force to an O(1)-space loop.',
      body: M`
        ## When DP applies
        1. **Optimal substructure:** the answer for a big input is built from answers for smaller inputs.
        2. **Overlapping subproblems:** the brute-force recursion solves the same smaller input many times.

        Fibonacci is the smallest example. The naive recursion takes exponential time because «f(n−2)» is computed inside both «f(n)» and «f(n−1)», and so on down the tree:

        @viz fibMemo

        ## The refactoring path (do this out loud in interviews)
        1. **Recursive brute force.** Write «solve(i)» directly from the problem's choices.
        2. **Memoize.** Cache «solve(i)» in an array or map. Each state is computed once: time = states × work per state.
        3. **Tabulate.** Fill the same array bottom-up in dependency order. There's no recursion, so no stack overflow in Java.
        4. **Compress.** If «dp[i]» only reads the last one or two entries, keep only those in variables: O(1) space.

        ~~~java Step 1 → 2: memoized recursion (climbing stairs: 1 or 2 steps at a time)
        int ways(int i, int[] memo) {                 // ways to reach step n from step i
            if (i >= n) return i == n ? 1 : 0;
            if (memo[i] != 0) return memo[i];
            return memo[i] = ways(i + 1, memo) + ways(i + 2, memo);
        }
        ~~~
        ~~~java Step 3 → 4: bottom-up, then two variables
        int a = 1, b = 1;                             // ways(n), ways(n+1) boundary values
        for (int i = n - 1; i >= 0; i--) { int c = a + b; b = a; a = c; }
        return a;
        ~~~

        ## The recipe
        | Question | Example (house robber) |
        |---|---|
        | **State:** what does dp[i] mean, in words? | the most money from houses 0..i |
        | **Choices / transition:** how does dp[i] use smaller states? | skip house i → dp[i−1]; take it → dp[i−2] + nums[i] |
        | **Base cases** | dp[0] = nums[0], dp[1] = max(nums[0], nums[1]) |
        | **Order and answer** | increasing i; the answer is dp[n−1] |

        @viz houseRobberDP

        :::key State design is the whole game
        If you can't write the transition, the state is missing information. Common fixes:
        - "best **ending at** i" instead of "best **among** the first i" (maximum subarray, LIS).
        - Add a flag: "…with the stock held / not held", "…with the first house taken".
        - Track two values: max **and** min product (negatives flip them).
        :::

        ## Common 1-D shapes
        | Shape | Transition | Problems |
        |---|---|---|
        | Fibonacci-like | dp[i] = f(dp[i−1], dp[i−2]) | Climbing stairs, house robber, decode ways |
        | Best over choices | dp[i] = min/max over options of dp[i − cost] + gain | Coin change, perfect squares, min cost tickets |
        | Ending at i | dp[i] = best subarray/subsequence that ends exactly at i | Max subarray, LIS, max product |
        | Prefix segmentation | dp[i] = any/count over j < i of dp[j] ∧ valid(j..i) | Word break, palindrome partitioning |
        | Expand around centres | not a table, but reuses palindromic structure | Longest palindromic substring |

        @viz coinChangeDP

        ## Java notes
        - For memo arrays, use «int[]» with a sentinel (−1), or «Integer[]» where «null» means not computed. Avoid «HashMap<Integer,Integer>» for dense states: it's slower and boxes everything.
        - Counts overflow quickly: use «long», and «% 1_000_000_007» after every addition if the problem asks.
        - Deep recursion (n up to 10⁵) risks «StackOverflowError», so prefer bottom-up in Java.

        ## Signals
        - "Number of ways", "minimum cost", "maximum value", "is it possible", over a sequence of choices.
        - The brute-force recursion branches, and the same (index, …) arguments repeat.
        - Greedy seems plausible, but you can find a counterexample (coin change with [1, 3, 4] and amount 6).
        - Constraints like n ≤ 10⁴ with an obvious O(n²) state space.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'Coins [1, 3, 4], amount 6. Greedy (largest coin first) gives 4 + 1 + 1 = 3 coins. What’s optimal, and why does this justify DP?',
          options: ['3 coins; greedy is optimal', '2 coins (3 + 3): greedy commits too early, while DP considers every last coin for every amount', '1 coin', 'Impossible'],
          answer: 1, why: 'The locally best choice (4) blocks the global optimum. DP tries every coin as the last one: dp[6] = 1 + min(dp[5], dp[3], dp[2]) = 1 + dp[3] = 2.' },
        { q: 'You memoized a recursion with states (i) for i in 0..n, and each state loops over up to n options. Time complexity?',
          options: ['O(n)', 'O(n²)', 'O(2ⁿ)', 'O(n log n)'],
          answer: 1, why: 'Time = number of states × work per state = n × n. Memoization doesn’t make a state’s own loop free.' },
      ],
      practice: ['climbing-stairs', 'min-cost-stairs', 'house-robber', 'house-robber-ii', 'coin-change', 'decode-ways', 'word-break', 'max-product-subarray', 'lis', 'longest-palindrome-substring', 'palindromic-substrings'],
    },

    { problem: {
      id: 'climbing-stairs', title: 'Climbing Stairs', diff: 'easy',
      tags: ['1-D DP', 'Fibonacci'],
      statement: M`
        A staircase has «n» steps. Each move climbs **1 or 2** steps. In how many distinct ways can you reach the top?
      `,
      fn: { name: 'climbStairs', params: [['int', 'n']], ret: 'int' },
      tests: [
        { args: [2], ex: true, expect: 2, why: '1+1 or 2.' },
        { args: [3], ex: true, expect: 3, why: '1+1+1, 1+2, 2+1.' },
        { args: [1], expect: 1 },
        { args: [4], expect: 5 },
        { args: [10], expect: 89 },
        { args: [45], expect: 1836311903, why: 'Near the int limit. The naive recursion would take about 3.7 billion calls.' },
      ],
      constraints: ['1 ≤ n ≤ 45'],
      hints: [
        'Think about your **last** move to reach step n.',
        'It was either a 1-step from n − 1 or a 2-step from n − 2. So ways(n) = ways(n − 1) + ways(n − 2).',
        'That’s Fibonacci. Compute it bottom-up with two variables.',
      ],
      solution: {
        pattern: '**Fibonacci-shaped DP:** "ways to reach i" sums the ways to reach each state that can move to i.',
        intuition: 'Every way to reach step n ends with a 1-step or a 2-step, and those two groups don’t overlap. So the count is ways(n − 1) + ways(n − 2), with ways(0) = ways(1) = 1.',
        java: J`class Solution {
    public int climbStairs(int n) {
        int prev = 1, cur = 1;                  // ways(i-1), ways(i), starting at i = 1
        for (int i = 2; i <= n; i++) {
            int next = prev + cur;
            prev = cur;
            cur = next;
        }
        return cur;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - Naive recursion is O(2ⁿ): n = 45 takes billions of calls.
          - Base cases: ways(1) = 1, ways(2) = 2. Starting the loop wrongly shifts everything by one.
        `,
        alts: [
          { name: 'Memoized recursion', time: 'O(n)', space: 'O(n)', java: J`class Solution {
    private final int[] memo = new int[46];
    public int climbStairs(int n) {
        if (n <= 2) return n;
        if (memo[n] != 0) return memo[n];
        return memo[n] = climbStairs(n - 1) + climbStairs(n - 2);
    }
}` },
          { name: 'Matrix power / Binet formula', time: 'O(log n)', space: 'O(1)', note: 'Fibonacci numbers come from powers of [[1,1],[1,0]]. Fast exponentiation gives O(log n). It’s overkill for n ≤ 45, but a nice follow-up.', check: false },
        ],
        followups: M`
          - **Steps of size 1, 2 or 3** (or any set): ways(n) = Σ ways(n − s).
          - **Some steps are broken:** set ways(broken) = 0.
          - **Minimum cost instead of count** (next problem): replace + with min.
        `,
        talk: 'The last move is 1 or 2 steps, so ways(n) = ways(n−1) + ways(n−2): Fibonacci. Bottom-up with two variables, O(n) time and O(1) space.',
      },
      viz: { id: 'fibMemo', input: { n: 6, memo: 'yes' } },
      lc: [lc(70, 'climbing-stairs', 'Climbing Stairs', 'same'), lc(509, 'fibonacci-number', 'Fibonacci Number', 'easier'), lc(746, 'min-cost-climbing-stairs', 'Min Cost Climbing Stairs', 'variant'), lc(1137, 'n-th-tribonacci-number', 'N-th Tribonacci Number', 'variant')],
      drill: { prompt: 'Number of ways to climb n stairs taking 1 or 2 steps at a time.', pattern: 'dp-1d', why: 'ways(n) = ways(n−1) + ways(n−2): Fibonacci-style 1-D DP.' },
    } },

    { problem: {
      id: 'min-cost-stairs', title: 'Min Cost Climbing Stairs', diff: 'easy',
      tags: ['1-D DP'],
      statement: M`
        «cost[i]» is the price of stepping on stair «i». After paying for a stair you may climb one or two stairs. You can start on stair 0 or stair 1. Reach the **top** (just past the last stair) as cheaply as possible and return that total cost.
      `,
      fn: { name: 'minCostClimbingStairs', params: [['int[]', 'cost']], ret: 'int' },
      tests: [
        { args: [[10, 15, 20]], ex: true, expect: 15, why: 'Start on stair 1 (15), then jump two to the top.' },
        { args: [[1, 100, 1, 1, 1, 100, 1, 1, 100, 1]], ex: true, expect: 6 },
        { args: [[0, 0]], expect: 0 },
        { args: [[5, 10]], expect: 5 },
        { args: [[1, 2, 3, 4, 5]], expect: 6 },
        { args: [[0, 1, 2, 2]], expect: 2 },
        { args: [{ $gen: 'ints', args: [100000, 0, 999, 201] }], big: true },
      ],
      constraints: ['2 ≤ cost.length ≤ 10⁵ (LeetCode: 1000)', '0 ≤ cost[i] ≤ 999'],
      hints: [
        'Let dp[i] be the minimum cost to arrive at stair i (before paying for it).',
        'You arrive at i from i − 1 (paying cost[i − 1]) or from i − 2 (paying cost[i − 2]).',
        'dp[0] = dp[1] = 0; the answer is dp[n]. Keep two variables.',
      ],
      solution: {
        pattern: '**1-D DP with min:** the same shape as climbing stairs, where + becomes min over the two predecessors.',
        intuition: 'To stand at the top (index n), your last stair was n − 1 or n − 2; you paid for it, plus whatever it cost to get there. Minimize over those two options, building up from the free starting positions.',
        java: J`class Solution {
    public int minCostClimbingStairs(int[] cost) {
        int a = 0, b = 0;                               // dp[i-2], dp[i-1]: cost to arrive there
        for (int i = 2; i <= cost.length; i++) {
            int c = Math.min(b + cost[i - 1], a + cost[i - 2]);
            a = b;
            b = c;
        }
        return b;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - The top is index n, *past* the last stair. Returning dp[n − 1] misses the final jump.
          - Starting at stair 0 or 1 is free: dp[0] = dp[1] = 0.
        `,
        alts: [
          { name: 'dp array', time: 'O(n)', space: 'O(n)', java: J`class Solution {
    public int minCostClimbingStairs(int[] cost) {
        int n = cost.length;
        int[] dp = new int[n + 1];
        for (int i = 2; i <= n; i++) dp[i] = Math.min(dp[i - 1] + cost[i - 1], dp[i - 2] + cost[i - 2]);
        return dp[n];
    }
}` },
        ],
        talk: 'dp[i] is the cheapest cost to arrive at stair i = min(dp[i−1] + cost[i−1], dp[i−2] + cost[i−2]), with the first two free. The answer is dp[n]. Two rolling variables.',
      },
      lc: [lc(746, 'min-cost-climbing-stairs', 'Min Cost Climbing Stairs', 'same'), lc(70, 'climbing-stairs', 'Climbing Stairs', 'easier'), lc(983, 'minimum-cost-for-tickets', 'Minimum Cost For Tickets', 'harder')],
      drill: { prompt: 'Pay cost[i] to step on stair i, move 1 or 2 stairs; minimum cost to get past the top.', pattern: 'dp-1d', why: 'dp[i] = min of the two predecessors plus their cost.' },
    } },

    { problem: {
      id: 'house-robber', title: 'House Robber', diff: 'medium',
      tags: ['1-D DP', 'take or skip'],
      statement: M`
        Houses along a street hold «nums[i]» money. Robbing two **adjacent** houses triggers an alarm. Return the maximum amount you can rob without robbing two neighbours.
      `,
      fn: { name: 'rob', params: [['int[]', 'nums']], ret: 'int' },
      tests: [
        { args: [[1, 2, 3, 1]], ex: true, expect: 4, why: 'Houses 0 and 2.' },
        { args: [[2, 7, 9, 3, 1]], ex: true, expect: 12, why: 'Houses 0, 2 and 4.' },
        { args: [[5]], expect: 5 },
        { args: [[2, 1, 1, 2]], expect: 4, why: 'Houses 0 and 3: skipping two in a row can be optimal.' },
        { args: [[0, 0, 0]], expect: 0 },
        { args: [[100, 1, 1, 100]], expect: 200 },
        { args: [{ $gen: 'ints', args: [100000, 0, 400, 203] }], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁵ (LeetCode: 100)', '0 ≤ nums[i] ≤ 400'],
      hints: [
        'Consider the last house. Either you rob it or you don’t.',
        'Rob it: you can’t rob the previous one, so it’s «nums[i] + best(i − 2)». Skip it: «best(i − 1)».',
        'best(i) = max(best(i − 1), best(i − 2) + nums[i]). Two variables suffice.',
      ],
      solution: {
        pattern: '**Take-or-skip DP:** each element is either included (with a constraint on its neighbours) or excluded.',
        intuition: 'The best plan for houses 0..i either includes house i (then house i − 1 is excluded, and the rest is the best plan for 0..i − 2) or excludes it (then it’s the best plan for 0..i − 1).',
        java: J`class Solution {
    public int rob(int[] nums) {
        int prev2 = 0, prev1 = 0;                     // best for houses up to i-2, i-1
        for (int x : nums) {
            int cur = Math.max(prev1, prev2 + x);     // skip i, or take i
            prev2 = prev1;
            prev1 = cur;
        }
        return prev1;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - Greedy (take every other house, or the largest first) fails on «[2, 1, 1, 2]».
          - Taking only the even or only the odd positions misses mixed patterns.
        `,
        alts: [
          { name: 'Memoized recursion', time: 'O(n)', space: 'O(n)', java: J`class Solution {
    private int[] memo;
    public int rob(int[] nums) { memo = new int[nums.length]; Arrays.fill(memo, -1); return best(nums, nums.length - 1); }
    private int best(int[] a, int i) {
        if (i < 0) return 0;
        if (memo[i] >= 0) return memo[i];
        return memo[i] = Math.max(best(a, i - 1), best(a, i - 2) + a[i]);
    }
}`, check: false },
          { name: 'Brute force over subsets', time: 'O(2ⁿ · n)', space: 'O(n)', check: false, note: 'Try every non-adjacent subset. It’s the exponential baseline.' },
        ],
        followups: M`
          - **Houses in a circle** (next problem): run twice, excluding the first house or the last.
          - **Houses in a binary tree** (LeetCode 337): return (robbed, notRobbed) pairs bottom-up.
          - **Delete and earn** (LeetCode 740): bucket the values, then run house robber.
        `,
        talk: 'best(i) = max(skip i → best(i−1), take i → best(i−2) + nums[i]). Bottom-up with two rolling variables: O(n) time, O(1) space.',
      },
      viz: { id: 'houseRobberDP' },
      lc: [lc(198, 'house-robber', 'House Robber', 'same'), lc(213, 'house-robber-ii', 'House Robber II', 'variant'), lc(337, 'house-robber-iii', 'House Robber III', 'harder'), lc(740, 'delete-and-earn', 'Delete and Earn', 'similar')],
      drill: { prompt: 'Maximize the sum of chosen array elements with no two adjacent.', pattern: 'dp-1d', why: 'Take-or-skip DP: best(i) = max(best(i−1), best(i−2) + a[i]).' },
    } },

    { problem: {
      id: 'house-robber-ii', title: 'House Robber in a Circle', diff: 'medium',
      tags: ['1-D DP', 'break the cycle'],
      statement: M`
        Same as House Robber, but the houses stand in a **circle**: the first and last houses are neighbours. Return the maximum you can rob.
      `,
      fn: { name: 'rob', params: [['int[]', 'nums']], ret: 'int' },
      tests: [
        { args: [[2, 3, 2]], ex: true, expect: 3 },
        { args: [[1, 2, 3, 1]], ex: true, expect: 4 },
        { args: [[1, 2, 3]], ex: true, expect: 3 },
        { args: [[7]], expect: 7 },
        { args: [[5, 1]], expect: 5 },
        { args: [[200, 3, 140, 20, 10]], expect: 340 },
        { args: [[1, 3, 1, 3, 100]], expect: 103 },
        { args: [{ $gen: 'ints', args: [100000, 0, 1000, 205] }], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁵ (LeetCode: 100)', '0 ≤ nums[i] ≤ 1000'],
      hints: [
        'The circle only adds one constraint: you can’t rob both house 0 and house n − 1.',
        'So either house 0 is excluded, or house n − 1 is excluded (or both).',
        'Run the linear house robber on «[1..n−1]» and on «[0..n−2]», and take the max. Handle n = 1 separately.',
      ],
      solution: {
        pattern: '**Break a cycle into linear cases:** solve the linear version twice, once without the first element and once without the last.',
        intuition: 'Any valid circular plan leaves out house 0 or house n − 1, so it’s a valid linear plan on one of the two shortened ranges. The best of the two linear answers is the circular answer.',
        java: J`class Solution {
    public int rob(int[] nums) {
        int n = nums.length;
        if (n == 1) return nums[0];
        return Math.max(line(nums, 0, n - 2), line(nums, 1, n - 1));
    }

    private int line(int[] a, int lo, int hi) {
        int prev2 = 0, prev1 = 0;
        for (int i = lo; i <= hi; i++) {
            int cur = Math.max(prev1, prev2 + a[i]);
            prev2 = prev1;
            prev1 = cur;
        }
        return prev1;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - n = 1: both ranges would be empty, but the single house can be robbed.
          - Trying to track "was the first house taken" inside one pass works, but it's easy to get wrong. Two passes are cleaner.
        `,
        alts: [
          { name: 'Brute force', time: 'O(2ⁿ · n)', space: 'O(n)', check: false, note: 'Enumerate subsets with no two adjacent, circularly.' },
        ],
        talk: 'The circle forbids taking both the first and last house, so the answer is the max of linear house robber on [0..n−2] and on [1..n−1], with n = 1 as a special case. O(n).',
      },
      lc: [lc(213, 'house-robber-ii', 'House Robber II', 'same'), lc(198, 'house-robber', 'House Robber', 'easier'), lc(918, 'maximum-sum-circular-subarray', 'Maximum Sum Circular Subarray', 'similar')],
      drill: { prompt: 'Non-adjacent maximum sum where the array is circular (first and last are adjacent).', pattern: 'dp-1d', why: 'Run the linear take-or-skip DP twice: excluding the first element, then the last.' },
    } },

    { problem: {
      id: 'coin-change', title: 'Coin Change (Fewest Coins)', diff: 'medium',
      tags: ['1-D DP', 'unbounded'],
      statement: M`
        Given coin denominations «coins» (unlimited supply of each) and an «amount», return the **fewest coins** that add up to exactly «amount», or «−1» if it can't be made.
      `,
      fn: { name: 'coinChange', params: [['int[]', 'coins'], ['int', 'amount']], ret: 'int' },
      tests: [
        { args: [[1, 2, 5], 11], ex: true, expect: 3, why: '5 + 5 + 1.' },
        { args: [[2], 3], ex: true, expect: -1 },
        { args: [[1], 0], ex: true, expect: 0 },
        { args: [[1, 3, 4], 6], expect: 2, why: '3 + 3. Greedy would pick 4 + 1 + 1.' },
        { args: [[2, 5, 10, 1], 27], expect: 4 },
        { args: [[186, 419, 83, 408], 6249], expect: 20 },
        { args: [[7], 14], expect: 2 },
        { args: [[3, 7, 405, 436], 8839], big: true },
        { args: [[411, 412, 413, 414, 415, 416, 417, 418, 419, 420, 421, 422], 9864], big: true },
      ],
      constraints: ['1 ≤ coins.length ≤ 12', '1 ≤ coins[i] ≤ 2³¹ − 1', '0 ≤ amount ≤ 10⁴'],
      hints: [
        'Think about the **last coin** used to make amount a. If it’s coin c, what remains?',
        'amount a − c, which should be made with the fewest coins. So dp[a] = 1 + min over coins c ≤ a of dp[a − c].',
        'Fill dp[0..amount] upward, with dp[0] = 0 and "infinity" = amount + 1 for unreachable amounts.',
      ],
      solution: {
        pattern: '**Min over choices DP (unbounded knapsack):** dp[a] = 1 + min over coins of dp[a − coin].',
        intuition: 'The optimal way to make a ends with some coin c, and what comes before it must be an optimal way to make a − c (otherwise you could improve it). Trying every coin as the last one covers every possibility.',
        java: J`class Solution {
    public int coinChange(int[] coins, int amount) {
        int[] dp = new int[amount + 1];
        Arrays.fill(dp, amount + 1);            // larger than any possible answer
        dp[0] = 0;
        for (int a = 1; a <= amount; a++)
            for (int c : coins)
                if (c <= a && dp[a - c] + 1 < dp[a]) dp[a] = dp[a - c] + 1;
        return dp[amount] > amount ? -1 : dp[amount];
    }
}`,
        time: 'O(amount × coins)', space: 'O(amount)',
        pitfalls: M`
          - «Integer.MAX_VALUE» as infinity overflows in «dp[a − c] + 1». Use «amount + 1».
          - Greedy (largest coin first) is wrong for arbitrary denominations (test 4).
          - «c <= a» must be checked before indexing «dp[a − c]». Coins can be huge (up to 2³¹ − 1).
        `,
        alts: [
          { name: 'BFS over amounts', time: 'O(amount × coins)', space: 'O(amount)', note: 'Each amount is a node; adding a coin is an edge of cost 1. The BFS level at which you reach «amount» is the fewest coins. The same complexity, viewed as a shortest path.',
            java: J`class Solution {
    public int coinChange(int[] coins, int amount) {
        if (amount == 0) return 0;
        boolean[] seen = new boolean[amount + 1];
        Deque<Integer> q = new ArrayDeque<>();
        q.offer(0); seen[0] = true;
        for (int steps = 1; !q.isEmpty(); steps++) {
            for (int k = q.size(); k > 0; k--) {
                int cur = q.poll();
                for (int c : coins) {
                    if (c > amount - cur) continue;
                    int nxt = cur + c;
                    if (nxt == amount) return steps;
                    if (!seen[nxt]) { seen[nxt] = true; q.offer(nxt); }
                }
            }
        }
        return -1;
    }
}` },
          { name: 'Memoized recursion', time: 'O(amount × coins)', space: 'O(amount)', check: false, note: 'best(a) = 1 + min(best(a − c)). Same logic top-down, but recursion can reach depth «amount».' },
        ],
        followups: M`
          - **Count the ways** instead of the minimum (Coin Change II, LeetCode 518): order of loops matters (next module).
          - **Reconstruct the coins:** store which coin achieved dp[a] and walk back.
        `,
        talk: 'dp[a] = fewest coins for amount a = 1 + min over coins c ≤ a of dp[a−c], with dp[0] = 0 and amount+1 as infinity. Fill upward. O(amount × coins). Greedy fails for arbitrary denominations.',
      },
      viz: { id: 'coinChangeDP' },
      lc: [lc(322, 'coin-change', 'Coin Change', 'same'), lc(518, 'coin-change-ii', 'Coin Change II', 'variant'), lc(279, 'perfect-squares', 'Perfect Squares', 'similar'), lc(983, 'minimum-cost-for-tickets', 'Minimum Cost For Tickets', 'similar')],
      drill: { prompt: 'Fewest coins (unlimited supply of given denominations) to make an exact amount.', pattern: 'dp-1d', why: 'dp[a] = 1 + min over coins of dp[a − c]; greedy fails in general.' },
    } },

    { problem: {
      id: 'decode-ways', title: 'Decode Ways', diff: 'medium',
      tags: ['1-D DP', 'strings'],
      statement: M`
        Letters are encoded as numbers: «A → 1», «B → 2», …, «Z → 26». Given a digit string «s», return the number of ways to decode it into letters. A group can't start with «0» (so «06» is invalid, but «6» is fine). The answer fits in a 32-bit int.
      `,
      fn: { name: 'numDecodings', params: [['String', 's']], ret: 'int' },
      tests: [
        { args: ['12'], ex: true, expect: 2, why: '"AB" (1 2) or "L" (12).' },
        { args: ['226'], ex: true, expect: 3, why: '2 2 6, 22 6, 2 26.' },
        { args: ['06'], ex: true, expect: 0 },
        { args: ['0'], expect: 0 },
        { args: ['10'], expect: 1 },
        { args: ['100'], expect: 0 },
        { args: ['2101'], expect: 1 },
        { args: ['27'], expect: 1 },
        { args: ['11106'], expect: 2 },
        { args: ['1'.repeat(45)], big: true, expect: 1836311903, why: '45 ones: Fibonacci(46) decodings, near the int limit.' },
      ],
      constraints: ['1 ≤ s.length ≤ 100', 's contains digits and may start with 0'],
      hints: [
        'Look at how the decoding of a prefix ends: the last letter used either one digit or two.',
        'ways(i) (the prefix of length i) = ways(i − 1) if s[i−1] is 1–9, plus ways(i − 2) if s[i−2..i−1] is 10–26.',
        'ways(0) = 1 (the empty prefix). Keep two variables.',
      ],
      solution: {
        pattern: '**Fibonacci-like counting with validity conditions:** each position either stands alone or pairs with its predecessor.',
        intuition: 'Every decoding of the first i characters ends with either a single-digit letter (the last digit, which must not be 0) or a two-digit letter (the last two digits, 10–26). Those cases are disjoint, so their counts add.',
        java: J`class Solution {
    public int numDecodings(String s) {
        int prev2 = 1;                                          // ways for the empty prefix
        int prev1 = s.charAt(0) == '0' ? 0 : 1;                 // ways for the first char
        for (int i = 2; i <= s.length(); i++) {
            int cur = 0;
            if (s.charAt(i - 1) != '0') cur += prev1;           // last letter is one digit
            int two = (s.charAt(i - 2) - '0') * 10 + (s.charAt(i - 1) - '0');
            if (two >= 10 && two <= 26) cur += prev2;           // last letter is two digits
            prev2 = prev1;
            prev1 = cur;
        }
        return prev1;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - '0' can't stand alone, and "0X" isn't a valid pair (two-digit codes are 10–26).
          - Once a 0 has no valid partner, the count stays 0 for good. The recurrence handles that naturally.
        `,
        alts: [
          { name: 'Memoized recursion from the left', time: 'O(n)', space: 'O(n)', java: J`class Solution {
    private Integer[] memo;
    public int numDecodings(String s) { memo = new Integer[s.length() + 1]; return go(s, 0); }
    private int go(String s, int i) {
        if (i == s.length()) return 1;
        if (s.charAt(i) == '0') return 0;
        if (memo[i] != null) return memo[i];
        int r = go(s, i + 1);
        if (i + 1 < s.length() && (s.charAt(i) - '0') * 10 + (s.charAt(i + 1) - '0') <= 26) r += go(s, i + 2);
        return memo[i] = r;
    }
}` },
        ],
        followups: M`
          - **With '*' wildcards** (LeetCode 639): the same DP with more cases, taken modulo 10⁹ + 7.
        `,
        talk: 'ways(i) = [s[i−1] ≠ 0] · ways(i−1) + [s[i−2..i−1] in 10–26] · ways(i−2), with ways(0) = 1. Two rolling variables, O(n).',
      },
      lc: [lc(91, 'decode-ways', 'Decode Ways', 'same'), lc(639, 'decode-ways-ii', 'Decode Ways II', 'harder'), lc(1416, 'restore-the-array', 'Restore The Array', 'harder')],
      drill: { prompt: 'Count the ways a digit string can be split into letter codes 1–26.', pattern: 'dp-1d', why: 'Each prefix ends in a 1-digit or a valid 2-digit code: Fibonacci-like DP.' },
    } },

    { problem: {
      id: 'word-break', title: 'Word Break', diff: 'medium',
      tags: ['1-D DP', 'segmentation'],
      statement: M`
        Given a string «s» and a dictionary «wordDict», return «true» if «s» can be split into a sequence of one or more dictionary words (words may be reused).
      `,
      fn: { name: 'wordBreak', params: [['String', 's'], ['List<String>', 'wordDict']], ret: 'boolean' },
      tests: [
        { args: ['leetcode', ['leet', 'code']], ex: true, expect: true },
        { args: ['applepenapple', ['apple', 'pen']], ex: true, expect: true },
        { args: ['catsandog', ['cats', 'dog', 'sand', 'and', 'cat']], ex: true, expect: false },
        { args: ['a', ['b']], expect: false },
        { args: ['aaaaaaa', ['aaaa', 'aaa']], expect: true },
        { args: ['cars', ['car', 'ca', 'rs']], expect: true, why: 'Greedy "car" fails; "ca" + "rs" works.' },
        { args: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab', ['a', 'aa', 'aaa', 'aaaa', 'aaaaa', 'aaaaaa', 'aaaaaaa', 'aaaaaaaa', 'aaaaaaaaa', 'aaaaaaaaaa']], expect: false, why: 'Plain backtracking explodes here; DP doesn’t.' },
        { args: [{ $gen: 'repeatStr', args: ['abcab', 60] }, ['ab', 'ca', 'b', 'abc', 'cab', 'abcab']], big: true, expect: true },
      ],
      constraints: ['1 ≤ s.length ≤ 300', '1 ≤ wordDict.length ≤ 1000', '1 ≤ word length ≤ 20'],
      hints: [
        'Trying every split recursively repeats work: the same suffix gets tested again and again.',
        'Let dp[i] be whether the prefix «s[0..i)» can be segmented. dp[0] = true.',
        'dp[i] is true if some j < i has dp[j] true and «s[j..i)» in the dictionary (a HashSet). Limit j to the dictionary’s word lengths for speed.',
      ],
      solution: {
        pattern: '**Prefix segmentation DP:** dp[i] = OR over split points j of (dp[j] AND piece(j, i) is valid).',
        intuition: 'A segmentation of the prefix of length i ends with some dictionary word s[j..i), and what comes before must itself be segmentable. So dp[i] only depends on earlier dp values, and you can fill it left to right.',
        java: J`class Solution {
    public boolean wordBreak(String s, List<String> wordDict) {
        Set<String> dict = new HashSet<>(wordDict);
        int maxLen = 0;
        for (String w : wordDict) maxLen = Math.max(maxLen, w.length());
        boolean[] dp = new boolean[s.length() + 1];
        dp[0] = true;
        for (int i = 1; i <= s.length(); i++)
            for (int j = Math.max(0, i - maxLen); j < i; j++)          // last word is s[j..i)
                if (dp[j] && dict.contains(s.substring(j, i))) { dp[i] = true; break; }
        return dp[s.length()];
    }
}`,
        time: 'O(n · L²)', space: 'O(n)', timeWhy: 'L = max word length (substring + hash per split)',
        pitfalls: M`
          - Backtracking without memoization is exponential (test 7).
          - Greedy longest-match fails (test 6).
        `,
        alts: [
          { name: 'Memoized DFS over start positions', time: 'O(n · L²)', space: 'O(n)', java: J`class Solution {
    private Boolean[] memo;
    public boolean wordBreak(String s, List<String> wordDict) { memo = new Boolean[s.length()]; return can(s, 0, new HashSet<>(wordDict)); }
    private boolean can(String s, int i, Set<String> dict) {
        if (i == s.length()) return true;
        if (memo[i] != null) return memo[i];
        for (int j = i + 1; j <= s.length(); j++)
            if (dict.contains(s.substring(i, j)) && can(s, j, dict)) return memo[i] = true;
        return memo[i] = false;
    }
}` },
          { name: 'Trie of words + DP', time: 'O(n · L)', space: 'O(total word chars)', note: 'From each reachable position, walk a trie forward to find every word starting there. There are no substring allocations.', check: false },
        ],
        followups: M`
          - **Return all segmentations** (Word Break II, LeetCode 140): backtracking plus memoization of each suffix's sentence list.
        `,
        talk: 'dp[i] = can the prefix of length i be segmented: true if some j has dp[j] and s[j..i) is a dictionary word (checked with a HashSet), limiting j to the max word length. O(n·L²).',
      },
      viz: { id: 'wordBreakDP' },
      lc: [lc(139, 'word-break', 'Word Break', 'same'), lc(140, 'word-break-ii', 'Word Break II', 'harder'), lc(472, 'concatenated-words', 'Concatenated Words', 'harder')],
      drill: { prompt: 'Can a string be split into a sequence of dictionary words?', pattern: 'dp-1d', why: 'Prefix DP: dp[i] is true if some dp[j] is true and s[j..i) is a word.' },
    } },

    { problem: {
      id: 'max-product-subarray', title: 'Maximum Product Subarray', diff: 'medium',
      tags: ['1-D DP', 'track max & min'],
      statement: M`
        Given an integer array «nums», return the largest **product** of any non-empty contiguous subarray. The answer fits in a 32-bit int.
      `,
      fn: { name: 'maxProduct', params: [['int[]', 'nums']], ret: 'int' },
      tests: [
        { args: [[2, 3, -2, 4]], ex: true, expect: 6 },
        { args: [[-2, 0, -1]], ex: true, expect: 0 },
        { args: [[-2]], expect: -2 },
        { args: [[-2, 3, -4]], expect: 24, why: 'Two negatives make a positive: keep the minimum too.' },
        { args: [[0, 2]], expect: 2 },
        { args: [[-1, -2, -3, 0]], expect: 6 },
        { args: [[2, -5, -2, -4, 3]], expect: 24 },
        { args: [[-2, -3, 7, -2, 0, 5, -8, -9]], expect: 360 },
        { args: [Array.from({ length: 20000 }, (_, i) => (i % 11 === 10 ? 0 : ((i * 7919) % 7) - 3))], big: true, why: 'Zeros every 11 elements keep products in range while exercising sign flips.' },
      ],
      constraints: ['1 ≤ nums.length ≤ 2·10⁴', '−10 ≤ nums[i] ≤ 10', 'Every subarray product fits in a 32-bit int'],
      hints: [
        'Kadane’s idea (best subarray ending here) almost works. What breaks it for products?',
        'A negative number turns the **smallest** product into the largest. So track both the max and the min product ending at each index.',
        'At each x: newMax = max(x, x·max, x·min), newMin = min(x, x·max, x·min). Compute both from the old values.',
      ],
      solution: {
        pattern: '**"Ending here" DP with two states:** keep both extremes, because multiplying by a negative swaps them.',
        intuition: 'The best product ending at i either starts fresh at nums[i] or extends a product ending at i − 1. If nums[i] is negative, the best extension comes from the most negative previous product. So carry the max and the min together.',
        java: J`class Solution {
    public int maxProduct(int[] nums) {
        int max = nums[0], min = nums[0], best = nums[0];
        for (int i = 1; i < nums.length; i++) {
            int x = nums[i];
            int a = x * max, b = x * min;
            max = Math.max(x, Math.max(a, b));       // use the OLD max/min (saved in a, b)
            min = Math.min(x, Math.min(a, b));
            best = Math.max(best, max);
        }
        return best;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - Updating «max» first and then using the new value to compute «min»: save both products first.
          - Zeros reset everything. Starting fresh at x (the «max(x, …)» term) handles that.
        `,
        alts: [
          { name: 'Prefix and suffix products', time: 'O(n)', space: 'O(1)', note: 'The best subarray is a prefix or suffix of a zero-free segment (an even number of negatives, or drop up to the first or last negative). Scan left-to-right and right-to-left with running products, resetting at 0.',
            java: J`class Solution {
    public int maxProduct(int[] nums) {
        int n = nums.length, best = Integer.MIN_VALUE, l = 1, r = 1;
        for (int i = 0; i < n; i++) {
            l = (l == 0 ? 1 : l) * nums[i];
            r = (r == 0 ? 1 : r) * nums[n - 1 - i];
            best = Math.max(best, Math.max(l, r));
        }
        return best;
    }
}` },
          { name: 'All subarrays', time: 'O(n²)', space: 'O(1)', java: J`class Solution {
    public int maxProduct(int[] nums) {
        int best = Integer.MIN_VALUE;
        for (int i = 0; i < nums.length; i++) { int p = 1; for (int j = i; j < nums.length; j++) { p *= nums[j]; best = Math.max(best, p); } }
        return best;
    }
}` },
        ],
        talk: 'Like Kadane, but a negative flips max and min, so I track both the max and the min product ending at each index: newMax = max(x, x·max, x·min), newMin likewise, computed from the old values. O(n), O(1).',
      },
      lc: [lc(152, 'maximum-product-subarray', 'Maximum Product Subarray', 'same'), lc(53, 'maximum-subarray', 'Maximum Subarray', 'easier'), lc(1567, 'maximum-length-of-subarray-with-positive-product', 'Maximum Length of Subarray With Positive Product', 'similar')],
      drill: { prompt: 'Largest product of a contiguous subarray (values can be negative or zero).', pattern: 'dp-1d', why: '“Ending here” DP tracking both the max and the min product, since negatives swap them.' },
    } },

    { problem: {
      id: 'lis', title: 'Longest Increasing Subsequence', diff: 'medium',
      tags: ['1-D DP', 'binary search'],
      statement: M`
        Return the length of the longest **strictly increasing subsequence** of «nums». A subsequence keeps the original order but may skip elements.
      `,
      fn: { name: 'lengthOfLIS', params: [['int[]', 'nums']], ret: 'int' },
      tests: [
        { args: [[10, 9, 2, 5, 3, 7, 101, 18]], ex: true, expect: 4, why: 'For example [2, 3, 7, 101].' },
        { args: [[0, 1, 0, 3, 2, 3]], ex: true, expect: 4 },
        { args: [[7, 7, 7, 7]], ex: true, expect: 1, why: 'Strictly increasing: equal values don’t chain.' },
        { args: [[1]], expect: 1 },
        { args: [[5, 4, 3, 2, 1]], expect: 1 },
        { args: [[1, 3, 6, 7, 9, 4, 10, 5, 6]], expect: 6 },
        { args: [[4, 10, 4, 3, 8, 9]], expect: 3 },
        { args: [{ $gen: 'ints', args: [100000, -1000000, 1000000, 209] }], big: true },
        { args: [{ $gen: 'range', args: [100000, 0, 1] }], big: true, expect: 100000 },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁵ (LeetCode: 2500)', '−10⁴ ≤ nums[i] ≤ 10⁴ (the large tests go wider)'],
      hints: [
        'O(n²) DP: dp[i] = length of the LIS **ending at** i = 1 + max(dp[j]) over j < i with nums[j] < nums[i].',
        'For O(n log n): keep «tails[k]» = the smallest possible tail of an increasing subsequence of length k + 1. tails stays sorted.',
        'For each x, binary-search the first tail ≥ x and replace it (or append if x is larger than every tail). The answer is the size of tails.',
      ],
      solution: {
        pattern: '**Patience sorting:** a DP over lengths (smallest tail per length) plus binary search. It’s a classic O(n²) → O(n log n) upgrade.',
        intuition: M`
          For each possible length, only the **smallest** tail matters, because a smaller tail can be extended by more future elements. Those minimal tails are strictly increasing in length. A new element x extends the longest subsequence whose tail is < x, and it becomes the new (smaller) tail for length + 1. Binary search finds that position.
        `,
        java: J`class Solution {
    public int lengthOfLIS(int[] nums) {
        int[] tails = new int[nums.length];
        int len = 0;
        for (int x : nums) {
            int lo = 0, hi = len;                    // first index with tails[i] >= x
            while (lo < hi) {
                int mid = (lo + hi) >>> 1;
                if (tails[mid] >= x) hi = mid; else lo = mid + 1;
            }
            tails[lo] = x;
            if (lo == len) len++;
        }
        return len;
    }
}`,
        time: 'O(n log n)', space: 'O(n)',
        why: 'Invariant: tails[k] is the minimum tail over all increasing subsequences of length k + 1 seen so far. Replacing the first tail ≥ x keeps the invariant: x extends a subsequence of length lo, and x ≤ the old tails[lo].',
        pitfalls: M`
          - «tails» is not the actual LIS. Only its length is meaningful. Reconstruct with parent pointers if you need the sequence itself.
          - Strict vs non-strict: «≥ x» gives strictly increasing; use «> x» for non-decreasing.
        `,
        alts: [
          { name: 'O(n²) DP (ending at i)', time: 'O(n²)', space: 'O(n)', note: 'The standard first answer: explain it, then upgrade.',
            java: J`class Solution {
    public int lengthOfLIS(int[] nums) {
        int n = nums.length, best = 1;
        int[] dp = new int[n];
        for (int i = 0; i < n; i++) {
            dp[i] = 1;
            for (int j = 0; j < i; j++) if (nums[j] < nums[i]) dp[i] = Math.max(dp[i], dp[j] + 1);
            best = Math.max(best, dp[i]);
        }
        return best;
    }
}` },
        ],
        followups: M`
          - **Russian doll envelopes** (LeetCode 354): sort by width ascending and height descending, then take the LIS on heights.
          - **Number of LIS** (LeetCode 673): the O(n²) DP with counts.
          - **Longest chain / box stacking**: sort, then LIS.
        `,
        talk: 'O(n²) DP: dp[i] = 1 + max dp[j] over smaller earlier elements. Better: keep tails[k], the smallest tail of an increasing subsequence of length k+1. It’s sorted, so each element binary-searches its slot and replaces or appends. The answer is its size. O(n log n).',
      },
      viz: { id: 'lisTails' },
      lc: [lc(300, 'longest-increasing-subsequence', 'Longest Increasing Subsequence', 'same'), lc(354, 'russian-doll-envelopes', 'Russian Doll Envelopes', 'harder'), lc(673, 'number-of-longest-increasing-subsequence', 'Number of Longest Increasing Subsequence', 'harder'), lc(1964, 'find-the-longest-valid-obstacle-course-at-each-position', 'Find the Longest Valid Obstacle Course at Each Position', 'harder')],
      drill: { prompt: 'Length of the longest strictly increasing subsequence (not necessarily contiguous).', pattern: 'dp-1d', why: 'DP ending at i (O(n²)) or patience sorting with binary search (O(n log n)).' },
    } },

    { problem: {
      id: 'longest-palindrome-substring', title: 'Longest Palindromic Substring', diff: 'medium',
      tags: ['expand around centre', 'DP'],
      statement: M`
        Return the longest **substring** of «s» that is a palindrome. If several have the same maximum length, return the one that starts **first**.
      `,
      fn: { name: 'longestPalindrome', params: [['String', 's']], ret: 'String' },
      tests: [
        { args: ['babad'], ex: true, expect: 'bab', why: '"aba" is equally long but starts later.' },
        { args: ['cbbd'], ex: true, expect: 'bb' },
        { args: ['a'], expect: 'a' },
        { args: ['ac'], expect: 'a' },
        { args: ['forgeeksskeegfor'], expect: 'geeksskeeg' },
        { args: ['racecar'], expect: 'racecar' },
        { args: ['abacdfgdcaba'], expect: 'aba' },
        { args: [{ $gen: 'repeatStr', args: ['a', 1000] }], big: true },
        { args: [{ $gen: 'str', args: [1000, 'ab', 211] }], big: true },
      ],
      constraints: ['1 ≤ s.length ≤ 1000', 'Digits and English letters'],
      hints: [
        'Every palindrome has a centre: a character (odd length) or a gap between two characters (even length).',
        'There are 2n − 1 centres. From each, expand outward while the characters match.',
        'Track the best (start, length); only replace it on a strictly longer palindrome, to keep the earliest.',
      ],
      solution: {
        pattern: '**Expand around centres:** O(n²) time and O(1) space. It beats the O(n²)-space DP table and is the usual interview answer.',
        intuition: 'A palindrome is symmetric about its centre. Rather than testing all O(n²) substrings (each in O(n)), grow palindromes outward from each of the 2n − 1 centres. Each expansion stops at the first mismatch.',
        java: J`class Solution {
    private int bestStart = 0, bestLen = 1;

    public String longestPalindrome(String s) {
        for (int c = 0; c < s.length(); c++) {
            expand(s, c, c);           // odd length, centred on s[c]
            expand(s, c, c + 1);       // even length, centred between c and c+1
        }
        return s.substring(bestStart, bestStart + bestLen);
    }

    private void expand(String s, int l, int r) {
        while (l >= 0 && r < s.length() && s.charAt(l) == s.charAt(r)) { l--; r++; }
        int len = r - l - 1;           // the loop overshot by one on each side
        if (len > bestLen) { bestLen = len; bestStart = l + 1; }
    }
}`,
        time: 'O(n²)', space: 'O(1)',
        pitfalls: M`
          - Forgetting even-length centres misses «"bb"».
          - Off-by-one after the loop: the palindrome is «s[l+1..r−1]».
          - Replacing on ties (≥) would return a later palindrome than the one required here.
        `,
        alts: [
          { name: 'DP table isPal[i][j]', time: 'O(n²)', space: 'O(n²)', note: 'isPal[i][j] = s[i] == s[j] && (j − i < 2 || isPal[i+1][j−1]). Fill by increasing length. It’s useful when you also need all palindromic substrings (for partitioning).',
            java: J`class Solution {
    public String longestPalindrome(String s) {
        int n = s.length(), bs = 0, bl = 1;
        boolean[][] p = new boolean[n][n];
        for (int len = 1; len <= n; len++)
            for (int i = 0; i + len - 1 < n; i++) {
                int j = i + len - 1;
                p[i][j] = s.charAt(i) == s.charAt(j) && (len < 3 || p[i + 1][j - 1]);
                if (p[i][j] && len > bl) { bl = len; bs = i; }
            }
        return s.substring(bs, bs + bl);
    }
}` },
          { name: 'Manacher’s algorithm', time: 'O(n)', space: 'O(n)', note: 'Reuses mirror information to avoid re-expanding. It’s worth knowing it exists; rarely expected in interviews.', check: false },
        ],
        talk: 'Expand around each of the 2n−1 centres (characters and gaps) while the ends match, tracking the longest. O(n²) time, O(1) space. A DP table works too with O(n²) space; Manacher is O(n).',
      },
      lc: [lc(5, 'longest-palindromic-substring', 'Longest Palindromic Substring', 'same'), lc(647, 'palindromic-substrings', 'Palindromic Substrings', 'variant'), lc(516, 'longest-palindromic-subsequence', 'Longest Palindromic Subsequence', 'harder'), lc(214, 'shortest-palindrome', 'Shortest Palindrome', 'harder')],
      drill: { prompt: 'Longest contiguous palindrome within a string.', pattern: 'dp-1d', why: 'Expand around all 2n−1 centres (or a palindrome DP table): O(n²).' },
    } },

    { problem: {
      id: 'palindromic-substrings', title: 'Count Palindromic Substrings', diff: 'medium',
      tags: ['expand around centre'],
      statement: M`
        Return the number of **palindromic substrings** in «s». Substrings at different positions count separately even if they're equal.
      `,
      fn: { name: 'countSubstrings', params: [['String', 's']], ret: 'int' },
      tests: [
        { args: ['abc'], ex: true, expect: 3 },
        { args: ['aaa'], ex: true, expect: 6, why: 'a, a, a, aa, aa, aaa.' },
        { args: ['a'], expect: 1 },
        { args: ['abba'], expect: 6 },
        { args: ['racecar'], expect: 10 },
        { args: ['fdsklf'], expect: 6 },
        { args: [{ $gen: 'repeatStr', args: ['a', 1000] }], big: true, expect: 500500 },
        { args: [{ $gen: 'str', args: [1000, 'abc', 213] }], big: true },
      ],
      constraints: ['1 ≤ s.length ≤ 1000', 'Lowercase letters'],
      hints: [
        'Every palindromic substring has exactly one centre.',
        'Expand from each of the 2n − 1 centres; each successful step outward is one more palindrome.',
        'Sum the counts.',
      ],
      solution: {
        pattern: '**Expand around centres, counting** each successful expansion.',
        intuition: 'Each palindrome is identified by its centre and radius, so counting the radii that work from every centre counts every palindrome exactly once.',
        java: J`class Solution {
    public int countSubstrings(String s) {
        int count = 0;
        for (int c = 0; c < s.length(); c++) count += expand(s, c, c) + expand(s, c, c + 1);
        return count;
    }

    private int expand(String s, int l, int r) {
        int k = 0;
        while (l >= 0 && r < s.length() && s.charAt(l) == s.charAt(r)) { k++; l--; r++; }
        return k;
    }
}`,
        time: 'O(n²)', space: 'O(1)',
        alts: [
          { name: 'DP table', time: 'O(n²)', space: 'O(n²)', java: J`class Solution {
    public int countSubstrings(String s) {
        int n = s.length(), count = 0;
        boolean[][] p = new boolean[n][n];
        for (int i = n - 1; i >= 0; i--)
            for (int j = i; j < n; j++) {
                p[i][j] = s.charAt(i) == s.charAt(j) && (j - i < 2 || p[i + 1][j - 1]);
                if (p[i][j]) count++;
            }
        return count;
    }
}` },
        ],
        talk: 'Every palindrome has one centre. Expand from each of the 2n−1 centres and count each successful step. O(n²), O(1) space.',
      },
      lc: [lc(647, 'palindromic-substrings', 'Palindromic Substrings', 'same'), lc(5, 'longest-palindromic-substring', 'Longest Palindromic Substring', 'variant'), lc(131, 'palindrome-partitioning', 'Palindrome Partitioning', 'similar')],
      drill: { prompt: 'Count all substrings of a string that are palindromes.', pattern: 'dp-1d', why: 'Expand around every centre, counting successful expansions (or a DP table).' },
    } },
  ],
});
})();

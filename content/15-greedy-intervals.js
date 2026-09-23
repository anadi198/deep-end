(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

// mulberry32: small, fast, and good enough for test data.
function rng(seed) {
  let a = seed >>> 0;
  return (lo, hi) => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return lo + (((t ^ (t >>> 14)) >>> 0) % (hi - lo + 1));
  };
}

// Gas station data with total gas ≥ total cost, so some start is valid.
const GAS_MID = (() => {
  const r = rng(401), n = 4000, gas = [], cost = [];
  for (let i = 0; i < n; i++) { gas.push(r(0, 10000)); cost.push(r(0, 10000)); }
  let total = 0;
  for (let i = 0; i < n; i++) total += gas[i] - cost[i];
  for (let i = 0; total < 0; i = (i + 1) % n) { const add = Math.min(-total, 10000 - gas[i]); gas[i] += add; total += add; }
  return [gas, cost];
})();

function gasValidate({ args, got, expected }) {
  const [gas, cost] = args;
  if (!Array.isArray(gas) || !Array.isArray(cost)) return got === expected ? true : `expected ${expected}`;
  const n = gas.length;
  let total = 0;
  for (let i = 0; i < n; i++) total += gas[i] - cost[i];
  if (total < 0) return got === -1 ? true : 'total gas < total cost, so no start works: expected -1';
  if (!Number.isInteger(got) || got < 0 || got >= n) return `a valid start exists, but you returned ${got}`;
  let tank = 0;
  for (let k = 0; k < n; k++) {
    const i = (got + k) % n;
    tank += gas[i] - cost[i];
    if (tank < 0) return `starting at ${got}, the tank runs dry leaving station ${i}`;
  }
  return true;
}

DSA.module({
  id: 'greedy', title: 'Greedy & Intervals', short: 'Greedy',
  blurb: 'Take the locally best step and never look back, and know how to prove that it works. Then the interval toolkit: sort by the right key and sweep.',
  intro: M`
    Greedy algorithms are the shortest code in the interview and the easiest to get wrong. Each lesson here pairs a template with **the argument for why it's correct**, because "it seems right" is what interviewers probe. Interval problems are greedy's most common disguise: nearly all of them are "sort by start or by end, then one pass".
  `,
  more: [
    lc(122, 'best-time-to-buy-and-sell-stock-ii', 'Best Time to Buy and Sell Stock II', 'easier'),
    lc(455, 'assign-cookies', 'Assign Cookies', 'easier'),
    lc(1899, 'merge-triplets-to-form-target-triplet', 'Merge Triplets to Form Target Triplet', 'similar'),
    lc(678, 'valid-parenthesis-string', 'Valid Parenthesis String', 'similar'),
    lc(135, 'candy', 'Candy', 'harder'),
    lc(406, 'queue-reconstruction-by-height', 'Queue Reconstruction by Height', 'similar'),
    lc(621, 'task-scheduler', 'Task Scheduler', 'similar'),
    lc(986, 'interval-list-intersections', 'Interval List Intersections', 'similar'),
    lc(1288, 'remove-covered-intervals', 'Remove Covered Intervals', 'similar'),
    lc(1851, 'minimum-interval-to-include-each-query', 'Minimum Interval to Include Each Query', 'harder'),
    lc(759, 'employee-free-time', 'Employee Free Time', 'harder', { premium: true }),
    lc(630, 'course-schedule-iii', 'Course Schedule III', 'harder'),
  ],
  items: [
    { lesson: 'greedy', title: 'Greedy: choose now, prove it later', mins: 15,
      lede: 'What greedy means, the two standard proofs (exchange argument, stays ahead), how to spot when it fails, and five recurring greedy shapes.',
      body: M`
        ## What makes an algorithm greedy
        A greedy algorithm builds the answer one decision at a time, always taking the choice that looks best **right now**, and never undoing it. There's no table and no backtracking, usually just a sort and a single pass. It's correct only when the problem has the **greedy-choice property**: some optimal solution starts with the greedy choice, and what remains is a smaller instance of the same problem.

        ## Proving it (what interviewers ask for)
        :::key Two standard arguments
        - **Exchange argument:** take any optimal solution that differs from the greedy one at the first decision. Swap in the greedy choice and show the result is still valid and no worse. Repeating the swap turns the optimal solution into the greedy one, so greedy is optimal.
        - **Greedy stays ahead:** show that after every step, greedy's partial solution is at least as good as any other algorithm's partial solution (it reaches farther, finishes earlier, has spent less).
        :::

        One sentence is usually enough in an interview: *"Picking the interval that ends earliest leaves the most room for the rest, and any optimal schedule can swap its first interval for that one without conflicts."*

        ## When greedy fails, and how to find out fast
        The classic counterexample: coins «[1, 3, 4]», amount 6. Greedy takes 4 + 1 + 1 (three coins), but 3 + 3 uses two. Before committing to a greedy idea, spend a minute **trying to break it on tiny inputs**: ties, one element, the two-choice case where the locally worse option wins later. If you find a counterexample, switch to DP (the coin change problem is in the 1-D DP module).

        ## Five greedy shapes worth recognizing
        **1. Running value with a reset** (Kadane, gas station). Keep a running sum. When it stops helping (below zero, or the tank runs dry), throw it away and restart from the next position.

        @viz kadane

        **2. Reach frontier** (jump game I and II). Track the farthest index reachable so far. If the current index goes past it, you're stuck. Counting "levels" of reach gives the minimum number of jumps, which is BFS without a queue.

        @viz jumpReach

        **3. Last-occurrence boundaries** (partition labels). Precompute where each character last appears. A segment can close only once you've passed the last occurrence of everything inside it.

        **4. Smallest first** (hand of straights). The smallest remaining card must start a group, since nothing smaller could come before it. Consume from the smallest value up using a «TreeMap» of counts.

        **5. Sort by the right key, then sweep** (all the interval problems). See the next lesson.

        ## Signals
        - "Minimum number of X to cover / reach / schedule" with a monotone structure → try greedy, then look for a counterexample.
        - "Can you reach the end?" → reach frontier.
        - "Maximum subarray", "best single segment" → a running value with a reset.
        - Values must be used in consecutive runs → smallest-first with counts.
        - If greedy choices can interact later (knapsack weights, arbitrary coins) → DP.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'Coins [1, 5, 10, 25] (US coins): does "always take the largest coin that fits" give the minimum number of coins?',
          options: ['Yes, for this coin system', 'No, never', 'Only for amounts under 25', 'Only for even amounts'],
          answer: 0, why: 'US coins are a "canonical" system where greedy happens to be optimal. With [1, 3, 4] and amount 6 it fails (4+1+1 vs 3+3). Whether greedy works depends on the input structure, which is why you need a proof or a counterexample.' },
        { q: 'Kadane keeps «cur = max(x, cur + x)». Why is dropping the running sum when it goes negative safe?',
          options: ['Negative numbers are never in the answer', 'A negative prefix can only lower the sum of anything that extends it, so no optimal subarray starts with it', 'It is a heuristic', 'Because the array is sorted'],
          answer: 1, why: 'If the best sum ending at i−1 is negative, then for any subarray starting earlier and ending at j ≥ i, chopping off that negative part makes it larger. So restarting at i loses nothing.' },
      ],
      practice: ['max-subarray', 'jump-game', 'jump-game-ii', 'gas-station', 'partition-labels', 'hand-of-straights'],
    },

    { problem: {
      id: 'max-subarray', title: 'Maximum Subarray', diff: 'medium',
      tags: ['Kadane', 'running value'],
      statement: M`
        Given an integer array «nums», find the non-empty contiguous subarray with the largest sum and return that sum.
      `,
      fn: { name: 'maxSubArray', params: [['int[]', 'nums']], ret: 'int' },
      tests: [
        { args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], ex: true, expect: 6, why: '[4, −1, 2, 1].' },
        { args: [[1]], ex: true, expect: 1 },
        { args: [[5, 4, -1, 7, 8]], ex: true, expect: 23 },
        { args: [[-3, -1, -2]], expect: -1, why: 'All negative: the best is the single largest element.' },
        { args: [[0, 0, 0]], expect: 0 },
        { args: [[-1, 3, -1, 3, -10, 5]], expect: 5 },
        { args: [[2, -1, 2, -1, 2]], expect: 4 },
        { args: [{ $gen: 'ints', args: [100000, -10000, 10000, 501] }], big: true },
        { args: [{ $gen: 'ints', args: [100000, -10000, -1, 502] }], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁵', '−10⁴ ≤ nums[i] ≤ 10⁴'],
      hints: [
        'What is the best sum of a subarray that **ends exactly at** index i?',
        'It’s either nums[i] alone or nums[i] appended to the best subarray ending at i − 1, whichever is larger.',
        '«cur = max(nums[i], cur + nums[i]); best = max(best, cur)». Initialize both with nums[0] so all-negative arrays work.',
      ],
      solution: {
        pattern: '**Kadane (running value with a reset):** the best subarray ending here either extends the previous one or starts fresh.',
        intuition: M`
          Every subarray ends somewhere. If you know the best sum ending at i − 1, the best ending at i is that plus nums[i], unless that previous best is negative, in which case starting over at nums[i] is better. Track the maximum over all end positions. (It's a 1-D DP with O(1) state, and also a greedy rule: drop a negative prefix.)
        `,
        java: J`class Solution {
    public int maxSubArray(int[] nums) {
        int cur = nums[0], best = nums[0];
        for (int i = 1; i < nums.length; i++) {
            cur = Math.max(nums[i], cur + nums[i]);   // extend, or restart here
            best = Math.max(best, cur);
        }
        return best;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - Initializing «best = 0» returns 0 for all-negative arrays, but the subarray must be non-empty.
          - Resetting «cur = 0» *before* adding (the textbook variant) also works, but only if best is updated first. The max(x, cur + x) form is harder to get wrong.
        `,
        alts: [
          { name: 'Prefix sums: best difference', time: 'O(n)', space: 'O(1)', note: 'sum(i..j) = P[j+1] − P[i]. Keep the minimum prefix seen so far; the answer is the max of P − minPrefix. The same idea as the best time to buy and sell a stock.',
            java: J`class Solution {
    public int maxSubArray(int[] nums) {
        int prefix = 0, minPrefix = 0, best = Integer.MIN_VALUE;
        for (int x : nums) {
            prefix += x;
            best = Math.max(best, prefix - minPrefix);
            minPrefix = Math.min(minPrefix, prefix);
        }
        return best;
    }
}` },
          { name: 'Divide and conquer', time: 'O(n log n)', space: 'O(log n)', note: 'The best subarray is entirely in the left half, entirely in the right, or crosses the middle (best suffix of left + best prefix of right). This is the follow-up LeetCode asks for.',
            java: J`class Solution {
    public int maxSubArray(int[] nums) { return best(nums, 0, nums.length - 1); }
    private int best(int[] a, int lo, int hi) {
        if (lo == hi) return a[lo];
        int mid = (lo + hi) >>> 1;
        int leftSuffix = Integer.MIN_VALUE, s = 0;
        for (int i = mid; i >= lo; i--) { s += a[i]; leftSuffix = Math.max(leftSuffix, s); }
        int rightPrefix = Integer.MIN_VALUE; s = 0;
        for (int i = mid + 1; i <= hi; i++) { s += a[i]; rightPrefix = Math.max(rightPrefix, s); }
        return Math.max(Math.max(best(a, lo, mid), best(a, mid + 1, hi)), leftSuffix + rightPrefix);
    }
}` },
          { name: 'All pairs (brute force)', time: 'O(n²)', space: 'O(1)', java: J`class Solution {
    public int maxSubArray(int[] nums) {
        int best = Integer.MIN_VALUE;
        for (int i = 0; i < nums.length; i++) {
            int s = 0;
            for (int j = i; j < nums.length; j++) { s += nums[j]; best = Math.max(best, s); }
        }
        return best;
    }
}` },
        ],
        followups: M`
          - **Return the indices:** remember where cur last restarted, and record (start, i) whenever best improves.
          - **Circular array** (LeetCode 918): max(normal Kadane, total − minimum subarray), unless all elements are negative.
          - **Maximum product subarray** (in the 1-D DP module): track both max and min, because a negative flips them.
        `,
        talk: 'Kadane: the best subarray ending at i is max(nums[i], best ending at i−1 + nums[i]). A negative running sum never helps, so restart. Track the global max; initialize with nums[0] for all-negative inputs. O(n), O(1).',
      },
      viz: { id: 'kadane' },
      lc: [lc(53, 'maximum-subarray', 'Maximum Subarray', 'same'), lc(918, 'maximum-sum-circular-subarray', 'Maximum Sum Circular Subarray', 'variant'), lc(152, 'maximum-product-subarray', 'Maximum Product Subarray', 'similar'), lc(121, 'best-time-to-buy-and-sell-stock', 'Best Time to Buy and Sell Stock', 'similar')],
      drill: { prompt: 'Largest sum of any contiguous, non-empty subarray.', pattern: 'greedy', why: 'Kadane: extend the running sum or restart when it goes negative (a DP with O(1) state).' },
    } },

    { problem: {
      id: 'jump-game', title: 'Jump Game', diff: 'medium',
      tags: ['reach frontier'],
      statement: M`
        You start at index 0 of «nums». Each element is the **maximum** jump length from that position. Return «true» if you can reach the last index.
      `,
      fn: { name: 'canJump', params: [['int[]', 'nums']], ret: 'boolean' },
      tests: [
        { args: [[2, 3, 1, 1, 4]], ex: true, expect: true },
        { args: [[3, 2, 1, 0, 4]], ex: true, expect: false, why: 'Every path lands on index 3, whose jump length is 0.' },
        { args: [[0]], expect: true, why: 'Already at the last index.' },
        { args: [[0, 1]], expect: false },
        { args: [[2, 0, 0]], expect: true },
        { args: [[1, 0, 1, 0]], expect: false },
        { args: [[5, 0, 0, 0, 0, 0]], expect: true },
        { args: [[1, 1, 2, 0, 0, 1]], expect: false },
        { args: [{ $gen: 'repeat', args: [100000, 1] }], big: true, expect: true },
        { args: [{ $gen: 'ints', args: [100000, 0, 3, 503] }], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁴ (large tests: 10⁵)', '0 ≤ nums[i] ≤ 10⁵'],
      hints: [
        'You don’t need to know *which* jumps to take, only how far you can possibly get.',
        'Walk left to right keeping «reach», the farthest index reachable so far. If i > reach, index i is unreachable.',
        'At each reachable i: «reach = max(reach, i + nums[i])». Return true once reach ≥ n − 1.',
      ],
      solution: {
        pattern: '**Reach frontier:** the set of reachable indices is always a prefix, so one number (its end) describes it.',
        intuition: M`
          If index j is reachable, every index before j is too (you passed through or jumped over them, and any shorter jump is allowed). So reachability is a prefix «[0, reach]». Scan it, extending reach with each «i + nums[i]». If the scan ever passes reach, you're stuck.
        `,
        java: J`class Solution {
    public boolean canJump(int[] nums) {
        int reach = 0;
        for (int i = 0; i < nums.length; i++) {
            if (i > reach) return false;              // stuck before i
            reach = Math.max(reach, i + nums[i]);
            if (reach >= nums.length - 1) return true;
        }
        return true;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - DFS or BFS over the jumps works but is O(n²) in the worst case.
          - Watch for «i + nums[i]» overflow if values could be near «Integer.MAX_VALUE» (not here).
        `,
        alts: [
          { name: 'Backwards: move the goal left', time: 'O(n)', space: 'O(1)', note: 'Scan from the end. If index i can jump to the current goal, i becomes the new goal. Answer: goal == 0.',
            java: J`class Solution {
    public boolean canJump(int[] nums) {
        int goal = nums.length - 1;
        for (int i = nums.length - 2; i >= 0; i--)
            if (i + nums[i] >= goal) goal = i;
        return goal == 0;
    }
}` },
          { name: 'DP: good[i] from the right', time: 'O(n · max jump)', space: 'O(n)', java: J`class Solution {
    public boolean canJump(int[] nums) {
        int n = nums.length;
        boolean[] good = new boolean[n];
        good[n - 1] = true;
        for (int i = n - 2; i >= 0; i--)
            for (int j = i + 1; j <= Math.min(n - 1, i + nums[i]) && !good[i]; j++)
                good[i] = good[j];
        return good[0];
    }
}` },
        ],
        talk: 'Reachable indices form a prefix. Scan while tracking the farthest reach = max(reach, i + nums[i]). If i ever exceeds reach, return false. O(n), O(1).',
      },
      viz: { id: 'jumpReach' },
      lc: [lc(55, 'jump-game', 'Jump Game', 'same'), lc(45, 'jump-game-ii', 'Jump Game II', 'harder'), lc(1306, 'jump-game-iii', 'Jump Game III', 'variant'), lc(1871, 'jump-game-vii', 'Jump Game VII', 'harder')],
      drill: { prompt: 'Each cell gives a max jump length. Can you get from the first index to the last?', pattern: 'greedy', why: 'Reach frontier: track the farthest reachable index in one pass.' },
    } },

    { problem: {
      id: 'jump-game-ii', title: 'Jump Game II (Fewest Jumps)', diff: 'medium',
      tags: ['reach frontier', 'implicit BFS'],
      statement: M`
        Same setup as Jump Game, but the last index is **guaranteed** reachable. Return the **minimum number of jumps** to reach it.
      `,
      fn: { name: 'jump', params: [['int[]', 'nums']], ret: 'int' },
      tests: [
        { args: [[2, 3, 1, 1, 4]], ex: true, expect: 2, why: '0 → 1 → 4.' },
        { args: [[2, 3, 0, 1, 4]], ex: true, expect: 2 },
        { args: [[0]], expect: 0 },
        { args: [[1, 2]], expect: 1 },
        { args: [[1, 1, 1, 1]], expect: 3 },
        { args: [[10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 0]], expect: 2, why: 'Index 0 reaches index 10 at most; one more jump is needed.' },
        { args: [[1, 2, 1, 1, 1]], expect: 3 },
        { args: [{ $gen: 'repeat', args: [100000, 1] }], big: true, expect: 99999 },
        { args: [{ $gen: 'ints', args: [100000, 1, 6, 504] }], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁴ (large tests: 10⁵)', '0 ≤ nums[i] ≤ 1000', 'The last index is reachable'],
      hints: [
        'Think of BFS: level 0 is index 0; level k is every index first reachable with k jumps.',
        'Each level is a contiguous range. The next level ends at the farthest «i + nums[i]» over the current level.',
        'Track «curEnd» (end of the current level) and «farthest». When i reaches curEnd, you must jump: «jumps++, curEnd = farthest».',
      ],
      solution: {
        pattern: '**BFS by levels on an implicit graph, without a queue:** each level is an index range, so two numbers describe it.',
        intuition: M`
          All indices reachable in exactly k jumps form a contiguous block, just past the block for k − 1. Scan the current block, computing how far the next block extends. When you reach the end of the current block you have to take another jump, and the farthest point seen becomes the new boundary. This is BFS where the frontier is an interval.
        `,
        java: J`class Solution {
    public int jump(int[] nums) {
        int jumps = 0, curEnd = 0, farthest = 0;
        for (int i = 0; i < nums.length - 1; i++) {      // no jump needed from the last index
            farthest = Math.max(farthest, i + nums[i]);
            if (i == curEnd) {                           // end of this BFS level
                jumps++;
                curEnd = farthest;
            }
        }
        return jumps;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - Looping to «n − 1» inclusive counts one extra jump when curEnd lands exactly on the last index.
          - Greedily jumping to the *largest* nums value in range isn't the same thing. Choose by farthest «i + nums[i]», not by the value.
        `,
        alts: [
          { name: 'DP over positions', time: 'O(n · max jump)', space: 'O(n)', java: J`class Solution {
    public int jump(int[] nums) {
        int n = nums.length;
        int[] dp = new int[n];
        Arrays.fill(dp, Integer.MAX_VALUE);
        dp[0] = 0;
        for (int i = 0; i < n; i++) {
            if (dp[i] == Integer.MAX_VALUE) continue;
            for (int j = i + 1; j <= Math.min(n - 1, i + nums[i]); j++)
                dp[j] = Math.min(dp[j], dp[i] + 1);
        }
        return dp[n - 1];
    }
}` },
        ],
        talk: 'Implicit BFS: indices reachable with k jumps form a contiguous range. Scan while tracking the farthest reach; when i hits the current range end, jump++ and extend to farthest. Stop before the last index. O(n), O(1).',
      },
      viz: { id: 'jumpReach', input: { nums: [2, 3, 1, 1, 4, 2, 1, 1, 0] } },
      lc: [lc(45, 'jump-game-ii', 'Jump Game II', 'same'), lc(1024, 'video-stitching', 'Video Stitching', 'variant'), lc(1326, 'minimum-number-of-taps-to-open-to-water-a-garden', 'Minimum Number of Taps to Open to Water a Garden', 'harder')],
      drill: { prompt: 'Minimum number of jumps to reach the last index (max jump length given per cell).', pattern: 'greedy', why: 'BFS by levels where each level is a contiguous range: track the current end and the farthest reach.' },
    } },

    { problem: {
      id: 'gas-station', title: 'Gas Station', diff: 'medium',
      tags: ['running value with a reset'],
      statement: M`
        There are «n» gas stations on a circular route. Station «i» has «gas[i]» fuel, and driving from «i» to «i + 1» costs «cost[i]». With an empty tank, return the index of a station you can start from to travel around the circuit once clockwise, or «−1» if none exists. (On LeetCode the answer is unique; here, any valid start is accepted.)
      `,
      fn: { name: 'canCompleteCircuit', params: [['int[]', 'gas'], ['int[]', 'cost']], ret: 'int' },
      validate: gasValidate,
      tests: [
        { args: [[1, 2, 3, 4, 5], [3, 4, 5, 1, 2]], ex: true, expect: 3 },
        { args: [[2, 3, 4], [3, 4, 3]], ex: true, expect: -1 },
        { args: [[5], [4]], expect: 0 },
        { args: [[4], [5]], expect: -1 },
        { args: [[3, 1, 1], [1, 2, 2]], expect: 0 },
        { args: [[5, 1, 2, 3, 4], [4, 4, 1, 5, 1]], expect: 4 },
        { args: [[1, 1, 1, 10], [2, 2, 2, 7]], expect: 3 },
        { args: GAS_MID, big: true },
        { args: [{ $gen: 'ints', args: [100000, 0, 9000, 505] }, { $gen: 'ints', args: [100000, 1000, 10000, 506] }], big: true, expect: -1 },
      ],
      constraints: ['1 ≤ n ≤ 10⁵', '0 ≤ gas[i], cost[i] ≤ 10⁴'],
      hints: [
        'If total gas < total cost, no start can work. Is the converse true?',
        'Simulate from a start s. If the tank goes negative leaving station i, then **no station between s and i** can be a valid start either. Why?',
        'So restart at i + 1 with an empty tank. One pass: track the running tank, reset the start on a deficit, and check the total at the end.',
      ],
      solution: {
        pattern: '**Running value with a reset (Kadane-style):** a failed stretch rules out every start inside it.',
        intuition: M`
          Suppose you start at s and first run dry leaving station i. Every intermediate station k in (s, i] was reached with a tank ≥ 0, so starting at k with an *empty* tank is no better, and you'd still run dry by i. So the next candidate is i + 1. After one pass, the last candidate is valid if the total surplus is ≥ 0: the stretch from the candidate to the end is non-negative, and the total covers the deficit before it.
        `,
        java: J`class Solution {
    public int canCompleteCircuit(int[] gas, int[] cost) {
        int total = 0, tank = 0, start = 0;
        for (int i = 0; i < gas.length; i++) {
            int diff = gas[i] - cost[i];
            total += diff;
            tank += diff;
            if (tank < 0) {           // can't leave station i starting from 'start' (or anything in between)
                start = i + 1;
                tank = 0;
            }
        }
        return total >= 0 ? start : -1;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - Returning «start» without checking the total: the last candidate may still fail on the wrap-around.
          - «start» can equal n only when the total is negative, which the final check handles.
        `,
        alts: [
          { name: 'Start after the minimum prefix', time: 'O(n)', space: 'O(1)', note: 'Plot the running surplus. Starting right after its lowest point keeps it ≥ 0 all the way round (if the total ≥ 0). The same answer, a geometric view.',
            java: J`class Solution {
    public int canCompleteCircuit(int[] gas, int[] cost) {
        int prefix = 0, minPrefix = 0, start = 0;
        for (int i = 0; i < gas.length; i++) {
            prefix += gas[i] - cost[i];
            if (prefix < minPrefix) { minPrefix = prefix; start = i + 1; }
        }
        return prefix < 0 ? -1 : start % gas.length;
    }
}` },
          { name: 'Try every start', time: 'O(n²)', space: 'O(1)', java: J`class Solution {
    public int canCompleteCircuit(int[] gas, int[] cost) {
        int n = gas.length;
        for (int s = 0; s < n; s++) {
            int tank = 0, k = 0;
            for (; k < n; k++) {
                int i = (s + k) % n;
                tank += gas[i] - cost[i];
                if (tank < 0) break;
            }
            if (k == n) return s;
        }
        return -1;
    }
}` },
        ],
        talk: 'If the total surplus is negative, return −1. Otherwise scan once with a running tank. When it goes negative at i, no start in [start, i] works, so restart at i+1. The final start is valid because the total is non-negative. O(n), O(1).',
      },
      lc: [lc(134, 'gas-station', 'Gas Station', 'same'), lc(53, 'maximum-subarray', 'Maximum Subarray', 'similar'), lc(2202, 'maximize-the-topmost-element-after-k-moves', 'Maximize the Topmost Element After K Moves', 'similar')],
      drill: { prompt: 'Circular route with gas and costs per station. Find a start that lets you complete the loop.', pattern: 'greedy', why: 'One pass with a reset: a deficit at i rules out every start up to i; the total decides feasibility.' },
    } },

    { problem: {
      id: 'partition-labels', title: 'Partition Labels', diff: 'medium',
      tags: ['last occurrence', 'extend the boundary'],
      statement: M`
        Split string «s» into as many parts as possible so that **each letter appears in at most one part**. Return the sizes of the parts, in order.
      `,
      fn: { name: 'partitionLabels', params: [['String', 's']], ret: 'List<Integer>' },
      tests: [
        { args: ['ababcbacadefegdehijhklij'], ex: true, expect: [9, 7, 8], why: '"ababcbaca", "defegde", "hijhklij".' },
        { args: ['eccbbbbdec'], ex: true, expect: [10] },
        { args: ['a'], expect: [1] },
        { args: ['abc'], expect: [1, 1, 1] },
        { args: ['abca'], expect: [4] },
        { args: ['caedbdedda'], expect: [1, 9] },
        { args: ['aabbccab'], expect: [8] },
        { args: [Array.from({ length: 26 }, (_, k) => String.fromCharCode(97 + k).repeat(1000)).join('')], big: true },
        { args: [{ $gen: 'str', args: [100000, 'abcdefghijklmnopqrstuvwxyz', 507] }], big: true, expect: [100000] },
      ],
      constraints: ['1 ≤ s.length ≤ 500 (large tests: 10⁵)', 'Lowercase English letters'],
      hints: [
        'The part containing the first character must extend at least to that character’s last occurrence.',
        'Precompute «last[c]». Walk the string, extending the current part’s end to «last[s[i]]».',
        'When i reaches the current end, nothing inside needs to go further: cut there.',
      ],
      solution: {
        pattern: '**Extend the boundary to the last occurrence:** a segment closes once every letter in it has had its final appearance.',
        intuition: M`
          A part that contains letter c must contain *every* c, so it reaches at least «last[c]». Start a part at i, keep extending its end to cover the last occurrence of each letter you meet, and cut as soon as you're standing on the end. Cutting at the earliest possible point is what maximizes the number of parts.
        `,
        java: J`class Solution {
    public List<Integer> partitionLabels(String s) {
        int[] last = new int[26];
        for (int i = 0; i < s.length(); i++) last[s.charAt(i) - 'a'] = i;
        List<Integer> sizes = new ArrayList<>();
        int start = 0, end = 0;
        for (int i = 0; i < s.length(); i++) {
            end = Math.max(end, last[s.charAt(i) - 'a']);
            if (i == end) {                       // everything inside finishes here
                sizes.add(end - start + 1);
                start = i + 1;
            }
        }
        return sizes;
    }
}`,
        time: 'O(n)', space: 'O(1) (26 counters)',
        pitfalls: M`
          - Cutting when a letter's *count* hits zero works too, but it needs a remaining-count array and careful bookkeeping of all open letters.
          - This is the merge-intervals idea in disguise: each letter spans [first, last], and the parts are the merged blocks.
        `,
        alts: [
          { name: 'Merge the letter intervals', time: 'O(n)', space: 'O(1)', note: 'Each letter covers [first, last]. Sorted by first occurrence, merge overlapping spans; each merged block is one part.',
            java: J`class Solution {
    public List<Integer> partitionLabels(String s) {
        int[] first = new int[26], last = new int[26];
        Arrays.fill(first, -1);
        for (int i = 0; i < s.length(); i++) { int c = s.charAt(i) - 'a'; if (first[c] < 0) first[c] = i; last[c] = i; }
        List<int[]> spans = new ArrayList<>();
        for (int c = 0; c < 26; c++) if (first[c] >= 0) spans.add(new int[]{first[c], last[c]});
        spans.sort((a, b) -> Integer.compare(a[0], b[0]));
        List<Integer> res = new ArrayList<>();
        int st = spans.get(0)[0], en = spans.get(0)[1];
        for (int[] sp : spans) {
            if (sp[0] > en) { res.add(en - st + 1); st = sp[0]; en = sp[1]; }
            else en = Math.max(en, sp[1]);
        }
        res.add(en - st + 1);
        return res;
    }
}` },
        ],
        talk: 'Record each letter’s last index. Scan, extending the current end to last[c]. When i == end, close the part (its size is end − start + 1). O(n) time, O(1) space.',
      },
      lc: [lc(763, 'partition-labels', 'Partition Labels', 'same'), lc(56, 'merge-intervals', 'Merge Intervals', 'similar'), lc(2405, 'optimal-partition-of-string', 'Optimal Partition of String', 'variant')],
      drill: { prompt: 'Cut a string into the most pieces such that no letter appears in two pieces.', pattern: 'greedy', why: 'Extend the current piece to the last occurrence of every letter in it; cut when you reach the end.' },
    } },

    { problem: {
      id: 'hand-of-straights', title: 'Hand of Straights', diff: 'medium',
      tags: ['smallest first', 'TreeMap'],
      statement: M`
        Can the cards in «hand» be rearranged into groups of exactly «groupSize» cards, each group being **consecutive** values? Return «true» or «false».
      `,
      fn: { name: 'isNStraightHand', params: [['int[]', 'hand'], ['int', 'groupSize']], ret: 'boolean' },
      tests: [
        { args: [[1, 2, 3, 6, 2, 3, 4, 7, 8], 3], ex: true, expect: true, why: '[1,2,3], [2,3,4], [6,7,8].' },
        { args: [[1, 2, 3, 4, 5], 4], ex: true, expect: false },
        { args: [[1], 1], expect: true },
        { args: [[1, 1, 2, 2, 3, 3], 3], expect: true },
        { args: [[1, 1, 2, 3], 2], expect: false },
        { args: [[8, 10, 12], 3], expect: false },
        { args: [[1, 2, 3, 3, 4, 4, 5, 6], 4], expect: true },
        { args: [[5, 1], 2], expect: false },
        { args: [{ $gen: 'range', args: [100000, 1, 1] }, 4], big: true, expect: true },
        { args: [{ $gen: 'pyramid', args: [300, 514] }, 3], big: true },
        { args: [{ $gen: 'ints', args: [99999, 0, 1000000000, 508] }, 3], big: true },
      ],
      constraints: ['1 ≤ hand.length ≤ 10⁴ (large tests: 10⁵)', '0 ≤ hand[i] ≤ 10⁹', '1 ≤ groupSize ≤ hand.length'],
      hints: [
        'Look at the smallest card. Which group can it belong to?',
        'It must be the **start** of a group, since nothing smaller is left to precede it. So that group is fixed: min, min+1, …, min+groupSize−1.',
        'Keep counts in a «TreeMap». Repeatedly take the smallest key and remove one of each value in its run; fail if any is missing.',
      ],
      solution: {
        pattern: '**Smallest first:** the minimum remaining card has no choice, so it starts a group. Use a sorted count map.',
        intuition: 'The smallest remaining card can’t be in the middle or at the end of a group, because that would need a smaller card. So forming the group that starts there is forced, not a guess. Repeat until the cards run out or a needed card is missing.',
        java: J`class Solution {
    public boolean isNStraightHand(int[] hand, int groupSize) {
        if (hand.length % groupSize != 0) return false;
        TreeMap<Integer, Integer> count = new TreeMap<>();
        for (int c : hand) count.merge(c, 1, Integer::sum);
        while (!count.isEmpty()) {
            int first = count.firstKey();                 // must start a group
            for (int v = first; v < first + groupSize; v++) {
                Integer k = count.get(v);
                if (k == null) return false;              // gap in the run
                if (k == 1) count.remove(v); else count.put(v, k - 1);
            }
        }
        return true;
    }
}`,
        time: 'O(n log n)', space: 'O(n)',
        pitfalls: M`
          - Check «n % groupSize» first. It's a cheap early exit.
          - Using «count.get(v) == 1» on Integer objects works, but comparing two Integer objects with «==» does not (above 127). Unbox first.
        `,
        alts: [
          { name: 'Sort + HashMap counts', time: 'O(n log n)', space: 'O(n)', note: 'Sort the array. For each card in order with a positive count, start a run there.',
            java: J`class Solution {
    public boolean isNStraightHand(int[] hand, int groupSize) {
        if (hand.length % groupSize != 0) return false;
        Arrays.sort(hand);
        Map<Integer, Integer> count = new HashMap<>();
        for (int c : hand) count.merge(c, 1, Integer::sum);
        for (int c : hand) {
            if (count.get(c) == 0) continue;
            for (int v = c; v < c + groupSize; v++) {
                int k = count.getOrDefault(v, 0);
                if (k == 0) return false;
                count.put(v, k - 1);
            }
        }
        return true;
    }
}` },
          { name: 'Count "open runs" in one sweep', time: 'O(n log n)', space: 'O(n)', check: false, note: 'Walk distinct values in order, tracking how many runs are open and when they close (a queue of how many runs started at each value). Avoids repeated decrements: O(distinct values) after sorting.' },
        ],
        talk: 'The smallest remaining card must start a group, so the choice is forced. Counts go in a TreeMap: take firstKey, decrement first..first+k−1, fail on a gap. O(n log n).',
      },
      lc: [lc(846, 'hand-of-straights', 'Hand of Straights', 'same'), lc(1296, 'divide-array-in-sets-of-k-consecutive-numbers', 'Divide Array in Sets of K Consecutive Numbers', 'same'), lc(659, 'split-array-into-consecutive-subsequences', 'Split Array into Consecutive Subsequences', 'harder')],
      drill: { prompt: 'Can the cards be grouped into runs of k consecutive values?', pattern: 'greedy', why: 'The smallest remaining card must start a run: a TreeMap of counts, consumed from the smallest.' },
    } },

    { lesson: 'intervals', title: 'Intervals: sort by the right key, then sweep', mins: 14,
      lede: 'One overlap test, three sort orders, and four templates (merge, schedule, count concurrent, insert) cover nearly every interval question.',
      body: M`
        ## The overlap test
        Intervals «[a, b]» and «[c, d]» overlap iff **each starts before the other ends**:

        ~~~java overlap
        boolean overlap = a < d && c < b;      // half-open: [1,3] and [3,5] just touch (no overlap)
        boolean overlapIncl = a <= d && c <= b; // closed:    [1,3] and [3,5] share the point 3
        ~~~

        The problem statement decides whether touching counts. Meeting rooms: a meeting ending at 10 frees the room for one starting at 10. Balloons: an arrow at x = 3 bursts both [1,3] and [3,5]. Read carefully and say it out loud.

        ## Which sort key?
        | Goal | Sort by | Why |
        |---|---|---|
        | Merge overlaps, total coverage, insert | **start** | overlapping intervals become neighbours |
        | Most non-overlapping, fewest removals, fewest arrows | **end** | finishing earliest leaves the most room (exchange argument) |
        | Maximum concurrency / rooms needed | starts and ends **separately**, or start + min-heap of ends | only the count of open intervals matters |

        ## Template 1: merge (sort by start)
        @viz mergeIntervals

        ~~~java merge
        Arrays.sort(iv, (x, y) -> Integer.compare(x[0], y[0]));
        List<int[]> out = new ArrayList<>();
        for (int[] cur : iv) {
            if (out.isEmpty() || out.get(out.size() - 1)[1] < cur[0]) out.add(cur);   // gap
            else out.get(out.size() - 1)[1] = Math.max(out.get(out.size() - 1)[1], cur[1]);
        }
        return out.toArray(new int[0][]);
        ~~~

        ## Template 2: interval scheduling (sort by end)
        Keep an interval if it starts at or after the end of the last kept one. This maximizes the number kept, so "minimum removals" is n minus that, and "minimum arrows" is the same count with an inclusive overlap test.

        :::key Why earliest end?
        Take any optimal selection. Its first interval ends no earlier than the earliest-ending interval overall, so swapping that one in can't create a conflict. Repeat for the rest. An interval that *starts* earliest might be huge and block everything.
        :::

        ## Template 3: how many overlap at once (rooms)
        @viz meetingRooms

        Sort by start and keep a min-heap of end times for rooms in use. For each meeting, free the earliest-ending room if it's already done, then push this meeting's end. The heap's peak size is the answer. Or sort starts and ends separately and sweep with two pointers: +1 at a start, −1 at an end. For small coordinates, the difference-array trick from «car pooling» gives the same counts.

        ## Template 4: insert into a sorted, disjoint list
        Three phases in one pass: copy everything that ends before the new interval starts; absorb everything that overlaps (take min start, max end); copy the rest. No sort needed, O(n).

        ## Java specifics that bite
        - **Comparator overflow:** «(x, y) -> x[0] - y[0]» breaks when values span more than 2³¹ (e.g. −2³¹ and 2³¹−1). Use «Integer.compare» or «Comparator.comparingInt(x -> x[0])».
        - «List<int[]>» to «int[][]»: «list.toArray(new int[0][])».
        - Mutating «out.get(last)[1]» changes the int[] inside the list in place, which is what you want here.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'To find the maximum number of non-overlapping intervals, what should you sort by?',
          options: ['Start time', 'End time', 'Length', 'It doesn’t matter'],
          answer: 1, why: 'Earliest end leaves the most room for the rest (the exchange argument). Sorting by start fails on [[1,100],[2,3],[4,5]]: taking [1,100] first blocks the other two.' },
        { q: 'Why is «(a, b) -> a[0] − b[0]» risky as a comparator?',
          options: ['It is slower', 'The subtraction can overflow int for widely spread values, producing the wrong sign', 'Arrays.sort rejects it', 'It sorts in descending order'],
          answer: 1, why: 'For a[0] = 2³¹−1 and b[0] = −1 the difference overflows to a negative number, so the order flips. Integer.compare(a[0], b[0]) is always safe.' },
      ],
      practice: ['merge-intervals', 'insert-interval', 'non-overlapping-intervals', 'min-meeting-rooms', 'min-arrows', 'car-pooling'],
    },

    { problem: {
      id: 'merge-intervals', title: 'Merge Intervals', diff: 'medium',
      tags: ['sort by start'],
      statement: M`
        Given an array of «intervals» «[start, end]», merge all overlapping intervals (touching counts, so [1,4] and [4,5] merge) and return the non-overlapping result **sorted by start**.
      `,
      fn: { name: 'merge', params: [['int[][]', 'intervals']], ret: 'int[][]' },
      tests: [
        { args: [[[1, 3], [2, 6], [8, 10], [15, 18]]], ex: true, expect: [[1, 6], [8, 10], [15, 18]] },
        { args: [[[1, 4], [4, 5]]], ex: true, expect: [[1, 5]] },
        { args: [[[1, 4]]], expect: [[1, 4]] },
        { args: [[[1, 4], [0, 4]]], expect: [[0, 4]] },
        { args: [[[1, 4], [2, 3]]], expect: [[1, 4]], why: 'A contained interval: the end must be max(ends), not the last end.' },
        { args: [[[5, 6], [1, 2], [3, 4]]], expect: [[1, 2], [3, 4], [5, 6]] },
        { args: [[[2, 3], [4, 5], [6, 7], [8, 9], [1, 10]]], expect: [[1, 10]] },
        { args: [{ $gen: 'intervals', args: [100000, 0, 10000000, 200, 509] }], big: true },
        { args: [{ $gen: 'intervals', args: [100000, 0, 100000, 50, 510] }], big: true },
      ],
      constraints: ['1 ≤ intervals.length ≤ 10⁴ (large tests: 10⁵)', '0 ≤ start ≤ end'],
      hints: [
        'If the intervals were sorted by start, where would overlapping ones be?',
        'Adjacent. Sort by start, then sweep, comparing each interval with the last merged one.',
        'Overlap if «cur.start ≤ last.end», then «last.end = max(last.end, cur.end)». Otherwise start a new block.',
      ],
      solution: {
        pattern: '**Sort by start, then sweep:** overlaps become adjacent, so one comparison with the last block suffices.',
        intuition: 'After sorting by start, an interval either overlaps the most recent merged block (it starts before that block ends) or begins a new block. Nothing earlier can matter, because every earlier block ended before this block started.',
        java: J`class Solution {
    public int[][] merge(int[][] intervals) {
        Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));
        List<int[]> out = new ArrayList<>();
        for (int[] cur : intervals) {
            if (out.isEmpty() || out.get(out.size() - 1)[1] < cur[0]) out.add(new int[]{cur[0], cur[1]});
            else {
                int[] last = out.get(out.size() - 1);
                last[1] = Math.max(last[1], cur[1]);      // max: cur might be contained
            }
        }
        return out.toArray(new int[0][]);
    }
}`,
        time: 'O(n log n)', space: 'O(n) (output, plus the sort)',
        pitfalls: M`
          - «last[1] = cur[1]» instead of max breaks on a contained interval like [1,10], [2,3].
          - Deciding whether touching intervals merge: here «<» means [1,4] and [4,5] merge.
        `,
        alts: [
          { name: 'Sort starts and ends separately', time: 'O(n log n)', space: 'O(n)', note: 'A block ends at index i when starts[i+1] > ends[i]. Works because only the sorted multisets of starts and ends matter.',
            java: J`class Solution {
    public int[][] merge(int[][] iv) {
        int n = iv.length;
        int[] s = new int[n], e = new int[n];
        for (int i = 0; i < n; i++) { s[i] = iv[i][0]; e[i] = iv[i][1]; }
        Arrays.sort(s); Arrays.sort(e);
        List<int[]> out = new ArrayList<>();
        for (int i = 0, j = 0; i < n; i++)
            if (i == n - 1 || s[i + 1] > e[i]) { out.add(new int[]{s[j], e[i]}); j = i + 1; }
        return out.toArray(new int[0][]);
    }
}` },
        ],
        followups: M`
          - **Streaming intervals:** keep a «TreeMap<start, end>» and merge with floorKey/ceilingKey on insert (LeetCode 352, «Data Stream as Disjoint Intervals»).
          - **Total covered length:** merge, then sum the block lengths.
        `,
        talk: 'Sort by start; sweep comparing with the last merged block. Overlap (start ≤ last end) extends it to max(end); otherwise start a new block. O(n log n) for the sort.',
      },
      viz: { id: 'mergeIntervals' },
      lc: [lc(56, 'merge-intervals', 'Merge Intervals', 'same'), lc(57, 'insert-interval', 'Insert Interval', 'variant'), lc(986, 'interval-list-intersections', 'Interval List Intersections', 'similar'), lc(352, 'data-stream-as-disjoint-intervals', 'Data Stream as Disjoint Intervals', 'harder')],
      drill: { prompt: 'Combine all overlapping ranges into disjoint ranges.', pattern: 'intervals', why: 'Sort by start; each interval overlaps the last merged block or starts a new one.' },
    } },

    { problem: {
      id: 'insert-interval', title: 'Insert Interval', diff: 'medium',
      tags: ['three phases', 'no sort'],
      statement: M`
        «intervals» is sorted by start and non-overlapping. Insert «newInterval», merging where necessary (touching counts as overlap), and return the result, still sorted and non-overlapping.
      `,
      fn: { name: 'insert', params: [['int[][]', 'intervals'], ['int[]', 'newInterval']], ret: 'int[][]' },
      tests: [
        { args: [[[1, 3], [6, 9]], [2, 5]], ex: true, expect: [[1, 5], [6, 9]] },
        { args: [[[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8]], ex: true, expect: [[1, 2], [3, 10], [12, 16]] },
        { args: [[], [5, 7]], expect: [[5, 7]] },
        { args: [[[1, 5]], [2, 3]], expect: [[1, 5]] },
        { args: [[[1, 5]], [6, 8]], expect: [[1, 5], [6, 8]] },
        { args: [[[3, 5]], [0, 1]], expect: [[0, 1], [3, 5]] },
        { args: [[[1, 5]], [5, 7]], expect: [[1, 7]] },
        { args: [[[1, 2], [4, 5], [7, 8]], [0, 10]], expect: [[0, 10]] },
        { args: [Array.from({ length: 4000 }, (_, i) => [4 * i, 4 * i + 2]), [2001, 8003]], big: true },
      ],
      constraints: ['0 ≤ intervals.length ≤ 10⁴', 'intervals sorted by start, non-overlapping', '0 ≤ start ≤ end ≤ 10⁵'],
      hints: [
        'You could append and run Merge Intervals (O(n log n)), but the input is already sorted.',
        'Three groups: intervals entirely before the new one, those overlapping it, those entirely after.',
        'Copy «end < new.start»; then while «start ≤ new.end», grow the new interval (min start, max end); add it; copy the rest.',
      ],
      solution: {
        pattern: '**Three-phase sweep:** before / overlapping / after, with no sort needed because the input is sorted.',
        intuition: 'Because the list is sorted and disjoint, the intervals overlapping the new one form one contiguous stretch. Everything before it ends before the new start, and everything after it starts after the new end. Merge the stretch into one interval.',
        java: J`class Solution {
    public int[][] insert(int[][] intervals, int[] newInterval) {
        List<int[]> out = new ArrayList<>();
        int i = 0, n = intervals.length;
        int s = newInterval[0], e = newInterval[1];
        while (i < n && intervals[i][1] < s) out.add(intervals[i++]);       // 1. entirely before
        while (i < n && intervals[i][0] <= e) {                             // 2. overlapping: absorb
            s = Math.min(s, intervals[i][0]);
            e = Math.max(e, intervals[i][1]);
            i++;
        }
        out.add(new int[]{s, e});
        while (i < n) out.add(intervals[i++]);                              // 3. entirely after
        return out.toArray(new int[0][]);
    }
}`,
        time: 'O(n)', space: 'O(n) (output)',
        pitfalls: M`
          - Getting the phase conditions right: before means «end < newStart»; overlap means «start ≤ newEnd» (touching merges).
          - The empty input must still return the new interval.
        `,
        alts: [
          { name: 'Append + merge', time: 'O(n log n)', space: 'O(n)', java: J`class Solution {
    public int[][] insert(int[][] intervals, int[] newInterval) {
        int[][] all = Arrays.copyOf(intervals, intervals.length + 1);
        all[intervals.length] = newInterval;
        Arrays.sort(all, (a, b) -> Integer.compare(a[0], b[0]));
        List<int[]> out = new ArrayList<>();
        for (int[] cur : all) {
            if (out.isEmpty() || out.get(out.size() - 1)[1] < cur[0]) out.add(new int[]{cur[0], cur[1]});
            else out.get(out.size() - 1)[1] = Math.max(out.get(out.size() - 1)[1], cur[1]);
        }
        return out.toArray(new int[0][]);
    }
}` },
          { name: 'Binary search the boundaries', time: 'O(log n) to locate + O(n) to copy', space: 'O(n)', check: false, note: 'Find the first interval with end ≥ s and the last with start ≤ e by binary search. Useful when the structure is a TreeMap and copying isn’t needed.' },
        ],
        talk: 'The input is sorted, so do one pass in three phases: copy intervals ending before the new start, absorb overlapping ones (min start, max end), append the merged interval, copy the rest. O(n).',
      },
      lc: [lc(57, 'insert-interval', 'Insert Interval', 'same'), lc(56, 'merge-intervals', 'Merge Intervals', 'similar'), lc(715, 'range-module', 'Range Module', 'harder')],
      drill: { prompt: 'Insert a new range into a sorted list of disjoint ranges, merging as needed.', pattern: 'intervals', why: 'Three phases (before, overlapping, after) in one pass; no sort needed.' },
    } },

    { problem: {
      id: 'non-overlapping-intervals', title: 'Non-overlapping Intervals', diff: 'medium',
      tags: ['sort by end', 'interval scheduling'],
      statement: M`
        Return the **minimum number of intervals to remove** so that the rest don't overlap. Intervals that only touch, like [1,2] and [2,3], do **not** overlap.
      `,
      fn: { name: 'eraseOverlapIntervals', params: [['int[][]', 'intervals']], ret: 'int' },
      tests: [
        { args: [[[1, 2], [2, 3], [3, 4], [1, 3]]], ex: true, expect: 1 },
        { args: [[[1, 2], [1, 2], [1, 2]]], ex: true, expect: 2 },
        { args: [[[1, 2], [2, 3]]], ex: true, expect: 0 },
        { args: [[[1, 100], [11, 22], [1, 11], [2, 12]]], expect: 2 },
        { args: [[[0, 2], [1, 3], [2, 4], [3, 5], [4, 6]]], expect: 2 },
        { args: [[[1, 100], [2, 3], [4, 5], [6, 7]]], expect: 1, why: 'Remove the long one, keep the three short ones.' },
        { args: [[[-2147483648, 2147483647], [0, 1]]], expect: 1 },
        { args: [{ $gen: 'intervals', args: [100000, -50000, 50000, 1, 1000, 511] }], big: true },
      ],
      constraints: ['1 ≤ intervals.length ≤ 10⁵', 'start < end, values fit in int'],
      hints: [
        'Minimum removals = n − (maximum number you can keep without overlap).',
        'Which interval should you keep first? The one that **ends earliest**: it leaves the most room.',
        'Sort by end. Keep an interval if «start ≥ lastEnd»; otherwise it’s removed.',
      ],
      solution: {
        pattern: '**Interval scheduling: sort by end,** keep whatever fits after the last kept end.',
        intuition: M`
          Maximizing the number of kept intervals is the classic activity-selection problem. The interval with the earliest end is always safe to keep: in any optimal selection you can swap its first interval for this one without creating a conflict (exchange argument). Then repeat on what's left, which means sorting by end and scanning.
        `,
        java: J`class Solution {
    public int eraseOverlapIntervals(int[][] intervals) {
        Arrays.sort(intervals, (a, b) -> Integer.compare(a[1], b[1]));   // not a[1] - b[1]: overflow
        int kept = 0;
        long lastEnd = Long.MIN_VALUE;
        for (int[] iv : intervals)
            if (iv[0] >= lastEnd) { kept++; lastEnd = iv[1]; }            // touching is fine
        return intervals.length - kept;
    }
}`,
        time: 'O(n log n)', space: 'O(log n) (sort)',
        pitfalls: M`
          - Sorting by start and keeping the first one fails: [1,100] blocks everything.
          - A subtraction comparator overflows on the «[−2³¹, 2³¹−1]» test.
          - Initializing lastEnd to «Integer.MIN_VALUE» with «≥» is fine; with «>» it would wrongly reject an interval starting at MIN_VALUE. Using a long avoids thinking about it.
        `,
        alts: [
          { name: 'Sort by start, drop the longer on conflict', time: 'O(n log n)', space: 'O(log n)', note: 'When two intervals overlap, remove the one ending later (keep the smaller end). Equivalent, and a common way people remember it.',
            java: J`class Solution {
    public int eraseOverlapIntervals(int[][] iv) {
        Arrays.sort(iv, (a, b) -> Integer.compare(a[0], b[0]));
        int removed = 0, end = iv[0][1];
        for (int i = 1; i < iv.length; i++) {
            if (iv[i][0] < end) { removed++; end = Math.min(end, iv[i][1]); }
            else end = iv[i][1];
        }
        return removed;
    }
}` },
          { name: 'DP (LIS-style)', time: 'O(n²)', space: 'O(n)', check: false, note: 'Sort by start; dp[i] = most kept ending with interval i. Correct but slow. Useful to contrast with the greedy.' },
        ],
        talk: 'Minimum removals = n − max kept. Max kept is activity selection: sort by end and keep whatever starts at or after the last kept end. Earliest end leaves the most room (exchange argument). Use Integer.compare to avoid overflow. O(n log n).',
      },
      lc: [lc(435, 'non-overlapping-intervals', 'Non-overlapping Intervals', 'same'), lc(452, 'minimum-number-of-arrows-to-burst-balloons', 'Minimum Number of Arrows to Burst Balloons', 'variant'), lc(646, 'maximum-length-of-pair-chain', 'Maximum Length of Pair Chain', 'same'), lc(1235, 'maximum-profit-in-job-scheduling', 'Maximum Profit in Job Scheduling', 'harder')],
      drill: { prompt: 'Fewest intervals to delete so that the rest are pairwise non-overlapping.', pattern: 'intervals', why: 'Activity selection: sort by end, keep greedily, answer n − kept.' },
    } },

    { problem: {
      id: 'min-meeting-rooms', title: 'Meeting Rooms II', diff: 'medium',
      tags: ['min-heap of ends', 'sweep line'],
      statement: M`
        Given meeting times «intervals[i] = [start, end)», return the minimum number of conference rooms required. A meeting ending at time t frees its room for a meeting starting at t.
      `,
      fn: { name: 'minMeetingRooms', params: [['int[][]', 'intervals']], ret: 'int' },
      tests: [
        { args: [[[0, 30], [5, 10], [15, 20]]], ex: true, expect: 2 },
        { args: [[[7, 10], [2, 4]]], ex: true, expect: 1 },
        { args: [[[1, 5], [5, 10]]], expect: 1, why: 'Back to back: the room is reused.' },
        { args: [[[1, 10], [2, 9], [3, 8], [4, 7]]], expect: 4 },
        { args: [[[0, 1]]], expect: 1 },
        { args: [[[5, 8], [6, 8]]], expect: 2 },
        { args: [[[13, 15], [1, 13]]], expect: 1 },
        { args: [[[1, 3], [2, 4], [3, 5], [4, 6], [2, 3]]], expect: 3 },
        { args: [{ $gen: 'intervals', args: [100000, 0, 1000000, 1, 5000, 512] }], big: true },
      ],
      constraints: ['1 ≤ intervals.length ≤ 10⁴ (large test: 10⁵)', '0 ≤ start < end ≤ 10⁶'],
      hints: [
        'The answer is the maximum number of meetings in progress at the same moment.',
        'Sort by start. Keep a min-heap of end times for the rooms in use. Before placing a meeting, free the room that ends earliest if it has ended by now.',
        'Or sort all starts and all ends separately and sweep: a start before the next end needs a new room; otherwise a room is freed.',
      ],
      solution: {
        pattern: '**Count concurrent intervals:** sort by start plus a min-heap of end times (or a two-array sweep).',
        intuition: M`
          Process meetings in start order. The rooms in use are described by their end times. If the room that frees up earliest is free by this meeting's start, reuse it (pop and push the new end). Otherwise open a new room (push). The heap never shrinks below the peak concurrency, so its final size is the answer.
        `,
        java: J`class Solution {
    public int minMeetingRooms(int[][] intervals) {
        Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));
        PriorityQueue<Integer> ends = new PriorityQueue<>();      // end time of each room in use
        for (int[] m : intervals) {
            if (!ends.isEmpty() && ends.peek() <= m[0]) ends.poll();  // earliest room is free: reuse it
            ends.offer(m[1]);
        }
        return ends.size();
    }
}`,
        time: 'O(n log n)', space: 'O(n)',
        pitfalls: M`
          - Using «<» instead of «<=» for reuse counts back-to-back meetings as overlapping.
          - Freeing only one room per meeting is enough: the heap size then equals the number of rooms ever needed at once.
        `,
        alts: [
          { name: 'Chronological sweep (two sorted arrays)', time: 'O(n log n)', space: 'O(n)', note: 'Rooms needed = max over time of (starts so far − ends so far). With ties, process ends first (≤), which frees rooms for back-to-back meetings.',
            java: J`class Solution {
    public int minMeetingRooms(int[][] iv) {
        int n = iv.length;
        int[] s = new int[n], e = new int[n];
        for (int i = 0; i < n; i++) { s[i] = iv[i][0]; e[i] = iv[i][1]; }
        Arrays.sort(s); Arrays.sort(e);
        int rooms = 0, best = 0;
        for (int i = 0, j = 0; i < n; i++) {
            while (j < n && e[j] <= s[i]) { j++; rooms--; }
            rooms++;
            best = Math.max(best, rooms);
        }
        return best;
    }
}` },
          { name: 'Difference array / TreeMap of events', time: 'O(n log n)', space: 'O(n)', note: '+1 at each start, −1 at each end, in sorted key order. The running maximum is the answer. The same idea as car pooling.',
            java: J`class Solution {
    public int minMeetingRooms(int[][] iv) {
        TreeMap<Integer, Integer> delta = new TreeMap<>();
        for (int[] m : iv) { delta.merge(m[0], 1, Integer::sum); delta.merge(m[1], -1, Integer::sum); }
        int cur = 0, best = 0;
        for (int d : delta.values()) { cur += d; best = Math.max(best, cur); }
        return best;
    }
}` },
        ],
        talk: 'Rooms = peak concurrency. Sort by start and keep a min-heap of ends. If the earliest end ≤ this start, reuse that room; always push the new end. The final heap size is the answer. Or sweep sorted starts and ends. O(n log n).',
      },
      viz: { id: 'meetingRooms' },
      lc: [lc(253, 'meeting-rooms-ii', 'Meeting Rooms II', 'same', { premium: true }), lc(2406, 'divide-intervals-into-minimum-number-of-groups', 'Divide Intervals Into Minimum Number of Groups', 'variant'), lc(252, 'meeting-rooms', 'Meeting Rooms', 'easier', { premium: true }), lc(1094, 'car-pooling', 'Car Pooling', 'similar'), lc(1851, 'minimum-interval-to-include-each-query', 'Minimum Interval to Include Each Query', 'harder')],
      drill: { prompt: 'Minimum number of rooms so that no two overlapping meetings share one.', pattern: 'intervals', why: 'Peak concurrency: sort by start with a min-heap of end times, or sweep +1/−1 events.' },
    } },

    { problem: {
      id: 'min-arrows', title: 'Minimum Arrows to Burst Balloons', diff: 'medium',
      tags: ['sort by end', 'closed intervals'],
      statement: M`
        Balloons are horizontal ranges «[xstart, xend]» (closed). A vertical arrow shot at «x» bursts every balloon with «xstart ≤ x ≤ xend». Return the minimum number of arrows needed to burst all balloons.
      `,
      fn: { name: 'findMinArrowShots', params: [['int[][]', 'points']], ret: 'int' },
      tests: [
        { args: [[[10, 16], [2, 8], [1, 6], [7, 12]]], ex: true, expect: 2, why: 'Arrows at x = 6 and x = 11.' },
        { args: [[[1, 2], [3, 4], [5, 6], [7, 8]]], ex: true, expect: 4 },
        { args: [[[1, 2], [2, 3], [3, 4], [4, 5]]], ex: true, expect: 2, why: 'Touching balloons share a point: x = 2 and x = 4.' },
        { args: [[[1, 2]]], expect: 1 },
        { args: [[[-2147483646, -2147483645], [2147483646, 2147483647]]], expect: 2, why: 'A subtraction comparator overflows here.' },
        { args: [[[-2147483648, 2147483647], [0, 0], [5, 5]]], expect: 2 },
        { args: [[[1, 10], [2, 3], [4, 5], [6, 7]]], expect: 3 },
        { args: [{ $gen: 'intervals', args: [100000, -1000000000, 1000000000, 100000, 513] }], big: true },
      ],
      constraints: ['1 ≤ points.length ≤ 10⁵', '−2³¹ ≤ xstart ≤ xend ≤ 2³¹ − 1'],
      hints: [
        'An arrow can hit a set of balloons iff they all share a common point. So group balloons into the fewest groups with a common point.',
        'Sort by end. The first balloon must be hit by some arrow, and the best place for it is the balloon’s right edge (it covers the most later balloons).',
        'Shoot at the current end; skip all balloons with «start ≤ arrow»; shoot again at the next un-hit balloon’s end.',
      ],
      solution: {
        pattern: '**Interval scheduling with closed intervals:** sort by end, place each arrow at the end of the first balloon not yet hit.',
        intuition: 'The balloon ending earliest must be hit, and shooting at its right edge hits every balloon that overlaps it (all of them end later and start at or before that point). Shooting any further left can only hit fewer. Repeat for the balloons that remain.',
        java: J`class Solution {
    public int findMinArrowShots(int[][] points) {
        Arrays.sort(points, (a, b) -> Integer.compare(a[1], b[1]));   // Integer.compare: values span the full int range
        int arrows = 1;
        int arrow = points[0][1];
        for (int[] p : points)
            if (p[0] > arrow) {             // not hit by the current arrow (closed: start == arrow is hit)
                arrows++;
                arrow = p[1];
            }
        return arrows;
    }
}`,
        time: 'O(n log n)', space: 'O(log n) (sort)',
        pitfalls: M`
          - «a[1] − b[1]» overflows for balloons near ±2³¹, a case LeetCode specifically tests.
          - Closed intervals: use «>» (not «≥») for "not hit", so [1,2] and [2,3] share an arrow.
        `,
        alts: [
          { name: 'Sort by start, shrink the shared window', time: 'O(n log n)', space: 'O(log n)', note: 'Track the intersection of the current group: end = min(end, p.end). A balloon starting after it needs a new arrow.',
            java: J`class Solution {
    public int findMinArrowShots(int[][] pts) {
        Arrays.sort(pts, (a, b) -> Integer.compare(a[0], b[0]));
        int arrows = 1, end = pts[0][1];
        for (int i = 1; i < pts.length; i++) {
            if (pts[i][0] > end) { arrows++; end = pts[i][1]; }
            else end = Math.min(end, pts[i][1]);
        }
        return arrows;
    }
}` },
        ],
        talk: 'Sort by end (Integer.compare, because of overflow). Shoot at the first balloon’s end; every balloon starting at or before that point is hit. The next balloon starting after it needs a new arrow at its end. O(n log n).',
      },
      lc: [lc(452, 'minimum-number-of-arrows-to-burst-balloons', 'Minimum Number of Arrows to Burst Balloons', 'same'), lc(435, 'non-overlapping-intervals', 'Non-overlapping Intervals', 'variant'), lc(1288, 'remove-covered-intervals', 'Remove Covered Intervals', 'similar')],
      drill: { prompt: 'Fewest vertical lines so that every horizontal segment is crossed by at least one.', pattern: 'intervals', why: 'Sort by end and place each line at the end of the first uncovered segment.' },
    } },
  ],
});
})();

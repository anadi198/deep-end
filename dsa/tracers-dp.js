/* DSA Lab — tracers for dynamic programming, greedy, intervals and bits. */
(function () {
  'use strict';
  const V = window.DSAViz, add = V.add;

  /* ═════════════ DP 1-D ═════════════ */
  add('fibMemo', {
    title: 'Why memoization: the recursion tree of Fibonacci', sub: 'Naive recursion recomputes the same subproblems exponentially often; a memo computes each once.',
    inputs: [{ key: 'n', label: 'n', type: 'int', def: 6 }, { key: 'memo', label: 'memo? (yes/no)', type: 'str', def: 'yes' }],
    check: ({ n, memo }) => (n < 1 || n > 8 ? 'n between 1 and 8' : ['yes', 'no'].includes(memo) ? null : 'memo: yes or no'),
    code: `
long fib(int n, Long[] memo) {
    if (n <= 1) return n;
    if (memo[n] != null) return memo[n];          // already solved: reuse
    long r = fib(n - 1, memo) + fib(n - 2, memo);
    memo[n] = r;                                  // remember
    return r;
}`,
    run({ n, memo }, t) {
      const useMemo = memo === 'yes';
      const nodes = []; let id = 0; const known = {}; let calls = 0;
      const view = (cur) => [{ t: 'rtree', label: `calls so far: ${calls}`, nodes: nodes.map((x) => ({ ...x, cls: x.id === cur ? 'active' : x.cls })) }, { t: 'map', label: 'memo', e: Object.entries(known).map(([k, v]) => [`fib(${k})`, v]) }];
      const fib = (k, parent) => {
        calls++;
        const me = 'n' + id++;
        nodes.push({ id: me, parent, text: `f(${k})`, cls: '' });
        if (k <= 1) { nodes[nodes.length - 1].cls = 'done'; t.step(2, `f(${k}) is a base case: ${k}.`, view(me)); return k; }
        if (useMemo && known[k] !== undefined) { nodes.find((x) => x.id === me).cls = 'ok'; t.step(3, `f(${k}) is already in the memo (${known[k]}): no recursion below this node.`, view(me)); return known[k]; }
        t.step(4, `f(${k}) = f(${k - 1}) + f(${k - 2}): recurse.`, view(me));
        const r = fib(k - 1, me) + fib(k - 2, me);
        if (useMemo) known[k] = r;
        nodes.find((x) => x.id === me).cls = 'done';
        t.step(5, `f(${k}) = ${r}${useMemo ? ', stored in the memo' : ''}.`, view(me));
        return r;
      };
      const r = fib(n, null);
      t.step(6, useMemo ? `f(${n}) = ${r} in ${calls} calls, O(n). Each subproblem is solved once; green nodes are memo hits.` : `f(${n}) = ${r} in ${calls} calls, O(2ⁿ). The same subtrees appear over and over. Switch memo to "yes" to compare.`, view(null));
    },
  });

  add('houseRobberDP', {
    title: 'House robber: dp[i] = max(skip, take)', sub: 'The best loot from the first i houses either skips house i or takes it plus the best up to i − 2.',
    inputs: [{ key: 'nums', label: 'money', type: 'ints', def: [2, 7, 9, 3, 1, 4] }],
    check: ({ nums }) => (nums.length > 14 ? 'at most 14 houses' : null),
    code: `
int rob(int[] nums) {
    int prev2 = 0, prev1 = 0;                        // dp[i-2], dp[i-1]
    for (int x : nums) {
        int cur = Math.max(prev1, prev2 + x);        // skip house i, or take it
        prev2 = prev1;
        prev1 = cur;
    }
    return prev1;
}`,
    run({ nums }, t) {
      const dp = Array(nums.length).fill(null);
      const view = (i, c = {}) => [{ t: 'array', label: 'money', a: nums, ptr: i !== undefined ? { i } : {}, cls: i !== undefined ? { [i]: 'active' } : {} }, { t: 'array', label: 'dp[i] = best loot from houses 0..i', a: dp, cls: c }];
      t.step(2, 'dp[i] is the best total using houses 0..i with no two adjacent. Only the last two values are ever needed.', view());
      for (let i = 0; i < nums.length; i++) {
        const skip = i >= 1 ? dp[i - 1] : 0, take = (i >= 2 ? dp[i - 2] : 0) + nums[i];
        dp[i] = Math.max(skip, take);
        t.step(4, `House ${i}: skip it → ${skip}; take it → ${i >= 2 ? `dp[${i - 2}]` : '0'} + ${nums[i]} = ${take}. dp[${i}] = <b>${dp[i]}</b>.`, view(i, { [i]: 'ok', ...(i >= 1 ? { [i - 1]: skip >= take ? 'cmp' : '' } : {}), ...(i >= 2 ? { [i - 2]: take > skip ? 'cmp' : '' } : {}) }));
      }
      t.step(8, `Answer: ${dp[nums.length - 1]}. O(n) time, O(1) space with two rolling variables.`, view());
    },
  });

  add('coinChangeDP', {
    title: 'Coin change: fewest coins for every amount', sub: 'dp[a] = 1 + min over coins c of dp[a − c]. Build it up from 0.',
    inputs: [{ key: 'coins', label: 'coins', type: 'ints', def: [1, 3, 4] }, { key: 'amount', label: 'amount', type: 'int', def: 6 }],
    check: ({ coins, amount }) => (amount > 20 || amount < 0 ? 'amount 0–20' : coins.some((c) => c <= 0) ? 'positive coins' : null),
    code: `
int coinChange(int[] coins, int amount) {
    int[] dp = new int[amount + 1];
    Arrays.fill(dp, amount + 1);                     // "infinity"
    dp[0] = 0;
    for (int a = 1; a <= amount; a++)
        for (int c : coins)
            if (c <= a) dp[a] = Math.min(dp[a], dp[a - c] + 1);
    return dp[amount] > amount ? -1 : dp[amount];
}`,
    run({ coins, amount }, t) {
      const INF = amount + 1; const dp = Array(amount + 1).fill(INF); dp[0] = 0;
      const show = () => dp.map((v) => (v === INF ? '∞' : v));
      t.step(4, 'dp[0] = 0 (zero coins make 0); everything else starts at ∞.', [{ t: 'array', label: 'dp[amount]', a: show(), cls: { 0: 'ok' } }]);
      for (let a = 1; a <= amount; a++) {
        for (const c of coins) {
          if (c > a) continue;
          const cand = dp[a - c] + 1; const better = cand < dp[a];
          if (better) dp[a] = cand;
          t.step(7, `a = ${a}, coin ${c}: dp[${a - c}] + 1 = ${dp[a - c] >= INF ? '∞' : cand}${better ? ` → improves dp[${a}] to ${cand}` : ''}.`, [{ t: 'array', label: 'dp[amount]', a: show(), cls: { [a]: 'active', [a - c]: 'cmp' } }]);
        }
      }
      t.step(8, dp[amount] >= INF ? 'Amount unreachable → −1.' : `Fewest coins for ${amount}: <b>${dp[amount]}</b>. Greedy (largest coin first) could fail here: 6 = 4+1+1 is 3 coins, but 3+3 is 2. O(amount × coins).`, [{ t: 'array', label: 'dp[amount]', a: show(), cls: { [amount]: 'ok' } }]);
    },
  });

  add('lisTails', {
    title: 'LIS in O(n log n): patience sorting', sub: 'tails[k] = the smallest possible tail of an increasing subsequence of length k + 1. Binary-search where each number goes.',
    inputs: [{ key: 'nums', label: 'nums', type: 'ints', def: [10, 9, 2, 5, 3, 7, 101, 18, 4, 20] }],
    check: ({ nums }) => (nums.length > 16 ? 'at most 16 numbers' : null),
    code: `
int lengthOfLIS(int[] nums) {
    int[] tails = new int[nums.length];
    int len = 0;
    for (int x : nums) {
        int lo = 0, hi = len;                    // first tail >= x
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (tails[mid] >= x) hi = mid; else lo = mid + 1;
        }
        tails[lo] = x;                           // replace, or extend when lo == len
        if (lo == len) len++;
    }
    return len;
}`,
    run({ nums }, t) {
      const tails = [];
      nums.forEach((x, i) => {
        let lo = 0, hi = tails.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] >= x) hi = mid; else lo = mid + 1; }
        const extend = lo === tails.length;
        const old = tails[lo];
        tails[lo] = x;
        t.step(extend ? 12 : 11, extend ? `${x} is bigger than every tail: extend, so an increasing subsequence of length ${tails.length} now exists.` : `${x} replaces tail[${lo}] = ${old}: a length-${lo + 1} subsequence can now end with a smaller value (${x}), which is easier to extend later.`, [{ t: 'array', label: 'nums', a: nums, ptr: { i }, cls: { [i]: 'active' } }, { t: 'array', label: 'tails', a: tails.slice(), cls: { [lo]: extend ? 'ok' : 'cmp' } }]);
      });
      t.step(14, `LIS length = <b>${tails.length}</b>. Note that tails isn’t itself the subsequence, just the best tail for each length. O(n log n).`, [{ t: 'array', label: 'nums', a: nums }, { t: 'array', label: 'tails', a: tails.slice() }]);
    },
  });

  add('wordBreakDP', {
    title: 'Word break: can each prefix be segmented?', sub: 'dp[i] is true if some dictionary word ends at i and dp[start of that word] is true.',
    inputs: [{ key: 's', label: 's', type: 'str', def: 'applepenapple' }, { key: 'dict', label: 'dictionary', type: 'strs', def: ['apple', 'pen'] }],
    check: ({ s }) => (s.length > 20 ? 'at most 20 characters' : null),
    code: `
boolean wordBreak(String s, List<String> wordDict) {
    Set<String> dict = new HashSet<>(wordDict);
    boolean[] dp = new boolean[s.length() + 1];   // dp[i]: s[0..i) can be segmented
    dp[0] = true;
    for (int i = 1; i <= s.length(); i++)
        for (int j = 0; j < i; j++)
            if (dp[j] && dict.contains(s.substring(j, i))) { dp[i] = true; break; }
    return dp[s.length()];
}`,
    run({ s, dict }, t) {
      const D = new Set(dict); const dp = Array(s.length + 1).fill(false); dp[0] = true;
      const view = (i, j) => [{ t: 'array', label: 's', a: s.split(''), range: j !== undefined ? [j, i - 1] : undefined, cls: {} }, { t: 'array', label: 'dp[i] (prefix of length i segmentable?)', a: dp.map((x) => (x ? 'T' : 'F')), cls: { ...Object.fromEntries(dp.map((x, k) => [k, x ? 'ok' : ''])), ...(i !== undefined ? { [i]: 'active' } : {}), ...(j !== undefined ? { [j]: 'cmp' } : {}) } }];
      t.step(4, 'dp[0] = true: the empty prefix is trivially segmentable.', view());
      for (let i = 1; i <= s.length; i++) {
        for (let j = 0; j < i; j++) {
          if (!dp[j]) continue;
          const w = s.slice(j, i);
          if (D.has(w)) { dp[i] = true; t.step(7, `dp[${j}] is true and "${w}" is a word, so dp[${i}] = true.`, view(i, j)); break; }
        }
        if (!dp[i]) t.step(6, `No split point works for the prefix "${s.slice(0, i)}": dp[${i}] = false.`, view(i));
      }
      t.step(9, `dp[${s.length}] = ${dp[s.length]}. O(n²) substring checks (fewer if you only try word lengths from the dictionary).`, view());
    },
  });

  /* ═════════════ DP 2-D ═════════════ */
  add('lcsTable', {
    title: 'Longest common subsequence table', sub: 'Matching characters extend the diagonal; otherwise take the better of dropping a character from either string.',
    inputs: [{ key: 'a', label: 'text1', type: 'str', def: 'ABCBDAB' }, { key: 'b', label: 'text2', type: 'str', def: 'BDCABA' }],
    check: ({ a, b }) => (a.length > 10 || b.length > 10 ? 'at most 10 characters each' : null),
    code: `
int longestCommonSubsequence(String a, String b) {
    int m = a.length(), n = b.length();
    int[][] dp = new int[m + 1][n + 1];          // dp[i][j]: LCS of a[0..i) and b[0..j)
    for (int i = 1; i <= m; i++)
        for (int j = 1; j <= n; j++)
            dp[i][j] = a.charAt(i - 1) == b.charAt(j - 1)
                     ? dp[i - 1][j - 1] + 1
                     : Math.max(dp[i - 1][j], dp[i][j - 1]);
    return dp[m][n];
}`,
    run({ a, b }, t) {
      const m = a.length, n = b.length; const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
      const view = (ci, cj, cls = {}) => [{ t: 'grid', label: 'dp[i][j]', g: dp.map((r) => r.slice()), rh: ['ε', ...a.split('')], ch: ['ε', ...b.split('')], cls: { ...cls, ...(ci !== undefined ? { [ci + ',' + cj]: 'active' } : {}) }, w: 32, h: 30 }];
      t.step(4, 'Row 0 and column 0 are 0: an empty string has no common subsequence with anything.', view());
      for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) { dp[i][j] = dp[i - 1][j - 1] + 1; t.step(7, `'${a[i - 1]}' == '${b[j - 1]}': extend the diagonal, ${dp[i - 1][j - 1]} + 1 = ${dp[i][j]}.`, view(i, j, { [(i - 1) + ',' + (j - 1)]: 'ok' })); }
        else { dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]); t.step(9, `'${a[i - 1]}' ≠ '${b[j - 1]}': max(up ${dp[i - 1][j]}, left ${dp[i][j - 1]}) = ${dp[i][j]}.`, view(i, j, { [(i - 1) + ',' + j]: 'cmp', [i + ',' + (j - 1)]: 'cmp' })); }
      }
      let i = m, j = n; const path = {}; const seq = [];
      while (i > 0 && j > 0) { if (a[i - 1] === b[j - 1]) { path[i + ',' + j] = 'ok'; seq.push(a[i - 1]); i--; j--; } else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--; }
      t.step(10, `LCS length <b>${dp[m][n]}</b>, e.g. "${seq.reverse().join('')}" (traced back through the green diagonal cells). O(m·n).`, view(undefined, undefined, path));
    },
  });

  add('editDistance', {
    title: 'Edit distance table', sub: 'dp[i][j] = the cost to turn a[0..i) into b[0..j): keep a match free, or pay 1 for insert, delete or replace.',
    inputs: [{ key: 'a', label: 'word1', type: 'str', def: 'horse' }, { key: 'b', label: 'word2', type: 'str', def: 'ros' }],
    check: ({ a, b }) => (a.length > 9 || b.length > 9 ? 'at most 9 characters each' : null),
    code: `
int minDistance(String a, String b) {
    int m = a.length(), n = b.length();
    int[][] dp = new int[m + 1][n + 1];
    for (int i = 0; i <= m; i++) dp[i][0] = i;       // delete everything
    for (int j = 0; j <= n; j++) dp[0][j] = j;       // insert everything
    for (int i = 1; i <= m; i++)
        for (int j = 1; j <= n; j++)
            dp[i][j] = a.charAt(i - 1) == b.charAt(j - 1)
                ? dp[i - 1][j - 1]                                           // free match
                : 1 + Math.min(dp[i - 1][j - 1],                             // replace
                               Math.min(dp[i - 1][j], dp[i][j - 1]));        // delete, insert
    return dp[m][n];
}`,
    run({ a, b }, t) {
      const m = a.length, n = b.length; const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : null)));
      const view = (ci, cj, cls = {}) => [{ t: 'grid', label: 'dp[i][j]', g: dp.map((r) => r.map((v) => (v === null ? '' : v))), rh: ['ε', ...a.split('')], ch: ['ε', ...b.split('')], cls: { ...cls, ...(ci !== undefined ? { [ci + ',' + cj]: 'active' } : {}) }, w: 32, h: 30 }];
      t.step(5, 'Base cases: turning a prefix into the empty string costs its length (deletes), and building a prefix from empty costs its length (inserts).', view());
      for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) { dp[i][j] = dp[i - 1][j - 1]; t.step(9, `'${a[i - 1]}' == '${b[j - 1]}': no cost, copy the diagonal ${dp[i][j]}.`, view(i, j, { [(i - 1) + ',' + (j - 1)]: 'ok' })); }
        else {
          const rep = dp[i - 1][j - 1], del = dp[i - 1][j], ins = dp[i][j - 1];
          dp[i][j] = 1 + Math.min(rep, del, ins);
          const which = rep <= del && rep <= ins ? 'replace' : del <= ins ? 'delete' : 'insert';
          t.step(10, `'${a[i - 1]}' ≠ '${b[j - 1]}': 1 + min(replace ${rep}, delete ${del}, insert ${ins}) = ${dp[i][j]} (${which}).`, view(i, j, { [(i - 1) + ',' + (j - 1)]: 'cmp', [(i - 1) + ',' + j]: 'cmp', [i + ',' + (j - 1)]: 'cmp' }));
        }
      }
      t.step(13, `Edit distance "${a}" → "${b}" = <b>${dp[m][n]}</b>. O(m·n) time; O(n) space with two rows.`, view(m, n));
    },
  });

  add('knapsack01', {
    title: '0/1 knapsack (subset sum), one row, backwards', sub: 'Iterate capacity from high to low so each item is used at most once.',
    inputs: [{ key: 'nums', label: 'items', type: 'ints', def: [1, 5, 11, 5] }, { key: 'target', label: 'target (half the sum)', type: 'int', def: 11 }],
    check: ({ nums, target }) => (target > 24 || target < 0 ? 'target 0–24' : nums.length > 8 ? 'at most 8 items' : null),
    code: `
boolean canReach(int[] nums, int target) {
    boolean[] dp = new boolean[target + 1];   // dp[s]: some subset sums to s
    dp[0] = true;
    for (int x : nums)
        for (int s = target; s >= x; s--)       // backwards: x counted at most once
            dp[s] = dp[s] || dp[s - x];
    return dp[target];
}`,
    run({ nums, target }, t) {
      const dp = Array(target + 1).fill(false); dp[0] = true;
      const show = () => dp.map((x) => (x ? 'T' : '·'));
      t.step(3, 'dp[0] = true: the empty subset sums to 0.', [{ t: 'array', label: 'dp[sum]', a: show(), cls: { 0: 'ok' }, cw: 28 }]);
      nums.forEach((x, k) => {
        const newly = {};
        for (let s = target; s >= x; s--) if (!dp[s] && dp[s - x]) { dp[s] = true; newly[s] = 'ok'; }
        t.step(6, `Item ${x}: every reachable sum s − ${x} makes s reachable. Going from high s to low means sums made with ${x} in this pass aren't reused in the same pass. New: ${Object.keys(newly).join(', ') || 'none'}.`, [{ t: 'array', label: 'items', a: nums, cls: { [k]: 'active' } }, { t: 'array', label: 'dp[sum]', a: show(), cls: { ...Object.fromEntries(dp.map((v, i) => [i, v ? 'blue' : ''])), ...newly }, cw: 28 }]);
      });
      t.step(8, `dp[${target}] = ${dp[target]}. Forward iteration would let one item be used many times, which is the unbounded knapsack. O(n × target).`, [{ t: 'array', label: 'dp[sum]', a: show(), cls: { [target]: dp[target] ? 'ok' : 'bad' }, cw: 28 }]);
    },
  });

  add('gridPathsDP', {
    title: 'Grid paths: dp[r][c] = dp[r−1][c] + dp[r][c−1]', sub: 'Every path into a cell comes from above or from the left.',
    inputs: [{ key: 'grid', label: 'grid (1 = obstacle)', type: 'matrix', def: [[0, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1], [1, 0, 0, 0]] }],
    check: ({ grid }) => (grid.length > 7 || grid[0].length > 8 ? 'at most 7 × 8' : null),
    code: `
int uniquePathsWithObstacles(int[][] g) {
    int R = g.length, C = g[0].length;
    int[] dp = new int[C];                 // one row, updated in place
    dp[0] = g[0][0] == 1 ? 0 : 1;
    for (int r = 0; r < R; r++)
        for (int c = 0; c < C; c++) {
            if (g[r][c] == 1) dp[c] = 0;                 // blocked
            else if (c > 0) dp[c] += dp[c - 1];          // from above (old dp[c]) + from the left
        }
    return dp[C - 1];
}`,
    run({ grid }, t) {
      const R = grid.length, C = grid[0].length; const dp = grid.map((row) => row.map(() => ''));
      const view = (ci, cj, cls = {}) => [{ t: 'grid', label: 'number of paths to each cell', g: dp, cls: { ...Object.fromEntries(grid.flatMap((row, r) => row.map((v, c) => [r + ',' + c, v === 1 ? 'wall' : '']))), ...cls, ...(ci !== undefined ? { [ci + ',' + cj]: 'active' } : {}) }, w: 38, h: 34 }];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        if (grid[r][c] === 1) { dp[r][c] = 0; t.step(8, `(${r},${c}) is blocked: 0 paths.`, view(r, c)); continue; }
        if (r === 0 && c === 0) { dp[r][c] = 1; t.step(4, 'The start has exactly one path (standing still).', view(r, c)); continue; }
        const up = r > 0 ? dp[r - 1][c] : 0, left = c > 0 ? dp[r][c - 1] : 0;
        dp[r][c] = up + left;
        t.step(9, `(${r},${c}) = above ${up} + left ${left} = ${dp[r][c]}.`, view(r, c, { ...(r > 0 ? { [(r - 1) + ',' + c]: 'cmp' } : {}), ...(c > 0 ? { [r + ',' + (c - 1)]: 'cmp' } : {}) }));
      }
      t.step(11, `Paths to the bottom-right: <b>${dp[R - 1][C - 1]}</b>. O(R·C) time, O(C) space with one rolling row.`, view(R - 1, C - 1));
    },
  });

  /* ═════════════ Greedy & intervals ═════════════ */
  add('kadane', {
    title: 'Kadane’s algorithm (maximum subarray)', sub: 'At each index, either extend the running sum or restart from the current element, whichever is larger.',
    inputs: [{ key: 'nums', label: 'nums', type: 'ints', def: [-2, 1, -3, 4, -1, 2, 1, -5, 4] }],
    code: `
int maxSubArray(int[] nums) {
    int cur = nums[0], best = nums[0];
    for (int i = 1; i < nums.length; i++) {
        cur = Math.max(nums[i], cur + nums[i]);   // extend, or start fresh here
        best = Math.max(best, cur);
    }
    return best;
}`,
    run({ nums }, t) {
      let cur = nums[0], best = nums[0], start = 0, bs = 0, be = 0;
      t.step(2, `Start: cur = best = ${nums[0]}.`, [{ t: 'array', label: 'nums', a: nums, range: [0, 0], ptr: { i: 0 } }, { t: 'vars', v: { cur, best } }]);
      for (let i = 1; i < nums.length; i++) {
        const restart = nums[i] > cur + nums[i];
        if (restart) { cur = nums[i]; start = i; } else cur += nums[i];
        if (cur > best) { best = cur; bs = start; be = i; }
        t.step(4, restart ? `cur + ${nums[i]} &lt; ${nums[i]}: the running sum is a burden, so <b>restart</b> at ${i}.` : `Extend: cur = ${cur}.`, [{ t: 'array', label: 'nums', a: nums, range: [start, i], ptr: { i }, cls: { [i]: 'active' } }, { t: 'vars', v: { cur, best }, chg: cur === best ? ['best'] : ['cur'] }]);
      }
      t.step(7, `Maximum subarray sum = <b>${best}</b> (indices ${bs}–${be}). O(n), O(1).`, [{ t: 'array', label: 'nums', a: nums, range: [bs, be], cls: Object.fromEntries(Array.from({ length: be - bs + 1 }, (_, k) => [bs + k, 'ok'])) }, { t: 'vars', v: { best } }]);
    },
  });

  add('jumpReach', {
    title: 'Jump game: track the farthest reachable index', sub: 'Walk forward; if you ever stand past the farthest reach, you’re stuck.',
    inputs: [{ key: 'nums', label: 'max jump at each index', type: 'ints', def: [2, 3, 1, 1, 0, 4] }],
    code: `
boolean canJump(int[] nums) {
    int reach = 0;
    for (int i = 0; i < nums.length; i++) {
        if (i > reach) return false;              // can't even get here
        reach = Math.max(reach, i + nums[i]);
    }
    return true;
}`,
    run({ nums }, t) {
      let reach = 0;
      for (let i = 0; i < nums.length; i++) {
        if (i > reach) { t.step(4, `Index ${i} is beyond the farthest reach (${reach}): stuck, so false.`, [{ t: 'array', label: 'nums', a: nums, ptr: { i, reach: [reach, 'bot', 2] }, cls: { [i]: 'bad', ...Object.fromEntries(nums.map((_, k) => [k, k <= reach ? 'range' : 'dim'])) } }]); return; }
        const before = reach; reach = Math.max(reach, i + nums[i]);
        t.step(5, `At ${i}: can jump up to ${i} + ${nums[i]} = ${i + nums[i]}. Farthest reach ${before} → ${reach}.`, [{ t: 'array', label: 'nums', a: nums, ptr: { i, reach: [Math.min(reach, nums.length - 1), 'bot', 2] }, cls: { ...Object.fromEntries(nums.map((_, k) => [k, k <= reach ? 'range' : ''])), [i]: 'active' } }]);
      }
      t.step(7, 'Every index was reachable, including the last one: true. O(n) greedy, with no DP needed.', [{ t: 'array', label: 'nums', a: nums, cls: Object.fromEntries(nums.map((_, k) => [k, 'ok'])) }]);
    },
  });

  add('mergeIntervals', {
    title: 'Merging intervals after sorting by start', sub: 'Sorted by start, an interval overlaps the last merged one iff it starts before that one ends.',
    inputs: [{ key: 'iv', label: 'intervals', type: 'matrix', def: [[8, 10], [1, 3], [2, 6], [15, 18], [9, 12], [17, 20]] }],
    check: ({ iv }) => (iv.length > 10 ? 'at most 10 intervals' : null),
    code: `
int[][] merge(int[][] intervals) {
    Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));
    List<int[]> res = new ArrayList<>();
    for (int[] cur : intervals) {
        if (res.isEmpty() || res.get(res.size() - 1)[1] < cur[0]) res.add(cur);   // gap: new block
        else res.get(res.size() - 1)[1] = Math.max(res.get(res.size() - 1)[1], cur[1]); // overlap: extend
    }
    return res.toArray(new int[0][]);
}`,
    run({ iv }, t) {
      const s = iv.map((x) => x.slice()).sort((a, b) => a[0] - b[0]);
      const lo = Math.min(...s.map((x) => x[0])), hi = Math.max(...s.map((x) => x[1]));
      const res = [];
      const view = (k, c) => [{ t: 'ivals', label: 'sorted by start', a: s, lo, hi, cls: k !== undefined ? { [k]: c } : {} }, { t: 'ivals', label: 'merged', a: res.length ? res : [[lo, lo]], lo, hi, text: res.length ? undefined : [''], cls: res.length ? { [res.length - 1]: 'ok' } : { 0: 'dim' } }];
      t.step(2, 'Sort by start time. Now overlaps can only happen with the most recently merged block.', view());
      s.forEach((cur, k) => {
        const last = res[res.length - 1];
        if (!last || last[1] < cur[0]) { res.push(cur.slice()); t.step(5, `[${cur}] starts after the last block ends${last ? ` (${last[1]})` : ''}: start a new block.`, view(k, 'active')); }
        else { const old = last[1]; last[1] = Math.max(last[1], cur[1]); t.step(6, `[${cur}] overlaps [${last[0]}, ${old}]: extend the end to ${last[1]}.`, view(k, 'cmp')); }
      });
      t.step(8, `${res.length} merged interval(s). O(n log n) for the sort, then one pass.`, view());
    },
  });

  add('meetingRooms', {
    title: 'Minimum meeting rooms: a min-heap of end times', sub: 'Sort by start. The heap holds when each busy room frees up; reuse the earliest if it’s free.',
    inputs: [{ key: 'iv', label: 'meetings', type: 'matrix', def: [[0, 30], [5, 10], [15, 20], [10, 25], [26, 35], [31, 40]] }],
    check: ({ iv }) => (iv.length > 10 ? 'at most 10 meetings' : null),
    code: `
int minMeetingRooms(int[][] intervals) {
    Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));
    PriorityQueue<Integer> ends = new PriorityQueue<>();   // end times of busy rooms
    for (int[] m : intervals) {
        if (!ends.isEmpty() && ends.peek() <= m[0]) ends.poll();   // earliest room is free: reuse
        ends.offer(m[1]);
    }
    return ends.size();                                    // rooms ever needed at once
}`,
    run({ iv }, t) {
      const s = iv.map((x) => x.slice()).sort((a, b) => a[0] - b[0]);
      const lo = Math.min(...s.map((x) => x[0])), hi = Math.max(...s.map((x) => x[1]));
      const rooms = []; const roomOf = []; let ends = [];
      const view = (k, sweep) => [{ t: 'ivals', label: 'meetings (each row is a room)', a: s.slice(0, k + 1), rows: roomOf.slice(0, k + 1), lo, hi, sweep, cls: { [k]: 'active' } }, { t: 'stack', label: 'heap of end times (min first)', a: ends.slice().sort((a, b) => a - b) }];
      s.forEach((m, k) => {
        ends.sort((a, b) => a - b);
        if (ends.length && ends[0] <= m[0]) {
          const freed = ends.shift();
          const r = rooms.findIndex((e) => e === freed); rooms[r] = m[1]; roomOf[k] = r;
          ends.push(m[1]);
          t.step(5, `[${m}] starts at ${m[0]}; the earliest room frees at ${freed} ≤ ${m[0]}: reuse room ${r}.`, view(k, m[0]));
        } else {
          rooms.push(m[1]); roomOf[k] = rooms.length - 1; ends.push(m[1]);
          t.step(6, `[${m}]: every room is still busy (the earliest frees at ${ends.length > 1 ? Math.min(...ends.slice(0, -1)) : '—'}), so open room ${rooms.length - 1}.`, view(k, m[0]));
        }
      });
      t.step(8, `Rooms needed: <b>${rooms.length}</b>. O(n log n).`, view(s.length - 1));
    },
  });

  /* ═════════════ Bits ═════════════ */
  add('xorSingle', {
    title: 'XOR cancels pairs', sub: 'x ^ x = 0 and x ^ 0 = x, and order doesn’t matter, so XOR everything and the pairs vanish.',
    inputs: [{ key: 'nums', label: 'nums', type: 'ints', def: [4, 1, 2, 1, 2] }],
    check: ({ nums }) => (nums.some((x) => x < 0 || x > 255) ? 'use values 0–255 for display' : nums.length > 9 ? 'at most 9 numbers' : null),
    code: `
int singleNumber(int[] nums) {
    int x = 0;
    for (int v : nums) x ^= v;     // paired values cancel out
    return x;
}`,
    run({ nums }, t) {
      let x = 0;
      const rows = [{ label: 'x = 0', v: 0 }];
      t.step(2, 'Start with x = 0.', [{ t: 'bits', rows: rows.slice() }]);
      nums.forEach((v, i) => {
        const before = x; x ^= v;
        const hl = []; for (let b = 0; b < 8; b++) if (((before ^ x) >> b) & 1) hl.push(b);
        t.step(3, `x ^= ${v}: bits where ${v} has a 1 flip.`, [{ t: 'array', label: 'nums', a: nums, ptr: { i }, cls: { [i]: 'active' } }, { t: 'bits', rows: [{ label: 'x before', v: before }, { label: `^ ${v}`, v }, { label: '= x', v: x, hl }] }]);
      });
      t.step(4, `Every paired value cancelled. What's left, <b>${x}</b>, is the single one. O(n) time, O(1) space.`, [{ t: 'bits', rows: [{ label: 'result', v: x }] }]);
    },
  });

  add('bitTricks', {
    title: 'n & (n − 1) clears the lowest set bit', sub: 'Subtracting 1 flips the lowest 1 and every 0 below it, so AND-ing wipes out exactly that bit.',
    inputs: [{ key: 'n', label: 'n (0–255)', type: 'int', def: 180 }],
    check: ({ n }) => (n < 0 || n > 255 ? '0–255 for display' : null),
    code: `
int hammingWeight(int n) {
    int count = 0;
    while (n != 0) {
        n &= n - 1;        // drop the lowest set bit
        count++;
    }
    return count;
}`,
    run({ n }, t) {
      let x = n, count = 0;
      t.step(3, `n = ${n}. The loop runs once per set bit, not once per bit position.`, [{ t: 'bits', rows: [{ label: 'n', v: x }] }]);
      while (x !== 0) {
        const low = x & -x; const bit = Math.log2(low);
        const next = x & (x - 1);
        t.step(4, `n − 1 flips bit ${bit} and everything below it; n & (n − 1) clears bit ${bit}.`, [{ t: 'bits', rows: [{ label: 'n', v: x, hl: [bit] }, { label: 'n − 1', v: x - 1, hl: Array.from({ length: bit + 1 }, (_, k) => k) }, { label: 'n & (n − 1)', v: next }] }]);
        x = next; count++;
      }
      t.step(7, `${count} set bit(s). Related tricks: <code>n & (n − 1) == 0</code> tests for a power of two; <code>n & −n</code> isolates the lowest set bit.`, [{ t: 'bits', rows: [{ label: 'original', v: n, dec: `${n} → ${count} ones` }] }]);
    },
  });

  add('fastPow', {
    title: 'Fast exponentiation (square and multiply)', sub: 'Walk the bits of the exponent: square the base each step, multiply it in when the bit is 1. O(log n).',
    inputs: [{ key: 'x', label: 'x', type: 'int', def: 3 }, { key: 'n', label: 'n (0–255)', type: 'int', def: 13 }],
    check: ({ n }) => (n < 0 || n > 255 ? 'n in 0–255' : null),
    code: `
double myPow(double x, int n) {
    long e = n;                          // long: -Integer.MIN_VALUE overflows int
    if (e < 0) { x = 1 / x; e = -e; }
    double result = 1;
    while (e > 0) {
        if ((e & 1) == 1) result *= x;   // this bit contributes x^(2^k)
        x *= x;                          // x^(2^k) -> x^(2^(k+1))
        e >>= 1;
    }
    return result;
}`,
    run({ x, n }, t) {
      let e = n, base = x, result = 1, k = 0;
      t.step(3, `${x}^${n}: write ${n} in binary. Each 1 bit k contributes a factor x^(2^k).`, [{ t: 'bits', rows: [{ label: 'n', v: n }] }, { t: 'vars', v: { result, base } }]);
      while (e > 0) {
        const bit = e & 1;
        if (bit) result *= base;
        t.step(bit ? 7 : 8, bit ? `Bit ${k} is 1: result *= ${x}^${2 ** k} (${base}) → ${result}.` : `Bit ${k} is 0: skip.`, [{ t: 'bits', rows: [{ label: 'n', v: n, hl: [k] }] }, { t: 'vars', v: { result, [`base = ${x}^${2 ** k}`]: base }, chg: bit ? ['result'] : [] }]);
        base *= base; e >>= 1; k++;
      }
      t.step(10, `${x}^${n} = <b>${result}</b> in ${k} squaring steps instead of ${n} multiplications.`, [{ t: 'vars', v: { result } }]);
    },
  });
})();

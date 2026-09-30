/* DSA Lab — tracers for sliding window, stacks, binary search and linked lists. */
(function () {
  'use strict';
  const add = window.DSAViz.add;
  const rangeCls = (l, r, c = 'range') => { const o = {}; for (let i = l; i <= r; i++) o[i] = c; return o; };

  /* ═════════════ Sliding window ═════════════ */
  add('fixedWindow', {
    title: 'Fixed-size window', sub: 'Slide by adding the element that enters and subtracting the one that leaves: O(1) per step.',
    inputs: [{ key: 'nums', label: 'nums', type: 'ints', def: [1, 12, -5, -6, 50, 3, 7, 1] }, { key: 'k', label: 'k', type: 'int', def: 4 }],
    check: ({ nums, k }) => (k < 1 || k > nums.length ? 'need 1 ≤ k ≤ nums.length' : null),
    code: `
double findMaxAverage(int[] nums, int k) {
    int sum = 0;
    for (int i = 0; i < k; i++) sum += nums[i];     // first window
    int best = sum;
    for (int r = k; r < nums.length; r++) {
        sum += nums[r] - nums[r - k];              // one in, one out
        best = Math.max(best, sum);
    }
    return (double) best / k;
}`,
    run({ nums, k }, t) {
      let sum = 0;
      for (let i = 0; i < k; i++) {
        sum += nums[i];
        t.step(3, `Build the first window: add nums[${i}] = ${nums[i]} → sum ${sum}.`, [{ t: 'array', label: 'nums', a: nums, range: [0, i], cls: { [i]: 'active' } }, { t: 'vars', v: { sum } }]);
      }
      let best = sum, bestL = 0;
      t.step(4, `First window [0, ${k - 1}] has sum ${sum}.`, [{ t: 'array', label: 'nums', a: nums, range: [0, k - 1] }, { t: 'vars', v: { sum, best } }]);
      for (let r = k; r < nums.length; r++) {
        sum += nums[r] - nums[r - k];
        const better = sum > best; if (better) { best = sum; bestL = r - k + 1; }
        t.step(6, `Slide: +nums[${r}] (${nums[r]}) −nums[${r - k}] (${nums[r - k]}) → sum ${sum}${better ? ', a new best' : ''}.`, [{ t: 'array', label: 'nums', a: nums, range: [r - k + 1, r], cls: { [r]: 'ok', [r - k]: 'bad' }, ptr: { l: [r - k + 1, 'bot', 1], r: [r, 'bot', 2] } }, { t: 'vars', v: { sum, best }, chg: better ? ['best'] : ['sum'] }]);
      }
      t.step(9, `Best window sum ${best} at [${bestL}, ${bestL + k - 1}], so the average is ${(best / k).toFixed(4)}. O(n) instead of O(n·k).`, [{ t: 'array', label: 'nums', a: nums, range: [bestL, bestL + k - 1], cls: rangeCls(bestL, bestL + k - 1, 'ok') }, { t: 'vars', v: { best, average: +(best / k).toFixed(4) } }]);
    },
  });

  add('longestNoRepeat', {
    title: 'Longest substring without repeats', sub: 'Grow the window on the right; when a character repeats, jump the left edge past its previous position.',
    inputs: [{ key: 's', label: 's', type: 'str', def: 'abcabcbbzx' }],
    check: ({ s }) => (s.length > 30 ? 'keep it under 30 characters' : null),
    code: `
int lengthOfLongestSubstring(String s) {
    Map<Character, Integer> last = new HashMap<>();   // char -> last index
    int best = 0, l = 0;
    for (int r = 0; r < s.length(); r++) {
        char c = s.charAt(r);
        if (last.containsKey(c) && last.get(c) >= l)
            l = last.get(c) + 1;                     // jump past the duplicate
        last.put(c, r);
        best = Math.max(best, r - l + 1);
    }
    return best;
}`,
    run({ s }, t) {
      const a = s.split('');
      const last = new Map();
      let best = 0, l = 0, bestLR = [0, -1];
      const view = (r, c = {}) => [{ t: 'array', label: 's', a, range: r >= l ? [l, r] : undefined, ptr: { l: [l, 'bot', 1], r: [r, 'top', 2] }, cls: c }, { t: 'map', label: 'last index of each char', e: [...last.entries()], cls: {} }, { t: 'vars', v: { window: r >= l ? s.slice(l, r + 1) : '', best } }];
      t.step(3, 'The window [l, r] always contains distinct characters. We only ever move l forward.', view(-1));
      for (let r = 0; r < a.length; r++) {
        const c = a[r];
        if (last.has(c) && last.get(c) >= l) {
          const p = last.get(c);
          t.step(7, `'${c}' is already in the window at index ${p}. Move l to ${p + 1}: every window that starts at or before ${p} and reaches r repeats '${c}'.`, view(r, { [p]: 'bad', [r]: 'bad' }));
          l = p + 1;
        }
        last.set(c, r);
        const len = r - l + 1;
        if (len > best) { best = len; bestLR = [l, r]; }
        t.step(9, `Window "${s.slice(l, r + 1)}" (length ${len}) is valid. best = ${best}.`, view(r, { [r]: 'active' }));
      }
      t.step(11, `Longest: "${s.slice(bestLR[0], bestLR[1] + 1)}" (length ${best}). l and r each move at most n times, so it's O(n).`, [{ t: 'array', label: 's', a, range: bestLR, cls: rangeCls(bestLR[0], bestLR[1], 'ok') }, { t: 'vars', v: { best } }]);
    },
  });

  add('charReplacement', {
    title: 'Longest repeating after k replacements', sub: 'A window is fixable iff (length − count of its most common letter) ≤ k.',
    inputs: [{ key: 's', label: 's', type: 'str', def: 'AABABBAB' }, { key: 'k', label: 'k', type: 'int', def: 1 }],
    check: ({ s }) => (/^[A-Z]{1,24}$/.test(s) ? null : 'uppercase letters, at most 24'),
    code: `
int characterReplacement(String s, int k) {
    int[] count = new int[26];
    int l = 0, maxFreq = 0, best = 0;
    for (int r = 0; r < s.length(); r++) {
        maxFreq = Math.max(maxFreq, ++count[s.charAt(r) - 'A']);
        while (r - l + 1 - maxFreq > k)        // too many letters to replace
            count[s.charAt(l++) - 'A']--;
        best = Math.max(best, r - l + 1);
    }
    return best;
}`,
    run({ s, k }, t) {
      const a = s.split(''); const cnt = {}; let l = 0, maxF = 0, best = 0;
      const view = (r, c = {}) => [{ t: 'array', label: 's', a, range: [l, r], ptr: { l: [l, 'bot', 1], r: [r, 'top', 2] }, cls: c }, { t: 'map', label: 'counts in window', e: Object.entries(cnt).filter(([, v]) => v > 0) }, { t: 'vars', v: { length: r - l + 1, maxFreq: maxF, 'to replace': r - l + 1 - maxF, k, best } }];
      for (let r = 0; r < a.length; r++) {
        cnt[a[r]] = (cnt[a[r]] || 0) + 1; maxF = Math.max(maxF, cnt[a[r]]);
        t.step(5, `Add '${a[r]}'. The most common letter appears ${maxF}×, so ${r - l + 1 - maxF} letter(s) would need replacing.`, view(r, { [r]: 'active' }));
        while (r - l + 1 - maxF > k) {
          t.step(6, `${r - l + 1 - maxF} &gt; k = ${k}: shrink from the left, dropping '${a[l]}'.`, view(r, { [l]: 'bad' }));
          cnt[a[l]]--; l++;
        }
        best = Math.max(best, r - l + 1);
        t.step(8, `Valid window of length ${r - l + 1}. best = ${best}.`, view(r));
      }
      t.step(10, `Answer: ${best}. (maxFreq is never decreased when shrinking. That's fine, because only a larger maxFreq can produce a larger answer.)`, [{ t: 'array', label: 's', a }, { t: 'vars', v: { best } }]);
    },
  });

  add('minWindow', {
    title: 'Minimum window containing all of t', sub: 'Expand until the window is valid, then shrink while it stays valid, recording the smallest.',
    inputs: [{ key: 's', label: 's', type: 'str', def: 'ADOBECODEBANC' }, { key: 't', label: 't', type: 'str', def: 'ABC' }],
    check: ({ s, t }) => (s.length > 26 ? 's: at most 26 characters' : !t.length ? 't cannot be empty' : null),
    code: `
String minWindow(String s, String t) {
    int[] need = new int[128];
    for (char c : t.toCharArray()) need[c]++;
    int missing = t.length(), l = 0, bestL = 0, bestLen = Integer.MAX_VALUE;
    for (int r = 0; r < s.length(); r++) {
        if (need[s.charAt(r)]-- > 0) missing--;      // r covers a needed char
        while (missing == 0) {                       // valid: try to shrink
            if (r - l + 1 < bestLen) { bestLen = r - l + 1; bestL = l; }
            if (++need[s.charAt(l++)] > 0) missing++; // lost a needed char
        }
    }
    return bestLen == Integer.MAX_VALUE ? "" : s.substring(bestL, bestL + bestLen);
}`,
    run({ s, t: tt }, t) {
      const a = s.split(''); const need = {};
      for (const c of tt) need[c] = (need[c] || 0) + 1;
      let missing = tt.length, l = 0, bestL = 0, bestLen = Infinity;
      const needView = () => ({ t: 'map', label: 'need (positive = still missing)', e: Object.entries(need).filter(([c]) => tt.includes(c)), cls: Object.fromEntries(Object.entries(need).map(([c, v]) => [c, v > 0 ? 'cmp' : 'ok'])) });
      const view = (r, c = {}) => [{ t: 'array', label: 's', a, range: r >= l ? [l, r] : undefined, ptr: { l: [l, 'bot', 1], r: [r, 'top', 2] }, cls: c }, needView(), { t: 'vars', v: { missing, best: bestLen === Infinity ? '—' : s.substr(bestL, bestLen) } }];
      t.step(4, `We need ${tt.length} characters (${[...new Set(tt)].map((c) => `'${c}'×${need[c]}`).join(', ')}). "missing" counts how many are still uncovered.`, view(-1));
      for (let r = 0; r < a.length; r++) {
        const c = a[r];
        const useful = (need[c] || 0) > 0;
        need[c] = (need[c] || 0) - 1; if (useful) missing--;
        t.step(6, useful ? `'${c}' was needed → missing = ${missing}.` : `'${c}' isn't needed (or we already have enough).`, view(r, { [r]: useful ? 'ok' : 'active' }));
        while (missing === 0) {
          if (r - l + 1 < bestLen) { bestLen = r - l + 1; bestL = l; t.step(8, `Valid window "${s.slice(l, r + 1)}", the smallest so far (length ${bestLen}).`, view(r, rangeCls(l, r, 'ok'))); }
          const lc = a[l];
          need[lc]++;
          const lost = need[lc] > 0;
          t.step(9, lost ? `Dropping '${lc}' loses a needed character → invalid again. Resume expanding.` : `Dropping '${lc}' keeps the window valid; keep shrinking.`, view(r, { [l]: lost ? 'bad' : 'dim' }));
          l++; if (lost) missing++;
        }
      }
      t.step(12, bestLen === Infinity ? 'No window contains all of t.' : `Answer: "${s.substr(bestL, bestLen)}". Each pointer moves at most n times: O(|s| + |t|).`, [{ t: 'array', label: 's', a, range: bestLen === Infinity ? undefined : [bestL, bestL + bestLen - 1], cls: bestLen === Infinity ? {} : rangeCls(bestL, bestL + bestLen - 1, 'ok') }]);
    },
  });

  add('minSubarraySum', {
    title: 'Shortest subarray with sum ≥ target', sub: 'All values are positive, so growing the window only raises the sum and shrinking only lowers it.',
    inputs: [{ key: 'nums', label: 'nums (positive)', type: 'ints', def: [2, 3, 1, 2, 4, 3] }, { key: 'target', label: 'target', type: 'int', def: 7 }],
    check: ({ nums }) => (nums.every((x) => x > 0) ? null : 'values must be positive'),
    code: `
int minSubArrayLen(int target, int[] nums) {
    int l = 0, sum = 0, best = Integer.MAX_VALUE;
    for (int r = 0; r < nums.length; r++) {
        sum += nums[r];
        while (sum >= target) {              // valid: record, then shrink
            best = Math.min(best, r - l + 1);
            sum -= nums[l++];
        }
    }
    return best == Integer.MAX_VALUE ? 0 : best;
}`,
    run({ nums, target }, t) {
      let l = 0, sum = 0, best = Infinity;
      for (let r = 0; r < nums.length; r++) {
        sum += nums[r];
        t.step(4, `Add nums[${r}] = ${nums[r]} → sum ${sum}.`, [{ t: 'array', label: 'nums', a: nums, range: [l, r], ptr: { l: [l, 'bot', 1], r: [r, 'top', 2] }, cls: { [r]: 'active' } }, { t: 'vars', v: { sum, target, best: best === Infinity ? '∞' : best } }]);
        while (sum >= target) {
          best = Math.min(best, r - l + 1);
          t.step(6, `sum ${sum} ≥ ${target}: window length ${r - l + 1}; best = ${best}. Shrink from the left.`, [{ t: 'array', label: 'nums', a: nums, range: [l, r], ptr: { l: [l, 'bot', 1], r: [r, 'top', 2] }, cls: { ...rangeCls(l, r, 'ok'), [l]: 'bad' } }, { t: 'vars', v: { sum, target, best }, chg: ['best'] }]);
          sum -= nums[l++];
        }
      }
      t.step(10, `Shortest length: ${best === Infinity ? 0 : best}. With negative numbers this would fail; you'd need prefix sums plus a monotonic deque.`, [{ t: 'array', label: 'nums', a: nums }, { t: 'vars', v: { best: best === Infinity ? 0 : best } }]);
    },
  });

  /* ═════════════ Stacks ═════════════ */
  add('validParens', {
    title: 'Matching brackets with a stack', sub: 'Push openers; each closer must match the most recent unmatched opener.',
    inputs: [{ key: 's', label: 's', type: 'str', def: '{[()()]}(]' }],
    check: ({ s }) => (/^[()[\]{}]{1,30}$/.test(s) ? null : 'only ()[]{} characters, at most 30'),
    code: `
boolean isValid(String s) {
    Deque<Character> st = new ArrayDeque<>();
    for (char c : s.toCharArray()) {
        if (c == '(') st.push(')');          // push the closer we expect
        else if (c == '[') st.push(']');
        else if (c == '{') st.push('}');
        else if (st.isEmpty() || st.pop() != c) return false;
    }
    return st.isEmpty();                     // leftovers = unclosed openers
}`,
    run({ s }, t) {
      const a = s.split(''); const st = [];
      const pair = { '(': ')', '[': ']', '{': '}' };
      for (let i = 0; i < a.length; i++) {
        const c = a[i];
        if (pair[c]) { st.push(pair[c]); t.step(4, `'${c}' opens: push the closer we'll need, '${pair[c]}'.`, [{ t: 'array', label: 's', a, ptr: { i }, cls: { [i]: 'active' }, cw: 30 }, { t: 'stack', label: 'expected closers (top = right)', a: st.slice(), cls: { [st.length - 1]: 'active' } }]); }
        else {
          if (!st.length) { t.step(7, `'${c}' closes, but nothing is open → invalid.`, [{ t: 'array', label: 's', a, ptr: { i }, cls: { [i]: 'bad' }, cw: 30 }, { t: 'stack', label: 'expected closers', a: [] }]); return; }
          const top = st[st.length - 1];
          if (top !== c) { t.step(7, `'${c}' closes, but the most recent opener needs '${top}' → invalid.`, [{ t: 'array', label: 's', a, ptr: { i }, cls: { [i]: 'bad' }, cw: 30 }, { t: 'stack', label: 'expected closers', a: st.slice(), cls: { [st.length - 1]: 'bad' } }]); return; }
          st.pop();
          t.step(7, `'${c}' matches the top of the stack: pop.`, [{ t: 'array', label: 's', a, ptr: { i }, cls: { [i]: 'ok' }, cw: 30 }, { t: 'stack', label: 'expected closers', a: st.slice() }]);
        }
      }
      t.step(9, st.length ? `End of string with ${st.length} unclosed opener(s) → invalid.` : 'Every opener was closed in the right order → valid.', [{ t: 'array', label: 's', a, cw: 30 }, { t: 'stack', label: 'expected closers', a: st.slice(), cls: Object.fromEntries(st.map((_, k) => [k, 'bad'])) }]);
    },
  });

  add('monoStack', {
    title: 'Monotonic stack: next warmer day', sub: 'Keep indices whose answer is still unknown, with temperatures decreasing from bottom to top.',
    inputs: [{ key: 'temps', label: 'temperatures', type: 'ints', def: [73, 74, 75, 71, 69, 72, 76, 73] }],
    code: `
int[] dailyTemperatures(int[] temps) {
    int[] ans = new int[temps.length];
    Deque<Integer> st = new ArrayDeque<>();          // indices, temps decreasing
    for (int i = 0; i < temps.length; i++) {
        while (!st.isEmpty() && temps[i] > temps[st.peek()]) {
            int j = st.pop();                          // i is j's next warmer day
            ans[j] = i - j;
        }
        st.push(i);
    }
    return ans;                                      // left on the stack: 0
}`,
    run({ temps }, t) {
      const ans = temps.map(() => 0); const st = [];
      const view = (c = {}, ac = {}) => [{ t: 'array', label: 'temperatures', a: temps, cls: c }, { t: 'stack', label: 'stack of waiting indices (temps shown), top = right', a: st.map((j) => `${j}:${temps[j]}`) }, { t: 'array', label: 'answer (days to wait)', a: ans, cls: ac }];
      for (let i = 0; i < temps.length; i++) {
        t.step(5, `Day ${i} is ${temps[i]}°. Does it resolve anyone waiting on the stack?`, view({ [i]: 'active', ...Object.fromEntries(st.map((j) => [j, 'cmp'])) }));
        while (st.length && temps[i] > temps[st[st.length - 1]]) {
          const j = st.pop(); ans[j] = i - j;
          t.step(7, `${temps[i]} &gt; ${temps[j]}: day ${i} is day ${j}'s next warmer day → answer[${j}] = ${i - j}. Pop.`, view({ [i]: 'active', [j]: 'ok' }, { [j]: 'ok' }));
        }
        st.push(i);
        t.step(10, `Push day ${i}; it waits for something warmer. The stack stays decreasing.`, view({ [i]: 'active' }));
      }
      t.step(12, `Days still on the stack never warm up (answer 0). Each index is pushed and popped at most once: O(n).`, view(Object.fromEntries(st.map((j) => [j, 'dim']))));
    },
  });

  add('histogram', {
    title: 'Largest rectangle in a histogram', sub: 'A bar’s rectangle extends until the first shorter bar on each side, and the stack finds both.',
    inputs: [{ key: 'h', label: 'heights', type: 'ints', def: [2, 1, 5, 6, 2, 3] }],
    code: `
int largestRectangleArea(int[] h) {
    Deque<Integer> st = new ArrayDeque<>();     // indices of increasing heights
    int best = 0;
    for (int i = 0; i <= h.length; i++) {
        int cur = (i == h.length) ? 0 : h[i];   // sentinel 0 flushes the stack
        while (!st.isEmpty() && cur < h[st.peek()]) {
            int height = h[st.pop()];
            int left = st.isEmpty() ? -1 : st.peek();   // first shorter bar on the left
            best = Math.max(best, height * (i - left - 1));
        }
        st.push(i);
    }
    return best;
}`,
    run({ h }, t) {
      const st = []; let best = 0, bestSpan = null;
      const view = (c = {}) => [{ t: 'array', label: 'heights', a: h, bars: true, cls: c }, { t: 'stack', label: 'stack (indices), heights increasing', a: st.map((j) => `${j}:${h[j]}`) }, { t: 'vars', v: { best } }];
      for (let i = 0; i <= h.length; i++) {
        const cur = i === h.length ? 0 : h[i];
        if (i === h.length) t.step(5, 'Past the end: a sentinel height 0 forces every remaining bar to be resolved.', view());
        while (st.length && cur < h[st[st.length - 1]]) {
          const top = st.pop(), height = h[top];
          const left = st.length ? st[st.length - 1] : -1;
          const area = height * (i - left - 1);
          if (area > best) { best = area; bestSpan = [left + 1, i - 1]; }
          t.step(9, `${i === h.length ? 'End' : `Bar ${i} (${cur})`} is shorter than bar ${top} (${height}): bar ${top}'s rectangle spans (${left}, ${i}), so width ${i - left - 1} and area <b>${area}</b>.`, view({ ...rangeCls(left + 1, i - 1, 'range'), [top]: 'cmp', ...(i < h.length ? { [i]: 'active' } : {}) }));
        }
        if (i < h.length) { st.push(i); t.step(11, `Push bar ${i} (${h[i]}).`, view({ [i]: 'active' })); }
      }
      t.step(13, `Largest area: ${best}${bestSpan ? ` (bars ${bestSpan[0]}–${bestSpan[1]})` : ''}. O(n): every bar is pushed and popped once.`, view(bestSpan ? rangeCls(bestSpan[0], bestSpan[1], 'ok') : {}));
    },
  });

  add('slidingMaxDeque', {
    title: 'Sliding window maximum (monotonic deque)', sub: 'The deque holds candidate indices with decreasing values; the front is the current max.',
    inputs: [{ key: 'nums', label: 'nums', type: 'ints', def: [1, 3, -1, -3, 5, 3, 6, 7] }, { key: 'k', label: 'k', type: 'int', def: 3 }],
    check: ({ nums, k }) => (k < 1 || k > nums.length ? 'need 1 ≤ k ≤ nums.length' : null),
    code: `
int[] maxSlidingWindow(int[] nums, int k) {
    int[] res = new int[nums.length - k + 1];
    Deque<Integer> dq = new ArrayDeque<>();           // indices, values decreasing
    for (int i = 0; i < nums.length; i++) {
        if (!dq.isEmpty() && dq.peekFirst() <= i - k) dq.pollFirst();   // fell out of the window
        while (!dq.isEmpty() && nums[dq.peekLast()] <= nums[i]) dq.pollLast(); // can never be max again
        dq.offerLast(i);
        if (i >= k - 1) res[i - k + 1] = nums[dq.peekFirst()];
    }
    return res;
}`,
    run({ nums, k }, t) {
      const dq = []; const res = [];
      const view = (i, c = {}) => [{ t: 'array', label: 'nums', a: nums, range: [Math.max(0, i - k + 1), i], cls: c }, { t: 'stack', label: 'deque of indices (front → back), values decreasing', a: dq.map((j) => `${j}:${nums[j]}`), kind: 'deque' }, { t: 'array', label: 'result', a: res.slice() }];
      for (let i = 0; i < nums.length; i++) {
        if (dq.length && dq[0] <= i - k) { const j = dq.shift(); t.step(5, `Index ${j} left the window: drop it from the front.`, view(i, { [j]: 'dim' })); }
        while (dq.length && nums[dq[dq.length - 1]] <= nums[i]) { const j = dq.pop(); t.step(6, `nums[${j}] = ${nums[j]} ≤ nums[${i}] = ${nums[i]}: ${nums[j]} can never be the max while ${nums[i]} is in the window. Drop it from the back.`, view(i, { [j]: 'bad', [i]: 'active' })); }
        dq.push(i);
        if (i >= k - 1) { res.push(nums[dq[0]]); t.step(8, `Window [${i - k + 1}, ${i}]: max = nums[${dq[0]}] = <b>${nums[dq[0]]}</b> (the front).`, view(i, { [dq[0]]: 'ok', [i]: 'active' })); }
        else t.step(7, `Add index ${i}. The first window isn't full yet.`, view(i, { [i]: 'active' }));
      }
      t.step(11, 'Each index enters and leaves the deque once: O(n) total, where a heap would be O(n log n).', view(nums.length - 1));
    },
  });

  add('rpnEval', {
    title: 'Evaluating postfix (RPN) with a stack', sub: 'Numbers are pushed; an operator pops two operands and pushes the result.',
    inputs: [{ key: 'tokens', label: 'tokens', type: 'strs', def: ['4', '13', '5', '/', '+', '2', '*'] }],
    code: `
int evalRPN(String[] tokens) {
    Deque<Integer> st = new ArrayDeque<>();
    for (String tok : tokens) {
        switch (tok) {
            case "+" -> st.push(st.pop() + st.pop());
            case "-" -> { int b = st.pop(), a = st.pop(); st.push(a - b); }
            case "*" -> st.push(st.pop() * st.pop());
            case "/" -> { int b = st.pop(), a = st.pop(); st.push(a / b); }
            default -> st.push(Integer.parseInt(tok));
        }
    }
    return st.pop();
}`,
    run({ tokens }, t) {
      const st = [];
      for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if ('+-*/'.includes(tok) && tok.length === 1) {
          if (st.length < 2) { t.step(4, `'${tok}' needs two operands; the expression is malformed.`, [{ t: 'array', label: 'tokens', a: tokens, ptr: { i }, cls: { [i]: 'bad' } }, { t: 'stack', label: 'stack', a: st.slice() }]); return; }
          const b = st.pop(), a = st.pop();
          const r = tok === '+' ? a + b : tok === '-' ? a - b : tok === '*' ? a * b : Math.trunc(a / b);
          st.push(r);
          t.step(tok === '+' ? 5 : tok === '-' ? 6 : tok === '*' ? 7 : 8, `'${tok}': pop b = ${b} and a = ${a}, push a ${tok} b = ${r}${tok === '/' ? ' (Java truncates toward zero)' : ''}.`, [{ t: 'array', label: 'tokens', a: tokens, ptr: { i }, cls: { [i]: 'active' } }, { t: 'stack', label: 'stack', a: st.slice(), cls: { [st.length - 1]: 'ok' } }]);
        } else { st.push(+tok); t.step(9, `Number ${tok}: push.`, [{ t: 'array', label: 'tokens', a: tokens, ptr: { i }, cls: { [i]: 'active' } }, { t: 'stack', label: 'stack', a: st.slice(), cls: { [st.length - 1]: 'active' } }]); }
      }
      t.step(12, `The final value on the stack is the answer: <b>${st[st.length - 1]}</b>.`, [{ t: 'array', label: 'tokens', a: tokens }, { t: 'stack', label: 'stack', a: st.slice(), cls: { [st.length - 1]: 'ok' } }]);
    },
  });

  /* ═════════════ Binary search ═════════════ */
  add('lowerBound', {
    title: 'Binary search: first index where the condition turns true', sub: 'Keep the answer inside [lo, hi); every step halves the range.',
    inputs: [{ key: 'nums', label: 'nums (sorted)', type: 'ints', def: [1, 3, 3, 5, 8, 8, 8, 12, 15, 20] }, { key: 'target', label: 'target', type: 'int', def: 8 }],
    check: ({ nums }) => (nums.every((x, i) => !i || nums[i - 1] <= x) ? null : 'nums must be sorted'),
    code: `
// first index i with nums[i] >= target (nums.length if none)
int lowerBound(int[] nums, int target) {
    int lo = 0, hi = nums.length;          // answer is in [lo, hi]
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (nums[mid] >= target) hi = mid; // mid might be the answer: keep it
        else lo = mid + 1;                 // mid is too small: discard it
    }
    return lo;
}`,
    run({ nums, target }, t) {
      let lo = 0, hi = nums.length;
      const cond = nums.map((x) => (x >= target ? 'T' : 'F'));
      const view = (mid, c = {}) => [{ t: 'array', label: 'nums', a: nums, ptr: { lo: [lo, 'bot', 1], hi: [hi, 'bot', 2], ...(mid !== undefined ? { mid: [mid, 'top', 3] } : {}) }, range: [lo, hi - 1], cls: { ...Object.fromEntries(nums.map((_, i) => [i, i < lo || i >= hi ? 'dim' : ''])), ...c } }, { t: 'array', label: `condition: nums[i] ≥ ${target}`, a: cond, noIdx: true, cls: Object.fromEntries(cond.map((x, i) => [i, x === 'T' ? 'ok' : 'bad'])) }];
      t.step(4, `The condition is F…F then T…T (the array is sorted). We want the first T. Search space: [${lo}, ${hi}].`, view());
      while (lo < hi) {
        const mid = lo + ((hi - lo) >> 1);
        if (nums[mid] >= target) { t.step(7, `nums[${mid}] = ${nums[mid]} ≥ ${target}: T. The answer is at ${mid} or to its left → hi = ${mid}.`, view(mid, { [mid]: 'ok' })); hi = mid; }
        else { t.step(8, `nums[${mid}] = ${nums[mid]} &lt; ${target}: F. The answer is to the right → lo = ${mid + 1}.`, view(mid, { [mid]: 'bad' })); lo = mid + 1; }
      }
      t.step(10, lo < nums.length ? `lo == hi == ${lo}: the first index with nums[i] ≥ ${target}. ${nums[lo] === target ? 'The target is present.' : 'The target is absent; this is where it would be inserted.'} ${Math.ceil(Math.log2(nums.length + 1))} steps at most.` : `lo == ${lo} == length: every element is smaller than ${target}.`, view(undefined, lo < nums.length ? { [lo]: 'ok' } : {}));
    },
  });

  add('answerSearch', {
    title: 'Binary search on the answer (Koko’s bananas)', sub: 'Feasibility is monotone in the speed: too slow → F, fast enough → T. Find the first T.',
    inputs: [{ key: 'piles', label: 'piles', type: 'ints', def: [3, 6, 7, 11] }, { key: 'h', label: 'hours h', type: 'int', def: 8 }],
    check: ({ piles, h }) => (piles.length > h ? 'h must be ≥ number of piles' : Math.max(...piles) > 40 ? 'keep piles ≤ 40 so the speed axis fits' : null),
    code: `
int minEatingSpeed(int[] piles, int h) {
    int lo = 1, hi = Arrays.stream(piles).max().getAsInt();
    while (lo < hi) {
        int k = lo + (hi - lo) / 2;
        if (hours(piles, k) <= h) hi = k;    // fast enough: try slower
        else lo = k + 1;                     // too slow
    }
    return lo;
}
long hours(int[] piles, int k) {
    long t = 0;
    for (int p : piles) t += (p + k - 1) / k;   // ceil(p / k)
    return t;
}`,
    run({ piles, h }, t) {
      const max = Math.max(...piles);
      const speeds = Array.from({ length: max }, (_, i) => i + 1);
      const hours = (k) => piles.reduce((a, p) => a + Math.ceil(p / k), 0);
      const known = {};
      let lo = 1, hi = max;
      const view = (k, extra = {}) => [
        { t: 'array', label: 'candidate speeds k', a: speeds, ptr: { lo: [lo - 1, 'bot', 1], hi: [hi - 1, 'bot', 2], ...(k ? { k: [k - 1, 'top', 3] } : {}) }, cls: { ...Object.fromEntries(speeds.map((s) => [s - 1, s < lo || s > hi ? 'dim' : ''])), ...Object.fromEntries(Object.entries(known).map(([s, ok]) => [s - 1, ok ? 'ok' : 'bad'])) }, noIdx: true, cw: 30 },
        { t: 'vars', v: { h, ...extra } },
      ];
      t.step(3, `The answer is a speed between 1 and max(piles) = ${max}. Checking one speed costs O(n), and faster is always at least as feasible. So binary-search the speeds instead of trying them all.`, view());
      while (lo < hi) {
        const k = lo + ((hi - lo) >> 1); const hrs = hours(k); const ok = hrs <= h; known[k] = ok;
        t.step(ok ? 6 : 7, `k = ${k}: ${piles.map((p) => `⌈${p}/${k}⌉`).join(' + ')} = ${hrs} hours ${ok ? `≤ ${h}: feasible → hi = ${k}` : `&gt; ${h}: too slow → lo = ${k + 1}`}.`, view(k, { k, hours: hrs }));
        if (ok) hi = k; else lo = k + 1;
      }
      known[lo] = true;
      t.step(9, `Minimum feasible speed: <b>${lo}</b> (${hours(lo)} hours). O(n log max) instead of O(n · max).`, view(lo, { answer: lo }));
    },
  });

  add('rotatedSearch', {
    title: 'Search in a rotated sorted array', sub: 'One half around mid is always sorted. Check whether the target lies in that half.',
    inputs: [{ key: 'nums', label: 'nums (rotated, distinct)', type: 'ints', def: [15, 18, 22, 3, 5, 7, 9, 11, 13] }, { key: 'target', label: 'target', type: 'int', def: 9 }],
    code: `
int search(int[] nums, int target) {
    int lo = 0, hi = nums.length - 1;
    while (lo <= hi) {
        int mid = (lo + hi) >>> 1;
        if (nums[mid] == target) return mid;
        if (nums[lo] <= nums[mid]) {                        // left half is sorted
            if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
            else lo = mid + 1;
        } else {                                            // right half is sorted
            if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
            else hi = mid - 1;
        }
    }
    return -1;
}`,
    run({ nums, target }, t) {
      let lo = 0, hi = nums.length - 1;
      const view = (mid, c = {}) => [{ t: 'array', label: 'nums', a: nums, ptr: { lo: [lo, 'bot', 1], hi: [hi, 'bot', 2], ...(mid !== undefined ? { mid: [mid, 'top', 3] } : {}) }, cls: { ...Object.fromEntries(nums.map((_, i) => [i, i < lo || i > hi ? 'dim' : ''])), ...c } }, { t: 'vars', v: { target } }];
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (nums[mid] === target) { t.step(5, `nums[${mid}] = ${target}: found.`, view(mid, { [mid]: 'ok' })); return; }
        if (nums[lo] <= nums[mid]) {
          const inLeft = nums[lo] <= target && target < nums[mid];
          t.step(6, `nums[lo] = ${nums[lo]} ≤ nums[mid] = ${nums[mid]}, so the left half [${lo}, ${mid}] is sorted. Is ${target} in [${nums[lo]}, ${nums[mid]})? ${inLeft ? 'Yes → go left.' : 'No → go right.'}`, view(mid, { ...rangeCls(lo, mid, 'blue'), [mid]: 'cmp' }));
          if (inLeft) hi = mid - 1; else lo = mid + 1;
        } else {
          const inRight = nums[mid] < target && target <= nums[hi];
          t.step(10, `The left half isn't sorted, so the right half [${mid}, ${hi}] is. Is ${target} in (${nums[mid]}, ${nums[hi]}]? ${inRight ? 'Yes → go right.' : 'No → go left.'}`, view(mid, { ...rangeCls(mid, hi, 'blue'), [mid]: 'cmp' }));
          if (inRight) lo = mid + 1; else hi = mid - 1;
        }
      }
      t.step(15, `${target} is not in the array → −1. Still O(log n).`, view());
    },
  });

  /* ═════════════ Linked lists ═════════════ */
  const mkList = (vals) => ({ nodes: vals.map((v, i) => ({ id: 'n' + i, v })), next: Object.fromEntries(vals.map((_, i) => ['n' + i, i + 1 < vals.length ? 'n' + (i + 1) : null])) });

  add('reverseList', {
    title: 'Reversing a linked list in place', sub: 'Three pointers: save next, flip curr.next back to prev, advance both.',
    inputs: [{ key: 'vals', label: 'list', type: 'ints', def: [1, 2, 3, 4, 5] }],
    check: ({ vals }) => (vals.length > 9 ? 'at most 9 nodes' : null),
    code: `
ListNode reverseList(ListNode head) {
    ListNode prev = null, curr = head;
    while (curr != null) {
        ListNode next = curr.next;   // 1. remember the rest
        curr.next = prev;            // 2. flip the pointer
        prev = curr;                 // 3. advance prev
        curr = next;                 //    and curr
    }
    return prev;                     // the old tail is the new head
}`,
    run({ vals }, t) {
      const L = mkList(vals);
      let prev = null, curr = vals.length ? 'n0' : null;
      const view = (ptr, ecls = {}) => [{ t: 'list', label: 'nodes (arrows are next pointers)', nodes: L.nodes, next: { ...L.next }, ptr, ecls, cls: prev ? { [prev]: 'ok' } : {} }];
      t.step(2, 'prev starts at null, curr at the head.', view({ prev, curr }));
      while (curr) {
        const next = L.next[curr];
        t.step(4, 'Save <code>next</code>. Without it, flipping curr.next would lose the rest of the list.', view({ prev, curr, next }));
        L.next[curr] = prev;
        t.step(5, 'Flip: curr.next now points back to prev.', view({ prev, curr, next }, { [curr]: 'active' }));
        prev = curr; curr = next;
        t.step(7, 'Advance prev and curr one step.', view({ prev, curr }));
      }
      t.step(9, 'curr is null: prev is the new head. O(n) time, O(1) extra space.', view({ head: prev }));
    },
  });

  add('floydCycle', {
    title: 'Floyd’s cycle detection (tortoise and hare)', sub: 'slow moves 1 step, fast moves 2. If there is a cycle, fast laps slow inside it.',
    inputs: [{ key: 'vals', label: 'list', type: 'ints', def: [3, 2, 0, -4, 7, 9] }, { key: 'pos', label: 'tail links to index (−1 = no cycle)', type: 'int', def: 1 }],
    check: ({ vals, pos }) => (vals.length > 9 ? 'at most 9 nodes' : pos < -1 || pos >= vals.length ? 'pos must be −1 or a valid index' : null),
    code: `
boolean hasCycle(ListNode head) {
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;          // 1 step
        fast = fast.next.next;     // 2 steps
        if (slow == fast) return true;   // fast caught up from behind
    }
    return false;                  // fast fell off the end
}`,
    run({ vals, pos }, t) {
      const L = mkList(vals);
      if (pos >= 0 && vals.length) L.next['n' + (vals.length - 1)] = 'n' + pos;
      let slow = vals.length ? 'n0' : null, fast = slow, steps = 0;
      const view = (c = {}) => [{ t: 'list', label: pos >= 0 ? `the tail links back to index ${pos}` : 'no cycle', nodes: L.nodes, next: L.next, ptr: { slow, fast }, cls: c }];
      t.step(2, 'Both start at the head.', view());
      while (fast && L.next[fast]) {
        slow = L.next[slow]; fast = L.next[L.next[fast]]; steps++;
        if (slow === fast) { t.step(6, `They meet after ${steps} steps → there is a cycle. (To find where it starts, move one pointer back to the head and advance both one step at a time until they meet.)`, view({ [slow]: 'ok' })); return; }
        t.step(5, `Step ${steps}: slow → ${slow ? vals[+slow.slice(1)] : 'null'}, fast → ${fast ? vals[+fast.slice(1)] : 'null'}.`, view({ ...(slow ? { [slow]: 'active' } : {}), ...(fast ? { [fast]: 'cmp' } : {}) }));
      }
      t.step(9, 'fast reached the end (null) → no cycle. O(n) time, O(1) space; no HashSet of visited nodes needed.', view());
    },
  });

  add('mergeLists', {
    title: 'Merging two sorted lists', sub: 'A dummy head plus a tail pointer: repeatedly attach the smaller front node.',
    inputs: [{ key: 'a', label: 'list A (sorted)', type: 'ints', def: [1, 3, 4, 8] }, { key: 'b', label: 'list B (sorted)', type: 'ints', def: [1, 2, 6] }],
    check: ({ a, b }) => (a.length + b.length > 10 ? 'at most 10 nodes in total' : null),
    code: `
ListNode mergeTwoLists(ListNode a, ListNode b) {
    ListNode dummy = new ListNode(0), tail = dummy;
    while (a != null && b != null) {
        if (a.val <= b.val) { tail.next = a; a = a.next; }
        else { tail.next = b; b = b.next; }
        tail = tail.next;
    }
    tail.next = (a != null) ? a : b;   // attach whatever is left
    return dummy.next;
}`,
    run({ a, b }, t) {
      let i = 0, j = 0; const merged = [];
      const view = (hl) => [
        { t: 'stack', label: 'A (remaining)', a: a.slice(i), kind: 'list', cls: hl === 'a' ? { 0: 'active' } : {} },
        { t: 'stack', label: 'B (remaining)', a: b.slice(j), kind: 'list', cls: hl === 'b' ? { 0: 'active' } : {} },
        { t: 'stack', label: 'dummy → merged (tail = last)', a: ['D', ...merged], kind: 'list', cls: { 0: 'dim', [merged.length]: merged.length ? 'ok' : '' } },
      ];
      t.step(2, 'The dummy node means we never special-case "the result is empty so far".', view());
      while (i < a.length && j < b.length) {
        if (a[i] <= b[j]) { t.step(4, `${a[i]} ≤ ${b[j]}: attach A's front node.`, view('a')); merged.push(a[i++]); }
        else { t.step(5, `${b[j]} &lt; ${a[i]}: attach B's front node.`, view('b')); merged.push(b[j++]); }
        t.step(7, 'Advance the tail.', view());
      }
      const rest = i < a.length ? a.slice(i) : b.slice(j);
      merged.push(...rest); i = a.length; j = b.length;
      t.step(9, `One list is empty: attach the other's remainder (${rest.length ? rest.join(', ') : 'nothing'}) in one step. It's already sorted.`, view());
      t.step(10, 'Return dummy.next. O(n + m) time, O(1) extra space: we relink existing nodes.', view());
    },
  });

  add('removeNth', {
    title: 'Remove the n-th node from the end (one pass)', sub: 'Put fast n+1 steps ahead of slow; when fast hits null, slow is just before the target.',
    inputs: [{ key: 'vals', label: 'list', type: 'ints', def: [1, 2, 3, 4, 5, 6] }, { key: 'n', label: 'n', type: 'int', def: 2 }],
    check: ({ vals, n }) => (vals.length > 9 ? 'at most 9 nodes' : n < 1 || n > vals.length ? 'need 1 ≤ n ≤ length' : null),
    code: `
ListNode removeNthFromEnd(ListNode head, int n) {
    ListNode dummy = new ListNode(0, head), slow = dummy, fast = dummy;
    for (int i = 0; i <= n; i++) fast = fast.next;   // gap of n + 1
    while (fast != null) { slow = slow.next; fast = fast.next; }
    slow.next = slow.next.next;                      // skip the target
    return dummy.next;
}`,
    run({ vals, n }, t) {
      const L = mkList(['D', ...vals]);
      L.nodes[0].v = 'dummy';
      let slow = 'n0', fast = 'n0';
      const view = (c = {}) => [{ t: 'list', label: 'dummy → list', nodes: L.nodes, next: L.next, ptr: { slow, fast }, cls: { n0: 'dim', ...c } }];
      t.step(2, 'A dummy node before the head means even removing the head is the ordinary case.', view());
      for (let i = 0; i <= n; i++) { fast = L.next[fast]; t.step(3, `Move fast ahead: step ${i + 1} of ${n + 1}.`, view()); }
      while (fast) { slow = L.next[slow]; fast = L.next[fast]; t.step(4, 'Move both one step. The gap stays at n + 1.', view()); }
      const target = L.next[slow];
      t.step(5, `fast is null, so slow is right before the ${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} node from the end. Skip it.`, view({ [target]: 'bad' }));
      L.next[slow] = L.next[target]; L.nodes = L.nodes.filter((x) => x.id !== target);
      t.step(6, 'Done in one pass with O(1) extra space.', view());
    },
  });
})();

/* DSA Lab — algorithm tracers for the visualizer (see viz.js for the view format). */
(function () {
  'use strict';
  const V = window.DSAViz;
  const add = V.add;
  const cls = V.H.cls;

  /* ═════════════ Arrays & hashing ═════════════ */
  add('twoSumMap', {
    title: 'Two Sum with a hash map', sub: 'One pass: for each number, look up the complement you need.',
    inputs: [{ key: 'nums', label: 'nums', type: 'ints', def: [3, 8, 11, 2, 15, 7] }, { key: 'target', label: 'target', type: 'int', def: 9 }],
    code: `
int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> seen = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        int need = target - nums[i];
        Integer j = seen.get(need);
        if (j != null) return new int[]{j, i};
        seen.put(nums[i], i);
    }
    return new int[0];
}`,
    run({ nums, target }, t) {
      const seen = new Map();
      const map = (hl, c = 'active') => ({ t: 'map', label: 'seen (value → index)', e: [...seen.entries()], cls: hl !== undefined ? { [hl]: c } : {} });
      t.step(2, `Start with an empty map. We scan once, and every number looks for its <b>complement</b> <code>target − x</code> among the numbers <i>before</i> it.`, [{ t: 'array', label: 'nums', a: nums }, map(), { t: 'vars', v: { target } }]);
      for (let i = 0; i < nums.length; i++) {
        const need = target - nums[i];
        t.step(4, `i = ${i}: need = ${target} − ${nums[i]} = <b>${need}</b>. Is ${need} in the map?`, [{ t: 'array', label: 'nums', a: nums, ptr: { i }, cls: { [i]: 'active' } }, map(seen.has(need) ? need : undefined, 'ok'), { t: 'vars', v: { target, i, need }, chg: ['need'] }]);
        if (seen.has(need)) {
          const j = seen.get(need);
          t.step(6, `Found: ${need} was at index ${j}, so nums[${j}] + nums[${i}] = ${target}. Return <b>[${j}, ${i}]</b>. One pass, O(n).`, [{ t: 'array', label: 'nums', a: nums, ptr: { j: [j, 'bot', 4], i }, cls: { [j]: 'ok', [i]: 'ok' } }, map(need, 'ok'), { t: 'vars', v: { target, i, need } }]);
          return;
        }
        seen.set(nums[i], i);
        t.step(7, `Not there. Remember ${nums[i]} → ${i} for the numbers still to come.`, [{ t: 'array', label: 'nums', a: nums, ptr: { i }, cls: { [i]: 'active' } }, map(nums[i]), { t: 'vars', v: { target, i, need } }]);
      }
      t.step(9, 'No pair adds up to the target.', [{ t: 'array', label: 'nums', a: nums }, map()]);
    },
  });

  add('anagramCount', {
    title: 'Counting letters with an int[26]', sub: 'Add counts for s, subtract for t; anagrams end at all zeros.',
    inputs: [{ key: 's', label: 's', type: 'str', def: 'listen' }, { key: 't', label: 't', type: 'str', def: 'silent' }],
    code: `
boolean isAnagram(String s, String t) {
    if (s.length() != t.length()) return false;
    int[] count = new int[26];
    for (int i = 0; i < s.length(); i++) {
        count[s.charAt(i) - 'a']++;
        count[t.charAt(i) - 'a']--;
    }
    for (int c : count) if (c != 0) return false;
    return true;
}`,
    check: ({ s, t: x }) => (/^[a-z]*$/.test(s + x) ? (s.length + x.length > 40 ? 'keep it under 20 letters each' : null) : 'use lowercase a–z only'),
    run({ s, t: t2 }, t) {
      const letters = [...new Set((s + t2).split(''))].sort();
      const cnt = Object.fromEntries(letters.map((c) => [c, 0]));
      const view = (hl) => ({ t: 'array', label: 'count[c − \'a\'] (only letters that appear)', a: letters.map((c) => cnt[c]), idx: letters, cls: Object.fromEntries(letters.map((c, k) => [k, c === hl ? 'active' : cnt[c] === 0 ? '' : cnt[c] > 0 ? 'cmp' : 'bad'])) });
      if (s.length !== t2.length) { t.step(2, `Lengths differ (${s.length} vs ${t2.length}): can't be anagrams.`, []); return; }
      t.step(3, 'One counter per letter. Each letter of <code>s</code> adds 1 and each letter of <code>t</code> subtracts 1.', [{ t: 'array', label: 's', a: s.split('') }, { t: 'array', label: 't', a: t2.split('') }, view()]);
      for (let i = 0; i < s.length; i++) {
        cnt[s[i]]++;
        t.step(5, `s[${i}] = '${s[i]}' → count['${s[i]}']++`, [{ t: 'array', label: 's', a: s.split(''), ptr: { i }, cls: { [i]: 'active' } }, { t: 'array', label: 't', a: t2.split('') }, view(s[i])]);
        cnt[t2[i]]--;
        t.step(6, `t[${i}] = '${t2[i]}' → count['${t2[i]}']--`, [{ t: 'array', label: 's', a: s.split('') }, { t: 'array', label: 't', a: t2.split(''), ptr: { i }, cls: { [i]: 'active' } }, view(t2[i])]);
      }
      const bad = letters.filter((c) => cnt[c] !== 0);
      t.step(8, bad.length ? `Non-zero counts for ${bad.map((c) => `'${c}'`).join(', ')}: <b>not</b> anagrams.` : 'Every count is back to 0, so the two strings use exactly the same letters: <b>anagrams</b>. O(n) time, O(1) space (26 counters).', [{ t: 'array', label: 's', a: s.split('') }, { t: 'array', label: 't', a: t2.split('') }, view()]);
    },
  });

  add('groupAnagrams', {
    title: 'Grouping by a canonical key', sub: 'Words that are anagrams share the same sorted-letters key.',
    inputs: [{ key: 'words', label: 'words', type: 'strs', def: ['eat', 'tea', 'tan', 'ate', 'nat', 'bat'] }],
    code: `
List<List<String>> groupAnagrams(String[] strs) {
    Map<String, List<String>> groups = new HashMap<>();
    for (String s : strs) {
        char[] c = s.toCharArray();
        Arrays.sort(c);
        String key = new String(c);
        groups.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
    }
    return new ArrayList<>(groups.values());
}`,
    run({ words }, t) {
      const g = new Map();
      const mv = (hl) => ({ t: 'map', label: 'groups (key → words)', e: [...g.entries()].map(([k, v]) => [k, v]), cls: hl ? { [hl]: 'active' } : {} });
      t.step(2, 'Map each word to a <b>canonical key</b> that all its anagrams share: here, its letters sorted.', [{ t: 'array', label: 'words', a: words }, mv()]);
      words.forEach((w, i) => {
        const key = w.split('').sort().join('');
        t.step(6, `"${w}" sorted is <b>"${key}"</b>.`, [{ t: 'array', label: 'words', a: words, ptr: { w: i }, cls: { [i]: 'active' } }, mv(g.has(key) ? key : null)]);
        if (!g.has(key)) g.set(key, []);
        g.get(key).push(w);
        t.step(7, g.get(key).length > 1 ? `Key "${key}" exists: add "${w}" to its group.` : `New key "${key}": start a group.`, [{ t: 'array', label: 'words', a: words, ptr: { w: i }, cls: { [i]: 'ok' } }, mv(key)]);
      });
      t.step(9, `Each map value is one group: ${g.size} groups. Sorting each key costs O(k log k), so the total is O(n · k log k).`, [mv()]);
    },
  });

  add('longestConsecutive', {
    title: 'Longest consecutive run with a set', sub: 'Only start counting at numbers that begin a run (x − 1 is absent).',
    inputs: [{ key: 'nums', label: 'nums', type: 'ints', def: [100, 4, 200, 1, 3, 2, 101] }],
    code: `
int longestConsecutive(int[] nums) {
    Set<Integer> set = new HashSet<>();
    for (int x : nums) set.add(x);
    int best = 0;
    for (int x : set) {
        if (set.contains(x - 1)) continue;   // not a run start
        int len = 1;
        while (set.contains(x + len)) len++;
        best = Math.max(best, len);
    }
    return best;
}`,
    run({ nums }, t) {
      const set = [...new Set(nums)];
      const has = new Set(set);
      let best = 0;
      const sv = (c) => ({ t: 'map', label: 'set', e: set.map((x) => [x]), cls: c || {} });
      t.step(3, 'Put everything in a HashSet: O(1) membership checks.', [{ t: 'array', label: 'nums', a: nums }, sv()]);
      for (const x of set) {
        if (has.has(x - 1)) { t.step(6, `${x}: ${x - 1} is in the set, so ${x} is in the middle of a run. <b>Skip</b>; its run will be counted from its start.`, [sv({ [x]: 'cmp', [x - 1]: 'active' }), { t: 'vars', v: { best } }]); continue; }
        let len = 1;
        const c = { [x]: 'ok' };
        t.step(7, `${x}: ${x - 1} is absent, so ${x} <b>starts</b> a run. Walk upward.`, [sv(c), { t: 'vars', v: { x, len, best } }]);
        while (has.has(x + len)) { c[x + len] = 'ok'; len++; t.step(8, `${x + len - 1} is present → len = ${len}`, [sv({ ...c }), { t: 'vars', v: { x, len, best }, chg: ['len'] }]); }
        best = Math.max(best, len);
        t.step(9, `Run from ${x} has length ${len}. best = ${best}.`, [sv(c), { t: 'vars', v: { x, len, best }, chg: ['best'] }]);
      }
      t.step(11, `Answer: <b>${best}</b>. Each number is visited at most twice (once as a candidate, once inside a run), so O(n) overall.`, [sv(), { t: 'vars', v: { best } }]);
    },
  });

  add('prefixSumMap', {
    title: 'Subarray sum = k with prefix sums', sub: 'sum(i+1..j) = prefix[j] − prefix[i]. Count earlier prefixes equal to prefix − k.',
    inputs: [{ key: 'nums', label: 'nums', type: 'ints', def: [1, 2, -1, 3, -2, 2] }, { key: 'k', label: 'k', type: 'int', def: 3 }],
    code: `
int subarraySum(int[] nums, int k) {
    Map<Integer, Integer> count = new HashMap<>();
    count.put(0, 1);              // the empty prefix
    int prefix = 0, result = 0;
    for (int x : nums) {
        prefix += x;
        result += count.getOrDefault(prefix - k, 0);
        count.merge(prefix, 1, Integer::sum);
    }
    return result;
}`,
    run({ nums, k }, t) {
      const count = new Map([[0, 1]]);
      let prefix = 0, result = 0;
      const pre = [0]; for (const x of nums) pre.push(pre[pre.length - 1] + x);
      const mv = (hl, c = 'active') => ({ t: 'map', label: 'count (prefix sum → how many times)', e: [...count.entries()], cls: hl !== undefined ? { [hl]: c } : {} });
      t.step(3, 'Seed the map with prefix 0 seen once: the empty prefix, so subarrays that start at index 0 get counted.', [{ t: 'array', label: 'nums', a: nums }, mv(0), { t: 'vars', v: { k, prefix, result } }]);
      nums.forEach((x, j) => {
        prefix += x;
        const want = prefix - k;
        const hits = count.get(want) || 0;
        const starts = [];
        for (let i = 0; i <= j; i++) if (pre[i] === want) starts.push(i);
        t.step(7, `j = ${j}: prefix = ${prefix}. Any earlier prefix equal to ${prefix} − ${k} = <b>${want}</b> marks a subarray summing to ${k}. Found <b>${hits}</b>.`,
          [{ t: 'array', label: 'nums', a: nums, ptr: { j }, cls: cls([j, 'active']), range: starts.length ? [starts[starts.length - 1], j] : undefined }, mv(hits ? want : undefined, 'ok'), { t: 'vars', v: { k, prefix, want, result: result + hits }, chg: hits ? ['result'] : [] }]);
        result += hits;
        count.set(prefix, (count.get(prefix) || 0) + 1);
        t.step(8, `Record prefix ${prefix} (now seen ${count.get(prefix)}×).`, [{ t: 'array', label: 'nums', a: nums, ptr: { j } }, mv(prefix), { t: 'vars', v: { k, prefix, result } }]);
      });
      t.step(10, `Total: <b>${result}</b> subarrays. This works with negative numbers, where a sliding window would fail.`, [{ t: 'array', label: 'nums', a: nums }, mv(), { t: 'vars', v: { result } }]);
    },
  });

  add('productExcept', {
    title: 'Product except self: prefix × suffix', sub: 'answer[i] = (product of everything left of i) × (product of everything right of i).',
    inputs: [{ key: 'nums', label: 'nums', type: 'ints', def: [2, 3, 4, 5] }],
    code: `
int[] productExceptSelf(int[] nums) {
    int n = nums.length;
    int[] ans = new int[n];
    ans[0] = 1;
    for (int i = 1; i < n; i++) ans[i] = ans[i - 1] * nums[i - 1];  // left products
    int right = 1;
    for (int i = n - 1; i >= 0; i--) {
        ans[i] *= right;                                        // times right products
        right *= nums[i];
    }
    return ans;
}`,
    run({ nums }, t) {
      const n = nums.length, ans = Array(n).fill(null);
      ans[0] = 1;
      t.step(4, 'Pass 1 fills <code>ans[i]</code> with the product of everything to the <b>left</b> of i. Nothing is left of index 0, so it starts at 1.', [{ t: 'array', label: 'nums', a: nums }, { t: 'array', label: 'ans', a: ans, cls: { 0: 'active' } }]);
      for (let i = 1; i < n; i++) {
        ans[i] = ans[i - 1] * nums[i - 1];
        t.step(5, `ans[${i}] = ans[${i - 1}] × nums[${i - 1}] = ${ans[i - 1]} × ${nums[i - 1]} = <b>${ans[i]}</b>`, [{ t: 'array', label: 'nums', a: nums, range: [0, i - 1] }, { t: 'array', label: 'ans (left products)', a: ans, ptr: { i }, cls: { [i]: 'active' } }]);
      }
      let right = 1;
      for (let i = n - 1; i >= 0; i--) {
        const before = ans[i];
        ans[i] *= right;
        t.step(8, `Pass 2 (right to left): ans[${i}] = ${before} × right(${right}) = <b>${ans[i]}</b>`, [{ t: 'array', label: 'nums', a: nums, range: i + 1 <= n - 1 ? [i + 1, n - 1] : undefined }, { t: 'array', label: 'ans', a: ans, ptr: { i }, cls: { [i]: 'ok' } }, { t: 'vars', v: { right } }]);
        right *= nums[i];
        t.step(9, `right *= nums[${i}] → ${right}`, [{ t: 'array', label: 'nums', a: nums, ptr: { i }, cls: { [i]: 'cmp' } }, { t: 'array', label: 'ans', a: ans }, { t: 'vars', v: { right }, chg: ['right'] }]);
      }
      t.step(11, 'Done without division, in O(n) time and O(1) extra space (the output array doesn’t count).', [{ t: 'array', label: 'nums', a: nums }, { t: 'array', label: 'ans', a: ans, cls: Object.fromEntries(ans.map((_, i) => [i, 'ok'])) }]);
    },
  });

  add('diffArray', {
    title: 'Difference array for range updates', sub: 'Add at the start, subtract after the end; a prefix sum rebuilds the values.',
    inputs: [{ key: 'trips', label: 'trips [people, from, to]', type: 'matrix', def: [[2, 1, 5], [3, 3, 7], [1, 6, 8]] }, { key: 'capacity', label: 'capacity', type: 'int', def: 5 }],
    code: `
boolean carPooling(int[][] trips, int capacity) {
    int[] diff = new int[1001];
    for (int[] t : trips) {
        diff[t[1]] += t[0];     // people get on at 'from'
        diff[t[2]] -= t[0];     // and off at 'to'
    }
    int load = 0;
    for (int x = 0; x < diff.length; x++) {
        load += diff[x];
        if (load > capacity) return false;
    }
    return true;
}`,
    run({ trips, capacity }, t) {
      const hi = Math.max(...trips.map((x) => x[2])) + 1;
      const diff = Array(hi + 1).fill(0);
      t.step(2, 'One slot per position. Instead of adding people to every position of a trip (O(length)), mark only where the trip starts and ends.', [{ t: 'array', label: 'diff', a: diff }]);
      trips.forEach(([p, f, to], k) => {
        diff[f] += p; diff[to] -= p;
        t.step(5, `Trip ${k + 1}: +${p} at ${f}, −${p} at ${to}.`, [{ t: 'array', label: 'diff', a: diff, cls: { [f]: 'ok', [to]: 'bad' }, range: [f, to - 1] }]);
      });
      let load = 0; const loads = Array(hi + 1).fill(null);
      for (let x = 0; x <= hi; x++) {
        load += diff[x]; loads[x] = load;
        const over = load > capacity;
        t.step(over ? 10 : 9, `Position ${x}: running sum → load = <b>${load}</b>${over ? ` > capacity ${capacity}. Overloaded!` : ''}`, [{ t: 'array', label: 'diff', a: diff, ptr: { x } }, { t: 'array', label: 'load (prefix sum of diff)', a: loads, cls: { [x]: over ? 'bad' : 'active' } }, { t: 'vars', v: { load, capacity } }]);
        if (over) return;
      }
      t.step(12, 'The load never goes over capacity. Each trip cost O(1) to record, plus one O(range) sweep.', [{ t: 'array', label: 'load', a: loads }]);
    },
  });

  /* ═════════════ Two pointers ═════════════ */
  add('pairSumSorted', {
    title: 'Two pointers on a sorted array', sub: 'Too small → move L right. Too big → move R left.',
    inputs: [{ key: 'nums', label: 'nums (sorted)', type: 'ints', def: [1, 3, 4, 6, 8, 11, 14] }, { key: 'target', label: 'target', type: 'int', def: 17 }],
    check: ({ nums }) => (nums.every((x, i) => !i || nums[i - 1] <= x) ? null : 'nums must be sorted ascending'),
    code: `
int[] twoSum(int[] nums, int target) {
    int l = 0, r = nums.length - 1;
    while (l < r) {
        int sum = nums[l] + nums[r];
        if (sum == target) return new int[]{l, r};
        if (sum < target) l++;     // need bigger: drop the smallest
        else r--;                  // need smaller: drop the largest
    }
    return new int[0];
}`,
    run({ nums, target }, t) {
      let l = 0, r = nums.length - 1;
      const dim = {};
      const view = (c) => ({ t: 'array', label: 'nums', a: nums, ptr: { L: l, R: [r, 'top', 2] }, cls: { ...dim, ...c }, range: [l, r], noBracket: true });
      t.step(2, 'L at the smallest, R at the largest. The pair we want is somewhere inside [L, R].', [view({}), { t: 'vars', v: { target } }]);
      while (l < r) {
        const sum = nums[l] + nums[r];
        t.step(4, `sum = ${nums[l]} + ${nums[r]} = <b>${sum}</b> ${sum === target ? '=' : sum < target ? '<' : '>'} ${target}`, [view({ [l]: 'cmp', [r]: 'cmp' }), { t: 'vars', v: { target, sum }, chg: ['sum'] }]);
        if (sum === target) { t.step(5, `Found it: indices [${l}, ${r}].`, [view({ [l]: 'ok', [r]: 'ok' }), { t: 'vars', v: { target, sum } }]); return; }
        if (sum < target) { t.step(6, `Too small. nums[L] = ${nums[l]} can't be in any pair: even with the <i>largest</i> remaining number it falls short. Drop it: L++.`, [view({ [l]: 'bad' }), { t: 'vars', v: { target, sum } }]); dim[l] = 'dim'; l++; }
        else { t.step(7, `Too big. nums[R] = ${nums[r]} can't be in any pair: even with the <i>smallest</i> remaining number it overshoots. Drop it: R--.`, [view({ [r]: 'bad' }), { t: 'vars', v: { target, sum } }]); dim[r] = 'dim'; r--; }
      }
      t.step(9, 'Pointers met: no pair adds up to the target. Each step removed one candidate, so it took O(n).', [view({})]);
    },
  });

  add('removeDupes', {
    title: 'Reader / writer pointers', sub: 'r scans everything; w marks where the next kept element goes.',
    inputs: [{ key: 'nums', label: 'nums (sorted)', type: 'ints', def: [1, 1, 2, 3, 3, 3, 4, 5, 5] }],
    code: `
int removeDuplicates(int[] nums) {
    int w = 1;                            // nums[0..w) is the result
    for (int r = 1; r < nums.length; r++) {
        if (nums[r] != nums[w - 1]) {     // a new value
            nums[w] = nums[r];
            w++;
        }
    }
    return w;
}`,
    run({ nums }, t) {
      const a = nums.slice();
      if (!a.length) { t.step(9, 'Empty array → 0.', []); return; }
      let w = 1;
      const view = (c) => ({ t: 'array', label: 'nums', a, ptr: { w: [w, 'bot', 4], r: rr }, cls: { ...Object.fromEntries(Array.from({ length: w }, (_, i) => [i, 'ok'])), ...c } });
      let rr = 1;
      t.step(2, 'The prefix <code>nums[0..w)</code> (green) is the answer so far. The first element is always kept.', [view({})]);
      for (rr = 1; rr < a.length; rr++) {
        if (a[rr] !== a[w - 1]) {
          t.step(4, `nums[r] = ${a[rr]} differs from the last kept value ${a[w - 1]}: keep it.`, [view({ [rr]: 'active', [w - 1]: 'cmp' })]);
          a[w] = a[rr]; w++;
          t.step(6, `Copy it to position ${w - 1}, then w++.`, [view({ [w - 1]: 'active' })]);
        } else t.step(4, `nums[r] = ${a[rr]} equals the last kept value: a duplicate. Skip it.`, [view({ [rr]: 'dim', [w - 1]: 'cmp' })]);
      }
      t.step(9, `Return w = <b>${w}</b>. The first ${w} slots hold the unique values. O(n) time, O(1) extra space.`, [view({})]);
    },
  });

  add('dutchFlag', {
    title: 'Dutch national flag (3-way partition)', sub: '[0, low) are 0s · [low, mid) are 1s · (high, end] are 2s · [mid, high] unknown',
    inputs: [{ key: 'nums', label: 'nums (0/1/2)', type: 'ints', def: [2, 0, 2, 1, 1, 0, 1, 2, 0] }],
    check: ({ nums }) => (nums.every((x) => x === 0 || x === 1 || x === 2) ? null : 'only 0, 1 and 2'),
    code: `
void sortColors(int[] nums) {
    int low = 0, mid = 0, high = nums.length - 1;
    while (mid <= high) {
        if (nums[mid] == 0) swap(nums, low++, mid++);
        else if (nums[mid] == 1) mid++;
        else swap(nums, mid, high--);    // don't advance mid: the swapped-in value is unseen
    }
}`,
    run({ nums }, t) {
      const a = nums.slice();
      let low = 0, mid = 0, high = a.length - 1;
      const view = (c = {}) => {
        const k = {};
        for (let i = 0; i < a.length; i++) k[i] = i < low ? 'blue' : i < mid ? 'range' : i > high ? 'bad' : '';
        return { t: 'array', label: 'nums', a: a.slice(), ptr: { low: [low, 'bot', 3], mid, high: [high, 'top', 2] }, cls: { ...k, ...c } };
      };
      t.step(2, 'Three regions grow from the edges while the unknown middle shrinks.', [view()]);
      while (mid <= high) {
        const v = a[mid];
        if (v === 0) { t.step(4, `nums[mid] = 0 → swap into the 0-region at low, advance both.`, [view({ [mid]: 'active', [low]: 'cmp' })]); [a[low], a[mid]] = [a[mid], a[low]]; low++; mid++; }
        else if (v === 1) { t.step(5, 'nums[mid] = 1 → already in the right place; mid++.', [view({ [mid]: 'active' })]); mid++; }
        else { t.step(6, `nums[mid] = 2 → swap to the end (high), high--. Don't move mid: the value that came back is unexamined.`, [view({ [mid]: 'active', [high]: 'cmp' })]); [a[mid], a[high]] = [a[high], a[mid]]; high--; }
      }
      t.step(8, 'mid passed high: no unknowns left. Sorted in one pass, O(1) space.', [view()]);
    },
  });

  add('containerWater', {
    title: 'Container with most water', sub: 'Always move the shorter wall: the taller one can’t help any narrower container.',
    inputs: [{ key: 'h', label: 'height', type: 'ints', def: [1, 8, 6, 2, 5, 4, 8, 3, 7] }],
    code: `
int maxArea(int[] height) {
    int l = 0, r = height.length - 1, best = 0;
    while (l < r) {
        int area = Math.min(height[l], height[r]) * (r - l);
        best = Math.max(best, area);
        if (height[l] < height[r]) l++;
        else r--;
    }
    return best;
}`,
    run({ h }, t) {
      let l = 0, r = h.length - 1, best = 0, bestLR = null;
      const view = (c = {}, water) => ({ t: 'array', label: 'height', a: h, bars: true, water, ptr: { L: [l, 'bot', 1], R: [r, 'bot', 2] }, cls: c });
      const wat = () => h.map((x, i) => (i > l && i < r ? Math.max(0, Math.min(h[l], h[r]) - x) : 0));
      t.step(2, 'Start with the widest container.', [view()]);
      while (l < r) {
        const area = Math.min(h[l], h[r]) * (r - l);
        if (area > best) { best = area; bestLR = [l, r]; }
        t.step(4, `area = min(${h[l]}, ${h[r]}) × ${r - l} = <b>${area}</b>. best = ${best}.`, [view({ [l]: 'cmp', [r]: 'cmp' }, wat()), { t: 'vars', v: { area, best }, chg: area === best ? ['best'] : [] }]);
        if (h[l] < h[r]) { t.step(6, `Left wall (${h[l]}) is shorter. Pairing it with any closer right wall is narrower and no taller, so it's done: L++.`, [view({ [l]: 'bad' }), { t: 'vars', v: { best } }]); l++; }
        else { t.step(7, `Right wall (${h[r]}) is ${h[r] === h[l] ? 'no taller' : 'shorter'}: R--.`, [view({ [r]: 'bad' }), { t: 'vars', v: { best } }]); r--; }
      }
      t.step(9, `Best area <b>${best}</b>${bestLR ? ` between indices ${bestLR[0]} and ${bestLR[1]}` : ''}. O(n), because each step discards one wall for good.`, [view(bestLR ? { [bestLR[0]]: 'ok', [bestLR[1]]: 'ok' } : {}), { t: 'vars', v: { best } }]);
    },
  });

  add('trapWater', {
    title: 'Trapping rain water (two pointers)', sub: 'Water above i = min(maxLeft, maxRight) − height[i]. Process the side with the smaller max.',
    inputs: [{ key: 'h', label: 'height', type: 'ints', def: [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1] }],
    code: `
int trap(int[] h) {
    int l = 0, r = h.length - 1, leftMax = 0, rightMax = 0, water = 0;
    while (l < r) {
        if (h[l] < h[r]) {
            leftMax = Math.max(leftMax, h[l]);
            water += leftMax - h[l];   // bounded by leftMax: some right wall ≥ h[r] > h[l] exists
            l++;
        } else {
            rightMax = Math.max(rightMax, h[r]);
            water += rightMax - h[r];
            r--;
        }
    }
    return water;
}`,
    run({ h }, t) {
      let l = 0, r = h.length - 1, lm = 0, rm = 0, water = 0;
      const w = h.map(() => 0);
      const view = (c = {}) => ({ t: 'array', label: 'height (blue = trapped water)', a: h, bars: true, water: w.slice(), ptr: { L: [l, 'bot', 1], R: [r, 'bot', 2] }, cls: c });
      t.step(2, 'Water at a bar is limited by the shorter of the tallest bar on its left and the tallest on its right.', [view(), { t: 'vars', v: { leftMax: lm, rightMax: rm, water } }]);
      while (l < r) {
        if (h[l] < h[r]) {
          lm = Math.max(lm, h[l]); w[l] = lm - h[l]; water += w[l];
          t.step(6, `h[L] = ${h[L_(l)]} < h[R] = ${h[r]}: the right side has a wall at least as tall as leftMax, so leftMax (${lm}) is the limit. Water here: ${w[l]}.`, [view({ [l]: 'active' }), { t: 'vars', v: { leftMax: lm, rightMax: rm, water }, chg: ['water'] }]);
          l++;
        } else {
          rm = Math.max(rm, h[r]); w[r] = rm - h[r]; water += w[r];
          t.step(10, `h[R] = ${h[r]} ≤ h[L] = ${h[l]}: rightMax (${rm}) is the limit. Water here: ${w[r]}.`, [view({ [r]: 'active' }), { t: 'vars', v: { leftMax: lm, rightMax: rm, water }, chg: ['water'] }]);
          r--;
        }
      }
      t.step(14, `Total water: <b>${water}</b>. One pass, O(1) space, with no leftMax[]/rightMax[] arrays needed.`, [view(), { t: 'vars', v: { water } }]);
      function L_(x) { return x; }
    },
  });

  add('threeSum', {
    title: '3Sum: sort, fix one, two-pointer the rest', sub: 'Skip equal neighbours to avoid duplicate triplets.',
    inputs: [{ key: 'nums', label: 'nums', type: 'ints', def: [-1, 0, 1, 2, -1, -4, -2, 3] }],
    code: `
List<List<Integer>> threeSum(int[] nums) {
    Arrays.sort(nums);
    List<List<Integer>> res = new ArrayList<>();
    for (int i = 0; i < nums.length - 2 && nums[i] <= 0; i++) {
        if (i > 0 && nums[i] == nums[i - 1]) continue;   // same first number
        int l = i + 1, r = nums.length - 1;
        while (l < r) {
            int sum = nums[i] + nums[l] + nums[r];
            if (sum < 0) l++;
            else if (sum > 0) r--;
            else {
                res.add(List.of(nums[i], nums[l], nums[r]));
                while (l < r && nums[l] == nums[l + 1]) l++;   // skip duplicates
                while (l < r && nums[r] == nums[r - 1]) r--;
                l++; r--;
            }
        }
    }
    return res;
}`,
    run({ nums }, t) {
      const a = nums.slice().sort((x, y) => x - y);
      const res = [];
      const view = (i, l, r, c = {}) => ({ t: 'array', label: 'nums (sorted)', a, ptr: { i: [i, 'bot', 3], L: l, R: [r, 'top', 2] }, cls: { [i]: 'blue', ...c } });
      const out = () => ({ t: 'stack', label: 'triplets found', a: res.map((x) => `[${x}]`), kind: 'list' });
      t.step(2, 'Sort first. Then for each i, find pairs in the rest that sum to −nums[i] with two pointers.', [{ t: 'array', label: 'nums (sorted)', a }, out()]);
      for (let i = 0; i < a.length - 2 && a[i] <= 0; i++) {
        if (i > 0 && a[i] === a[i - 1]) { t.step(5, `nums[${i}] = ${a[i]} is the same as the previous first number. Skip it to avoid duplicate triplets.`, [view(i, null, null, { [i]: 'dim' }), out()]); continue; }
        let l = i + 1, r = a.length - 1;
        while (l < r) {
          const sum = a[i] + a[l] + a[r];
          t.step(8, `${a[i]} + ${a[l]} + ${a[r]} = <b>${sum}</b>`, [view(i, l, r, { [l]: 'cmp', [r]: 'cmp' }), out()]);
          if (sum < 0) l++;
          else if (sum > 0) r--;
          else {
            res.push([a[i], a[l], a[r]]);
            t.step(12, `Zero! Record [${a[i]}, ${a[l]}, ${a[r]}], then skip past equal values on both sides.`, [view(i, l, r, { [l]: 'ok', [r]: 'ok' }), out()]);
            while (l < r && a[l] === a[l + 1]) l++;
            while (l < r && a[r] === a[r - 1]) r--;
            l++; r--;
          }
        }
      }
      t.step(20, `${res.length} unique triplets. Sorting is O(n log n) and the loops are O(n²) total.`, [{ t: 'array', label: 'nums (sorted)', a }, out()]);
    },
  });

  add('palindromeCheck', {
    title: 'Palindrome check from both ends', sub: 'Skip anything that isn’t a letter or digit; compare case-insensitively.',
    inputs: [{ key: 's', label: 's', type: 'str', def: 'Race car!' }],
    code: `
boolean isPalindrome(String s) {
    int l = 0, r = s.length() - 1;
    while (l < r) {
        while (l < r && !Character.isLetterOrDigit(s.charAt(l))) l++;
        while (l < r && !Character.isLetterOrDigit(s.charAt(r))) r--;
        if (Character.toLowerCase(s.charAt(l)) != Character.toLowerCase(s.charAt(r))) return false;
        l++; r--;
    }
    return true;
}`,
    check: ({ s }) => (s.length > 30 ? 'keep it under 30 characters' : null),
    run({ s }, t) {
      const a = s.split('').map((c) => (c === ' ' ? '␣' : c));
      const ok = (c) => /[a-z0-9]/i.test(c);
      let l = 0, r = s.length - 1;
      const done = {};
      const view = (c = {}) => ({ t: 'array', label: 's', a, ptr: { l, r: [r, 'top', 2] }, cls: { ...done, ...c } });
      t.step(2, 'Compare from both ends toward the middle, with no new string needed.', [view()]);
      while (l < r) {
        while (l < r && !ok(s[l])) { t.step(4, `'${a[l]}' isn't a letter or digit: skip.`, [view({ [l]: 'dim' })]); done[l] = 'dim'; l++; }
        while (l < r && !ok(s[r])) { t.step(5, `'${a[r]}' isn't a letter or digit: skip.`, [view({ [r]: 'dim' })]); done[r] = 'dim'; r--; }
        if (l >= r) break;
        const same = s[l].toLowerCase() === s[r].toLowerCase();
        t.step(6, `'${s[l]}' vs '${s[r]}' (ignoring case): ${same ? 'match' : '<b>mismatch</b>'}`, [view({ [l]: same ? 'ok' : 'bad', [r]: same ? 'ok' : 'bad' })]);
        if (!same) { t.step(6, 'Not a palindrome.', [view({ [l]: 'bad', [r]: 'bad' })]); return; }
        done[l] = 'ok'; done[r] = 'ok'; l++; r--;
      }
      t.step(9, 'Pointers met: it’s a palindrome.', [view()]);
    },
  });
})();

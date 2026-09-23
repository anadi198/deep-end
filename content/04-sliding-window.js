(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

DSA.module({
  id: 'sliding-window', title: 'Sliding Window', short: 'Sliding window',
  blurb: 'Contiguous subarrays and substrings in O(n): grow the right edge, shrink the left edge, and keep just enough state to know whether the window is valid.',
  intro: M`
    A sliding window is two pointers moving in the **same direction**, with a **window invariant** between them. The whole skill is choosing the state (a sum, a count table, a number of distinct characters) and knowing when to shrink. Two templates cover nearly every problem: *longest valid window* and *shortest valid window*.
  `,
  more: [
    lc(1456, 'maximum-number-of-vowels-in-a-substring-of-given-length', 'Maximum Number of Vowels in a Substring of Given Length', 'easier'),
    lc(1004, 'max-consecutive-ones-iii', 'Max Consecutive Ones III', 'similar'),
    lc(1493, 'longest-subarray-of-1s-after-deleting-one-element', 'Longest Subarray of 1\'s After Deleting One Element', 'similar'),
    lc(438, 'find-all-anagrams-in-a-string', 'Find All Anagrams in a String', 'variant'),
    lc(340, 'longest-substring-with-at-most-k-distinct-characters', 'Longest Substring with At Most K Distinct Characters', 'variant', { premium: true }),
    lc(1658, 'minimum-operations-to-reduce-x-to-zero', 'Minimum Operations to Reduce X to Zero', 'harder'),
    lc(1248, 'count-number-of-nice-subarrays', 'Count Number of Nice Subarrays', 'variant'),
    lc(713, 'subarray-product-less-than-k', 'Subarray Product Less Than K', 'similar'),
    lc(1838, 'frequency-of-the-most-frequent-element', 'Frequency of the Most Frequent Element', 'harder'),
    lc(30, 'substring-with-concatenation-of-all-words', 'Substring with Concatenation of All Words', 'harder'),
    lc(2461, 'maximum-sum-of-distinct-subarrays-with-length-k', 'Maximum Sum of Distinct Subarrays With Length K', 'similar'),
  ],
  items: [
    { lesson: 'sliding-window', title: 'Sliding window templates', mins: 14,
      lede: 'Fixed windows, longest-valid and shortest-valid windows, and the “exactly K = at most K − at most K−1” trick.',
      body: M`
        ## Why it's O(n)
        The brute force looks at all O(n²) subarrays and recomputes each one's property from scratch. A sliding window keeps a running summary of the current window «[l, r]» and updates it in O(1) when an element enters on the right or leaves on the left. Both pointers only move forward, at most n times each, so the total work is O(n), even though there's a «while» inside a «for».

        ## Fixed-size windows
        When the window length is given (k), slide it one step at a time: add the element entering and subtract the one leaving.

        @viz fixedWindow

        ~~~java Template: fixed window of size k
        int sum = 0;
        for (int r = 0; r < n; r++) {
            sum += a[r];                          // element enters
            if (r >= k) sum -= a[r - k];          // element leaves
            if (r >= k - 1) { /* window [r-k+1, r] is complete: use sum */ }
        }
        ~~~

        ## Variable windows: longest valid
        *"Longest substring/subarray such that [condition]."* Expand «r» every step. While the window is **invalid**, shrink «l». Then the window is valid, so record its length.

        @viz longestNoRepeat

        ~~~java Template: longest valid window
        int l = 0, best = 0;
        for (int r = 0; r < n; r++) {
            add(a[r]);                            // update the window state
            while (invalid()) remove(a[l++]);     // restore validity
            best = Math.max(best, r - l + 1);     // [l, r] is valid here
        }
        ~~~

        ## Variable windows: shortest valid
        *"Shortest/minimum window such that [condition]."* Expand «r». While the window is **valid**, record it and shrink «l» to try for something smaller.

        @viz minWindow

        ~~~java Template: shortest valid window
        int l = 0, best = Integer.MAX_VALUE;
        for (int r = 0; r < n; r++) {
            add(a[r]);
            while (valid()) {
                best = Math.min(best, r - l + 1); // record before shrinking
                remove(a[l++]);
            }
        }
        ~~~

        :::key The condition must be monotone
        Sliding windows work when validity behaves predictably as the window grows or shrinks:
        - For *longest valid*: if a window is valid, every smaller window inside it is valid too ("at most 2 distinct", "no repeats", "sum ≤ S" with non-negative numbers).
        - For *shortest valid*: if a window is valid, every bigger window containing it is valid too ("contains all of t", "sum ≥ S" with non-negative numbers).

        **Negative numbers break sum windows**: adding an element can lower the sum, so you can't tell which way to move. Use prefix sums with a hash map instead.
        :::

        ## Choosing the window state
        | Condition | State to keep | Valid when… |
        |---|---|---|
        | Sum limit (non-negative values) | «int sum» | «sum ≤ S» or «sum ≥ S» |
        | No repeated characters | «int[128]» counts or last-index map | no count > 1 |
        | At most K distinct | counts plus a «distinct» counter | «distinct ≤ K» |
        | Contains all of t | «need[]» counts plus a «missing» counter | «missing == 0» |
        | At most K replacements | counts plus «maxFreq» | «length − maxFreq ≤ K» |

        Keep a counter such as «distinct» or «missing» next to the count table, so checking validity is O(1) instead of scanning 26 or 128 slots.

        ## Counting subarrays: "exactly K" = "at most K" − "at most K−1"
        Windows naturally count **at most K** conditions. For a longest-valid window, every valid window ending at «r» (there are «r − l + 1» of them) satisfies "at most K". Subarrays with *exactly* K distinct values (or K odd numbers, and so on) are the ones counted by «atMost(K)» but not by «atMost(K − 1)».

        ## Signals
        - "**Contiguous** subarray / substring" with longest, shortest, maximum or minimum → window.
        - "**At most K**" of something (distinct values, zeros to flip, replacements) → longest-valid window.
        - "**Contains all** / covers / at least" → shortest-valid window.
        - A fixed length k ("every window of size k") → fixed window.
        - **Negative numbers** plus a sum target → not a window. Use prefix sums.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'Longest subarray with sum ≤ S, where the array has negative numbers. Does a sliding window work?',
          options: ['Yes, always', 'No: with negatives, a valid window can become valid again after growing, so shrinking decisions aren’t safe', 'Only if S is positive', 'Only for fixed windows'],
          answer: 1, why: 'The window template relies on monotone validity. Negatives break it, so use prefix sums (plus a monotonic structure or binary search, depending on the exact question).' },
        { q: 'How many subarrays have **exactly** 3 distinct values?',
          options: ['atMost(3)', 'atMost(3) − atMost(2)', 'atMost(3) + atMost(2)', 'atMost(4) − atMost(3)'],
          answer: 1, why: 'Every subarray with exactly 3 distinct values is counted by atMost(3) and not by atMost(2). Everything with fewer than 3 is counted by both and cancels.' },
      ],
      practice: ['max-avg-subarray', 'best-time-stock', 'longest-no-repeat', 'char-replacement', 'fruit-baskets', 'permutation-in-string', 'min-size-subarray', 'min-window-substring', 'k-distinct-subarrays'],
    },

    { problem: {
      id: 'max-avg-subarray', title: 'Best Average Over k Days', diff: 'easy',
      tags: ['fixed window'],
      statement: M`
        «nums[i]» is a store's profit on day «i». Find the contiguous block of exactly «k» days with the **highest average** profit, and return that average.

        Answers within 10⁻⁵ of the true value are accepted.
      `,
      fn: { name: 'findMaxAverage', params: [['int[]', 'nums'], ['int', 'k']], ret: 'double' },
      tests: [
        { args: [[1, 12, -5, -6, 50, 3], 4], ex: true, expect: 12.75, why: '(12 − 5 − 6 + 50) / 4 = 12.75.' },
        { args: [[5], 1], ex: true, expect: 5.0 },
        { args: [[0, 4, 0, 3, 2], 1], expect: 4.0 },
        { args: [[-1, -2, -3], 2], expect: -1.5 },
        { args: [[3, 3, 4, 3, 0], 3], expect: 3.33333 },
        { args: [[7, 4, 5, 8, 8, 3, 9, 8, 7, 6], 7] },
        { args: [{ $gen: 'ints', args: [100000, -10000, 10000, 61] }, 50000], big: true },
        { args: [{ $gen: 'ints', args: [100000, -10000, 10000, 62] }, 7], big: true },
      ],
      constraints: ['1 ≤ k ≤ n ≤ 10⁵', '−10⁴ ≤ nums[i] ≤ 10⁴'],
      hints: [
        'The maximum average over length k is the maximum **sum** over length k, divided by k.',
        'Recomputing each window’s sum is O(k). How does the sum change when the window slides one step?',
        'New sum = old sum + nums[r] − nums[r − k].',
      ],
      solution: {
        pattern: '**Fixed-size sliding window:** O(1) update per slide instead of O(k) recomputation.',
        intuition: 'Consecutive windows overlap in k − 1 elements. Instead of re-adding them, add the new element and subtract the one that fell out.',
        java: J`class Solution {
    public double findMaxAverage(int[] nums, int k) {
        long sum = 0;
        for (int i = 0; i < k; i++) sum += nums[i];
        long best = sum;
        for (int r = k; r < nums.length; r++) {
            sum += nums[r] - nums[r - k];
            best = Math.max(best, sum);
        }
        return (double) best / k;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - Integer division: «best / k» with «int»s truncates. Cast to «double» first.
          - Compare sums, not averages: it's simpler and avoids floating-point error until the very end.
        `,
        alts: [
          { name: 'Recompute every window', time: 'O(n·k)', space: 'O(1)', note: 'Up to 2.5·10⁹ operations on the large test.', java: J`class Solution {
    public double findMaxAverage(int[] nums, int k) {
        long best = Long.MIN_VALUE;
        for (int i = 0; i + k <= nums.length; i++) { long s = 0; for (int j = i; j < i + k; j++) s += nums[j]; best = Math.max(best, s); }
        return (double) best / k;
    }
}` },
          { name: 'Prefix sums', time: 'O(n)', space: 'O(n)', note: 'The window sum is prefix[i + k] − prefix[i]. The same complexity, with an extra array.' },
        ],
        followups: M`
          - **Length at least k** (LeetCode 644, hard): binary search on the average plus prefix sums.
        `,
        talk: 'Fixed window of size k: build the first sum, then slide by adding the new element and subtracting the old one, tracking the max sum. Divide by k at the end. O(n).',
      },
      viz: { id: 'fixedWindow', input: { nums: [1, 12, -5, -6, 50, 3], k: 4 } },
      lc: [lc(643, 'maximum-average-subarray-i', 'Maximum Average Subarray I', 'same'), lc(1456, 'maximum-number-of-vowels-in-a-substring-of-given-length', 'Maximum Number of Vowels in a Substring of Given Length', 'similar'), lc(2461, 'maximum-sum-of-distinct-subarrays-with-length-k', 'Maximum Sum of Distinct Subarrays With Length K', 'harder')],
      drill: { prompt: 'Maximum average of any contiguous block of exactly k elements.', pattern: 'sliding-window', why: 'Fixed-size window: add the entering element, subtract the leaving one.' },
    } },

    { problem: {
      id: 'best-time-stock', title: 'One Trade, Maximum Profit', diff: 'easy',
      tags: ['running min', 'window'],
      statement: M`
        «prices[i]» is a stock's price on day «i». You may buy once and later sell once (selling on a later day than buying). Return the maximum profit, or «0» if no profitable trade exists.
      `,
      fn: { name: 'maxProfit', params: [['int[]', 'prices']], ret: 'int' },
      tests: [
        { args: [[7, 1, 5, 3, 6, 4]], ex: true, expect: 5, why: 'Buy at 1 (day 1), sell at 6 (day 4).' },
        { args: [[7, 6, 4, 3, 1]], ex: true, expect: 0, why: 'Prices only fall.' },
        { args: [[1]], expect: 0 },
        { args: [[2, 4, 1]], expect: 2 },
        { args: [[3, 2, 6, 5, 0, 3]], expect: 4 },
        { args: [[1, 2]], expect: 1 },
        { args: [[2, 1, 2, 1, 0, 1, 2]], expect: 2 },
        { args: [{ $gen: 'ints', args: [100000, 0, 10000, 63] }], big: true },
      ],
      constraints: ['1 ≤ prices.length ≤ 10⁵', '0 ≤ prices[i] ≤ 10⁴'],
      hints: [
        'If you sell on day i, what’s the best day to have bought?',
        'The cheapest day before i. Can you know that without looking back?',
        'Track the minimum price so far; at each day, the best profit selling today is «price − minSoFar».',
      ],
      solution: {
        pattern: '**Running minimum (a one-pass window):** the best partner for each right end is a summary of everything to its left. The same idea underlies Kadane’s algorithm.',
        intuition: 'For each sell day, the optimal buy day is the cheapest day so far. Keep that minimum as you scan; each day offers a candidate profit of today’s price minus the minimum.',
        java: J`class Solution {
    public int maxProfit(int[] prices) {
        int minPrice = Integer.MAX_VALUE, best = 0;
        for (int p : prices) {
            minPrice = Math.min(minPrice, p);     // best day to have bought, so far
            best = Math.max(best, p - minPrice);  // sell today?
        }
        return best;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        why: 'The optimal trade (b, s) is considered on day s, when minPrice ≤ prices[b]. So the maximum over all days is at least the optimum, and every candidate is a real trade.',
        pitfalls: M`
          - Finding the global minimum and then the maximum *after* it misses cases like «[2, 4, 1]» (answer 2, before the minimum).
          - Updating the minimum before computing the profit is fine: it just yields profit 0 on that day.
        `,
        alts: [
          { name: 'Try every pair', time: 'O(n²)', space: 'O(1)', java: J`class Solution {
    public int maxProfit(int[] prices) {
        int best = 0;
        for (int i = 0; i < prices.length; i++)
            for (int j = i + 1; j < prices.length; j++) best = Math.max(best, prices[j] - prices[i]);
        return best;
    }
}` },
          { name: 'Kadane on daily differences', time: 'O(n)', space: 'O(1)', note: 'The profit of buying on day b and selling on day s is the sum of the daily changes between them, so the answer is the maximum subarray sum of the diffs (clamped at 0).' },
        ],
        followups: M`
          - **Unlimited trades** (LeetCode 122): sum every positive daily change.
          - **At most two, or k, trades** (LeetCode 123/188) and **cooldown** (309): state-machine DP (2-D DP module).
        `,
        talk: 'For each day I know the cheapest price before it, so the best sell-today profit is price minus minSoFar. One pass tracking the min and the best difference. O(n) time, O(1) space.',
      },
      lc: [lc(121, 'best-time-to-buy-and-sell-stock', 'Best Time to Buy and Sell Stock', 'same'), lc(122, 'best-time-to-buy-and-sell-stock-ii', 'Best Time to Buy and Sell Stock II', 'variant'), lc(309, 'best-time-to-buy-and-sell-stock-with-cooldown', 'Best Time to Buy and Sell Stock with Cooldown', 'harder'), lc(2016, 'maximum-difference-between-increasing-elements', 'Maximum Difference Between Increasing Elements', 'same')],
      drill: { prompt: 'Maximize prices[j] − prices[i] with j > i (one buy, one sell).', pattern: 'sliding-window', why: 'Scan left to right keeping the running minimum, the best left partner for every right end.' },
    } },

    { problem: {
      id: 'longest-no-repeat', title: 'Longest Substring Without Repeats', diff: 'medium',
      tags: ['variable window', 'last index'],
      statement: M`
        Given a string «s», return the length of the longest **substring** (contiguous) in which no character appears twice.
      `,
      fn: { name: 'lengthOfLongestSubstring', params: [['String', 's']], ret: 'int' },
      tests: [
        { args: ['abcabcbb'], ex: true, expect: 3, why: '"abc".' },
        { args: ['bbbbb'], ex: true, expect: 1 },
        { args: ['pwwkew'], ex: true, expect: 3, why: '"wke". "pwke" is a subsequence, not a substring.' },
        { args: [''], expect: 0 },
        { args: [' '], expect: 1 },
        { args: ['dvdf'], expect: 3 },
        { args: ['abba'], expect: 2, why: 'When the second «a» arrives, its old position (0) is left of the window; don’t move l backwards.' },
        { args: ['tmmzuxt'], expect: 5 },
        { args: ['au1 2!au'], expect: 6 },
        { args: [{ $gen: 'str', args: [100000, 'abcdefghijklmnopqrstuvwxyz0123456789', 65] }], big: true },
        { args: [{ $gen: 'repeatStr', args: ['abcdefghijklmnopqrstuvwxyz', 3800] }], big: true, expect: 26 },
      ],
      constraints: ['0 ≤ s.length ≤ 10⁵', 's has printable ASCII characters (codes 32–126)'],
      hints: [
        'Keep a window [l, r] with no repeats. When you add s[r] and it’s already inside the window, what must happen to l?',
        'l must move just past the previous occurrence of s[r]. Any window starting at or before it would repeat s[r].',
        'Store the last index of each character. Jump l to «max(l, last[c] + 1)», because the old occurrence might already be left of the window.',
      ],
      solution: {
        pattern: '**Longest-valid sliding window** where the "shrink" is a jump. A last-index table lets l skip straight past the conflict.',
        intuition: M`
          The window always holds distinct characters. When a character repeats inside it, any window containing both copies is invalid, so the new left edge is one past the earlier copy. A last-index array tells us where that is in O(1). Every window ending at «r» with a valid start is considered, so the maximum is found.
        `,
        java: J`class Solution {
    public int lengthOfLongestSubstring(String s) {
        int[] last = new int[128];              // last index + 1 of each char (0 = unseen)
        int best = 0, l = 0;
        for (int r = 0; r < s.length(); r++) {
            char c = s.charAt(r);
            l = Math.max(l, last[c]);            // jump past the previous c, but never move back
            last[c] = r + 1;
            best = Math.max(best, r - l + 1);
        }
        return best;
    }
}`,
        time: 'O(n)', space: 'O(1)', spaceWhy: '128 slots for ASCII',
        pitfalls: M`
          - «l = last[c] + 1» without the «max» moves l **backwards** on inputs like «"abba"»: the old «a» sits left of the current window.
          - Storing «index + 1» makes 0 mean "unseen", which avoids a separate fill with −1.
        `,
        alts: [
          { name: 'HashSet window, shrink one step at a time', time: 'O(n)', space: 'O(min(n, alphabet))', note: 'The generic template: while s[r] is in the set, remove s[l] and advance l. Each char is added and removed at most once.',
            java: J`class Solution {
    public int lengthOfLongestSubstring(String s) {
        Set<Character> window = new HashSet<>();
        int best = 0, l = 0;
        for (int r = 0; r < s.length(); r++) {
            while (!window.add(s.charAt(r))) window.remove(s.charAt(l++));
            best = Math.max(best, r - l + 1);
        }
        return best;
    }
}` },
          { name: 'Check every substring', time: 'O(n²)–O(n³)', space: 'O(alphabet)', note: 'For each start, extend until a repeat appears. O(n · alphabet) in practice.',
            java: J`class Solution {
    public int lengthOfLongestSubstring(String s) {
        int best = 0;
        for (int i = 0; i < s.length(); i++) {
            boolean[] seen = new boolean[128];
            int j = i;
            while (j < s.length() && !seen[s.charAt(j)]) seen[s.charAt(j++)] = true;
            best = Math.max(best, j - i);
        }
        return best;
    }
}` },
        ],
        followups: M`
          - **At most k distinct characters** (LeetCode 340): counts plus a distinct counter, shrinking while distinct > k.
          - **Return the substring:** remember «l» at the best moment.
        `,
        talk: 'Sliding window with distinct characters. I keep each character’s last index; when s[r] was seen inside the window, l jumps past that occurrence, taking the max so it never moves back. Record r − l + 1 each step. O(n).',
      },
      viz: { id: 'longestNoRepeat' },
      lc: [lc(3, 'longest-substring-without-repeating-characters', 'Longest Substring Without Repeating Characters', 'same'), lc(340, 'longest-substring-with-at-most-k-distinct-characters', 'Longest Substring with At Most K Distinct Characters', 'variant', { premium: true }), lc(2461, 'maximum-sum-of-distinct-subarrays-with-length-k', 'Maximum Sum of Distinct Subarrays With Length K', 'similar')],
      drill: { prompt: 'Length of the longest substring with all distinct characters.', pattern: 'sliding-window', why: 'Longest-valid window; on a repeat, move the left edge past the previous occurrence.' },
    } },

    { problem: {
      id: 'char-replacement', title: 'Longest Run After k Replacements', diff: 'medium',
      tags: ['variable window', 'max frequency'],
      statement: M`
        «s» contains uppercase English letters. You may change at most «k» characters to any other uppercase letter. Return the length of the longest substring that can be made of a **single repeated letter**.
      `,
      fn: { name: 'characterReplacement', params: [['String', 's'], ['int', 'k']], ret: 'int' },
      tests: [
        { args: ['ABAB', 2], ex: true, expect: 4 },
        { args: ['AABABBA', 1], ex: true, expect: 4, why: 'Replace the middle «A» of «ABBA» → «BBBB»… or «AABA» → «AAAA».' },
        { args: ['A', 0], expect: 1 },
        { args: ['ABCDE', 0], expect: 1 },
        { args: ['ABCDE', 5], expect: 5 },
        { args: ['AAAA', 0], expect: 4 },
        { args: ['BAAAB', 2], expect: 5 },
        { args: ['ABBB', 2], expect: 4 },
        { args: [{ $gen: 'str', args: [100000, 'ABC', 67] }, 5000], big: true },
        { args: [{ $gen: 'str', args: [100000, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 68] }, 3], big: true },
      ],
      constraints: ['1 ≤ s.length ≤ 10⁵', 'Uppercase English letters', '0 ≤ k ≤ s.length'],
      hints: [
        'For a fixed window, how many replacements does it need to become one letter?',
        'Length − (count of its most common letter). The window is fixable iff that is ≤ k.',
        'Slide with counts. Track «maxFreq» and shrink while «length − maxFreq > k». You never need to decrease «maxFreq», because only a bigger maxFreq can produce a longer answer.',
      ],
      solution: {
        pattern: '**Longest-valid window with a derived condition:** valid iff «windowLength − maxFreq ≤ k». The subtle trick is a stale «maxFreq» that never decreases.',
        intuition: M`
          The cheapest way to make a window uniform is to keep its most frequent letter and replace everything else. So validity only needs the counts and the max count. The clever part: when we shrink, the true max frequency might drop, but we don't need to recompute it. The answer can only improve when a window has a higher max frequency than any before it, and a stale (too high) maxFreq only makes us shrink less, never report an invalid length as a new best.
        `,
        java: J`class Solution {
    public int characterReplacement(String s, int k) {
        int[] count = new int[26];
        int l = 0, maxFreq = 0, best = 0;
        for (int r = 0; r < s.length(); r++) {
            maxFreq = Math.max(maxFreq, ++count[s.charAt(r) - 'A']);
            while (r - l + 1 - maxFreq > k) count[s.charAt(l++) - 'A']--;
            best = Math.max(best, r - l + 1);
        }
        return best;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        why: M`
          The window length only exceeds the best so far when maxFreq has grown to a new record, and at that moment «length − maxFreq ≤ k» holds with the true frequency. When maxFreq is stale, the window at most keeps its length (we shrink by one whenever it grows by one), so «best» never records an invalid window.
        `,
        pitfalls: M`
          - Recomputing maxFreq by scanning 26 counts after each shrink is correct too (O(26n)), and it's easier to justify if you aren't sure about the stale-max argument.
          - «if» instead of «while» works here (the window grows by at most one), but «while» is the safe template.
        `,
        alts: [
          { name: 'Try each target letter separately', time: 'O(26·n)', space: 'O(1)', note: 'For each letter X, find the longest window with at most k non-X characters. It’s the plain "at most k bad elements" window, run 26 times, and easy to prove correct.',
            java: J`class Solution {
    public int characterReplacement(String s, int k) {
        int best = 0;
        for (char x = 'A'; x <= 'Z'; x++) {
            int l = 0, bad = 0;
            for (int r = 0; r < s.length(); r++) {
                if (s.charAt(r) != x) bad++;
                while (bad > k) if (s.charAt(l++) != x) bad--;
                best = Math.max(best, r - l + 1);
            }
        }
        return best;
    }
}` },
        ],
        followups: M`
          - **Binary array, flip at most k zeros** (LeetCode 1004): the same window with "bad = zeros".
        `,
        talk: 'A window can become uniform iff its length minus the count of its most common letter is at most k. I slide with a count array and maxFreq, shrinking while that’s violated. maxFreq never needs to decrease, because only a larger one can beat the best. O(n).',
      },
      viz: { id: 'charReplacement' },
      lc: [lc(424, 'longest-repeating-character-replacement', 'Longest Repeating Character Replacement', 'same'), lc(1004, 'max-consecutive-ones-iii', 'Max Consecutive Ones III', 'similar'), lc(2024, 'maximize-the-confusion-of-an-exam', 'Maximize the Confusion of an Exam', 'similar')],
      drill: { prompt: 'Longest substring you can make all one letter with at most k character changes.', pattern: 'sliding-window', why: 'Window valid iff length − (max letter count) ≤ k; shrink while it isn’t.' },
    } },

    { problem: {
      id: 'fruit-baskets', title: 'At Most Two Kinds', diff: 'medium',
      tags: ['at most K distinct', 'window'],
      statement: M`
        Trees stand in a row; «fruits[i]» is the type of fruit on tree «i». You have **two** baskets, and each holds one type of fruit (any amount). Starting at any tree, you pick one fruit from every tree moving right, and you must stop as soon as a tree's fruit fits in neither basket.

        Return the maximum number of fruits you can pick, which is the length of the longest subarray with **at most 2 distinct values**.
      `,
      fn: { name: 'totalFruit', params: [['int[]', 'fruits']], ret: 'int' },
      tests: [
        { args: [[1, 2, 1]], ex: true, expect: 3 },
        { args: [[0, 1, 2, 2]], ex: true, expect: 3 },
        { args: [[1, 2, 3, 2, 2]], ex: true, expect: 4, why: '[2, 3, 2, 2].' },
        { args: [[3, 3, 3, 1, 2, 1, 1, 2, 3, 3, 4]], expect: 5 },
        { args: [[0]], expect: 1 },
        { args: [[1, 1, 1, 1]], expect: 4 },
        { args: [[0, 1, 2, 3, 4]], expect: 2 },
        { args: [{ $gen: 'ints', args: [100000, 0, 3, 69] }], big: true },
        { args: [{ $gen: 'ints', args: [100000, 0, 99999, 70] }], big: true },
      ],
      constraints: ['1 ≤ fruits.length ≤ 10⁵', '0 ≤ fruits[i] < fruits.length'],
      hints: [
        'Strip away the story: longest contiguous subarray with at most 2 distinct values.',
        'Keep counts of each value in the window and the number of distinct values.',
        'Shrink from the left while there are more than 2 distinct values, decrementing counts. A count dropping to 0 means one fewer distinct value.',
      ],
      solution: {
        pattern: '**Longest window with at most K distinct values:** counts plus a distinct counter. It’s the building block for the "exactly K" problems.',
        intuition: 'The window [l, r] is valid while it holds ≤ 2 distinct values. Extending r may add a third type; then advance l until one type disappears completely.',
        java: J`class Solution {
    public int totalFruit(int[] fruits) {
        int[] count = new int[fruits.length];
        int l = 0, distinct = 0, best = 0;
        for (int r = 0; r < fruits.length; r++) {
            if (count[fruits[r]]++ == 0) distinct++;
            while (distinct > 2)
                if (--count[fruits[l++]] == 0) distinct--;
            best = Math.max(best, r - l + 1);
        }
        return best;
    }
}`,
        time: 'O(n)', space: 'O(n)', spaceWhy: 'counts indexed by fruit type (< n); a HashMap works for arbitrary values',
        pitfalls: M`
          - Tracking only the "last two types" with special cases is error-prone. The counts template generalizes to any K.
          - Forgetting to decrement «distinct» when a count hits zero keeps the window shrinking forever.
        `,
        alts: [
          { name: 'HashMap counts (arbitrary values)', time: 'O(n)', space: 'O(1)', note: 'The map never holds more than 3 keys.',
            java: J`class Solution {
    public int totalFruit(int[] fruits) {
        Map<Integer, Integer> count = new HashMap<>();
        int l = 0, best = 0;
        for (int r = 0; r < fruits.length; r++) {
            count.merge(fruits[r], 1, Integer::sum);
            while (count.size() > 2) {
                if (count.merge(fruits[l], -1, Integer::sum) == 0) count.remove(fruits[l]);
                l++;
            }
            best = Math.max(best, r - l + 1);
        }
        return best;
    }
}` },
        ],
        talk: 'This is the longest subarray with at most two distinct values: a sliding window with counts and a distinct counter, shrinking while distinct exceeds 2. O(n).',
      },
      lc: [lc(904, 'fruit-into-baskets', 'Fruit Into Baskets', 'same'), lc(340, 'longest-substring-with-at-most-k-distinct-characters', 'Longest Substring with At Most K Distinct Characters', 'variant', { premium: true }), lc(992, 'subarrays-with-k-different-integers', 'Subarrays with K Different Integers', 'harder')],
      drill: { prompt: 'Longest contiguous stretch containing at most two different values.', pattern: 'sliding-window', why: 'At-most-K-distinct window: counts plus a distinct counter; shrink while distinct > K.' },
    } },

    { problem: {
      id: 'permutation-in-string', title: 'Hidden Anagram', diff: 'medium',
      tags: ['fixed window', 'counts'],
      statement: M`
        Given lowercase strings «p» and «s», return «true» if some **substring** of «s» is a permutation (an anagram) of «p».
      `,
      fn: { name: 'checkInclusion', params: [['String', 'p'], ['String', 's']], ret: 'boolean' },
      tests: [
        { args: ['ab', 'eidbaooo'], ex: true, expect: true, why: '"ba" appears at index 3.' },
        { args: ['ab', 'eidboaoo'], ex: true, expect: false },
        { args: ['a', 'a'], expect: true },
        { args: ['abc', 'ab'], expect: false, why: 's is shorter than p.' },
        { args: ['adc', 'dcda'], expect: true },
        { args: ['hello', 'ooolleoooleh'], expect: false },
        { args: ['aab', 'baa'], expect: true },
        { args: ['xyz', 'afdgzyxksldfm'], expect: true },
        { args: [{ $gen: 'str', args: [5000, 'abcde', 71] }, { $gen: 'str', args: [100000, 'abcde', 72] }], big: true },
        { args: ['abcdefghijklmnopqrstuvwxyz', { $gen: 'repeatStr', args: ['abcdefghijklmnopqrstuvwxyy', 3800] }], big: true, expect: false },
      ],
      constraints: ['1 ≤ p.length, s.length ≤ 10⁵ (LeetCode: 10⁴)', 'Lowercase English letters'],
      hints: [
        'Any anagram of p has length |p|. So look only at windows of exactly that length.',
        'Two strings are anagrams iff their letter counts are equal. Maintain counts for the current window as it slides.',
        'Comparing 26 counts per step is fine (O(26n)). For O(n), track how many letters currently have matching counts.',
      ],
      solution: {
        pattern: '**Fixed window + frequency match.** Anagram-in-window problems slide a window of length |p| and compare counts incrementally.',
        intuition: 'Because a permutation has exactly |p| characters, only windows of that length matter. Sliding updates two counters per step. Keep a «matches» number (how many of the 26 letters have equal counts in the window and in p), and you have an anagram when it reaches 26.',
        java: J`class Solution {
    public boolean checkInclusion(String p, String s) {
        int m = p.length(), n = s.length();
        if (m > n) return false;
        int[] need = new int[26], win = new int[26];
        for (int i = 0; i < m; i++) { need[p.charAt(i) - 'a']++; win[s.charAt(i) - 'a']++; }
        int matches = 0;
        for (int c = 0; c < 26; c++) if (need[c] == win[c]) matches++;
        for (int r = m; r < n; r++) {
            if (matches == 26) return true;
            int in = s.charAt(r) - 'a', out = s.charAt(r - m) - 'a';
            if (win[in] == need[in]) matches--;     // about to break a match
            if (++win[in] == need[in]) matches++;   // or create one
            if (win[out] == need[out]) matches--;
            if (--win[out] == need[out]) matches++;
        }
        return matches == 26;
    }
}`,
        time: 'O(n + m)', space: 'O(1)',
        pitfalls: M`
          - Checking «matches == 26» only inside the loop misses a match in the very last window. Check again at the end.
          - When the incoming and outgoing letters are the same, the two updates cancel correctly in this order, but test that case.
        `,
        alts: [
          { name: 'Compare the full count arrays each step', time: 'O(26·n)', space: 'O(1)', note: 'Simpler to write and plenty fast. Offer it first.',
            java: J`class Solution {
    public boolean checkInclusion(String p, String s) {
        if (p.length() > s.length()) return false;
        int[] need = new int[26], win = new int[26];
        for (char c : p.toCharArray()) need[c - 'a']++;
        for (int r = 0; r < s.length(); r++) {
            win[s.charAt(r) - 'a']++;
            if (r >= p.length()) win[s.charAt(r - p.length()) - 'a']--;
            if (Arrays.equals(need, win)) return true;
        }
        return false;
    }
}` },
        ],
        followups: M`
          - **Return every start index** (LeetCode 438): record r − m + 1 whenever the window matches.
          - **Arbitrary character sets:** use maps and a matched-key counter.
        `,
        talk: 'An anagram of p has length |p|, so I slide a fixed window over s and keep 26 counts. With a counter of how many letters match p’s counts, each slide is O(1), and the answer is whether matches ever reaches 26.',
      },
      lc: [lc(567, 'permutation-in-string', 'Permutation in String', 'same'), lc(438, 'find-all-anagrams-in-a-string', 'Find All Anagrams in a String', 'variant'), lc(76, 'minimum-window-substring', 'Minimum Window Substring', 'harder')],
      drill: { prompt: 'Does s contain some rearrangement of p as a contiguous substring?', pattern: 'sliding-window', why: 'Fixed window of length |p| with letter counts compared as it slides.' },
    } },

    { problem: {
      id: 'min-size-subarray', title: 'Shortest Subarray Reaching a Target', diff: 'medium',
      tags: ['shortest-valid window', 'positive values'],
      statement: M`
        Given an array of **positive** integers «nums» and a positive integer «target», return the minimal length of a contiguous subarray whose sum is **at least** «target», or «0» if there is none.
      `,
      fn: { name: 'minSubArrayLen', params: [['int', 'target'], ['int[]', 'nums']], ret: 'int' },
      tests: [
        { args: [7, [2, 3, 1, 2, 4, 3]], ex: true, expect: 2, why: '[4, 3].' },
        { args: [4, [1, 4, 4]], ex: true, expect: 1 },
        { args: [11, [1, 1, 1, 1, 1, 1, 1, 1]], ex: true, expect: 0 },
        { args: [15, [1, 2, 3, 4, 5]], expect: 5 },
        { args: [1, [5]], expect: 1 },
        { args: [6, [10, 2, 3]], expect: 1 },
        { args: [11, [1, 2, 3, 4, 5]], expect: 3 },
        { args: [1000000000, { $gen: 'ints', args: [100000, 1, 10000, 73] }], big: true, expect: 0 },
        { args: [5000000, { $gen: 'ints', args: [100000, 1, 10000, 74] }], big: true },
      ],
      constraints: ['1 ≤ target ≤ 10⁹', '1 ≤ nums.length ≤ 10⁵', '1 ≤ nums[i] ≤ 10⁴'],
      hints: [
        'All values are positive: growing a window increases its sum, and shrinking decreases it.',
        'Extend r until the sum reaches the target. Then shrink l as far as possible while it stays ≥ target.',
        'Record the length each time the window is valid, before you shrink.',
      ],
      solution: {
        pattern: '**Shortest-valid sliding window:** expand until valid, then shrink while valid, recording each time.',
        intuition: M`
          With positive numbers, the sum is monotone in the window size. For each right end r, the best (shortest) valid window is found by moving l as far right as possible while the sum is still ≥ target. l never needs to move back, because a later r can only allow l further right.
        `,
        java: J`class Solution {
    public int minSubArrayLen(int target, int[] nums) {
        int l = 0, best = Integer.MAX_VALUE;
        long sum = 0;
        for (int r = 0; r < nums.length; r++) {
            sum += nums[r];
            while (sum >= target) {
                best = Math.min(best, r - l + 1);
                sum -= nums[l++];
            }
        }
        return best == Integer.MAX_VALUE ? 0 : best;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - Recording the length *after* shrinking misses the last valid window.
          - With negative numbers this fails: use prefix sums with a monotonic deque (LeetCode 862).
        `,
        alts: [
          { name: 'Prefix sums + binary search', time: 'O(n log n)', space: 'O(n)', note: 'Prefix sums are strictly increasing, so for each start i, binary-search the first j with prefix[j] − prefix[i] ≥ target. It’s the classic follow-up answer.',
            java: J`class Solution {
    public int minSubArrayLen(int target, int[] nums) {
        int n = nums.length;
        long[] pre = new long[n + 1];
        for (int i = 0; i < n; i++) pre[i + 1] = pre[i] + nums[i];
        int best = Integer.MAX_VALUE;
        for (int i = 0; i < n; i++) {
            int lo = i + 1, hi = n + 1;               // first j with pre[j] >= pre[i] + target
            while (lo < hi) { int mid = (lo + hi) >>> 1; if (pre[mid] >= pre[i] + target) hi = mid; else lo = mid + 1; }
            if (lo <= n) best = Math.min(best, lo - i);
        }
        return best == Integer.MAX_VALUE ? 0 : best;
    }
}` },
        ],
        followups: M`
          - **Negative numbers allowed** (LeetCode 862): monotonic deque over prefix sums.
        `,
        talk: 'Positive values, so the sum is monotone in the window. I expand r, and while the sum is at least target I record the length and shrink l. Each pointer moves n times: O(n).',
      },
      viz: { id: 'minSubarraySum' },
      lc: [lc(209, 'minimum-size-subarray-sum', 'Minimum Size Subarray Sum', 'same'), lc(862, 'shortest-subarray-with-sum-at-least-k', 'Shortest Subarray with Sum at Least K', 'harder'), lc(713, 'subarray-product-less-than-k', 'Subarray Product Less Than K', 'similar')],
      drill: { prompt: 'Positive integers: shortest contiguous subarray with sum ≥ target.', pattern: 'sliding-window', why: 'Positives make the sum monotone: the shortest-valid window (shrink while the sum ≥ target).' },
    } },

    { problem: {
      id: 'min-window-substring', title: 'Minimum Window Covering All Letters', diff: 'hard',
      tags: ['shortest-valid window', 'need counts'],
      statement: M`
        Given strings «s» and «t», return the **shortest substring of s** that contains every character of «t», including duplicates (if «t» has two «a»s, the window needs at least two). If no such window exists, return «""».

        If several windows share the minimum length, return the **leftmost** one.
      `,
      fn: { name: 'minWindow', params: [['String', 's'], ['String', 't']], ret: 'String' },
      tests: [
        { args: ['ADOBECODEBANC', 'ABC'], ex: true, expect: 'BANC' },
        { args: ['a', 'a'], ex: true, expect: 'a' },
        { args: ['a', 'aa'], ex: true, expect: '', why: 'Only one «a» is available.' },
        { args: ['ab', 'b'], expect: 'b' },
        { args: ['abc', 'cba'], expect: 'abc' },
        { args: ['aaflslflsldkalskaaa', 'aaa'], expect: 'aaa' },
        { args: ['cabwefgewcwaefgcf', 'cae'], expect: 'cwae' },
        { args: ['bba', 'ab'], expect: 'ba' },
        { args: ['abab', 'ab'], expect: 'ab', why: 'Several windows of length 2: return the leftmost.' },
        { args: [{ $gen: 'str', args: [100000, 'abcdefghijklmnopqrstuvwxyz', 75] }, 'zzqqxxjj'], big: true },
        { args: [{ $gen: 'str', args: [100000, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 76] }, { $gen: 'str', args: [2000, 'abcdefghijklmnopqrstuvwxyz', 77] }], big: true },
      ],
      constraints: ['1 ≤ s.length, t.length ≤ 10⁵', 's and t consist of English letters'],
      hints: [
        'Use a shortest-valid window: expand r until the window covers t, then shrink l while it still covers t.',
        'Keep «need[c]» = how many more copies of c the window needs (it can go negative for extras), plus a single counter «missing» = total copies still needed.',
        'Adding c: if «need[c] > 0» before decrementing, it was useful, so «missing−−». Removing c: increment «need[c]»; if it becomes positive, «missing++» and the window is no longer valid.',
      ],
      solution: {
        pattern: '**Shortest-valid window with a "missing" counter**, so validity is O(1). It’s the hardest of the window templates and the one interviewers use to separate candidates.',
        intuition: M`
          «need[c]» starts as the count of c in t. As the window takes in characters, it decrements «need». Characters that were still needed reduce «missing»; extras just drive «need» negative. When «missing» hits 0, the window covers t: record it, then shrink from the left. Removing an extra (need ≤ 0 afterwards) keeps it valid, while removing a needed one makes it invalid, and we go back to expanding.
        `,
        java: J`class Solution {
    public String minWindow(String s, String t) {
        int[] need = new int[128];
        for (int i = 0; i < t.length(); i++) need[t.charAt(i)]++;
        int missing = t.length(), l = 0, bestL = 0, bestLen = Integer.MAX_VALUE;
        for (int r = 0; r < s.length(); r++) {
            if (need[s.charAt(r)]-- > 0) missing--;          // s[r] was still needed
            while (missing == 0) {                           // window [l, r] covers t
                if (r - l + 1 < bestLen) { bestLen = r - l + 1; bestL = l; }
                if (++need[s.charAt(l++)] > 0) missing++;     // dropped a needed char
            }
        }
        return bestLen == Integer.MAX_VALUE ? "" : s.substring(bestL, bestL + bestLen);
    }
}`,
        time: 'O(|s| + |t|)', space: 'O(1)', spaceWhy: '128 counters',
        why: 'For each r, after the inner loop l has advanced past the last position where [l, r] still covered t, so every minimal window ending at r was recorded. Using «<» (not «≤») keeps the leftmost of equal-length windows.',
        pitfalls: M`
          - Checking validity by comparing two 128-slot arrays each step is O(128 n): acceptable, but the «missing» counter is the expected answer.
          - Building substrings in the loop (instead of storing «bestL» and «bestLen») allocates O(n²) characters.
          - Duplicates in t: the window needs as many copies as t has, which is why «need» holds counts and not booleans.
        `,
        alts: [
          { name: 'Compare full count arrays', time: 'O(128·|s|)', space: 'O(1)', note: 'Same window, with validity checked by «covers(win, need)» over 128 slots. Easier to get right under pressure.',
            java: J`class Solution {
    public String minWindow(String s, String t) {
        int[] need = new int[128], win = new int[128];
        for (char c : t.toCharArray()) need[c]++;
        int l = 0, bestL = 0, bestLen = Integer.MAX_VALUE;
        for (int r = 0; r < s.length(); r++) {
            win[s.charAt(r)]++;
            while (covers(win, need)) {
                if (r - l + 1 < bestLen) { bestLen = r - l + 1; bestL = l; }
                win[s.charAt(l++)]--;
            }
        }
        return bestLen == Integer.MAX_VALUE ? "" : s.substring(bestL, bestL + bestLen);
    }
    private boolean covers(int[] win, int[] need) {
        for (int c = 0; c < 128; c++) if (win[c] < need[c]) return false;
        return true;
    }
}` },
        ],
        followups: M`
          - **Minimum window subsequence** (LeetCode 727): order matters, so it becomes a DP or a two-pass scan.
          - **Shortest window containing all distinct characters of s itself:** «t» = the set of s's characters.
        `,
        talk: 'Shortest-valid sliding window. need[c] counts what’s still required and missing counts the total. Expanding decrements need, and useful characters reduce missing. While missing is 0, I record the window and shrink, and removing a needed character makes it invalid. O(|s| + |t|).',
      },
      viz: { id: 'minWindow' },
      lc: [lc(76, 'minimum-window-substring', 'Minimum Window Substring', 'same'), lc(567, 'permutation-in-string', 'Permutation in String', 'easier'), lc(727, 'minimum-window-subsequence', 'Minimum Window Subsequence', 'harder', { premium: true }), lc(30, 'substring-with-concatenation-of-all-words', 'Substring with Concatenation of All Words', 'harder')],
      drill: { prompt: 'Shortest substring of s containing every character of t (with multiplicity).', pattern: 'sliding-window', why: 'Shortest-valid window with need counts and a missing counter.' },
    } },

    { problem: {
      id: 'k-distinct-subarrays', title: 'Subarrays With Exactly K Distinct', diff: 'hard',
      tags: ['at most K trick', 'counting windows'],
      statement: M`
        Given an integer array «nums» and an integer «k», return the number of contiguous subarrays that contain **exactly** «k» distinct values.
      `,
      fn: { name: 'subarraysWithKDistinct', params: [['int[]', 'nums'], ['int', 'k']], ret: 'int' },
      tests: [
        { args: [[1, 2, 1, 2, 3], 2], ex: true, expect: 7, why: '[1,2], [2,1], [1,2], [2,3], [1,2,1], [2,1,2], [1,2,1,2].' },
        { args: [[1, 2, 1, 3, 4], 3], ex: true, expect: 3 },
        { args: [[1], 1], expect: 1 },
        { args: [[1, 1, 1], 1], expect: 6 },
        { args: [[1, 2, 3], 4], expect: 0 },
        { args: [[2, 1, 1, 1, 2], 1], expect: 8 },
        { args: [[1, 2, 1, 2, 1], 2], expect: 10 },
        { args: [{ $gen: 'ints', args: [20000, 1, 5, 79] }, 3], big: true },
        { args: [{ $gen: 'ints', args: [20000, 1, 2000, 80] }, 100], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 2·10⁴', '1 ≤ nums[i] ≤ nums.length', '1 ≤ k ≤ nums.length'],
      hints: [
        'A sliding window handles "at most k distinct" naturally, but "exactly k" isn’t monotone: shrinking can go from exactly k to fewer.',
        'Count subarrays with **at most k** distinct: for each right end r, every start from l to r works, so add «r − l + 1».',
        'Exactly k = atMost(k) − atMost(k − 1).',
      ],
      solution: {
        pattern: '**Exactly K = at most K − at most (K − 1):** turn a non-monotone condition into two monotone window counts.',
        intuition: M`
          For the "at most k distinct" condition, the valid starts for a right end r form a contiguous range «[l, r]», and l only moves right as r grows. So «r − l + 1» windows end at r, and summing gives the count of all "at most k" subarrays in O(n). Subarrays with exactly k distinct values are those counted by atMost(k) and not by atMost(k − 1).
        `,
        java: J`class Solution {
    public int subarraysWithKDistinct(int[] nums, int k) {
        return atMost(nums, k) - atMost(nums, k - 1);
    }

    private int atMost(int[] nums, int k) {
        int[] count = new int[nums.length + 1];
        int l = 0, distinct = 0, total = 0;
        for (int r = 0; r < nums.length; r++) {
            if (count[nums[r]]++ == 0) distinct++;
            while (distinct > k)
                if (--count[nums[l++]] == 0) distinct--;
            total += r - l + 1;          // all windows [l..r], [l+1..r], ..., [r..r]
        }
        return total;
    }
}`,
        time: 'O(n)', space: 'O(n)',
        pitfalls: M`
          - Trying to maintain "exactly k" with one window misses subarrays: after reaching k distinct values, several different left edges can be valid.
          - «atMost(0)» must return 0. The loop handles it, since every window gets shrunk to empty.
          - The total can reach n(n+1)/2 = 2·10⁸ for n = 2·10⁴, which fits in «int». Use «long» for larger n.
        `,
        alts: [
          { name: 'One pass with two left pointers', time: 'O(n)', space: 'O(n)', note: 'Keep l1 (smallest start with ≤ k distinct) and l2 (smallest start with ≤ k − 1 distinct); add l2 − l1 each step. This is the same subtraction, fused into one loop.' },
          { name: 'All subarrays with a set', time: 'O(n²)', space: 'O(n)',
            java: J`class Solution {
    public int subarraysWithKDistinct(int[] nums, int k) {
        int res = 0;
        for (int i = 0; i < nums.length; i++) {
            int[] c = new int[nums.length + 1]; int d = 0;
            for (int j = i; j < nums.length; j++) { if (c[nums[j]]++ == 0) d++; if (d == k) res++; else if (d > k) break; }
        }
        return res;
    }
}` },
        ],
        followups: M`
          - **Count nice subarrays with exactly k odd numbers** (LeetCode 1248), and **binary subarrays with sum k** (LeetCode 930): the same subtraction trick.
        `,
        talk: '“Exactly k” isn’t monotone, but “at most k” is: for each r, all starts from l to r work, so I add r − l + 1. The answer is atMost(k) − atMost(k−1). Two O(n) passes.',
      },
      lc: [lc(992, 'subarrays-with-k-different-integers', 'Subarrays with K Different Integers', 'same'), lc(1248, 'count-number-of-nice-subarrays', 'Count Number of Nice Subarrays', 'variant'), lc(930, 'binary-subarrays-with-sum', 'Binary Subarrays With Sum', 'variant'), lc(904, 'fruit-into-baskets', 'Fruit Into Baskets', 'easier')],
      drill: { prompt: 'Count subarrays containing exactly k distinct values.', pattern: 'sliding-window', why: 'Exactly K = atMost(K) − atMost(K−1); each atMost count is a sliding window adding r − l + 1.' },
    } },
  ],
});
})();

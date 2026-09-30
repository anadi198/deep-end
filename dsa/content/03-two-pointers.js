(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

DSA.module({
  id: 'two-pointers', title: 'Two Pointers', short: 'Two pointers',
  blurb: 'Two indices moving through an array with a rule that throws away candidates each step: O(n) where brute force is O(n²), usually in O(1) space.',
  intro: M`
    Two pointers is less a data structure than a way of **discarding candidates safely**. Each step, one pointer moves because you've proven that everything it skips can't be part of the answer. The lesson builds that proof habit; the problems cover the three families: converging pointers, reader/writer pointers, and three-way partitioning.
  `,
  more: [
    lc(344, 'reverse-string', 'Reverse String', 'easier'),
    lc(283, 'move-zeroes', 'Move Zeroes', 'easier'),
    lc(27, 'remove-element', 'Remove Element', 'easier'),
    lc(80, 'remove-duplicates-from-sorted-array-ii', 'Remove Duplicates from Sorted Array II', 'variant'),
    lc(680, 'valid-palindrome-ii', 'Valid Palindrome II', 'variant'),
    lc(16, '3sum-closest', '3Sum Closest', 'variant'),
    lc(18, '4sum', '4Sum', 'harder'),
    lc(881, 'boats-to-save-people', 'Boats to Save People', 'similar'),
    lc(1750, 'minimum-length-of-string-after-deleting-similar-ends', 'Minimum Length of String After Deleting Similar Ends', 'similar'),
    lc(31, 'next-permutation', 'Next Permutation', 'harder'),
    lc(392, 'is-subsequence', 'Is Subsequence', 'easier'),
    lc(88, 'merge-sorted-array', 'Merge Sorted Array', 'easier'),
  ],
  items: [
    { lesson: 'two-pointers', title: 'Two pointers: discard safely', mins: 12,
      lede: 'Converging pointers, reader/writer pointers and three-way partitions, plus the one-sentence proof that makes each of them correct.',
      body: M`
        ## Family 1: converging pointers
        Start one pointer at each end and move them toward each other. It works when the array is **sorted** (or has a similar monotone structure) and you're looking for a pair.

        @viz pairSumSorted

        ### Why it's correct (say this in the interview)
        With «L» at the smallest remaining value and «R» at the largest:
        - If «nums[L] + nums[R] < target», then «nums[L]» plus *any* remaining value is at most «nums[L] + nums[R]», which is too small. So «nums[L]» belongs to no valid pair and we can drop it: «L++».
        - If the sum is too big, «nums[R]» plus any remaining value is too big, so we drop it: «R--».

        Every step eliminates one element **with proof**, so at most n steps are needed. That's the whole technique: a rule that discards a candidate each step, with a reason it can't be the answer.

        ~~~java Template: converging pointers
        int l = 0, r = a.length - 1;
        while (l < r) {
            int s = a[l] + a[r];                  // or whatever you evaluate for the pair (l, r)
            if (s == target) { /* record / return */ l++; r--; }
            else if (s < target) l++;             // a[l] can't work with anything left, so drop it
            else r--;                             // a[r] can't work with anything left, so drop it
        }
        ~~~

        The same shape solves palindromes (compare the ends), reversing in place, **container with most water** (move the shorter wall, since it limits every narrower container) and **trapping rain water** (process the side with the smaller maximum).

        ## Family 2: reader and writer (same direction)
        Both pointers move left to right. The **reader** «r» visits every element; the **writer** «w» marks where the next kept element goes. Everything before «w» is the finished answer. This removes or compacts elements in place, in O(n) time and O(1) space.

        @viz removeDupes

        ~~~java Template: in-place filter
        int w = 0;
        for (int r = 0; r < a.length; r++)
            if (keep(a[r])) a[w++] = a[r];   // e.g. a[r] != 0, or a[r] != a[w - 1] for dedupe
        return w;                           // a[0..w) is the result
        ~~~

        ## Family 3: three-way partition (Dutch national flag)
        Three pointers split the array into four regions: «< pivot», «= pivot», unknown, «> pivot». Each step shrinks the unknown region by one. This is the partition step of quicksort, and Sort Colors in one pass.

        @viz dutchFlag

        ## Signals
        - The input is **sorted**, or you're allowed to sort it, and you need a **pair / triple** with some sum or difference → converging pointers (after sorting: O(n log n) + O(n)).
        - "**In place**", "**O(1) extra space**", remove, move, compact → reader/writer.
        - Something about the **two ends** of an array or string (palindrome, reverse, widest container) → converging.
        - "Partition into < / = / >" or three categories → Dutch flag.
        - k-Sum: sort, fix k − 2 elements with loops, and two-pointer the last pair → O(n^(k−1)).

        :::key Sorted input changes everything
        When an array is sorted, "is there a pair with sum x?" needs no hash map: two pointers do it in O(1) space. And when the answer needs **values, not indices**, sorting first is usually allowed. Ask: "May I reorder the input?"
        :::

        ## Two pointers vs hash map vs sliding window
        | Situation | Prefer |
        |---|---|
        | Unsorted, need original indices of a pair | Hash map |
        | Sorted, or sortable because only values matter, pair or triple | Two pointers |
        | Contiguous subarray satisfying a condition | Sliding window (the next module): two same-direction pointers with a window invariant |

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'Container With Most Water: why is it safe to move the pointer at the **shorter** wall inward?',
          options: ['It’s a heuristic that usually works', 'Every container using the shorter wall with a closer partner is narrower and no taller, so none of them can beat the current one', 'The taller wall might be the answer', 'Moving either pointer is fine'],
          answer: 1, why: 'Area = min(h[l], h[r]) × width. Keeping the shorter wall caps the height at its value while the width shrinks, so its best container is the one we just measured. It can be discarded.' },
        { q: 'You need to remove all occurrences of value v from an array in place and return the new length. Which pattern fits?',
          options: ['Converging pointers', 'Reader/writer pointers', 'Binary search', 'Hash set'],
          answer: 1, why: 'The reader scans everything; the writer copies each element that isn’t v forward. O(n) time, O(1) space.' },
      ],
      practice: ['valid-palindrome', 'two-sum-sorted', 'squares-sorted-array', 'remove-duplicates-sorted', 'sort-colors', 'three-sum', 'container-most-water', 'trapping-rain-water'],
    },

    { problem: {
      id: 'valid-palindrome', title: 'Palindrome, Ignoring Noise', diff: 'easy',
      tags: ['converging pointers', 'strings'],
      statement: M`
        A phrase is a **palindrome** if it reads the same forwards and backwards after you lowercase every letter and drop everything that isn't a letter or a digit.

        Given a string «s», return «true» if it is a palindrome. Use O(1) extra space: don't build a cleaned-up copy.
      `,
      fn: { name: 'isPalindrome', params: [['String', 's']], ret: 'boolean' },
      tests: [
        { args: ['A man, a plan, a canal: Panama'], ex: true, expect: true },
        { args: ['race a car'], ex: true, expect: false },
        { args: [' '], expect: true, why: 'Nothing left after cleaning: the empty string is a palindrome.' },
        { args: ['a.'], expect: true },
        { args: ['0P'], expect: false, why: 'Digits count, and «0» is not «p».' },
        { args: ['.,'], expect: true },
        { args: ['No lemon, no melon'], expect: true },
        { args: ['ab_a'], expect: true },
        { args: ['Aa'], expect: true },
        { args: [{ $gen: 'repeatStr', args: ['ab, BA! ', 20000] }], big: true },
      ],
      constraints: ['1 ≤ s.length ≤ 2·10⁵', 's consists of printable ASCII characters'],
      hints: [
        'Compare the first and last characters that matter, then move inward.',
        'Skip characters that aren’t letters or digits with inner «while» loops, and don’t let the pointers cross.',
        '«Character.isLetterOrDigit» and «Character.toLowerCase» do the heavy lifting.',
      ],
      solution: {
        pattern: '**Converging pointers on a string**, with skipping. Palindrome checks, reversals and "compare both ends" questions are all this shape.',
        intuition: 'A palindrome is symmetric, so compare the outermost meaningful characters, then the next pair in, and so on. Skipping noise on each side keeps both pointers on characters that count.',
        java: J`class Solution {
    public boolean isPalindrome(String s) {
        int l = 0, r = s.length() - 1;
        while (l < r) {
            while (l < r && !Character.isLetterOrDigit(s.charAt(l))) l++;
            while (l < r && !Character.isLetterOrDigit(s.charAt(r))) r--;
            if (Character.toLowerCase(s.charAt(l)) != Character.toLowerCase(s.charAt(r))) return false;
            l++;
            r--;
        }
        return true;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - Leaving out «l < r» in the inner loops lets the pointers run past each other on inputs like «".,"».
          - Filtering with «s.replaceAll("[^A-Za-z0-9]", "")» is correct, but it costs O(n) extra memory and a regex.
        `,
        alts: [
          { name: 'Clean copy, then compare with its reverse', time: 'O(n)', space: 'O(n)', note: 'The most readable version, and a good first answer before tightening to O(1) space.',
            java: J`class Solution {
    public boolean isPalindrome(String s) {
        StringBuilder sb = new StringBuilder();
        for (char c : s.toCharArray()) if (Character.isLetterOrDigit(c)) sb.append(Character.toLowerCase(c));
        String t = sb.toString();
        return t.equals(sb.reverse().toString());
    }
}` },
        ],
        followups: M`
          - **Allow deleting one character** (LeetCode 680): on the first mismatch, try skipping the left char or the right char and check the rest.
          - **Longest palindromic substring:** expand around each centre (DP module).
        `,
        talk: 'Two pointers from the ends, skipping non-alphanumerics, comparing lowercase characters, and moving inward. O(n) time, O(1) space.',
      },
      viz: { id: 'palindromeCheck', input: { s: 'Race car!' } },
      lc: [lc(125, 'valid-palindrome', 'Valid Palindrome', 'same'), lc(680, 'valid-palindrome-ii', 'Valid Palindrome II', 'variant'), lc(234, 'palindrome-linked-list', 'Palindrome Linked List', 'harder')],
      drill: { prompt: 'Check whether a phrase reads the same backwards, ignoring case and punctuation, in O(1) space.', pattern: 'two-pointers', why: 'Converging pointers from both ends, skipping characters that don’t count.' },
    } },

    { problem: {
      id: 'two-sum-sorted', title: 'Pair Sum in a Sorted Array', diff: 'medium',
      tags: ['converging pointers', 'sorted'],
      statement: M`
        «numbers» is sorted in **non-decreasing** order. Return the indices «[i, j]» (0-based, «i < j») of the two elements that add up to «target». Exactly one such pair exists.

        Use only **O(1) extra space**, so no hash map this time.
      `,
      fn: { name: 'twoSum', params: [['int[]', 'numbers'], ['int', 'target']], ret: 'int[]' },
      tests: [
        { args: [[2, 7, 11, 15], 9], ex: true, expect: [0, 1] },
        { args: [[2, 3, 4], 6], ex: true, expect: [0, 2] },
        { args: [[-1, 0], -1], expect: [0, 1] },
        { args: [[1, 2, 3, 4, 4, 9, 56, 90], 8], expect: [3, 4] },
        { args: [[5, 25, 75], 100], expect: [1, 2] },
        { args: [[-10, -8, -2, 1, 2, 5, 6], -9], expect: [0, 3] },
        { args: [[0, 0, 3, 4], 0], expect: [0, 1] },
        { args: [{ $gen: 'range', args: [100000, -99999, 2] }, 199996], big: true, expect: [99998, 99999] },
        { args: [{ $gen: 'range', args: [100000, 0, 3] }, 3], big: true, expect: [0, 1] },
      ],
      constraints: ['2 ≤ numbers.length ≤ 10⁵', '−10⁹ ≤ numbers[i], target ≤ 10⁹', 'numbers is sorted non-decreasing', 'Exactly one solution'],
      hints: [
        'Consider the smallest and largest elements. If their sum is too small, can the smallest element be part of any valid pair?',
        'No: pairing it with anything else gives an even smaller sum. So you can discard it.',
        'Pointers at both ends. Too small → move left forward. Too big → move right back.',
      ],
      solution: {
        pattern: '**Converging pointers on sorted data.** Each comparison proves one end can’t be in any answer, so it’s O(n) time and O(1) space.',
        intuition: M`
          Look at the pair (smallest, largest) that remains. If their sum is below the target, the smallest can't pair with anything: its best partner is the largest, and even that falls short. Symmetrically, if the sum is too big, the largest is useless. Every step removes one element, so we find the pair in at most n − 1 steps.
        `,
        java: J`class Solution {
    public int[] twoSum(int[] numbers, int target) {
        int l = 0, r = numbers.length - 1;
        while (l < r) {
            long sum = (long) numbers[l] + numbers[r];   // long: two values near ±1e9 overflow an int
            if (sum == target) return new int[]{l, r};
            if (sum < target) l++;
            else r--;
        }
        return new int[0];
    }
}`,
        time: 'O(n)', space: 'O(1)',
        why: 'The invariant: if a solution exists, it lies within [l, r]. It holds initially, and each move only discards an element proven to be in no solution. The loop stops when the pair is found.',
        pitfalls: M`
          - Overflow: «10⁹ + 10⁹» exceeds «Integer.MAX_VALUE». Sum in «long».
          - «l <= r» would let an element pair with itself.
        `,
        alts: [
          { name: 'Binary search for each complement', time: 'O(n log n)', space: 'O(1)', note: 'For each i, binary-search «target − numbers[i]» in the suffix. Also O(1) space, but slower. Good to mention as the "use sortedness" first idea.',
            java: J`class Solution {
    public int[] twoSum(int[] numbers, int target) {
        for (int i = 0; i < numbers.length; i++) {
            long need = (long) target - numbers[i];
            int lo = i + 1, hi = numbers.length - 1;
            while (lo <= hi) {
                int mid = (lo + hi) >>> 1;
                if (numbers[mid] == need) return new int[]{i, mid};
                if (numbers[mid] < need) lo = mid + 1; else hi = mid - 1;
            }
        }
        return new int[0];
    }
}` },
        ],
        followups: M`
          - **All pairs, without duplicates:** after a match, skip equal values on both sides (the core of 3Sum).
          - **Count pairs with sum < target:** when the sum is too small, every index between l and r pairs with l, so add «r − l» and move l.
        `,
        talk: 'Sorted, so two pointers at the ends: if the sum is too small, the left element can’t work with anything, so move it; if too big, move right. Each step discards one element with proof, so O(n) time, O(1) space. I sum in long to avoid overflow.',
      },
      viz: { id: 'pairSumSorted' },
      lc: [lc(167, 'two-sum-ii-input-array-is-sorted', 'Two Sum II - Input Array Is Sorted', 'same'), lc(1, 'two-sum', 'Two Sum', 'variant'), lc(881, 'boats-to-save-people', 'Boats to Save People', 'similar'), lc(15, '3sum', '3Sum', 'harder')],
      drill: { prompt: 'Sorted array, O(1) extra space: find two entries adding up to a target.', pattern: 'two-pointers', why: 'Sorted + pair + no extra space → converging pointers that discard one end each step.' },
    } },

    { problem: {
      id: 'squares-sorted-array', title: 'Squares of a Sorted Array', diff: 'easy',
      tags: ['converging pointers', 'merge'],
      statement: M`
        «nums» is sorted in non-decreasing order and may contain negatives. Return the squares of its elements, also sorted in non-decreasing order, in **O(n)** time.
      `,
      fn: { name: 'sortedSquares', params: [['int[]', 'nums']], ret: 'int[]' },
      tests: [
        { args: [[-4, -1, 0, 3, 10]], ex: true, expect: [0, 1, 9, 16, 100] },
        { args: [[-7, -3, 2, 3, 11]], ex: true, expect: [4, 9, 9, 49, 121] },
        { args: [[1, 2, 3]], expect: [1, 4, 9] },
        { args: [[-3, -2, -1]], expect: [1, 4, 9] },
        { args: [[0]], expect: [0] },
        { args: [[-5, 5]], expect: [25, 25] },
        { args: [[-10000, 0, 10000]], expect: [0, 100000000, 100000000] },
        { args: [{ $gen: 'sorted', args: [100000, -10000, 10000, 41] }], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁵', '−10⁴ ≤ nums[i] ≤ 10⁴', 'nums is sorted non-decreasing'],
      hints: [
        'Squaring then sorting is O(n log n). Where are the largest squares located?',
        'The largest square is at one of the two **ends** (a very negative or a very positive number).',
        'Fill the output from the back: compare the squares at both ends, write the larger one, and move that pointer inward.',
      ],
      solution: {
        pattern: '**Converging pointers that produce output from the largest end.** It’s really merging two sorted sequences (the negatives reversed, and the positives).',
        intuition: 'Squares shrink toward the element closest to zero, so the biggest square is always at one of the two ends. Repeatedly take the larger end square and place it at the back of the result.',
        java: J`class Solution {
    public int[] sortedSquares(int[] nums) {
        int n = nums.length;
        int[] res = new int[n];
        int l = 0, r = n - 1;
        for (int k = n - 1; k >= 0; k--) {           // fill from the largest down
            int a = nums[l] * nums[l], b = nums[r] * nums[r];
            if (a > b) { res[k] = a; l++; }
            else { res[k] = b; r--; }
        }
        return res;
    }
}`,
        time: 'O(n)', space: 'O(1) extra (output excluded)',
        pitfalls: M`
          - Filling from the front would require finding the element nearest zero first. Filling from the back avoids that.
          - «(-10⁴)² = 10⁸» fits in an «int». Values up to 10⁵ would need «long».
        `,
        alts: [
          { name: 'Square then sort', time: 'O(n log n)', space: 'O(1)–O(n)', java: J`class Solution {
    public int[] sortedSquares(int[] nums) {
        int[] res = new int[nums.length];
        for (int i = 0; i < nums.length; i++) res[i] = nums[i] * nums[i];
        Arrays.sort(res);
        return res;
    }
}` },
        ],
        talk: 'The largest square is at one of the ends, so I use two pointers from the ends and write the larger square into the result from the back. O(n).',
      },
      lc: [lc(977, 'squares-of-a-sorted-array', 'Squares of a Sorted Array', 'same'), lc(88, 'merge-sorted-array', 'Merge Sorted Array', 'similar'), lc(360, 'sort-transformed-array', 'Sort Transformed Array', 'harder', { premium: true })],
      drill: { prompt: 'Sorted array with negatives: return the sorted squares in O(n).', pattern: 'two-pointers', why: 'The biggest squares sit at the two ends; converging pointers fill the result from the back.' },
    } },

    { problem: {
      id: 'remove-duplicates-sorted', title: 'Deduplicate In Place', diff: 'easy',
      tags: ['reader/writer', 'in place'],
      statement: M`
        «nums» is sorted in non-decreasing order. Remove the duplicates **in place** so that each distinct value appears once, keeping the original order, and return «k», the number of distinct values. The first «k» slots of «nums» must hold the result; what's left beyond them doesn't matter.

        Use O(1) extra memory. (The grader checks the first «k» elements.)
      `,
      fn: { name: 'removeDuplicates', params: [['int[]', 'nums']], ret: 'int' },
      post: 'java.util.Arrays.copyOf(a0, r)',
      tests: [
        { args: [[1, 1, 2]], ex: true, expect: [1, 2], why: 'Return k = 2, with nums starting [1, 2, …].' },
        { args: [[0, 0, 1, 1, 1, 2, 2, 3, 3, 4]], ex: true, expect: [0, 1, 2, 3, 4] },
        { args: [[7]], expect: [7] },
        { args: [[2, 2, 2, 2]], expect: [2] },
        { args: [[1, 2, 3]], expect: [1, 2, 3] },
        { args: [[-3, -3, -1, 0, 0, 5]], expect: [-3, -1, 0, 5] },
        { args: [{ $gen: 'sorted', args: [100000, -100, 100, 43] }], big: true },
        { args: [{ $gen: 'range', args: [100000, -50000, 1] }], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁵', '−10⁴ ≤ nums[i] ≤ 10⁴ (the large test also uses a range)', 'nums is sorted non-decreasing'],
      hints: [
        'Because the array is sorted, duplicates are adjacent.',
        'Keep a write index «w»: «nums[0..w)» is the deduplicated prefix so far.',
        'For each element, if it differs from «nums[w − 1]» (the last value kept), copy it to «nums[w]» and advance «w».',
      ],
      solution: {
        pattern: '**Reader/writer pointers**: the in-place filter template. «w» marks the end of the kept prefix; «r» scans everything.',
        intuition: 'In a sorted array, a value is new exactly when it differs from the last value we kept. Copy new values forward into the kept prefix; skip the rest.',
        java: J`class Solution {
    public int removeDuplicates(int[] nums) {
        int w = 1;                                   // nums[0] is always kept
        for (int r = 1; r < nums.length; r++)
            if (nums[r] != nums[w - 1]) nums[w++] = nums[r];
        return w;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        why: 'Invariant: «nums[0..w)» holds the distinct values of «nums[0..r)» in order. A new «nums[r]» that differs from the last kept value is a value we haven’t kept yet (sorted order), so appending it maintains the invariant.',
        pitfalls: M`
          - Comparing «nums[r]» with «nums[r − 1]» also works in this problem, but comparing with «nums[w − 1]» generalizes to "keep at most two" (compare with «nums[w − 2]»).
          - Returning the array instead of «k», or shifting elements left one by one: that's O(n²).
        `,
        alts: [
          { name: 'LinkedHashSet then copy back', time: 'O(n)', space: 'O(n)', note: 'Works even for unsorted input (keeps first occurrences), but uses O(n) memory.',
            java: J`class Solution {
    public int removeDuplicates(int[] nums) {
        Set<Integer> set = new LinkedHashSet<>();
        for (int x : nums) set.add(x);
        int k = 0;
        for (int x : set) nums[k++] = x;
        return k;
    }
}` },
        ],
        followups: M`
          - **Allow each value at most twice** (LeetCode 80): compare with «nums[w − 2]» and start «w» at 2.
          - **Remove a given value** (LeetCode 27) and **move zeroes** (LeetCode 283): the same template with a different keep condition.
        `,
        talk: 'Sorted, so duplicates are adjacent. A write pointer marks the end of the kept prefix; a read pointer scans, copying each value that differs from the last kept one. O(n) time, O(1) space.',
      },
      viz: { id: 'removeDupes' },
      lc: [lc(26, 'remove-duplicates-from-sorted-array', 'Remove Duplicates from Sorted Array', 'same'), lc(80, 'remove-duplicates-from-sorted-array-ii', 'Remove Duplicates from Sorted Array II', 'variant'), lc(27, 'remove-element', 'Remove Element', 'easier'), lc(283, 'move-zeroes', 'Move Zeroes', 'similar')],
      drill: { prompt: 'In-place, O(1) memory: compact a sorted array so every value appears once; return the new length.', pattern: 'two-pointers', why: 'Reader/writer pointers: copy each new value forward to the write index.' },
    } },

    { problem: {
      id: 'sort-colors', title: 'Sort Three Colors in One Pass', diff: 'medium',
      tags: ['Dutch flag', 'three pointers', 'in place'],
      statement: M`
        «nums» contains only «0» (red), «1» (white) and «2» (blue). Sort it **in place** so that all 0s come first, then all 1s, then all 2s.

        Don't call a library sort. The challenge is **one pass with O(1) extra space**. Your method returns nothing; the grader inspects «nums».
      `,
      fn: { name: 'sortColors', params: [['int[]', 'nums']], ret: 'void' },
      tests: [
        { args: [[2, 0, 2, 1, 1, 0]], ex: true, expect: [0, 0, 1, 1, 2, 2] },
        { args: [[2, 0, 1]], ex: true, expect: [0, 1, 2] },
        { args: [[0]], expect: [0] },
        { args: [[2, 2, 2]], expect: [2, 2, 2] },
        { args: [[1, 0]], expect: [0, 1] },
        { args: [[2, 1, 0, 0, 1, 2, 2, 0]], expect: [0, 0, 0, 1, 1, 2, 2, 2] },
        { args: [[1, 2, 0]], expect: [0, 1, 2] },
        { args: [{ $gen: 'ints', args: [100000, 0, 2, 47] }], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁵ (LeetCode: ≤ 300)', 'nums[i] ∈ {0, 1, 2}'],
      hints: [
        'Two passes are easy: count the 0s, 1s and 2s, then overwrite. Can you do it in one?',
        'Maintain three regions: 0s at the front, 2s at the back, 1s in the middle, and an unknown region between «mid» and «high».',
        'Look at «nums[mid]»: a 0 swaps to «low» (advance both), a 1 just advances «mid», and a 2 swaps to «high» (move «high» back, but **don’t** advance «mid»).',
      ],
      solution: {
        pattern: '**Dutch national flag (three-way partition):** three pointers maintain the regions «< | = | unknown | >» and shrink the unknown by one each step.',
        intuition: M`
          Keep the invariant: «[0, low)» are 0s, «[low, mid)» are 1s, «(high, n−1]» are 2s, and «[mid, high]» is unexamined. Look at «nums[mid]» and move it into the correct region with at most one swap. When «mid» passes «high», nothing is unexamined.
        `,
        java: J`class Solution {
    public void sortColors(int[] nums) {
        int low = 0, mid = 0, high = nums.length - 1;
        while (mid <= high) {
            if (nums[mid] == 0) swap(nums, low++, mid++);
            else if (nums[mid] == 1) mid++;
            else swap(nums, mid, high--);   // the value swapped in from high is unexamined, so mid stays
        }
    }

    private void swap(int[] a, int i, int j) { int t = a[i]; a[i] = a[j]; a[j] = t; }
}`,
        time: 'O(n)', space: 'O(1)',
        why: 'When nums[mid] = 0, the element at low is a 1 (or low == mid), so after the swap both regions stay valid and both pointers advance. When nums[mid] = 2, the swapped-in element came from the unknown region, so mid must re-check it.',
        pitfalls: M`
          - Advancing «mid» after swapping with «high»: the incoming value might be a 0 or a 2, and it would go unexamined.
          - Using «mid < high» as the loop condition leaves the last unknown element unexamined.
        `,
        alts: [
          { name: 'Counting sort (two passes)', time: 'O(n)', space: 'O(1)', note: 'Count each color, then overwrite. Perfectly fine if two passes are allowed.',
            java: J`class Solution {
    public void sortColors(int[] nums) {
        int[] c = new int[3];
        for (int x : nums) c[x]++;
        int k = 0;
        for (int v = 0; v < 3; v++) while (c[v]-- > 0) nums[k++] = v;
    }
}` },
        ],
        followups: M`
          - **Quicksort with many duplicates:** three-way partitioning prevents O(n²) on arrays with repeated keys.
          - **k colors:** counting sort, or repeatedly partition around the smallest and largest remaining colors.
        `,
        talk: 'Dutch national flag: low, mid and high pointers maintain zeros, ones, unknown and twos. A 0 swaps to low, a 1 advances mid, a 2 swaps to high without advancing mid. One pass, O(1) space.',
      },
      viz: { id: 'dutchFlag' },
      lc: [lc(75, 'sort-colors', 'Sort Colors', 'same'), lc(905, 'sort-array-by-parity', 'Sort Array By Parity', 'easier'), lc(2161, 'partition-array-according-to-given-pivot', 'Partition Array According to Given Pivot', 'variant')],
      drill: { prompt: 'Rearrange an array of 0s, 1s and 2s into sorted order in a single pass with O(1) extra space.', pattern: 'two-pointers', why: 'Dutch national flag: low/mid/high pointers partition into three regions.' },
    } },

    { problem: {
      id: 'three-sum', title: 'Triplets Summing to Zero', diff: 'medium',
      tags: ['sort', 'two pointers', 'dedupe'],
      statement: M`
        Given an integer array «nums», return **all unique triplets** «[a, b, c]» of elements (at distinct indices) such that «a + b + c == 0».

        "Unique" means no two triplets contain the same three values. Return them in any order; the order of values within a triplet doesn't matter either.
      `,
      fn: { name: 'threeSum', params: [['int[]', 'nums']], ret: 'List<List<Integer>>' },
      compare: 'unordered-deep',
      tests: [
        { args: [[-1, 0, 1, 2, -1, -4]], ex: true, expect: [[-1, -1, 2], [-1, 0, 1]] },
        { args: [[0, 1, 1]], ex: true, expect: [] },
        { args: [[0, 0, 0]], ex: true, expect: [[0, 0, 0]] },
        { args: [[0, 0, 0, 0]], expect: [[0, 0, 0]], why: 'Four zeros still make only one distinct triplet.' },
        { args: [[-2, 0, 1, 1, 2]], expect: [[-2, 0, 2], [-2, 1, 1]] },
        { args: [[1, 2, -2, -1]], expect: [] },
        { args: [[-4, -2, -2, -2, 0, 1, 2, 2, 2, 3, 3, 4, 4, 6, 6]] },
        { args: [[3, -2, 1, 0]], expect: [] },
        { args: [{ $gen: 'ints', args: [3000, -100000, 100000, 51] }], big: true },
        { args: [{ $gen: 'ints', args: [3000, -50, 50, 52] }], big: true },
      ],
      constraints: ['3 ≤ nums.length ≤ 3000', '−10⁵ ≤ nums[i] ≤ 10⁵'],
      hints: [
        'Fix the first element «a». What problem remains for the other two?',
        'A pair summing to «−a», which is Two Sum. Sort the array first and it becomes the sorted, two-pointer version.',
        'To avoid duplicates: skip an «i» whose value equals the previous «i»’s value, and after recording a triplet, move «l» and «r» past equal values.',
      ],
      solution: {
        pattern: '**Sort + fix one + converging pointers:** the k-Sum template. Sorting also makes deduplication a matter of skipping equal neighbours.',
        intuition: M`
          Brute force over all triples is O(n³). Fixing «nums[i]» reduces the rest to "find pairs summing to «−nums[i]»" in the suffix, which the sorted two-pointer scan does in O(n). Total O(n²). Sorting also groups equal values, so choosing only the first of each run of equal values (for i, l and r) guarantees every triplet appears exactly once.
        `,
        java: J`class Solution {
    public List<List<Integer>> threeSum(int[] nums) {
        Arrays.sort(nums);
        List<List<Integer>> res = new ArrayList<>();
        int n = nums.length;
        for (int i = 0; i < n - 2 && nums[i] <= 0; i++) {       // nums[i] > 0 means all three are positive
            if (i > 0 && nums[i] == nums[i - 1]) continue;       // same first value as before
            int l = i + 1, r = n - 1;
            while (l < r) {
                int sum = nums[i] + nums[l] + nums[r];
                if (sum < 0) l++;
                else if (sum > 0) r--;
                else {
                    res.add(Arrays.asList(nums[i], nums[l], nums[r]));
                    while (l < r && nums[l] == nums[l + 1]) l++;   // skip duplicates on both sides
                    while (l < r && nums[r] == nums[r - 1]) r--;
                    l++; r--;
                }
            }
        }
        return res;
    }
}`,
        time: 'O(n²)', space: 'O(1) extra (besides sorting and the output)',
        pitfalls: M`
          - Deduplicating with a «HashSet<List<Integer>>» works, but hides the real skill and costs more. Interviewers usually want the skip logic.
          - Skipping «i» when «nums[i] == nums[i + 1]» (looking forward) wrongly drops triplets like «[-1, -1, 2]». Compare with the **previous** value.
          - After a match, move both pointers. Moving only one leads to re-finding the same pair or looping forever.
        `,
        alts: [
          { name: 'Hash set per fixed element', time: 'O(n²)', space: 'O(n)', note: 'Fix i, then run a hash-based Two Sum on the rest, deduplicating the results with a set of sorted triplets. Same complexity, clunkier.',
            java: J`class Solution {
    public List<List<Integer>> threeSum(int[] nums) {
        Arrays.sort(nums);
        Set<List<Integer>> out = new HashSet<>();
        for (int i = 0; i < nums.length; i++) {
            Set<Integer> seen = new HashSet<>();
            for (int j = i + 1; j < nums.length; j++) {
                int need = -nums[i] - nums[j];
                if (seen.contains(need)) out.add(Arrays.asList(nums[i], need, nums[j]));
                seen.add(nums[j]);
            }
        }
        return new ArrayList<>(out);
    }
}` },
          { name: 'Brute force triples', time: 'O(n³)', space: 'O(n)', check: false, note: 'Three nested loops over sorted input, adding each zero-sum triplet to a set to deduplicate. Mention it as the baseline; 3000³ ≈ 2.7·10¹⁰ is far too slow.' },
        ],
        followups: M`
          - **3Sum Closest** (LeetCode 16): same loop, and track the sum with the smallest |sum − target|.
          - **4Sum** (LeetCode 18): one more outer loop (O(n³)), and watch for overflow with large values.
          - **Count triplets with sum < target:** when the sum is too small, all «r − l» pairs with that «l» work.
        `,
        talk: 'Sort, fix each first element, and two-pointer the remaining suffix for a pair summing to its negative. Skip equal values for i, and move l and r past equal values after a match, so every triplet appears once. O(n²).',
      },
      viz: { id: 'threeSum' },
      lc: [lc(15, '3sum', '3Sum', 'same'), lc(16, '3sum-closest', '3Sum Closest', 'variant'), lc(18, '4sum', '4Sum', 'harder'), lc(259, '3sum-smaller', '3Sum Smaller', 'variant', { premium: true })],
      drill: { prompt: 'Find all unique triples of values that add up to zero.', pattern: 'two-pointers', why: 'Sort, fix one element, and find the remaining pair with converging pointers, skipping duplicates: O(n²).' },
    } },

    { problem: {
      id: 'container-most-water', title: 'Biggest Container', diff: 'medium',
      tags: ['converging pointers', 'greedy proof'],
      statement: M`
        You're given «n» vertical walls; wall «i» stands at x = i with height «height[i]». Choose two walls that, together with the x-axis, form a container. It holds «min(height[i], height[j]) × (j − i)» units of water.

        Return the **maximum** amount of water a container can hold.
      `,
      fn: { name: 'maxArea', params: [['int[]', 'height']], ret: 'int' },
      tests: [
        { args: [[1, 8, 6, 2, 5, 4, 8, 3, 7]], ex: true, expect: 49, why: 'Walls at 1 (height 8) and 8 (height 7): min(8, 7) × 7 = 49.' },
        { args: [[1, 1]], ex: true, expect: 1 },
        { args: [[4, 3, 2, 1, 4]], expect: 16 },
        { args: [[1, 2, 1]], expect: 2 },
        { args: [[0, 0, 0]], expect: 0 },
        { args: [[2, 3, 10, 5, 7, 8, 9]], expect: 36 },
        { args: [[1, 2, 4, 3]], expect: 4 },
        { args: [{ $gen: 'ints', args: [100000, 0, 10000, 53] }], big: true },
        { args: [{ $gen: 'range', args: [100000, 1, 1] }], big: true },
      ],
      constraints: ['2 ≤ height.length ≤ 10⁵', '0 ≤ height[i] ≤ 10⁴'],
      hints: [
        'Start with the widest container, the two outermost walls. How could a narrower container ever beat it?',
        'Only by being taller, and the height is capped by the **shorter** wall.',
        'Move the pointer at the shorter wall inward (any container keeping it is narrower and no taller). Track the best area as you go.',
      ],
      solution: {
        pattern: '**Converging pointers with a discard proof.** Move the side that limits the answer; everything it skipped is provably worse.',
        intuition: M`
          Area = (shorter height) × (width). Start at maximum width. To have any chance of beating it with a narrower container, you need a taller limiting wall. The shorter of the two current walls is the bottleneck, and every container that still uses it is narrower with height at most that wall, so worse. Discard it and move on.
        `,
        java: J`class Solution {
    public int maxArea(int[] height) {
        int l = 0, r = height.length - 1, best = 0;
        while (l < r) {
            best = Math.max(best, Math.min(height[l], height[r]) * (r - l));
            if (height[l] < height[r]) l++;
            else r--;
        }
        return best;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        why: M`
          Suppose «height[l] ≤ height[r]». For any «k» in «(l, r)», the container «(l, k)» has width «< r − l» and height «≤ height[l]», so its area is below the one we just measured. Discarding «l» can't lose the optimum. The same holds symmetrically for «r».
        `,
        pitfalls: M`
          - Moving the taller wall: that can only shrink the width without raising the cap.
          - Area can reach «10⁴ × 10⁵ = 10⁹», still inside «int». Double-check such bounds when the constraints grow.
        `,
        alts: [
          { name: 'All pairs', time: 'O(n²)', space: 'O(1)', java: J`class Solution {
    public int maxArea(int[] height) {
        int best = 0;
        for (int i = 0; i < height.length; i++)
            for (int j = i + 1; j < height.length; j++)
                best = Math.max(best, Math.min(height[i], height[j]) * (j - i));
        return best;
    }
}` },
        ],
        followups: M`
          - **Trapping Rain Water** looks similar but sums water over every bar. It needs prefix/suffix maxima or the two-pointer variant (next problem).
        `,
        talk: 'Start with the widest pair. The shorter wall bounds every container that uses it, and any narrower one is worse, so I move the shorter side inward while tracking the best. Each step discards one wall with proof: O(n).',
      },
      viz: { id: 'containerWater' },
      lc: [lc(11, 'container-with-most-water', 'Container With Most Water', 'same'), lc(42, 'trapping-rain-water', 'Trapping Rain Water', 'harder'), lc(1793, 'maximum-score-of-a-good-subarray', 'Maximum Score of a Good Subarray', 'harder')],
      drill: { prompt: 'Pick two walls to maximize min(height) × distance between them.', pattern: 'two-pointers', why: 'Converging pointers; always move the shorter wall, which limits every narrower container.' },
    } },

    { problem: {
      id: 'trapping-rain-water', title: 'Trapping Rain Water', diff: 'hard',
      tags: ['two pointers', 'prefix max'],
      statement: M`
        «height» describes an elevation map of bars, each 1 unit wide. After it rains, water collects in the dips between bars. Return how many units of water are trapped.
      `,
      fn: { name: 'trap', params: [['int[]', 'height']], ret: 'int' },
      tests: [
        { args: [[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], ex: true, expect: 6 },
        { args: [[4, 2, 0, 3, 2, 5]], ex: true, expect: 9 },
        { args: [[1]], expect: 0 },
        { args: [[3, 0, 3]], expect: 3 },
        { args: [[1, 2, 3, 4]], expect: 0, why: 'Always rising: water runs off the left.' },
        { args: [[5, 4, 1, 2]], expect: 1 },
        { args: [[2, 0, 2, 0, 2]], expect: 4 },
        { args: [[0, 0, 0]], expect: 0 },
        { args: [{ $gen: 'ints', args: [100000, 0, 100000, 57] }], big: true },
      ],
      constraints: ['1 ≤ height.length ≤ 10⁵ (LeetCode: 2·10⁴)', '0 ≤ height[i] ≤ 10⁵'],
      hints: [
        'Focus on one bar. How high can water stand above it?',
        'Up to «min(tallest bar to its left, tallest bar to its right)», minus its own height (if positive). Precomputing both maxima gives O(n) time with O(n) space.',
        'For O(1) space, use two pointers. If «height[l] < height[r]», the water at «l» is bounded by «leftMax» (the right side is at least «height[r]», which is taller). Process that side and move inward.',
      ],
      solution: {
        pattern: '**Prefix/suffix maxima**, compressed into **two pointers.** Water per bar = min(maxLeft, maxRight) − height, and the pointers always process the side whose limiting max is already known.',
        intuition: M`
          The water above bar «i» is «min(maxLeft(i), maxRight(i)) − height[i]». The O(n)-space solution builds both maxima arrays. The two-pointer version notices that you don't need both maxima exactly, only which one is smaller. If «height[l] < height[r]», the right side is guaranteed to contain a wall at least «height[r]» tall, which is at least as tall as anything that set «leftMax». So «leftMax» is the smaller bound, the water at «l» is exactly «leftMax − height[l]», and we can move «l».
        `,
        java: J`class Solution {
    public int trap(int[] height) {
        int l = 0, r = height.length - 1;
        int leftMax = 0, rightMax = 0;
        long water = 0;
        while (l < r) {
            if (height[l] < height[r]) {
                leftMax = Math.max(leftMax, height[l]);
                water += leftMax - height[l];       // right side has a wall >= height[r] > height[l]
                l++;
            } else {
                rightMax = Math.max(rightMax, height[r]);
                water += rightMax - height[r];
                r--;
            }
        }
        return (int) water;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        why: M`
          When we process «l» (because «height[l] < height[r]»), «leftMax» is the true left maximum for «l». The right maximum for «l» is at least «height[r]». Since «leftMax» came from bars that lost earlier comparisons to the right side, «leftMax ≤ height[r]» holds, so «min(leftMax, maxRight) = leftMax». The symmetric argument covers «r».
        `,
        pitfalls: M`
          - Moving the side with the *larger* height uses the wrong bound.
          - Total water can exceed «int» for large inputs (10⁵ bars × 10⁵ height). Accumulate in «long».
        `,
        alts: [
          { name: 'Prefix and suffix max arrays', time: 'O(n)', space: 'O(n)', note: 'The most explainable version: build «maxL[i]» and «maxR[i]», then sum «min(maxL, maxR) − h».',
            java: J`class Solution {
    public int trap(int[] h) {
        int n = h.length;
        int[] maxL = new int[n], maxR = new int[n];
        for (int i = 0; i < n; i++) maxL[i] = Math.max(i > 0 ? maxL[i - 1] : 0, h[i]);
        for (int i = n - 1; i >= 0; i--) maxR[i] = Math.max(i < n - 1 ? maxR[i + 1] : 0, h[i]);
        long water = 0;
        for (int i = 0; i < n; i++) water += Math.min(maxL[i], maxR[i]) - h[i];
        return (int) water;
    }
}` },
          { name: 'Monotonic stack (fill layer by layer)', time: 'O(n)', space: 'O(n)', note: 'Keep a decreasing stack of indices. When a taller bar arrives, pop a bottom and add the water between the new bar and the new stack top. It computes water horizontally, which bridges to the Monotonic Stack lesson.',
            java: J`class Solution {
    public int trap(int[] h) {
        Deque<Integer> st = new ArrayDeque<>();
        long water = 0;
        for (int i = 0; i < h.length; i++) {
            while (!st.isEmpty() && h[i] > h[st.peek()]) {
                int bottom = st.pop();
                if (st.isEmpty()) break;
                int left = st.peek();
                water += (long) (Math.min(h[left], h[i]) - h[bottom]) * (i - left - 1);
            }
            st.push(i);
        }
        return (int) water;
    }
}` },
          { name: 'Per bar, scan both directions', time: 'O(n²)', space: 'O(1)', check: false, note: 'For each bar, find the tallest bar to its left and right by scanning. It’s the direct translation of the formula, and the repeated scans are exactly what the maxima arrays cache.' },
        ],
        followups: M`
          - **Trapping rain water II** (LeetCode 407, a 2-D height map): a min-heap flood from the border (Dijkstra-like).
        `,
        talk: 'Water above a bar is min(max left, max right) minus its height. With two pointers, whichever side has the smaller current height has its bound determined by its own running max, so I process that side and move inward. O(n) time, O(1) space.',
      },
      viz: { id: 'trapWater' },
      lc: [lc(42, 'trapping-rain-water', 'Trapping Rain Water', 'same'), lc(11, 'container-with-most-water', 'Container With Most Water', 'easier'), lc(407, 'trapping-rain-water-ii', 'Trapping Rain Water II', 'harder')],
      drill: { prompt: 'Elevation bars: how much rain water collects between them?', pattern: 'two-pointers', why: 'Water at i = min(max left, max right) − h[i]; two pointers process the side with the smaller max in O(1) space.' },
    } },
  ],
});
})();

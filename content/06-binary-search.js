(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

DSA.module({
  id: 'binary-search', title: 'Binary Search', short: 'Binary search',
  blurb: 'One template (find the first index where a condition turns true) covers sorted arrays, rotated arrays, and searching the answer itself.',
  intro: M`
    Binary search is easy to describe and famously easy to get wrong: infinite loops, off-by-one errors, «mid» overflow. This module teaches **one** template and shows that every variant is the same template with a different condition. The second lesson applies it to the *answer space*, which is where most medium and hard binary-search problems live.
  `,
  more: [
    lc(35, 'search-insert-position', 'Search Insert Position', 'easier'),
    lc(69, 'sqrtx', 'Sqrt(x)', 'easier'),
    lc(278, 'first-bad-version', 'First Bad Version', 'easier'),
    lc(374, 'guess-number-higher-or-lower', 'Guess Number Higher or Lower', 'easier'),
    lc(540, 'single-element-in-a-sorted-array', 'Single Element in a Sorted Array', 'similar'),
    lc(81, 'search-in-rotated-sorted-array-ii', 'Search in Rotated Sorted Array II', 'variant'),
    lc(240, 'search-a-2d-matrix-ii', 'Search a 2D Matrix II', 'variant'),
    lc(1482, 'minimum-number-of-days-to-make-m-bouquets', 'Minimum Number of Days to Make m Bouquets', 'similar'),
    lc(410, 'split-array-largest-sum', 'Split Array Largest Sum', 'harder'),
    lc(1283, 'find-the-smallest-divisor-given-a-threshold', 'Find the Smallest Divisor Given a Threshold', 'similar'),
    lc(378, 'kth-smallest-element-in-a-sorted-matrix', 'Kth Smallest Element in a Sorted Matrix', 'harder'),
    lc(2226, 'maximum-candies-allocated-to-k-children', 'Maximum Candies Allocated to K Children', 'similar'),
  ],
  items: [
    { lesson: 'binary-search', title: 'Binary search: one template', mins: 13,
      lede: 'Stop memorizing variants. Find the first index where a monotone condition becomes true, and every problem is a choice of condition.',
      body: M`
        ## Think in conditions, not targets
        Binary search works whenever a condition over the index is **monotone**: false, false, …, false, true, true, …, true. The job is to find the **first true**. Looking for a value «x» in a sorted array? The condition is «a[i] ≥ x». The first index where it holds is where x is (or where it would be inserted).

        @viz lowerBound

        ~~~java Template: first index in [lo, hi) where ok(i) is true (hi if none)
        int lo = 0, hi = n;                 // the answer is in [lo, hi]
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;   // lo <= mid < hi, never overflows
            if (ok(mid)) hi = mid;          // mid could be the answer: keep it
            else lo = mid + 1;              // mid is not: discard it and everything left of it
        }
        return lo;                          // lo == hi == first true (or n)
        ~~~

        :::key Why this template never loops forever
        «mid» is always strictly less than «hi», so «hi = mid» shrinks the range, and «lo = mid + 1» shrinks it too. The range strictly shrinks every iteration, and «lo == hi» is the answer. There's no «lo <= hi» / «mid − 1» / "did I overshoot?" bookkeeping to get wrong.
        :::

        ## Every variant is a condition
        | Goal | Condition «ok(i)» | Result |
        |---|---|---|
        | First index with «a[i] ≥ x» (lower bound, insert position) | «a[i] >= x» | «lo» |
        | First index with «a[i] > x» (upper bound) | «a[i] > x» | «lo» |
        | Does x exist? | «a[i] >= x», then check «lo < n && a[lo] == x» | |
        | Last index with «a[i] ≤ x» | first with «a[i] > x», minus 1 | «lo − 1» |
        | Count of x | upper bound − lower bound | |
        | Minimum of a rotated sorted array | «a[i] <= a[n − 1]» | «lo» |
        | First bad version / first day that works | «isBad(i)» | «lo» |

        ## Rotated arrays
        A sorted array rotated at an unknown point («[4,5,6,7,0,1,2]») isn't monotone, but it's two sorted runs. Around any «mid», **one half is sorted**. Check whether the target falls inside the sorted half's range; if not, it's in the other half.

        @viz rotatedSearch

        ## A 2-D sorted matrix is a 1-D array
        If each row is sorted and every row's first element exceeds the previous row's last, flatten it: index «k» ↔ «matrix[k / cols][k % cols]», and binary-search «[0, rows × cols)».

        ## In the Java standard library
        - «Arrays.binarySearch(a, x)» returns an index of x if present (*any* one, if there are duplicates), else «−(insertionPoint) − 1». Decode that with «−(r + 1)».
        - «Collections.binarySearch(list, x)» does the same for lists.
        - «TreeMap/TreeSet» «floorKey»/«ceilingKey» are binary search on a tree, plus O(log n) inserts.

        In interviews, write your own: they want to see the invariant.

        ## Signals
        - **Sorted** input and a lookup → binary search, O(log n).
        - "Find the first/last position of…" → lower/upper bound.
        - "Rotated sorted array" → the sorted-half check.
        - "O(log n) required" in the statement → there's a monotone condition somewhere.
        - A hidden monotone function: "first bad version", "peak element" (compare with the neighbour).

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'With the template (ok(mid) → hi = mid, else lo = mid + 1), what does it return for «a = [1, 3, 3, 5]», «ok(i) = a[i] > 3»?',
          options: ['1', '2', '3', '4'],
          answer: 2, why: 'The condition is F, F, F, T, so the first true is at index **3** (value 5): the upper bound of 3.' },
        { q: 'Why write «mid = lo + (hi − lo) / 2» instead of «(lo + hi) / 2»?',
          options: ['It’s faster', '«lo + hi» can overflow int when both are large; the difference can’t', 'It rounds up', 'Java requires it'],
          answer: 1, why: 'With indices or values near 2³¹, «lo + hi» overflows to a negative number. «(lo + hi) >>> 1» also works for non-negative values.' },
      ],
      practice: ['binary-search', 'first-last-position', 'search-rotated', 'find-min-rotated', 'search-2d-matrix', 'peak-element'],
    },

    { problem: {
      id: 'binary-search', title: 'Classic Binary Search', diff: 'easy',
      tags: ['binary search'],
      statement: M`
        Given a sorted (ascending) array of **distinct** integers «nums» and a «target», return the index of «target», or «−1» if it's absent. Your algorithm must run in **O(log n)**.
      `,
      fn: { name: 'search', params: [['int[]', 'nums'], ['int', 'target']], ret: 'int' },
      tests: [
        { args: [[-1, 0, 3, 5, 9, 12], 9], ex: true, expect: 4 },
        { args: [[-1, 0, 3, 5, 9, 12], 2], ex: true, expect: -1 },
        { args: [[5], 5], expect: 0 },
        { args: [[5], -5], expect: -1 },
        { args: [[1, 3], 3], expect: 1 },
        { args: [[1, 3], 0], expect: -1 },
        { args: [[1, 3], 4], expect: -1 },
        { args: [[2, 4, 6, 8, 10, 12, 14], 2], expect: 0 },
        { args: [[2, 4, 6, 8, 10, 12, 14], 14], expect: 6 },
        { args: [{ $gen: 'range', args: [100000, -1000000, 7] }, 699993], big: true },
        { args: [{ $gen: 'range', args: [100000, 0, 2] }, 3], big: true, expect: -1 },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁵ (LeetCode: 10⁴)', 'Values are distinct and sorted ascending'],
      hints: [
        'Compare the target with the middle element. Which half can you discard?',
        'Use the template: find the first index with «nums[i] ≥ target».',
        'At the end, check that the index is in range and holds the target.',
      ],
      solution: {
        pattern: '**Lower bound, then check:** the template with condition «nums[i] ≥ target».',
        intuition: 'Each comparison with the middle element rules out half of the remaining range, so after about log₂(n) steps one candidate remains.',
        java: J`class Solution {
    public int search(int[] nums, int target) {
        int lo = 0, hi = nums.length;               // first index with nums[i] >= target
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] >= target) hi = mid;
            else lo = mid + 1;
        }
        return (lo < nums.length && nums[lo] == target) ? lo : -1;
    }
}`,
        time: 'O(log n)', space: 'O(1)',
        pitfalls: M`
          - Off-by-one in the classic «while (lo <= hi)» version: it needs «hi = n − 1», «hi = mid − 1», and a return inside the loop. Mixing the two styles is the most common bug.
          - Forgetting the final bounds check before reading «nums[lo]».
        `,
        alts: [
          { name: 'Closed interval [lo, hi] with early return', time: 'O(log n)', space: 'O(1)', note: 'The textbook version. Fine as long as you keep its three rules consistent.',
            java: J`class Solution {
    public int search(int[] nums, int target) {
        int lo = 0, hi = nums.length - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] == target) return mid;
            if (nums[mid] < target) lo = mid + 1; else hi = mid - 1;
        }
        return -1;
    }
}` },
          { name: 'Arrays.binarySearch', time: 'O(log n)', space: 'O(1)', java: J`class Solution {
    public int search(int[] nums, int target) {
        int r = Arrays.binarySearch(nums, target);
        return r >= 0 ? r : -1;
    }
}` },
        ],
        talk: 'Binary search for the first index with nums[i] ≥ target using a half-open range, then check that it holds the target. O(log n), with mid computed as lo + (hi − lo)/2 to avoid overflow.',
      },
      viz: { id: 'lowerBound', input: { nums: [-1, 0, 3, 5, 9, 12], target: 9 } },
      lc: [lc(704, 'binary-search', 'Binary Search', 'same'), lc(35, 'search-insert-position', 'Search Insert Position', 'variant'), lc(278, 'first-bad-version', 'First Bad Version', 'variant')],
      drill: { prompt: 'Find a target in a sorted array of distinct integers in O(log n).', pattern: 'binary-search', why: 'Sorted + lookup + O(log n) → binary search.' },
    } },

    { problem: {
      id: 'first-last-position', title: 'First and Last Occurrence', diff: 'medium',
      tags: ['lower bound', 'upper bound'],
      statement: M`
        «nums» is sorted in non-decreasing order and may contain duplicates. Return «[first, last]», the first and last index where «target» appears, or «[−1, −1]» if it doesn't. Run in **O(log n)**.
      `,
      fn: { name: 'searchRange', params: [['int[]', 'nums'], ['int', 'target']], ret: 'int[]' },
      tests: [
        { args: [[5, 7, 7, 8, 8, 10], 8], ex: true, expect: [3, 4] },
        { args: [[5, 7, 7, 8, 8, 10], 6], ex: true, expect: [-1, -1] },
        { args: [[], 0], ex: true, expect: [-1, -1] },
        { args: [[1], 1], expect: [0, 0] },
        { args: [[2, 2, 2, 2], 2], expect: [0, 3] },
        { args: [[1, 2, 3], 3], expect: [2, 2] },
        { args: [[1, 2, 3], 4], expect: [-1, -1] },
        { args: [[1, 1, 2, 2, 2, 3], 2], expect: [2, 4] },
        { args: [{ $gen: 'sorted', args: [100000, 0, 500, 93] }, 250], big: true },
        { args: [{ $gen: 'repeat', args: [100000, 7] }, 7], big: true, expect: [0, 99999], why: 'A linear scan from the first match would be O(n).' },
      ],
      constraints: ['0 ≤ nums.length ≤ 10⁵', 'nums is sorted non-decreasing'],
      hints: [
        'Finding one occurrence and then scanning outward is O(n) when the whole array equals the target.',
        'The first occurrence is the lower bound: the first index with «nums[i] ≥ target».',
        'The last occurrence is (first index with «nums[i] > target») − 1. That’s two binary searches.',
      ],
      solution: {
        pattern: '**Lower bound and upper bound:** two runs of the same template with conditions «≥ target» and «> target». The count of target is their difference.',
        intuition: 'Both boundaries are "first true" questions with different conditions. The first index ≥ target starts the run of targets; the first index > target is just past its end.',
        java: J`class Solution {
    public int[] searchRange(int[] nums, int target) {
        int first = firstTrue(nums, target, false);   // first nums[i] >= target
        if (first == nums.length || nums[first] != target) return new int[]{-1, -1};
        int last = firstTrue(nums, target, true) - 1;  // first nums[i] > target, minus one
        return new int[]{first, last};
    }

    private int firstTrue(int[] a, int target, boolean strict) {
        int lo = 0, hi = a.length;
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (strict ? a[mid] > target : a[mid] >= target) hi = mid;
            else lo = mid + 1;
        }
        return lo;
    }
}`,
        time: 'O(log n)', space: 'O(1)',
        pitfalls: M`
          - "Find any match, then expand" degrades to O(n) on runs of duplicates. The last big test is exactly that.
          - Empty arrays: «first == nums.length» must be checked before indexing.
        `,
        alts: [
          { name: 'Find one, then expand', time: 'O(log n + k)', space: 'O(1)', note: 'k = number of occurrences, which is O(n) in the worst case.',
            java: J`class Solution {
    public int[] searchRange(int[] nums, int target) {
        int i = Arrays.binarySearch(nums, target);
        if (i < 0) return new int[]{-1, -1};
        int l = i, r = i;
        while (l > 0 && nums[l - 1] == target) l--;
        while (r < nums.length - 1 && nums[r + 1] == target) r++;
        return new int[]{l, r};
    }
}` },
        ],
        talk: 'Two binary searches with the same template: the first index ≥ target gives the start, the first index > target minus one gives the end. If the start doesn’t hold the target, return [−1, −1]. O(log n).',
      },
      viz: { id: 'lowerBound', input: { nums: [5, 7, 7, 8, 8, 10], target: 8 } },
      lc: [lc(34, 'find-first-and-last-position-of-element-in-sorted-array', 'Find First and Last Position of Element in Sorted Array', 'same'), lc(2089, 'find-target-indices-after-sorting-array', 'Find Target Indices After Sorting Array', 'easier'), lc(1150, 'check-if-a-number-is-majority-element-in-a-sorted-array', 'Check If a Number Is Majority Element in a Sorted Array', 'similar', { premium: true })],
      drill: { prompt: 'Sorted array with duplicates: first and last index of a target in O(log n).', pattern: 'binary-search', why: 'Lower bound (≥) and upper bound (>) − 1: two binary searches.' },
    } },

    { problem: {
      id: 'search-rotated', title: 'Search a Rotated Sorted Array', diff: 'medium',
      tags: ['binary search', 'rotated'],
      statement: M`
        A sorted array of **distinct** integers was rotated at an unknown pivot. For example, «[0,1,2,4,5,6,7]» might become «[4,5,6,7,0,1,2]». Given the rotated array «nums» and a «target», return its index, or «−1» if it's absent, in **O(log n)**.
      `,
      fn: { name: 'search', params: [['int[]', 'nums'], ['int', 'target']], ret: 'int' },
      tests: [
        { args: [[4, 5, 6, 7, 0, 1, 2], 0], ex: true, expect: 4 },
        { args: [[4, 5, 6, 7, 0, 1, 2], 3], ex: true, expect: -1 },
        { args: [[1], 0], ex: true, expect: -1 },
        { args: [[1], 1], expect: 0 },
        { args: [[3, 1], 1], expect: 1 },
        { args: [[1, 3], 3], expect: 1, why: 'Rotated by 0: still valid.' },
        { args: [[5, 1, 3], 5], expect: 0 },
        { args: [[6, 7, 8, 1, 2, 3, 4, 5], 8], expect: 2 },
        { args: [[6, 7, 8, 1, 2, 3, 4, 5], 5], expect: 7 },
        { args: [{ $gen: 'rotated', args: [100000, -500000, 9, 73217, 95] }, 12345], big: true },
        { args: [{ $gen: 'rotated', args: [100000, 0, 3, 99999, 96] }, 4], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁵', 'Values are distinct', 'nums is an ascending array rotated at some pivot'],
      hints: [
        'Split at «mid». At least one of the two halves «[lo, mid]» and «[mid, hi]» is sorted normally. How can you tell which?',
        'If «nums[lo] ≤ nums[mid]», the left half is sorted. Otherwise the right half is.',
        'If the target lies within the sorted half’s value range, search there; otherwise search the other half.',
      ],
      solution: {
        pattern: '**Binary search on a structure with one sorted half:** decide which half is sorted, then whether the target is inside it.',
        intuition: M`
          The rotation point lies in only one of the two halves, so the other half is a normal sorted range and we can test in O(1) whether the target could be in it. If it could, go there; if not, the target (if present) is in the other half. Either way, half the range is discarded.
        `,
        java: J`class Solution {
    public int search(int[] nums, int target) {
        int lo = 0, hi = nums.length - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] == target) return mid;
            if (nums[lo] <= nums[mid]) {                             // left half sorted
                if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
                else lo = mid + 1;
            } else {                                                 // right half sorted
                if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
                else hi = mid - 1;
            }
        }
        return -1;
    }
}`,
        time: 'O(log n)', space: 'O(1)',
        pitfalls: M`
          - «nums[lo] <= nums[mid]» needs «<=»: when «lo == mid» (two elements left), the left "half" is a single sorted element.
          - Duplicates (LeetCode 81) break the sorted-half test: with «nums[lo] == nums[mid] == nums[hi]» you can't tell which side is sorted. Shrink «lo++, hi−−» and accept an O(n) worst case.
        `,
        alts: [
          { name: 'Find the pivot, then a normal binary search', time: 'O(log n)', space: 'O(1)', note: 'First find the index of the minimum (next problem), then binary-search the correct sorted segment. Two clean searches, sometimes easier to get right.',
            java: J`class Solution {
    public int search(int[] nums, int target) {
        int n = nums.length, lo = 0, hi = n - 1;
        while (lo < hi) { int mid = (lo + hi) >>> 1; if (nums[mid] > nums[hi]) lo = mid + 1; else hi = mid; }
        int pivot = lo;                                    // index of the minimum
        int l = (target >= nums[pivot] && target <= nums[n - 1]) ? pivot : 0;
        int r = (l == pivot) ? n - 1 : pivot - 1;
        while (l <= r) { int mid = (l + r) >>> 1; if (nums[mid] == target) return mid; if (nums[mid] < target) l = mid + 1; else r = mid - 1; }
        return -1;
    }
}` },
          { name: 'Linear scan', time: 'O(n)', space: 'O(1)', java: J`class Solution {
    public int search(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++) if (nums[i] == target) return i;
        return -1;
    }
}` },
        ],
        talk: 'Around mid, one half is always sorted: the left if nums[lo] ≤ nums[mid], otherwise the right. If the target lies within the sorted half’s range I go there, else to the other half. O(log n).',
      },
      viz: { id: 'rotatedSearch' },
      lc: [lc(33, 'search-in-rotated-sorted-array', 'Search in Rotated Sorted Array', 'same'), lc(81, 'search-in-rotated-sorted-array-ii', 'Search in Rotated Sorted Array II', 'harder'), lc(153, 'find-minimum-in-rotated-sorted-array', 'Find Minimum in Rotated Sorted Array', 'similar')],
      drill: { prompt: 'Find a target in a sorted array that has been rotated at an unknown pivot, in O(log n).', pattern: 'binary-search', why: 'One half around mid is always sorted; check whether the target lies in it.' },
    } },

    { problem: {
      id: 'find-min-rotated', title: 'Minimum of a Rotated Array', diff: 'medium',
      tags: ['binary search', 'rotated'],
      statement: M`
        A sorted array of distinct integers has been rotated an unknown number of times (possibly zero). Return its **minimum** element in **O(log n)**.
      `,
      fn: { name: 'findMin', params: [['int[]', 'nums']], ret: 'int' },
      tests: [
        { args: [[3, 4, 5, 1, 2]], ex: true, expect: 1 },
        { args: [[4, 5, 6, 7, 0, 1, 2]], ex: true, expect: 0 },
        { args: [[11, 13, 15, 17]], ex: true, expect: 11, why: 'Not rotated.' },
        { args: [[1]], expect: 1 },
        { args: [[2, 1]], expect: 1 },
        { args: [[5, 1, 2, 3, 4]], expect: 1 },
        { args: [[2, 3, 4, 5, 1]], expect: 1 },
        { args: [[-5, -3, 0, 2, -9, -7]], expect: -9 },
        { args: [{ $gen: 'rotated', args: [100000, -500000, 9, 4242, 97] }], big: true },
        { args: [{ $gen: 'rotated', args: [100000, 0, 3, 0, 98] }], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁵ (LeetCode: 5000)', 'Values are distinct'],
      hints: [
        'Compare «nums[mid]» with the **last** element «nums[hi]».',
        'If «nums[mid] > nums[hi]», the drop (and the minimum) is to the right of mid. Otherwise mid is in the right sorted run, so the minimum is at mid or to its left.',
        'As a condition: «ok(i) = nums[i] ≤ nums[n − 1]» is false then true, and the first true is the minimum.',
      ],
      solution: {
        pattern: '**Binary search on a hidden monotone condition:** «nums[i] ≤ nums[last]» splits the array into the left run (false) and the right run (true).',
        intuition: 'Every element of the right-hand sorted run is ≤ the last element; every element of the left-hand run is greater. That’s a monotone F…FT…T condition, and its first true is the rotation point, the minimum.',
        java: J`class Solution {
    public int findMin(int[] nums) {
        int lo = 0, hi = nums.length - 1;
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] > nums[hi]) lo = mid + 1;   // minimum is right of mid
            else hi = mid;                           // mid might be the minimum
        }
        return nums[lo];
    }
}`,
        time: 'O(log n)', space: 'O(1)',
        pitfalls: M`
          - Comparing with «nums[lo]» instead of «nums[hi]» fails on unrotated arrays: «[1, 2, 3]» would push you right.
          - «hi = mid − 1» can skip the minimum when mid *is* the minimum.
        `,
        alts: [
          { name: 'Linear minimum', time: 'O(n)', space: 'O(1)', java: J`class Solution {
    public int findMin(int[] nums) {
        int m = nums[0];
        for (int x : nums) m = Math.min(m, x);
        return m;
    }
}` },
        ],
        followups: M`
          - **With duplicates** (LeetCode 154): when «nums[mid] == nums[hi]», you can only drop «hi−−». The worst case is O(n).
          - **How many times was it rotated?** The index of the minimum.
        `,
        talk: 'Compare mid with the last element: if nums[mid] is bigger, the minimum is to the right, so lo = mid + 1; otherwise it’s at mid or left, so hi = mid. That’s first-true binary search on nums[i] ≤ nums[last]. O(log n).',
      },
      lc: [lc(153, 'find-minimum-in-rotated-sorted-array', 'Find Minimum in Rotated Sorted Array', 'same'), lc(154, 'find-minimum-in-rotated-sorted-array-ii', 'Find Minimum in Rotated Sorted Array II', 'harder'), lc(33, 'search-in-rotated-sorted-array', 'Search in Rotated Sorted Array', 'similar')],
      drill: { prompt: 'Minimum element of a rotated sorted array in O(log n).', pattern: 'binary-search', why: 'Compare mid with the last element: the condition nums[i] ≤ nums[last] is F…FT…T.' },
    } },

    { problem: {
      id: 'search-2d-matrix', title: 'Search a Sorted Matrix', diff: 'medium',
      tags: ['binary search', 'index mapping'],
      statement: M`
        «matrix» is «m × n». Each row is sorted ascending, and the first element of each row is greater than the last element of the previous row. Return whether «target» is in the matrix, in **O(log(m·n))**.
      `,
      fn: { name: 'searchMatrix', params: [['int[][]', 'matrix'], ['int', 'target']], ret: 'boolean' },
      tests: [
        { args: [[[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], 3], ex: true, expect: true },
        { args: [[[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], 13], ex: true, expect: false },
        { args: [[[1]], 1], expect: true },
        { args: [[[1]], 2], expect: false },
        { args: [[[1, 3]], 3], expect: true },
        { args: [[[1], [3], [5]], 4], expect: false },
        { args: [[[1, 2, 3], [4, 5, 6]], 6], expect: true },
        { args: [[[-10, -5], [0, 5]], -10], expect: true },
        { args: [[[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], 61], expect: false },
      ],
      constraints: ['1 ≤ m, n ≤ 100', '−10⁴ ≤ matrix[i][j], target ≤ 10⁴'],
      hints: [
        'Read the matrix row by row: what do you get?',
        'One long sorted array of length m·n.',
        'Binary-search indices «[0, m·n)», mapping index «k» to «matrix[k / n][k % n]».',
      ],
      solution: {
        pattern: '**Index mapping:** treat a structure as the sorted array it really is, and binary-search virtual indices.',
        intuition: 'Row-major order is globally sorted by the problem’s guarantee, so the matrix is just a sorted array folded into rows. Division and modulo convert between the flat index and (row, column).',
        java: J`class Solution {
    public boolean searchMatrix(int[][] matrix, int target) {
        int m = matrix.length, n = matrix[0].length;
        int lo = 0, hi = m * n;                     // first flat index with value >= target
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (matrix[mid / n][mid % n] >= target) hi = mid;
            else lo = mid + 1;
        }
        return lo < m * n && matrix[lo / n][lo % n] == target;
    }
}`,
        time: 'O(log(m·n))', space: 'O(1)',
        pitfalls: M`
          - Mapping with «mid / m» (rows) instead of «mid / n» (columns per row) breaks non-square matrices.
          - The other classic, "rows sorted and columns sorted" (LeetCode 240), is a *different* problem: there you start at the top-right corner and walk (O(m + n)).
        `,
        alts: [
          { name: 'Pick the row, then search it', time: 'O(log m + log n)', space: 'O(1)', note: 'Binary-search the row whose first element ≤ target, then binary-search inside that row. The same complexity in two steps.' },
          { name: 'Staircase walk from the top-right', time: 'O(m + n)', space: 'O(1)', note: 'Too big → move left; too small → move down. Works even under the weaker "rows and columns sorted" guarantee.',
            java: J`class Solution {
    public boolean searchMatrix(int[][] matrix, int target) {
        int r = 0, c = matrix[0].length - 1;
        while (r < matrix.length && c >= 0) {
            if (matrix[r][c] == target) return true;
            if (matrix[r][c] > target) c--; else r++;
        }
        return false;
    }
}` },
        ],
        talk: 'Row-major order is fully sorted, so I binary-search flat indices 0..m·n−1 and map index k to matrix[k / n][k % n]. O(log(m·n)).',
      },
      lc: [lc(74, 'search-a-2d-matrix', 'Search a 2D Matrix', 'same'), lc(240, 'search-a-2d-matrix-ii', 'Search a 2D Matrix II', 'variant'), lc(378, 'kth-smallest-element-in-a-sorted-matrix', 'Kth Smallest Element in a Sorted Matrix', 'harder')],
      drill: { prompt: 'A matrix whose rows are sorted and chain end-to-start: find a target in O(log(mn)).', pattern: 'binary-search', why: 'It’s a sorted array folded into rows; binary-search the flat index.' },
    } },

    { problem: {
      id: 'peak-element', title: 'Find a Peak', diff: 'medium',
      tags: ['binary search', 'slope'],
      statement: M`
        A **peak** is an element strictly greater than its neighbours. Imagine «nums[−1] = nums[n] = −∞», so the ends only need to beat their one real neighbour. Adjacent elements are never equal.

        Return the index of **any** peak in **O(log n)** time.
      `,
      fn: { name: 'findPeakElement', params: [['int[]', 'nums']], ret: 'int' },
      validate: ({ args, got }) => {
        const a = args[0], i = got;
        if (!Number.isInteger(i) || i < 0 || i >= a.length) return 'index out of range';
        const left = i === 0 ? -Infinity : a[i - 1], right = i === a.length - 1 ? -Infinity : a[i + 1];
        return a[i] > left && a[i] > right ? true : `nums[${i}] = ${a[i]} is not a peak`;
      },
      tests: [
        { args: [[1, 2, 3, 1]], ex: true, why: 'Index 2 (value 3) is the only peak.' },
        { args: [[1, 2, 1, 3, 5, 6, 4]], ex: true, why: 'Index 1 or index 5 are both correct.' },
        { args: [[1]] },
        { args: [[2, 1]] },
        { args: [[1, 2]] },
        { args: [[5, 4, 3, 2, 1]] },
        { args: [[1, 2, 3, 4, 5]] },
        { args: [[3, 1, 3, 1, 3]] },
        { args: [[-2147483648, 2147483647]] },
        { args: [Array.from({ length: 5000 }, (_, i) => (i < 3000 ? i : 6000 - i))] },
      ],
      constraints: ['1 ≤ nums.length ≤ 5000 (LeetCode: 1000)', 'nums[i] ≠ nums[i + 1]'],
      hints: [
        'Look at «nums[mid]» and «nums[mid + 1]». If the array is going up at mid, is there certainly a peak to the right?',
        'Yes: walking right, the values either come down at some point (a peak) or keep rising to the end (the last element is a peak, since nums[n] = −∞).',
        'Condition «nums[i] > nums[i + 1]» (going down). Binary-search for any index where it’s true; the first true is a peak.',
      ],
      solution: {
        pattern: '**Binary search on the slope:** no sortedness needed, just a guarantee that "going uphill" always ends at a peak.',
        intuition: M`
          If «nums[mid] < nums[mid + 1]», we're on an uphill slope, and a peak must exist to the right (the hill has to end somewhere, and the right boundary is −∞). Otherwise mid is on a downhill, so a peak is at mid or to its left. Each step halves the search range while keeping at least one peak inside it.
        `,
        java: J`class Solution {
    public int findPeakElement(int[] nums) {
        int lo = 0, hi = nums.length - 1;
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] < nums[mid + 1]) lo = mid + 1;   // uphill: a peak lies to the right
            else hi = mid;                                 // downhill: peak at mid or left
        }
        return lo;
    }
}`,
        time: 'O(log n)', space: 'O(1)',
        why: 'Invariant: [lo, hi] always contains a peak, because lo is either 0 or just right of an uphill step, and hi is either n − 1 or at the top of a downhill step. When lo == hi, that single index is a peak.',
        pitfalls: M`
          - Accessing «nums[mid + 1]» is safe because «mid < hi ≤ n − 1» inside the loop.
          - Values can equal «Integer.MIN_VALUE», so don't use it as a sentinel for −∞. Compare neighbours directly, as above.
        `,
        alts: [
          { name: 'Linear scan', time: 'O(n)', space: 'O(1)', note: 'The first i with nums[i] > nums[i + 1] is a peak (or the last index).',
            java: J`class Solution {
    public int findPeakElement(int[] nums) {
        for (int i = 0; i + 1 < nums.length; i++) if (nums[i] > nums[i + 1]) return i;
        return nums.length - 1;
    }
}` },
        ],
        followups: M`
          - **Peak in a 2-D grid** (LeetCode 1901): binary-search columns, take each column’s max, and compare it with the neighbouring columns.
          - **Mountain array** (LeetCode 852, 1095): exactly one peak; the same slope test.
        `,
        talk: 'Compare mid with mid+1. Uphill means a peak exists to the right (the boundary is −∞), so lo = mid + 1; downhill means a peak is at mid or left, so hi = mid. The range always contains a peak. O(log n).',
      },
      lc: [lc(162, 'find-peak-element', 'Find Peak Element', 'same'), lc(852, 'peak-index-in-a-mountain-array', 'Peak Index in a Mountain Array', 'easier'), lc(1901, 'find-a-peak-element-ii', 'Find a Peak Element II', 'harder'), lc(1095, 'find-in-mountain-array', 'Find in Mountain Array', 'harder')],
      drill: { prompt: 'Return the index of any element larger than both neighbours, in O(log n), in an unsorted array.', pattern: 'binary-search', why: 'Binary search on the slope: going uphill guarantees a peak ahead.' },
    } },

    { lesson: 'binary-search-answer', title: 'Binary search on the answer', mins: 10,
      lede: 'When the question is “the minimum X such that it’s possible”, don’t search the array; search the values X could take.',
      body: M`
        ## The shape of these problems
        *"What is the minimum speed / capacity / time / largest-part-size such that [something] is achievable?"*

        Two facts unlock them:
        1. **Checking one candidate is easy.** Given a speed, simulating whether Koko finishes in h hours is a single O(n) pass.
        2. **Feasibility is monotone.** If speed k works, every faster speed works too. So over candidate answers, feasibility looks like F, F, F, T, T, T, and you want the first T.

        That's the binary search template again, but over the **answer range** instead of array indices.

        @viz answerSearch

        ~~~java Template: minimum feasible answer
        long lo = MIN_POSSIBLE, hi = MAX_POSSIBLE;   // make sure hi is feasible
        while (lo < hi) {
            long mid = lo + (hi - lo) / 2;
            if (feasible(mid)) hi = mid;             // mid works: try smaller
            else lo = mid + 1;                       // mid fails: need bigger
        }
        return lo;
        ~~~
        For "**maximum** feasible" (feasibility is T…T F…F), search for the first infeasible value and subtract 1. Or flip the condition: «ok(x) = !feasible(x + 1)».

        ## Designing the check
        | Problem | Answer being searched | Feasibility check (greedy, O(n)) |
        |---|---|---|
        | Koko eating bananas | eating speed k | «Σ ceil(pile / k) ≤ h» |
        | Ship packages in D days | ship capacity | fill each day greedily; count days ≤ D |
        | Split array into m parts, minimize the largest sum | max part sum S | cut greedily whenever the sum would exceed S; parts ≤ m |
        | m bouquets of k adjacent flowers | day d | count runs of bloomed flowers by day d |
        | Aggressive cows / magnetic force (maximize the minimum gap) | minimum gap g | place greedily; count ≥ m (max-feasible version) |

        :::key Bounds and cost
        - **lo:** the smallest answer that could possibly work (1, or max(weights) for capacity).
        - **hi:** an answer that definitely works (max(piles), sum(weights)). Getting hi wrong is the classic bug.
        - **Cost:** O(check × log(hi − lo)). With values up to 10⁹ that's about 30 checks.
        - Use «long» when sums can exceed «int».
        :::

        ## Signals
        - "**Minimum** X such that…" or "**maximum** X such that…", where X is a number you *choose*.
        - A direct formula seems hard, but "is X enough?" is an easy greedy check.
        - Large value ranges (up to 10⁹) combined with n ≤ 10⁵: an O(n log range) solution fits.
        - "Minimize the maximum" or "maximize the minimum" wording.

        @quiz 0
      `,
      quiz: [
        { q: 'Ship packages within D days: what are the correct search bounds for the capacity?',
          options: ['[1, max(weights)]', '[max(weights), sum(weights)]', '[0, D]', '[min(weights), max(weights)]'],
          answer: 1, why: 'The ship must carry the heaviest package in one go, so capacity ≥ max(weights); and a capacity of sum(weights) ships everything in one day, so it’s always feasible.' },
      ],
      practice: ['koko-bananas', 'ship-packages', 'time-map', 'median-two-sorted'],
    },

    { problem: {
      id: 'koko-bananas', title: 'Minimum Eating Speed', diff: 'medium',
      tags: ['binary search on answer'],
      statement: M`
        There are «piles[i]» bananas in pile «i». Koko picks an eating speed «k» (bananas per hour). Each hour she chooses one pile and eats «k» bananas from it; if the pile has fewer than «k», she finishes it and waits out the rest of that hour.

        Return the **minimum integer k** that lets her eat everything within «h» hours.
      `,
      fn: { name: 'minEatingSpeed', params: [['int[]', 'piles'], ['int', 'h']], ret: 'int' },
      tests: [
        { args: [[3, 6, 7, 11], 8], ex: true, expect: 4, why: 'At k = 4: 1 + 2 + 2 + 3 = 8 hours. At k = 3: 1 + 2 + 3 + 4 = 10 > 8.' },
        { args: [[30, 11, 23, 4, 20], 5], ex: true, expect: 30, why: 'One pile per hour: she must finish the largest pile in an hour.' },
        { args: [[30, 11, 23, 4, 20], 6], ex: true, expect: 23 },
        { args: [[1], 1], expect: 1 },
        { args: [[1000000000], 2], expect: 500000000 },
        { args: [[5, 5, 5], 100], expect: 1 },
        { args: [[312884470], 312884469], expect: 2 },
        { args: [[1000000000, 1000000000], 3], expect: 1000000000 },
        { args: [{ $gen: 'ints', args: [10000, 1, 1000000000, 99] }, 1000000], big: true },
      ],
      constraints: ['1 ≤ piles.length ≤ h ≤ 10⁹', '1 ≤ piles[i] ≤ 10⁹', 'piles.length ≤ 10⁴'],
      hints: [
        'Given a speed k, how many hours does she need? Can you compute it quickly?',
        '«Σ ceil(pile / k)». And a faster speed never takes more hours: feasibility is monotone in k.',
        'Binary-search k in «[1, max(piles)]» for the first speed with hours ≤ h. Sum the hours in «long».',
      ],
      solution: {
        pattern: '**Binary search on the answer:** monotone feasibility and an O(n) check give O(n log max).',
        intuition: 'We can’t easily compute k directly, but verifying a candidate is one pass. Since faster is never worse, the feasible speeds form a suffix [k*, ∞), and binary search finds its start.',
        java: J`class Solution {
    public int minEatingSpeed(int[] piles, int h) {
        int lo = 1, hi = 0;
        for (int p : piles) hi = Math.max(hi, p);        // speed = max pile always works
        while (lo < hi) {
            int k = lo + (hi - lo) / 2;
            if (hours(piles, k) <= h) hi = k;
            else lo = k + 1;
        }
        return lo;
    }

    private long hours(int[] piles, int k) {
        long t = 0;
        for (int p : piles) t += (p + k - 1) / k;       // ceil(p / k) without floating point
        return t;
    }
}`,
        time: 'O(n log max)', space: 'O(1)',
        pitfalls: M`
          - «(p + k − 1) / k» can overflow if p is near «Integer.MAX_VALUE». Here p ≤ 10⁹ and k ≤ 10⁹, so the sum is ≤ 2·10⁹ − 1, which just barely fits. Use «(p − 1) / k + 1» to be fully safe.
          - The total hours can reach 10⁴ × 10⁹. Accumulate in «long».
          - Starting «hi» at «h» or «sum(piles)» works but is looser than needed. Starting it at the answer or below is a bug.
        `,
        alts: [
          { name: 'Try every speed upward', time: 'O(n · max)', space: 'O(1)', check: false, note: 'Up to 10⁴ × 10⁹ operations. It shows why binary search is required.' },
        ],
        followups: M`
          - Same shape: **ship packages** (next problem), **smallest divisor given a threshold** (LeetCode 1283), **minimum days for m bouquets** (LeetCode 1482).
        `,
        talk: 'Feasibility is monotone in the speed, and checking a speed is O(n): the sum of ceil(pile/k). So I binary-search k in [1, max pile] for the first speed with hours ≤ h, summing in long. O(n log max).',
      },
      viz: { id: 'answerSearch' },
      lc: [lc(875, 'koko-eating-bananas', 'Koko Eating Bananas', 'same'), lc(1283, 'find-the-smallest-divisor-given-a-threshold', 'Find the Smallest Divisor Given a Threshold', 'similar'), lc(1482, 'minimum-number-of-days-to-make-m-bouquets', 'Minimum Number of Days to Make m Bouquets', 'similar'), lc(2187, 'minimum-time-to-complete-trips', 'Minimum Time to Complete Trips', 'similar')],
      drill: { prompt: 'Minimum constant rate so all piles are consumed within h hours (one pile per hour at most).', pattern: 'bs-answer', why: '“Minimum X such that feasible” with a monotone O(n) check: binary search on the rate.' },
    } },

    { problem: {
      id: 'ship-packages', title: 'Ship Within D Days', diff: 'medium',
      tags: ['binary search on answer', 'greedy check'],
      statement: M`
        Packages must ship **in the given order**; package «i» weighs «weights[i]». Each day you load the ship with consecutive packages, as many as fit under its capacity, and it sails once.

        Return the **minimum capacity** that ships all packages within «days» days.
      `,
      fn: { name: 'shipWithinDays', params: [['int[]', 'weights'], ['int', 'days']], ret: 'int' },
      tests: [
        { args: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5], ex: true, expect: 15, why: '[1..5] [6,7] [8] [9] [10].' },
        { args: [[3, 2, 2, 4, 1, 4], 3], ex: true, expect: 6 },
        { args: [[1, 2, 3, 1, 1], 4], ex: true, expect: 3 },
        { args: [[10], 1], expect: 10 },
        { args: [[1, 1, 1, 1], 1], expect: 4 },
        { args: [[7, 2, 5, 10, 8], 2], expect: 18 },
        { args: [[5, 5, 5, 5], 4], expect: 5 },
        { args: [[1, 500, 1], 3], expect: 500 },
        { args: [{ $gen: 'ints', args: [50000, 1, 500, 101] }, 700], big: true },
      ],
      constraints: ['1 ≤ days ≤ weights.length ≤ 5·10⁴', '1 ≤ weights[i] ≤ 500'],
      hints: [
        'For a given capacity, how do you count the days needed? (Load greedily: keep adding until the next package doesn’t fit.)',
        'A bigger ship never needs more days. Feasibility is monotone in capacity.',
        'Binary-search capacity in «[max(weights), sum(weights)]».',
      ],
      solution: {
        pattern: '**Binary search on the answer with a greedy check:** "minimize the maximum load" problems are this template.',
        intuition: M`
          For a fixed capacity, packing each day as full as possible is optimal: delaying a package can only push more work into later days. So the check is one greedy pass. Larger capacities are never worse, so the smallest feasible capacity can be found by binary search between the two natural bounds.
        `,
        java: J`class Solution {
    public int shipWithinDays(int[] weights, int days) {
        int lo = 0, hi = 0;
        for (int w : weights) { lo = Math.max(lo, w); hi += w; }   // must carry the heaviest; sum always works
        while (lo < hi) {
            int cap = lo + (hi - lo) / 2;
            if (daysNeeded(weights, cap) <= days) hi = cap;
            else lo = cap + 1;
        }
        return lo;
    }

    private int daysNeeded(int[] weights, int cap) {
        int d = 1, load = 0;
        for (int w : weights) {
            if (load + w > cap) { d++; load = 0; }   // start a new day
            load += w;
        }
        return d;
    }
}`,
        time: 'O(n log(sum))', space: 'O(1)',
        why: 'Greedy loading minimizes the number of days for a fixed capacity: an exchange argument shows that moving a package earlier never hurts. Monotonicity then justifies the binary search.',
        pitfalls: M`
          - «lo = 1» instead of «max(weights)»: capacities below the heaviest package are infeasible, and the greedy check would loop wrongly or miscount.
          - Order matters. Don't sort the weights; this isn't bin packing.
        `,
        alts: [
          { name: 'Linear search over capacities', time: 'O(n · sum)', space: 'O(1)', check: false, note: 'Try capacities from max(weights) upward: up to 2.5·10⁷ × 5·10⁴ operations.' },
          { name: 'DP over splits', time: 'O(n² · days)', space: 'O(n · days)', check: false, note: 'dp[i][d] = min over j of max(dp[j][d−1], sum(j..i)). Correct, but far too slow here. It shows why the greedy check is the key insight.' },
        ],
        followups: M`
          - **Split array largest sum** (LeetCode 410): exactly this problem with different wording.
          - **Painter's partition**, **allocate books**: the same template.
        `,
        talk: 'Days needed is monotone in capacity, and for a given capacity greedy loading counts the days in O(n). Binary-search capacity between max(weights) and sum(weights). O(n log sum).',
      },
      lc: [lc(1011, 'capacity-to-ship-packages-within-d-days', 'Capacity To Ship Packages Within D Days', 'same'), lc(410, 'split-array-largest-sum', 'Split Array Largest Sum', 'harder'), lc(1552, 'magnetic-force-between-two-balls', 'Magnetic Force Between Two Balls', 'variant'), lc(2064, 'minimized-maximum-of-products-distributed-to-any-store', 'Minimized Maximum of Products Distributed to Any Store', 'similar')],
      drill: { prompt: 'Split an ordered list into at most D consecutive groups so the largest group sum is as small as possible.', pattern: 'bs-answer', why: 'Minimize the maximum: binary-search the cap with a greedy O(n) feasibility check.' },
    } },

    { problem: {
      id: 'time-map', title: 'Time-Versioned Key-Value Store', diff: 'medium',
      tags: ['design', 'binary search', 'TreeMap'],
      statement: M`
        Design «TimeMap», which stores several values for the same key at different timestamps:

        - «set(key, value, timestamp)» stores «value» for «key» at «timestamp».
        - «get(key, timestamp)» returns the value set for «key» at the **largest timestamp ≤ timestamp**, or «""» if there is none.

        Timestamps passed to «set» are **strictly increasing** across all calls.
      `,
      design: { cls: 'TimeMap', ctor: [], methods: { set: { params: [['String', 'key'], ['String', 'value'], ['int', 'timestamp']], ret: 'void' }, get: { params: [['String', 'key'], ['int', 'timestamp']], ret: 'String' } } },
      tests: [
        { ex: true, ops: ['TimeMap', 'set', 'get', 'get', 'set', 'get', 'get'], args: [[], ['foo', 'bar', 1], ['foo', 1], ['foo', 3], ['foo', 'bar2', 4], ['foo', 4], ['foo', 5]], expect: [null, null, 'bar', 'bar', null, 'bar2', 'bar2'] },
        { ops: ['TimeMap', 'get', 'set', 'get', 'get'], args: [[], ['x', 5], ['x', 'a', 10], ['x', 9], ['y', 10]], expect: [null, '', null, '', ''] },
        { ops: ['TimeMap', 'set', 'set', 'set', 'get', 'get', 'get', 'get'], args: [[], ['k', 'v1', 1], ['j', 'w', 2], ['k', 'v3', 3], ['k', 2], ['k', 3], ['j', 1], ['j', 100]], expect: [null, null, null, null, 'v1', 'v3', '', 'w'] },
        { ops: ['TimeMap', 'set', 'set', 'get', 'get', 'get'], args: [[], ['love', 'high', 10], ['love', 'low', 20], ['love', 5], ['love', 10], ['love', 15]], expect: [null, null, null, '', 'high', 'high'] },
        { ops: ['TimeMap', ...Array.from({ length: 4000 }, (_, i) => (i % 2 === 0 ? 'set' : 'get'))], args: [[], ...Array.from({ length: 4000 }, (_, i) => (i % 2 === 0 ? ['k' + (i % 7), 'v' + i, i + 1] : ['k' + ((i * 3) % 7), ((i * 7919) % 4200)]))], big: true },
      ],
      constraints: ['Keys and values are short lowercase strings', '1 ≤ timestamp ≤ 10⁷, strictly increasing for set', 'At most 2·10⁵ calls'],
      hints: [
        'Group entries by key. For one key, what order do its timestamps arrive in?',
        'Increasing, so each key’s list is already sorted by timestamp. Appending keeps it sorted.',
        '«get» is "the last entry with time ≤ t": binary search (first time > t, minus one). A «TreeMap<Integer,String>.floorEntry» also works.',
      ],
      solution: {
        pattern: '**Append-only sorted lists plus binary search** (or TreeMap floor queries). When inserts arrive in sorted order, an ArrayList stays sorted for free.',
        intuition: 'Per key, we need "the most recent value at or before time t". Because timestamps only increase, each key’s history is a sorted list, and the query is an upper-bound binary search.',
        java: J`class TimeMap {
    private final Map<String, List<Integer>> times = new HashMap<>();
    private final Map<String, List<String>> values = new HashMap<>();

    public void set(String key, String value, int timestamp) {
        times.computeIfAbsent(key, k -> new ArrayList<>()).add(timestamp);   // stays sorted
        values.computeIfAbsent(key, k -> new ArrayList<>()).add(value);
    }

    public String get(String key, int timestamp) {
        List<Integer> ts = times.get(key);
        if (ts == null) return "";
        int lo = 0, hi = ts.size();                  // first index with time > timestamp
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (ts.get(mid) > timestamp) hi = mid;
            else lo = mid + 1;
        }
        return lo == 0 ? "" : values.get(key).get(lo - 1);
    }
}`,
        time: 'set O(1), get O(log n)', space: 'O(total entries)',
        pitfalls: M`
          - Returning «null» instead of «""» for misses.
          - Comparing boxed «Integer»s from the list with «==» (they're unboxed here by «>» and «get», so it's fine; be careful with «equals» elsewhere).
        `,
        alts: [
          { name: 'HashMap of TreeMaps', time: 'O(log n) for both', space: 'O(n)', note: 'Works even when timestamps arrive out of order. «floorEntry» does the search.',
            java: J`class TimeMap {
    private final Map<String, TreeMap<Integer, String>> map = new HashMap<>();
    public void set(String key, String value, int timestamp) { map.computeIfAbsent(key, k -> new TreeMap<>()).put(timestamp, value); }
    public String get(String key, int timestamp) {
        TreeMap<Integer, String> t = map.get(key);
        if (t == null) return "";
        Map.Entry<Integer, String> e = t.floorEntry(timestamp);
        return e == null ? "" : e.getValue();
    }
}` },
        ],
        followups: M`
          - **Out-of-order timestamps:** TreeMap per key (the alternative above).
          - **Snapshot array** (LeetCode 1146): the same per-index history with binary search.
        `,
        talk: 'A map from key to its list of (timestamp, value); since timestamps increase, appending keeps it sorted. get binary-searches for the last timestamp ≤ t. set is O(1), get O(log n). With out-of-order timestamps I’d use a TreeMap per key and floorEntry.',
      },
      lc: [lc(981, 'time-based-key-value-store', 'Time Based Key-Value Store', 'same'), lc(1146, 'snapshot-array', 'Snapshot Array', 'variant'), lc(2034, 'stock-price-fluctuation', 'Stock Price Fluctuation', 'harder')],
      drill: { prompt: 'Store values per key with timestamps; query the latest value at or before a time.', pattern: 'binary-search', why: 'Per-key sorted histories (appends in time order) plus an upper-bound binary search (or TreeMap.floorEntry).' },
    } },

    { problem: {
      id: 'median-two-sorted', title: 'Median of Two Sorted Arrays', diff: 'hard',
      tags: ['binary search', 'partition'],
      statement: M`
        Given two sorted arrays «a» and «b» of sizes m and n, return the **median** of all m + n elements combined. The overall run time must be **O(log(min(m, n)))**.

        (The median of an even count is the average of the two middle values.)
      `,
      fn: { name: 'findMedianSortedArrays', params: [['int[]', 'a'], ['int[]', 'b']], ret: 'double' },
      tests: [
        { args: [[1, 3], [2]], ex: true, expect: 2.0 },
        { args: [[1, 2], [3, 4]], ex: true, expect: 2.5 },
        { args: [[], [1]], expect: 1.0 },
        { args: [[2], []], expect: 2.0 },
        { args: [[1, 1, 1], [1, 1, 1]], expect: 1.0 },
        { args: [[1, 3, 8, 9, 15], [7, 11, 18, 19, 21, 25]], expect: 11.0 },
        { args: [[100000], [100001]], expect: 100000.5 },
        { args: [[-5, 3, 6, 12, 15], [-12, -10, -6, -3, 4, 10]], expect: 3.0 },
        { args: [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]], expect: 5.5 },
        { args: [{ $gen: 'sorted', args: [100000, -1000000, 1000000, 103] }, { $gen: 'sorted', args: [99999, -1000000, 1000000, 104] }], big: true },
      ],
      constraints: ['0 ≤ m, n ≤ 10⁵ (LeetCode: 1000)', '1 ≤ m + n', '−10⁶ ≤ values ≤ 10⁶'],
      hints: [
        'Merging is O(m + n). What if you could decide how many of the smallest half come from «a», without merging?',
        'Choose «i» elements from «a» and «j = half − i» from «b» for the left half. The partition is correct iff «a[i−1] ≤ b[j]» and «b[j−1] ≤ a[i]».',
        'Binary-search «i» in «[0, m]» on the shorter array: if «a[i−1] > b[j]», i is too big; if «b[j−1] > a[i]», i is too small. Treat out-of-range values as ±∞.',
      ],
      solution: {
        pattern: '**Binary search on a partition point:** search the "cut" in one array that makes a valid global split. It’s the hardest standard binary-search problem.',
        intuition: M`
          The median splits the combined elements into a left half and a right half with «max(left) ≤ min(right)». If the left half takes «i» elements from «a», it must take «j = (m + n + 1) / 2 − i» from «b». A cut is valid when «a[i−1] ≤ b[j]» and «b[j−1] ≤ a[i]». When the first fails, too many elements came from «a»; when the second fails, too few. That's a monotone condition on «i», so binary search finds it.
        `,
        java: J`class Solution {
    public double findMedianSortedArrays(int[] a, int[] b) {
        if (a.length > b.length) return findMedianSortedArrays(b, a);   // search the shorter one
        int m = a.length, n = b.length, half = (m + n + 1) / 2;
        int lo = 0, hi = m;
        while (lo <= hi) {
            int i = (lo + hi) >>> 1, j = half - i;          // i from a, j from b in the left half
            int aL = i == 0 ? Integer.MIN_VALUE : a[i - 1], aR = i == m ? Integer.MAX_VALUE : a[i];
            int bL = j == 0 ? Integer.MIN_VALUE : b[j - 1], bR = j == n ? Integer.MAX_VALUE : b[j];
            if (aL > bR) hi = i - 1;                        // took too many from a
            else if (bL > aR) lo = i + 1;                   // took too few from a
            else {
                int leftMax = Math.max(aL, bL);
                if ((m + n) % 2 == 1) return leftMax;
                return (leftMax + (double) Math.min(aR, bR)) / 2.0;
            }
        }
        throw new IllegalArgumentException("inputs not sorted");
    }
}`,
        time: 'O(log(min(m, n)))', space: 'O(1)',
        pitfalls: M`
          - Search the **shorter** array. Otherwise «j» can go negative or past «n».
          - Sentinels: «Integer.MIN_VALUE»/«MAX_VALUE» are safe here because they're only compared, never added. (Values reach ±10⁶ only.)
          - «(leftMax + rightMin) / 2» with ints truncates. Convert to double before dividing.
        `,
        alts: [
          { name: 'Merge until the middle', time: 'O(m + n)', space: 'O(1)', note: 'Walk both arrays with two pointers, like merge sort, stopping at the middle. It’s the first thing to say, and it fails the stated bound.',
            java: J`class Solution {
    public double findMedianSortedArrays(int[] a, int[] b) {
        int total = a.length + b.length, i = 0, j = 0, prev = 0, cur = 0;
        for (int k = 0; k <= total / 2; k++) {
            prev = cur;
            if (i < a.length && (j >= b.length || a[i] <= b[j])) cur = a[i++];
            else cur = b[j++];
        }
        return total % 2 == 1 ? cur : (prev + (double) cur) / 2.0;
    }
}` },
          { name: 'k-th smallest by discarding halves', time: 'O(log(m + n))', space: 'O(log) recursion', note: 'Find the k-th smallest by comparing a[k/2 − 1] with b[k/2 − 1] and discarding k/2 elements from the smaller side. It generalizes to any k.' },
        ],
        talk: 'I binary-search how many elements the left half takes from the shorter array; the rest come from the other. The cut is valid when both left maxima ≤ both right minima. If a’s left max is too big I take fewer from a, else more. Then the median comes from the boundary values. O(log min(m,n)).',
      },
      lc: [lc(4, 'median-of-two-sorted-arrays', 'Median of Two Sorted Arrays', 'same'), lc(295, 'find-median-from-data-stream', 'Find Median from Data Stream', 'similar'), lc(1539, 'kth-missing-positive-number', 'Kth Missing Positive Number', 'easier')],
      drill: { prompt: 'Median of two sorted arrays combined, in O(log(min(m,n))).', pattern: 'binary-search', why: 'Binary-search the partition point in the shorter array so both halves split correctly.' },
    } },
  ],
});
})();

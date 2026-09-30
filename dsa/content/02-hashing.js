(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

DSA.module({
  id: 'hashing', title: 'Arrays, Hashing & Prefix Sums', short: 'Hashing & prefix sums',
  blurb: 'Trade memory for instant lookups: complements, counts, canonical keys, and prefix sums that answer range questions in O(1).',
  intro: M`
    Most "can you do better than O(n²)?" moments in interviews end with a hash map or a prefix sum. Both remove an inner loop: the hash map by remembering what you've already seen, and the prefix sum by precomputing every range total at once. Master these and roughly a quarter of easy/medium problems become one-pass solutions.
  `,
  more: [
    lc(217, 'contains-duplicate', 'Contains Duplicate', 'easier'),
    lc(205, 'isomorphic-strings', 'Isomorphic Strings', 'similar'),
    lc(290, 'word-pattern', 'Word Pattern', 'similar'),
    lc(36, 'valid-sudoku', 'Valid Sudoku', 'similar'),
    lc(1512, 'number-of-good-pairs', 'Number of Good Pairs', 'easier'),
    lc(454, '4sum-ii', '4Sum II', 'similar'),
    lc(974, 'subarray-sums-divisible-by-k', 'Subarray Sums Divisible by K', 'variant'),
    lc(304, 'range-sum-query-2d-immutable', 'Range Sum Query 2D - Immutable', 'harder'),
    lc(1109, 'corporate-flight-bookings', 'Corporate Flight Bookings', 'variant'),
    lc(523, 'continuous-subarray-sum', 'Continuous Subarray Sum', 'variant'),
    lc(442, 'find-all-duplicates-in-an-array', 'Find All Duplicates in an Array', 'similar'),
    lc(1074, 'number-of-submatrices-that-sum-to-target', 'Number of Submatrices That Sum to Target', 'harder'),
  ],
  items: [
    { lesson: 'hashing-patterns', title: 'Hashing patterns', mins: 12,
      lede: 'Four shapes of hash-map solution cover almost every problem in this family. Learn to spot which one you are looking at.',
      body: M`
        ## The core move: replace a search with a lookup
        The brute force for "find two numbers that sum to target" checks every pair: for each element, it searches the rest of the array. The search is the waste. If you remember every element you've passed in a hash map, "is target − x somewhere before me?" becomes one O(1) lookup, and O(n²) becomes O(n) time with O(n) extra space.

        @viz twoSumMap

        ## The four shapes
        | Shape | Question it answers | Structure | Classic problems |
        |---|---|---|---|
        | **Complement / seen** | "Have I seen the thing that completes me?" | «HashMap<value, index>» or «HashSet» | Two Sum, Contains Duplicate |
        | **Frequency count** | "How many of each?" | «HashMap<key, count>» or «int[26]» | Anagram, Top K Frequent, Majority |
        | **Canonical key** | "Which items are equivalent?" | «HashMap<signature, List>» | Group Anagrams, Isomorphic Strings |
        | **Index as key** | Same as above, when keys are small integers | the array itself | First Missing Positive, Find Duplicates |

        ### Complement / seen
        ~~~java Template: one-pass lookup
        Map<Integer, Integer> seen = new HashMap<>();   // value -> index (or a HashSet if you only need yes/no)
        for (int i = 0; i < nums.length; i++) {
            int need = /* what completes nums[i]? */ target - nums[i];
            if (seen.containsKey(need)) { /* found a pair: seen.get(need), i */ }
            seen.put(nums[i], i);                        // insert AFTER checking, so an element can't pair with itself
        }
        ~~~

        ### Frequency counting
        When keys are lowercase letters, an «int[26]» beats a «HashMap»: no hashing, no boxing, and a fixed 26-slot footprint (O(1) space). Increment for one string and decrement for the other, and the strings are anagrams exactly when every counter returns to zero.

        @viz anagramCount

        ### Canonical key
        To group items that are "the same up to X", map each item to a **signature** that is identical for all equivalent items and different otherwise. For anagrams that's the sorted letters («"eat"» → «"aet"») or a count string («"1#0#0#…"»). For isomorphic strings it's the pattern of first occurrences («"paper"» → «[0,1,0,2,3]»).

        @viz groupAnagrams

        ### Index as key
        If values are integers in «1..n» and you can modify the input, the array can serve as its own hash table: mark «nums[v − 1]» (negate it, or swap v into slot v − 1) to record "v seen". That gives O(1) extra space. First Missing Positive is the famous example.

        ## Signals
        - "Return **indices** of elements that…", in an **unsorted** array → complement map.
        - "**Anagram**, **permutation of**, **same characters**" → counts.
        - "**Group** items that are equivalent" → canonical key.
        - "Values in **1..n**, O(1) extra space" → index as key.
        - "Find the **duplicate** / first repeated / contains…" → set.

        :::warn Java pitfalls with maps
        - «int x = map.get(k);» throws «NullPointerException» when «k» is missing, because null can't unbox. Use «getOrDefault» or check «containsKey».
        - Comparing two «Integer» values from a map with «==» breaks above 127 (Integer cache). Use «equals» or unbox.
        - «char[]» and «int[]» don't work as keys (identity equality). Convert to «String» («new String(chars)»), or use «Arrays.toString» / «List.of».
        :::

        ## When sorting beats hashing
        If you may reorder the input and need O(1) extra space, sorting (O(n log n)) plus a scan is often simpler: duplicates end up adjacent, and pairs can use two pointers. Mention both in an interview: "hash map for O(n) time and O(n) space, or sort for O(n log n) time and O(1) extra space."

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'In the one-pass Two Sum, why do we check the map **before** inserting the current element?',
          options: ['It’s faster', 'So an element can’t pair with itself when target = 2·x', 'HashMap requires it', 'To keep the smallest index'],
          answer: 1, why: 'With target 6 and x = 3 at index 0, inserting first would make «seen.get(3)» return index 0 for the same element. Checking first means only *earlier* elements are candidates.' },
        { q: 'You must group strings that are rotations of each other («"abc"», «"bca"», «"cab"»). A good canonical key is…',
          options: ['The sorted characters', 'The lexicographically smallest rotation', 'The string length', 'The first character'],
          answer: 1, why: 'Sorted characters would also group non-rotations like «"acb"». The smallest rotation (or the rotation starting at the minimal index) is identical exactly for strings in the same rotation class.' },
      ],
      practice: ['two-sum', 'contains-nearby-duplicate', 'valid-anagram', 'group-anagrams', 'top-k-frequent', 'longest-consecutive', 'first-missing-positive'],
    },

    { problem: {
      id: 'two-sum', title: 'Two Sum', diff: 'easy',
      tags: ['hash map', 'complement'],
      statement: M`
        Given an array of integers «nums» and an integer «target», return the **indices** of the two distinct elements that add up to «target», smaller index first.

        Exactly one valid pair exists. The array is **not** sorted, and you may not use the same element twice (though two different elements can hold equal values).
      `,
      fn: { name: 'twoSum', params: [['int[]', 'nums'], ['int', 'target']], ret: 'int[]' },
      tests: [
        { args: [[2, 7, 11, 15], 9], ex: true, expect: [0, 1], why: 'nums[0] + nums[1] = 2 + 7 = 9.' },
        { args: [[3, 2, 4], 6], ex: true, expect: [1, 2], why: 'Not [0, 0]: 3 can’t be used twice.' },
        { args: [[3, 3], 6], expect: [0, 1] },
        { args: [[-1, -2, -3, -4, -5], -8], expect: [2, 4] },
        { args: [[0, 4, 3, 0], 0], expect: [0, 3] },
        { args: [[1000000000, -1000000000, 7], 0], expect: [0, 1] },
        { args: [[5, 75, 25], 100], expect: [1, 2] },
        { args: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 19], expect: [8, 9] },
        { args: [{ $gen: 'range', args: [100000, 1, 2] }, 399996], big: true, why: 'The pair is at the very end.' },
        { args: [{ $gen: 'range', args: [100000, -99999, 2] }, -199996], big: true },
      ],
      constraints: ['2 ≤ nums.length ≤ 10⁵', '−10⁹ ≤ nums[i], target ≤ 10⁹', 'Exactly one valid answer exists'],
      hints: [
        'The brute force checks every pair: O(n²). For a fixed «nums[i]», what exact value are you searching for?',
        'You’re searching for «target − nums[i]». What data structure answers "have I seen value v?" in O(1)?',
        'Walk left to right with a «HashMap<value, index>». Check for the complement *before* storing the current element.',
      ],
      solution: {
        pattern: '**Complement lookup.** When the brute force searches for a specific partner value, a hash map of what you’ve already seen turns that search into O(1).',
        intuition: M`
          For each element «x», the only partner that works is «target − x». Instead of scanning for it, remember every value seen so far with its index. When we reach the second element of the pair, the first one is already in the map.
        `,
        java: J`class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();      // value -> index
        for (int i = 0; i < nums.length; i++) {
            Integer j = seen.get(target - nums[i]);
            if (j != null) return new int[]{j, i};         // j < i automatically
            seen.put(nums[i], i);
        }
        throw new IllegalArgumentException("no pair");
    }
}`,
        time: 'O(n)', space: 'O(n)',
        walk: M`
          «nums = [3, 2, 4]», «target = 6»:
          - i = 0: need 3. The map is empty. Store 3 → 0.
          - i = 1: need 4. Not there. Store 2 → 1.
          - i = 2: need 2. Found at index 1. Return «[1, 2]».
        `,
        pitfalls: M`
          - Storing first and then checking lets «[3, …]» with target 6 match index 0 with itself.
          - «target − nums[i]» can't overflow here (the bounds are ±10⁹, well inside ±2.1·10⁹), but a similar problem with larger values would need «long».
          - Returning «[i, j]» in the wrong order: the stored index is always the smaller one.
        `,
        alts: [
          { name: 'Brute force: all pairs', time: 'O(n²)', space: 'O(1)', note: 'Fine to say out loud as your starting point, then optimize. It times out on the large tests.',
            java: J`class Solution {
    public int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++)
            for (int j = i + 1; j < nums.length; j++)
                if (nums[i] + nums[j] == target) return new int[]{i, j};
        return new int[0];
    }
}` },
          { name: 'Sort indices + two pointers', time: 'O(n log n)', space: 'O(n)', note: 'Sort the indices by value, then move pointers inward from both ends. Useful when the follow-up says "the array is sorted" (LeetCode 167), where it needs only O(1) space.',
            java: J`class Solution {
    public int[] twoSum(int[] nums, int target) {
        Integer[] idx = new Integer[nums.length];
        for (int i = 0; i < idx.length; i++) idx[i] = i;
        Arrays.sort(idx, (a, b) -> Integer.compare(nums[a], nums[b]));
        int l = 0, r = idx.length - 1;
        while (l < r) {
            long s = (long) nums[idx[l]] + nums[idx[r]];
            if (s == target) return new int[]{Math.min(idx[l], idx[r]), Math.max(idx[l], idx[r])};
            if (s < target) l++; else r--;
        }
        return new int[0];
    }
}` },
        ],
        followups: M`
          - **Sorted input?** Two pointers with O(1) space (Two Pointers module).
          - **Return all pairs, or count pairs?** Count occurrences in the map and add «count[target − x]» as you go.
          - **Three numbers?** Sort, fix one, two-pointer the rest (3Sum): O(n²).
          - **Streaming data with many queries?** Keep the count map and answer «find(target)» by scanning distinct values.
        `,
        talk: 'Brute force is O(n²) over all pairs. For each x the only useful partner is target − x, so I keep a map from value to index of everything seen. One pass: check for the complement, then insert. O(n) time, O(n) space.',
      },
      viz: { id: 'twoSumMap', input: { nums: [3, 2, 4], target: 6 } },
      lc: [lc(1, 'two-sum', 'Two Sum', 'same'), lc(167, 'two-sum-ii-input-array-is-sorted', 'Two Sum II - Input Array Is Sorted', 'variant'), lc(1679, 'max-number-of-k-sum-pairs', 'Max Number of K-Sum Pairs', 'similar'), lc(15, '3sum', '3Sum', 'harder')],
      drill: { prompt: 'Unsorted array: return indices of the two numbers that add up to a target, in one pass.', pattern: 'hash-lookup', why: '“Indices” + unsorted rules out sorting-based two pointers; a value→index map finds each complement in O(1).' },
    } },

    { problem: {
      id: 'contains-nearby-duplicate', title: 'Repeat Within Distance k', diff: 'easy',
      tags: ['hash map', 'sliding set'],
      statement: M`
        Given an integer array «nums» and an integer «k», return «true» if there are two **different** indices «i» and «j» with «nums[i] == nums[j]» and «|i − j| ≤ k». Otherwise return «false».
      `,
      fn: { name: 'containsNearbyDuplicate', params: [['int[]', 'nums'], ['int', 'k']], ret: 'boolean' },
      tests: [
        { args: [[1, 2, 3, 1], 3], ex: true, expect: true, why: 'The two 1s are 3 apart.' },
        { args: [[1, 2, 3, 1, 2, 3], 2], ex: true, expect: false, why: 'Equal values are always 3 apart, more than k = 2.' },
        { args: [[1, 0, 1, 1], 1], expect: true },
        { args: [[1, 1], 0], expect: false, why: 'Distance 0 would need i = j.' },
        { args: [[99], 5], expect: false },
        { args: [[4, 1, 2, 3, 1, 5, 4], 3], expect: true },
        { args: [[1, 2, 1], 1], expect: false },
        { args: [[5, 6, 7, 5], 100000], expect: true },
        { args: [{ $gen: 'perm', args: [100000, 3] }, 99999], big: true, expect: false },
        { args: [{ $gen: 'ints', args: [100000, 1, 1000000, 5] }, 50], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁵', '−10⁹ ≤ nums[i] ≤ 10⁹', '0 ≤ k ≤ 10⁵'],
      hints: [
        'For each position, which earlier occurrence of the same value matters most?',
        'Only the **most recent** earlier occurrence can be within distance k. If it isn’t, no older one is.',
        'Keep «HashMap<value, lastIndex>». Alternatively, keep a «HashSet» of the last k values: a sliding window.',
      ],
      solution: {
        pattern: '**Seen-map with the last index**, or equivalently a **sliding window set** of the last k elements. "Within distance k" is a window constraint.',
        intuition: M`
          When we reach index «i», the best candidate partner is the closest previous index with the same value, which is the last time we saw «nums[i]». Store that in a map and compare distances. Each step updates the map to the current index.
        `,
        java: J`class Solution {
    public boolean containsNearbyDuplicate(int[] nums, int k) {
        Map<Integer, Integer> last = new HashMap<>();     // value -> most recent index
        for (int i = 0; i < nums.length; i++) {
            Integer j = last.put(nums[i], i);             // put returns the previous index (or null)
            if (j != null && i - j <= k) return true;
        }
        return false;
    }
}`,
        time: 'O(n)', space: 'O(n)',
        pitfalls: M`
          - Keeping the *first* index instead of the most recent misses pairs like «[1, 0, 1, 1]» with k = 1.
          - «Map.put» returns the old value: a handy one-lookup trick, and a surprise if you didn't know.
        `,
        alts: [
          { name: 'Sliding window HashSet of size k', time: 'O(n)', space: 'O(min(n, k))', note: 'Keep exactly the last k values in a set; before adding «nums[i]», drop «nums[i − k − 1]». A duplicate inside the set means distance ≤ k. Uses less memory when k is small.',
            java: J`class Solution {
    public boolean containsNearbyDuplicate(int[] nums, int k) {
        Set<Integer> window = new HashSet<>();
        for (int i = 0; i < nums.length; i++) {
            if (i > k) window.remove(nums[i - k - 1]);
            if (!window.add(nums[i])) return true;
        }
        return false;
    }
}` },
          { name: 'Brute force: check the next k elements', time: 'O(n·k)', space: 'O(1)',
            java: J`class Solution {
    public boolean containsNearbyDuplicate(int[] nums, int k) {
        for (int i = 0; i < nums.length; i++)
            for (int j = i + 1; j <= i + k && j < nums.length; j++)
                if (nums[i] == nums[j]) return true;
        return false;
    }
}` },
        ],
        followups: M`
          - **Values within t of each other, and indices within k** (LeetCode 220): keep a «TreeSet» window and query «ceiling(x − t)», or use buckets of width t + 1.
        `,
        talk: 'Only the most recent previous occurrence can be within k, so I map each value to its last index and check the distance as I go. O(n) time. A sliding HashSet of the last k values also works with O(k) space.',
      },
      lc: [lc(219, 'contains-duplicate-ii', 'Contains Duplicate II', 'same'), lc(217, 'contains-duplicate', 'Contains Duplicate', 'easier'), lc(220, 'contains-duplicate-iii', 'Contains Duplicate III', 'harder')],
      drill: { prompt: 'Is there a pair of equal values whose indices differ by at most k?', pattern: 'hash-lookup', why: 'Remember the last index of each value (or a sliding set of the last k values).' },
    } },

    { problem: {
      id: 'valid-anagram', title: 'Same Letters, Different Order', diff: 'easy',
      tags: ['counting', 'int[26]'],
      statement: M`
        Given two strings «s» and «t» of lowercase English letters, return «true» if «t» is an **anagram** of «s»: it uses exactly the same letters, the same number of times, in any order.
      `,
      fn: { name: 'isAnagram', params: [['String', 's'], ['String', 't']], ret: 'boolean' },
      tests: [
        { args: ['anagram', 'nagaram'], ex: true, expect: true },
        { args: ['rat', 'car'], ex: true, expect: false },
        { args: ['a', 'a'], expect: true },
        { args: ['ab', 'a'], expect: false },
        { args: ['aacc', 'ccac'], expect: false, why: 'Same letter set, different counts.' },
        { args: ['listen', 'silent'], expect: true },
        { args: ['abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba'], expect: true },
        { args: [{ $gen: 'str', args: [100000, 'abcdefghijklmnopqrstuvwxyz', 11] }, { $gen: 'str', args: [100000, 'abcdefghijklmnopqrstuvwxyz', 11] }], big: true, expect: true },
        { args: [{ $gen: 'str', args: [100000, 'ab', 3] }, { $gen: 'str', args: [100000, 'ab', 4] }], big: true },
      ],
      constraints: ['1 ≤ s.length, t.length ≤ 10⁵', 'Lowercase English letters only'],
      hints: [
        'Two strings are anagrams exactly when every letter appears the same number of times in both.',
        'There are only 26 possible letters. What’s the cheapest structure to count them?',
        'One «int[26]»: increment for letters of «s», decrement for «t». They’re anagrams iff all counts end at zero (and the lengths match).',
      ],
      solution: {
        pattern: '**Frequency counting with a fixed-size array.** When the alphabet is small and known, «int[26]» (or «int[128]» for ASCII) is the fastest possible hash map.',
        intuition: M`
          Order doesn't matter, only counts do. Count letters once with +1 for «s» and −1 for «t». If anything is non-zero at the end, some letter differs.
        `,
        java: J`class Solution {
    public boolean isAnagram(String s, String t) {
        if (s.length() != t.length()) return false;
        int[] count = new int[26];
        for (int i = 0; i < s.length(); i++) {
            count[s.charAt(i) - 'a']++;
            count[t.charAt(i) - 'a']--;
        }
        for (int c : count) if (c != 0) return false;
        return true;
    }
}`,
        time: 'O(n)', space: 'O(1)', spaceWhy: '26 counters, no matter the input size',
        pitfalls: M`
          - Skipping the length check: with it, "all zeros" is also enough, and you avoid indexing past the shorter string.
          - «s.charAt(i) − 'a'» assumes lowercase letters. For Unicode use a «HashMap<Integer, Integer>» over code points.
        `,
        alts: [
          { name: 'Sort both and compare', time: 'O(n log n)', space: 'O(n)', note: 'Short and clear. Mention it first, then offer counting as the O(n) improvement.',
            java: J`class Solution {
    public boolean isAnagram(String s, String t) {
        char[] a = s.toCharArray(), b = t.toCharArray();
        Arrays.sort(a); Arrays.sort(b);
        return Arrays.equals(a, b);
    }
}` },
        ],
        followups: M`
          - **Unicode strings:** count with a map over code points; the array trick needs a bounded alphabet.
          - **Find all anagrams of p inside s** (LeetCode 438): the same counts, maintained over a sliding window of length |p| (Sliding Window module).
        `,
        talk: 'Anagrams have equal letter counts. With 26 letters I use one int[26], plus one for s and minus one for t, then check all zeros. O(n) time, O(1) space.',
      },
      viz: { id: 'anagramCount', input: { s: 'anagram', t: 'nagaram' } },
      lc: [lc(242, 'valid-anagram', 'Valid Anagram', 'same'), lc(383, 'ransom-note', 'Ransom Note', 'similar'), lc(438, 'find-all-anagrams-in-a-string', 'Find All Anagrams in a String', 'harder')],
      drill: { prompt: 'Decide whether one lowercase string is a rearrangement of another.', pattern: 'counting', why: 'Only the letter counts matter: an int[26] frequency table.' },
    } },

    { problem: {
      id: 'group-anagrams', title: 'Group the Anagrams', diff: 'medium',
      tags: ['hash map', 'canonical key'],
      statement: M`
        Given an array of lowercase strings «strs», group together the strings that are **anagrams** of each other. Return the groups in **any order**, with the strings inside each group in any order.
      `,
      fn: { name: 'groupAnagrams', params: [['String[]', 'strs']], ret: 'List<List<String>>' },
      compare: 'unordered-deep',
      tests: [
        { args: [['eat', 'tea', 'tan', 'ate', 'nat', 'bat']], ex: true, expect: [['bat'], ['nat', 'tan'], ['ate', 'eat', 'tea']] },
        { args: [['']], ex: true, expect: [['']], why: 'The empty string is its own group.' },
        { args: [['a']], expect: [['a']] },
        { args: [['abc', 'bca', 'cab', 'abcd', 'dcba', 'x']], expect: [['abc', 'bca', 'cab'], ['abcd', 'dcba'], ['x']] },
        { args: [['aab', 'aba', 'abb', 'bab', 'baa']], expect: [['aab', 'aba', 'baa'], ['abb', 'bab']], why: 'Same letters, different counts: «aab» and «abb» are not anagrams.' },
        { args: [['', '', 'b', '']], expect: [['', '', ''], ['b']] },
        { args: [{ $gen: 'words', args: [20000, 1, 6, 'abcde', 21] }], big: true },
      ],
      constraints: ['1 ≤ strs.length ≤ 10⁴ (the large test uses 2·10⁴)', '0 ≤ strs[i].length ≤ 100', 'Lowercase English letters'],
      hints: [
        'Anagrams are equal once you ignore order. Can you compute a value that is identical for all anagrams of a word?',
        'Sort the characters of each word: all anagrams share the same sorted string. Use it as a map key.',
        '«Map<String, List<String>>» with «computeIfAbsent(key, k -> new ArrayList<>()).add(word)», then return the map’s values.',
      ],
      solution: {
        pattern: '**Canonical key grouping.** Map every item to a signature shared exactly by its equivalence class, and bucket items by signature in a hash map.',
        intuition: M`
          Two words are anagrams iff they have the same multiset of letters. The sorted letters, or a 26-count string, are a perfect fingerprint of that multiset: equal fingerprints mean anagrams, and different fingerprints mean not. One pass puts every word into the bucket for its fingerprint.
        `,
        java: J`class Solution {
    public List<List<String>> groupAnagrams(String[] strs) {
        Map<String, List<String>> groups = new HashMap<>();
        for (String s : strs) {
            char[] c = s.toCharArray();
            Arrays.sort(c);
            groups.computeIfAbsent(new String(c), k -> new ArrayList<>()).add(s);
        }
        return new ArrayList<>(groups.values());
    }
}`,
        time: 'O(n · k log k)', space: 'O(n · k)', timeWhy: 'n words of length ≤ k, each sorted',
        pitfalls: M`
          - «c.toString()» on a «char[]» gives something like «[C@1b6d3586», not the letters. Use «new String(c)» or «String.valueOf(c)».
          - «char[]» as a map key uses identity, so every word lands in its own group.
        `,
        alts: [
          { name: 'Count-signature key (no sorting)', time: 'O(n · k)', space: 'O(n · k)', note: 'Build a key from the 26 counts, e.g. «"1#0#2#…"». Linear in the total length, which beats sorting for long words. The separator matters: without it, counts 1,11 and 11,1 collide.',
            java: J`class Solution {
    public List<List<String>> groupAnagrams(String[] strs) {
        Map<String, List<String>> groups = new HashMap<>();
        for (String s : strs) {
            int[] cnt = new int[26];
            for (int i = 0; i < s.length(); i++) cnt[s.charAt(i) - 'a']++;
            StringBuilder key = new StringBuilder();
            for (int c : cnt) key.append(c).append('#');
            groups.computeIfAbsent(key.toString(), k -> new ArrayList<>()).add(s);
        }
        return new ArrayList<>(groups.values());
    }
}` },
        ],
        followups: M`
          - **Group shifted strings** («abc», «bcd», «xyz»): key = the differences between consecutive letters, mod 26 (LeetCode 249).
          - **Very long strings:** prefer the count key. Sorting costs k log k per word.
        `,
        talk: 'Anagrams share a fingerprint: the sorted letters or the 26-count vector. I bucket words in a HashMap by that key with computeIfAbsent and return the buckets. O(n·k log k), or O(n·k) with count keys.',
      },
      viz: { id: 'groupAnagrams' },
      lc: [lc(49, 'group-anagrams', 'Group Anagrams', 'same'), lc(249, 'group-shifted-strings', 'Group Shifted Strings', 'variant', { premium: true }), lc(205, 'isomorphic-strings', 'Isomorphic Strings', 'similar')],
      drill: { prompt: 'Partition a list of words so words made of the same letters end up together.', pattern: 'hash-lookup', why: 'Canonical key grouping: HashMap<sortedLetters, List<word>>.' },
    } },

    { problem: {
      id: 'top-k-frequent', title: 'Top K Frequent Elements', diff: 'medium',
      tags: ['counting', 'bucket sort', 'heap'],
      statement: M`
        Given an integer array «nums» and an integer «k», return the «k» most frequent elements, in **any order**.

        The answer is guaranteed to be unique: the k-th and (k+1)-th most frequent elements never tie. Aim for better than O(n log n).
      `,
      fn: { name: 'topKFrequent', params: [['int[]', 'nums'], ['int', 'k']], ret: 'int[]' },
      compare: 'unordered',
      tests: [
        { args: [[1, 1, 1, 2, 2, 3], 2], ex: true, expect: [1, 2] },
        { args: [[1], 1], ex: true, expect: [1] },
        { args: [[4, 4, 4, 4, -1, -1, -1, 2, 2, 5], 3], expect: [4, -1, 2] },
        { args: [[7, 7, 8, 8, 8, 9], 1], expect: [8] },
        { args: [[3, 0, 1, 0], 1], expect: [0] },
        { args: [[1, 2, 3, 4, 5, 5, 6, 6, 6], 2], expect: [6, 5] },
        { args: [[5, 3, 5, 3, 5], 2], expect: [5, 3] },
        { args: [{ $gen: 'pyramid', args: [440, 9] }, 10], big: true },
        { args: [{ $gen: 'pyramid', args: [440, 10] }, 440], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁵', '−10⁴ ≤ nums[i] ≤ 10⁴', 'k is between 1 and the number of distinct values', 'The answer is unique'],
      hints: [
        'First count every value. The question becomes: which k keys have the largest counts?',
        'Sorting the distinct keys by count is O(m log m). A min-heap of size k gives O(m log k). Can you avoid comparisons entirely?',
        'A count is always between 1 and n. Make «buckets[count]» hold the values with that count, then walk the buckets from n down until you’ve collected k values: O(n).',
      ],
      solution: {
        pattern: '**Count, then select.** Count with a hash map, then choose the top k by **bucket sort** (counts are bounded by n) or a **size-k min-heap** (the general top-K template).',
        intuition: M`
          Frequencies are small integers in «1..n», and that's the key observation. Instead of sorting by frequency, index by it: «bucket[f]» lists every value that appears exactly f times. Reading buckets from the highest f down yields values in decreasing frequency, with no comparisons at all.
        `,
        java: J`class Solution {
    public int[] topKFrequent(int[] nums, int k) {
        Map<Integer, Integer> count = new HashMap<>();
        for (int x : nums) count.merge(x, 1, Integer::sum);

        List<Integer>[] bucket = new List[nums.length + 1];   // bucket[f] = values seen f times
        for (Map.Entry<Integer, Integer> e : count.entrySet()) {
            int f = e.getValue();
            if (bucket[f] == null) bucket[f] = new ArrayList<>();
            bucket[f].add(e.getKey());
        }

        int[] res = new int[k];
        int i = 0;
        for (int f = nums.length; f >= 1 && i < k; f--)
            if (bucket[f] != null)
                for (int v : bucket[f]) if (i < k) res[i++] = v;
        return res;
    }
}`,
        time: 'O(n)', space: 'O(n)',
        pitfalls: M`
          - «new List[n + 1]» gives an unchecked warning: generic array creation isn't allowed with type parameters, so the raw array is the standard workaround.
          - A min-heap of size k must be ordered by **count**, not by value.
        `,
        alts: [
          { name: 'Min-heap of size k', time: 'O(n log k)', space: 'O(n)', note: 'The general top-K template: push each (value, count) and pop whenever the size exceeds k. The heap keeps the k largest counts. Works for streams and for any score, not just bounded counts.',
            java: J`class Solution {
    public int[] topKFrequent(int[] nums, int k) {
        Map<Integer, Integer> count = new HashMap<>();
        for (int x : nums) count.merge(x, 1, Integer::sum);
        PriorityQueue<Integer> heap = new PriorityQueue<>((a, b) -> Integer.compare(count.get(a), count.get(b)));
        for (int v : count.keySet()) {
            heap.offer(v);
            if (heap.size() > k) heap.poll();       // drop the least frequent
        }
        int[] res = new int[k];
        for (int i = 0; i < k; i++) res[i] = heap.poll();
        return res;
    }
}` },
          { name: 'Sort distinct values by count', time: 'O(n + m log m)', space: 'O(n)', note: 'Perfectly acceptable to start with, where m is the number of distinct values.',
            java: J`class Solution {
    public int[] topKFrequent(int[] nums, int k) {
        Map<Integer, Integer> count = new HashMap<>();
        for (int x : nums) count.merge(x, 1, Integer::sum);
        List<Integer> keys = new ArrayList<>(count.keySet());
        keys.sort((a, b) -> Integer.compare(count.get(b), count.get(a)));
        int[] res = new int[k];
        for (int i = 0; i < k; i++) res[i] = keys.get(i);
        return res;
    }
}` },
        ],
        followups: M`
          - **Streaming input:** keep counts plus a size-k heap, or use a count-min sketch when memory is tight.
          - **Top k frequent words, ties broken alphabetically** (LeetCode 692): the heap comparator needs the tie-breaker (Heaps module).
          - **Quickselect** on the distinct keys gives O(n) average time, with an O(n²) worst case.
        `,
        talk: 'Count with a HashMap. Since counts are between 1 and n, I bucket values by count and read the buckets from high to low until I have k: O(n). The general alternative is a size-k min-heap, O(n log k).',
      },
      lc: [lc(347, 'top-k-frequent-elements', 'Top K Frequent Elements', 'same'), lc(692, 'top-k-frequent-words', 'Top K Frequent Words', 'variant'), lc(451, 'sort-characters-by-frequency', 'Sort Characters By Frequency', 'similar'), lc(973, 'k-closest-points-to-origin', 'K Closest Points to Origin', 'similar')],
      drill: { prompt: 'Return the k values that occur most often in an array, faster than sorting.', pattern: 'heap-topk', why: 'Count, then select the top k by count: a size-k heap, or bucket sort because counts are bounded by n.' },
    } },

    { problem: {
      id: 'longest-consecutive', title: 'Longest Consecutive Run', diff: 'medium',
      tags: ['hash set', 'sequence starts'],
      statement: M`
        Given an **unsorted** array of integers «nums», return the length of the longest sequence of consecutive integers («x, x+1, x+2, …») whose values all appear in «nums». The values can appear anywhere in the array.

        Your algorithm must run in **O(n)** time, so sorting is out.
      `,
      fn: { name: 'longestConsecutive', params: [['int[]', 'nums']], ret: 'int' },
      tests: [
        { args: [[100, 4, 200, 1, 3, 2]], ex: true, expect: 4, why: '1, 2, 3, 4.' },
        { args: [[0, 3, 7, 2, 5, 8, 4, 6, 0, 1]], ex: true, expect: 9, why: '0 through 8; the duplicate 0 doesn’t matter.' },
        { args: [[]], expect: 0 },
        { args: [[5]], expect: 1 },
        { args: [[1, 2, 0, 1]], expect: 3 },
        { args: [[9, 1, -3, 2, 4, 8, 3, -1, 6, -2, -4, 7]], expect: 4 },
        { args: [[-2147483648, 2147483647, -2147483647]], expect: 2 },
        { args: [[10, 30, 20]], expect: 1 },
        { args: [{ $gen: 'perm', args: [100000, 4] }], big: true, expect: 100000 },
        { args: [{ $gen: 'ints', args: [100000, -1000000000, 1000000000, 8] }], big: true },
        { args: [{ $gen: 'range', args: [100000, 0, 2] }], big: true, expect: 1 },
      ],
      constraints: ['0 ≤ nums.length ≤ 10⁵', '−10⁹ ≤ nums[i] ≤ 10⁹'],
      hints: [
        'Put everything in a «HashSet» so you can ask "is x present?" in O(1).',
        'If you start counting upward from every number, runs get re-counted many times (O(n²) on «[1..n]»). Which numbers should you start from?',
        'Only start counting at x when x − 1 is **not** in the set, meaning x begins a run. Each number is then visited O(1) times.',
      ],
      solution: {
        pattern: '**Hash set plus "only start at sequence starts".** Picking one canonical starting point per run is a common trick for avoiding repeated work.',
        intuition: M`
          A run is fully determined by its smallest element. Given a set of all the values, only walk upward from numbers whose predecessor is missing. Every run is then walked exactly once from its start, and each element is touched a constant number of times overall.
        `,
        java: J`class Solution {
    public int longestConsecutive(int[] nums) {
        Set<Integer> set = new HashSet<>();
        for (int x : nums) set.add(x);
        int best = 0;
        for (int x : set) {
            if (x > Integer.MIN_VALUE && set.contains(x - 1)) continue;   // not the start of a run
            int len = 1;
            while (x + len > x && set.contains(x + len)) len++;           // x + len > x: stop at int overflow
            best = Math.max(best, len);
        }
        return best;
    }
}`,
        time: 'O(n)', space: 'O(n)',
        timeWhy: 'each value is skipped once or walked through once, when its run is counted from the start',
        pitfalls: M`
          - Iterating over «nums» instead of the set: with many duplicates of a run's start, you'd re-walk the same run once per duplicate. That's O(n²) in the worst case.
          - **Overflow at the edges of «int».** «Integer.MAX_VALUE + 1» wraps to «Integer.MIN_VALUE». Without guards, «[MIN, MAX, MIN+1]» counts MAX → MIN → MIN+1 as one run of 3, and «MIN − 1» wraps to «MAX» and wrongly marks «MIN» as "not a start". The guards «x > MIN_VALUE» and «x + len > x» fix both cases. Interviewers rarely test this, but mentioning it shows care.
        `,
        alts: [
          { name: 'Sort and scan', time: 'O(n log n)', space: 'O(1)–O(n)', note: 'Sort, then count runs while skipping duplicates. Simple and often accepted, but the problem explicitly asks for O(n).',
            java: J`class Solution {
    public int longestConsecutive(int[] nums) {
        if (nums.length == 0) return 0;
        int[] a = nums.clone();
        Arrays.sort(a);
        int best = 1, cur = 1;
        for (int i = 1; i < a.length; i++) {
            if (a[i] == a[i - 1]) continue;
            cur = (a[i] == a[i - 1] + 1) ? cur + 1 : 1;
            best = Math.max(best, cur);
        }
        return best;
    }
}` },
          { name: 'Union-Find over neighbours', time: '≈O(n)', space: 'O(n)', note: 'Union x with x + 1 when both exist, then take the largest component size. Overkill here, but a good bridge to the Union-Find module.' },
        ],
        followups: M`
          - **Return the run itself:** remember the best start along with its length.
          - **Streaming inserts with queries:** Union-Find, or a TreeMap of disjoint intervals (LeetCode 352).
        `,
        talk: 'Put everything in a HashSet. A number starts a run iff x−1 is absent, so only from those do I walk upward counting. Every number is touched O(1) times, so it’s O(n) overall.',
      },
      viz: { id: 'longestConsecutive' },
      lc: [lc(128, 'longest-consecutive-sequence', 'Longest Consecutive Sequence', 'same'), lc(352, 'data-stream-as-disjoint-intervals', 'Data Stream as Disjoint Intervals', 'harder'), lc(298, 'binary-tree-longest-consecutive-sequence', 'Binary Tree Longest Consecutive Sequence', 'variant', { premium: true })],
      drill: { prompt: 'Unsorted array, O(n): length of the longest run of consecutive integer values present.', pattern: 'hash-lookup', why: 'A HashSet for O(1) membership, only counting upward from numbers whose predecessor is missing.' },
    } },

    { problem: {
      id: 'first-missing-positive', title: 'Smallest Missing Positive', diff: 'hard',
      tags: ['index as key', 'cyclic sort', 'in place'],
      statement: M`
        Given an unsorted integer array «nums», return the **smallest positive integer** that does not appear in it.

        You must use **O(n) time** and **O(1) extra space**. Modifying «nums» is allowed.
      `,
      fn: { name: 'firstMissingPositive', params: [['int[]', 'nums']], ret: 'int' },
      tests: [
        { args: [[1, 2, 0]], ex: true, expect: 3 },
        { args: [[3, 4, -1, 1]], ex: true, expect: 2 },
        { args: [[7, 8, 9, 11, 12]], ex: true, expect: 1 },
        { args: [[1]], expect: 2 },
        { args: [[2]], expect: 1 },
        { args: [[1, 1]], expect: 2 },
        { args: [[2, 2, 2, 1]], expect: 3 },
        { args: [[-5, -1, 0]], expect: 1 },
        { args: [[5, 4, 3, 2, 1]], expect: 6 },
        { args: [[2147483647, 1, 2]], expect: 3 },
        { args: [{ $gen: 'perm', args: [100000, 12] }], big: true, expect: 100001 },
        { args: [{ $gen: 'ints', args: [100000, -5, 60000, 13] }], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁵', '−2³¹ ≤ nums[i] ≤ 2³¹ − 1'],
      hints: [
        'With n numbers, the answer is always in «1..n+1». Values outside «1..n» can never matter.',
        'You’d normally mark "seen" in a boolean array of size n + 1. Can the input array itself hold those marks?',
        'Place each value v in «1..n» at index «v − 1» by swapping (cyclic sort). Then the first index «i» with «nums[i] != i + 1» gives the answer «i + 1».',
      ],
      solution: {
        pattern: '**The array as its own hash table** (index as key / cyclic sort). When values live in «1..n», slot «v − 1» can record "v is present", which buys O(1) extra space.',
        intuition: M`
          The answer is at most n + 1, because n numbers can fill «1..n» at best. So we only care which of «1..n» are present. Put every such value in "its" slot: value v goes to index «v − 1». Each swap places at least one value permanently, so there are at most n swaps. Afterwards, scan for the first slot that doesn't hold its own value.
        `,
        java: J`class Solution {
    public int firstMissingPositive(int[] nums) {
        int n = nums.length;
        for (int i = 0; i < n; i++) {
            // keep swapping nums[i] into its home until it's out of range or its home is already correct
            while (nums[i] > 0 && nums[i] <= n && nums[nums[i] - 1] != nums[i]) {
                int home = nums[i] - 1;
                int tmp = nums[home]; nums[home] = nums[i]; nums[i] = tmp;
            }
        }
        for (int i = 0; i < n; i++)
            if (nums[i] != i + 1) return i + 1;
        return n + 1;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        timeWhy: 'every swap puts one value in its final home, so there are at most n swaps in total despite the nested loop',
        why: M`
          After the first loop, every value v in «1..n» that exists in the array sits at index v − 1: whenever we left v elsewhere, its home already held v. So «nums[i] == i + 1» exactly when «i + 1» is present, and the first mismatch is the smallest missing positive.
        `,
        pitfalls: M`
          - Checking «nums[nums[i] − 1] != nums[i]», and not «nums[i] != i + 1», prevents an infinite loop on duplicates like «[1, 1]».
          - The swap must read «nums[i] − 1» *before* overwriting «nums[i]». Save it in «home».
          - Values like «Integer.MAX_VALUE» must be range-checked before being used as an index.
        `,
        alts: [
          { name: 'Boolean array (O(n) space)', time: 'O(n)', space: 'O(n)', note: 'Mark present values in «seen[1..n]» and scan. Give this first, then explain how to fold the marks into the input to reach O(1) space.',
            java: J`class Solution {
    public int firstMissingPositive(int[] nums) {
        int n = nums.length;
        boolean[] seen = new boolean[n + 2];
        for (int x : nums) if (x > 0 && x <= n) seen[x] = true;
        for (int v = 1; v <= n + 1; v++) if (!seen[v]) return v;
        return n + 1;
    }
}` },
          { name: 'Sign marking', time: 'O(n)', space: 'O(1)', note: 'Replace non-positive and out-of-range values with n + 1, then for each |v| ≤ n make «nums[|v| − 1]» negative. The first positive index i gives i + 1. The same idea as cyclic sort, recorded in signs instead.',
            java: J`class Solution {
    public int firstMissingPositive(int[] nums) {
        int n = nums.length;
        for (int i = 0; i < n; i++) if (nums[i] <= 0 || nums[i] > n) nums[i] = n + 1;
        for (int i = 0; i < n; i++) { int v = Math.abs(nums[i]); if (v <= n && nums[v - 1] > 0) nums[v - 1] = -nums[v - 1]; }
        for (int i = 0; i < n; i++) if (nums[i] > 0) return i + 1;
        return n + 1;
    }
}` },
        ],
        followups: M`
          - **Find all duplicates / all missing numbers in «1..n»** (LeetCode 442, 448): the same sign-marking trick.
          - **Find the duplicate number without modifying the array** (LeetCode 287): Floyd's cycle detection on «i → nums[i]» (Linked List module).
        `,
        talk: 'The answer is in 1..n+1, so only values 1..n matter. I cyclic-sort them in place, putting v at index v−1 by swapping, then return the first index whose value isn’t i+1. Each swap fixes one value, so O(n) time and O(1) space.',
      },
      lc: [lc(41, 'first-missing-positive', 'First Missing Positive', 'same'), lc(448, 'find-all-numbers-disappeared-in-an-array', 'Find All Numbers Disappeared in an Array', 'easier'), lc(442, 'find-all-duplicates-in-an-array', 'Find All Duplicates in an Array', 'similar'), lc(268, 'missing-number', 'Missing Number', 'easier')],
      drill: { prompt: 'Smallest positive integer missing from an unsorted array, O(n) time and O(1) extra space.', pattern: 'hash-lookup', why: 'Values that matter lie in 1..n, so the array itself serves as the hash table (cyclic sort / index as key).' },
    } },

    { lesson: 'prefix-sums', title: 'Prefix sums and difference arrays', mins: 12,
      lede: 'Precompute running totals once and every range sum becomes a subtraction. Add a hash map and you can count subarrays with any target sum, negatives included.',
      body: M`
        ## Running totals
        Define «prefix[i]» = the sum of the first i elements, with «prefix[0] = 0» and length n + 1:
        ~~~java
        long[] prefix = new long[n + 1];
        for (int i = 0; i < n; i++) prefix[i + 1] = prefix[i] + nums[i];
        // sum of nums[l..r] (inclusive) = prefix[r + 1] - prefix[l]     O(1) per query
        ~~~
        The extra leading zero removes every special case for ranges that start at index 0. Building is O(n); after that, any range sum costs one subtraction.

        ## Prefix sum + hash map: subarrays with sum k
        A subarray «nums[i+1..j]» sums to k exactly when «prefix[j] − prefix[i] = k», that is, when an **earlier prefix equals «prefix[j] − k»**. So scan once, keep a map of how many times each prefix value has occurred, and at each step add the count of «prefix − k». This is the complement trick from Two Sum, applied to prefix sums.

        @viz prefixSumMap

        | Variant | Map stores | Initial entry |
        |---|---|---|
        | **Count** subarrays with sum k | prefix → number of occurrences | «{0: 1}» |
        | **Longest** subarray with sum k | prefix → **first** index seen | «{0: −1}» |
        | Sum **divisible by k** | «floorMod(prefix, k)» → count | «{0: 1}» |
        | Equal numbers of 0s and 1s | treat 0 as −1, then "longest with sum 0" | «{0: −1}» |

        :::key Why not a sliding window?
        A sliding window only works when extending the window moves the sum in one direction, meaning **all values are non-negative**. With negative numbers, a window can't know when to shrink. Prefix sums with a hash map don't care about signs, which makes them the default for "subarray sum equals k".
        :::

        ## Prefix products and "everything except me"
        The same idea works for any associative operation. «left[i]» = product of everything before i, «right[i]» = product of everything after, and «left[i] · right[i]» is the product of all but «nums[i]», with no division.

        @viz productExcept

        ## Difference arrays: range updates in O(1)
        The reverse direction: to add «v» to every element of «[l, r]» many times, record «diff[l] += v» and «diff[r + 1] −= v». After all updates, one prefix-sum pass over «diff» rebuilds the actual values. Q updates over a range of size R cost O(Q + R) instead of O(Q · R).

        @viz diffArray

        ## 2-D prefix sums (for reference)
        «P[r+1][c+1] = grid[r][c] + P[r][c+1] + P[r+1][c] − P[r][c]», and the sum of a rectangle is «P[r2+1][c2+1] − P[r1][c2+1] − P[r2+1][c1] + P[r1][c1]» (inclusion–exclusion).

        ## Signals
        - "Sum of a subarray / range" asked **many times** → prefix array.
        - "**Number of subarrays** with sum = k", with **negatives allowed** → prefix + count map.
        - "**Longest subarray** with sum k / balanced 0s and 1s" → prefix + first-index map.
        - "Add v to every element between l and r", repeatedly → difference array.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'To find the **longest** subarray with sum k, the map should store, for each prefix value…',
          options: ['the latest index', 'the first index it appeared at', 'how many times it appeared', 'the subarray length'],
          answer: 1, why: 'The length is j − i, so for a fixed j you want the smallest i, which is the earliest occurrence. Never overwrite an existing entry.' },
        { q: '«nums = [2, −1, 3]». Which approach correctly counts subarrays with sum 2?',
          options: ['Sliding window that shrinks while the sum > k', 'Prefix sums with a count map', 'Sort, then two pointers', 'Binary search on the prefix array'],
          answer: 1, why: 'The −1 breaks the sliding window’s monotonicity, and sorting destroys contiguity. Prefix sums with a count map handle any signs. (The answer is 2: [2] and [−1, 3].)' },
      ],
      practice: ['range-sum-query', 'product-except-self', 'subarray-sum-k', 'contiguous-array', 'car-pooling'],
    },

    { problem: {
      id: 'range-sum-query', title: 'Range Sum Queries', diff: 'easy',
      tags: ['prefix sum', 'design'],
      statement: M`
        Implement «NumArray», which answers many sum queries on a fixed array:

        - «NumArray(nums)» takes the integer array.
        - «sumRange(left, right)» returns «nums[left] + … + nums[right]» (inclusive).

        There can be up to 10⁴ queries on an array of 10⁴ elements, so each query should be O(1).
      `,
      design: { cls: 'NumArray', ctor: [['int[]', 'nums']], methods: { sumRange: { params: [['int', 'left'], ['int', 'right']], ret: 'int' } } },
      tests: [
        { ex: true, ops: ['NumArray', 'sumRange', 'sumRange', 'sumRange'], args: [[[-2, 0, 3, -5, 2, -1]], [0, 2], [2, 5], [0, 5]], expect: [null, 1, -1, -3] },
        { ops: ['NumArray', 'sumRange'], args: [[[7]], [0, 0]], expect: [null, 7] },
        { ops: ['NumArray', 'sumRange', 'sumRange', 'sumRange'], args: [[[1, 2, 3, 4]], [1, 1], [3, 3], [0, 3]], expect: [null, 2, 4, 10] },
        { ops: ['NumArray', 'sumRange', 'sumRange'], args: [[[-100000, 100000, -100000]], [0, 2], [1, 2]], expect: [null, -100000, 0] },
        { ops: ['NumArray', ...Array(5000).fill('sumRange')], args: [[Array.from({ length: 10000 }, (_, i) => ((i * 7919) % 20001) - 10000)], ...Array.from({ length: 5000 }, (_, i) => { const a = (i * 131) % 10000, b = (i * 977) % 10000; return [Math.min(a, b), Math.max(a, b)]; })], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁴', '−10⁵ ≤ nums[i] ≤ 10⁵', 'At most 10⁴ calls to sumRange'],
      hints: [
        'Summing on every query costs O(n) per call. What could you precompute once?',
        'Store running totals: «prefix[i]» = sum of the first i elements.',
        '«sumRange(l, r) = prefix[r + 1] − prefix[l]».',
      ],
      solution: {
        pattern: '**Prefix sums:** O(n) preprocessing turns every range sum into one subtraction.',
        intuition: 'The sum of «nums[l..r]» is (sum of the first r + 1 elements) − (sum of the first l elements). Precompute all the "first i elements" sums once.',
        java: J`class NumArray {
    private final int[] prefix;          // prefix[i] = nums[0] + ... + nums[i-1]

    public NumArray(int[] nums) {
        prefix = new int[nums.length + 1];
        for (int i = 0; i < nums.length; i++) prefix[i + 1] = prefix[i] + nums[i];
    }

    public int sumRange(int left, int right) {
        return prefix[right + 1] - prefix[left];
    }
}`,
        time: 'O(n) build, O(1) per query', space: 'O(n)',
        pitfalls: M`
          - Off-by-one: with the n + 1 layout it's «prefix[right + 1] − prefix[left]». Draw a 3-element example if unsure.
          - Overflow: 10⁴ × 10⁵ = 10⁹ fits in «int». Larger inputs need a «long[]» prefix.
        `,
        alts: [
          { name: 'Sum on every query', time: 'O(n) per query', space: 'O(1)', note: 'O(n · q) total, up to 10⁸ operations here. Correct, but the point of the problem is to precompute.',
            java: J`class NumArray {
    private final int[] a;
    public NumArray(int[] nums) { a = nums.clone(); }
    public int sumRange(int left, int right) { int s = 0; for (int i = left; i <= right; i++) s += a[i]; return s; }
}` },
        ],
        followups: M`
          - **Updates between queries** (LeetCode 307): a prefix array would need O(n) per update. Use a **Fenwick tree** (binary indexed tree) or a segment tree: O(log n) for both operations.
          - **2-D queries** (LeetCode 304): a 2-D prefix sum with inclusion–exclusion.
        `,
        talk: 'Precompute prefix sums with a leading zero; each query is prefix[r+1] − prefix[l]. O(n) build, O(1) per query. With updates I’d switch to a Fenwick tree.',
      },
      lc: [lc(303, 'range-sum-query-immutable', 'Range Sum Query - Immutable', 'same'), lc(304, 'range-sum-query-2d-immutable', 'Range Sum Query 2D - Immutable', 'harder'), lc(307, 'range-sum-query-mutable', 'Range Sum Query - Mutable', 'harder'), lc(724, 'find-pivot-index', 'Find Pivot Index', 'similar')],
      drill: { prompt: 'Answer many “sum of elements between i and j” queries on a fixed array, each in O(1).', pattern: 'prefix-sum', why: 'Precompute running totals; each query is one subtraction.' },
    } },

    { problem: {
      id: 'product-except-self', title: 'Product of Everything Else', diff: 'medium',
      tags: ['prefix product', 'no division'],
      statement: M`
        Given an integer array «nums», return an array «answer» where «answer[i]» is the product of every element of «nums» **except** «nums[i]».

        Don't use division, and run in O(n) time. (Every product fits in a 32-bit int.) Follow-up: use only O(1) extra space beyond the output array.
      `,
      fn: { name: 'productExceptSelf', params: [['int[]', 'nums']], ret: 'int[]' },
      tests: [
        { args: [[1, 2, 3, 4]], ex: true, expect: [24, 12, 8, 6] },
        { args: [[-1, 1, 0, -3, 3]], ex: true, expect: [0, 0, 9, 0, 0], why: 'Only the position of the 0 gets a non-zero product.' },
        { args: [[2, 3]], expect: [3, 2] },
        { args: [[0, 0, 5]], expect: [0, 0, 0] },
        { args: [[5, 0, 2]], expect: [0, 10, 0] },
        { args: [[1, 1, 1, 1, 1]], expect: [1, 1, 1, 1, 1] },
        { args: [[-2, -3, 4]], expect: [-12, -8, 6] },
        { args: [{ $gen: 'ints', args: [100000, -1, 1, 17] }], big: true },
      ],
      constraints: ['2 ≤ nums.length ≤ 10⁵', '−30 ≤ nums[i] ≤ 30', 'Every prefix and suffix product fits in an int'],
      hints: [
        'The product of everything except i = (product of everything to the left of i) × (product of everything to the right of i).',
        'Compute all the left products in one pass and all the right products in another.',
        'For O(1) extra space: store the left products directly in «answer», then sweep from the right keeping a single running «right» product.',
      ],
      solution: {
        pattern: '**Prefix and suffix products:** "combine everything except position i" = (combine of the prefix before i) ⊗ (combine of the suffix after i). It works for sums, products, max, gcd, and more.',
        intuition: M`
          Division would be the obvious shortcut, but it fails with zeros and is ruled out anyway. Split the "everything else" into the part on the left and the part on the right. Both are running products, which a left-to-right and a right-to-left pass compute in O(n).
        `,
        java: J`class Solution {
    public int[] productExceptSelf(int[] nums) {
        int n = nums.length;
        int[] ans = new int[n];
        ans[0] = 1;
        for (int i = 1; i < n; i++) ans[i] = ans[i - 1] * nums[i - 1];   // product of nums[0..i-1]
        int right = 1;                                                // product of nums[i+1..n-1]
        for (int i = n - 1; i >= 0; i--) {
            ans[i] *= right;
            right *= nums[i];
        }
        return ans;
    }
}`,
        time: 'O(n)', space: 'O(1) extra', spaceWhy: 'the output array doesn’t count',
        pitfalls: M`
          - Division breaks on zeros: with one zero, only that index is non-zero; with two, everything is zero.
          - In the second pass, multiply «ans[i]» by «right» **before** folding in «nums[i]».
        `,
        alts: [
          { name: 'Separate left[] and right[] arrays', time: 'O(n)', space: 'O(n)', note: 'The clearest version to explain first. Then show that the output array can hold the left products.',
            java: J`class Solution {
    public int[] productExceptSelf(int[] nums) {
        int n = nums.length;
        int[] left = new int[n], right = new int[n], ans = new int[n];
        left[0] = 1; right[n - 1] = 1;
        for (int i = 1; i < n; i++) left[i] = left[i - 1] * nums[i - 1];
        for (int i = n - 2; i >= 0; i--) right[i] = right[i + 1] * nums[i + 1];
        for (int i = 0; i < n; i++) ans[i] = left[i] * right[i];
        return ans;
    }
}` },
          { name: 'Brute force', time: 'O(n²)', space: 'O(1)',
            java: J`class Solution {
    public int[] productExceptSelf(int[] nums) {
        int[] ans = new int[nums.length];
        for (int i = 0; i < nums.length; i++) { int p = 1; for (int j = 0; j < nums.length; j++) if (j != i) p *= nums[j]; ans[i] = p; }
        return ans;
    }
}` },
        ],
        followups: M`
          - **Can you use division?** Count zeros: more than one gives all zeros; exactly one means only that index gets the product of the rest; otherwise divide the total product by «nums[i]».
          - **Same pattern:** "trapping rain water" uses the prefix max from the left and the suffix max from the right.
        `,
        talk: 'Everything except i is the left product times the right product. I fill the answer with left products in one pass, then sweep from the right with a running product. O(n) time, O(1) extra space, no division.',
      },
      viz: { id: 'productExcept', input: { nums: [1, 2, 3, 4] } },
      lc: [lc(238, 'product-of-array-except-self', 'Product of Array Except Self', 'same'), lc(42, 'trapping-rain-water', 'Trapping Rain Water', 'similar'), lc(1352, 'product-of-the-last-k-numbers', 'Product of the Last K Numbers', 'variant')],
      drill: { prompt: 'For each index, the product of all other elements, without division, in O(n).', pattern: 'prefix-sum', why: 'Prefix products from the left times suffix products from the right.' },
    } },

    { problem: {
      id: 'subarray-sum-k', title: 'Count Subarrays Summing to K', diff: 'medium',
      tags: ['prefix sum', 'hash map'],
      statement: M`
        Given an integer array «nums» (values can be **negative**) and an integer «k», return the **number of contiguous subarrays** whose elements sum to exactly «k».
      `,
      fn: { name: 'subarraySum', params: [['int[]', 'nums'], ['int', 'k']], ret: 'int' },
      tests: [
        { args: [[1, 1, 1], 2], ex: true, expect: 2, why: '[1,1] starting at index 0, and at index 1.' },
        { args: [[1, 2, 3], 3], ex: true, expect: 2, why: '[1,2] and [3].' },
        { args: [[1, -1, 0], 0], expect: 3, why: '[1,−1], [0] and [1,−1,0].' },
        { args: [[3], 3], expect: 1 },
        { args: [[3], 2], expect: 0 },
        { args: [[0, 0, 0], 0], expect: 6 },
        { args: [[1, 2, -1, 3, -2, 2], 3], expect: 4 },
        { args: [[-1, -1, 1], 0], expect: 1 },
        { args: [{ $gen: 'ints', args: [20000, -1000, 1000, 23] }, 100], big: true },
        { args: [{ $gen: 'ints', args: [20000, -1, 1, 24] }, 0], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 2·10⁴', '−1000 ≤ nums[i] ≤ 1000', '−10⁷ ≤ k ≤ 10⁷'],
      hints: [
        'A sliding window won’t work: negative numbers mean the sum isn’t monotone as the window grows.',
        'With prefix sums, «sum(i+1..j) = prefix[j] − prefix[i]». For a fixed right end j, which earlier prefixes give a sum of k?',
        'You need the number of earlier prefixes equal to «prefix[j] − k». Keep a «HashMap<prefixSum, count>» seeded with «{0: 1}».',
      ],
      solution: {
        pattern: '**Prefix sum + count map:** the Two Sum complement trick applied to prefix sums. It counts subarrays with a target sum even with negative numbers.',
        intuition: M`
          Every subarray is a difference of two prefix sums. For each right end j, the subarrays ending at j with sum k correspond one-to-one with earlier positions i where «prefix[i] = prefix[j] − k». A hash map of prefix-sum counts answers "how many such i?" in O(1). Seeding «{0: 1}» accounts for the empty prefix, i.e. subarrays that start at index 0.
        `,
        java: J`class Solution {
    public int subarraySum(int[] nums, int k) {
        Map<Integer, Integer> count = new HashMap<>();
        count.put(0, 1);                                  // empty prefix
        int prefix = 0, result = 0;
        for (int x : nums) {
            prefix += x;
            result += count.getOrDefault(prefix - k, 0);  // earlier prefixes that complete a sum of k
            count.merge(prefix, 1, Integer::sum);
        }
        return result;
    }
}`,
        time: 'O(n)', space: 'O(n)',
        pitfalls: M`
          - Forgetting the «{0: 1}» seed misses every subarray that starts at index 0.
          - Updating the map **before** reading it would count an empty subarray when k = 0.
          - A sliding window gives wrong answers as soon as a negative number appears.
        `,
        alts: [
          { name: 'All subarrays with a running sum', time: 'O(n²)', space: 'O(1)', note: 'Fix the start, extend the end while accumulating the sum. That’s 2·10⁸ operations here: too slow in general, but fine as a correctness baseline.',
            java: J`class Solution {
    public int subarraySum(int[] nums, int k) {
        int count = 0;
        for (int i = 0; i < nums.length; i++) {
            int sum = 0;
            for (int j = i; j < nums.length; j++) { sum += nums[j]; if (sum == k) count++; }
        }
        return count;
    }
}` },
        ],
        followups: M`
          - **Divisible by k** (LeetCode 974): key the map by «Math.floorMod(prefix, k)» and look up the same key.
          - **Longest subarray with sum k:** store the first index of each prefix instead of a count.
          - **All values positive:** a sliding window also works, in O(1) space.
          - **2-D version** (LeetCode 1074): fix a pair of rows, compress the columns, then run this algorithm: O(rows² · cols).
        `,
        talk: 'Subarray sums are differences of prefix sums, so for each prefix I count how many earlier prefixes equal prefix − k, using a HashMap of counts seeded with {0:1}. One pass, O(n), and it handles negatives where a sliding window can’t.',
      },
      viz: { id: 'prefixSumMap' },
      lc: [lc(560, 'subarray-sum-equals-k', 'Subarray Sum Equals K', 'same'), lc(974, 'subarray-sums-divisible-by-k', 'Subarray Sums Divisible by K', 'variant'), lc(523, 'continuous-subarray-sum', 'Continuous Subarray Sum', 'variant'), lc(1074, 'number-of-submatrices-that-sum-to-target', 'Number of Submatrices That Sum to Target', 'harder')],
      drill: { prompt: 'Count contiguous subarrays with sum exactly k; the array has negative numbers.', pattern: 'prefix-sum', why: 'Negatives break sliding windows. Prefix sums plus a count map of earlier prefixes (prefix − k) works in O(n).' },
    } },

    { problem: {
      id: 'contiguous-array', title: 'Longest Balanced Binary Subarray', diff: 'medium',
      tags: ['prefix sum', 'first index'],
      statement: M`
        Given a binary array «nums» (0s and 1s), return the length of the **longest contiguous subarray** containing an **equal number of 0s and 1s**.
      `,
      fn: { name: 'findMaxLength', params: [['int[]', 'nums']], ret: 'int' },
      tests: [
        { args: [[0, 1]], ex: true, expect: 2 },
        { args: [[0, 1, 0]], ex: true, expect: 2 },
        { args: [[0, 0, 1, 0, 0, 0, 1, 1]], expect: 6, why: 'Indices 2..7: [1,0,0,0,1,1] has three of each.' },
        { args: [[1]], expect: 0 },
        { args: [[1, 1, 1, 1]], expect: 0 },
        { args: [[0, 1, 1, 0, 1, 1, 1, 0]], expect: 4 },
        { args: [[1, 0, 1, 0, 1, 0]], expect: 6 },
        { args: [{ $gen: 'ints', args: [100000, 0, 1, 29] }], big: true },
        { args: [{ $gen: 'repeat', args: [100000, 1] }], big: true, expect: 0 },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁵', 'nums[i] is 0 or 1'],
      hints: [
        'Replace every 0 with −1. What’s the sum of a balanced subarray then?',
        'Now you want the longest subarray with sum 0, which is two equal prefix sums as far apart as possible.',
        'Store the **first** index where each prefix sum appears (seed «0 → −1»). At each index, the candidate length is «i − first[prefix]».',
      ],
      solution: {
        pattern: '**Transform, then prefix sum + first-index map.** Counting problems like "equal numbers of A and B" become "sum is 0" once you map A → +1 and B → −1.',
        intuition: M`
          With 0 → −1, a subarray is balanced iff its sum is 0, iff the prefix sums at its two ends are equal. To make it as long as possible, pair each index with the **earliest** index that had the same prefix sum.
        `,
        java: J`class Solution {
    public int findMaxLength(int[] nums) {
        Map<Integer, Integer> first = new HashMap<>();   // prefix sum -> first index where it occurred
        first.put(0, -1);                                // empty prefix "ends" before index 0
        int prefix = 0, best = 0;
        for (int i = 0; i < nums.length; i++) {
            prefix += nums[i] == 1 ? 1 : -1;
            Integer j = first.putIfAbsent(prefix, i);      // keeps the earliest index
            if (j != null) best = Math.max(best, i - j);
        }
        return best;
    }
}`,
        time: 'O(n)', space: 'O(n)',
        pitfalls: M`
          - Overwriting the stored index with later ones shortens the answers. Use «putIfAbsent».
          - The «0 → −1» seed makes balanced prefixes (starting at index 0) count their full length «i + 1».
        `,
        alts: [
          { name: 'Array instead of map', time: 'O(n)', space: 'O(n)', note: 'The prefix lies in «[−n, n]», so an «int[2n + 1]» offset by n replaces the map: faster, same idea.',
            java: J`class Solution {
    public int findMaxLength(int[] nums) {
        int n = nums.length;
        int[] first = new int[2 * n + 1];
        Arrays.fill(first, -2);
        first[n] = -1;
        int prefix = 0, best = 0;
        for (int i = 0; i < n; i++) {
            prefix += nums[i] == 1 ? 1 : -1;
            if (first[prefix + n] == -2) first[prefix + n] = i;
            else best = Math.max(best, i - first[prefix + n]);
        }
        return best;
    }
}` },
          { name: 'Check every subarray', time: 'O(n²)', space: 'O(1)',
            java: J`class Solution {
    public int findMaxLength(int[] nums) {
        int best = 0;
        for (int i = 0; i < nums.length; i++) {
            int bal = 0;
            for (int j = i; j < nums.length; j++) { bal += nums[j] == 1 ? 1 : -1; if (bal == 0) best = Math.max(best, j - i + 1); }
        }
        return best;
    }
}` },
        ],
        talk: 'Map 0 to −1; balanced means sum zero, which means equal prefix sums. I store the first index of each prefix sum (seeded 0 → −1), and the answer is the maximum i − first[prefix]. O(n).',
      },
      lc: [lc(525, 'contiguous-array', 'Contiguous Array', 'same'), lc(325, 'maximum-size-subarray-sum-equals-k', 'Maximum Size Subarray Sum Equals k', 'variant', { premium: true }), lc(1124, 'longest-well-performing-interval', 'Longest Well-Performing Interval', 'harder')],
      drill: { prompt: 'Longest subarray of a 0/1 array with as many 0s as 1s.', pattern: 'prefix-sum', why: 'Map 0 → −1, then find equal prefix sums as far apart as possible (a first-index map).' },
    } },

    { problem: {
      id: 'car-pooling', title: 'Shuttle Capacity', diff: 'medium',
      tags: ['difference array', 'sweep'],
      statement: M`
        A shuttle drives east along a road with stops at kilometres «0, 1, 2, …» and never turns back. It seats «capacity» passengers.

        Each trip «trips[i] = [people, from, to]» means «people» passengers board at kilometre «from» and leave at kilometre «to». Return «true» if the shuttle can carry every trip without ever exceeding capacity.

        Passengers leaving at kilometre x free their seats *before* new passengers board at x.
      `,
      fn: { name: 'carPooling', params: [['int[][]', 'trips'], ['int', 'capacity']], ret: 'boolean' },
      tests: [
        { args: [[[2, 1, 5], [3, 3, 7]], 4], ex: true, expect: false, why: 'Between km 3 and 5 there are 2 + 3 = 5 passengers.' },
        { args: [[[2, 1, 5], [3, 3, 7]], 5], ex: true, expect: true },
        { args: [[[2, 1, 5], [3, 5, 7]], 3], expect: true, why: 'The first group leaves at km 5 just as the second boards.' },
        { args: [[[3, 2, 7], [3, 7, 9], [8, 3, 9]], 11], expect: true },
        { args: [[[9, 0, 1]], 8], expect: false },
        { args: [[[1, 0, 1000]], 1], expect: true },
        { args: [[[2, 1, 3], [2, 2, 4], [2, 3, 5]], 3], expect: false },
        { args: [{ $gen: 'trips', args: [1000, 100, 1000, 120, 31] }, 3000], big: true },
        { args: [{ $gen: 'trips', args: [1000, 100, 1000, 120, 32] }, 7000], big: true },
      ],
      constraints: ['1 ≤ trips.length ≤ 1000', 'trips[i] = [people, from, to] with 1 ≤ people ≤ 100', '0 ≤ from < to ≤ 1000', '1 ≤ capacity ≤ 10⁵'],
      hints: [
        'Adding «people» to every kilometre of every trip works, but it’s O(trips × distance). Can each trip be recorded in O(1)?',
        'Only two points matter per trip: where the load goes up and where it comes down.',
        'Difference array: «diff[from] += people», «diff[to] −= people». A running sum over «diff» gives the load at each kilometre; check it against capacity.',
      ],
      solution: {
        pattern: '**Difference array:** each range update costs O(1) at its two endpoints, and one prefix-sum sweep rebuilds the values. It’s the discrete cousin of the sweep line in the Intervals module.',
        intuition: M`
          The number of passengers only changes at pickup and drop-off points. Record just those changes (+people at «from», −people at «to»). Walking along the road with a running total then gives the exact load at every kilometre.
        `,
        java: J`class Solution {
    public boolean carPooling(int[][] trips, int capacity) {
        int[] diff = new int[1001];
        for (int[] t : trips) {
            diff[t[1]] += t[0];      // board at 'from'
            diff[t[2]] -= t[0];      // leave at 'to' (before anyone boards there)
        }
        int load = 0;
        for (int d : diff) {
            load += d;
            if (load > capacity) return false;
        }
        return true;
    }
}`,
        time: 'O(n + L)', space: 'O(L)', timeWhy: 'L = 1001 road positions',
        pitfalls: M`
          - Put the minus at «to», not «to + 1»: the interval is half-open because passengers get off at «to».
          - If coordinates were huge (10⁹), a 10⁹-slot array wouldn't fit. Sort the 2n events, or use a «TreeMap<position, delta>», instead.
        `,
        alts: [
          { name: 'Sort events (works for any coordinate range)', time: 'O(n log n)', space: 'O(n)', note: 'Make events (position, +people) and (position, −people), sort by position with drop-offs before pickups at equal positions, and sweep.',
            java: J`class Solution {
    public boolean carPooling(int[][] trips, int capacity) {
        int[][] ev = new int[trips.length * 2][];
        int k = 0;
        for (int[] t : trips) { ev[k++] = new int[]{t[1], t[0]}; ev[k++] = new int[]{t[2], -t[0]}; }
        Arrays.sort(ev, (a, b) -> a[0] != b[0] ? Integer.compare(a[0], b[0]) : Integer.compare(a[1], b[1]));
        int load = 0;
        for (int[] e : ev) { load += e[1]; if (load > capacity) return false; }
        return true;
    }
}` },
          { name: 'Simulate every kilometre', time: 'O(n · L)', space: 'O(L)',
            java: J`class Solution {
    public boolean carPooling(int[][] trips, int capacity) {
        int[] load = new int[1001];
        for (int[] t : trips) for (int x = t[1]; x < t[2]; x++) if ((load[x] += t[0]) > capacity) return false;
        return true;
    }
}` },
        ],
        followups: M`
          - **Flight bookings** (LeetCode 1109): the same difference array, and you return the rebuilt array.
          - **Minimum meeting rooms** is this idea with capacity replaced by "max simultaneous", solved by a sweep or a heap (Intervals module).
        `,
        talk: 'Each trip only changes the load at its pickup and drop-off, so I record +people at from and −people at to in a difference array, then sweep with a running sum and check capacity. O(n + L).',
      },
      viz: { id: 'diffArray' },
      lc: [lc(1094, 'car-pooling', 'Car Pooling', 'same'), lc(1109, 'corporate-flight-bookings', 'Corporate Flight Bookings', 'variant'), lc(370, 'range-addition', 'Range Addition', 'variant', { premium: true }), lc(2381, 'shifting-letters-ii', 'Shifting Letters II', 'variant')],
      drill: { prompt: 'Many “add v to every position between l and r” updates, then check the maximum load anywhere.', pattern: 'prefix-sum', why: 'A difference array: O(1) per range update, then one prefix-sum sweep.' },
    } },
  ],
});
})();

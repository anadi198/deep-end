(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

const grid = (r, c, f) => Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => f(i, j)));

DSA.module({
  id: 'bits', title: 'Bit Manipulation & Math', short: 'Bits & math',
  blurb: 'XOR tricks, masks and two’s complement in Java, then the matrix and math problems that show up as warm-ups: rotation, spirals, in-place marking, fast power.',
  intro: M`
    These problems are short but full of traps: sign bits, «>>» vs «>>>», overflow, and in-place updates that destroy the information you still need. Each one has a trick worth knowing by name. Learn the handful of identities in the first lesson and most of them become two-liners.
  `,
  more: [
    lc(231, 'power-of-two', 'Power of Two', 'easier'),
    lc(137, 'single-number-ii', 'Single Number II', 'harder'),
    lc(260, 'single-number-iii', 'Single Number III', 'harder'),
    lc(201, 'bitwise-and-of-numbers-range', 'Bitwise AND of Numbers Range', 'similar'),
    lc(78, 'subsets', 'Subsets (bitmask enumeration)', 'similar'),
    lc(7, 'reverse-integer', 'Reverse Integer', 'similar'),
    lc(202, 'happy-number', 'Happy Number', 'easier'),
    lc(66, 'plus-one', 'Plus One', 'easier'),
    lc(43, 'multiply-strings', 'Multiply Strings', 'similar'),
    lc(204, 'count-primes', 'Count Primes', 'similar'),
    lc(2013, 'detect-squares', 'Detect Squares', 'harder'),
    lc(1041, 'robot-bounded-in-circle', 'Robot Bounded In Circle', 'similar'),
  ],
  items: [
    { lesson: 'bits', title: 'Bits in Java: operators, identities, tricks', mins: 14,
      lede: 'Two’s complement, the three shifts, the XOR and n & (n − 1) identities, masks, and the Java library methods that do the work for you.',
      body: M`
        ## Two's complement in one paragraph
        A Java «int» is 32 bits. The top bit is the sign, and «−x == ~x + 1». So «−1» is all ones («0xFFFFFFFF»), «Integer.MIN_VALUE» is «0x80000000», and «Math.abs(Integer.MIN_VALUE)» is still negative, because +2³¹ doesn't fit. Java has no unsigned int type, but "treat this int as unsigned" problems just mean: don't let the sign bit confuse you.

        ## Operators
        | Op | Meaning | Note |
        |---|---|---|
        | «a & b» | AND | clear bits / test a bit |
        | «a \| b» | OR | set bits |
        | «a ^ b» | XOR | toggle bits; 1 where they differ |
        | «~a» | NOT | «~a == −a − 1» |
        | «a << k» | shift left | «× 2ᵏ» (bits fall off the top) |
        | «a >> k» | arithmetic shift right | copies the sign bit: «−8 >> 1 == −4» |
        | «a >>> k» | logical shift right | fills with 0: use for "unsigned" loops |

        :::warn The classic infinite loop
        «while (n != 0) { …; n >>= 1; }» never ends for negative n, because «>>» keeps copying the sign bit, so n becomes −1 forever. Use «>>>» or loop exactly 32 times.
        :::

        ## Identities worth memorizing
        | Expression | Result |
        |---|---|
        | «x ^ x», «x ^ 0» | «0», «x»: XOR cancels pairs, in any order |
        | «(x >> k) & 1» | bit k of x |
        | «x \| (1 << k)», «x & ~(1 << k)», «x ^ (1 << k)» | set, clear, toggle bit k |
        | «x & (x − 1)» | x with its **lowest set bit cleared** |
        | «x & −x» | only the lowest set bit (Fenwick trees use this) |
        | «x > 0 && (x & (x − 1)) == 0» | x is a power of two |
        | «a ^ b ^ a» | «b»: swap without a temp, find the odd one out |

        @viz xorSingle

        @viz bitTricks

        ## Library methods (use them, then explain what they do)
        «Integer.bitCount(x)», «Integer.highestOneBit(x)», «Integer.lowestOneBit(x)», «Integer.numberOfTrailingZeros(x)», «Integer.numberOfLeadingZeros(x)», «Integer.reverse(x)», «Integer.toBinaryString(x)», «Long.bitCount». Interviewers usually want the manual version too, so know both.

        ## Bitmasks as sets
        With up to about 20 items, an int can be a set: bit i is set if item i is in the set. Enumerate all subsets with «for (int m = 0; m < 1 << n; m++)», and all submasks of «m» with «for (int s = m; s > 0; s = (s − 1) & m)». This powers bitmask DP (TSP-style problems) and "visit all nodes" BFS.

        ## Addition without «+»
        «a ^ b» is the sum without carries; «(a & b) << 1» is the carries. Repeat until there are no carries. It works for negative numbers too, because two's complement arithmetic is the same bit-level addition.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'What does «n & (n − 1)» do?',
          options: ['Halves n', 'Clears the lowest set bit of n', 'Clears the highest set bit', 'Returns the lowest set bit'],
          answer: 1, why: 'Subtracting 1 flips the lowest 1 to 0 and every 0 below it to 1. AND-ing with the original wipes exactly those bits. Counting how many times you can do this gives the popcount.' },
        { q: 'For «int n = −8», what are «n >> 1» and «n >>> 1»?',
          options: ['−4 and −4', '−4 and 2147483644', '4 and 4', '−4 and 0'],
          answer: 1, why: '«>>» copies the sign bit (arithmetic shift) so −8 becomes −4. «>>>» shifts in a 0, giving the large positive number 0x7FFFFFFC = 2147483644.' },
      ],
      practice: ['single-number', 'number-of-1-bits', 'counting-bits', 'missing-number', 'reverse-bits', 'sum-two-integers'],
    },

    { problem: {
      id: 'single-number', title: 'Single Number', diff: 'easy',
      tags: ['XOR'],
      statement: M`
        Every element of «nums» appears **twice** except one, which appears once. Find it in O(n) time and O(1) extra space.
      `,
      fn: { name: 'singleNumber', params: [['int[]', 'nums']], ret: 'int' },
      tests: [
        { args: [[2, 2, 1]], ex: true, expect: 1 },
        { args: [[4, 1, 2, 1, 2]], ex: true, expect: 4 },
        { args: [[1]], ex: true, expect: 1 },
        { args: [[-1, -1, -2]], expect: -2 },
        { args: [[0, 5, 5]], expect: 0 },
        { args: [[-2147483648, 7, 7]], expect: -2147483648 },
        { args: [[...Array.from({ length: 30000 }, (_, i) => i - 15000), 424242, ...Array.from({ length: 30000 }, (_, i) => 15000 - i - 1)]], big: true, expect: 424242 },
      ],
      constraints: ['1 ≤ nums.length ≤ 3·10⁴ (large test: 6·10⁴ + 1)', 'Each element appears twice except one'],
      hints: [
        'A HashSet works (add, or remove if present), but it’s O(n) space.',
        'Which operation makes a value cancel itself out, regardless of order?',
        'XOR: x ^ x = 0 and x ^ 0 = x, and XOR is commutative. XOR all the elements.',
      ],
      solution: {
        pattern: '**XOR cancellation:** pairs vanish and the unpaired value remains.',
        intuition: 'XOR is associative and commutative, so you can mentally regroup the elements into pairs. Each pair XORs to 0, and 0 ^ single = single.',
        java: J`class Solution {
    public int singleNumber(int[] nums) {
        int x = 0;
        for (int v : nums) x ^= v;     // pairs cancel: a ^ a = 0
        return x;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - Summing with the formula «2·sum(set) − sum(array)» works mathematically but can overflow int.
        `,
        alts: [
          { name: 'HashSet toggle', time: 'O(n)', space: 'O(n)', java: J`class Solution {
    public int singleNumber(int[] nums) {
        Set<Integer> seen = new HashSet<>();
        for (int v : nums) if (!seen.add(v)) seen.remove(v);
        return seen.iterator().next();
    }
}` },
          { name: 'Sort and scan pairs', time: 'O(n log n)', space: 'O(1)', java: J`class Solution {
    public int singleNumber(int[] nums) {
        int[] a = nums.clone();
        Arrays.sort(a);
        for (int i = 0; i + 1 < a.length; i += 2) if (a[i] != a[i + 1]) return a[i];
        return a[a.length - 1];
    }
}` },
        ],
        followups: M`
          - **Every other element appears three times** (LeetCode 137): count each bit position mod 3, or use the «ones/twos» state machine.
          - **Two singles** (LeetCode 260): XOR everything to get «a ^ b», split the numbers by any set bit of that (for example «x & −x»), and XOR each group.
        `,
        talk: 'XOR everything. Pairs cancel (a ^ a = 0), XOR is order-independent, and the single value survives. O(n) time, O(1) space.',
      },
      viz: { id: 'xorSingle' },
      lc: [lc(136, 'single-number', 'Single Number', 'same'), lc(137, 'single-number-ii', 'Single Number II', 'harder'), lc(260, 'single-number-iii', 'Single Number III', 'harder'), lc(268, 'missing-number', 'Missing Number', 'similar')],
      drill: { prompt: 'Everything appears twice except one element; find it with O(1) extra space.', pattern: 'bits', why: 'XOR all the values: pairs cancel.' },
    } },

    { problem: {
      id: 'number-of-1-bits', title: 'Number of 1 Bits', diff: 'easy',
      tags: ['popcount', 'n & (n − 1)'],
      statement: M`
        Return the number of set bits in the 32-bit binary representation of «n», treating it as **unsigned** (so negative inputs have their sign bit counted).
      `,
      fn: { name: 'hammingWeight', params: [['int', 'n']], ret: 'int' },
      tests: [
        { args: [11], ex: true, expect: 3, why: '1011.' },
        { args: [128], ex: true, expect: 1 },
        { args: [2147483645], ex: true, expect: 30 },
        { args: [0], expect: 0 },
        { args: [-1], expect: 32, why: 'All 32 bits set.' },
        { args: [-3], expect: 31 },
        { args: [-2147483648], expect: 1, why: 'Only the sign bit. «while (n > 0)» would return 0 here.' },
        { args: [1431655765], expect: 16, why: '0x55555555.' },
      ],
      constraints: ['n is any 32-bit int, read as unsigned'],
      hints: [
        'Check the lowest bit with «n & 1», then shift. Which shift keeps negative numbers from looping forever?',
        '«>>>» fills with zeros, so n eventually reaches 0. Or loop exactly 32 times.',
        'Faster: «n &= n − 1» removes one set bit per iteration, so the loop runs popcount times.',
      ],
      solution: {
        pattern: '**Clear the lowest set bit** (Kernighan): one iteration per 1-bit.',
        intuition: '«n − 1» flips the lowest set bit and every 0 below it, so «n & (n − 1)» removes exactly that one bit. Count how many removals it takes to reach 0. It also works for negative n, because the loop condition is «n != 0» and there are no shifts.',
        java: J`class Solution {
    public int hammingWeight(int n) {
        int count = 0;
        while (n != 0) {
            n &= n - 1;        // drop the lowest set bit
            count++;
        }
        return count;
    }
}`,
        time: 'O(number of set bits) ≤ 32', space: 'O(1)',
        pitfalls: M`
          - «n >>= 1» with a negative n never reaches 0. Use «>>>».
          - «while (n > 0)» skips negative inputs entirely.
        `,
        alts: [
          { name: 'Check each bit with >>>', time: 'O(32)', space: 'O(1)', java: J`class Solution {
    public int hammingWeight(int n) {
        int count = 0;
        while (n != 0) { count += n & 1; n >>>= 1; }
        return count;
    }
}` },
          { name: 'Integer.bitCount', time: 'O(1)', space: 'O(1)', note: 'The library uses a SWAR trick: add adjacent bit pairs, then nibbles, then bytes, with masks like 0x55555555 and 0x33333333.',
            java: J`class Solution {
    public int hammingWeight(int n) { return Integer.bitCount(n); }
}` },
        ],
        followups: M`
          - **Called millions of times:** a 256-entry lookup table indexed by byte, or the SWAR method that «Integer.bitCount» uses.
          - **Hamming distance** (LeetCode 461): «bitCount(x ^ y)».
        `,
        talk: 'Kernighan’s trick: n &= n − 1 clears the lowest set bit, so count iterations until n == 0. It handles negatives because there’s no shift. Alternatively, test n & 1 and shift with >>> (not >>).',
      },
      viz: { id: 'bitTricks' },
      lc: [lc(191, 'number-of-1-bits', 'Number of 1 Bits', 'same'), lc(461, 'hamming-distance', 'Hamming Distance', 'easier'), lc(231, 'power-of-two', 'Power of Two', 'easier'), lc(338, 'counting-bits', 'Counting Bits', 'similar')],
      drill: { prompt: 'Count the set bits of a 32-bit integer (read as unsigned).', pattern: 'bits', why: 'n & (n − 1) clears one set bit per step; or shift with >>>.' },
    } },

    { problem: {
      id: 'counting-bits', title: 'Counting Bits', diff: 'easy',
      tags: ['DP on bits'],
      statement: M`
        Return an array «ans» of length «n + 1» where «ans[i]» is the number of 1 bits in «i». Aim for O(n) without calling a popcount per number.
      `,
      fn: { name: 'countBits', params: [['int', 'n']], ret: 'int[]' },
      tests: [
        { args: [2], ex: true, expect: [0, 1, 1] },
        { args: [5], ex: true, expect: [0, 1, 1, 2, 1, 2] },
        { args: [0], expect: [0] },
        { args: [1], expect: [0, 1] },
        { args: [16], expect: [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4, 1] },
        { args: [100000], big: true },
      ],
      constraints: ['0 ≤ n ≤ 10⁵'],
      hints: [
        'Relate i to a smaller number whose answer you already know.',
        '«i >> 1» is i without its last bit. So bits(i) = bits(i >> 1) + (i & 1).',
        'Alternatively bits(i) = bits(i & (i − 1)) + 1, since that clears exactly one bit.',
      ],
      solution: {
        pattern: '**DP over the bits:** each number’s answer comes from a smaller number with one bit removed.',
        intuition: 'Shifting right drops the lowest bit, giving a smaller number that’s already computed. Add back that dropped bit (i & 1). Filling from 0 upward makes it a one-line recurrence.',
        java: J`class Solution {
    public int[] countBits(int n) {
        int[] ans = new int[n + 1];
        for (int i = 1; i <= n; i++)
            ans[i] = ans[i >> 1] + (i & 1);     // drop the last bit, add it back
        return ans;
    }
}`,
        time: 'O(n)', space: 'O(1) besides the output',
        pitfalls: M`
          - Operator precedence: «ans[i >> 1] + i & 1» parses as «(ans[i >> 1] + i) & 1». Parenthesize «(i & 1)».
        `,
        alts: [
          { name: 'Clear the lowest set bit', time: 'O(n)', space: 'O(1)', java: J`class Solution {
    public int[] countBits(int n) {
        int[] ans = new int[n + 1];
        for (int i = 1; i <= n; i++) ans[i] = ans[i & (i - 1)] + 1;
        return ans;
    }
}` },
          { name: 'Popcount each number', time: 'O(n log n)', space: 'O(1)', java: J`class Solution {
    public int[] countBits(int n) {
        int[] ans = new int[n + 1];
        for (int i = 0; i <= n; i++) ans[i] = Integer.bitCount(i);
        return ans;
    }
}` },
        ],
        talk: 'DP: bits(i) = bits(i >> 1) + (i & 1), since shifting drops the last bit and that smaller number is already computed. Or bits(i & (i−1)) + 1. O(n).',
      },
      lc: [lc(338, 'counting-bits', 'Counting Bits', 'same'), lc(191, 'number-of-1-bits', 'Number of 1 Bits', 'easier'), lc(1356, 'sort-integers-by-the-number-of-1-bits', 'Sort Integers by The Number of 1 Bits', 'similar')],
      drill: { prompt: 'Number of set bits for every integer from 0 to n, in O(n).', pattern: 'bits', why: 'DP: bits(i) = bits(i >> 1) + (i & 1).' },
    } },

    { problem: {
      id: 'missing-number', title: 'Missing Number', diff: 'easy',
      tags: ['XOR', 'Gauss sum'],
      statement: M`
        «nums» contains «n» distinct numbers taken from «0..n». Return the one number in the range that is missing.
      `,
      fn: { name: 'missingNumber', params: [['int[]', 'nums']], ret: 'int' },
      tests: [
        { args: [[3, 0, 1]], ex: true, expect: 2 },
        { args: [[0, 1]], ex: true, expect: 2 },
        { args: [[9, 6, 4, 2, 3, 5, 7, 0, 1]], ex: true, expect: 8 },
        { args: [[0]], expect: 1 },
        { args: [[1]], expect: 0 },
        { args: [[1, 2]], expect: 0 },
        { args: [{ $gen: 'perm', args: [100000, 701] }], big: true, expect: 0, why: 'A shuffled 1..n, so 0 is missing.' },
        { args: [{ $gen: 'range', args: [100000, 0, 1] }], big: true, expect: 100000 },
      ],
      constraints: ['1 ≤ n ≤ 10⁴ (large tests: 10⁵)', 'All numbers distinct, in [0, n]'],
      hints: [
        'Sum of 0..n is n(n+1)/2. What does subtracting the actual sum give?',
        'That works (watch for overflow in other variants). The XOR version never overflows.',
        'XOR every index 0..n with every value: everything present appears twice and cancels, leaving the missing number.',
      ],
      solution: {
        pattern: '**XOR indices against values:** everything present cancels.',
        intuition: 'XOR together all of 0..n and all elements of nums. Each present number appears twice (once as an index or n, once as a value) and cancels. The missing number appears only once.',
        java: J`class Solution {
    public int missingNumber(int[] nums) {
        int x = nums.length;                 // start with n (the index that has no slot)
        for (int i = 0; i < nums.length; i++)
            x ^= i ^ nums[i];
        return x;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - Forgetting to include «n» itself in the XOR (hence «x = nums.length» at the start).
          - The Gauss formula «n·(n+1)/2» overflows int for n > 65535 if you compute it in int. Use long, or the XOR.
        `,
        alts: [
          { name: 'Gauss sum (long)', time: 'O(n)', space: 'O(1)', java: J`class Solution {
    public int missingNumber(int[] nums) {
        long n = nums.length, expected = n * (n + 1) / 2, actual = 0;
        for (int v : nums) actual += v;
        return (int) (expected - actual);
    }
}` },
          { name: 'Boolean presence array', time: 'O(n)', space: 'O(n)', java: J`class Solution {
    public int missingNumber(int[] nums) {
        boolean[] seen = new boolean[nums.length + 1];
        for (int v : nums) seen[v] = true;
        for (int i = 0; ; i++) if (!seen[i]) return i;
    }
}` },
        ],
        talk: 'XOR all indices 0..n with all values. Every present number appears twice and cancels, leaving the missing one. Alternatively n(n+1)/2 − sum, computed in long. O(n), O(1).',
      },
      lc: [lc(268, 'missing-number', 'Missing Number', 'same'), lc(136, 'single-number', 'Single Number', 'similar'), lc(41, 'first-missing-positive', 'First Missing Positive', 'harder'), lc(645, 'set-mismatch', 'Set Mismatch', 'variant')],
      drill: { prompt: 'n distinct numbers from 0..n; which one is missing?', pattern: 'bits', why: 'XOR indices with values (or a Gauss sum in long).' },
    } },

    { problem: {
      id: 'reverse-bits', title: 'Reverse Bits', diff: 'easy',
      tags: ['shifts', 'unsigned'],
      statement: M`
        Reverse the 32 bits of «n» (bit 0 becomes bit 31, and so on) and return the result as an int. Treat the input and output as raw bit patterns: the result may be negative.
      `,
      fn: { name: 'reverseBits', params: [['int', 'n']], ret: 'int' },
      tests: [
        { args: [43261596], ex: true, expect: 964176192, why: '00000010100101000001111010011100 → 00111001011110000010100101000000.' },
        { args: [-3], ex: true, expect: -1073741825, why: '0xFFFFFFFD → 0xBFFFFFFF.' },
        { args: [0], expect: 0 },
        { args: [1], expect: -2147483648 },
        { args: [-1], expect: -1 },
        { args: [2], expect: 1073741824 },
        { args: [-2147483648], expect: 1 },
      ],
      constraints: ['n is any 32-bit pattern'],
      hints: [
        'Build the result one bit at a time: take n’s lowest bit and push it into the result from the right.',
        '«res = (res << 1) | (n & 1); n >>>= 1;», exactly 32 times.',
        'Loop 32 times rather than while n != 0, because leading zeros matter (they become trailing zeros).',
      ],
      solution: {
        pattern: '**Bit-by-bit transfer:** pop the lowest bit of n, push it onto the result.',
        intuition: 'Reading n from its lowest bit and writing into res from its lowest bit (shifting res left each time) reverses the order, like popping from one stack and pushing onto another.',
        java: J`class Solution {
    public int reverseBits(int n) {
        int res = 0;
        for (int i = 0; i < 32; i++) {
            res = (res << 1) | (n & 1);   // push n's lowest bit
            n >>>= 1;                     // unsigned shift: no sign copying
        }
        return res;
    }
}`,
        time: 'O(32)', space: 'O(1)',
        pitfalls: M`
          - Stopping when n becomes 0 drops the leading zeros, which should become trailing zeros of the result.
          - «>>» on a negative n shifts in ones. Use «>>>» (or never look past 32 iterations, as here).
        `,
        alts: [
          { name: 'Divide and conquer swaps', time: 'O(1) (5 steps)', space: 'O(1)', note: 'Swap the 16-bit halves, then the bytes within each half, then the nibbles, the bit pairs, and single bits. This is how Integer.reverse works.',
            java: J`class Solution {
    public int reverseBits(int n) {
        n = (n >>> 16) | (n << 16);
        n = ((n & 0xff00ff00) >>> 8) | ((n & 0x00ff00ff) << 8);
        n = ((n & 0xf0f0f0f0) >>> 4) | ((n & 0x0f0f0f0f) << 4);
        n = ((n & 0xcccccccc) >>> 2) | ((n & 0x33333333) << 2);
        n = ((n & 0xaaaaaaaa) >>> 1) | ((n & 0x55555555) << 1);
        return n;
    }
}` },
          { name: 'Integer.reverse', time: 'O(1)', space: 'O(1)', java: J`class Solution {
    public int reverseBits(int n) { return Integer.reverse(n); }
}` },
        ],
        followups: M`
          - **Called many times:** cache the reversal of each byte (a 256-entry table) and combine four lookups.
        `,
        talk: 'Loop exactly 32 times: res = (res << 1) | (n & 1), then n >>>= 1. Stopping early would lose the leading zeros; >>> avoids sign extension. Or use divide-and-conquer mask swaps in five steps.',
      },
      lc: [lc(190, 'reverse-bits', 'Reverse Bits', 'same'), lc(7, 'reverse-integer', 'Reverse Integer', 'similar'), lc(191, 'number-of-1-bits', 'Number of 1 Bits', 'similar')],
      drill: { prompt: 'Reverse the order of the 32 bits of an integer.', pattern: 'bits', why: 'Transfer bits one at a time: res = (res << 1) | (n & 1), n >>>= 1, 32 times.' },
    } },

    { problem: {
      id: 'sum-two-integers', title: 'Sum of Two Integers (No + or −)', diff: 'medium',
      tags: ['XOR', 'carry'],
      statement: M`
        Return «a + b» **without** using the operators «+» or «−». (Overflow wraps around, like normal Java int addition.)
      `,
      fn: { name: 'getSum', params: [['int', 'a'], ['int', 'b']], ret: 'int' },
      tests: [
        { args: [1, 2], ex: true, expect: 3 },
        { args: [2, 3], ex: true, expect: 5 },
        { args: [-1, 1], expect: 0 },
        { args: [-5, -7], expect: -12 },
        { args: [1000, -1000], expect: 0 },
        { args: [0, 0], expect: 0 },
        { args: [-8, 3], expect: -5 },
        { args: [2147483647, 1], expect: -2147483648, why: 'Wraps around, just like «+».' },
      ],
      constraints: ['−1000 ≤ a, b ≤ 1000 on LeetCode; any ints here'],
      hints: [
        'Add in binary by hand: which bits produce a 1 without carrying, and which produce a carry?',
        '«a ^ b» is the sum ignoring carries; «(a & b) << 1» is the carry into each position.',
        'Repeat with a = sum-without-carry, b = carry until the carry is 0. At most 32 rounds.',
      ],
      solution: {
        pattern: '**Half-adder loop:** XOR adds without carries, AND-and-shift produces the carries; repeat until no carry.',
        intuition: M`
          Column by column, 0+0=0, 1+0=1 and 1+1=0 carry 1. That's XOR for the digit and AND for the carry, which moves one position left. Add the carries back in the same way. Each round pushes the carries at least one position left, so after at most 32 rounds they fall off the top. Two's complement makes negatives work unchanged.
        `,
        java: J`class Solution {
    public int getSum(int a, int b) {
        while (b != 0) {
            int carry = (a & b) << 1;   // positions where both are 1 carry into the next bit
            a ^= b;                     // sum without the carries
            b = carry;
        }
        return a;
    }
}`,
        time: 'O(32)', space: 'O(1)',
        pitfalls: M`
          - In languages with unbounded ints (Python), negatives loop forever without a 32-bit mask. In Java, the int width does the masking for you.
        `,
        alts: [
          { name: 'Recursive form', time: 'O(32)', space: 'O(32)', java: J`class Solution {
    public int getSum(int a, int b) {
        return b == 0 ? a : getSum(a ^ b, (a & b) << 1);
    }
}` },
        ],
        followups: M`
          - **Subtraction:** «a − b = a + (~b + 1)», which is the same loop.
          - **Multiplication with shifts and adds:** Russian peasant multiplication.
        `,
        talk: 'XOR gives the sum without carries, (a & b) << 1 gives the carries. Loop until the carry is zero: at most 32 rounds, and negatives work thanks to two’s complement.',
      },
      lc: [lc(371, 'sum-of-two-integers', 'Sum of Two Integers', 'same'), lc(67, 'add-binary', 'Add Binary', 'easier'), lc(29, 'divide-two-integers', 'Divide Two Integers', 'harder')],
      drill: { prompt: 'Add two integers without using + or −.', pattern: 'bits', why: 'XOR is the carry-less sum and (a & b) << 1 the carry; loop until the carry is 0.' },
    } },

    { lesson: 'math-geometry', title: 'Matrix and math tricks', mins: 12,
      lede: 'Rotate = transpose + reverse, spiral with four shrinking walls, O(1)-space marking in the first row and column, fast power, and integer arithmetic that won’t bite.',
      body: M`
        ## Matrix rotation: compose simple moves
        Rotating 90° clockwise in place is two easy passes:
        1. **Transpose** (swap «m[i][j]» with «m[j][i]» for «j > i»).
        2. **Reverse each row.**

        Counter-clockwise: transpose, then reverse each column (or reverse rows first, then transpose). 180°: reverse rows and reverse each row. Deriving these on the spot from "where does (0, 0) go?" is the skill.

        ## Spiral traversal: four walls
        Keep «top, bottom, left, right». Walk right along top (then «top++»), down along right («right−−»), left along bottom («bottom−−»), up along left («left++»). Check «top ≤ bottom» and «left ≤ right» before the last two legs, or single rows and columns get visited twice.

        ## O(1) extra space: use the input as your notebook
        Set Matrix Zeroes needs to remember which rows and columns to clear. Instead of two boolean arrays, store the flags in the **first row and first column**, plus one extra flag for the first column itself (because «m[0][0]» can only hold one of the two). Same idea as marking visited cells in place with «'#'» in grid DFS.

        ## Fast exponentiation
        @viz fastPow

        «xⁿ» in O(log n): square the base and halve n each step, multiplying the result in whenever the current bit of n is 1. For negative n, compute with «1/x» and «−n». Store «n» in a **long** first, because «−Integer.MIN_VALUE» overflows. The same loop with «% MOD» gives modular exponentiation.

        ## Integer arithmetic that won't bite
        | Situation | Safe form |
        |---|---|
        | Midpoint | «lo + (hi − lo) / 2» or «(lo + hi) >>> 1» |
        | Products or sums past 2·10⁹ | cast to «long» **before** multiplying: «(long) a * b» |
        | Floor division and modulo with negatives | «Math.floorDiv», «Math.floorMod» («−7 / 2 == −3», «−7 % 2 == −1») |
        | Big results "modulo 10⁹ + 7" | reduce after every «+» and «×», in long |
        | GCD | «gcd(a, b) = b == 0 ? a : gcd(b, a % b)» |
        | Overflow check | «Math.addExact», «Math.multiplyExact» throw instead of wrapping |

        @quiz 0
      `,
      quiz: [
        { q: 'Which pair of in-place steps rotates a square matrix 90° clockwise?',
          options: ['Reverse each row, then reverse each column', 'Transpose, then reverse each row', 'Transpose, then reverse each column', 'Reverse the row order only'],
          answer: 1, why: 'Transposing sends (i, j) to (j, i); reversing each row then sends it to (j, n−1−i), which is exactly the clockwise rotation. Transpose then reverse columns gives counter-clockwise.' },
      ],
      practice: ['rotate-image', 'spiral-matrix', 'set-matrix-zeroes', 'pow-x-n'],
    },

    { problem: {
      id: 'rotate-image', title: 'Rotate Image', diff: 'medium',
      tags: ['matrix', 'in place'],
      statement: M`
        Rotate the «n × n» matrix 90° **clockwise, in place**. Your method returns nothing; the grader inspects «matrix».
      `,
      fn: { name: 'rotate', params: [['int[][]', 'matrix']], ret: 'void' },
      tests: [
        { args: [[[1, 2, 3], [4, 5, 6], [7, 8, 9]]], ex: true, expect: [[7, 4, 1], [8, 5, 2], [9, 6, 3]] },
        { args: [[[5, 1, 9, 11], [2, 4, 8, 10], [13, 3, 6, 7], [15, 14, 12, 16]]], ex: true, expect: [[15, 13, 2, 5], [14, 3, 4, 1], [12, 6, 8, 9], [16, 7, 10, 11]] },
        { args: [[[1]]], expect: [[1]] },
        { args: [[[1, 2], [3, 4]]], expect: [[3, 1], [4, 2]] },
        { args: [grid(5, 5, (i, j) => i * 5 + j)], expect: grid(5, 5, (i, j) => (4 - j) * 5 + i) },
        { args: [{ $gen: 'matrix', args: [500, 500, -1000, 1000, 702] }], big: true },
      ],
      constraints: ['1 ≤ n ≤ 20 (large test: 500)', 'In place: no second matrix'],
      hints: [
        'Where does the element at (i, j) end up after a clockwise rotation?',
        'At (j, n − 1 − i). Can you get there with two simpler in-place operations?',
        'Transpose (swap across the main diagonal), then reverse each row.',
      ],
      solution: {
        pattern: '**Compose simple in-place moves:** transpose, then reverse each row.',
        intuition: 'A clockwise rotation maps (i, j) → (j, n−1−i). Transposing gives (j, i); mirroring each row horizontally then gives (j, n−1−i). Both steps are easy in-place swaps.',
        java: J`class Solution {
    public void rotate(int[][] m) {
        int n = m.length;
        for (int i = 0; i < n; i++)
            for (int j = i + 1; j < n; j++) {            // transpose: only above the diagonal
                int t = m[i][j]; m[i][j] = m[j][i]; m[j][i] = t;
            }
        for (int[] row : m)
            for (int l = 0, r = n - 1; l < r; l++, r--) { // reverse each row
                int t = row[l]; row[l] = row[r]; row[r] = t;
            }
    }
}`,
        time: 'O(n²)', space: 'O(1)',
        pitfalls: M`
          - Transposing over the full matrix (j from 0) swaps every pair twice and undoes itself.
          - Allocating a new matrix and assigning «matrix = copy» only changes the local reference. The caller sees nothing.
        `,
        alts: [
          { name: 'Rotate four cells at a time (layers)', time: 'O(n²)', space: 'O(1)', note: 'For each layer and offset, cycle top → right → bottom → left → top with one temp.',
            java: J`class Solution {
    public void rotate(int[][] m) {
        int n = m.length;
        for (int i = 0; i < n / 2; i++)
            for (int j = i; j < n - 1 - i; j++) {
                int t = m[i][j];
                m[i][j] = m[n - 1 - j][i];
                m[n - 1 - j][i] = m[n - 1 - i][n - 1 - j];
                m[n - 1 - i][n - 1 - j] = m[j][n - 1 - i];
                m[j][n - 1 - i] = t;
            }
    }
}` },
        ],
        talk: 'Clockwise maps (i, j) → (j, n−1−i). Do it as transpose (swap above the diagonal only) followed by reversing each row. Both are in place: O(n²) time, O(1) space.',
      },
      lc: [lc(48, 'rotate-image', 'Rotate Image', 'same'), lc(1886, 'determine-whether-matrix-can-be-obtained-by-rotation', 'Determine Whether Matrix Can Be Obtained By Rotation', 'variant'), lc(867, 'transpose-matrix', 'Transpose Matrix', 'easier')],
      drill: { prompt: 'Rotate an n×n matrix by 90° clockwise without a second matrix.', pattern: 'matrix', why: 'Transpose, then reverse each row.' },
    } },

    { problem: {
      id: 'spiral-matrix', title: 'Spiral Matrix', diff: 'medium',
      tags: ['matrix', 'boundaries'],
      statement: M`
        Return all elements of the «m × n» matrix in **spiral order**: clockwise, starting at the top-left corner.
      `,
      fn: { name: 'spiralOrder', params: [['int[][]', 'matrix']], ret: 'List<Integer>' },
      tests: [
        { args: [[[1, 2, 3], [4, 5, 6], [7, 8, 9]]], ex: true, expect: [1, 2, 3, 6, 9, 8, 7, 4, 5] },
        { args: [[[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]], ex: true, expect: [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7] },
        { args: [[[7]]], expect: [7] },
        { args: [[[1, 2, 3, 4]]], expect: [1, 2, 3, 4], why: 'A single row must not be walked back.' },
        { args: [[[1], [2], [3], [4]]], expect: [1, 2, 3, 4] },
        { args: [[[1, 2], [3, 4]]], expect: [1, 2, 4, 3] },
        { args: [[[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]]], expect: [1, 2, 3, 6, 9, 12, 11, 10, 7, 4, 5, 8] },
        { args: [{ $gen: 'matrix', args: [300, 200, -100, 100, 703] }], big: true },
      ],
      constraints: ['1 ≤ m, n ≤ 10 (large test: 300 × 200)'],
      hints: [
        'Peel the matrix like an onion: one full ring at a time.',
        'Keep four walls (top, bottom, left, right). Walk each side, then move that wall inward.',
        'Before walking the bottom row and the left column, re-check «top ≤ bottom» and «left ≤ right», or thin matrices get elements twice.',
      ],
      solution: {
        pattern: '**Four shrinking boundaries:** walk a side, then move that wall in.',
        intuition: 'Each pass around the ring consumes the top row, the right column, the bottom row and the left column, then the problem is the same on the smaller inner matrix. Tracking four walls avoids a visited array. The only subtlety is a leftover single row or column, which the two re-checks handle.',
        java: J`class Solution {
    public List<Integer> spiralOrder(int[][] m) {
        List<Integer> out = new ArrayList<>();
        int top = 0, bottom = m.length - 1, left = 0, right = m[0].length - 1;
        while (top <= bottom && left <= right) {
            for (int c = left; c <= right; c++) out.add(m[top][c]);
            top++;
            for (int r = top; r <= bottom; r++) out.add(m[r][right]);
            right--;
            if (top <= bottom) {                       // a row is still left
                for (int c = right; c >= left; c--) out.add(m[bottom][c]);
                bottom--;
            }
            if (left <= right) {                       // a column is still left
                for (int r = bottom; r >= top; r--) out.add(m[r][left]);
                left++;
            }
        }
        return out;
    }
}`,
        time: 'O(m · n)', space: 'O(1) besides the output',
        pitfalls: M`
          - Missing the two re-checks: a 1 × 4 matrix would output 1 2 3 4 3 2 1.
        `,
        alts: [
          { name: 'Direction vector + visited', time: 'O(m · n)', space: 'O(m · n)', note: 'Walk with dr/dc and turn right when the next cell is out of bounds or visited. Easier to get right under pressure, at the cost of a visited array.',
            java: J`class Solution {
    public List<Integer> spiralOrder(int[][] m) {
        int R = m.length, C = m[0].length;
        boolean[][] seen = new boolean[R][C];
        int[] dr = {0, 1, 0, -1}, dc = {1, 0, -1, 0};
        List<Integer> out = new ArrayList<>();
        int r = 0, c = 0, d = 0;
        for (int k = 0; k < R * C; k++) {
            out.add(m[r][c]); seen[r][c] = true;
            int nr = r + dr[d], nc = c + dc[d];
            if (nr < 0 || nc < 0 || nr >= R || nc >= C || seen[nr][nc]) { d = (d + 1) % 4; nr = r + dr[d]; nc = c + dc[d]; }
            r = nr; c = nc;
        }
        return out;
    }
}` },
        ],
        talk: 'Four walls: walk the top row, then top++; the right column, then right−−; if a row remains, the bottom row backwards, then bottom−−; if a column remains, the left column upwards, then left++. The re-checks handle leftover single rows and columns. O(m·n).',
      },
      lc: [lc(54, 'spiral-matrix', 'Spiral Matrix', 'same'), lc(59, 'spiral-matrix-ii', 'Spiral Matrix II', 'variant'), lc(885, 'spiral-matrix-iii', 'Spiral Matrix III', 'harder')],
      drill: { prompt: 'Read out a matrix in clockwise spiral order.', pattern: 'matrix', why: 'Four shrinking boundaries with re-checks for leftover rows or columns.' },
    } },

    { problem: {
      id: 'set-matrix-zeroes', title: 'Set Matrix Zeroes', diff: 'medium',
      tags: ['matrix', 'in-place marking'],
      statement: M`
        If an element of the «m × n» matrix is «0», set its **entire row and column** to 0, in place. Your method returns nothing; the grader inspects «matrix». Can you use O(1) extra space?
      `,
      fn: { name: 'setZeroes', params: [['int[][]', 'matrix']], ret: 'void' },
      tests: [
        { args: [[[1, 1, 1], [1, 0, 1], [1, 1, 1]]], ex: true, expect: [[1, 0, 1], [0, 0, 0], [1, 0, 1]] },
        { args: [[[0, 1, 2, 0], [3, 4, 5, 2], [1, 3, 1, 5]]], ex: true, expect: [[0, 0, 0, 0], [0, 4, 5, 0], [0, 3, 1, 0]] },
        { args: [[[1]]], expect: [[1]] },
        { args: [[[0]]], expect: [[0]] },
        { args: [[[1, 0]]], expect: [[0, 0]] },
        { args: [[[1], [0]]], expect: [[0], [0]] },
        { args: [[[1, 2, 3], [4, 0, 6], [7, 8, 9], [0, 1, 1]]], expect: [[0, 0, 3], [0, 0, 0], [0, 0, 9], [0, 0, 0]] },
        { args: [[[1, 1, 1], [0, 1, 2]]], expect: [[0, 1, 1], [0, 0, 0]], why: 'Only the first column is marked. It must not wipe row 0.' },
        { args: [{ $gen: 'matrix', args: [300, 300, 0, 3000, 704] }], big: true },
      ],
      constraints: ['1 ≤ m, n ≤ 200 (large test: 300 × 300)'],
      hints: [
        'If you zero cells as you find zeros, the new zeros trigger more zeroing. Record first, then clear.',
        'Two boolean arrays (rows, cols) give O(m + n) space. Where in the matrix could those flags live instead?',
        'Use row 0 and column 0 as the flag arrays, plus one boolean for whether column 0 itself must be cleared. Clear the inner cells first, then row 0 and column 0 last.',
      ],
      solution: {
        pattern: '**Use the input as scratch space:** row 0 and column 0 hold the flags; one extra variable resolves the shared corner.',
        intuition: M`
          A cell must become 0 iff its row or column contains a 0. Record that in «m[i][0]» (row i) and «m[0][j]» (column j). The corner «m[0][0]» can't mean both "row 0" and "column 0", so give column 0 its own boolean. Then clear inner cells using the flags, and handle row 0 and column 0 **last**, so the flags are read before they're overwritten.
        `,
        java: J`class Solution {
    public void setZeroes(int[][] m) {
        int R = m.length, C = m[0].length;
        boolean col0 = false;                             // does column 0 need clearing?
        for (int i = 0; i < R; i++) {
            if (m[i][0] == 0) col0 = true;
            for (int j = 1; j < C; j++)
                if (m[i][j] == 0) { m[i][0] = 0; m[0][j] = 0; }   // flags in row 0 / column 0
        }
        for (int i = R - 1; i >= 0; i--) {                // bottom-up so row 0 (the flags) is cleared last
            for (int j = C - 1; j >= 1; j--)
                if (m[i][0] == 0 || m[0][j] == 0) m[i][j] = 0;
            if (col0) m[i][0] = 0;
        }
    }
}`,
        time: 'O(m · n)', space: 'O(1)',
        pitfalls: M`
          - Zeroing row 0 or column 0 before using them as flags erases the information.
          - Using «m[0][0]» for both row 0 and column 0 zeroes too much, hence the separate «col0» (see the last test).
          - Marking with a sentinel like «−1» or «Integer.MIN_VALUE» breaks when that value can appear in the input.
        `,
        alts: [
          { name: 'Row and column flag arrays', time: 'O(m · n)', space: 'O(m + n)', java: J`class Solution {
    public void setZeroes(int[][] m) {
        int R = m.length, C = m[0].length;
        boolean[] row = new boolean[R], col = new boolean[C];
        for (int i = 0; i < R; i++) for (int j = 0; j < C; j++) if (m[i][j] == 0) { row[i] = true; col[j] = true; }
        for (int i = 0; i < R; i++) for (int j = 0; j < C; j++) if (row[i] || col[j]) m[i][j] = 0;
    }
}` },
        ],
        talk: 'Record, then clear. For O(1) space, store the flags in row 0 and column 0, with one boolean for column 0 because the corner is shared. Clear the inner cells from the flags, and row 0 / column 0 last (iterate bottom-up). O(m·n).',
      },
      lc: [lc(73, 'set-matrix-zeroes', 'Set Matrix Zeroes', 'same'), lc(289, 'game-of-life', 'Game of Life', 'similar'), lc(2482, 'difference-between-ones-and-zeros-in-row-and-column', 'Difference Between Ones and Zeros in Row and Column', 'easier')],
      drill: { prompt: 'Zero out every row and column containing a 0, in place with O(1) extra space.', pattern: 'matrix', why: 'Keep flags in the first row and column, plus one extra boolean.' },
    } },

    { problem: {
      id: 'pow-x-n', title: 'Pow(x, n)', diff: 'medium',
      tags: ['fast exponentiation', 'binary'],
      statement: M`
        Implement «pow(x, n)»: «x» raised to the integer power «n» (which may be negative). Don't call «Math.pow».
      `,
      fn: { name: 'myPow', params: [['double', 'x'], ['int', 'n']], ret: 'double' },
      tests: [
        { args: [2.0, 10], ex: true, expect: 1024.0 },
        { args: [2.1, 3], ex: true, expect: 9.261 },
        { args: [2.0, -2], ex: true, expect: 0.25 },
        { args: [1.0, -2147483648], expect: 1.0, why: '−n overflows int if you negate it as an int.' },
        { args: [0.5, 3], expect: 0.125 },
        { args: [-2.0, 3], expect: -8.0 },
        { args: [-1.0, 2147483647], expect: -1.0, why: 'O(n) multiplication would take 2·10⁹ steps.' },
        { args: [2.0, -2147483648], expect: 0.0 },
        { args: [1.00001, 123456], expect: 3.436845 },
        { args: [0.0, 5], expect: 0.0 },
        { args: [7.0, 0], expect: 1.0 },
      ],
      constraints: ['−100 < x < 100', '−2³¹ ≤ n ≤ 2³¹ − 1', 'Either x ≠ 0 or n > 0', 'Answers are checked to a relative error of 10⁻⁵'],
      hints: [
        'Multiplying x by itself n times is O(n), up to 2·10⁹ here.',
        'x¹⁰ = (x⁵)², and x⁵ = x · (x²)². Halving the exponent each step gives O(log n).',
        'Iterate over the bits of n (as a long, to survive −2³¹): square the base each step and multiply it into the result when the bit is 1. For n < 0, use 1/x and −n.',
      ],
      solution: {
        pattern: '**Fast exponentiation (square and multiply):** one squaring per bit of the exponent.',
        intuition: M`
          Write n in binary, for example 13 = 1101₂, so x¹³ = x⁸ · x⁴ · x¹. The base walks through x, x², x⁴, x⁸, … by repeated squaring, and you multiply in the ones whose bit is set. That's log₂ n squarings. A negative exponent is the same computation on 1/x.
        `,
        java: J`class Solution {
    public double myPow(double x, int n) {
        long e = n;                  // long: -(-2^31) doesn't fit in int
        if (e < 0) { x = 1 / x; e = -e; }
        double result = 1;
        while (e > 0) {
            if ((e & 1) == 1) result *= x;   // this bit is set: multiply the current power in
            x *= x;                          // x, x^2, x^4, x^8, ...
            e >>= 1;
        }
        return result;
    }
}`,
        time: 'O(log n)', space: 'O(1)',
        pitfalls: M`
          - «n = −n» on «Integer.MIN_VALUE» stays negative. Copy it to a long first.
          - The recursive version «pow(x, n/2) * pow(x, n/2)» calls itself twice, which is O(n) again. Compute the half once.
        `,
        alts: [
          { name: 'Recursive halving', time: 'O(log n)', space: 'O(log n)', java: J`class Solution {
    public double myPow(double x, int n) {
        long e = n;
        return e < 0 ? 1 / pow(x, -e) : pow(x, e);
    }
    private double pow(double x, long e) {
        if (e == 0) return 1;
        double half = pow(x, e / 2);        // compute once
        return e % 2 == 0 ? half * half : half * half * x;
    }
}` },
        ],
        followups: M`
          - **Modular power** (a^b mod m, as in LeetCode 372 «Super Pow»): the same loop with «% m» after each multiply, in long.
          - **Matrix power:** Fibonacci in O(log n) by raising [[1,1],[1,0]] to the n-th power.
        `,
        talk: 'Square and multiply. Copy n to a long (−2³¹ can’t be negated as an int); if it’s negative, invert x. Loop over the bits of e: multiply the result by x when the bit is 1, square x, shift e. O(log n).',
      },
      viz: { id: 'fastPow' },
      lc: [lc(50, 'powx-n', 'Pow(x, n)', 'same'), lc(372, 'super-pow', 'Super Pow', 'harder'), lc(69, 'sqrtx', 'Sqrt(x)', 'similar'), lc(509, 'fibonacci-number', 'Fibonacci Number', 'similar')],
      drill: { prompt: 'Compute x to an integer power (possibly negative) in O(log n).', pattern: 'matrix', why: 'Square and multiply over the bits of the exponent (as a long).' },
    } },
  ],
});
})();

(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function shuffled(arr, seed) { const r = rng(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// points with pairwise-distinct distances from the origin: [x, 1] for distinct x > 0
const POINTS = shuffled(Array.from({ length: 10000 }, (_, i) => [3 * i + 1, 1]), 5);
const WORDS = (() => { const r = rng(9); const base = Array.from({ length: 300 }, (_, i) => 'w' + i.toString(36)); const out = []; base.forEach((w, i) => { for (let c = 0; c < 1 + ((i * 37) % 97); c++) out.push(w); }); return shuffled(out, 3).slice(0, 12000).concat(r() < 2 ? [] : []); })();

DSA.module({
  id: 'heaps', title: 'Heaps & Priority Queues', short: 'Heaps',
  blurb: 'Always know the best item in a changing collection: top-K, merging sorted streams, running medians and greedy scheduling, all in O(log n) per step.',
  intro: M`
    A heap answers "what's the smallest (or largest) right now?" in O(1), and absorbs inserts and removals in O(log n). Four patterns account for nearly every heap problem in interviews: **top-K**, **K-way merge**, **two heaps**, and **greedy scheduling**. How the heap works inside is covered in the Java internals module; here we use it.
  `,
  more: [
    lc(1046, 'last-stone-weight', 'Last Stone Weight', 'easier'),
    lc(2558, 'take-gifts-from-the-richest-pile', 'Take Gifts From the Richest Pile', 'easier'),
    lc(1985, 'find-the-kth-largest-integer-in-the-array', 'Find the Kth Largest Integer in the Array', 'similar'),
    lc(378, 'kth-smallest-element-in-a-sorted-matrix', 'Kth Smallest Element in a Sorted Matrix', 'variant'),
    lc(373, 'find-k-pairs-with-smallest-sums', 'Find K Pairs with Smallest Sums', 'harder'),
    lc(767, 'reorganize-string', 'Reorganize String', 'similar'),
    lc(1834, 'single-threaded-cpu', 'Single-Threaded CPU', 'harder'),
    lc(355, 'design-twitter', 'Design Twitter', 'harder'),
    lc(480, 'sliding-window-median', 'Sliding Window Median', 'harder'),
    lc(871, 'minimum-number-of-refueling-stops', 'Minimum Number of Refueling Stops', 'harder'),
    lc(1642, 'furthest-building-you-can-reach', 'Furthest Building You Can Reach', 'similar'),
    lc(632, 'smallest-range-covering-elements-from-k-lists', 'Smallest Range Covering Elements from K Lists', 'harder'),
  ],
  items: [
    { lesson: 'heaps', title: 'The four heap patterns', mins: 14,
      lede: 'Top-K keeps the k best with a heap of the *opposite* kind; K-way merge keeps one candidate per source; two heaps split the data; greedy scheduling always takes the best available.',
      body: M`
        ## Java's PriorityQueue in 30 seconds
        ~~~java
        PriorityQueue<Integer> min = new PriorityQueue<>();                             // smallest first
        PriorityQueue<Integer> max = new PriorityQueue<>(Collections.reverseOrder());   // largest first
        PriorityQueue<int[]> byDist = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));
        pq.offer(x); pq.peek(); pq.poll(); pq.size(); pq.isEmpty();    // O(log n), O(1), O(log n)
        ~~~
        Remember: iterating or printing a PQ isn't sorted; «remove(x)» and «contains(x)» are O(n); and comparators should use «Integer.compare», not subtraction.

        ## Pattern 1: top-K with a heap of size k
        To keep the k **largest** elements, use a **min**-heap. Its root is the weakest member of the top k, so each new element only has to beat the root. When the size exceeds k, poll the root. At the end, the root is the k-th largest.

        @viz topKHeap

        | Want | Heap type | Keep size | Answer |
        |---|---|---|---|
        | k largest / k-th largest | min-heap | k | heap contents / root |
        | k smallest / k-th smallest (k closest) | max-heap | k | heap contents / root |
        | k most frequent | min-heap by count | k | heap contents |

        Cost: O(n log k), which beats sorting when k ≪ n and works on **streams** (one pass, O(k) memory). Alternatives: quickselect (O(n) average, in memory), or bucket sort when keys are small integers.

        ## Pattern 2: K-way merge
        Merge k sorted lists (or find the k-th smallest across sorted sources) by keeping **one candidate per source** in a min-heap: its current head. Pop the smallest and push the next element from the same source. The heap never holds more than k items: O(N log k) for N total elements.

        @viz kWayMerge

        Also covered by this pattern: k-th smallest in a sorted matrix (each row is a source), k pairs with the smallest sums, and the smallest range covering k lists.

        ## Pattern 3: two heaps
        Split the data into a **lower half** (a max-heap) and an **upper half** (a min-heap), balanced in size. The median, or any split point, sits at the tops.

        @viz twoHeapsMedian

        A variant: two heaps with different keys. In IPO, projects move from a min-heap by capital into a max-heap by profit once they become affordable.

        ## Pattern 4: greedy scheduling
        At each step, take the best available option, where "available" changes over time: meeting rooms (a min-heap of end times), task scheduling (a max-heap of remaining counts), CPU scheduling (a min-heap by duration), refuelling stops (a max-heap of fuel passed). The heap maintains the "best available" set as items become eligible or are used up.

        :::key Lazy deletion
        A PriorityQueue can't efficiently delete an arbitrary element or change a priority. Instead, push the new version and **skip stale entries** when they reach the top: check a map of current values, or whether the index has left the window. Dijkstra and sliding-window problems use this all the time.
        :::

        ## Signals
        - "k largest / smallest / closest / most frequent", "k-th largest" → top-K heap.
        - "k sorted lists / arrays / rows", "merge sorted" → K-way merge.
        - "running median", "balance two halves" → two heaps.
        - "schedule", "rooms", "CPU", "maximize with a budget, one at a time" → greedy with a heap.
        - Repeatedly "take the largest/smallest, modify it, put it back" → a heap simulation.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'To find the k **closest** points to the origin in a stream of a million points, using O(k) memory, you keep…',
          options: ['a min-heap by distance of size k', 'a max-heap by distance of size k, evicting the farthest when it overflows', 'a sorted list of all points', 'a hash map'],
          answer: 1, why: 'For the k *smallest* distances, keep a max-heap: the root is the farthest of the current k, and each new point only needs to beat it.' },
        { q: 'Merging k sorted lists with N total nodes using a heap of list heads costs…',
          options: ['O(N log N)', 'O(N log k)', 'O(N · k)', 'O(k log N)'],
          answer: 1, why: 'The heap holds at most k nodes, so each of the N pushes and pops costs O(log k).' },
      ],
      practice: ['kth-largest-array', 'kth-largest-stream', 'last-stone-weight', 'k-closest-points', 'merge-k-lists', 'top-k-frequent-words', 'task-scheduler', 'median-stream', 'ipo'],
    },

    { problem: {
      id: 'kth-largest-array', title: 'k-th Largest Element', diff: 'medium',
      tags: ['top-K', 'min-heap', 'quickselect'],
      statement: M`
        Return the «k»-th largest element of «nums»: the element that would be at index «k − 1» if the array were sorted in **descending** order. Duplicates count separately. Can you beat O(n log n)?
      `,
      fn: { name: 'findKthLargest', params: [['int[]', 'nums'], ['int', 'k']], ret: 'int' },
      tests: [
        { args: [[3, 2, 1, 5, 6, 4], 2], ex: true, expect: 5 },
        { args: [[3, 2, 3, 1, 2, 4, 5, 5, 6], 4], ex: true, expect: 4 },
        { args: [[1], 1], expect: 1 },
        { args: [[2, 1], 2], expect: 1 },
        { args: [[7, 7, 7, 7], 3], expect: 7 },
        { args: [[-1, -5, 10, 3], 1], expect: 10 },
        { args: [{ $gen: 'ints', args: [100000, -10000, 10000, 131] }, 50000], big: true },
        { args: [{ $gen: 'repeat', args: [100000, 5] }, 777], big: true, expect: 5, why: 'All equal: a naive quickselect degrades here.' },
      ],
      constraints: ['1 ≤ k ≤ nums.length ≤ 10⁵', '−10⁴ ≤ nums[i] ≤ 10⁴'],
      hints: [
        'Sorting works in O(n log n). If you only kept the k largest values seen so far, what would the answer be?',
        'The smallest of those k. A min-heap of size k keeps exactly those, with the answer at the root.',
        'Push each number; if the heap grows past k, poll. Return «peek()».',
      ],
      solution: {
        pattern: '**Top-K with a size-k min-heap:** O(n log k) time, O(k) space, and it works on streams.',
        intuition: 'The k-th largest is the smallest member of the "top k" club. A min-heap holding only the club exposes that member at the root; any newcomer smaller than the root can’t join.',
        java: J`class Solution {
    public int findKthLargest(int[] nums, int k) {
        PriorityQueue<Integer> heap = new PriorityQueue<>();   // min-heap of the k largest so far
        for (int x : nums) {
            heap.offer(x);
            if (heap.size() > k) heap.poll();
        }
        return heap.peek();
    }
}`,
        time: 'O(n log k)', space: 'O(k)',
        pitfalls: M`
          - A max-heap of all n elements, polled k times, is O(n + k log n). Also fine, but uses O(n) memory.
          - Quickselect with a fixed pivot (first or last element) is O(n²) on sorted or constant arrays. Randomize the pivot, and use three-way partitioning for duplicates.
        `,
        alts: [
          { name: 'Quickselect (3-way, random pivot)', time: 'O(n) average', space: 'O(1)', note: 'Partition around a random pivot into < | = | >, then recurse only into the side containing index n − k. It’s the classic "can you do better?" answer.',
            java: J`class Solution {
    public int findKthLargest(int[] nums, int k) {
        int target = nums.length - k;              // index in ascending order
        int lo = 0, hi = nums.length - 1;
        Random rnd = new Random(7);
        while (true) {
            int pivot = nums[lo + rnd.nextInt(hi - lo + 1)];
            int lt = lo, i = lo, gt = hi;          // Dutch-flag partition
            while (i <= gt) {
                if (nums[i] < pivot) swap(nums, lt++, i++);
                else if (nums[i] > pivot) swap(nums, i, gt--);
                else i++;
            }
            if (target < lt) hi = lt - 1;
            else if (target > gt) lo = gt + 1;
            else return pivot;
        }
    }
    private void swap(int[] a, int i, int j) { int t = a[i]; a[i] = a[j]; a[j] = t; }
}` },
          { name: 'Sort', time: 'O(n log n)', space: 'O(log n)', java: J`class Solution {
    public int findKthLargest(int[] nums, int k) {
        int[] a = nums.clone();
        Arrays.sort(a);
        return a[a.length - k];
    }
}` },
          { name: 'Counting (bounded values)', time: 'O(n + range)', space: 'O(range)', note: 'Values lie in [−10⁴, 10⁴], so count them and walk down from the top. It’s linear, and a great answer when the value range is small.' },
        ],
        followups: M`
          - **A stream of values, many queries:** keep the size-k heap (next problem).
          - **k-th smallest:** a max-heap of size k, or quickselect for index k − 1.
        `,
        talk: 'A min-heap of size k holds the k largest seen so far, and its root is the k-th largest. O(n log k), O(k) memory. Quickselect with a random pivot gives O(n) average if we can modify the array.',
      },
      viz: { id: 'topKHeap' },
      lc: [lc(215, 'kth-largest-element-in-an-array', 'Kth Largest Element in an Array', 'same'), lc(703, 'kth-largest-element-in-a-stream', 'Kth Largest Element in a Stream', 'variant'), lc(973, 'k-closest-points-to-origin', 'K Closest Points to Origin', 'similar'), lc(414, 'third-maximum-number', 'Third Maximum Number', 'easier')],
      drill: { prompt: 'Find the k-th largest value in an unsorted array faster than sorting.', pattern: 'heap-topk', why: 'Size-k min-heap (the root is the answer), or quickselect.' },
    } },

    { problem: {
      id: 'kth-largest-stream', title: 'k-th Largest in a Stream', diff: 'easy',
      tags: ['top-K', 'design'],
      statement: M`
        Design «KthLargest», which tracks the «k»-th largest score in a stream of scores:

        - «KthLargest(k, nums)» starts with the initial scores «nums».
        - «add(val)» adds a score and returns the current «k»-th largest score.

        It's guaranteed that at least «k» scores exist whenever «add» returns.
      `,
      design: { cls: 'KthLargest', ctor: [['int', 'k'], ['int[]', 'nums']], methods: { add: { params: [['int', 'val']], ret: 'int' } } },
      tests: [
        { ex: true, ops: ['KthLargest', 'add', 'add', 'add', 'add', 'add'], args: [[3, [4, 5, 8, 2]], [3], [5], [10], [9], [4]], expect: [null, 4, 5, 5, 8, 8] },
        { ops: ['KthLargest', 'add', 'add', 'add'], args: [[1, []], [-3], [-2], [-4]], expect: [null, -3, -2, -2] },
        { ops: ['KthLargest', 'add', 'add', 'add', 'add'], args: [[2, [0]], [-1], [1], [-2], [3]], expect: [null, -1, 0, 0, 1] },
        { ops: ['KthLargest', 'add', 'add'], args: [[3, [5, 5, 5]], [5], [1]], expect: [null, 5, 5] },
        { ops: ['KthLargest', ...Array(8000).fill('add')], args: [[100, Array.from({ length: 5000 }, (_, i) => ((i * 7919) % 20001) - 10000)], ...Array.from({ length: 8000 }, (_, i) => [((i * 104729) % 20001) - 10000])], big: true },
      ],
      constraints: ['1 ≤ k ≤ 10⁴', '0 ≤ nums.length ≤ 10⁴', 'At most 10⁴ calls to add'],
      hints: [
        'You never need the scores below the top k. Which ones do you need to keep?',
        'Keep exactly the k largest in a min-heap. Its root is the answer.',
        'On add: push, and if the size exceeds k, poll. Trim the initial array the same way.',
      ],
      solution: {
        pattern: '**Top-K over a stream:** a min-heap capped at size k answers "k-th largest so far" in O(1) after an O(log k) update.',
        intuition: 'A score that ever drops out of the top k can never return (scores only get added), so throw it away immediately. The heap holds exactly the top k, and the weakest of them is the k-th largest.',
        java: J`class KthLargest {
    private final int k;
    private final PriorityQueue<Integer> heap = new PriorityQueue<>();

    public KthLargest(int k, int[] nums) {
        this.k = k;
        for (int x : nums) add(x);
    }

    public int add(int val) {
        heap.offer(val);
        if (heap.size() > k) heap.poll();
        return heap.peek();
    }
}`,
        time: 'O(log k) per add', space: 'O(k)',
        pitfalls: M`
          - Keeping every score and sorting on each call is O(n log n) per add.
          - Calling «peek()» when fewer than k scores exist returns the minimum, not the k-th. The problem rules this out; mention it.
        `,
        alts: [
          { name: 'Sorted list with insertion', time: 'O(n) per add', space: 'O(n)', java: J`class KthLargest {
    private final int k;
    private final List<Integer> all = new ArrayList<>();
    public KthLargest(int k, int[] nums) { this.k = k; for (int x : nums) all.add(x); Collections.sort(all); }
    public int add(int val) {
        int pos = Collections.binarySearch(all, val);
        all.add(pos < 0 ? -pos - 1 : pos, val);
        return all.get(all.size() - k);
    }
}` },
        ],
        talk: 'A min-heap capped at size k: each add pushes and polls if it’s over k, and the root is the k-th largest. O(log k) per add, O(k) memory.',
      },
      lc: [lc(703, 'kth-largest-element-in-a-stream', 'Kth Largest Element in a Stream', 'same'), lc(215, 'kth-largest-element-in-an-array', 'Kth Largest Element in an Array', 'similar'), lc(1845, 'seat-reservation-manager', 'Seat Reservation Manager', 'similar')],
      drill: { prompt: 'After each new score arrives, report the k-th highest score so far.', pattern: 'heap-topk', why: 'A min-heap capped at k; its root is the answer.' },
    } },

    { problem: {
      id: 'last-stone-weight', title: 'Smash the Heaviest Stones', diff: 'easy',
      tags: ['max-heap', 'simulation'],
      statement: M`
        Each turn, take the two **heaviest** stones, with weights «x ≤ y», and smash them together. If «x == y», both are destroyed; otherwise the lighter one is destroyed and the heavier one becomes «y − x». Continue until at most one stone remains, and return its weight (or «0» if none remain).
      `,
      fn: { name: 'lastStoneWeight', params: [['int[]', 'stones']], ret: 'int' },
      tests: [
        { args: [[2, 7, 4, 1, 8, 1]], ex: true, expect: 1 },
        { args: [[1]], ex: true, expect: 1 },
        { args: [[3, 3]], expect: 0 },
        { args: [[10, 4]], expect: 6 },
        { args: [[2, 2, 2]], expect: 2 },
        { args: [[1, 3]], expect: 2 },
        { args: [{ $gen: 'ints', args: [30000, 1, 1000, 133] }], big: true },
      ],
      constraints: ['1 ≤ stones.length ≤ 3·10⁴ (LeetCode: 30)', '1 ≤ stones[i] ≤ 1000'],
      hints: [
        'Each turn needs the two largest of a collection that keeps changing.',
        'A max-heap gives the largest in O(log n), even as you insert new weights.',
        'Poll twice; if they differ, push the difference. Stop when the size is ≤ 1.',
      ],
      solution: {
        pattern: '**Heap simulation:** "repeatedly take the best, transform it, put it back".',
        intuition: 'The rules only ever touch the two heaviest stones, and they insert at most one new stone. A max-heap makes both operations O(log n).',
        java: J`class Solution {
    public int lastStoneWeight(int[] stones) {
        PriorityQueue<Integer> heap = new PriorityQueue<>(Collections.reverseOrder());
        for (int s : stones) heap.offer(s);
        while (heap.size() > 1) {
            int y = heap.poll(), x = heap.poll();
            if (y != x) heap.offer(y - x);
        }
        return heap.isEmpty() ? 0 : heap.peek();
    }
}`,
        time: 'O(n log n)', space: 'O(n)',
        alts: [
          { name: 'Re-sort every turn', time: 'O(n² log n)', space: 'O(n)', java: J`class Solution {
    public int lastStoneWeight(int[] stones) {
        List<Integer> s = new ArrayList<>();
        for (int x : stones) s.add(x);
        while (s.size() > 1) {
            Collections.sort(s);
            int y = s.remove(s.size() - 1), x = s.remove(s.size() - 1);
            if (y != x) s.add(y - x);
        }
        return s.isEmpty() ? 0 : s.get(0);
    }
}` },
          { name: 'Counting sort buckets', time: 'O(n + W)', space: 'O(W)', note: 'Weights are ≤ 1000, so bucket counts can simulate the max-heap by scanning down from the top.' },
        ],
        followups: M`
          - **Last Stone Weight II** (LeetCode 1049): any two stones, minimize the result. That's a partition/knapsack DP, not a heap!
        `,
        talk: 'A max-heap: poll the two largest, push the difference if non-zero, repeat. O(n log n).',
      },
      lc: [lc(1046, 'last-stone-weight', 'Last Stone Weight', 'same'), lc(2558, 'take-gifts-from-the-richest-pile', 'Take Gifts From the Richest Pile', 'similar'), lc(1049, 'last-stone-weight-ii', 'Last Stone Weight II', 'harder')],
      drill: { prompt: 'Repeatedly remove the two largest numbers and reinsert their difference.', pattern: 'heap-topk', why: 'Heap simulation: a max-heap gives the two largest in O(log n) each turn.' },
    } },

    { problem: {
      id: 'k-closest-points', title: 'k Closest Points to the Origin', diff: 'medium',
      tags: ['top-K', 'max-heap'],
      statement: M`
        Given points «[x, y]» on a plane and an integer «k», return the «k» points closest to the origin (Euclidean distance), in any order. The answer is unique: the k-th and (k+1)-th closest are never tied.
      `,
      fn: { name: 'kClosest', params: [['int[][]', 'points'], ['int', 'k']], ret: 'int[][]' },
      compare: 'unordered',
      tests: [
        { args: [[[1, 3], [-2, 2]], 1], ex: true, expect: [[-2, 2]], why: 'Distances² are 10 and 8.' },
        { args: [[[3, 3], [5, -1], [-2, 4]], 2], ex: true, expect: [[3, 3], [-2, 4]] },
        { args: [[[0, 1], [1, 0]], 2], expect: [[0, 1], [1, 0]] },
        { args: [[[5, 5]], 1], expect: [[5, 5]] },
        { args: [[[1, 1], [10000, 10000], [-2, 0], [3, 4]], 3], expect: [[1, 1], [-2, 0], [3, 4]] },
        { args: [[[-10000, 10000], [10000, -9999]], 1], expect: [[10000, -9999]], why: 'Squared distances reach 2·10⁸, which still fits in an int.' },
        { args: [POINTS, 500], big: true },
      ],
      constraints: ['1 ≤ k ≤ points.length ≤ 10⁴', '−10⁴ ≤ x, y ≤ 10⁴'],
      hints: [
        'Compare squared distances «x² + y²». No need for square roots.',
        'You want the k *smallest* distances. Which heap lets you evict the worst of your current candidates?',
        'A max-heap by distance of size k: push each point, and poll when the size exceeds k.',
      ],
      solution: {
        pattern: '**Top-K smallest with a max-heap of size k:** the mirror image of "k largest".',
        intuition: 'Keep the k best candidates so far. The one that should be evicted next is the farthest, so a max-heap by distance puts it on top, ready to compare with each newcomer.',
        java: J`class Solution {
    public int[][] kClosest(int[][] points, int k) {
        PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> Integer.compare(dist(b), dist(a))); // max-heap
        for (int[] p : points) {
            heap.offer(p);
            if (heap.size() > k) heap.poll();          // drop the farthest
        }
        return heap.toArray(new int[0][]);
    }

    private int dist(int[] p) { return p[0] * p[0] + p[1] * p[1]; }
}`,
        time: 'O(n log k)', space: 'O(k)',
        pitfalls: M`
          - A comparator written as «dist(b) − dist(a)» is safe here (values ≤ 2·10⁸), but «Integer.compare» is the habit that never overflows.
          - «Math.sqrt» is unnecessary and adds floating-point noise.
        `,
        alts: [
          { name: 'Sort by distance', time: 'O(n log n)', space: 'O(log n)', java: J`class Solution {
    public int[][] kClosest(int[][] points, int k) {
        int[][] p = points.clone();
        Arrays.sort(p, (a, b) -> Integer.compare(a[0] * a[0] + a[1] * a[1], b[0] * b[0] + b[1] * b[1]));
        return Arrays.copyOf(p, k);
    }
}` },
          { name: 'Quickselect on distance', time: 'O(n) average', space: 'O(1)', note: 'Partition the array so the k closest points come first. Fastest in memory, but it reorders the input.' },
        ],
        talk: 'Compare squared distances. A max-heap of size k holds the k closest so far; each new point pushes, and the farthest pops when the size exceeds k. O(n log k). Sorting is simpler at O(n log n); quickselect is O(n) average.',
      },
      lc: [lc(973, 'k-closest-points-to-origin', 'K Closest Points to Origin', 'same'), lc(658, 'find-k-closest-elements', 'Find K Closest Elements', 'variant'), lc(215, 'kth-largest-element-in-an-array', 'Kth Largest Element in an Array', 'similar')],
      drill: { prompt: 'Return the k points nearest the origin from a large list.', pattern: 'heap-topk', why: 'Top-K smallest: a size-k max-heap keyed by squared distance.' },
    } },

    { problem: {
      id: 'merge-k-lists', title: 'Merge k Sorted Lists', diff: 'hard',
      tags: ['K-way merge', 'heap'],
      statement: M`
        Given an array of «k» sorted linked lists, merge them into **one sorted list** and return its head.
      `,
      fn: { name: 'mergeKLists', params: [['ListNode[]', 'lists']], ret: 'ListNode' },
      tests: [
        { args: [[[1, 4, 5], [1, 3, 4], [2, 6]]], ex: true, expect: [1, 1, 2, 3, 4, 4, 5, 6] },
        { args: [[]], ex: true, expect: [] },
        { args: [[[]]], ex: true, expect: [] },
        { args: [[[], [1], []]], expect: [1] },
        { args: [[[5], [3], [4], [1], [2]]], expect: [1, 2, 3, 4, 5] },
        { args: [[[-3, 0, 9], [-3, 7], [1, 2, 3, 4, 5]]], expect: [-3, -3, 0, 1, 2, 3, 4, 5, 7, 9] },
        { args: [{ $gen: 'sortedLists', args: [1000, 50, -10000, 10000, 135] }], big: true },
        { args: [{ $gen: 'sortedLists', args: [4, 20000, -100000, 100000, 136] }], big: true },
      ],
      constraints: ['0 ≤ k ≤ 10⁴', '0 ≤ total nodes ≤ 10⁵', 'Each list is sorted'],
      hints: [
        'Merging lists one at a time into a growing result is O(k · N). Can you always pick the global minimum quickly?',
        'The next node in the output is the smallest of the k current heads. A min-heap of heads gives it in O(log k).',
        'Pop the smallest head, append it, and push its «next» if there is one. Use a dummy head for the output.',
      ],
      solution: {
        pattern: '**K-way merge:** a min-heap holding one current element per sorted source.',
        intuition: 'The smallest remaining node overall is always one of the k list heads. A heap over just those heads finds it in O(log k); after taking it, only that list’s head changes.',
        java: J`class Solution {
    public ListNode mergeKLists(ListNode[] lists) {
        PriorityQueue<ListNode> heap = new PriorityQueue<>((a, b) -> Integer.compare(a.val, b.val));
        for (ListNode head : lists) if (head != null) heap.offer(head);
        ListNode dummy = new ListNode(0), tail = dummy;
        while (!heap.isEmpty()) {
            ListNode n = heap.poll();
            tail.next = n;
            tail = n;
            if (n.next != null) heap.offer(n.next);
        }
        return dummy.next;
    }
}`,
        time: 'O(N log k)', space: 'O(k)',
        pitfalls: M`
          - Pushing null heads: «PriorityQueue» rejects null. Skip empty lists.
          - Comparator by subtraction: «a.val − b.val» overflows for extreme values. Use «Integer.compare».
        `,
        alts: [
          { name: 'Divide and conquer (pairwise merge)', time: 'O(N log k)', space: 'O(log k) recursion / O(1) iterative', note: 'Merge lists in pairs: (0,1), (2,3), …, then merge the results, for log k rounds of O(N) each. No heap needed.',
            java: J`class Solution {
    public ListNode mergeKLists(ListNode[] lists) {
        if (lists.length == 0) return null;
        for (int step = 1; step < lists.length; step *= 2)
            for (int i = 0; i + step < lists.length; i += 2 * step)
                lists[i] = merge(lists[i], lists[i + step]);
        return lists[0];
    }
    private ListNode merge(ListNode a, ListNode b) {
        ListNode d = new ListNode(0), t = d;
        while (a != null && b != null) { if (a.val <= b.val) { t.next = a; a = a.next; } else { t.next = b; b = b.next; } t = t.next; }
        t.next = a != null ? a : b;
        return d.next;
    }
}` },
          { name: 'Collect all values and sort', time: 'O(N log N)', space: 'O(N)', java: J`class Solution {
    public ListNode mergeKLists(ListNode[] lists) {
        List<Integer> vals = new ArrayList<>();
        for (ListNode l : lists) for (ListNode p = l; p != null; p = p.next) vals.add(p.val);
        Collections.sort(vals);
        ListNode d = new ListNode(0), t = d;
        for (int v : vals) { t.next = new ListNode(v); t = t.next; }
        return d.next;
    }
}` },
        ],
        followups: M`
          - **Smallest range covering all lists** (LeetCode 632): K-way merge while tracking the current max.
          - **External sort:** merging k sorted files that don't fit in memory is this algorithm.
        `,
        talk: 'A min-heap of the k list heads: pop the smallest, append it, push its successor. Each of the N nodes passes through a heap of size ≤ k: O(N log k). Pairwise divide-and-conquer merging has the same bound without a heap.',
      },
      viz: { id: 'kWayMerge' },
      lc: [lc(23, 'merge-k-sorted-lists', 'Merge k Sorted Lists', 'same'), lc(21, 'merge-two-sorted-lists', 'Merge Two Sorted Lists', 'easier'), lc(378, 'kth-smallest-element-in-a-sorted-matrix', 'Kth Smallest Element in a Sorted Matrix', 'similar'), lc(632, 'smallest-range-covering-elements-from-k-lists', 'Smallest Range Covering Elements from K Lists', 'harder')],
      drill: { prompt: 'Merge k individually sorted linked lists into one sorted list.', pattern: 'kway-merge', why: 'A min-heap of the current heads: pop the smallest, push its successor.' },
    } },

    { problem: {
      id: 'top-k-frequent-words', title: 'Top k Frequent Words', diff: 'medium',
      tags: ['top-K', 'comparator tie-break'],
      statement: M`
        Given a list of words and an integer «k», return the «k» most frequent words, sorted from **most to least frequent**. Words with the same frequency are sorted **alphabetically**.
      `,
      fn: { name: 'topKFrequent', params: [['String[]', 'words'], ['int', 'k']], ret: 'List<String>' },
      tests: [
        { args: [['i', 'love', 'leetcode', 'i', 'love', 'coding'], 2], ex: true, expect: ['i', 'love'], why: '“i” and “love” both appear twice; “i” comes first alphabetically.' },
        { args: [['the', 'day', 'is', 'sunny', 'the', 'the', 'the', 'sunny', 'is', 'is'], 4], ex: true, expect: ['the', 'is', 'sunny', 'day'] },
        { args: [['a'], 1], expect: ['a'] },
        { args: [['b', 'a', 'c'], 3], expect: ['a', 'b', 'c'] },
        { args: [['aaa', 'aa', 'a'], 1], expect: ['a'] },
        { args: [['x', 'y', 'x', 'y', 'z'], 2], expect: ['x', 'y'] },
        { args: [WORDS, 25], big: true },
      ],
      constraints: ['1 ≤ words.length ≤ 500 (large test: 12000)', 'k ≤ number of distinct words'],
      hints: [
        'Count with a HashMap first.',
        'You need an ordering: frequency descending, then word ascending. Write it as a single comparator.',
        'Size-k heap version: the heap must evict the *worst* word, the one with the lowest frequency or, on ties, the alphabetically **largest**. At the end, pop everything and reverse.',
      ],
      solution: {
        pattern: '**Top-K with a composite comparator:** the heap’s order is the *reverse* of the answer order, because the heap evicts the worst.',
        intuition: M`
          The output order is (frequency ↓, word ↑). A size-k min-heap needs its root to be the *worst* of the kept words: lowest frequency, and among equal frequencies the alphabetically **last** word. So the heap comparator is (frequency ↑, word ↓). Polling everything yields the kept words from worst to best, so reverse them.
        `,
        java: J`class Solution {
    public List<String> topKFrequent(String[] words, int k) {
        Map<String, Integer> count = new HashMap<>();
        for (String w : words) count.merge(w, 1, Integer::sum);

        PriorityQueue<String> heap = new PriorityQueue<>((a, b) -> {
            int fa = count.get(a), fb = count.get(b);
            return fa != fb ? Integer.compare(fa, fb) : b.compareTo(a);   // worst on top
        });
        for (String w : count.keySet()) {
            heap.offer(w);
            if (heap.size() > k) heap.poll();
        }
        List<String> res = new ArrayList<>();
        while (!heap.isEmpty()) res.add(heap.poll());
        Collections.reverse(res);
        return res;
    }
}`,
        time: 'O(n + m log k)', space: 'O(m)', timeWhy: 'm distinct words',
        pitfalls: M`
          - Getting the tie-break backwards in the heap. The heap evicts the worst, so equal-frequency words compare in *reverse* alphabetical order there.
          - Forgetting the final reverse.
          - Comparing «Integer» counts with «!=» on boxed values is buggy above 127; unbox with «int fa = …» as above.
        `,
        alts: [
          { name: 'Sort distinct words with the answer comparator', time: 'O(n + m log m)', space: 'O(m)', note: 'Simplest to get right: sort by (count desc, word asc) and take the first k.',
            java: J`class Solution {
    public List<String> topKFrequent(String[] words, int k) {
        Map<String, Integer> count = new HashMap<>();
        for (String w : words) count.merge(w, 1, Integer::sum);
        List<String> keys = new ArrayList<>(count.keySet());
        keys.sort((a, b) -> !count.get(a).equals(count.get(b)) ? Integer.compare(count.get(b), count.get(a)) : a.compareTo(b));
        return keys.subList(0, k);
    }
}` },
        ],
        talk: 'Count with a map, then keep a size-k heap whose root is the worst candidate: lowest count, and on ties the alphabetically largest word. Pop everything and reverse. O(n + m log k). Sorting all distinct words with the answer comparator is the simpler O(m log m) version.',
      },
      lc: [lc(692, 'top-k-frequent-words', 'Top K Frequent Words', 'same'), lc(347, 'top-k-frequent-elements', 'Top K Frequent Elements', 'easier'), lc(1636, 'sort-array-by-increasing-frequency', 'Sort Array by Increasing Frequency', 'similar')],
      drill: { prompt: 'k most common words, ordered by count and then alphabetically.', pattern: 'heap-topk', why: 'Count, then top-K with a comparator that breaks ties alphabetically (reversed inside the heap).' },
    } },

    { problem: {
      id: 'task-scheduler', title: 'CPU Task Scheduler', diff: 'medium',
      tags: ['greedy', 'max-heap', 'counting'],
      statement: M`
        A CPU runs tasks labelled with letters; each takes one time unit. Any two runs of the **same** task must be separated by at least «n» units, and the CPU may sit idle to satisfy that. Tasks can run in any order.

        Return the **minimum number of time units** needed to finish every task in «tasks».
      `,
      fn: { name: 'leastInterval', params: [['char[]', 'tasks'], ['int', 'n']], ret: 'int' },
      tests: [
        { args: [['A', 'A', 'A', 'B', 'B', 'B'], 2], ex: true, expect: 8, why: 'A B idle A B idle A B.' },
        { args: [['A', 'C', 'A', 'B', 'D', 'B'], 1], ex: true, expect: 6 },
        { args: [['A', 'A', 'A', 'B', 'B', 'B'], 3], ex: true, expect: 10 },
        { args: [['A'], 5], expect: 1 },
        { args: [['A', 'A', 'A', 'B', 'B', 'B'], 0], expect: 6 },
        { args: [['A', 'A', 'A', 'A', 'A', 'A', 'B', 'C', 'D', 'E', 'F', 'G'], 2], expect: 16 },
        { args: [['A', 'B', 'C', 'D', 'E', 'A', 'B', 'C', 'D', 'E'], 4], expect: 10 },
        { args: [{ $gen: 'str', args: [10000, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 137] }, 30], big: true },
        { args: [{ $gen: 'str', args: [10000, 'AAAAAAAABC', 138] }, 5], big: true },
      ],
      constraints: ['1 ≤ tasks.length ≤ 10⁴', 'tasks[i] is an uppercase letter', '0 ≤ n ≤ 100'],
      hints: [
        'The most frequent task is the bottleneck. How many "frames" does it force?',
        'If the max count is «f», you get «f − 1» full frames of length «n + 1», plus a final frame containing every task that has count «f».',
        'Answer = max(tasks.length, (f − 1)(n + 1) + (number of tasks with count f)). A greedy max-heap simulation reaches the same number.',
      ],
      solution: {
        pattern: '**Greedy by frequency.** Either reason directly with the "frames" formula, or simulate with a max-heap of remaining counts and a cooldown queue.',
        intuition: M`
          Lay out the most frequent task «A» (count «f») with gaps of «n»: «A _ _ A _ _ A». That creates «f − 1» frames of size «n + 1», plus the final A. Other tasks fill the gaps. Every task with the same max count adds one more slot at the end. If there are more tasks than gap slots, no idling is needed at all, and the answer is just the number of tasks.
        `,
        java: J`class Solution {
    public int leastInterval(char[] tasks, int n) {
        int[] count = new int[26];
        for (char c : tasks) count[c - 'A']++;
        int maxF = 0, numMax = 0;
        for (int c : count) {
            if (c > maxF) { maxF = c; numMax = 1; }
            else if (c == maxF) numMax++;
        }
        int frames = (maxF - 1) * (n + 1) + numMax;    // forced layout of the most frequent tasks
        return Math.max(tasks.length, frames);          // enough other tasks means no idling at all
    }
}`,
        time: 'O(N)', space: 'O(1)',
        why: 'Lower bounds: the answer is at least the number of tasks, and at least the frame bound, since the most frequent tasks need f − 1 gaps of n. The greedy layout achieves the larger of the two bounds, filling gaps round-robin by frequency.',
        pitfalls: M`
          - Forgetting the «max(tasks.length, …)» case: with many distinct tasks, the frames overflow and nothing idles.
          - «numMax» counts every task tied for the maximum, not just 1.
        `,
        alts: [
          { name: 'Simulation: max-heap + cooldown queue', time: 'O(T log 26)', space: 'O(26)', note: 'Each time unit, run the task with the most remaining; put it in a cooldown queue with its ready time, and return it to the heap when it’s ready. Straightforward to explain, and it generalizes when the formula doesn’t.',
            java: J`class Solution {
    public int leastInterval(char[] tasks, int n) {
        int[] count = new int[26];
        for (char c : tasks) count[c - 'A']++;
        PriorityQueue<Integer> heap = new PriorityQueue<>(Collections.reverseOrder());
        for (int c : count) if (c > 0) heap.offer(c);
        Deque<int[]> cooldown = new ArrayDeque<>();        // [remaining, readyTime]
        int time = 0;
        while (!heap.isEmpty() || !cooldown.isEmpty()) {
            time++;
            if (!heap.isEmpty()) {
                int left = heap.poll() - 1;
                if (left > 0) cooldown.offer(new int[]{left, time + n});
            }
            if (!cooldown.isEmpty() && cooldown.peek()[1] == time) heap.offer(cooldown.poll()[0]);
        }
        return time;
    }
}` },
        ],
        followups: M`
          - **Reorganize string** (LeetCode 767): n = 1, and output an arrangement. A greedy max-heap alternates the two most frequent characters.
          - **Rearrange string k distance apart** (LeetCode 358): the cooldown-queue simulation.
        `,
        talk: 'The most frequent task forces (f−1) frames of length n+1, plus one slot per task tied at the max. If there are enough other tasks, no idling is needed, so the answer is max(total tasks, that frame count). A max-heap plus cooldown simulation gives the same result.',
      },
      lc: [lc(621, 'task-scheduler', 'Task Scheduler', 'same'), lc(767, 'reorganize-string', 'Reorganize String', 'similar'), lc(358, 'rearrange-string-k-distance-apart', 'Rearrange String k Distance Apart', 'harder', { premium: true }), lc(1953, 'maximum-number-of-weeks-for-which-you-can-work', 'Maximum Number of Weeks for Which You Can Work', 'similar')],
      drill: { prompt: 'Minimum time to run tasks when identical tasks need a cooldown of n between runs.', pattern: 'greedy', why: 'Greedy on the most frequent task (a frame count formula, or a max-heap with a cooldown queue).' },
    } },

    { problem: {
      id: 'median-stream', title: 'Running Median', diff: 'hard',
      tags: ['two heaps', 'design'],
      statement: M`
        Design «MedianFinder»:

        - «addNum(num)» adds an integer from a data stream.
        - «findMedian()» returns the median of all numbers so far (the average of the two middle values when the count is even).

        «findMedian» is only called after at least one number has been added.
      `,
      design: { cls: 'MedianFinder', ctor: [], methods: { addNum: { params: [['int', 'num']], ret: 'void' }, findMedian: { params: [], ret: 'double' } } },
      tests: [
        { ex: true, ops: ['MedianFinder', 'addNum', 'addNum', 'findMedian', 'addNum', 'findMedian'], args: [[], [1], [2], [], [3], []], expect: [null, null, null, 1.5, null, 2.0] },
        { ops: ['MedianFinder', 'addNum', 'findMedian'], args: [[], [-7], []], expect: [null, null, -7.0] },
        { ops: ['MedianFinder', 'addNum', 'addNum', 'addNum', 'addNum', 'findMedian'], args: [[], [5], [5], [5], [5], []], expect: [null, null, null, null, null, 5.0] },
        { ops: ['MedianFinder', 'addNum', 'findMedian', 'addNum', 'findMedian', 'addNum', 'findMedian', 'addNum', 'findMedian'], args: [[], [6], [], [10], [], [2], [], [6], []], expect: [null, null, 6.0, null, 8.0, null, 6.0, null, 6.0] },
        { ops: ['MedianFinder', 'addNum', 'addNum', 'findMedian'], args: [[], [-100000], [100000], []], expect: [null, null, null, 0.0] },
        { ops: ['MedianFinder', ...Array.from({ length: 6000 }, (_, i) => (i % 3 === 2 ? 'findMedian' : 'addNum'))], args: [[], ...Array.from({ length: 6000 }, (_, i) => (i % 3 === 2 ? [] : [((i * 7919) % 200001) - 100000]))], big: true },
      ],
      constraints: ['−10⁵ ≤ num ≤ 10⁵', 'At most 5·10⁴ calls'],
      hints: [
        'Keeping a sorted list makes the median O(1), but inserting is O(n). What do you really need access to?',
        'Just the largest element of the lower half and the smallest of the upper half.',
        'A max-heap for the lower half and a min-heap for the upper half, with sizes equal or the lower one bigger by one. Rebalance after each add.',
      ],
      solution: {
        pattern: '**Two heaps:** a max-heap for the lower half and a min-heap for the upper half. The median is at the tops.',
        intuition: M`
          The median only depends on the elements at the boundary between the lower and upper halves. Keep each half in a heap facing that boundary (the lower half's max, the upper half's min). Route each new number through the lower heap into the upper heap, so the "all of low ≤ all of high" invariant holds, then move one back if the upper heap got bigger.
        `,
        java: J`class MedianFinder {
    private final PriorityQueue<Integer> low = new PriorityQueue<>(Collections.reverseOrder()); // max-heap
    private final PriorityQueue<Integer> high = new PriorityQueue<>();                          // min-heap

    public void addNum(int num) {
        low.offer(num);
        high.offer(low.poll());                  // the largest of the lower half moves up
        if (high.size() > low.size()) low.offer(high.poll());   // keep low.size() >= high.size()
    }

    public double findMedian() {
        if (low.size() > high.size()) return low.peek();
        return (low.peek() + (double) high.peek()) / 2.0;
    }
}`,
        time: 'addNum O(log n), findMedian O(1)', space: 'O(n)',
        pitfalls: M`
          - Integer overflow or truncation when averaging: add as «double».
          - Inserting directly into whichever heap "looks right" without the pass-through can break the ordering invariant. The low → high → (maybe) low routing always preserves it.
        `,
        alts: [
          { name: 'Sorted list with binary insertion', time: 'add O(n), median O(1)', space: 'O(n)', java: J`class MedianFinder {
    private final List<Integer> a = new ArrayList<>();
    public void addNum(int num) {
        int i = Collections.binarySearch(a, num);
        a.add(i < 0 ? -i - 1 : i, num);
    }
    public double findMedian() {
        int n = a.size();
        return n % 2 == 1 ? a.get(n / 2) : (a.get(n / 2 - 1) + (double) a.get(n / 2)) / 2.0;
    }
}` },
        ],
        followups: M`
          - **Values in 0..100 only:** a counting array gives O(1) add and O(100) median.
          - **Sliding window median** (LeetCode 480): two heaps with lazy deletion, or two TreeMaps as multisets.
          - **99% of values in 0..100:** counts, plus overflow counters or heaps for the rare outliers.
        `,
        talk: 'Two heaps: a max-heap for the lower half and a min-heap for the upper half. Each number goes into low, low’s max moves to high, and if high gets bigger its min moves back. The median is low’s top, or the average of both tops. O(log n) add, O(1) median.',
      },
      viz: { id: 'twoHeapsMedian' },
      lc: [lc(295, 'find-median-from-data-stream', 'Find Median from Data Stream', 'same'), lc(480, 'sliding-window-median', 'Sliding Window Median', 'harder'), lc(502, 'ipo', 'IPO', 'similar'), lc(4, 'median-of-two-sorted-arrays', 'Median of Two Sorted Arrays', 'harder')],
      drill: { prompt: 'Support adding numbers from a stream and reporting the current median quickly.', pattern: 'two-heaps', why: 'A max-heap for the lower half and a min-heap for the upper half, kept balanced.' },
    } },

    { problem: {
      id: 'ipo', title: 'Maximize Capital (IPO)', diff: 'hard',
      tags: ['two heaps', 'greedy'],
      statement: M`
        You start with capital «w» and may complete at most «k» distinct projects. Project «i» requires «capital[i]» to start (it isn't consumed) and adds «profits[i]» to your capital when done. Projects are completed one after another.

        Return the **maximum capital** you can reach.
      `,
      fn: { name: 'findMaximizedCapital', params: [['int', 'k'], ['int', 'w'], ['int[]', 'profits'], ['int[]', 'capital']], ret: 'int' },
      tests: [
        { args: [2, 0, [1, 2, 3], [0, 1, 1]], ex: true, expect: 4, why: 'Do project 0 (capital becomes 1), then project 2 (capital 4).' },
        { args: [3, 0, [1, 2, 3], [0, 1, 2]], ex: true, expect: 6 },
        { args: [1, 0, [1, 2, 3], [1, 1, 2]], expect: 0, why: 'Nothing is affordable.' },
        { args: [5, 10, [1, 2], [0, 0]], expect: 13 },
        { args: [1, 2, [1, 2, 3], [1, 1, 2]], expect: 5 },
        { args: [2, 1, [5, 1, 10], [2, 0, 3]], expect: 7, why: 'Only project 1 is affordable at first; then project 0 (capital 2) is.' },
        { args: [10, 0, { $gen: 'ints', args: [100000, 0, 10000, 139] }, { $gen: 'ints', args: [100000, 0, 50000, 140] }], big: true },
        { args: [100000, 1, { $gen: 'ints', args: [100000, 0, 1000, 141] }, { $gen: 'range', args: [100000, 0, 1] }], big: true },
      ],
      constraints: ['1 ≤ k ≤ 10⁵', '0 ≤ w ≤ 10⁹', '1 ≤ n ≤ 10⁵', '0 ≤ profits[i] ≤ 10⁴', '0 ≤ capital[i] ≤ 10⁹', 'The answer fits in an int'],
      hints: [
        'Among the projects you can currently afford, which one should you do next?',
        'The most profitable one: profit only increases capital, which can only unlock more projects. Greedy is safe.',
        'Sort projects by required capital. As capital grows, move newly affordable projects into a max-heap by profit; take the top k times.',
      ],
      solution: {
        pattern: '**Two heaps with different keys (greedy unlocking):** a pointer over projects sorted by cost feeds a max-heap of profits as they become affordable.',
        intuition: M`
          Doing the most profitable affordable project is never worse: it leaves you with the most capital, which unlocks a superset of projects. So repeatedly (1) unlock every project whose cost ≤ current capital, and (2) take the best profit among the unlocked. Sorting by cost makes unlocking a moving pointer, and a max-heap makes "best among unlocked" O(log n).
        `,
        java: J`class Solution {
    public int findMaximizedCapital(int k, int w, int[] profits, int[] capital) {
        int n = profits.length;
        Integer[] idx = new Integer[n];
        for (int i = 0; i < n; i++) idx[i] = i;
        Arrays.sort(idx, (a, b) -> Integer.compare(capital[a], capital[b]));   // by cost

        PriorityQueue<Integer> best = new PriorityQueue<>(Collections.reverseOrder()); // affordable profits
        int p = 0;
        for (int round = 0; round < k; round++) {
            while (p < n && capital[idx[p]] <= w) best.offer(profits[idx[p++]]);    // unlock
            if (best.isEmpty()) break;                                           // stuck
            w += best.poll();
        }
        return w;
    }
}`,
        time: 'O(n log n + k log n)', space: 'O(n)',
        pitfalls: M`
          - Re-scanning all projects each round is O(k · n). Sort once and keep a pointer.
          - Stop early when nothing is affordable, since the heap would be empty.
        `,
        alts: [
          { name: 'Scan all projects each round', time: 'O(k · n)', space: 'O(n)', note: 'Pick the best affordable, unused project by linear scan each round. Correct, but too slow for large k and n.',
            java: J`class Solution {
    public int findMaximizedCapital(int k, int w, int[] profits, int[] capital) {
        boolean[] used = new boolean[profits.length];
        for (int r = 0; r < k; r++) {
            int bi = -1;
            for (int i = 0; i < profits.length; i++) if (!used[i] && capital[i] <= w && (bi == -1 || profits[i] > profits[bi])) bi = i;
            if (bi == -1) break;
            used[bi] = true; w += profits[bi];
        }
        return w;
    }
}` },
        ],
        talk: 'Greedy: always take the most profitable affordable project. I sort projects by required capital and, as capital grows, push newly affordable profits into a max-heap, polling the best k times. O((n + k) log n).',
      },
      lc: [lc(502, 'ipo', 'IPO', 'same'), lc(1834, 'single-threaded-cpu', 'Single-Threaded CPU', 'similar'), lc(871, 'minimum-number-of-refueling-stops', 'Minimum Number of Refueling Stops', 'similar'), lc(630, 'course-schedule-iii', 'Course Schedule III', 'harder')],
      drill: { prompt: 'With starting capital w, pick up to k projects (cost threshold, profit) to maximize final capital.', pattern: 'two-heaps', why: 'Greedy: unlock projects by cost (sorted pointer) into a max-heap of profits; take the best each round.' },
    } },
  ],
});
})();

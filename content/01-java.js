(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

DSA.module({
  id: 'java', title: 'Java Collections, Under the Hood', short: 'Java internals',
  blurb: 'What ArrayList, HashMap, TreeMap, ArrayDeque, PriorityQueue and String actually do inside, what each operation costs, and the idioms and traps that matter in interviews.',
  intro: M`
    Interviewers expect you to pick the right collection without hesitating and to justify the cost of every call. "How does HashMap work?" also comes up as a question in its own right. This module opens up each structure: its fields, what happens on insert and growth, and why each operation costs what it does. Then you build smaller versions yourself.

    Keep the **Java collections** cheat sheet open alongside: it has the "which collection?" flowchart and a one-page cost table.
  `,
  more: [
    lc(706, 'design-hashmap', 'Design HashMap', 'same'),
    lc(705, 'design-hashset', 'Design HashSet', 'variant'),
    lc(641, 'design-circular-deque', 'Design Circular Deque', 'same'),
    lc(622, 'design-circular-queue', 'Design Circular Queue', 'variant'),
    lc(380, 'insert-delete-getrandom-o1', 'Insert Delete GetRandom O(1)', 'harder'),
    lc(981, 'time-based-key-value-store', 'Time Based Key-Value Store', 'similar'),
    lc(220, 'contains-duplicate-iii', 'Contains Duplicate III', 'harder'),
    lc(732, 'my-calendar-iii', 'My Calendar III', 'harder'),
  ],
  items: [
    /* ───────────────────────── Lesson: toolkit ───────────────────────── */
    { lesson: 'java-toolkit', title: 'The Java interview toolkit', mins: 14,
      lede: 'The syntax, idioms and traps that come up in almost every Java interview solution, in one place.',
      body: M`
        ## Declare by interface, construct by class
        ~~~java
        List<Integer> list = new ArrayList<>();
        Map<String, Integer> count = new HashMap<>();
        Set<Integer> seen = new HashSet<>();
        Deque<Integer> stack = new ArrayDeque<>();     // stack AND queue
        Queue<int[]> queue = new ArrayDeque<>();
        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));
        TreeMap<Integer, Integer> sorted = new TreeMap<>(); // keep the class type to use floorKey etc.
        ~~~

        ## Arrays
        ~~~java
        int[] a = new int[n];                 // zero-filled (boolean: false, objects: null)
        int[][] grid = new int[rows][cols];
        Arrays.fill(a, -1);                   // 1-D only; for 2-D fill each row
        int[] copy = a.clone();               // or Arrays.copyOf(a, len), Arrays.copyOfRange(a, from, to)
        Arrays.sort(a);                       // primitives: dual-pivot quicksort, ascending only
        Arrays.sort(a, 2, 5);                 // sort a[2..4]
        Arrays.sort(intervals, (x, y) -> Integer.compare(x[0], y[0]));  // int[][]: objects, comparator OK
        System.out.println(Arrays.toString(a));       // debugging; deepToString for 2-D
        int sum = Arrays.stream(a).sum();             // .max().getAsInt(), .min(), .average()
        ~~~

        :::warn Arrays.asList traps
        - «Arrays.asList(1, 2, 3)» is a **fixed-size view**: «set» works, but «add»/«remove» throw «UnsupportedOperationException». Wrap it, «new ArrayList<>(Arrays.asList(...))», when you need to grow it.
        - «Arrays.asList(intArray)» gives a «List<int[]>» with **one** element. Primitive arrays don't autobox. Use «Arrays.stream(a).boxed().toList()».
        - «List.of(...)» is fully immutable and rejects nulls.
        :::

        ## Strings and chars
        ~~~java
        char c = s.charAt(i);                 // O(1)
        char[] cs = s.toCharArray();          // O(n) copy; mutate it, then new String(cs)
        int idx = c - 'a';                    // letter → 0..25
        char next = (char) ('a' + idx);       // back (the cast is required)
        boolean same = s.equals(t);           // NEVER s == t
        String sub = s.substring(i, j);       // [i, j), O(j − i) copy
        String[] parts = s.trim().split("\\s+");
        String joined = String.join(",", parts);
        Character.isDigit(c); Character.isLetter(c); Character.isLetterOrDigit(c);
        Character.toLowerCase(c); Character.getNumericValue('7');   // 7; or c - '0'
        StringBuilder sb = new StringBuilder();
        sb.append(x).append(','); sb.insert(0, 'y'); sb.setCharAt(0, 'z');
        sb.deleteCharAt(sb.length() - 1); sb.reverse(); String out = sb.toString();
        ~~~

        ## Numbers: overflow, division, sentinels
        - «int» is 32-bit and wraps silently: «Integer.MAX_VALUE + 1 == Integer.MIN_VALUE». Sums of products, or of 10⁵ values up to 10⁹, need «long». Write «long x = (long) a * b», not «(long) (a * b)», which overflows first and widens after.
        - Midpoints: «lo + (hi - lo) / 2», or «(lo + hi) >>> 1». «(lo + hi) / 2» can overflow.
        - Integer division truncates toward zero: «-7 / 2 == -3». «%» keeps the sign of the dividend: «-7 % 3 == -1». Use «Math.floorMod(-7, 3) == 2» when you need a non-negative result.
        - Sentinels: «Integer.MAX_VALUE» is a good "infinity" until you add to it. «dist + w» overflows to a negative number. Guard it, or use a smaller infinity like «1_000_000_000».
        - Modular arithmetic: take «% MOD» after every addition and multiplication, in «long».

        :::warn Integer caching: the "== works in my tests" bug
        «Integer a = 127, b = 127; a == b» is «true» because «Integer.valueOf» caches −128…127. With 128 it is «false»: two different objects. Comparing «map.get(x) == map.get(y)» therefore passes small tests and fails large ones. Unbox to «int», or use «.equals».
        :::

        ## Map idioms: one lookup instead of two
        ~~~java
        count.merge(key, 1, Integer::sum);                    // count occurrences
        count.put(key, count.getOrDefault(key, 0) + 1);       // same, older style
        graph.computeIfAbsent(u, k -> new ArrayList<>()).add(v); // multimap: key → list
        seen.putIfAbsent(key, i);                             // first index only
        for (Map.Entry<String, Integer> e : count.entrySet()) { e.getKey(); e.getValue(); }
        count.entrySet().removeIf(e -> e.getValue() == 0);
        ~~~

        ## Comparators without bugs
        ~~~java
        (a, b) -> Integer.compare(a[0], b[0])              // not a[0] - b[0]: overflows for big or negative values
        Comparator.comparingInt((int[] x) -> x[0]).thenComparingInt(x -> x[1])
        Comparator.comparing(Person::name).reversed()
        new PriorityQueue<>(Collections.reverseOrder())     // max-heap of Integer
        list.sort(null);                                    // natural order
        ~~~

        ## Converting between shapes
        | From → To | Code |
        |---|---|
        | «int[]» → «List<Integer>» | «Arrays.stream(a).boxed().collect(Collectors.toList())» |
        | «List<Integer>» → «int[]» | «list.stream().mapToInt(Integer::intValue).toArray()» |
        | «List<int[]>» → «int[][]» | «list.toArray(new int[0][])» |
        | «Set<Integer>» → «List<Integer>» | «new ArrayList<>(set)» |
        | «char[]» → «String» | «new String(cs)», «String.valueOf(cs)» |
        | «String» → «int» | «Integer.parseInt(s)»; digit: «s.charAt(i) - '0'» |
        | «int» → «String» | «String.valueOf(x)», «Integer.toString(x)», «"" + x» |
        | «int» → binary | «Integer.toBinaryString(x)», «Integer.bitCount(x)» |

        ## Recursion
        Java has no tail-call optimization. The default thread stack holds roughly 10–20 thousand frames, and in-browser Java here holds about 5 thousand. Depth equal to the input size (a 10⁵-node linked list, a skewed tree) can throw «StackOverflowError». Say so in the interview, and know the iterative version with an explicit «ArrayDeque».

        @quiz 0
        @quiz 1
        @quiz 2
      `,
      quiz: [
        { q: '«Map<Integer,Integer> m» holds counts. Which check is a latent bug?',
          options: ['«m.get(a).equals(m.get(b))»', '«m.get(a) == m.get(b)»', '«m.get(a).intValue() == m.get(b).intValue()»', '«(int) m.get(a) == (int) m.get(b)»'],
          answer: 1, why: '«==» on two «Integer» objects compares references. It happens to work for values −128…127 because of the Integer cache, then silently fails for larger counts.' },
        { q: 'Which comparator is safe for sorting «int[]» pairs by their first element when values range over the full «int» range?',
          options: ['«(a, b) -> a[0] - b[0]»', '«(a, b) -> Integer.compare(a[0], b[0])»', '«(a, b) -> a[0] < b[0] ? 1 : -1»', 'All of the above'],
          answer: 1, why: 'Subtraction overflows: «Integer.MIN_VALUE - 1» wraps to a large positive number. The third option never returns 0 and breaks the comparator contract, which can make TimSort throw.' },
        { q: '«List<Integer> list = new ArrayList<>(List.of(5, 1, 7)); list.remove(1);» What does the list contain?',
          options: ['[5, 7]', '[5, 1, 7]', '[1, 7]', 'It throws'],
          answer: 0, why: '«remove(int index)» wins overload resolution over «remove(Object)», so it removes index 1 (the value 1 happens to be there). To remove the *value* 7, call «list.remove(Integer.valueOf(7))».' },
      ],
    },

    /* ───────────────────────── Lesson: ArrayList / LinkedList ───────────────────────── */
    { lesson: 'arraylist-internals', title: 'ArrayList and LinkedList, inside', mins: 10,
      lede: 'A growable array versus a chain of nodes. Why amortized O(1) is real, why LinkedList almost never wins, and fail-fast iterators.',
      body: M`
        ## ArrayList is a resizable Object[]
        ~~~java
        // java.util.ArrayList (JDK 21), the fields that matter
        transient Object[] elementData;   // the backing array; its length is the *capacity*
        private int size;                 // how many slots are actually used
        ~~~
        A new «ArrayList» shares an empty placeholder array. The first «add» allocates 10 slots. When the array is full, «grow()» allocates a new array **1.5× as large** («old + (old >> 1)») and copies everything with «System.arraycopy».

        @viz arrayListGrowth

        ### Why add() is amortized O(1)
        Growing by a constant *factor* means n adds cause copies of about n + n/1.5 + n/1.5² + … ≤ 3n elements in total: a constant number of copies per add. Growing by a constant *amount* (say +10 each time) would make the total quadratic. This geometric-growth argument is the canonical example of amortized analysis, and interviewers love it.

        | Operation | Cost | Why |
        |---|---|---|
        | «get(i)», «set(i, x)» | O(1) | array indexing |
        | «add(x)» (at the end) | O(1) amortized | occasional O(n) copy on growth |
        | «add(i, x)», «remove(i)» | O(n − i) | shifts the tail with «System.arraycopy» |
        | «remove(size() − 1)» | O(1) | nothing to shift; this is how to use a list as a stack |
        | «contains(x)», «indexOf(x)», «remove(Object)» | O(n) | linear scan using «equals» |
        | «Collections.sort(list)» | O(n log n) | copies to an array, TimSort, writes back |

        :::java Boxing cost
        «ArrayList<Integer>» stores **references** to «Integer» objects: about 16 bytes of object plus a 4–8 byte reference per element, compared with 4 bytes in an «int[]». When the size is known, or you're doing heavy numeric work, prefer «int[]». When the size varies, «ArrayList» is fine. Just know what it costs.
        :::

        ## LinkedList is a doubly linked chain
        ~~~java
        private static class Node<E> { E item; Node<E> next; Node<E> prev; }
        transient Node<E> first, last;
        ~~~
        - «addFirst/addLast/removeFirst/removeLast» are O(1): just pointer updates.
        - «get(i)» walks from whichever end is closer: **O(n)**. So «for (int i = 0; i < list.size(); i++) list.get(i)» is O(n²).
        - Removing through an «Iterator» is O(1) once you're there. Finding the spot is O(n).
        - Each element costs a 24–32 byte node object, and nodes are scattered in memory, so the CPU cache misses constantly.

        :::key Interview rule of thumb
        Use «ArrayList» for lists and «ArrayDeque» for stacks and queues. Choose «LinkedList» only when you need to hold an iterator and insert or delete in the middle repeatedly, which is rare. For "O(1) remove from the middle" (an LRU cache), you'll build your own node class so you can keep references to nodes in a map.
        :::

        ## Fail-fast iterators
        Every structural change bumps an internal «modCount». An iterator remembers the count it started with and throws «ConcurrentModificationException» when it changes. This is the usual cause of that exception:
        ~~~java
        for (Integer x : list) if (x % 2 == 0) list.remove(x);   // throws
        list.removeIf(x -> x % 2 == 0);                          // correct, O(n)
        Iterator<Integer> it = list.iterator();
        while (it.hasNext()) if (it.next() % 2 == 0) it.remove(); // also correct
        ~~~
        The same applies to «HashMap» key sets: collect the keys to delete first, or use «entrySet().removeIf(...)».

        ?? Why does ArrayList grow by 1.5× instead of 2×?
        Both give amortized O(1). 1.5× wastes less memory: at most a third of the capacity sits unused, versus half. It also lets freed old blocks be reused sooner by some allocators. «ArrayDeque», «StringBuilder» and C++ «std::vector» often use 2×.

        ?? What is the difference between size and capacity?
        Size is the number of elements; capacity is the length of the backing array. «new ArrayList<>(1000)» sets capacity (no elements yet), so «get(0)» still throws. «ensureCapacity(n)» pre-sizes to avoid repeated growth; «trimToSize()» releases the slack.

        ?? Is ArrayList thread-safe?
        No. Concurrent writes can corrupt it or throw. Use «Collections.synchronizedList», or «CopyOnWriteArrayList» for read-heavy data. «Vector» is the legacy synchronized version, avoided today.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'You call «list.add(0, x)» n times on an ArrayList. Total cost?',
          options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(1) each, so O(n)'],
          answer: 2, why: 'Inserting at the front shifts every existing element: 0 + 1 + … + (n−1) = O(n²). Use «ArrayDeque.addFirst» (O(1)), or add at the end and reverse once.' },
        { q: 'Why is «LinkedList.get(i)» inside an index loop a trap?',
          options: ['It throws for large i', 'Each get walks the chain, so the loop is O(n²)', 'It returns a copy', 'It isn’t fail-fast'],
          answer: 1, why: 'There is no index table. «get(i)» walks from the nearer end, O(n) each time. Iterate with for-each or an iterator instead.' },
      ],
    },

    /* ───────────────────────── Lesson: HashMap ───────────────────────── */
    { lesson: 'hashmap-internals', title: 'HashMap, inside', mins: 14,
      lede: 'Buckets, hash spreading, collisions, resizing and treeification: the answer to the most-asked Java internals question.',
      body: M`
        ## The data structure
        ~~~java
        // java.util.HashMap (JDK 8+), simplified
        transient Node<K,V>[] table;      // the buckets; length is always a power of two
        transient int size;
        int threshold;                    // resize when size > threshold (= capacity × loadFactor)
        final float loadFactor;           // default 0.75

        static class Node<K,V> { final int hash; final K key; V value; Node<K,V> next; }
        ~~~
        The table is allocated lazily on the first «put», with **16** buckets by default. Each bucket is a singly linked chain of «Node»s (or a red-black tree; see below).

        ## put(key, value) step by step
        1. **Hash.** «h = key.hashCode(); hash = h ^ (h >>> 16)». The XOR folds the high 16 bits into the low 16, because the next step only looks at the low bits. A «null» key hashes to 0 (HashMap allows one null key; «Hashtable» and «ConcurrentHashMap» don't).
        2. **Index.** «i = (table.length - 1) & hash». Since the length is a power of two, this bitmask equals «hash mod length», without a slow division.
        3. **Search the chain.** For each node in bucket «i»: if «node.hash == hash && (node.key == key || key.equals(node.key))», replace the value and return the old one.
        4. **Append** a new node at the tail of the chain (JDK 7 prepended at the head, which could create cycles under concurrent resizing).
        5. **Treeify** if the chain now has 8 or more nodes: convert it to a red-black tree, but only when the table has at least 64 buckets. A smaller table just resizes instead.
        6. **Resize** if «++size > threshold».

        @viz hashMapInsert

        ## Resizing without rehashing
        Resize doubles the table. Because capacities are powers of two, each node's new index is either its **old index** or **old index + oldCapacity**, decided by one bit of the stored hash: «hash & oldCap». Each chain splits into a "lo" and a "hi" list, both keeping their order, with no «hashCode()» calls. Resizing is O(n), but like «ArrayList» growth it's amortized O(1) per insert.

        :::java Pre-size when you know n
        «new HashMap<>(n)» sets the *capacity* (rounded up to a power of two), not the number of entries it holds before resizing. To hold n entries with no resize, ask for «(int) (n / 0.75f) + 1», or use «HashMap.newHashMap(n)» (JDK 19+). In interviews this rarely matters, but it's a good detail to mention.
        :::

        ## Costs
        | Operation | Average | Worst case |
        |---|---|---|
        | «get», «put», «containsKey», «remove» | O(1) | O(log n) with a treeified bucket; O(n) for non-Comparable keys that all collide |
        | iterate all entries | O(capacity + n) | it walks every bucket, empty ones too |
        | «containsValue» | O(n) | no index on values |

        **Why worst case O(log n)?** Before Java 8, an attacker who knew your hash function could send keys that all collided, turning every lookup into an O(n) chain walk (hash-flooding DoS). A treeified bucket keeps even that case at O(log n), as long as the keys are «Comparable», like «String» and «Integer».

        ## The equals/hashCode contract
        - If «a.equals(b)», then «a.hashCode() == b.hashCode()». Break this and «get» searches the wrong bucket and misses keys that are there.
        - Equal hash codes don't imply equal objects. That's just a collision, and it's fine.
        - **Never mutate a key** after inserting it. Its bucket was chosen by its old hash, so it becomes unreachable.

        :::warn Keys that silently don't work
        - «int[]», and arrays in general: arrays use *identity* «equals»/«hashCode», so «map.get(new int[]{1,2})» never finds the array you stored. Use «List.of(1, 2)», «Arrays.toString(arr)», a «record Point(int r, int c)», or encode the pair as a «long»: «(long) r << 32 | c».
        - Your own class without «equals»/«hashCode» overrides: same identity problem. Records generate both for you.
        :::

        ## Iteration order
        A «HashMap» iterates in bucket order, which looks random and can change after a resize. Never rely on it. «LinkedHashMap» keeps insertion (or access) order, and «TreeMap» keeps key order.

        ## HashSet
        «HashSet<E>» is a «HashMap<E, Object>» where every value is the same dummy object («PRESENT»). Every fact above applies to it.

        ?? Why is the capacity always a power of two?
        So the bucket index is a cheap bitmask, «hash & (n − 1)», instead of a modulo, and so that resizing splits each bucket cleanly into i and i + oldCap. The cost is that only the low bits pick the bucket, which is why the high bits get XOR-folded in first.

        ?? What happens on a collision?
        Both entries live in the same bucket's chain, and lookups compare hashes, then «equals», along the chain. A chain of 8+ in a table of 64+ buckets becomes a red-black tree (O(log n) search). It turns back into a list when it shrinks to 6 or fewer during a resize.

        ?? Why load factor 0.75?
        It trades memory for speed. A lower factor means fewer collisions but more empty buckets; a higher one saves memory but lengthens chains. With a decent hash, 0.75 keeps the expected chain length well under 1.

        ?? HashMap vs Hashtable vs ConcurrentHashMap?
        Hashtable is legacy: every method synchronized, and no nulls. ConcurrentHashMap is the modern thread-safe map: lock-free reads, fine-grained locking on writes, no nulls, and atomic «compute»/«merge». HashMap isn't thread-safe at all.

        @quiz 0
        @quiz 1
        @quiz 2
      `,
      quiz: [
        { q: 'A HashMap has 16 buckets. The spread hash of a key ends in binary …10110. Which bucket does it go to?',
          options: ['6', '22', '16', '2'],
          answer: 0, why: 'index = hash & (16 − 1) = hash & 0b1111, which keeps the low 4 bits: 0110 = **6**.' },
        { q: 'Resizing from 16 to 32 buckets: the entry in bucket 5 has hash bit 16 (value 0b10000) set. Where does it go?',
          options: ['Stays in 5', 'Moves to 21', 'Moves to 10', 'Rehashed from scratch'],
          answer: 1, why: 'When «hash & oldCap» is non-zero, the node moves to index + oldCap = 5 + 16 = **21**. No hashCode() call is needed.' },
        { q: 'You use «Map<int[], Integer>» to memoize results keyed by (row, col). What happens?',
          options: ['Works, but slowly', 'Lookups with a new array never hit, because arrays use identity equals/hashCode', 'Compile error', 'Throws at runtime'],
          answer: 1, why: 'Arrays inherit «Object.equals»/«hashCode» (identity). Use a record, a «List», a String key, or pack the pair into a long.' },
      ],
    },

    /* ───────────────────────── Lesson: TreeMap ───────────────────────── */
    { lesson: 'treemap-internals', title: 'TreeMap and TreeSet, inside', mins: 11,
      lede: 'A red-black tree gives O(log n) sorted operations, plus floor/ceiling queries that no hash table can answer.',
      body: M`
        ## A self-balancing binary search tree
        ~~~java
        // java.util.TreeMap
        private transient Entry<K,V> root;
        static final class Entry<K,V> { K key; V value; Entry<K,V> left, right, parent; boolean color = BLACK; }
        ~~~
        Keys are ordered by their «Comparable» natural order, or by the «Comparator» you pass to the constructor. A plain BST degrades to a linked list when keys arrive sorted. A **red-black tree** stays balanced by enforcing:

        1. Every node is red or black, and the root is black.
        2. A red node never has a red child.
        3. Every path from a node down to a null has the same number of black nodes.

        Together these guarantee height ≤ 2·log₂(n+1). After a normal BST insert, the new red node may break rule 2, and a few **recolorings and at most two rotations** restore it.

        @viz rbInsert

        ## Costs
        | Operation | Cost |
        |---|---|
        | «get», «put», «remove», «containsKey» | O(log n) |
        | «firstKey», «lastKey», «pollFirstEntry», «pollLastEntry» | O(log n) |
        | «floorKey(k)» (≤ k), «ceilingKey(k)» (≥ k), «lowerKey» (<), «higherKey» (>) | O(log n) |
        | «headMap», «tailMap», «subMap» (views) | O(log n) to create, then live views of the tree |
        | iterate all entries in order | O(n) |

        ## The navigation API: TreeMap's superpower
        ~~~java
        TreeMap<Integer, String> m = new TreeMap<>(Map.of(10, "a", 20, "b", 30, "c"));
        m.floorKey(25);      // 20    greatest key ≤ 25
        m.ceilingKey(25);    // 30    smallest key ≥ 25
        m.lowerKey(20);      // 10    strictly less
        m.higherKey(30);     // null  nothing greater
        m.firstEntry();      // 10=a  (also lastEntry, pollFirstEntry)
        m.headMap(20);       // {10=a}        keys < 20 (headMap(20, true) includes 20)
        m.tailMap(20);       // {20=b, 30=c}  keys ≥ 20
        m.descendingMap();   // {30=c, 20=b, 10=a}
        ~~~
        «TreeSet» offers the same calls without values: «floor», «ceiling», «lower», «higher», «first», «pollFirst». When a problem needs "the closest value to x", "the next free slot", or "the booking just before this time", think TreeMap. Nothing else in the standard library answers those in O(log n).

        :::warn Equality comes from the comparator
        A TreeMap/TreeSet decides two keys are the *same key* when «compare(a, b) == 0». It never calls «equals». Put «Person("Ann", 30)» and «Person("Bob", 30)» into a «TreeSet» ordered by age only, and Bob silently disappears. Add a tie-breaker («thenComparing(Person::name)»), or count duplicates with «TreeMap<K, Integer>»:
        ~~~java
        TreeMap<Integer, Integer> multiset = new TreeMap<>();
        multiset.merge(x, 1, Integer::sum);                              // add x
        if (multiset.merge(x, -1, Integer::sum) == 0) multiset.remove(x); // remove one x
        int smallest = multiset.firstKey();
        ~~~
        Java has no built-in sorted multiset, so this idiom shows up in sliding-window-median and scheduling problems.
        :::

        ## TreeMap vs HashMap vs PriorityQueue
        | Need | Use |
        |---|---|
        | Fast lookup by exact key | «HashMap»: O(1) |
        | Keys in sorted order, or nearest-key queries | «TreeMap»: O(log n) |
        | Only the min (or max), repeatedly | «PriorityQueue»: O(1) peek, O(log n) poll, lower constants |
        | Min *and* max, or delete arbitrary elements | «TreeMap» with counts (a PQ's «remove(x)» is O(n)) |

        ?? Why a red-black tree and not an AVL tree?
        AVL trees are more strictly balanced, so lookups are slightly faster, but inserts and deletes rotate more. Red-black trees need at most two rotations per insert and three per delete, which is better for write-heavy maps. Java, C++'s std::map and Linux's scheduler all use red-black trees.

        ?? Can TreeMap store null keys?
        Not with natural ordering: «compareTo» on null throws «NullPointerException». A custom comparator that handles null can allow it. Null values are fine.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'You need, for each new booking time t, the latest existing booking that starts at or before t. Best structure?',
          options: ['HashMap with a scan', 'Sorted ArrayList, re-sorted after every insert', '«TreeMap.floorKey(t)»', 'PriorityQueue'],
          answer: 2, why: 'floorKey answers "greatest key ≤ t" in O(log n) while supporting O(log n) inserts. A sorted list needs O(n) inserts, and a PQ only exposes its minimum.' },
        { q: '«new TreeSet<>(Comparator.comparingInt(String::length))» receives "cat", "dog", "bird". What is its size?',
          options: ['3', '2', '1', 'It throws'],
          answer: 1, why: '"cat" and "dog" compare as equal (both length 3), so the set treats them as the same element and keeps only the first. The size is 2.' },
      ],
    },

    /* ───────────────────────── Lesson: ArrayDeque & PriorityQueue ───────────────────────── */
    { lesson: 'deque-heap-internals', title: 'ArrayDeque and PriorityQueue, inside', mins: 12,
      lede: 'A ring buffer that makes the best stack and queue in Java, and a heap packed into an array.',
      body: M`
        ## ArrayDeque: a circular array
        ~~~java
        transient Object[] elements;
        transient int head;   // index of the first element
        transient int tail;   // index where the next addLast goes
        ~~~
        Elements live between «head» and «tail» and may **wrap around** the end of the array. Adding at the front decrements «head» (wrapping to the last index); adding at the back increments «tail». When the ring fills up, it grows (about 2× while small, 1.5× when large) and copies the elements out in order.

        @viz circularDeque

        | Method (Queue view) | Method (Stack view) | Deque method | Cost |
        |---|---|---|---|
        | «offer(x)» / «add(x)» | — | «offerLast» / «addLast» | O(1) amortized |
        | «poll()» / «remove()» | «pop()» | «pollFirst» / «removeFirst» | O(1) |
        | «peek()» / «element()» | «peek()» | «peekFirst» / «getFirst» | O(1) |
        | — | «push(x)» | «addFirst» | O(1) amortized |
        | — | — | «pollLast», «peekLast» | O(1) |

        The «poll/peek/offer» family returns «null» or «false» on failure; «remove/element/add/pop» throw. In interviews, «poll» and «peek» with a null check are the usual choice.

        :::key Stack and queue in Java = ArrayDeque
        - «Stack» extends «Vector»: every call is synchronized, and it exposes index-based methods that break the stack abstraction. It's legacy.
        - «LinkedList» works as a queue, but allocates a node per element and scatters them in memory.
        - «ArrayDeque» has no per-element objects and uses contiguous memory, so it's usually 2–3× faster. One catch: it **rejects null**, since null marks an empty slot.
        :::

        ## PriorityQueue: a binary heap in an array
        ~~~java
        transient Object[] queue;   // queue[0] is the smallest element
        int size;
        private final Comparator<? super E> comparator;   // null → natural order
        ~~~
        The heap is a complete binary tree stored level by level: the children of «i» are at «2i + 1» and «2i + 2», and its parent is at «(i − 1) / 2». The only rule is *parent ≤ children*, so the minimum sits at index 0, but the array is **not sorted**.

        @viz heapOps

        | Operation | Cost | How |
        |---|---|---|
        | «offer(x)» | O(log n) | append, then sift up |
        | «poll()» | O(log n) | move the last element to the root, then sift down |
        | «peek()» | O(1) | «queue[0]» |
        | «remove(x)», «contains(x)» | O(n) | linear search, then re-sift |
        | «new PriorityQueue<>(collection)» | O(n) | bottom-up heapify, faster than n offers |
        | iterate / «toString()» / «toArray()» | O(n) | array order, **unsorted** |

        :::warn PriorityQueue traps
        - **Printing a PQ doesn't show sorted order.** Neither does a for-each loop over it. Poll it repeatedly to get elements in order.
        - **Max-heap:** «new PriorityQueue<>(Collections.reverseOrder())», or «(a, b) -> Integer.compare(b, a)», never «b - a» (overflow).
        - **Updating a priority in place doesn't work.** Changing an element's key after insertion breaks the heap. Remove it and re-add it (O(n)), or use **lazy deletion**: push the new version and skip stale entries when you poll them. That's the standard trick in Dijkstra.
        - **Ties are unordered.** A heap isn't stable. Add a tie-breaker to the comparator when order among equals matters.
        :::

        ?? How does heapify build a heap in O(n), not O(n log n)?
        It sifts down every non-leaf, starting at the last one and working back to the root. Half the nodes are leaves (no work), a quarter sift at most 1 level, an eighth at most 2, and so on: n·Σ k/2^(k+1) = O(n). Building with n separate «offer» calls is O(n log n).

        ?? Why does ArrayDeque reject null?
        It uses «null» as the "empty slot" marker, so «poll()» returning null has to mean "empty". Allowing null elements would make that ambiguous.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'A PriorityQueue<Integer> holds 5, 1, 3. What does «System.out.println(pq)» print?',
          options: ['Always [1, 3, 5]', 'The heap array order, e.g. [1, 5, 3]: a valid heap, not sorted', 'Always [5, 3, 1]', 'Insertion order'],
          answer: 1, why: '«toString» walks the backing array, which only satisfies parent ≤ children. Poll repeatedly to see sorted order.' },
        { q: 'You need a LIFO stack of Integers in Java. Best choice?',
          options: ['«Stack<Integer>»', '«Deque<Integer> st = new ArrayDeque<>()» with push/pop/peek', '«LinkedList<Integer>» with add/removeLast', '«ArrayList» with add/remove(0)'],
          answer: 1, why: 'ArrayDeque is the recommended stack: no synchronization and no node allocation. «remove(0)» on an ArrayList is O(n).' },
      ],
    },

    /* ───────────────────────── Lesson: LinkedHashMap & friends ───────────────────────── */
    { lesson: 'linkedhashmap-lru', title: 'LinkedHashMap, LRU, and the specialty maps', mins: 7,
      lede: 'A hash table threaded with a linked list gives predictable order, and an LRU cache in five lines.',
      body: M`
        ## A HashMap with a doubly linked list through it
        «LinkedHashMap» extends «HashMap». Its entries add «before» and «after» pointers, and the map keeps «head» and «tail». Lookups work exactly as in HashMap. The list only defines **iteration order**:

        - **Insertion order** (default): re-inserting an existing key doesn't move it.
        - **Access order** («new LinkedHashMap<>(16, 0.75f, true)»): every «get»/«put» moves the entry to the tail, so the head is always the least recently used.

        After each insertion, it calls «removeEldestEntry(head)». Override that and you have a size-bounded LRU cache:

        @viz linkedHashMapLru

        ~~~java
        class LRU<K, V> extends LinkedHashMap<K, V> {
            private final int cap;
            LRU(int cap) { super(16, 0.75f, true); this.cap = cap; }
            @Override protected boolean removeEldestEntry(Map.Entry<K, V> e) { return size() > cap; }
        }
        ~~~
        Mention this in an LRU interview, then expect "now build it without LinkedHashMap". The Linked List module does exactly that.

        ## Specialty maps worth one sentence each
        | Class | Use it for |
        |---|---|
        | «LinkedHashSet» | A set that remembers insertion order (dedupe while keeping order) |
        | «EnumMap» / «EnumSet» | Enum keys: backed by an array or bit vector, very fast |
        | «IdentityHashMap» | Keys compared with «==»: graph cloning, object identity |
        | «WeakHashMap» | Caches whose keys can be garbage collected |
        | «ConcurrentHashMap» | Thread-safe map with atomic «merge»/«compute» |
        | «BitSet» | Millions of booleans packed into «long[]» (a sieve, visited flags) |

        @quiz 0
      `,
      quiz: [
        { q: 'You need to remove duplicates from a list while keeping first-occurrence order, in O(n). What do you use?',
          options: ['TreeSet', 'HashSet', 'LinkedHashSet', 'Sort, then scan'],
          answer: 2, why: 'LinkedHashSet gives O(1) membership checks plus insertion-order iteration. TreeSet sorts (losing the original order), HashSet scrambles it, and sorting also loses it.' },
      ],
    },

    /* ───────────────────────── Lesson: Strings & sorting ───────────────────────── */
    { lesson: 'strings-sorting', title: 'Strings, StringBuilder and sorting, inside', mins: 10,
      lede: 'Why string concatenation in a loop is quadratic, what Arrays.sort really runs, and the comparator contract.',
      body: M`
        ## String: an immutable byte array
        ~~~java
        // java.lang.String (JDK 9+, "compact strings")
        private final byte[] value;   // 1 byte per char if all chars are Latin-1, else 2 (UTF-16)
        private final byte coder;     // LATIN1 or UTF16
        private int hash;             // cached hashCode, computed on first use
        ~~~
        - **Immutable:** every "change" creates a new String. «s.toUpperCase()», «s.replace(...)» and «s.substring(i, j)» all allocate and copy, so they're O(length). (Before JDK 7u6, «substring» shared the parent's array; now it copies.)
        - «charAt», «length» and a cached «hashCode» are O(1). «equals» is O(n).
        - **String literals are interned**: «"ab" == "ab"» is true because both refer to one pooled object, but «new String("ab") == "ab"» is false. Always compare with «equals».

        ## Concatenation in a loop is O(n²)
        ~~~java
        String s = "";
        for (int i = 0; i < n; i++) s += i;         // copies the whole string every time: O(n²)

        StringBuilder sb = new StringBuilder();     // growable byte[]; append is amortized O(1)
        for (int i = 0; i < n; i++) sb.append(i);
        String s2 = sb.toString();                  // one final O(n) copy
        ~~~
        «StringBuilder» grows its array to about «2 × old + 2» when full, the same amortized argument as ArrayList. Watch out for «sb.insert(0, x)» and «sb.deleteCharAt(0)»: they shift everything, so each is O(n). To build a string backwards, append and then «reverse()» once.

        ## What Arrays.sort runs
        | Call | Algorithm | Stable? | Cost |
        |---|---|---|---|
        | «Arrays.sort(int[])» and other primitives | Dual-pivot quicksort, with insertion sort for tiny ranges | No (irrelevant for primitives) | O(n log n) average; recent JDKs fall back to heapsort on bad inputs |
        | «Arrays.sort(T[])», «Arrays.sort(T[], cmp)» | TimSort (merge sort + insertion sort on natural runs) | **Yes** | O(n log n) worst, O(n) on sorted input, O(n) extra memory |
        | «Collections.sort(list)», «list.sort(cmp)» | Copies to an array, runs TimSort, writes back | Yes | same as above |

        Stability matters when you sort by one key after another. Sort by secondary key, then by primary key, and a stable sort keeps the secondary order within ties. Better still, use one comparator: «comparing(primary).thenComparing(secondary)».

        :::warn Descending order for int[]
        There's no «Arrays.sort(int[], comparator)», because comparators need objects. Options: sort ascending and read from the end; sort ascending and reverse in place; or box to «Integer[]» and use «Collections.reverseOrder()» (slower, more memory).
        :::

        ## The comparator contract
        A comparator must be **consistent** (antisymmetric and transitive). A random or broken one («(a, b) -> a < b ? -1 : 1», which never returns 0) can make TimSort throw «IllegalArgumentException: Comparison method violates its general contract!». It only surfaces on some inputs. Use «Integer.compare», «Comparator.comparing…», and «thenComparing».

        ?? Why is String immutable?
        Safety and speed. Strings are used as HashMap keys (a mutable key would break the map), they're shared freely between threads with no locking, the hash can be cached, and literals can be pooled. The price: modifications allocate, hence StringBuilder.

        ?? Why does Java use quicksort for primitives but merge-based TimSort for objects?
        Primitives have no identity, so stability doesn't matter, and quicksort's in-place speed wins. Objects often need a stable sort, and comparisons (calls through a Comparator) are expensive, so TimSort's fewer comparisons and fast handling of pre-sorted runs pay off.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'What does this cost? «String r = ""; for (char c : s.toCharArray()) r = c + r;» (n = s.length())',
          options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(1)'],
          answer: 2, why: 'Each iteration builds a brand-new string of length up to n, so the total is 1 + 2 + … + n = O(n²). Use «new StringBuilder(s).reverse().toString()», which is O(n).' },
        { q: 'You sort a list of employees by department with «list.sort(comparing(Employee::dept))». They were previously sorted by name. Within a department, what order are they in?',
          options: ['Random', 'By name, because TimSort is stable', 'Reverse name order', 'By hash code'],
          answer: 1, why: 'List.sort uses TimSort, which is stable: elements with equal keys keep their previous relative order.' },
      ],
    },

    /* ───────────────────────── Problems ───────────────────────── */
    { problem: {
      id: 'design-hashmap', title: 'Build Your Own HashMap', diff: 'easy',
      tags: ['design', 'hashing', 'chaining'],
      statement: M`
        Implement «MyHashMap», a map from «int» keys to «int» values, **without** using any built-in hash table («HashMap», «HashSet», «Hashtable»…). Write the buckets and chains yourself.

        - «MyHashMap()» creates an empty map.
        - «put(key, value)» inserts the pair, or updates the value if «key» already exists.
        - «get(key)» returns the value for «key», or «-1» if it's absent.
        - «remove(key)» deletes «key» if present.

        Tests call these operations in sequence and compare the list of results («null» for «void» methods).
      `,
      design: { cls: 'MyHashMap', ctor: [], methods: { put: { params: [['int', 'key'], ['int', 'value']], ret: 'void' }, get: { params: [['int', 'key']], ret: 'int' }, remove: { params: [['int', 'key']], ret: 'void' } } },
      tests: [
        { ex: true, ops: ['MyHashMap', 'put', 'put', 'get', 'get', 'put', 'get', 'remove', 'get'], args: [[], [1, 1], [2, 2], [1], [3], [2, 1], [2], [2], [2]], expect: [null, null, null, 1, -1, null, 1, null, -1], why: 'get(3) misses; put(2, 1) overwrites; after remove(2), get(2) misses.' },
        { ops: ['MyHashMap', 'get', 'remove', 'get'], args: [[], [0], [0], [0]], expect: [null, -1, null, -1] },
        { ops: ['MyHashMap', 'put', 'put', 'put', 'get', 'get', 'get'], args: [[], [0, 5], [1000000, 7], [16, 9], [0], [1000000], [16]], expect: [null, null, null, null, 5, 7, 9] },
        { ops: ['MyHashMap', 'put', 'put', 'put', 'put', 'remove', 'get', 'get', 'get'], args: [[], [1, 10], [17, 20], [33, 30], [49, 40], [17], [1], [17], [49]], expect: [null, null, null, null, null, null, 10, -1, 40], why: 'With 16 buckets, 1, 17, 33 and 49 all collide. Removing from the middle of a chain must keep the rest.' },
        { ops: ['MyHashMap', 'put', 'put', 'remove', 'put', 'get'], args: [[], [5, 1], [5, 2], [5], [5, 3], [5]], expect: [null, null, null, null, null, 3] },
        { ops: ['MyHashMap', ...Array(60).fill('put'), ...Array(60).fill('get')], args: [[], ...Array.from({ length: 60 }, (_, i) => [i * 997 % 1000001, i]), ...Array.from({ length: 60 }, (_, i) => [i * 997 % 1000001])] },
        { ops: ['MyHashMap', ...Array.from({ length: 3000 }, (_, i) => ['put', 'get', 'remove', 'put', 'get'][(i * 7 + (i >> 3)) % 5])], args: [[], ...Array.from({ length: 3000 }, (_, i) => { const op = ['put', 'get', 'remove', 'put', 'get'][(i * 7 + (i >> 3)) % 5]; const k = (i * 7919) % 523; return op === 'put' ? [k, i] : [k]; })], big: true },
      ],
      constraints: ['0 ≤ key, value ≤ 10⁶', 'At most 10⁴ calls in total'],
      hints: [
        'Start with an array of buckets. Which bucket does a key go to?',
        'Each bucket holds a small linked list (or «ArrayList») of «(key, value)» pairs. «put» and «get» search only that bucket.',
        'To handle any number of keys well, resize (double the buckets and re-insert) when the average chain gets long, exactly like «java.util.HashMap».',
      ],
      solution: {
        pattern: 'Implementing a hash table: **hash → bucket index → search the chain**, with resizing to keep chains short. Knowing this cold is also your answer to "how does HashMap work?".',
        intuition: M`
          Map each key to one of «n» buckets with «key mod n» (or «hash & (n − 1)» when n is a power of two). Keys that share a bucket form a chain. With n comparable to the number of entries, chains average O(1) length, so every operation is O(1) on average. Double the table when the load (size / buckets) passes 0.75, and re-insert everything.
        `,
        java: J`class MyHashMap {
    private static class Node {
        final int key; int val; Node next;
        Node(int key, int val, Node next) { this.key = key; this.val = val; this.next = next; }
    }

    private Node[] table = new Node[16];
    private int size = 0;

    private int index(int key, int n) {
        int h = Integer.hashCode(key);
        h ^= (h >>> 16);                 // spread high bits, like java.util.HashMap
        return h & (n - 1);              // n is a power of two
    }

    public void put(int key, int value) {
        int i = index(key, table.length);
        for (Node e = table[i]; e != null; e = e.next)
            if (e.key == key) { e.val = value; return; }
        table[i] = new Node(key, value, table[i]);     // prepend: O(1)
        if (++size > table.length * 3 / 4) resize();
    }

    public int get(int key) {
        for (Node e = table[index(key, table.length)]; e != null; e = e.next)
            if (e.key == key) return e.val;
        return -1;
    }

    public void remove(int key) {
        int i = index(key, table.length);
        Node dummy = new Node(0, 0, table[i]);
        for (Node prev = dummy; prev.next != null; prev = prev.next)
            if (prev.next.key == key) { prev.next = prev.next.next; size--; break; }
        table[i] = dummy.next;
    }

    private void resize() {
        Node[] old = table;
        table = new Node[old.length * 2];
        for (Node head : old)
            for (Node e = head; e != null; ) {
                Node next = e.next;
                int i = index(e.key, table.length);
                e.next = table[i]; table[i] = e;      // relink, no new nodes
                e = next;
            }
    }
}`,
        time: 'O(1) average per call', space: 'O(number of keys)',
        timeWhy: 'chains stay short thanks to resizing; a resize is O(n) but amortized O(1)',
        why: M`
          All keys in a bucket share «index(key)», so a key can only be in its own bucket's chain, and searching that chain is enough. Resizing keeps «size / buckets ≤ 0.75», so the expected chain length stays constant, assuming keys spread well. The shift-and-XOR takes care of keys that differ only in their high bits.
        `,
        pitfalls: M`
          - Removing a node from a singly linked chain needs the *previous* node. A dummy head removes the special case for the first node.
          - Forgetting to check for an existing key in «put» creates duplicates, and «get» may then return a stale value.
          - During «resize», compute new indices with the **new** length.
        `,
        alts: [
          { name: 'Direct addressing (array indexed by key)', time: 'O(1) worst case', space: 'O(key range) = 10⁶ ints ≈ 4 MB',
            note: 'Because keys are bounded by 10⁶, an «int[1000001]» filled with −1 works. It’s perfect when the key range is small and dense; mention it, then explain why real maps can’t do this for arbitrary keys.',
            java: J`class MyHashMap {
    private final int[] vals = new int[1_000_001];
    public MyHashMap() { Arrays.fill(vals, -1); }
    public void put(int key, int value) { vals[key] = value; }
    public int get(int key) { return vals[key]; }
    public void remove(int key) { vals[key] = -1; }
}` },
          { name: 'Fixed buckets of ArrayLists, no resize', time: 'O(n / buckets) per call', space: 'O(n)',
            note: 'A prime number of buckets (like 1009) with «List<int[]>» chains passes the constraints here, but degrades linearly as keys grow. Resizing is what makes a real hash map O(1).' },
        ],
        followups: M`
          - **Open addressing:** store entries directly in the array and probe «i, i+1, i+2…» on collision (linear probing). Deletion needs tombstones. Python's dict uses a variant of this.
          - **Generic keys:** use «key.hashCode()» and «equals», and treeify long chains to bound the worst case.
          - **Thread safety:** lock per bucket (striping), which is roughly what «ConcurrentHashMap» does.
        `,
        talk: 'An array of buckets, each a linked chain. The index is the spread hash masked by capacity minus one. put searches the chain and updates or prepends; get searches the chain; remove unlinks with a dummy node. Past a 0.75 load factor I double and relink, so every operation is O(1) amortized on average.',
      },
      lc: [lc(706, 'design-hashmap', 'Design HashMap', 'same'), lc(705, 'design-hashset', 'Design HashSet', 'variant')],
      drill: { prompt: 'Implement put/get/remove for an int→int map without using the library hash table.', pattern: 'design', why: 'It’s a data-structure design problem: buckets plus chains, and resizing to keep O(1).' },
    } },

    { problem: {
      id: 'circular-deque', title: 'Build a Ring-Buffer Deque', diff: 'medium',
      tags: ['design', 'circular array', 'deque'],
      statement: M`
        Implement «MyCircularDeque», a double-ended queue with a fixed capacity «k», stored in a plain array used as a **ring buffer**. This is how «ArrayDeque» works inside (minus the growing).

        - «MyCircularDeque(k)» creates a deque holding at most «k» elements.
        - «insertFront(x)», «insertLast(x)»: add «x» and return «true», or return «false» if the deque is full.
        - «deleteFront()», «deleteLast()»: remove an element and return «true», or return «false» if it's empty.
        - «getFront()», «getRear()»: return the element, or «-1» if the deque is empty.
        - «isEmpty()», «isFull()».

        Every operation must be O(1): no shifting elements.
      `,
      design: { cls: 'MyCircularDeque', ctor: [['int', 'k']], methods: {
        insertFront: { params: [['int', 'value']], ret: 'boolean' }, insertLast: { params: [['int', 'value']], ret: 'boolean' },
        deleteFront: { params: [], ret: 'boolean' }, deleteLast: { params: [], ret: 'boolean' },
        getFront: { params: [], ret: 'int' }, getRear: { params: [], ret: 'int' },
        isEmpty: { params: [], ret: 'boolean' }, isFull: { params: [], ret: 'boolean' },
      } },
      tests: [
        { ex: true, ops: ['MyCircularDeque', 'insertLast', 'insertLast', 'insertFront', 'insertFront', 'getRear', 'isFull', 'deleteLast', 'insertFront', 'getFront'], args: [[3], [1], [2], [3], [4], [], [], [], [4], []], expect: [null, true, true, true, false, 2, true, true, true, 4] },
        { ops: ['MyCircularDeque', 'getFront', 'getRear', 'deleteFront', 'deleteLast', 'isEmpty', 'isFull'], args: [[2], [], [], [], [], [], []], expect: [null, -1, -1, false, false, true, false] },
        { ops: ['MyCircularDeque', 'insertFront', 'getRear', 'getFront', 'deleteLast', 'isEmpty', 'insertLast', 'getFront'], args: [[1], [9], [], [], [], [], [7], []], expect: [null, true, 9, 9, true, true, true, 7] },
        { ops: ['MyCircularDeque', 'insertFront', 'insertFront', 'insertFront', 'deleteLast', 'deleteLast', 'insertLast', 'insertLast', 'getFront', 'getRear', 'isFull'], args: [[3], [1], [2], [3], [], [], [4], [5], [], [], []], expect: [null, true, true, true, true, true, true, true, 3, 5, true], why: 'The front wraps around to the end of the array several times.' },
        { ops: ['MyCircularDeque', ...Array.from({ length: 2000 }, (_, i) => ['insertFront', 'insertLast', 'deleteFront', 'getRear', 'deleteLast', 'getFront', 'insertLast', 'isFull'][(i * 5 + (i >> 2)) % 8])], args: [[37], ...Array.from({ length: 2000 }, (_, i) => (['insertFront', 'insertLast', 'insertLast'].includes(['insertFront', 'insertLast', 'deleteFront', 'getRear', 'deleteLast', 'getFront', 'insertLast', 'isFull'][(i * 5 + (i >> 2)) % 8]) ? [i % 1000] : []))], big: true },
      ],
      constraints: ['1 ≤ k ≤ 1000', '0 ≤ value ≤ 1000', 'At most 2000 calls'],
      hints: [
        'Keep an array of size k, the index of the front element, and the current size.',
        'The back element sits at «(front + size − 1) mod k». Inserting at the front moves «front» one step back, with wraparound.',
        'Moving back from index 0 must land on k − 1. «(i − 1 + k) % k» does that; plain «(i − 1) % k» can go negative in Java.',
      ],
      solution: {
        pattern: 'A **circular buffer**: logical index «(front + j) mod k». The same trick powers «ArrayDeque», bounded queues, and sliding windows over streams.',
        intuition: M`
          Don't move elements; move the *window*. Track «front» (index of the first element) and «size». The element at logical position «j» lives at «(front + j) % k». Inserting at the front steps «front» back one slot (wrapping), inserting at the back writes at «(front + size) % k», and deleting just adjusts «front» or «size».
        `,
        java: J`class MyCircularDeque {
    private final int[] a;
    private int front = 0, size = 0;

    public MyCircularDeque(int k) { a = new int[k]; }

    public boolean insertFront(int value) {
        if (isFull()) return false;
        front = (front - 1 + a.length) % a.length;   // step back, wrapping from 0 to k-1
        a[front] = value;
        size++;
        return true;
    }

    public boolean insertLast(int value) {
        if (isFull()) return false;
        a[(front + size) % a.length] = value;
        size++;
        return true;
    }

    public boolean deleteFront() {
        if (isEmpty()) return false;
        front = (front + 1) % a.length;
        size--;
        return true;
    }

    public boolean deleteLast() {
        if (isEmpty()) return false;
        size--;
        return true;
    }

    public int getFront() { return isEmpty() ? -1 : a[front]; }
    public int getRear() { return isEmpty() ? -1 : a[(front + size - 1) % a.length]; }
    public boolean isEmpty() { return size == 0; }
    public boolean isFull() { return size == a.length; }
}`,
        time: 'O(1) per operation', space: 'O(k)',
        pitfalls: M`
          - Java's «%» keeps the dividend's sign: «(0 − 1) % k == −1». Add k before taking the modulus.
          - Using only «head» and «tail» makes "empty" and "full" look the same (head == tail). Track «size», or keep one slot always empty the way ArrayDeque does.
        `,
        alts: [
          { name: 'Wrap java.util.ArrayDeque', time: 'O(1)', space: 'O(k)', note: 'Fine in practice, but it skips the point of the exercise. Useful as a reference check.',
            java: J`class MyCircularDeque {
    private final Deque<Integer> d = new ArrayDeque<>();
    private final int k;
    public MyCircularDeque(int k) { this.k = k; }
    public boolean insertFront(int v) { if (d.size() == k) return false; d.addFirst(v); return true; }
    public boolean insertLast(int v) { if (d.size() == k) return false; d.addLast(v); return true; }
    public boolean deleteFront() { return d.pollFirst() != null; }
    public boolean deleteLast() { return d.pollLast() != null; }
    public int getFront() { return d.isEmpty() ? -1 : d.peekFirst(); }
    public int getRear() { return d.isEmpty() ? -1 : d.peekLast(); }
    public boolean isEmpty() { return d.isEmpty(); }
    public boolean isFull() { return d.size() == k; }
}` },
        ],
        followups: M`
          - **Make it growable:** when full, copy into a 2× array starting at index 0 (unwrapping). That's «ArrayDeque».
          - **Thread-safe bounded queue:** add a lock and two conditions (not full, not empty). That's «ArrayBlockingQueue».
        `,
        talk: 'A fixed array with a front index and a size. Logical position j lives at (front + j) mod k. Front inserts step front back with wraparound, back inserts write at front + size, and deletes only move front or size. Everything is O(1).',
      },
      lc: [lc(641, 'design-circular-deque', 'Design Circular Deque', 'same'), lc(622, 'design-circular-queue', 'Design Circular Queue', 'easier')],
      drill: { prompt: 'Design a fixed-capacity double-ended queue with O(1) insert/delete at both ends using an array.', pattern: 'design', why: 'Data-structure design with a circular array: indices wrap modulo the capacity.' },
    } },

    { problem: {
      id: 'min-heap', title: 'Build Your Own PriorityQueue', diff: 'medium',
      tags: ['design', 'heap', 'array'],
      statement: M`
        Implement «MinHeap», a min-priority queue of «int»s stored in an array, the way «java.util.PriorityQueue» does it. Don't use any built-in priority queue or sorted collection.

        - «MinHeap()» creates an empty heap.
        - «push(x)» inserts «x».
        - «pop()» removes and returns the smallest element, or «-1» if the heap is empty.
        - «peek()» returns the smallest element without removing it, or «-1» if empty.
        - «size()» returns the number of elements.

        «push» and «pop» must be O(log n).
      `,
      design: { cls: 'MinHeap', ctor: [], methods: { push: { params: [['int', 'x']], ret: 'void' }, pop: { params: [], ret: 'int' }, peek: { params: [], ret: 'int' }, size: { params: [], ret: 'int' } } },
      tests: [
        { ex: true, ops: ['MinHeap', 'push', 'push', 'push', 'peek', 'pop', 'pop', 'size', 'pop', 'pop'], args: [[], [5], [1], [3], [], [], [], [], [], []], expect: [null, null, null, null, 1, 1, 3, 1, 5, -1] },
        { ops: ['MinHeap', 'peek', 'pop', 'size'], args: [[], [], [], []], expect: [null, -1, -1, 0] },
        { ops: ['MinHeap', 'push', 'push', 'push', 'push', 'pop', 'pop', 'pop', 'pop'], args: [[], [2], [2], [1], [2], [], [], [], []], expect: [null, null, null, null, null, 1, 2, 2, 2], why: 'Duplicates must all come out.' },
        { ops: ['MinHeap', 'push', 'push', 'push', 'push', 'push', 'push', 'push', 'pop', 'pop', 'pop', 'pop', 'pop', 'pop', 'pop'], args: [[], [7], [6], [5], [4], [3], [2], [1], [], [], [], [], [], [], []], expect: [null, null, null, null, null, null, null, null, 1, 2, 3, 4, 5, 6, 7] },
        { ops: ['MinHeap', 'push', 'push', 'pop', 'push', 'peek', 'push', 'pop', 'size'], args: [[], [-5], [100], [], [-10], [], [0], [], []], expect: [null, null, null, -5, null, -10, null, -10, 2] },
        { ops: ['MinHeap', ...Array.from({ length: 4000 }, (_, i) => (i % 3 === 2 ? 'pop' : 'push'))], args: [[], ...Array.from({ length: 4000 }, (_, i) => (i % 3 === 2 ? [] : [((i * 7919) % 10007) - 5000]))], big: true },
      ],
      constraints: ['−10⁹ ≤ x ≤ 10⁹ (values other than −1 are returned as-is)', 'At most 10⁴ calls'],
      hints: [
        'Store the heap as a complete binary tree in an array: the children of index i are «2i + 1» and «2i + 2», and the parent is «(i − 1) / 2».',
        '«push»: put the value at the end, then swap it upward while it’s smaller than its parent.',
        '«pop»: save the root, move the last element to the root, then swap it downward with its **smaller** child until both children are larger.',
      ],
      solution: {
        pattern: 'The **binary heap**: an array with implicit parent/child links and O(log n) sift-up/sift-down. It powers every top-K, scheduling, and Dijkstra solution in Java.',
        intuition: M`
          The heap property (parent ≤ children) is local, so fixing it after a change only touches one root-to-leaf path, which has length O(log n) in a complete tree. Adding at the end keeps the tree complete; only the new leaf may be out of place, so it bubbles up. Removing the root leaves a hole. Fill it with the last element (which keeps the tree complete) and let it sink down.
        `,
        java: J`class MinHeap {
    private int[] a = new int[16];
    private int n = 0;

    public void push(int x) {
        if (n == a.length) a = Arrays.copyOf(a, n * 2);   // grow like ArrayList
        a[n] = x;
        int k = n++;
        while (k > 0) {                                   // sift up
            int p = (k - 1) / 2;
            if (a[p] <= a[k]) break;
            swap(p, k);
            k = p;
        }
    }

    public int pop() {
        if (n == 0) return -1;
        int min = a[0];
        a[0] = a[--n];
        int k = 0;
        while (true) {                                    // sift down
            int l = 2 * k + 1, r = l + 1, s = k;
            if (l < n && a[l] < a[s]) s = l;
            if (r < n && a[r] < a[s]) s = r;
            if (s == k) break;
            swap(s, k);
            k = s;
        }
        return min;
    }

    public int peek() { return n == 0 ? -1 : a[0]; }
    public int size() { return n; }

    private void swap(int i, int j) { int t = a[i]; a[i] = a[j]; a[j] = t; }
}`,
        time: 'push/pop O(log n), peek/size O(1)', space: 'O(n)',
        pitfalls: M`
          - Sifting down, compare with the **smaller** child. Swapping with the left child blindly can put a larger value above a smaller one.
          - Check that «l < n» and «r < n» before reading children. The array has spare capacity past «n» full of stale values.
        `,
        alts: [
          { name: 'Reference check with java.util.PriorityQueue', time: 'O(log n)', space: 'O(n)', note: 'What you’d use in any other problem.',
            java: J`class MinHeap {
    private final PriorityQueue<Integer> pq = new PriorityQueue<>();
    public void push(int x) { pq.offer(x); }
    public int pop() { return pq.isEmpty() ? -1 : pq.poll(); }
    public int peek() { return pq.isEmpty() ? -1 : pq.peek(); }
    public int size() { return pq.size(); }
}` },
          { name: 'Sorted array', time: 'push O(n), pop O(1)', space: 'O(n)', note: 'Binary search finds the spot, but inserting shifts elements, so it’s O(n). That’s fine for few inserts and many reads; the heap balances both.' },
        ],
        followups: M`
          - **Build from an array in O(n):** sift down indices «n/2 − 1» down to 0 (heapify).
          - **Decrease-key:** track each element's index in a map so you can sift it after an update (an indexed heap). Java's PQ doesn't support this, which is why Dijkstra in Java uses lazy deletion.
          - **Heapsort:** heapify, then pop n times: O(n log n) in place, not stable.
        `,
        talk: 'A complete binary tree in an array: children 2i+1 and 2i+2, parent (i−1)/2. push appends and sifts up; pop replaces the root with the last element and sifts down toward the smaller child. Both walk one path, so O(log n).',
      },
      lc: [lc(215, 'kth-largest-element-in-an-array', 'Kth Largest Element in an Array', 'similar'), lc(703, 'kth-largest-element-in-a-stream', 'Kth Largest Element in a Stream', 'similar'), lc(1046, 'last-stone-weight', 'Last Stone Weight', 'easier')],
      drill: { prompt: 'Implement push/pop-min in O(log n) using an array, without the library priority queue.', pattern: 'heap-topk', why: 'It’s the heap itself: sift-up on insert, sift-down on removal.' },
    } },

    { problem: {
      id: 'sort-by-frequency', title: 'Sort Letters by Frequency', diff: 'medium',
      tags: ['hash map', 'sorting', 'comparator'],
      statement: M`
        Given a string «s», return it rearranged so that characters appear in **decreasing order of frequency**, each character's copies grouped together. When two characters occur equally often, the one with the **smaller character code** comes first («'A'» (65) before «'a'» (97), «'1'» before «'A'»).

        This is mostly practice in Java's counting and comparator tools.
      `,
      fn: { name: 'frequencySort', params: [['String', 's']], ret: 'String' },
      tests: [
        { args: ['tree'], ex: true, expect: 'eert', why: "'e' appears twice; 'r' and 't' once each, and 'r' < 't'." },
        { args: ['cccaaa'], ex: true, expect: 'aaaccc', why: "Tie at 3: 'a' (97) comes before 'c' (99)." },
        { args: ['Aabb'], expect: 'bbAa' },
        { args: ['z'], expect: 'z' },
        { args: ['2a554442f544asfasss'] },
        { args: ['abcABC123'], expect: '123ABCabc' },
        { args: ['    xy'], expect: '    xy' },
        { args: [{ $gen: 'str', args: [100000, 'abcdefghijklmnopqrstuvwxyzABC0123456789', 3] }], big: true },
      ],
      constraints: ['1 ≤ s.length ≤ 10⁵', 's contains printable ASCII characters (codes 32–126)'],
      hints: [
        'Count each character first. An «int[128]» is enough for ASCII.',
        'Then sort the distinct characters by (count descending, character ascending).',
        'Build the answer with a «StringBuilder», appending each character «count» times.',
      ],
      solution: {
        pattern: '**Count, then sort the distinct keys** with a two-key comparator. Sorting only the distinct characters (at most 95 here) instead of all n characters is what makes this fast.',
        intuition: M`
          The output is completely determined by the counts: which characters exist, how many of each, and the ordering rule. Count once, order the distinct characters with «comparator(count desc, char asc)», then expand.
        `,
        java: J`class Solution {
    public String frequencySort(String s) {
        int[] count = new int[128];
        for (int i = 0; i < s.length(); i++) count[s.charAt(i)]++;

        List<Character> chars = new ArrayList<>();
        for (char c = 0; c < 128; c++) if (count[c] > 0) chars.add(c);

        chars.sort((a, b) -> count[a] != count[b]
                ? Integer.compare(count[b], count[a])   // more frequent first
                : Character.compare(a, b));             // then smaller code first

        StringBuilder sb = new StringBuilder(s.length());
        for (char c : chars) sb.append(String.valueOf(c).repeat(count[c]));
        return sb.toString();
    }
}`,
        time: 'O(n + k log k)', space: 'O(n)', timeWhy: 'k ≤ 95 distinct characters, so effectively O(n)',
        pitfalls: M`
          - Sorting all n characters with a comparator that looks up counts works, but it's O(n log n) with boxing overhead. Sort only the distinct ones.
          - Building the result with «+=» in a loop is O(n²). Use «StringBuilder».
          - Tie-breaking matters here because the expected output is unique.
        `,
        alts: [
          { name: 'Bucket by frequency', time: 'O(n)', space: 'O(n)',
            note: 'Frequencies range from 1 to n, so put characters into «buckets[freq]» and read the buckets from high to low (characters within a bucket in ascending order). This avoids sorting entirely, the same trick as Top K Frequent Elements.',
            java: J`class Solution {
    public String frequencySort(String s) {
        int[] count = new int[128];
        for (char c : s.toCharArray()) count[c]++;
        List<List<Character>> buckets = new ArrayList<>();
        for (int i = 0; i <= s.length(); i++) buckets.add(new ArrayList<>());
        for (char c = 0; c < 128; c++) if (count[c] > 0) buckets.get(count[c]).add(c);
        StringBuilder sb = new StringBuilder();
        for (int f = s.length(); f >= 1; f--)
            for (char c : buckets.get(f)) sb.append(String.valueOf(c).repeat(f));
        return sb.toString();
    }
}` },
          { name: 'Sort boxed characters by count', time: 'O(n log n)', space: 'O(n)', note: 'Box every character into a «Character[]» and sort with the two-key comparator. Simple, but slower.',
            java: J`class Solution {
    public String frequencySort(String s) {
        Map<Character, Integer> count = new HashMap<>();
        for (char c : s.toCharArray()) count.merge(c, 1, Integer::sum);
        Character[] cs = new Character[s.length()];
        for (int i = 0; i < cs.length; i++) cs[i] = s.charAt(i);
        Arrays.sort(cs, (a, b) -> !count.get(a).equals(count.get(b)) ? count.get(b) - count.get(a) : a - b);
        StringBuilder sb = new StringBuilder();
        for (char c : cs) sb.append(c);
        return sb.toString();
    }
}` },
        ],
        followups: M`
          - **Unicode input:** count with «HashMap<Integer, Integer>» over code points («s.codePoints()»).
          - **Top k characters only:** use a heap of size k, or the bucket array (Heaps module).
        `,
        talk: 'Count with an int array, sort just the distinct characters by count descending then character ascending, and expand with a StringBuilder. O(n) plus sorting at most 95 keys. The bucket-by-frequency variant avoids the sort entirely.',
      },
      lc: [lc(451, 'sort-characters-by-frequency', 'Sort Characters By Frequency', 'same'), lc(1636, 'sort-array-by-increasing-frequency', 'Sort Array by Increasing Frequency', 'variant'), lc(347, 'top-k-frequent-elements', 'Top K Frequent Elements', 'similar')],
      drill: { prompt: 'Reorder a string so characters appear by decreasing frequency (grouped).', pattern: 'counting', why: 'Count frequencies, then order by count (sorting or bucket sort by frequency).' },
    } },

    { problem: {
      id: 'my-calendar', title: 'Meeting Room Booker', diff: 'medium',
      tags: ['design', 'TreeMap', 'intervals'],
      statement: M`
        Implement «MyCalendar» for a single meeting room. «book(start, end)» tries to reserve the half-open interval «[start, end)»:

        - If it doesn't overlap any existing booking, record it and return «true».
        - Otherwise leave the calendar unchanged and return «false».

        Two bookings overlap when they share any time: «[10, 20)» and «[15, 25)» overlap, while «[10, 20)» and «[20, 30)» don't. Aim for O(log n) per booking.
      `,
      design: { cls: 'MyCalendar', ctor: [], methods: { book: { params: [['int', 'start'], ['int', 'end']], ret: 'boolean' } } },
      tests: [
        { ex: true, ops: ['MyCalendar', 'book', 'book', 'book'], args: [[], [10, 20], [15, 25], [20, 30]], expect: [null, true, false, true], why: '[15,25) overlaps [10,20); [20,30) starts exactly when [10,20) ends, which is allowed.' },
        { ops: ['MyCalendar', 'book', 'book', 'book', 'book', 'book'], args: [[], [47, 50], [33, 41], [39, 45], [33, 42], [25, 32]], expect: [null, true, true, false, false, true] },
        { ops: ['MyCalendar', 'book', 'book', 'book'], args: [[], [5, 10], [0, 5], [10, 15]], expect: [null, true, true, true] },
        { ops: ['MyCalendar', 'book', 'book', 'book'], args: [[], [0, 100], [10, 20], [99, 100]], expect: [null, true, false, false], why: 'A booking entirely inside an existing one also conflicts.' },
        { ops: ['MyCalendar', 'book', 'book'], args: [[], [10, 20], [0, 30]], expect: [null, true, false], why: 'A booking that swallows an existing one conflicts.' },
        { ops: ['MyCalendar', ...Array(1000).fill('book')], args: [[], ...Array.from({ length: 1000 }, (_, i) => { const s = (i * 7919) % 100000; return [s, s + 1 + (i % 50)]; })], big: true },
      ],
      constraints: ['0 ≤ start < end ≤ 10⁹', 'At most 1000 calls to book'],
      hints: [
        'Keep the existing bookings sorted by start time. A new booking can only collide with its nearest neighbours.',
        'Which existing booking could overlap on the left? The one with the greatest start ≤ the new start. On the right? The one with the smallest start ≥ the new start.',
        '«TreeMap<Integer, Integer>» (start → end) answers both questions with «floorEntry» and «ceilingEntry».',
      ],
      solution: {
        pattern: '**Nearest-neighbour queries in a sorted set** with «TreeMap.floorEntry/ceilingEntry», O(log n). When you need "the element just before or after x" while also inserting, reach for a TreeMap.',
        intuition: M`
          Existing bookings never overlap each other, so sorted by start they're also sorted by end. A new interval «[s, e)» can only conflict with the booking that starts at or before «s» (it overlaps if it ends after «s») or the booking that starts at or after «s» (it overlaps if it starts before «e»). Any other booking is farther away than one of these two.
        `,
        java: J`class MyCalendar {
    private final TreeMap<Integer, Integer> booked = new TreeMap<>();   // start -> end

    public boolean book(int start, int end) {
        Map.Entry<Integer, Integer> before = booked.floorEntry(start);   // greatest start <= start
        if (before != null && before.getValue() > start) return false;
        Map.Entry<Integer, Integer> after = booked.ceilingEntry(start);  // smallest start >= start
        if (after != null && after.getKey() < end) return false;
        booked.put(start, end);
        return true;
    }
}`,
        time: 'O(log n) per booking', space: 'O(n)',
        why: M`
          Suppose some booking «[a, b)» overlaps «[s, e)», meaning «a < e» and «s < b». If «a ≤ s», then «before» exists with start «a' ≥ a». Since bookings don't overlap, «before»'s end is at least «b > s», so the first check catches it. If «a > s», then «after» exists with start ≤ «a < e», so the second check catches it.
        `,
        pitfalls: M`
          - Half-open intervals: touching endpoints ([10, 20) then [20, 30)) are fine, so use strict «>» and «<».
          - Don't insert first and check afterwards. A rejected booking must leave the calendar unchanged.
        `,
        alts: [
          { name: 'Linear scan of all bookings', time: 'O(n) per booking', space: 'O(n)', note: 'Two intervals overlap iff «max(starts) < min(ends)». Check every existing booking. With only 1000 calls this passes; mention the TreeMap for scale.',
            java: J`class MyCalendar {
    private final List<int[]> list = new ArrayList<>();
    public boolean book(int start, int end) {
        for (int[] b : list) if (Math.max(b[0], start) < Math.min(b[1], end)) return false;
        list.add(new int[]{start, end});
        return true;
    }
}` },
        ],
        followups: M`
          - **Allow double booking but not triple** (LeetCode 731): keep the bookings plus a second list of pairwise overlaps.
          - **Maximum simultaneous bookings** (LeetCode 732): a sweep line. «TreeMap<time, delta>» with +1 at start and −1 at end, then a running sum (Intervals module).
        `,
        talk: 'Bookings don’t overlap each other, so I keep them in a TreeMap from start to end. A new booking can only collide with its floor entry (if that ends after my start) or its ceiling entry (if that starts before my end). Two O(log n) queries, then insert.',
      },
      lc: [lc(729, 'my-calendar-i', 'My Calendar I', 'same'), lc(731, 'my-calendar-ii', 'My Calendar II', 'harder'), lc(732, 'my-calendar-iii', 'My Calendar III', 'harder')],
      drill: { prompt: 'Accept a new booking [start, end) only if it doesn’t overlap existing ones; each call should be O(log n).', pattern: 'intervals', why: 'Interval overlap checks against sorted neighbours, using TreeMap floor/ceiling.' },
    } },
  ],
});
})();

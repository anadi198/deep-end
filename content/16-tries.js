(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

// mulberry32: small, fast, and good enough for test data.
function rng(seed) {
  let a = seed >>> 0;
  return (lo, hi) => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return lo + (((t ^ (t >>> 14)) >>> 0) % (hi - lo + 1));
  };
}
// n distinct random words over an alphabet.
function uniqueWords(n, minL, maxL, alpha, seed) {
  const r = rng(seed), seen = new Set(), out = [];
  for (let tries = 0; out.length < n; tries++) {
    if (tries > 50 * n) throw new Error('uniqueWords: not enough distinct words');
    let w = '';
    const len = r(minL, maxL);
    for (let i = 0; i < len; i++) w += alpha[r(0, alpha.length - 1)];
    if (!seen.has(w)) { seen.add(w); out.push(w); }
  }
  return out;
}
function randomBoard(rows, cols, alpha, seed) {
  const r = rng(seed);
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => alpha[r(0, alpha.length - 1)]).join(''));
}

// Big design tests.
const TRIE_BIG = (() => {
  const words = uniqueWords(1500, 1, 8, 'abcd', 601), r = rng(602), ops = ['Trie'], args = [[]];
  for (let i = 0; i < 6000; i++) {
    const w = words[r(0, words.length - 1)];
    const k = i % 3;
    if (k === 0 || i < 1500) { ops.push('insert'); args.push([w]); }
    else if (k === 1) { ops.push('search'); args.push([r(0, 1) ? w : w + 'abcd'[r(0, 3)]]); }
    else { ops.push('startsWith'); args.push([w.slice(0, r(1, w.length))]); }
  }
  return { ops, args, big: true };
})();
const DICT_BIG = (() => {
  const words = uniqueWords(2000, 1, 10, 'abc', 603), r = rng(604), ops = ['WordDictionary'], args = [[]];
  for (let i = 0; i < 4000; i++) {
    const w = words[r(0, words.length - 1)];
    if (i < 2000 || i % 2 === 0) { ops.push('addWord'); args.push([w]); }
    else {
      let q = '';
      for (const ch of w) q += r(0, 2) === 0 ? '.' : ch;
      if (r(0, 3) === 0) q += '.';
      ops.push('search'); args.push([q]);
    }
  }
  return { ops, args, big: true };
})();

DSA.module({
  id: 'tries', title: 'Tries (Prefix Trees)', short: 'Tries',
  blurb: 'A tree keyed by characters: prefix queries in O(length), autocomplete, matching many words at once, and the bitwise trie for XOR problems.',
  intro: M`
    A hash set answers "is this exact word present?" A trie also answers "does any word **start with** this?", "which words match this pattern with wildcards?" and "which of these 10,000 words appear in this grid?", in time proportional to the length of the query rather than the number of words. It's a small data structure you write from memory in about 15 lines.
  `,
  more: [
    lc(648, 'replace-words', 'Replace Words', 'easier'),
    lc(720, 'longest-word-in-dictionary', 'Longest Word in Dictionary', 'easier'),
    lc(677, 'map-sum-pairs', 'Map Sum Pairs', 'similar'),
    lc(1804, 'implement-trie-ii-prefix-tree', 'Implement Trie II (Prefix Tree)', 'variant', { premium: true }),
    lc(642, 'design-search-autocomplete-system', 'Design Search Autocomplete System', 'harder', { premium: true }),
    lc(745, 'prefix-and-suffix-search', 'Prefix and Suffix Search', 'harder'),
    lc(1032, 'stream-of-characters', 'Stream of Characters', 'harder'),
    lc(336, 'palindrome-pairs', 'Palindrome Pairs', 'harder'),
    lc(1707, 'maximum-xor-with-an-element-from-array', 'Maximum XOR With an Element From Array', 'harder'),
  ],
  items: [
    { lesson: 'tries', title: 'Tries: structure, templates and when to reach for one', mins: 14,
      lede: 'Nodes are prefixes, edges are characters. The two node layouts in Java, the insert and search template, pruning tricks, and the bitwise trie.',
      body: M`
        ## The idea
        Each node represents a **prefix**. The root is the empty prefix, and following the edge labelled «c» from the node for «"ca"» leads to the node for «"cac"»... or to nothing if no word continues that way. A boolean on each node marks whether the prefix is itself a complete word.

        @viz trieBuild

        Words that share a prefix share nodes. So "does any word start with «car»?" is a walk of three edges, whatever the dictionary size.

        ## Two node layouts in Java
        ~~~java array-children
        class TrieNode {
            TrieNode[] next = new TrieNode[26];   // fixed alphabet: fastest, 26 references per node
            boolean end;                          // a word ends here
        }
        ~~~
        ~~~java map-children
        class TrieNode {
            Map<Character, TrieNode> next = new HashMap<>();   // any alphabet, sparse, slower
            boolean end;
        }
        ~~~
        Use the array for lowercase letters (the usual interview case). Use the map for Unicode, huge alphabets, or when memory matters more than speed.

        ## The template
        ~~~java trie
        class Trie {
            private final TrieNode root = new TrieNode();

            void insert(String w) {
                TrieNode cur = root;
                for (char ch : w.toCharArray()) {
                    int c = ch - 'a';
                    if (cur.next[c] == null) cur.next[c] = new TrieNode();
                    cur = cur.next[c];
                }
                cur.end = true;
            }
            private TrieNode walk(String s) {          // node for prefix s, or null
                TrieNode cur = root;
                for (char ch : s.toCharArray()) {
                    cur = cur.next[ch - 'a'];
                    if (cur == null) return null;
                }
                return cur;
            }
            boolean search(String w)     { TrieNode n = walk(w); return n != null && n.end; }
            boolean startsWith(String p) { return walk(p) != null; }
        }
        ~~~

        | Operation | Time | Notes |
        |---|---|---|
        | insert / search / startsWith | O(L) | L = length of the word or prefix |
        | space | O(total characters × alphabet) worst case | shared prefixes save a lot in practice |

        ## Extensions you'll see in interviews
        - **Store the word at its end node** («String word» instead of «boolean end») so a DFS can collect results without rebuilding strings.
        - **Store counts** (words passing through a node) for "how many words have this prefix?" and for pruning.
        - **Wildcards** («.»): at a wildcard, branch into every child. This is DFS, O(26^dots) in the worst case.
        - **Many words against a grid** (word search II): put the words in a trie and do one DFS over the board, following trie edges. Dead prefixes stop immediately. Remove found words so the trie shrinks.
        - **Bitwise trie:** insert numbers bit by bit from the highest bit. To maximize «x XOR y», walk from the top and prefer the opposite bit at each level. Every level decides one bit of the answer greedily.

        ## Trie or something else?
        | Need | Use |
        |---|---|
        | Exact membership only | «HashSet<String>», simpler and faster |
        | Prefix queries, autocomplete, "starts with" | **trie**, or a sorted list / «TreeSet» with «ceiling(prefix)» |
        | Match many patterns against one text or grid | **trie** (Aho–Corasick for streaming text) |
        | Maximize or minimize XOR over pairs | **bitwise trie** |

        :::tip Sorted-list alternative
        A sorted array answers prefix queries too: binary search for the first word ≥ prefix, then scan while words start with it. For autocomplete with the top-3 lexicographic results (search suggestions), that's often shorter to write than a trie. Mention both.
        :::

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'A trie holds 100,000 words. What does «startsWith("inter")» cost?',
          options: ['O(100,000)', 'O(5), the prefix length', 'O(log 100,000)', 'O(5 × 100,000)'],
          answer: 1, why: 'You follow one edge per character of the prefix. The number of stored words doesn’t matter.' },
        { q: 'For maximum XOR of two numbers with a bitwise trie, why insert bits from the most significant end?',
          options: ['It uses less memory', 'Higher bits dominate the value, so choosing the opposite bit greedily from the top maximizes the result', 'Java stores ints big-endian', 'It doesn’t matter'],
          answer: 1, why: 'Getting a 1 in bit k is worth more than all lower bits combined (2ᵏ > 2ᵏ⁻¹ + … + 1). So decide bits from high to low, taking the opposite branch whenever it exists.' },
      ],
      practice: ['implement-trie', 'word-dictionary', 'search-suggestions', 'word-search-ii', 'max-xor'],
    },

    { problem: {
      id: 'implement-trie', title: 'Implement a Trie', diff: 'medium',
      tags: ['design', 'trie'],
      statement: M`
        Implement «Trie» with:
        - «Trie()»: an empty trie.
        - «void insert(String word)».
        - «boolean search(String word)»: true if «word» was inserted.
        - «boolean startsWith(String prefix)»: true if some inserted word starts with «prefix».

        Words contain only lowercase letters.
      `,
      design: { cls: 'Trie', ctor: [], methods: {
        insert: { params: [['String', 'word']], ret: 'void' },
        search: { params: [['String', 'word']], ret: 'boolean' },
        startsWith: { params: [['String', 'prefix']], ret: 'boolean' },
      } },
      tests: [
        { ex: true, ops: ['Trie', 'insert', 'search', 'search', 'startsWith', 'insert', 'search'], args: [[], ['apple'], ['apple'], ['app'], ['app'], ['app'], ['app']], expect: [null, null, true, false, true, null, true] },
        { ops: ['Trie', 'search', 'startsWith', 'insert', 'search', 'startsWith', 'startsWith'], args: [[], ['a'], ['a'], ['a'], ['a'], ['a'], ['b']], expect: [null, false, false, null, true, true, false] },
        { ops: ['Trie', 'insert', 'insert', 'search', 'startsWith', 'search', 'search', 'startsWith'], args: [[], ['car'], ['cart'], ['ca'], ['ca'], ['cart'], ['carts'], ['carts']], expect: [null, null, null, false, true, true, false, false], why: '«ca» is a prefix but not a word.' },
        { ops: ['Trie', 'insert', 'insert', 'search', 'search', 'startsWith'], args: [[], ['abc'], ['abc'], ['abc'], ['ab'], ['abc']], expect: [null, null, null, true, false, true], why: 'Inserting twice is harmless.' },
        { ops: ['Trie', 'insert', 'search', 'startsWith', 'search'], args: [[], ['zzzzzzzzzzzzzzzzzzzz'], ['zzzzzzzzzzzzzzzzzzzz'], ['zzzzzzzzzz'], ['zzzzzzzzzzzzzzzzzzz']], expect: [null, null, true, true, false] },
        TRIE_BIG,
      ],
      constraints: ['1 ≤ word.length, prefix.length ≤ 2000', 'Lowercase letters', 'At most 3·10⁴ calls'],
      hints: [
        'Each node needs links to its children (one per letter) and a flag saying whether a word ends there.',
        'insert: walk from the root, creating missing children; mark the last node. search and startsWith both walk the same way.',
        'Share the walk: a helper returns the node for a prefix (or null). search checks its end flag; startsWith just checks non-null.',
      ],
      solution: {
        pattern: '**Trie:** a node per prefix, children indexed by character, an end-of-word flag.',
        intuition: 'Inserting a word creates (or reuses) one node per character along its path. A search for a word or prefix follows the same path; missing edges mean it isn’t there. The only difference between search and startsWith is whether the final node must be a word end.',
        java: J`class Trie {
    private static class Node {
        Node[] next = new Node[26];
        boolean end;
    }
    private final Node root = new Node();

    public Trie() {}

    public void insert(String word) {
        Node cur = root;
        for (int i = 0; i < word.length(); i++) {
            int c = word.charAt(i) - 'a';
            if (cur.next[c] == null) cur.next[c] = new Node();
            cur = cur.next[c];
        }
        cur.end = true;
    }

    public boolean search(String word) {
        Node n = walk(word);
        return n != null && n.end;
    }

    public boolean startsWith(String prefix) {
        return walk(prefix) != null;
    }

    private Node walk(String s) {            // node for prefix s, or null if absent
        Node cur = root;
        for (int i = 0; i < s.length() && cur != null; i++) cur = cur.next[s.charAt(i) - 'a'];
        return cur;
    }
}`,
        time: 'O(L) per operation', space: 'O(total inserted characters × 26) worst case',
        pitfalls: M`
          - Returning «true» from search for a prefix that isn't a word: check the end flag.
          - Recursion isn't needed. Iterative walks avoid stack depth issues for long words.
        `,
        alts: [
          { name: 'HashMap children', time: 'O(L) average', space: 'O(total characters)', note: 'Sparse nodes and any alphabet, at the cost of hashing and boxing each character.',
            java: J`class Trie {
    private static class Node { Map<Character, Node> next = new HashMap<>(); boolean end; }
    private final Node root = new Node();
    public Trie() {}
    public void insert(String word) {
        Node cur = root;
        for (char ch : word.toCharArray()) cur = cur.next.computeIfAbsent(ch, k -> new Node());
        cur.end = true;
    }
    public boolean search(String word) { Node n = walk(word); return n != null && n.end; }
    public boolean startsWith(String prefix) { return walk(prefix) != null; }
    private Node walk(String s) {
        Node cur = root;
        for (char ch : s.toCharArray()) { cur = cur.next.get(ch); if (cur == null) return null; }
        return cur;
    }
}` },
          { name: 'HashSet of words + HashSet of prefixes', time: 'O(L²) insert, O(L) query (hashing)', space: 'O(total L²)', note: 'Stores every prefix explicitly. Fine for short words, but the quadratic memory is why tries exist.',
            java: J`class Trie {
    private final Set<String> words = new HashSet<>(), prefixes = new HashSet<>();
    public Trie() {}
    public void insert(String word) { words.add(word); for (int i = 1; i <= word.length(); i++) prefixes.add(word.substring(0, i)); }
    public boolean search(String word) { return words.contains(word); }
    public boolean startsWith(String prefix) { return prefixes.contains(prefix); }
}` },
        ],
        followups: M`
          - **Count words with a prefix / delete a word** (Trie II, LeetCode 1804): keep «pass» and «endCount» counters on each node.
          - **Memory:** 26 references per node is about 120+ bytes. For millions of words, consider a map-based node or a compressed (radix) trie.
        `,
        talk: 'A node per prefix with a Node[26] array of children and an end flag. Insert creates the missing nodes along the path and marks the end. search and startsWith share a walk helper: a word needs end == true, a prefix only needs a non-null node. O(L) per operation.',
      },
      viz: { id: 'trieBuild' },
      lc: [lc(208, 'implement-trie-prefix-tree', 'Implement Trie (Prefix Tree)', 'same'), lc(1804, 'implement-trie-ii-prefix-tree', 'Implement Trie II (Prefix Tree)', 'variant', { premium: true }), lc(677, 'map-sum-pairs', 'Map Sum Pairs', 'similar'), lc(648, 'replace-words', 'Replace Words', 'similar')],
      drill: { prompt: 'Support insert(word), search(word) and startsWith(prefix) in time proportional to the word length.', pattern: 'trie', why: 'A trie: one node per prefix with 26 children and an end flag.' },
    } },

    { problem: {
      id: 'word-dictionary', title: 'Word Dictionary With Wildcards', diff: 'medium',
      tags: ['design', 'trie', 'DFS'],
      statement: M`
        Implement «WordDictionary»:
        - «void addWord(String word)»: add a lowercase word.
        - «boolean search(String word)»: true if any added word matches, where «.» in the query matches **any one letter**.
      `,
      design: { cls: 'WordDictionary', ctor: [], methods: {
        addWord: { params: [['String', 'word']], ret: 'void' },
        search: { params: [['String', 'word']], ret: 'boolean' },
      } },
      tests: [
        { ex: true, ops: ['WordDictionary', 'addWord', 'addWord', 'addWord', 'search', 'search', 'search', 'search'], args: [[], ['bad'], ['dad'], ['mad'], ['pad'], ['bad'], ['.ad'], ['b..']], expect: [null, null, null, null, false, true, true, true] },
        { ops: ['WordDictionary', 'search', 'addWord', 'search', 'search', 'search', 'search'], args: [[], ['a'], ['a'], ['.'], ['a'], ['..'], ['aa']], expect: [null, false, null, true, true, false, false] },
        { ops: ['WordDictionary', 'addWord', 'addWord', 'search', 'search', 'search', 'search', 'search'], args: [[], ['at'], ['and'], ['a'], ['.at'], ['an.'], ['a.d.'], ['...']], expect: [null, null, null, false, false, true, false, true] },
        { ops: ['WordDictionary', 'addWord', 'search', 'search', 'search'], args: [[], ['abc'], ['ab'], ['abcd'], ['...']], expect: [null, null, false, false, true], why: 'The match must end exactly at a word end.' },
        { ops: ['WordDictionary', 'addWord', 'addWord', 'search', 'search'], args: [[], ['xyz'], ['xya'], ['xy.'], ['.y.']], expect: [null, null, null, true, true] },
        DICT_BIG,
      ],
      constraints: ['1 ≤ word.length ≤ 25', 'Queries contain at most 2 dots on LeetCode (the large test here has more)', 'At most 10⁴ calls'],
      hints: [
        'Without dots this is exactly the trie search. What should a dot do at a node?',
        'Try every child: the query matches if the rest of it matches below **any** child.',
        'Write search as DFS(node, index): a letter follows one edge; a dot loops over all non-null children; at the end, return node.end.',
      ],
      solution: {
        pattern: '**Trie + DFS for wildcards:** letters follow one edge; a wildcard branches into every child.',
        intuition: 'A plain character leaves exactly one path to follow. A «.» could be any letter, so explore every existing child and succeed if any branch matches the rest of the query. The trie keeps the branching limited to prefixes that actually exist.',
        java: J`class WordDictionary {
    private static class Node {
        Node[] next = new Node[26];
        boolean end;
    }
    private final Node root = new Node();

    public WordDictionary() {}

    public void addWord(String word) {
        Node cur = root;
        for (int i = 0; i < word.length(); i++) {
            int c = word.charAt(i) - 'a';
            if (cur.next[c] == null) cur.next[c] = new Node();
            cur = cur.next[c];
        }
        cur.end = true;
    }

    public boolean search(String word) {
        return dfs(root, word, 0);
    }

    private boolean dfs(Node node, String w, int i) {
        if (i == w.length()) return node.end;
        char ch = w.charAt(i);
        if (ch == '.') {
            for (Node child : node.next)
                if (child != null && dfs(child, w, i + 1)) return true;   // any child can play the dot
            return false;
        }
        Node child = node.next[ch - 'a'];
        return child != null && dfs(child, w, i + 1);
    }
}`,
        time: 'addWord O(L); search O(L) without dots, up to O(26^d · L) with d dots', space: 'O(total characters × 26)',
        pitfalls: M`
          - Returning true when the query runs out at a non-word node («ab» vs «abc»).
          - A dot must match exactly one letter, never zero.
        `,
        alts: [
          { name: 'Words bucketed by length', time: 'search O(words of that length × L)', space: 'O(total characters)', note: 'Map<length, List<String>>, then compare character by character. Simple, but linear in the bucket size. Fine when there are few words.',
            java: J`class WordDictionary {
    private final Map<Integer, List<String>> byLen = new HashMap<>();
    public WordDictionary() {}
    public void addWord(String word) { byLen.computeIfAbsent(word.length(), k -> new ArrayList<>()).add(word); }
    public boolean search(String q) {
        for (String w : byLen.getOrDefault(q.length(), List.of())) {
            int i = 0;
            while (i < q.length() && (q.charAt(i) == '.' || q.charAt(i) == w.charAt(i))) i++;
            if (i == q.length()) return true;
        }
        return false;
    }
}` },
        ],
        talk: 'A trie for storage. Search is DFS(node, i): a letter follows its child, a dot tries every non-null child, and at the end of the query return node.end. Plain searches are O(L); dots branch up to 26 ways each.',
      },
      lc: [lc(211, 'design-add-and-search-words-data-structure', 'Design Add and Search Words Data Structure', 'same'), lc(208, 'implement-trie-prefix-tree', 'Implement Trie (Prefix Tree)', 'easier'), lc(676, 'implement-magic-dictionary', 'Implement Magic Dictionary', 'variant'), lc(44, 'wildcard-matching', 'Wildcard Matching', 'harder')],
      drill: { prompt: 'Store words; answer queries where “.” matches any single letter.', pattern: 'trie', why: 'A trie with DFS: a wildcard branches into all children.' },
    } },

    { problem: {
      id: 'search-suggestions', title: 'Search Suggestions System', diff: 'medium',
      tags: ['trie', 'sorting', 'binary search'],
      statement: M`
        Given distinct «products» and a «searchWord», after typing each character of «searchWord» suggest up to **three** products that start with the typed prefix. If more than three match, return the three lexicographically smallest. Return the list of suggestion lists, one per typed character.
      `,
      fn: { name: 'suggestedProducts', params: [['String[]', 'products'], ['String', 'searchWord']], ret: 'List<List<String>>' },
      tests: [
        { args: [['mobile', 'mouse', 'moneypot', 'monitor', 'mousepad'], 'mouse'], ex: true,
          expect: [['mobile', 'moneypot', 'monitor'], ['mobile', 'moneypot', 'monitor'], ['mouse', 'mousepad'], ['mouse', 'mousepad'], ['mouse', 'mousepad']] },
        { args: [['havana'], 'havana'], ex: true, expect: [['havana'], ['havana'], ['havana'], ['havana'], ['havana'], ['havana']] },
        { args: [['bags', 'baggage', 'banner', 'box', 'cloths'], 'bags'], expect: [['baggage', 'bags', 'banner'], ['baggage', 'bags', 'banner'], ['baggage', 'bags'], ['bags']] },
        { args: [['havana'], 'tatiana'], expect: [[], [], [], [], [], [], []] },
        { args: [['a', 'ab', 'abc', 'abcd', 'b'], 'abz'], expect: [['a', 'ab', 'abc'], ['ab', 'abc', 'abcd'], []] },
        { args: [uniqueWords(3000, 1, 10, 'abcde', 605), 'abcdeabcde'], big: true },
        { args: [uniqueWords(3000, 1, 13, 'ab', 606), 'ababbabaabab'], big: true },
      ],
      constraints: ['1 ≤ products.length ≤ 1000 (large tests: 3000)', 'Products are distinct lowercase words', '1 ≤ searchWord.length ≤ 1000'],
      hints: [
        'If the products were sorted, where would all the words starting with a given prefix be?',
        'In one contiguous block. Binary search for the first word ≥ prefix, then take up to three that still start with it.',
        'Or build a trie where each node stores up to three smallest words passing through it (insert in sorted order).',
      ],
      solution: {
        pattern: '**Sorted array + binary search for a prefix block** (or a trie with top-3 lists at each node).',
        intuition: M`
          In sorted order, the words sharing a prefix are contiguous and start at the first word ≥ the prefix. So after sorting once, each typed prefix costs one binary search plus up to three «startsWith» checks. The prefix only grows, so the block's start only moves right, and you can even resume the search from the previous position.
        `,
        java: J`class Solution {
    public List<List<String>> suggestedProducts(String[] products, String searchWord) {
        String[] p = products.clone();
        Arrays.sort(p);
        List<List<String>> res = new ArrayList<>();
        int lo = 0;
        for (int len = 1; len <= searchWord.length(); len++) {
            String prefix = searchWord.substring(0, len);
            lo = lowerBound(p, lo, prefix);                 // first word >= prefix (never moves left)
            List<String> out = new ArrayList<>();
            for (int i = lo; i < p.length && i < lo + 3 && p[i].startsWith(prefix); i++) out.add(p[i]);
            res.add(out);
        }
        return res;
    }
    private int lowerBound(String[] a, int lo, String key) {
        int hi = a.length;
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (a[mid].compareTo(key) < 0) lo = mid + 1; else hi = mid;
        }
        return lo;
    }
}`,
        time: 'O(n log n · L) sort + O(m · (log n · L + 3L)) queries', space: 'O(n) (sorted copy)',
        pitfalls: M`
          - Stopping at the first non-matching word: the block is contiguous, so once one word fails «startsWith», the rest do too.
          - Once a prefix has no matches, every longer prefix has none, so all remaining lists are empty.
        `,
        alts: [
          { name: 'Trie with top-3 at each node', time: 'O(total characters) build + O(m) queries', space: 'O(total characters × 26)', note: 'Insert products in sorted order, appending to each node’s list while it has fewer than 3 entries. Queries just walk.',
            java: J`class Solution {
    private static class Node { Node[] next = new Node[26]; List<String> top = new ArrayList<>(); }
    public List<List<String>> suggestedProducts(String[] products, String searchWord) {
        String[] p = products.clone();
        Arrays.sort(p);
        Node root = new Node();
        for (String w : p) {
            Node cur = root;
            for (char ch : w.toCharArray()) {
                int c = ch - 'a';
                if (cur.next[c] == null) cur.next[c] = new Node();
                cur = cur.next[c];
                if (cur.top.size() < 3) cur.top.add(w);
            }
        }
        List<List<String>> res = new ArrayList<>();
        Node cur = root;
        for (char ch : searchWord.toCharArray()) {
            cur = cur == null ? null : cur.next[ch - 'a'];
            res.add(cur == null ? new ArrayList<>() : new ArrayList<>(cur.top));
        }
        return res;
    }
}` },
          { name: 'TreeSet ceiling', time: 'O(n log n) + O(m · log n · L)', space: 'O(n)', note: 'TreeSet.ceiling(prefix) is the first candidate; tailSet(prefix) iterates the next ones.',
            java: J`class Solution {
    public List<List<String>> suggestedProducts(String[] products, String searchWord) {
        TreeSet<String> set = new TreeSet<>(Arrays.asList(products));
        List<List<String>> res = new ArrayList<>();
        for (int len = 1; len <= searchWord.length(); len++) {
            String prefix = searchWord.substring(0, len);
            List<String> out = new ArrayList<>();
            for (String w : set.tailSet(prefix, true)) {
                if (out.size() == 3 || !w.startsWith(prefix)) break;
                out.add(w);
            }
            res.add(out);
        }
        return res;
    }
}` },
        ],
        talk: 'Sort once. Each prefix’s matches form a contiguous block starting at lowerBound(prefix); take up to 3 that start with it. The start only moves right as the prefix grows. Alternatively, a trie storing the three smallest words at each node.',
      },
      lc: [lc(1268, 'search-suggestions-system', 'Search Suggestions System', 'same'), lc(642, 'design-search-autocomplete-system', 'Design Search Autocomplete System', 'harder', { premium: true }), lc(208, 'implement-trie-prefix-tree', 'Implement Trie (Prefix Tree)', 'easier')],
      drill: { prompt: 'Autocomplete: after each typed character, the three smallest products with that prefix.', pattern: 'trie', why: 'Prefix block in a sorted list via binary search, or a trie storing the top 3 per node.' },
    } },

    { problem: {
      id: 'word-search-ii', title: 'Word Search II', diff: 'hard',
      tags: ['trie', 'backtracking', 'grid DFS'],
      statement: M`
        Given an «m × n» board of letters and a list of distinct «words», return every word that can be formed by a path of **adjacent** cells (up, down, left, right), using each cell at most once per word. Any order.
      `,
      fn: { name: 'findWords', params: [['char[][]', 'board'], ['String[]', 'words']], ret: 'List<String>' },
      compare: 'unordered',
      tests: [
        { args: [[['o', 'a', 'a', 'n'], ['e', 't', 'a', 'e'], ['i', 'h', 'k', 'r'], ['i', 'f', 'l', 'v']], ['oath', 'pea', 'eat', 'rain']], ex: true, expect: ['eat', 'oath'] },
        { args: [[['a', 'b'], ['c', 'd']], ['abcb']], ex: true, expect: [] },
        { args: [[['a']], ['a']], expect: ['a'] },
        { args: [[['a', 'a']], ['aaa']], expect: [], why: 'Each cell can be used once per word.' },
        { args: [[['a', 'b'], ['c', 'd']], ['ab', 'cb', 'ad', 'bd', 'ac', 'ca', 'da', 'bc', 'db', 'adcb', 'dabc', 'abb', 'acb']], expect: ['ab', 'bd', 'ac', 'ca', 'db'] },
        { args: [[['a', 'b', 'c'], ['a', 'e', 'd'], ['a', 'f', 'g']], ['abcdefg', 'gfedcbaaa', 'eaabcdgfa', 'befa', 'dgc', 'ade']], expect: ['abcdefg', 'gfedcbaaa', 'eaabcdgfa', 'befa'] },
        { args: [Array(12).fill('aaaaaaaaaaaa'), [...Array.from({ length: 10 }, (_, k) => 'a'.repeat(k + 1)), ...Array.from({ length: 9 }, (_, k) => 'a'.repeat(k + 1) + 'b')]], big: true, why: 'A board of identical letters: many paths share every prefix.' },
        { args: [randomBoard(12, 12, 'abcde', 607), uniqueWords(3000, 3, 10, 'abcde', 608)], big: true },
      ],
      constraints: ['1 ≤ m, n ≤ 12', '1 ≤ words.length ≤ 3·10⁴, distinct, length ≤ 10', 'Lowercase letters'],
      hints: [
        'Running Word Search I once per word repeats the same exploration for words that share prefixes.',
        'Put all words in a trie. Do one DFS from every cell, walking the trie alongside the board: a missing child means no word continues, so stop.',
        'Store the word at its end node; when you reach it, record it and clear it (no duplicates). Mark cells visited in place (e.g. set to «#») and restore on the way back.',
      ],
      solution: {
        pattern: '**Trie-guided backtracking:** one grid DFS explores all words at once, pruning any path that isn’t a prefix of some word.',
        intuition: M`
          The per-word approach redoes the same walks: "oath" and "oat" explore identical paths for three letters. A trie merges all words, so a single DFS from each cell follows the board and the trie together. It stops as soon as the path spells something no word starts with, and it collects every word whose end node it reaches. Removing found words (and dead branches) makes later searches faster.
        `,
        java: J`class Solution {
    private static class Node {
        Node[] next = new Node[26];
        String word;                           // non-null at the end of a word
    }

    public List<String> findWords(char[][] board, String[] words) {
        Node root = new Node();
        for (String w : words) {
            Node cur = root;
            for (char ch : w.toCharArray()) {
                int c = ch - 'a';
                if (cur.next[c] == null) cur.next[c] = new Node();
                cur = cur.next[c];
            }
            cur.word = w;
        }
        List<String> found = new ArrayList<>();
        for (int r = 0; r < board.length; r++)
            for (int c = 0; c < board[0].length; c++)
                dfs(board, r, c, root, found);
        return found;
    }

    private void dfs(char[][] b, int r, int c, Node parent, List<String> found) {
        if (r < 0 || c < 0 || r >= b.length || c >= b[0].length) return;
        char ch = b[r][c];
        if (ch == '#') return;                            // already on this path
        Node node = parent.next[ch - 'a'];
        if (node == null) return;                         // no word continues this way: prune
        if (node.word != null) { found.add(node.word); node.word = null; }   // record once
        b[r][c] = '#';
        dfs(b, r + 1, c, node, found);
        dfs(b, r - 1, c, node, found);
        dfs(b, r, c + 1, node, found);
        dfs(b, r, c - 1, node, found);
        b[r][c] = ch;                                     // restore
        if (isLeaf(node)) parent.next[ch - 'a'] = null;   // optional: drop exhausted branches
    }

    private boolean isLeaf(Node n) {
        if (n.word != null) return false;
        for (Node x : n.next) if (x != null) return false;
        return true;
    }
}`,
        time: 'O(m · n · 4 · 3^(L−1)) worst case, usually far less with pruning', space: 'O(total characters in words) for the trie',
        pitfalls: M`
          - Adding a word every time it's reached produces duplicates. Clear «node.word» after recording it.
          - Forgetting to restore the cell after the DFS corrupts later searches.
          - The per-word Word Search I approach times out on LeetCode with many words.
        `,
        alts: [
          { name: 'Word Search I for every word', time: 'O(words · m · n · 3^L)', space: 'O(L)', note: 'Correct, and the baseline to beat. Shared prefixes are explored again for each word.',
            java: J`class Solution {
    public List<String> findWords(char[][] board, String[] words) {
        List<String> res = new ArrayList<>();
        for (String w : words) if (exists(board, w)) res.add(w);
        return res;
    }
    private boolean exists(char[][] b, String w) {
        for (int r = 0; r < b.length; r++) for (int c = 0; c < b[0].length; c++) if (dfs(b, w, 0, r, c)) return true;
        return false;
    }
    private boolean dfs(char[][] b, String w, int i, int r, int c) {
        if (i == w.length()) return true;
        if (r < 0 || c < 0 || r >= b.length || c >= b[0].length || b[r][c] != w.charAt(i)) return false;
        char ch = b[r][c]; b[r][c] = '#';
        boolean ok = dfs(b, w, i + 1, r + 1, c) || dfs(b, w, i + 1, r - 1, c) || dfs(b, w, i + 1, r, c + 1) || dfs(b, w, i + 1, r, c - 1);
        b[r][c] = ch;
        return ok;
    }
}` },
        ],
        talk: 'Build a trie of the words, storing each word at its end node. DFS from every cell, walking the trie in parallel: stop when no child matches, record and clear the word at end nodes, mark cells visited in place and restore them. Optionally prune exhausted trie branches. One search covers every word.',
      },
      lc: [lc(212, 'word-search-ii', 'Word Search II', 'same'), lc(79, 'word-search', 'Word Search', 'easier'), lc(1032, 'stream-of-characters', 'Stream of Characters', 'harder')],
      drill: { prompt: 'Find which of thousands of words can be traced on a letter grid.', pattern: 'trie', why: 'A trie of the words guides one backtracking DFS; dead prefixes are pruned.' },
    } },

    { problem: {
      id: 'max-xor', title: 'Maximum XOR of Two Numbers', diff: 'medium',
      tags: ['bitwise trie', 'greedy by bit'],
      statement: M`
        Given non-negative integers «nums», return the maximum value of «nums[i] XOR nums[j]» over all pairs «i ≤ j».
      `,
      fn: { name: 'findMaximumXOR', params: [['int[]', 'nums']], ret: 'int' },
      tests: [
        { args: [[3, 10, 5, 25, 2, 8]], ex: true, expect: 28, why: '5 XOR 25 = 28.' },
        { args: [[14, 70, 53, 83, 49, 91, 36, 80, 92, 51, 66, 70]], ex: true, expect: 127 },
        { args: [[0]], expect: 0 },
        { args: [[1, 2]], expect: 3 },
        { args: [[8, 10, 2]], expect: 10 },
        { args: [[7, 7, 7]], expect: 0 },
        { args: [[2147483647, 0]], expect: 2147483647 },
        { args: [[1073741824, 1073741823]], expect: 2147483647 },
        { args: [{ $gen: 'ints', args: [200000, 0, 2147483647, 609] }], big: true },
        { args: [{ $gen: 'ints', args: [200000, 0, 1000000, 610] }], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 2·10⁵', '0 ≤ nums[i] ≤ 2³¹ − 1'],
      hints: [
        'Brute force over pairs is O(n²), 4·10¹⁰ here. Too slow.',
        'The answer is decided bit by bit from the top: a 1 in bit 30 beats anything in the lower bits. For a given x, you want a partner whose bit differs as high up as possible.',
        'Insert every number into a binary trie (bit 30 down to 0). For each x, walk down preferring the child with the opposite bit; each successful choice sets that bit of the XOR.',
      ],
      solution: {
        pattern: '**Bitwise trie + greedy by bit:** at each level, take the branch with the opposite bit if it exists.',
        intuition: M`
          XOR has a 1 wherever the bits differ, and higher bits dominate: 2ᵏ > 2ᵏ⁻¹ + … + 1. So for a fixed x, the best partner is found greedily from the top bit down. Always go to the opposite bit when some inserted number has it; otherwise follow the same bit. A binary trie of all the numbers makes each such walk 31 steps.
        `,
        java: J`class Solution {
    private static class Node { Node zero, one; }

    public int findMaximumXOR(int[] nums) {
        Node root = new Node();
        for (int x : nums) {                       // insert bits 30..0 (values are non-negative)
            Node cur = root;
            for (int b = 30; b >= 0; b--) {
                if (((x >> b) & 1) == 0) { if (cur.zero == null) cur.zero = new Node(); cur = cur.zero; }
                else { if (cur.one == null) cur.one = new Node(); cur = cur.one; }
            }
        }
        int best = 0;
        for (int x : nums) {
            Node cur = root;
            int xor = 0;
            for (int b = 30; b >= 0; b--) {
                int bit = (x >> b) & 1;
                Node want = bit == 0 ? cur.one : cur.zero;   // the opposite bit makes this XOR bit 1
                if (want != null) { xor |= 1 << b; cur = want; }
                else cur = bit == 0 ? cur.zero : cur.one;
            }
            best = Math.max(best, xor);
        }
        return best;
    }
}`,
        time: 'O(31 · n)', space: 'O(31 · n) trie nodes',
        pitfalls: M`
          - Starting at bit 31 for non-negative ints wastes a level; for general signed ints, you'd handle the sign bit separately.
          - Querying before inserting anything: insert all numbers first (or insert then query each x, since x XOR x = 0 is harmless).
        `,
        alts: [
          { name: 'Prefix hash set, bit by bit', time: 'O(31 · n)', space: 'O(n)', note: 'Build the answer from the top bit. Guess that the next bit is 1 and check with a HashSet of prefixes: a ^ b = candidate ⇔ a ^ candidate = b.',
            java: J`class Solution {
    public int findMaximumXOR(int[] nums) {
        int best = 0, mask = 0;
        for (int b = 30; b >= 0; b--) {
            mask |= 1 << b;
            Set<Integer> prefixes = new HashSet<>();
            for (int x : nums) prefixes.add(x & mask);
            int candidate = best | (1 << b);
            for (int p : prefixes)
                if (prefixes.contains(p ^ candidate)) { best = candidate; break; }
        }
        return best;
    }
}` },
          { name: 'All pairs', time: 'O(n²)', space: 'O(1)', java: J`class Solution {
    public int findMaximumXOR(int[] nums) {
        int best = 0;
        for (int i = 0; i < nums.length; i++)
            for (int j = i; j < nums.length; j++) best = Math.max(best, nums[i] ^ nums[j]);
        return best;
    }
}` },
        ],
        followups: M`
          - **Queries with a limit** (LeetCode 1707): sort queries by limit and insert numbers offline as the limit grows.
          - **Maximum XOR subarray**: a bitwise trie over prefix XORs, since subarray XOR = P[j] ^ P[i].
        `,
        talk: 'Higher bits dominate, so decide the XOR greedily from bit 30 down. Insert all numbers into a binary trie; for each x, walk down taking the opposite bit whenever that child exists (that bit of the XOR becomes 1). O(31·n).',
      },
      lc: [lc(421, 'maximum-xor-of-two-numbers-in-an-array', 'Maximum XOR of Two Numbers in an Array', 'same'), lc(1707, 'maximum-xor-with-an-element-from-array', 'Maximum XOR With an Element From Array', 'harder'), lc(1803, 'count-pairs-with-xor-in-a-range', 'Count Pairs With XOR in a Range', 'harder')],
      drill: { prompt: 'Largest XOR of any two numbers in a big array.', pattern: 'trie', why: 'A bitwise trie: greedily take the opposite bit from the top for each number.' },
    } },
  ],
});
})();

(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

DSA.module({
  id: 'linked-list', title: 'Linked Lists', short: 'Linked lists',
  blurb: 'Pointer surgery without losing nodes: dummy heads, in-place reversal, fast and slow pointers, and the LRU cache every interviewer loves.',
  intro: M`
    Linked-list problems are rarely about clever algorithms. They test whether you can rewire pointers **without losing a reference or dereferencing null**. A handful of moves covers almost everything: the dummy head, save-then-rewire reversal, fast/slow pointers, and splitting and merging. Draw boxes and arrows. Interviewers expect you to.
  `,
  more: [
    lc(83, 'remove-duplicates-from-sorted-list', 'Remove Duplicates from Sorted List', 'easier'),
    lc(203, 'remove-linked-list-elements', 'Remove Linked List Elements', 'easier'),
    lc(160, 'intersection-of-two-linked-lists', 'Intersection of Two Linked Lists', 'similar'),
    lc(92, 'reverse-linked-list-ii', 'Reverse Linked List II', 'variant'),
    lc(24, 'swap-nodes-in-pairs', 'Swap Nodes in Pairs', 'similar'),
    lc(328, 'odd-even-linked-list', 'Odd Even Linked List', 'similar'),
    lc(61, 'rotate-list', 'Rotate List', 'similar'),
    lc(148, 'sort-list', 'Sort List', 'harder'),
    lc(138, 'copy-list-with-random-pointer', 'Copy List with Random Pointer', 'harder'),
    lc(287, 'find-the-duplicate-number', 'Find the Duplicate Number', 'harder'),
    lc(2095, 'delete-the-middle-node-of-a-linked-list', 'Delete the Middle Node of a Linked List', 'similar'),
    lc(460, 'lfu-cache', 'LFU Cache', 'harder'),
  ],
  items: [
    { lesson: 'linked-lists', title: 'Linked lists: pointer surgery', mins: 13,
      lede: 'Five moves cover nearly every linked-list problem. Master them and the rest is careful bookkeeping.',
      body: M`
        ## The node
        ~~~java
        public class ListNode {
            int val;
            ListNode next;
            ListNode(int val) { this.val = val; }
        }
        ~~~
        You have no indices, only references. Reaching the k-th node costs k steps, and once you overwrite a «next» pointer, whatever it pointed to is gone unless you saved it.

        ## Move 1: the dummy head
        Whenever the head itself might change (you remove it, insert before it, or build a new list), start with a sentinel node before it. Every real node then has a predecessor, so there are no special cases. Return «dummy.next».
        ~~~java
        ListNode dummy = new ListNode(0), tail = dummy;
        // ... tail.next = someNode; tail = tail.next; ...
        return dummy.next;
        ~~~

        ## Move 2: reverse in place (save, flip, advance)
        @viz reverseList
        The order of the four assignments is the whole trick. Save «next» **before** overwriting «curr.next».

        ## Move 3: fast and slow pointers
        One pointer moves 1 step, the other 2 (or they start k apart):
        - **Middle:** when fast reaches the end, slow is in the middle.
        - **Cycle:** in a cycle, fast gains one step per iteration and must land on slow (Floyd). To find the cycle's **start**, reset one pointer to the head and step both by 1 until they meet.
        - **k-th from the end:** move fast k steps first, then move both; when fast hits null, slow is k from the end.

        @viz floydCycle

        :::key Why Floyd finds the cycle start
        Let the cycle start at distance «a» from the head, and let the pointers meet «b» steps into the cycle, whose length is «c». Slow walked «a + b»; fast walked «2(a + b)». The difference «a + b» is a whole number of laps, so «a + b ≡ 0 (mod c)», which gives «a ≡ c − b». Walking «a» more steps from the meeting point therefore lands exactly on the cycle start, and so does walking «a» steps from the head.
        :::

        ## Move 4: merge two sorted lists
        @viz mergeLists

        ## Move 5: split, process, reconnect
        Harder problems chain the moves: find the middle (fast/slow), reverse the second half, then merge or compare (reorder list, palindrome list); or cut the list into k-groups, reverse each, and stitch them back together.

        ## Recursion vs iteration
        Recursive solutions (recursive reverse, recursive merge) are elegant, but they use O(n) stack. With 10⁵ nodes, Java may throw «StackOverflowError», and in-browser Java allows only about 5,000 frames. Know the iterative version and mention the trade-off.

        ## Design: HashMap + doubly linked list
        A doubly linked list removes any node in O(1) **if you already hold a reference to it**, and a HashMap gives you that reference by key. Together they make LRU caches (and LFU caches, and O(1) "move to front" in general).

        ## Signals
        - "In place", "O(1) extra space" on a list → pointer rewiring, not copying into an array.
        - "Middle", "cycle", "k-th from end", "intersection" → fast/slow or two pointers.
        - "Reverse" (all, a sub-range, k-groups) → save/flip/advance.
        - "Merge k sorted lists" → a heap (Heaps module); "sort a list" → merge sort.
        - "O(1) get and put with eviction order" → HashMap + doubly linked list.

        :::warn Common bugs checklist
        - Dereferencing «null»: check «fast != null && fast.next != null» before «fast.next.next».
        - Losing the rest of the list: save «next» before rewiring.
        - Forgetting to terminate: set the new tail's «next = null», or you'll create a cycle.
        - Returning the old head after the head changed. The dummy head fixes this.
        :::

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'To find the middle of a list of length 6 (nodes 1..6), with slow and fast both starting at the head and the loop «while (fast != null && fast.next != null)», where does slow end?',
          options: ['Node 3', 'Node 4', 'Node 2', 'Node 5'],
          answer: 1, why: 'Slow moves to 2, 3, 4 while fast goes 3, 5, then null, so it ends on **node 4**, the second of the two middles. To get the first middle, start fast at head.next.' },
        { q: 'After Floyd’s pointers meet inside a cycle, how do you find the node where the cycle begins?',
          options: ['The meeting point is the start', 'Move one pointer to the head; advance both one step at a time; they meet at the start', 'Count the cycle length, then binary search', 'Reverse the list'],
          answer: 1, why: 'The head-to-start distance equals (a multiple of the cycle length minus) the meeting-point-to-start distance, so both pointers arrive at the start together.' },
      ],
      practice: ['reverse-list', 'merge-two-lists', 'linked-list-cycle', 'cycle-start', 'middle-of-list', 'palindrome-list', 'remove-nth-from-end', 'reorder-list', 'add-two-numbers', 'lru-cache', 'reverse-k-group'],
    },

    { problem: {
      id: 'reverse-list', title: 'Reverse a Linked List', diff: 'easy',
      tags: ['reversal', 'in place'],
      statement: M`
        Given the head of a singly linked list, reverse it **in place** and return the new head.
      `,
      fn: { name: 'reverseList', params: [['ListNode', 'head']], ret: 'ListNode' },
      tests: [
        { args: [[1, 2, 3, 4, 5]], ex: true, expect: [5, 4, 3, 2, 1] },
        { args: [[1, 2]], ex: true, expect: [2, 1] },
        { args: [[]], ex: true, expect: [] },
        { args: [[7]], expect: [7] },
        { args: [[3, 3, 1]], expect: [1, 3, 3] },
        { args: [{ $gen: 'list', args: [5000, -5000, 5000, 105] }], big: true },
      ],
      constraints: ['0 ≤ number of nodes ≤ 5000', '−5000 ≤ val ≤ 5000'],
      hints: [
        'Walk the list once. For each node, where should its «next» point after reversing?',
        'Back to the previous node. Keep a «prev» pointer, starting at null.',
        'Save «next» before you overwrite «curr.next», then advance both pointers.',
      ],
      solution: {
        pattern: '**Save, flip, advance:** the in-place reversal loop. It appears inside many harder problems (reorder, palindrome, k-group).',
        intuition: 'Reversing means every arrow points the other way. Walk forward with «prev» (the already-reversed part) and «curr»; flip «curr.next» to «prev», but save the old «next» first so you can keep walking.',
        java: J`class Solution {
    public ListNode reverseList(ListNode head) {
        ListNode prev = null, curr = head;
        while (curr != null) {
            ListNode next = curr.next;   // save
            curr.next = prev;            // flip
            prev = curr;                 // advance
            curr = next;
        }
        return prev;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - Returning «head» (now the tail) instead of «prev».
          - Overwriting «curr.next» before saving it loses the rest of the list.
        `,
        alts: [
          { name: 'Recursive', time: 'O(n)', space: 'O(n) stack', note: 'Reverse the rest, then hook the current node onto the end: «head.next.next = head; head.next = null». Elegant, but deep lists can overflow the stack.',
            java: J`class Solution {
    public ListNode reverseList(ListNode head) {
        if (head == null || head.next == null) return head;
        ListNode newHead = reverseList(head.next);
        head.next.next = head;      // the old next now points back to us
        head.next = null;
        return newHead;
    }
}` },
          { name: 'Copy into a stack/array, rebuild', time: 'O(n)', space: 'O(n)', check: false, note: 'Works, but it misses the point, since interviewers ask for in-place.' },
        ],
        followups: M`
          - **Reverse positions left..right** (LeetCode 92): walk to the node before «left», then reverse a fixed number of links.
          - **Reverse in k-groups** (hard, later in this module).
        `,
        talk: 'Iterate with prev and curr: save curr.next, point curr.next at prev, advance both. prev ends as the new head. O(n) time, O(1) space. A recursive version exists but uses O(n) stack.',
      },
      viz: { id: 'reverseList' },
      lc: [lc(206, 'reverse-linked-list', 'Reverse Linked List', 'same'), lc(92, 'reverse-linked-list-ii', 'Reverse Linked List II', 'harder'), lc(25, 'reverse-nodes-in-k-group', 'Reverse Nodes in k-Group', 'harder')],
      drill: { prompt: 'Reverse a singly linked list in place.', pattern: 'linked-list', why: 'Pointer rewiring: save next, flip, advance.' },
    } },

    { problem: {
      id: 'merge-two-lists', title: 'Merge Two Sorted Lists', diff: 'easy',
      tags: ['dummy head', 'merge'],
      statement: M`
        Given the heads of two sorted linked lists, merge them into **one sorted list** by relinking their nodes (don't create new nodes), and return its head.
      `,
      fn: { name: 'mergeTwoLists', params: [['ListNode', 'list1'], ['ListNode', 'list2']], ret: 'ListNode' },
      tests: [
        { args: [[1, 2, 4], [1, 3, 4]], ex: true, expect: [1, 1, 2, 3, 4, 4] },
        { args: [[], []], ex: true, expect: [] },
        { args: [[], [0]], ex: true, expect: [0] },
        { args: [[5], [1, 2, 3]], expect: [1, 2, 3, 5] },
        { args: [[1, 2, 3], [4, 5, 6]], expect: [1, 2, 3, 4, 5, 6] },
        { args: [[-10, -3, 0, 7], [-5, -3, 8]], expect: [-10, -5, -3, -3, 0, 7, 8] },
        { args: [{ $gen: 'sortedList', args: [50000, -100000, 100000, 107] }, { $gen: 'sortedList', args: [50000, -100000, 100000, 108] }], big: true },
      ],
      constraints: ['0 ≤ list lengths ≤ 5·10⁴ (LeetCode: 50)', 'Both lists are sorted non-decreasing'],
      hints: [
        'Compare the two front nodes. Which one comes first in the result?',
        'Use a dummy head and a «tail» pointer; attach the smaller front node to «tail.next» and advance that list.',
        'When one list runs out, attach the rest of the other in a single step.',
      ],
      solution: {
        pattern: '**Dummy head + tail pointer:** the building block for merge sort on lists and for merging k lists.',
        intuition: 'The smallest remaining element is always at the front of one of the two lists. Repeatedly move the smaller front node to the end of the result. The dummy node means the first attachment needs no special case.',
        java: J`class Solution {
    public ListNode mergeTwoLists(ListNode a, ListNode b) {
        ListNode dummy = new ListNode(0), tail = dummy;
        while (a != null && b != null) {
            if (a.val <= b.val) { tail.next = a; a = a.next; }
            else { tail.next = b; b = b.next; }
            tail = tail.next;
        }
        tail.next = (a != null) ? a : b;        // the leftover is already sorted
        return dummy.next;
    }
}`,
        time: 'O(n + m)', space: 'O(1)',
        pitfalls: M`
          - Looping until *both* are null with per-node checks is clumsy. Attach the leftover in one step.
          - Using «<» instead of «<=» still merges correctly, but «<=» keeps the merge stable (equal keys from list1 first).
        `,
        alts: [
          { name: 'Recursive merge', time: 'O(n + m)', space: 'O(n + m) stack', note: 'The smaller head points to the merge of the rest. Beautiful, but deep recursion on long lists.',
            java: J`class Solution {
    public ListNode mergeTwoLists(ListNode a, ListNode b) {
        if (a == null) return b;
        if (b == null) return a;
        if (a.val <= b.val) { a.next = mergeTwoLists(a.next, b); return a; }
        b.next = mergeTwoLists(a, b.next);
        return b;
    }
}`, check: false },
        ],
        followups: M`
          - **Merge k sorted lists:** a min-heap of the k heads (Heaps module), or merge pairwise in log k rounds.
          - **Sort a linked list** (LeetCode 148): merge sort, where splitting uses fast/slow and joining uses this function.
        `,
        talk: 'A dummy head and a tail pointer. While both lists have nodes, attach the smaller front node and advance; then attach the leftover in one step. O(n + m) time, O(1) space.',
      },
      viz: { id: 'mergeLists' },
      lc: [lc(21, 'merge-two-sorted-lists', 'Merge Two Sorted Lists', 'same'), lc(88, 'merge-sorted-array', 'Merge Sorted Array', 'similar'), lc(23, 'merge-k-sorted-lists', 'Merge k Sorted Lists', 'harder'), lc(148, 'sort-list', 'Sort List', 'harder')],
      drill: { prompt: 'Combine two sorted linked lists into one sorted list by relinking nodes.', pattern: 'linked-list', why: 'Dummy head plus tail pointer; attach the smaller front node each step.' },
    } },

    { problem: {
      id: 'linked-list-cycle', title: 'Does the List Loop?', diff: 'easy',
      tags: ['fast & slow', 'Floyd'],
      statement: M`
        Given the head of a linked list, return «true» if following «next» pointers ever revisits a node (the list has a **cycle**), otherwise «false».

        In the tests, «pos» is the index of the node the tail links back to («−1» for no cycle). **Your method only receives «head»**; «pos» just describes the input. Use O(1) extra memory.
      `,
      fn: { name: 'hasCycle', params: [['ListNode', 'head'], ['int', 'pos', { hidden: true }]], ret: 'boolean' },
      prep: '__CL.cycle(a0, a1);',
      tests: [
        { args: [[3, 2, 0, -4], 1], ex: true, expect: true, why: 'The tail links back to the node at index 1.' },
        { args: [[1, 2], 0], ex: true, expect: true },
        { args: [[1], -1], ex: true, expect: false },
        { args: [[], -1], expect: false },
        { args: [[1], 0], expect: true, why: 'A single node pointing to itself.' },
        { args: [[1, 2, 3, 4, 5], -1], expect: false },
        { args: [[1, 2, 3, 4, 5], 4], expect: true },
        { args: [{ $gen: 'list', args: [100000, 0, 9, 109] }, 12345], big: true, expect: true },
        { args: [{ $gen: 'list', args: [100000, 0, 9, 110] }, -1], big: true, expect: false },
      ],
      constraints: ['0 ≤ nodes ≤ 10⁵ (LeetCode: 10⁴)', 'pos is −1 or a valid index'],
      hints: [
        'A «HashSet» of visited nodes works, but uses O(n) memory. How else can you tell a loop from an end?',
        'Two runners on a circular track, one twice as fast: what happens?',
        'Move «slow» 1 step and «fast» 2 steps. If fast reaches null, there’s no cycle; if they ever point to the same node, there is.',
      ],
      solution: {
        pattern: '**Floyd’s tortoise and hare:** cycle detection in O(1) space. It also applies to any sequence x → f(x) (duplicate number, happy number).',
        intuition: 'If there’s no cycle, the fast pointer hits the end. If there is one, both pointers eventually enter it, and each iteration the fast one closes the gap by exactly one step, so it can’t jump over slow and must land on it within one lap.',
        java: J`class Solution {
    public boolean hasCycle(ListNode head) {
        ListNode slow = head, fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            if (slow == fast) return true;        // compare references, not values
        }
        return false;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - Comparing «slow.val == fast.val» gives false positives with duplicate values. Compare node references.
          - «fast.next.next» without checking «fast.next != null» throws on even-length lists.
        `,
        alts: [
          { name: 'HashSet of visited nodes', time: 'O(n)', space: 'O(n)', java: J`class Solution {
    public boolean hasCycle(ListNode head) {
        Set<ListNode> seen = new HashSet<>();
        for (ListNode n = head; n != null; n = n.next) if (!seen.add(n)) return true;
        return false;
    }
}` },
        ],
        followups: M`
          - **Where does the cycle start?** (next problem). **How long is it?** After meeting, keep one pointer fixed and count steps until the other returns.
          - **Find the duplicate number** in «[1..n]» (LeetCode 287): treat «i → nums[i]» as a linked list and apply Floyd.
        `,
        talk: 'Floyd’s algorithm: slow moves one step, fast two. Without a cycle fast hits null; with one, fast gains one step per iteration inside the loop and must meet slow. O(n) time, O(1) space.',
      },
      viz: { id: 'floydCycle' },
      lc: [lc(141, 'linked-list-cycle', 'Linked List Cycle', 'same'), lc(142, 'linked-list-cycle-ii', 'Linked List Cycle II', 'harder'), lc(202, 'happy-number', 'Happy Number', 'similar'), lc(287, 'find-the-duplicate-number', 'Find the Duplicate Number', 'harder')],
      drill: { prompt: 'Detect whether a linked list loops back on itself, using O(1) memory.', pattern: 'fast-slow', why: 'Floyd’s tortoise and hare: a fast pointer laps a slow one inside a cycle.' },
    } },

    { problem: {
      id: 'cycle-start', title: 'Where Does the Loop Begin?', diff: 'medium',
      tags: ['fast & slow', 'Floyd phase 2'],
      statement: M`
        Given the head of a linked list, return the **node where its cycle begins**, or «null» if there is no cycle. Don't modify the list, and use O(1) extra memory.

        As before, «pos» describes the input (the index the tail links to) and isn't passed to your method. The grader reports the index of the node you return («−1» for null).
      `,
      fn: { name: 'detectCycle', params: [['ListNode', 'head'], ['int', 'pos', { hidden: true }]], ret: 'ListNode' },
      prep: '__CL.cycle(a0, a1);',
      post: '__CL.indexOf(a0, r)',
      tests: [
        { args: [[3, 2, 0, -4], 1], ex: true, expect: 1 },
        { args: [[1, 2], 0], ex: true, expect: 0 },
        { args: [[1], -1], ex: true, expect: -1 },
        { args: [[], -1], expect: -1 },
        { args: [[1], 0], expect: 0 },
        { args: [[1, 2, 3, 4, 5, 6], 3], expect: 3 },
        { args: [[1, 2, 3, 4, 5, 6], 5], expect: 5 },
        { args: [[1, 1, 1, 1], 2], expect: 2, why: 'Values repeat, so you must compare nodes, not values.' },
        { args: [{ $gen: 'list', args: [100000, 0, 9, 111] }, 777], big: true, expect: 777 },
        { args: [{ $gen: 'list', args: [100000, 0, 9, 112] }, -1], big: true, expect: -1 },
      ],
      constraints: ['0 ≤ nodes ≤ 10⁵', 'pos is −1 or a valid index'],
      hints: [
        'First detect the cycle with slow and fast pointers. Where can they meet?',
        'Let a = distance from the head to the cycle start, b = distance from the start to the meeting point, and c = cycle length. Slow walked a + b; fast walked 2(a + b). What does that imply?',
        'a + b is a multiple of c, so walking a steps from the meeting point reaches the start. Reset one pointer to the head and move both one step at a time; they meet at the start.',
      ],
      solution: {
        pattern: '**Floyd, phase 2:** after the meeting, "head and meeting point are equally far from the cycle start (mod c)".',
        intuition: M`
          When the pointers meet, fast has travelled exactly twice as far as slow, and the extra distance «a + b» is a whole number of laps. So from the meeting point, «a» more steps completes a lap back to the start. A pointer walking «a» steps from the head also arrives at the start. Walk both in lockstep and the first node they share is the answer, without ever knowing «a».
        `,
        java: J`class Solution {
    public ListNode detectCycle(ListNode head) {
        ListNode slow = head, fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            if (slow == fast) {                       // phase 1: inside the cycle
                ListNode p = head;
                while (p != slow) { p = p.next; slow = slow.next; }   // phase 2
                return p;
            }
        }
        return null;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        why: 'Slow travels a + b and fast travels 2(a + b) = a + b + kc, so a + b = kc and a = kc − b. From the meeting point, walking a steps goes kc − b steps around the cycle, landing on the start.',
        pitfalls: M`
          - Starting phase 2 before confirming a meeting (when there's no cycle) dereferences null.
          - Returning the meeting point itself: it's generally *not* the start.
        `,
        alts: [
          { name: 'HashSet: first revisited node', time: 'O(n)', space: 'O(n)', java: J`class Solution {
    public ListNode detectCycle(ListNode head) {
        Set<ListNode> seen = new HashSet<>();
        for (ListNode n = head; n != null; n = n.next) if (!seen.add(n)) return n;
        return null;
    }
}` },
        ],
        talk: 'Floyd: find a meeting point with slow and fast. The distance from the head to the cycle start equals the distance from the meeting point to the start, mod the cycle length, so I restart one pointer at the head and step both by one; they meet at the start. O(n), O(1) space.',
      },
      viz: { id: 'floydCycle', input: { vals: [3, 2, 0, -4, 7, 9], pos: 2 } },
      lc: [lc(142, 'linked-list-cycle-ii', 'Linked List Cycle II', 'same'), lc(287, 'find-the-duplicate-number', 'Find the Duplicate Number', 'variant'), lc(141, 'linked-list-cycle', 'Linked List Cycle', 'easier')],
      drill: { prompt: 'Return the node where a linked list’s cycle starts, with O(1) memory.', pattern: 'fast-slow', why: 'Floyd phase 2: after meeting, advance a pointer from the head and one from the meeting point in lockstep.' },
    } },

    { problem: {
      id: 'middle-of-list', title: 'Middle of the List', diff: 'easy',
      tags: ['fast & slow'],
      statement: M`
        Return the **middle node** of a non-empty linked list. With an even number of nodes there are two middles; return the **second** one. (The grader prints the list from the node you return.)
      `,
      fn: { name: 'middleNode', params: [['ListNode', 'head']], ret: 'ListNode' },
      tests: [
        { args: [[1, 2, 3, 4, 5]], ex: true, expect: [3, 4, 5] },
        { args: [[1, 2, 3, 4, 5, 6]], ex: true, expect: [4, 5, 6], why: 'Two middles (3 and 4): return the second.' },
        { args: [[1]], expect: [1] },
        { args: [[1, 2]], expect: [2] },
        { args: [[1, 2, 3]], expect: [2, 3] },
        { args: [{ $gen: 'list', args: [99999, 0, 99, 113] }], big: true },
      ],
      constraints: ['1 ≤ nodes ≤ 10⁵ (LeetCode: 100)'],
      hints: [
        'Counting the nodes and then walking to n/2 takes two passes. Can one pass do it?',
        'If one pointer moves twice as fast as another, where is the slow one when the fast one finishes?',
        'Loop while «fast != null && fast.next != null»: slow ends on the second middle.',
      ],
      solution: {
        pattern: '**Fast & slow for the middle:** used to split lists for merge sort, palindrome checks and reordering.',
        intuition: 'Fast covers twice the distance of slow. When fast has walked the whole list, slow has walked half of it.',
        java: J`class Solution {
    public ListNode middleNode(ListNode head) {
        ListNode slow = head, fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
        }
        return slow;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - To get the **first** middle (needed when splitting a list into two halves for merge sort), start «fast = head.next», or loop while «fast.next != null && fast.next.next != null».
        `,
        alts: [
          { name: 'Count, then walk', time: 'O(n)', space: 'O(1)', java: J`class Solution {
    public ListNode middleNode(ListNode head) {
        int n = 0;
        for (ListNode p = head; p != null; p = p.next) n++;
        ListNode p = head;
        for (int i = 0; i < n / 2; i++) p = p.next;
        return p;
    }
}` },
        ],
        talk: 'Slow moves one step and fast two; when fast can’t move further, slow is at the middle (the second of two middles). One pass, O(1) space.',
      },
      lc: [lc(876, 'middle-of-the-linked-list', 'Middle of the Linked List', 'same'), lc(2095, 'delete-the-middle-node-of-a-linked-list', 'Delete the Middle Node of a Linked List', 'variant'), lc(234, 'palindrome-linked-list', 'Palindrome Linked List', 'harder')],
      drill: { prompt: 'Find the middle node of a linked list in one pass.', pattern: 'fast-slow', why: 'Fast moves 2, slow moves 1; slow is in the middle when fast finishes.' },
    } },

    { problem: {
      id: 'palindrome-list', title: 'Palindrome Linked List', diff: 'easy',
      tags: ['fast & slow', 'reversal'],
      statement: M`
        Return «true» if a singly linked list reads the same forwards and backwards. Try for O(n) time and **O(1) extra space**.
      `,
      fn: { name: 'isPalindrome', params: [['ListNode', 'head']], ret: 'boolean' },
      tests: [
        { args: [[1, 2, 2, 1]], ex: true, expect: true },
        { args: [[1, 2]], ex: true, expect: false },
        { args: [[1]], expect: true },
        { args: [[1, 2, 1]], expect: true },
        { args: [[1, 2, 3, 2, 2]], expect: false },
        { args: [[5, 5]], expect: true },
        { args: [[1, 0, 0]], expect: false },
        { args: [{ $gen: 'list', args: [100000, 0, 9, 114] }], big: true },
      ],
      constraints: ['1 ≤ nodes ≤ 10⁵', '0 ≤ val ≤ 9'],
      hints: [
        'Copying the values into an array makes it easy, but uses O(n) space.',
        'Compare the first half with the **reversed** second half.',
        'Find the middle (fast/slow), reverse the second half in place, compare node by node, then (politely) reverse it back.',
      ],
      solution: {
        pattern: '**Chain the moves:** middle (fast/slow) → reverse the second half → compare. It’s the template for "operate on both halves" list problems.',
        intuition: 'A palindrome’s second half, reversed, equals its first half. Reversing in place costs O(1) space, and we can restore the list afterwards.',
        java: J`class Solution {
    public boolean isPalindrome(ListNode head) {
        ListNode slow = head, fast = head;
        while (fast != null && fast.next != null) { slow = slow.next; fast = fast.next.next; }
        ListNode second = reverse(slow);           // second half, reversed
        ListNode p = head, q = second;
        boolean ok = true;
        while (q != null) {                        // second half is never longer
            if (p.val != q.val) { ok = false; break; }
            p = p.next; q = q.next;
        }
        reverse(second);                           // restore the input
        return ok;
    }

    private ListNode reverse(ListNode head) {
        ListNode prev = null;
        while (head != null) { ListNode next = head.next; head.next = prev; prev = head; head = next; }
        return prev;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - With an odd length, the middle node belongs to both "halves" in this version. Comparing until the reversed half ends handles it.
          - Mutating the input without restoring it can surprise callers. Mention it and restore it.
        `,
        alts: [
          { name: 'Copy to an array, two pointers', time: 'O(n)', space: 'O(n)', java: J`class Solution {
    public boolean isPalindrome(ListNode head) {
        List<Integer> v = new ArrayList<>();
        for (ListNode p = head; p != null; p = p.next) v.add(p.val);
        for (int i = 0, j = v.size() - 1; i < j; i++, j--) if (!v.get(i).equals(v.get(j))) return false;
        return true;
    }
}` },
        ],
        talk: 'Find the middle with fast/slow, reverse the second half in place, walk both halves comparing values, then reverse the second half back. O(n) time, O(1) extra space.',
      },
      lc: [lc(234, 'palindrome-linked-list', 'Palindrome Linked List', 'same'), lc(2130, 'maximum-twin-sum-of-a-linked-list', 'Maximum Twin Sum of a Linked List', 'variant'), lc(143, 'reorder-list', 'Reorder List', 'harder')],
      drill: { prompt: 'Check whether a singly linked list is a palindrome using O(1) extra space.', pattern: 'fast-slow', why: 'Find the middle with fast/slow, reverse the second half, compare.' },
    } },

    { problem: {
      id: 'remove-nth-from-end', title: 'Remove the n-th Node From the End', diff: 'medium',
      tags: ['two pointers', 'dummy head'],
      statement: M`
        Remove the «n»-th node from the **end** of a linked list and return the head. Can you do it in one pass?
      `,
      fn: { name: 'removeNthFromEnd', params: [['ListNode', 'head'], ['int', 'n']], ret: 'ListNode' },
      tests: [
        { args: [[1, 2, 3, 4, 5], 2], ex: true, expect: [1, 2, 3, 5] },
        { args: [[1], 1], ex: true, expect: [] },
        { args: [[1, 2], 1], ex: true, expect: [1] },
        { args: [[1, 2], 2], expect: [2], why: 'Removing the head, which the dummy node makes routine.' },
        { args: [[1, 2, 3], 3], expect: [2, 3] },
        { args: [[1, 2, 3, 4], 1], expect: [1, 2, 3] },
        { args: [{ $gen: 'list', args: [100000, 0, 99, 115] }, 50000], big: true },
      ],
      constraints: ['1 ≤ nodes ≤ 10⁵ (LeetCode: 30)', '1 ≤ n ≤ number of nodes'],
      hints: [
        'Two passes: count the length L, then remove node L − n + 1. For one pass, how can you know you’re n from the end?',
        'Keep two pointers exactly n + 1 nodes apart. When the front one falls off the end, the back one is just before the target.',
        'Start both at a dummy node before the head, so removing the head needs no special case.',
      ],
      solution: {
        pattern: '**Two pointers with a fixed gap:** "k-th from the end" in one pass. The dummy node handles removing the head.',
        intuition: 'If «fast» is n + 1 steps ahead of «slow», then when fast reaches null, slow is n + 1 from the end, which is right before the node to delete. Unlink it.',
        java: J`class Solution {
    public ListNode removeNthFromEnd(ListNode head, int n) {
        ListNode dummy = new ListNode(0);
        dummy.next = head;
        ListNode slow = dummy, fast = dummy;
        for (int i = 0; i <= n; i++) fast = fast.next;     // gap of n + 1
        while (fast != null) { slow = slow.next; fast = fast.next; }
        slow.next = slow.next.next;                        // unlink the target
        return dummy.next;
    }
}`,
        time: 'O(L)', space: 'O(1)',
        pitfalls: M`
          - Without the dummy node, removing the head (n = L) needs a special case, and it's easy to return the removed head.
          - A gap of n (instead of n + 1) leaves slow *on* the target rather than before it.
        `,
        alts: [
          { name: 'Two passes (count first)', time: 'O(L)', space: 'O(1)', java: J`class Solution {
    public ListNode removeNthFromEnd(ListNode head, int n) {
        int len = 0;
        for (ListNode p = head; p != null; p = p.next) len++;
        ListNode dummy = new ListNode(0);
        dummy.next = head;
        ListNode p = dummy;
        for (int i = 0; i < len - n; i++) p = p.next;
        p.next = p.next.next;
        return dummy.next;
    }
}` },
        ],
        talk: 'A dummy node, then fast moves n+1 steps ahead; move both until fast is null, and slow is just before the n-th from the end, so I unlink slow.next. One pass, O(1) space, and the head needs no special case.',
      },
      viz: { id: 'removeNth' },
      lc: [lc(19, 'remove-nth-node-from-end-of-list', 'Remove Nth Node From End of List', 'same'), lc(1721, 'swapping-nodes-in-a-linked-list', 'Swapping Nodes in a Linked List', 'variant'), lc(61, 'rotate-list', 'Rotate List', 'similar')],
      drill: { prompt: 'Delete the n-th node from the end of a linked list in one pass.', pattern: 'fast-slow', why: 'Two pointers n+1 apart (plus a dummy head): when the front hits null, the back is before the target.' },
    } },

    { problem: {
      id: 'reorder-list', title: 'Interleave From Both Ends', diff: 'medium',
      tags: ['middle', 'reverse', 'merge'],
      statement: M`
        Given a list «L0 → L1 → … → Ln−1 → Ln», reorder it **in place** to «L0 → Ln → L1 → Ln−1 → L2 → Ln−2 → …». Change the links, not the values. The method returns nothing; the grader reads the list from the original head.
      `,
      fn: { name: 'reorderList', params: [['ListNode', 'head']], ret: 'void' },
      tests: [
        { args: [[1, 2, 3, 4]], ex: true, expect: [1, 4, 2, 3] },
        { args: [[1, 2, 3, 4, 5]], ex: true, expect: [1, 5, 2, 4, 3] },
        { args: [[1]], expect: [1] },
        { args: [[1, 2]], expect: [1, 2] },
        { args: [[1, 2, 3]], expect: [1, 3, 2] },
        { args: [[10, 20, 30, 40, 50, 60]], expect: [10, 60, 20, 50, 30, 40] },
        { args: [{ $gen: 'list', args: [50000, 0, 1000, 117] }], big: true },
      ],
      constraints: ['1 ≤ nodes ≤ 5·10⁴', 'Modify the links, not the values'],
      hints: [
        'The pattern alternates between the first half (forward) and the second half (backward).',
        'Split at the middle, reverse the second half, then merge the two halves by alternating nodes.',
        'Cut the first half off (set the middle’s «next» to null) or you’ll create a cycle.',
      ],
      solution: {
        pattern: '**Split → reverse → weave:** three linked-list moves chained together. A favourite for testing pointer discipline.',
        intuition: 'The output takes one node from the front, then one from the back, repeatedly. Reversing the back half turns "from the back" into "from the front of a second list", and interleaving two lists is easy.',
        java: J`class Solution {
    public void reorderList(ListNode head) {
        if (head == null || head.next == null) return;
        ListNode slow = head, fast = head;                 // 1. find the end of the first half
        while (fast.next != null && fast.next.next != null) { slow = slow.next; fast = fast.next.next; }
        ListNode second = reverse(slow.next);              // 2. reverse the second half
        slow.next = null;                                  //    and cut it off
        ListNode first = head;                             // 3. weave
        while (second != null) {
            ListNode n1 = first.next, n2 = second.next;
            first.next = second;
            second.next = n1;
            first = n1;
            second = n2;
        }
    }

    private ListNode reverse(ListNode head) {
        ListNode prev = null;
        while (head != null) { ListNode next = head.next; head.next = prev; prev = head; head = next; }
        return prev;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - Forgetting «slow.next = null» leaves the first half pointing into the reversed second half, which creates a cycle.
          - Using the "second middle" split makes the second half longer, so the weave loop's termination needs care. Splitting after the first middle keeps the second half no longer than the first.
        `,
        alts: [
          { name: 'Array of nodes + two pointers', time: 'O(n)', space: 'O(n)', note: 'Put the nodes in an ArrayList, then relink i and j from both ends. Simple and a good fallback.',
            java: J`class Solution {
    public void reorderList(ListNode head) {
        List<ListNode> nodes = new ArrayList<>();
        for (ListNode p = head; p != null; p = p.next) nodes.add(p);
        int i = 0, j = nodes.size() - 1;
        while (i < j) {
            nodes.get(i).next = nodes.get(j);
            i++;
            if (i == j) break;
            nodes.get(j).next = nodes.get(i);
            j--;
        }
        nodes.get(i).next = null;
    }
}` },
        ],
        talk: 'Three moves: find the middle with fast/slow, reverse the second half and cut it off, then weave the two lists alternately. O(n) time, O(1) space.',
      },
      lc: [lc(143, 'reorder-list', 'Reorder List', 'same'), lc(234, 'palindrome-linked-list', 'Palindrome Linked List', 'easier'), lc(328, 'odd-even-linked-list', 'Odd Even Linked List', 'similar')],
      drill: { prompt: 'Rearrange L0→L1→…→Ln into L0→Ln→L1→Ln−1→… in place.', pattern: 'linked-list', why: 'Find the middle, reverse the second half, then weave the two halves.' },
    } },

    { problem: {
      id: 'add-two-numbers', title: 'Add Numbers Stored as Lists', diff: 'medium',
      tags: ['dummy head', 'carry'],
      statement: M`
        Two non-negative integers are stored as linked lists of digits in **reverse order** (the ones digit first): «2 → 4 → 3» is 342. Return their sum as a list in the same format. There are no leading zeros, except for the number 0 itself.
      `,
      fn: { name: 'addTwoNumbers', params: [['ListNode', 'l1'], ['ListNode', 'l2']], ret: 'ListNode' },
      tests: [
        { args: [[2, 4, 3], [5, 6, 4]], ex: true, expect: [7, 0, 8], why: '342 + 465 = 807.' },
        { args: [[0], [0]], ex: true, expect: [0] },
        { args: [[9, 9, 9, 9, 9, 9, 9], [9, 9, 9, 9]], ex: true, expect: [8, 9, 9, 9, 0, 0, 0, 1] },
        { args: [[5], [5]], expect: [0, 1], why: 'The final carry creates a new digit.' },
        { args: [[1, 8], [0]], expect: [1, 8] },
        { args: [[9], [1, 9, 9]], expect: [0, 0, 0, 1] },
        { args: [{ $gen: 'list', args: [30000, 0, 9, 119] }, { $gen: 'list', args: [20000, 0, 9, 120] }], big: true },
      ],
      constraints: ['1 ≤ each length ≤ 3·10⁴ (LeetCode: 100)', 'Digits 0–9, no leading zeros'],
      hints: [
        'The digits are in the right order for grade-school addition: least significant first.',
        'Walk both lists at once, adding digits plus a carry. The new digit is «sum % 10», and the carry is «sum / 10».',
        'Keep going while either list has nodes **or** the carry is non-zero. Use a dummy head for the result.',
      ],
      solution: {
        pattern: '**Simultaneous traversal with carry:** grade-school arithmetic on lists. Never convert to «int»/«long», since the numbers can have thousands of digits.',
        intuition: 'Reverse-order storage makes addition natural: process digit by digit from the ones place, carrying into the next position, exactly as on paper.',
        java: J`class Solution {
    public ListNode addTwoNumbers(ListNode l1, ListNode l2) {
        ListNode dummy = new ListNode(0), tail = dummy;
        int carry = 0;
        while (l1 != null || l2 != null || carry != 0) {
            int sum = carry;
            if (l1 != null) { sum += l1.val; l1 = l1.next; }
            if (l2 != null) { sum += l2.val; l2 = l2.next; }
            tail.next = new ListNode(sum % 10);
            tail = tail.next;
            carry = sum / 10;
        }
        return dummy.next;
    }
}`,
        time: 'O(max(m, n))', space: 'O(max(m, n)) for the output',
        pitfalls: M`
          - Converting to «long» overflows after 19 digits. «BigInteger» works, but misses the point.
          - Dropping the final carry: «[5] + [5]» must give «[0, 1]».
        `,
        alts: [
          { name: 'Recursive digit add', time: 'O(max(m, n))', space: 'O(max(m, n)) stack', check: false, note: 'add(l1, l2, carry) returns a node with the digit and next = add(rest, newCarry). Clean, but deep for long numbers.' },
        ],
        followups: M`
          - **Most significant digit first** (LeetCode 445): reverse both lists, add, reverse the result; or use two stacks.
          - **Multiply** (LeetCode 43, strings): O(m·n) digit products into a result array.
        `,
        talk: 'Walk both lists together with a carry, create a node with sum mod 10, and carry sum/10. Continue while either list or the carry remains. A dummy head avoids special cases. O(max(m, n)).',
      },
      lc: [lc(2, 'add-two-numbers', 'Add Two Numbers', 'same'), lc(445, 'add-two-numbers-ii', 'Add Two Numbers II', 'variant'), lc(67, 'add-binary', 'Add Binary', 'easier'), lc(415, 'add-strings', 'Add Strings', 'easier')],
      drill: { prompt: 'Add two big numbers stored as reversed digit lists.', pattern: 'linked-list', why: 'Walk both lists with a carry, building the result behind a dummy head.' },
    } },

    { problem: {
      id: 'lru-cache', title: 'LRU Cache', diff: 'medium',
      tags: ['design', 'hash map', 'doubly linked list'],
      statement: M`
        Design an «LRUCache» with a fixed «capacity»:

        - «get(key)» returns the value if the key exists (and marks it as recently used), otherwise «−1».
        - «put(key, value)» inserts or updates the key (marking it recently used). If this makes the cache exceed its capacity, evict the **least recently used** key.

        Both operations must be **O(1)** on average. Build it yourself: a hash map plus your own doubly linked list. «LinkedHashMap» is the easy way out (mention it, but don't use it).
      `,
      design: { cls: 'LRUCache', ctor: [['int', 'capacity']], methods: { get: { params: [['int', 'key']], ret: 'int' }, put: { params: [['int', 'key'], ['int', 'value']], ret: 'void' } } },
      tests: [
        { ex: true, ops: ['LRUCache', 'put', 'put', 'get', 'put', 'get', 'put', 'get', 'get', 'get'], args: [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]], expect: [null, null, null, 1, null, -1, null, -1, 3, 4], why: 'get(1) makes 1 recent, so put(3) evicts 2; put(4) then evicts 1.' },
        { ops: ['LRUCache', 'put', 'get', 'put', 'get', 'get'], args: [[1], [2, 1], [2], [3, 2], [2], [3]], expect: [null, null, 1, null, -1, 2] },
        { ops: ['LRUCache', 'put', 'put', 'put', 'put', 'get', 'get'], args: [[2], [2, 1], [1, 1], [2, 3], [4, 1], [1], [2]], expect: [null, null, null, null, null, -1, 3], why: 'Updating key 2 makes it recent, so key 1 is evicted.' },
        { ops: ['LRUCache', 'get', 'put', 'get', 'put', 'put', 'get', 'get'], args: [[2], [2], [2, 6], [1], [1, 5], [1, 2], [1], [2]], expect: [null, -1, null, -1, null, null, 2, 6] },
        { ops: ['LRUCache', 'put', 'put', 'put', 'get', 'put', 'get', 'get', 'get'], args: [[3], [1, 1], [2, 2], [3, 3], [1], [4, 4], [2], [3], [1]], expect: [null, null, null, null, 1, null, -1, 3, 1] },
        { ops: ['LRUCache', ...Array.from({ length: 6000 }, (_, i) => (i % 3 === 1 ? 'get' : 'put'))], args: [[50], ...Array.from({ length: 6000 }, (_, i) => (i % 3 === 1 ? [(i * 31) % 97] : [(i * 17) % 97, i]))], big: true },
      ],
      constraints: ['1 ≤ capacity ≤ 3000', '0 ≤ key ≤ 10⁴, 0 ≤ value ≤ 10⁵', 'At most 2·10⁵ calls'],
      hints: [
        'You need O(1) lookup by key (a hash map) *and* O(1) "move to most recent" and "remove the least recent". What structure removes an arbitrary element in O(1)?',
        'A doubly linked list, as long as you have a reference to the node. So the map should store nodes.',
        'Use sentinel head and tail nodes. On access, unlink the node and insert it right after head. To evict, remove the node before tail and delete its key from the map.',
      ],
      solution: {
        pattern: '**HashMap + doubly linked list:** the map finds a node in O(1), and the list reorders and evicts in O(1). Sentinels remove every null check.',
        intuition: M`
          Recency order is a queue that needs "move this arbitrary element to the front". Arrays and singly linked lists can't do that in O(1). A doubly linked list can, given the node, because it knows both neighbours. The map from key to node supplies the node. Keep the most recent right after «head» and the least recent right before «tail».
        `,
        java: J`class LRUCache {
    private static class Node {
        int key, val; Node prev, next;
        Node(int key, int val) { this.key = key; this.val = val; }
    }

    private final int capacity;
    private final Map<Integer, Node> map = new HashMap<>();
    private final Node head = new Node(0, 0), tail = new Node(0, 0);   // sentinels

    public LRUCache(int capacity) {
        this.capacity = capacity;
        head.next = tail; tail.prev = head;
    }

    public int get(int key) {
        Node n = map.get(key);
        if (n == null) return -1;
        unlink(n); addFront(n);               // now most recent
        return n.val;
    }

    public void put(int key, int value) {
        Node n = map.get(key);
        if (n != null) { n.val = value; unlink(n); addFront(n); return; }
        if (map.size() == capacity) {         // evict the least recent
            Node lru = tail.prev;
            unlink(lru);
            map.remove(lru.key);              // this is why nodes store their key
        }
        n = new Node(key, value);
        map.put(key, n);
        addFront(n);
    }

    private void unlink(Node n) { n.prev.next = n.next; n.next.prev = n.prev; }
    private void addFront(Node n) { n.next = head.next; n.prev = head; head.next.prev = n; head.next = n; }
}`,
        time: 'O(1) per operation', space: 'O(capacity)',
        pitfalls: M`
          - Nodes must store their **key**: on eviction you have the node and need to remove it from the map.
          - Updating an existing key must also move it to the front.
          - Evict *before* inserting (when full), or after inserting when the size exceeds capacity. Either works, but be consistent.
        `,
        alts: [
          { name: 'LinkedHashMap with accessOrder', time: 'O(1)', space: 'O(capacity)', note: 'Five lines using «removeEldestEntry», and worth mentioning to show you know the library. Expect the follow-up "now build it yourself".',
            java: J`class LRUCache extends LinkedHashMap<Integer, Integer> {
    private final int capacity;
    public LRUCache(int capacity) { super(16, 0.75f, true); this.capacity = capacity; }
    public int get(int key) { return super.getOrDefault(key, -1); }
    public void put(int key, int value) { super.put(key, value); }
    @Override protected boolean removeEldestEntry(Map.Entry<Integer, Integer> e) { return size() > capacity; }
}` },
        ],
        followups: M`
          - **LFU cache** (LeetCode 460): map of key → node, plus map of frequency → doubly linked list, plus the current minimum frequency.
          - **Thread safety:** a lock around both operations, or striped segments.
          - **TTL expiry:** also keep a heap or timer wheel ordered by expiry time.
        `,
        talk: 'A HashMap from key to node plus a doubly linked list in recency order, with head and tail sentinels. get: look up, unlink, move to front. put: update and move, or insert at front; if over capacity, remove tail.prev and delete its key from the map. All O(1).',
      },
      viz: { id: 'linkedHashMapLru' },
      lc: [lc(146, 'lru-cache', 'LRU Cache', 'same'), lc(460, 'lfu-cache', 'LFU Cache', 'harder'), lc(1472, 'design-browser-history', 'Design Browser History', 'similar'), lc(432, 'all-oone-data-structure', 'All O`one Data Structure', 'harder')],
      drill: { prompt: 'Cache with O(1) get/put that evicts the least recently used entry when full.', pattern: 'design', why: 'HashMap from key to node, plus a doubly linked list in recency order.' },
    } },

    { problem: {
      id: 'reverse-k-group', title: 'Reverse in Groups of k', diff: 'hard',
      tags: ['reversal', 'stitching'],
      statement: M`
        Reverse the nodes of a linked list **k at a time** and return the new head. If the number of remaining nodes at the end is less than k, leave them as they are. Rearrange the nodes themselves (not their values), using O(1) extra memory.
      `,
      fn: { name: 'reverseKGroup', params: [['ListNode', 'head'], ['int', 'k']], ret: 'ListNode' },
      tests: [
        { args: [[1, 2, 3, 4, 5], 2], ex: true, expect: [2, 1, 4, 3, 5] },
        { args: [[1, 2, 3, 4, 5], 3], ex: true, expect: [3, 2, 1, 4, 5] },
        { args: [[1, 2, 3, 4, 5], 1], expect: [1, 2, 3, 4, 5] },
        { args: [[1, 2, 3, 4, 5], 5], expect: [5, 4, 3, 2, 1] },
        { args: [[1], 1], expect: [1] },
        { args: [[1, 2, 3, 4, 5, 6], 3], expect: [3, 2, 1, 6, 5, 4] },
        { args: [[1, 2], 3], expect: [1, 2], why: 'Fewer than k nodes: untouched.' },
        { args: [{ $gen: 'list', args: [100000, 0, 9, 121] }, 7], big: true },
      ],
      constraints: ['1 ≤ k ≤ number of nodes ≤ 10⁵ (LeetCode: 5000)'],
      hints: [
        'Handle one group at a time: check that k nodes remain, reverse exactly those k, then connect them to the previous part and the rest.',
        'Keep «groupPrev», the node just before the current group (start with a dummy). After reversing, the group’s old first node becomes its last node.',
        'Reverse with «prev» initialised to the node *after* the group, so the reversed group is automatically linked to the rest.',
      ],
      solution: {
        pattern: '**Reverse a segment and stitch it in:** the general "reverse between" move repeated per group, with a dummy and a groupPrev anchor.',
        intuition: M`
          Each group is independent: count k nodes (stop if there aren't enough), reverse those links, then reconnect. The node before the group must point to the group's new first node (the old k-th), and the group's new last node (the old first) must point to the node after the group. Initialising the reversal's «prev» to that next node makes the second link happen for free.
        `,
        java: J`class Solution {
    public ListNode reverseKGroup(ListNode head, int k) {
        ListNode dummy = new ListNode(0);
        dummy.next = head;
        ListNode groupPrev = dummy;
        while (true) {
            ListNode kth = groupPrev;
            for (int i = 0; i < k && kth != null; i++) kth = kth.next;   // k-th node of this group
            if (kth == null) break;                                      // fewer than k left
            ListNode groupNext = kth.next;
            ListNode prev = groupNext, curr = groupPrev.next;           // reverse the group
            while (curr != groupNext) {
                ListNode next = curr.next;
                curr.next = prev;
                prev = curr;
                curr = next;
            }
            ListNode oldFirst = groupPrev.next;                         // becomes the group's tail
            groupPrev.next = kth;                                       // kth is the group's new head
            groupPrev = oldFirst;
        }
        return dummy.next;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        pitfalls: M`
          - Reversing before checking that k nodes remain breaks the "leave the tail alone" rule.
          - Losing track of which node becomes the group's tail. Save «groupPrev.next» (the old first) before rewiring «groupPrev.next».
        `,
        alts: [
          { name: 'Recursive per group', time: 'O(n)', space: 'O(n/k) stack', note: 'Reverse the first k, then set the old head’s next to reverseKGroup(rest). Short; the recursion depth is n/k.',
            java: J`class Solution {
    public ListNode reverseKGroup(ListNode head, int k) {
        ListNode p = head;
        for (int i = 0; i < k; i++) { if (p == null) return head; p = p.next; }
        ListNode prev = reverseKGroup(p, k), curr = head;
        for (int i = 0; i < k; i++) { ListNode next = curr.next; curr.next = prev; prev = curr; curr = next; }
        return prev;
    }
}`, check: false },
          { name: 'Values into an array, reverse chunks, write back', time: 'O(n)', space: 'O(n)', check: false, note: 'It violates the "rearrange nodes" rule, so only use it as a correctness check.' },
        ],
        followups: M`
          - **Reverse alternate groups**, or **reverse between positions left and right** (LeetCode 92): the same segment reversal and stitching.
        `,
        talk: 'With a dummy and a groupPrev anchor: find the k-th node (stop if missing), reverse the group with prev starting at the node after it so the tail links up automatically, then point groupPrev at the new head and move groupPrev to the old first node. O(n) time, O(1) space.',
      },
      lc: [lc(25, 'reverse-nodes-in-k-group', 'Reverse Nodes in k-Group', 'same'), lc(24, 'swap-nodes-in-pairs', 'Swap Nodes in Pairs', 'easier'), lc(92, 'reverse-linked-list-ii', 'Reverse Linked List II', 'easier'), lc(2074, 'reverse-nodes-in-even-length-groups', 'Reverse Nodes in Even Length Groups', 'variant')],
      drill: { prompt: 'Reverse a linked list k nodes at a time, leaving a short tail untouched.', pattern: 'linked-list', why: 'Repeated segment reversal with careful stitching (a dummy and a groupPrev anchor).' },
    } },
  ],
});
})();

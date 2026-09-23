(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

DSA.module({
  id: 'stack', title: 'Stacks & Monotonic Stacks', short: 'Stacks',
  blurb: 'Last in, first out: matching brackets, evaluating expressions, and the monotonic stack that finds the “next greater element” for everything in O(n).',
  intro: M`
    A stack answers one question instantly: *what is the most recent unfinished thing?* That's exactly what nesting (brackets, tags, recursion) and "look back to the nearest…" problems need. The second lesson turns the stack into a **monotonic stack**, one of the most reliable interview tricks for going from O(n²) to O(n).
  `,
  more: [
    lc(232, 'implement-queue-using-stacks', 'Implement Queue using Stacks', 'easier'),
    lc(1047, 'remove-all-adjacent-duplicates-in-string', 'Remove All Adjacent Duplicates In String', 'easier'),
    lc(71, 'simplify-path', 'Simplify Path', 'similar'),
    lc(224, 'basic-calculator', 'Basic Calculator', 'harder'),
    lc(227, 'basic-calculator-ii', 'Basic Calculator II', 'similar'),
    lc(496, 'next-greater-element-i', 'Next Greater Element I', 'easier'),
    lc(901, 'online-stock-span', 'Online Stock Span', 'similar'),
    lc(853, 'car-fleet', 'Car Fleet', 'similar'),
    lc(907, 'sum-of-subarray-minimums', 'Sum of Subarray Minimums', 'harder'),
    lc(85, 'maximal-rectangle', 'Maximal Rectangle', 'harder'),
    lc(402, 'remove-k-digits', 'Remove K Digits', 'similar'),
    lc(316, 'remove-duplicate-letters', 'Remove Duplicate Letters', 'harder'),
    lc(1438, 'longest-continuous-subarray-with-absolute-diff-less-than-or-equal-to-limit', 'Longest Continuous Subarray With Absolute Diff Less Than or Equal to Limit', 'harder'),
  ],
  items: [
    { lesson: 'stacks', title: 'Stacks: nesting and evaluation', mins: 9,
      lede: 'When the most recent open thing is the first to close, use a stack. In Java, that means ArrayDeque.',
      body: M`
        ## The stack API in Java
        ~~~java
        Deque<Integer> st = new ArrayDeque<>();
        st.push(x);          // add to the top
        st.peek();           // look at the top (null if empty)
        st.pop();            // remove the top (throws if empty; use poll() for null)
        st.isEmpty();
        ~~~
        Avoid «java.util.Stack»: it's a synchronized legacy class built on «Vector» (see the Java module). When the stack only holds ints and the maximum size is known, an «int[]» plus a top index is even faster.

        ## Pattern 1: matching and nesting
        Brackets, HTML tags, «if/else» blocks: the thing closing now must match the **most recently opened**, not yet closed thing. That's the top of a stack.

        @viz validParens

        ## Pattern 2: expression evaluation
        - **Postfix (RPN):** numbers push; an operator pops two, computes, and pushes the result.
        - **Infix with parentheses** («3 * (2 + 4)»): either two stacks (values and operators, applying higher-precedence operators first), or treat each «(» as "save my current state and start fresh" and «)» as "finish the inner value and combine it with the saved state".

        @viz rpnEval

        ## Pattern 3: "save state, go deeper, come back"
        Recursion *is* a stack: the call stack. Any recursive algorithm can be written with an explicit stack, and vice versa. Decode String is the classic: on «[» push the current string and repeat count, then on «]» pop them and combine.

        ## Pattern 4: cancellation from the right
        Process items left to right. A new item may cancel or merge with the item on top of the stack, repeatedly. Examples: asteroid collisions, removing adjacent duplicates, backspace strings. The stack holds the survivors so far.

        ## Signals
        - Brackets, tags, nested structures, "valid", "balanced" → matching stack.
        - Evaluate an expression, a calculator, postfix/prefix → operand stack.
        - Nested encodings like «3[a2[c]]» → a stack of saved states.
        - A new element can cancel previous ones, or "remove adjacent…" → survivor stack.
        - "Next greater / smaller / warmer element", "span", "how far can I see" → **monotonic stack** (next lesson).

        @quiz 0
      `,
      quiz: [
        { q: 'Why is a queue the wrong structure for checking balanced brackets?',
          options: ['Queues are slower', 'A closer must match the *most recent* unmatched opener; a queue would give you the *oldest* one', 'Queues can’t store characters', 'It would work equally well'],
          answer: 1, why: 'In «([)]» the «)» must match the «[» opened last. LIFO order is the whole point of the stack here.' },
      ],
      practice: ['valid-parentheses', 'min-stack', 'eval-rpn', 'decode-string', 'asteroid-collision'],
    },

    { problem: {
      id: 'valid-parentheses', title: 'Balanced Brackets', diff: 'easy',
      tags: ['stack', 'matching'],
      statement: M`
        Given a string «s» containing only «(», «)», «[», «]», «{» and «}», return «true» if it's **balanced**: every opener is closed by the same kind of bracket, and brackets close in the correct (nested) order.
      `,
      fn: { name: 'isValid', params: [['String', 's']], ret: 'boolean' },
      tests: [
        { args: ['()'], ex: true, expect: true },
        { args: ['()[]{}'], ex: true, expect: true },
        { args: ['(]'], ex: true, expect: false },
        { args: ['([)]'], expect: false, why: 'The kinds match in count, but not in nesting order.' },
        { args: ['{[]}'], expect: true },
        { args: ['('], expect: false },
        { args: [')'], expect: false },
        { args: ['(('], expect: false },
        { args: ['){'], expect: false },
        { args: ['[({})]([]){}'], expect: true },
        { args: [{ $gen: 'repeatStr', args: ['({[]})', 16000] }], big: true, expect: true },
        { args: [{ $gen: 'repeatStr', args: ['(', 100000] }], big: true, expect: false },
      ],
      constraints: ['1 ≤ s.length ≤ 10⁵', 's contains only bracket characters'],
      hints: [
        'When you meet a closing bracket, which opening bracket must it match?',
        'The most recent one that hasn’t been closed yet: the top of a stack.',
        'Push openers (or, neater, push the closer you expect). On a closer, the stack must be non-empty and its top must match. At the end the stack must be empty.',
      ],
      solution: {
        pattern: '**Matching with a stack:** the canonical LIFO problem.',
        intuition: 'Nested structures close in reverse order of opening. A stack of "what I expect to close next" checks every closer against the only bracket it may legally close.',
        java: J`class Solution {
    public boolean isValid(String s) {
        Deque<Character> st = new ArrayDeque<>();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '(') st.push(')');
            else if (c == '[') st.push(']');
            else if (c == '{') st.push('}');
            else if (st.isEmpty() || st.pop() != c) return false;   // closer without its opener
        }
        return st.isEmpty();                                         // unclosed openers left?
    }
}`,
        time: 'O(n)', space: 'O(n)',
        pitfalls: M`
          - Forgetting the final «isEmpty()» check accepts «"(("».
          - Popping an empty «ArrayDeque» throws «NoSuchElementException». Check «isEmpty()» first, as above.
          - Counting brackets per kind isn't enough: «"([)]"» has balanced counts.
        `,
        alts: [
          { name: 'char[] as a stack', time: 'O(n)', space: 'O(n)', note: 'An array and an index avoid boxing «Character»: faster, same logic. If the length is odd, return false immediately.',
            java: J`class Solution {
    public boolean isValid(String s) {
        if (s.length() % 2 == 1) return false;
        char[] st = new char[s.length()];
        int top = 0;
        for (char c : s.toCharArray()) {
            if (c == '(') st[top++] = ')';
            else if (c == '[') st[top++] = ']';
            else if (c == '{') st[top++] = '}';
            else if (top == 0 || st[--top] != c) return false;
        }
        return top == 0;
    }
}` },
        ],
        followups: M`
          - **Only one bracket type:** a single counter suffices (it must never go negative, and must end at 0).
          - **Minimum insertions/removals to balance** (LeetCode 921, 1249): counters or a stack of indices.
          - **Longest valid parentheses substring** (LeetCode 32, hard): a stack of indices, or DP.
        `,
        talk: 'A stack of expected closers: push the matching closer on each opener, and each closer must equal the popped top. At the end the stack must be empty. O(n).',
      },
      viz: { id: 'validParens', input: { s: '([)]' } },
      lc: [lc(20, 'valid-parentheses', 'Valid Parentheses', 'same'), lc(921, 'minimum-add-to-make-parentheses-valid', 'Minimum Add to Make Parentheses Valid', 'variant'), lc(1249, 'minimum-remove-to-make-valid-parentheses', 'Minimum Remove to Make Valid Parentheses', 'harder'), lc(32, 'longest-valid-parentheses', 'Longest Valid Parentheses', 'harder')],
      drill: { prompt: 'Is a string of ()[]{} properly nested and matched?', pattern: 'stack', why: 'Each closer must match the most recent unclosed opener: the top of a stack.' },
    } },

    { problem: {
      id: 'min-stack', title: 'Stack With O(1) Minimum', diff: 'medium',
      tags: ['design', 'stack', 'auxiliary state'],
      statement: M`
        Design «MinStack», a stack that also reports its minimum element, with **every operation in O(1)**:

        - «push(x)», «pop()» (removes the top), «top()» (returns the top).
        - «getMin()» returns the smallest element currently in the stack.

        «pop», «top» and «getMin» are only called on a non-empty stack.
      `,
      design: { cls: 'MinStack', ctor: [], methods: { push: { params: [['int', 'val']], ret: 'void' }, pop: { params: [], ret: 'void' }, top: { params: [], ret: 'int' }, getMin: { params: [], ret: 'int' } } },
      tests: [
        { ex: true, ops: ['MinStack', 'push', 'push', 'push', 'getMin', 'pop', 'top', 'getMin'], args: [[], [-2], [0], [-3], [], [], [], []], expect: [null, null, null, null, -3, null, 0, -2] },
        { ops: ['MinStack', 'push', 'getMin', 'top', 'push', 'getMin'], args: [[], [5], [], [], [7], []], expect: [null, null, 5, 5, null, 5] },
        { ops: ['MinStack', 'push', 'push', 'push', 'getMin', 'pop', 'getMin', 'pop', 'getMin'], args: [[], [2], [2], [1], [], [], [], [], []], expect: [null, null, null, null, 1, null, 2, null, 2], why: 'Duplicated minimums must survive a pop.' },
        { ops: ['MinStack', 'push', 'push', 'getMin', 'pop', 'getMin'], args: [[], [-2147483648], [2147483647], [], [], []], expect: [null, null, null, -2147483648, null, -2147483648] },
        { ops: ['MinStack', 'push', 'push', 'push', 'pop', 'pop', 'getMin', 'push', 'getMin'], args: [[], [3], [1], [0], [], [], [], [4], []], expect: [null, null, null, null, null, null, 3, null, 3] },
        { ops: ['MinStack', ...Array.from({ length: 5000 }, (_, i) => (i < 20 ? 'push' : ['push', 'getMin', 'top', 'pop', 'push', 'getMin', 'push'][i % 7]))], args: [[], ...Array.from({ length: 5000 }, (_, i) => { const op = i < 20 ? 'push' : ['push', 'getMin', 'top', 'pop', 'push', 'getMin', 'push'][i % 7]; return op === 'push' ? [((i * 7919) % 20011) - 10000] : []; })], big: true },
      ],
      constraints: ['−2³¹ ≤ val ≤ 2³¹ − 1', 'At most 3·10⁴ calls'],
      hints: [
        'Scanning for the minimum on every «getMin» is O(n). What could you store at push time so you never have to scan?',
        'The minimum only changes when you push or pop. Store, next to each element, the minimum of the stack *at that moment*.',
        'A second stack of running minimums, or pairs «[value, minSoFar]» on a single stack. «getMin» just peeks.',
      ],
      solution: {
        pattern: '**Augment each stack entry with a running aggregate** (min, max, sum). Because a stack only changes at the top, the aggregate for every older state is still valid underneath.',
        intuition: M`
          The minimum of the stack depends only on what's below the top, and that part never changes while the top exists. So when you push «x», you already know the minimum of the new stack: «min(x, previous minimum)». Store it with «x». Popping restores the previous state, and its minimum is sitting right there.
        `,
        java: J`class MinStack {
    private final Deque<int[]> st = new ArrayDeque<>();   // [value, min of stack up to here]

    public void push(int val) {
        int min = st.isEmpty() ? val : Math.min(val, st.peek()[1]);
        st.push(new int[]{val, min});
    }

    public void pop() { st.pop(); }
    public int top() { return st.peek()[0]; }
    public int getMin() { return st.peek()[1]; }
}`,
        time: 'O(1) for every operation', space: 'O(n)',
        pitfalls: M`
          - A single «min» field fails after popping the minimum: you don't know the previous minimum anymore.
          - With a separate min-stack that only pushes when «x < min», duplicates break it: push when «x <= min».
        `,
        alts: [
          { name: 'Two stacks, min stack pushed only on new minimums', time: 'O(1)', space: 'O(n) worst, less in practice', note: 'Push onto «mins» when «x ≤ mins.peek()»; pop from «mins» when the popped value equals «mins.peek()». Saves memory when minimums change rarely.',
            java: J`class MinStack {
    private final Deque<Integer> st = new ArrayDeque<>(), mins = new ArrayDeque<>();
    public void push(int val) { st.push(val); if (mins.isEmpty() || val <= mins.peek()) mins.push(val); }
    public void pop() { if (st.pop().equals(mins.peek())) mins.pop(); }
    public int top() { return st.peek(); }
    public int getMin() { return mins.peek(); }
}` },
        ],
        followups: M`
          - **O(1) extra space trick:** store differences from the current minimum (as «long»). Clever but rarely needed.
          - **Max queue / min queue:** a queue made of two min-stacks, or a monotonic deque (next lesson).
        `,
        talk: 'Each stack entry stores its value and the minimum of the stack at that point, which is min(value, previous entry’s min). Pop restores the previous min automatically. Every operation is O(1).',
      },
      lc: [lc(155, 'min-stack', 'Min Stack', 'same'), lc(716, 'max-stack', 'Max Stack', 'harder', { premium: true }), lc(232, 'implement-queue-using-stacks', 'Implement Queue using Stacks', 'similar')],
      drill: { prompt: 'A stack supporting push, pop, top and retrieving the minimum, all in O(1).', pattern: 'design', why: 'Store the running minimum alongside each element (or keep a second min stack).' },
    } },

    { problem: {
      id: 'eval-rpn', title: 'Evaluate Postfix Notation', diff: 'medium',
      tags: ['stack', 'expression'],
      statement: M`
        «tokens» is an arithmetic expression in **Reverse Polish Notation** (postfix): operators come after their operands, so «["2","1","+","3","*"]» means «(2 + 1) * 3». Operators are «+», «-», «*» and «/». Division between integers **truncates toward zero**.

        Evaluate it and return the result. The expression is valid, and every intermediate value fits in a 32-bit int.
      `,
      fn: { name: 'evalRPN', params: [['String[]', 'tokens']], ret: 'int' },
      tests: [
        { args: [['2', '1', '+', '3', '*']], ex: true, expect: 9 },
        { args: [['4', '13', '5', '/', '+']], ex: true, expect: 6, why: '13 / 5 = 2 (truncated), 4 + 2 = 6.' },
        { args: [['10', '6', '9', '3', '+', '-11', '*', '/', '*', '17', '+', '5', '+']], expect: 22 },
        { args: [['42']], expect: 42 },
        { args: [['3', '-4', '/']], expect: 0, why: '−0.75 truncates to 0, not −1.' },
        { args: [['-7', '2', '/']], expect: -3 },
        { args: [['5', '1', '2', '+', '4', '*', '+', '3', '-']], expect: 14 },
        { args: [['1', '2', '-']], expect: -1, why: 'Order matters: the first popped value is the right operand.' },
      ],
      constraints: ['1 ≤ tokens.length ≤ 10⁴', 'Each token is an operator or an integer in [−200, 200]'],
      hints: [
        'Scan left to right. What do you do with a number? With an operator?',
        'Numbers are pushed. An operator pops two values, applies itself, and pushes the result.',
        'Careful with order: the **first** pop is the right operand («a − b» pops b first).',
      ],
      solution: {
        pattern: '**Operand stack:** postfix expressions evaluate in one pass with no precedence rules. That’s why compilers and calculators convert infix to postfix.',
        intuition: 'In postfix, every operator applies to the two most recent unconsumed values, exactly the top two of a stack. After the last token, the single value left is the result.',
        java: J`class Solution {
    public int evalRPN(String[] tokens) {
        Deque<Integer> st = new ArrayDeque<>();
        for (String t : tokens) {
            switch (t) {
                case "+" -> st.push(st.pop() + st.pop());
                case "*" -> st.push(st.pop() * st.pop());
                case "-" -> { int b = st.pop(), a = st.pop(); st.push(a - b); }
                case "/" -> { int b = st.pop(), a = st.pop(); st.push(a / b); }   // Java truncates toward 0
                default -> st.push(Integer.parseInt(t));
            }
        }
        return st.pop();
    }
}`,
        time: 'O(n)', space: 'O(n)',
        pitfalls: M`
          - Operand order for «-» and «/»: «st.pop() - st.pop()» computes «b − a». Pop into named variables.
          - Detecting numbers with «Character.isDigit(t.charAt(0))» misreads negative numbers like «"-11"». Match the operators exactly instead.
          - Java's «/» truncates toward zero, which is what the problem wants. Python's «//» would not.
        `,
        alts: [
          { name: 'int[] as a stack', time: 'O(n)', space: 'O(n)', java: J`class Solution {
    public int evalRPN(String[] tokens) {
        int[] st = new int[tokens.length];
        int top = 0;
        for (String t : tokens) {
            if (t.length() == 1 && "+-*/".indexOf(t.charAt(0)) >= 0) {
                int b = st[--top], a = st[--top];
                st[top++] = switch (t.charAt(0)) { case '+' -> a + b; case '-' -> a - b; case '*' -> a * b; default -> a / b; };
            } else st[top++] = Integer.parseInt(t);
        }
        return st[0];
    }
}` },
        ],
        followups: M`
          - **Infix with + − * / and parentheses** (LeetCode 224/227/772): two stacks (shunting-yard), or recursion on parentheses.
        `,
        talk: 'Postfix evaluates with one stack: push numbers; an operator pops the right operand then the left, applies itself, and pushes the result. O(n).',
      },
      viz: { id: 'rpnEval', input: { tokens: ['4', '13', '5', '/', '+'] } },
      lc: [lc(150, 'evaluate-reverse-polish-notation', 'Evaluate Reverse Polish Notation', 'same'), lc(227, 'basic-calculator-ii', 'Basic Calculator II', 'harder'), lc(224, 'basic-calculator', 'Basic Calculator', 'harder')],
      drill: { prompt: 'Evaluate an arithmetic expression given in postfix (operators after operands).', pattern: 'stack', why: 'Operand stack: operators pop two values and push the result.' },
    } },

    { problem: {
      id: 'decode-string', title: 'Decode Nested Repeats', diff: 'medium',
      tags: ['stack', 'nesting', 'StringBuilder'],
      statement: M`
        An encoded string uses the rule «k[text]», meaning «text» repeated «k» times. Rules can nest: «3[a2[c]]» decodes to «accaccacc».

        Given a valid encoded string «s» (digits appear only as repeat counts; letters are lowercase), return the decoded string.
      `,
      fn: { name: 'decodeString', params: [['String', 's']], ret: 'String' },
      tests: [
        { args: ['3[a]2[bc]'], ex: true, expect: 'aaabcbc' },
        { args: ['3[a2[c]]'], ex: true, expect: 'accaccacc' },
        { args: ['2[abc]3[cd]ef'], ex: true, expect: 'abcabccdcdcdef' },
        { args: ['abc'], expect: 'abc' },
        { args: ['10[a]'], expect: 'aaaaaaaaaa', why: 'Counts can have several digits.' },
        { args: ['2[b3[a]]c'], expect: 'baaabaaac' },
        { args: ['1[x]2[]y'], expect: 'xy' },
        { args: ['3[z]2[2[y]pq4[2[jk]e1[f]]]ef'], expect: 'zzzyypqjkjkefjkjkefjkjkefjkjkefyypqjkjkefjkjkefjkjkefjkjkefef' },
        { args: ['100[leetcode]'] },
      ],
      constraints: ['1 ≤ s.length ≤ 30', 'Counts are between 1 and 300; the decoded length is at most 10⁵'],
      hints: [
        'When you see «[», you’re entering a nested context. What must you remember so you can come back?',
        'The string built so far (before the bracket) and the repeat count for the part inside.',
        'Two stacks, or one stack of pairs. On «[» push (current string, k) and start fresh. On «]» pop them: result = saved + current × k.',
      ],
      solution: {
        pattern: '**Save state on the way in, combine on the way out:** an explicit stack standing in for recursion.',
        intuition: M`
          Each «k[» opens a new context whose result will be repeated and appended to the enclosing context. Keep the current context's text in a StringBuilder. On «[», push the enclosing text and «k», and start a new builder. On «]», the inner text is complete: pop, repeat, append.
        `,
        java: J`class Solution {
    public String decodeString(String s) {
        Deque<StringBuilder> texts = new ArrayDeque<>();
        Deque<Integer> counts = new ArrayDeque<>();
        StringBuilder cur = new StringBuilder();
        int k = 0;
        for (char c : s.toCharArray()) {
            if (Character.isDigit(c)) k = k * 10 + (c - '0');          // multi-digit counts
            else if (c == '[') {
                texts.push(cur); counts.push(k);                        // save the outer context
                cur = new StringBuilder(); k = 0;
            } else if (c == ']') {
                String inner = cur.toString();
                cur = texts.pop();
                cur.append(inner.repeat(counts.pop()));
            } else cur.append(c);
        }
        return cur.toString();
    }
}`,
        time: 'O(output length)', space: 'O(output length)',
        pitfalls: M`
          - Single-digit parsing breaks «10[a]». Accumulate «k = k * 10 + digit».
          - Reset «k» after pushing it. Otherwise the next count starts from the old value.
          - String concatenation in a loop instead of «StringBuilder» can go quadratic.
        `,
        alts: [
          { name: 'Recursive descent', time: 'O(output)', space: 'O(depth + output)', note: 'A function reads until «]» or the end and returns the decoded text; on «k[» it calls itself for the inner part. It mirrors the grammar and reads beautifully.',
            java: J`class Solution {
    private int i = 0;
    public String decodeString(String s) {
        StringBuilder out = new StringBuilder();
        while (i < s.length() && s.charAt(i) != ']') {
            char c = s.charAt(i);
            if (Character.isDigit(c)) {
                int k = 0;
                while (Character.isDigit(s.charAt(i))) k = k * 10 + (s.charAt(i++) - '0');
                i++;                                   // skip '['
                String inner = decodeString(s);
                i++;                                   // skip ']'
                out.append(inner.repeat(k));
            } else { out.append(c); i++; }
        }
        return out.toString();
    }
}` },
        ],
        talk: 'Two stacks: on “[” I push the text built so far and the repeat count, then start fresh; on “]” I pop and append the inner text repeated k times. Digits accumulate for multi-digit counts. Linear in the output size.',
      },
      lc: [lc(394, 'decode-string', 'Decode String', 'same'), lc(726, 'number-of-atoms', 'Number of Atoms', 'harder'), lc(1106, 'parsing-a-boolean-expression', 'Parsing A Boolean Expression', 'harder')],
      drill: { prompt: 'Expand an encoding like 3[a2[c]] into its full string.', pattern: 'stack', why: 'Nested contexts: push the outer text and count on “[”, combine on “]”.' },
    } },

    { problem: {
      id: 'asteroid-collision', title: 'Asteroid Collisions', diff: 'medium',
      tags: ['stack', 'cancellation'],
      statement: M`
        Asteroids move along a line. «asteroids[i]»'s absolute value is its size, and its sign is its direction (positive = right, negative = left). All move at the same speed.

        When two asteroids meet, the smaller one explodes; if they're the same size, both explode. Two asteroids moving in the same direction never meet. Return the asteroids that remain, in order.
      `,
      fn: { name: 'asteroidCollision', params: [['int[]', 'asteroids']], ret: 'int[]' },
      tests: [
        { args: [[5, 10, -5]], ex: true, expect: [5, 10], why: '10 and −5 collide; −5 explodes.' },
        { args: [[8, -8]], ex: true, expect: [] },
        { args: [[10, 2, -5]], ex: true, expect: [10], why: '−5 destroys 2, then loses to 10.' },
        { args: [[-2, -1, 1, 2]], expect: [-2, -1, 1, 2], why: 'Moving apart: no collisions.' },
        { args: [[1, -2, -2, -2]], expect: [-2, -2, -2] },
        { args: [[-2, 2, -1, -2]], expect: [-2] },
        { args: [[3, 5, -6, 2, -1, 4]], expect: [-6, 2, 4] },
        { args: [[1, 1, 1, -3, 5]], expect: [-3, 5] },
        { args: [{ $gen: 'ints', args: [10000, -1000, 1000, 83] }], big: true },
      ],
      constraints: ['2 ≤ asteroids.length ≤ 10⁴', '−1000 ≤ asteroids[i] ≤ 1000, asteroids[i] ≠ 0'],
      hints: [
        'Scan left to right. Which previous asteroids can a new left-moving one hit?',
        'Only right-movers that are still alive, starting with the most recent. That’s a stack of survivors.',
        'While the new asteroid moves left and the top moves right: compare sizes, pop the smaller (or both if equal). Push the new one if it survives.',
      ],
      solution: {
        pattern: '**Survivor stack with cancellation:** each new element fights the top of the stack repeatedly, and the stack holds the stable state so far.',
        intuition: M`
          A collision only happens between a right-mover on the left and a left-mover on the right. As we scan, the stack holds survivors, and the only ones a new left-mover can hit are the right-movers at the top. It destroys smaller ones one by one until it meets a bigger or equal one, or runs out of right-movers.
        `,
        java: J`class Solution {
    public int[] asteroidCollision(int[] asteroids) {
        int[] st = new int[asteroids.length];
        int top = 0;
        for (int a : asteroids) {
            boolean alive = true;
            while (alive && a < 0 && top > 0 && st[top - 1] > 0) {
                if (st[top - 1] < -a) top--;               // top explodes; keep checking
                else {
                    if (st[top - 1] == -a) top--;          // both explode
                    alive = false;                         // a explodes
                }
            }
            if (alive) st[top++] = a;
        }
        return Arrays.copyOf(st, top);
    }
}`,
        time: 'O(n)', space: 'O(n)', timeWhy: 'each asteroid is pushed and popped at most once',
        pitfalls: M`
          - A left-mover arriving when the top is also a left-mover (or the stack is empty) never collides. Push it.
          - Equal sizes destroy **both**, so pop and stop.
        `,
        alts: [
          { name: 'Deque<Integer> version', time: 'O(n)', space: 'O(n)', java: J`class Solution {
    public int[] asteroidCollision(int[] asteroids) {
        Deque<Integer> st = new ArrayDeque<>();
        for (int a : asteroids) {
            boolean alive = true;
            while (alive && a < 0 && !st.isEmpty() && st.peek() > 0) {
                int t = st.peek();
                if (t < -a) st.pop();
                else { if (t == -a) st.pop(); alive = false; }
            }
            if (alive) st.push(a);
        }
        int[] res = new int[st.size()];
        for (int i = res.length - 1; i >= 0; i--) res[i] = st.pop();
        return res;
    }
}` },
        ],
        talk: 'A stack of survivors. A left-moving asteroid only collides with right-movers on top of the stack; it pops smaller ones, stops at a larger one, and both die when equal. Each asteroid is pushed and popped at most once: O(n).',
      },
      lc: [lc(735, 'asteroid-collision', 'Asteroid Collision', 'same'), lc(1047, 'remove-all-adjacent-duplicates-in-string', 'Remove All Adjacent Duplicates In String', 'easier'), lc(1209, 'remove-all-adjacent-duplicates-in-string-ii', 'Remove All Adjacent Duplicates in String II', 'similar')],
      drill: { prompt: 'Signed sizes moving left/right: simulate collisions and return the survivors.', pattern: 'stack', why: 'A survivor stack: each new left-mover repeatedly fights the right-mover on top.' },
    } },

    { lesson: 'monotonic-stack', title: 'Monotonic stacks and deques', mins: 12,
      lede: 'Keep a stack sorted as you push, and each pop answers a question: the next greater element, the width of a histogram bar, a window maximum.',
      body: M`
        ## The question it answers
        For every element, find the **nearest element to the right (or left) that is greater (or smaller)**. The brute force scans outward from each element: O(n²). A monotonic stack does it in one pass.

        @viz monoStack

        ### How it works
        Keep a stack of indices **whose answer isn't known yet**. Their values are decreasing from bottom to top, because anything smaller than a later element has already been answered and popped. When a new element arrives:
        1. While the top's value is **smaller** than the new value, the new element is the top's "next greater". Record it and pop.
        2. Push the new element: it's now waiting for its own next greater.

        ~~~java Template: next greater element to the right
        int[] next = new int[n];
        Arrays.fill(next, -1);                     // -1 = none
        Deque<Integer> st = new ArrayDeque<>();    // indices; values decreasing
        for (int i = 0; i < n; i++) {
            while (!st.isEmpty() && a[i] > a[st.peek()]) next[st.pop()] = i;   // or a[i]
            st.push(i);
        }
        ~~~

        :::key Why O(n)
        Each index is pushed once and popped at most once, so the «while» loop runs at most n times **in total** across the whole scan. This is the amortized argument from the Big-O lesson.
        :::

        ## The four variants
        | Want | Stack order (bottom → top) | Pop while |
        |---|---|---|
        | Next **greater** to the right | decreasing | «a[i] > a[top]» |
        | Next **smaller** to the right | increasing | «a[i] < a[top]» |
        | Previous greater / smaller (to the left) | same stacks | after popping, the new top *is* the answer for «i» |
        | Circular array | scan «2n» indices with «i % n» | same |

        Use «≥» vs «>» to decide how equal values are treated (strictly greater, or greater-or-equal).

        ## Spans and boundaries: largest rectangle
        Many problems need, for each element, **how far it extends** before hitting something smaller: histogram rectangles, sums of subarray minimums, visibility. When an element is popped, you know both boundaries at once: the element that popped it is its right boundary, and the element below it on the stack is its left boundary.

        @viz histogram

        ## Monotonic deque: sliding window max/min
        Add a second end. Keep indices in a deque with decreasing values. Drop from the **back** anything smaller than the new element (it can never be a window max while the new element is around), and drop from the **front** anything that has slid out of the window. The front is always the current maximum.

        @viz slidingMaxDeque

        ## Signals
        - "Next greater / smaller / warmer", "how many days until…" → monotonic stack.
        - "Span", "how far can each element see / extend" → monotonic stack, using the popping boundaries.
        - "Largest rectangle", "maximal area", "sum over all subarrays of min/max" → a monotonic stack for boundaries.
        - "Maximum/minimum of every window of size k" → monotonic deque.
        - "Remove k digits to make the smallest number", "remove duplicate letters, smallest result" → a greedy monotonic stack.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'To find, for each element, the **previous smaller** element (to its left), which stack do you keep?',
          options: ['Decreasing stack; answer = the element that pops it', 'Increasing stack; after popping everything ≥ a[i], the top (if any) is the answer', 'Any stack; sort afterwards', 'A max-heap'],
          answer: 1, why: 'Keep an increasing stack. Pop everything ≥ a[i]; whatever remains on top is the nearest element to the left that is smaller than a[i]. Then push i.' },
        { q: 'Sliding window maximum: why can we discard a smaller element from the back when a larger one arrives?',
          options: ['To save memory', 'The new larger element stays in the window at least as long, so the smaller one can never be the maximum again', 'The deque must stay sorted by index', 'Because the window moves right'],
          answer: 1, why: 'The newcomer is both larger and newer, so it outlives the older, smaller element in every future window. The older one is dominated.' },
      ],
      practice: ['daily-temperatures', 'next-greater-circular', 'largest-rectangle', 'sliding-window-max'],
    },

    { problem: {
      id: 'daily-temperatures', title: 'Days Until Warmer', diff: 'medium',
      tags: ['monotonic stack', 'next greater'],
      statement: M`
        «temps[i]» is the temperature on day «i». Return an array «answer» where «answer[i]» is the number of days you have to wait after day «i» for a **strictly warmer** temperature, or «0» if no warmer day comes.
      `,
      fn: { name: 'dailyTemperatures', params: [['int[]', 'temps']], ret: 'int[]' },
      tests: [
        { args: [[73, 74, 75, 71, 69, 72, 76, 73]], ex: true, expect: [1, 1, 4, 2, 1, 1, 0, 0] },
        { args: [[30, 40, 50, 60]], ex: true, expect: [1, 1, 1, 0] },
        { args: [[30, 60, 90]], expect: [1, 1, 0] },
        { args: [[90, 80, 70]], expect: [0, 0, 0] },
        { args: [[50]], expect: [0] },
        { args: [[70, 70, 71]], expect: [2, 1, 0], why: 'Equal isn’t warmer.' },
        { args: [[55, 38, 53, 81, 61, 93, 97, 32, 43, 78]], expect: [3, 1, 1, 2, 1, 1, 0, 1, 1, 0] },
        { args: [{ $gen: 'ints', args: [100000, 30, 100, 85] }], big: true },
        { args: [{ $gen: 'range', args: [100000, 100000, -1] }], big: true, why: 'Strictly falling: the naive scan is O(n²) here.' },
      ],
      constraints: ['1 ≤ temps.length ≤ 10⁵', '30 ≤ temps[i] ≤ 100 (the large test uses a wider range)'],
      hints: [
        'For each day, the naive approach scans forward until a warmer day: O(n²) on a falling sequence.',
        'Flip it around: when a warm day arrives, which earlier days does it answer?',
        'Keep a stack of days still waiting, with temperatures decreasing. A warmer day pops (and answers) every waiting day that is cooler than it.',
      ],
      solution: {
        pattern: '**Monotonic stack, next greater element.** Unresolved indices wait on a decreasing stack until something bigger arrives.',
        intuition: M`
          Instead of each day searching forward, let each day announce itself to the earlier days waiting for it. The waiting days always have decreasing temperatures (a cooler day behind a warmer one would already have been answered), so the new day answers them from the top down until it meets one at least as warm.
        `,
        java: J`class Solution {
    public int[] dailyTemperatures(int[] temps) {
        int n = temps.length;
        int[] ans = new int[n];
        int[] st = new int[n];          // stack of indices, temps decreasing
        int top = 0;
        for (int i = 0; i < n; i++) {
            while (top > 0 && temps[i] > temps[st[top - 1]]) {
                int j = st[--top];
                ans[j] = i - j;
            }
            st[top++] = i;
        }
        return ans;                     // indices left on the stack keep 0
    }
}`,
        time: 'O(n)', space: 'O(n)',
        pitfalls: M`
          - Store **indices**, not temperatures: you need the distance «i − j».
          - «>=» instead of «>» treats equal temperatures as warmer.
        `,
        alts: [
          { name: 'Scan from the right, jumping', time: 'O(n)', space: 'O(1) extra', note: 'Process right to left; to find the next warmer day for i, start at i + 1 and jump by «ans[j]» (skipping days known to be cooler than j). Also amortized O(n), with a nice trick.',
            java: J`class Solution {
    public int[] dailyTemperatures(int[] t) {
        int n = t.length;
        int[] ans = new int[n];
        for (int i = n - 2; i >= 0; i--) {
            int j = i + 1;
            while (j < n && t[j] <= t[i]) j = ans[j] == 0 ? n : j + ans[j];
            if (j < n) ans[i] = j - i;
        }
        return ans;
    }
}` },
          { name: 'Brute force', time: 'O(n²)', space: 'O(1)', java: J`class Solution {
    public int[] dailyTemperatures(int[] t) {
        int[] ans = new int[t.length];
        for (int i = 0; i < t.length; i++)
            for (int j = i + 1; j < t.length; j++) if (t[j] > t[i]) { ans[i] = j - i; break; }
        return ans;
    }
}` },
        ],
        talk: 'Monotonic stack of indices still waiting for a warmer day, temperatures decreasing. Each new day pops every cooler waiting day and records the distance, then waits itself. Each index is pushed and popped once: O(n).',
      },
      viz: { id: 'monoStack' },
      lc: [lc(739, 'daily-temperatures', 'Daily Temperatures', 'same'), lc(496, 'next-greater-element-i', 'Next Greater Element I', 'easier'), lc(901, 'online-stock-span', 'Online Stock Span', 'similar'), lc(1475, 'final-prices-with-a-special-discount-in-a-shop', 'Final Prices With a Special Discount in a Shop', 'easier')],
      drill: { prompt: 'For each day, how many days until a strictly warmer temperature?', pattern: 'mono-stack', why: 'Next greater element to the right: a decreasing stack of waiting indices.' },
    } },

    { problem: {
      id: 'next-greater-circular', title: 'Next Greater in a Circle', diff: 'medium',
      tags: ['monotonic stack', 'circular'],
      statement: M`
        «nums» is **circular**: after the last element comes the first. For each element, return the first element **strictly greater** than it when walking forward (wrapping around), or «−1» if none exists.
      `,
      fn: { name: 'nextGreaterElements', params: [['int[]', 'nums']], ret: 'int[]' },
      tests: [
        { args: [[1, 2, 1]], ex: true, expect: [2, -1, 2], why: 'The last 1 wraps around to find 2.' },
        { args: [[1, 2, 3, 4, 3]], ex: true, expect: [2, 3, 4, -1, 4] },
        { args: [[5]], expect: [-1] },
        { args: [[3, 3, 3]], expect: [-1, -1, -1] },
        { args: [[5, 4, 3, 2, 1]], expect: [-1, 5, 5, 5, 5] },
        { args: [[1, 5, 3, 6, 8]], expect: [5, 6, 6, 8, -1] },
        { args: [[-2, -1, -3]], expect: [-1, -1, -2] },
        { args: [{ $gen: 'ints', args: [100000, -1000000000, 1000000000, 87] }], big: true },
        { args: [{ $gen: 'range', args: [100000, 100000, -1] }], big: true },
      ],
      constraints: ['1 ≤ nums.length ≤ 10⁵ (LeetCode: 10⁴)', '−10⁹ ≤ nums[i] ≤ 10⁹'],
      hints: [
        'Without wrapping this is the standard next-greater stack. How do you let the end "see" the beginning?',
        'Pretend the array is concatenated with itself: walk indices 0 … 2n − 1 and use «i % n».',
        'Only push indices during the first pass (i < n). The second pass only resolves elements still waiting.',
      ],
      solution: {
        pattern: '**Monotonic stack plus the "iterate twice" trick** for circular arrays.',
        intuition: 'In a circle, an element’s next greater is either later in the array or, wrapping around, earlier. Walking through the array twice gives every element a chance to see all others after it. After the second lap, anything still waiting has no greater element.',
        java: J`class Solution {
    public int[] nextGreaterElements(int[] nums) {
        int n = nums.length;
        int[] res = new int[n];
        Arrays.fill(res, -1);
        int[] st = new int[n];
        int top = 0;
        for (int i = 0; i < 2 * n; i++) {
            int v = nums[i % n];
            while (top > 0 && v > nums[st[top - 1]]) res[st[--top]] = v;
            if (i < n) st[top++] = i;          // second lap only resolves
        }
        return res;
    }
}`,
        time: 'O(n)', space: 'O(n)',
        pitfalls: M`
          - Pushing during the second lap too makes the stack hold 2n indices. That's still correct if you mod them, but pointless.
          - Building an actual doubled array wastes memory; «i % n» does the same job.
        `,
        alts: [
          { name: 'Brute force with wraparound', time: 'O(n²)', space: 'O(1)', java: J`class Solution {
    public int[] nextGreaterElements(int[] nums) {
        int n = nums.length;
        int[] res = new int[n];
        for (int i = 0; i < n; i++) {
            res[i] = -1;
            for (int k = 1; k < n; k++) if (nums[(i + k) % n] > nums[i]) { res[i] = nums[(i + k) % n]; break; }
        }
        return res;
    }
}` },
        ],
        talk: 'The standard decreasing stack for next greater, but I iterate i from 0 to 2n−1 using i mod n, and only push during the first lap. Anything never popped stays −1. O(n).',
      },
      lc: [lc(503, 'next-greater-element-ii', 'Next Greater Element II', 'same'), lc(496, 'next-greater-element-i', 'Next Greater Element I', 'easier'), lc(556, 'next-greater-element-iii', 'Next Greater Element III', 'variant')],
      drill: { prompt: 'Circular array: for each element, the first strictly greater element going forward (with wraparound).', pattern: 'mono-stack', why: 'Next greater with a monotonic stack, scanning the array twice (i mod n).' },
    } },

    { problem: {
      id: 'largest-rectangle', title: 'Largest Rectangle in a Histogram', diff: 'hard',
      tags: ['monotonic stack', 'boundaries'],
      statement: M`
        «heights[i]» is the height of the i-th bar in a histogram; every bar is 1 wide. Return the area of the **largest rectangle** that fits entirely inside the histogram.
      `,
      fn: { name: 'largestRectangleArea', params: [['int[]', 'heights']], ret: 'int' },
      tests: [
        { args: [[2, 1, 5, 6, 2, 3]], ex: true, expect: 10, why: 'Bars 2..3 (heights 5, 6) at height 5: width 2.' },
        { args: [[2, 4]], ex: true, expect: 4 },
        { args: [[1]], expect: 1 },
        { args: [[0]], expect: 0 },
        { args: [[1, 1, 1, 1]], expect: 4 },
        { args: [[4, 2, 0, 3, 2, 5]], expect: 6 },
        { args: [[6, 2, 5, 4, 5, 1, 6]], expect: 12 },
        { args: [[1, 2, 3, 4, 5]], expect: 9 },
        { args: [{ $gen: 'ints', args: [100000, 0, 10000, 89] }], big: true },
        { args: [{ $gen: 'range', args: [100000, 1, 1] }], big: true },
      ],
      constraints: ['1 ≤ heights.length ≤ 10⁵', '0 ≤ heights[i] ≤ 10⁴'],
      hints: [
        'Any maximal rectangle is as tall as its shortest bar. So for each bar, ask: what is the widest rectangle whose height is exactly this bar’s height?',
        'It extends left and right until the first **shorter** bar on each side, so you need the previous smaller and next smaller element for every bar.',
        'Keep an increasing stack of indices. When a shorter bar arrives, pop: the popped bar’s right boundary is the new bar, and its left boundary is the new stack top. Add a 0-height sentinel at the end to flush the stack.',
      ],
      solution: {
        pattern: '**Monotonic stack for boundaries:** popping an element reveals both its next-smaller (the element doing the popping) and its previous-smaller (the element underneath).',
        intuition: M`
          The best rectangle using bar «i» as its limiting height spans from just after the previous shorter bar to just before the next shorter bar. An increasing stack keeps bars whose right boundary hasn't appeared yet. When a shorter bar shows up, each popped bar is finalized: we now know its right boundary (the current index) and its left boundary (the index below it on the stack, or −1).
        `,
        java: J`class Solution {
    public int largestRectangleArea(int[] heights) {
        int n = heights.length, best = 0;
        int[] st = new int[n + 1];                    // indices, heights increasing
        int top = 0;
        for (int i = 0; i <= n; i++) {
            int h = (i == n) ? 0 : heights[i];        // sentinel flushes everything
            while (top > 0 && h < heights[st[top - 1]]) {
                int height = heights[st[--top]];
                int left = (top == 0) ? -1 : st[top - 1];
                best = Math.max(best, height * (i - left - 1));
            }
            st[top++] = i;
        }
        return best;
    }
}`,
        time: 'O(n)', space: 'O(n)',
        why: 'Every maximal rectangle has some bar as its shortest, and extends exactly to the nearest shorter bars on both sides. Each bar’s rectangle is evaluated when it is popped, so the maximum is among the evaluated areas.',
        pitfalls: M`
          - Without the sentinel, bars left on the stack at the end never get evaluated. The trailing 0 forces them out.
          - The width is «i − left − 1», not «i − popped»: the rectangle extends left past previously popped taller bars.
        `,
        alts: [
          { name: 'Precompute previous/next smaller arrays', time: 'O(n)', space: 'O(n)', note: 'Two separate monotonic-stack passes compute «left[i]» and «right[i]», then area = heights[i] × (right[i] − left[i] − 1). Easier to reason about, same complexity.',
            java: J`class Solution {
    public int largestRectangleArea(int[] h) {
        int n = h.length;
        int[] left = new int[n], right = new int[n];
        Deque<Integer> st = new ArrayDeque<>();
        for (int i = 0; i < n; i++) { while (!st.isEmpty() && h[st.peek()] >= h[i]) st.pop(); left[i] = st.isEmpty() ? -1 : st.peek(); st.push(i); }
        st.clear();
        for (int i = n - 1; i >= 0; i--) { while (!st.isEmpty() && h[st.peek()] >= h[i]) st.pop(); right[i] = st.isEmpty() ? n : st.peek(); st.push(i); }
        int best = 0;
        for (int i = 0; i < n; i++) best = Math.max(best, h[i] * (right[i] - left[i] - 1));
        return best;
    }
}` },
          { name: 'Expand from each bar', time: 'O(n²)', space: 'O(1)', java: J`class Solution {
    public int largestRectangleArea(int[] h) {
        int best = 0;
        for (int i = 0; i < h.length; i++) {
            int l = i, r = i;
            while (l > 0 && h[l - 1] >= h[i]) l--;
            while (r < h.length - 1 && h[r + 1] >= h[i]) r++;
            best = Math.max(best, h[i] * (r - l + 1));
        }
        return best;
    }
}` },
        ],
        followups: M`
          - **Maximal rectangle of 1s in a binary matrix** (LeetCode 85): build a histogram per row (heights of consecutive 1s) and run this algorithm on each row: O(rows × cols).
          - **Sum of subarray minimums** (LeetCode 907): the same boundaries; each element contributes value × leftSpan × rightSpan.
        `,
        talk: 'Each bar’s best rectangle extends to the nearest shorter bars on both sides. An increasing stack gives both: when a shorter bar pops index j, the popper is j’s right boundary and the new top is its left. A zero sentinel flushes the stack. O(n).',
      },
      viz: { id: 'histogram' },
      lc: [lc(84, 'largest-rectangle-in-histogram', 'Largest Rectangle in Histogram', 'same'), lc(85, 'maximal-rectangle', 'Maximal Rectangle', 'harder'), lc(907, 'sum-of-subarray-minimums', 'Sum of Subarray Minimums', 'harder'), lc(1793, 'maximum-score-of-a-good-subarray', 'Maximum Score of a Good Subarray', 'harder')],
      drill: { prompt: 'Largest rectangle that fits under a histogram of bar heights.', pattern: 'mono-stack', why: 'Each bar extends to its nearest shorter neighbours; an increasing stack reveals both boundaries on pop.' },
    } },

    { problem: {
      id: 'sliding-window-max', title: 'Maximum of Every Window', diff: 'hard',
      tags: ['monotonic deque', 'window'],
      statement: M`
        Given an array «nums» and a window size «k», a window of size k slides from the left end to the right end, one step at a time. Return an array with the **maximum** of each window position.
      `,
      fn: { name: 'maxSlidingWindow', params: [['int[]', 'nums'], ['int', 'k']], ret: 'int[]' },
      tests: [
        { args: [[1, 3, -1, -3, 5, 3, 6, 7], 3], ex: true, expect: [3, 3, 5, 5, 6, 7] },
        { args: [[1], 1], ex: true, expect: [1] },
        { args: [[4, 2], 2], expect: [4] },
        { args: [[9, 8, 7, 6, 5], 2], expect: [9, 8, 7, 6] },
        { args: [[1, 2, 3, 4, 5], 5], expect: [5] },
        { args: [[1, -1], 1], expect: [1, -1] },
        { args: [[7, 2, 4], 2], expect: [7, 4] },
        { args: [[1, 3, 1, 2, 0, 5], 3], expect: [3, 3, 2, 5] },
        { args: [{ $gen: 'ints', args: [100000, -10000, 10000, 91] }, 1000], big: true },
        { args: [{ $gen: 'range', args: [100000, 100000, -1] }, 50000], big: true },
      ],
      constraints: ['1 ≤ k ≤ nums.length ≤ 10⁵', '−10⁴ ≤ nums[i] ≤ 10⁴ (the large tests go wider)'],
      hints: [
        'Recomputing each window’s max is O(nk). A heap gives O(n log n). Can you get O(n)?',
        'If a newer element is ≥ an older one, the older one can never be a window max again. Why keep it?',
        'Keep a deque of indices with decreasing values. Pop smaller values from the back when adding, pop the front when it leaves the window, and the front is the max.',
      ],
      solution: {
        pattern: '**Monotonic deque:** a monotonic stack that also expires elements from the front. It gives O(n) window min/max.',
        intuition: M`
          Candidates for "maximum of the current or a future window" form a decreasing sequence: any element with a larger element after it is dominated forever. Keep exactly those candidates in a deque. New elements evict smaller candidates from the back, and candidates that fall out of the window leave from the front.
        `,
        java: J`class Solution {
    public int[] maxSlidingWindow(int[] nums, int k) {
        int n = nums.length;
        int[] res = new int[n - k + 1];
        int[] dq = new int[n];                       // indices; nums decreasing from head to tail
        int head = 0, tail = 0;
        for (int i = 0; i < n; i++) {
            if (head < tail && dq[head] <= i - k) head++;               // expired
            while (head < tail && nums[dq[tail - 1]] <= nums[i]) tail--; // dominated
            dq[tail++] = i;
            if (i >= k - 1) res[i - k + 1] = nums[dq[head]];
        }
        return res;
    }
}`,
        time: 'O(n)', space: 'O(k)', spaceWhy: 'at most k live candidates (the array here is n for simplicity)',
        pitfalls: M`
          - Store indices, not values: expiry needs positions.
          - Using «<» instead of «<=» when evicting keeps equal values. That's still correct, just more work.
        `,
        alts: [
          { name: 'Max-heap with lazy expiry', time: 'O(n log n)', space: 'O(n)', note: 'Push (value, index); before reading the top, pop entries whose index has left the window. It’s a common first answer and a good bridge to the deque.',
            java: J`class Solution {
    public int[] maxSlidingWindow(int[] nums, int k) {
        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[0] != b[0] ? Integer.compare(b[0], a[0]) : Integer.compare(b[1], a[1]));
        int[] res = new int[nums.length - k + 1];
        for (int i = 0; i < nums.length; i++) {
            pq.offer(new int[]{nums[i], i});
            if (i >= k - 1) {
                while (pq.peek()[1] <= i - k) pq.poll();
                res[i - k + 1] = pq.peek()[0];
            }
        }
        return res;
    }
}` },
          { name: 'Rescan each window', time: 'O(n·k)', space: 'O(1)', java: J`class Solution {
    public int[] maxSlidingWindow(int[] nums, int k) {
        int[] res = new int[nums.length - k + 1];
        for (int i = 0; i + k <= nums.length; i++) { int m = Integer.MIN_VALUE; for (int j = i; j < i + k; j++) m = Math.max(m, nums[j]); res[i] = m; }
        return res;
    }
}` },
        ],
        followups: M`
          - **Window minimum:** the same deque with increasing values.
          - **Longest subarray where max − min ≤ limit** (LeetCode 1438): two deques (max and min) plus a variable window.
          - **Shortest subarray with sum ≥ K, negatives allowed** (LeetCode 862): a monotonic deque over prefix sums.
        `,
        talk: 'A monotonic deque of indices with decreasing values. Each new element evicts smaller ones from the back, since they can never be a max again; the front expires when it leaves the window. The front is always the window max. Each index enters and leaves once: O(n).',
      },
      viz: { id: 'slidingMaxDeque' },
      lc: [lc(239, 'sliding-window-maximum', 'Sliding Window Maximum', 'same'), lc(1438, 'longest-continuous-subarray-with-absolute-diff-less-than-or-equal-to-limit', 'Longest Continuous Subarray With Absolute Diff Less Than or Equal to Limit', 'harder'), lc(862, 'shortest-subarray-with-sum-at-least-k', 'Shortest Subarray with Sum at Least K', 'harder'), lc(1696, 'jump-game-vi', 'Jump Game VI', 'harder')],
      drill: { prompt: 'Report the maximum of every length-k window of an array in O(n).', pattern: 'mono-stack', why: 'Monotonic deque: evict dominated smaller elements from the back, expired ones from the front.' },
    } },
  ],
});
})();

(() => {
const J = String.raw, M = String.raw, lc = DSA.lc;

DSA.module({
  id: 'start', title: 'Start Here', short: 'Start here',
  blurb: 'How the lab works, the method that wins interviews, and reading Big-O straight off the constraints.',
  intro: M`
    Three short lessons and two warm-ups. The warm-ups are easy on purpose: they teach you the **Run → Submit** loop and how the grader reports results, so later you can spend all your attention on the problem.
  `,
  more: [
    lc(485, 'max-consecutive-ones', 'Max Consecutive Ones', 'same'),
    lc(169, 'majority-element', 'Majority Element', 'same'),
    lc(1480, 'running-sum-of-1d-array', 'Running Sum of 1d Array', 'easier'),
    lc(1672, 'richest-customer-wealth', 'Richest Customer Wealth', 'easier'),
    lc(229, 'majority-element-ii', 'Majority Element II', 'harder'),
  ],
  items: [
    { lesson: 'welcome', title: 'How DSA Lab works', mins: 5,
      lede: 'Patterns first, then problems that make you apply them, then spaced review so they stick.',
      body: M`
        ## The loop
        Interview problems look endless, but they are built from about twenty **patterns**: two pointers, sliding window, BFS, "binary search on the answer", and so on. Memorizing 500 solutions doesn't scale. What works is to **recognize the pattern**, **know its template cold**, and **adapt it** under time pressure. Every module is built for that:

        1. **Lesson.** What the pattern is, the *signals* in a problem statement that point to it, a Java template, and a step-through visualization you can feed your own inputs.
        2. **Problems.** Original problems in the pattern, graded by a real Java compiler. **Run** checks the examples; **Submit** adds edge cases and large inputs that catch O(n²) solutions.
        3. **Hints, then the solution.** Hints come one at a time. Each solution explains the intuition, the brute force it beats, why it's correct, the pitfalls, the follow-up questions interviewers ask, and a short *say-it-in-the-interview* summary.
        4. **LeetCode practice.** Every problem links to the matching LeetCode problem and a few variants, so you can take the pattern into the wild.
        5. **Review.** When you solve something, you choose when to see it again. Re-solving from a blank editor right before you'd forget is the cheapest way to make a pattern permanent.

        ## Writing solutions
        You write a LeetCode-style class, usually «class Solution» with one method. Keep the method signature from the starter code.

        - «java.util.*», «java.util.function.*» and «java.util.stream.*» are already imported. Add other imports at the top if you need them.
        - «ListNode» and «TreeNode» exist whenever a problem uses them, with the same fields as on LeetCode («val», «next», «left», «right»).
        - «System.out.println» works: output appears under each test in the results panel.
        - **Custom input** runs your code on inputs you type, and shows the reference solution's answer beside yours.

        ## Two engines
        | | In-browser (default) | Your JDK |
        |---|---|---|
        | What runs your code | A real «javac» plus TeaVM, compiled to WebAssembly, in this tab | Your installed JDK, via «node dsa/runner/server.mjs» |
        | Works on | Any modern browser, phones included | The computer running the runner |
        | Runtime errors | Exception type only | Full message with the line number |
        | Recursion depth | About 5,000 nested calls | As deep as a normal JVM |
        | Speed | Roughly 1–3× slower than a JVM | JVM speed |

        :::note Known in-browser limits
        - «String.format» with «%f» (floating-point formatting) crashes. «%d» and «%s» work.
        - «Throwable.getStackTrace()» isn't available.
        - Very deep recursion (thousands of levels) overflows sooner than on a JVM. The tests here are sized so normal recursive solutions pass.

        If something works on your JDK and not in the browser, it's the engine, not you.
        :::

        ## A study plan
        About an hour a day for six to eight weeks covers everything here. A good day looks like this:

        - **10 min:** clear the reviews that are due (topbar chip).
        - **15 min:** one lesson, including playing with its visualization.
        - **30 min:** two or three problems. Give each at least 20 minutes before you open hints.
        - **5 min:** one round of the pattern drill.

        On weekends, do a mock interview: two problems you haven't seen, 45 minutes, no tags.

        :::interview How to use hints well
        A hint you needed is information: it tells you which signal you missed. After you solve a problem with hints, reread the solution's **Pattern** box and say out loud what in the statement should have tipped you off.
        :::
      `,
    },

    { lesson: 'method', title: 'The interview method', mins: 8,
      lede: 'What interviewers actually score, and a step-by-step method that hits every item on their rubric.',
      body: M`
        ## What's on the scorecard
        Most companies grade coding rounds on some version of these four rows. Getting the optimal answer silently, after 40 minutes of mumbling, scores worse than you'd think.

        | Signal | What they look for | How you show it |
        |---|---|---|
        | **Problem solving** | You find a correct approach and improve it | Brute force first, then name the bottleneck and the pattern that removes it |
        | **Coding** | Clean, correct, idiomatic code | Good names, small helpers, no copy-paste, standard library used well |
        | **Verification** | You catch your own bugs | Trace an example by hand, then check edge cases, before saying "done" |
        | **Communication** | They can follow your thinking | Narrate decisions, not keystrokes; ask before assuming |

        ## The steps (45-minute round)
        1. **Understand (3–5 min).** Restate the problem. Ask about input size, value ranges, duplicates, negatives, empty input, sortedness, and what to return when there's no answer. *The constraints tell you the target complexity; see the next lesson.*
        2. **Examples (2–3 min).** Work one normal example by hand and invent an edge case: empty, one element, all equal, already sorted.
        3. **Brute force (2–3 min).** Say it and its complexity, even if it's obviously too slow. It proves you understand the problem, and its inefficiency points at the fix.
        4. **Optimize (5–10 min).** Ask *what work is repeated?* and *what would make the inner loop O(1) or O(log n)?* That is where patterns come in: a hash map removes a search, sorting enables two pointers, a heap maintains a best-so-far.
        5. **Plan (2 min).** Outline the algorithm in a few lines and get a nod from the interviewer before you type.
        6. **Code (10–15 min).** Write it top-down. If a piece is fiddly, call a helper you'll write next.
        7. **Test (5 min).** Run your example through the code line by line, updating variables as you go. Then check the edge cases. Fix bugs calmly and say what you changed.
        8. **Wrap up (2 min).** State time and space complexity, and mention trade-offs or what you'd do for a follow-up (streaming input, huge data, many queries).

        :::key The one question that unlocks most problems
        **"What does the brute force recompute?"** Two Sum rescans the array for each element, so a hash map remembers what you've seen. Maximum subarray re-adds overlapping ranges, so carry a running sum. Fibonacci recomputes subtrees, so memoize. Almost every optimization is *stop recomputing*.
        :::

        ## Phrases that help
        - "Let me restate it to make sure I understand…"
        - "Can the input be empty? Can values be negative? Roughly how large is n?"
        - "The brute force is O(n²): for each element, scan the rest. The repeated work is the scan, so a hash map should make it O(1)."
        - "I'll write a helper for this part so the main loop stays readable."
        - "Let me trace this example through the code before I call it done."
        - "Time is O(n log n) because of the sort, and space is O(n) for the map."

        ## Failure modes to avoid
        - **Coding before agreeing on an approach.** You risk writing the wrong algorithm beautifully.
        - **Going silent.** The interviewer can't give partial credit, or a nudge, for thoughts they can't hear.
        - **Skipping verification.** "I think this works" is weaker than finding and fixing your own off-by-one.
        - **Over-optimizing too early.** Get a correct O(n log n) before chasing O(n).
        - **Fighting the language.** Know Java's collections well enough that the API never slows you down; the next module drills them.

        @quiz 0
        @quiz 1
      `,
      quiz: [
        { q: 'You have an idea for an O(n) solution but are not sure it handles duplicates. What is the best move?',
          options: ['Start coding it and handle duplicates later', 'Walk through a small example with duplicates out loud before coding', 'Switch to a brute force to be safe', 'Ask the interviewer whether duplicates matter and wait'],
          answer: 1, why: 'Testing the idea on a tricky example *before* coding is cheap and shows verification skill. Asking is fine too, but you should still check your own approach, and a known brute force is only a fallback.' },
        { q: 'Which statement best describes why you should state the brute force even when you already see the optimal approach?',
          options: ['Interviewers require it', 'It shows you understand the problem, gives a correctness baseline, and its bottleneck motivates the optimization', 'It makes the interview longer', 'The brute force is usually what gets accepted'],
          answer: 1, why: 'The brute force is the reference point. Naming its complexity and what it recomputes is exactly the reasoning interviewers want to hear. It takes 30 seconds.' },
      ],
    },

    { lesson: 'big-o', title: 'Big-O from the constraints', mins: 9,
      lede: 'The input size tells you the complexity you need before you have an idea. Learn the table and the counting rules.',
      body: M`
        ## Budget: about 10⁸ simple operations per second
        A JVM does very roughly 10⁸ to 10⁹ simple operations (array reads, additions, comparisons) per second. Judges usually allow 1–2 seconds. Hash map operations and object allocation are 10–50× more expensive than an array access. So plan on **about 10⁸ cheap steps**, and read the constraint on *n* as a hint about the intended solution.

        | If n is up to… | You can afford | Typical approaches |
        |---|---|---|
        | 10–12 | O(n!) | Permutations, brute-force search |
        | 20–25 | O(2ⁿ) | Subsets, bitmask DP, backtracking |
        | 100–500 | O(n³) | Triple loops, interval DP, Floyd–Warshall |
        | 1,000–5,000 | O(n²) | Pairwise loops, 2-D DP |
        | 10⁵–10⁶ | O(n log n) or O(n) | Sorting, heaps, binary search, hashing, two pointers, sliding window |
        | 10⁹ and up | O(log n) or O(1) | Binary search on the value, math |

        :::key Use it backwards
        "n ≤ 10⁵" all but says **don't nest two loops over the input**. "n ≤ 20" invites exponential search. "values up to 10⁹, n ≤ 10⁵" often means *sort* or *binary search on the answer*, not an array indexed by value.
        :::

        ## How big these actually get
        | n | log₂ n | n log₂ n | n² | 2ⁿ |
        |---|---|---|---|---|
        | 10 | 3 | 33 | 100 | 1,024 |
        | 1,000 | 10 | 10⁴ | 10⁶ | ≈10³⁰¹ |
        | 10⁵ | 17 | 1.7·10⁶ | 10¹⁰ ✗ | — |
        | 10⁶ | 20 | 2·10⁷ | 10¹² ✗ | — |

        ## Counting rules
        - **Sequential blocks add:** O(n) + O(n log n) = O(n log n). Keep only the biggest term.
        - **Nested loops multiply,** but only when the inner loop's length depends on n. A loop over 26 letters inside a loop over n is O(26n) = O(n).
        - **Halving means log.** Binary search, a balanced tree's height, repeated «n /= 2»: O(log n).
        - **Recursion: count the calls.** Calls ≈ branches^depth. Naive Fibonacci makes two calls, depth n: O(2ⁿ). With memoization, each of the n states is computed once: O(n).
        - **Amortized cost.** Some operations are occasionally expensive but cheap on average. «ArrayList.add» sometimes copies the whole array, but doubling keeps the average O(1). A monotonic stack pushes and pops each element at most once, so the whole loop is O(n) despite the inner «while».
        - **Hashing is O(1) on average,** O(n) in the pathological worst case. Java 8+ turns long bucket chains into trees, so the worst case is O(log n).
        - **Strings are not free.** «s.substring», «s + t» and «new String(chars)» cost O(length). Concatenating in a loop is O(n²); use «StringBuilder».

        ## Space counts too
        - The recursion stack is memory: depth d costs O(d) space. DFS on a 10⁵-node linked list can overflow the stack.
        - The output usually doesn't count against extra space, but say so when you rely on it.
        - «int[]» of size 10⁷ is 40 MB. «Integer» objects are about 4× larger than «int».

        @quiz 0
        @quiz 1
        @quiz 2
      `,
      quiz: [
        { q: 'n ≤ 2·10⁵ and values up to 10⁹. Which target complexity is realistic?',
          options: ['O(n²)', 'O(n log n)', 'O(2ⁿ)', 'O(n · maxValue)'],
          answer: 1, why: 'n² = 4·10¹⁰ operations is far too slow, and an array indexed by value (10⁹) is too big. **O(n log n)** (sorting, heaps, binary search) or O(n) (hashing) is the intended range.' },
        { q: 'What is the time complexity?\n\n«for (int i = 0; i < n; i++) for (int j = i; j < n; j *= 2) work();» (assume j starts at 1 when i is 0)',
          options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'],
          answer: 1, why: 'The outer loop runs n times, and the inner loop doubles j, so it runs about log n times. n · log n = **O(n log n)**.' },
        { q: 'A monotonic-stack loop has an inner «while (!stack.isEmpty() && …) stack.pop();». Why is the whole algorithm still O(n)?',
          options: ['The while loop usually exits immediately', 'Every element is pushed once and popped at most once, so all the pops together total at most n', 'Stacks have O(1) operations', 'It is actually O(n²)'],
          answer: 1, why: 'Amortized analysis: count the **total** work, not the worst iteration. There are n pushes and at most n pops overall, so the total is O(n).' },
      ],
    },

    { problem: {
      id: 'max-consecutive-ones', title: 'Longest Streak of Ones', diff: 'easy',
      tags: ['array', 'single pass'],
      statement: M`
        A server writes one status bit per minute: «1» when it's healthy, «0» when it isn't. Given the log as an array «bits», return the length of the **longest run of consecutive 1s**.

        This is a warm-up. Its real job is to get you comfortable with **Run** (examples only) and **Submit** (every test, including a 100,000-element log).
      `,
      fn: { name: 'longestStreak', params: [['int[]', 'bits']], ret: 'int' },
      tests: [
        { args: [[1, 1, 0, 1, 1, 1]], ex: true, expect: 3, why: 'The last three minutes are the longest healthy run.' },
        { args: [[1, 0, 1, 1, 0, 1]], ex: true, expect: 2 },
        { args: [[0, 0, 0]], expect: 0 },
        { args: [[1]], expect: 1 },
        { args: [[0]], expect: 0 },
        { args: [[1, 1, 1, 1]], expect: 4 },
        { args: [[1, 0, 1, 0, 1, 0, 1]], expect: 1 },
        { args: [[0, 1, 1, 1, 0, 1, 1, 1, 1, 0]], expect: 4 },
        { args: [{ $gen: 'ints', args: [100000, 0, 1, 7] }], big: true },
        { args: [{ $gen: 'repeat', args: [100000, 1] }], big: true, expect: 100000 },
      ],
      constraints: ['1 ≤ bits.length ≤ 10⁵', 'bits[i] is 0 or 1'],
      hints: [
        'You only need to look at each bit once. What do you need to remember as you walk left to right?',
        'Keep two numbers: the length of the **current** run and the **best** run seen so far.',
        'On a «1», extend the current run and update the best. On a «0», reset the current run to 0.',
      ],
      solution: {
        pattern: 'A **single pass with running state**. Many "longest/best contiguous" questions need only the current run and the best so far. Recognize this and you avoid building subarrays.',
        intuition: M`
          A run of 1s ends exactly when you hit a 0. So walk the array once, count the current run, and reset it at every 0. The answer is the largest count you ever reached.
        `,
        java: J`class Solution {
    public int longestStreak(int[] bits) {
        int best = 0, cur = 0;
        for (int b : bits) {
            if (b == 1) {
                cur++;
                best = Math.max(best, cur);
            } else {
                cur = 0;
            }
        }
        return best;
    }
}`,
        time: 'O(n)', space: 'O(1)', timeWhy: 'one pass', spaceWhy: 'two counters',
        pitfalls: M`
          - Updating «best» only when a 0 appears misses a run that reaches the end of the array («[0,1,1]»). Update inside the «1» branch, or once more after the loop.
          - Don't build lists of runs. You never need more than two numbers.
        `,
        alts: [
          { name: 'Brute force: start a count at every index', time: 'O(n²)', space: 'O(1)',
            note: 'For each start index, count forward while you see 1s. Correct but quadratic; the large test times out.',
            java: J`class Solution {
    public int longestStreak(int[] bits) {
        int best = 0;
        for (int i = 0; i < bits.length; i++) {
            int j = i;
            while (j < bits.length && bits[j] == 1) j++;
            best = Math.max(best, j - i);
        }
        return best;
    }
}` },
        ],
        followups: M`
          - **You may flip at most one 0.** Use a sliding window that contains at most one zero (LeetCode 487). With at most **k** flips it's the same window with a counter (LeetCode 1004, in the Sliding Window module).
          - **Streaming input, unbounded length.** The same two counters work. It's already O(1) memory.
        `,
        talk: 'One pass, tracking the current run and the best run. A zero resets the current run. O(n) time, O(1) space.',
      },
      lc: [lc(485, 'max-consecutive-ones', 'Max Consecutive Ones', 'same'), lc(487, 'max-consecutive-ones-ii', 'Max Consecutive Ones II', 'variant', { premium: true }), lc(1004, 'max-consecutive-ones-iii', 'Max Consecutive Ones III', 'harder')],
      drill: { prompt: 'Given a binary array, return the length of the longest run of consecutive 1s.', pattern: 'sliding-window', why: 'It’s the simplest "longest contiguous run" question: a single pass with a running count (a degenerate sliding window). With "flip up to k zeros" it becomes a real sliding window.' },
    } },

    { problem: {
      id: 'majority-element', title: 'The Majority Vote', diff: 'easy',
      tags: ['array', 'voting', 'counting'],
      statement: M`
        An election produced the array «votes», where each entry is a candidate id. Exactly one candidate received **more than half** of all votes. Return that candidate's id.

        Solving it with a hash map is easy. For the full lesson, find the **O(n) time, O(1) extra space** solution.
      `,
      fn: { name: 'majority', params: [['int[]', 'votes']], ret: 'int' },
      tests: [
        { args: [[3, 2, 3]], ex: true, expect: 3 },
        { args: [[2, 2, 1, 1, 1, 2, 2]], ex: true, expect: 2 },
        { args: [[7]], expect: 7 },
        { args: [[5, 5]], expect: 5 },
        { args: [[1, 9, 9]], expect: 9 },
        { args: [[4, 4, 4, 1, 2]], expect: 4 },
        { args: [[1, 2, 3, 4, 4, 4, 4]], expect: 4 },
        { args: [[-1, -1, 2147483647]], expect: -1 },
        { args: [[6, 5, 6, 5, 6, 5, 6]], expect: 6 },
      ],
      constraints: ['1 ≤ votes.length ≤ 5·10⁴', '−2³¹ ≤ votes[i] ≤ 2³¹ − 1', 'A majority candidate always exists.'],
      hints: [
        'The hash-map solution counts every candidate. Can you do it without remembering every candidate?',
        'Imagine pairing up votes for *different* candidates and throwing both away. Who must be left at the end?',
        'Keep one «candidate» and a «count». A vote for the candidate adds 1, any other vote subtracts 1, and when the count hits 0 the next vote becomes the new candidate.',
      ],
      solution: {
        pattern: 'The **Boyer–Moore majority vote** is a classic "cancellation" argument. It shows that some counting problems need only O(1) state when the answer is guaranteed to exist.',
        intuition: M`
          Cancel out pairs of votes for different candidates. Each cancellation removes at most one majority vote and at least one other vote. The majority has more than n/2 votes, more than everyone else combined, so it can never be fully cancelled. Whatever survives is the majority.

          The algorithm does this cancellation in one pass. «count» is how many uncancelled votes the current «candidate» has.
        `,
        java: J`class Solution {
    public int majority(int[] votes) {
        int candidate = 0, count = 0;
        for (int v : votes) {
            if (count == 0) candidate = v;          // everything before cancelled out
            count += (v == candidate) ? 1 : -1;
        }
        return candidate;
    }
}`,
        time: 'O(n)', space: 'O(1)',
        why: M`
          Split the array wherever «count» returns to 0. Inside each finished segment, the segment's candidate has exactly half the votes, so the true majority has *at most* half of that segment. Since the majority holds more than half of the whole array, it must hold more than half of the final, unfinished segment. There the candidate that survives with a positive count must be the majority.
        `,
        pitfalls: M`
          - This only works when a majority is **guaranteed**. If it might not exist, do a second pass to count the candidate's votes and check that it's more than n/2.
          - Comparing «Integer» objects with «==» in the hash-map version is a classic bug. It works for small values (cached from −128 to 127) and fails for large ones. Use «.equals», or unbox to «int».
        `,
        alts: [
          { name: 'Hash map counts', time: 'O(n)', space: 'O(n)', note: 'Count with «merge(v, 1, Integer::sum)» and return as soon as a count passes n/2. Perfectly fine in an interview; mention Boyer–Moore as the O(1)-space follow-up.',
            java: J`class Solution {
    public int majority(int[] votes) {
        Map<Integer, Integer> count = new HashMap<>();
        for (int v : votes)
            if (count.merge(v, 1, Integer::sum) > votes.length / 2) return v;
        throw new IllegalArgumentException("no majority");
    }
}` },
          { name: 'Sort and take the middle', time: 'O(n log n)', space: 'O(1)–O(log n)', note: 'After sorting, the majority element must cover index n/2. It’s short, but slower, and it mutates the input.',
            java: J`class Solution {
    public int majority(int[] votes) {
        Arrays.sort(votes);
        return votes[votes.length / 2];
    }
}` },
        ],
        followups: M`
          - **Elements appearing more than n/3 times.** Keep *two* candidates and two counts, then verify with a second pass (LeetCode 229).
          - **The majority might not exist.** Run the vote, then verify.
        `,
        talk: 'I can count with a hash map in O(n) space. For O(1) space I use Boyer–Moore voting: votes for different candidates cancel pairwise, and since the majority has more than half, it survives. Two variables, one pass.',
      },
      lc: [lc(169, 'majority-element', 'Majority Element', 'same'), lc(229, 'majority-element-ii', 'Majority Element II', 'harder')],
      drill: { prompt: 'Find the element that appears more than ⌊n/2⌋ times, using O(1) extra space.', pattern: 'counting', why: 'It’s a counting problem, and the O(1)-space trick (Boyer–Moore voting) replaces the frequency map with a single candidate and count.' },
    } },
  ],
});
})();

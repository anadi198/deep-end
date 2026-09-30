(function (root) {
  const L = root.LLD, J = L.J;
  L.module({
    id: 'start', title: 'Start here', short: 'Start',
    blurb: 'What an LLD round grades, the 5-step script, and how this lab keeps things from leaking out of your head.',
    items: [
      {
        lesson: 'lld-rounds', title: 'What an LLD round actually grades', mins: 5,
        remember: 'LLD rounds grade clear responsibilities and easy extension, not how many pattern names you know.',
        cue: 'An LLD prompt lands → clarify, list entities, draw classes, code one path, walk a follow-up',
        body: J`
          ## Two flavours of the same round

          - **Design round (whiteboard).** "Design a parking lot." You talk, draw classes, write key interfaces and a few methods. 45 to 60 minutes.
          - **Machine coding round.** Same prompt, but you write runnable code in 60 to 120 minutes, and it has to work. Common at Indian product companies.

          Both are graded on the same thing: **would this code survive the next requirement?**

          ## The 5-step script

          1. **Clarify.** Write the requirements as a short numbered list. Ask about scale, concurrency (can two people book the same seat?) and what is out of scope. Two minutes here saves twenty later.
          2. **Nouns to classes, verbs to methods.** Underline the nouns (vehicle, spot, ticket) and verbs (park, pay, leave).
          3. **Draw the classes.** Boxes and arrows: who owns whom, who talks to whom. Keep it rough.
          4. **Code one path end to end.** Interfaces first, then the happy path (park a car, get a ticket).
          5. **Walk a follow-up.** "What if we add electric charging spots?" Show exactly which one class changes. This is where patterns earn their place.

          @stop

          ## What the interviewer is scoring

          | They look for | It looks like |
          |---|---|
          | Clear responsibilities | Each class has one reason to change; no 400-line «Manager» |
          | Extension without surgery | A new rule is a new class, not a new «else if» in five places |
          | Sensible names | «ParkingSpot», «FeePolicy», not «Helper», «Data», «Util» |
          | Correct and edge-aware | Full lot, double checkout, zero-length stay |
          | Concurrency awareness | "Two threads could grab the same spot, so allocation is atomic" |

          :::warn The three ways people fail
          - **Jumping to code** before the requirements are pinned down.
          - **A god class** that does everything («ParkingLotManager» with 30 methods).
          - **Pattern stuffing.** Six patterns for a problem that needed two. Interviewers read it as not understanding *why*.
          :::

          @quiz 0
        `,
        quiz: [
          {
            q: 'You have 45 minutes for "design a library system". What should the first two minutes be?',
            options: ['Write the «Book» class with all its fields', 'Pick the design patterns you will use', 'Write down the requirements and ask what is in and out of scope', 'Draw the database schema'],
            answer: 2,
            why: 'Clarify first. The requirement list is what every later decision points back to, and it tells you which follow-ups to design for.',
          },
        ],
      },
      {
        lesson: 'how-to-use', title: 'How to use this lab (and not forget it)', mins: 3,
        remember: 'Do one step, then stop if you want. The 5-minute daily review does the remembering for you.',
        body: J`
          ## Every step is small

          Lessons take 3 to 8 minutes, exercises 8 to 15. Each lesson opens with a **Remember this** box: the one sentence worth keeping. If you read nothing else, read that.

          ## You do not have to memorise anything

          When you finish a lesson, its remember line and its **cue card** ("when you see X, reach for Y") go into your **Today** review. They come back a day later, then at growing gaps, just before you would forget them. Five minutes, most days. That is the whole habit.

          ## Only 12 patterns are worth learning properly

          They fall into four moves: **swap it, wrap it, pass it on, build it**. The [pattern map](#/patterns) shows them. The other 11 patterns you only need to recognise by name, and they get one lesson between them.

          ## Exercises

          - **Build** exercises are graded by tests, in your browser.
          - **Design** exercises have no tests. Press **Review with Claude** and you get the one thing to fix.
          - Anything with threads says **JDK only**. It needs the small runner on your computer (see [Setup](#/setup)).

          ## When your head is full

          Press **◎** in the top bar for focus mode: it hides everything but the current step. The **Continue** button on the home page always takes you to exactly where you stopped.
        `,
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);

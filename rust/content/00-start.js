(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'start', title: 'Start here', short: 'Start',
    blurb: 'What the Rust compiler already checked for you, the eight things it cannot check, and how this lab keeps it from leaking out of your head.',
    items: [
      {
        lesson: 'start-mindset', title: 'What a Rust reviewer actually checks', mins: 5,
        remember: 'The compiler already proved there are no dangling pointers and no data races. Your review hunts what it cannot see: crashes, silence, async traps and plain bugs.',
        cue: 'A Rust PR lands → skip memory safety, hunt crashes, silence, async traps and plain bugs',
        body: R`
          ## Why Rust code looks so busy

          In Java the garbage collector decides when memory is freed, and any thread can touch any object. You stay safe by discipline: «synchronized», immutable objects, code review.

          In Rust the **compiler** tracks who owns each value and who is looking at it right now. Code that could read freed memory, free something twice, or let two threads write the same data without a lock **does not compile**.

          That is why Rust code is full of «&», «mut», «.clone()» and «Arc»: they are the paperwork the compiler checks. Once you can read the paperwork, the code underneath is ordinary backend code.

          ## What that means for your review

          | The compiler already checked | You still check |
          |---|---|
          | No use of freed memory, no double free | Does it crash on bad input? («.unwrap()», «v[i]») |
          | No data races between threads | When it fails, does anyone hear about it? |
          | Every «match» handles every case | Does async code stall, wait forever, drop work or grow without limit? |
          | Types line up, and there is no null | Is the logic right? Is it doing needless work? |

          @stop

          ## The eight review hunts

          Everything you look for in a Rust PR falls into eight hunts, in three groups. Every review exercise in this lab uses them, and the daily review brings them back, so you do not need to memorise them now.

          @hunts

          :::review You are allowed to say "I need a second reviewer"
          If a PR contains «unsafe», a hand-written «Future», or macro definitions («macro_rules!»), ask for a reviewer who knows them. That is a normal policy on Rust teams, not a gap in you. This lab skips those on purpose.
          :::

          @quiz 0
        `,
        quiz: [
          {
            q: 'A PR compiles cleanly. Which of these can it still contain?',
            options: ['A reference to memory that was already freed', 'Two threads writing the same «Vec» without a lock', 'An «.unwrap()» on a network read that crashes on a malformed frame', 'A «match» on an enum that forgets one case'],
            answer: 2,
            why: 'The other three are exactly what the compiler rejects. A panic on bad input is legal Rust: it compiles, and it crashes at run time. That is your job to catch.',
          },
        ],
      },
      {
        lesson: 'start-how', title: 'How this lab works (and how not to forget it)', mins: 3,
        remember: 'Do one step, then stop if you want. The 5-minute daily review does the remembering for you.',
        body: R`
          ## Every step is small

          Lessons take 3 to 8 minutes. Each opens with a **Remember this** box: the one sentence worth keeping. If you read nothing else, read that.

          ## The code is real

          Every snippet marked with an output was compiled by the real Rust compiler (Rust 1.98, on the official Rust Playground), and what it printed is shown underneath. You never have to run something just to see what happens. When you want to poke at one, press **Edit & run**.

          **Predict** boxes ask what a snippet does before you see it. Guessing wrong is the point: that is where the learning sticks.

          ## Three kinds of exercise

          - **Fix**: code that does not compile or fails its tests. Make the smallest change that fixes it.
          - **Build**: write a small piece yourself. The tests grade it.
          - **Review**: a pull request an AI wrote. Click the lines you would comment on and pick which hunt each one is. This is the kind that matters most for you.

          Code runs on the Rust Playground (play.rust-lang.org), so **Run** needs the internet. Reading does not.

          ## You do not have to memorise anything

          When you finish a lesson, its remember line, its **cue card** ("when you see X, reach for Y") and its predict questions go into **Today**. They come back a day later, then at growing gaps. Five minutes, most days.

          ## When your head is full

          Press **◎** in the top bar for focus mode: it hides everything but the current step. **Continue** on the home page always takes you to exactly where you stopped.
        `,
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);

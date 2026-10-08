(function (root) {
  const BL = root.BL, R = BL.R;
  BL.module({
    id: 'start', title: 'Start here', short: 'Start',
    blurb: 'How the lab works: what a strong answer to a backend question contains, and how the simulators and interview drills fit around each lesson.',
    items: [
      {
        lesson: 'st-how', title: 'The first answer opens; the follow-ups decide', mins: 6,
        remember: 'A strong backend answer has three parts in order: the mechanism (what happens, step by step), the failure (when it breaks and what users see), and the trade-off (what you would change and what it costs).',
        cue: 'you finish an answer and the room is quiet → add the failure mode and the trade-off before they ask for them',
        body: R`
          This lab is a quick look at how backend systems behave when something goes wrong: a call times out, a dependency slows down, a cache disappears, a message will not process, a migration takes a lock, two services disagree. Each topic is a question that comes up in senior backend interviews, and each is taught as a mechanism you can run.

          ## What the follow-ups test

          Interviewers rarely judge the first answer. They ask a follow-up, and the follow-ups come from a short list:

          | Follow-up | What it tests |
          |---|---|
          | "What actually happens when…?" | Depth: can you walk the mechanism step by step, naming the real actors? |
          | "And if that fails?" | Failure reasoning: what breaks, what users see, how it recovers |
          | "Why not the other option?" | Trade-offs: the alternative, and what your choice costs |
          | "How would you know?" | Observability: the metric, log or trace that shows it |
          | "What did you do?" | Ownership: your decision, separate from the team's |

          So a strong answer is built in the same order:

          1. **Mechanism.** Number the steps in the order they happen, with concrete actors: the client, the load balancer, the service thread, the database, the broker.
          2. **Failure.** Say when it breaks, and what the user or the downstream sees.
          3. **Trade-off.** Say what you would change, and what it costs: latency, money, complexity, a weaker guarantee.

          ## How each lesson is built

          - **Remember this** at the top: the one sentence to keep. It comes back in the daily review, so there is nothing to memorise now.
          - **The mechanism**, in short sections with a diagram where one helps.
          - **A simulator**: a small model of the mechanism with controls. Change a setting and watch the result change. Most have **Compare every option**, which runs each strategy on the same scenario and puts the numbers side by side.
          - **Defend it**: an interview question worked as a round. You answer out loud first, then see a weak answer and why it falls flat, then take the follow-ups one at a time, then compare against what a strong answer covers. Rate yourself honestly: questions rated *Shaky* or *Missed it* come back sooner, in Today and in **Mock round**.
          - **A cue card** at the end: "when you see X, reach for Y".

          :::note About the simulators
          They are models written for this lab, not benchmarks of any product. Each is seeded, so the same settings always give the same result, and the lab's tests pin the behaviour every lesson describes. The numbers are illustrative; the shapes (what gets worse, what fixes it, what each fix costs) are the point.
          :::

          ## The one idea that runs through everything

          A caller gets one of three things back: a success, an error, or nothing before its timeout. The third tells it only that it stopped waiting. Behind a timeout, the server may have:

          | What the server did | Is it safe to retry blindly? |
          |---|---|
          | Never received the request | yes |
          | Failed before changing anything | yes |
          | Finished the work; the answer was lost on the way back | no: the retry repeats the work |
          | Is still working on it | no: the retry runs alongside it |

          Most of the questions in this lab live in the last two rows, where the caller cannot tell what happened and has to be built so that it does not need to.

          @quiz 0
        `,
        quiz: [
          { q: 'A client gets a timeout. Which outcomes are still possible?', options: ['Only "it failed"', 'It never ran, it failed, it worked but the answer was lost, or it is still running', 'Only "it is still running"', 'It worked; timeouts only happen after success'], answer: 1, why: 'A timeout only says the client stopped waiting. It carries no information about what the server did.' },
        ],
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);

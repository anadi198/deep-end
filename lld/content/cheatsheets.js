/* One-page cheat sheets. Each: { id, title, kind, blurb, lede, body, quiz } */
(function (root) {
  const L = root.LLD, J = L.J;
  L.cheats.push(
    {
      id: 'script', title: 'The LLD round script', kind: 'Interview',
      blurb: 'The 5 steps, the questions to ask, and what to say at each step.',
      body: J`
        ## The 5 steps

        | Step | Minutes | What you produce |
        |---|---|---|
        | 1. Clarify | 3 to 5 | A numbered requirement list, plus what is out of scope |
        | 2. Entities | 3 | Nouns become classes, verbs become methods |
        | 3. Class diagram | 5 to 8 | Boxes and arrows: owns, uses, is-a |
        | 4. Code one path | 20 to 30 | Interfaces first, then the happy path end to end |
        | 5. Follow-up | 5 to 10 | "Adding X changes only this class" |

        ## Clarifying questions that always pay off

        - How many users or items? (Tells you if an in-memory map is fine.)
        - Can two people act on the same thing at once? (Seat booking, last item in stock, one parking spot.)
        - What must be extensible? (New vehicle types, new payment methods, new pricing.)
        - What is explicitly out of scope? (Payments, auth, persistence, UI.)

        ## Phrases that score

        - "This varies, so it goes behind an interface."
        - "Adding a new X is a new class; nothing else changes."
        - "This check-then-act must be atomic, so I'll ..."
        - "I would not add a pattern here yet; a plain method is enough until the second variant shows up."
      `,
    },
    {
      id: 'patterns', title: 'The 12 patterns on one page', kind: 'Patterns',
      blurb: 'Four moves, twelve patterns, one cue each.',
      body: J`
        | Move | Pattern | Cue | One line |
        |---|---|---|---|
        | Swap it | **Strategy** | the rule might change | caller picks the rule |
        | Swap it | **State** | a lifecycle where actions depend on the stage | the object switches itself |
        | Swap it | Command | undo, queue, retry | the action becomes an object |
        | Wrap it | Decorator | optional extras that stack | same interface, adds behaviour |
        | Wrap it | Proxy | check before calling | same interface, controls access |
        | Wrap it | Adapter | integrate a vendor API | fixes a wrong interface |
        | Wrap it | Composite | folders in folders | one interface for item and group |
        | Pass it on | **Observer** | notify many when X happens | subject → listeners |
        | Pass it on | Chain of Responsibility | try A, else B, else C | handler → next handler |
        | Build it | **Factory** | type code decides the class | one place does «new» |
        | Build it | **Builder** | many optional parameters | step-by-step then «build()» |
        | Build it | **Singleton** | exactly one, no DI | usually prefer injecting one |

        **Bold** = the core 6. The other 11 patterns: know the name, see the pattern map.
      `,
    },
  );
})(typeof globalThis !== 'undefined' ? globalThis : this);

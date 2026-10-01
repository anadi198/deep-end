(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'flow', title: 'Control flow and patterns', short: 'Flow',
    blurb: '«if», «loop», «while» and «for» as expressions, labels and break values, ranges, then patterns in full: every pattern form, «match» and its exhaustiveness check, guards and bindings, «if let», «while let» and «let else».',
    items: [
      {
        lesson: 'fl-loops', title: '«if» and the three loops', mins: 7,
        remember: '«if» is an expression whose branches must have the same type. «loop» runs until «break» and can break with a value, «while» tests a «bool», and «for» walks anything that implements «IntoIterator». Labels let «break» and «continue» target an outer loop.',
        cue: 'A loop that finds a value and stores it in a mutable variable declared outside → «let x = loop { ... break value; }», or an iterator method',
        body: R`
          ~~~text Syntax
          if CONDITION BLOCK [else if CONDITION BLOCK]... [else BLOCK]
          loop BLOCK                        its value is the break value; it has type ! if it never breaks
          while CONDITION BLOCK             its value is ()
          for PATTERN in EXPRESSION BLOCK   EXPRESSION must implement IntoIterator; its value is ()
          'label: loop | while | for ...
          break ['label] [EXPRESSION];      continue ['label];
          ~~~

          The rules:

          1. A condition must be a «bool»; there is no truthiness. No parentheses are needed, and the braces are mandatory.
          2. «if» without «else» has type «()», so it cannot produce a value.
          3. Only «loop» can «break» with a value, because only «loop» is certain to reach a «break» to get one.
          4. Ranges: «a..b» excludes «b», «a..=b» includes it; «(0..10).step_by(2)», «(1..=5).rev()».
          5. «for x in v» consumes «v»; «for x in &v» borrows each element; «for x in &mut v» borrows each mutably. The Borrowing module explains the difference.

          ~~~rust !run
          fn main() {
              let frames = [3, 8, 0, 5];
              let mut i = 0;
              let first_empty = loop {
                  if i == frames.len() {
                      break None;
                  }
                  if frames[i] == 0 {
                      break Some(i);
                  }
                  i += 1;
              };
              println!("{first_empty:?}");

              'rows: for row in 0..3 {
                  for col in 0..3 {
                      if col > row {
                          continue 'rows;
                      }
                      if row == 2 && col == 1 {
                          break 'rows;
                      }
                      print!("({row},{col}) ");
                  }
              }
              println!();

              for n in (1..=10).rev().step_by(3) {
                  print!("{n} ");
              }
              println!();
          }
          ~~~

          «'rows» looks like a lifetime but is only a label: a name for the loop.

          @predict 0
          @predict 1
        `,
        predict: [
          {
            q: 'What does this print?',
            code: 'fn main() {\n    let mut attempts = 0;\n    let n = loop {\n        attempts += 1;\n        if attempts == 3 {\n            break attempts * 10;\n        }\n    };\n    println!("{n}");\n}',
            options: ['3', '30', 'Compile error'],
            answer: 1,
            why: '«loop» is an expression. «break attempts * 10» leaves the loop and makes 30 the loop\'s value, which lands in «n».',
          },
          {
            q: 'An «if» used as a value, without an «else». What happens?',
            code: R`fn main() {
    let size = 2048;
    let label = if size > 1024 { "large" };
    println!("{label}");
}`,
            options: ['large', 'Compile error', 'It prints an empty line'],
            answer: 1, error: 'E0317',
            why: 'Without an «else», the «if» has to produce «()» when the condition is false, but the true branch produces a «&str». The two branches disagree, so it does not compile: "if may be missing an else clause".',
          },
        ],
      },
      {
        lesson: 'fl-match', title: '«match»: exhaustive by construction', mins: 7, hunts: ['logic'],
        remember: '«match» tries its arms top to bottom and runs the first whose pattern fits and whose guard is true. The compiler rejects a «match» that does not cover every possible value, so a finished «match» is also a proof that no case was forgotten.',
        cue: 'A «match» ending in «_ =>» → that arm also catches every value added in the future; list the cases when that matters',
        body: R`
          ~~~text Syntax
          match EXPRESSION {
              PATTERN [| PATTERN]... [if GUARD] => EXPRESSION,
              ...
          }
          ~~~

          The rules:

          1. Arms are tried in order; the first match wins.
          2. Every arm's expression has the same type, and that is the type of the «match».
          3. The patterns together must cover every value of the scrutinee's type (exhaustiveness). Guards do not count toward coverage, because the compiler cannot evaluate them.
          4. An arm that can never be reached (because earlier arms cover it) is a warning.

          ~~~rust !run
          fn classify(code: u16) -> &'static str {
              match code {
                  200 | 201 | 204 => "ok",
                  300..=399 => "redirect",
                  400 | 404 => "client error",
                  n if n >= 500 => "server error",
                  _ => "other",
              }
          }

          fn main() {
              for c in [200, 302, 404, 503, 418] {
                  println!("{c} {}", classify(c));
              }
          }
          ~~~

          The compiler knows every value of an integer type, so it can name exactly what is missing:

          ~~~rust !fail
          fn kind(b: u8) -> &'static str {
              match b {
                  0..=127 => "ascii",
                  128..=254 => "high",
              }
          }

          fn main() {
              println!("{}", kind(65));
          }
          ~~~

          :::java «switch», side by side
          A Java «switch» expression over a sealed type is also checked for exhaustiveness. Rust applies the check to every «match», over any type: integers, tuples, slices, enums and references.
          :::

          :::cpp «switch», side by side
          A C++ «switch» works only on integers and enums, is a statement rather than an expression, needs no «default», and falls through to the next case unless it hits a «break». A missing enum case is at most a warning. A Rust «match» never falls through, produces a value, works on any type, and does not compile with a case missing.
          :::

          ~~~cpp !run Fall-through in C++
          int main() {
              int code = 1;
              switch (code) {
                  case 1: std::cout << "one ";
                  case 2: std::cout << "two ";
                  default: std::cout << "other";
              }
              std::cout << '\n';
          }
          ~~~

          @predict 0
        `,
        predict: [
          {
            q: 'Which arm wins?',
            code: R`fn main() {
    let n = 7;
    let s = match n {
        x if x % 2 == 1 => "odd",
        7 => "seven",
        _ => "even",
    };
    println!("{s}");
}`,
            options: ['odd', 'seven', 'even', 'Compile error'],
            answer: 0,
            why: 'Arms are tried in order, and the first one fits: 7 is odd. The «7» arm gets no "unreachable" warning, because the compiler does not evaluate guards when it checks coverage; it simply never wins here.',
          },
        ],
      },
      {
        lesson: 'fl-patterns', title: 'Patterns: the full grammar', mins: 8,
        remember: 'Patterns appear in «let», function parameters, «match», «if let», «while let» and «for». They match literals and ranges, ignore with «_», bind names, and destructure tuples, structs, enums, slices and references. A pattern is either refutable (it can fail to match) or irrefutable (it always matches).',
        cue: '«let» with a pattern that might not match («let Some(x) = ...») → it needs an «else» that leaves: «let Some(x) = opt else { return; };»',
        body: R`
          ## Every pattern form

          | Pattern | Matches | Example |
          |---|---|---|
          | literal | that value | «0», «'a'», «"MSH"», «true» |
          | range | a value in the range | «1..=9», «'a'..='z'», «..0» |
          | «_» | anything; binds nothing | «_» |
          | identifier | anything; binds it | «x», «mut total» |
          | «NAME @ PATTERN» | binds while also testing | «n @ 1..=9» |
          | «..» | the rest of a tuple, struct or slice | «(first, ..)» |
          | tuple | element by element | «(0, y)» |
          | struct | fields by name | «Point { x: 0, y }», «Frame { id, .. }» |
          | tuple struct or enum variant | fields by position | «Some(x)», «Ok(v)», «Kind::Data(len)» |
          | slice | by position, with an optional rest | «[first, .., last]», «[b'M', rest @ ..]» |
          | reference | through a «&» | «&x», «&(a, b)» |
          | alternatives | either | «1 \| 2», «Some(0) \| None» |

          ## Refutable and irrefutable

          | Accepts | Where |
          |---|---|
          | irrefutable patterns only | «let», function parameters, «for» |
          | refutable patterns | «match» arms, «if let», «while let», «let ... else» |

          ~~~text Syntax
          if let PATTERN = EXPRESSION BLOCK [else BLOCK]
          while let PATTERN = EXPRESSION BLOCK
          let PATTERN = EXPRESSION else DIVERGING_BLOCK;     the else block must return, break, continue or panic
          ~~~

          ~~~rust !run
          fn describe(frame: &[u8]) -> String {
              match frame {
                  [] => "empty".to_string(),
                  [0x0b, body @ .., 0x1c, 0x0d] => format!("MLLP frame, {} body bytes", body.len()),
                  [first, .., last] => format!("starts {first:#04x}, ends {last:#04x}"),
                  [only] => format!("one byte {only}"),
              }
          }

          fn main() {
              let frames: [&[u8]; 4] = [b"", &[0x0b, b'M', b'S', b'H', 0x1c, 0x0d], &[1, 2, 3], &[9]];
              for f in frames {
                  println!("{}", describe(f));
              }
          }
          ~~~

          @stop

          ## Destructuring, bindings, and the conditional forms

          ~~~rust !run
          struct Frame {
              route: &'static str,
              retries: u32,
          }

          fn main() {
              let frames = [Frame { route: "lab-a", retries: 0 }, Frame { route: "lab-b", retries: 4 }];
              for Frame { route, retries } in &frames {
                  let level = match retries {
                      0 => "fresh".to_string(),
                      n @ 1..=3 => format!("retried {n} times"),
                      n => format!("gave up after {n}"),
                  };
                  println!("{route}: {level}");
              }

              let mut stack = vec![1, 2, 3];
              while let Some(top) = stack.pop() {
                  print!("{top} ");
              }
              println!();

              let port: Option<u16> = "5100".parse().ok();
              if let Some(p) = port && p > 1024 {
                  println!("unprivileged port {p}");
              }
              println!("{}", matches!(port, Some(1..=1024)));

              let Some(dot) = "lab-a.local".find('.') else {
                  return;
              };
              println!("the domain starts at byte {dot}");
          }
          ~~~

          - «for Frame { route, retries } in &frames» destructures each element. Because «&frames» yields references, the bindings are references too («&&str», «&u32»): patterns see through a «&» automatically.
          - «if let ... && ...» chains conditions (edition 2024).
          - «matches!(value, PATTERN)» is «true» when the pattern fits.

          @predict 0
        `,
        predict: [
          {
            q: 'The «else» block of a «let ... else» only prints. What happens?',
            code: R`fn main() {
    let port: Option<u16> = None;
    let Some(p) = port else {
        println!("no port");
    };
    println!("{p}");
}`,
            options: ['no port', 'no port, then 0', 'Compile error', 'It panics'],
            answer: 2,
            why: 'If the «else» block could finish normally, execution would reach «println!("{p}")» with nothing bound to «p». So it must diverge: «return», «break», «continue» or a panic. The compiler rejects the block because its type is «()», not «!».',
          },
        ],
      },
      {
        exercise: {
          id: 'fl-build-classify', title: 'Classify frames with slice patterns', kind: 'build', mins: 10, diff: 'easy', topics: ['patterns'],
          statement: R`
            An MLLP frame is «0x0B», a body, then «0x1C 0x0D». Write «classify» with a single «match» on the slice:

            | Input | Result |
            |---|---|
            | no bytes | «"empty"» |
            | «0x0B 0x1C 0x0D» (nothing in between) | «"mllp-empty"» |
            | «0x0B», a body, «0x1C 0x0D» | «"mllp"» |
            | starts with «0x0B» but does not end with «0x1C 0x0D» | «"partial"» |
            | anything else | «"junk"» |
          `,
          starter: R`
pub fn classify(frame: &[u8]) -> &'static str {
    todo!()
}
`,
          starterFails: 'tests',
          tests: [
            { name: 'empty', ex: true, code: 'assert_eq!(classify(&[]), "empty");' },
            { name: 'a full frame', ex: true, code: 'assert_eq!(classify(&[0x0b, b\'M\', b\'S\', b\'H\', 0x1c, 0x0d]), "mllp");' },
            { name: 'a frame with no body', ex: true, code: 'assert_eq!(classify(&[0x0b, 0x1c, 0x0d]), "mllp-empty");' },
            { name: 'partial frames', code: 'assert_eq!(classify(&[0x0b]), "partial");\nassert_eq!(classify(&[0x0b, b\'M\', 0x1c]), "partial");\nassert_eq!(classify(&[0x0b, 0x0d]), "partial");' },
            { name: 'junk', code: 'assert_eq!(classify(&[0x1c, 0x0d]), "junk");\nassert_eq!(classify(b"MSH"), "junk");' },
          ],
          lint: [
            { re: '\\.len\\(\\)|\\bif\\b', when: 'present', note: 'Every case here can be a slice pattern: «[]», «[0x0b, .., 0x1c, 0x0d]», «[0x0b, ..]». No length checks or «if» needed.' },
          ],
          hints: [
            'Arms are tried in order. Which of «mllp» and «mllp-empty» must come first, given that «[0x0b, .., 0x1c, 0x0d]» also matches an empty body?',
            '«[0x0b, ..]» matches anything that starts with «0x0B», including the complete frames, so it goes after them.',
          ],
          solution: {
            rust: R`
pub fn classify(frame: &[u8]) -> &'static str {
    match frame {
        [] => "empty",
        [0x0b, 0x1c, 0x0d] => "mllp-empty",
        [0x0b, .., 0x1c, 0x0d] => "mllp",
        [0x0b, ..] => "partial",
        _ => "junk",
    }
}
`,
            why: R`
              - Slice patterns match by position: «[0x0b, .., 0x1c, 0x0d]» fixes the first byte and the last two, and «..» accepts anything (including nothing) in between.
              - Order does the rest: the exact «[0x0b, 0x1c, 0x0d]» must come before the general frame, and the frame before «[0x0b, ..]».
              - The «_» arm makes the match exhaustive.
            `,
            talk: 'One match on the slice, with the most specific patterns first: the empty frame, then any complete frame, then anything that at least starts like a frame, then junk.',
          },
          wrong: [
            { name: 'general pattern first', rust: 'pub fn classify(frame: &[u8]) -> &\'static str {\n    match frame {\n        [] => "empty",\n        [0x0b, .., 0x1c, 0x0d] => "mllp",\n        [0x0b, 0x1c, 0x0d] => "mllp-empty",\n        [0x0b, ..] => "partial",\n        _ => "junk",\n    }\n}' },
            { name: 'checks only the first byte', rust: 'pub fn classify(frame: &[u8]) -> &\'static str {\n    match frame {\n        [] => "empty",\n        [0x0b, 0x1c, 0x0d] => "mllp-empty",\n        [0x0b, ..] => "mllp",\n        _ => "junk",\n    }\n}' },
          ],
        },
      },
      {
        exercise: {
          id: 'fl-fix-loops', title: 'Make it compile: a match and a loop', kind: 'fix', mins: 8, diff: 'easy', topics: ['patterns'],
          statement: R`
            Two functions, two compile errors. Press **Run**, read what the compiler says, and fix each with the smallest change.

            - «buckets» counts sizes under 1 KiB, under 1 MiB, and everything larger.
            - «first_over» returns the index of the first size over the limit, if there is one.
          `,
          starter: R`
pub fn buckets(sizes: &[u64]) -> (u32, u32, u32) {
    let mut small = 0;
    let mut medium = 0;
    let mut large = 0;
    for size in sizes {
        match size {
            0..1024 => small += 1,
            1024..1_048_576 => medium += 1,
        }
    }
    (small, medium, large)
}

pub fn first_over(sizes: &[u64], limit: u64) -> Option<usize> {
    let mut i = 0;
    loop {
        if i == sizes.len() {
            break None;
        }
        if sizes[i] > limit {
            break i;
        }
        i += 1;
    }
}
`,
          starterFails: 'compile',
          tests: [
            { name: 'buckets', ex: true, code: 'assert_eq!(buckets(&[10, 2_000, 5_000_000, 1_023, 1_024]), (2, 2, 1));\nassert_eq!(buckets(&[]), (0, 0, 0));' },
            { name: 'first_over', ex: true, code: 'assert_eq!(first_over(&[1, 5, 9], 4), Some(1));\nassert_eq!(first_over(&[1, 2], 4), None);' },
          ],
          hints: [
            'The first error is "non-exhaustive patterns". Which sizes does no arm cover, and which counter should they go to?',
            'The second is "mismatched types": every «break» of a «loop» must produce the same type. One produces «Option<usize>», the other a plain «usize».',
          ],
          solution: {
            rust: R`
pub fn buckets(sizes: &[u64]) -> (u32, u32, u32) {
    let mut small = 0;
    let mut medium = 0;
    let mut large = 0;
    for size in sizes {
        match size {
            0..1024 => small += 1,
            1024..1_048_576 => medium += 1,
            _ => large += 1,
        }
    }
    (small, medium, large)
}

pub fn first_over(sizes: &[u64], limit: u64) -> Option<usize> {
    let mut i = 0;
    loop {
        if i == sizes.len() {
            break None;
        }
        if sizes[i] > limit {
            break Some(i);
        }
        i += 1;
    }
}
`,
            why: R`
              - The «match» covered «0..1_048_576» only, and the compiler named the gap («1_048_576_u64..» not covered). The «_» arm sends everything else to «large».
              - A «loop»'s value is its «break» value, and all «break»s must agree on the type: «Some(i)», not «i».
              - The «match» on «size», which is a «&u64», works with plain range patterns because patterns see through references.
            `,
            talk: 'The match left sizes of 1 MiB and up uncovered, so it gained a catch-all arm for large, and the loop broke with a usize in one place and an Option in another, so the hit became Some(i).',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);

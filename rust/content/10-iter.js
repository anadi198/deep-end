(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'iter', title: 'Iterators and closures: streams that cost nothing', short: 'Iter',
    blurb: 'Iterator chains read like Java streams. The three ways a chain starts, the adapters you will use most, «collect» into «Result», closures and «move», and the «Iterator» and «Fn» traits underneath.',
    items: [
      {
        lesson: 'it-streams', title: 'Iterators are Java streams, but lazy and free', mins: 7,
        remember: 'An iterator chain is a Java stream: nothing runs until something consumes it («collect», «sum», «count», a «for» loop), and it compiles down to a plain loop.',
        cue: 'A «.map(...)» or «.filter(...)» chain that nothing consumes → it never runs; rustc warns that iterators are lazy',
        body: R`
          :::vs The same pipeline
          ~~~java
          List<String> ids = segments.stream()
              .filter(s -> s.startsWith("OBX"))
              .map(s -> s.split("\\|")[3])
              .collect(Collectors.toList());
          ~~~
          ~~~rust
          let ids: Vec<&str> = segments.iter()
              .filter(|s| s.starts_with("OBX"))
              .map(|s| s.split('|').nth(3).unwrap_or(""))
              .collect();
          ~~~
          :::

          Same shape, and three differences worth knowing:

          - **Nothing runs until something consumes the chain.** Java streams are lazy too; Rust just warns you when you forget the end.
          - **No cost.** The compiler turns the chain into the same loop you would write by hand, so there is no performance reason to avoid iterators.
          - **How the chain starts matters**: it decides whether the collection is borrowed, changed or consumed.

          ## The three starts

          | Start | Items are | The collection afterwards | Java feel |
          |---|---|---|---|
          | «v.iter()» or «for x in &v» | borrowed, «&T» | still yours | «stream()» |
          | «v.iter_mut()» or «for x in &mut v» | «&mut T», changeable | still yours, maybe changed | a loop that edits in place |
          | «v.into_iter()» or «for x in v» | owned, «T» | gone: moved into the loop | draining the list |

          @predict 0

          @stop

          ## Lazy means lazy

          @predict 1
        `,
        predict: [
          {
            q: '«for x in v», then «v» again. What happens?',
            code: 'fn main() {\n    let v = vec![String::from("A01"), String::from("A08")];\n    for x in v {\n        println!("{x}");\n    }\n    println!("{}", v.len());\n}',
            options: ['A01\nA08\n2', 'Compile error', 'It panics'],
            answer: 1, error: 'E0382',
            why: '«for x in v» is «into_iter()»: the loop takes ownership of the Vec and its strings. After the loop «v» is gone. «for x in &v» would only borrow it.',
          },
          {
            q: 'A «map» with a print inside, and no collect. What prints?',
            code: 'fn main() {\n    let v = vec![1, 2, 3];\n    v.iter().map(|x| {\n        println!("saw {x}");\n        x * 2\n    });\n    println!("done");\n}',
            options: ['saw 1\nsaw 2\nsaw 3\ndone', 'done', 'Compile error'],
            answer: 1,
            why: 'Nothing consumed the chain, so the closure never ran. rustc warns that the «Map» must be used: "iterators are lazy and do nothing unless consumed".',
          },
        ],
      },
      {
        lesson: 'it-adapters', title: 'The adapters you will use most', mins: 8, hunts: ['swallow'],
        remember: '«collect()» builds whatever type the code asks for: a «Vec», a «HashMap», a «String», or a «Result<Vec<_>, _>» that stops at the first error.',
        cue: '«filter_map(|x| x.parse().ok())» on outside data → bad items vanish without a trace; «collect::<Result<Vec<_>, _>>()» fails on the first one instead',
        body: R`
          | Adapter | Does | Java stream |
          |---|---|---|
          | «map», «filter» | transform, keep | same |
          | «filter_map» | transform and drop the «None»s in one step | «map» plus «filter(Objects::nonNull)» |
          | «flat_map» | each item becomes several | «flatMap» |
          | «enumerate» | pairs of (index, item) | (an index counter) |
          | «zip» | walk two sequences together | (none) |
          | «take(n)», «skip(n)» | first n, all but the first n | «limit», «skip» |
          | «rev» | backwards | (none) |
          | «any», «all», «find», «position» | stop at the first match | «anyMatch», «findFirst» |
          | «sum», «count», «min», «max», «fold» | reduce to one value | same, «reduce» |
          | «collect» | build a collection | «collect(...)» |

          On slices you also meet «windows(n)» (overlapping runs, as in the Errors module's frame parser) and «chunks(n)».

          ~~~rust !run
          fn main() {
              let msg = "MSH|^~\\&|LAB\rOBX|1|NM|GLU||98\rOBX|2|NM|K||4.1\rOBX|3|ST|NOTE||see chart\r";
              let values: Vec<f64> = msg
                  .split('\r')
                  .filter(|seg| seg.starts_with("OBX"))
                  .filter_map(|seg| seg.split('|').nth(5))
                  .filter_map(|v| v.parse().ok())
                  .collect();
              println!("{values:?}");
          }
          ~~~

          @stop

          ## Collect into «Result»: all or nothing

          ~~~rust !run
          fn main() {
              let good: Result<Vec<u16>, _> = ["2575", "6661"].iter().map(|s| s.parse::<u16>()).collect();
              let bad: Result<Vec<u16>, _> = ["2575", "x", "6661"].iter().map(|s| s.parse::<u16>()).collect();
              println!("{good:?}");
              println!("{bad:?}");
          }
          ~~~

          A stream of «Result»s collects into one «Result»: «Ok» with every value, or the first «Err». This is the idiom for "parse all of these, or tell me what was wrong".

          @predict 0

          :::pitfall «.ok()» inside an iterator
          Dropping unparseable items is right when the requirement says so ("skip non-numeric results"). It is a swallowed error when the input is a list someone typed: a retry list, a set of ports, ids from a config file. Know which one you have.
          :::
        `,
        predict: [
          {
            q: 'Ports from a config line, with two bad entries. What prints?',
            code: 'fn main() {\n    let ports: Vec<u16> = ["2575", "x", "70000", "6661"]\n        .iter()\n        .filter_map(|s| s.parse().ok())\n        .collect();\n    println!("{ports:?}");\n}',
            options: ['[2575, 6661]', '[2575, 0, 0, 6661]', 'It panics', 'Compile error'],
            answer: 0,
            why: '«.ok()» turns each failed parse into «None», and «filter_map» drops the «None»s. Two of four entries disappeared without a word: no error, no log line.',
          },
        ],
      },
      {
        lesson: 'it-closures', title: 'Closures, and «move»', mins: 6,
        remember: 'A closure borrows what it uses unless it is marked «move», which makes it take ownership; threads and tasks need «move» because they outlive the function that started them.',
        cue: '«let x = x.clone();» right before «move || ...» or «async move» → the normal way to give each task its own handle (usually an «Arc»)',
        body: R`
          ## The syntax

          | Rust | Java |
          |---|---|
          | «\|x\| x + 1» | «x -> x + 1» |
          | «\|a, b\| { ... }» | «(a, b) -> { ... }» |
          | «move \|\| ...» | (no equivalent: the closure takes ownership of what it uses) |

          A closure borrows the variables it mentions, following the Borrowing module's rules. So it can even change them:

          @predict 0

          ## «move», and the clone just before it

          ~~~rust !run
          use std::sync::Arc;
          use std::thread;

          fn main() {
              let config = Arc::new(String::from("lab.local:2575"));
              let mut handles = Vec::new();
              for id in 0..3 {
                  let config = Arc::clone(&config);
                  handles.push(thread::spawn(move || format!("worker {id} -> {config}")));
              }
              for h in handles {
                  println!("{}", h.join().unwrap());
              }
          }
          ~~~

          Each thread needs its own handle, so the code clones the «Arc» (cheap: a counter) under the same name, then «move»s that clone into the closure. You will see this exact shape before every «tokio::spawn» in the Async module.

          @stop

          ## «Fn», «FnMut», «FnOnce»

          | Bound | The closure | Seen in |
          |---|---|---|
          | «F: Fn(&str) -> bool» | only reads what it captured, callable any number of times | filters, predicates, handlers |
          | «F: FnMut(u8)» | changes what it captured | callbacks that count or collect |
          | «F: FnOnce() -> T» | may consume what it captured, callable once | «spawn», «thread::spawn», «Option::map» |

          «Box<dyn Fn(&Frame) + Send + Sync>» is a stored handler: an interface with one method, shareable between threads.
        `,
        predict: [
          {
            q: 'A closure that changes a captured counter. What prints?',
            code: 'fn main() {\n    let mut count = 0;\n    let mut bump = || count += 1;\n    bump();\n    bump();\n    println!("{count}");\n}',
            options: ['0', '2', 'Compile error'],
            answer: 1,
            why: '«bump» borrows «count» mutably for as long as it is used. Its last use is the second call, so by the «println!» the borrow is over (the Borrowing module: a borrow lasts until its last use).',
          },
        ],
      },
      {
        lesson: 'it-traits', title: 'The «Iterator» and «Fn» traits, precisely', mins: 7,
        remember: '«Iterator» has one required method, «fn next(&mut self) -> Option<Self::Item>», and every adapter is built on it; «for» calls «IntoIterator::into_iter». A closure implements «FnOnce», «FnMut» or «Fn» according to what it does with the values it captured.',
        cue: '«impl Iterator for X» → only «next» is written; «map», «filter», «sum» and the rest come with the trait',
        body: R`
          ~~~rust
          pub trait Iterator {
              type Item;
              fn next(&mut self) -> Option<Self::Item>;
              // about 75 provided methods: map, filter, fold, sum, collect, ...
          }

          pub trait IntoIterator {
              type Item;
              type IntoIter: Iterator<Item = Self::Item>;
              fn into_iter(self) -> Self::IntoIter;
          }
          ~~~

          The rules:

          1. An iterator yields «Some(item)» until it returns «None». Adapters («map», «filter») wrap it and do nothing until something calls «next»: a chain with no consumer («collect», «sum», «for», «count») does no work at all.
          2. «for PATTERN in EXPRESSION» is «let mut it = IntoIterator::into_iter(EXPRESSION); while let Some(PATTERN) = it.next() { ... }».
          3. A collection implements «IntoIterator» three times, which is where the three loop forms come from:

          | Expression | Implementation | Items |
          |---|---|---|
          | «v» | «IntoIterator for Vec<T>» | «T», and «v» is consumed |
          | «&v» | «IntoIterator for &Vec<T>» | «&T» |
          | «&mut v» | «IntoIterator for &mut Vec<T>» | «&mut T» |

          ~~~rust !run
          struct Countdown {
              from: u32,
          }

          impl Iterator for Countdown {
              type Item = u32;

              fn next(&mut self) -> Option<u32> {
                  if self.from == 0 {
                      return None;
                  }
                  self.from -= 1;
                  Some(self.from + 1)
              }
          }

          fn main() {
              for n in (Countdown { from: 3 }) {
                  print!("{n} ");
              }
              println!();
              let evens: Vec<u32> = Countdown { from: 10 }.filter(|n| n % 2 == 0).collect();
              println!("{evens:?} {}", Countdown { from: 4 }.sum::<u32>());
          }
          ~~~

          The parentheses in the «for» head are required: a struct literal cannot appear directly after «for ... in», «if», «while» or «match», because the parser would take its opening brace for the start of the body.

          @stop

          ## The closure traits

          | Trait | The closure | Can be called |
          |---|---|---|
          | «FnOnce» | may move captured values out | once |
          | «FnMut» | may change what it captured, moves nothing out | many times, needs «&mut» access |
          | «Fn» | only reads what it captured | many times, even shared between threads |

          Every closure implements «FnOnce»; one that moves nothing out also implements «FnMut»; one that also changes nothing implements «Fn». So a function that asks for «impl FnOnce» accepts any closure, and one that asks for «impl Fn» accepts the fewest.

          - A closure captures each variable in the least demanding way its body allows: by «&», then by «&mut», then by value. «move» forces capture by value for every variable it mentions.
          - Plain functions («fn double(x: u32) -> u32») implement all three.

          ~~~rust !run
          fn apply_twice(mut f: impl FnMut() -> u32) -> u32 {
              f() + f()
          }

          fn call_once(f: impl FnOnce() -> String) -> String {
              f()
          }

          fn main() {
              let mut calls = 0;
              println!("{}", apply_twice(|| {
                  calls += 1;
                  calls
              }));

              let route = String::from("lab-a");
              println!("{}", call_once(move || route + "-backup"));
          }
          ~~~

          @predict 0
        `,
        predict: [
          {
            q: 'The closure returns a captured «String». What happens on the second call?',
            code: R`fn main() {
    let name = String::from("lab-a");
    let give = move || name;
    let a = give();
    let b = give();
    println!("{a} {b}");
}`,
            options: ['lab-a lab-a', 'lab-a (then an empty line)', 'Compile error'],
            answer: 2, error: 'E0382',
            why: 'Returning «name» moves it out of the closure, so the closure is only «FnOnce», and calling it consumes it: "use of moved value: give". Returning «name.clone()» would make it «Fn».',
          },
        ],
      },
      {
        exercise: {
          id: 'it-build-obx', title: 'Summarise a message with iterators', kind: 'build', mins: 12, diff: 'easy', topics: ['iterators'],
          statement: R`
            Write three small functions, each as an iterator chain (a «for» loop is fine where it reads better).

            - «numeric_results(msg)»: the numeric OBX-5 values (field 5 of each «OBX» segment), in order. **Skip** values that are not numbers: that is the requirement.
            - «segment_counts(msg)»: how many segments of each type («MSH», «PID», «OBX», ...). Ignore empty segments.
            - «parse_ports(list)»: a comma-separated list like «"2575, 6661"». Spaces are allowed. **One bad entry fails the whole list**, because someone typed it.

            Segments end with «\r».
          `,
          starter: R`
use std::collections::HashMap;

pub fn numeric_results(msg: &str) -> Vec<f64> {
    todo!()
}

pub fn segment_counts(msg: &str) -> HashMap<String, usize> {
    todo!()
}

pub fn parse_ports(list: &str) -> Result<Vec<u16>, std::num::ParseIntError> {
    todo!()
}
`,
          starterFails: 'tests',
          tests: [
            { name: 'numeric OBX results', ex: true, code: R`let m = "MSH|x\rOBX|1|NM|GLU||98\rOBX|2|NM|K||4.1\rOBX|3|ST|NOTE||see chart\r";
assert_eq!(numeric_results(m), vec![98.0, 4.1]);` },
            { name: 'segment counts', ex: true, code: R`let c = segment_counts("MSH|x\rPID|1\rOBX|1\rOBX|2\r");
assert_eq!(c.get("OBX"), Some(&2));
assert_eq!(c.get("MSH"), Some(&1));
assert_eq!(c.len(), 3, "empty segments are not a type");` },
            { name: 'a clean port list', ex: true, code: 'assert_eq!(parse_ports("2575,6661"), Ok(vec![2575, 6661]));' },
            { name: 'spaces are allowed', code: 'assert_eq!(parse_ports("2575, 6661"), Ok(vec![2575, 6661]));' },
            { name: 'one bad port fails the whole list', code: 'assert!(parse_ports("2575,x").is_err(), "a typo must not be dropped silently");' },
            { name: 'an empty message', code: 'assert!(numeric_results("").is_empty());\nassert!(segment_counts("").is_empty());' },
          ],
          hints: [
            'Everything starts with «msg.split(\'\\r\')». Then «filter», «filter_map» and «collect».',
            'For counting: «*counts.entry(name.to_string()).or_insert(0) += 1;» is the «computeIfAbsent» of Rust.',
            'For ports: «.map(|p| p.trim().parse::<u16>())» and let «collect()» build the «Result<Vec<u16>, _>». The return type tells it what to build.',
          ],
          solution: {
            rust: R`
use std::collections::HashMap;

pub fn numeric_results(msg: &str) -> Vec<f64> {
    msg.split('\r')
        .filter(|seg| seg.starts_with("OBX|"))
        .filter_map(|seg| seg.split('|').nth(5))
        .filter_map(|v| v.parse().ok())
        .collect()
}

pub fn segment_counts(msg: &str) -> HashMap<String, usize> {
    let mut counts = HashMap::new();
    for seg in msg.split('\r').filter(|s| !s.is_empty()) {
        let name = seg.split('|').next().unwrap_or("");
        *counts.entry(name.to_string()).or_insert(0) += 1;
    }
    counts
}

pub fn parse_ports(list: &str) -> Result<Vec<u16>, std::num::ParseIntError> {
    list.split(',').map(|p| p.trim().parse::<u16>()).collect()
}
`,
            why: R`
              - «numeric_results» drops non-numbers on purpose: the requirement says so. The same «.ok()» in «parse_ports» would be a swallowed error.
              - «entry(...).or_insert(0)» returns a mutable reference into the map, so «+= 1» updates it in place.
              - «parse_ports» collects an iterator of «Result»s into one «Result»: the first bad entry becomes the error.
            `,
            talk: 'Iterator chains for all three: filter_map with ok() where skipping bad values is the requirement, entry().or_insert() for counting, and collect into Result for the port list so one typo fails the whole list instead of vanishing.',
          },
          wrong: [
            { name: 'drops bad ports silently', rust: R`
use std::collections::HashMap;
pub fn numeric_results(msg: &str) -> Vec<f64> {
    msg.split('\r').filter(|s| s.starts_with("OBX|")).filter_map(|s| s.split('|').nth(5)).filter_map(|v| v.parse().ok()).collect()
}
pub fn segment_counts(msg: &str) -> HashMap<String, usize> {
    let mut c = HashMap::new();
    for s in msg.split('\r').filter(|s| !s.is_empty()) { *c.entry(s.split('|').next().unwrap_or("").to_string()).or_insert(0) += 1; }
    c
}
pub fn parse_ports(list: &str) -> Result<Vec<u16>, std::num::ParseIntError> {
    Ok(list.split(',').filter_map(|p| p.trim().parse().ok()).collect())
}
` },
          ],
        },
      },
      {
        exercise: {
          id: 'it-review-batch', title: 'Find the bugs: batch summary helpers', kind: 'review', mins: 12, diff: 'easy', topics: ['iterators'],
          file: 'src/batch.rs',
          statement: R`
            **The change:** Adds helpers for the batch page: counts per message kind and total bytes, the ids from the manual retry box, the oldest messages, and a "has large messages" flag.

            Context: a batch holds up to 500 messages of up to 4 MB each. The retry box is a text field operators type ids into.
          `,
          code: R`
use std::collections::HashMap;

pub struct Msg {
    pub id: u64,
    pub kind: String,
    pub body: Vec<u8>,
}

+/// Counts messages per kind, and the total body bytes.
+pub fn summarize(batch: &[Msg]) -> (HashMap<String, usize>, usize) {
+    let mut per_kind = HashMap::new();
+    for m in batch.iter() { ⟦d1⟧
+        *per_kind.entry(m.kind.clone()).or_insert(0) += 1; ⟦d2⟧
+    }
+    let total: usize = batch.iter().map(|m| m.body.clone()).map(|b| b.len()).sum(); ⟦a⟧
+    (per_kind, total)
+}
+
+/// Message ids typed into the retry box, e.g. "12, 15, 19".
+pub fn retry_ids(list: &str) -> Vec<u64> {
+    list.split(',').filter_map(|s| s.trim().parse().ok()).collect() ⟦b⟧
+}
+
+/// The first n messages of the batch, oldest first.
+pub fn oldest(batch: &[Msg], n: usize) -> Vec<&Msg> {
+    let mut sorted: Vec<&Msg> = batch.iter().collect();
+    sorted.sort_by_key(|m| m.id);
+    sorted.into_iter().rev().take(n).collect() ⟦c⟧
+}
+
+pub fn has_large(batch: &[Msg], limit: usize) -> bool {
+    batch.iter().filter(|m| m.body.len() > limit).count() > 0 ⟦e⟧
+}
`,
          issues: [
            {
              id: 'a', tag: 'cost', title: 'Copies every body to measure its length',
              why: '«map(|m| m.body.clone())» allocates and copies each body (up to 500 times 4 MB) only to call «.len()» on the copy and throw it away.',
              fix: '«batch.iter().map(|m| m.body.len()).sum()»: read the length through the borrow.',
            },
            {
              id: 'b', tag: 'swallow', title: 'A mistyped id is silently skipped',
              why: 'Operators type these ids. «12, 1S, 19» retries two messages and says nothing about the third. Dropping bad items is fine for data that may legitimately be messy, not for a command someone typed.',
              fix: 'Collect into «Result<Vec<u64>, _>» and show the operator which entry was wrong.',
            },
            {
              id: 'c', tag: 'logic', title: '«oldest» returns the newest messages',
              why: 'After sorting by id ascending, «.rev()» walks from the newest end, so «take(n)» picks the n newest. The doc comment says oldest first.',
              fix: 'Drop the «.rev()»: «sorted.into_iter().take(n).collect()».',
              demo: 'let batch = vec![Msg { id: 3, kind: "A".into(), body: vec![] }, Msg { id: 1, kind: "A".into(), body: vec![] }, Msg { id: 2, kind: "A".into(), body: vec![] }];\nassert_eq!(oldest(&batch, 1)[0].id, 1, "the oldest message has the lowest id");',
            },
            {
              id: 'e', tag: 'cost', title: 'Walks the whole batch to answer yes or no',
              why: '«filter(...).count() > 0» checks all 500 messages even when the first one is large. «any» stops at the first match.',
              fix: '«batch.iter().any(|m| m.body.len() > limit)».',
            },
          ],
          decoys: [
            { id: 'd1', why: '«batch.iter()» borrows each message; nothing is copied. (Writing «for m in batch» would do the same thing.)' },
            { id: 'd2', why: 'The map owns its keys, so the kind has to be cloned into it once per message. It is a short string, so this is cheap. Borrowed «&str» keys would avoid it, at the price of a lifetime on the return type.' },
          ],
          hints: [
            'Two needless costs, one swallowed error, one wrong result.',
            'For each «clone()» and each chain, ask what it touches: every byte, every item, or only what is needed?',
            'Walk «oldest» by hand with ids 3, 1, 2 and n = 1.',
          ],
          solution: {
            fixed: R`
use std::collections::HashMap;
use std::num::ParseIntError;

pub struct Msg {
    pub id: u64,
    pub kind: String,
    pub body: Vec<u8>,
}

/// Counts messages per kind, and the total body bytes.
pub fn summarize(batch: &[Msg]) -> (HashMap<String, usize>, usize) {
    let mut per_kind = HashMap::new();
    for m in batch {
        *per_kind.entry(m.kind.clone()).or_insert(0) += 1;
    }
    let total = batch.iter().map(|m| m.body.len()).sum();
    (per_kind, total)
}

/// Message ids typed into the retry box, e.g. "12, 15, 19".
pub fn retry_ids(list: &str) -> Result<Vec<u64>, ParseIntError> {
    list.split(',').map(|s| s.trim().parse()).collect()
}

/// The first n messages of the batch, oldest first.
pub fn oldest(batch: &[Msg], n: usize) -> Vec<&Msg> {
    let mut sorted: Vec<&Msg> = batch.iter().collect();
    sorted.sort_by_key(|m| m.id);
    sorted.into_iter().take(n).collect()
}

pub fn has_large(batch: &[Msg], limit: usize) -> bool {
    batch.iter().any(|m| m.body.len() > limit)
}
`,
            talk: 'Two needless costs: cloning every body to measure it, and counting the whole batch where any() would stop early. The retry box silently dropped mistyped ids. And oldest() reversed the sort, so it returned the newest messages.',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);

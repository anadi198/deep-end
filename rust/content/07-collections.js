(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'collections', title: 'Collections and text', short: 'Collections',
    blurb: 'Slices as pointer-and-length views, strings as UTF-8 and the formatting syntax, «Vec» and what each operation costs, and «HashMap», «HashSet» and «BTreeMap» with the entry API.',
    items: [
      {
        lesson: 'co-slices', title: 'Slices: views into contiguous data', mins: 6, hunts: ['panic'],
        remember: 'A slice «[T]» is a run of elements whose length is known only at run time, so it always sits behind a pointer: «&[T]» and «&mut [T]» are a (pointer, length) pair. Arrays, «Vec»s and parts of them all coerce to slices, and range indexing panics when the range is out of bounds.',
        cue: 'A parameter of type «&Vec<T>» → «&[T]» accepts a «Vec», an array, or any part of either',
        body: R`
          ~~~text Syntax
          [T]              a slice type: unsized, so always used behind a pointer
          &[T]   &mut [T]  a shared or mutable slice reference: a pointer and a length
          &v[a..b]         elements a to b-1;  also &v[a..], &v[..b], &v[..]
          &str             a string slice: bytes that are guaranteed to be valid UTF-8
          ~~~

          The rules:

          1. «&v[a..b]» panics if «b» is past the end or «a > b». «v.get(a..b)» returns «None» instead.
          2. A slice reference is two words, pointer and length, so it knows its own length.
          3. «&Vec<T>», «&[T; N]» and «&String» coerce to «&[T]» and «&str» automatically (deref coercion), so functions should accept the slice.
          4. «&mut [T]» can change elements in place, but cannot grow or shrink: that needs the «Vec».

          | Method | Returns | Note |
          |---|---|---|
          | «len()», «is_empty()» | «usize», «bool» | |
          | «first()», «last()», «get(i)», «get(a..b)» | «Option<&T>», «Option<&[T]>» | never panic |
          | «contains(&x)», «starts_with(&[..])» | «bool» | |
          | «split_at(i)» | «(&[T], &[T])» | panics if «i > len» |
          | «chunks(n)», «windows(n)» | iterators over sub-slices | |
          | «iter()», «iter_mut()» | iterators over «&T», «&mut T» | |
          | «sort()», «sort_by_key(f)», «reverse()», «fill(x)» | «()» | on «&mut [T]» |
          | «to_vec()» | «Vec<T>» | copies |

          ~~~rust !run
          fn checksum(bytes: &[u8]) -> u32 {
              bytes.iter().map(|&b| u32::from(b)).sum()
          }

          fn main() {
              let arr = [0x0b, b'M', b'S', b'H', 0x1c, 0x0d];
              let v = arr.to_vec();
              println!("{} {} {}", checksum(&arr), checksum(&v), checksum(&v[1..4]));
              println!("{:?} {:?}", v.first(), v.get(10..));

              let (head, rest) = v.split_at(1);
              println!("{head:?} {}", rest.len());

              for w in b"abcd".windows(2) {
                  print!("{:?} ", std::str::from_utf8(w).unwrap());
              }
              println!();
              println!("a slice reference is {} bytes", std::mem::size_of::<&[u8]>());

              let mut buf = [5, 3, 9, 1];
              buf.sort();
              buf[..2].fill(0);
              println!("{buf:?}");
          }
          ~~~

          @predict 0
        `,
        predict: [
          {
            q: 'The body of a frame is everything between the first byte and the last two. What happens?',
            code: R`fn body(frame: &[u8]) -> &[u8] {
    &frame[1..frame.len() - 2]
}

fn main() {
    println!("{:?}", body(&[0x0b, 1, 2, 0x1c, 0x0d]));
    println!("{:?}", body(&[0x0b]));
}`,
            options: ['[1, 2]\n[]', '[1, 2]', 'It panics', 'Compile error'],
            answer: 2,
            why: 'It prints «[1, 2]», then for a one-byte frame «frame.len() - 2» underflows a «usize» and panics. Frames from outside need their length checked first, or a slice pattern like «[0x0b, body @ .., 0x1c, 0x0d]».',
          },
        ],
      },
      {
        lesson: 'co-text', title: 'Text: UTF-8, string methods and formatting', mins: 8, hunts: ['panic'],
        remember: 'A «String» is an owned, growable buffer of UTF-8 bytes and «&str» a borrowed view of one. Neither can be indexed by position, because a character takes one to four bytes: iterate with «.chars()» or «.bytes()», and slice only at character boundaries.',
        cue: '«s[i]» or «&s[..n]» on text from outside → those are bytes, not characters; use «.chars()», «.char_indices()» or «.get(..n)»',
        body: R`
          The Ownership module covered «String» versus «&str». This lesson is about their contents.

          :::cpp In C++ terms
          A «std::string» is a sequence of bytes with no idea of an encoding: «s[0]» returns the first byte, and «s.size()» counts bytes. A Rust «String» is the same buffer with one promise added, that it is always valid UTF-8, which is why it refuses «s[0]» (half of «é» is not a character) and makes you say whether you want bytes or characters.
          :::

          ## Literals

          | Written | Type | Note |
          |---|---|---|
          | «"text\n"» | «&'static str» | escapes: «\n \r \t \\ \" \0 \x7F \u{E9}» |
          | «r"C:\path"», «r#"a "quoted" word"#» | «&'static str» | raw: no escapes |
          | «b"MSH"» | «&'static [u8; 3]» | a byte string |
          | «'é'» | «char» | one Unicode scalar value |

          ## Bytes, not characters

          ~~~rust !fail
          fn main() {
              let name = String::from("José");
              println!("{}", name[0]);
          }
          ~~~

          | You want | Use | Unit |
          |---|---|---|
          | the size in memory | «s.len()» | bytes |
          | the characters | «s.chars()», «s.chars().count()» | «char» |
          | characters with their byte offsets | «s.char_indices()» | «(usize, char)» |
          | the raw bytes | «s.bytes()», «s.as_bytes()» | «u8» |
          | a prefix that never panics | «s.get(..n)» | bytes; «None» mid-character |

          ## Everyday methods

          | Method | Returns |
          |---|---|
          | «trim()», «trim_start()», «trim_end()» | «&str» |
          | «split(p)», «lines()», «split_whitespace()» | an iterator of «&str» |
          | «split_once(p)» | «Option<(&str, &str)>» |
          | «starts_with(p)», «ends_with(p)», «contains(p)» | «bool» |
          | «find(p)» | «Option<usize>», a byte offset |
          | «replace(from, to)», «to_lowercase()», «to_uppercase()» | «String» |
          | «parse::<T>()» | «Result<T, T::Err>» |

          Building text: «String::with_capacity(n)», «push(char)», «push_str(&str)», «format!(...)», «x.to_string()» for anything with «Display», and «a + &b», which takes «a» by value and appends to its buffer.

          @stop

          ## The formatting syntax

          «format!», «println!», «write!» and friends share one mini-language: «{[ARGUMENT][:[FILL]ALIGN][WIDTH][.PRECISION][TYPE]}».

          | Written | Means |
          |---|---|
          | «{}», «{:?}», «{:#?}» | «Display», «Debug», pretty-printed «Debug» |
          | «{name}», «{0}» | a variable captured by name; an argument by position |
          | «{:>8}», «{:<8}», «{:^8}», «{:*>8}» | right, left, centre in 8 columns; «*» as the fill |
          | «{:.2}», «{:8.3}» | 2 decimals; width 8 with 3 decimals |
          | «{:#x}», «{:08b}», «{:e}», «{:+}» | hex with «0x»; binary padded to 8 digits; scientific; always a sign |

          ~~~rust !run
          use std::fmt::Write;

          fn main() {
              let raw = "  MSH|^~\\&|LAB|  ";
              let t = raw.trim();
              println!("[{t}] {} bytes", t.len());
              let fields: Vec<&str> = t.split('|').collect();
              println!("{fields:?}");
              println!("{:?}", "lab-a:5100".split_once(':'));

              let name = "José";
              println!("{} bytes, {} chars", name.len(), name.chars().count());
              for (i, c) in name.char_indices() {
                  print!("{i}:{c} ");
              }
              println!();
              println!("{:?} {:?}", name.get(..3), name.get(..4));

              let mut report = String::with_capacity(64);
              write!(report, "{:<6}|{:>6}|{:^7}|", "id", 42, "ok").unwrap();
              writeln!(report, " {:.2} {:#x} {:08b} {:+}", 3.14159, 255, 5, 7).unwrap();
              print!("{report}");

              let greeting = String::from("lab") + "-" + &name.to_lowercase();
              println!("{greeting}");
          }
          ~~~

          @predict 0
        `,
        predict: [
          {
            q: '«+» joins two strings. What happens on the last line?',
            code: R`fn main() {
    let host = String::from("lab");
    let full = host + "-a";
    println!("{full}");
    println!("{host}");
}`,
            options: ['lab-a\nlab', 'lab-a\nlab-a', 'Compile error'],
            answer: 2, error: 'E0382',
            why: '«String + &str» takes the left-hand «String» by value and appends to its buffer, so «host» is moved into «full». Reading it afterwards is "borrow of moved value". «format!("{host}-a")» leaves «host» alone.',
          },
        ],
      },
      {
        lesson: 'co-vec', title: '«Vec<T>»: the growable array', mins: 6, hunts: ['cost'],
        remember: '«Vec<T>» is a growable array on the heap: a pointer, a length and a capacity. «push» is amortised O(1); «insert» and «remove» shift every later element; «v[i]» panics out of range where «v.get(i)» returns an «Option».',
        cue: '«v.remove(0)» in a loop → O(n) per call; «VecDeque» pops from the front in O(1)',
        body: R`
          | Operation | Cost | Note |
          |---|---|---|
          | «Vec::new()», «vec![a, b]», «vec![x; n]», «Vec::with_capacity(n)» | | «with_capacity» avoids regrowing |
          | «push(x)», «pop()» | amortised O(1) | «pop» returns «Option<T>» |
          | «insert(i, x)», «remove(i)» | O(n) | shift everything after «i» |
          | «swap_remove(i)» | O(1) | moves the last element into the gap |
          | «v[i]», «v.get(i)» | O(1) | the first panics out of range |
          | «extend(iter)», «append(&mut other)», «truncate(n)», «clear()» | | |
          | «retain(f)», «dedup()», «drain(range)» | O(n) | |
          | «sort()», «sort_by_key(f)», «sort_unstable()» | O(n log n) | «sort» is stable |
          | «binary_search(&x)» | O(log n) | on sorted data; «Ok(index)» or «Err(insertion point)» |

          When the length reaches the capacity, «push» allocates a larger buffer (typically double) and moves every element: that is why it is amortised O(1) and why «with_capacity» helps when the size is known.

          «Vec<T>» is «std::vector<T>»: «push» is «push_back», «with_capacity» is «reserve», and the reallocation is the same, which is exactly why a reference into a «Vec» cannot survive a «push» (the Borrowing module showed the C++ version of that bug). A slice «&[T]» is «std::span<const T>», and «&mut [T]» is «std::span<T>».

          ~~~rust !run
          use std::collections::VecDeque;

          fn main() {
              let mut v: Vec<u32> = Vec::with_capacity(4);
              println!("{} {}", v.len(), v.capacity());
              v.extend([5, 3, 9, 3, 1]);
              v.push(7);
              println!("{v:?} len {}", v.len());

              v.sort();
              v.dedup();
              println!("{v:?} {:?}", v.binary_search(&7));
              v.retain(|&x| x != 5);
              let last = v.pop();
              let first = v.remove(0);
              println!("{v:?} {last:?} {first}");
              println!("{:?} {:?}", v.get(10), v.iter().max());

              let mut q = VecDeque::from(vec![1, 2, 3]);
              q.push_back(4);
              println!("{:?} {:?}", q.pop_front(), q);
          }
          ~~~

          ## Three ways to loop

          | Loop | Yields | Afterwards |
          |---|---|---|
          | «for x in &v» (or «v.iter()») | «&T» | «v» is unchanged |
          | «for x in &mut v» (or «v.iter_mut()») | «&mut T» | elements may have changed |
          | «for x in v» (or «v.into_iter()») | «T» | «v» is gone: it was moved into the loop |

          @predict 0
        `,
        predict: [
          {
            q: 'The loop takes «v» without «&». What happens?',
            code: R`fn main() {
    let v = vec![1, 2, 3];
    for x in v {
        print!("{x} ");
    }
    println!("{}", v.len());
}`,
            options: ['1 2 3 3', '1 2 3 0', 'Compile error'],
            answer: 2, error: 'E0382',
            why: '«for x in v» calls «v.into_iter()», which consumes the «Vec». After the loop there is no «v» to ask for a length. «for x in &v» borrows instead.',
          },
        ],
      },
      {
        lesson: 'co-maps', title: 'HashMap, HashSet and BTreeMap', mins: 6, hunts: ['panic'],
        remember: '«HashMap<K, V>» and «HashSet<T>» need keys that implement «Eq» and «Hash», iterate in no particular order, and answer «get» with an «Option<&V>». «BTreeMap» and «BTreeSet» keep keys sorted. The entry API inserts or updates with a single lookup.',
        cue: '«if map.contains_key(&k) { ... } else { map.insert(k, ...) }» → «*map.entry(k).or_insert(0) += 1»',
        body: R`
          | Operation | Returns | Note |
          |---|---|---|
          | «insert(k, v)» | «Option<V>» | the previous value, if any |
          | «get(&k)», «get_mut(&k)» | «Option<&V>», «Option<&mut V>» | |
          | «map[&k]» | «&V» | panics if the key is missing |
          | «remove(&k)», «contains_key(&k)» | «Option<V>», «bool» | |
          | «entry(k).or_insert(v)» | «&mut V» | inserts «v» only if the key is missing |
          | «entry(k).or_insert_with(f)», «.or_default()», «.and_modify(f)» | | |
          | «iter()», «keys()», «values()», «values_mut()» | iterators | a «HashMap»'s order is unspecified |
          | «HashSet::insert(x)» | «bool» | «false» if it was already there |

          - A «HashMap<String, V>» can be looked up with a «&str»: «map.get("lab-a")».
          - «HashMap» is «std::unordered_map» and «BTreeMap» is «std::map», with one trap removed: C++'s «m[key]» inserts a default value when the key is missing, while Rust's «map[&key]» panics and «get» returns «None». Inserting is always explicit, usually through «entry».
          - Floats cannot be keys (not «Eq» or «Hash»); neither can anything that does not derive or implement both.
          - Iterating a «HashMap» twice may give different orders on different runs. Sort, or use a «BTreeMap», when order matters.

          ~~~rust !run
          use std::collections::{BTreeMap, HashMap, HashSet};

          fn main() {
              let msg = "MSH|a\rPID|b\rOBX|1\rOBX|2\rOBX|3";
              let mut counts: HashMap<&str, u32> = HashMap::new();
              for seg in msg.split('\r') {
                  *counts.entry(&seg[..3]).or_insert(0) += 1;
              }
              println!("{:?} {:?}", counts.get("OBX"), counts.get("NTE"));

              let sorted: BTreeMap<_, _> = counts.iter().collect();
              println!("{sorted:?}");

              let old = counts.insert("PID", 9);
              println!("{old:?} {}", counts["PID"]);

              let mut seen = HashSet::new();
              println!("{} {}", seen.insert("lab-a"), seen.insert("lab-a"));
          }
          ~~~

          @predict 0
        `,
        predict: [
          {
            q: 'The key is not in the map. What happens?',
            code: R`use std::collections::HashMap;

fn main() {
    let mut ports = HashMap::new();
    ports.insert("lab-a", 5100);
    println!("{}", ports["lab-b"]);
}`,
            options: ['0', 'None', 'It panics', 'Compile error'],
            answer: 2,
            why: 'Indexing a map with «[]» panics when the key is missing, just like indexing a «Vec» out of range. «ports.get("lab-b")» returns «None» instead.',
          },
        ],
      },
      {
        exercise: {
          id: 'co-fix-utf8', title: 'Text functions that survive non-ASCII names', kind: 'fix', mins: 10, diff: 'medium', topics: ['text'],
          statement: R`
            Both functions work on «"Ana"» and panic on «"José"» or «"émile"». Fix them so they work on any text.

            - «prefix(s, n)»: the first «n» **characters** of «s», or all of «s» if it is shorter.
            - «capitalise(name)»: «name» with its first character in upper case.
          `,
          starter: R`
/// The first n characters of s, or all of s if it is shorter.
pub fn prefix(s: &str, n: usize) -> &str {
    &s[..n]
}

/// The name with its first character in upper case.
pub fn capitalise(name: &str) -> String {
    let first = &name[..1];
    first.to_uppercase() + &name[1..]
}
`,
          starterFails: 'tests',
          tests: [
            { name: 'ASCII still works', ex: true, code: 'assert_eq!(prefix("lab-a", 3), "lab");\nassert_eq!(capitalise("ana"), "Ana");' },
            { name: 'prefix counts characters', ex: true, code: 'assert_eq!(prefix("José", 4), "José");\nassert_eq!(prefix("José", 3), "Jos");\nassert_eq!(prefix("émile", 2), "ém");' },
            { name: 'prefix of something shorter', code: 'assert_eq!(prefix("ab", 5), "ab");\nassert_eq!(prefix("", 0), "");' },
            { name: 'capitalise a non-ASCII first letter', ex: true, code: 'assert_eq!(capitalise("émile"), "Émile");' },
            { name: 'capitalise nothing', code: 'assert_eq!(capitalise(""), "");' },
          ],
          hints: [
            '«s.char_indices()» yields «(byte_offset, char)». The byte offset of character number «n» is where the prefix ends.',
            '«s.char_indices().nth(n)» is «None» when «s» has at most «n» characters: then the answer is all of «s».',
            'For «capitalise»: «let mut chars = name.chars();», take «chars.next()», and «chars.as_str()» is the rest. «char::to_uppercase» yields an iterator, because some characters become several.',
          ],
          solution: {
            rust: R`
/// The first n characters of s, or all of s if it is shorter.
pub fn prefix(s: &str, n: usize) -> &str {
    match s.char_indices().nth(n) {
        Some((end, _)) => &s[..end],
        None => s,
    }
}

/// The name with its first character in upper case.
pub fn capitalise(name: &str) -> String {
    let mut chars = name.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}
`,
            why: R`
              - Slicing a «&str» takes **byte** offsets and panics in the middle of a character. «char_indices» gives the byte offset of each character, so «&s[..end]» always cuts at a boundary.
              - «nth(n)» returning «None» covers "shorter than n", which the original also got wrong: «&s[..n]» panics when «n» is past the end.
              - «chars.next()» takes the first character and leaves the iterator positioned after it; «as_str()» is the untouched rest, borrowed.
              - «to_uppercase()» returns an iterator because some characters uppercase to several («ß» becomes «SS»).
            `,
            talk: 'Both functions sliced by byte offsets, which panics inside a multi-byte character. prefix now finds the byte offset of the nth character with char_indices, and capitalise takes the first char from a chars iterator and appends the rest with as_str.',
          },
          wrong: [
            { name: 'counts bytes, guards the end', rust: 'pub fn prefix(s: &str, n: usize) -> &str { s.get(..n).unwrap_or(s) }\npub fn capitalise(name: &str) -> String { let mut c = name.chars(); match c.next() { Some(f) => f.to_uppercase().collect::<String>() + c.as_str(), None => String::new() } }' },
          ],
        },
      },
      {
        exercise: {
          id: 'co-build-counts', title: 'Count segments with a HashMap', kind: 'build', mins: 12, diff: 'medium', topics: ['collections'],
          statement: R`
            An HL7 message is a list of segments separated by «\r»; each segment starts with a three-letter name such as «MSH» or «OBX».

            - «segment_counts(msg)»: how often each segment name appears. Skip empty segments. A segment shorter than three characters counts under its whole text.
            - «top_segments(counts, n)»: the «n» most frequent names with their counts, most frequent first, ties in alphabetical order.
          `,
          starter: R`
use std::collections::HashMap;

pub fn segment_counts(msg: &str) -> HashMap<String, u32> {
    todo!()
}

pub fn top_segments(counts: &HashMap<String, u32>, n: usize) -> Vec<(String, u32)> {
    todo!()
}
`,
          starterFails: 'tests',
          tests: [
            { name: 'counts names', ex: true, code: 'let c = segment_counts("MSH|a\\rPID|b\\rOBX|1\\rOBX|2");\nassert_eq!(c.get("OBX"), Some(&2));\nassert_eq!(c.get("MSH"), Some(&1));\nassert_eq!(c.len(), 3);' },
            { name: 'skips empty segments', ex: true, code: 'let c = segment_counts("MSH|a\\r\\rPID|b\\r");\nassert_eq!(c.len(), 2);' },
            { name: 'short segments', code: 'let c = segment_counts("MSH|a\\rZ\\rZ");\nassert_eq!(c.get("Z"), Some(&2));' },
            { name: 'top segments in order', ex: true, code: 'let c = segment_counts("OBX|1\\rMSH|a\\rOBX|2\\rPID|b\\rOBX|3\\rPID|c");\nassert_eq!(top_segments(&c, 2), vec![("OBX".to_string(), 3), ("PID".to_string(), 2)]);' },
            { name: 'ties are alphabetical', code: 'let c = segment_counts("PID|a\\rMSH|b\\rNTE|c");\nassert_eq!(top_segments(&c, 3), vec![("MSH".to_string(), 1), ("NTE".to_string(), 1), ("PID".to_string(), 1)]);' },
            { name: 'n larger than the map', code: 'let c = segment_counts("MSH|a");\nassert_eq!(top_segments(&c, 5).len(), 1);' },
          ],
          hints: [
            '«msg.split(\'\\r\')» yields each segment; «seg.get(..3).unwrap_or(seg)» is the name, and never panics.',
            '«*counts.entry(name.to_string()).or_insert(0) += 1» counts in one lookup.',
            'Collect the pairs into a «Vec», then «sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)))»: count descending, then name ascending. «truncate(n)» keeps the first «n».',
          ],
          solution: {
            rust: R`
use std::collections::HashMap;

pub fn segment_counts(msg: &str) -> HashMap<String, u32> {
    let mut counts = HashMap::new();
    for seg in msg.split('\r') {
        if seg.is_empty() {
            continue;
        }
        let name = seg.get(..3).unwrap_or(seg);
        *counts.entry(name.to_string()).or_insert(0) += 1;
    }
    counts
}

pub fn top_segments(counts: &HashMap<String, u32>, n: usize) -> Vec<(String, u32)> {
    let mut pairs: Vec<(String, u32)> = counts.iter().map(|(k, v)| (k.clone(), *v)).collect();
    pairs.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    pairs.truncate(n);
    pairs
}
`,
            why: R`
              - «get(..3)» returns «None» both for a segment shorter than three bytes and for a cut inside a multi-byte character, so it never panics; «&seg[..3]» would.
              - The entry API finds the slot once: «or_insert(0)» creates it when missing, and «+= 1» updates it through the returned «&mut u32».
              - A «HashMap» has no order, so the result has to be sorted explicitly. «Ordering::then» chains the tie-breaker.
              - «truncate(n)» does nothing when there are fewer than «n» elements.
            `,
            talk: 'segment_counts uses the entry API with a panic-free get(..3) for the name, and top_segments copies the pairs out, sorts by count descending then name ascending, and truncates to n.',
          },
          wrong: [
            { name: 'least frequent first', rust: 'use std::collections::HashMap;\npub fn segment_counts(msg: &str) -> HashMap<String, u32> { let mut c = HashMap::new(); for s in msg.split(\'\\r\') { if s.is_empty() { continue; } *c.entry(s.get(..3).unwrap_or(s).to_string()).or_insert(0) += 1; } c }\npub fn top_segments(counts: &HashMap<String, u32>, n: usize) -> Vec<(String, u32)> { let mut p: Vec<(String, u32)> = counts.iter().map(|(k, v)| (k.clone(), *v)).collect(); p.sort_by(|a, b| a.1.cmp(&b.1).then(a.0.cmp(&b.0))); p.truncate(n); p }' },
          ],
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);

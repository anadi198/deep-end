(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'types', title: 'Types: scalars, tuples and arrays', short: 'Types',
    blurb: 'Every integer type with its range, literal syntax, what overflow does in debug and release builds, floats, bool and char, tuples and fixed-size arrays, and the exact rules for converting between types.',
    items: [
      {
        lesson: 'ty-ints', title: 'Integers: widths, ranges and literals', mins: 7,
        remember: 'Integer types state their width and signedness («i8» to «i128», «u8» to «u128», «isize», «usize»). An integer literal with nothing else to go on is an «i32», and every length and index is a «usize».',
        cue: 'An integer literal with no suffix and no context → «i32»; anything used as an index or a length → «usize»',
        body: R`
          ## The integer types

          | Type | Bits | Range |
          |---|---|---|
          | «i8» | 8 | -128 to 127 |
          | «u8» | 8 | 0 to 255 |
          | «i16» | 16 | -32,768 to 32,767 |
          | «u16» | 16 | 0 to 65,535 |
          | «i32» | 32 | -2,147,483,648 to 2,147,483,647 |
          | «u32» | 32 | 0 to 4,294,967,295 |
          | «i64» | 64 | -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807 |
          | «u64» | 64 | 0 to 18,446,744,073,709,551,615 |
          | «i128», «u128» | 128 | about ±1.7e38, and 0 to about 3.4e38 |
          | «isize», «usize» | pointer width: 64 on 64-bit targets | the size of a memory address |

          - Java has only signed types; Rust's unsigned ones are the norm for sizes, bytes and counts.
          - «usize» is the type of every «.len()» and the only type that can index a slice or a «Vec».
          - Each type has associated constants: «u16::MAX», «i8::MIN», «u32::BITS».

          ## Literals

          | Written | Value |
          |---|---|
          | «1_000_000» | underscores are ignored, for readability |
          | «0xFF», «0o17», «0b1010» | hexadecimal, octal, binary |
          | «255u8», «10_i64», «1usize» | a suffix fixes the type |
          | «b'A'» | a byte literal: the «u8» 65 |
          | no suffix | inferred from context; if nothing decides, «i32» |

          ~~~rust !run
          fn main() {
              let a = 1_000_000; // i32: nothing else decides
              let b = 0xFFu8;
              let c = 0b1010_0101u8;
              let d = b'A';
              let e: u64 = 1 << 40;
              println!("{a} {b} {c} {d} {e}");
              println!("{} {}", u16::MAX, i8::MIN);
              println!("{} bytes in a usize", std::mem::size_of::<usize>());
          }
          ~~~

          @predict 0
        `,
        predict: [
          {
            q: 'What happens?',
            code: R`fn main() {
    let port: u8 = 256;
    println!("{port}");
}`,
            options: ['0', '255', 'Compile error', 'It panics'],
            answer: 2,
            why: 'A literal that does not fit its type is rejected at compile time ("literal out of range for u8", a lint that is an error by default). Values computed at run time are the next lesson.',
          },
        ],
      },
      {
        lesson: 'ty-overflow', title: 'Arithmetic: overflow, division and the explicit methods', mins: 7, hunts: ['panic', 'logic'],
        remember: 'Integer overflow panics in debug builds and wraps silently in release builds. When overflow is possible, say what should happen with «checked_», «wrapping_», «saturating_» or «overflowing_».',
        cue: 'Arithmetic on sizes, counters or values from outside → can it overflow? Choose «checked_add», «saturating_add» or «wrapping_add» explicitly',
        body: R`
          ## The rules

          1. «+ - *» that overflow **panic** in a debug build ("attempt to add with overflow") and **wrap** in a release build, unless the build profile enables overflow checks.
          2. Unsigned subtraction below zero is overflow: «len - 1» when «len» is 0.
          3. Integer division truncates toward zero; «%» takes the sign of the left operand. Division or remainder by zero panics in every build.
          4. Shifting by the type's bit width or more is overflow too.
          5. «i32::MIN.abs()» and «i32::MIN / -1» overflow, because 2,147,483,648 does not fit.

          Tests and the Playground are debug builds, so there overflow is loud. Production is usually a release build, where the same code quietly produces a wrapped value.

          @predict 0

          ## Saying what you mean

          | Method | Returns | On overflow |
          |---|---|---|
          | «a.checked_add(b)» | «Option<T>» | «None» |
          | «a.wrapping_add(b)» | «T» | wraps around, in every build |
          | «a.saturating_add(b)» | «T» | stops at «MIN» or «MAX» |
          | «a.overflowing_add(b)» | «(T, bool)» | the wrapped value, and «true» |

          The same four exist for «sub», «mul», «div», «pow», «shl» and more.

          ~~~rust !run
          fn main() {
              let x: u8 = 250;
              println!("{:?}", x.checked_add(10));
              println!("{}", x.wrapping_add(10));
              println!("{}", x.saturating_add(10));
              println!("{:?}", x.overflowing_add(10));
              println!("{} {}", 7 / 2, -7 / 2);
              println!("{} {}", 7 % 3, -7 % 3);
              println!("{}", (-7i32).rem_euclid(3));
          }
          ~~~

          «rem_euclid» and «div_euclid» give the mathematical versions, where the remainder is never negative: what you want for wrapping an index into a ring buffer.

          @stop

          ## Overflow through a method

          @predict 1
        `,
        predict: [
          {
            q: 'What does this print on the Playground (a debug build)?',
            code: R`fn remaining(limit: u32, used: u32) -> u32 {
    limit - used
}

fn main() {
    println!("{}", remaining(5, 3));
    println!("{}", remaining(3, 5));
}`,
            options: ['2\n-2', '2\n4294967294', 'It panics', 'Compile error'],
            answer: 2,
            why: 'It prints 2, then «3 - 5» underflows a «u32» and panics with "attempt to subtract with overflow". A release build would print 4294967294 instead, with no warning. «limit.saturating_sub(used)» gives 0, and «checked_sub» gives «None».',
          },
          {
            q: 'Two small numbers, summed as bytes. What happens?',
            code: 'fn main() {\n    let sizes: Vec<u8> = vec![200, 100];\n    let total: u8 = sizes.iter().sum();\n    println!("{total}");\n}',
            options: ['300', '44', 'It panics', 'Compile error'],
            answer: 2,
            why: '«sum» adds with «+», so it overflows like any other addition: a panic in a debug build, 44 in a release build. Summing into a wider type avoids it: «sizes.iter().map(|&s| u32::from(s)).sum::<u32>()».',
          },
        ],
      },
      {
        lesson: 'ty-scalars', title: 'Floats, bool, char, unit and never', mins: 6,
        remember: '«f64» and «f32» are IEEE 754, so «NaN» is not equal to itself and floats implement only «PartialEq» and «PartialOrd». A «char» is a 4-byte Unicode scalar value, not a byte, and «bool» never converts to or from an integer implicitly.',
        cue: 'Sorting floats or using them as map keys fails to compile → floats are not «Ord» or «Eq» because of NaN; use «total_cmp»',
        body: R`
          | Type | Size | Literals | Notes |
          |---|---|---|---|
          | «f64» | 8 bytes | «1.0», «1e-3», «2.5f64» | the default float |
          | «f32» | 4 bytes | «2.5f32» | |
          | «bool» | 1 byte | «true», «false» | conditions must be «bool»: no truthiness |
          | «char» | 4 bytes | «'a'», «'é'», «'\u{1F600}'» | one Unicode scalar value |
          | «()» | 0 bytes | «()» | the unit type (the Syntax module) |
          | «!» | none | none | the never type (the Syntax module) |

          ~~~rust !run
          fn main() {
              let nan = f64::NAN;
              println!("{}", nan == nan);
              println!("{}", 0.1 + 0.2 == 0.3);

              let mut sizes: Vec<f64> = vec![2.5, -1.0, 10.0];
              sizes.sort_by(|a, b| a.total_cmp(b));
              println!("{sizes:?}");

              let c = 'é';
              println!("{} {} {}", c.len_utf8(), c as u32, std::mem::size_of::<char>());
              println!("{}", true as u8 + 1);
          }
          ~~~

          Because «NaN != NaN», floats cannot promise a total order or consistent equality, so they implement only «PartialEq» and «PartialOrd». Anything that needs «Ord» or «Eq» (sorting with «sort()», «BTreeMap» keys, «HashMap» keys) rejects them:

          ~~~rust !fail
          fn main() {
              let mut sizes = vec![2.5, -1.0, 10.0];
              sizes.sort();
              println!("{sizes:?}");
          }
          ~~~

          @predict 0
        `,
        predict: [
          {
            q: 'How long is this string?',
            code: R`fn main() {
    println!("{}", "José".len());
}`,
            options: ['4', '5', '8', '16'],
            answer: 1,
            why: '«len()» on a string counts **bytes** of UTF-8, not characters. «é» takes two bytes, so four characters are five bytes. «"José".chars().count()» gives 4. The Collections and text module goes into strings properly.',
          },
        ],
      },
      {
        lesson: 'ty-compound', title: 'Tuples and arrays', mins: 6, hunts: ['panic'],
        remember: 'A tuple «(A, B)» groups a fixed number of values of possibly different types, read with «.0», «.1» or by destructuring. An array «[T; N]» holds exactly N values of one type, its length is part of its type, and indexing is bounds-checked at run time.',
        cue: '«[u8; 4]» versus «Vec<u8>» → the array\'s length is fixed at compile time and it is stored inline; a «Vec» can grow and stores its elements on the heap',
        body: R`
          ~~~text Syntax
          (TYPE, TYPE, ...)          a tuple type        (EXPRESSION, EXPRESSION, ...)   a tuple value
          [TYPE; LENGTH]             an array type       [EXPRESSION, ...]  [EXPRESSION; LENGTH]
          ~~~

          - A one-element tuple needs a comma: «(5,)». The empty tuple «()» is the unit type.
          - Tuple fields are read with «.0», «.1», ... or taken apart with a pattern: «let (host, port) = pair;».
          - An array's length is a compile-time constant and part of its type: «[u8; 4]» and «[u8; 8]» are different types.
          - «[0u8; 1024]» repeats one value; «a.len()» is the length; «a[i]» panics when «i» is out of range, and «a.get(i)» returns an «Option».
          - Arrays and tuples are «Copy» when their elements are, so assigning one copies it.
          - «&a» on an array gives a slice, «&[T]», the type most functions accept (the Collections and text module).

          ~~~rust !run
          fn main() {
              let header: (u8, &str, u16) = (0x0b, "MSH", 5100);
              let (start, segment, port) = header;
              println!("{} {} {} {}", header.0, start, segment, port);

              let mut buf = [0u8; 8];
              buf[0] = 0x0b;
              println!("{:?} len {}", buf, buf.len());
              println!("{:?} {:?}", buf.get(7), buf.get(8));

              let grid = [[1, 2, 3], [4, 5, 6]];
              println!("{}", grid[1][2]);
          }
          ~~~

          @predict 0
        `,
        predict: [
          {
            q: 'The index comes in as a parameter. What happens?',
            code: R`fn byte_at(buf: [u8; 4], i: usize) -> u8 {
    buf[i]
}

fn main() {
    println!("{}", byte_at([1, 2, 3, 4], 4));
}`,
            options: ['0', '4', 'It panics', 'Compile error'],
            answer: 2,
            why: 'Indexing is checked at run time: "index out of bounds: the len is 4 but the index is 4". With a constant index the compiler would reject it outright; with a variable it can only check when it runs. «buf.get(i)» returns «None» instead.',
          },
        ],
      },
      {
        lesson: 'ty-convert', title: 'Conversions: as, From and TryFrom', mins: 7, hunts: ['logic'],
        remember: 'Rust never converts numbers implicitly. «as» converts between primitive types and never fails: it truncates, reinterprets signs and saturates without a word. «From» is for conversions that cannot lose information; «TryFrom» returns a «Result» when they can.',
        cue: '«x as u8», «as u16» or «as i32» on a value that might not fit → «u8::try_from(x)», which returns an error instead of a wrong number',
        body: R`
          ## No implicit conversions

          Mixing integer types is a compile error, even when widening would be safe:

          ~~~rust !fail
          fn main() {
              let frames: u32 = 10;
              let bytes: u64 = 5_000;
              let total: u64 = bytes + frames;
              println!("{total}");
          }
          ~~~

          ## What «as» does

          | Conversion | Rule | Example |
          |---|---|---|
          | wider integer to narrower | keeps the low bits | «300u32 as u8» is 44 |
          | signed and unsigned, same width | reinterprets the bits | «-1i32 as u32» is 4294967295 |
          | narrower to wider | zero- or sign-extends: lossless | «200u8 as i32» is 200 |
          | float to integer | rounds toward zero, saturates, NaN becomes 0 | «3.99 as u8» is 3; «300.0 as u8» is 255 |
          | integer to float | the nearest representable value | |
          | «bool» or «char» to integer | «false» is 0, «true» is 1; a «char» gives its code point | «'A' as u8» is 65 |
          | «u8» to «char» | only from «u8» | «65u8 as char» is «'A'» |

          ~~~rust !run
          fn main() {
              println!("{}", 300u32 as u8);
              println!("{}", -1i32 as u32);
              println!("{} {} {}", 3.99f64 as u8, 300.0f64 as u8, -1.0f64 as u8);
              println!("{}", f64::NAN as u8);
          }
          ~~~

          @stop

          ## «From» and «TryFrom»

          | Trait | Signature | Used as |
          |---|---|---|
          | «From<T> for U» | «fn from(t: T) -> U» | «u64::from(x)», or «x.into()» where a «u64» is expected |
          | «TryFrom<T> for U» | «fn try_from(t: T) -> Result<U, Self::Error>» | «u8::try_from(x)», or «x.try_into()» |
          | «FromStr» | «fn from_str(s: &str) -> Result<Self, Self::Err>» | «"5100".parse::<u16>()» |

          The standard library implements «From» only where no value can be lost («u32» to «u64», «u8» to «char»), and «TryFrom» for the rest. «::<u16>», the **turbofish**, supplies a type parameter where inference has nothing to go on.

          ~~~rust !run
          fn main() {
              println!("{:?}", u8::try_from(300u32));
              println!("{:?}", u8::try_from(200u32));
              let wide: u64 = 7u32.into();
              println!("{wide}");
              println!("{:?} {:?}", "5100".parse::<u16>(), "70000".parse::<u16>());
          }
          ~~~

          @predict 0
        `,
        predict: [
          {
            q: 'A 70,000-byte body gets a 16-bit length prefix. What is written on the wire?',
            code: R`fn main() {
    let body_len: usize = 70_000;
    let prefix = body_len as u16;
    println!("{prefix}");
}`,
            options: ['70000', '65535', '4464', 'It panics'],
            answer: 2,
            why: '«as» keeps the low 16 bits: 70,000 minus 65,536 is 4,464. No panic in any build. «u16::try_from(body_len)» would return an error you have to handle instead of a wrong length.',
          },
        ],
      },
      {
        exercise: {
          id: 'ty-build-sizes', title: 'Size arithmetic that cannot go wrong', kind: 'build', mins: 12, diff: 'medium', topics: ['types'],
          statement: R`
            Three functions that deal with sizes, none of which may overflow, truncate or panic:

            - «total_len(lens)»: the sum of all lengths, or «None» if it does not fit in a «u32».
            - «length_prefix(body_len)»: the body length as a «u16» for a 16-bit length prefix, or an error if it does not fit.
            - «backoff_ms(attempt)»: 100 ms doubled for each attempt (100, 200, 400, ...), never more than 30,000, for any «attempt» up to «u32::MAX».

            The starter returns the right answers for small inputs. The tests use large ones.
          `,
          starter: R`
/// The sum of all lengths, or None if it does not fit in a u32.
pub fn total_len(lens: &[u32]) -> Option<u32> {
    Some(lens.iter().sum())
}

/// The body length as a u16, or an error if it is longer than u16::MAX.
pub fn length_prefix(body_len: usize) -> Result<u16, String> {
    Ok(body_len as u16)
}

/// 100 ms doubled per attempt, capped at 30,000 ms.
pub fn backoff_ms(attempt: u32) -> u64 {
    (100 * 2u64.pow(attempt)).min(30_000)
}
`,
          starterFails: 'tests',
          tests: [
            { name: 'small totals', ex: true, code: 'assert_eq!(total_len(&[1, 2, 3]), Some(6));\nassert_eq!(total_len(&[]), Some(0));' },
            { name: 'a total that does not fit', ex: true, code: 'assert_eq!(total_len(&[u32::MAX, 1]), None);' },
            { name: 'prefixes that fit', ex: true, code: 'assert_eq!(length_prefix(0), Ok(0));\nassert_eq!(length_prefix(65_535), Ok(65_535));' },
            { name: 'a body too long for 16 bits', code: 'assert!(length_prefix(65_536).is_err(), "65,536 does not fit in a u16");\nassert!(length_prefix(70_000).is_err());' },
            { name: 'backoff doubles', ex: true, code: 'assert_eq!((backoff_ms(0), backoff_ms(1), backoff_ms(3)), (100, 200, 800));' },
            { name: 'backoff is capped', code: 'assert_eq!(backoff_ms(9), 30_000);\nassert_eq!(backoff_ms(64), 30_000);\nassert_eq!(backoff_ms(u32::MAX), 30_000);' },
          ],
          hints: [
            '«checked_add» returns an «Option». Add in a «for» loop, and return «None» as soon as one addition fails.',
            '«u16::try_from(body_len)» returns a «Result»; «.map_err(|e| e.to_string())» turns its error into a «String».',
            '«2u64.checked_pow(attempt)» is «None» once the power no longer fits; «saturating_mul» and «min» do the rest.',
          ],
          solution: {
            rust: R`
/// The sum of all lengths, or None if it does not fit in a u32.
pub fn total_len(lens: &[u32]) -> Option<u32> {
    let mut total: u32 = 0;
    for &len in lens {
        total = total.checked_add(len)?;
    }
    Some(total)
}

/// The body length as a u16, or an error if it is longer than u16::MAX.
pub fn length_prefix(body_len: usize) -> Result<u16, String> {
    u16::try_from(body_len).map_err(|_| format!("a body of {body_len} bytes does not fit a 16-bit length"))
}

/// 100 ms doubled per attempt, capped at 30,000 ms.
pub fn backoff_ms(attempt: u32) -> u64 {
    let factor = 2u64.checked_pow(attempt).unwrap_or(u64::MAX);
    100u64.saturating_mul(factor).min(30_000)
}
`,
            why: R`
              - «checked_add(len)?» returns «None» from the function the moment an addition overflows. «?» on an «Option» is covered properly in the Errors module; here it means "stop and return None".
              - «body_len as u16» would turn 70,000 into 4,464 on the wire. «try_from» makes "too big" an error the caller has to handle.
              - «2u64.pow(64)» overflows (a panic in debug builds), so the power is checked, and the multiplication saturates instead of wrapping. The result is capped either way.
            `,
            talk: 'Each function states what happens at the edge: checked_add stops the sum at the first overflow, try_from turns a length that does not fit into an error, and checked_pow plus saturating_mul keep the backoff from overflowing before the cap applies.',
          },
          wrong: [
            { name: 'wraps instead of failing', rust: 'pub fn total_len(lens: &[u32]) -> Option<u32> { let mut t: u32 = 0; for &l in lens { t = t.wrapping_add(l); } Some(t) }\npub fn length_prefix(body_len: usize) -> Result<u16, String> { u16::try_from(body_len).map_err(|e| e.to_string()) }\npub fn backoff_ms(attempt: u32) -> u64 { 100u64.saturating_mul(2u64.checked_pow(attempt).unwrap_or(u64::MAX)).min(30_000) }' },
            { name: 'truncates the prefix', rust: 'pub fn total_len(lens: &[u32]) -> Option<u32> { let mut t: u32 = 0; for &l in lens { t = t.checked_add(l)?; } Some(t) }\npub fn length_prefix(body_len: usize) -> Result<u16, String> { Ok(body_len as u16) }\npub fn backoff_ms(attempt: u32) -> u64 { 100u64.saturating_mul(2u64.checked_pow(attempt).unwrap_or(u64::MAX)).min(30_000) }' },
          ],
        },
      },
      {
        exercise: {
          id: 'ty-fix-mixed', title: 'Make the types line up', kind: 'fix', mins: 8, diff: 'easy', topics: ['types'],
          statement: R`
            Three functions mix numeric types, and none of them compiles. Press **Run**, read the errors, and fix each one with an explicit, lossless conversion.

            - «average»: bytes per frame, rounded down; 0 when there are no frames.
            - «byte_at»: the byte at a position that arrives as a «u32»; «None» past the end.
            - «percent»: used as a percentage of capacity, as an «f64»; 0.0 when the capacity is 0.
          `,
          starter: R`
pub fn average(total_bytes: u64, frames: u32) -> u64 {
    if frames == 0 {
        return 0;
    }
    total_bytes / frames
}

pub fn byte_at(buf: &[u8], pos: u32) -> Option<u8> {
    buf.get(pos).copied()
}

pub fn percent(used: u32, capacity: u32) -> f64 {
    if capacity == 0 {
        return 0.0;
    }
    used / capacity * 100.0
}
`,
          starterFails: 'compile',
          tests: [
            { name: 'average', ex: true, code: 'assert_eq!(average(10, 4), 2);\nassert_eq!(average(5, 0), 0);' },
            { name: 'byte_at', ex: true, code: 'assert_eq!(byte_at(&[1, 2, 3], 2), Some(3));\nassert_eq!(byte_at(&[1, 2, 3], 3), None);' },
            { name: 'percent', ex: true, code: 'assert_eq!(percent(1, 4), 25.0);\nassert_eq!(percent(3, 0), 0.0);' },
          ],
          hints: [
            '«u64 / u32» has no implementation. «u64::from(frames)» widens without loss.',
            'Slices are indexed by «usize». «usize::try_from(pos)» cannot fail on a 32- or 64-bit machine, but it says so explicitly; «pos as usize» also works here because it only widens.',
            'Convert both operands before dividing: «f64::from(used) / f64::from(capacity) * 100.0». Dividing two «u32» first would truncate 1/4 to 0.',
          ],
          solution: {
            rust: R`
pub fn average(total_bytes: u64, frames: u32) -> u64 {
    if frames == 0 {
        return 0;
    }
    total_bytes / u64::from(frames)
}

pub fn byte_at(buf: &[u8], pos: u32) -> Option<u8> {
    let i = usize::try_from(pos).ok()?;
    buf.get(i).copied()
}

pub fn percent(used: u32, capacity: u32) -> f64 {
    if capacity == 0 {
        return 0.0;
    }
    f64::from(used) / f64::from(capacity) * 100.0
}
`,
            why: R`
              - Arithmetic operators are defined per pair of types, and «Div<u32> for u64» does not exist. «u64::from» is the lossless widening.
              - Only «usize» indexes a slice. «try_from» documents that the conversion is checked, even though it cannot fail on common platforms.
              - Converting to «f64» before dividing keeps the fraction; integer division would have made «1 / 4» zero.
            `,
            talk: 'Each error was a missing conversion: u64::from to widen the frame count, usize for the index, and f64::from on both operands before dividing so the fraction survives.',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);

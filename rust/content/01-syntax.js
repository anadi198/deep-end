(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'syntax', title: 'Syntax: items, statements and expressions', short: 'Syntax',
    blurb: 'The grammar of a Rust program: items, variables and shadowing, constants and statics, expressions and statements, blocks with values, the unit and never types, and functions.',
    items: [
      {
        lesson: 'sx-items', title: 'A program is a tree of items', mins: 6,
        remember: 'A crate is a tree of items: functions, structs, enums, traits, impls, modules, uses, consts, statics and type aliases. Items may appear in any order; statements exist only inside function bodies.',
        cue: 'Code at the top level of a file → it must be an item: fn, struct, enum, trait, impl, mod, use, const, static or type',
        body: R`
          ## Items

          A source file is a list of **items**. There is no class wrapper: a function can stand on its own.

          | Item | Syntax | Nearest Java |
          |---|---|---|
          | function | «fn NAME(PARAMS) -> TYPE BLOCK» | a static method |
          | struct | «struct NAME { FIELD: TYPE, ... }» | a class's fields, or a record |
          | enum | «enum NAME { VARIANT, VARIANT(TYPE), ... }» | a sealed interface with records |
          | trait | «trait NAME { fn m(&self); ... }» | an interface |
          | impl | «impl TYPE { ... }», «impl TRAIT for TYPE { ... }» | methods; «implements» |
          | module | «mod NAME { ... }» or «mod NAME;» (a file) | a package |
          | use | «use PATH;» | «import» |
          | const | «const NAME: TYPE = EXPRESSION;» | a «static final» constant, inlined |
          | static | «static NAME: TYPE = EXPRESSION;» | a static field: one value at one address |
          | type alias | «type NAME = TYPE;» | none |

          A binary crate starts at «fn main()» in «src/main.rs»; a library crate's root is «src/lib.rs». Items are visible to each other regardless of order:

          ~~~rust !run
          const MAX_RETRIES: u32 = 3;

          fn main() {
              let frame = Frame { id: 7 };
              println!("{} of {}", describe(&frame), MAX_RETRIES);
          }

          fn describe(f: &Frame) -> String {
              format!("frame {}", f.id)
          }

          struct Frame {
              id: u32,
          }
          ~~~

          ## Naming conventions

          The compiler warns when these are broken:

          | Kind | Convention | Example |
          |---|---|---|
          | types, traits, enum variants | «UpperCamelCase» | «FrameKind», «Data» |
          | functions, methods, variables, fields, modules | «snake_case» | «parse_frame» |
          | constants and statics | «SCREAMING_SNAKE_CASE» | «MAX_RETRIES» |
          | lifetimes | short, lowercase, with an apostrophe | «'a» |

          @stop

          ## Comments and attributes

          | Written | Means |
          |---|---|
          | «// text», «/* text */» | comments; block comments nest |
          | «/// text» | documentation for the next item, in Markdown; «cargo doc» renders it |
          | «//! text» | documentation for the enclosing module or crate |
          | «#[attr]» | an attribute on the next item: «#[derive(Debug)]», «#[test]», «#[cfg(test)]» |
          | «#![attr]» | an attribute on the enclosing item: «#![allow(dead_code)]» at the top of a crate |

          @predict 0
        `,
        predict: [
          {
            q: 'The constant is declared after the function that uses it. What happens?',
            code: R`fn main() {
    println!("{}", LIMIT * 2);
}

const LIMIT: u32 = 21;`,
            options: ['42', 'Compile error: LIMIT is used before it is declared', '0'],
            answer: 0,
            why: 'Items are not executed in order; they are declarations the compiler sees all at once. Only statements inside a function body run top to bottom.',
          },
        ],
      },
      {
        lesson: 'sx-vars', title: 'Variables: let, mut, shadowing, const and static', mins: 7,
        remember: '«let» binds a pattern to a value, and the binding is immutable unless declared «let mut». A second «let» with the same name shadows the first: a new variable, possibly of a new type. A «const» is inlined at every use; a «static» is one value at one address.',
        cue: '«let x = ...x...» on a name that already exists → shadowing: a new variable, not an assignment',
        body: R`
          ~~~text Syntax
          let PATTERN [: TYPE] [= EXPRESSION];
          const NAME: TYPE = CONSTANT_EXPRESSION;
          static NAME: TYPE = CONSTANT_EXPRESSION;
          ~~~

          The rules:

          1. A binding is **immutable** unless the pattern says «mut»: «let mut count = 0;».
          2. A binding may be declared without a value, but it must be **definitely assigned** before every use, on every path.
          3. The type is **inferred** from the initialiser and from later uses; write it when inference cannot decide or when it documents intent.
          4. The left-hand side is a **pattern**: «let (host, port) = split(route);» binds two names at once.
          5. «const» needs a type and a value computable at compile time. It has no fixed address; every use is a copy of the value.
          6. «static» lives for the whole program at one address. A «static mut» can only be touched in «unsafe» code; shared mutable state uses atomics or a «Mutex» instead (the Shared state module).

          Assigning twice to an immutable binding is an error:

          ~~~rust !fail
          fn main() {
              let retries = 0;
              retries += 1;
              println!("{retries}");
          }
          ~~~

          ## Shadowing

          ~~~rust !run
          fn main() {
              let port = "5100";
              let port: u16 = port.parse().unwrap(); // a new variable, of a new type
              let port = port + 1;
              println!("{port}");
              {
                  let port = 0; // shadows only inside this block
                  println!("inner {port}");
              }
              println!("outer {port}");
          }
          ~~~

          Each «let port» creates a new variable; the old one still exists, it just cannot be named any more. That is different from «mut»: shadowing can change the type, and the new variable is immutable again. The common use is converting a value step by step without inventing names like «port_str» and «port_num».

          @stop

          ## Definite assignment

          @predict 0
        `,
        predict: [
          {
            q: 'The label is assigned in one branch only. What happens?',
            code: R`fn main() {
    let label;
    let urgent = true;
    if urgent {
        label = "high";
    }
    println!("{label}");
}`,
            options: ['high', 'Compile error', 'It prints an empty line'],
            answer: 1, error: 'E0381',
            why: 'On the path where «urgent» is false, «label» is never assigned, so the compiler rejects the read: "used binding is possibly-uninitialized". Java reports the same thing for a local variable. With an «else» that assigns it too, it compiles, and «label» stays immutable.',
          },
        ],
      },
      {
        lesson: 'sx-expr', title: 'Expressions and statements: blocks have values', mins: 7,
        remember: 'Rust is expression-oriented: blocks, «if», «match» and «loop» all produce values. A statement is a «let», an item, or an expression followed by «;», and the semicolon turns a value into «()», the unit type.',
        cue: 'A block ending in a bare expression with no semicolon → that expression is the block\'s value; a trailing semicolon would make it «()»',
        body: R`
          ## Statements and expressions

          | | Forms | Has a value? |
          |---|---|---|
          | statement | «let» statement; an item; «EXPRESSION;» | no |
          | expression | literals, paths, operators, calls, method calls, field access, blocks «{ }», «if», «match», loops, closures, ranges, «return», «break», «continue» | yes |

          A **block** «{ STATEMENT... [EXPRESSION] }» evaluates to its final expression. With no final expression, its value is «()».

          ~~~rust !run
          fn main() {
              let size = 1500;
              let class = {
                  let kb = size / 1024;
                  if kb == 0 { "tiny" } else { "large" }
              };
              println!("{class}");

              let unit = {
                  let _ = size;
              };
              println!("{unit:?}");
          }
          ~~~

          A function body is a block, so a function returns its final expression:

          @predict 0

          @stop

          ## The unit type and the never type

          - «()» is the **unit type**, and also its only value. It is what Java calls «void», except that it is a real type: it can be stored, compared and returned.
          - «!» is the **never type**: the type of expressions that never produce a value, such as «return», «break», «continue», «panic!(..)», and a «loop» with no «break». Because it never produces a value, it fits wherever any type is expected:

          ~~~rust !run
          fn parse_port(s: &str) -> u16 {
              let n: u16 = match s.parse() {
                  Ok(n) => n,
                  Err(_) => return 0, // type !, accepted where a u16 is expected
              };
              n
          }

          fn main() {
              println!("{} {}", parse_port("5100"), parse_port("x"));
          }
          ~~~

          ## Operators

          | Kind | Operators | Notes |
          |---|---|---|
          | arithmetic | «+ - * / %» | integer «/» truncates toward zero, as in Java |
          | comparison | «== != < > <= >=» | both sides must have the same type |
          | logical | «&& \|\| !» | on «bool» only; short-circuiting |
          | bitwise | «& \| ^ ! << >>» | «!» is bitwise not on integers |
          | assignment | «= += -= *= /= %= &= \|= ^= <<= >>=» | an expression of type «()», so «a = b = 1» does not chain |
          | other | «as» (cast), «?» (propagate an error), «..» «..=» (ranges), «&» «&mut» «*» (references) | covered in later lessons |

          There is no «++» or «--», and no ternary «? :»: «if» is already an expression.

          :::cpp In C++ terms
          In C++, «if», «switch» and loops are statements, and «?:» is the only conditional expression. A Rust block that ends in a value works like a C++ lambda you call on the spot, «[&] { ...; return x; }()», without the ceremony. And Rust assignment returns «()», so the C++ habit «if (x = next())» does not compile.
          :::
        `,
        predict: [
          {
            q: 'One character changed. What happens now?',
            code: 'fn double(x: i32) -> i32 {\n    x * 2;\n}\n\nfn main() {\n    println!("{}", double(21));\n}',
            options: ['42', 'Compile error', '0'],
            answer: 1, error: 'E0308',
            why: 'The semicolon turns «x * 2» into a statement, so the body\'s value is «()» instead of an «i32»: "mismatched types". rustc points at the semicolon and suggests removing it.',
          },
        ],
      },
      {
        lesson: 'sx-fns', title: 'Functions: signatures, parameters and returns', mins: 6,
        remember: 'A signature states every parameter type and the return type. There is no overloading, no default arguments and no varargs; a function returns its final expression, and «-> TYPE» is left out when it returns «()».',
        cue: 'Two functions that differ only in parameter types → Rust has no overloading: different names, a generic, or a trait',
        body: R`
          ~~~text Syntax
          [pub] [const] [async] fn NAME[<GENERICS>](PATTERN: TYPE, ...) [-> TYPE] [where BOUNDS] BLOCK
          ~~~

          The rules:

          1. Every parameter has a type; there is no inference at the signature level.
          2. The return type is written unless it is «()».
          3. No overloading, default arguments or variable argument lists. «println!» takes any number of arguments because it is a macro, not a function.
          4. Parameters are patterns: «fn show((host, port): (&str, u16))».
          5. A parameter is an immutable binding unless written «mut name: T». That makes the local copy mutable; it does not affect the caller.
          6. «return EXPRESSION;» leaves early. Several results come back as a tuple.
          7. Functions are values: a function name can be passed where a «fn(u32) -> u32» pointer is expected.

          ~~~rust !run
          fn split_route(route: &str) -> (&str, u16) {
              match route.split_once(':') {
                  Some((host, port)) => (host, port.parse().unwrap_or(0)),
                  None => (route, 0),
              }
          }

          fn double(x: u32) -> u32 {
              x * 2
          }

          fn apply(f: fn(u32) -> u32, x: u32) -> u32 {
              f(x)
          }

          fn main() {
              let (host, port) = split_route("lab-a:5100");
              println!("{host} {port}");
              println!("{}", apply(double, 21));
          }
          ~~~

          Declaring the same name twice is an error, whatever the parameters:

          ~~~rust !fail
          fn send(frame: &str) {
              println!("{frame}");
          }

          fn send(frame: &[u8]) {
              println!("{}", frame.len());
          }

          fn main() {}
          ~~~

          Methods («fn» inside «impl») are the Structs and enums module; generics are the Traits module.

          @predict 0
        `,
        predict: [
          {
            q: 'The parameter is declared «mut». What does this print?',
            code: R`fn bump(mut n: u32) -> u32 {
    n += 1;
    n
}

fn main() {
    let n = 5;
    let m = bump(n);
    println!("{n} {m}");
}`,
            options: ['5 6', '6 6', 'Compile error: n is not declared mut'],
            answer: 0,
            why: '«mut n» makes the function\'s own copy of the argument mutable. The caller\'s «n» is a separate, immutable binding, and a «u32» is copied when it is passed.',
          },
        ],
      },
      {
        exercise: {
          id: 'read-fix-returns', title: 'Make it compile: three syntax mistakes', kind: 'fix', mins: 8, diff: 'easy', topics: ['syntax'],
          statement: R`
            Three short functions, three classic mistakes. Press **Run** to see the compiler's messages, then fix each one with the smallest change.

            Each message points at a line, says what it expected, and usually says how to fix it.
          `,
          starter: R`
pub fn checksum(bytes: &[u8]) -> u32 {
    let mut sum = 0;
    for b in bytes {
        sum += *b as u32;
    }
    sum;
}

pub fn label(ok: bool) -> &'static str {
    if ok { "AA"; } else { "AE"; }
}

pub fn count_segments(msg: &str) -> usize {
    let count = 0;
    for line in msg.split('\r') {
        if !line.is_empty() {
            count += 1;
        }
    }
    count
}
`,
          starterFails: 'compile',
          tests: [
            { name: 'checksum adds the bytes', ex: true, code: 'assert_eq!(checksum(b"AB"), 131);\nassert_eq!(checksum(b""), 0);' },
            { name: 'label picks AA or AE', ex: true, code: 'assert_eq!(label(true), "AA");\nassert_eq!(label(false), "AE");' },
            { name: 'count_segments skips the empty tail', ex: true, code: 'assert_eq!(count_segments("MSH|a\\rPID|b\\r"), 2);\nassert_eq!(count_segments(""), 0);' },
          ],
          hints: [
            'Two of the errors are "mismatched types": a semicolon turned a value into a statement.',
            'The third is "cannot assign twice to immutable variable". Which «let» needs a «mut»?',
          ],
          solution: {
            rust: R`
pub fn checksum(bytes: &[u8]) -> u32 {
    let mut sum = 0;
    for b in bytes {
        sum += *b as u32;
    }
    sum
}

pub fn label(ok: bool) -> &'static str {
    if ok { "AA" } else { "AE" }
}

pub fn count_segments(msg: &str) -> usize {
    let mut count = 0;
    for line in msg.split('\r') {
        if !line.is_empty() {
            count += 1;
        }
    }
    count
}
`,
            why: R`
              - «sum;» → «sum»: the last expression is the return value, and a semicolon throws it away.
              - «{ "AA"; }» → «{ "AA" }»: the same rule inside each «if» branch. The «if» is the function's last expression, so its branches are the return value.
              - «let count» → «let mut count»: bindings are immutable unless declared «mut».
              - «*b as u32» is safe: widening a «u8» into a «u32» cannot lose bits. The Types module covers when «as» does lose them.
            `,
            talk: 'Two semicolons turned return values into statements, and one binding was missing mut. The compiler named all three.',
          },
        },
      },
      {
        exercise: {
          id: 'sx-build-exprs', title: 'Three functions, no return statements', kind: 'build', mins: 8, diff: 'easy', topics: ['syntax'],
          statement: R`
            Write three small functions. Each body can be a single expression, so none of them needs «return».

            - «to_fahrenheit(c)»: «c * 9 / 5 + 32», in «f64».
            - «is_leap(year)»: divisible by 4, except centuries, except every fourth century (2000 was a leap year, 1900 was not).
            - «sign(n)»: -1, 0 or 1.
          `,
          starter: R`
pub fn to_fahrenheit(c: f64) -> f64 {
    todo!()
}

pub fn is_leap(year: u32) -> bool {
    todo!()
}

pub fn sign(n: i64) -> i64 {
    todo!()
}
`,
          starterFails: 'tests',
          tests: [
            { name: 'converts temperatures', ex: true, code: 'assert_eq!(to_fahrenheit(100.0), 212.0);\nassert_eq!(to_fahrenheit(-40.0), -40.0);' },
            { name: 'leap years', ex: true, code: 'assert!(is_leap(2024));\nassert!(!is_leap(2023));' },
            { name: 'century rules', code: 'assert!(is_leap(2000));\nassert!(!is_leap(1900));' },
            { name: 'sign of a number', ex: true, code: 'assert_eq!((sign(-7), sign(0), sign(42)), (-1, 0, 1));' },
            { name: 'extremes', code: 'assert_eq!((sign(i64::MIN), sign(i64::MAX)), (-1, 1));' },
          ],
          lint: [
            { re: '\\breturn\\b', when: 'present', note: 'Every one of these is a single expression. «return» is for leaving a function early; the final expression is the normal way to return.' },
          ],
          hints: [
            '«c * 9.0 / 5.0 + 32.0»: floating-point literals need the «.0», because there is no implicit conversion from integers.',
            'The leap rule as one boolean expression: «year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)».',
            '«if n < 0 { -1 } else if n == 0 { 0 } else { 1 }» is one expression. So is «n.signum()».',
          ],
          solution: {
            rust: R`
pub fn to_fahrenheit(c: f64) -> f64 {
    c * 9.0 / 5.0 + 32.0
}

pub fn is_leap(year: u32) -> bool {
    year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
}

pub fn sign(n: i64) -> i64 {
    if n < 0 {
        -1
    } else if n == 0 {
        0
    } else {
        1
    }
}
`,
            why: R`
              - Each body is one expression, and the function returns it.
              - «9.0» rather than «9»: an integer literal is never converted to a float implicitly, so «c * 9» is a type error.
              - «if ... else if ... else» is one expression whose branches all have type «i64».
              - The standard library also has «n.signum()», which does exactly this.
            `,
            talk: 'Each function body is a single expression: arithmetic on f64 literals, a boolean formula, and an if-else-if chain whose branches are all i64.',
          },
          wrong: [
            { name: 'forgets the century rule', rust: 'pub fn to_fahrenheit(c: f64) -> f64 { c * 9.0 / 5.0 + 32.0 }\npub fn is_leap(year: u32) -> bool { year % 4 == 0 }\npub fn sign(n: i64) -> i64 { n.signum() }' },
            { name: 'no zero', rust: 'pub fn to_fahrenheit(c: f64) -> f64 { c * 9.0 / 5.0 + 32.0 }\npub fn is_leap(year: u32) -> bool { year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) }\npub fn sign(n: i64) -> i64 { if n < 0 { -1 } else { 1 } }' },
          ],
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);

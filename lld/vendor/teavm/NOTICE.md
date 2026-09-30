# Third-party: TeaVM in-browser Java compiler

The files in this folder come from the TeaVM playground (https://teavm.org/playground/), which compiles Java to WebAssembly entirely in the browser:

| File | What |
|---|---|
| `compiler.wasm`, `compiler.wasm-runtime.js`, `compiler.wasm-deobfuscator.wasm` | The compiler: OpenJDK's `javac` plus the TeaVM compiler, themselves compiled to WebAssembly |
| `compile-classlib-teavm.bin`, `runtime-classlib-teavm.bin` | The Java class library that programs compile against and link with |
| `orig/` | The unmodified class library files |

**Licenses**

- TeaVM is licensed under the Apache License, Version 2.0: https://github.com/konsoletyper/teavm/blob/master/LICENSE
- `javac` is part of OpenJDK, licensed under the GNU General Public License, version 2, with the Classpath Exception: https://openjdk.org/legal/gplv2+ce.html

**Modifications**

`compile-classlib-teavm.bin` and `runtime-classlib-teavm.bin` in this folder were modified by `tools/patch-teavm.mjs` (the originals are in `orig/`):

- Nested classes in the compile-time stubs (for example `org/teavm/classlib/java/util/TMap$TEntry`) are also exposed under their `java.*` names (`java/util/Map$Entry`), so code that uses `Map.Entry` compiles.
- Added `Integer.sum(int, int)`, `Long.sum / max / min(long, long)` and `Double.sum / max / min(double, double)`, which the stock library lacks (they are commonly used as method references such as `Integer::sum`).
- Added a `value()` element to the `SuppressWarnings` stub.

The compiler files themselves are unmodified.

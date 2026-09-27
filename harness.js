/* LLD Lab harness: turns an exercise spec plus your code into Java files, and reads back what the
 * generated Main printed. Shared by the page, the runner-independent build tools and the self-test.
 *
 * An exercise's tests are small Java method bodies that use your classes and a few assertions that
 * live in Main:
 *   eq(expected, actual, "what")   ok(condition, "what")   no(condition, "what")
 *   near(expected, actual, "what") fails(() -> ..., "what")   say("note shown under the test")
 *   throwsA(IllegalStateException.class, () -> ..., "what")
 * Output protocol, one line each:
 *   @@@S i        test i starts (anything printed until the next marker belongs to test i)
 *   @@@P i ns     passed          @@@F i ns msg   an assertion failed     @@@E i ns err   threw
 *   @@@D          every test ran
 */
(function (root) {
  'use strict';

  const IMPORTS = 'import java.util.*; import java.util.function.*; import java.util.stream.*; import java.util.concurrent.*; import java.util.concurrent.atomic.*; ';
  const JDK_IMPORTS = 'import java.util.concurrent.locks.*; ';

  function javaStr(s) {
    return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
  }
  const importsFor = (ex) => IMPORTS + (ex.jdk ? JDK_IMPORTS : '') + (ex.imports || []).map((i) => `import ${i}; `).join('');

  // Everything lives in one or two files here, so a top-level `public` would demand its own file.
  // Blank it out, keeping every line and column in place.
  function dropTopLevelPublic(src) {
    return String(src).replace(/^public(?=\s+(?:(?:final|abstract|sealed|non-sealed|static|strictfp)\s+)*(?:class|interface|enum|record|@interface)\s)/gm, '      ');
  }
  // The in-browser javac overflows its stack on @SuppressWarnings (a javac-in-Wasm bug).
  function forBrowser(src) {
    return src.replace(/@SuppressWarnings\s*\(\s*(?:"[^"]*"|\{[^}]*\})\s*\)/g, (m) => m.replace(/[^\n]/g, ' '));
  }

  const ASSERTS = `
  static final class Fail extends RuntimeException {
    final String text;
    Fail(String message) { super(message); text = message; }
  }
  static String show(Object o) {
    if (o == null) return "null";
    if (o instanceof String) return "\\"" + o + "\\"";
    if (o instanceof Character) return "'" + o + "'";
    return String.valueOf(o);
  }
  static void eq(Object expected, Object actual, String what) {
    if (!Objects.equals(expected, actual)) throw new Fail(what + ": expected " + show(expected) + " but got " + show(actual));
  }
  static void eq(long expected, long actual, String what) {
    if (expected != actual) throw new Fail(what + ": expected " + expected + " but got " + actual);
  }
  static void eq(double expected, double actual, String what) { near(expected, actual, what); }
  static void near(double expected, double actual, String what) {
    if (Math.abs(expected - actual) > 1e-6 * Math.max(1, Math.abs(expected))) throw new Fail(what + ": expected " + expected + " but got " + actual);
  }
  static void ok(boolean cond, String what) { if (!cond) throw new Fail(what); }
  static void no(boolean cond, String what) { if (cond) throw new Fail(what); }
  static void fails(Runnable r, String what) {
    boolean threw = false;
    try { r.run(); } catch (Fail e) { throw e; } catch (RuntimeException e) { threw = true; }
    if (!threw) throw new Fail(what + ": expected an exception, but nothing was thrown");
  }
  static void throwsA(Class<? extends Throwable> type, Runnable r, String what) {
    try { r.run(); }
    catch (Throwable e) {
      if (type.isInstance(e)) return;
      throw new Fail(what + ": expected " + type.getSimpleName() + " but got " + e);
    }
    throw new Fail(what + ": expected " + type.getSimpleName() + ", but nothing was thrown");
  }
  static void say(String s) { System.out.println(s); }
  static String oneLine(String s) { return s == null ? "" : s.replace("\\r", " ").replace("\\n", " | "); }`;

  function errSource(jdk) {
    return `
  static String err(Throwable e) {
    String m = e.toString();${jdk ? `
    StackTraceElement[] st = e.getStackTrace();
    if (st != null) for (StackTraceElement f : st) {
      String cn = f.getClassName();
      if (f.getLineNumber() > 0 && cn != null && !cn.startsWith("Main") && !cn.startsWith("java")) { m += "  (" + f.getFileName() + ":" + f.getLineNumber() + ")"; break; }
    }` : ''}
    return oneLine(m);
  }`;
  }

  function buildMain(ex, tests, { jdk = true } = {}) {
    const body = tests.map((t, i) => `  static void t${i}() throws Exception {\n${String(t.code).replace(/^\n+|\s+$/g, '').split('\n').map((l) => '    ' + l).join('\n')}\n  }`).join('\n');
    return `${importsFor(ex)}
public class Main {
  public static void main(String[] args) {
    int from = args.length > 0 ? Integer.parseInt(args[0]) : 0;
    for (int t = from; t < ${tests.length}; t++) {
      System.out.println("@@@S " + t);
      long t0 = System.nanoTime();
      try { run(t); System.out.println("@@@P " + t + " " + (System.nanoTime() - t0)); }
      catch (Fail e) { System.out.println("@@@F " + t + " " + (System.nanoTime() - t0) + " " + oneLine(e.text)); }
      catch (Throwable e) { System.out.println("@@@E " + t + " " + (System.nanoTime() - t0) + " " + err(e)); }
    }
    System.out.println("@@@D");
  }
  static void run(int t) throws Exception {
    switch (t) {
${tests.map((_, i) => `      case ${i}: t${i}(); break;`).join('\n')}
      default: break;
    }
  }
${body}
${ex.helpers || ''}
${ASSERTS}
${errSource(jdk)}
}
`;
  }

  const userFileOf = (ex) => ex.file || (ex.kind === 'design' ? 'Design.java' : 'Solution.java');

  /** Files to compile. opts.engine: 'browser' | 'jdk' (default). */
  function buildFiles(ex, userCode, tests, opts = {}) {
    const browser = opts.engine === 'browser';
    const fix = (s) => (browser ? forBrowser(dropTopLevelPublic(s)) : dropTopLevelPublic(s));
    const imp = importsFor(ex);
    const files = {};
    const user = userFileOf(ex);
    files[user] = imp + fix(userCode);                 // same line numbers as the editor
    if (ex.given) files['Given.java'] = imp + fix(ex.given);
    files['Main.java'] = buildMain(ex, tests, { jdk: !browser });
    return { files, mainClass: 'Main', userFile: user, importsLen: imp.length };
  }

  /* ───────────── Reading what Main printed ───────────── */
  function parseRun(text, nTests) {
    const results = new Array(nTests).fill(null);
    const lines = String(text).split(/\r?\n/);
    let cur = -1, done = false;
    const stray = [];
    for (const line of lines) {
      if (line.startsWith('@@@S ')) { cur = +line.slice(5); results[cur] = { status: 'running', stdout: [] }; continue; }
      const m = /^@@@([PFE]) (\d+) (-?\d+) ?(.*)$/.exec(line);
      if (m) {
        const t = +m[2];
        const r = results[t] || (results[t] = { stdout: [] });
        r.ns = +m[3];
        r.status = { P: 'pass', F: 'fail', E: 'error' }[m[1]];
        if (m[4]) r.msg = m[4];
        cur = -1;
        continue;
      }
      if (line === '@@@D') { done = true; cur = -1; continue; }
      if (line.startsWith('@@@ERR ')) continue;
      if (cur >= 0 && results[cur]) { const so = results[cur].stdout; if (so.length < 200) so.push(line); else if (so.length === 200) so.push('… (more output cut)'); }
      else if (line !== '' && stray.length < 200) stray.push(line);
    }
    return { results, done, stray, last: cur };
  }

  // Maps runtime traps from the browser engine onto the Java exception you'd see on a JVM.
  function friendlyTrap(msg) {
    const m = String(msg || '');
    if (/out of bounds/i.test(m)) return 'java.lang.ArrayIndexOutOfBoundsException (an index went past the end of an array or string)';
    if (/null pointer|null reference|dereferencing a null/i.test(m)) return 'java.lang.NullPointerException';
    if (/call stack|too much recursion|stack overflow/i.test(m)) return 'java.lang.StackOverflowError: recursion too deep. Check for a missing base case.';
    if (/divide by zero|division by zero|integer divide/i.test(m)) return 'java.lang.ArithmeticException: / by zero';
    if (/illegal cast|cast failure/i.test(m)) return 'java.lang.ClassCastException';
    if (/unreachable/i.test(m)) return 'runtime error (unreachable code executed, often an exception thrown with no handler)';
    if (/memory|allocation|array too large|invalid array length/i.test(m)) return 'java.lang.OutOfMemoryError (too much memory allocated)';
    return m;
  }

  /* ───────────── Design notes: cheap source checks, shown as hints, never as failures ───────────── */
  function stripComments(src) {
    return String(src)
      .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, '');
  }
  function lint(ex, code) {
    const src = stripComments(code);
    const out = [];
    for (const l of ex.lint || []) {
      const re = new RegExp(l.re, l.flags || 'm');
      const hit = re.test(src);
      if ((l.when || 'present') === 'present' ? hit : !hit) out.push(l.note);
    }
    return out;
  }

  const api = { IMPORTS, JDK_IMPORTS, importsFor, buildFiles, buildMain, parseRun, friendlyTrap, lint, stripComments, userFileOf, dropTopLevelPublic, forBrowser, javaStr };
  root.LLDHarness = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

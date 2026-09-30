/* DSA Lab test harness — shared by the page, the local JDK runner and the build tools.
 *
 * Given a problem (its Java signature and tests) and a Solution source, it writes the Java files
 * to compile: Solution.java (yours), Main.java (runs every test and prints one marker line per
 * test), __H.java (a small JSON reader, converters, serializer and seeded input generators) and,
 * when the problem needs them, ListNode.java / TreeNode.java. It also parses what Main printed
 * and compares outputs.
 *
 * Output protocol (one line each, interleaved with anything your code prints):
 *   @@@S <t>                     test t started
 *   @@@R <t> <nanos> <json>      test t returned (json is the serialized result)
 *   @@@E <t> <nanos> <error>     test t threw
 *   @@@D                         all tests finished
 */
(function (root) {
  'use strict';

  const IMPORTS = 'import java.util.*; import java.util.function.*; import java.util.stream.*; ';
  const DIGEST_OVER = 4096;          // outputs longer than this are printed as "#<fnv64>:<length>"

  /* ───────────── Java string literals ───────────── */
  function javaStr(s) {
    let out = '"';
    for (const ch of String(s)) {
      const c = ch.codePointAt(0);
      if (ch === '"') out += '\\"';
      else if (ch === '\\') out += '\\\\';
      else if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else if (c < 0x20) out += '\\' + c.toString(8).padStart(3, '0');
      else if (c > 0x7e) {
        for (const unit of ch.split('')) out += '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0');
      } else out += ch;
    }
    return out + '"';
  }
  // Long JSON inputs are split so no single class-file constant goes over 64 KB.
  function javaText(s) {
    s = String(s);
    if (s.length <= 16000) return javaStr(s);
    const parts = [];
    for (let i = 0; i < s.length; i += 16000) parts.push(javaStr(s.slice(i, i + 16000)));
    return '__J.cat(' + parts.join(',\n      ') + ')';
  }
  function javaChar(c) {
    if (c === "'") return "'\\''";
    if (c === '\\') return "'\\\\'";
    const s = javaStr(c); return "'" + s.slice(1, -1) + "'";
  }

  /* ───────────── Types ───────────── */
  // Java type → converter name in __C (for JSON values)
  const CONV = {
    'int[]': 'ia', 'long[]': 'la', 'double[]': 'da', 'boolean[]': 'ba', 'char[]': 'ca', 'String[]': 'sa',
    'int[][]': 'iaa', 'char[][]': 'caa', 'String[][]': 'saa', 'long[][]': 'laa', 'double[][]': 'daa', 'boolean[][]': 'baa',
    'List<Integer>': 'li', 'List<Long>': 'll', 'List<String>': 'ls', 'List<Double>': 'ld', 'List<Boolean>': 'lb', 'List<Character>': 'lc',
    'List<List<Integer>>': 'lli', 'List<List<String>>': 'lls', 'List<int[]>': 'lia', 'List<List<Character>>': 'llc',
    'ListNode': '__CL.ln', 'TreeNode': '__CT.tn', 'ListNode[]': '__CL.lna',
    'Integer': 'boxI', 'Long': 'boxL', 'Object': 'obj',
  };
  const usesList = (t) => /\bListNode\b/.test(t);
  const usesTree = (t) => /\bTreeNode\b/.test(t);

  function literal(type, v) {
    if (v && typeof v === 'object' && !Array.isArray(v) && v.$gen) return genCall(type, v);
    switch (type) {
      case 'int': return String(v | 0) === String(v) ? String(v) : `(int) ${v}`;
      case 'long': return `${v}L`;
      case 'double': case 'float': return Number.isInteger(v) ? `${v}.0` : String(v);
      case 'boolean': return v ? 'true' : 'false';
      case 'char': return javaChar(String(v));
      case 'String': return v === null ? 'null' : javaStr(v);
    }
    const c = CONV[type];
    if (!c) throw new Error('Unsupported type ' + type);
    return `${c.includes('.') ? c : '__C.' + c}(__J.parse(${javaText(JSON.stringify(v))}))`;
  }
  function genCall(type, g) {
    const args = (g.args || []).map((a) => (typeof a === 'string' ? javaStr(a) : Number.isInteger(a) && Math.abs(a) > 2147483647 ? a + 'L' : String(a)));
    const call = `__G.${g.$gen}(${args.join(', ')})`;
    return type === 'char[]' && (g.$gen === 'str' || g.$gen === 'repeatStr') ? call + '.toCharArray()' : call;
  }

  /* ───────────── Helper sources ───────────── */
  function helperSource({ list, tree, jdk = true }) {
    return `import java.util.*;

final class __J {
  private final String s; private int p;
  private __J(String s) { this.s = s; }
  static Object parse(String s) { return new __J(s).val(); }
  static String cat(String... parts) { StringBuilder b = new StringBuilder(); for (String x : parts) b.append(x); return b.toString(); }
  private void ws() { while (p < s.length() && s.charAt(p) <= ' ') p++; }
  private Object val() {
    ws();
    char c = s.charAt(p);
    if (c == '[') {
      p++; ArrayList<Object> a = new ArrayList<>(); ws();
      if (s.charAt(p) == ']') { p++; return a; }
      while (true) { a.add(val()); ws(); char d = s.charAt(p++); if (d == ']') return a; }
    }
    if (c == '"') return str();
    if (c == 't') { p += 4; return Boolean.TRUE; }
    if (c == 'f') { p += 5; return Boolean.FALSE; }
    if (c == 'n') { p += 4; return null; }
    int st = p++;
    while (p < s.length() && "+-0123456789.eE".indexOf(s.charAt(p)) >= 0) p++;
    String t = s.substring(st, p);
    if (t.indexOf('.') >= 0 || t.indexOf('e') >= 0 || t.indexOf('E') >= 0) return Double.parseDouble(t);
    return Long.parseLong(t);
  }
  private String str() {
    p++; StringBuilder b = new StringBuilder();
    while (true) {
      char c = s.charAt(p++);
      if (c == '"') return b.toString();
      if (c != '\\\\') { b.append(c); continue; }
      char e = s.charAt(p++);
      switch (e) {
        case 'n': b.append('\\n'); break;
        case 't': b.append('\\t'); break;
        case 'r': b.append('\\r'); break;
        case 'b': b.append('\\b'); break;
        case 'f': b.append('\\f'); break;
        case 'u': b.append((char) Integer.parseInt(s.substring(p, p + 4), 16)); p += 4; break;
        default: b.append(e);
      }
    }
  }
}

final class __C {
  static List<Object> L(Object o) { return (List<Object>) o; }
  static int i(Object o) { return ((Number) o).intValue(); }
  static long l(Object o) { return ((Number) o).longValue(); }
  static double d(Object o) { return ((Number) o).doubleValue(); }
  static boolean b(Object o) { return (Boolean) o; }
  static char c(Object o) { return ((String) o).charAt(0); }
  static String s(Object o) { return (String) o; }
  static Integer boxI(Object o) { return o == null ? null : i(o); }
  static Long boxL(Object o) { return o == null ? null : l(o); }
  static Object obj(Object o) { return o; }
  static int[] ia(Object o) { List<Object> a = L(o); int[] r = new int[a.size()]; for (int k = 0; k < r.length; k++) r[k] = i(a.get(k)); return r; }
  static long[] la(Object o) { List<Object> a = L(o); long[] r = new long[a.size()]; for (int k = 0; k < r.length; k++) r[k] = l(a.get(k)); return r; }
  static double[] da(Object o) { List<Object> a = L(o); double[] r = new double[a.size()]; for (int k = 0; k < r.length; k++) r[k] = d(a.get(k)); return r; }
  static boolean[] ba(Object o) { List<Object> a = L(o); boolean[] r = new boolean[a.size()]; for (int k = 0; k < r.length; k++) r[k] = b(a.get(k)); return r; }
  static char[] ca(Object o) {
    if (o instanceof String) return ((String) o).toCharArray();
    List<Object> a = L(o); char[] r = new char[a.size()]; for (int k = 0; k < r.length; k++) r[k] = c(a.get(k)); return r;
  }
  static String[] sa(Object o) { List<Object> a = L(o); String[] r = new String[a.size()]; for (int k = 0; k < r.length; k++) r[k] = s(a.get(k)); return r; }
  static int[][] iaa(Object o) { List<Object> a = L(o); int[][] r = new int[a.size()][]; for (int k = 0; k < r.length; k++) r[k] = ia(a.get(k)); return r; }
  static long[][] laa(Object o) { List<Object> a = L(o); long[][] r = new long[a.size()][]; for (int k = 0; k < r.length; k++) r[k] = la(a.get(k)); return r; }
  static double[][] daa(Object o) { List<Object> a = L(o); double[][] r = new double[a.size()][]; for (int k = 0; k < r.length; k++) r[k] = da(a.get(k)); return r; }
  static boolean[][] baa(Object o) { List<Object> a = L(o); boolean[][] r = new boolean[a.size()][]; for (int k = 0; k < r.length; k++) r[k] = ba(a.get(k)); return r; }
  static char[][] caa(Object o) { List<Object> a = L(o); char[][] r = new char[a.size()][]; for (int k = 0; k < r.length; k++) r[k] = ca(a.get(k)); return r; }
  static String[][] saa(Object o) { List<Object> a = L(o); String[][] r = new String[a.size()][]; for (int k = 0; k < r.length; k++) r[k] = sa(a.get(k)); return r; }
  static List<Integer> li(Object o) { List<Integer> r = new ArrayList<>(); for (Object x : L(o)) r.add(x == null ? null : i(x)); return r; }
  static List<Long> ll(Object o) { List<Long> r = new ArrayList<>(); for (Object x : L(o)) r.add(l(x)); return r; }
  static List<Double> ld(Object o) { List<Double> r = new ArrayList<>(); for (Object x : L(o)) r.add(d(x)); return r; }
  static List<Boolean> lb(Object o) { List<Boolean> r = new ArrayList<>(); for (Object x : L(o)) r.add(b(x)); return r; }
  static List<Character> lc(Object o) { List<Character> r = new ArrayList<>(); for (Object x : L(o)) r.add(c(x)); return r; }
  static List<String> ls(Object o) { List<String> r = new ArrayList<>(); for (Object x : L(o)) r.add(s(x)); return r; }
  static List<List<Integer>> lli(Object o) { List<List<Integer>> r = new ArrayList<>(); for (Object x : L(o)) r.add(li(x)); return r; }
  static List<List<String>> lls(Object o) { List<List<String>> r = new ArrayList<>(); for (Object x : L(o)) r.add(ls(x)); return r; }
  static List<List<Character>> llc(Object o) { List<List<Character>> r = new ArrayList<>(); for (Object x : L(o)) r.add(lc(x)); return r; }
  static List<int[]> lia(Object o) { List<int[]> r = new ArrayList<>(); for (Object x : L(o)) r.add(ia(x)); return r; }
}
${list ? `
final class __CL {
  static ListNode ln(Object o) {
    ListNode d = new ListNode(0), t = d;
    for (Object x : __C.L(o)) { t.next = new ListNode(__C.i(x)); t = t.next; }
    return d.next;
  }
  static ListNode[] lna(Object o) { List<Object> a = __C.L(o); ListNode[] r = new ListNode[a.size()]; for (int k = 0; k < r.length; k++) r[k] = ln(a.get(k)); return r; }
  // Joins the tail to the node at index pos (pos < 0: no cycle).
  static void cycle(ListNode head, int pos) {
    if (head == null || pos < 0) return;
    ListNode tail = head, at = null; int k = 0;
    for (ListNode n = head; n != null; n = n.next, k++) { if (k == pos) at = n; tail = n; }
    tail.next = at;
  }
  static ListNode nth(ListNode head, int k) { while (k-- > 0 && head != null) head = head.next; return head; }
  // Position of target in the list starting at head (-1 if absent); safe on cyclic lists.
  static int indexOf(ListNode head, ListNode target) { if (target == null) return -1; int k = 0; for (ListNode n = head; n != null && k < 200000; n = n.next, k++) if (n == target) return k; return -1; }
}
` : ''}${tree ? `
final class __CT {
  static TreeNode tn(Object o) {
    List<Object> a = __C.L(o);
    if (a.isEmpty() || a.get(0) == null) return null;
    TreeNode root = new TreeNode(__C.i(a.get(0)));
    ArrayDeque<TreeNode> q = new ArrayDeque<>(); q.add(root);
    int k = 1;
    while (!q.isEmpty() && k < a.size()) {
      TreeNode n = q.poll();
      if (k < a.size() && a.get(k) != null) { n.left = new TreeNode(__C.i(a.get(k))); q.add(n.left); }
      k++;
      if (k < a.size() && a.get(k) != null) { n.right = new TreeNode(__C.i(a.get(k))); q.add(n.right); }
      k++;
    }
    return root;
  }
  // Finds the node holding value v (problems that take node arguments use distinct values).
  static TreeNode find(TreeNode root, int v) {
    ArrayDeque<TreeNode> st = new ArrayDeque<>();
    if (root != null) st.push(root);
    while (!st.isEmpty()) {
      TreeNode n = st.pop();
      if (n.val == v) return n;
      if (n.right != null) st.push(n.right);
      if (n.left != null) st.push(n.left);
    }
    return null;
  }
}
` : ''}
final class __S {
  static String ser(Object o) { StringBuilder b = new StringBuilder(); w(b, o); return b.toString(); }
  static void w(StringBuilder b, Object o) {
    if (o == null) { b.append("null"); return; }
    if (o instanceof String) { str(b, (String) o); return; }
    if (o instanceof Character) { str(b, String.valueOf(((Character) o).charValue())); return; }
    if (o instanceof Double || o instanceof Float) { dbl(b, ((Number) o).doubleValue()); return; }
    if (o instanceof Number || o instanceof Boolean) { b.append(o.toString()); return; }
    if (o instanceof int[]) { int[] a = (int[]) o; b.append('['); for (int k = 0; k < a.length; k++) { if (k > 0) b.append(','); b.append(a[k]); } b.append(']'); return; }
    if (o instanceof long[]) { long[] a = (long[]) o; b.append('['); for (int k = 0; k < a.length; k++) { if (k > 0) b.append(','); b.append(a[k]); } b.append(']'); return; }
    if (o instanceof double[]) { double[] a = (double[]) o; b.append('['); for (int k = 0; k < a.length; k++) { if (k > 0) b.append(','); dbl(b, a[k]); } b.append(']'); return; }
    if (o instanceof boolean[]) { boolean[] a = (boolean[]) o; b.append('['); for (int k = 0; k < a.length; k++) { if (k > 0) b.append(','); b.append(a[k]); } b.append(']'); return; }
    if (o instanceof char[]) { char[] a = (char[]) o; b.append('['); for (int k = 0; k < a.length; k++) { if (k > 0) b.append(','); str(b, String.valueOf(a[k])); } b.append(']'); return; }
    if (o instanceof Object[]) { Object[] a = (Object[]) o; b.append('['); for (int k = 0; k < a.length; k++) { if (k > 0) b.append(','); w(b, a[k]); } b.append(']'); return; }
    if (o instanceof Collection) { b.append('['); boolean first = true; for (Object x : (Collection<?>) o) { if (!first) b.append(','); first = false; w(b, x); } b.append(']'); return; }${list ? `
    if (o instanceof ListNode) {
      b.append('['); int k = 0;
      for (ListNode n = (ListNode) o; n != null; n = n.next, k++) {
        if (k == 200000) { b.append(",\\"<cycle?>\\""); break; }
        if (k > 0) b.append(','); b.append(n.val);
      }
      b.append(']'); return;
    }` : ''}${tree ? `
    if (o instanceof TreeNode) {
      List<TreeNode> order = new ArrayList<>(); order.add((TreeNode) o);
      for (int k = 0; k < order.size() && order.size() < 400000; k++) {
        TreeNode n = order.get(k);
        if (n != null) { order.add(n.left); order.add(n.right); }
      }
      int end = order.size();
      while (end > 0 && order.get(end - 1) == null) end--;
      b.append('[');
      for (int k = 0; k < end; k++) { if (k > 0) b.append(','); TreeNode n = order.get(k); if (n == null) b.append("null"); else b.append(n.val); }
      b.append(']'); return;
    }` : ''}
    str(b, String.valueOf(o));
  }
  static void dbl(StringBuilder b, double d) {
    if (Double.isNaN(d) || Double.isInfinite(d)) { str(b, String.valueOf(d)); return; }
    if (d == Math.rint(d) && Math.abs(d) < 1e15) { b.append((long) d).append(".0"); return; }
    b.append(d);
  }
  static void str(StringBuilder b, String s) {
    b.append('"');
    for (int k = 0; k < s.length(); k++) {
      char c = s.charAt(k);
      if (c == '"') b.append("\\\\\\"");
      else if (c == '\\\\') b.append("\\\\\\\\");
      else if (c == '\\n') b.append("\\\\n");
      else if (c < 0x20 || c > 0x7e) { String h = Integer.toHexString(c); b.append("\\\\u"); for (int z = h.length(); z < 4; z++) b.append('0'); b.append(h); }
      else b.append(c);
    }
    b.append('"');
  }
  // Puts order-insensitive answers into one canonical order (so large ones can be hashed):
  // deep 1 = sort the outer list, 2 = also sort each inner list, 3 = sort every level.
  static Object canon(Object o, int deep) {
    List<Object> items = asList(o);
    if (items == null) return o;
    List<Object> out = new ArrayList<>();
    for (Object x : items) out.add(deep >= 2 ? canon(x, deep == 3 ? 3 : 1) : x);
    List<String> keys = new ArrayList<>();
    Integer[] idx = new Integer[out.size()];
    for (int k = 0; k < idx.length; k++) { idx[k] = k; keys.add(ser(out.get(k))); }
    Arrays.sort(idx, (a, b) -> keys.get(a).compareTo(keys.get(b)));
    List<Object> sorted = new ArrayList<>();
    for (Integer k : idx) sorted.add(out.get(k));
    return sorted;
  }
  static List<Object> asList(Object o) {
    List<Object> r = new ArrayList<>();
    if (o instanceof Collection) { r.addAll((Collection<?>) o); return r; }
    if (o instanceof Object[]) { r.addAll(Arrays.asList((Object[]) o)); return r; }
    if (o instanceof int[]) { for (int v : (int[]) o) r.add(v); return r; }
    if (o instanceof long[]) { for (long v : (long[]) o) r.add(v); return r; }
    if (o instanceof char[]) { for (char v : (char[]) o) r.add(String.valueOf(v)); return r; }
    return null;
  }
  // Big outputs are compared by length + FNV-1a hash so the page never has to hold them.
  static String fit(String s) {
    if (s.length() <= ${DIGEST_OVER}) return s;
    long h = 0xcbf29ce484222325L;
    for (int k = 0; k < s.length(); k++) { h ^= s.charAt(k); h *= 0x100000001b3L; }
    return "\\"#" + Long.toHexString(h) + ":" + s.length() + "\\"";
  }
  static String err(Throwable e) {
    String m = e.toString();${jdk ? `
    StackTraceElement[] st = e.getStackTrace();
    if (st != null) for (StackTraceElement f : st) {
      String cn = f.getClassName();
      if (f.getLineNumber() > 0 && cn != null && !cn.startsWith("Main") && !cn.startsWith("__") && !cn.startsWith("java")) { m += "  (" + f.getFileName() + ":" + f.getLineNumber() + ")"; break; }
    }` : ''}
    return m.replace('\\n', ' ');
  }
}

// Seeded input generators (SplitMix64) — identical results on every JVM and in the browser.
final class __G {
  private static long x;
  static void seed(long s) { x = s; }
  static long next() { long z = (x += 0x9E3779B97F4A7C15L); z = (z ^ (z >>> 30)) * 0xBF58476D1CE4E5B9L; z = (z ^ (z >>> 27)) * 0x94D049BB133111EBL; return z ^ (z >>> 31); }
  static int rnd(int lo, int hi) { return (int) (lo + Math.floorMod(next(), (long) hi - lo + 1)); }
  static int[] ints(int n, int lo, int hi, long seed) { seed(seed); int[] a = new int[n]; for (int k = 0; k < n; k++) a[k] = rnd(lo, hi); return a; }
  static int[] sorted(int n, int lo, int hi, long seed) { int[] a = ints(n, lo, hi, seed); Arrays.sort(a); return a; }
  static int[] distinctSorted(int n, int lo, int step, long seed) { seed(seed); int[] a = new int[n]; int v = lo; for (int k = 0; k < n; k++) { v += 1 + rnd(0, step - 1); a[k] = v; } return a; }
  static int[] perm(int n, long seed) { seed(seed); int[] a = new int[n]; for (int k = 0; k < n; k++) a[k] = k + 1; for (int k = n - 1; k > 0; k--) { int j = rnd(0, k); int t = a[k]; a[k] = a[j]; a[j] = t; } return a; }
  static int[] rotated(int n, int lo, int step, int shift, long seed) { int[] s = distinctSorted(n, lo, step, seed); int[] a = new int[n]; for (int k = 0; k < n; k++) a[k] = s[(k + shift) % n]; return a; }
  static int[] repeat(int n, int v) { int[] a = new int[n]; Arrays.fill(a, v); return a; }
  // value v (1..m) appears exactly v times, shuffled: every frequency is distinct
  static int[] pyramid(int m, long seed) { seed(seed); int n = m * (m + 1) / 2; int[] a = new int[n]; int k = 0; for (int v = 1; v <= m; v++) for (int c = 0; c < v; c++) a[k++] = v; for (int i = n - 1; i > 0; i--) { int j = rnd(0, i); int t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  static int[] range(int n, int start, int step) { int[] a = new int[n]; for (int k = 0; k < n; k++) a[k] = start + k * step; return a; }
  static long[] longs(int n, long lo, long hi, long seed) { seed(seed); long[] a = new long[n]; for (int k = 0; k < n; k++) a[k] = lo + Math.floorMod(next(), hi - lo + 1); return a; }
  static String str(int n, String alphabet, long seed) { seed(seed); char[] c = new char[n]; for (int k = 0; k < n; k++) c[k] = alphabet.charAt(rnd(0, alphabet.length() - 1)); return new String(c); }
  static String repeatStr(String s, int times) { StringBuilder b = new StringBuilder(); for (int k = 0; k < times; k++) b.append(s); return b.toString(); }
  static String[] words(int n, int minLen, int maxLen, String alphabet, long seed) { seed(seed); String[] w = new String[n]; for (int k = 0; k < n; k++) { int len = rnd(minLen, maxLen); char[] c = new char[len]; for (int z = 0; z < len; z++) c[z] = alphabet.charAt(rnd(0, alphabet.length() - 1)); w[k] = new String(c); } return w; }
  static int[][] matrix(int r, int c, int lo, int hi, long seed) { seed(seed); int[][] m = new int[r][c]; for (int i = 0; i < r; i++) for (int j = 0; j < c; j++) m[i][j] = rnd(lo, hi); return m; }
  static char[][] grid(int r, int c, String cells, int pct, long seed) { seed(seed); char[][] g = new char[r][c]; for (int i = 0; i < r; i++) for (int j = 0; j < c; j++) g[i][j] = rnd(0, 99) < pct ? cells.charAt(1) : cells.charAt(0); return g; }
  static int[][] binGrid(int r, int c, int pctOnes, long seed) { seed(seed); int[][] g = new int[r][c]; for (int i = 0; i < r; i++) for (int j = 0; j < c; j++) g[i][j] = rnd(0, 99) < pctOnes ? 1 : 0; return g; }
  static int[][] intervals(int n, int lo, int hi, int maxLen, long seed) { seed(seed); int[][] a = new int[n][]; for (int k = 0; k < n; k++) { int s = rnd(lo, hi); a[k] = new int[]{s, s + rnd(0, maxLen)}; } return a; }
  static int[][] intervals(int n, int lo, int hi, int minLen, int maxLen, long seed) { seed(seed); int[][] a = new int[n][]; for (int k = 0; k < n; k++) { int s = rnd(lo, hi); a[k] = new int[]{s, s + rnd(minLen, maxLen)}; } return a; }
  // [people, from, to] trips with 0 <= from < to <= maxPos and to - from <= maxLen
  static int[][] trips(int n, int maxPeople, int maxPos, int maxLen, long seed) { seed(seed); int[][] a = new int[n][]; for (int k = 0; k < n; k++) { int f = rnd(0, maxPos - 1); int t = Math.min(maxPos, f + rnd(1, maxLen)); a[k] = new int[]{rnd(1, maxPeople), f, t}; } return a; }
  static int[][] pairs(int n, int lo, int hi, long seed) { seed(seed); int[][] a = new int[n][]; for (int k = 0; k < n; k++) a[k] = new int[]{rnd(lo, hi), rnd(lo, hi)}; return a; }
  // Random edges on nodes [0, n): a spanning tree (if tree=1) plus extra random edges, optional weights in [wlo, whi].
  static int[][] edges(int n, int extra, int tree, int wlo, int whi, long seed) {
    seed(seed); List<int[]> e = new ArrayList<>(); boolean w = whi > 0;
    if (tree == 1) for (int k = 1; k < n; k++) { int p = rnd(0, k - 1); e.add(w ? new int[]{p, k, rnd(wlo, whi)} : new int[]{p, k}); }
    for (int k = 0; k < extra; k++) { int a = rnd(0, n - 1), b = rnd(0, n - 1); if (a == b) continue; e.add(w ? new int[]{a, b, rnd(wlo, whi)} : new int[]{a, b}); }
    return e.toArray(new int[0][]);
  }
  // Random DAG edges a -> b with a < b in a hidden random order (prerequisite pairs [b, a] if flip=1).
  static int[][] dag(int n, int m, int flip, long seed) {
    int[] ord = perm(n, seed); for (int k = 0; k < n; k++) ord[k]--;
    List<int[]> e = new ArrayList<>();
    for (int k = 0; k < m; k++) { int i = rnd(0, n - 1), j = rnd(0, n - 1); if (i == j) continue; int a = ord[Math.min(i, j)], b = ord[Math.max(i, j)]; e.add(flip == 1 ? new int[]{b, a} : new int[]{a, b}); }
    return e.toArray(new int[0][]);
  }${tree ? `
  // A random binary tree with n nodes (values from the generator), built by random insertion.
  static TreeNode tree(int n, int lo, int hi, long seed) {
    seed(seed); if (n == 0) return null;
    TreeNode root = new TreeNode(rnd(lo, hi)); List<TreeNode> nodes = new ArrayList<>(); nodes.add(root);
    while (nodes.size() < n) {
      TreeNode p = nodes.get(rnd(0, nodes.size() - 1));
      if (rnd(0, 1) == 0) { if (p.left == null) { p.left = new TreeNode(rnd(lo, hi)); nodes.add(p.left); } }
      else if (p.right == null) { p.right = new TreeNode(rnd(lo, hi)); nodes.add(p.right); }
    }
    return root;
  }
  static TreeNode bst(int n, long seed) { int[] v = distinctSorted(n, 0, 5, seed); return bstOf(v, 0, n - 1); }
  private static TreeNode bstOf(int[] v, int lo, int hi) { if (lo > hi) return null; int m = (lo + hi) >>> 1; TreeNode t = new TreeNode(v[m]); t.left = bstOf(v, lo, m - 1); t.right = bstOf(v, m + 1, hi); return t; }
  static TreeNode chain(int n, int left) { TreeNode root = null; for (int k = n; k >= 1; k--) { TreeNode t = new TreeNode(k); if (left == 1) t.left = root; else t.right = root; root = t; } return root; }` : ''}${list ? `
  static ListNode list(int n, int lo, int hi, long seed) { int[] a = ints(n, lo, hi, seed); ListNode d = new ListNode(0), t = d; for (int v : a) { t.next = new ListNode(v); t = t.next; } return d.next; }
  static ListNode sortedList(int n, int lo, int hi, long seed) { int[] a = sorted(n, lo, hi, seed); ListNode d = new ListNode(0), t = d; for (int v : a) { t.next = new ListNode(v); t = t.next; } return d.next; }
  static ListNode[] sortedLists(int k, int n, int lo, int hi, long seed) { ListNode[] r = new ListNode[k]; for (int z = 0; z < k; z++) r[z] = sortedList(n, lo, hi, seed + z); return r; }` : ''}
}
`;
  }

  const LIST_NODE = `public class ListNode {
    public int val;
    public ListNode next;
    public ListNode() {}
    public ListNode(int val) { this.val = val; }
    public ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}
`;
  const TREE_NODE = `public class TreeNode {
    public int val;
    public TreeNode left, right;
    public TreeNode() {}
    public TreeNode(int val) { this.val = val; }
    public TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}
`;

  /* ───────────── Main.java ───────────── */
  // problem.fn = { name, params: [[type, name, opts?]], ret }   (opts: { hidden: true } or { node: argIndex })
  // problem.design = { cls, ctor: [[type,name]], methods: { m: { params: [[type,name]], ret } } }
  // problem.prep / problem.post / problem.call: optional Java snippets (a0.. are the args, r the result)
  function mainClassOf(p) { return p.design ? p.design.cls : 'Solution'; }

  function testMethod(p, test, idx, ref) {
    const target = ref ? '__Ref.' : '';
    const name = (ref ? 'r' : 't') + idx;
    const L = [];
    if (p.design) {
      const d = p.design;
      const cls = target + d.cls;
      L.push(`  static String ${name}() {`);
      L.push(`    List<Object> ops = __C.L(__J.parse(${javaText(JSON.stringify(test.ops))}));`);
      L.push(`    List<Object> A = __C.L(__J.parse(${javaText(JSON.stringify(test.args))}));`);
      L.push(`    StringBuilder out = new StringBuilder("[");`);
      L.push(`    ${cls} o = null;`);
      L.push(`    long t0 = System.nanoTime();`);
      L.push(`    for (int k = 0; k < ops.size(); k++) {`);
      L.push(`      List<Object> a = __C.L(A.get(k));`);
      L.push(`      Object r = null;`);
      L.push(`      switch ((String) ops.get(k)) {`);
      const argList = (ps) => ps.map(([t], i) => conv(t, `a.get(${i})`)).join(', ');
      L.push(`        case ${javaStr(d.cls)}: o = new ${cls}(${argList(d.ctor || [])}); break;`);
      for (const [m, spec] of Object.entries(d.methods)) {
        const call = `o.${m}(${argList(spec.params || [])})`;
        L.push(`        case ${javaStr(m)}: ${spec.ret === 'void' ? call + ';' : 'r = ' + call + ';'} break;`);
      }
      L.push(`        default: throw new IllegalArgumentException("unknown operation " + ops.get(k));`);
      L.push(`      }`);
      L.push(`      if (k > 0) out.append(',');`);
      L.push(`      __S.w(out, r);`);
      L.push(`    }`);
      L.push(`    dt = System.nanoTime() - t0;`);
      L.push(`    return out.append(']').toString();`);
      L.push(`  }`);
      return L.join('\n');
    }
    const fn = p.fn;
    L.push(`  static String ${name}() {`);
    fn.params.forEach(([type, , opts], i) => {
      const v = test.args[i];
      if (opts && opts.node != null) L.push(`    ${type} a${i} = __CT.find(a${opts.node}, ${literal('int', v)});`);
      else L.push(`    ${type} a${i} = ${literal(type, v)};`);
    });
    if (p.prep) L.push('    ' + p.prep);
    const args = fn.params.map((x, i) => (x[2] && x[2].hidden ? null : `a${i}`)).filter(Boolean).join(', ');
    // p.classes: the user's class names a custom call mentions (default Solution); the reference copy lives in __Ref
    const call = p.call ? (p.classes || ['Solution']).reduce((c, k) => c.replace(new RegExp('\\b' + k + '\\b', 'g'), target + k), p.call) : `new ${target}Solution().${fn.name}(${args})`;
    L.push(`    long t0 = System.nanoTime();`);
    if (fn.ret === 'void') L.push(`    ${call};`);
    else L.push(`    ${fn.ret} r = ${call};`);
    L.push(`    dt = System.nanoTime() - t0;`);
    const outVar = fn.ret === 'void' ? 'a0' : 'r';
    const outType = fn.ret === 'void' ? fn.params[0][0] : fn.ret;
    const deep = { unordered: 1, 'unordered-deep': 2, 'unordered-all': 3 }[p.compare];
    const wrap = (e) => (deep ? `__S.canon(${e}, ${deep})` : e);
    if (p.post) L.push(`    return __S.ser(${wrap(p.post)});`);
    else if (outType === 'ListNode' || outType === 'TreeNode') L.push(`    return ${outVar} == null ? "[]" : __S.ser(${outVar});`);
    else L.push(`    return __S.ser(${wrap(outVar)});`);
    L.push(`  }`);
    return L.join('\n');
  }
  function conv(type, expr) {
    switch (type) {
      case 'int': return `__C.i(${expr})`;
      case 'long': return `__C.l(${expr})`;
      case 'double': return `__C.d(${expr})`;
      case 'boolean': return `__C.b(${expr})`;
      case 'char': return `__C.c(${expr})`;
      case 'String': return `__C.s(${expr})`;
    }
    const c = CONV[type];
    if (!c) throw new Error('Unsupported type ' + type);
    return `${c.includes('.') ? c : '__C.' + c}(${expr})`;
  }

  function buildMain(p, tests, { withRef = false } = {}) {
    const methods = tests.map((t, i) => testMethod(p, t, i, false));
    if (withRef) methods.push(...tests.map((t, i) => testMethod(p, t, i, true)));
    return `import java.util.*;

public class Main {
  static long dt;
  public static void main(String[] args) {
    int from = args.length > 0 ? Integer.parseInt(args[0]) : 0;
    boolean ref = args.length > 1 && args[1].equals("ref");
    for (int t = from; t < ${tests.length}; t++) {
      System.out.println("@@@S " + t);
      dt = 0;
      String out;
      try { out = ref ? runRef(t) : run(t); }
      catch (Throwable e) { System.out.println("@@@E " + t + " " + dt + " " + __S.err(e)); continue; }
      System.out.println("@@@R " + t + " " + dt + " " + ${p.validate || p.noDigest ? 'out' : '__S.fit(out)'});
    }
    System.out.println("@@@D");
  }
  static String run(int t) {
    switch (t) {
${tests.map((_, i) => `      case ${i}: return t${i}();`).join('\n')}
      default: return null;
    }
  }
  static String runRef(int t) {
${withRef ? `    switch (t) {\n${tests.map((_, i) => `      case ${i}: return r${i}();`).join('\n')}\n      default: return null;\n    }` : '    return null;'}
  }
${methods.join('\n')}
}
`;
  }

  function problemUses(p) {
    const types = [];
    if (p.fn) { types.push(p.fn.ret, ...p.fn.params.map((x) => x[0])); }
    if (p.design) { types.push(...(p.design.ctor || []).map((x) => x[0])); for (const m of Object.values(p.design.methods)) types.push(m.ret, ...(m.params || []).map((x) => x[0])); }
    const all = types.join(' ') + ' ' + (p.uses || []).join(' ');
    return { list: usesList(all), tree: usesTree(all) };
  }

  // Wraps a reference solution so it can sit next to the user's classes: every top-level
  // type becomes a static member of __Ref (so helper classes can't collide).
  function wrapRef(src) {
    const body = src.replace(/^\s*import\s+[\w.*\s]+;\s*$/gm, '')
      .replace(/^(?:public\s+)?(?:final\s+)?(class|interface|enum|record|abstract\s+class)\s/gm, 'static $1 ');
    return 'import java.util.*; import java.util.function.*; import java.util.stream.*;\nfinal class __Ref {\n' + body + '\n}\n';
  }

  // The in-browser javac overflows its stack on @SuppressWarnings (a javac-in-Wasm bug). The
  // annotation never changes behaviour, so blank it out, keeping every line and column in place.
  function forBrowser(src) {
    return src.replace(/@SuppressWarnings\s*\(\s*(?:"[^"]*"|\{[^}]*\})\s*\)/g, (m) => m.replace(/[^\n]/g, ' '));
  }

  /** Files to compile. opts.withRef adds the reference solution (for "expected" on custom tests);
   *  opts.engine: 'browser' | 'jdk' (default). */
  function buildFiles(p, userCode, tests, opts = {}) {
    const uses = problemUses(p);
    const browser = opts.engine === 'browser';
    const fix = browser ? forBrowser : (s) => s;
    const files = {};
    const main = mainClassOf(p);
    files[main + '.java'] = IMPORTS + fix(userCode);         // same line numbers as the editor
    files['Main.java'] = buildMain(p, tests, { withRef: !!opts.withRef });
    files['__H.java'] = helperSource({ ...uses, jdk: !browser });
    if (uses.list) files['ListNode.java'] = LIST_NODE;
    if (uses.tree) files['TreeNode.java'] = TREE_NODE;
    if (opts.withRef) files['__Ref.java'] = fix(wrapRef(p.solution.java));
    return { files, mainClass: 'Main', userFile: main + '.java' };
  }

  /* ───────────── Parsing what Main printed ───────────── */
  function parseRun(text, nTests) {
    const results = new Array(nTests).fill(null);
    const lines = String(text).split(/\r?\n/);
    let cur = -1, done = false;
    const stray = [];                      // stdout printed outside a test
    for (const line of lines) {
      if (line.startsWith('@@@S ')) { cur = +line.slice(5); results[cur] = { status: 'running', stdout: [] }; continue; }
      if (line.startsWith('@@@R ') || line.startsWith('@@@E ')) {
        const m = /^@@@([RE]) (\d+) (-?\d+) ?(.*)$/.exec(line);
        if (m) {
          const t = +m[2];
          const r = results[t] || (results[t] = { stdout: [] });
          r.ns = +m[3];
          if (m[1] === 'R') { r.status = 'ran'; r.out = m[4]; } else { r.status = 'error'; r.error = m[4]; }
          cur = -1;
        }
        continue;
      }
      if (line === '@@@D') { done = true; cur = -1; continue; }
      if (cur >= 0 && results[cur]) { const so = results[cur].stdout; if (so.length < 200) so.push(line); else if (so.length === 200) so.push('… (more output cut)'); }
      else if (line !== '' && stray.length < 200) stray.push(line);
    }
    return { results, done, stray, last: cur };
  }

  /* ───────────── Comparing outputs ───────────── */
  // A JSON reader that keeps numbers as their source text, so long values stay exact.
  function readJson(s) {
    let p = 0;
    const ws = () => { while (p < s.length && /\s/.test(s[p])) p++; };
    function val() {
      ws();
      const c = s[p];
      if (c === '[') {
        p++; const a = []; ws();
        if (s[p] === ']') { p++; return a; }
        for (;;) { a.push(val()); ws(); const d = s[p++]; if (d === ']') return a; if (d !== ',') throw new Error('bad json'); }
      }
      if (c === '"') {
        let out = ''; p++;
        for (;;) {
          const ch = s[p++];
          if (ch === undefined) throw new Error('bad json');
          if (ch === '"') return out;
          if (ch === '\\') {
            const e = s[p++];
            if (e === 'u') { out += String.fromCharCode(parseInt(s.slice(p, p + 4), 16)); p += 4; }
            else out += ({ n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' })[e] || e;
          } else out += ch;
        }
      }
      if (s.startsWith('true', p)) { p += 4; return true; }
      if (s.startsWith('false', p)) { p += 5; return false; }
      if (s.startsWith('null', p)) { p += 4; return null; }
      const m = /^-?[0-9][0-9.eE+-]*/.exec(s.slice(p, p + 40));
      if (!m) throw new Error('bad json at ' + p);
      p += m[0].length;
      return { num: m[0] };
    }
    const v = val(); ws();
    if (p !== s.length) throw new Error('trailing text');
    return v;
  }
  const isNum = (x) => x && typeof x === 'object' && !Array.isArray(x) && 'num' in x;
  function numEq(a, b) {
    const ai = /^-?\d+$/.test(a.num), bi = /^-?\d+$/.test(b.num);
    if (ai && bi) return BigInt(a.num) === BigInt(b.num);
    const x = parseFloat(a.num), y = parseFloat(b.num);
    return Math.abs(x - y) <= 1e-5 * Math.max(1, Math.abs(x), Math.abs(y));
  }
  function deepEq(a, b) {
    if (isNum(a) && isNum(b)) return numEq(a, b);
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEq(x, b[i]));
    return a === b;
  }
  const key = (x) => JSON.stringify(x, (k, v) => (isNum(v) ? (/^-?\d+$/.test(v.num) ? 'n' + BigInt(v.num) : 'f' + (+parseFloat(v.num).toPrecision(9))) : v));
  function sortDeep(x, depth) {
    if (!Array.isArray(x) || depth <= 0) return x;
    return x.map((y) => sortDeep(y, depth - 1)).sort((u, v) => (key(u) < key(v) ? -1 : key(u) > key(v) ? 1 : 0));
  }
  function canon(x, mode) {
    if (mode === 'unordered') return sortDeep(x, 1);
    if (mode === 'unordered-deep') return Array.isArray(x) ? sortDeep(x.map((y) => (Array.isArray(y) ? sortDeep(y, 1) : y)), 1) : x;
    if (mode === 'unordered-all') return sortDeep(x, 99);
    return x;
  }
  // mode: 'exact' | 'unordered' (outer list is a set) | 'unordered-deep' (outer and each inner list) | 'unordered-all'
  // validators: problem-specific checks when many answers are valid ({ args, got, expected } → true / reason string)
  function compare(expected, got, mode = 'exact', ctx = {}) {
    if (got == null) return { ok: false, why: 'no output' };
    if (typeof expected === 'string' && expected.startsWith('"#')) return { ok: expected === got };
    let e, g;
    try { g = readJson(got); } catch (err) { return { ok: false, why: 'unreadable output' }; }
    if (ctx.validate) {
      const v = ctx.validate({ args: ctx.args, got: plain(g), expected: expected == null ? undefined : plain(readJson(expected)) });
      return v === true ? { ok: true } : { ok: false, why: typeof v === 'string' ? v : '' };
    }
    try { e = readJson(expected); } catch (err) { return { ok: false, why: 'bad expected value' }; }
    return { ok: deepEq(canon(e, mode), canon(g, mode)) };
  }
  // Converts readJson output to plain JS values (numbers become Numbers).
  function plain(x) {
    if (isNum(x)) return Number(x.num);
    if (Array.isArray(x)) return x.map(plain);
    return x;
  }

  /* ───────────── Display helpers ───────────── */
  function describeGen(g) {
    const a = g.args || [];
    const num = (n) => (Math.abs(n) >= 1e6 && n % 1e5 === 0 ? `${(n / 1e9 >= 1 || n / 1e9 <= -1) ? n / 1e9 + 'e9' : n / 1e6 + 'e6'}` : String(n));
    switch (g.$gen) {
      case 'ints': return `[${a[0].toLocaleString('en-US')} random ints in ${num(a[1])}..${num(a[2])}]`;
      case 'sorted': return `[${a[0].toLocaleString('en-US')} sorted random ints in ${num(a[1])}..${num(a[2])}]`;
      case 'distinctSorted': return `[${a[0].toLocaleString('en-US')} distinct sorted ints]`;
      case 'perm': return `[a random permutation of 1..${a[0].toLocaleString('en-US')}]`;
      case 'rotated': return `[${a[0].toLocaleString('en-US')} distinct ints, sorted then rotated by ${a[3]}]`;
      case 'repeat': return `[${a[1]} repeated ${a[0].toLocaleString('en-US')} times]`;
      case 'pyramid': return `[${(a[0] * (a[0] + 1) / 2).toLocaleString('en-US')} values: each v in 1..${a[0]} appears v times, shuffled]`;
      case 'range': return `[${a[1]}, ${a[1] + a[2]}, … (${a[0].toLocaleString('en-US')} values, step ${a[2]})]`;
      case 'str': return `"${a[0].toLocaleString('en-US')} random chars from '${a[1]}'"`;
      case 'repeatStr': return `"${a[0]}" repeated ${a[1].toLocaleString('en-US')} times`;
      case 'words': return `[${a[0].toLocaleString('en-US')} random words, length ${a[1]}–${a[2]}]`;
      case 'matrix': return `[${a[0]}×${a[1]} random matrix, values ${num(a[2])}..${num(a[3])}]`;
      case 'grid': return `[${a[0]}×${a[1]} random grid of '${a[2][0]}'/'${a[2][1]}', ${a[3]}% '${a[2][1]}']`;
      case 'binGrid': return `[${a[0]}×${a[1]} random 0/1 grid, ${a[2]}% ones]`;
      case 'intervals': return `[${a[0].toLocaleString('en-US')} random intervals, starts in ${num(a[1])}..${num(a[2])}, length ${a.length === 6 ? a[3] + '–' + a[4] : '0–' + a[3]}]`;
      case 'pairs': return `[${a[0].toLocaleString('en-US')} random pairs]`;
      case 'trips': return `[${a[0].toLocaleString('en-US')} random trips over km 0..${a[2]}]`;
      case 'edges': return `[${(a[0] - 1 + a[1]).toLocaleString('en-US')} random edges on ${a[0].toLocaleString('en-US')} nodes]`;
      case 'dag': return `[${a[1].toLocaleString('en-US')} random acyclic edges on ${a[0].toLocaleString('en-US')} nodes]`;
      case 'tree': return `[random tree with ${a[0].toLocaleString('en-US')} nodes]`;
      case 'bst': return `[balanced BST with ${a[0].toLocaleString('en-US')} nodes]`;
      case 'chain': return `[a ${a[0].toLocaleString('en-US')}-node chain leaning ${a[1] ? 'left' : 'right'}]`;
      case 'list': return `[linked list of ${a[0].toLocaleString('en-US')} random values]`;
      case 'sortedList': return `[sorted linked list of ${a[0].toLocaleString('en-US')} values]`;
      case 'sortedLists': return `[${a[0]} sorted lists × ${a[1].toLocaleString('en-US')} values]`;
      case 'longs': return `[${a[0].toLocaleString('en-US')} random longs]`;
    }
    return `[generated: ${g.$gen}]`;
  }
  function showValue(v, max = 600) {
    if (v && typeof v === 'object' && !Array.isArray(v) && v.$gen) return describeGen(v);
    const s = JSON.stringify(v);
    return s.length > max ? s.slice(0, max) + ' …' : s;
  }
  function showOutput(s, max = 600) {
    if (s == null) return '—';
    if (s.startsWith('"#')) { const m = /^"#([0-9a-f]+):(\d+)"$/.exec(s); return m ? `(large output, ${(+m[2]).toLocaleString('en-US')} chars — compared by hash)` : s; }
    return s.length > max ? s.slice(0, max) + ' …' : s;
  }
  // Maps runtime traps from the browser engine onto the Java exception you'd see on a JVM.
  function friendlyTrap(msg) {
    const m = String(msg || '');
    if (/out of bounds/i.test(m)) return 'java.lang.ArrayIndexOutOfBoundsException (an index went past the end of an array or string)';
    if (/null pointer|null reference|dereferencing a null/i.test(m)) return 'java.lang.NullPointerException';
    if (/call stack|too much recursion|stack overflow/i.test(m)) return 'java.lang.StackOverflowError: recursion too deep. Check for a missing base case. Note: in-browser Java allows only about 5,000 nested calls (a JVM allows far more), so very deep recursion on a valid input can also hit this. Make it iterative, or run it on "Your JDK".';
    if (/divide by zero|division by zero|integer divide/i.test(m)) return 'java.lang.ArithmeticException: / by zero';
    if (/illegal cast|cast failure/i.test(m)) return 'java.lang.ClassCastException';
    if (/unreachable/i.test(m)) return 'runtime error (unreachable code executed — often an exception thrown with no handler)';
    if (/memory|allocation|array too large|invalid array length/i.test(m)) return 'java.lang.OutOfMemoryError (too much memory allocated)';
    return m;
  }

  const api = { IMPORTS, buildFiles, buildMain, helperSource, parseRun, compare, readJson, plain, showValue, showOutput, describeGen, friendlyTrap, wrapRef, problemUses, mainClassOf, javaStr, LIST_NODE, TREE_NODE };
  root.DSAHarness = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

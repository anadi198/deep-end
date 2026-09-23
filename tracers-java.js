/* DSA Lab — tracers for "Java Collections, Under the Hood". */
(function () {
  'use strict';
  const add = window.DSAViz.add;

  // Java's String.hashCode and HashMap's hash spreading, in 32-bit int arithmetic.
  const strHash = (s) => { let h = 0; for (const ch of s) h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0; return h; };
  const keyHash = (k) => (typeof k === 'number' ? k | 0 : strHash(String(k)));
  const spread = (h) => (h ^ (h >>> 16)) | 0;

  /* ───── ArrayList growth ───── */
  add('arrayListGrowth', {
    title: 'ArrayList: size vs capacity', sub: 'When the backing array is full, allocate 1.5× and copy. Copies are rare enough to average O(1).',
    inputs: [{ key: 'n', label: 'adds', type: 'int', def: 23 }, { key: 'cap', label: 'initial capacity', type: 'int', def: 4 }],
    check: ({ n, cap }) => (n < 1 || n > 60 ? 'adds: 1–60' : cap < 1 || cap > 16 ? 'capacity: 1–16' : null),
    code: `
// java.util.ArrayList, simplified
Object[] elementData = new Object[10];   // capacity
int size = 0;

boolean add(E e) {
    if (size == elementData.length)
        grow();                          // full: make room
    elementData[size++] = e;
    return true;
}

void grow() {
    int old = elementData.length;
    int cap = old + (old >> 1);          // 1.5x
    elementData = Arrays.copyOf(elementData, cap);  // O(size) copy
}`,
    run({ n, cap }, t) {
      let arr = Array(cap).fill(null), size = 0, copies = 0, grows = 0;
      const view = (c = {}, note) => [
        { t: 'array', label: `elementData (capacity ${arr.length})`, a: arr.map((x) => (x === null ? '·' : x)), cls: { ...Object.fromEntries(arr.map((x, i) => [i, x === null ? 'dim' : ''])), ...c }, ptr: { size: [size, 'bot', 3] }, cw: 34 },
        { t: 'vars', v: { size, capacity: arr.length, 'element copies so far': copies, 'copies per add': size ? (copies / size).toFixed(2) : 0 } },
      ];
      t.step(2, `A new list starts with room for ${cap}. <code>size</code> counts real elements; the rest of the array is spare capacity.`, view());
      for (let k = 1; k <= n; k++) {
        if (size === arr.length) {
          const old = arr.length, nc = old + (old >> 1) || old + 1;
          t.step(7, `Add #${k}: the array is <b>full</b> (size = capacity = ${old}). We have to grow.`, view({ ...Object.fromEntries(arr.map((_, i) => [i, 'cmp'])) }));
          arr = [...arr, ...Array(nc - old).fill(null)];
          copies += size; grows++;
          t.step(14, `Grow to ${old} + ${old} &gt;&gt; 1 = <b>${nc}</b> and copy all ${size} elements across (O(n) this time).`, view({ ...Object.fromEntries(Array.from({ length: size }, (_, i) => [i, 'blue'])) }));
        }
        arr[size++] = k;
        t.step(8, `Add #${k} goes into slot ${size - 1}: O(1).`, view({ [size - 1]: 'active' }));
      }
      t.step(9, `${n} adds caused ${copies} element copies (${grows} grows), about <b>${(copies / n).toFixed(2)}</b> per add. Each grow copies more, but grows get rarer at the same rate, so the average stays constant: <b>amortized O(1)</b>.`, view());
    },
  });

  /* ───── HashMap buckets ───── */
  add('hashMapInsert', {
    title: 'HashMap: hash → bucket → chain', sub: 'index = (h ^ h>>>16) & (capacity − 1). Past 75% full, the table doubles and entries split.',
    inputs: [{ key: 'keys', label: 'keys to put', type: 'strs', def: ['cat', 'dog', 'owl', 'ant', 'bee', 'yak', 'elk', 'fox', 'gnu', 'emu'] }, { key: 'cap', label: 'initial capacity (power of 2)', type: 'int', def: 4 }],
    check: ({ keys, cap }) => (keys.length > 24 ? 'at most 24 keys' : ![1, 2, 4, 8, 16].includes(cap) ? 'capacity: 1, 2, 4, 8 or 16' : null),
    code: `
// java.util.HashMap.put, simplified
static int hash(Object key) {
    int h = key.hashCode();
    return h ^ (h >>> 16);          // mix high bits into low bits
}

V put(K key, V value) {
    int h = hash(key);
    int i = (table.length - 1) & h; // == h mod capacity (capacity is a power of 2)
    for (Node e = table[i]; e != null; e = e.next)
        if (e.hash == h && e.key.equals(key)) {
            V old = e.value; e.value = value; return old;   // replace
        }
    table[i] = append(table[i], new Node(h, key, value));
    if (++size > threshold)         // threshold = capacity * 0.75
        resize();                   // double; each chain splits into i and i + oldCap
    return null;
}`,
    run({ keys, cap }, t) {
      let table = Array.from({ length: cap }, () => []);
      let size = 0;
      const thr = () => Math.floor(table.length * 0.75);
      const view = (hl = {}, info) => {
        const w = Math.max(1, ...table.map((c) => c.length));
        const g = table.map((chain) => [...chain.map((e) => e.key), ...Array(w - chain.length).fill('')]);
        const cls = {};
        for (const [k, c] of Object.entries(hl)) cls[k] = c;
        table.forEach((chain, i) => chain.forEach((_, j) => { if (!cls[i + ',' + j]) cls[i + ',' + j] = 'blue'; }));
        return [
          { t: 'grid', label: `table[${table.length}] (each row is a bucket; its chain runs left → right)`, g, rh: table.map((_, i) => i), cls, w: 54, h: 30 },
          { t: 'vars', v: { size, capacity: table.length, 'threshold (0.75 × cap)': thr(), ...(info || {}) } },
        ];
      };
      t.step(7, `An empty table with ${cap} buckets. Each bucket holds a linked chain of entries.`, view());
      for (const key of keys) {
        const hc = keyHash(key), h = spread(hc), i = h & (table.length - 1);
        const bits = { t: 'bits', label: 'index computation (low 8 bits)', rows: [
          { label: 'hash', v: h & 255, w: 8, dec: `${h}` },
          { label: 'cap − 1', v: table.length - 1, w: 8, dec: table.length - 1 },
          { label: 'index = &', v: i, w: 8, dec: i },
        ] };
        t.step(9, `put("${key}"): hashCode = ${hc}, spread = ${h}. index = spread &amp; ${table.length - 1} = <b>${i}</b>.`, [bits, ...view({ ...Object.fromEntries(table[i].map((_, j) => [i + ',' + j, 'cmp'])) }, { key, hashCode: hc, index: i })]);
        const found = table[i].findIndex((e) => e.key === key);
        if (found >= 0) {
          t.step(12, `"${key}" is already in bucket ${i}: equal hash and equals() is true, so the value is replaced and size is unchanged.`, view({ [i + ',' + found]: 'ok' }, { key, index: i }));
          continue;
        }
        if (table[i].length) t.step(11, `Bucket ${i} already holds ${table[i].map((e) => `"${e.key}"`).join(', ')}. That's a <b>collision</b>. Walk the chain comparing hash, then equals()…`, view({ ...Object.fromEntries(table[i].map((_, j) => [i + ',' + j, 'cmp'])) }, { key, index: i }));
        table[i].push({ key, h });
        size++;
        t.step(14, `Append "${key}" to bucket ${i}. size = ${size}.`, view({ [i + ',' + (table[i].length - 1)]: 'active' }, { key, index: i }));
        if (size > thr()) {
          const oldCap = table.length;
          t.step(15, `size ${size} &gt; threshold ${thr()} → <b>resize</b> to ${oldCap * 2} buckets.`, view({}, { key }));
          const nt = Array.from({ length: oldCap * 2 }, () => []);
          const moved = {};
          table.forEach((chain) => chain.forEach((e) => {
            const ni = (e.h & oldCap) ? (e.h & (oldCap - 1)) + oldCap : e.h & (oldCap - 1);
            nt[ni].push(e); if (ni >= oldCap) moved[ni + ',' + (nt[ni].length - 1)] = 'active';
          }));
          table = nt;
          t.step(16, `No rehashing needed: each entry either stays at index i or moves to <b>i + ${oldCap}</b>, depending on one more bit of its hash (<code>hash &amp; ${oldCap}</code>). Highlighted entries moved.`, view(moved));
        }
      }
      const longest = Math.max(...table.map((c) => c.length));
      t.step(0, `Done: ${size} entries in ${table.length} buckets, longest chain ${longest}. With a good hashCode, chains stay short and get/put are O(1) on average. Java 8+ turns a chain of 8+ into a red-black tree once the table has at least 64 buckets, so the worst case is O(log n).`, view());
    },
  });

  /* ───── Red-black tree insert (TreeMap) ───── */
  add('rbInsert', {
    title: 'TreeMap: red-black tree insertion', sub: 'Insert as in a BST, colour it red, then recolour and rotate until no red node has a red child.',
    inputs: [{ key: 'keys', label: 'keys', type: 'ints', def: [10, 20, 30, 15, 25, 5, 1, 12, 13] }],
    check: ({ keys }) => (keys.length > 20 ? 'at most 20 keys' : new Set(keys).size !== keys.length ? 'keys must be distinct (TreeMap would just replace the value)' : null),
    code: `
// java.util.TreeMap.put + fixAfterInsertion, simplified
put(key):
    walk down from the root comparing keys; attach a new RED node
    fixAfterInsertion(x)

fixAfterInsertion(x):
    while (x != root && parent(x).color == RED) {
        if (uncle(x).color == RED) {           // case 1: recolour
            parent = BLACK; uncle = BLACK; grandparent = RED;
            x = grandparent;
        } else {
            if (x is an "inner" child)           // case 2: rotate parent
                x = parent; rotate(x) away from grandparent;
            parent = BLACK; grandparent = RED;  // case 3: rotate grandparent
            rotate(grandparent) the other way;
        }
    }
    root.color = BLACK;`,
    run({ keys }, t) {
      const N = {}; let root = null, id = 0;
      const node = (v) => { const k = 'n' + id++; N[k] = { v, l: null, r: null, p: null, red: true }; return k; };
      const view = (hl = {}, ptr = {}) => {
        const nodes = {}; const cls = {};
        for (const [k, n] of Object.entries(N)) { nodes[k] = { v: n.v, l: n.l, r: n.r }; cls[k] = n.red ? 'red' : 'blk'; }
        for (const [k, c] of Object.entries(hl)) cls[k] = cls[k] + ' ' + c;
        return [{ t: 'tree', label: 'red-black tree', root, nodes, cls, ptr }];
      };
      const rotL = (x) => { const y = N[x].r; N[x].r = N[y].l; if (N[y].l) N[N[y].l].p = x; N[y].p = N[x].p; if (!N[x].p) root = y; else if (N[N[x].p].l === x) N[N[x].p].l = y; else N[N[x].p].r = y; N[y].l = x; N[x].p = y; };
      const rotR = (x) => { const y = N[x].l; N[x].l = N[y].r; if (N[y].r) N[N[y].r].p = x; N[y].p = N[x].p; if (!N[x].p) root = y; else if (N[N[x].p].r === x) N[N[x].p].r = y; else N[N[x].p].l = y; N[y].r = x; N[x].p = y; };
      const red = (k) => !!k && N[k].red;
      t.step(1, 'Red-black rules: every node is red or black, the root is black, <b>no red node has a red child</b>, and every root-to-null path has the same number of black nodes. Together these keep height ≤ 2·log₂(n+1).', view());
      for (const v of keys) {
        const x = node(v);
        if (!root) { root = x; N[x].red = false; t.step(17, `Insert ${v} as the root and colour it black.`, view({ [x]: 'hl' }, { new: x })); continue; }
        let cur = root, par = null; const path = {};
        while (cur) { par = cur; path[cur] = 'cmpo'; cur = v < N[cur].v ? N[cur].l : N[cur].r; }
        N[x].p = par; if (v < N[par].v) N[par].l = x; else N[par].r = x;
        t.step(3, `Insert ${v}: walk down comparing keys (${Object.keys(path).map((k) => N[k].v).join(' → ')}), then attach it as a <b>red</b> leaf.`, view({ ...path, [x]: 'hl' }, { new: x }));
        let z = x;
        while (z !== root && red(N[z].p)) {
          const p = N[z].p, g = N[p].p;
          const left = N[g].l === p;
          const u = left ? N[g].r : N[g].l;
          if (red(u)) {
            t.step(8, `${N[z].v}'s parent ${N[p].v} is red, and so is the uncle ${N[u].v}. <b>Case 1: recolour.</b> Parent and uncle turn black, grandparent ${N[g].v} turns red, then check the grandparent.`, view({ [z]: 'hl' }, { x: z, p, u, g }));
            N[p].red = false; N[u].red = false; N[g].red = true; z = g;
            t.step(10, 'Recoloured. If the grandparent now has a red parent, repeat from there.', view({ [z]: 'hl' }, { x: z }));
          } else {
            let pp = p;
            if (left ? N[pp].r === z : N[pp].l === z) {
              t.step(13, `Uncle is black and ${N[z].v} is an <b>inner</b> child. <b>Case 2:</b> rotate the parent ${N[pp].v} ${left ? 'left' : 'right'} to make it an outer child.`, view({ [z]: 'hl' }, { x: z, p: pp, g }));
              z = pp; if (left) rotL(z); else rotR(z); pp = N[z].p;
              t.step(14, 'Now the red-red pair is in a straight line.', view({ [z]: 'hl' }, { x: z }));
            }
            const gg = N[pp].p;
            t.step(15, `<b>Case 3:</b> colour the parent ${N[pp].v} black and the grandparent ${N[gg].v} red, then rotate the grandparent ${left ? 'right' : 'left'}.`, view({ [pp]: 'hl' }, { p: pp, g: gg }));
            N[pp].red = false; N[gg].red = true; if (left) rotR(gg); else rotL(gg);
            t.step(16, `Balanced: ${N[pp].v} is the new subtree root.`, view({ [pp]: 'ok' }));
          }
        }
        if (N[root].red) { N[root].red = false; t.step(19, 'The root is always coloured black.', view({ [root]: 'hl' })); }
      }
      const h = (k) => (k ? 1 + Math.max(h(N[k].l), h(N[k].r)) : 0);
      t.step(19, `${keys.length} keys, height ${h(root)} (a plain BST fed sorted keys would have height ${keys.length}). get, put, remove, floorKey and ceilingKey are all O(log n).`, view());
    },
  });

  /* ───── ArrayDeque ring buffer ───── */
  add('circularDeque', {
    title: 'ArrayDeque: a circular buffer', sub: 'head and tail move around the array; indices wrap with (i ± 1) mod capacity. Full → double and unwrap.',
    inputs: [{ key: 'ops', label: 'operations', type: 'strs', def: ['addLast 1', 'addLast 2', 'addFirst 0', 'addLast 3', 'pollFirst', 'addLast 4', 'addLast 5', 'addFirst 9', 'addLast 6', 'pollLast', 'pollFirst'] }],
    check: ({ ops }) => (ops.every((o) => /^(addFirst|addLast|offerFirst|offerLast|push) -?\d+$|^(pollFirst|pollLast|pop)$/.test(o)) ? null : 'use "addFirst x", "addLast x", "push x", "pollFirst", "pollLast" or "pop"'),
    code: `
// java.util.ArrayDeque, simplified (head = first element, tail = next free slot)
Object[] es = new Object[8];
int head = 0, tail = 0;

void addLast(E e)  { es[tail] = e; tail = inc(tail); if (head == tail) grow(); }
void addFirst(E e) { head = dec(head); es[head] = e; if (head == tail) grow(); }
E pollFirst() { E e = es[head]; es[head] = null; head = inc(head); return e; }
E pollLast()  { tail = dec(tail); E e = es[tail]; es[tail] = null; return e; }

int inc(int i) { return (i + 1) % es.length; }   // wrap around the end
int dec(int i) { return (i - 1 + es.length) % es.length; }
// push = addFirst, pop = pollFirst: that's why ArrayDeque is Java's stack`,
    run({ ops }, t) {
      let es = Array(4).fill(null), head = 0, tail = 0, count = 0;
      const view = (c = {}, out) => [
        { t: 'array', label: `es (capacity ${es.length})`, a: es.map((x) => (x === null ? '·' : x)), cls: { ...Object.fromEntries(es.map((x, i) => [i, x === null ? 'dim' : ''])), ...c }, ptr: { head: [head, 'top', 1], tail: [tail, 'bot', 2] }, cw: 36 },
        { t: 'stack', label: 'logical order (first → last)', a: Array.from({ length: count }, (_, k) => es[(head + k) % es.length]), kind: 'deque' },
        ...(out !== undefined ? [{ t: 'vars', v: { returned: out } }] : []),
      ];
      const grow = () => {
        const old = es.length; const order = Array.from({ length: count }, (_, k) => es[(head + k) % old]);
        es = [...order, ...Array(old * 2 - count).fill(null)]; head = 0; tail = count;
      };
      t.step(2, 'A small ring (the real default is 16). The deque’s elements live between head and tail, and may wrap past the end of the array.', view());
      for (const op of ops) {
        const [name, arg] = op.split(' ');
        const v = arg !== undefined ? +arg : null;
        if (name === 'addLast' || name === 'offerLast') {
          es[tail] = v; const at = tail; tail = (tail + 1) % es.length; count++;
          t.step(4, `${op}: write at tail (${at}), then tail = (${at} + 1) mod ${es.length} = ${tail}.`, view({ [at]: 'active' }));
        } else if (name === 'addFirst' || name === 'offerFirst' || name === 'push') {
          head = (head - 1 + es.length) % es.length; es[head] = v; count++;
          t.step(5, `${op}: head moves back to ${head}${head === es.length - 1 ? ' (wrapped around to the end)' : ''} and ${v} goes there.`, view({ [head]: 'active' }));
        } else if (name === 'pollFirst' || name === 'pop') {
          if (!count) { t.step(6, `${op} on an empty deque returns null (pop() would throw NoSuchElementException).`, view({}, 'null')); continue; }
          const at = head, e = es[head]; es[head] = null; head = (head + 1) % es.length; count--;
          t.step(6, `${op}: take es[${at}] = ${e}, clear the slot, and head moves forward.`, view({ [at]: 'cmp' }, e));
        } else if (name === 'pollLast') {
          if (!count) { t.step(7, 'pollLast on an empty deque returns null.', view({}, 'null')); continue; }
          tail = (tail - 1 + es.length) % es.length; const e = es[tail]; es[tail] = null; count--;
          t.step(7, `${op}: tail moves back to ${tail}; take ${e}.`, view({ [tail]: 'cmp' }, e));
        }
        if (count && head === tail) {
          t.step(4, `head == tail after an add: the ring is <b>full</b>. Allocate ${es.length * 2} slots and copy the elements in order, unwrapping them.`, view(Object.fromEntries(es.map((_, i) => [i, 'cmp']))));
          grow();
          t.step(4, 'Grown: head = 0 again, and the elements are contiguous. Like ArrayList, this averages out to O(1) per operation.', view(Object.fromEntries(Array.from({ length: count }, (_, i) => [i, 'blue']))));
        }
      }
      t.step(0, 'Every operation at either end is O(1), with no node objects and good cache locality. That’s why ArrayDeque beats both Stack and LinkedList.', view());
    },
  });

  /* ───── Binary heap (PriorityQueue) ───── */
  add('heapOps', {
    title: 'PriorityQueue: a binary heap in an array', sub: 'Children of i are 2i+1 and 2i+2. offer sifts up; poll moves the last element to the root and sifts down.',
    inputs: [{ key: 'ops', label: 'operations', type: 'strs', def: ['offer 5', 'offer 3', 'offer 8', 'offer 1', 'offer 9', 'offer 2', 'poll', 'offer 4', 'poll', 'poll'] }],
    check: ({ ops }) => (ops.every((o) => /^(offer|add) -?\d+$|^poll$/.test(o)) ? null : 'use "offer x" or "poll"'),
    code: `
// java.util.PriorityQueue (a min-heap), simplified
Object[] queue; int size;

boolean offer(E e) {
    int k = size++;
    queue[k] = e;                                    // add at the end…
    while (k > 0) {                                  // …then sift up
        int parent = (k - 1) >>> 1;
        if (cmp(queue[k], queue[parent]) >= 0) break;
        swap(k, parent); k = parent;
    }
    return true;
}

E poll() {
    E min = queue[0];
    queue[0] = queue[--size]; queue[size] = null;    // last element to the root…
    int k = 0;                                       // …then sift down
    while (2 * k + 1 < size) {
        int c = 2 * k + 1;                           // smaller child
        if (c + 1 < size && cmp(queue[c + 1], queue[c]) < 0) c++;
        if (cmp(queue[k], queue[c]) <= 0) break;
        swap(k, c); k = c;
    }
    return min;
}`,
    run({ ops }, t) {
      const q = [];
      const view = (c = {}, extra = {}) => {
        const nodes = {};
        q.forEach((v, i) => { nodes['h' + i] = { v, l: 2 * i + 1 < q.length ? 'h' + (2 * i + 1) : null, r: 2 * i + 2 < q.length ? 'h' + (2 * i + 2) : null }; });
        const tc = {}; for (const [i, k] of Object.entries(c)) tc['h' + i] = k;
        return [
          { t: 'row', items: [
            { t: 'tree', label: 'as a tree', root: q.length ? 'h0' : null, nodes, cls: tc },
            { t: 'array', label: 'the actual storage: queue[]', a: q.slice(), cls: c, cw: 34 },
          ] },
          ...(Object.keys(extra).length ? [{ t: 'vars', v: extra }] : []),
        ];
      };
      t.step(2, 'The heap is a complete binary tree stored level by level in an array, with no pointers. Rule: every parent ≤ its children, so the minimum is at index 0.', view());
      for (const op of ops) {
        if (op.startsWith('offer') || op.startsWith('add')) {
          const v = +op.split(' ')[1];
          q.push(v); let k = q.length - 1;
          t.step(6, `offer(${v}): place it at the end, index ${k}.`, view({ [k]: 'active' }));
          while (k > 0) {
            const p = (k - 1) >> 1;
            if (q[k] >= q[p]) { t.step(9, `${q[k]} ≥ parent ${q[p]}: heap order holds, stop.`, view({ [k]: 'ok', [p]: 'cmp' })); break; }
            t.step(10, `${q[k]} &lt; parent ${q[p]} (index ${p}): swap them, sift up.`, view({ [k]: 'active', [p]: 'cmp' }));
            [q[k], q[p]] = [q[p], q[k]]; k = p;
          }
          if (k === 0) t.step(10, `${q[0]} reached the root.`, view({ 0: 'ok' }));
        } else {
          if (!q.length) { t.step(15, 'poll() on an empty queue returns null.', view({}, { returned: 'null' })); continue; }
          const min = q[0];
          t.step(15, `poll(): the minimum is always queue[0] = <b>${min}</b>.`, view({ 0: 'ok' }, { returned: min }));
          const last = q.pop();
          if (q.length) {
            q[0] = last;
            t.step(16, `Move the last element (${last}) to the root, then sift it down.`, view({ 0: 'active' }, { returned: min }));
            let k = 0;
            while (2 * k + 1 < q.length) {
              let c = 2 * k + 1; if (c + 1 < q.length && q[c + 1] < q[c]) c++;
              if (q[k] <= q[c]) { t.step(22, `${q[k]} ≤ smaller child ${q[c]}: stop.`, view({ [k]: 'ok', [c]: 'cmp' }, { returned: min })); break; }
              t.step(23, `Smaller child is ${q[c]} (index ${c}); ${q[k]} &gt; ${q[c]}, so swap and continue down.`, view({ [k]: 'active', [c]: 'cmp' }, { returned: min }));
              [q[k], q[c]] = [q[c], q[k]]; k = c;
            }
          }
        }
      }
      t.step(0, 'Height is ⌊log₂ n⌋, so offer and poll are O(log n) and peek is O(1). Note that iterating a PriorityQueue (or printing it) shows this array order, which is <b>not</b> sorted.', view());
    },
  });

  /* ───── LinkedHashMap access order (LRU) ───── */
  add('linkedHashMapLru', {
    title: 'LinkedHashMap in access order = an LRU cache', sub: 'A hash table plus a doubly linked list through every entry. get() moves an entry to the end; the eldest sits at the front.',
    inputs: [{ key: 'cap', label: 'capacity', type: 'int', def: 3 }, { key: 'ops', label: 'operations', type: 'strs', def: ['put 1', 'put 2', 'put 3', 'get 1', 'put 4', 'get 2', 'get 3', 'put 5', 'get 1'] }],
    check: ({ ops, cap }) => (cap < 1 || cap > 8 ? 'capacity 1–8' : ops.every((o) => /^(put|get) -?\d+$/.test(o)) ? null : 'use "put k" or "get k"'),
    code: `
class LRUCache extends LinkedHashMap<Integer, Integer> {
    private final int capacity;
    LRUCache(int capacity) {
        super(16, 0.75f, true);            // true = access order
        this.capacity = capacity;
    }
    @Override
    protected boolean removeEldestEntry(Map.Entry<Integer, Integer> eldest) {
        return size() > capacity;          // called after every put
    }
}
// get(k): hash lookup O(1), then unlink + relink at the tail O(1)
// put(k): insert at the tail; if over capacity, drop the head (eldest)`,
    run({ cap, ops }, t) {
      let order = [];
      const view = (hl = {}, info = {}) => [{ t: 'stack', label: 'linked order: eldest (evicted first) → most recently used', a: order.map((k) => `${k}`), cls: hl, kind: 'list' }, { t: 'vars', v: { capacity: cap, size: order.length, ...info } }];
      t.step(4, 'Every entry sits in its hash bucket <i>and</i> in one doubly linked list. With accessOrder = true, the list order is least recently used → most recently used.', view());
      for (const op of ops) {
        const [name, s] = op.split(' '); const k = +s;
        const at = order.indexOf(k);
        if (name === 'get') {
          if (at < 0) { t.step(13, `get(${k}): not present → null. The order is unchanged.`, view({}, { returned: 'null' })); continue; }
          t.step(13, `get(${k}): found via the hash table in O(1)…`, view({ [at]: 'cmp' }, { returned: k }));
          order.splice(at, 1); order.push(k);
          t.step(13, '…then unlinked and relinked at the tail: it’s now the most recently used.', view({ [order.length - 1]: 'active' }, { returned: k }));
        } else {
          if (at >= 0) { order.splice(at, 1); order.push(k); t.step(14, `put(${k}): already present. Update the value and move it to the tail.`, view({ [order.length - 1]: 'active' })); continue; }
          order.push(k);
          t.step(14, `put(${k}): new entry appended at the tail.`, view({ [order.length - 1]: 'active' }));
          if (order.length > cap) {
            t.step(10, `removeEldestEntry: size ${order.length} &gt; capacity ${cap}, so the head (${order[0]}) is evicted.`, view({ 0: 'bad' }));
            order.shift();
            t.step(14, 'Evicted. Every step was O(1).', view());
          }
        }
      }
      t.step(0, 'That’s the whole LRU cache. In an interview, expect to build the same thing by hand: HashMap&lt;key, Node&gt; plus your own doubly linked list (Linked List module).', view());
    },
  });
})();

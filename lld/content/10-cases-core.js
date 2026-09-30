(function (root) {
  const L = root.LLD, J = L.J;
  L.module({
    id: 'cases-core', title: 'Case studies I: the classics', short: 'Classics',
    blurb: 'Parking lot, LRU cache, rate limiter, elevator: the four prompts you are most likely to get. Each is a short walkthrough, then you build the core.',
    intro: J`
      :::remember How to use the case studies
      Read the walkthrough (7 minutes), then build the core. In the interview, the walkthrough *is* your first 15 minutes: requirements, entities, the two or three decisions that matter, and the follow-ups.
      :::
    `,
    items: [
      /* ─────────────── Parking lot ─────────────── */
      {
        lesson: 'case-parking', title: 'Parking lot', mins: 8,
        remember: 'Parking lot: the two decisions that matter are how a spot is chosen (a strategy) and how the fee is computed (another strategy); everything else is bookkeeping.',
        cue: '"Design a parking lot" → vehicle types vs spot sizes, a spot-choosing strategy, a fee strategy, and an atomic allocation',
        body: J`
          ## Pin the requirements (write them down)

          1. Spots are SMALL, MEDIUM or LARGE. Bikes fit anything, cars need MEDIUM or LARGE, trucks need LARGE.
          2. On entry the driver gets a ticket; on exit they pay by the hour.
          3. Out of scope today: multiple floors, payment methods, reservations. (Ask; then say you'll keep the design open for floors.)

          ## Entities

          «ParkingLot» (the service), «Spot» (id, size, occupied), «Ticket» (value: id, plate, spot, entry time), «VehicleType», «SpotSize», and two policies.

          ~~~mermaid
          classDiagram
            direction LR
            class ParkingLot {
              +park(plate, type) Ticket
              +leave(ticketId) long
            }
            class SpotChooser {
              <<interface>>
              +choose(type, freeSpots) Spot
            }
            class FeePolicy {
              <<interface>>
              +fee(type, millis) long
            }
            ParkingLot --> SpotChooser
            ParkingLot --> FeePolicy
            ParkingLot o-- Spot
            ParkingLot ..> Ticket : issues
          ~~~

          @stop

          ## The decisions that matter

          - **Choosing a spot is a Strategy.** "Smallest spot that fits, lowest id" today; "nearest the exit" or "EV spots first" tomorrow.
          - **The fee is a Strategy** too: hourly now, weekend rates or monthly passes later.
          - **Allocation must be atomic.** Two cars at two gates must not get the same spot. A lock around "choose and mark occupied" (or a compare-and-set on the spot) is enough.
          - **Fast lookup.** Keep free spots per size in a sorted set, so "lowest free id of this size" is O(log n), not a scan of every spot.
          - **Time comes from a Clock**, so fee tests do not wait hours.

          ## Follow-ups and where they land

          | Follow-up | Change |
          |---|---|
          | Multiple floors | a «Floor» groups spots; the chooser picks floor then spot |
          | Electric charging spots | a new «SpotSize» (or a spot feature) and a rule in the chooser |
          | Display boards with free counts | Observer: the lot publishes "spot freed / taken" events |
          | Lost ticket | look up the active ticket by plate (you already index plates) |

          :::interview 60-second version
          "A ParkingLot service holds spots, indexed as free sets per size. Parking asks a SpotChooser strategy for the smallest fitting free spot and marks it taken atomically, then issues an immutable Ticket. Leaving computes the fee through a FeePolicy strategy with an injected clock. Floors, EV spots and display boards each plug in without touching the core."
          :::
        `,
      },
      {
        exercise: {
          id: 'parking-lot', title: 'Build the parking lot core', kind: 'build', mins: 18, diff: 'medium', patterns: ['strategy'], blind: true,
          statement: J`
            Build «ParkingLot» and an «HourlyFee» policy.

            - Spots get ids 1, 2, 3... in the order of the list you are given.
            - «park(plate, type)» picks the **smallest size that fits**, and within that size the **lowest free id**. Bikes fit SMALL, MEDIUM or LARGE; cars MEDIUM or LARGE; trucks only LARGE. It returns a ticket with id «"T1"», «"T2"»..., the plate, type, spot id and entry time from the clock.
            - No fitting spot: «IllegalStateException». A plate that is already inside: «IllegalArgumentException».
            - «leave(ticketId)» frees the spot and returns the fee. An unknown or already-used ticket: «IllegalArgumentException».
            - «HourlyFee»: per **started** hour, at least one hour: BIKE 10, CAR 20, TRUCK 50.
            - «freeSpots(size)» counts free spots of that size.
          `,
          given: L.kit.clock + J`
enum VehicleType { BIKE, CAR, TRUCK }
enum SpotSize { SMALL, MEDIUM, LARGE }
record Ticket(String id, String plate, VehicleType type, int spotId, long entryMillis) { }

interface FeePolicy {
    long fee(VehicleType type, long millisParked);
}
`,
          starter: J`
class HourlyFee implements FeePolicy {
    public long fee(VehicleType type, long millisParked) {
        return 0; // TODO
    }
}

class ParkingLot {
    ParkingLot(List<SpotSize> spots, Clock clock, FeePolicy fees) {
    }

    Ticket park(String plate, VehicleType type) {
        throw new IllegalStateException("TODO");
    }

    long leave(String ticketId) {
        return 0; // TODO
    }

    int freeSpots(SpotSize size) {
        return 0; // TODO
    }
}
`,
          tests: [
            { name: 'A car gets the smallest spot that fits', ex: true, code: J`
              ParkingLot lot = new ParkingLot(List.of(SpotSize.SMALL, SpotSize.MEDIUM, SpotSize.LARGE), new FakeClock(0), new HourlyFee());
              Ticket t = lot.park("KA01", VehicleType.CAR);
              eq(2, t.spotId(), "spot");
              eq("T1", t.id(), "ticket id");` },
            { name: 'A bike takes a small spot first', ex: true, code: J`
              ParkingLot lot = new ParkingLot(List.of(SpotSize.LARGE, SpotSize.SMALL), new FakeClock(0), new HourlyFee());
              eq(2, lot.park("B1", VehicleType.BIKE).spotId(), "spot");` },
            { name: 'Leaving charges per started hour', ex: true, code: J`
              FakeClock clock = new FakeClock(0);
              ParkingLot lot = new ParkingLot(List.of(SpotSize.MEDIUM), clock, new HourlyFee());
              Ticket t = lot.park("KA01", VehicleType.CAR);
              clock.advance((2 * 60 + 30) * 60_000L);
              eq(60L, lot.leave(t.id()), "2 h 30 min is 3 started hours at 20");` },
            { name: 'Trucks only fit large spots', code: J`
              ParkingLot lot = new ParkingLot(List.of(SpotSize.SMALL, SpotSize.MEDIUM, SpotSize.LARGE, SpotSize.LARGE), new FakeClock(0), new HourlyFee());
              eq(3, lot.park("T-1", VehicleType.TRUCK).spotId(), "first truck");
              eq(4, lot.park("T-2", VehicleType.TRUCK).spotId(), "second truck");
              throwsA(IllegalStateException.class, () -> lot.park("T-3", VehicleType.TRUCK), "third truck");` },
            { name: 'Bikes overflow into bigger spots', code: J`
              ParkingLot lot = new ParkingLot(List.of(SpotSize.SMALL, SpotSize.MEDIUM), new FakeClock(0), new HourlyFee());
              eq(1, lot.park("B1", VehicleType.BIKE).spotId(), "first bike");
              eq(2, lot.park("B2", VehicleType.BIKE).spotId(), "second bike");` },
            { name: 'Lowest id first within a size', code: J`
              ParkingLot lot = new ParkingLot(List.of(SpotSize.LARGE, SpotSize.MEDIUM, SpotSize.MEDIUM), new FakeClock(0), new HourlyFee());
              eq(2, lot.park("C1", VehicleType.CAR).spotId(), "first car");
              eq(3, lot.park("C2", VehicleType.CAR).spotId(), "second car");
              eq(1, lot.park("C3", VehicleType.CAR).spotId(), "third car overflows to large");` },
            { name: 'The same plate cannot park twice', code: J`
              ParkingLot lot = new ParkingLot(List.of(SpotSize.MEDIUM, SpotSize.MEDIUM), new FakeClock(0), new HourlyFee());
              lot.park("KA01", VehicleType.CAR);
              throwsA(IllegalArgumentException.class, () -> lot.park("KA01", VehicleType.CAR), "second entry");` },
            { name: 'A ticket works once', code: J`
              ParkingLot lot = new ParkingLot(List.of(SpotSize.MEDIUM), new FakeClock(0), new HourlyFee());
              Ticket t = lot.park("KA01", VehicleType.CAR);
              lot.leave(t.id());
              throwsA(IllegalArgumentException.class, () -> lot.leave(t.id()), "second leave");
              throwsA(IllegalArgumentException.class, () -> lot.leave("T99"), "unknown ticket");` },
            { name: 'At least one hour is charged', code: J`
              FakeClock clock = new FakeClock(0);
              ParkingLot lot = new ParkingLot(List.of(SpotSize.SMALL), clock, new HourlyFee());
              Ticket t = lot.park("B1", VehicleType.BIKE);
              clock.advance(5 * 60_000L);
              eq(10L, lot.leave(t.id()), "five minutes on a bike");` },
            { name: 'Freed spots are reused, and counted', code: J`
              ParkingLot lot = new ParkingLot(List.of(SpotSize.MEDIUM, SpotSize.MEDIUM), new FakeClock(0), new HourlyFee());
              Ticket a = lot.park("A", VehicleType.CAR);
              lot.park("B", VehicleType.CAR);
              eq(0, lot.freeSpots(SpotSize.MEDIUM), "full");
              lot.leave(a.id());
              eq(1, lot.freeSpots(SpotSize.MEDIUM), "one free");
              eq(1, lot.park("C", VehicleType.CAR).spotId(), "spot 1 is reused");` },
          ],
          lint: [
            { re: 'System\\.currentTimeMillis|Instant\\.now', note: 'Time must come from the injected «Clock».' },
          ],
          rubric: J`
            - Which sizes a vehicle fits is data (a map or a method on the enum), not «if» chains spread around.
            - Free spots are indexed per size (a sorted set), so parking does not scan every spot.
            - Fees go through the «FeePolicy» interface; the lot never computes money itself.
            - «park» and «leave» keep the plate index, ticket index and free sets consistent (and would be synchronized in a multi-gate lot).
          `,
          hints: [
            'Keep «Map<SpotSize, TreeSet<Integer>> free». For a vehicle, loop over the sizes it fits in ascending order and take «free.get(size).first()» from the first non-empty set.',
            'Index active tickets by id and by plate. «leave» removes both and adds the spot id back to its size\'s free set.',
            'Started hours: «long hours = Math.max(1, (millis + HOUR - 1) / HOUR)».',
          ],
          solution: {
            pattern: 'Strategy for the fee (and, in the real design, for choosing a spot), with free spots indexed per size.',
            java: J`
class HourlyFee implements FeePolicy {
    private static final long HOUR = 60 * 60 * 1000L;

    public long fee(VehicleType type, long millisParked) {
        long hours = Math.max(1, (millisParked + HOUR - 1) / HOUR);
        long rate = switch (type) {
            case BIKE -> 10;
            case CAR -> 20;
            case TRUCK -> 50;
        };
        return hours * rate;
    }
}

class ParkingLot {
    private static final Map<VehicleType, List<SpotSize>> FITS = Map.of(
        VehicleType.BIKE, List.of(SpotSize.SMALL, SpotSize.MEDIUM, SpotSize.LARGE),
        VehicleType.CAR, List.of(SpotSize.MEDIUM, SpotSize.LARGE),
        VehicleType.TRUCK, List.of(SpotSize.LARGE));

    private final Clock clock;
    private final FeePolicy fees;
    private final Map<Integer, SpotSize> sizeOf = new HashMap<>();
    private final Map<SpotSize, TreeSet<Integer>> free = new EnumMap<>(SpotSize.class);
    private final Map<String, Ticket> active = new HashMap<>();
    private final Set<String> platesInside = new HashSet<>();
    private int nextTicket = 1;

    ParkingLot(List<SpotSize> spots, Clock clock, FeePolicy fees) {
        this.clock = clock;
        this.fees = fees;
        for (SpotSize s : SpotSize.values()) free.put(s, new TreeSet<>());
        for (int i = 0; i < spots.size(); i++) {
            sizeOf.put(i + 1, spots.get(i));
            free.get(spots.get(i)).add(i + 1);
        }
    }

    synchronized Ticket park(String plate, VehicleType type) {
        if (platesInside.contains(plate)) throw new IllegalArgumentException(plate + " is already inside");
        for (SpotSize size : FITS.get(type)) {
            TreeSet<Integer> candidates = free.get(size);
            if (candidates.isEmpty()) continue;
            int spot = candidates.pollFirst();
            Ticket t = new Ticket("T" + nextTicket++, plate, type, spot, clock.nowMillis());
            active.put(t.id(), t);
            platesInside.add(plate);
            return t;
        }
        throw new IllegalStateException("no free spot for a " + type);
    }

    synchronized long leave(String ticketId) {
        Ticket t = active.remove(ticketId);
        if (t == null) throw new IllegalArgumentException("unknown or used ticket " + ticketId);
        platesInside.remove(t.plate());
        free.get(sizeOf.get(t.spotId())).add(t.spotId());
        return fees.fee(t.type(), clock.nowMillis() - t.entryMillis());
    }

    synchronized int freeSpots(SpotSize size) {
        return free.get(size).size();
    }
}
`,
            why: J`
              «FITS» makes "which sizes does a car fit" data, listed smallest first, so the allocation loop is the whole spot-choosing rule. A «TreeSet» per size gives the lowest free id in O(log n). In a fuller answer, that loop moves into a «SpotChooser» strategy.
            `,
            talk: 'The lot indexes free spots per size in sorted sets. Parking walks the sizes a vehicle fits from smallest up and takes the lowest free id, atomically, then issues an immutable ticket. Leaving frees the spot and asks a FeePolicy strategy for the price, with time from an injected clock.',
          },
          wrong: [
            { name: 'charges only full hours', java: J`
class HourlyFee implements FeePolicy { public long fee(VehicleType t, long ms) { long h = Math.max(1, ms / 3_600_000L); return h * (t == VehicleType.BIKE ? 10 : t == VehicleType.CAR ? 20 : 50); } }
class ParkingLot {
    private final Clock c; private final FeePolicy f; private final Map<Integer, SpotSize> sz = new HashMap<>(); private final Map<SpotSize, TreeSet<Integer>> free = new EnumMap<>(SpotSize.class); private final Map<String, Ticket> act = new HashMap<>(); private final Set<String> in = new HashSet<>(); private int n = 1;
    ParkingLot(List<SpotSize> s, Clock c, FeePolicy f) { this.c = c; this.f = f; for (SpotSize x : SpotSize.values()) free.put(x, new TreeSet<>()); for (int i = 0; i < s.size(); i++) { sz.put(i + 1, s.get(i)); free.get(s.get(i)).add(i + 1); } }
    Ticket park(String p, VehicleType t) { if (in.contains(p)) throw new IllegalArgumentException(); List<SpotSize> fit = t == VehicleType.BIKE ? List.of(SpotSize.SMALL, SpotSize.MEDIUM, SpotSize.LARGE) : t == VehicleType.CAR ? List.of(SpotSize.MEDIUM, SpotSize.LARGE) : List.of(SpotSize.LARGE); for (SpotSize s : fit) { if (free.get(s).isEmpty()) continue; int id = free.get(s).pollFirst(); Ticket k = new Ticket("T" + n++, p, t, id, c.nowMillis()); act.put(k.id(), k); in.add(p); return k; } throw new IllegalStateException(); }
    long leave(String id) { Ticket k = act.remove(id); if (k == null) throw new IllegalArgumentException(); in.remove(k.plate()); free.get(sz.get(k.spotId())).add(k.spotId()); return f.fee(k.type(), c.nowMillis() - k.entryMillis()); }
    int freeSpots(SpotSize s) { return free.get(s).size(); }
}
` },
          ],
        },
      },

      /* ─────────────── LRU cache ─────────────── */
      {
        lesson: 'case-lru', title: 'LRU cache', mins: 6,
        remember: 'LRU cache: a HashMap for O(1) lookup plus a doubly linked list for O(1) "move to front" and "drop from the back".',
        cue: '"Design an LRU cache" → HashMap from key to list node, doubly linked list ordered by recency, sentinel head and tail',
        body: J`
          ## The whole trick

          Two structures, each doing what it is good at:

          - a **HashMap** from key to node: find anything in O(1);
          - a **doubly linked list** ordered by recency: move a node to the front, or drop the last one, in O(1).

          ~~~seq get("b") in a cache holding a, b, c
          actors: Client, Cache, Map, List
          Client -> Cache: get("b")
          Cache -> Map: node for "b"
          Map --> Cache: node(b)
          Cache -> List: unlink node(b), put it at the front
          note: The list is now b, a, c: most recent first.
          Cache --> Client: value of b
          ~~~

          **Sentinels** (a dummy head and tail node) remove every "is this the first or last node" special case. Mention them: interviewers notice.

          @stop

          ## Java has one built in

          «new LinkedHashMap<>(16, 0.75f, true)» (access order) with «removeEldestEntry» overridden *is* an LRU cache. Say so, then build the real thing: that is what the question is testing.

          ## Follow-ups

          - **Thread safety.** One lock around get/put is the honest answer; the list makes finer locking hard. Caffeine and Guava use a concurrent map plus buffered reorder events.
          - **LFU instead.** A map from frequency to a linked list of keys, plus the minimum frequency. Same "map + lists" idea.
          - **TTL.** Store an expiry per node and check it on read.
        `,
      },
      {
        exercise: {
          id: 'lru-cache', title: 'An LRU cache from scratch', kind: 'build', mins: 15, diff: 'medium', patterns: [], blind: true,
          statement: J`
            Build «LruCache<K, V>» with O(1) «get» and «put». Use a «HashMap» and your own doubly linked list (no «LinkedHashMap»).

            - «new LruCache<>(capacity)»: capacity at least 1, else «IllegalArgumentException».
            - «get(key)»: the value, or empty. A hit makes that key the most recently used.
            - «put(key, value)»: inserts or updates, and makes the key most recently used. If that pushes the cache over capacity, evict the **least** recently used key.
            - «size()», and «keysMostRecentFirst()» for inspecting the order.
          `,
          starter: J`
class LruCache<K, V> {
    LruCache(int capacity) {
    }

    Optional<V> get(K key) {
        return Optional.empty(); // TODO
    }

    void put(K key, V value) {
        // TODO
    }

    int size() {
        return 0; // TODO
    }

    List<K> keysMostRecentFirst() {
        return List.of(); // TODO
    }
}
`,
          tests: [
            { name: 'Evicts the least recently used', ex: true, code: J`
              LruCache<String, Integer> c = new LruCache<>(2);
              c.put("a", 1); c.put("b", 2);
              c.get("a");
              c.put("c", 3);
              eq(Optional.empty(), c.get("b"), "b was least recent");
              eq(Optional.of(1), c.get("a"), "a stays");
              eq(List.of("a", "c"), c.keysMostRecentFirst(), "order");` },
            { name: 'put on an existing key updates and refreshes it', ex: true, code: J`
              LruCache<String, Integer> c = new LruCache<>(2);
              c.put("a", 1); c.put("b", 2);
              c.put("a", 10);
              c.put("c", 3);
              eq(Optional.of(10), c.get("a"), "a updated and kept");
              eq(Optional.empty(), c.get("b"), "b evicted");
              eq(2, c.size(), "size");` },
            { name: 'Capacity must be at least 1', ex: true, code: J`throwsA(IllegalArgumentException.class, () -> new LruCache<String, Integer>(0), "capacity 0");` },
            { name: 'Capacity 1 keeps only the latest', code: J`
              LruCache<Integer, String> c = new LruCache<>(1);
              c.put(1, "one"); c.put(2, "two");
              eq(Optional.empty(), c.get(1), "1 evicted");
              eq(Optional.of("two"), c.get(2), "2 kept");` },
            { name: 'A miss does not change the order', code: J`
              LruCache<String, Integer> c = new LruCache<>(3);
              c.put("a", 1); c.put("b", 2); c.put("c", 3);
              c.get("zzz");
              eq(List.of("c", "b", "a"), c.keysMostRecentFirst(), "order");` },
            { name: 'Order follows every access', code: J`
              LruCache<String, Integer> c = new LruCache<>(3);
              c.put("a", 1); c.put("b", 2); c.put("c", 3);
              c.get("a"); c.get("b");
              eq(List.of("b", "a", "c"), c.keysMostRecentFirst(), "order");
              c.put("d", 4);
              eq(List.of("d", "b", "a"), c.keysMostRecentFirst(), "c evicted");` },
            { name: 'Many operations stay consistent', code: J`
              LruCache<Integer, Integer> c = new LruCache<>(50);
              for (int i = 0; i < 1000; i++) { c.put(i % 70, i); c.get((i * 7) % 70); }
              eq(50, c.size(), "size");
              eq(50, new HashSet<>(c.keysMostRecentFirst()).size(), "distinct keys in the list");` },
          ],
          lint: [
            { re: 'LinkedHashMap', note: '«LinkedHashMap» with access order is the right tool at work, but this exercise is the map + doubly linked list interviewers ask you to write.' },
          ],
          rubric: J`
            - HashMap from key to node, plus a doubly linked list ordered by recency.
            - Sentinel head and tail, so there are no null special cases.
            - get and put are O(1); eviction removes the tail node from both the list and the map.
          `,
          hints: [
            'A private static «Node<K, V>» class with «key», «value», «prev», «next». Keep «head» and «tail» sentinels linked to each other at the start.',
            'Two helpers do all the work: «unlink(node)» and «addFront(node)». A hit is «unlink» then «addFront». Eviction is «tail.prev»: unlink it and remove its key from the map.',
          ],
          solution: {
            pattern: 'HashMap plus a doubly linked list with sentinels.',
            java: J`
class LruCache<K, V> {
    private static final class Node<K, V> {
        K key;
        V value;
        Node<K, V> prev, next;
        Node(K key, V value) { this.key = key; this.value = value; }
    }

    private final int capacity;
    private final Map<K, Node<K, V>> map = new HashMap<>();
    private final Node<K, V> head = new Node<>(null, null), tail = new Node<>(null, null);

    LruCache(int capacity) {
        if (capacity < 1) throw new IllegalArgumentException("capacity must be at least 1");
        this.capacity = capacity;
        head.next = tail;
        tail.prev = head;
    }

    Optional<V> get(K key) {
        Node<K, V> n = map.get(key);
        if (n == null) return Optional.empty();
        unlink(n);
        addFront(n);
        return Optional.of(n.value);
    }

    void put(K key, V value) {
        Node<K, V> n = map.get(key);
        if (n != null) {
            n.value = value;
            unlink(n);
            addFront(n);
            return;
        }
        n = new Node<>(key, value);
        map.put(key, n);
        addFront(n);
        if (map.size() > capacity) {
            Node<K, V> lru = tail.prev;
            unlink(lru);
            map.remove(lru.key);
        }
    }

    int size() {
        return map.size();
    }

    List<K> keysMostRecentFirst() {
        List<K> out = new ArrayList<>();
        for (Node<K, V> n = head.next; n != tail; n = n.next) out.add(n.key);
        return out;
    }

    private void unlink(Node<K, V> n) {
        n.prev.next = n.next;
        n.next.prev = n.prev;
    }

    private void addFront(Node<K, V> n) {
        n.next = head.next;
        n.prev = head;
        head.next.prev = n;
        head.next = n;
    }
}
`,
            talk: 'A HashMap finds the node for a key in O(1), and a doubly linked list with sentinel head and tail keeps recency: a hit moves the node to the front, and eviction drops the node before the tail, from both the list and the map.',
          },
          wrong: [
            { name: 'get does not refresh recency', java: J`
class LruCache<K, V> {
    private final int cap; private final Deque<K> order = new ArrayDeque<>(); private final Map<K, V> m = new HashMap<>();
    LruCache(int cap) { if (cap < 1) throw new IllegalArgumentException(); this.cap = cap; }
    Optional<V> get(K k) { return Optional.ofNullable(m.get(k)); }
    void put(K k, V v) { if (m.containsKey(k)) order.remove(k); order.addFirst(k); m.put(k, v); if (m.size() > cap) m.remove(order.removeLast()); }
    int size() { return m.size(); }
    List<K> keysMostRecentFirst() { return new ArrayList<>(order); }
}
` },
          ],
        },
      },

      /* ─────────────── Rate limiter ─────────────── */
      {
        lesson: 'case-rate-limiter', title: 'Rate limiter', mins: 7,
        remember: 'Rate limiter: pick the algorithm (token bucket for bursts, sliding window for strict counts) behind one RateLimiter interface, keep state per client, and take time from a clock.',
        cue: '"Design a rate limiter" → a RateLimiter interface, token bucket vs sliding window as strategies, per-client state, injected clock',
        body: J`
          ## Clarify first

          Per user or per API key? Limit per second, minute, day? Are short **bursts** fine (10 requests at once, then 1 per second)? Single server or many? (Many servers means the counters live in Redis; the algorithm is the same.)

          ## Two algorithms, one interface

          ~~~java
          interface RateLimiter { boolean allow(String client); }
          ~~~

          | | Token bucket | Sliding window log |
          |---|---|---|
          | Idea | a bucket of tokens refills at a steady rate; each request spends one | keep the timestamps of recent requests; allow if fewer than N in the last window |
          | Bursts | allowed, up to the bucket size | no burst beyond N per window |
          | Memory | two numbers per client | up to N timestamps per client |
          | Used by | most API gateways | strict quotas |

          ~~~seq A bucket of 3 tokens, refilling 1 per second
          actors: Client, TokenBucket
          Client -> TokenBucket: allow() at 0 ms
          TokenBucket --> Client: yes (2 tokens left)
          Client -> TokenBucket: allow() twice more
          TokenBucket --> Client: yes, yes (0 left)
          Client -> TokenBucket: allow() at 10 ms
          TokenBucket --> Client: no
          note: Refill is computed lazily from the elapsed time when a request arrives. No background timer.
          Client -> TokenBucket: allow() at 1010 ms
          TokenBucket --> Client: yes (1 token had refilled)
          ~~~

          @stop

          ## The details that score

          - **Lazy refill.** Store «tokens» and «lastRefill»; on each request add «elapsed x rate». No threads, no timers.
          - **Per-client state** in a «ConcurrentHashMap», updated with «compute» so each client's check-and-spend is atomic.
          - **Injected clock**, so you can test "one second later" instantly.
          - **Response:** HTTP 429 with a «Retry-After» header.

          :::interview 60-second version
          "A RateLimiter interface with token bucket and sliding window implementations as strategies. Per-client state in a concurrent map, updated atomically with compute. Refill is lazy from the elapsed time, and time comes from an injected clock. Across servers, the same state moves into Redis with a Lua script for atomicity."
          :::
        `,
      },
      {
        exercise: {
          id: 'rate-limiter', title: 'Token bucket and sliding window', kind: 'build', mins: 15, diff: 'medium', patterns: ['strategy'], blind: true,
          statement: J`
            Implement two «RateLimiter»s. Each client has its own state.

            **«TokenBucket(clock, capacity, refillPerSecond)»**
            - A new client starts with a full bucket («capacity» tokens).
            - Tokens refill continuously: «elapsedMillis x refillPerSecond / 1000», never above «capacity».
            - «allow» spends one token if at least one whole token is there; otherwise it refuses.

            **«SlidingWindowLog(clock, limit, windowMillis)»**
            - «allow» at time «now» counts this client's **allowed** requests with a timestamp **greater than** «now - windowMillis». If that count is below «limit», it allows and records «now»; otherwise it refuses (refused requests are not recorded).
          `,
          given: L.kit.clock + J`
interface RateLimiter {
    boolean allow(String client);
}
`,
          starter: J`
class TokenBucket implements RateLimiter {
    TokenBucket(Clock clock, int capacity, int refillPerSecond) {
    }

    public boolean allow(String client) {
        return false; // TODO
    }
}

class SlidingWindowLog implements RateLimiter {
    SlidingWindowLog(Clock clock, int limit, long windowMillis) {
    }

    public boolean allow(String client) {
        return false; // TODO
    }
}
`,
          tests: [
            { name: 'A full bucket allows a burst up to its capacity', ex: true, code: J`
              RateLimiter r = new TokenBucket(new FakeClock(0), 3, 1);
              ok(r.allow("u"), "1"); ok(r.allow("u"), "2"); ok(r.allow("u"), "3");
              no(r.allow("u"), "4th in the same instant");` },
            { name: 'Tokens come back over time', ex: true, code: J`
              FakeClock clock = new FakeClock(0);
              RateLimiter r = new TokenBucket(clock, 3, 1);
              for (int i = 0; i < 3; i++) r.allow("u");
              clock.advance(1000);
              ok(r.allow("u"), "one token after a second");
              no(r.allow("u"), "and only one");` },
            { name: 'Sliding window allows at most N per window', ex: true, code: J`
              FakeClock clock = new FakeClock(0);
              RateLimiter r = new SlidingWindowLog(clock, 2, 1000);
              ok(r.allow("u"), "t=0");
              clock.advance(100); ok(r.allow("u"), "t=100");
              clock.advance(100); no(r.allow("u"), "t=200, third in the window");` },
            { name: 'The bucket never holds more than its capacity', code: J`
              FakeClock clock = new FakeClock(0);
              RateLimiter r = new TokenBucket(clock, 3, 1);
              clock.advance(3_600_000);
              int allowed = 0;
              for (int i = 0; i < 10; i++) if (r.allow("u")) allowed++;
              eq(3, allowed, "after an hour idle");` },
            { name: 'Partial refills add up', code: J`
              FakeClock clock = new FakeClock(0);
              RateLimiter r = new TokenBucket(clock, 1, 2);
              ok(r.allow("u"), "spend the only token");
              clock.advance(250); no(r.allow("u"), "half a token is not enough");
              clock.advance(250); ok(r.allow("u"), "two halves make one");` },
            { name: 'Clients are independent', code: J`
              FakeClock clock = new FakeClock(0);
              RateLimiter tb = new TokenBucket(clock, 1, 1), sw = new SlidingWindowLog(clock, 1, 1000);
              ok(tb.allow("a"), "tb a"); ok(tb.allow("b"), "tb b"); no(tb.allow("a"), "tb a again");
              ok(sw.allow("a"), "sw a"); ok(sw.allow("b"), "sw b"); no(sw.allow("a"), "sw a again");` },
            { name: 'Old requests leave the window', code: J`
              FakeClock clock = new FakeClock(0);
              RateLimiter r = new SlidingWindowLog(clock, 2, 1000);
              r.allow("u");
              clock.advance(100); r.allow("u");
              clock.advance(900); ok(r.allow("u"), "t=1000: the t=0 request is out of the window");
              clock.advance(50); no(r.allow("u"), "t=1050: 100 and 1000 are still in");
              clock.advance(50); ok(r.allow("u"), "t=1100: 100 has left");` },
            { name: 'Refused requests do not count', code: J`
              FakeClock clock = new FakeClock(0);
              RateLimiter r = new SlidingWindowLog(clock, 1, 1000);
              ok(r.allow("u"), "t=0");
              clock.advance(500); no(r.allow("u"), "t=500");
              clock.advance(500); ok(r.allow("u"), "t=1000: only t=0 counted, and it has left");` },
          ],
          lint: [
            { re: 'System\\.currentTimeMillis|System\\.nanoTime|Instant\\.now', note: 'Time must come from the injected «Clock».' },
            { re: 'new\\s+Thread|Timer\\b|ScheduledExecutor', note: 'No background refill needed: compute tokens lazily from the elapsed time on each request.' },
          ],
          rubric: J`
            - Both limiters implement «RateLimiter»; callers never know which algorithm runs.
            - Per-client state in a map; the token bucket refills lazily from elapsed time.
            - The sliding window drops old timestamps from the front of a per-client deque.
            - (Bonus) «ConcurrentHashMap.compute» for atomic per-client updates.
          `,
          hints: [
            'Token bucket state per client: «double tokens; long last;». On each call: «tokens = Math.min(capacity, tokens + (now - last) * refillPerSecond / 1000.0); last = now;» then spend if «tokens >= 1».',
            'Sliding window: a «Deque<Long>» per client. Remove from the front while «first <= now - windowMillis», then compare the size with the limit.',
          ],
          solution: {
            pattern: 'Strategy: two interchangeable algorithms behind RateLimiter, with lazily updated per-client state.',
            java: J`
class TokenBucket implements RateLimiter {
    private static final class Bucket {
        double tokens;
        long last;
        Bucket(double tokens, long last) { this.tokens = tokens; this.last = last; }
    }

    private final Clock clock;
    private final int capacity, refillPerSecond;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    TokenBucket(Clock clock, int capacity, int refillPerSecond) {
        this.clock = clock;
        this.capacity = capacity;
        this.refillPerSecond = refillPerSecond;
    }

    public boolean allow(String client) {
        long now = clock.nowMillis();
        boolean[] allowed = { false };
        buckets.compute(client, (k, b) -> {
            if (b == null) b = new Bucket(capacity, now);
            b.tokens = Math.min(capacity, b.tokens + (now - b.last) * refillPerSecond / 1000.0);
            b.last = now;
            if (b.tokens >= 1) { b.tokens -= 1; allowed[0] = true; }
            return b;
        });
        return allowed[0];
    }
}

class SlidingWindowLog implements RateLimiter {
    private final Clock clock;
    private final int limit;
    private final long windowMillis;
    private final Map<String, Deque<Long>> logs = new ConcurrentHashMap<>();

    SlidingWindowLog(Clock clock, int limit, long windowMillis) {
        this.clock = clock;
        this.limit = limit;
        this.windowMillis = windowMillis;
    }

    public boolean allow(String client) {
        long now = clock.nowMillis();
        boolean[] allowed = { false };
        logs.compute(client, (k, log) -> {
            if (log == null) log = new ArrayDeque<>();
            while (!log.isEmpty() && log.peekFirst() <= now - windowMillis) log.pollFirst();
            if (log.size() < limit) { log.addLast(now); allowed[0] = true; }
            return log;
        });
        return allowed[0];
    }
}
`,
            why: J`
              «compute» runs the whole refill-check-spend for one client atomically inside the «ConcurrentHashMap», so concurrent requests from the same client cannot both spend the last token, and different clients never block each other.
            `,
            talk: 'Both algorithms implement one RateLimiter interface. The token bucket refills lazily from the elapsed time on each request; the sliding window keeps a deque of recent allowed timestamps per client. Per-client state is updated atomically with ConcurrentHashMap.compute, and time is injected.',
          },
          wrong: [
            { name: 'window counts refused requests', java: J`
class TokenBucket implements RateLimiter {
    private final Clock c; private final int cap, rate; private final Map<String, double[]> b = new HashMap<>();
    TokenBucket(Clock c, int cap, int rate) { this.c = c; this.cap = cap; this.rate = rate; }
    public boolean allow(String k) { long now = c.nowMillis(); double[] s = b.computeIfAbsent(k, x -> new double[] { cap, now }); s[0] = Math.min(cap, s[0] + (now - s[1]) * rate / 1000.0); s[1] = now; if (s[0] >= 1) { s[0]--; return true; } return false; }
}
class SlidingWindowLog implements RateLimiter {
    private final Clock c; private final int limit; private final long w; private final Map<String, Deque<Long>> logs = new HashMap<>();
    SlidingWindowLog(Clock c, int limit, long w) { this.c = c; this.limit = limit; this.w = w; }
    public boolean allow(String k) { long now = c.nowMillis(); Deque<Long> d = logs.computeIfAbsent(k, x -> new ArrayDeque<>()); while (!d.isEmpty() && d.peekFirst() <= now - w) d.pollFirst(); boolean ok = d.size() < limit; d.addLast(now); return ok; }
}
` },
          ],
        },
      },

      /* ─────────────── Elevator ─────────────── */
      {
        lesson: 'case-elevator', title: 'Elevator', mins: 7,
        remember: 'Elevator: keep going in the current direction while there are requests ahead, then turn around (the LOOK algorithm); keep pending floors in a sorted set.',
        cue: '"Design an elevator" → state (IDLE, UP, DOWN), requests in a sorted set, LOOK scheduling, and a dispatcher strategy for many cars',
        body: J`
          ## Scope it hard

          Elevator questions balloon. Pin down: **one car or many?** Start with one car and a clean scheduling rule; add a dispatcher for many cars as the follow-up.

          ## One car: the LOOK algorithm

          1. Keep requested floors in a «TreeSet».
          2. While moving up, stop at each requested floor on the way; keep going while there is any request **above**.
          3. When nothing is left above, turn around and do the same downward.
          4. With nothing left at all, go IDLE. From IDLE, head toward the nearest request.

          ~~~seq At floor 5, requests 7, 3 and 9 arrive
          actors: Elevator, Requests
          state Elevator: IDLE at 5
          Elevator -> Requests: nearest? 7 and 3 are both 2 away: go UP
          state Elevator: UP
          Elevator -> Elevator: 6, then stop at 7
          Elevator -> Elevator: 8, then stop at 9
          Elevator -> Requests: anything above 9? no, turn around
          state Elevator: DOWN
          Elevator -> Elevator: 8 ... 4, stop at 3
          state Elevator: IDLE at 3
          ~~~

          «TreeSet.higher(floor)» and «lower(floor)» answer "anything ahead?" in O(log n).

          @stop

          ## Design shape

          - «Elevator» holds its floor, direction and pending stops. The direction is a small **state** (IDLE, UP, DOWN), and the rules differ per state.
          - **Many cars:** an «ElevatorDispatcher» picks which car serves a hall call. That choice is a **Strategy**: nearest car, least loaded, or the car already moving toward the caller.
          - **Hall vs car buttons:** a hall call has a direction (up or down); a car button does not. Model them as two request types.
          - **Time:** a «step()» method (move one floor) makes the simulation testable without real time.

          :::interview 60-second version
          "Each car keeps pending floors in a sorted set and runs LOOK: continue in the current direction while requests remain ahead, then reverse; idle cars head to the nearest request. A dispatcher assigns hall calls to cars through a pluggable strategy, and the simulation advances by step() so it is testable."
          :::
        `,
      },
      {
        exercise: {
          id: 'elevator-look', title: 'A LOOK-scheduling elevator', kind: 'build', mins: 15, diff: 'hard', patterns: ['state'], blind: true,
          statement: J`
            Build one elevator car with LOOK scheduling. Floors are 0 to «floors - 1».

            - «request(floor)» adds a stop (a floor outside the building: «IllegalArgumentException»; a duplicate is one stop).
            - «step()» does one unit of work and returns the floor it is on:
              1. If the current floor is requested, **stop** there (serve it) and do nothing else this step.
              2. Otherwise, with no requests, it is IDLE and stays put.
              3. Otherwise pick a direction: if IDLE, head toward the **nearest** request (a tie goes UP); if moving but nothing is left ahead, reverse. Then move one floor, and if that floor is requested, stop there too.
            - After serving, the direction becomes IDLE once no requests remain.
            - «runUntilIdle()» steps until no requests remain and returns the floors where it stopped, in order.
            - «floor()» and «direction()» («"UP"», «"DOWN"», «"IDLE"») report state.
          `,
          starter: J`
class Elevator {
    Elevator(int floors, int startFloor) {
    }

    void request(int floor) {
        // TODO
    }

    int step() {
        return 0; // TODO
    }

    List<Integer> runUntilIdle() {
        return List.of(); // TODO
    }

    int floor() {
        return 0; // TODO
    }

    String direction() {
        return "IDLE"; // TODO
    }
}
`,
          tests: [
            { name: 'Going up, it stops at each requested floor', ex: true, code: J`
              Elevator e = new Elevator(10, 0);
              e.request(3); e.request(1); e.request(5);
              eq(List.of(1, 3, 5), e.runUntilIdle(), "stops");
              eq(5, e.floor(), "floor");
              eq("IDLE", e.direction(), "direction");` },
            { name: 'It finishes a direction before turning', ex: true, code: J`
              Elevator e = new Elevator(10, 5);
              e.request(7); e.request(3); e.request(9);
              eq(List.of(7, 9, 3), e.runUntilIdle(), "7 and 3 tie, so up first");` },
            { name: 'Floors outside the building are rejected', ex: true, code: J`
              Elevator e = new Elevator(10, 0);
              throwsA(IllegalArgumentException.class, () -> e.request(10), "floor 10");
              throwsA(IllegalArgumentException.class, () -> e.request(-1), "floor -1");` },
            { name: 'From idle it heads to the nearest request', code: J`
              Elevator e = new Elevator(10, 5);
              e.request(9); e.request(4);
              eq(List.of(4, 9), e.runUntilIdle(), "4 is nearer");` },
            { name: 'A request at the current floor is served at once', code: J`
              Elevator e = new Elevator(10, 2);
              e.request(2);
              eq(2, e.step(), "stays at 2");
              eq(List.of(), e.runUntilIdle(), "nothing left");` },
            { name: 'Requests that arrive while moving', code: J`
              Elevator e = new Elevator(10, 0);
              e.request(5);
              e.step(); e.step();
              eq(2, e.floor(), "on the way up");
              eq("UP", e.direction(), "direction");
              e.request(1); e.request(4);
              eq(List.of(4, 5, 1), e.runUntilIdle(), "4 is ahead, 1 is behind");` },
            { name: 'Duplicate requests are one stop', code: J`
              Elevator e = new Elevator(10, 0);
              e.request(3); e.request(3);
              eq(List.of(3), e.runUntilIdle(), "stops");` },
            { name: 'Going down works the same way', code: J`
              Elevator e = new Elevator(10, 9);
              e.request(2); e.request(6);
              eq(List.of(6, 2), e.runUntilIdle(), "stops");
              eq("IDLE", e.direction(), "direction");` },
          ],
          rubric: J`
            - Pending floors in a sorted set; "anything ahead?" is «higher»/«lower», not a scan.
            - Direction is explicit state with clear transitions (IDLE, UP, DOWN).
            - «step()» is the single place that moves the car, which makes the simulation testable.
          `,
          hints: [
            'Keep «TreeSet<Integer> stops», «int floor», and a direction (an enum or «int dir» of -1, 0, 1).',
            'Choosing a direction: if idle, compare «stops.ceiling(floor)» and «stops.floor(floor)» distances. If moving up and «stops.higher(floor) == null», switch to down (and vice versa).',
            'Record a stop in a list whenever you serve a floor; «runUntilIdle» loops «while (!stops.isEmpty()) step();» and returns the stops recorded during the loop.',
          ],
          solution: {
            pattern: 'State (IDLE / UP / DOWN) driving the LOOK algorithm over a sorted set.',
            java: J`
class Elevator {
    private enum Dir { UP, DOWN, IDLE }

    private final int floors;
    private final TreeSet<Integer> stops = new TreeSet<>();
    private final List<Integer> served = new ArrayList<>();
    private int floor;
    private Dir dir = Dir.IDLE;

    Elevator(int floors, int startFloor) {
        this.floors = floors;
        this.floor = startFloor;
    }

    void request(int f) {
        if (f < 0 || f >= floors) throw new IllegalArgumentException("no floor " + f);
        stops.add(f);
    }

    int step() {
        if (stops.remove(floor)) {
            serve();
            return floor;
        }
        if (stops.isEmpty()) {
            dir = Dir.IDLE;
            return floor;
        }
        if (dir == Dir.IDLE) {
            Integer up = stops.higher(floor), down = stops.lower(floor);
            if (down == null) dir = Dir.UP;
            else if (up == null) dir = Dir.DOWN;
            else dir = up - floor <= floor - down ? Dir.UP : Dir.DOWN;
        } else if (dir == Dir.UP && stops.higher(floor) == null) dir = Dir.DOWN;
        else if (dir == Dir.DOWN && stops.lower(floor) == null) dir = Dir.UP;
        floor += dir == Dir.UP ? 1 : -1;
        if (stops.remove(floor)) serve();
        return floor;
    }

    private void serve() {
        served.add(floor);
        if (stops.isEmpty()) dir = Dir.IDLE;
    }

    List<Integer> runUntilIdle() {
        int from = served.size();
        while (!stops.isEmpty()) step();
        return new ArrayList<>(served.subList(from, served.size()));
    }

    int floor() {
        return floor;
    }

    String direction() {
        return dir.name();
    }
}
`,
            talk: 'Pending floors live in a TreeSet and the car has an explicit direction state. Each step serves the current floor if requested, otherwise keeps going while higher() or lower() says there is work ahead, reverses when there is not, and idles when the set is empty. From idle it heads to the nearest request.',
          },
          wrong: [
            { name: 'always serves the nearest floor next', java: J`
class Elevator {
    private final int n; private final TreeSet<Integer> s = new TreeSet<>(); private final List<Integer> served = new ArrayList<>(); private int f; private String d = "IDLE";
    Elevator(int n, int start) { this.n = n; f = start; }
    void request(int x) { if (x < 0 || x >= n) throw new IllegalArgumentException(); s.add(x); }
    int step() {
        if (s.remove(f)) { served.add(f); if (s.isEmpty()) d = "IDLE"; return f; }
        if (s.isEmpty()) { d = "IDLE"; return f; }
        Integer up = s.higher(f), down = s.lower(f);
        boolean goUp = down == null || (up != null && up - f <= f - down);
        d = goUp ? "UP" : "DOWN"; f += goUp ? 1 : -1;
        if (s.remove(f)) { served.add(f); if (s.isEmpty()) d = "IDLE"; }
        return f;
    }
    List<Integer> runUntilIdle() { int from = served.size(); while (!s.isEmpty()) step(); return new ArrayList<>(served.subList(from, served.size())); }
    int floor() { return f; }
    String direction() { return d; }
}
` },
          ],
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);

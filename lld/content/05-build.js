(function (root) {
  const L = root.LLD, J = L.J;
  L.module({
    id: 'build', title: 'Build it: Factory, Builder, Singleton', short: 'Build it',
    blurb: 'Control how objects get made: which class, in what steps, and how many.',
    intro: J`
      :::remember The move
      Keep «new ConcreteThing(...)» in **one place**. Callers say what they want; one piece of code knows how to make it.
      :::

      | Pattern | The question it answers | Typical cue |
      |---|---|---|
      | Factory | *Which* class do I create? | a type code in the input |
      | Builder | *How* do I assemble something with many optional parts? | a constructor with 8 parameters |
      | Singleton | *How many* instances exist? | "exactly one registry" |
    `,
    items: [
      /* ─────────────── Factory ─────────────── */
      {
        lesson: 'factory', title: 'Factory: one place decides what to create', mins: 6,
        remember: 'Factory: one place decides which class to create, so callers ask for what they need, not how to build it.',
        cue: 'A type code in the input decides which class to create, or «new SomeImpl()» is copied across callers → Factory',
        body: J`
          ## The smell

          The same «if» ladder, copied into every place that needs a notifier:

          ~~~java
          Notifier n;
          if (channel.equals("EMAIL")) n = new EmailNotifier(smtpConfig);
          else if (channel.equals("SMS")) n = new SmsNotifier(gatewayKey);
          else throw new IllegalArgumentException(channel);
          ~~~

          Add "PUSH" and you hunt down every copy.

          ## The move: put «new» in one place

          ~~~java
          class NotifierFactory {
              private final Map<String, Supplier<Notifier>> makers = new HashMap<>();

              NotifierFactory register(String channel, Supplier<Notifier> maker) {
                  makers.put(channel.toUpperCase(), maker);
                  return this;
              }

              Notifier create(String channel) {
                  Supplier<Notifier> maker = makers.get(channel.toUpperCase());
                  if (maker == null) throw new IllegalArgumentException("unknown channel " + channel);
                  return maker.get();          // a fresh object each time
              }
          }
          ~~~

          A map of «Supplier»s (a *registry*) beats a «switch»: a new channel is one «register» call, and the factory's code never changes.

          ~~~seq Creating a notifier
          actors: OrderService, NotifierFactory, SmsNotifier
          OrderService -> NotifierFactory: create("SMS")
          NotifierFactory -> NotifierFactory: look up the maker for SMS
          NotifierFactory -> SmsNotifier: new SmsNotifier()
          NotifierFactory --> OrderService: a Notifier
          note: OrderService only ever sees the Notifier interface.
          ~~~

          @stop

          ## You use factories every day

          - «List.of(...)», «Optional.of(...)», «Executors.newFixedThreadPool(4)»: static factory methods that hide which class you get.
          - «Integer.valueOf(7)» returns a *cached* object for small numbers. A factory can reuse objects; a constructor never can.
          - Spring's «BeanFactory», and Camel turning «"kafka:orders"» into a Kafka endpoint by its scheme.

          :::note Names you will hear
          **Simple factory** (what you just saw) is what interviewers usually mean. **Factory Method** (GoF) is a variant where a subclass overrides a «createX()» method. **Abstract Factory** makes a whole *family* of matching objects; see the recognise-only lesson.
          :::

          :::interview Say it like this
          "The channel string decides the class, so creation lives in one «NotifierFactory». It's a registry of suppliers, so a new channel is registered, not coded into a switch."
          :::

          @quiz 0
        `,
        quiz: [
          {
            q: 'Why might a factory return «maker.get()» (a new object) instead of keeping one shared instance per channel?',
            options: ['Shared instances are slower', 'Notifiers may hold per-use state (a message count, a connection), and sharing would leak it between callers', 'Java cannot store objects in a map', 'Factories must always create new objects'],
            answer: 1,
            why: 'If the product is stateful, sharing it couples unrelated callers. If it is stateless and expensive, returning a shared one is fine; that is a decision you make, and a factory is the one place to make it.',
          },
        ],
      },
      {
        exercise: {
          id: 'notifier-factory', title: 'A notifier factory you can extend', kind: 'build', mins: 10, diff: 'easy', patterns: ['factory'],
          statement: J`
            Build three notifiers and a factory that creates them by channel name.

            - «EmailNotifier.send(to, msg)» returns «"EMAIL to <to>: <msg>"».
            - «SmsNotifier» returns «"SMS to <to>: <msg>"», but cuts the message to its **first 160 characters**, and throws «IllegalArgumentException» unless «to» starts with «+» (an international number).
            - «PushNotifier» returns «"PUSH to <to>: <msg>"».
            - «NotifierFactory.standard()» knows EMAIL, SMS and PUSH. «create(channel)» ignores upper/lower case, returns a **new** object every time, and throws «IllegalArgumentException» for an unknown channel.
            - «register(channel, maker)» adds a channel (or replaces one) and returns the factory, so calls can chain.
            - «channels()» returns the known channel names in upper case.
          `,
          given: J`
interface Notifier {
    /** Sends a message and returns a line describing what was sent. */
    String send(String to, String message);
}
`,
          starter: J`
class EmailNotifier implements Notifier {
    public String send(String to, String message) {
        return ""; // TODO
    }
}

class SmsNotifier implements Notifier {
    public String send(String to, String message) {
        return ""; // TODO
    }
}

class PushNotifier implements Notifier {
    public String send(String to, String message) {
        return ""; // TODO
    }
}

class NotifierFactory {
    static NotifierFactory standard() {
        return new NotifierFactory(); // TODO: knows EMAIL, SMS, PUSH
    }

    NotifierFactory register(String channel, Supplier<Notifier> maker) {
        return this; // TODO
    }

    Notifier create(String channel) {
        throw new IllegalArgumentException("TODO");
    }

    Set<String> channels() {
        return Set.of(); // TODO
    }
}
`,
          tests: [
            { name: 'EMAIL makes an email notifier', ex: true, code: J`eq("EMAIL to a@x.com: hi", NotifierFactory.standard().create("EMAIL").send("a@x.com", "hi"), "send");` },
            { name: 'SMS makes an SMS notifier', ex: true, code: J`eq("SMS to +9198450: hi", NotifierFactory.standard().create("SMS").send("+9198450", "hi"), "send");` },
            { name: 'An unknown channel is rejected', ex: true, code: J`throwsA(IllegalArgumentException.class, () -> NotifierFactory.standard().create("FAX"), "FAX");` },
            { name: 'Channel names ignore case', code: J`eq("PUSH to dev1: yo", NotifierFactory.standard().create("push").send("dev1", "yo"), "push in lower case");` },
            { name: 'Every create gives a fresh object', code: J`
              NotifierFactory f = NotifierFactory.standard();
              ok(f.create("EMAIL") != f.create("EMAIL"), "two creates must return two objects");` },
            { name: 'SMS keeps only the first 160 characters', code: J`
              String longMsg = "x".repeat(200);
              String sent = NotifierFactory.standard().create("SMS").send("+1555", longMsg);
              eq("SMS to +1555: " + "x".repeat(160), sent, "send");` },
            { name: 'SMS needs an international number', code: J`throwsA(IllegalArgumentException.class, () -> NotifierFactory.standard().create("SMS").send("9845012345", "hi"), "number without +");` },
            { name: 'register adds a channel without editing the factory', code: J`
              Notifier slack = NotifierFactory.standard().register("slack", () -> (to, m) -> "SLACK to " + to + ": " + m).create("SLACK");
              eq("SLACK to #ops: up", slack.send("#ops", "up"), "send");` },
            { name: 'channels() lists the known channels', code: J`eq(Set.of("EMAIL", "SMS", "PUSH"), NotifierFactory.standard().channels(), "channels");` },
          ],
          lint: [
            { re: 'switch\\s*\\(\\s*channel|if\\s*\\(\\s*channel\\s*\\.\\s*equals', note: 'A «switch» or «if» on the channel inside the factory works, but then «register» cannot add a channel. A map of makers handles both.' },
          ],
          rubric: J`
            - All «new» calls for notifiers live in one place (the factory's registrations).
            - A registry («Map<String, Supplier<Notifier>>») lets «register» add channels with no code change.
            - Channel names are normalised once (upper case) on both register and create.
            - Each notifier validates its own input (SMS number format) instead of the factory doing it.
          `,
          hints: [
            'Keep a «Map<String, Supplier<Notifier>>». «standard()» registers «EmailNotifier::new», «SmsNotifier::new» and «PushNotifier::new».',
            'Normalise with «channel.toUpperCase()» in both «register» and «create». «channels()» can return a copy of the map\'s key set.',
            'For SMS: «message.length() > 160 ? message.substring(0, 160) : message».',
          ],
          solution: {
            pattern: 'Factory with a registry: a map from channel name to a supplier that makes a fresh notifier.',
            java: J`
class EmailNotifier implements Notifier {
    public String send(String to, String message) {
        return "EMAIL to " + to + ": " + message;
    }
}

class SmsNotifier implements Notifier {
    private static final int LIMIT = 160;

    public String send(String to, String message) {
        if (!to.startsWith("+")) throw new IllegalArgumentException("SMS needs an international number, got " + to);
        String body = message.length() > LIMIT ? message.substring(0, LIMIT) : message;
        return "SMS to " + to + ": " + body;
    }
}

class PushNotifier implements Notifier {
    public String send(String to, String message) {
        return "PUSH to " + to + ": " + message;
    }
}

class NotifierFactory {
    private final Map<String, Supplier<Notifier>> makers = new HashMap<>();

    static NotifierFactory standard() {
        return new NotifierFactory()
            .register("EMAIL", EmailNotifier::new)
            .register("SMS", SmsNotifier::new)
            .register("PUSH", PushNotifier::new);
    }

    NotifierFactory register(String channel, Supplier<Notifier> maker) {
        makers.put(channel.toUpperCase(), maker);
        return this;
    }

    Notifier create(String channel) {
        Supplier<Notifier> maker = makers.get(channel.toUpperCase());
        if (maker == null) throw new IllegalArgumentException("unknown channel " + channel + ", known: " + makers.keySet());
        return maker.get();
    }

    Set<String> channels() {
        return new HashSet<>(makers.keySet());
    }
}
`,
            followups: J`
              - **"Channels need config (SMTP host, API keys)."** Register lambdas that capture the config: «register("EMAIL", () -> new EmailNotifier(smtp))».
              - **"Send to every channel the user opted into."** Loop over the user's preferences and «create» each: the factory makes that loop trivial.
            `,
            talk: 'A NotifierFactory holds a map from channel name to a supplier, so creation lives in one place and a new channel is just a register call. Each notifier validates its own input.',
          },
          wrong: [
            { name: 'shares one instance per channel', java: J`
class EmailNotifier implements Notifier { public String send(String to, String m) { return "EMAIL to " + to + ": " + m; } }
class SmsNotifier implements Notifier { public String send(String to, String m) { if (!to.startsWith("+")) throw new IllegalArgumentException(); return "SMS to " + to + ": " + (m.length() > 160 ? m.substring(0, 160) : m); } }
class PushNotifier implements Notifier { public String send(String to, String m) { return "PUSH to " + to + ": " + m; } }
class NotifierFactory {
    private final Map<String, Notifier> made = new HashMap<>();
    static NotifierFactory standard() { return new NotifierFactory().register("EMAIL", EmailNotifier::new).register("SMS", SmsNotifier::new).register("PUSH", PushNotifier::new); }
    NotifierFactory register(String c, Supplier<Notifier> s) { made.put(c.toUpperCase(), s.get()); return this; }
    Notifier create(String c) { Notifier n = made.get(c.toUpperCase()); if (n == null) throw new IllegalArgumentException(); return n; }
    Set<String> channels() { return new HashSet<>(made.keySet()); }
}
` },
            { name: 'case-sensitive lookup', java: J`
class EmailNotifier implements Notifier { public String send(String to, String m) { return "EMAIL to " + to + ": " + m; } }
class SmsNotifier implements Notifier { public String send(String to, String m) { if (!to.startsWith("+")) throw new IllegalArgumentException(); return "SMS to " + to + ": " + (m.length() > 160 ? m.substring(0, 160) : m); } }
class PushNotifier implements Notifier { public String send(String to, String m) { return "PUSH to " + to + ": " + m; } }
class NotifierFactory {
    private final Map<String, Supplier<Notifier>> makers = new HashMap<>();
    static NotifierFactory standard() { return new NotifierFactory().register("EMAIL", EmailNotifier::new).register("SMS", SmsNotifier::new).register("PUSH", PushNotifier::new); }
    NotifierFactory register(String c, Supplier<Notifier> s) { makers.put(c, s); return this; }
    Notifier create(String c) { Supplier<Notifier> s = makers.get(c); if (s == null) throw new IllegalArgumentException(); return s.get(); }
    Set<String> channels() { return new HashSet<>(makers.keySet()); }
}
` },
          ],
        },
      },

      /* ─────────────── Builder ─────────────── */
      {
        lesson: 'builder', title: 'Builder: many optional parts, one valid object', mins: 6,
        remember: 'Builder: set the parts you need by name, validate everything once in build(), and get back an immutable object.',
        cue: 'A constructor with many parameters, several of them optional → Builder',
        body: J`
          ## The smell: telescoping constructors

          ~~~java
          new HttpRequest("https://api.x.com", "POST", null, 30, true, false, "{...}");
          ~~~

          What is the fifth argument? Nobody knows without opening the class. And there is a constructor for every combination.

          ## The move

          ~~~java
          HttpRequest req = HttpRequest.newBuilder("https://api.x.com/orders")
              .method("POST")
              .header("Idempotency-Key", key)
              .timeoutSeconds(10)
              .body(json)
              .build();          // validates, then creates an immutable HttpRequest
          ~~~

          The shape in Java:

          ~~~java
          final class HttpRequest {
              private final String url, method;
              private HttpRequest(Builder b) { this.url = b.url; this.method = b.method; }   // only the builder can call this

              static Builder newBuilder(String url) { return new Builder(url); }

              static final class Builder {
                  private final String url;
                  private String method = "GET";              // defaults live here
                  private Builder(String url) { this.url = url; }
                  Builder method(String m) { this.method = m; return this; }
                  HttpRequest build() {
                      // cross-field checks happen once, here
                      return new HttpRequest(this);
                  }
              }
          }
          ~~~

          @stop

          ## Three things interviewers check

          1. **Validation lives in «build()».** Rules that span fields ("a GET cannot have a body") can only be checked when everything is set.
          2. **The result is immutable.** Copy collections on the way in («new LinkedHashMap<>(b.headers)») and hand out read-only views. Otherwise changing the builder later changes an object you already built.
          3. **Defaults are explicit** (method GET, timeout 30 s), so callers only set what differs.

          :::java Records and Lombok
          A «record» is great when every field is required. For many optional fields, pair it with a builder, or use Lombok's «@Builder» at work. In an interview, write it by hand once; it shows you know what the annotation generates.
          :::

          :::interview Say it like this
          "The request has several optional parts and cross-field rules, so I use a builder: named setters, defaults in the builder, validation in «build()», and an immutable result."
          :::

          @quiz 0
        `,
        quiz: [
          {
            q: 'A «Pizza» needs a size, and optionally any number of toppings and a crust type. Where does "a small pizza can have at most 3 toppings" belong?',
            options: ['In the «topping()» setter', 'In «build()»', 'In the «Pizza» getters', 'Nowhere: callers should know'],
            answer: 1,
            why: 'The rule depends on two parts (size and toppings), which can be set in any order. Only «build()» sees the final combination.',
          },
        ],
      },
      {
        exercise: {
          id: 'request-builder', title: 'An immutable HTTP request builder', kind: 'build', mins: 12, diff: 'medium', patterns: ['builder'],
          statement: J`
            Finish «HttpRequest» and its «Builder».

            - «HttpRequest.newBuilder(url)» starts a builder. «build()» rejects a URL that does not start with «http://» or «https://» (IllegalArgumentException).
            - «method(m)»: GET, POST, PUT or DELETE, in any case (store it upper case). Anything else: «IllegalArgumentException». Default: GET.
            - «timeoutSeconds(s)»: 1 to 300, else «IllegalArgumentException». Default: 30.
            - «header(name, value)»: adds a header; the same name again replaces the value. Headers keep insertion order.
            - «body(text)»: only allowed with POST or PUT. A body with GET or DELETE makes «build()» throw «IllegalStateException».
            - The built request is **immutable**: «headers()» cannot be modified, and changing the builder after «build()» does not affect requests already built.
          `,
          starter: J`
final class HttpRequest {
    String method() { return null; } // TODO
    String url() { return null; } // TODO
    Map<String, String> headers() { return null; } // TODO
    int timeoutSeconds() { return 0; } // TODO
    /** null when there is no body. */
    String body() { return null; } // TODO

    static Builder newBuilder(String url) {
        return new Builder();
    }

    static final class Builder {
        Builder method(String method) { return this; } // TODO
        Builder header(String name, String value) { return this; } // TODO
        Builder timeoutSeconds(int seconds) { return this; } // TODO
        Builder body(String body) { return this; } // TODO

        HttpRequest build() {
            return new HttpRequest(); // TODO: validate, then build
        }
    }
}
`,
          tests: [
            { name: 'Defaults: GET with a 30 second timeout', ex: true, code: J`
              HttpRequest r = HttpRequest.newBuilder("https://api.x.com/ping").build();
              eq("GET", r.method(), "method");
              eq(30, r.timeoutSeconds(), "timeout");
              eq(null, r.body(), "body");
              eq("https://api.x.com/ping", r.url(), "url");` },
            { name: 'A POST with headers and a body', ex: true, code: J`
              HttpRequest r = HttpRequest.newBuilder("https://api.x.com/orders").method("POST").header("A", "1").header("B", "2").body("{}").timeoutSeconds(5).build();
              eq("POST", r.method(), "method");
              eq("{}", r.body(), "body");
              eq(5, r.timeoutSeconds(), "timeout");
              eq(List.of("A", "B"), new ArrayList<>(r.headers().keySet()), "header order");` },
            { name: 'A URL without http(s) is rejected', ex: true, code: J`throwsA(IllegalArgumentException.class, () -> HttpRequest.newBuilder("ftp://files").build(), "ftp URL");` },
            { name: 'A body on a GET is rejected at build()', code: J`throwsA(IllegalStateException.class, () -> HttpRequest.newBuilder("https://x.com").body("oops").build(), "GET with a body");` },
            { name: 'Method names are normalised; unknown ones rejected', code: J`
              eq("DELETE", HttpRequest.newBuilder("https://x.com").method("delete").build().method(), "lower case delete");
              throwsA(IllegalArgumentException.class, () -> HttpRequest.newBuilder("https://x.com").method("PATCHY"), "unknown method");` },
            { name: 'Timeout must be 1 to 300 seconds', code: J`
              throwsA(IllegalArgumentException.class, () -> HttpRequest.newBuilder("https://x.com").timeoutSeconds(0), "0 s");
              throwsA(IllegalArgumentException.class, () -> HttpRequest.newBuilder("https://x.com").timeoutSeconds(301), "301 s");` },
            { name: 'The same header name replaces the value', code: J`eq("2", HttpRequest.newBuilder("https://x.com").header("A", "1").header("A", "2").build().headers().get("A"), "header A");` },
            { name: 'headers() cannot be modified', code: J`
              HttpRequest r = HttpRequest.newBuilder("https://x.com").header("A", "1").build();
              throwsA(UnsupportedOperationException.class, () -> r.headers().put("B", "2"), "put on headers()");` },
            { name: 'Changing the builder later does not change a built request', code: J`
              HttpRequest.Builder b = HttpRequest.newBuilder("https://x.com").header("A", "1");
              HttpRequest first = b.build();
              b.header("B", "2");
              eq(1, first.headers().size(), "first request's header count");
              eq(2, b.build().headers().size(), "second request's header count");` },
          ],
          lint: [
            { re: 'return\\s+headers\\s*;', note: '«headers()» returns the map field directly. If that map is the builder\'s, or mutable, callers can change a "finished" request.' },
          ],
          rubric: J`
            - The request's constructor is private and takes the builder; fields are final.
            - Defaults live in the builder; single-field checks can fail early in setters, cross-field checks in «build()».
            - Collections are copied into the request and exposed read-only.
            - The builder can be reused without affecting requests already built.
          `,
          hints: [
            'Give the builder fields with defaults («method = "GET"», «timeout = 30», «headers = new LinkedHashMap<>()»). Give «HttpRequest» a private constructor «HttpRequest(Builder b)» that copies them.',
            'Copy the headers: «this.headers = Collections.unmodifiableMap(new LinkedHashMap<>(b.headers))». That one line gives both immutability and independence from the builder.',
            'In «build()»: check the URL prefix, then «if (body != null && !(method.equals("POST") || method.equals("PUT"))) throw new IllegalStateException(...)».',
          ],
          solution: {
            pattern: 'Builder: defaults and early checks in the builder, cross-field validation in «build()», an immutable product.',
            java: J`
final class HttpRequest {
    private static final Set<String> METHODS = Set.of("GET", "POST", "PUT", "DELETE");

    private final String method;
    private final String url;
    private final Map<String, String> headers;
    private final int timeoutSeconds;
    private final String body;

    private HttpRequest(Builder b) {
        this.method = b.method;
        this.url = b.url;
        this.headers = Collections.unmodifiableMap(new LinkedHashMap<>(b.headers));
        this.timeoutSeconds = b.timeoutSeconds;
        this.body = b.body;
    }

    String method() { return method; }
    String url() { return url; }
    Map<String, String> headers() { return headers; }
    int timeoutSeconds() { return timeoutSeconds; }
    String body() { return body; }

    static Builder newBuilder(String url) {
        return new Builder(url);
    }

    static final class Builder {
        private final String url;
        private String method = "GET";
        private final Map<String, String> headers = new LinkedHashMap<>();
        private int timeoutSeconds = 30;
        private String body;

        private Builder(String url) {
            this.url = url;
        }

        Builder method(String method) {
            String m = method.toUpperCase();
            if (!METHODS.contains(m)) throw new IllegalArgumentException("unsupported method " + method);
            this.method = m;
            return this;
        }

        Builder header(String name, String value) {
            headers.put(name, value);
            return this;
        }

        Builder timeoutSeconds(int seconds) {
            if (seconds < 1 || seconds > 300) throw new IllegalArgumentException("timeout must be 1..300 s, got " + seconds);
            this.timeoutSeconds = seconds;
            return this;
        }

        Builder body(String body) {
            this.body = body;
            return this;
        }

        HttpRequest build() {
            if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) throw new IllegalArgumentException("URL must start with http:// or https://");
            if (body != null && !(method.equals("POST") || method.equals("PUT"))) throw new IllegalStateException(method + " cannot have a body");
            return new HttpRequest(this);
        }
    }
}
`,
            followups: J`
              - **"Add query parameters."** Another builder method and one more copied collection. Nothing else changes.
              - **"Make «toBuilder()»"** to tweak an existing request: a method on «HttpRequest» that pre-fills a new builder from its fields.
            `,
            talk: 'HttpRequest has a private constructor and a nested Builder with defaults. Single-field checks fail fast in the setters, cross-field rules like no body on a GET run in build(), and the headers are copied into an unmodifiable map so built requests never change.',
          },
          wrong: [
            { name: 'shares the builder\'s header map', java: J`
final class HttpRequest {
    private final String method, url, body; private final Map<String, String> headers; private final int timeoutSeconds;
    private HttpRequest(Builder b) { method = b.method; url = b.url; headers = b.headers; timeoutSeconds = b.timeout; body = b.body; }
    String method() { return method; } String url() { return url; } Map<String, String> headers() { return headers; } int timeoutSeconds() { return timeoutSeconds; } String body() { return body; }
    static Builder newBuilder(String url) { return new Builder(url); }
    static final class Builder {
        private final String url; private String method = "GET", body; private final Map<String, String> headers = new LinkedHashMap<>(); private int timeout = 30;
        private Builder(String url) { this.url = url; }
        Builder method(String m) { m = m.toUpperCase(); if (!Set.of("GET", "POST", "PUT", "DELETE").contains(m)) throw new IllegalArgumentException(); method = m; return this; }
        Builder header(String n, String v) { headers.put(n, v); return this; }
        Builder timeoutSeconds(int s) { if (s < 1 || s > 300) throw new IllegalArgumentException(); timeout = s; return this; }
        Builder body(String b) { body = b; return this; }
        HttpRequest build() { if (!(url.startsWith("http://") || url.startsWith("https://"))) throw new IllegalArgumentException(); if (body != null && !(method.equals("POST") || method.equals("PUT"))) throw new IllegalStateException(); return new HttpRequest(this); }
    }
}
` },
            { name: 'no cross-field check', java: J`
final class HttpRequest {
    private final String method, url, body; private final Map<String, String> headers; private final int timeoutSeconds;
    private HttpRequest(Builder b) { method = b.method; url = b.url; headers = Collections.unmodifiableMap(new LinkedHashMap<>(b.headers)); timeoutSeconds = b.timeout; body = b.body; }
    String method() { return method; } String url() { return url; } Map<String, String> headers() { return headers; } int timeoutSeconds() { return timeoutSeconds; } String body() { return body; }
    static Builder newBuilder(String url) { return new Builder(url); }
    static final class Builder {
        private final String url; private String method = "GET", body; private final Map<String, String> headers = new LinkedHashMap<>(); private int timeout = 30;
        private Builder(String url) { this.url = url; }
        Builder method(String m) { m = m.toUpperCase(); if (!Set.of("GET", "POST", "PUT", "DELETE").contains(m)) throw new IllegalArgumentException(); method = m; return this; }
        Builder header(String n, String v) { headers.put(n, v); return this; }
        Builder timeoutSeconds(int s) { if (s < 1 || s > 300) throw new IllegalArgumentException(); timeout = s; return this; }
        Builder body(String b) { body = b; return this; }
        HttpRequest build() { if (!(url.startsWith("http://") || url.startsWith("https://"))) throw new IllegalArgumentException(); return new HttpRequest(this); }
    }
}
` },
          ],
        },
      },

      /* ─────────────── Singleton ─────────────── */
      {
        lesson: 'singleton', title: 'Singleton, and why to inject it instead', mins: 6,
        remember: 'Singleton: one instance, one access point. Better: create one instance at startup and pass it in. If you must, use the holder idiom or an enum.',
        cue: 'Exactly one shared registry or config, with no DI to hand it out → Singleton (and say why you would rather inject it)',
        body: J`
          ## The textbook version has a race

          ~~~java
          class Registry {
              private static Registry instance;
              static Registry get() {
                  if (instance == null) instance = new Registry();   // check, then act
                  return instance;
              }
          }
          ~~~

          ~~~seq Two threads, two "singletons"
          actors: Thread A, Registry, Thread B
          Thread A -> Registry: get()
          Registry -> Registry: instance == null? yes
          Thread B -> Registry: get()
          Registry -> Registry: instance == null? still yes
          note: A has not assigned the field yet, so B sees null too.
          Registry --> Thread A: new Registry() #1
          Registry --> Thread B: new Registry() #2
          note: Two instances. Any state in #1 is invisible to B.
          ~~~

          ## Three safe versions

          ~~~java
          // 1. Eager: simplest. Built when the class loads.
          class Registry { static final Registry INSTANCE = new Registry(); private Registry() {} }

          // 2. Holder idiom: lazy AND thread-safe, because the JVM runs class initialisation exactly once.
          class Registry {
              private Registry() {}
              private static class Holder { static final Registry INSTANCE = new Registry(); }
              static Registry get() { return Holder.INSTANCE; }
          }

          // 3. Enum: also safe against reflection and serialization making a second copy.
          enum Registry { INSTANCE; }
          ~~~

          Double-checked locking also works, but only with a «volatile» field; without it another thread can see a half-constructed object. Mention it, but write the holder idiom.

          @stop

          ## Why interviewers push back on it

          - **Hidden dependency.** A class that calls «Registry.get()» inside a method does not say so in its constructor.
          - **Hard to test.** You cannot hand it a fake registry.
          - **Global state** that leaks between tests.

          The fix keeps "one instance" but drops the pattern: **create one instance at startup and pass it into the constructors that need it.** That is exactly what a Spring bean is: single by *scope*, injected, and replaceable in tests.

          :::interview Say it like this
          "I need exactly one «IdGenerator», but I would not make every class call a static «get()». I create one at startup and inject it; if there's no DI, the holder idiom gives me a lazy, thread-safe instance, and classes still take it through their constructor."
          :::

          @quiz 0
        `,
        quiz: [
          {
            q: 'Why is the holder idiom thread-safe without any «synchronized»?',
            options: ['Static fields are always volatile', 'The JVM initialises a class exactly once, under a lock, the first time it is used', 'Nested classes run on one thread', 'It is not thread-safe'],
            answer: 1,
            why: 'Class initialisation is guaranteed by the JVM to happen once, with proper memory visibility. The «Holder» class is only initialised when «get()» first touches it, which also makes it lazy.',
          },
        ],
      },
      {
        exercise: {
          id: 'singleton-inject', title: 'One ID source, injected', kind: 'build', mins: 8, diff: 'easy', patterns: ['singleton'],
          statement: J`
            Order IDs must come from one shared counter, but «OrderService» must stay testable.

            - «GlobalIds» is the one shared «IdSource». «GlobalIds.instance()» always returns the same object; its «next()» returns 1, 2, 3 and so on, safely even from several threads. Nobody else can construct a «GlobalIds».
            - «OrderService» takes an «IdSource» in its constructor. «place(item)» returns «"ORD-<id>-<item>"».
            - «OrderService.withDefaults()» builds one that uses «GlobalIds.instance()».

            Tests will hand «OrderService» a fake «IdSource», which is only possible because it is injected.
          `,
          given: J`
interface IdSource {
    long next();
}
`,
          starter: J`
final class GlobalIds implements IdSource {
    static GlobalIds instance() {
        return new GlobalIds(); // TODO: the same instance every time
    }

    public long next() {
        return 0; // TODO
    }
}

class OrderService {
    OrderService(IdSource ids) {
    }

    static OrderService withDefaults() {
        return new OrderService(null); // TODO
    }

    String place(String item) {
        return ""; // TODO
    }
}
`,
          tests: [
            { name: 'instance() is always the same object', ex: true, code: J`ok(GlobalIds.instance() == GlobalIds.instance(), "two calls, one object");` },
            { name: 'IDs count up by one', ex: true, code: J`
              long a = GlobalIds.instance().next();
              long b = GlobalIds.instance().next();
              eq(a + 1, b, "second id");` },
            { name: 'OrderService uses the injected source', ex: true, code: J`eq("ORD-42-book", new OrderService(() -> 42).place("book"), "order id");` },
            { name: 'withDefaults() uses the shared counter', code: J`
              long before = GlobalIds.instance().next();
              eq("ORD-" + (before + 1) + "-pen", OrderService.withDefaults().place("pen"), "order id");` },
            { name: 'Two services share one counter', code: J`
              OrderService s1 = OrderService.withDefaults(), s2 = OrderService.withDefaults();
              String o1 = s1.place("a"), o2 = s2.place("b");
              long n1 = Long.parseLong(o1.split("-")[1]), n2 = Long.parseLong(o2.split("-")[1]);
              eq(n1 + 1, n2, "ids from two services");` },
          ],
          lint: [
            { re: 'private\\s+GlobalIds\\s*\\(', when: 'absent', note: '«GlobalIds» has no private constructor, so anyone can write «new GlobalIds()» and get a second counter.' },
            { re: 'GlobalIds\\.instance\\(\\)[\\s\\S]*String\\s+place|String\\s+place[\\s\\S]*GlobalIds\\.instance\\(\\)', note: '«place()» reaches for «GlobalIds.instance()» itself. Use the injected «IdSource» so tests can swap it.' },
          ],
          rubric: J`
            - «GlobalIds» uses the holder idiom (or eager init / enum) with a private constructor.
            - The counter is thread-safe («AtomicLong.incrementAndGet()»).
            - «OrderService» depends on the «IdSource» interface through its constructor, never on «GlobalIds» directly (except in the convenience factory).
          `,
          hints: [
            'Holder idiom: «private static class Holder { static final GlobalIds INSTANCE = new GlobalIds(); }» and «instance()» returns «Holder.INSTANCE».',
            'Use «private final AtomicLong counter = new AtomicLong();» and «return counter.incrementAndGet();».',
          ],
          solution: {
            pattern: 'Singleton via the holder idiom, but consumed through an interface and constructor injection.',
            java: J`
final class GlobalIds implements IdSource {
    private final AtomicLong counter = new AtomicLong();

    private GlobalIds() {
    }

    private static class Holder {
        static final GlobalIds INSTANCE = new GlobalIds();
    }

    static GlobalIds instance() {
        return Holder.INSTANCE;
    }

    public long next() {
        return counter.incrementAndGet();
    }
}

class OrderService {
    private final IdSource ids;

    OrderService(IdSource ids) {
        this.ids = Objects.requireNonNull(ids);
    }

    static OrderService withDefaults() {
        return new OrderService(GlobalIds.instance());
    }

    String place(String item) {
        return "ORD-" + ids.next() + "-" + item;
    }
}
`,
            talk: 'GlobalIds is a holder-idiom singleton over an AtomicLong, but OrderService never calls it directly: it takes an IdSource in its constructor, so production wires in the shared instance and tests pass a fake.',
          },
          wrong: [
            { name: 'a new instance per call', java: J`
final class GlobalIds implements IdSource {
    private final AtomicLong c = new AtomicLong();
    private GlobalIds() {}
    static GlobalIds instance() { return new GlobalIds(); }
    public long next() { return c.incrementAndGet(); }
}
class OrderService {
    private final IdSource ids;
    OrderService(IdSource ids) { this.ids = ids; }
    static OrderService withDefaults() { return new OrderService(GlobalIds.instance()); }
    String place(String item) { return "ORD-" + ids.next() + "-" + item; }
}
` },
            { name: 'ignores the injected source', java: J`
final class GlobalIds implements IdSource {
    private final AtomicLong c = new AtomicLong();
    private GlobalIds() {}
    private static class H { static final GlobalIds I = new GlobalIds(); }
    static GlobalIds instance() { return H.I; }
    public long next() { return c.incrementAndGet(); }
}
class OrderService {
    OrderService(IdSource ids) {}
    static OrderService withDefaults() { return new OrderService(GlobalIds.instance()); }
    String place(String item) { return "ORD-" + GlobalIds.instance().next() + "-" + item; }
}
` },
          ],
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);

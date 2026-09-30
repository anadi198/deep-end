/* The pattern catalogue: 23 patterns in four families and three tiers.
 *   tier 1  core: learn properly (they show up in nearly every LLD round)
 *   tier 2  next: learn the shape once, recognise the cue
 *   tier 3  the rest: know the name
 * Each: { label, family, tier, one (what it is), cue (when to reach for it), lesson, confuse, where } */
(function (root) {
  const L = root.LLD;
  const J = L.J;

  L.families = {
    swap: { label: 'Swap it', one: 'One interface, several implementations: pick one at runtime.' },
    wrap: { label: 'Wrap it', one: 'Put an object inside another with the same (or a friendlier) interface.' },
    pass: { label: 'Pass it on', one: 'Hand a message to others: to everyone who listens, or down a line until someone handles it.' },
    build: { label: 'Build it', one: 'Control how objects get created: which class, how many, in what steps.' },
  };

  L.patterns = {
    /* ── core 6 ── */
    strategy: {
      label: 'Strategy', family: 'swap', tier: 1, lesson: 'strategy', confuse: ['state', 'command', 'template'],
      one: 'Put each interchangeable rule behind one interface and pick one at runtime.',
      cue: 'the rule might change, or there are several ways to do the same job (pricing, payment, eviction, spot allocation)',
      where: '«Comparator» in the JDK; Camel «AggregationStrategy»; every Spring «*Strategy» interface.',
    },
    state: {
      label: 'State', family: 'swap', tier: 1, lesson: 'state', confuse: ['strategy'],
      one: 'Each state is its own class that decides what each action does and which state comes next.',
      cue: 'a lifecycle with states and allowed transitions, where the same action means different things (vending machine, order, elevator, ATM)',
      where: 'Order lifecycles, connection state machines, a TCP connection.',
    },
    observer: {
      label: 'Observer', family: 'pass', tier: 1, lesson: 'observer', confuse: ['chain', 'mediator'],
      one: 'The subject keeps a list of listeners and notifies every one when something happens, without knowing who they are.',
      cue: 'notify X when Y happens, and more listeners will be added later',
      where: 'Spring «ApplicationEvent» + «@EventListener»; Reactor subscribers; RocketMQ consumers.',
    },
    factory: {
      label: 'Factory', family: 'build', tier: 1, lesson: 'factory', confuse: ['builder', 'abstract-factory'],
      one: 'One place decides which concrete class to create, so callers ask for what they need, not how to build it.',
      cue: '«if (type == CAR) new Car()» scattered around, or a type code in the input decides the class',
      where: '«List.of», «NumberFormat.getInstance»; Spring «BeanFactory»; Camel resolving a component from a URI scheme.',
    },
    builder: {
      label: 'Builder', family: 'build', tier: 1, lesson: 'builder', confuse: ['factory'],
      one: 'Build a complex, usually immutable object step by step with named setters, then «build()» once.',
      cue: 'a constructor with many parameters, several of them optional',
      where: '«StringBuilder», «HttpRequest.newBuilder()»; «WebClient.builder()»; Camel «RouteBuilder».',
    },
    singleton: {
      label: 'Singleton', family: 'build', tier: 1, lesson: 'singleton', confuse: ['factory'],
      one: 'Exactly one instance behind one access point. Usually a smell: prefer injecting one shared instance.',
      cue: 'exactly one shared registry, config or pool, and no dependency injection to hand it out',
      where: '«Runtime.getRuntime()». Spring beans are single by scope, not by this pattern.',
    },
    /* ── next 6 ── */
    decorator: {
      label: 'Decorator', family: 'wrap', tier: 2, lesson: 'decorator', confuse: ['proxy', 'adapter', 'chain'],
      one: 'Wrap an object in another with the same interface to add behaviour; wrappers stack.',
      cue: 'optional extras that combine freely (toppings, add-ons, logging + caching + retry around a service)',
      where: '«new BufferedReader(new FileReader(f))»; «Collections.unmodifiableList»; Reactor operators.',
    },
    chain: {
      label: 'Chain of Responsibility', family: 'pass', tier: 2, lesson: 'chain', confuse: ['decorator', 'observer'],
      one: 'Pass a request along a line of handlers; each handles it, passes it on, or both.',
      cue: 'try A, else B, else C; a pipeline of checks or filters; approval levels; notes and coins by denomination',
      where: 'Servlet filters; Spring Security filter chain; a Camel pipeline of processors.',
    },
    command: {
      label: 'Command', family: 'swap', tier: 2, lesson: 'command', confuse: ['strategy', 'memento'],
      one: 'Turn a request into an object, so you can queue it, log it, retry it or undo it.',
      cue: 'undo and redo, a job queue, retries, macro recording',
      where: '«Runnable» and «Callable» submitted to an executor; a Camel «Exchange» carries a message.',
    },
    adapter: {
      label: 'Adapter', family: 'wrap', tier: 2, lesson: 'adapter', confuse: ['decorator', 'facade'],
      one: 'Wrap a class that has the wrong interface so it fits the one your code expects.',
      cue: 'integrate a third-party or legacy API behind your own interface',
      where: '«Arrays.asList», «InputStreamReader»; one client class per payment gateway.',
    },
    proxy: {
      label: 'Proxy', family: 'wrap', tier: 2, lesson: 'proxy', confuse: ['decorator'],
      one: 'A stand-in with the same interface that controls access: caching, lazy loading, permission checks, rate limits, remote calls.',
      cue: 'check or do something before calling the real object, without the caller knowing',
      where: 'Spring AOP (@Transactional, @Cacheable) is proxies; gRPC client stubs; «java.lang.reflect.Proxy».',
    },
    composite: {
      label: 'Composite', family: 'wrap', tier: 2, lesson: 'composite', confuse: ['decorator'],
      one: 'Treat a single item and a group of items the same way through one interface: a tree.',
      cue: 'a folder contains files and folders; a menu contains items and submenus; totals over a tree',
      where: 'File systems, org charts, UI component trees.',
    },
    /* ── the rest: recognise the name ── */
    'abstract-factory': { label: 'Abstract Factory', family: 'build', tier: 3, lesson: 'the-rest', confuse: ['factory'], one: 'A factory for a family of related objects that must match (dark-theme button + dark-theme checkbox).', cue: 'families of related products that must be used together' },
    prototype: { label: 'Prototype', family: 'build', tier: 3, lesson: 'the-rest', confuse: ['builder'], one: 'Create new objects by copying a configured one.', cue: 'building from scratch is costly; clone a template' },
    flyweight: { label: 'Flyweight', family: 'build', tier: 3, lesson: 'the-rest', confuse: ['singleton'], one: 'Share the common, unchanging part of many small objects instead of copying it.', cue: 'millions of similar objects eating memory (glyphs, chess piece types)' },
    memento: { label: 'Memento', family: 'build', tier: 3, lesson: 'the-rest', confuse: ['command'], one: 'Save and restore an object\'s state without exposing its insides.', cue: 'snapshots, checkpoints, undo by restoring state' },
    facade: { label: 'Facade', family: 'wrap', tier: 3, lesson: 'the-rest', confuse: ['adapter'], one: 'One simple entry point in front of a complicated subsystem.', cue: 'callers need several services called in the right order; give them one method' },
    bridge: { label: 'Bridge', family: 'wrap', tier: 3, lesson: 'the-rest', confuse: ['adapter', 'strategy'], one: 'Split an abstraction from its implementation so the two vary independently.', cue: 'two independent dimensions of variation that would multiply subclasses (Shape x Renderer)' },
    interpreter: { label: 'Interpreter', family: 'wrap', tier: 3, lesson: 'the-rest', confuse: ['composite'], one: 'Represent a small language\'s grammar as classes and evaluate the tree.', cue: 'evaluate rules or expressions written in a tiny language' },
    template: { label: 'Template Method', family: 'swap', tier: 3, lesson: 'the-rest', confuse: ['strategy'], one: 'A base class fixes the steps of an algorithm; subclasses fill in some steps. Usually better as Strategy.', cue: 'same recipe, different details, and the base class must control the order' },
    iterator: { label: 'Iterator', family: 'pass', tier: 3, lesson: 'the-rest', confuse: ['visitor'], one: 'Walk a collection without exposing how it is stored. Java builds it in.', cue: 'for-each over your own collection' },
    mediator: { label: 'Mediator', family: 'pass', tier: 3, lesson: 'the-rest', confuse: ['observer'], one: 'Objects talk through one coordinator instead of to each other.', cue: 'many objects that would otherwise all reference each other (chat room, air-traffic control)' },
    visitor: { label: 'Visitor', family: 'pass', tier: 3, lesson: 'the-rest', confuse: ['iterator', 'composite'], one: 'Add operations over a fixed set of classes without editing them. In modern Java: sealed types + a pattern-matching «switch».', cue: 'many different operations over a stable class hierarchy (syntax tree, file tree)' },
  };

  L.mapNotes = J`
## How to use this map

1. **Name the move first.** Do I need to *swap* behaviour, *wrap* an object, *pass* a message on, or control how things get *built*? That narrows 23 to 3 or 4.
2. **Then match the cue.** Each card's cue is the sentence in a problem statement that should make you reach for it.
3. **Then ask "is it worth it?"** A pattern that serves no follow-up question is over-engineering. Interviewers reward the simplest design that survives their next question.

:::key The two that get mixed up most
**Strategy vs State.** Both swap an object behind an interface. In Strategy, the *caller* picks the rule. In State, the *object* switches itself as things happen.
**Decorator vs Proxy.** Both wrap with the same interface. A Decorator *adds* behaviour and stacks. A Proxy *controls access* to one real object.
:::
`;
})(typeof globalThis !== 'undefined' ? globalThis : this);

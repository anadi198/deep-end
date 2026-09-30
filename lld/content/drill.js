/* Extra "which pattern fits?" prompts for the drill and the daily review.
 * Each: { prompt, pattern, why }. Every tier 1 and 2 pattern's own cue is added automatically. */
(function (root) {
  const L = root.LLD;
  L.drill.push(
    { prompt: 'Users pay by UPI, card or wallet; they choose at checkout, and finance will add BNPL next quarter.', pattern: 'strategy', why: 'Several interchangeable ways to do one job, picked by the caller: Strategy.' },
    { prompt: 'An elevator ignores the "open doors" button while moving, but opens when idle at a floor.', pattern: 'state', why: 'The same action means different things depending on the current state, and the elevator moves itself between states.' },
    { prompt: 'A drawing app needs undo and redo for every shape you add, move or delete.', pattern: 'command', why: 'Undo needs each action as an object that can reverse itself: Command.' },
    { prompt: 'When a stock price changes, the chart, the alert service and the portfolio page all update, and plugins can register for updates too.', pattern: 'observer', why: 'One event, many listeners, and more to come: Observer.' },
    { prompt: 'A support ticket goes to L1; if L1 cannot solve it, to L2; then to engineering.', pattern: 'chain', why: 'Pass the request along a line of handlers until one handles it: Chain of Responsibility.' },
    { prompt: 'A coffee order can add milk, extra shot, caramel and whipped cream in any combination, each changing price and description.', pattern: 'decorator', why: 'Optional extras that stack freely: each one wraps the drink and adds to it.' },
    { prompt: 'Your code expects «PaymentGateway.charge(Money)», but the vendor SDK exposes «makeTxn(String amountStr, String currency)».', pattern: 'adapter', why: 'A class with the wrong interface that has to fit yours: Adapter.' },
    { prompt: 'Image objects are expensive to load; show a placeholder and only load the real file the first time it is drawn.', pattern: 'proxy', why: 'A stand-in with the same interface that controls when the real object is created: a lazy-loading Proxy.' },
    { prompt: 'An org chart where you ask any node for its total salary cost, whether it is one person or a whole department.', pattern: 'composite', why: 'One interface for a single item and a group of items: Composite.' },
    { prompt: 'Notifications are created from a type string in each event: "EMAIL", "SMS" or "PUSH".', pattern: 'factory', why: 'A type code in the input decides which class to create: Factory.' },
    { prompt: 'An «HttpRequest» has a URL, a method, and optional headers, timeout, body and retries.', pattern: 'builder', why: 'Many optional parameters for one immutable object: Builder.' },
    { prompt: 'The app needs exactly one in-memory cache registry, and there is no dependency injection framework.', pattern: 'singleton', why: 'Exactly one shared instance with one access point. (With DI, you would register one instance instead.)' },
    { prompt: 'A parking lot assigns spots nearest-first on weekdays and cheapest-first on weekends, and ops wants to switch at runtime.', pattern: 'strategy', why: 'The allocation rule varies and is chosen from outside: Strategy.' },
    { prompt: 'A document is DRAFT, IN_REVIEW or PUBLISHED; "edit" is allowed in draft, sends it back to draft from review, and is refused once published.', pattern: 'state', why: 'The action\'s meaning depends on the lifecycle stage: State.' },
    { prompt: 'Every API request passes authentication, then rate limiting, then validation; any step can reject it.', pattern: 'chain', why: 'A line of handlers, each able to stop the request: Chain of Responsibility (servlet filters work exactly like this).' },
    { prompt: 'You want to log timing around every call to a repository without touching the repository class, and only in production.', pattern: 'decorator', why: 'Add behaviour by wrapping with the same interface. (Spring does this with proxies; the design idea is a Decorator.)' },
    { prompt: 'A cricket score changes and the TV overlay, the mobile app and the commentary bot must all react.', pattern: 'observer', why: 'Many independent listeners to one subject: Observer.' },
    { prompt: 'Jobs are submitted from the web tier and executed by workers later, with retries on failure.', pattern: 'command', why: 'The request becomes an object you can queue and replay: Command.' },
  );
})(typeof globalThis !== 'undefined' ? globalThis : this);

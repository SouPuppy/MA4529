# Cache System

The cache system bridges the **MessageBus** and the **Loom window + plugin** layer. It is the primary runtime subsystem for strategy data access.

---

## Architecture

```
Program::use<Bars<PluginSMA<20>>>("data.bar.*", 200)
  │
  ▼
CacheManager::ensure<Bars<PluginSMA<20>>>("data.bar.*", 200)
  │  deduplicates: if adapter for (WindowType, pattern) exists, reuse it
  │
  ▼
CacheAdapter<Bars<PluginSMA<20>>>
  subscribes: "data.bar.*"   priority = UINT8_MAX-1  (before other subscribers)

  on UpdateBar(topic = "data.bar.aapl.Mock@1m"):
    1. auto-create Bars<PluginSMA<20>>(rt, 200)   if first time for this topic
    2. window.receive(bar)                          evict + push + pulse plugins
    3. poll<PluginSMA<20>>()
       if timestamp matches event_ts:
         publish<double>("data.bar.aapl.Mock@1m:sma20", value)
```

Derived topics re-enter the bus as normal publishes and can trigger interrupt handlers.

---

## CacheTraits — Message-to-Window Binding

`CacheTraits<WindowType>` declares which bus message type feeds a window:

| Window type | `message_type` | Bus topic prefix |
|-------------|---------------|-----------------|
| `Bars<Plugins...>` | `UpdateBar` | `data.bar.*` |
| `OrderBook<Plugins...>` | `UpdateBook` | `data.depth.*` |

The trait provides `topic()`, `event_timestamp()`, and `receive()` so the adapter routes each message into the correct window method.

---

## Plugin Topic Suffixes

Plugins used inside engine cache windows must define `static topic_suffix()`:

```cpp
struct PluginSMA<20> {
    static std::string topic_suffix() { return "sma20"; }
};
```

The adapter appends this to the source topic to build the derived topic name. All built-in plugins satisfy this requirement:

| Plugin | `topic_suffix()` |
|--------|-----------------|
| `PluginSMA<N>` | `"smaNN"` — e.g. `"sma20"` |
| `PluginEMA<N>` | `"emaN"` |
| `PluginRSI<N>` | `"rsiN"` |
| `PluginBollinger<N, K>` | `"bollingerN"` |
| `PluginMidPrice` | `"mid_price"` |

---

## CacheManager — Deduplication

`CacheManager` is a registry of adapters, keyed by `(WindowType, pattern)`. If two programs call `use<Bars<PluginSMA<20>>>("data.bar.*", 200)` with the same type and pattern, only one adapter is created and both programs read from the same windows.

---

## CacheFacade — User API

`CacheFacade` is the read interface available as `ctx.cache` in every handler.

### Market Data Windows

```cpp
// Returns the window for the given topic, or nullptr if not yet created.
const auto* bars = ctx.cache.get<loom::Bars<PluginSMA<20>>>(
                       "data.bar.aapl.Mock@1m");
if (!bars || bars->count() == 0) return;

double close = bars->latest().close;
double sma   = bars->template poll<PluginSMA<20>>().value;
```

For wildcard handlers, use `ctx.trigger.source` as the key:

```cpp
on(SIGNAL<Event>("data.bar.*.Mock@1m"), [](Context& ctx) {
    const auto* bars = ctx.cache.get<loom::Bars<PluginSMA<20>>>(
                           ctx.trigger.source);
});
```

`get<W>` checks the window layer first; it falls back to the bus latest snapshot if no window exists.

### Order Lookups

```cpp
const Order* o = ctx.cache.order(client_order_id);
const Order* o = ctx.cache.order_by_id(order_id);
const Order* o = ctx.cache.order_by_venue_id(venue_order_id);

for (const Order* o : ctx.cache.orders_open())   { ... }
for (const Order* o : ctx.cache.orders_closed())  { ... }
```

### Portfolio Lookups

```cpp
const auto* acct = ctx.cache.default_account();
const auto* acct = ctx.cache.account("MY_ACCOUNT");

const auto* pos = ctx.cache.position("DEFAULT", "aapl");
```

---

## Declaring Windows in a Program

```cpp
// Fixed-count bar window (all symbols from Mock at 1m)
use<loom::Bars<PluginSMA<20>, PluginEMA<10>>>("data.bar.*.Mock@1m", /*max_size=*/200);

// Time-windowed order book
use<loom::OrderBook<PluginMidPrice>>("data.depth.aapl.Mock@10",
                                     loom::time::seconds(30));
```

Windows are created per matching topic on first message arrival. The `Runtime` is injected automatically; remaining constructor arguments are forwarded to the window.

---

## Derived Topic Subscriptions

Because derived topics are normal bus publishes, handlers can subscribe to them directly:

```cpp
// Fires after every new SMA-20 value for any symbol
on(SIGNAL<Event>("data.bar.*.Mock@1m:sma20"), [](Context& ctx) {
    const auto* bars = ctx.cache.get<loom::Bars<PluginSMA<20>>>(
                           ctx.trigger.source.substr(0, ctx.trigger.source.find(':')));
});
```

Or subscribe to the raw bar and read all analytics together:

```cpp
on(SIGNAL<Event>("data.bar.aapl.Mock@1m"), [](Context& ctx) {
    using W = loom::Bars<PluginSMA<20>, PluginRSI<14>>;
    const auto* bars = ctx.cache.get<W>("data.bar.aapl.Mock@1m");
    if (!bars || bars->count() < 20) return;

    double sma = bars->template poll<PluginSMA<20>>().value;
    double rsi = bars->template poll<PluginRSI<14>>().value;
});
```

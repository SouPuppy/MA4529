# Topics & Market Messages

## Topic Format

Topics are dot-separated strings. `:` is a hard boundary — wildcards cannot cross it.

```
data.bar.{symbol}.{source}@{param}          ← raw bar topic
data.depth.{symbol}.{source}@{param}        ← raw depth topic
{source_topic}:{plugin_suffix}              ← derived analytic topic
```

Wildcards follow glob rules:

- `*` matches any single segment within a `.`-separated level
- `*` **cannot** cross `.` or `:`

Examples:

| Pattern | Matches | Does Not Match |
|---------|---------|----------------|
| `data.bar.*.Mock@1m` | `data.bar.aapl.Mock@1m` | `data.bar.aapl.NYSE@1m` |
| `data.bar.aapl.*` | `data.bar.aapl.Mock@1m`, `data.bar.aapl.Binance@5m` | `data.depth.aapl.Mock@10` |
| `data.bar.aapl.Mock@1m:*` | `data.bar.aapl.Mock@1m:sma20` | `data.bar.aapl.Mock@5m:sma20` |
| `data.bar.*` | `data.bar.aapl.Mock@1m` | `data.bar.aapl.Mock@1m:sma20` |

---

## Topic Taxonomy

| Prefix | Example | Published by |
|--------|---------|--------------|
| `data.bar.*` | `data.bar.aapl.Mock@1m` | Datafeed |
| `data.depth.*` | `data.depth.aapl.Mock@10` | Datafeed |
| `{source_topic}:{suffix}` | `data.bar.aapl.Mock@1m:sma20`, `data.depth.aapl.Mock@10:mid_price` | CacheAdapter (plugin output) |
| `command.order.submit.*` | `command.order.submit.MockExec` | Executor |
| `command.order.execute.*` | `command.order.execute.MockExec` | RiskCore (approved) |
| `command.order.denied.*` | `command.order.denied.MockExec` | RiskCore (denied) |
| `venue.order.accepted.*` | `venue.order.accepted.MockExec` | Executor (venue ack) |
| `venue.order.filled.*` | `venue.order.filled.MockExec` | Executor (venue fill) |
| `event.order.*` | `event.order.MockExec` | ExecutionCore |

---

## UpdateBar

Published by a `Datafeed` on each clock tick for every subscribed bar channel.

```cpp
namespace message {
struct UpdateBar {
    std::string venue;           // "Mock", "Binance", "OKX"
    std::string symbol;          // "aapl", "BTC-USDT"
    std::string param;           // interval: "1m", "5m", "1h"
    loom::Tick<loom::Bar> bar;   // {ts_ns, {open, high, low, close, volume}}

    std::string topic() const;          // "data.bar.{symbol}.{venue}@{param}"
    int64_t     event_timestamp() const; // bar.timestamp_ns
};
}
```

Topic example: `data.bar.aapl.Mock@1m`

---

## UpdateBook

Published by a `Datafeed` for each depth-of-book update.

```cpp
namespace message {
struct UpdateBook {
    std::string venue;
    std::string symbol;
    std::string param;                           // depth levels: "10", "20"
    loom::Tick<loom::OrderBookDelta> book;       // snapshot or incremental delta

    std::string topic() const;                   // "data.depth.{symbol}.{venue}@{param}"
    int64_t     event_timestamp() const;
};
}
```

Topic example: `data.depth.aapl.Mock@10`

The first delta is always `DELTA_SNAPSHOT` (full book); subsequent deltas are `DELTA_INCREMENTAL`.

---

## Derived Topics

After each market data message, the `CacheAdapter` polls all registered plugins and republishes their output as derived topics. Wildcards can subscribe to all derived outputs for a given source topic:

```cpp
// All derived analytics for any AAPL bar:
on(SIGNAL<Event>("data.bar.aapl.Mock@1m:*"), [](Context& ctx) {
    // ctx.trigger.source will be "data.bar.aapl.Mock@1m:sma20" etc.
});
```

Derived topics are normal bus publishes and can themselves trigger handlers. See [Cache System](cache.md) for how they are produced.

---

## Subscribing in a Program

```cpp
// Raw bar for a specific symbol + source + interval
on(SIGNAL<Event>("data.bar.aapl.Mock@1m"), [](Context& ctx) { ... });

// All symbols from one source at one interval
on(SIGNAL<Event>("data.bar.*.Mock@1m"), [](Context& ctx) {
    const std::string& topic = ctx.trigger.source;  // actual matched topic
});

// Specific derived analytic
on(SIGNAL<Event>("data.bar.aapl.Mock@1m:sma20"), [](Context& ctx) { ... });

// Order book
on(SIGNAL<Event>("data.depth.aapl.Mock@10"), [](Context& ctx) { ... });
```

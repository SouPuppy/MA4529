# Writing Programs

A `Program` is the base class for strategy logic. Subclass it, declare cache windows with `use<W>()`, and register interrupt handlers with `on()`. Handlers fire deterministically after each data wave quiesces.

```cpp
#include <aurum/program/program.h>
#include <aurum/engine/engine.h>
using namespace aurum;
```

---

## Structure

```cpp
class MyStrategy : public Program {
public:
    MyStrategy() {
        use<loom::Bars<PluginSMA<20>>>("data.bar.aapl.Mock@1m", /*max_size=*/200);

        on(SIGNAL<Event>("data.bar.aapl.Mock@1m"), [this](Context& ctx) {
            handle_bar(ctx);
        });

        on(SIGNAL<Cron>("30 9 * * 1-5"), [this](Context& ctx) {
            on_open(ctx);
        });
    }

    void on_start(Context& ctx) override { /* called once before first tick */ }

private:
    void handle_bar(Context& ctx);
    void on_open(Context& ctx);
};
```

Install with an executor — every program is bound to one:

```cpp
auto exec = engine.bind<Executor>(my_executor_binding);
engine.install<MyStrategy>(exec);
```

---

## `use<W>` — Cache Windows

Declares a rolling window for every topic matching the pattern. Windows are created per-topic on first message arrival.

```cpp
// Fixed-count bar window
use<loom::Bars<PluginSMA<20>>>("data.bar.aapl.Mock@1m", /*max_size=*/200);

// Time-windowed order book
use<loom::OrderBook<PluginMidPrice>>("data.depth.aapl.Mock@10",
                                     loom::time::seconds(30));

// Wildcard: one window per symbol
use<loom::Bars<PluginEMA<10>>>("data.bar.*.Mock@1m", /*max_size=*/100);
```

See [Cache System](data/cache.md) for how windows are created and how plugin outputs become derived topics.

---

## `on` — Interrupt Handlers

Handlers fire after the engine quiesces the current data wave — `ctx.cache` is always a coherent snapshot.

### Event

Fires when a matching topic is published:

```cpp
on(SIGNAL<Event>("data.bar.aapl.Mock@1m"), [](Context& ctx) { ... });

// Wildcard: check ctx.trigger.source for the actual topic
on(SIGNAL<Event>("data.bar.*.Mock@1m"), [](Context& ctx) {
    const auto& topic = ctx.trigger.source;
});
```

### Cron

Fires on a schedule evaluated against the engine clock:

```cpp
on(SIGNAL<Cron>("30 9 * * 1-5"), [](Context& ctx) { ... });  // weekdays 9:30
on(SIGNAL<Cron>("* * * * *"),    [](Context& ctx) { ... });  // every minute
```

---

## `Context`

```cpp
struct Context {
    Engine&            engine;   // full engine access (advanced use)
    Executor&          exec;     // executor this program is bound to
    const CacheFacade& cache;    // read-only: windows, orders, portfolio
    loom::Timestamp    now_ns;   // current engine timestamp
    TriggerInfo        trigger;  // what fired this handler
};

ctx.trigger.kind;      // TriggerKind::EVENT or TriggerKind::CRON
ctx.trigger.source;    // topic that fired (EVENT only)
ctx.trigger.ts_event;  // timestamp of the triggering event
```

---

## Reading Cache

```cpp
on(SIGNAL<Event>("data.bar.aapl.Mock@1m"), [](Context& ctx) {
    const auto* bars = ctx.cache.get<loom::Bars<PluginSMA<20>>>(
                           "data.bar.aapl.Mock@1m");
    if (!bars || bars->count() == 0) return;

    double close = bars->latest().close;
    double sma   = bars->template poll<PluginSMA<20>>().value;
});

// Wildcard handler: use ctx.trigger.source as the key
on(SIGNAL<Event>("data.bar.*.Mock@1m"), [](Context& ctx) {
    const auto* bars = ctx.cache.get<loom::Bars<PluginSMA<20>>>(
                           ctx.trigger.source);
});
```

---

## Submitting Orders

```cpp
Order order;
order.instrument_id = "aapl";
order.type          = OrderType::MARKET;
order.side          = OrderSide::BUY;
order.quantity      = 100;

ctx.exec.submit_order(std::move(order));
```

`submit_order` auto-assigns `client_order_id` and publishes `SubmitOrder`. `RiskCore` validates and either approves or denies the order within the same tick.

For TIF normalization rules, denial reasons, and the full validation pipeline see [Risk Validation](orders/risk.md).  
For status flow and how to subscribe to order events see [Order Lifecycle](orders/lifecycle.md).

---

## Reading Portfolio

```cpp
// Cash
const auto* acct = ctx.cache.default_account();
if (acct) {
    double available = acct->available_cash;
    double locked    = acct->locked_cash;
}

// Position
const auto* pos = ctx.cache.position("DEFAULT", "aapl");
if (pos && pos->is_open()) {
    double qty  = pos->quantity;
    double rpnl = pos->realized_pnl;
}
```

For cash flow mechanics and position P&L details see [Accounts](portfolio/account.md) and [Positions](portfolio/position.md).

---

## Complete Example

```cpp
class MomentumStrategy : public Program {
public:
    MomentumStrategy() {
        use<loom::Bars<PluginSMA<20>, PluginSMA<50>>>(
            "data.bar.aapl.Mock@1m", /*max_size=*/200);

        on(SIGNAL<Event>("data.bar.aapl.Mock@1m"), [this](Context& ctx) {
            run(ctx);
        });
    }

    void on_start(Context& ctx) override {}

private:
    void run(Context& ctx) {
        using Bars = loom::Bars<PluginSMA<20>, PluginSMA<50>>;

        const auto* bars = ctx.cache.get<Bars>("data.bar.aapl.Mock@1m");
        if (!bars || bars->count() < 50) return;

        double sma20 = bars->template poll<PluginSMA<20>>().value;
        double sma50 = bars->template poll<PluginSMA<50>>().value;

        if (sma20 > sma50 && !long_) {
            Order o;
            o.instrument_id = "aapl";
            o.type          = OrderType::MARKET;
            o.side          = OrderSide::BUY;
            o.quantity      = 100;
            ctx.exec.submit_order(std::move(o));
            long_ = true;
        } else if (sma20 < sma50 && long_) {
            Order o;
            o.instrument_id = "aapl";
            o.type          = OrderType::MARKET;
            o.side          = OrderSide::SELL;
            o.quantity      = 100;
            ctx.exec.submit_order(std::move(o));
            long_ = false;
        }
    }

    bool long_ = false;
};
```

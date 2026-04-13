# Aurum Engine Overview

Aurum is a quantitative trading engine built on top of Loom. Everything communicates through a central **MessageBus**: devices publish market data and venue reports, cores react by updating state, and strategy handlers run deterministically after each data wave quiesces.

---

## Architecture

```
Clock
  │
  ├─▶ sync_executor_clocks      Executor.on_clock()
  │
  ├─▶ start_programs            on_start() for new programs
  │
  ├─▶ tick_non_executor_devices  Datafeed.on_clock()
  │                                  │ publishes UpdateBar / UpdateBook
  │                                  ▼
  │                            MessageBus
  │                            │
  │                            ├── CacheAdapter   ← high priority; auto-creates Window per topic
  │                            │       │ plugin outputs → derived topics  (source:sma20, …)
  │                            │       ▼
  │                            │   Window (Bars / OrderBook) + plugins
  │                            │
  │                            ├── PortfolioCore  ← mark prices, cash, positions
  │                            ├── RiskCore       ← command.order.submit.*
  │                            └── ExecutionCore  ← command.order.execute/filled/accepted
  │
  ├─▶ drain()                   flush all queued publishes
  ├─▶ collect_due()             cron triggers
  ├─▶ process_interrupts()      stabilize → run Program handlers
  ├─▶ drain()
  ├─▶ process_interrupts()      re-entrant triggers from handler commands
  └─▶ drain_service_tasks()     cross-thread HTTP work; stabilize after
```

---

## Components

| Component | Role |
|-----------|------|
| **MessageBus** | Typed pub/sub; stores latest snapshot per `(type, topic)`; routes to subscribers |
| **Datafeed** | Publishes `UpdateBar` / `UpdateBook` on each clock tick |
| **Executor** | Normalizes and submits `SubmitOrder`; receives venue acks and fills |
| **CacheAdapter** | Subscribes to bus; auto-creates one Window per topic; publishes plugin outputs as derived topics |
| **CacheManager** | Registry of adapters; deduplicates by `(WindowType, pattern)` |
| **CacheFacade** | User API: `use<W>()`, `get<W>()`, order lookups, portfolio lookups |
| **PortfolioCore** | Projects fills into positions and PnL; tracks mark prices |
| **RiskCore** | Validates `SubmitOrder` → approves or denies before touching venue |
| **ExecutionCore** | Assigns order IDs; folds venue reports into `OrderCache`; emits `OrderEvent` |
| **InterruptController** | Observes all publishes; enqueues matching handlers; fires after quiescing |
| **Scheduler** | Evaluates cron expressions; enqueues due triggers each tick |
| **CatalogCore** | Observes all topics; builds source/instrument/channel metadata index |

---

## Quiescing

`process_interrupts` guarantees handlers see coherent state:

```
interrupt_controller_.has_pending()?
  enter_quiescing()
  stabilize_dataflow()   ←  drain() + runtime.drain()  ×2
  run handlers
```

When a handler calls `ctx.exec.submit_order()`, the resulting publishes re-enter the bus and are processed by the second `process_interrupts` pass in the same tick.

---

## State in Memory

| What | Owner | API |
|------|-------|-----|
| Latest message per topic | `MessageBus` | `bus.latest<T>(topic)` |
| Rolling windows per topic | `CacheAdapter` | `ctx.cache.get<Bars<...>>(topic)` |
| Current order state | `OrderCache` | `ctx.cache.order(client_order_id)` |
| Account cash | `PortfolioCore` | `ctx.cache.default_account()` |
| Positions | `PortfolioCore` | `ctx.cache.position(account_id, instrument_id)` |

---

## Running the Engine

```cpp
Engine engine;

auto exec = engine.bind<Executor>(my_executor_binding);
engine.bind<Datafeed>(my_datafeed_binding);
engine.install<MyStrategy>(exec);

engine.serve({.host = "0.0.0.0", .port = 8080, .base_path = "/api/v1"});

// Backtesting
engine.replay(start_ns, end_ns, loom::time::milliseconds(1));

// Live
loom::SystemClock clock(loom::time::milliseconds(1));
engine.run(clock);  // blocks; call engine.stop() to exit
```

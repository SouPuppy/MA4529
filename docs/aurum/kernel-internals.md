# Aurum Kernel Internals

## Why This Doc Exists

This document explains how the Aurum kernel currently works from three angles:

1. Communication: how data, commands, queries, and interrupts move through the engine.
2. Memory: what state is actually kept in memory, what is only a latest snapshot, and what is not stored at all.
3. Operations: how to debug wrong behavior and where the current design should evolve without making the kernel bloated.

The target reader is the person who needs to:

- design a stable REST or WS API,
- debug why a strategy did not trigger,
- debug why an order or PnL looks wrong,
- optimize latency or memory,
- evolve the engine without importing all of Nautilus Trader's complexity.

This is intentionally not an event-sourcing manifesto. Aurum today is a compact single-engine kernel with a typed message bus, interrupt-driven strategy execution, in-memory projections, and a control-plane HTTP server. The goal is to make that model explicit.

## Executive Summary

The most important current conclusion is:

- Aurum already has projection state.
- Aurum does not yet have a fill fact ledger.

More concretely:

- `MessageBus` answers: "what is the latest message seen on this topic for this type?"
- `OrderCache` answers: "what is the current state of this order?"
- `PortfolioCore` answers: "what is the current account and position projection?"
- Cache windows answer: "what is the current derived analytic state for this topic?"
- Nothing today answers cleanly: "what executions actually occurred over time?"

That missing layer is why `/fills` is awkward today, why PnL provenance is weaker than it should be, and why execution debugging is harder than necessary.

The right next step is not to clone Nautilus wholesale. The right next step is to add a minimal append-only in-memory fill store and keep the rest of the kernel compact.

## Scope And Current Design Goal

The current Aurum design is already converging on a sensible split:

- REST should be a control plane plus snapshot/query plane.
- WS can later be the streaming plane for live execution and market updates.
- Market data itself should not be forced through REST.

For a single backtest task, that implies a strong rule:

- REST should accept commands such as order submission or cancellation.
- REST should return metadata and snapshots from engine-owned memory.
- WS should later stream incremental changes.

This is a good direction. It keeps REST deterministic and cheap, and it stops the HTTP layer from becoming a transport for high-volume market data.

## Code Map

These files are the main places to read while debugging the kernel:

| File | Responsibility |
| --- | --- |
| `abzu-aurum/src/engine.cpp` | Engine lifecycle, tick loop, device start/stop, service task drain, overall sequencing. |
| `abzu-aurum/include/aurum/core/bus/message_bus.h` | Typed pub/sub, latest snapshots, endpoints, response handlers, publish observers. |
| `abzu-aurum/include/aurum/core/bus/topic_router.h` | Per-type queued fanout and drain semantics. |
| `abzu-aurum/include/aurum/core/bus/matching.h` | Topic wildcard matching, including `:` derived-topic boundary behavior. |
| `abzu-aurum/include/aurum/core/kernel.h` | Kernel state and interrupt controller interface. |
| `abzu-aurum/src/core/kernel.cpp` | Event and cron interrupt registration, pending queue, quiesce/run cycle. |
| `abzu-aurum/src/core/scheduler.cpp` | Cron scheduling and next deadline collection. |
| `abzu-aurum/include/aurum/core/cache/cache_manager.h` | Window adapter registry. |
| `abzu-aurum/include/aurum/core/cache/cache_adapter.h` | Auto-created windows per topic and derived-topic publication. |
| `abzu-aurum/include/aurum/core/cache/order_cache.h` | In-memory order aggregate store and indexes. |
| `abzu-aurum/include/aurum/engine/cores/execution.h` | Folds risk approvals and venue reports into order state and publishes order events. |
| `abzu-aurum/include/aurum/engine/cores/portfolio.h` | Projects order and market events into account and position state. |
| `abzu-aurum/src/integration/mock/client.cpp` | Mock venue behavior, including accepted and filled reports. |

## High-Level Mental Model

At runtime, the kernel looks like this:

```text
clock tick
  -> devices observe time
  -> data / execution messages get published into MessageBus
  -> MessageBus stores latest snapshots and queues router deliveries
  -> bus drain fans messages to cores, cache adapters, and observers
  -> publish observer turns matching topics into pending interrupts
  -> scheduler adds cron interrupts
  -> engine quiesces dataflow
  -> strategy handlers run with a stable Context snapshot
  -> handlers submit commands
  -> commands re-enter bus/core pipeline
  -> engine drains again
  -> service tasks run
```

The key idea is:

- data flows continuously,
- strategies do not execute in the middle of arbitrary bus fanout,
- the engine first quiesces the current wave of publishes and then runs interrupt handlers.

That quiescing behavior is one of the most important properties in the kernel.

## Engine Ownership Model

`Engine` owns the core runtime objects:

- `loom::Runtime runtime_`
- `MessageBus message_bus_`
- `CacheManager cache_manager_`
- `OrderCache order_cache_`
- `PortfolioCore portfolio_core_`
- `CatalogCore catalog_core_`
- `CacheFacade cache_facade_`
- `RiskCore risk_core_`
- `ExecutionCore execution_core_`
- `InterruptController interrupt_controller_`

The constructor in `abzu-aurum/src/engine.cpp` wires them together directly. There is no separate distributed kernel process model here. The engine is a single in-process coordinator with a few clearly owned stores.

This matters because API design should follow ownership:

- if something is not owned in engine memory, REST cannot reliably query it,
- if something is only a latest snapshot, REST cannot pretend it is history,
- if something is a projection, consumers must not treat it as raw execution truth.

## Lifecycle And Reset Semantics

### Start

When the engine starts, `start_devices()` performs a hard runtime reset of engine-owned state:

- clears scheduler state,
- clears interrupt controller state,
- clears message bus snapshots,
- clears cache windows,
- clears order cache,
- resets portfolio core,
- clears catalog runtime state,
- resets execution core order-id sequence,
- clears pending service tasks,
- starts HTTP server if configured,
- registers program interrupts,
- starts devices.

This means current engine memory is run-scoped, not durable across runs.

### Stop

When the engine stops, it:

- stops HTTP,
- stops devices,
- stabilizes dataflow,
- clears scheduler state,
- clears interrupt state,
- clears pending service tasks.

The important implication is:

- the control-plane API is lifecycle-bound to a single engine run,
- snapshots and in-memory stores are not persisted across runs unless you add persistence explicitly.

## Tick Processing Order

`Engine::process_clock_tick()` is the core sequence:

1. Update interrupt controller current timestamp.
2. Tick executor devices first.
3. Start programs that have not yet started.
4. Tick all non-executor devices.
5. Drain the message bus.
6. Collect due cron interrupts from the scheduler.
7. Process interrupts.
8. Drain the bus again.
9. Process interrupts again.
10. Drain service tasks.

That order is not accidental.

Executor devices tick first so venue-side state can stay aligned with time before datafeeds and strategies generate more traffic. Programs start before the main non-executor device tick completes, so `on_start` logic can attach caches or publish initial commands. The repeated bus/interrupt phases exist because handlers can publish more messages, which can in turn schedule more work.

## Communication Model

There are four different communication patterns in Aurum. They should not be conflated.

### 1. Publish / Subscribe

This is the main internal event and command transport.

`MessageBus` owns one `TopicRouter<T>` per message type. On `publish<T>(topic, message)` it does three things in order:

1. store the latest snapshot for `(type, topic)`,
2. notify publish observers,
3. enqueue the message into the router for that type.

Important implications:

- publish observers see the publish before router delivery drains,
- snapshots update before subscribers run,
- subscribers run only when `message_bus_.drain()` is called.

This is why the engine can quiesce delivery and then run strategy handlers against stable latest state.

### 2. Latest Snapshots

`MessageBus::latest<T>(topic)` is not history. It is only the latest stored value for one `(type, topic)` key.

That means:

- it is great for reading current bars, books, derived indicators, or the latest service snapshot,
- it is not enough for audit, PnL provenance, or execution history,
- it should never be used to fake `/fills` history.

If two fills happen on the same topic, the bus snapshot can only retain the latest one.

### 3. Endpoint Query / Response

The bus also supports request/response style local endpoints:

- `register_endpoint<T>(endpoint, handler)`
- `send(endpoint, message)`
- `register_response_handler(correlation_id, handler)`
- `send_response(correlation_id, response)`

This is how query-style service surfaces are implemented today:

- `query.orders`
- `query.portfolio`

These are synchronous local dispatch points inside the process, not a distributed RPC layer. They are useful because they let the HTTP layer request engine-owned snapshots without reaching into core objects directly from the wrong thread.

### 4. Service Task Queue

The HTTP server is not supposed to mutate engine state directly from its own thread. Instead, it should enqueue a service task and let the engine thread execute it inside `drain_service_tasks()`.

This is the real thread-crossing mechanism for control-plane work.

The sequence is:

1. transport thread receives HTTP request,
2. transport thread calls `Engine::enqueue_service_task(...)`,
3. engine thread executes queued tasks at the end of a clock tick,
4. tasks can use bus endpoints, response handlers, and engine-owned state safely,
5. engine drains bus and interrupts again if those tasks published anything.

This is an important design property:

- engine state is conceptually single-thread owned,
- external transports inject work, they do not directly touch state.

If future REST or WS code bypasses this rule, subtle races will appear.

## Topic Semantics

Topic matching is wildcard-based, but `:` is a hard derived-topic boundary.

Examples:

- `data.bar.aapl.Mock@1m` matches `data.bar.*.Mock@*`
- `data.bar.aapl.Mock@1m:ema20` does not match `data.bar.*.Mock@*`
- `data.bar.aapl.Mock@1m:ema20` matches `data.bar.aapl.Mock@1m:*`

This is a very good rule and should stay. It cleanly separates:

- raw source topics,
- derived analytic topics.

Without this boundary, caches and strategies start accidentally matching both raw and derived streams.

## Interrupt Model

The interrupt controller gives Aurum its strategy execution model.

### Kernel States

The kernel has three visible states:

- `FLOWING`
- `QUIESCING`
- `INTERRUPTING`

These mean:

- `FLOWING`: normal publish/drain/dataflow progression.
- `QUIESCING`: stop and flush the current publish wave so handlers see a stable state.
- `INTERRUPTING`: run strategy handlers for queued triggers.

### Event Triggers

On construction, `InterruptController` registers a publish observer on the bus.

Whenever any message is published:

1. the observer checks all registered event triggers,
2. topic patterns are matched,
3. matching handlers are pushed into the pending activation queue,
4. `interrupt_pending` becomes true.

Important nuance:

- the trigger is based on publish observation, not on subscriber completion,
- the strategy does not run immediately,
- it runs only after the engine enters a quiescent point and calls `process_interrupts()`.

### Cron Triggers

Cron triggers are registered into `Scheduler`.

The scheduler:

- stores cron expressions per handler registration,
- computes next fire timestamps,
- exposes the nearest deadline,
- enqueues due activations into the interrupt controller when the engine reaches or passes that time.

In replay mode, the engine can advance either to the next clock resolution or to the next cron deadline, whichever comes first.

### Why Quiescing Matters

Before running pending interrupts, the engine calls `stabilize_dataflow()`:

- `message_bus_.drain()`
- `runtime_.drain()`
- `message_bus_.drain()`
- `runtime_.drain()`

The exact intent is: flush synchronous bus work and async runtime work until the current wave is stable.

This means strategy handlers should read a much more coherent picture than they would if they fired in the middle of router delivery.

It is also why a debugging question like "why did my strategy read stale cache state?" should start by checking whether the relevant data had actually been published and drained before the interrupt fired.

## Memory Model

This is the most important section for API design and debugging.

### What Lives In Memory Today

| Layer | Owned By | Meaning |
| --- | --- | --- |
| Latest bus snapshots | `MessageBus` | The latest value seen for a `(message type, topic)` pair. |
| Window cache state | `CacheManager` and `CacheAdapter` | Per-topic rolling analytic windows and derived plugin outputs. |
| Order aggregate state | `OrderCache` | Current order state with lookup indexes. |
| Account and position projection | `PortfolioCore` | Current cash account, current positions, and current mark prices. |
| Service query handlers | `MessageBus` | Temporary request/response handlers keyed by correlation id. |
| Pending transport work | `Engine` service task queue | Deferred cross-thread tasks waiting for engine-thread execution. |

### What Does Not Live In Memory Today

There is currently no first-class in-memory store for:

- historical order events,
- fill history,
- execution reports as an append-only ledger,
- account event history,
- position event history,
- a general audit log.

This is the missing fact layer.

### The Most Useful Distinction

You should think in three categories:

1. Fact store
2. Projection store
3. Snapshot cache

In Aurum today:

- `OrderCache` is a projection-like aggregate store for current order state.
- `PortfolioCore` is a projection store for current account and position state.
- `MessageBus::latest()` is a snapshot cache.
- A real fill fact store does not yet exist.

This distinction is the root of many API mistakes. If you expose projections as if they were facts, later debugging becomes painful.

## Order State Versus Fill State

### What `OrderCache` Is Good At

`OrderCache` is a solid compact store for current order state.

It provides:

- primary storage keyed by `client_order_id`,
- secondary lookup by `order_id`,
- secondary lookup by `venue_order_id`,
- deterministic scan order,
- open / closed / all filtering.

This is enough to power:

- `GET /orders`
- `GET /orders/{order_id}`
- order lookup by client id or venue id,
- current order status in UI.

### What `OrderCache` Cannot Answer Well

`OrderCache` cannot answer all fill questions well because it only stores the aggregate order object.

From the order object you can reconstruct some summary:

- total filled quantity,
- average fill price,
- trade ids,
- terminal status,
- timestamps.

But you cannot cleanly answer:

- how many partial fills happened,
- what each fill price was,
- what sequence of fills led to the average,
- which fill changed the position and realized PnL,
- what exactly should `/fills` return.

That is why `OrderCache` should remain what it is: current order state, not execution history.

## End-To-End Execution Flow

This is the current trading path in Aurum.

### Strategy To Order

1. A data or cron trigger activates a program handler.
2. The handler receives a `Context` with:
   - `engine`
   - `exec`
   - `cache`
   - `now_ns`
   - optional trigger metadata
3. The handler calls executor-facing APIs such as order submission.
4. A trading command is published into the bus.

### Risk To Execution

1. `RiskCore` receives the submit command.
2. If approved, it publishes `OrderRiskApproved`.
3. If denied, it publishes `OrderRiskDenied`.
4. `ExecutionCore` subscribes to both.

On approval, `ExecutionCore`:

- assigns a new `order_id`,
- marks the order `SUBMITTED`,
- stores it in `OrderCache`,
- publishes `OrderSubmitted`,
- publishes a generic `OrderEvent`,
- publishes `ExecutionRequest` toward the executor.

On denial, `ExecutionCore`:

- stores a denied order in `OrderCache`,
- publishes `OrderDenied`,
- publishes a generic `OrderEvent`.

### Venue To Order Aggregate

The executor or venue adapter later publishes:

- `VenueOrderAccepted`
- `VenueOrderFilled`

`ExecutionCore` folds these back into the aggregate order:

- bind `venue_order_id`,
- transition status to `ACCEPTED`,
- update `filled_quantity`,
- update `avg_fill_price`,
- append `trade_id`,
- move status to `PARTIALLY_FILLED` or `FILLED`,
- publish `OrderAccepted`, `OrderFilled`, and generic `OrderEvent`.

This is where the current design loses execution history:

- the fill arrives,
- its information is folded into the order aggregate,
- an event is emitted,
- but no dedicated fill ledger keeps the independent fact long-term.

### Mock Venue Behavior

The mock executor makes this especially visible.

On `ExecutionRequest` it immediately publishes:

1. `VenueOrderAccepted`
2. `VenueOrderFilled`

The fill record exists as an event payload, but unless some other component stores it, it only survives indirectly inside:

- aggregate order summary fields,
- position and account projections,
- logs,
- maybe the latest bus snapshot for that topic.

That is not enough for a production-grade execution API.

## Portfolio Projection Flow

`PortfolioCore` subscribes to:

- `event.order.*`
- `data.bar.*`
- `data.depth.*`

Its responsibilities are projection responsibilities, not raw fact storage.

### On Order Submitted

For buy orders, it reserves estimated required cash:

- determine account,
- estimate required cash,
- move available cash into locked cash.

This is projection logic. It is not raw venue truth.

### On Order Filled

When an `OrderEvent` with a fill arrives:

1. account balances are adjusted,
2. position is created or updated,
3. realized PnL is incrementally updated,
4. mark-based unrealized PnL can later move with market data,
5. position timestamps and status are updated.

This means:

- `PortfolioCore` is a current-state projector,
- it depends on fills,
- but it does not retain fill history itself.

If PnL looks wrong, the hard part today is often not position math. The hard part is proving which fills were actually applied in what sequence.

## Cache Windows And Derived Data

Cache windows are a separate memory layer from orders and portfolio.

`CacheAdapter<WindowType>`:

- subscribes to a message pattern,
- auto-creates one window per source topic,
- feeds matching messages into the window,
- publishes plugin outputs back to the bus under derived topics like `:ema10`.

This is important operationally:

- windows are topic-local state,
- they are created lazily on first message,
- they are cleared at engine start,
- derived outputs re-enter normal bus routing.

Because derived topics are normal publishes, they can themselves trigger strategies if patterns match.

## What Aurum Should Learn From Nautilus

Nautilus Trader is useful here mainly as a layering reference.

The valuable lesson is not "copy all of Nautilus".
The valuable lesson is "separate facts, aggregates, projections, and reports."

The layering Aurum should learn is:

1. Order aggregate
2. Fill fact
3. Account / position projection
4. API snapshot / report layer

What Aurum should not do yet:

- add a huge taxonomy of reports just because Nautilus has them,
- introduce persistence or replay machinery before the in-memory model is coherent,
- over-abstract the kernel before the current fact/projection boundaries are fixed.

The compact version of the Nautilus lesson is:

- keep Aurum small,
- stop conflating current state with historical facts.

## The Missing Piece: A Minimal Fill Store

### Short Answer

Yes, fills should be added to engine memory.

Not because the engine needs to be large, but because execution facts are too important to remain transient.

### Why It Is Needed

A fill store would directly improve:

- `/fills` REST support,
- future WS execution streams,
- order debugging,
- position and PnL debugging,
- trade blotter style UI,
- regression tests that need exact execution provenance.

### What It Should Be

It should be minimal and append-only.

The key property is:

- `OrderCache` stores the current aggregate,
- `FillStore` stores the execution facts.

Do not make it responsible for PnL or position math. That stays in `PortfolioCore`.

### Minimal Suggested Shape

At minimum, the stored fill record should let the API answer fills without re-deriving everything from the current order state.

The current `OrderFill` struct is too thin for clean API usage because by itself it does not include fields such as:

- `order_id`
- `instrument_id`
- `account_id`
- `side`
- `executor_name`

You have two reasonable options:

1. Keep `OrderFill` as the raw domain event payload and store an enriched `RecordedFill`.
2. Expand `OrderFill` enough that it can stand as both event payload and storage record.

For a compact kernel, option 1 is cleaner.

Example:

```cpp
struct RecordedFill {
  OrderId order_id{0};
  ClientOrderId client_order_id;
  std::optional<VenueOrderId> venue_order_id;
  std::optional<TradeId> trade_id;

  std::string executor_name;
  InstrumentId instrument_id;
  std::optional<AccountId> account_id;
  OrderSide side{BUY};

  Quantity last_quantity{0.0};
  Price last_price{0.0};
  Timestamp ts_event{0};
};
```

And the store can stay small:

```cpp
class FillStore {
public:
  void append(RecordedFill fill);
  void clear();

  const RecordedFill* find_by_trade_id(const TradeId& trade_id) const noexcept;
  std::vector<const RecordedFill*> all() const noexcept;
  std::vector<const RecordedFill*> by_client_order_id(const ClientOrderId&) const noexcept;
  std::vector<const RecordedFill*> by_order_id(OrderId) const noexcept;
  std::vector<const RecordedFill*> by_account(const AccountId&) const noexcept;
  std::vector<const RecordedFill*> by_instrument(const InstrumentId&) const noexcept;
};
```

This does not force a complex event framework. It just stops losing execution facts.

### Where It Should Be Updated

The natural place to append fills is in `ExecutionCore::on_venue_filled(...)`, exactly where the order aggregate is already being updated.

That gives a clean sequence:

1. venue report arrives,
2. record fill fact in `FillStore`,
3. fold into `OrderCache`,
4. publish `OrderFilled` and `OrderEvent`,
5. let `PortfolioCore` project from the event.

This preserves the fact first, then builds aggregate and projection state from it.

## API Consequences

This section is the practical bridge to REST and future WS design.

### What REST Should Return

REST should expose engine-owned memory that is already stable enough for lookup and snapshot semantics.

Good REST resources:

- `/health`
- `/metadata`
- `/orders`
- `/orders/{order_id}`
- `/fills`
- `/fills/{trade_id}` or `/fills/{fill_id}` if you later define one
- `/positions`
- `/portfolio`
- `/sources`
- `/sources/{source}/instruments`

The rule is:

- REST returns snapshots and query results,
- not high-rate market streams.

### What WS Should Later Stream

WS is a better fit for:

- order event stream,
- fill stream,
- position/account updates,
- PnL deltas,
- market data and derived indicators.

That does not replace REST. It complements it.

The normal model should be:

1. REST for initial snapshot or lookup,
2. WS for incremental updates after subscription.

### Should Orders And PnL Be Queryable Or WS-Only?

They should be queryable.

Reasons:

- a UI needs initial state after page load,
- a debugger or test harness needs point-in-time inspection,
- reconnect logic is simpler with snapshot-plus-stream,
- order state and portfolio state are already stored in memory.

WS-only is a mistake for these resources because it forces every client to rebuild state from stream history.

The right split is:

- orders, fills, positions, portfolio: queryable over REST,
- changes to those resources: streamable over WS.

### Current Limitation

Right now `/fills` is the weakest resource because no dedicated fill memory exists yet.

Until a fill store exists, any `/fills` endpoint is either:

- incomplete,
- synthetic,
- or coupled too tightly to current aggregate order state.

That is the main API gap.

## Practical Debugging Guide

These are the most useful debugging entry points.

### "Why Did My Strategy Not Trigger?"

Check in this order:

1. Was the relevant message actually published?
2. Did the topic match the interrupt trigger pattern?
3. Did the message reach the bus before the interrupt phase?
4. Was the program registered and started?
5. Was the trigger event using a raw topic while the actual publish was on a derived `:` topic, or vice versa?

Common failure modes:

- pattern mismatch,
- unexpected `:` derived-topic boundary,
- handler registered on event topic but looking for a different executor/source suffix,
- assuming immediate callback on publish instead of callback after quiescing.

### "Why Was My Order Denied?"

Start at:

- submit command publish,
- `RiskCore` decision,
- whether `OrderRiskDenied` was emitted,
- whether the order reached `OrderCache` as denied.

If the denial exists in the aggregate but the UI does not show it, the problem is usually in query or serialization. If the denial never exists in `OrderCache`, the issue is upstream in command routing or risk logic.

### "Why Does The Order Look Filled But `/fills` Is Empty Or Useless?"

That is currently expected from the architecture.

The order aggregate stores summary execution state, but the engine has no independent fill ledger yet. This is precisely the gap a minimal `FillStore` should close.

### "Why Does PnL Look Wrong?"

Split the problem into three layers:

1. Was the fill fact correct?
2. Was the fill correctly folded into order state?
3. Was the portfolio projection math correct?

Today layer 1 is the hardest to prove because fill facts are not durably stored in memory. That is why PnL debugging feels less grounded than it should.

### "Why Is An HTTP Snapshot Missing Or Inconsistent?"

Check:

1. Did the HTTP thread enqueue a service task, or did it touch engine state directly?
2. Was the engine running when the task was enqueued?
3. Did the service task execute during `drain_service_tasks()`?
4. Did the query use a bus endpoint and correlation handler correctly?
5. Is the requested data truly stored, or are you asking a latest snapshot cache for historical data?

Most confusing cases come from assuming all engine data is historical when some of it is only current state.

## Performance And Optimization Notes

### Bus Drain Is Wave-Based

`MessageBus::drain()` loops until all routers are empty. That is necessary for re-entrant publishes, but it means one external publish can trigger a large internal wave.

Implications:

- fanout depth matters,
- derived cache publications matter,
- strategy handlers that publish more messages extend the same wave.

When latency spikes, inspect publish cascades, not just the original message.

### Topic Matching Is On The Hot Path

Interrupt publish observation checks event trigger patterns on every publish. If trigger count grows large, matching cost grows with it.

Watch for:

- too many wide wildcard triggers,
- unnecessary derived-topic publications,
- subscriptions that match far more topics than intended.

### Cache Windows Grow Per Topic

Cache adapters auto-create one window per source topic. This is efficient for active topics but can become memory-heavy if topic cardinality explodes.

Watch:

- symbol fanout,
- timeframe fanout,
- unnecessary window attachment on broad patterns.

### Service Task Backlog Affects Control-Plane Latency

HTTP or future WS control-plane work does not run instantly. It waits for the engine tick to drain service tasks.

If control-plane latency feels bad, inspect:

- tick frequency,
- service task volume,
- whether tasks are doing too much work on the engine thread,
- whether queries are copying too much state.

### Snapshot Copy Cost

Query responses like order or portfolio snapshots copy data out of engine stores. This is fine for control-plane APIs, but large scans can become noticeable.

If you later support larger histories:

- pagination,
- filtering,
- and maybe capped retention

will matter.

## Recommended Near-Term Architecture

If the goal is "small kernel, but correct enough to build a professional API on top", the near-term target should be:

1. Keep `MessageBus` as typed pub/sub plus latest snapshot cache.
2. Keep `OrderCache` as current order aggregate state.
3. Keep `PortfolioCore` as current account and position projection.
4. Add a minimal append-only `FillStore`.
5. Make REST read only from these explicit in-memory layers.
6. Make WS later stream deltas from the same layers.

That gets most of the value of a professional backtest engine API without committing to a large framework.

## Final Mental Model

If you remember only one model, use this one:

- `MessageBus` is transport plus latest snapshot.
- `OrderCache` is current order state.
- `FillStore` should become execution fact history.
- `PortfolioCore` is current account and position projection.
- REST should query these stores.
- WS should stream changes to these stores.

That is the clean boundary Aurum currently needs.


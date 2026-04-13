# Order Lifecycle

---

## Order Types

| Type | Description |
|------|-------------|
| `MARKET` | Execute immediately at the best available price |
| `LIMIT` | Execute only at `price` or better |

```cpp
Order o;
o.instrument_id = "aapl";
o.type          = OrderType::MARKET;
o.side          = OrderSide::BUY;
o.quantity      = 100;

// Limit order
Order lmt;
lmt.instrument_id = "aapl";
lmt.type          = OrderType::LIMIT;
lmt.side          = OrderSide::BUY;
lmt.quantity      = 100;
lmt.price         = 185.00;
lmt.tif           = OrderTimeInForce::GTC;
```

---

## Time in Force

| TIF | Valid for | Meaning |
|-----|-----------|---------|
| `GTC` | LIMIT | Good Till Canceled |
| `DAY` | LIMIT | Cancel at end of session |
| `GTD` | LIMIT | Good Till Date |
| `IOC` | MARKET | Immediate Or Cancel |
| `FOK` | MARKET | Fill Or Kill |

**`normalize_order_defaults`** runs before risk validation and fixes common mismatches:

| Order type | Default TIF if unset | Auto-fix |
|------------|---------------------|---------|
| `MARKET` | `IOC` | `GTC → IOC` |
| `LIMIT` | `GTC` | `IOC/FOK → GTC` |

---

## Submitting an Order

```cpp
ctx.exec.submit_order(std::move(order));
```

`submit_order` auto-assigns `client_order_id` if left empty, sets timestamps, and publishes `SubmitOrder` onto the bus. Control returns immediately — the order flows through `RiskCore` asynchronously within the same tick.

---

## Status Flow

```
INITIALIZED
    │
    ├─▶ SUBMITTED    ← ExecutionCore assigns order_id, forwards to venue
    │       │
    │       ├─▶ ACCEPTED     ← venue acknowledged
    │       │       │
    │       │       ├─▶ PARTIALLY_FILLED
    │       │       │         │
    │       │       └─▶ FILLED  (terminal)
    │       │
    │       └─▶ REJECTED     (terminal, venue refused)
    │
    ├─▶ DENIED       (terminal, RiskCore refused — see Risk Validation)
    │
    └─▶ CANCELED / EXPIRED   (terminal)
```

---

## Order Events

Subscribe to `event.order.*` to track the full lifecycle:

```cpp
on(SIGNAL<Event>("event.order.*"), [](Context& ctx) {
    const auto* ev = ctx.engine.message_bus()
                               .latest<message::OrderEvent>(ctx.trigger.source);
    if (!ev) return;

    switch (ev->type) {
        case OrderEventType::ORDER_SUBMITTED:   break;
        case OrderEventType::ORDER_ACCEPTED:    break;
        case OrderEventType::ORDER_DENIED:
            std::cerr << ev->reason << '\n';
            break;
        case OrderEventType::ORDER_FILLED:
            double px = ev->fill->last_price;
            double qty = ev->fill->last_quantity;
            break;
    }
});
```

---

## Reading Order State

Orders are accessible via `ctx.cache` at any point during a handler:

```cpp
// Lookup by client_order_id
const Order* o = ctx.cache.order("my-order-1");

// By engine order_id or venue_order_id
const Order* o = ctx.cache.order_by_id(42);
const Order* o = ctx.cache.order_by_venue_id("venue-abc");

// Scan
for (const Order* o : ctx.cache.orders_open())   { ... }
for (const Order* o : ctx.cache.orders_closed())  { ... }
```

Key `Order` fields:

| Field | Type | Description |
|-------|------|-------------|
| `client_order_id` | `string` | Your identifier |
| `order_id` | `uint64` | Engine-assigned |
| `venue_order_id` | `optional<string>` | Set after venue acceptance |
| `status` | `OrderStatus` | Current lifecycle state |
| `filled_quantity` | `Quantity` | How much has been filled |
| `avg_fill_price` | `optional<Price>` | VWAP of fills so far |
| `ts_init` | `Timestamp` | When order was created |
| `ts_last` | `Timestamp` | Last state transition |

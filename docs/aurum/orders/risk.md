# Risk Validation

`RiskCore` intercepts every `SubmitOrder` command before it reaches the venue. Orders that fail validation are denied immediately; approved orders are forwarded to `ExecutionCore`.

---

## Validation Pipeline

```
ctx.exec.submit_order(order)
  │
  ▼
Executor publishes SubmitOrder → command.order.submit.{executor}
  │
  ▼
RiskCore.on_submit_order()
  ├─ normalize_order_defaults()     fix TIF mismatches
  ├─ check: client_order_id present
  ├─ check: no duplicate in OrderCache
  ├─ check: valid order shape       (qty, TIF, price rules)
  └─ check: sufficient cash         (buy orders only)
  │
  ├─▶ OrderRiskApproved → command.order.execute.{executor}  → ExecutionCore
  └─▶ OrderRiskDenied   → command.order.denied.{executor}   → ExecutionCore
```

---

## Denial Reasons

| Code | Cause |
|------|-------|
| `MISSING_CLIENT_ORDER_ID` | `client_order_id` is empty after executor auto-assignment (should not happen in practice) |
| `DUPLICATE_CLIENT_ORDER_ID` | Same `client_order_id` already exists in `OrderCache` |
| `INVALID_ORDER_SHAPE` | Any of: qty ≤ 0; invalid TIF for order type; MARKET order with a limit price; LIMIT order without a price |
| `INSUFFICIENT_CASH` | Estimated cost of the buy order exceeds `available_cash` in the account |

---

## Valid TIF by Order Type

| Order type | Accepted TIF |
|------------|-------------|
| `MARKET` | `IOC`, `FOK` |
| `LIMIT` | `GTC`, `DAY`, `GTD` |

`normalize_order_defaults` runs first and silently corrects common mistakes (`GTC → IOC` for MARKET, `IOC/FOK → GTC` for LIMIT). Only remaining mismatches after normalization produce `INVALID_ORDER_SHAPE`.

---

## Cash Estimation for Buy Orders

`RiskCore` estimates the cash required for a buy order before approving it:

```
required_cash = quantity × reference_price
```

`reference_price` is:

- the limit `price` if set,
- `100.0` if no price is set (market orders without a price).

The estimate is intentionally conservative for market orders. If the actual fill is cheaper, the difference is released back to `available_cash` after the fill.

---

## Handling Denials in a Program

```cpp
on(SIGNAL<Event>("event.order.*"), [](Context& ctx) {
    const auto* ev = ctx.engine.message_bus()
                               .latest<message::OrderEvent>(ctx.trigger.source);
    if (!ev || ev->type != OrderEventType::ORDER_DENIED) return;

    std::cerr << "Order denied: " << ev->reason << '\n';
    // ev->reason is a string matching one of the denial codes above
});
```

Denied orders are stored in `OrderCache` with status `DENIED` and are queryable via `ctx.cache.order(client_order_id)`.

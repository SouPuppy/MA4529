# Positions

`PortfolioCore` tracks one `Position` per `(account_id, instrument_id)` pair using a **NETTING** model — all fills for the same instrument accumulate into a single position that can be LONG or SHORT.

---

## Position Fields

```cpp
struct Position {
    PositionId   position_id;       // "{account_id}:{instrument_id}"
    AccountId    account_id;        // "DEFAULT"
    InstrumentId instrument_id;     // "aapl"

    PositionSide   side;            // LONG | SHORT
    PositionStatus status;          // OPEN | CLOSED

    Quantity quantity;              // current absolute size
    Price    avg_open_price;        // VWAP of opening fills

    Decimal  realized_pnl;         // accumulated realized gain/loss
    Decimal  unrealized_pnl;       // mark-to-market; only valid in snapshots

    Timestamp ts_opened;
    Timestamp ts_last;

    bool is_open() const { return status == OPEN && quantity > 0.0; }
};
```

---

## NETTING Model — apply_fill Logic

Every fill updates the position according to these rules:

### New position

If no open position exists for the instrument:

```
side           = fill.side (BUY → LONG, SELL → SHORT)
quantity       = fill.quantity
avg_open_price = fill.price
status         = OPEN
```

### Same-side fill (adding to position)

```
avg_open_price = (existing_qty × avg_open_price + fill_qty × fill_price)
                 / (existing_qty + fill_qty)     ← VWAP
quantity      += fill_qty
```

### Opposite-side fill (partial close)

```
closing_qty    = min(fill_qty, existing_qty)
realized_pnl  += closing_qty × (fill_price - avg_open_price) × sign
                 where sign = +1 for LONG, -1 for SHORT
quantity      -= closing_qty
```

If `fill_qty > existing_qty` the position **flips**:

```
remaining_qty  = fill_qty - existing_qty
side           = opposite side
quantity       = remaining_qty
avg_open_price = fill_price   ← new avg for the flipped position
```

### Full close

```
quantity       = 0
status         = CLOSED
```

---

## Unrealized PnL & Mark Prices

`unrealized_pnl` is **not** updated continuously — it is only computed on demand at snapshot time using the latest mark price.

**Mark price sources:**

| Data | How PortfolioCore uses it |
|------|--------------------------|
| `UpdateBar` | `close` price of the bar becomes the mark price for that instrument |
| `UpdateBook` | mid-price `(best_bid + best_ask) / 2` becomes the mark price |

`PortfolioCore` subscribes to both `data.bar.*` and `data.depth.*`. Whichever arrives last for an instrument sets the mark price.

At snapshot time (e.g., REST `/portfolio` or a query from a program):

```
unrealized_pnl = (mark_price - avg_open_price) × quantity × sign
                 where sign = +1 for LONG, -1 for SHORT
```

---

## Reading Positions in a Handler

```cpp
// Single position
const auto* pos = ctx.cache.position("DEFAULT", "aapl");
if (pos && pos->is_open()) {
    double qty  = pos->quantity;
    double avg  = pos->avg_open_price;
    double rpnl = pos->realized_pnl;
    // unrealized_pnl here reflects the last snapshot computation,
    // not a live mark — read it from a REST /portfolio call for current mark
}
```

`ctx.cache.position()` returns the live in-memory projection; `unrealized_pnl` in this struct may lag behind the latest mark price. The REST endpoint always recomputes it before responding.

---

## REST Snapshot

```json
{
  "positions": [
    {
      "position_id": "DEFAULT:aapl",
      "account_id": "DEFAULT",
      "instrument_id": "aapl",
      "side": "LONG",
      "status": "OPEN",
      "quantity": 100.0,
      "avg_open_price": 185.00,
      "realized_pnl": 0.0,
      "unrealized_pnl": 250.0,
      "ts_opened": 1712000000000000000,
      "ts_last":   1712001000000000000
    }
  ]
}
```

See [REST API](../restful-api.md) for full schema.

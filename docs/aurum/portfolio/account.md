# Cash Accounts

`PortfolioCore` maintains a `CashAccount` for each account in the engine. On engine start, a default account is created automatically.

---

## Default Account

```cpp
CashAccount{
    .account_id     = "DEFAULT",
    .currency       = "USD",
    .total_cash     = 1'000'000.0,
    .available_cash = 1'000'000.0,
    .locked_cash    = 0.0,
}
```

The default account is reset to these values every time the engine starts (including replay runs).

---

## CashAccount Fields

```cpp
struct CashAccount {
    AccountId account_id;    // "DEFAULT"
    std::string currency;    // "USD"
    Decimal total_cash;      // total = available + locked
    Decimal available_cash;  // usable for new orders
    Decimal locked_cash;     // reserved for open buy orders
};
```

**Invariant:** `total_cash == available_cash + locked_cash` at all times.

---

## Cash Flow Lifecycle

Cash moves through three operations tied to the order lifecycle:

### 1. BUY order submitted → `reserve(amount)`

When `RiskCore` approves a buy order, `PortfolioCore` calls `reserve` to move cash from available to locked:

```
available_cash -= amount
locked_cash    += amount
total_cash      unchanged
```

The reserved amount is the estimated order cost:

```
amount = quantity × reference_price
```

`reference_price` is the limit price if set, or `100.0` for market orders without a price.

### 2. BUY order filled → `spend_locked(amount)`

When a fill arrives for a buy order, `PortfolioCore` calls `spend_locked` for the actual fill cost:

```
locked_cash  -= fill_cost
total_cash   -= fill_cost
available_cash unchanged
```

If the actual fill cost is less than what was reserved, the remainder stays locked until the order closes, then is released.

### 3. SELL order filled → `credit(amount)`

When a fill arrives for a sell order, `PortfolioCore` calls `credit` for the fill proceeds:

```
available_cash += fill_proceeds
total_cash     += fill_proceeds
locked_cash     unchanged
```

---

## Reading Account State in a Handler

```cpp
// Default account
const auto* acct = ctx.cache.default_account();
if (acct) {
    double available = acct->available_cash;
    double locked    = acct->locked_cash;
    double total     = acct->total_cash;
}

// Named account
const auto* acct = ctx.cache.account("MY_ACCOUNT");
```

---

## REST Snapshot

The `/portfolio` endpoint returns the current account state:

```json
{
  "account": {
    "account_id": "DEFAULT",
    "currency": "USD",
    "total_cash": 999900.0,
    "available_cash": 999900.0,
    "locked_cash": 0.0
  }
}
```

See [REST API](../restful-api.md) for full response schema.

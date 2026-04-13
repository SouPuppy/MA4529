# Aurum Engine RESTful API

## Overview

Aurum `Engine` can expose an HTTP control-plane API through `Engine::serve()`.
The HTTP server is attached to the engine lifecycle:

- Call `engine.serve()` or `engine.serve(config)` before `run()` / `replay()`.
- The HTTP server starts when the engine starts.
- The HTTP server stops when the engine stops.

Example:

```cpp
#include <aurum/aurum.h>

int main() {
  aurum::Engine engine;

  engine.serve({
      .host = "0.0.0.0",
      .port = 8080,
      .base_path = "/api/v1",
  });

  engine.run(clock);
}
```

With the configuration above, all routes are served under:

```text
http://<host>:8080/api/v1
```

## HTTP Configuration

`Engine::HttpConfig` fields:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `host` | `std::string` | `"0.0.0.0"` | Bind address for the HTTP server. |
| `port` | `int` | `0` | Listen port. `0` means "bind any available port". |
| `base_path` | `std::string` | `""` | Optional common prefix for all routes, for example `"/api/v1"`. |

### Base Path Rules

- Empty string and `"/"` both mean "serve at root".
- If `base_path` does not start with `/`, one is added automatically.
- Trailing `/` is removed, except for root.

Examples:

| Configured `base_path` | Effective route prefix |
| --- | --- |
| `""` | `""` |
| `"/"` | `""` |
| `"api/v1"` | `"/api/v1"` |
| `"/api/v1/"` | `"/api/v1"` |

## Endpoint Summary

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check endpoint. |
| `GET` | `/portfolio` | Query account and position snapshot. |
| `GET` | `/orders` | Query order snapshot. |
| `GET` | `/sources` | List auto-discovered data sources. |
| `GET` | `/sources/{source}/instruments` | List instruments and channels under a source. |
| `GET` | `/sources/{source}/instruments/{instrument}/channels/{channel}` | Query the discovered schema descriptor for a specific channel. |

All responses are JSON.

## Common Error Format

All error responses use the same envelope:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "human readable message"
  }
}
```

## Endpoints

### `GET /health`

Simple transport-level health endpoint.

#### Response

```json
{
  "status": "ok",
  "transport": "http"
}
```

#### Notes

- This endpoint does not query engine state.
- It is suitable for liveness checks.

### `GET /portfolio`

Returns the current portfolio snapshot.

#### Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `account_id` | `string` | No | Restrict the response to one account. |

#### Success Response

```json
{
  "account_id": "DEFAULT",
  "account": {
    "account_id": "DEFAULT",
    "currency": "USD",
    "total_cash": 999900.0,
    "available_cash": 999900.0,
    "locked_cash": 0.0
  },
  "positions": [
    {
      "position_id": "DEFAULT:AAPL",
      "account_id": "DEFAULT",
      "instrument_id": "AAPL",
      "side": "LONG",
      "status": "OPEN",
      "quantity": 1.0,
      "avg_open_price": 100.0,
      "realized_pnl": 0.0,
      "unrealized_pnl": 0.0,
      "ts_opened": 1234567890,
      "ts_last": 1234567890
    }
  ],
  "ts_event": 1234567890
}
```

#### Response Fields

Top-level fields:

| Field | Type | Description |
| --- | --- | --- |
| `account_id` | `string \| null` | Queried account id, or default account id. |
| `account` | `object \| null` | Cash-account snapshot. |
| `positions` | `array` | Position snapshots for the selected account. |
| `ts_event` | `number` | Snapshot event timestamp in nanoseconds. |

`account` fields:

| Field | Type | Description |
| --- | --- | --- |
| `account_id` | `string` | Account identifier. |
| `currency` | `string` | Account currency. |
| `total_cash` | `number` | Total cash balance. |
| `available_cash` | `number` | Available cash balance. |
| `locked_cash` | `number` | Reserved cash balance. |

`positions[]` fields:

| Field | Type | Description |
| --- | --- | --- |
| `position_id` | `string` | Position identifier. |
| `account_id` | `string` | Owning account id. |
| `instrument_id` | `string` | Instrument identifier. |
| `side` | `string` | `LONG` or `SHORT`. |
| `status` | `string` | `OPEN` or `CLOSED`. |
| `quantity` | `number` | Current position quantity. |
| `avg_open_price` | `number` | Average open price. |
| `realized_pnl` | `number` | Realized PnL. |
| `unrealized_pnl` | `number` | Unrealized PnL. |
| `ts_opened` | `number` | Position open timestamp in nanoseconds. |
| `ts_last` | `number` | Last update timestamp in nanoseconds. |

#### Error Responses

| Status | Code | Meaning |
| --- | --- | --- |
| `404` | `ACCOUNT_NOT_FOUND` | The requested `account_id` does not exist. |
| `503` | `PORTFOLIO_QUERY_UNAVAILABLE` | Portfolio query endpoint is unavailable. |

### `GET /orders`

Returns order snapshots.

#### Query Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `string` | No | One of `all`, `open`, `closed`. |
| `client_order_id` | `string` | No | Lookup by client order id. |
| `order_id` | `uint64` | No | Lookup by engine order id. |
| `venue_order_id` | `string` | No | Lookup by venue order id. |

#### Lookup Rules

- If none of `client_order_id`, `order_id`, or `venue_order_id` is provided, the endpoint returns a list query.
- If any lookup field is provided and no order matches, the endpoint returns `404 ORDER_NOT_FOUND`.

#### Success Response

```json
{
  "status": "all",
  "count": 1,
  "orders": [
    {
      "client_order_id": "mock-1",
      "order_id": 1,
      "venue_order_id": "venue-1",
      "instrument_id": "AAPL",
      "account_id": "DEFAULT",
      "type": "MARKET",
      "side": "BUY",
      "status": "FILLED",
      "tif": "IOC",
      "quantity": 1.0,
      "filled_quantity": 1.0,
      "leaves_quantity": 0.0,
      "price": null,
      "avg_fill_price": 100.0,
      "ts_init": 1234567890,
      "ts_last": 1234567890
    }
  ]
}
```

#### Response Fields

Top-level fields:

| Field | Type | Description |
| --- | --- | --- |
| `status` | `string` | Echoes the requested filter, defaults to `all`. |
| `count` | `number` | Number of returned orders. |
| `orders` | `array` | Order snapshots. |

`orders[]` fields:

| Field | Type | Description |
| --- | --- | --- |
| `client_order_id` | `string` | Client-assigned order id. |
| `order_id` | `number` | Engine order id. |
| `venue_order_id` | `string \| null` | Venue-assigned order id. |
| `instrument_id` | `string` | Instrument identifier. |
| `account_id` | `string \| null` | Owning account id. |
| `type` | `string` | `MARKET` or `LIMIT`. |
| `side` | `string` | `BUY` or `SELL`. |
| `status` | `string` | Engine order status. |
| `tif` | `string` | Time in force, such as `GTC`, `IOC`, `FOK`. |
| `quantity` | `number` | Original order quantity. |
| `filled_quantity` | `number` | Filled quantity. |
| `leaves_quantity` | `number` | Remaining quantity. |
| `price` | `number \| null` | Limit price, or `null` for market orders. |
| `avg_fill_price` | `number \| null` | Average fill price. |
| `ts_init` | `number` | Initial timestamp in nanoseconds. |
| `ts_last` | `number` | Last update timestamp in nanoseconds. |

#### Error Responses

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `INVALID_ORDER_STATUS` | `status` must be one of `all`, `open`, `closed`. |
| `400` | `INVALID_ORDER_ID` | `order_id` must be an unsigned integer. |
| `404` | `ORDER_NOT_FOUND` | No order matched the lookup query. |
| `503` | `ORDERS_QUERY_UNAVAILABLE` | Orders query endpoint is unavailable. |

### `GET /sources`

Returns all auto-discovered sources.

#### Discovery Behavior

- Sources are discovered from runtime-published `data.*` topics.
- A source will not appear until at least one relevant topic has been published.
- Known venue names such as `Mock`, `Binance`, and `OKX` are classified as `exchange`; unknown names default to `custom`.

#### Success Response

```json
{
  "sources": [
    {
      "id": "Mock",
      "type": "exchange"
    },
    {
      "id": "Custom#2",
      "type": "database"
    }
  ]
}
```

#### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `sources` | `array` | Source list. |

`sources[]` fields:

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Source identifier. |
| `type` | `string` | Source type, such as `exchange`, `database`, or `custom`. |

#### Error Responses

| Status | Code | Meaning |
| --- | --- | --- |
| `503` | `SOURCES_QUERY_UNAVAILABLE` | Sources query endpoint is unavailable. |

### `GET /sources/{source}/instruments`

Returns all instruments currently discovered under a source.

#### Path Parameters

| Name | Type | Description |
| --- | --- | --- |
| `source` | `string` | Source identifier. |

#### Success Response

```json
{
  "source": "Mock",
  "instruments": [
    {
      "name": "aapl",
      "channels": ["bar"]
    }
  ]
}
```

#### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `source` | `string` | Source identifier. |
| `instruments` | `array` | Instrument list. |

`instruments[]` fields:

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | Canonical instrument name. Instruments are normalized to lowercase. |
| `channels` | `array[string]` | Channels available for the instrument. |

#### Error Responses

| Status | Code | Meaning |
| --- | --- | --- |
| `404` | `SOURCE_NOT_FOUND` | The requested source does not exist. |
| `503` | `INSTRUMENTS_QUERY_UNAVAILABLE` | Source instruments query endpoint is unavailable. |

### `GET /sources/{source}/instruments/{instrument}/channels/{channel}`

Returns the discovered schema descriptor for a channel under a source and instrument.

#### Path Parameters

| Name | Type | Description |
| --- | --- | --- |
| `source` | `string` | Source identifier. |
| `instrument` | `string` | Instrument identifier. Case is normalized internally. |
| `channel` | `string` | Channel name, for example `bar` or `depth`. |

#### Success Response

```json
{
  "source": "Mock",
  "instrument": "aapl",
  "channel": "bar",
  "derived": ["sma5"],
  "params": {
    "interval": ["500ms"]
  }
}
```

#### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `source` | `string` | Source identifier. |
| `instrument` | `string` | Canonical instrument name in lowercase. |
| `channel` | `string` | Channel name. |
| `derived` | `array[string]` | Derived series registered for this channel. |
| `params` | `object` | Channel parameter sets keyed by parameter name. |

Typical `params` keys:

| Channel | Param Key |
| --- | --- |
| `bar` | `interval` |
| `depth` | `level` |
| other | `param` |

#### Error Responses

| Status | Code | Meaning |
| --- | --- | --- |
| `404` | `CHANNEL_SCHEMA_NOT_FOUND` | No matching source / instrument / channel schema was found. |
| `503` | `CHANNEL_SCHEMA_QUERY_UNAVAILABLE` | Channel schema query endpoint is unavailable. |

## HTTP Status Codes

The current API uses the following HTTP status codes:

| Status | Meaning |
| --- | --- |
| `200` | Request succeeded. |
| `400` | Invalid client parameters. |
| `404` | Route or requested resource not found. |
| `503` | Engine-side query endpoint unavailable or timed out. |

## Route Not Found

Unknown routes return:

```json
{
  "error": {
    "code": "HTTP_ROUTE_NOT_FOUND",
    "message": "route not found"
  }
}
```

## Operational Notes

- The HTTP layer is read-only. It exposes snapshots and catalog views; it does not submit commands.
- Query endpoints are executed on the engine service-task path, not directly on the HTTP worker thread.
- `GET /sources/...` catalog entries are populated automatically from observed runtime data topics and derived runtime outputs.
- There is no manual public catalog registration API on `Engine`; source and channel entries appear only after relevant topics are published.
- Source instrument names are normalized to lowercase in catalog responses.
- If `port = 0`, the actual listen port is assigned by the OS. The bound port can be inspected from `engine.http_server()->bound_port()` after the engine starts.

# Lyra WebSocket API

## Overview

`lyrad` exposes a WebSocket API for real-time market-data subscriptions.  Clients
connect to a running project and subscribe to data topics by key.  The server
fans out live engine messages — OHLCV bars, order-book updates, and derived
scalars — to all subscribed sessions.

The same TCP port serves both the HTTP control API and the WebSocket API.  A
standard HTTP `Upgrade` request on the path `/ws/<project-id>/` initiates the
WebSocket handshake.

```text
ws://host:port/ws/{project-id}/
```

All messages are UTF-8 text frames.  No binary framing or special envelope is
used.

---

## Topic Key Format

Every subscription is identified by a **topic key** — a string that mirrors the
aurum engine's internal `MessageBus` topic, minus the leading `data.` prefix.

```text
{channel}.{symbol}.{venue}@{param}[:{derived}]
```

| Segment | Description |
| --- | --- |
| `channel` | Data channel: `bar` or `depth` |
| `symbol` | Instrument symbol, normalized to lowercase |
| `venue` | Exchange or data source name, case-preserved |
| `param` | Channel parameter (bar interval or depth level count) |
| `derived` | Optional derived series name, e.g. `mid_price` |

The `@param` part is required for `bar` and `depth` channels.  The `:derived`
suffix is optional.

**Examples:**

| Key | Meaning |
| --- | --- |
| `bar.btcusdt.Binance@1m` | BTC/USDT 1-minute bars from Binance |
| `bar.btcusdt.Binance@5m` | BTC/USDT 5-minute bars from Binance |
| `bar.ethusdt.OKX@1h` | ETH/USDT 1-hour bars from OKX |
| `depth.btcusdt.Binance@20` | BTC/USDT order book, top 20 levels, from Binance |
| `depth.btcusdt.Binance@20:mid_price` | Mid-price derived from the BTC/USDT order book |

**Translation rule:** a topic key maps to an engine `MessageBus` topic by
prepending `data.`:

```text
engine topic = "data." + ws_key
```

### Derived Keys

Keys with a `:derived` suffix (e.g. `depth.btcusdt.Binance@20:mid_price`) carry
a scalar `double` value computed by a window plugin.  Their push messages use
`"type": "data.scalar"` instead of the depth snapshot/update types.

Derived keys are enumerated by `ALL` once the engine has produced at least one
value.  They do **not** support `RESYNC` (no snapshot store — only the latest
value is pushed on each tick).

---

## Client → Server Messages

All client messages share a common structure.

### Request

```json
{
  "id": 1,
  "method": "SUBSCRIBE",
  "keys": ["bar.btcusdt.Binance@1m", "depth.btcusdt.Binance@20", "depth.btcusdt.Binance@20:mid_price"]
}
```

#### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `number` | No | Optional correlation id.  Echoed back in every server response to this request. |
| `method` | `string` | Yes | One of `SUBSCRIBE`, `UNSUBSCRIBE`, `LIST`, `ALL`, `RESYNC`. |
| `keys` | `array[string]` | Depends | List of topic keys the method applies to.  Required for `SUBSCRIBE`, `UNSUBSCRIBE`, and `RESYNC`.  Must be omitted or empty for `LIST` and `ALL`. |

---

## Server → Client: Acknowledgements

Every method produces exactly one acknowledgement message in reply.  If `id`
was present in the request, it is echoed in the response.

### SUBSCRIBE and UNSUBSCRIBE: `WsAck`

```json
{
  "id": 1,
  "type": "ack",
  "method": "SUBSCRIBE",
  "results": [
    {"key": "bar.btcusdt.Binance@1m"},
    {"key": "depth.btcusdt.Binance@20"},
    {"key": "depth.btcusdt.Binance@20:mid_price"},
    {"key": "depth.btcusdt.Binance@bad", "code": 400, "msg": "invalid key format"}
  ]
}
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `number` | Echoed correlation id, if provided in the request. |
| `type` | `string` | Always `"ack"`. |
| `method` | `string` | Echoed method name (`SUBSCRIBE` or `UNSUBSCRIBE`). |
| `results` | `array` | One entry per requested key, in request order. |

#### `results[]` entry fields

| Field | Type | Description |
| --- | --- | --- |
| `key` | `string` | The topic key this result applies to. |
| `code` | `number` | Absent (0) means the key was accepted.  Non-zero is an HTTP-style error code. |
| `msg` | `string` | Human-readable error reason.  Only present when `code` is non-zero. |

**Reading the result:** iterate `results` once.  If `code` is absent or `0`, the
key was accepted.  Otherwise the key was rejected and `msg` explains why.

---

### LIST: `WsListAck`

Returns this session's active subscriptions.

```json
{
  "id": 2,
  "type": "ack",
  "method": "LIST",
  "subscriptions": [
    "bar.btcusdt.Binance@1m",
    "depth.btcusdt.Binance@20",
    "depth.btcusdt.Binance@20:mid_price"
  ]
}
```

An empty session returns an empty array, never an absent field:

```json
{"type": "ack", "method": "LIST", "subscriptions": []}
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `number` | Echoed correlation id, if provided. |
| `type` | `string` | Always `"ack"`. |
| `method` | `string` | Always `"LIST"`. |
| `subscriptions` | `array[string]` | All active topic keys for this session. |

---

### ALL: `WsAllAck`

Returns every data topic currently cached in the engine's snapshot store.
This is the full universe of subscribable keys — populated at runtime as data
flows through the engine, not from a static catalog.

```json
{
  "id": 3,
  "type": "ack",
  "method": "ALL",
  "keys": [
    "bar.btcusdt.Binance@1m",
    "depth.btcusdt.Binance@20",
    "depth.btcusdt.Binance@20:mid_price"
  ]
}
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `number` | Echoed correlation id, if provided. |
| `type` | `string` | Always `"ack"`. |
| `method` | `string` | Always `"ALL"`. |
| `keys` | `array[string]` | All topic keys the engine currently has cached snapshots for. |

#### Notes

- A key appears in `ALL` only after the engine has published at least one message on that topic.
- `ALL` reflects the snapshot store at the moment of the request; it is not a live feed.
- Subscribe to any key from this list with `SUBSCRIBE`.

---

### RESYNC

Re-sends the latest depth snapshot for each requested key directly to this
session.  Only valid for **raw** `depth.*` keys (no `:derived` suffix).

**Request:**

```json
{"id": 5, "method": "RESYNC", "keys": ["depth.btcusdt.Binance@20"]}
```

**On success:** a `DepthSnapshotPush` is sent (see [Depth Snapshot](#depth-snapshot-datadepthsnapshot)).

**On error per key:**

```json
{"id": 5, "type": "error", "code": 404, "msg": "no snapshot available yet for: depth.btcusdt.Binance@20"}
```

```json
{"id": 5, "type": "error", "code": 400, "msg": "RESYNC only valid for raw depth.* keys"}
```

---

### Error Response: `WsError`

Returned for protocol-level failures — malformed requests, unknown methods, or
missing required fields.  Per-key errors within a valid request use the inline
`code`/`msg` fields in `WsAck` instead.

```json
{
  "id": 1,
  "type": "error",
  "code": 400,
  "msg": "SUBSCRIBE requires keys"
}
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `number` | Echoed correlation id, if the request was parseable enough to extract one. |
| `type` | `string` | Always `"error"`. |
| `code` | `number` | HTTP-style error code. |
| `msg` | `string` | Human-readable description. |

#### Protocol-Level Error Codes

| Code | Cause |
| --- | --- |
| `400` | Missing or invalid `method` field, missing `keys` for a method that requires them, unknown method name, or RESYNC on a derived key. |
| `404` | No snapshot available for the requested key (RESYNC only). |

---

## Server → Client: Data Pushes

After a successful `SUBSCRIBE`, the server streams messages to the client
whenever the engine publishes new data on a subscribed topic.  Each push
message carries a `type` field that the client should use to dispatch:

| `type` | Description |
| --- | --- |
| `data.bar` | OHLCV bar update |
| `data.depth.snapshot` | Full order-book snapshot |
| `data.depth.update` | Incremental order-book delta |
| `data.scalar` | Derived scalar value (e.g. mid-price) |

---

### Bar (`data.bar`)

Sent on every bar close for subscribed `bar.*` keys.

```json
{
  "type": "data.bar",
  "key": "bar.btcusdt.Binance@1m",
  "timestamp": 1700000060000,
  "data": {
    "scope": [1700000000000, 1700000060000],
    "ohlcv": ["67000.00", "67050.00", "66990.00", "67020.00", "12.345"]
  }
}
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `type` | `string` | Always `"data.bar"`. |
| `key` | `string` | The subscribed topic key. |
| `timestamp` | `number` | Bar close timestamp, milliseconds since Unix epoch. |
| `data` | `object` | Bar payload. |

`data` fields:

| Field | Type | Description |
| --- | --- | --- |
| `scope` | `array[number]` | Two-element array: `[start_ms, end_ms]` — the bar's time range. |
| `ohlcv` | `array[string]` | Five decimal strings: `[open, high, low, close, volume]`. |

Prices and volumes are decimal strings to preserve precision.

---

### Depth Snapshot (`data.depth.snapshot`)

Sent when a client first subscribes to a `depth.*` key and when `RESYNC` is
called.  A snapshot carries the complete order book at the given sequence.

```json
{
  "type": "data.depth.snapshot",
  "key": "depth.btcusdt.Binance@20",
  "sequence": 42,
  "data": {
    "ts": 1700000000000,
    "bids": [
      ["67000.00", "1.500"],
      ["66999.00", "3.200"]
    ],
    "asks": [
      ["67001.00", "0.800"],
      ["67002.00", "2.100"]
    ]
  }
}
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `type` | `string` | Always `"data.depth.snapshot"`. |
| `key` | `string` | The subscribed topic key. |
| `sequence` | `number` | Monotonically increasing sequence number.  Never resets. |
| `data` | `object` | Order-book payload. |

`data` fields:

| Field | Type | Description |
| --- | --- | --- |
| `ts` | `number` | Exchange timestamp, milliseconds since Unix epoch. |
| `bids` | `array` | Bid levels, best bid first.  Each entry is `["price", "size"]`. |
| `asks` | `array` | Ask levels, best ask first.  Each entry is `["price", "size"]`. |

Each `bids` / `asks` entry is a two-element array `["price", "size"]` where both
values are decimal strings.

---

### Depth Update (`data.depth.update`)

Sent on every tick after the initial snapshot, carrying only the **changed
levels** (diff from previous state).

```json
{
  "type": "data.depth.update",
  "key": "depth.btcusdt.Binance@20",
  "sequence": 43,
  "data": {
    "ts": 1700000000100,
    "bids": [["67000.00", "2.000"]],
    "asks": [["67001.00", "0"]]
  }
}
```

The fields are identical to `data.depth.snapshot`.

#### Applying Deltas

- For each entry in `bids` / `asks`: replace the size at that price level in your local book.
- A size of `"0"` means **remove** the level entirely.
- Price levels absent from the update are unchanged.

#### Sequence Integrity

Sequence numbers increment by one on every message (both snapshots and
updates) and never reset.  If a gap is detected, local book state is
inconsistent and a resync is required:

```json
{"method": "RESYNC", "keys": ["depth.btcusdt.Binance@20"]}
```

---

### Scalar (`data.scalar`)

Sent on every engine tick for subscribed keys with a `:derived` suffix.
The value is a computed scalar (e.g. mid-price from the order book).

```json
{
  "type": "data.scalar",
  "key": "depth.btcusdt.Binance@20:mid_price",
  "timestamp": 1700000000000,
  "value": 67000.5
}
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `type` | `string` | Always `"data.scalar"`. |
| `key` | `string` | The subscribed topic key. |
| `timestamp` | `number` | Server dispatch timestamp, milliseconds since Unix epoch. |
| `value` | `number` | The computed scalar value. |

`value` is a JSON number (not a quoted string) — derived scalars do not require
the same decimal-precision treatment as raw prices.

`RESYNC` is not supported for scalar keys.  The latest value is re-delivered
automatically on the next engine tick.

---

## Session Lifecycle

1. **Connect** — open a WebSocket connection to `ws://host:port/ws/{project-id}/`.
2. **Discover** — optionally send `ALL` to enumerate available topic keys.
3. **Subscribe** — send `SUBSCRIBE` with the desired keys.  Successful keys
   immediately start receiving push messages.
4. **Receive** — handle incoming `data.bar`, `data.depth.snapshot`,
   `data.depth.update`, and `data.scalar` frames.
5. **Inspect** — send `LIST` at any time to see this session's active
   subscriptions.
6. **Resync** — send `RESYNC` to request a fresh depth snapshot when a sequence
   gap is detected (raw `depth.*` keys only).
7. **Unsubscribe** — send `UNSUBSCRIBE` to cancel individual keys.
8. **Disconnect** — close the connection.  All subscriptions for this session
   are automatically cleaned up.

### Notes

- Each WebSocket connection is an independent session with its own subscription
  set.  Subscriptions are not shared between connections.
- Multiple sessions may subscribe to the same key simultaneously.  The engine
  registers only one `MessageBus` subscription per unique key regardless of
  how many sessions are subscribed.
- The first subscriber to a key causes the engine-side bus subscription to be
  registered.  The last unsubscriber causes it to be removed.
- For raw `depth.*` keys: book state is maintained per key in the server.  If
  the engine already has data when `SUBSCRIBE` is processed, a
  `data.depth.snapshot` is sent immediately after the ACK.
- For `depth.*:derived` keys: no snapshot is stored.  The latest value is
  pushed on the next engine tick after `SUBSCRIBE`.
- If `lyrad` shuts down, all WebSocket connections are closed gracefully.

---

## Quick Reference

### Methods

| Method | `keys` required | Response type |
| --- | --- | --- |
| `SUBSCRIBE` | Yes | `WsAck` (type `"ack"`, method `"SUBSCRIBE"`) |
| `UNSUBSCRIBE` | Yes | `WsAck` (type `"ack"`, method `"UNSUBSCRIBE"`) |
| `LIST` | No | `WsListAck` (type `"ack"`, method `"LIST"`) |
| `ALL` | No | `WsAllAck` (type `"ack"`, method `"ALL"`) |
| `RESYNC` | Yes (raw `depth.*` only) | `DepthSnapshotPush` per key, or `WsError` per key |

### Incoming Message Discriminant

| `type` field | Meaning |
| --- | --- |
| `"ack"` | Acknowledgement — check `method` to determine which command |
| `"error"` | Protocol-level error |
| `"data.bar"` | Bar push |
| `"data.depth.snapshot"` | Full order-book snapshot |
| `"data.depth.update"` | Incremental order-book delta |
| `"data.scalar"` | Derived scalar value (e.g. mid-price) |

### Key Routing Summary

| Key pattern | Bus message type | Push type |
| --- | --- | --- |
| `bar.*@*` | `UpdateBar` | `data.bar` |
| `depth.*@*` | `UpdateBook` | `data.depth.snapshot` / `data.depth.update` |
| `depth.*@*:suffix` | `double` | `data.scalar` |

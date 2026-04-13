# Pipeline

Loom's pipeline is a **dataflow graph**: values flow in via `<<` or `receive`, and are transformed or sunk via `>>`. Two modes: **sync** (no threads, immediate dispatch) and **async** (Runtime + Strands).

## Concepts (structural)

| Concept | Meaning |
|---------|---------|
| **StreamIn** | Receives values via `operator<<(value)`. |
| **StreamOut** | Can be subscribed via `operator>>(callable)`. |
| **Stream** | Either StreamIn or StreamOut (one direction). |
| **Hub** | Both StreamIn and StreamOut (full node). `Origin<T>` and `Hub<T>` satisfy Hub. |

Defined in `loom/core/pipeline/concepts.h`; no virtuals, constraint-only.

## Building blocks

| Type | Role | Dispatch |
|------|------|----------|
| **Origin<T>** | Pipeline **entry**. You push with `<<`; all downstream runs on the calling thread. | Sync |
| **Pipe<U>** | Chainable **segment**. Typed by value at this stage (output of previous). `>>` adds sink or transform; next type is deduced. | Sync |
| **Stream<T>** | Async stream. Needs a **Runtime**. Receives via `receive`/`emit`; `>>` attaches transform or sink and runs work on Strands. | Async |
| **StreamRef<U>** | Non-owning handle to a `Stream<U>`; supports `>>` like Stream. | Async |
| **Hub<T>** | Async **node** (extends `Stream<T>`). `<<` emits to listeners; `>>` chains new pipelines. Pipelines can **sink into** a Hub and **manifold out** from it. | Async |

- **Task** = `Stream<void>` (subscription handle, no value type).
- **Runtime**: thread pool + task queue; Stream/Hub hold a pointer and schedule work with it.

## Pipeline shapes

### Sync (Origin + Pipe)

- **Entry**: only `Origin<T>` (no Runtime).
- **Chain**: `Origin >> transform >> ... >> sink` or `... >> Pipe<U> >> ...`. Each `>>` is either a void sink or a callable T to U; the next stage type is deduced.
- **Feed**: `origin << value` runs the whole chain on the current thread.

```
Origin<T>  >>  [transform]  >>  [transform]  >>  [sink]
     ^
     +--  origin << value
```

- **Sink into async**: `Origin<T> >> Hub<T>` or `Pipe<U> >> Hub<U>` forwards sync output into the Hub (bridge sync to async).

### Async (Stream / Hub)

- **Source**: values enter via `Stream::receive` / `emit` or `Hub::operator<<`.
- **Chain**: `StreamRef<U> >> sink` or `StreamRef<U> >> transform >> ...`. Void sink returns **Task**; transform returns `StreamRef<Next>`.
- **Sink into Hub**: `StreamRef<U> >> Hub<U>` (uses `hub << u`). Sink into a type with `push(U)` (e.g. TimeWindow): `StreamRef<U> >> window`.

```
[Stream / Hub]  >>  [transform]  >>  [transform]  >>  [sink or Hub]
       ^
       +--  hub << value  or  stream.emit(value)
```

### Sinking sync pipeline into Hub

- `Pipe<U> >> Hub<U>` — sync pipeline output is forwarded with `hub << u`.
- `Origin<U> >> Hub<U>` — same; producer only does `origin << row`, caller owns Runtime and Hub.

## Summary table

| You have | You do | Result |
|----------|--------|--------|
| `Origin<T>` | `>> sink` or `>> transform` | Same Origin, or `Pipe<U>` |
| `Pipe<U>` | `>> sink` or `>> transform` | Same Pipe, or `Pipe<Next>` |
| `Pipe<U>`, `Hub<U>` | `pipe >> hub` | Pipe (connected to Hub) |
| `Origin<U>`, `Hub<U>` | `origin >> hub` | Origin (connected to Hub) |
| `StreamRef<U>` | `>> sink` | Task |
| `StreamRef<U>` | `>> transform` | `StreamRef<Next>` |
| `StreamRef<U>`, `Hub<U>` | `stream_ref >> hub` | Task (subscription) |
| `StreamRef<U>`, sink with `push(U)` | `stream_ref >> sink` | Task |

## One-line mental model

- **Origin/Pipe**: sync chain; you push with `<<`, everything runs immediately on one thread.
- **Stream/Hub**: async; need Runtime; `>>` creates Strands and dispatches work. Hub is the async dual of Origin: sink pipelines in, manifold pipelines out.

# Loom Overview

Loom is a C++20 library for building low-latency streaming pipelines over market data. It provides composable dataflow primitives, a clock abstraction for real-time and replay, sliding windows with pluggable analytics, and time-series transforms including fractional differencing.

## Architecture

```
 [data source]
      │
      ▼
 Origin<T>  ──>>──  Pipe<U>  ──>>──  Hub<T>  ──>>──  Window<T, Plugins...>
 (sync, push)       (sync)    (async) (async)           │
                                        ▲               ├── Plugin A ──>> stream
                                        │               ├── Plugin B ──>> stream
                                   Runtime              └── Plugin C ──>> stream
                                 (thread pool)
```

- **Origin / Pipe** — single-threaded, no allocation per node, immediate dispatch
- **Hub / Stream** — Runtime-backed, Strand-serialized, async fan-out
- **Window** — sliding buffer (time or count eviction) + compile-time plugins
- **Transforms** — stateful `Tick<T>` → `optional<Tick<T>>` (Diff, ∂t, …)
- **Clock** — unified handle over SystemClock (live) and VirtualClock (replay)

## Core Docs

| Doc | Description |
|-----|-------------|
| [Pipeline Tutorial](tutorial.md) | Start here: sync and async pipelines with runnable examples. |
| [Pipeline API](pipeline.md) | Type reference: Origin, Pipe, Stream, Hub, Runtime, concepts. |
| [Plugin System](plugins.md) | Sliding window (Time / Tick) + plugin pulse/yield/ref/chain model. |
| [Window Modules](modules.md) | Bars, OrderBook, Scalar; built-in plugins (SMA, EMA, MidPrice); custom plugins. |
| [Clocks](clocks.md) | SystemClock, VirtualClock, ForkedClock, time helpers. |
| [Transforms](transforms.md) | Diff, ∂t, fractional differencing; Δ and ∂t operator syntax. |

## Quick Start

```cpp
#include <loom/loom.h>
using namespace loom;

// Synchronous pipeline
Origin<Tick<double>> prices;

prices >> transform::Diff(1.0) >> [](const auto& opt) {
    if (opt) std::cout << "diff=" << opt->value << '\n';
};

prices << Tick<double>{1000, 10.0};
prices << Tick<double>{1010, 13.0};  // prints diff=3
```

```cpp
// Bars window with SMA plugin
Runtime rt(2);
Bars<PluginSMA<20>> bars(rt, 200);

bars[plugin<PluginSMA<20>>] >> [](const Tick<double>& t) {
    std::cout << "SMA-20 = " << t.value << '\n';
};

bars << Tick<Bar>{timestamp_ns, {open, high, low, close, volume}};
```

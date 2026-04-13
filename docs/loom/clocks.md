# Clocks

Loom's clock system provides a unified abstraction over real wall-clock time and deterministic replay time. All timestamps are `int64_t` nanoseconds since epoch.

## Time Helpers

```cpp
#include <loom/core/time.h>
using namespace loom;
```

| Function | Returns |
|----------|---------|
| `time::nanoseconds(n)` | `n` |
| `time::microseconds(n)` | `n * 1'000` |
| `time::milliseconds(n)` | `n * 1'000'000` |
| `time::seconds(n)` | `n * 1'000'000'000` |
| `time::minutes(n)` | `n * 60'000'000'000` |
| `time::hours(n)` | `n * 3'600'000'000'000` |

All are `constexpr` and return `int64_t`.

---

## Clock Handle

`Clock` is a unified handle wrapping any clock implementation. Create one via a factory, then `bind`, `start`, and `stop` it.

```cpp
#include <loom/core/clock.h>
using namespace loom;
```

```cpp
// Wall-clock, fires every millisecond
auto clock = Clock::system(time::milliseconds(1));

// Driven by explicit advance() calls (backtesting / replay)
auto replay_clock = Clock::replay(time::milliseconds(1));
```

### Lifecycle

```cpp
clock.bind([](int64_t timestamp_ns) {
    // called on every tick at the given timestamp
    std::cout << "tick at " << timestamp_ns << " ns\n";
});

clock.start();  // spawn background thread (SystemClock) or arm replay
// ...
clock.stop();
```

### Querying

```cpp
int64_t now = clock.now();         // current timestamp_ns
int64_t res = clock.resolution();  // resolution in ns
```

---

## Clock Types

### SystemClock

Fires on a real background thread at fixed intervals. The interval is the resolution passed to `Clock::system()`.

```cpp
auto clock = Clock::system(time::milliseconds(1));  // 1 ms resolution
clock.start();  // background thread starts ticking
// ... run your engine ...
clock.stop();   // background thread stops
```

Use for live trading and real-time processing.

### VirtualClock

Driven entirely by `advance()` calls. No background threads; deterministic.

```cpp
auto clock = Clock::replay();

auto& base = clock.base();  // returns BaseClock&, cast to VirtualClock&
auto& vclock = static_cast<VirtualClock&>(base);

vclock.advance(1'000'000'000);   // jump to t=1s
vclock.advance(2'000'000'000);   // jump to t=2s
vclock.reset();                  // back to t=0
```

Use for backtesting, simulation, and deterministic unit tests.

### ForkedClock

Derived from a parent clock; fires at the same wall-clock times but carries a timestamp shifted by N ticks.

```
parent tick at t=1000ms  →  forked(-1) emits at t=1000ms with timestamp=999ms
parent tick at t=1001ms  →  forked(-1) emits at t=1001ms with timestamp=1000ms
```

**Lookback (negative offset):** receive data at real time but process it as if it were from N ticks ago. Useful for computing lagged features.

**Lookahead (positive offset):** delayed delivery of a future-dated timestamp. Requires warmup of N ticks before the first emission.

```cpp
// Fork via Clock handle (preferred — parent stays alive via shared_ptr)
auto clock   = Clock::system(time::milliseconds(1));
auto lagged  = clock.fork_ns(-5'000'000'000);  // 5 s lookback
auto leading = clock.fork_ns(+time::seconds(1)); // 1 s lookahead
```

Forks can be chained:

```cpp
auto a = clock.fork_ns(-time::seconds(1));
auto b = a.fork_ns(-time::seconds(1));  // 2 s total lookback
```

---

## Binding Multiple Listeners

`bind()` appends — a single clock can drive multiple callbacks:

```cpp
clock.bind([](int64_t t) { feed_a.on_tick(t); });
clock.bind([](int64_t t) { feed_b.on_tick(t); });
```

Callbacks fire in bind order on every tick.

---

## Summary

| Type | Driven by | Use case |
|------|-----------|----------|
| `SystemClock` | OS wall clock (background thread) | Live trading |
| `VirtualClock` | Explicit `advance()` calls | Backtesting / tests |
| `ForkedClock` | Parent clock, shifted N ticks | Lagged / lookahead features |

```
Clock::system(resolution)  →  SystemClock   (real time)
Clock::replay(resolution)  →  VirtualClock  (deterministic)
clock.fork_ns(offset_ns)   →  ForkedClock   (shifted timestamps)
```

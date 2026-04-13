# Modules

Three concrete window types for market data. Each window ships with its own set of plugins.

```cpp
#include <loom/modules/bars/bars.h>
#include <loom/modules/orderbook/orderbook.h>
#include <loom/modules/scalar/scalar.h>
using namespace loom;
```

---

## Bars

Fixed-size sliding window of `Tick<Bar>` (OHLCV candles). Evicts the oldest bar when full.

```cpp
Runtime rt(2);
Bars<PluginSMA<20>, PluginEMA<10>> bars(rt, /*max_size=*/200);
```

**Constructor:** `Bars<Plugins...>(Runtime& rt, size_t max_size)`

```cpp
bars.count();       // bars currently in buffer
bars.max_size();    // configured capacity
bars.latest();      // most recent Tick<Bar>
bars.get_buffer();  // const std::deque<Tick<Bar>>&
```

```cpp
struct Bar { double open, high, low, close, volume; };

bars << Tick<Bar>{timestamp_ns, {open, high, low, close, volume}};
```

### Plugins

| Plugin | Header | Output | Warmup |
|--------|--------|--------|--------|
| `PluginSMA<Period>` | `bars/plugins/sma.h` | `double` | Period bars |
| `PluginEMA<Period>` | `bars/plugins/ema.h` | `double` | 1 bar |
| `PluginRSI<Period>` | `bars/plugins/rsi.h` | `double` (0–100) | Period + 1 bars |
| `PluginBollinger<Period, K_x100>` | `bars/plugins/bollinger.h` | `BollingerBands` | Period bars |

`PluginBollinger` outputs a struct: `BollingerBands{ double upper, middle, lower }`. `K_x100` is the sigma multiplier × 100 (default `200` = 2.0σ).

```cpp
#include <loom/modules/bars/plugins/sma.h>
#include <loom/modules/bars/plugins/ema.h>
#include <loom/modules/bars/plugins/rsi.h>
#include <loom/modules/bars/plugins/bollinger.h>
using namespace loom::plugins::bars;

Bars<PluginSMA<20>, PluginRSI<14>, PluginBollinger<20>> bars(rt, 200);

bars[plugin<PluginSMA<20>>] >> [](const Tick<double>& t) {
    std::cout << "SMA-20=" << t.value << '\n';
};

bars[plugin<PluginRSI<14>>] >> [](const Tick<double>& t) {
    if (t.value > 70) std::cout << "overbought\n";
};

bars[plugin<PluginBollinger<20>>] >> [](const Tick<BollingerBands>& t) {
    std::cout << "upper=" << t.value.upper
              << " mid=" << t.value.middle
              << " lower=" << t.value.lower << '\n';
};
```

---

## OrderBook

Time-windowed sliding window of `Tick<OrderBookDelta>`. Maintains live bid/ask state; evicts deltas older than `window_size_ns`.

```cpp
Runtime rt(2);
OrderBook<PluginMidPrice> ob(rt, time::seconds(60));
```

**Constructor:** `OrderBook<Plugins...>(Runtime& rt, int64_t window_size_ns)`

```cpp
ob.best_bid();        // Level{ price, size }
ob.best_ask();        // Level{ price, size }
ob.snapshot();        // Tick<OrderBookSnapshot> — full book
ob.top_snapshot(10);  // Tick<OrderBookSnapshot> — top N levels each side
```

Push a snapshot to initialize, then incremental deltas:

```cpp
enum OrderBookDeltaType { DELTA_SNAPSHOT, DELTA_INCREMENTAL };
struct Level { double price; double size; };

ob << Tick<OrderBookDelta>{ts, {DELTA_SNAPSHOT,
    {{100.0, 10.0}, {99.5, 5.0}},   // bids
    {{100.5, 8.0},  {101.0, 3.0}}}};  // asks

ob << Tick<OrderBookDelta>{ts2, {DELTA_INCREMENTAL,
    {{99.5, 0.0}},    // remove bid
    {{100.5, 12.0}}}}; // update ask
```

### Plugins

| Plugin | Header | Output |
|--------|--------|--------|
| `PluginMidPrice` | `orderbook/plugins/mid_price.h` | `double` — `(best_bid + best_ask) / 2` |

```cpp
#include <loom/modules/orderbook/plugins/mid_price.h>

ob[plugin<PluginMidPrice>] >> [](const Tick<double>& t) {
    std::cout << "mid=" << t.value << '\n';
};
```

---

## Scalar

Time-windowed sliding window of `Tick<double>`. Tracks `count`, `sum`, `sum_sq` for O(1) statistical plugins.

```cpp
Runtime rt(2);
window::Scalar<plugins::stats::Avg, plugins::stats::StdDev> scalar(rt, time::minutes(5));
```

**Constructor:** `Scalar<Plugins...>(Runtime& rt, int64_t window_size_ns)`

```cpp
scalar.count();   // ticks in window
scalar.sum();     // Σ values
scalar.sum_sq();  // Σ values²
```

### Plugins

| Plugin | Header | Output |
|--------|--------|--------|
| `plugins::stats::Avg` | `scalar/plugins/scalar_stats.h` | `double` — mean |
| `plugins::stats::Var` | `scalar/plugins/scalar_stats.h` | `double` — variance |
| `plugins::stats::StdDev` | `scalar/plugins/scalar_stats.h` | `double` — std deviation |

```cpp
#include <loom/modules/scalar/plugins/scalar_stats.h>
using namespace loom::plugins::stats;

window::Scalar<Avg, StdDev> scalar(rt, time::minutes(5));

scalar[plugin<Avg>] >> [](const Tick<double>& t) {
    std::cout << "mean=" << t.value << '\n';
};

scalar[plugin<StdDev>] >> [](const Tick<double>& t) {
    std::cout << "stddev=" << t.value << '\n';
};
```

---

## Subscribing to Plugin Output

`window[plugin<P>]` returns a handle to that plugin's output stream.

```cpp
// Single plugin
bars[plugin<PluginSMA<20>>] >> [](const Tick<double>& t) { ... };

// Forward to a Hub
auto ref = bars[plugin<PluginSMA<20>>];
ref >> hub;
```

## Multiple Plugins — Zip

Chain `[plugin<P>]` to receive all outputs aligned by timestamp.

```cpp
Bars<PluginSMA<20>, PluginEMA<10>> bars(rt, 200);

bars[plugin<PluginSMA<20>>][plugin<PluginEMA<10>>]
    >> [](int64_t ts, double sma, double ema) {
        std::cout << "spread=" << (sma - ema) << '\n';
    };
```

Fires only when both plugins have emitted for the same timestamp.

## Writing a Custom Plugin

Inherit `WindowPlugin<WindowType, OutputType>` and implement `onPulse(W* window, Yield&& yield)`.

```cpp
#include <loom/core/window/plugin.h>

// VWAP plugin for Bars
struct PluginVWAP : loom::WindowPlugin<loom::Bars, double> {
    template<typename W, typename Yield>
    void onPulse(W* window, Yield&& yield) {
        double sum_pv = 0.0, sum_v = 0.0;
        for (const auto& tick : window->get_buffer()) {
            double typical = (tick.high + tick.low + tick.close) / 3.0;
            sum_pv += typical * tick.volume;
            sum_v  += tick.volume;
        }
        if (sum_v > 0.0) yield(sum_pv / sum_v);
    }
};
```

| Method | Required | Notes |
|--------|----------|-------|
| `onPulse(W*, Yield&&)` | Yes | Read window state, call `yield(value)` 0+ times |
| `onPop(const TICK_TYPE&)` | No | Called on eviction; useful for incremental state |
| `config(const Config&)` | No | Optional plugin configuration |

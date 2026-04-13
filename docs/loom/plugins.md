# Plugin System

**Design language:** horizontal = data flow (left to right); vertical = sequence or fan-out. `[X]` = component, `-->` = sends to / produces.

## At a glance

One **Window** (sliding buffer). Ticks go in; the window evicts, then **pulses** every **Plugin**; each plugin **yields** onto its own stream. You subscribe via **ref** (one plugin) or **chain** (N plugins, zip by timestamp).

```
  [ticks in]  -->  [Window]  --+-->  [Plugin MidPrice]  -->  [stream]  -->  sink / Hub
       ^              |        +-->  [Plugin Spread]    -->  [stream]
       |              |        +-->  [Plugin Vol]       -->  [stream]
       |              v
   window << tick   buffer (evict by Time or Tick)
```

**Left:** you push ticks. **Center:** window holds a slice, runs eviction. **Right:** each plugin reads the window and yields to its stream; you take one ref or a chain of refs and subscribe or zip.

## Part 1: Sliding Window

**Role:** hold a time- or count-bounded slice of the tick stream; on each tick, evict then push then pulse plugins.

| Policy | Eviction |
|--------|----------|
| **Time** | Drop ticks with timestamp < (now - window_length). |
| **Tick** | Drop oldest when buffer size > max_size. |

**Mechanism (vertical = order of operations):**

```
  [receive(tick)]
     |
     v
  [evict]  ---------------  Time: by timestamp   or   Tick: by count
     |
     v
  [push tick]  -->  buffer
     |
     v
  [onPush(tick)]  --------  your hook (e.g. update state)
     |
     v
  [pulse]  -->  every plugin: onPulse(window, yield)
```

When eviction pops a tick, **onPop(tick)** runs (your hook and optionally each plugin's).

## Part 2: Plugin System

**Role:** plugins sit on the window; each has one output stream. Pulse = call each plugin's `onPulse(window, yield)`; plugin calls `yield(value)` zero or more times; each value goes out as `Tick{ ts, value }` on that plugin's stream.

| Concept | Meaning |
|---------|--------|
| **Plugin** | Type attached to the window. Implements `onPulse(window, yield)`; reads window, calls `yield(value)`. |
| **Ref** | Handle to one plugin's output. `window[plugin<MidPrice>]` = one ref. |
| **Chain** | N refs. `window[plugin<MidPrice>][plugin<Spread>]` ... Single ref: `>> sink`. N refs: `>> zip_callback` (zip by timestamp). |

**Fan-out (one window, N streams):**

```
  [Window]  --+-->  [Plugin A]  -->  [stream A]
              +-->  [Plugin B]  -->  [stream B]
              +-->  [Plugin C]  -->  [stream C]
```

**Plugin definition:** inherit a base that fixes **window type** and **output type**; implement **onPulse(window, yield)** (read window, call `yield(value)`); optional **onPop(tick)**, **config(config)**. Example: mid price = `(best_bid + best_ask) / 2`; `yield(mid)`.

## One tick (lifecycle, horizontal = time)

```
[tick in] --> [evict] --> [push] --> [pulse] --> [each plugin: yield] --> [streams]
                 ^          ^           ^                        ^
             Time/Tick    buffer   onPulse(window,yield)   Tick{ts, value}
```

## Usage

| You have | You do | Result |
|----------|--------|--------|
| Window | `window << tick` | Tick in buffer; eviction + pulse run. |
| Window | `window[plugin<MidPrice>]` | One ref. |
| Window | `window[plugin<MidPrice>][plugin<Spread>]` ... | Chain of N refs. |
| One ref | `>> sink` | Subscribe to that plugin's stream. |
| One ref | `.config(config)` | Forward config (chain length must be 1). |
| Chain (N refs) | `>> zip_callback` | Zip by timestamp; callback(ts, v1, ..., vN). |

## In one sentence

**Window** = sliding buffer (Time or Tick); you push ticks, it evicts then **pulses** every **plugin**; each **plugin** **yields** to its stream; **ref** = one plugin's output handle; **chain** = N refs; `>>` = subscribe (one ref) or zip by timestamp (N refs).

---

## Code Examples

### Single plugin — subscribe to output

```cpp
#include <loom/modules/bars/bars.h>
#include <loom/modules/bars/plugins/sma.h>
using namespace loom;

Runtime rt(2);
Bars<PluginSMA<20>> bars(rt, 200);  // last 200 bars, SMA-20

bars[plugin<PluginSMA<20>>] >> [](const Tick<double>& t) {
    std::cout << "SMA-20 = " << t.value
              << " at " << t.timestamp_ns << '\n';
};

// Push bars in
bars << Tick<Bar>{1000, {100.0, 105.0, 99.0, 103.0, 5000.0}};
bars << Tick<Bar>{2000, {103.0, 107.0, 102.0, 106.0, 6000.0}};
// ... after 20 bars, SMA-20 starts emitting
```

### Multiple plugins — zip by timestamp

All plugins in the chain must emit for the same timestamp before the callback fires.

```cpp
Bars<PluginSMA<20>, PluginEMA<10>> bars(rt, 200);

bars[plugin<PluginSMA<20>>][plugin<PluginEMA<10>>]
    >> [](int64_t ts, double sma, double ema) {
        std::cout << "ts=" << ts
                  << " sma=" << sma
                  << " ema=" << ema
                  << " spread=" << (sma - ema) << '\n';
    };
```

### Order book mid price

```cpp
#include <loom/modules/orderbook/orderbook.h>
#include <loom/modules/orderbook/plugins/mid_price.h>
using namespace loom;

Runtime rt(2);
OrderBook<PluginMidPrice> ob(rt, time::seconds(60));  // 60-second window

ob[plugin<PluginMidPrice>] >> [](const Tick<double>& t) {
    std::cout << "mid=" << t.value << '\n';
};

// Initialize with snapshot
ob << Tick<OrderBookDelta>{1000, {DELTA_SNAPSHOT,
    {{100.0, 10.0}, {99.5, 5.0}},   // bids
    {{100.5, 8.0}, {101.0, 3.0}}}};  // asks
// prints: mid=100.25

// Incremental update
ob << Tick<OrderBookDelta>{2000, {DELTA_INCREMENTAL,
    {{100.0, 15.0}},  // update bid size
    {}}};
```

### Writing a custom plugin

```cpp
#include <loom/core/window/plugin.h>

// VWAP plugin for Bars windows
struct PluginVWAP : loom::WindowPlugin<loom::Bars, double> {
    template<typename W, typename Yield>
    void onPulse(W* window, Yield&& yield) {
        double sum_pv = 0.0, sum_v = 0.0;
        for (const auto& tick : window->get_buffer()) {
            double typical = (tick.high + tick.low + tick.close) / 3.0;
            sum_pv += typical * tick.volume;
            sum_v  += tick.volume;
        }
        if (sum_v > 0.0)
            yield(sum_pv / sum_v);
    }
};

// Use it like any built-in plugin
Bars<PluginVWAP, PluginSMA<20>> bars(rt, 100);

bars[plugin<PluginVWAP>][plugin<PluginSMA<20>>]
    >> [](int64_t ts, double vwap, double sma) {
        std::cout << "vwap=" << vwap << " sma=" << sma << '\n';
    };
```

### Poll last emitted value (no stream subscription)

When you need the latest plugin output without setting up a subscriber:

```cpp
Bars<PluginSMA<20>> bars(rt, 200);
// ... push ticks ...

// Poll synchronously (returns last Tick<double> emitted)
auto last = bars.poll<PluginSMA<20>>();
std::cout << "last SMA-20 = " << last.value << '\n';
```

### Forward plugin output to an async Hub

```cpp
Runtime rt(2);
Hub<Tick<double>> hub(rt);

hub >> [](const Tick<double>& t) { process_signal(t); };

Bars<PluginSMA<20>> bars(rt, 200);
bars[plugin<PluginSMA<20>>] >> hub;  // plugin output flows into hub
```

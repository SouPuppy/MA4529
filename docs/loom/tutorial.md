# Pipeline Tutorial

This tutorial covers the practical use of Loom's pipeline for building dataflow graphs.
For API reference, see Pipeline.

## Prerequisites

Include the header:
```cpp
#include <loom/loom.h>
using namespace loom;
```

## Synchronous Pipeline (Origin + Pipe)

The sync pipeline runs entirely on the calling thread. No threads, no Runtime needed.

### Basic: Origin → Sink

```cpp
Origin<int> source;

source >> [](int x) {
    std::cout << "received: " << x << "\n";
};

source << 42;  // prints: received: 42
source << 100;  // prints: received: 100
```

### Origin → Transform → Sink

Chain transforms to modify data as it flows:

```cpp
Origin<int> source;

source
    >> [](int x) { return x * 2; }      // transform: int → int
    >> [](int x) { return std::to_string(x); }  // transform: int → string
    >> [](const std::string& s) {
        std::cout << "result: " << s << "\n";
    };

source << 5;  // prints: result: 10
```

### Void Transforms

Transforms that return void are sinks (end of chain):

```cpp
Origin<double> prices;

prices
    >> [](double p) { if (p > 100.0) std::cout << "expensive!\n"; }
    >> [](double p) { /* log, no return */ };

prices << 99.5;
prices << 150.0;  // prints: expensive!
```

### Using Pipe

`Pipe<U>` represents a chain segment with output type U. Use it to build reusable pipelines:

```cpp
// Create a pipe segment
Pipe<double> p = Origin<double>{} >> [](double x) { return x * 1.1; };

// Add more transforms
p >> [](double x) { return std::format("{:.2f}", x); };

// Attach sink
p >> [](const std::string& s) { std::cout << s << "\n"; };

// Feed data
Origin<double> src;
src >> p;
src << 100.0;  // prints: 110.00
```

## Asynchronous Pipeline (Stream + Hub + Runtime)

Async pipelines use a Runtime thread pool for concurrent execution.

### Basic: Hub + Runtime

```cpp
Runtime rt(4);  // 4 worker threads
Hub<int> hub(rt);

hub >> [](int x) { std::cout << x << "\n"; };

hub << 1;
hub << 2;
hub << 3;

rt.drain();  // wait for all tasks to complete
```

### Fan-out: Multiple Sinks

A single Hub can fan out to multiple subscribers:

```cpp
Runtime rt(2);
Hub<double> hub(rt);

std::atomic<int> count1{0};
std::atomic<int> count2{0};

hub >> [&](int) { count1++; };
hub >> [&](int) { count2++; };

for (int i = 0; i < 100; ++i)
    hub << i;

rt.drain();

// count1 == 100, count2 == 100
```

### Transform Chains

Chain transforms just like sync pipelines:

```cpp
Runtime rt(2);
Hub<int> hub(rt);
std::vector<int> results;

hub
    >> [](int x) { return x * 2; }      // multiply by 2
    >> [](int x) { return x + 10; }     // add 10
    >> [&](int x) { results.push_back(x); };

hub << 1;
hub << 2;
hub << 3;

rt.drain();
// results: {12, 14, 16}
```

## Bridging Sync to Async

Connect Origin/Pipe to Hub to bridge sync and async worlds.

### Origin → Hub

```cpp
Runtime rt(2);
Hub<std::string> hub(rt);

hub >> [](const std::string& s) { std::cout << s << "\n"; };

Origin<std::string> source;
source >> hub;  // bridge: sync output → async input

// Source pushes sync, Hub fans out async
source << "hello";
source << "world";

rt.drain();
```

### Pipe → Hub

```cpp
Runtime rt(2);
Hub<double> hub(rt);

hub >> [](double x) { std::cout << x << "\n"; };

Origin<int> source;
Pipe<double> p = source >> [](int x) { return static_cast<double>(x); };
p >> hub;  // bridge: sync pipe → async hub

source << 42;
rt.drain();
```

## Error Handling

Exceptions in transforms are caught and routed to a global error handler:

```cpp
// Set error handler (optional - default does nothing)
Origin<int>::setErrorHandler([](std::exception_ptr e) {
    try {
        std::rethrow_exception(e);
    } catch (const std::exception& ex) {
        spdlog::error("Pipeline error: {}", ex.what());
    }
});

Origin<int> source;
source >> [](int x) {
    if (x < 0) throw std::runtime_error("negative not allowed");
    return x * 2;
};

source << -5;  // error routed to handler
```

## Common Patterns

### Market Data Pipeline

Typical HFT market data processing:

```cpp
// Source: tick data from exchange
Origin<Tick<double>> tick_source;

// Async processing with Runtime
Runtime rt(4);
Hub<Tick<double>> hub(rt);

// Bridge sync ticks to async hub
tick_source >> hub;

// Multiple processing paths
hub >> transform::Diff(1) >> [](const auto& tick) {
    if (tick) process_mid_price(*tick);
};

hub >> transform::Spread() >> [](double spread) {
    if (spread > 0.01) alert("wide spread");
};
```

### Aggregation Pipeline

Combine with plugins for aggregation:

```cpp
Runtime rt(2);
Hub<OrderBook> ob_hub(rt);

auto window = TimeWindow<double>(std::chrono::seconds(60));

ob_hub
    >> plugin<MID_PRICE>()           // extract mid price
    >> std::ref(window)              // window plugin
    >> [](const auto& result) {
        if (result) std::cout << "avg: " << *result << "\n";
    };
```

## Best Practices

- **Thread safety**: Origin's `operator<<` is thread-safe. Multiple threads can push data concurrently.
- **Memory**: Call `rt.drain()` before destroying Runtime to ensure all tasks complete.
- **Performance**: For HFT, keep transforms inline (simple lambdas). Avoid heavy computation in hot paths.
- **Error handling**: Set error handler early, before any pipeline operations.

## Next Steps

- Pipeline API - Detailed type documentation
- Plugin System - Windowing and aggregation plugins
- REST Export - Expose pipelines via HTTP

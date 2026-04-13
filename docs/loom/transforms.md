# Transforms

Transforms are stateful functors mapping `Tick<T>` → `optional<Tick<T>>`. They plug directly into `>>` chains on `Origin`, `Pipe`, or `Stream`. Output is `nullopt` during warmup.

```cpp
#include <loom/transform/diff.h>
#include <loom/transform/derivative.h>
#include <loom/core/operators/timeseries.h>
using namespace loom;
```

---

## Diff

Computes the $d$-th order difference of a `Tick<double>` stream.

| `order` | Implementation | Formula |
|---------|---------------|---------|
| Integer ≥ 1 | `RuntimeOrderDifferencing` | `x[t] - x[t-1]`, `x[t] - 2x[t-1] + x[t-2]`, … |
| Fractional (0, 1) | `FractionalDifferencing` | Weighted sum with decaying memory |

```cpp
Origin<Tick<double>> prices;

prices >> transform::Diff(1.0) >> [](const auto& opt) {
    if (opt) std::cout << "diff=" << opt->value << '\n';
};

prices << Tick<double>{1000, 10.0};
prices << Tick<double>{1010, 13.0};  // prints diff=3

// 2nd-order
prices >> transform::Diff(2.0) >> ...;

// Fractional (memory-preserving stationarity)
prices >> transform::Diff(0.4) >> ...;
prices >> transform::Diff(0.4, /*tau=*/1e-5, /*max_lag=*/10000) >> ...;
```

---

## ∂t

Computes the time-scaled $d$-th order derivative: difference divided by elapsed seconds. Same dispatch as `Diff`.

```cpp
// Velocity: Δvalue / Δt (per second)
prices >> transform::∂t(1.0) >> [](const auto& opt) {
    if (opt) std::cout << "velocity=" << opt->value << " /s\n";
};

// Fractional
prices >> transform::∂t(0.5) >> ...;
```

---

## Δ · ∂t

Operator objects from `loom::op` — subscript syntax sugar over the transforms above.

```cpp
using namespace loom::op;

auto d1  = Δ<1.0>[prices];   // same as: prices >> transform::Diff(1.0)
auto fd  = Δ<0.4>[prices];
auto vel = ∂t<1.0>[prices];

// Chaining
auto result = Δ<0.4>[Δ<1.0>[prices]];
result >> [](const auto& opt) { if (opt) process(*opt); };
```

Accepts `Origin<Tick<T>>`, `Pipe<Tick<T>>`, or `Pipe<optional<Tick<T>>>`. Order is a compile-time `double` NTTP.

---

## Parameters

| Parameter | Default | Applies to |
|-----------|---------|------------|
| `order` | — | All. Integer ≥ 1 or fractional (0, 1). |
| `tau` | `1e-4` | Fractional only. Weight truncation threshold. |
| `max_lag` | `5000` | Fractional only. Memory window length. |

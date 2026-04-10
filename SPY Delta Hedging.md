### Quick Start

```
cd prism
pnpm install
pnpm run dev
```

# SPY Delta Hedging

!!! note "System Availability"
    The **Loom/Aurum** backtesting framework underlying this research is a closed-source proprietary system developed solely by **Quin**. Due to the complexity of the full engine stack, the source code is not published here. This document covers the strategy design, mathematical foundations, and results in full — the framework itself is presented at the architecture level only.

## Overview

This study implements and backtests a **self-financing delta hedge** of a short European call option on SPY (S&P 500 ETF), comparing multiple rebalancing strategies over a six-month window using a proprietary C++ backtesting engine built on the **Loom/Aurum** framework.

The primary research questions are:

1. How accurately can a discrete delta hedge replicate continuous Black-Scholes replication in practice?
2. How does rebalancing frequency affect hedge quality?
3. Does Monte Carlo delta estimation converge to the closed-form Black-Scholes result?

---

## Contract Specification

| Parameter       | Value                          |
|-----------------|--------------------------------|
| Underlying      | SPY (S&P 500 ETF)              |
| Option type     | European Call                  |
| Strike          | $600                           |
| Expiry          | 18 December 2026               |
| Implied vol (σ) | 24.49% (Bloomberg, 2025-10-05) |
| Risk-free rate  | 4.5% (annualised)              |
| Notional        | 100 shares per contract        |
| Backtest window | 5 Oct 2025 – 7 Apr 2026 (184 days) |
| Initial capital | $10,000                        |

Implied volatility is sourced from Bloomberg's vol surface for the specific strike/expiry pair and held constant across the backtest (constant-vol hedge).

---

## Engine Architecture

### Loom — Reactive Streaming Foundation

**Loom** is the low-latency C++ streaming library that Aurum is built on. Its core abstraction is a directed acyclic graph of typed nodes connected with the `>>` operator:

```
Origin → Pipe → Hub → Stream → Window
```

| Node | Role |
|------|------|
| **Origin** | Source of typed events — e.g. a price feed, a socket, a replay file |
| **Pipe** | Stateless transform: map, filter, project |
| **Hub** | Broadcast point — one value fanned out to N subscribers simultaneously |
| **Stream** | A named, typed channel that strategies subscribe to |
| **Window** | Stateful rolling buffer with pluggable analytics (SMA, EMA, mid-price, VWAP, …) |

All processing is **synchronous on the clock thread** — no thread hops, no queues between nodes. When a value propagates through the graph, every downstream node sees it within the same call stack. This eliminates latency from context switches and makes the execution order of subscribers within a tick fully deterministic.

### Aurum — Clock-Driven Trading Engine

**Aurum** is a trading engine built on Loom. Its execution model is **clock-driven with quiescing**. Each engine tick follows a fixed sequence:

```
Clock tick
  │
  ├─▶ 1. sync executor clocks          (Executor.on_clock)
  ├─▶ 2. start new programs            (initialize() for newly installed strategies)
  ├─▶ 3. tick datafeed devices         (Datafeed.on_clock)
  │          │
  │          └─▶ publishes UpdateBar / UpdateBook to MessageBus
  │                  │
  │                  ├─▶ CacheAdapter   — updates Windows, derived topic plugins
  │                  ├─▶ PortfolioCore  — mark prices, cash, unrealised P&L
  │                  ├─▶ RiskCore       — order validation
  │                  └─▶ ExecutionCore  — order lifecycle, fill processing
  │
  ├─▶ 4. drain()                        flush all queued publishes
  ├─▶ 5. process_interrupts()           quiesce → run strategy on() handlers
  ├─▶ 6. drain()                        flush any publishes caused by handlers
  ├─▶ 7. process_interrupts()           handle re-entrant triggers (e.g. order fills)
  └─▶ 8. drain_service_tasks()          cross-thread HTTP / REST work
```

### Quiescing — Why Handlers See Consistent State

The key invariant is **quiescing**: strategy handlers never fire mid-publish. Before any `on()` handler runs, the engine:

1. Detects pending interrupts (`interrupt_controller_.has_pending()`)
2. Enters QUIESCING state
3. Calls `stabilize_dataflow()` — drains the MessageBus and the Loom runtime until no further publishes are queued
4. Only then runs all pending handlers

This means when `on_bar()` fires, `ctx.cache` contains a **fully consistent snapshot**: all Windows are updated, all positions are marked, all prior fills are reflected. There are no partial updates.

```
data.bar.spy.* published
         ↓
CacheAdapter updates the Bars window     ← happens during drain()
PortfolioCore updates mark prices        ← happens during drain()
         ↓
stabilize_dataflow() — no more pending
         ↓
on(SIGNAL<UpdateBar>(...)) fires         ← handler sees complete state
```

When a handler submits an order (`ctx.exec.submit_order()`), the resulting `SubmitOrder` publish is processed in the **second** `process_interrupts` pass of the same tick — the strategy sees the fill (if immediate) within the same engine step.

### Core Components

| Component | Role |
|-----------|------|
| **MessageBus** | Typed pub/sub; stores latest snapshot per `(type, topic)`; routes to all subscribers |
| **Datafeed** | Publishes `UpdateBar` / `UpdateBook` on each clock tick |
| **Executor** | Normalises and routes `SubmitOrder`; receives venue acks and fills |
| **CacheAdapter** | Subscribes to bus; auto-creates one `Window` per topic; publishes plugin outputs as derived topics |
| **PortfolioCore** | Projects fills → positions → realised P&L; marks positions at latest price |
| **RiskCore** | Validates `SubmitOrder` before it reaches the venue (size, exposure, balance checks) |
| **ExecutionCore** | Assigns order IDs; folds venue reports into `OrderCache`; emits `OrderEvent` |
| **InterruptController** | Observes all publishes; enqueues matching handlers; fires after quiescing |
| **Scheduler** | Evaluates cron expressions; enqueues `Cron` triggers each tick |

### Writing a Strategy — the `Program` API

Strategies subclass `Program`. The constructor declares subscriptions; the engine wires everything up before the first tick.

```cpp
class AnalyticDeltaHedgeStrategy final : public Program {
public:
    AnalyticDeltaHedgeStrategy(/* params */) {
        // Subscribe to daily bar updates for the underlying
        on(SIGNAL<message::UpdateBar>("data.bar." + underlying_ + ".*@*"),
           [this](Context& ctx, const message::UpdateBar& bar) {
            spot_  = bar.bar.value.close;
            today_ = from_unix_ns(ctx.now_ns);
            on_bar(ctx);
        });
    }

    void initialize(Context& ctx) override {
        // Called once before the first tick — use for startup logging
        today_ = from_unix_ns(ctx.now_ns);
    }
};
```

The `Context` passed to every handler provides:

```cpp
struct Context {
    Engine&            engine;   // full engine access
    Executor&          exec;     // order submission
    const CacheFacade& cache;    // read-only: windows, orders, positions
    loom::Timestamp    now_ns;   // current engine clock (nanoseconds)
    TriggerInfo        trigger;  // what fired this handler (topic, timestamp)
};
```

Submitting an order:

```cpp
ctx.exec.submit_order(Order{
    .instrument_id = "spy",
    .account_id    = "acct_A_1d",
    .type          = MARKET,
    .side          = BUY,
    .quantity      = 57.5,
});
```

Reading portfolio state (for cross-validation):

```cpp
const auto* pos = ctx.cache.position(account_id_, underlying_);
double current_qty = (pos && pos->is_open() && pos->side == LONG)
                         ? static_cast<double>(pos->quantity) : 0.0;
double realized_pnl = pos ? static_cast<double>(pos->realized_pnl) : 0.0;
```

### Replay Mode

`engine.replay()` advances a **virtual clock** through the backtest window, emitting one bar per step. The `mock` venue client generates a GBM price path from fixed parameters:

```cpp
Engine engine;
auto client = venue::mock("SPY_SIM", SPOT0, vol, RATE);
engine.bind<Datafeed>(client.datafeed("spy", Channel::BAR, day_ns, start_ns, end_ns));
auto exec = engine.bind<Executor>(client.executor());
// ... install strategies ...
engine.replay(start_ns, end_ns, day_ns);
```

The GBM path is **deterministic**: same `SPOT0`, `vol`, `RATE` always produce the same sequence of prices. All five strategies receive the same price path in the same order — the only thing that varies between them is internal state and rebalancing logic.

### Backtest Correctness

Three properties guarantee the backtest faithfully reflects the strategy's behaviour:

1. **Quiescing**: `on_bar()` fires exactly once per bar, after all market state is updated. No race conditions. No partial reads.
2. **Self-contained cash accounting**: `cash_` and `shares_` are maintained entirely within the strategy. The engine's `PortfolioCore` tracks fills for reference, but the self-financing condition is enforced explicitly in code — not delegated to the portfolio engine.
3. **Deterministic path**: the GBM datafeed produces the same sequence on every run. The backtest is reproducible by construction.

---

## Black-Scholes Engine Design

### BlackCalculator

The `BlackCalculator` implements the **Black 1976 formula** for European options, mirroring the QuantLib `BlackCalculator` interface. It takes four inputs — payoff, forward price, standard deviation, and discount factor — and precomputes all required quantities **once** at construction:

$$
d_1 = \frac{\ln(F/K) + \frac{1}{2}\sigma^2 T}{\sigma\sqrt{T}}, \qquad d_2 = d_1 - \sigma\sqrt{T}
$$

$$
N(d_1),\quad N(d_2),\quad \phi(d_1) = \frac{e^{-d_1^2/2}}{\sqrt{2\pi}}
$$

After construction, **all Greek queries are $O(1)$ reads** of these cached values — no re-evaluation of the Black formula occurs.

```cpp
BlackCalculator::BlackCalculator(const VanillaPayoff& payoff,
                                 Real forward, Real stdDev, Real discount) noexcept
{
    // ω = +1 for call, -1 for put
    const Real omega = Real(Integer(payoff.optionType()));
    const Real K     = payoff.strike();

    if (stdDev <= 0.0) {
        // Intrinsic value only — degenerate case
        Nd1_ = (omega * (forward - K) > 0.0) ? 1.0 : 0.0;
        Nd2_ = Nd1_;
        nd1_ = 0.0;
    } else {
        d1_  = std::log(forward / K) / stdDev + 0.5 * stdDev;
        d2_  = d1_ - stdDev;
        Nd1_ = normalCdf(omega * d1_);
        Nd2_ = normalCdf(omega * d2_);
        nd1_ = normalPdf(d1_);
    }

    // Precomputed building blocks for all Greeks
    alpha_ = omega * forward * Nd1_;   //  ω·F·N(ω·d₁)
    beta_  = -omega * K * Nd2_;        // -ω·K·N(ω·d₂)
    // ...
}
```

**Greeks are derived from these building blocks:**

```cpp
Real BlackCalculator::value()        const noexcept { return discount_ * (alpha_ + beta_); }
Real BlackCalculator::deltaForward() const noexcept { return discount_ * omega * Nd1_; }
Real BlackCalculator::delta(Real spot) const noexcept {
    return deltaForward() * forward_ / spot;   // chain rule: ∂C/∂S = (∂C/∂F)·(∂F/∂S)
}
Real BlackCalculator::gammaForward() const noexcept {
    return discount_ * nd1_ / (forward_ * stdDev_);
}
Real BlackCalculator::gamma(Real spot) const noexcept {
    return gammaForward() * (forward_ / spot) * (forward_ / spot);
}
Real BlackCalculator::vega(Real maturity) const noexcept {
    return discount_ * forward_ * nd1_ * std::sqrt(maturity);
}
Real BlackCalculator::theta(Real spot, Real maturity) const noexcept {
    // Derived from BS PDE: Θ = r·V − (r−q)·S·Δ − ½·σ²·S²·Γ
    // ...
}
```

**Convenience bundle** — the strategy calls `allGreeks()` once per bar to retrieve all sensitivities in a single call:

```cpp
Greeks BlackCalculator::allGreeks(Real spot, Real maturity) const noexcept {
    Greeks g;
    g.delta        = deltaForward() * forward_ / spot;
    g.deltaForward = deltaForward();
    g.gamma        = gammaForward() * (forward_ / spot) * (forward_ / spot);
    g.gammaForward = gammaForward();
    g.vega         = vega(maturity);
    g.theta        = theta(spot, maturity);
    g.thetaPerDay  = g.theta / 365.0;
    g.rho          = rho(maturity);
    g.dividendRho  = -omega * spot * maturity * Nd1_;
    return g;
}
```

### QuantLib-Style Design

The design mirrors QuantLib's philosophy:

- **Pricing engines return only NPV** (`PricingResult = {value, error}`). The `EuropeanOption` instrument wires the engine's spot stream into an NPV hub — Greeks are not part of the reactive pipeline.
- **Greeks are computed on-demand** in strategy code via `BlackCalculator`. The strategy constructs the calculator each bar from fresh market inputs and calls `allGreeks()` directly.
- **`greeks.h`** contains only the two BS-PDE-derived helper functions (`blackScholesTheta`, `defaultThetaPerDay`) that are useful when $\Delta$, $\Gamma$, $V$ are already known but $\Theta$ needs to be recovered from the PDE identity — not a centralised Greek registry.

This separation keeps the instrument/engine layer clean and moves Greek computation to where it belongs: the strategy.

### EuropeanOption — Reactive Instrument

`EuropeanOption` is a reactive wrapper that auto-reprices on spot updates:

```cpp
template<typename Engine>
void EuropeanOption::setPricingEngine(Engine engine) {
    auto& spotStream = engine.process().spot();
    // Wire: spot updates → calculate() → emit to NPV hub
    spotStream >> [eng = std::move(engine), payoff = payoff_,
                   exercise = exercise_, date, rh, nh, neh, guard](Real spot) {
        if (!*guard) return;
        PricingResult res = eng.calculate(spot, payoff, exercise, *date);
        *rh << res;
        *nh << res.value;
        *neh << res.error;
    };
}
```

Subscribers on `option.NPV()` automatically receive updated prices whenever spot moves. The active_ guard safely silences old subscriptions when a new engine is attached.

---

## Strategy Design

### Analytic and MC as Parallel Abstractions

Both strategies share an identical structure — they differ only in **how delta is computed**. This is the key design insight: the replication algorithm is the same; the delta estimator is swapped.

```
on_bar():
    1. compute (price, delta)   ← differs: BlackCalculator vs MC pathwise
    2. compute higher Greeks    ← always BlackCalculator
    3. if Day 0: init portfolio
       else: bond accrual + rebalance
    4. compute ε_t and π_t
    5. write CSV row
```

This abstraction makes the MC/analytic comparison controlled: every other variable (portfolio mechanics, rebalance logic, P&L accounting, output schema) is identical.

### Analytic Delta Hedge

```cpp
class AnalyticDeltaHedgeStrategy final : public Program {
    // ...
    void on_bar(Context& ctx) {
        const Real fwd  = spot_ * std::exp(rate_ * tau);
        const Real sd   = vol_  * std::sqrt(tau);
        const Real disc = std::exp(-rate_ * tau);
        BlackCalculator calc(spec_.payoff(), fwd, sd, disc);

        const double price  = calc.value();
        const Greeks g      = calc.allGreeks(spot_, tau);
        const double delta  = g.delta;       // ← closed-form
        const double target = delta * notional_;
        // ...
    }
};
```

**Initialisation (Day 0) — self-financing construction:**

```cpp
if (!initialized_) {
    start_date_ = today_;
    cash_    = W0_ + price * notional_ - target * spot_;
    shares_  = target;
    avg_cost_ = spot_;
    initialized_ = true;
    // submit BUY order for target shares
}
```

**Daily dynamics:**

```cpp
// Bond accrual
cash_ *= std::exp(rate_ / 365.0);

// Rebalance (every k bars, min 1 share change)
const double diff = target - shares_;
if (step_count_ % rebalance_interval_ == 0 && std::abs(diff) >= 1.0) {
    if (diff > 0.0) {
        avg_cost_ = (shares_ * avg_cost_ + diff * spot_) / target;
        cash_ -= diff * spot_;
    } else {
        cash_ += (-diff) * spot_;
    }
    shares_ = target;
    // submit BUY or SELL order
}

// P&L
const double rep_error   = (shares_ * spot_ + cash_) - price * notional_;
const double excess_pnl  = rep_error - W0_ * std::exp(rate_ * elapsed);
```

### Monte Carlo Delta Hedge

The MC strategy replaces only the delta (and price) computation with a **pathwise estimator**:

$$
\hat{\Delta}^{MC} = e^{-r\tau} \cdot \frac{1}{N} \sum_{i=1}^{N} \mathbf{1}_{S_T^{(i)} > K} \cdot \frac{S_T^{(i)}}{S_t}
$$

**Antithetic variates** pair each draw $z$ with $-z$, halving variance at no extra cost:

```cpp
std::pair<double, double> mc_price_and_delta(double S, double K, double tau) {
    const double drift     = (rate_ - 0.5 * vol_ * vol_) * tau;
    const double diffusion = vol_ * std::sqrt(tau);
    const double disc      = std::exp(-rate_ * tau);

    double price_sum = 0.0, delta_sum = 0.0;
    const int half = n_paths_ / 2;

    for (int i = 0; i < half; ++i) {
        const double z = norm(rng_);

        // Original path
        const double ST1 = S * std::exp(drift + diffusion * z);
        price_sum += std::max(ST1 - K, 0.0);
        if (ST1 > K) delta_sum += ST1 / S;

        // Antithetic path (z → -z)
        const double ST2 = S * std::exp(drift - diffusion * z);
        price_sum += std::max(ST2 - K, 0.0);
        if (ST2 > K) delta_sum += ST2 / S;
    }

    return {disc * price_sum / (half * 2),
            disc * delta_sum / (half * 2)};
}
```

Higher-order Greeks fall back to `BlackCalculator` — MC estimates of $\Gamma$, $\Theta$, $\mathcal{V}$ require second-order finite differences and are too noisy at these path counts:

```cpp
void on_bar(Context& ctx) {
    const auto [price, delta] = mc_price_and_delta(spot_, K, tau);  // MC

    BlackCalculator calc(spec_.payoff(), fwd, sd, disc);
    const Greeks ag    = calc.allGreeks(spot_, tau);
    const double gamma = ag.gamma;        // closed-form
    const double theta = ag.thetaPerDay;  // closed-form
    // ... rest identical to AnalyticDeltaHedgeStrategy
}
```

---

## Self-Financing Portfolio

### Construction at $t = 0$

$$
\text{cash}_0 = W_0 + C_0 \cdot n - \Delta_0 \cdot n \cdot S_0, \qquad \text{shares}_0 = \Delta_0 \cdot n
$$

| Term | Value at inception |
|------|--------------------|
| $W_0$ | $\$10,000$ |
| $C_0 \cdot n$ | Option premium received (≈ $6,548 at $S_0 = 576.82$) |
| $\Delta_0 \cdot n \cdot S_0$ | Cost of initial share purchase (≈ $33,167$) |
| $\text{cash}_0$ | $\approx -16,619$ (net borrowing) |
| $\text{shares}_0$ | $\approx 57.5$ shares |

The negative cash balance reflects **borrowing** to fund the share purchase beyond what the premium and initial capital cover. On Day 0: $\varepsilon_0 = V^{\text{rep}}_0 - L_0 = W_0 = \$10,000$ exactly.

### Daily Dynamics

**Bond accrual** (continuous compounding approximation):

$$
\text{cash}_t = \text{cash}_{t-1} \cdot e^{r/365}
$$

**Rebalance** (when triggered):

$$
\text{cash}_t \leftarrow \text{cash}_t - (\phi_t - \phi_{t-1}) \cdot S_t, \qquad \phi_t = \Delta_t \cdot n
$$

### Replication Error and Excess P&L

$$
\varepsilon_t = V^{\text{rep}}_t - L_t = (\phi_t S_t + \text{cash}_t) - C_t \cdot n
$$

$$
\pi_t = \varepsilon_t - W_0 \cdot e^{r \cdot \text{elapsed}}
$$

Under perfect continuous hedging, $\varepsilon_t = W_0 e^{rt}$ exactly and $\pi_t = 0$. Discrete rebalancing causes $\pi_t$ to fluctuate around zero with a characteristic gamma/theta signature:

$$
\Delta\pi_t \approx \underbrace{\frac{1}{2}\Gamma_t(\Delta S_t)^2}_{\text{gamma cost}} - \underbrace{\Theta_t \cdot \Delta t}_{\text{theta earned}}
$$

---

## Research Dimensions

### A — Rebalancing Frequency (Analytic Greeks)

| Strategy     | Interval | Output |
|--------------|----------|--------|
| 1d Analytic  | Daily    | `A_analytic_1d.csv` |
| 5d Analytic  | Weekly   | `A_analytic_5d.csv` |
| 20d Analytic | Monthly  | `A_analytic_20d.csv` |

**Expected**: lower RMSE and Avg $|\varepsilon|$ with higher frequency; more trades.

### B — Monte Carlo vs Analytic Delta (Weekly Rebalance)

| Strategy | Paths | Output |
|----------|-------|--------|
| MC 500   | 500   | `B_mc_500.csv` |
| MC 5000  | 5000  | `B_mc_5000.csv` |

**Expected**: MC 5000 converges toward the analytic result; MC 500 shows delta estimation noise propagating into the replication error path.

### Engine Setup

All 5 strategies run in a single `engine.replay()` pass:

```cpp
Engine engine;
auto client = venue::mock("SPY_SIM", SPOT0, vol, RATE);
engine.bind<Datafeed>(client.datafeed("spy", Channel::BAR, day_ns, start_ns, end_ns));
auto exec = engine.bind<Executor>(client.executor());

// Study A
engine.install<AnalyticDeltaHedgeStrategy>(exec, "spy", make_spec(), RATE, vol, NOTIONAL, INITIAL_CASH, 1,  "acct_A_1d",   "output/A_analytic_1d.csv");
engine.install<AnalyticDeltaHedgeStrategy>(exec, "spy", make_spec(), RATE, vol, NOTIONAL, INITIAL_CASH, 5,  "acct_A_5d",   "output/A_analytic_5d.csv");
engine.install<AnalyticDeltaHedgeStrategy>(exec, "spy", make_spec(), RATE, vol, NOTIONAL, INITIAL_CASH, 20, "acct_A_20d",  "output/A_analytic_20d.csv");

// Study B
engine.install<MCDeltaHedgeStrategy>(exec, "spy", make_spec(), RATE, vol, NOTIONAL, INITIAL_CASH, 5, 500,  "acct_B_mc500",  "output/B_mc_500.csv");
engine.install<MCDeltaHedgeStrategy>(exec, "spy", make_spec(), RATE, vol, NOTIONAL, INITIAL_CASH, 5, 5000, "acct_B_mc5000", "output/B_mc_5000.csv");

engine.replay(start_ns, end_ns, day_ns);
```

---

## Hedge Quality Metrics

| Metric | Definition | Interpretation |
|--------|-----------|----------------|
| **Sharpe** | Annualised Sharpe of daily $\Delta\pi_t$ | Near 0 = hedge neutralises variance. High = directional drift. |
| **RMSE** | $\sqrt{\frac{1}{T}\sum_t \pi_t^2}$ | Root-mean-square excess P&L. Lower = tighter hedge. |
| **Max Drawdown** | $\max_{s \leq t}(\pi_s - \pi_t)$ | Worst peak-to-trough in excess P&L. |
| **Avg \|ε\|** | $\frac{1}{T}\sum_t |\varepsilon_t|$ | Mean absolute replication error. |
| **Excess P&L** | $\pi_T = \varepsilon_T - W_0 e^{rT}$ | Terminal deviation from risk-free benchmark. Near 0 = successful. |

A well-executed delta hedge has: Sharpe near 0 (no directional drift), low RMSE (tight path), small terminal Excess P&L (converges to risk-free benchmark).

---

## CSV Output Schema

Each strategy writes a 19-column CSV:

| Column | Description |
|--------|-------------|
| `trade_date` | Date |
| `spot` | $S_t$ |
| `ivol` | Implied vol (%) |
| `tau` | $\tau = T - t$ (years) |
| `option_price` | $C_t$ per share |
| `delta` | $\Delta_t$ |
| `gamma` | $\Gamma_t$ |
| `theta` | $\Theta_t$ per day |
| `vega` | $\mathcal{V}_t$ per 1% vol |
| `target_qty` | $\Delta_t \cdot n$ |
| `current_qty` | Shares held |
| `diff_qty` | Shares traded |
| `cash_position` | $\text{cash}_t$ |
| `portfolio_value` | $V^{\text{rep}}_t$ |
| `option_liability` | $L_t = C_t \cdot n$ |
| `replication_error` | $\varepsilon_t$ |
| `realized_pnl` | $\pi_t = \varepsilon_t - W_0 e^{r \cdot \text{elapsed}}$ |
| `unrealized_pnl` | $\phi_t(S_t - \bar{S})$ |
| `action` | `INIT` / `BUY` / `SELL` / `HOLD` |

---

## Prism Visualisation

Results are visualised in **Prism**, a React frontend purpose-built for Loom strategy research.

### Overview Tab

- **Replication Error chart**: $\varepsilon_t$ for all 5 strategies. Target ≈ $\$10{,}000 \cdot e^{0.045t}$.
- **Excess P&L chart**: $\pi_t$ for all 5 strategies overlaid. Deviations from zero are the discrete replication cost.
- **Hedge Quality table**: Sharpe, RMSE, Max Drawdown, Avg $|\varepsilon|$, terminal Excess P&L, trade count per strategy.

### Detail Tab (per strategy)

Step-by-step playback: spot path + trade markers, delta path, replication error, Greeks panel ($\Delta$, $\Gamma$, $\Theta$, $\mathcal{V}$), portfolio card ($\phi_t$, $\text{cash}_t$, $V^{\text{rep}}_t$, $L_t$), P&L card ($\pi_t$, unrealised P&L), event log (PRICE\_MOVE / REBALANCE).

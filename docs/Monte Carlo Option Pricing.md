Under the risk-neutral measure $\mathbb{Q}$, the price of a European option at time $t=0$ is given by
$$
V_0 = e^{-rT}\mathbb{E}^\mathbb{Q}[\Phi(S_T)]
$$
where

- $r$ : risk-free interest rate
- $T$ : maturity
- $S_T$ : stock price at maturity
- $\Phi(\cdot)$ : payoff function

For example, for a European call option
$$
\Phi(S_T)=\max(S_T-K,0)
$$
----
## Monte Carlo Approximation

The expectation can be approximated by simulating $N$ independent realizations of $S_T$.
$$
V_0 \approx e^{-rT}\frac{1}{N}\sum_{i=1}^{N}\Phi(S_T^{(i)})
$$
where $S_T^{(i)}$ is the simulated terminal stock price for the $i$-th path.

---
## Algorithm

1. Simulate $N$ independent stock price paths.
2. For each path compute the terminal payoff.
3. Compute the sample average of the payoff.
4. Discount the result back to time $0$.

---
## Pseudocode

```scala
var T: int        // maturity
var T: int        // number of Simulations
val stock_params; // S0, sigma, r, etc.

for i: N {
  stock_price[i] = simulate(T, stock_params);
}

V0 = E[discount(r, T) * payoff(stock_price[i])]
```

---
## Terminal Price Simulation (Black–Scholes Model)

Under the risk-neutral measure,
$$
S_T =
S_0
\exp
\left(
(r-\tfrac12\sigma^2)T
+
\sigma\sqrt{T}Z
\right),
\quad Z \sim N(0,1)
$$
Thus the simulation step typically generates a standard normal random variable $Z$ and computes $S_T$ using the above formula.

---
## Monte Carlo Error

The estimator converges according to
$$
\text{error} \sim O\!\left(\frac{1}{\sqrt{N}}\right)
$$
so increasing the number of simulated paths improves accuracy.m

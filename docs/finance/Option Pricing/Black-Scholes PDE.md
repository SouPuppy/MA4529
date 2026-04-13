### Market model

**Bond**
Let $B_t$ be the bank account:

$$
dB_t = r B_t dt, \quad B_0 = 1
$$

so

$$
B_t = e^{rt}
$$

Here $r$ is the constant risk-free rate.

**Stock**
We assume an underlying asset that satisfies geometric Brownian motion:

$$
dS_t = \mu S_t dt + \sigma S_t d \ W_t
$$

Where
- $\mu$ is physical drift
- $\sigma$ volatility
- $W_t$ is a standard Brownian motion.

### Derivative
Let $V(t,S)$ denote the price of a derivative written on the stock. Assume $V$ is sufficient smooth:

$$
V \in C^{1,2}([0,T)\times (0,\infty)).
$$

We regard the derivative price process as

$$
V_t := V(t,S_t).  
$$

**Apply [[Itô's Lemma]] to $V(t,S_t)$**

Since

$$
dS_t = \mu S_t dt + \sigma S_t d \ W_t
$$

[[Itô's Lemma]] gives

$$
dV_t=
\left(
\frac{\partial V}{\partial t} + \mu S_t \frac{\partial V}{\partial S} + \frac{1}{2}\sigma^2S_t^2\frac{\partial^2V}{\partial S^2}
\right)\,dt
+ \sigma S_t \frac{\partial V}{\partial S}dW_t
$$

### Delta Hedging

Construct a portfolio $\Pi$ which value is

$$
\Pi_t = V(t,S_t)-\Delta_t S_t
$$

Assume the strategy is **self-financing**. And the change in the portfolio value is 

$$
d\Pi_t=dV(t,S_t)-\Delta_tdS_t
$$

Substitute $dV_t$ and $dS_t$:

$$
d\Pi_t = 
\left(
\frac{\partial V}{\partial t} + \mu S_t \frac{\partial V}{\partial S} + \frac{1}{2}\sigma^2S_t^2\frac{\partial^2V}{\partial S^2}
\right)\,dt
+ \sigma S_t \frac{\partial V}{\partial S}dW_t
- \Delta_t 
\left(
\mu S_t dt + \sigma S_t d \ W_t
\right)
$$

Group the $dt$ terms and the $dW_t$ terms

$$
d\Pi_t = 
\left(
\frac{\partial V}{\partial t} + \mu S_t \frac{\partial V}{\partial S} + \frac{1}{2}\sigma^2S_t^2\frac{\partial^2V}{\partial S^2}
-\Delta_t\mu S_t
\right)\,dt
+ 
\sigma S_t
\left(
\frac{\partial V}{\partial S}
- \Delta_t
\right) dW_t
$$

**Choose $\Delta_t$ to eliminate risk**

Set $\Delta_t = \frac{\partial V}{\partial S}$, then the $dW_t$ term vanishes

$$
\sigma S_t
\left(
\frac{\partial V}{\partial S}
- \Delta_t
\right) dW_t = 0
$$

So, the portfolio becomes locally risk-less:

$$
d\Pi_t=
\left(
\frac{\partial V}{\partial t} + \frac{1}{2}\sigma^2S_t^2\frac{\partial^2V}{\partial S^2}
\right)\,dt
$$

**No-arbitrage**

A locally risk-less self-financing portfolio must earn the same return as the bank account. Otherwise there will be an arbitrage opportunity.

Therefore,

$$
d\Pi_t = r\Pi_tdt
$$

Since

$$
\Pi_t = V(t,S_t)-\Delta_t S_t
$$

we have

$$
d\Pi_t=r\left(V(t,S_t)-\Delta_t S_t\right)
$$

But from the hedging step we also found

$$
d\Pi_t=
\left(
\frac{\partial V}{\partial t} + \frac{1}{2}\sigma^2S_t^2\frac{\partial^2V}{\partial S^2}
\right)\,dt
$$

We have the equation

$$
r\left(V(t,S_t)-\Delta_t S_t\right) 
= 
\left(
\frac{\partial V}{\partial t} + \frac{1}{2}\sigma^2S_t^2\frac{\partial^2V}{\partial S^2}
\right)\,dt
$$

Move everything to the left-hand side and this is the **Black–Scholes PDE**:

$$
\boxed{ \frac{\partial V}{\partial t} +\frac12 \sigma^2 S^2 \frac{\partial^2 V}{\partial S^2} +rS\frac{\partial V}{\partial S} -rV =0 }  
$$

for $0 \le t < T, S>0$.

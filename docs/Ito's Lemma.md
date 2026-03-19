**Statement**
Suppose $W_t$ is a [[Brownian motion]], and $X_t$ satisfies the SDE
$$
dX_t = \mu_t \ dt + \sigma_t \ d W_t
$$
Let $f(t, x)$ be a sufficient smooth function, typically $f \in C^{1,2}$
Then Itô's lemma says:
$$
df(t,X_t)
=
\left(
\frac{\partial f}{\partial t}
+
\mu_t \frac{\partial f}{\partial x}
+
\frac12 \sigma_t^2 \frac{\partial^2 f}{\partial x^2}
\right) dt
+
\sigma_t \frac{\partial f}{\partial x}\, dW_t.
$$
### Proof
**Partition the interval**
Take a partition of $[0,t]$:
$$  
0=t_0<t_1<\cdots<t_n=t,  
$$
and define
$$  
\Delta t_i = t_{i+1}-t_i,\qquad \Delta X_i = X_{t_{i+1}}-X_{t_i},  
$$
Then
$$
f(t_{i+1}, X_{t_{i+1}}) - f(t_{i}, X_{t_i})
$$
**Apply the two-variable Taylor expansion**
Expand $f$ around $(t_i,X_{t_i})$
$$
\Delta f_i := f(t_{i+1},X_{t_{i+1}})-f(t_i,X_{t_i}) =
\underbrace{f_t(t_i,X_i)\Delta t_i}_{\text{First term}}  
+  
\underbrace{f_x(t_i,X_i)\Delta X_{t_i}}_{\text{Second term}}  
+  
\underbrace{\frac{1}{2}f_{xx}(t_i,X_i)(\Delta X_i)^2}_{\text{Quadratic term}}  
+  
R_i
$$
**Analyze $\Delta X_i$**
From
$$  
dX_t=\mu_t\,dt+\sigma_t\,dW_t,  
$$
we have on a small interval
$$  
\Delta X_i \approx \mu_{t_i}\Delta t_i+\sigma_{t_i}\Delta W_i,  
$$
where
$$  
\Delta W_i = W_{t_{i+1}}-W_{t_i}.  
$$
Now use the Brownian scaling:
$$  
\Delta W_i = O(\sqrt{\Delta t_i}).  
$$
Hence
$$  
\Delta X_i = O(\sqrt{\Delta t_i}).  
$$
Therefore
$$  
(\Delta X_i)^2 = O(\Delta t_i), \qquad \Delta t_i\Delta X_i = O((\Delta t_i)^{3/2}), \qquad (\Delta X_i)^3 = O((\Delta t_i)^{3/2}).  
$$
So after summing over the partition and taking the limit, only terms of order $O(\Delta t_i)$ survive.

**First Sum**
$$
\sum_i f_t(t_i,X_{t_i})\Delta t_i
\to
\int_0^t f_t(s,X_s)\,ds
$$
**Second Sum**
For the second term
$$
\sum_i f_x(t_i,X_{t_i})\Delta X_i
$$

Substitute $\Delta X_t$ with
$$
\Delta X_i = \int_{t_i}^{t_{i+1}} \mu_s ds + \int_{t_i}^{t_{i+1}} \sigma_sdW_s
$$
So,
$$
\sum_i f_x(t_i,X_{t_i})\Delta X_i
= \sum_i f_x(t_i,X_{t_i}) \int_{t_i}^{t_{i+1}} \mu_s ds
+ \sum_i f_x(t_i,X_{t_i}) \int_{t_i}^{t_{i+1}} \sigma_sdW_s
$$
$$
\sum_i f_x(t_i,X_{t_i})\Delta X_i
\to
\int_0^t f_x(s,X_s)\mu_s\,ds
+
\int_0^t f_x(s,X_s)\sigma_s\,dW_s
$$
**Quadratic term**
Now consider
$$  
\frac12\sum_i f_{xx}(t_i,X_{t_i})(\Delta X_i)^2.  
$$
Expand $(\Delta X_i)^2$:
$$  
(\Delta X_i)^2 = (\mu_{t_i}\Delta t_i+\sigma_{t_i}\Delta W_i)^2.  
$$
So
$$  
(\Delta X_i)^2 = \mu_{t_i}^2(\Delta t_i)^2 + 2\mu_{t_i}\sigma_{t_i}\Delta t_i\Delta W_i + \sigma_{t_i}^2(\Delta W_i)^2.  
$$
Only the last term survives. Hence
$$  
(\Delta X_i)^2 \sim \sigma_{t_i}^2(\Delta W_i)^2.  
$$
Therefore
$$  
\frac12\sum_i f_{xx}(t_i,X_{t_i})(\Delta X_i)^2 \sim \frac12\sum_i f_{xx}(t_i,X_{t_i})\sigma_{t_i}^2(\Delta W_i)^2.  
$$
So
$$  
\frac12\sum_i f_{xx}(t_i,X_{t_i})(\Delta X_i)^2 \to \frac12\int_0^t f_{xx}(s,X_s)\sigma_s^2\,ds.  
$$
**Combine all limits**
$$
f(t,X_t)-f(0,X_0)=
\int_0^t f_t(s,X_s)\,ds\\
+ \int_0^t f_x(s,X_s)\mu_s\,ds\\
+ \int_0^t f_x(s,X_s)\sigma_s\,dW_s
+ \frac12\int_0^t f_{xx}(s,X_s)\sigma_s^2\,ds\\
$$
Group $ds$-terms:
$$
f(t,X_t)-f(0,X_0)=
\int_0^t (
f_t(s,X_s) + f_x(s,X_s)\mu_s + f_{xx}(s,X_s)\sigma_s^2\
)\,ds\\
+ \int_0^t f_x(s,X_s)\sigma_s\,dW_s
$$
In differential form,
$$
df(t,X_t)
=
\left(
f_t(t,X_t)+\mu_t f_x(t,X_t)+\frac12 \sigma_t^2 f_{xx}(t,X_t)
\right)dt
+
\sigma_t f_x(t,X_t)\,dW_t.
$$

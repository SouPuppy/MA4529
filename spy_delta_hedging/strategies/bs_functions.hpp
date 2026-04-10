#pragma once

#include <loom/math/functions.h>

#include <algorithm>
#include <cmath>

// ---------------------------------------------------------------------------
// Black-Scholes closed-form helpers
// All functions operate on European call options.
// ---------------------------------------------------------------------------

inline double bs_phi(double x) noexcept {
    return std::exp(-0.5 * x * x) / std::sqrt(2.0 * M_PI);
}

inline double bs_d1(double S, double K, double r, double vol, double tau) noexcept {
    return (std::log(S / K) + (r + 0.5 * vol * vol) * tau) / (vol * std::sqrt(tau));
}

inline double bs_call_price(double S, double K, double r, double vol, double tau) noexcept {
    if (tau <= 0.0) return std::max(S - K, 0.0);
    const double sqrtT = std::sqrt(tau);
    const double d1    = bs_d1(S, K, r, vol, tau);
    const double d2    = d1 - vol * sqrtT;
    return S * loom::Φ(d1) - K * std::exp(-r * tau) * loom::Φ(d2);
}

inline double bs_call_delta(double S, double K, double r, double vol, double tau) noexcept {
    if (tau <= 0.0) return S > K ? 1.0 : 0.0;
    return loom::Φ(bs_d1(S, K, r, vol, tau));
}

inline double bs_gamma(double S, double K, double r, double vol, double tau) noexcept {
    if (tau <= 0.0) return 0.0;
    return bs_phi(bs_d1(S, K, r, vol, tau)) / (S * vol * std::sqrt(tau));
}

inline double bs_theta(double S, double K, double r, double vol, double tau) noexcept {
    if (tau <= 0.0) return 0.0;
    const double sqrtT = std::sqrt(tau);
    const double d1    = bs_d1(S, K, r, vol, tau);
    const double d2    = d1 - vol * sqrtT;
    return (-(S * bs_phi(d1) * vol) / (2.0 * sqrtT)
            - r * K * std::exp(-r * tau) * loom::Φ(d2)) / 365.0;
}

inline double bs_vega(double S, double K, double r, double vol, double tau) noexcept {
    if (tau <= 0.0) return 0.0;
    return S * bs_phi(bs_d1(S, K, r, vol, tau)) * std::sqrt(tau) / 100.0;
}

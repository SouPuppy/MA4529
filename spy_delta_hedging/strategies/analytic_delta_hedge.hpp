#pragma once

// ---------------------------------------------------------------------------
// AnalyticDeltaHedgeStrategy
//
// Self-financing delta hedge of a short European call using Black-Scholes
// closed-form Greeks.
//
// Portfolio at t=0:
//   cash = W0 + C0·n − Δ0·n·S0     (initial capital + premium − shares bought)
//   shares = Δ0·n
//
// Each bar:
//   1. Bond accrual:  cash *= exp(r / 365)
//   2. Rebalance (every `interval` bars, when |diff| ≥ 1 share):
//      buy/sell (Δ_new − Δ_old)·n shares, debit/credit cash
//
// Output:
//   portfolio_value   = shares·S + cash
//   option_liability  = C_t·n
//   replication_error = portfolio_value − option_liability  ≈ W0·e^{rt}
//   realized_pnl      = replication_error − W0·e^{r·elapsed}   (excess P&L)
//   unrealized_pnl    = shares·(S − avg_cost)
// ---------------------------------------------------------------------------

#include <aurum/aurum.h>
#include <loom/quant/instruments/EuropeanOption.h>
#include <loom/time/daycounter.h>
#include <loom/time/date.h>
#include <loom/utils/logger.h>
#include <loom/quant/pricing/blackCalculator.h>

#include "schema.hpp"

#include <cmath>
#include <sstream>
#include <string>

using namespace aurum;
using namespace loom;
using namespace loom::utils::log;

class AnalyticDeltaHedgeStrategy final : public Program {
public:
    AnalyticDeltaHedgeStrategy(std::string    underlying,
                                EuropeanOption spec,
                                double         rate,
                                double         vol_hedge,
                                double         notional,
                                double         initial_cash,
                                int            rebalance_interval_days,
                                std::string    account_id,
                                const char*    log_path)
        : underlying_(std::move(underlying)),
          spec_(std::move(spec)),
          rate_(rate),
          vol_(vol_hedge),
          notional_(notional),
          W0_(initial_cash),
          rebalance_interval_(rebalance_interval_days),
          account_id_(std::move(account_id)),
          log_sink_(log_path) {

        on(SIGNAL<message::UpdateBar>("data.bar." + underlying_ + ".*@*"),
           [this](Context& ctx, const message::UpdateBar& bar) {
            spot_  = bar.bar.value.close;
            today_ = from_unix_ns(ctx.now_ns);
            on_bar(ctx);
        });
    }

    void initialize(Context& ctx) override {
        today_ = from_unix_ns(ctx.now_ns);
        info("[ANALYTIC] acct={}  K={:.0f}  expiry={}  vol={:.2f}%  rate={:.1f}%  "
             "notional={:.0f}  W0={:.0f}  interval={}d",
             account_id_, spec_.payoff().strike(), spec_.exercise().lastDate(),
             vol_*100.0, rate_*100.0, notional_, W0_, rebalance_interval_);
    }

private:
    void on_bar(Context& ctx) {
        const double K   = spec_.payoff().strike();
        const double tau = Actual365Fixed::yearFraction(today_, spec_.exercise().lastDate());
        if (tau < 0.0) return;

        const Real fwd  = spot_ * std::exp(rate_ * tau);
        const Real sd   = vol_  * std::sqrt(tau);
        const Real disc = std::exp(-rate_ * tau);
        BlackCalculator calc(spec_.payoff(), fwd, sd, disc);

        const double price    = calc.value();
        const Greeks g        = calc.allGreeks(spot_, tau);
        const double delta    = g.delta;
        const double gamma    = g.gamma;
        const double theta    = g.thetaPerDay;
        const double vega_val = g.vega / 100.0;
        const double target   = delta * notional_;

        double actually_traded = 0.0;
        std::string action     = "HOLD";

        if (!initialized_) {
            // ── Day 0: establish self-financing portfolio ─────────────────
            start_date_ = today_;
            // Sell 1 call → receive premium. Buy delta·n shares immediately.
            cash_    = W0_ + price * notional_ - target * spot_;
            shares_  = target;
            avg_cost_ = (target > 0.0) ? spot_ : 0.0;
            initialized_ = true;

            actually_traded = target;
            action = "INIT";

            (void)ctx.exec.submit_order(Order{
                .instrument_id = underlying_,
                .account_id    = account_id_,
                .type          = MARKET,
                .side          = BUY,
                .quantity      = target,
            });
        } else {
            // ── Subsequent bars ───────────────────────────────────────────

            // 1. Bond accrual (one calendar day)
            cash_ *= std::exp(rate_ / 365.0);

            // 2. Rebalance
            const double diff = target - shares_;
            if (step_count_ % rebalance_interval_ == 0 && std::abs(diff) >= 1.0) {
                if (diff > 0.0) {
                    // Buy more shares
                    avg_cost_ = (shares_ * avg_cost_ + diff * spot_) / target;
                    cash_    -= diff * spot_;
                } else {
                    // Sell shares
                    cash_    += (-diff) * spot_;
                }
                shares_         = target;
                actually_traded = diff;
                action          = diff > 0.0 ? "BUY" : "SELL";

                (void)ctx.exec.submit_order(Order{
                    .instrument_id = underlying_,
                    .account_id    = account_id_,
                    .type          = MARKET,
                    .side          = diff > 0.0 ? BUY : SELL,
                    .quantity      = std::abs(diff),
                });
            }
        }

        // ── Compute stats ─────────────────────────────────────────────────
        const double elapsed          = Actual365Fixed::yearFraction(start_date_, today_);
        const double portfolio_value  = shares_ * spot_ + cash_;
        const double option_liability = price * notional_;
        const double rep_error        = portfolio_value - option_liability;
        // Excess P&L over simply investing W0 at the risk-free rate
        const double excess_pnl       = rep_error - W0_ * std::exp(rate_ * elapsed);
        const double unrealized_pnl   = shares_ * (spot_ - avg_cost_);

        std::ostringstream oss; oss << today_;
        log_sink_.receive(HedgeLogRow{
            .trade_date        = oss.str(),
            .spot              = spot_,
            .ivol              = vol_ * 100.0,
            .tau               = tau,
            .option_price      = price,
            .delta             = delta,
            .gamma             = gamma,
            .theta             = theta,
            .vega              = vega_val,
            .target_qty        = target,
            .current_qty       = shares_,
            .diff_qty          = actually_traded,
            .cash_position     = cash_,
            .portfolio_value   = portfolio_value,
            .option_liability  = option_liability,
            .replication_error = rep_error,
            .realized_pnl      = excess_pnl,
            .unrealized_pnl    = unrealized_pnl,
            .action            = action,
        });

        if (action != "HOLD" || step_count_ % 10 == 0) {
            info("[ANALYTIC:{}] {}  S={:.2f}  τ={:.3f}  Δ={:.4f}  "
                 "held={:.1f}  cash={:.2f}  ε={:.2f}  pnl={:.2f}  {}",
                 account_id_, today_, spot_, tau, delta,
                 shares_, cash_, rep_error, excess_pnl, action);
        }

        ++step_count_;
    }

    // Config
    std::string    underlying_;
    EuropeanOption spec_;
    double         rate_, vol_, notional_, W0_;
    int            rebalance_interval_;
    std::string    account_id_;

    // State
    double spot_{0.0};
    double cash_{0.0};
    double shares_{0.0};
    double avg_cost_{0.0};
    bool   initialized_{false};
    int    step_count_{0};
    Date   today_;
    Date   start_date_;

    loom::endpoint::CsvSink<HedgeLogRow, HedgeLogSchema> log_sink_;
};

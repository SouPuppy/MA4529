/// SPY Delta Hedging Research — Multi-Strategy Backtest
///
/// Runs multiple delta-hedging strategies in a single engine replay,
/// each writing its own CSV log.  Three research dimensions:
///
///   A) Rebalancing frequency  — analytic Greeks, varying interval
///   B) MC vs Analytic delta   — weekly rebalance, varying path count
///
/// Pipeline:
///   Bloomberg CSV  →  extract ivol  →  GBM datafeed (mock_stock)
///   → Engine::replay()
///   → [Strategy 1] → output/A_analytic_1d.csv
///   → [Strategy 2] → output/A_analytic_5d.csv
///   → [Strategy 3] → output/A_analytic_20d.csv
///   → [Strategy 4] → output/B_mc_500.csv
///   → [Strategy 5] → output/B_mc_5000.csv
///
/// Edit the CONFIG block below to change the option or simulation window.

#include <aurum/aurum.h>

#include <loom/domain/schema.h>
#include <loom/endpoint/csv.h>
#include <loom/time/date.h>
#include <loom/utils/logger.h>

#include "strategies/analytic_delta_hedge.hpp"
#include "strategies/mc_delta_hedge.hpp"

#include <map>
#include <stdexcept>
#include <string>

using namespace aurum;
using namespace loom;
using namespace loom::utils::log;

// ---------------------------------------------------------------------------
// Bloomberg input schema (only needed in main for vol surface loading)
// ---------------------------------------------------------------------------
constexpr auto identity_str_local = [](const std::string& s) { return s; };

struct OptionRow {
    std::string trade_date_str;
    std::string security_des;
    double      strike_px{0.0};
    std::string expire_dt_str;
    std::string ivol_str;
};

using OptionSchema = loom::endpoint::CsvSchema<
    OptionRow,
    loom::Field<"trade_date",  &OptionRow::trade_date_str, identity_str_local>,
    loom::Field<"security_des",&OptionRow::security_des,   identity_str_local>,
    loom::Field<"strike_px",   &OptionRow::strike_px>,
    loom::Field<"expire_dt",   &OptionRow::expire_dt_str,  identity_str_local>,
    loom::Field<"ivol",        &OptionRow::ivol_str,        identity_str_local>
>;

// ---------------------------------------------------------------------------
// Vol surface helpers
// ---------------------------------------------------------------------------
using VolSurface = std::map<std::string, double>;

static VolSurface load_vol_surface(const std::string& csv_path) {
    VolSurface surface;
    endpoint::CsvReader<OptionRow, OptionSchema> reader(csv_path);
    reader >> [&surface](const OptionRow& row) {
        if (row.security_des.empty() || row.ivol_str == "#N/A" || row.ivol_str.empty())
            return;
        if (surface.count(row.security_des)) return;  // first occurrence wins
        try { surface[row.security_des] = std::stod(row.ivol_str) / 100.0; }
        catch (...) {}
    };
    reader.load();
    return surface;
}

static double get_ivol(const VolSurface& surface, const std::string& security) {
    auto it = surface.find(security);
    if (it == surface.end())
        throw std::runtime_error("Option not found in vol surface: " + security);
    return it->second;
}

static void log_vol_surface_sample(const VolSurface& surface,
                                    const std::string& expiry_tag,
                                    double near_strike) {
    std::vector<std::pair<double, double>> pts;
    for (const auto& [sec, iv] : surface) {
        if (sec.find(expiry_tag) == std::string::npos) continue;
        if (sec.find(" C") == std::string::npos) continue;
        auto pos = sec.rfind(' ');
        if (pos == std::string::npos) continue;
        try { pts.push_back({std::stod(sec.substr(pos + 2)), iv}); } catch (...) {}
    }
    std::sort(pts.begin(), pts.end());
    info("[VOL-SURFACE] {} calls for expiry {}", pts.size(), expiry_tag);
    for (const auto& [k, iv] : pts)
        if (std::abs(k - near_strike) <= 75.0)
            info("[VOL-SURFACE]   K={:>6.0f}  ivol={:.2f}%", k, iv * 100.0);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
int main() {
    // -----------------------------------------------------------------------
    // CONFIG
    // -----------------------------------------------------------------------
    static constexpr const char* CSV_PATH = "data/spy_historical_optdata_bloomberg.csv";

    // Target option (must exist in the Bloomberg vol surface)
    static constexpr const char* TARGET_SECURITY = "SPY US 12/18/26 C600";
    static constexpr double      TARGET_STRIKE   = 600.0;
    const Date                   TARGET_EXPIRY(18, December, 2026);

    // Simulation parameters
    static constexpr double SPOT0         = 573.0;   // SPY on 2025-10-05
    static constexpr double RATE          = 0.045;
    static constexpr double NOTIONAL      = 100.0;   // shares per contract
    static constexpr double INITIAL_CASH  = 10000.0; // self-financing initial capital ($)

    // Replay window
    const Date start(5, October, 2025);
    const Date end  (7, April,   2026);

    const Timestamp day_ns   = 86400LL * 1'000'000'000LL;
    const Timestamp start_ns = to_unix_ns(start);
    const Timestamp end_ns   = to_unix_ns(end);

    // -----------------------------------------------------------------------
    // Load Bloomberg vol surface
    // -----------------------------------------------------------------------
    info("[SETUP] Loading Bloomberg vol surface from {}", CSV_PATH);
    const VolSurface surface = load_vol_surface(CSV_PATH);
    info("[SETUP] {} options loaded", surface.size());

    const double vol = get_ivol(surface, TARGET_SECURITY);
    info("[SETUP] Bloomberg ivol for {}: {:.2f}%", TARGET_SECURITY, vol * 100.0);
    log_vol_surface_sample(surface, "12/18/26", TARGET_STRIKE);

    // -----------------------------------------------------------------------
    // Engine + datafeed
    // -----------------------------------------------------------------------
    Engine engine;
    auto client = venue::mock("SPY_SIM", SPOT0, vol, RATE);
    engine.bind<Datafeed>(client.datafeed("spy", Channel::BAR, day_ns, start_ns, end_ns));
    auto exec = engine.bind<Executor>(client.executor());

    // Helper to build a fresh option spec (each strategy owns one)
    auto make_spec = [&]() {
        return EuropeanOption(VanillaPayoff(Option::Call, TARGET_STRIKE),
                              EuropeanExercise(TARGET_EXPIRY));
    };

    // -----------------------------------------------------------------------
    // A) Rebalancing frequency study — Analytic Greeks
    //    All strategies use the same Bloomberg-calibrated vol.
    // -----------------------------------------------------------------------
    engine.install<AnalyticDeltaHedgeStrategy>(
        exec, "spy", make_spec(), RATE, vol, NOTIONAL, INITIAL_CASH,
        /*interval=*/1, "acct_A_1d",  "output/A_analytic_1d.csv");

    engine.install<AnalyticDeltaHedgeStrategy>(
        exec, "spy", make_spec(), RATE, vol, NOTIONAL, INITIAL_CASH,
        /*interval=*/5, "acct_A_5d",  "output/A_analytic_5d.csv");

    engine.install<AnalyticDeltaHedgeStrategy>(
        exec, "spy", make_spec(), RATE, vol, NOTIONAL, INITIAL_CASH,
        /*interval=*/20, "acct_A_20d", "output/A_analytic_20d.csv");

    // -----------------------------------------------------------------------
    // B) MC vs Analytic — weekly rebalance, varying path count
    //    Demonstrates MC price/delta convergence to BS closed-form.
    // -----------------------------------------------------------------------
    engine.install<MCDeltaHedgeStrategy>(
        exec, "spy", make_spec(), RATE, vol, NOTIONAL, INITIAL_CASH,
        /*interval=*/5, /*paths=*/500,  "acct_B_mc500",  "output/B_mc_500.csv");

    engine.install<MCDeltaHedgeStrategy>(
        exec, "spy", make_spec(), RATE, vol, NOTIONAL, INITIAL_CASH,
        /*interval=*/5, /*paths=*/5000, "acct_B_mc5000", "output/B_mc_5000.csv");

    // -----------------------------------------------------------------------
    // Run
    // -----------------------------------------------------------------------
    info("[SETUP] start={}  end={}  spot0={:.2f}  K={:.0f}  expiry={}  vol={:.2f}%",
         start, end, SPOT0, TARGET_STRIKE, TARGET_EXPIRY, vol * 100.0);

    engine.replay(start_ns, end_ns, day_ns);

    info("[DONE] Logs written to output/");
    return 0;
}

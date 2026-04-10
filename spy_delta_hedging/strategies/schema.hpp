#pragma once

#include <loom/endpoint/csv.h>

#include <string>

// Shared identity_str for string fields in CSV schemas
inline constexpr auto identity_str = [](const std::string& s) { return s; };

// ---------------------------------------------------------------------------
// Hedge log output row — used by all delta-hedging strategies
// ---------------------------------------------------------------------------
struct HedgeLogRow {
    std::string trade_date;
    double      spot{0};
    double      ivol{0};
    double      tau{0};
    double      option_price{0};
    double      delta{0};
    double      gamma{0};
    double      theta{0};
    double      vega{0};
    double      target_qty{0};
    double      current_qty{0};
    double      diff_qty{0};
    double      cash_position{0};
    double      portfolio_value{0};
    double      option_liability{0};
    double      replication_error{0};
    double      realized_pnl{0};
    double      unrealized_pnl{0};
    std::string action;
};

using HedgeLogSchema = loom::endpoint::CsvSchema<
    HedgeLogRow,
    loom::Field<"trade_date",        &HedgeLogRow::trade_date,        identity_str>,
    loom::Field<"spot",              &HedgeLogRow::spot>,
    loom::Field<"ivol",              &HedgeLogRow::ivol>,
    loom::Field<"tau",               &HedgeLogRow::tau>,
    loom::Field<"option_price",      &HedgeLogRow::option_price>,
    loom::Field<"delta",             &HedgeLogRow::delta>,
    loom::Field<"gamma",             &HedgeLogRow::gamma>,
    loom::Field<"theta",             &HedgeLogRow::theta>,
    loom::Field<"vega",              &HedgeLogRow::vega>,
    loom::Field<"target_qty",        &HedgeLogRow::target_qty>,
    loom::Field<"current_qty",       &HedgeLogRow::current_qty>,
    loom::Field<"diff_qty",          &HedgeLogRow::diff_qty>,
    loom::Field<"cash_position",     &HedgeLogRow::cash_position>,
    loom::Field<"portfolio_value",   &HedgeLogRow::portfolio_value>,
    loom::Field<"option_liability",  &HedgeLogRow::option_liability>,
    loom::Field<"replication_error", &HedgeLogRow::replication_error>,
    loom::Field<"realized_pnl",      &HedgeLogRow::realized_pnl>,
    loom::Field<"unrealized_pnl",    &HedgeLogRow::unrealized_pnl>,
    loom::Field<"action",            &HedgeLogRow::action,            identity_str>
>;

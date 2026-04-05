import yfinance as yf
import pandas as pd
import os
import argparse
from datetime import datetime, timedelta


# ---------------------------------------------------------------------------
# Liquidity filter thresholds
# ---------------------------------------------------------------------------
MIN_VOLUME   = 10
MIN_OPEN_INT = 10
MIN_BID      = 0.01
MIN_IV       = 0.05
MAX_IV       = 1.50    # tightened from 2.0 — anything above 150% is noise


# ---------------------------------------------------------------------------
# Target time horizons for the volatility surface (in calendar days from today)
# ---------------------------------------------------------------------------
# We pick the CLOSEST available expiry to each of these targets.
# This gives you a well-spread term structure regardless of how many
# daily/weekly expiries the ticker happens to have.
TARGET_HORIZONS_DAYS = [7, 14, 30, 60, 90]


def _select_expiries_by_horizon(available_dates, horizons=TARGET_HORIZONS_DAYS):
    """
    Given a list of available expiry date strings (YYYY-MM-DD),
    returns the subset that is closest to each target horizon (in days).
    Skips any expiry that is fewer than 3 calendar days away — those
    produce unreliable implied vols.

    Returns a list of (expiry_str, actual_days_away) tuples.
    """
    today = datetime.today().date()

    # Parse and filter out anything expiring in < 3 days
    candidates = []
    for d in available_dates:
        expiry = datetime.strptime(d, '%Y-%m-%d').date()
        days   = (expiry - today).days
        if days >= 3:
            candidates.append((d, days))

    if not candidates:
        return []

    selected = {}
    for target in horizons:
        # Find the candidate whose days-to-expiry is closest to target
        best = min(candidates, key=lambda x: abs(x[1] - target))
        # Avoid duplicates (two targets mapping to the same expiry)
        if best[0] not in selected:
            selected[best[0]] = best[1]

    # Sort by expiry date
    return sorted(selected.items(), key=lambda x: x[0])


def _fetch_single_expiry(asset, expiry_date):
    """Downloads calls + puts for one expiry. Returns None on failure."""
    try:
        chain = asset.option_chain(expiry_date)
        calls = chain.calls.copy()
        calls['OptionType'] = 'Call'
        puts  = chain.puts.copy()
        puts['OptionType']  = 'Put'
        df = pd.concat([calls, puts], ignore_index=True)
        df['ExpiryDate']     = expiry_date
        df['ExtractionDate'] = pd.Timestamp.now().strftime('%Y-%m-%d')
        return df
    except Exception as e:
        print(f"  WARNING: Could not fetch {expiry_date}: {e}")
        return None


def _apply_liquidity_filter(df):
    """Keeps only liquid strikes with trustworthy implied vols."""
    # Compute days to expiry for each row
    today = pd.Timestamp.now().normalize()
    df = df.copy()
    df['_dte'] = (pd.to_datetime(df['ExpiryDate']) - today).dt.days

    # Dynamic IV cap — tighter for short-dated expiries
    def iv_cap(dte):
        if dte < 10:  return 0.80
        if dte < 20:  return 0.70
        return 1.50

    df['_iv_cap'] = df['_dte'].apply(iv_cap)

    mask = (
        (df['volume']            >  MIN_VOLUME)  &
        (df['openInterest']      >  MIN_OPEN_INT) &
        (df['bid']               >= MIN_BID)       &
        (df['impliedVolatility'] >  MIN_IV)        &
        (df['impliedVolatility'] <  df['_iv_cap'])
    )
    return df[mask].drop(columns=['_dte','_iv_cap']).copy()


def _select_columns(df):
    """Reorders columns — most useful first."""
    priority = [
        'OptionType', 'strike', 'impliedVolatility',
        'lastPrice', 'bid', 'ask', 'volume', 'openInterest',
        'contractSymbol', 'ExpiryDate', 'ExtractionDate',
        'lastTradeDate', 'change', 'percentChange',
        'inTheMoney', 'contractSize', 'currency'
    ]
    present  = [c for c in priority if c in df.columns]
    leftover = [c for c in df.columns if c not in present]
    return df[present + leftover]


def download_options_data(
    ticker_symbol,
    expiry_date=None,
    output_folder=None,
    num_expiries=5,
    filter_liquid=True,
    save_raw=False,
    use_horizon_selection=True
):
    """
    Downloads the options chain across multiple expiry dates.

    When expiry_date is None and use_horizon_selection=True (default),
    the script picks expiries closest to these horizons:
        7 days, 14 days, 30 days, 60 days, 90 days
    This gives a well-spread term structure regardless of whether the
    ticker has daily, weekly, or monthly options.

    When use_horizon_selection=False, it falls back to taking the next
    `num_expiries` available dates (skipping anything < 3 days away).
    """

    print(f"\n{'='*60}")
    print(f"  Options Downloader — {ticker_symbol}")
    print(f"{'='*60}")

    try:
        asset     = yf.Ticker(ticker_symbol)
        available = asset.options
    except Exception as e:
        print(f"ERROR: Could not connect to Yahoo Finance: {e}")
        return

    if not available:
        print(f"ERROR: No options found for {ticker_symbol}.")
        return

    print(f"Found {len(available)} available expiry dates.")
    print(f"Today: {datetime.today().date()}")

    # ------------------------------------------------------------------
    # Decide which expiry dates to download
    # ------------------------------------------------------------------
    if expiry_date:
        if expiry_date not in available:
            print(f"\nERROR: '{expiry_date}' not available.")
            print(f"Available: {list(available)}")
            return
        target_dates_with_days = [(expiry_date, None)]
        print(f"\nSingle expiry requested: {expiry_date}")

    elif use_horizon_selection:
        target_dates_with_days = _select_expiries_by_horizon(available)

        print(f"\nSmart horizon selection — picking closest expiry to each target:")
        print(f"  {'Target':>10}  {'Selected expiry':<16}  {'Actual days':>11}")
        print(f"  {'-'*42}")
        for target, (expiry, days) in zip(TARGET_HORIZONS_DAYS, target_dates_with_days):
            print(f"  {str(target)+' days':>10}  {expiry:<16}  {str(days)+' days':>11}")

    else:
        # Fallback: next N expiries, skipping those < 3 days away
        today      = datetime.today().date()
        candidates = [
            (d, (datetime.strptime(d, '%Y-%m-%d').date() - today).days)
            for d in available
            if (datetime.strptime(d, '%Y-%m-%d').date() - today).days >= 3
        ]
        target_dates_with_days = candidates[:num_expiries]
        print(f"\nFallback selection — next {len(target_dates_with_days)} expiries (>=3 days away):")
        for d, days in target_dates_with_days:
            print(f"  → {d}  ({days} days)")

    # ------------------------------------------------------------------
    # Download each expiry
    # ------------------------------------------------------------------
    all_frames     = []
    all_raw_frames = []

    print()
    for expiry, days in target_dates_with_days:
        days_str = f"({days}d)" if days else ""
        print(f"Fetching {expiry} {days_str}...", end="  ")
        df_raw = _fetch_single_expiry(asset, expiry)

        if df_raw is None:
            continue

        all_raw_frames.append(df_raw)

        if filter_liquid:
            df_clean = _apply_liquidity_filter(df_raw)
            print(f"{len(df_raw):>4} rows  →  {len(df_clean):>4} after filter")
            all_frames.append(df_clean)
        else:
            print(f"{len(df_raw):>4} rows  (no filter)")
            all_frames.append(df_raw)

    if not all_frames:
        print("\nERROR: No data downloaded successfully.")
        return

    # ------------------------------------------------------------------
    # Combine and save
    # ------------------------------------------------------------------
    df_final    = _select_columns(pd.concat(all_frames, ignore_index=True))
    expiry_list = sorted(df_final['ExpiryDate'].unique())

    if len(expiry_list) == 1:
        filename = f"{ticker_symbol}_options_{expiry_list[0]}.csv"
    else:
        filename = (f"{ticker_symbol}_options_surface_"
                    f"{expiry_list[0]}_to_{expiry_list[-1]}.csv")

    if output_folder is None:
        project_root  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        output_folder = os.path.join(project_root, 'data')

    os.makedirs(output_folder, exist_ok=True)
    file_path = os.path.join(output_folder, filename)
    df_final.to_csv(file_path, index=False)

    # Summary
    print(f"\n{'='*60}")
    print(f"  SAVED : {file_path}")
    print(f"  Rows  : {len(df_final)}")
    print(f"  Expiries ({df_final['ExpiryDate'].nunique()}):")
    for exp in expiry_list:
        subset = df_final[df_final['ExpiryDate'] == exp]
        days   = (datetime.strptime(exp, '%Y-%m-%d').date()
                  - datetime.today().date()).days
        print(f"    {exp}  ({days:>3}d)  —  "
              f"{len(subset):>4} rows, "
              f"IV {subset['impliedVolatility'].min():.3f}"
              f"–{subset['impliedVolatility'].max():.3f}")
    print(f"  Overall IV range: "
          f"{df_final['impliedVolatility'].min():.3f}"
          f" – {df_final['impliedVolatility'].max():.3f}")
    print(f"{'='*60}\n")

    # Optionally save unfiltered copy
    if save_raw and filter_liquid and all_raw_frames:
        df_raw_all = _select_columns(pd.concat(all_raw_frames, ignore_index=True))
        raw_path   = os.path.join(output_folder,
                                  filename.replace('.csv', '_RAW.csv'))
        df_raw_all.to_csv(raw_path, index=False)
        print(f"  Unfiltered copy saved: {raw_path}\n")

    return df_final


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='Download SPY/AAPL options across a spread of expiry dates'
    )
    parser.add_argument('ticker', type=str,
                        help='Ticker symbol, e.g. SPY')
    parser.add_argument('--expiry', type=str, default=None,
                        help='Single expiry date YYYY-MM-DD (optional)')
    parser.add_argument('--n', type=int, default=5,
                        help='Number of expiries when using fallback mode (default 5)')
    parser.add_argument('--folder', type=str, default=None,
                        help='Output folder (default: <project_root>/data/)')
    parser.add_argument('--no-filter', action='store_true',
                        help='Disable liquidity filter')
    parser.add_argument('--save-raw', action='store_true',
                        help='Also save unfiltered copy')
    parser.add_argument('--no-horizon', action='store_true',
                        help='Disable smart horizon selection, use next --n expiries instead')

    args = parser.parse_args()

    download_options_data(
        ticker_symbol        = args.ticker,
        expiry_date          = args.expiry,
        output_folder        = args.folder,
        num_expiries         = args.n,
        filter_liquid        = not args.no_filter,
        save_raw             = args.save_raw,
        use_horizon_selection= not args.no_horizon,
    )

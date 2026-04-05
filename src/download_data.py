import yfinance as yf
import pandas as pd
import numpy as np
import os
import argparse


def download_data(tickers, start_date, end_date, interval='1d', output_folder=None):
    """
    Downloads historical OHLCV data from Yahoo Finance and saves to CSV.

    Key fix vs original: yfinance >=0.2 returns MultiIndex columns for single
    tickers (e.g. ('Close', 'SPY')). We flatten these to plain strings ('Close')
    so the CSV reads back cleanly with df['Close'].
    """
    print(f"\nDownloading {interval} data for {tickers} "
          f"from {start_date} to {end_date}...")

    try:
        df = yf.download(
            tickers   = tickers,
            start     = start_date,
            end       = end_date,
            interval  = interval,
            auto_adjust = True,    # adjusts for splits/dividends — use Close, not Adj Close
            progress  = False,
        )

        if df.empty:
            print(f"ERROR: No data found for {tickers}. "
                  f"Check ticker symbol and internet connection.")
            return

        # ------------------------------------------------------------------
        # Fix MultiIndex columns produced by yfinance >=0.2
        # ('Close', 'SPY') → 'Close'
        # Only needed for single-ticker downloads; multi-ticker is fine as-is.
        # ------------------------------------------------------------------
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        # Drop duplicate columns if any (rare but can happen)
        df = df.loc[:, ~df.columns.duplicated()]

        # ------------------------------------------------------------------
        # Output folder
        # ------------------------------------------------------------------
        if output_folder is None:
            project_root  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            output_folder = os.path.join(project_root, 'data')

        os.makedirs(output_folder, exist_ok=True)

        filename  = f"{tickers}_{start_date}_{end_date}.csv"
        file_path = os.path.join(output_folder, filename)
        df.to_csv(file_path)

        # ------------------------------------------------------------------
        # Summary printout
        # ------------------------------------------------------------------
        print(f"Saved  : {file_path}")
        print(f"Rows   : {len(df)}")
        print(f"Columns: {list(df.columns)}")
        print(f"Range  : {df.index[0].date()} → {df.index[-1].date()}")

        # Compute and print annualised realised volatility from Close prices
        # This is the σ you'll use as your baseline in the simulations
        if 'Close' in df.columns and interval == '1d':
            log_returns = np.log(df['Close'] / df['Close'].shift(1)).dropna()
            daily_vol   = log_returns.std()
            annual_vol  = daily_vol * np.sqrt(252)
            print(f"\nRealised volatility (annualised, full period): {annual_vol:.4f} "
                  f"({annual_vol*100:.2f}%)")
            print(f"  → This is your baseline σ for constant-vol simulations.")

        return df

    except Exception as e:
        print(f"ERROR: {e}")
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Download Historical Stock Data')
    parser.add_argument('tickers',   type=str, help='Ticker symbol, e.g. SPY or ^GSPC')
    parser.add_argument('start',     type=str, help='Start date (YYYY-MM-DD)')
    parser.add_argument('end',       type=str, help='End date   (YYYY-MM-DD)')
    parser.add_argument('--interval',type=str, default='1d',
                        help='Bar interval: 1d, 1wk, 1mo (default: 1d)')
    parser.add_argument('--folder',  type=str, default=None,
                        help='Optional output folder path')
    args = parser.parse_args()

    download_data(args.tickers, args.start, args.end, args.interval, args.folder)

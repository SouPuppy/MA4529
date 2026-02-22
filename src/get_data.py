# src/get_data.py

import yfinance as yf
import pandas as pd
import os
import argparse

def download_data(tickers, start_date, end_date, interval='1d', output_folder=None):
    """
    Downlaods historical data from Yahoo Finance
    """
    print(f"Downloading {interval} data for {tickers} from {start_date} to {end_date}...")

    try:
        df = yf.download(
                tickers = tickers,
                start=start_date,
                end=end_date,
                interval=interval,
                )
        if df.empty:
            print(f"ERROR: No data found for {tickers}. Perhaps re-check your internet, symbols, etc.")
            return
        if output_folder is None:
            project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            output_folder = os.path.join(project_root, 'data')

        if not os.path.exists(output_folder):
            os.makedirs(output_folder)
            print(f"Created directory: {output_folder}")

        filename = f"{tickers}_{start_date}_{end_date}.csv"
        file_path = os.path.join(output_folder, filename)

        df.to_csv(file_path)
        print(f"Downloaded to {file_path}")
        print(f"Rows downloaded: {len(df)}")

    except Exception as e:
        print(f"Something wrong happened: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Download Stock Data')
    parser.add_argument('tickers', type=str, help='Stock Ticker (e.g., ^GSPC)')
    parser.add_argument('start', type=str, help='Start Date (YYYY-MM-DD)')
    parser.add_argument('end', type=str, help='End Date (YYYY-MM-DD)')
    parser.add_argument('--interval', type=str, default='1d', help='Interval (1d, 1wk, 1mo). Default is 1d')
    parser.add_argument('--folder', type=str, help='Optional output folder path')

    args = parser.parse_args()

    download_data(args.tickers, args.start, args.end, args.interval, args.folder)

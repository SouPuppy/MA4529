# src/download_options.py

import yfinance as yf
import pandas as pd
import os
import argparse

def download_options_data(ticker_symbol, expiry_date=None, output_folder=None):
    """
    Downloads the current options chain (Calls and Puts) for a given ticker.
    If expiry_date is not provided it downloads the nearest available expiration.
    """
    print(f"Connecting to Yahoo Finance for {ticker_symbol} options...")
    
    try:
        asset = yf.Ticker(ticker_symbol)
        available_expirations = asset.options
        
        if not available_expirations:
            print(f"ERROR: No options data found for {ticker_symbol}.")
            return

        if expiry_date:
            if expiry_date not in available_expirations:
                print(f"ERROR: {expiry_date} is not a valid expiration.")
                return
            target_date = expiry_date
        else:
            target_date = available_expirations[0]
            print(f"No date provided. Defaulting to nearest expiration: {target_date}")

        print(f"Downloading options chain for expiry: {target_date}...")

        chain = asset.option_chain(target_date)
        calls = chain.calls
        calls['OptionType'] = 'Call'
        
        puts = chain.puts
        puts['OptionType'] = 'Put'
        
        df = pd.concat([calls, puts], ignore_index=True)
        
        df['ExpiryDate'] = target_date
        df['ExtractionDate'] = pd.Timestamp.now().strftime('%Y-%m-%d')

        if output_folder is None:
            project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            output_folder = os.path.join(project_root, 'data')

        if not os.path.exists(output_folder):
            os.makedirs(output_folder)
            print(f"Created directory: {output_folder}")

        filename = f"{ticker_symbol}_options_{target_date}.csv"
        file_path = os.path.join(output_folder, filename)

        cols = ['OptionType', 'strike', 'impliedVolatility', 'lastPrice', 'bid', 'ask', 'volume', 'openInterest', 'contractSymbol', 'ExpiryDate', 'ExtractionDate']
        df = df[cols + [c for c in df.columns if c not in cols]]

        df.to_csv(file_path, index=False)
        print(f"Success! Downloaded to {file_path}")
        print(f"Rows downloaded: {len(df)} (Calls & Puts combined)")

    except Exception as e:
        print(f"Something wrong happened: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Download Options Chain Data for Volatility Smile')
    parser.add_argument('ticker', type=str, help='Stock Ticker (e.g., SPY, AAPL)')
    parser.add_argument('--expiry', type=str, help='Optional: Specific Expiration Date (YYYY-MM-DD). If left blank, gets nearest expiry.', default=None)
    parser.add_argument('--folder', type=str, help='Optional: Output folder path', default=None)

    args = parser.parse_args()

    download_options_data(args.ticker, args.expiry, args.folder)

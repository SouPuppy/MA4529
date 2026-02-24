# MA4529

Build a trading simulator to replicate a vanilla option payoff. Use lognormal process to start 
with and add a smile to the volatility and analysis the impact. Try different frequencies of 
hedging and analyse the impact on the final price.

### Dependency

- poetry

    ```bash
    pip install poetry
    ```

### Initialize the Project

```
poetry install
```

### Run

```
poetry run main
```

### Add a new package

```
poetry add <package>
```

## Downloading Historical Spot Prices 

We have added a script to download stock data from Yahoo Finance.

Usage:
```bash
poetry run python src/download_data.py AAPL 2023-01-01 2024-01-01
```

Syntax: `poetry run python src/download_data.py [TICKER] [START] [END]`

Option:
- `--interval`: Timeframe (e.g. `1wk`, `1mo`, `1h`). Default is `1d`.
- `--folder`:  Output location. Default is `data/`


## Downloading Options Chains
Script: `src/download_options.py`

Usage:

```bash
# Download the nearest expiration date (0DTE)
poetry run python src/download_options.py SPY

#Download a specific future expiration date
poetry run python src/download-options.py SPY --expiry 2026-04-17
```

Note: The options downloader script should only be run during US Market Hours

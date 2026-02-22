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

## Download Data

We have added a script to download stock data from Yahoo Finance.
Usage:
```bash
poetry run python src/get_data.py AAPL 2023-01-01 2024-01-01
```

Syntax: `poetry run python src/get_data.py [TICKER] [START] [END]`

Option:
- `--interval`: Timeframe (e.g. `1wk`, `1mo`). Default is `1d`.
- `--folder`:  Output location. Default is `data/`

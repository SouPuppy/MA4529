import numpy as np

class DeltaHedgingPortfolio:
    """
    Tracks the cash account and stock position for delta hedging an option.
    """
    def __init__(self, initial_stock_price, option_price, initial_delta):
        """
        Initialize the portfolio at t=0.
        Assuming we sold the option (received premium) and bought initial_delta shares.
        """
        self.stock_holdings = initial_delta
        
        # Cash = Money received from selling option - Money spent buying stock
        self.cash = option_price - (self.stock_holdings * initial_stock_price)

    def rebalance(self, current_stock_price, new_delta, dt, r):
        """
        Update portfolio for the next time step.
        dt: time elapsed since last rebalance (in years, e.g., 1/252 for daily)
        r: risk-free rate
        """
        # 1. Cash accrues/pays interest (continuous compounding)
        self.cash = self.cash * np.exp(r * dt)

        # 2. Calculate how many shares we need to buy/sell to match new delta
        shares_to_trade = new_delta - self.stock_holdings

        # 3. Update cash from buying/selling shares
        cost_of_trade = shares_to_trade * current_stock_price
        self.cash -= cost_of_trade

        # 4. Update stock holdings to the new delta
        self.stock_holdings = new_delta

    def get_portfolio_value(self, current_stock_price):
        """
        Calculate the total mark-to-market value of the replicating portfolio.
        Value = Cash + (Stock Holdings * Current Stock Price)
        """
        return self.cash + (self.stock_holdings * current_stock_price)
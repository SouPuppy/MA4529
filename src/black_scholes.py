import numpy as np
from scipy.stats import norm

def black_scholes_price(S, K, T, r, sigma, option_type='call'):
    """
    Calculate option price using the Black-Scholes model.
    """
    if T <= 0:
        if option_type == 'call':
            return max(S - K, 0.0)
        else:
            return max(K - S, 0.0)

    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)

    if option_type == 'call':
        price = S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    elif option_type == 'put':
        price = K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)
    else:
        raise ValueError("option_type must be 'call' or 'put'")
        
    return price

def black_scholes_delta(S, K, T, r, sigma, option_type='call'):
    """
    Calculate the Delta of an option.
    """
    if T <= 0:
        if option_type == 'call':
            return 1.0 if S > K else 0.0
        else:
            return -1.0 if S < K else 0.0

    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    
    if option_type == 'call':
        return norm.cdf(d1)
    elif option_type == 'put':
        return norm.cdf(d1) - 1.0
    else:
        raise ValueError("option_type must be 'call' or 'put'")

def black_scholes_gamma(S, K, T, r, sigma):
    """
    Calculate the Gamma of an option.
    """
    if T <= 0:
        return 0.0

    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
    return gamma

def black_scholes_vega(S, K, T, r, sigma):
    """
    Calculate the Vega of an option.
    """
    if T <= 0:
        return 0.0

    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    vega = S * norm.pdf(d1) * np.sqrt(T)
    return vega

def calculate_smile_volatility(S, K, a, b, c):
    """
    Calculate the Implied Volatility (IV) using a quadratic Volatility Smile model.
    IV = a + b(K/S - 1) + c(K/S - 1)^2
    """
    moneyness_minus_one = (K / S) - 1.0
    iv = a + b * moneyness_minus_one + c * (moneyness_minus_one ** 2)
    return max(iv, 0.01)

def smile_delta_sticky_moneyness(S, K, T, r, a, b, c, option_type='call'):
    """
    Calculate the adjusted Delta assuming 'Sticky Moneyness'.
    Smile Delta = BS_Delta + BS_Vega * (d(Sigma) / dS)
    """
    current_sigma = calculate_smile_volatility(S, K, a, b, c)
    
    bs_delta = black_scholes_delta(S, K, T, r, current_sigma, option_type)
    bs_vega = black_scholes_vega(S, K, T, r, current_sigma)
    
    moneyness_minus_one = (K / S) - 1.0
    d_sigma_d_S = (b + 2 * c * moneyness_minus_one) * (-K / (S ** 2))
    
    smile_delta = bs_delta + (bs_vega * d_sigma_d_S)
    return smile_delta

# Test Code
if __name__ == "__main__":
    
    S = 100.0  
    K = 100.0  
    T = 1.0    
    r = 0.05   
    
    # Simple Black-Sholes Volatility 
    constant_sigma = 0.2 
    
    # smile parameter
    smile_a = 0.20
    smile_b = -0.10
    smile_c = 0.05

    print("--- Black-Scholes Standard ---")
    print(f"Call Price: {black_scholes_price(S, K, T, r, constant_sigma, 'call'):.4f}")
    print(f"Call Delta: {black_scholes_delta(S, K, T, r, constant_sigma, 'call'):.4f}")
    print(f"Call Gamma: {black_scholes_gamma(S, K, T, r, constant_sigma):.4f}")
    print(f"Call Vega : {black_scholes_vega(S, K, T, r, constant_sigma):.4f}")
    
    print("\n--- Volatility Smile Adjusted ---")
    print(f"Current IV : {calculate_smile_volatility(S, K, smile_a, smile_b, smile_c):.4f}")
    print(f"Smile Delta: {smile_delta_sticky_moneyness(S, K, T, r, smile_a, smile_b, smile_c, 'call'):.4f}")
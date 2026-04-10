export type OptionType = 'call' | 'put'

export interface Greeks {
  delta: number    // ∂V/∂S — rate of change w.r.t. underlying
  gamma: number    // ∂²V/∂S² — rate of change of delta
  vega: number     // ∂V/∂σ per 1% vol move
  theta: number    // ∂V/∂t per calendar day (usually negative)
}

export interface OptionContract {
  symbol: string
  underlying: string
  strike: number
  expiry: string
  optionType: OptionType
  multiplier: number   // 100 shares per contract
}

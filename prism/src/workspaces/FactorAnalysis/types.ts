// ── Research Parameters ────────────────────────────────────────────────────────

export interface ResearchParams {
  factorId: string
  instrument: 'btc-usdt' | 'eth-usdt' | 'aapl' | 'es-fut' | 'custom'
  session: 'full' | 'open30' | 'mid' | 'close30'
  frequency: '100ms' | '500ms' | '1s' | '5s' | '10s' | '30s' | '1m'
  horizon: 1 | 2 | 3 | 5 | 10 | 20 | 60         // bars ahead at chosen freq
  returnDef: 'mid' | 'last' | 'weighted'
  normalization: 'none' | 'zscore' | 'rank' | 'robust'
  winsorize: 'none' | '2sigma' | '3sigma' | 'pct1'
  costModel: 'zero' | 'half-spread' | 'full-spread'
}

export const DEFAULT_PARAMS: ResearchParams = {
  factorId: 'ofi',
  instrument: 'btc-usdt',
  session: 'full',
  frequency: '1s',
  horizon: 3,
  returnDef: 'mid',
  normalization: 'rank',
  winsorize: '3sigma',
  costModel: 'half-spread',
}

// ── Factor Definitions ─────────────────────────────────────────────────────────

export interface FactorDef {
  id: string
  label: string
  description: string
  category: 'orderflow' | 'microstructure' | 'momentum' | 'info'
  typicalHalfLifeSec: number
}

export const FACTOR_DEFS: FactorDef[] = [
  {
    id: 'ofi',
    label: 'OFI',
    description: 'Order Flow Imbalance — (BidVol_delta − AskVol_delta) / total',
    category: 'orderflow',
    typicalHalfLifeSec: 4,
  },
  {
    id: 'vofi',
    label: 'VOFI',
    description: 'Volume-Weighted OFI — OFI weighted by notional size',
    category: 'orderflow',
    typicalHalfLifeSec: 3,
  },
  {
    id: 'tof',
    label: 'TOF',
    description: 'Trade Order Flow — aggressor-side buy/sell imbalance from tape',
    category: 'orderflow',
    typicalHalfLifeSec: 2.5,
  },
  {
    id: 'mid-mom',
    label: 'MidMom',
    description: 'Mid-Price Momentum — signed drift of mid over lookback window',
    category: 'momentum',
    typicalHalfLifeSec: 8,
  },
  {
    id: 'spread-ofi',
    label: 'SpreadOFI',
    description: 'Spread-Adjusted OFI — OFI scaled by relative bid-ask spread',
    category: 'orderflow',
    typicalHalfLifeSec: 5,
  },
  {
    id: 'book-press',
    label: 'BookPress',
    description: 'Book Pressure — depth imbalance across top-N levels',
    category: 'microstructure',
    typicalHalfLifeSec: 6,
  },
  {
    id: 'trade-rate',
    label: 'TradeRate',
    description: 'Trade Arrival Rate — trades/sec z-score anomaly',
    category: 'microstructure',
    typicalHalfLifeSec: 3,
  },
  {
    id: 'pin-alpha',
    label: 'PINAlpha',
    description: 'Microstructure Alpha — PIN-based informed trader probability',
    category: 'info',
    typicalHalfLifeSec: 12,
  },
]

// ── Section 1: Factor Diagnostics ─────────────────────────────────────────────

export interface FactorDiagnostics {
  direction: 'positive' | 'negative' | 'mixed'
  directionConfidence: number        // 0–1 (mapped from |t-stat|)
  halfLifeSec: number                // signal half-life in seconds
  icMean: number
  icStd: number
  icir: number                       // IC / σ(IC)
  ar1: number                        // AR(1) coefficient: exp(-freqSec / halfLifeSec)
  effectiveSampleSize: number        // raw N × (1 - ar1²) / (1 + ar1²) approx
  snrRatio: number                   // icMean / icStd × sqrt(effectiveSampleSize)
  avgSpreadBps: number               // avg spread (bps) at signal generation
  icHistory: number[]                // 20-point sparkline: per-session-day IC mean
  halfLifeHistory: number[]          // 20-point sparkline: daily half-life estimate
}

// ── Section 2: Predictive Evidence ────────────────────────────────────────────

export interface ICDailySnapshot {
  date: string                       // 'YYYY-MM-DD'
  ic: number                         // session IC mean
  rollingMean: number                // 10-session rolling
  ciUpper: number                    // ±1.96σ/√10 significance
  ciLower: number
}

export interface ICDecayPoint {
  lagSec: number                     // 0.1, 0.5, 1, 2, 5, 10, 30, 60
  label: string                      // '0.1s', '0.5s', …
  icMean: number
  icir: number
  isHalfLife: boolean                // closest lag to τ × ln(2)
}

export interface QuantilePoint {
  quantile: number                   // 1-based
  label: string                      // 'Q1'–'Q5'
  meanRetBps: number                 // mean return per bar in bps
}

export interface SignalACFPoint {
  lag: number                        // 1–20 bars
  acf: number                        // AR(1)^lag
  ciUpper: number                    // Bartlett +2/√effN
  ciLower: number                    // Bartlett -2/√effN
}

// ── Section 3: Microstructure Analysis ────────────────────────────────────────

export interface IntradayBucket {
  day: string                        // 'YYYY-MM-DD' (for heatmap x-axis)
  bucketLabel: string                // 'HH:MM'
  icMean: number
  sampleCount: number
}

export interface SpreadSensitivityPoint {
  spreadBpsLabel: string             // '<0.5', '0.5–1', '1–2', '2–5', '>5'
  spreadBpsMid: number               // midpoint for axis positioning
  icMean: number
  sampleFrac: number                 // fraction of total observations
}

export interface VolumeTierPoint {
  tier: number                       // 1–5
  label: string                      // 'V1 (thin)'…'V5 (thick)'
  icMean: number
  avgAdvLabel: string                // formatted avg volume
}

// ── Section 4: Implementation Reality ─────────────────────────────────────────

export interface LatencyPoint {
  delayMs: number                    // 1, 5, 10, 25, 50, 100, 250, 500, 1000
  label: string                      // '1ms', '5ms', …
  icFraction: number                 // IC(delay) / IC(0), 0–1
}

export interface ImplementationMetrics {
  grossRetBpsPerBar: number
  grossSharpe: number
  halfSpreadCostBps: number
  fullSpreadCostBps: number
  netRetBpsPerBar: number
  netSharpe: number
  capacityEstimateUsd: number
  verdict: 'live' | 'paper' | 'investigate' | 'reject'
}

// ── Top-level Output ───────────────────────────────────────────────────────────

export interface FactorOutput {
  // Section 1
  diagnostics: FactorDiagnostics
  // Section 2
  icTimeSeries: ICDailySnapshot[]
  icDecay: ICDecayPoint[]
  icDecayHorizonMarkerSec: number      // current horizon in seconds — drawn as marker on IC Decay chart
  icValues: number[]                   // 300 per-bar IC samples for distribution + QQ + ACF
  quantileReturns: QuantilePoint[]
  signalACF: SignalACFPoint[]
  // Section 3
  intradayBuckets: IntradayBucket[]
  spreadSensitivity: SpreadSensitivityPoint[]
  volumeTiers: VolumeTierPoint[]
  // Section 4
  lsReturns: { time: string; value: number }[]
  latencyDegradation: LatencyPoint[]
  implMetrics: ImplementationMetrics
}

import type {
  ResearchParams,
  FactorOutput,
  FactorDiagnostics,
  ICDailySnapshot,
  ICDecayPoint,
  QuantilePoint,
  SignalACFPoint,
  IntradayBucket,
  SpreadSensitivityPoint,
  VolumeTierPoint,
  LatencyPoint,
  ImplementationMetrics,
} from '../types'
import { FACTOR_DEFS } from '../types'

// ── Seeded PRNG & helpers ─────────────────────────────────────────────────────

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function makeNormal(rand: () => number): () => number {
  let spare: number | null = null
  return () => {
    if (spare !== null) { const s = spare; spare = null; return s }
    const u = 1 - rand(), v = rand()
    const mag = Math.sqrt(-2 * Math.log(u))
    spare = mag * Math.cos(2 * Math.PI * v)
    return mag * Math.sin(2 * Math.PI * v)
  }
}

/** Abramowitz & Stegun normal CDF approximation */
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))))
  return z > 0 ? 1 - p : p
}

function mean(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / xs.length }
function std(xs: number[]): number {
  const mu = mean(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / xs.length)
}

function tradingDays(start: Date, n: number): string[] {
  const dates: string[] = []
  const d = new Date(start)
  while (dates.length < n) {
    if (d.getDay() !== 0 && d.getDay() !== 6) dates.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

// ── Frequency helpers ─────────────────────────────────────────────────────────

const FREQ_SEC: Record<ResearchParams['frequency'], number> = {
  '100ms': 0.1, '500ms': 0.5, '1s': 1, '5s': 5, '10s': 10, '30s': 30, '1m': 60,
}

function sessionBars(params: ResearchParams): number {
  const freqSec = FREQ_SEC[params.frequency]
  const isCrypto = params.instrument === 'btc-usdt' || params.instrument === 'eth-usdt'
  const sessionSec = isCrypto ? 86400 : 23400
  const sessionFrac = params.session === 'full' ? 1
    : params.session === 'open30' || params.session === 'close30' ? 1800 / sessionSec
    : params.session === 'mid' ? (sessionSec - 3600) / sessionSec
    : 1
  return Math.round((sessionSec * sessionFrac) / freqSec)
}

function horizonSec(params: ResearchParams): number {
  return params.horizon * FREQ_SEC[params.frequency]
}

function getFactorDef(factorId: string) {
  return FACTOR_DEFS.find((d) => d.id === factorId) ?? FACTOR_DEFS[0]!
}

/** Half-life adjusted for horizon */
function effectiveHalfLife(params: ResearchParams): number {
  const def = getFactorDef(params.factorId)
  const hSec = horizonSec(params)
  return def.typicalHalfLifeSec * (1 + 0.15 * Math.log(1 + hSec / def.typicalHalfLifeSec))
}

/**
 * Factor's intrinsic IC at lag → 0, INDEPENDENT of horizon selection.
 * This is the anchor for the IC Decay chart — must not change with horizon.
 */
function baseIC0(factorId: string): number {
  const def = getFactorDef(factorId)
  return 0.048 + (def.typicalHalfLifeSec - 4) * 0.003
}

/**
 * IC at the currently selected horizon (what you expect per bar at horizon h).
 * Used for IC Time Series and Quantile Returns.
 */
function baseICMean(params: ResearchParams): number {
  const IC0 = baseIC0(params.factorId)
  const hSec = horizonSec(params)
  const τ = effectiveHalfLife(params)
  return IC0 * Math.exp(-hSec / τ)
}

/** Per-bar IC std — nearly constant across horizons */
function baseICStd(): number {
  return 0.086
}

function avgSpread(params: ResearchParams): number {
  const spreads: Record<ResearchParams['instrument'], number> = {
    'btc-usdt': 0.35, 'eth-usdt': 0.42, 'aapl': 0.28, 'es-fut': 0.10, 'custom': 0.50,
  }
  return spreads[params.instrument]
}

// ── Section 1: Factor Diagnostics ─────────────────────────────────────────────

function buildDiagnostics(params: ResearchParams, seed: number): FactorDiagnostics {
  const rand = mulberry32(seed + 1)
  const normal = makeNormal(rand)

  const freqSec = FREQ_SEC[params.frequency]
  const halfLifeSec = effectiveHalfLife(params)
  const icMean = baseICMean(params)
  const icStd = baseICStd()
  const icir = icMean / icStd

  const ar1 = Math.exp(-freqSec / halfLifeSec)
  const rawN = sessionBars(params) * 30
  const effN = Math.round(rawN * (1 - ar1 * ar1) / (1 + ar1 * ar1))
  const snrRatio = icMean / icStd * Math.sqrt(effN)

  const tStat = icMean / (icStd / Math.sqrt(effN))
  const directionConfidence = Math.min(1, (normalCDF(Math.abs(tStat)) - 0.5) * 2)
  const direction: FactorDiagnostics['direction'] = Math.abs(tStat) < 1.5 ? 'mixed' : icMean > 0 ? 'positive' : 'negative'

  const icHistory: number[] = []
  const halfLifeHistory: number[] = []
  for (let i = 0; i < 20; i++) {
    icHistory.push(icMean + normal() * icStd * 0.3)
    halfLifeHistory.push(halfLifeSec * (0.85 + rand() * 0.3))
  }

  return {
    direction, directionConfidence, halfLifeSec,
    icMean, icStd, icir, ar1,
    effectiveSampleSize: effN, snrRatio,
    avgSpreadBps: avgSpread(params),
    icHistory, halfLifeHistory,
  }
}

// ── Section 2: IC Time Series (30 sessions) ───────────────────────────────────

function buildICTimeSeries(params: ResearchParams, seed: number): ICDailySnapshot[] {
  const rand = mulberry32(seed)
  const normal = makeNormal(rand)

  // Session-level IC: mean of many per-bar ICs, so variance shrinks by √bars
  const ic0 = baseIC0(params.factorId)
  const hSec = horizonSec(params)
  const τ = effectiveHalfLife(params)
  const icMu = ic0 * Math.exp(-hSec / τ)
  const bars = sessionBars({ ...params, session: 'full' })
  // Per-session IC std = per-bar std / √bars, ×3 for intraday variation
  const sessionNoise = baseICStd() / Math.sqrt(Math.max(bars, 1)) * 3
  const PHI = 0.18

  const dates = tradingDays(new Date('2024-07-01'), 30)
  const rawIC: number[] = []
  let prev = icMu
  for (let i = 0; i < 30; i++) {
    const ic = icMu + PHI * (prev - icMu) + normal() * sessionNoise
    rawIC.push(ic)
    prev = ic
  }

  const ROLL = 5
  const fullStd = std(rawIC)
  const sigLevel = 1.96 * fullStd / Math.sqrt(ROLL)

  return rawIC.map((ic, i) => {
    const window = rawIC.slice(Math.max(0, i - ROLL + 1), i + 1)
    const wMu = mean(window)
    return { date: dates[i]!, ic, rollingMean: wMu, ciUpper: sigLevel, ciLower: -sigLevel }
  })
}

// ── Section 2: IC Decay Curve ─────────────────────────────────────────────────
//
// KEY FIX: IC0 is always the factor's intrinsic IC at lag=0 (horizon-independent).
// The currently selected horizon is passed back as `horizonMarkerSec` so the chart
// can draw a "current horizon" vertical marker without affecting the Y-axis scale.

function buildICDecay(params: ResearchParams): { points: ICDecayPoint[]; horizonMarkerSec: number } {
  const halfLifeSec = effectiveHalfLife(params)
  const IC0 = baseIC0(params.factorId)  // horizon-independent anchor
  const icStd0 = baseICStd()

  const lags = [0.1, 0.5, 1, 2, 5, 10, 30, 60]
  const halfLifePoint = halfLifeSec * Math.LN2

  const points = lags.map((lagSec) => {
    const icMean = IC0 * Math.exp(-lagSec / halfLifeSec)
    const icir = (icMean / icStd0) * Math.sqrt(sessionBars(params) * 30)
    const isHalfLife = lags.reduce((best, l) =>
      Math.abs(l - halfLifePoint) < Math.abs(best - halfLifePoint) ? l : best, lags[0]!
    ) === lagSec
    const label = `${lagSec}s`
    return { lagSec, label, icMean, icir, isHalfLife }
  })

  return { points, horizonMarkerSec: horizonSec(params) }
}

// ── Section 2: Per-bar IC samples (for distribution + QQ + ACF) ──────────────

function buildIcValues(params: ResearchParams, seed: number): number[] {
  const rand = mulberry32(seed + 11)
  const normal = makeNormal(rand)

  const icMu = baseICMean(params)
  const icStd = baseICStd()
  const ar1 = Math.exp(-FREQ_SEC[params.frequency] / effectiveHalfLife(params))
  const N = 300

  // AR(1) process with mild non-normality (slightly heavier tails via t-like mixing)
  const samples: number[] = []
  let prev = icMu
  for (let i = 0; i < N; i++) {
    const innov = normal() * icStd * Math.sqrt(1 - ar1 * ar1)
    // Occasional fat-tail draws (5% of samples) for realism
    const fatTailMix = rand() < 0.05 ? 2.5 : 1.0
    const ic = icMu + ar1 * (prev - icMu) + innov * fatTailMix
    samples.push(ic)
    prev = ic
  }
  return samples
}

// ── Section 2: Quantile Returns ───────────────────────────────────────────────

function buildQuantileReturns(params: ResearchParams, seed: number): QuantilePoint[] {
  const rand = mulberry32(seed + 3)
  const normal = makeNormal(rand)

  // Use baseIC0 (horizon-independent) for the spread scale
  const ic0 = baseIC0(params.factorId)
  // Return per unit IC in bps/bar at 1s horizon (base rate)
  const retPerIC_bps = 8.0
  const spreadBps = ic0 * retPerIC_bps * 4  // total spread Q1→Q5

  const labels = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5']
  return labels.map((label, i) => {
    const base = -spreadBps / 2 + (spreadBps / 4) * i
    // Small noise (0.15σ) so monotonicity is clearly visible
    const noise = normal() * spreadBps * 0.08
    return { quantile: i + 1, label, meanRetBps: base + noise }
  })
}

// ── Section 2: Signal ACF (empirical from icValues) ───────────────────────────

function buildSignalACF(params: ResearchParams, icValues: number[]): SignalACFPoint[] {
  const n = icValues.length
  const mu = mean(icValues)
  const variance = icValues.reduce((s, v) => s + (v - mu) ** 2, 0) / n
  const bartlett = 2 / Math.sqrt(n)

  return Array.from({ length: 20 }, (_, i) => {
    const lag = i + 1
    // Empirical ACF
    let cov = 0
    for (let j = 0; j < n - lag; j++) {
      cov += (icValues[j]! - mu) * (icValues[j + lag]! - mu)
    }
    const acf = variance > 0 ? cov / ((n - lag) * variance) : 0
    return { lag, acf, ciUpper: bartlett, ciLower: -bartlett }
  })
}

// ── Section 3: Intraday Heatmap ───────────────────────────────────────────────

function buildIntradayBuckets(params: ResearchParams, seed: number): IntradayBucket[] {
  const rand = mulberry32(seed + 5)
  const normal = makeNormal(rand)
  const icMu = baseICMean(params)
  const isCrypto = params.instrument === 'btc-usdt' || params.instrument === 'eth-usdt'
  const def = getFactorDef(params.factorId)

  const buckets = isCrypto
    ? ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00']
    : ['09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30']

  function intradayMultiplier(label: string): number {
    if (isCrypto) {
      const h = parseInt(label.split(':')[0]!)
      return h >= 14 && h <= 22 ? 1.2 + rand() * 0.3 : 0.8 + rand() * 0.3
    }
    if (label <= '10:00' || label >= '15:00') return 1.35 + rand() * 0.25
    if (label >= '12:00' && label <= '13:30') return 0.65 + rand() * 0.2
    return 0.95 + rand() * 0.2
  }

  const dates = tradingDays(new Date('2024-07-15'), 10)
  const result: IntradayBucket[] = []
  for (const day of dates) {
    for (const bucketLabel of buckets) {
      const mult = intradayMultiplier(bucketLabel)
      const noiseScale = def.category === 'info' ? 0.3 : 0.5
      const icMean = icMu * mult + normal() * Math.abs(icMu) * noiseScale
      const barsInBucket = isCrypto ? 7200 / FREQ_SEC[params.frequency] : 1800 / FREQ_SEC[params.frequency]
      result.push({ day, bucketLabel, icMean, sampleCount: Math.round(barsInBucket) })
    }
  }
  return result
}

// ── Section 3: Spread Sensitivity ─────────────────────────────────────────────

function buildSpreadSensitivity(params: ResearchParams, seed: number): SpreadSensitivityPoint[] {
  const rand = mulberry32(seed + 6)
  const normal = makeNormal(rand)
  const ic0 = baseIC0(params.factorId)
  const def = getFactorDef(params.factorId)

  const bins = [
    { label: '<0.5', mid: 0.25, frac: 0.12 },
    { label: '0.5–1', mid: 0.75, frac: 0.28 },
    { label: '1–2', mid: 1.5, frac: 0.35 },
    { label: '2–5', mid: 3.5, frac: 0.18 },
    { label: '>5', mid: 7.0, frac: 0.07 },
  ]

  return bins.map(({ label, mid, frac }) => {
    const optimalSpread = def.category === 'microstructure' ? 2.0 : 1.2
    const spreadDist = Math.abs(mid - optimalSpread)
    const mult = Math.exp(-spreadDist * (def.category === 'orderflow' ? 0.4 : 0.3))
    const noise = normal() * ic0 * 0.2
    return { spreadBpsLabel: label, spreadBpsMid: mid, icMean: ic0 * mult + noise, sampleFrac: frac }
  })
}

// ── Section 3: Volume Tiers ───────────────────────────────────────────────────

function buildVolumeTiers(params: ResearchParams, seed: number): VolumeTierPoint[] {
  const rand = mulberry32(seed + 8)
  const normal = makeNormal(rand)
  const ic0 = baseIC0(params.factorId)
  const def = getFactorDef(params.factorId)

  const tiers = [
    { tier: 1, label: 'V1 (thin)', advLabel: '<10k' },
    { tier: 2, label: 'V2', advLabel: '10–50k' },
    { tier: 3, label: 'V3', advLabel: '50–200k' },
    { tier: 4, label: 'V4', advLabel: '200k–1M' },
    { tier: 5, label: 'V5 (thick)', advLabel: '>1M' },
  ]

  return tiers.map(({ tier, label, advLabel }) => {
    const mult = (def.category === 'orderflow' || def.category === 'momentum')
      ? [0.6, 0.8, 1.0, 1.1, 0.9][tier - 1]!
      : [1.1, 1.0, 0.85, 0.7, 0.55][tier - 1]!
    return {
      tier, label, icMean: ic0 * mult + normal() * ic0 * 0.12, avgAdvLabel: advLabel,
    }
  })
}

// ── Section 4: L/S Returns ────────────────────────────────────────────────────

function buildLSReturns(
  icSeries: ICDailySnapshot[],
  params: ResearchParams,
  seed: number,
): { time: string; value: number }[] {
  const rand = mulberry32(seed + 7)
  const normal = makeNormal(rand)

  const ic0 = baseIC0(params.factorId)
  const retPerIC_bps = 8.0
  const noiseSigmaBps = avgSpread(params) * 2

  let cum = 0
  return icSeries.map((s) => {
    // Scale session IC back to per-bar for L/S calc
    const r = s.ic * retPerIC_bps + normal() * noiseSigmaBps
    void ic0
    cum += r
    return { time: s.date, value: cum }
  })
}

// ── Section 4: Latency Degradation ───────────────────────────────────────────

function buildLatencyDegradation(params: ResearchParams): LatencyPoint[] {
  const halfLifeMs = effectiveHalfLife(params) * 1000
  const delays = [1, 5, 10, 25, 50, 100, 250, 500, 1000]
  return delays.map((delayMs) => ({
    delayMs,
    label: delayMs < 1000 ? `${delayMs}ms` : '1s',
    icFraction: Math.exp(-delayMs / halfLifeMs),
  }))
}

// ── Section 4: Implementation Metrics ────────────────────────────────────────

function buildImplMetrics(
  lsReturns: { time: string; value: number }[],
  params: ResearchParams,
  diagnostics: FactorDiagnostics,
): ImplementationMetrics {
  const sessionRets = lsReturns.map((p, i) => p.value - (i > 0 ? lsReturns[i - 1]!.value : 0))
  const grossRetBpsPerBar = sessionRets.length > 0 ? mean(sessionRets) : 0
  const retStd = sessionRets.length > 1 ? std(sessionRets) : 1
  const annFactor = Math.sqrt(252)
  const grossSharpe = retStd > 0 ? (grossRetBpsPerBar / retStd) * annFactor : 0

  const halfSpreadCostBps = diagnostics.avgSpreadBps * 0.5
  const fullSpreadCostBps = diagnostics.avgSpreadBps
  const costPerBar = params.costModel === 'zero' ? 0
    : params.costModel === 'half-spread' ? halfSpreadCostBps
    : fullSpreadCostBps

  const netRetBpsPerBar = grossRetBpsPerBar - costPerBar
  const netSharpe = retStd > 0 ? (netRetBpsPerBar / retStd) * annFactor : 0

  const volProxy: Record<ResearchParams['instrument'], number> = {
    'btc-usdt': 2_000_000, 'eth-usdt': 800_000, 'aapl': 500_000, 'es-fut': 1_200_000, 'custom': 300_000,
  }
  const capacityEstimateUsd = volProxy[params.instrument]! * diagnostics.avgSpreadBps * 0.1
  const verdict: ImplementationMetrics['verdict'] = netSharpe >= 1.5 ? 'live'
    : netSharpe >= 0.75 ? 'paper'
    : netSharpe >= 0 ? 'investigate'
    : 'reject'

  return {
    grossRetBpsPerBar, grossSharpe,
    halfSpreadCostBps, fullSpreadCostBps,
    netRetBpsPerBar, netSharpe,
    capacityEstimateUsd, verdict,
  }
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildFactorOutput(params: ResearchParams): FactorOutput {
  const SEED = 42

  const diagnostics = buildDiagnostics(params, SEED)
  const icTimeSeries = buildICTimeSeries(params, SEED)
  const { points: icDecay, horizonMarkerSec: icDecayHorizonMarkerSec } = buildICDecay(params)
  const icValues = buildIcValues(params, SEED)
  const quantileReturns = buildQuantileReturns(params, SEED)
  const signalACF = buildSignalACF(params, icValues)
  const intradayBuckets = buildIntradayBuckets(params, SEED)
  const spreadSensitivity = buildSpreadSensitivity(params, SEED)
  const volumeTiers = buildVolumeTiers(params, SEED)
  const lsReturns = buildLSReturns(icTimeSeries, params, SEED)
  const latencyDegradation = buildLatencyDegradation(params)
  const implMetrics = buildImplMetrics(lsReturns, params, diagnostics)

  return {
    diagnostics,
    icTimeSeries, icDecay, icDecayHorizonMarkerSec, icValues,
    quantileReturns, signalACF,
    intradayBuckets, spreadSensitivity, volumeTiers,
    lsReturns, latencyDegradation, implMetrics,
  }
}

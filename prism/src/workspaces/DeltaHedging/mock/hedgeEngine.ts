import { TOPICS } from '../types'
import type { EnhancedSnapshot, SimEvent, FrequencyComparisonRow, RebalanceDetail } from '../types'

// ─── Black-Scholes Math ───────────────────────────────────────────────────────

/** Abramowitz & Stegun approximation of the normal CDF (max error 7.5e-8) */
function normalCDF(x: number): number {
  const sign = x < 0 ? -1 : 1
  const z = Math.abs(x) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * z)
  const poly =
    t * (0.254829592 +
    t * (-0.284496736 +
    t * (1.421413741 +
    t * (-1.453152027 +
    t * 1.061405429))))
  return 0.5 * (1 + sign * (1 - poly * Math.exp(-z * z)))
}

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

interface BSResult {
  price: number
  delta: number
  gamma: number
  vega: number
  theta: number
}

/**
 * Black-Scholes pricing and Greeks for a European call option.
 * @param S  current underlying price
 * @param K  strike price
 * @param T  time to expiry in years
 * @param r  risk-free rate (annualised)
 * @param sigma  implied volatility (annualised)
 */
export function blackScholesCall(S: number, K: number, T: number, r: number, sigma: number): BSResult {
  if (T <= 0) {
    const intrinsic = Math.max(S - K, 0)
    return { price: intrinsic, delta: intrinsic > 0 ? 1 : 0, gamma: 0, vega: 0, theta: 0 }
  }
  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  const Nd1 = normalCDF(d1)
  const Nd2 = normalCDF(d2)
  const nd1 = normalPDF(d1)
  const discount = Math.exp(-r * T)

  return {
    price: S * Nd1 - K * discount * Nd2,
    delta: Nd1,
    gamma: nd1 / (S * sigma * sqrtT),
    vega: (S * nd1 * sqrtT) / 100,           // per 1% vol move
    theta: (-(S * nd1 * sigma) / (2 * sqrtT) - r * K * discount * Nd2) / 365,
  }
}

// ─── RNG (seeded LCG for reproducibility) ────────────────────────────────────

function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0
    return s / 0x100000000
  }
}

/** Box-Muller transform → standard normal sample */
function nextNormal(rng: () => number): number {
  return Math.sqrt(-2 * Math.log(rng() + 1e-10)) * Math.cos(2 * Math.PI * rng())
}

// ─── Date utilities ───────────────────────────────────────────────────────────

function addBusinessDays(base: Date, days: number): string {
  const d = new Date(base)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) added++
  }
  return d.toISOString().slice(0, 10)
}

// ─── Simulation parameters ────────────────────────────────────────────────────

export interface SimParams {
  S0: number          // initial underlying price
  K: number           // strike price
  T: number           // time to expiry in years
  r: number           // risk-free rate (annualised)
  sigma: number       // implied volatility (annualised)
  mu: number          // physical drift (GBM path only, not used in pricing)
  steps: number       // total simulation steps
  hedgeInterval: number  // rebalance every N steps
  seed: number        // RNG seed for reproducibility
}

export const DEFAULT_PARAMS: SimParams = {
  S0: 100, K: 100, T: 1.0, r: 0.05,
  sigma: 0.20, mu: 0.05,
  steps: 252, hedgeInterval: 10, seed: 42,
}

/** Contract multiplier: 1 contract = 100 shares. Exported for chart normalisation. */
export const MULTIPLIER = 100

// ─── Core simulation engine ───────────────────────────────────────────────────

let _idCounter = 0

/**
 * Pre-compute a complete delta-hedging simulation.
 *
 * Scenario: sold 1 European call (MULTIPLIER shares notional) at inception,
 * collected premium, and continuously delta-hedge by rebalancing every
 * `hedgeInterval` steps.
 *
 * Each snapshot includes the full replication portfolio state and error εt
 * needed by the theoretical lab panel.
 */
export function runHedgeSimulation(params: SimParams = DEFAULT_PARAMS): EnhancedSnapshot[] {
  const { S0, K, T, r, sigma, mu, steps, hedgeInterval, seed } = params
  const dt = T / steps
  const rng = makeRng(seed)
  const BASE_DATE = new Date('2025-01-06')

  // Portfolio state (mutated each step)
  let S = S0
  let sharesHeld = 0
  let cash = 0

  // Accumulated tracking
  let cumulativeCost = 0
  let prevError = 0
  let prevPrice = S0
  let prevRebalanceDelta: number | undefined = undefined  // Δt at the last rebalance

  // t=0: sell 1 call, collect premium
  const initBS = blackScholesCall(S, K, T, r, sigma)
  cash = initBS.price * MULTIPLIER  // premium received into cash account

  const snapshots: EnhancedSnapshot[] = []

  for (let step = 0; step <= steps; step++) {
    const elapsed = step * dt
    const tau = Math.max(T - elapsed, 1e-6)
    const date = step === 0
      ? BASE_DATE.toISOString().slice(0, 10)
      : addBusinessDays(BASE_DATE, step)

    const bs = blackScholesCall(S, K, tau, r, sigma)

    // ── Pre-trade snapshot ─────────────────────────────────────────────────────
    const sharesHeldBefore = sharesHeld
    const cashBefore = cash
    const replicationValuePre = sharesHeld * S + cash
    const replicationErrorPre = replicationValuePre - bs.price * MULTIPLIER

    // Portfolio delta from the short-option perspective:
    //   short 1 contract → optionDelta = -bs.delta × MULTIPLIER
    //   portfolioDelta = sharesHeld + optionDelta   (target: 0)
    const optionDeltaContractSigned = -1 * bs.delta * MULTIPLIER
    const portfolioDeltaPreHedge = sharesHeld + optionDeltaContractSigned

    // ── Execute hedge trade if on rebalance step ───────────────────────────────
    let hedgeTrade: EnhancedSnapshot['hedgeTrade']
    let transactionCost = 0
    const isHedge = step % hedgeInterval === 0

    if (isHedge) {
      // targetShares = -optionDelta  (makes portfolioDelta → 0)
      const targetShares = -optionDeltaContractSigned
      const tradeQty = Math.round(targetShares - sharesHeld)

      if (Math.abs(tradeQty) >= 1) {
        const side = tradeQty > 0 ? 'buy' as const : 'sell' as const
        const qty = Math.abs(tradeQty)
        const tradeValue = qty * S

        // Transaction cost: 0.1% of trade value (10 bps)
        transactionCost = tradeValue * 0.001
        cumulativeCost += transactionCost

        if (side === 'buy') {
          sharesHeld += qty
          cash -= tradeValue + transactionCost
        } else {
          sharesHeld -= qty
          cash += tradeValue - transactionCost
        }
        hedgeTrade = { side, qty, price: +S.toFixed(4) }
      }
    }

    // ── Post-trade replication state ───────────────────────────────────────────
    const replicationValue = sharesHeld * S + cash
    const replicationError = replicationValue - bs.price * MULTIPLIER

    // Error decomposition: Δεt ≈ ½Γ(ΔS)² + ΘΔt
    const errorChange = step > 0 ? replicationError - prevError : 0
    const dS = step > 0 ? S - prevPrice : 0
    const gammaContribution = 0.5 * bs.gamma * (dS * dS) * MULTIPLIER
    const thetaContribution = bs.theta * dt * MULTIPLIER

    const portfolioDelta = sharesHeld + optionDeltaContractSigned

    // NAV = replication portfolio value minus option liability (same as −εt but
    // signed from a "we are short" perspective; also ≈ P&L from inception).
    const nav = replicationValue - bs.price * MULTIPLIER
    const pnl = nav  // inception NAV ≈ 0 (premium collected = initial option value)

    // ── Build MathEvent ────────────────────────────────────────────────────────
    let rebalanceDetail: RebalanceDetail | undefined = undefined
    if (hedgeTrade) {
      rebalanceDetail = {
        optionDeltaBefore: prevRebalanceDelta ?? bs.delta,
        optionDeltaAfter: bs.delta,
        sharesChange: sharesHeld - sharesHeldBefore,
        cashChange: cash - cashBefore,
        errorBefore: +replicationErrorPre.toFixed(2),
        errorAfter: +replicationError.toFixed(2),
      }
      prevRebalanceDelta = bs.delta
    }

    // ── Build SimEvent ─────────────────────────────────────────────────────────
    // Routing metadata (id, kind, topic, ts_event, step) is separated from the
    // business payload — mirrors aurum's message struct layout.
    const marketPayload = {
      St: +S.toFixed(4),
      Vt: +bs.price.toFixed(4),
      tau,
      optionDelta: +bs.delta.toFixed(4),
      replicationValue: +replicationValue.toFixed(2),
      replicationError: +replicationError.toFixed(2),
      sharesHeld: +sharesHeld.toFixed(2),
      cash: +cash.toFixed(2),
    }

    const event: SimEvent = hedgeTrade && rebalanceDetail
      ? {
          id: `evt-${++_idCounter}`,
          kind: 'REBALANCE',
          topic: TOPICS.REBALANCE,
          ts_event: date,
          step,
          payload: { ...marketPayload, rebalance: rebalanceDetail },
        }
      : {
          id: `evt-${++_idCounter}`,
          kind: 'PRICE_MOVE',
          topic: TOPICS.PRICE_MOVE,
          ts_event: date,
          step,
          payload: marketPayload,
        }

    snapshots.push({
      step,
      date,
      price: +S.toFixed(4),
      optionValue: +bs.price.toFixed(4),
      greeks: {
        delta: +bs.delta.toFixed(4),
        gamma: +bs.gamma.toFixed(5),
        vega: +bs.vega.toFixed(4),
        theta: +bs.theta.toFixed(4),
      },
      tau,
      sharesHeld: +sharesHeld.toFixed(0),
      cash: +cash.toFixed(2),
      hedgeTrade,
      portfolioDelta: +portfolioDelta.toFixed(2),
      portfolioDeltaPreHedge: hedgeTrade ? +portfolioDeltaPreHedge.toFixed(2) : undefined,
      replicationValue: +replicationValue.toFixed(2),
      replicationError: +replicationError.toFixed(2),
      errorChange: step > 0 ? +errorChange.toFixed(2) : undefined,
      gammaContribution: step > 0 ? +gammaContribution.toFixed(2) : undefined,
      thetaContribution: step > 0 ? +thetaContribution.toFixed(2) : undefined,
      transactionCost: transactionCost > 0 ? +transactionCost.toFixed(2) : undefined,
      cumulativeCost: +cumulativeCost.toFixed(2),
      nav: +nav.toFixed(2),
      pnl: +pnl.toFixed(2),
      event,
    })

    // Update tracking for next iteration
    prevError = replicationError
    prevPrice = S

    // ── Advance price with GBM (skip on last step) ─────────────────────────────
    if (step < steps) {
      const Z = nextNormal(rng)
      S = S * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * Z)
    }
  }

  return snapshots
}

// ─── Frequency comparison ─────────────────────────────────────────────────────

/**
 * Run simulations at different hedge intervals and compute replication error
 * statistics. Demonstrates how discrete hedging approximates continuous theory.
 */
export function runFrequencyComparison(
  baseParams: SimParams,
  intervals: number[],
): FrequencyComparisonRow[] {
  return intervals.map((hedgeInterval) => {
    const sims = runHedgeSimulation({ ...baseParams, hedgeInterval })
    const errors = sims.map((s) => s.replicationError)
    const totalTrades = sims.filter((s) => s.hedgeTrade !== undefined).length
    const terminalError = errors[errors.length - 1]
    const maxAbsError = Math.max(...errors.map(Math.abs))
    const rmse = Math.sqrt(errors.reduce((acc, e) => acc + e * e, 0) / errors.length)

    return {
      hedgeInterval,
      totalTrades,
      terminalError: +terminalError.toFixed(2),
      maxAbsError: +maxAbsError.toFixed(2),
      rmse: +rmse.toFixed(2),
    }
  })
}

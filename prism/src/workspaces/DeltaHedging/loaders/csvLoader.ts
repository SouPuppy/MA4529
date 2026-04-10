// ─── CSV → EnhancedSnapshot loader ───────────────────────────────────────────
//
// Reads the output produced by the spy_delta_hedging aurum strategy and maps
// it to the same EnhancedSnapshot format the panel already understands.
//
// Hardcoded contract details (SPY US 12/18/26 C600):
//   STRIKE   = 600
//   EXPIRY   = 2026-12-18
//   RATE     = 4.5%  (from strategy)
//   NOTIONAL = 100   (shares per contract)
//
// Missing fields (tau, option greeks, cash, replication values) are derived
// from the available CSV columns via Black-Scholes.

import { blackScholesCall } from '../mock/hedgeEngine'
import { TOPICS } from '../types'
import type { EnhancedSnapshot, SimEvent } from '../types'

// ─── Contract constants ───────────────────────────────────────────────────────

const STRIKE   = 600
const EXPIRY   = new Date('2026-12-18T00:00:00Z')
const RATE     = 0.045
const NOTIONAL = 100
const TXN_COST = 0.001  // 10 bps, same as mock engine

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_INDEX: Record<string, number> = {
  January:1, February:2, March:3, April:4, May:5, June:6,
  July:7, August:8, September:9, October:10, November:11, December:12,
}

/** "5 October 2025" → Date (UTC midnight) */
function parseCsvDate(s: string): Date {
  const [day, month, year] = s.trim().split(' ')
  return new Date(Date.UTC(Number(year), MONTH_INDEX[month] - 1, Number(day)))
}

/** Date → "YYYY-MM-DD" */
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Years remaining from tradeDate to EXPIRY (Actual/365.25) */
function tauYears(tradeDate: Date): number {
  return Math.max(0, (EXPIRY.getTime() - tradeDate.getTime()) / (365.25 * 24 * 3600 * 1000))
}

let _idCounter = 0

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Fetch a CSV produced by the aurum spy_delta_hedging strategy and convert
 * every row into an EnhancedSnapshot, computing the fields not written by
 * aurum (greeks beyond delta, option value, cash, replication tracking).
 */
export async function loadCsvSnapshots(url: string): Promise<EnhancedSnapshot[]> {
  const text   = await fetch(url).then((r) => r.text())
  const lines  = text.trim().split('\n')
  const rows   = lines.slice(1)  // skip header

  const snapshots: EnhancedSnapshot[] = []
  let cash           = 0
  let sharesHeld     = 0
  let cumulativeCost = 0
  let initialised    = false

  for (let i = 0; i < rows.length; i++) {
    const cols = rows[i].split(',')
    // CSV columns: trade_date, spot, ivol, delta, target_qty, current_qty, diff_qty, realized_pnl, action
    const [tradeDateStr, spotStr, ivolStr, deltaStr, , currentQtyStr, diffQtyStr, realizedPnlStr, actionRaw] = cols

    const tradeDate  = parseCsvDate(tradeDateStr)
    const spot       = parseFloat(spotStr)
    const ivol       = parseFloat(ivolStr)
    const csvDelta   = parseFloat(deltaStr)
    const currentQty = parseFloat(currentQtyStr)
    const diffQty    = parseFloat(diffQtyStr)
    const realizedPnl = parseFloat(realizedPnlStr)
    const action     = actionRaw.trim().toUpperCase()

    const tau  = tauYears(tradeDate)
    const bs   = blackScholesCall(spot, STRIKE, tau, RATE, ivol)
    const date = toISODate(tradeDate)

    // On first row: sell 1 call, receive premium as initial cash
    if (!initialised) {
      cash        = bs.price * NOTIONAL
      sharesHeld  = currentQty
      initialised = true
    }

    // ── Process hedge trade ──────────────────────────────────────────────────
    let hedgeTrade: EnhancedSnapshot['hedgeTrade']
    let transactionCost: number | undefined

    if (action === 'BUY' || action === 'SELL') {
      const qty  = Math.abs(diffQty)
      const side = action === 'BUY' ? 'buy' : 'sell' as const
      hedgeTrade     = { side, qty, price: spot }
      transactionCost = qty * spot * TXN_COST
      cumulativeCost += transactionCost
      if (side === 'buy') {
        cash       -= qty * spot + transactionCost
        sharesHeld += qty
      } else {
        cash       += qty * spot - transactionCost
        sharesHeld -= qty
      }
    } else {
      // HOLD: aurum already wrote current_qty, trust it
      sharesHeld = currentQty
    }

    // ── Portfolio accounting ─────────────────────────────────────────────────
    const replicationValue = sharesHeld * spot + cash
    const replicationError = replicationValue - bs.price * NOTIONAL
    const portfolioDelta   = sharesHeld - csvDelta * NOTIONAL

    const prev = snapshots[i - 1]

    // ── Build event ──────────────────────────────────────────────────────────
    const eventId = String(++_idCounter)
    let event: SimEvent

    if (action === 'BUY' || action === 'SELL') {
      event = {
        id:       eventId,
        kind:     'REBALANCE',
        topic:    TOPICS.REBALANCE,
        ts_event: date,
        step:     i,
        payload: {
          St:               spot,
          Vt:               bs.price,
          tau,
          optionDelta:      csvDelta,
          replicationValue,
          replicationError,
          sharesHeld,
          cash,
          rebalance: {
            optionDeltaBefore: prev?.greeks.delta ?? csvDelta,
            optionDeltaAfter:  csvDelta,
            sharesChange:      action === 'BUY' ? diffQty : -diffQty,
            cashChange:        action === 'BUY' ? -(diffQty * spot) : diffQty * spot,
            errorBefore:       prev?.replicationError ?? replicationError,
            errorAfter:        replicationError,
          },
        },
      }
    } else {
      event = {
        id:       eventId,
        kind:     'PRICE_MOVE',
        topic:    TOPICS.PRICE_MOVE,
        ts_event: date,
        step:     i,
        payload: {
          St:               spot,
          Vt:               bs.price,
          tau,
          optionDelta:      csvDelta,
          replicationValue,
          replicationError,
          sharesHeld,
          cash,
        },
      }
    }

    snapshots.push({
      step:        i,
      date,
      price:       spot,
      optionValue: bs.price,
      greeks: {
        delta: csvDelta,
        gamma: bs.gamma,
        vega:  bs.vega,
        theta: bs.theta,
      },
      tau,
      sharesHeld,
      cash,
      hedgeTrade,
      portfolioDelta,
      portfolioDeltaPreHedge: prev ? prev.portfolioDelta : portfolioDelta,
      replicationValue,
      replicationError,
      errorChange:        prev ? replicationError - prev.replicationError : undefined,
      gammaContribution:  prev ? 0.5 * bs.gamma * Math.pow(spot - prev.price, 2) : undefined,
      thetaContribution:  prev ? bs.theta * (1 / 365) : undefined,
      transactionCost,
      cumulativeCost,
      nav: replicationValue,
      pnl: realizedPnl,
      event,
    })
  }

  return snapshots
}

// ─── SimParams-compatible descriptor for ParameterPanel ─────────────────────
//
// Describes the real SPY US 12/18/26 C600 contract so ParameterPanel can
// display meaningful values instead of the mock defaults.

export const CSV_PARAMS = {
  S0:            573.0,     // initial spot from aurum strategy
  K:             STRIKE,
  T:             tauYears(new Date('2025-10-05T00:00:00Z')),  // full backtest duration
  r:             RATE,
  sigma:         0.244916,  // Bloomberg ivol (constant in current data)
  mu:            0,         // not used for static replay
  steps:         159,       // rows in CSV
  hedgeInterval: 1,         // aurum checks daily
  seed:          0,
}

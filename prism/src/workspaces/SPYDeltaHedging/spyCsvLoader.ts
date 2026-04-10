// ─── SPY Delta Hedging CSV loader ─────────────────────────────────────────────
//
// Reads the enriched CSV produced by the spy_delta_hedging aurum strategy
// (19 columns) and maps each row to EnhancedSnapshot.
//
// New columns added by aurum (compared with the old 9-col format):
//   option_price, gamma, theta, vega,
//   cash_position, portfolio_value, option_liability,
//   replication_error, unrealized_pnl
//
// Falls back to Black-Scholes computation for any missing column so the
// loader works with both the old and new CSV formats.

import { blackScholesCall } from '../DeltaHedging/mock/hedgeEngine'
import { TOPICS } from '../DeltaHedging/types'
import type { EnhancedSnapshot, SimEvent } from '../DeltaHedging/types'

// ─── Contract constants ───────────────────────────────────────────────────────

export const SPY_CONTRACT = {
  ticker:   'SPY US 12/18/26 C600',
  strike:   600,
  expiry:   '2026-12-18',
  rate:     0.045,
  notional: 100,
  S0:       573.0,
}

const EXPIRY_MS = new Date(`${SPY_CONTRACT.expiry}T00:00:00Z`).getTime()

const MONTH_INDEX: Record<string, number> = {
  January:1, February:2, March:3, April:4, May:5, June:6,
  July:7, August:8, September:9, October:10, November:11, December:12,
}

function parseCsvDate(s: string): Date {
  const [day, month, year] = s.trim().split(' ')
  return new Date(Date.UTC(Number(year), MONTH_INDEX[month] - 1, Number(day)))
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function tauYears(d: Date): number {
  return Math.max(0, (EXPIRY_MS - d.getTime()) / (365.25 * 24 * 3600 * 1000))
}

// ─── Column index map ─────────────────────────────────────────────────────────

interface ColMap {
  trade_date: number
  spot: number
  ivol: number
  tau: number
  option_price: number
  delta: number
  gamma: number
  theta: number
  vega: number
  target_qty: number
  current_qty: number
  diff_qty: number
  cash_position: number
  portfolio_value: number
  option_liability: number
  replication_error: number
  realized_pnl: number
  unrealized_pnl: number
  action: number
}

function buildColMap(header: string): ColMap {
  const cols = header.split(',').map((c, i) => [c.trim(), i] as [string, number])
  const idx = Object.fromEntries(cols) as Record<string, number>
  const get = (name: string) => idx[name] ?? -1
  return {
    trade_date:        get('trade_date'),
    spot:              get('spot'),
    ivol:              get('ivol'),
    tau:               get('tau'),
    option_price:      get('option_price'),
    delta:             get('delta'),
    gamma:             get('gamma'),
    theta:             get('theta'),
    vega:              get('vega'),
    target_qty:        get('target_qty'),
    current_qty:       get('current_qty'),
    diff_qty:          get('diff_qty'),
    cash_position:     get('cash_position'),
    portfolio_value:   get('portfolio_value'),
    option_liability:  get('option_liability'),
    replication_error: get('replication_error'),
    realized_pnl:      get('realized_pnl'),
    unrealized_pnl:    get('unrealized_pnl'),
    action:            get('action'),
  }
}

function col(row: string[], idx: number): string {
  return idx >= 0 ? (row[idx] ?? '').trim() : ''
}

function num(row: string[], idx: number): number {
  const v = col(row, idx)
  return v ? parseFloat(v) : NaN
}

// ─── Loader ───────────────────────────────────────────────────────────────────

let _idCounter = 0

export async function loadSpyCsvSnapshots(url: string): Promise<EnhancedSnapshot[]> {
  const text  = await fetch(url).then((r) => r.text())
  const lines = text.trim().split('\n')
  const c     = buildColMap(lines[0])
  const rows  = lines.slice(1)

  const snapshots: EnhancedSnapshot[] = []
  let cash           = 0
  let cumulativeCost = 0
  let initialised    = false

  for (let i = 0; i < rows.length; i++) {
    const row      = rows[i].split(',')
    const dateRaw  = col(row, c.trade_date)
    if (!dateRaw) continue

    const tradeDate = parseCsvDate(dateRaw)
    const date      = toISODate(tradeDate)
    const spot      = num(row, c.spot)
    const ivolPct   = num(row, c.ivol)          // % form (e.g. 24.49)
    const ivol      = ivolPct > 1 ? ivolPct / 100 : ivolPct  // normalise to decimal
    const tau       = c.tau >= 0 ? num(row, c.tau) : tauYears(tradeDate)
    const action    = col(row, c.action).toUpperCase()

    // Prefer CSV-provided values; fall back to BS computation
    const bs = (c.option_price < 0 || isNaN(num(row, c.option_price)))
      ? blackScholesCall(spot, SPY_CONTRACT.strike, tau, SPY_CONTRACT.rate, ivol)
      : null

    const optionValue = bs ? bs.price  : num(row, c.option_price)
    const delta       = bs ? bs.delta  : num(row, c.delta)
    const gamma       = bs ? bs.gamma  : num(row, c.gamma)
    const theta       = bs ? bs.theta  : num(row, c.theta)
    const vega        = bs ? bs.vega   : num(row, c.vega)

    const currentQty = num(row, c.current_qty)
    const diffQty    = num(row, c.diff_qty)

    // Cash accounting (use CSV value if present, else track locally)
    if (c.cash_position >= 0 && !isNaN(num(row, c.cash_position))) {
      cash = num(row, c.cash_position)
    } else {
      if (!initialised) {
        cash = optionValue * SPY_CONTRACT.notional
        initialised = true
      }
      if (action === 'BUY')  cash -= Math.abs(diffQty) * spot
      if (action === 'SELL') cash += Math.abs(diffQty) * spot
    }
    if (!initialised) initialised = true

    const portfolioValue = c.portfolio_value >= 0 && !isNaN(num(row, c.portfolio_value))
      ? num(row, c.portfolio_value)
      : currentQty * spot + cash

    const optionLiability = c.option_liability >= 0 && !isNaN(num(row, c.option_liability))
      ? num(row, c.option_liability)
      : optionValue * SPY_CONTRACT.notional

    const replicationError = c.replication_error >= 0 && !isNaN(num(row, c.replication_error))
      ? num(row, c.replication_error)
      : portfolioValue - optionLiability

    const realizedPnl   = num(row, c.realized_pnl) || 0
    const unrealizedPnl = c.unrealized_pnl >= 0 ? num(row, c.unrealized_pnl) : undefined

    // Transaction cost (not in CSV — estimate from trade)
    let hedgeTrade: EnhancedSnapshot['hedgeTrade']
    let txnCost: number | undefined
    if (action === 'BUY' || action === 'SELL') {
      const qty  = Math.abs(diffQty)
      const side = action === 'BUY' ? 'buy' : 'sell' as const
      txnCost        = qty * spot * 0.001
      cumulativeCost += txnCost
      hedgeTrade     = { side, qty, price: spot }
    }

    const prev = snapshots[i - 1]

    // Build event
    const eventId = String(++_idCounter)
    let event: SimEvent
    if (action === 'BUY' || action === 'SELL') {
      event = {
        id: eventId, kind: 'REBALANCE', topic: TOPICS.REBALANCE,
        ts_event: date, step: i,
        payload: {
          St: spot, Vt: optionValue, tau, optionDelta: delta,
          replicationValue: portfolioValue, replicationError, sharesHeld: currentQty, cash,
          rebalance: {
            optionDeltaBefore: prev?.greeks.delta ?? delta,
            optionDeltaAfter:  delta,
            sharesChange:      action === 'BUY' ? diffQty : -diffQty,
            cashChange:        action === 'BUY' ? -(Math.abs(diffQty) * spot) : Math.abs(diffQty) * spot,
            errorBefore:       prev?.replicationError ?? replicationError,
            errorAfter:        replicationError,
          },
        },
      }
    } else {
      event = {
        id: eventId, kind: 'PRICE_MOVE', topic: TOPICS.PRICE_MOVE,
        ts_event: date, step: i,
        payload: {
          St: spot, Vt: optionValue, tau, optionDelta: delta,
          replicationValue: portfolioValue, replicationError, sharesHeld: currentQty, cash,
        },
      }
    }

    snapshots.push({
      step:        i,
      date,
      price:       spot,
      optionValue,
      greeks:      { delta, gamma, vega, theta },
      tau,
      sharesHeld:  currentQty,
      cash,
      hedgeTrade,
      portfolioDelta:         currentQty - delta * SPY_CONTRACT.notional,
      portfolioDeltaPreHedge: prev ? prev.portfolioDelta : undefined,
      replicationValue: portfolioValue,
      replicationError,
      errorChange:        prev ? replicationError - prev.replicationError : undefined,
      gammaContribution:  prev ? 0.5 * gamma * Math.pow(spot - prev.price, 2) : undefined,
      thetaContribution:  prev ? theta * (1 / 365) : undefined,
      transactionCost:    txnCost,
      cumulativeCost,
      nav:           portfolioValue,
      pnl:           realizedPnl,
      unrealizedPnl,
      event,
    })
  }

  return snapshots
}

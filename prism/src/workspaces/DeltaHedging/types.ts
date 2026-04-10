// ─── Topic constants ──────────────────────────────────────────────────────────
//
// Mirrors aurum's topic namespace convention: {namespace}.{channel}.{verb}
// When the real backtesting engine connects, its events will carry the same
// topic strings so the EventLog can render them without code changes.

export const TOPICS = {
  PRICE_MOVE: 'sim.price.move',
  REBALANCE:  'sim.hedge.rebalance',
} as const

export type EventKind  = keyof typeof TOPICS                  // 'PRICE_MOVE' | 'REBALANCE'
export type SimTopic   = typeof TOPICS[EventKind]             // topic string union

// ─── Rebalance detail ─────────────────────────────────────────────────────────

export interface RebalanceDetail {
  optionDeltaBefore: number   // Δt at the previous rebalance
  optionDeltaAfter:  number   // Δt after this rebalance
  sharesChange:      number   // signed shares traded (+ = bought)
  cashChange:        number   // cash impact in dollars
  errorBefore:       number   // εt immediately before the trade
  errorAfter:        number   // εt immediately after the trade
}

// ─── Event payloads ───────────────────────────────────────────────────────────
//
// Market state is always present. Rebalance events carry an extra `rebalance`
// field — the same payload separation pattern aurum uses in its message structs.

export interface MarketPayload {
  St:               number   // underlying price
  Vt:               number   // option value per share
  tau:              number   // remaining time in years
  optionDelta:      number   // raw Δt ∈ [0,1] for a call
  replicationValue: number   // φt·St + Bt
  replicationError: number   // εt = replicationValue − Vt·100
  sharesHeld:       number   // current shares position
  cash:             number   // current cash/bond position
}

export interface RebalancePayload extends MarketPayload {
  rebalance: RebalanceDetail
}

// ─── SimEvent ─────────────────────────────────────────────────────────────────
//
// Routing metadata (id, kind, topic, ts_event, step) is separated from the
// business payload — aligned with how aurum's message structs are laid out.
//
// `topic`    → aurum's topic() field, used for future subscription routing
// `ts_event` → aurum's timestamp naming convention (was 'timestamp')
// `kind`     → strongly-typed discriminant (was plain string 'type')

export type SimEvent =
  | { id: string; kind: 'PRICE_MOVE'; topic: 'sim.price.move';    ts_event: string; step: number; payload: MarketPayload    }
  | { id: string; kind: 'REBALANCE';  topic: 'sim.hedge.rebalance'; ts_event: string; step: number; payload: RebalancePayload }

// ─── Snapshot ─────────────────────────────────────────────────────────────────

export interface EnhancedSnapshot {
  step:   number
  date:   string    // "YYYY-MM-DD" for chart time axis
  price:  number    // St
  optionValue: number  // Vt per share
  greeks: { delta: number; gamma: number; vega: number; theta: number }
  tau:    number

  sharesHeld:        number
  cash:              number
  hedgeTrade?:       { side: 'buy' | 'sell'; qty: number; price: number }
  portfolioDelta:    number
  portfolioDeltaPreHedge?: number  // Δportfolio before rebalancing
  replicationValue:  number
  replicationError:  number
  errorChange?:      number  // Δεt = εt - εt-1
  gammaContribution?: number // ½Γ(ΔS)²
  thetaContribution?: number // ΘΔt
  transactionCost?:  number  // Cost of this hedge trade
  cumulativeCost:    number  // Total transaction costs so far
  nav:               number
  pnl:               number
  unrealizedPnl?:    number

  event: SimEvent  // was mathEvent
}

// ─── Frequency comparison ─────────────────────────────────────────────────────

export interface FrequencyComparisonRow {
  hedgeInterval: number
  totalTrades:   number
  terminalError: number
  maxAbsError:   number
  rmse:          number
}

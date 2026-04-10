export type OrderSide = 'buy' | 'sell'
export type EventType = 'HEDGE' | 'PRICE' | 'INFO'

export interface Fill {
  orderId: string
  side: OrderSide
  qty: number
  price: number
  timestamp: string
}

export interface Position {
  symbol: string
  qty: number          // positive = long, negative = short
  avgPrice: number
  currentPrice: number
  unrealizedPnl: number
  realizedPnl: number
}

export interface Portfolio {
  positions: Position[]
  cash: number
  nav: number
  totalPnl: number
}

export interface TradeEvent {
  id: string
  type: EventType
  timestamp: string
  message: string
  hedgeTrade?: { side: OrderSide; qty: number; price: number }
  delta?: number
}

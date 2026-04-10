import type { EnhancedSnapshot } from '../../DeltaHedging/types'

function fmtSigned(n: number | undefined, fallback = '—') {
  if (n === undefined || isNaN(n)) return fallback
  const sign = n >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

function color(n: number | undefined) {
  if (n === undefined || isNaN(n)) return 'text-neutral-400'
  return n >= 0 ? 'text-emerald-600' : 'text-red-600'
}

interface RowProps { label: string; value: string; valueClass: string; sub?: string }
function Row({ label, value, valueClass, sub }: RowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-neutral-100 last:border-0">
      <div>
        <span className="text-[11px] text-neutral-500">{label}</span>
        {sub && <span className="text-[10px] text-neutral-400 ml-1">{sub}</span>}
      </div>
      <span className={`tabular-nums text-xs font-semibold ${valueClass}`}>{value}</span>
    </div>
  )
}

interface SPYPnLCardProps {
  snapshot: EnhancedSnapshot
}

export function SPYPnLCard({ snapshot }: SPYPnLCardProps) {
  const realized   = snapshot.pnl
  const unrealized = snapshot.unrealizedPnl
  const costs      = snapshot.cumulativeCost
  const total      = (realized ?? 0) + (unrealized ?? 0) - costs

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="text-xs font-semibold text-neutral-600">P&amp;L</h3>
      </div>
      <div className="px-3 pb-2">
        <Row
          label="Realized PnL"
          value={fmtSigned(realized)}
          valueClass={color(realized)}
        />
        <Row
          label="Unrealized PnL"
          value={fmtSigned(unrealized)}
          valueClass={color(unrealized)}
          sub="position MTM"
        />
        <Row
          label="Txn Costs"
          value={`-$${costs.toFixed(2)}`}
          valueClass="text-neutral-500"
          sub="cumulative"
        />
        <Row
          label="Net P&L"
          value={fmtSigned(total)}
          valueClass={color(total)}
          sub="est."
        />
      </div>
    </div>
  )
}

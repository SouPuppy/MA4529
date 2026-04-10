import type { EnhancedSnapshot } from '../../DeltaHedging/types'
import { SPY_CONTRACT } from '../spyCsvLoader'

function fmt(n: number, decimals = 2) {
  const sign = n >= 0 ? '' : ''
  return `${sign}$${Math.abs(n).toFixed(decimals)}`
}

function fmtSigned(n: number, decimals = 2) {
  const sign = n >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(n).toFixed(decimals)}`
}

interface RowProps {
  label:     string
  value:     string
  valueClass?: string
  sublabel?: string
}

function Row({ label, value, valueClass = 'text-neutral-900', sublabel }: RowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-neutral-100 last:border-0">
      <div>
        <span className="text-[11px] text-neutral-500">{label}</span>
        {sublabel && <span className="text-[10px] text-neutral-400 ml-1">{sublabel}</span>}
      </div>
      <span className={`tabular-nums text-xs font-semibold ${valueClass}`}>{value}</span>
    </div>
  )
}

interface SPYPortfolioCardProps {
  snapshot: EnhancedSnapshot
}

export function SPYPortfolioCard({ snapshot }: SPYPortfolioCardProps) {
  const {
    sharesHeld, cash, replicationValue, replicationError, optionValue,
  } = snapshot
  const optLiability = optionValue * SPY_CONTRACT.notional
  const errColor = replicationError >= 0 ? 'text-emerald-600' : 'text-red-600'
  const errBg    = replicationError >= 0 ? 'bg-emerald-50' : 'bg-red-50'

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="text-xs font-semibold text-neutral-600">Portfolio</h3>
      </div>
      <div className="px-3 pb-2">
        <Row label="φt  Shares held"  value={`${sharesHeld.toFixed(2)} sh`} />
        <Row label="Bt  Cash position" value={fmt(cash)} />
        <Row label="φt·St + Bt  Portfolio" value={fmt(replicationValue)} sublabel="hedge book" />
        <Row label="Vt × N  Option liability" value={fmt(optLiability)} sublabel="short call" />
      </div>

      {/* Replication error — highlighted */}
      <div className={`mx-3 mb-3 rounded px-3 py-2 ${errBg}`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-neutral-600">ε  Replication error</span>
          <span className={`tabular-nums text-sm font-bold ${errColor}`}>
            {fmtSigned(replicationError)}
          </span>
        </div>
        <div className="text-[10px] text-neutral-400 mt-0.5">
          {replicationError >= 0 ? 'over-replicated' : 'under-replicated'}
        </div>
      </div>
    </div>
  )
}

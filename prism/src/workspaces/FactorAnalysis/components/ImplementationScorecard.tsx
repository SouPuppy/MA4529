import type { ImplementationMetrics } from '../types'

interface Props {
  metrics: ImplementationMetrics
  costModelLabel: string
}

const VERDICT_CONFIG = {
  live: {
    label: 'Live Ready',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  paper: {
    label: 'Paper Trade',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
  },
  investigate: {
    label: 'Investigate',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  reject: {
    label: 'Reject',
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-700',
    dot: 'bg-red-500',
  },
}

function MetricRow({
  label, value, sub, valueClass = 'text-neutral-700',
}: {
  label: string; value: string; sub?: string; valueClass?: string
}) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-neutral-100 last:border-0">
      <span className="text-[10px] text-neutral-500">{label}</span>
      <div className="text-right">
        <span className={`text-xs font-semibold tabular-nums ${valueClass}`}>{value}</span>
        {sub && <span className="text-[9px] text-neutral-400 ml-1">{sub}</span>}
      </div>
    </div>
  )
}

/** Mini waterfall bar: gross → cost → net */
function WaterfallBar({ gross, cost, net }: { gross: number; cost: number; net: number }) {
  const maxAbs = Math.max(Math.abs(gross), 0.001)
  const grossW = Math.min(100, Math.abs(gross) / maxAbs * 80)
  const costW = Math.min(100, Math.abs(cost) / maxAbs * 80)
  const netW = Math.min(100, Math.abs(net) / maxAbs * 80)

  return (
    <div className="space-y-1 py-2">
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-neutral-400 w-10 text-right shrink-0">Gross</span>
        <div className="h-3 rounded-sm bg-blue-200" style={{ width: `${grossW}%` }} />
        <span className="text-[9px] tabular-nums text-blue-600">+{gross.toFixed(3)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-neutral-400 w-10 text-right shrink-0">Cost</span>
        <div className="h-3 rounded-sm bg-red-200" style={{ width: `${costW}%` }} />
        <span className="text-[9px] tabular-nums text-red-500">−{cost.toFixed(3)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-neutral-400 w-10 text-right shrink-0">Net</span>
        <div className={`h-3 rounded-sm ${net >= 0 ? 'bg-emerald-300' : 'bg-red-300'}`}
          style={{ width: `${netW}%` }} />
        <span className={`text-[9px] tabular-nums font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {net >= 0 ? '+' : ''}{net.toFixed(3)}
        </span>
      </div>
    </div>
  )
}

export function ImplementationScorecard({ metrics: m, costModelLabel }: Props) {
  const v = VERDICT_CONFIG[m.verdict]
  const capStr = m.capacityEstimateUsd >= 1_000_000
    ? `$${(m.capacityEstimateUsd / 1_000_000).toFixed(1)}M`
    : m.capacityEstimateUsd >= 1000
    ? `$${(m.capacityEstimateUsd / 1000).toFixed(0)}k`
    : `$${m.capacityEstimateUsd.toFixed(0)}`

  const sharpeColor = (s: number) => s >= 1.5 ? 'text-emerald-600'
    : s >= 0.75 ? 'text-blue-600'
    : s >= 0 ? 'text-amber-600'
    : 'text-red-600'

  return (
    <div className="h-full flex flex-col bg-white border border-neutral-200 rounded">

      {/* Verdict badge */}
      <div className={`px-3 py-2.5 border-b border-neutral-100 ${v.bg} ${v.border} border-l-2`}>
        <div className="flex items-center gap-1.5">
          <span className={`inline-block w-2 h-2 rounded-full ${v.dot}`} />
          <span className={`text-xs font-bold ${v.text}`}>{v.label}</span>
        </div>
        <p className="text-[9px] text-neutral-500 mt-0.5">{costModelLabel} cost model</p>
      </div>

      {/* Waterfall mini chart */}
      <div className="px-3 border-b border-neutral-100">
        <p className="text-[9px] text-neutral-400 pt-1.5">Return (bps/bar)</p>
        <WaterfallBar gross={m.grossRetBpsPerBar} cost={m.halfSpreadCostBps} net={m.netRetBpsPerBar} />
      </div>

      {/* Metrics list */}
      <div className="px-3 flex-1">
        <MetricRow label="Gross Sharpe" value={m.grossSharpe.toFixed(2)}
          valueClass={sharpeColor(m.grossSharpe)} />
        <MetricRow label="Net Sharpe" value={m.netSharpe.toFixed(2)}
          valueClass={sharpeColor(m.netSharpe)} />
        <MetricRow label="½ Spread Cost" value={`${m.halfSpreadCostBps.toFixed(3)}`} sub="bps/bar" />
        <MetricRow label="Full Spread" value={`${m.fullSpreadCostBps.toFixed(3)}`} sub="bps/bar" />
        <MetricRow label="Capacity Est." value={capStr} />
      </div>

    </div>
  )
}

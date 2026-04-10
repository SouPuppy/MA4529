import type { EnhancedSnapshot } from '../../DeltaHedging/types'

interface GreekRowProps {
  symbol:    string
  value:     string
  label:     string
  color:     string
  bgColor:   string
}

function GreekRow({ symbol, value, label, color, bgColor }: GreekRowProps) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded ${bgColor}`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold w-5 ${color}`}>{symbol}</span>
        <span className="text-[10px] text-neutral-500">{label}</span>
      </div>
      <span className={`tabular-nums text-sm font-semibold ${color}`}>{value}</span>
    </div>
  )
}

interface SPYGreeksCardProps {
  snapshot: EnhancedSnapshot
}

export function SPYGreeksCard({ snapshot }: SPYGreeksCardProps) {
  const { greeks, tau } = snapshot
  const tauDays = (tau * 365).toFixed(0)

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="text-xs font-semibold text-neutral-600">Greeks · τ = {tauDays}d</h3>
      </div>
      <div className="px-3 pb-3 space-y-1.5">
        <GreekRow
          symbol="Δ"
          value={greeks.delta.toFixed(4)}
          label="delta · ∂V/∂S"
          color="text-blue-700"
          bgColor="bg-blue-50"
        />
        <GreekRow
          symbol="Γ"
          value={greeks.gamma.toFixed(5)}
          label="gamma · ∂²V/∂S²"
          color="text-violet-700"
          bgColor="bg-violet-50"
        />
        <GreekRow
          symbol="Θ"
          value={greeks.theta.toFixed(4)}
          label="theta · $/day"
          color="text-orange-700"
          bgColor="bg-orange-50"
        />
        <GreekRow
          symbol="ν"
          value={greeks.vega.toFixed(4)}
          label="vega · $/1% vol"
          color="text-teal-700"
          bgColor="bg-teal-50"
        />
      </div>
    </div>
  )
}

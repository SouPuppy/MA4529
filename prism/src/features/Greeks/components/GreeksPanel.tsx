import type { Greeks } from '../../../domains/Options/model'

interface GreeksPanelProps {
  greeks: Greeks
  optionValue: number
  portfolioDelta: number
}

interface GreekRowProps {
  symbol: string
  label: string
  value: string
  description: string
}

function GreekRow({ symbol, label, value, description }: GreekRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-0">
      <div className="flex items-baseline gap-3">
        <span className="w-8 text-center font-serif text-lg text-blue-600">{symbol}</span>
        <span className="text-sm font-medium text-neutral-700">{label}</span>
      </div>
      <div className="text-right">
        <span className="tabular-nums text-sm font-semibold text-neutral-900">{value}</span>
        <p className="text-[10px] text-neutral-500 leading-none mt-0.5">{description}</p>
      </div>
    </div>
  )
}

export function GreeksPanel({ greeks, optionValue, portfolioDelta }: GreeksPanelProps) {
  const deltaAbs = Math.abs(portfolioDelta)
  const deltaClass = deltaAbs < 2 ? 'text-emerald-600' : deltaAbs < 10 ? 'text-orange-600' : 'text-red-600'

  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">Greeks</h3>
        <span className="text-xs tabular-nums text-neutral-500">Short 1 Call · K=$100</span>
      </div>

      <div className="panel-body space-y-0">
        <GreekRow
          symbol="Δ"
          label="Delta"
          value={greeks.delta.toFixed(4)}
          description="∂V/∂S per share"
        />
        <GreekRow
          symbol="Γ"
          label="Gamma"
          value={greeks.gamma.toFixed(5)}
          description="∂Δ/∂S per share"
        />
        <GreekRow
          symbol="V"
          label="Vega"
          value={greeks.vega.toFixed(4)}
          description="per 1% vol move"
        />
        <GreekRow
          symbol="Θ"
          label="Theta"
          value={greeks.theta.toFixed(4)}
          description="per calendar day"
        />

        {/* Option mark */}
        <div className="pt-3 mt-3 border-t border-neutral-200 flex justify-between items-center">
          <span className="text-sm font-medium text-neutral-600">Option Mark</span>
          <span className="tabular-nums text-sm font-semibold text-neutral-900">${optionValue.toFixed(2)}</span>
        </div>

        {/* Portfolio delta badge */}
        <div className="pt-2 flex justify-between items-center">
          <span className="text-sm font-medium text-neutral-600">Portfolio Δ</span>
          <span className={['tabular-nums text-lg font-bold', deltaClass].join(' ')}>
            {portfolioDelta > 0 ? '+' : ''}{portfolioDelta.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  )
}

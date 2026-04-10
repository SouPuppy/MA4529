import type { SimParams } from '../mock/hedgeEngine'
import { KatexSpan } from './KatexSpan'

interface ParameterPanelProps {
  params: SimParams
}

// Slots with a clean math symbol use KaTeX; others use plain text
interface ParamSlotProps {
  symbol: React.ReactNode   // rendered label (KaTeX span or plain string)
  value: string
  label: string
}

function ParamSlot({ symbol, value, label }: ParamSlotProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 first:pl-4">
      <span className="text-[12px] text-neutral-500 leading-none">{symbol}</span>
      <span className="tabular-nums text-sm font-semibold text-neutral-900 leading-none">{value}</span>
      <span className="text-[10px] text-neutral-400 leading-none">{label}</span>
    </div>
  )
}

function KSym({ f }: { f: string }) {
  return <KatexSpan formula={f} />
}

export function ParameterPanel({ params }: ParameterPanelProps) {
  return (
    <div className="panel">
      <div className="flex items-center py-1.5">
        {/* Parameter slots — clean math symbols only */}
        <div className="flex items-center divide-x divide-neutral-200 shrink-0">
          <ParamSlot symbol={<KSym f="S_0" />}     value={`$${params.S0}`}                           label="initial price" />
          <ParamSlot symbol={<KSym f="K" />}        value={`$${params.K}`}                            label="strike" />
          <ParamSlot symbol={<KSym f="T" />}        value={`${(params.T * 365).toFixed(0)}d`}         label="expiry" />
          <ParamSlot symbol={<KSym f="\sigma" />}   value={`${(params.sigma * 100).toFixed(0)}%`}     label="volatility" />
          <ParamSlot symbol={<KSym f="r" />}        value={`${(params.r * 100).toFixed(0)}%`}         label="risk-free" />
          <ParamSlot symbol="interval"              value={`every ${params.hedgeInterval}`}            label="steps" />
          <ParamSlot symbol="model"                 value="GBM"                                        label="path" />
        </div>

        {/* Divider */}
        <div className="mx-5 h-9 w-px bg-neutral-200 shrink-0" />

        {/* Assumption text */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-neutral-600 leading-relaxed">
            <span className="font-semibold">Black–Scholes world</span>
            {' · '}frictionless market
            {' · '}continuous trading idealization
            {' · '}discrete-time simulation
          </p>
          <p className="text-[10px] text-neutral-400 mt-1">
            Short 1 call (100 shares notional) · hedge portfolio: φ<sub>t</sub>·S<sub>t</sub> + B<sub>t</sub> · target Δ-neutral at each rebalance
          </p>
        </div>
      </div>
    </div>
  )
}

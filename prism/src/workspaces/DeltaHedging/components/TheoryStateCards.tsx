import type { EnhancedSnapshot } from '../types'
import { MULTIPLIER } from '../mock/hedgeEngine'
import { KatexSpan } from './KatexSpan'

interface TheoryStateCardsProps {
  snapshot: EnhancedSnapshot
}

// Simple symbol + name + value row — no partial derivatives in the label
interface GreekRowProps {
  symbol: string   // KaTeX formula for the symbol only, e.g. "\Delta_t"
  name: string     // plain English name
  value: string
  sub: string      // brief description
}

function GreekRow({ symbol, name, value, sub }: GreekRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
      <div className="flex items-baseline gap-2">
        <span className="w-7 text-center">
          <KatexSpan formula={symbol} className="text-[14px] text-blue-600" />
        </span>
        <span className="text-sm text-neutral-600">{name}</span>
      </div>
      <div className="text-right">
        <span className="tabular-nums text-sm font-semibold text-neutral-900">{value}</span>
        <p className="text-[10px] text-neutral-400 leading-none mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

export function TheoryStateCards({ snapshot: s }: TheoryStateCardsProps) {
  const tauDays = Math.round(s.tau * 365)
  const optionLiability = s.optionValue * MULTIPLIER

  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">State</h3>
        <span className="text-[10px] text-neutral-400 tabular-nums">step {s.step}</span>
      </div>

      {/* ── Section 1: Market state ───────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 border-b border-neutral-100">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-neutral-400">price S<sub>t</sub></p>
            <p className="tabular-nums text-base font-bold text-neutral-900">${s.price.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] text-neutral-400">time left τ</p>
            <p className="tabular-nums text-base font-bold text-neutral-900">{tauDays}d</p>
          </div>
          <div>
            <p className="text-[10px] text-neutral-400">option V<sub>t</sub></p>
            <p className="tabular-nums text-base font-bold text-neutral-900">${s.optionValue.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* ── Section 2: Greeks ────────────────────────────────────── */}
      <div className="px-4 py-1 border-b border-neutral-100">
        <GreekRow symbol="\Delta" name="Delta"  value={s.greeks.delta.toFixed(4)}  sub="hedge ratio" />
        <GreekRow symbol="\Gamma" name="Gamma"  value={s.greeks.gamma.toFixed(5)}  sub="Δ curvature" />
        <GreekRow symbol="\Theta" name="Theta"  value={s.greeks.theta.toFixed(4)}  sub="per day" />
        <GreekRow symbol="\nu"    name="Vega"   value={s.greeks.vega.toFixed(4)}   sub="per 1% vol" />
      </div>

      {/* ── Section 3: Replication portfolio ─────────────────────── */}
      <div className="px-4 py-2 border-b border-neutral-100 space-y-1.5">
        <div className="flex justify-between items-center text-sm">
          <span className="text-neutral-500">φ<sub>t</sub> <span className="text-[10px] text-neutral-400">shares held</span></span>
          <span className="tabular-nums font-semibold text-neutral-900">{s.sharesHeld}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-neutral-500">B<sub>t</sub> <span className="text-[10px] text-neutral-400">cash / bond</span></span>
          <span className={['tabular-nums font-semibold', s.cash >= 0 ? 'text-neutral-900' : 'text-red-600'].join(' ')}>
            ${s.cash.toFixed(2)}
          </span>
        </div>
        <div className="pt-1.5 border-t border-dashed border-neutral-200 space-y-1">
          <div className="flex justify-between items-center text-sm">
            <span className="text-neutral-600 font-medium text-[11px]">
              φ<sub>t</sub>·S<sub>t</sub> + B<sub>t</sub>
              <span className="text-neutral-400 font-normal ml-1 text-[10px]">replication</span>
            </span>
            <span className="tabular-nums font-semibold text-neutral-900">${s.replicationValue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-neutral-400 text-[10px]">V<sub>t</sub>×100 liability</span>
            <span className="tabular-nums text-neutral-600">${optionLiability.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

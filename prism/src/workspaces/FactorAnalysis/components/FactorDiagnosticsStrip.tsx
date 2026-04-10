import type { FactorDiagnostics } from '../types'

interface Props {
  diagnostics: FactorDiagnostics
  factorLabel: string
}

function Dot() {
  return <span className="text-ink-2d select-none mx-1">·</span>
}

function Stat({
  label, value, valueClass = 'text-ink-2b', sub,
}: {
  label: string
  value: string
  valueClass?: string
  sub?: string
}) {
  return (
    <span className="flex items-baseline gap-1 shrink-0">
      <span className="text-[10px] text-ink-5b">{label}</span>
      <span className={`text-[12px] font-semibold tabular-nums ${valueClass}`}>{value}</span>
      {sub && <span className="text-[10px] text-ink-5b">{sub}</span>}
    </span>
  )
}

export function FactorDiagnosticsStrip({ diagnostics: d, factorLabel }: Props) {
  const dirColor = d.direction === 'positive' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : d.direction === 'negative' ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-neutral-100 text-neutral-600 border-neutral-200'
  const dirSymbol = d.direction === 'positive' ? '▲' : d.direction === 'negative' ? '▼' : '◆'
  const dirLabel = d.direction === 'positive' ? 'Positive' : d.direction === 'negative' ? 'Negative' : 'Mixed'

  const icirColor = d.icir >= 0.5 ? 'text-emerald-600'
    : d.icir >= 0.25 ? 'text-ink-2b'
    : 'text-amber-600'

  const ar1Color = d.ar1 >= 0.7 ? 'text-amber-600' : 'text-ink-2b'

  const icSign = d.icMean >= 0 ? '+' : ''
  const icColor = d.icMean >= 0 ? 'text-emerald-600' : 'text-red-600'

  const effNStr = d.effectiveSampleSize >= 1_000_000
    ? `${(d.effectiveSampleSize / 1_000_000).toFixed(1)}M`
    : d.effectiveSampleSize >= 1000
    ? `${(d.effectiveSampleSize / 1000).toFixed(0)}k`
    : String(d.effectiveSampleSize)

  return (
    <div className="flex items-center gap-0 px-5 py-2 bg-white border border-neutral-200 overflow-x-auto">

      {/* Factor + direction badge */}
      <span className="text-[11px] font-semibold text-ink-2b shrink-0 mr-3">{factorLabel}</span>
      <span className={`text-[10px] font-semibold border px-1.5 py-0.5 shrink-0 ${dirColor}`}>
        {dirSymbol} {dirLabel}
      </span>

      <Dot />

      <Stat
        label="τ½"
        value={d.halfLifeSec < 10 ? d.halfLifeSec.toFixed(1) : d.halfLifeSec.toFixed(0)}
        sub="s"
        valueClass="text-amber-600"
      />

      <Dot />

      <Stat
        label="IC"
        value={`${icSign}${d.icMean.toFixed(4)}`}
        valueClass={icColor}
        sub={`±${d.icStd.toFixed(4)}`}
      />

      <Dot />

      <Stat
        label="ICIR"
        value={d.icir.toFixed(3)}
        valueClass={icirColor}
      />

      <Dot />

      <Stat
        label="AR(1)"
        value={d.ar1.toFixed(3)}
        valueClass={ar1Color}
        sub={d.ar1 >= 0.7 ? 'slow' : d.ar1 >= 0.3 ? 'mid' : 'fast'}
      />

      <Dot />

      <Stat
        label="Eff-N"
        value={effNStr}
      />

      <Dot />

      <Stat
        label="Spread"
        value={d.avgSpreadBps.toFixed(2)}
        sub="bps"
        valueClass={d.avgSpreadBps < 0.5 ? 'text-emerald-600' : d.avgSpreadBps > 2 ? 'text-red-600' : 'text-ink-2b'}
      />

    </div>
  )
}

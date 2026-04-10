import type { FactorDiagnostics, ResearchParams } from '../types'
import { FACTOR_DEFS } from '../types'

interface Props {
  params: ResearchParams
  diagnostics: FactorDiagnostics
  sessionDays: number
  dateRange: [string, string]
}

const COST_LABELS: Record<ResearchParams['costModel'], string> = {
  'zero': 'Zero cost',
  'half-spread': '½ spread',
  'full-spread': 'Full spread',
}

export function StatusBar({ params, diagnostics, sessionDays, dateRange }: Props) {
  const factorLabel = FACTOR_DEFS.find((d) => d.id === params.factorId)?.label ?? params.factorId
  const nObs = diagnostics.effectiveSampleSize

  const nStr = nObs >= 1_000_000
    ? `N=${(nObs / 1_000_000).toFixed(1)}M`
    : nObs >= 1000
    ? `N=${(nObs / 1000).toFixed(0)}k`
    : `N=${nObs}`

  return (
    <div className="border-t border-neutral-200 bg-white shrink-0 px-6 h-8 flex items-center gap-4 text-[10px] text-neutral-400">
      <span className="tabular-nums">{nStr} eff. obs</span>
      <span className="text-neutral-200">·</span>
      <span>{sessionDays} sessions</span>
      <span className="text-neutral-200">·</span>
      <span className="tabular-nums">{dateRange[0]} → {dateRange[1]}</span>
      <span className="text-neutral-200">·</span>
      <span className="font-medium text-neutral-500">{factorLabel} · {params.instrument} · {params.session} · {params.frequency}</span>
      <span className="text-neutral-200">·</span>
      <span>{COST_LABELS[params.costModel]}</span>
      <span className="text-neutral-200">·</span>
      <span className="ml-auto text-[9px] text-neutral-300">Mock data · computed in 0ms</span>
    </div>
  )
}

import type { FactorIdentity } from '../types'

interface FactorIdentityCardsProps {
  identity: FactorIdentity
  factorLabel: string
}

export function FactorIdentityCards({ identity, factorLabel }: FactorIdentityCardsProps) {
  const { direction, bestHorizon, monotonicityScore, stabilityScore, coverage, dailyTurnover } = identity

  return (
    <div className="grid grid-cols-6 gap-3">
      <DirectionCard direction={direction} factorLabel={factorLabel} />
      <IdentityCard
        label="Best Horizon"
        value={`${bestHorizon} bars`}
        sub="Strongest |IC| horizon"
        valueClass="text-blue-600"
      />
      <ScoreCard label="Monotonicity" score={monotonicityScore} sub="Quantile ordering strength" />
      <ScoreCard label="Stability" score={stabilityScore} sub="Sign consistency" />
      <IdentityCard
        label="Coverage"
        value={`${(coverage * 100).toFixed(1)}%`}
        sub="Usable sample ratio"
        valueClass="text-neutral-900"
      />
      <IdentityCard
        label="Turnover"
        value={`${(dailyTurnover * 100).toFixed(1)}% / bar`}
        sub="Implementability proxy"
        valueClass={dailyTurnover > 0.8 ? 'text-amber-600' : 'text-neutral-900'}
      />
    </div>
  )
}

// ── Direction card ─────────────────────────────────────────────────────────────

function DirectionCard({ direction, factorLabel }: { direction: FactorIdentity['direction']; factorLabel: string }) {
  const cfg = {
    positive: { icon: '▲', label: 'Positive', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
    negative: { icon: '▼', label: 'Negative', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
    mixed:    { icon: '~', label: 'Mixed',    color: 'text-neutral-500', bg: 'bg-neutral-50 border-neutral-200' },
  }[direction]

  return (
    <div className={`panel p-3 border ${cfg.bg}`}>
      <p className="metric-label mb-1.5">Direction</p>
      <p className={`metric-value text-xl font-bold ${cfg.color}`}>
        {cfg.icon} {cfg.label}
      </p>
      <p className="text-[10px] text-neutral-400 mt-1 truncate">{factorLabel}</p>
    </div>
  )
}

// ── Generic value card ─────────────────────────────────────────────────────────

function IdentityCard({ label, value, sub, valueClass }: {
  label: string; value: string; sub: string; valueClass: string
}) {
  return (
    <div className="panel p-3">
      <p className="metric-label mb-1.5">{label}</p>
      <p className={`metric-value text-lg tabular-nums ${valueClass}`}>{value}</p>
      <p className="text-[10px] text-neutral-400 mt-1">{sub}</p>
    </div>
  )
}

// ── Score card with progress bar ───────────────────────────────────────────────

function ScoreCard({ label, score, sub }: { label: string; score: number; sub: string }) {
  const pct = Math.round(score * 100)
  const barColor = score >= 0.75 ? 'bg-emerald-500' : score >= 0.5 ? 'bg-blue-500' : 'bg-amber-500'
  const textColor = score >= 0.75 ? 'text-emerald-600' : score >= 0.5 ? 'text-blue-600' : 'text-amber-600'

  return (
    <div className="panel p-3">
      <p className="metric-label mb-1.5">{label}</p>
      <p className={`metric-value text-lg tabular-nums ${textColor}`}>{score.toFixed(2)}</p>
      <div className="mt-2 h-1 bg-neutral-200 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-neutral-400 mt-1">{sub}</p>
    </div>
  )
}

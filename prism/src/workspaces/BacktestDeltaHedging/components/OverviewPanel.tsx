import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { EnhancedSnapshot } from '../../DeltaHedging/types'
import { STRATEGIES, type StrategyDef } from './StrategyTabs'

interface Props {
  data:     Record<string, EnhancedSnapshot[]>
  onSelect: (id: string) => void
}

// ─── Statistics ───────────────────────────────────────────────────────────────

interface HedgeStats {
  finalError:    number   // last ε_t
  excessPnl:     number   // last realized_pnl = ε_t - W0·e^(rt)
  avgAbsError:   number   // mean |ε_t|
  rmse:          number   // RMSE of excess P&L (how far from perfect hedge)
  sharpe:        number   // annualised Sharpe of daily excess P&L changes
  maxDrawdown:   number   // max peak-to-trough of excess P&L
  trades:        number
}

function computeStats(snaps: EnhancedSnapshot[]): HedgeStats {
  if (snaps.length === 0) return { finalError: 0, excessPnl: 0, avgAbsError: 0, rmse: 0, sharpe: 0, maxDrawdown: 0, trades: 0 }

  const last       = snaps[snaps.length - 1]
  const pnlSeries  = snaps.map((s) => s.pnl)   // excess P&L series: ε_t - W0·e^(rt)
  const trades     = snaps.filter((s) => s.hedgeTrade !== undefined).length

  // Average |ε| — average abs replication error
  const avgAbsError = snaps.reduce((a, s) => a + Math.abs(s.replicationError), 0) / snaps.length

  // RMSE of excess P&L (distance from perfect hedge = 0)
  const rmse = Math.sqrt(pnlSeries.reduce((a, p) => a + p * p, 0) / pnlSeries.length)

  // Daily changes in excess P&L → Sharpe
  const dailyChanges: number[] = []
  for (let i = 1; i < pnlSeries.length; i++) {
    dailyChanges.push(pnlSeries[i] - pnlSeries[i - 1])
  }
  let sharpe = 0
  if (dailyChanges.length > 1) {
    const mean = dailyChanges.reduce((a, b) => a + b, 0) / dailyChanges.length
    const variance = dailyChanges.reduce((a, b) => a + (b - mean) ** 2, 0) / (dailyChanges.length - 1)
    const std = Math.sqrt(variance)
    sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0
  }

  // Max drawdown of excess P&L
  let peak        = pnlSeries[0]
  let maxDrawdown = 0
  for (const p of pnlSeries) {
    if (p > peak) peak = p
    const dd = peak - p
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  return {
    finalError:  last.replicationError,
    excessPnl:   last.pnl,           // excess_pnl from C++: ε_t - W0·e^(rt)
    avgAbsError,
    rmse,
    sharpe,
    maxDrawdown,
    trades,
  }
}

// ─── Chart data ───────────────────────────────────────────────────────────────

function buildChartData(
  data: Record<string, EnhancedSnapshot[]>,
  field: 'replicationError' | 'pnl',
): Record<string, string | number>[] {
  const base = Object.values(data)[0]
  if (!base) return []
  return base.map((snap, i) => {
    const row: Record<string, string | number> = { date: snap.date }
    for (const s of STRATEGIES) {
      const d = data[s.id]
      if (d && d[i]) row[s.id] = d[i][field]
    }
    return row
  })
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtUsd(n: number) {
  return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2)
}

function fmtSharpe(n: number) {
  return (n >= 0 ? '+' : '') + n.toFixed(2)
}

function sharpeColor(n: number) {
  if (n >  0.5) return 'text-emerald-700'
  if (n < -0.5) return 'text-red-600'
  return 'text-neutral-600'
}

function pnlColor(n: number) {
  return n >= 0 ? 'text-emerald-700' : 'text-red-600'
}

// ─── Stat cell ────────────────────────────────────────────────────────────────

function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2 border-r border-neutral-100 last:border-0">
      <span className="text-[10px] text-neutral-400 uppercase tracking-wide whitespace-nowrap">{label}</span>
      <span className="text-sm font-semibold tabular-nums font-mono">{value}</span>
      {sub && <span className="text-[10px] text-neutral-400">{sub}</span>}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OverviewPanel({ data, onSelect }: Props) {
  const errorChartData = buildChartData(data, 'replicationError')
  const pnlChartData   = buildChartData(data, 'pnl')

  const stats = STRATEGIES.map((s) => {
    const snaps = data[s.id]
    return snaps ? { s, stats: computeStats(snaps) } : null
  }).filter(Boolean) as { s: StrategyDef; stats: HedgeStats }[]

  return (
    <div className="px-6 py-4 space-y-4">

      {/* ── Replication Error chart ──────────────────────────────────────── */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="text-xs font-semibold text-neutral-700">
            Replication Error ε<sub>t</sub> — All Strategies
          </h3>
          <span className="text-[10px] text-neutral-400 ml-2">
            portfolio value − option liability (target ≈ $10,000 · e<sup>rt</sup>)
          </span>
        </div>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={errorChartData} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} minTickGap={20} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} width={64} />
              <Tooltip
                contentStyle={{ fontSize: 11 }}
                formatter={(v: number, name: string) => {
                  const s = STRATEGIES.find((x) => x.id === name)
                  return [`$${v.toFixed(2)}`, s?.label ?? name]
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => STRATEGIES.find((x) => x.id === value)?.label ?? value} />
              {STRATEGIES.map((s) => (
                <Line key={s.id} type="monotone" dataKey={s.id} stroke={s.color} dot={false} strokeWidth={1.5} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Excess P&L chart ─────────────────────────────────────────────── */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="text-xs font-semibold text-neutral-700">
            Excess P&amp;L — All Strategies
          </h3>
          <span className="text-[10px] text-neutral-400 ml-2">
            ε<sub>t</sub> − W<sub>0</sub>·e<sup>rt</sup> — deviation from risk-free benchmark
          </span>
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pnlChartData} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} minTickGap={20} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} width={64} />
              <Tooltip
                contentStyle={{ fontSize: 11 }}
                formatter={(v: number, name: string) => {
                  const s = STRATEGIES.find((x) => x.id === name)
                  return [`${v >= 0 ? '+' : ''}$${v.toFixed(2)}`, s?.label ?? name]
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => STRATEGIES.find((x) => x.id === value)?.label ?? value} />
              {STRATEGIES.map((s) => (
                <Line key={s.id} type="monotone" dataKey={s.id} stroke={s.color} dot={false} strokeWidth={1.5} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Strategy comparison table ─────────────────────────────────────── */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="text-xs font-semibold text-neutral-700">Hedge Quality — Strategy Comparison</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neutral-100 text-neutral-500 font-medium text-right">
              <th className="text-left px-4 py-2">Strategy</th>
              <th className="px-4 py-2">Sharpe</th>
              <th className="px-4 py-2">RMSE</th>
              <th className="px-4 py-2">Max DD</th>
              <th className="px-4 py-2">Avg |ε|</th>
              <th className="px-4 py-2">Final ε</th>
              <th className="px-4 py-2">Excess P&amp;L</th>
              <th className="px-4 py-2">Trades</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {stats.map(({ s, stats: st }) => (
              <tr
                key={s.id}
                className="border-b border-neutral-50 hover:bg-neutral-50 cursor-pointer transition-colors"
                onClick={() => onSelect(s.id)}
              >
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                </td>
                {/* Sharpe — higher is better hedge, near 0 is ideal for a pure hedge */}
                <td className={`px-4 py-2.5 text-right tabular-nums font-mono font-semibold ${sharpeColor(st.sharpe)}`}>
                  {fmtSharpe(st.sharpe)}
                </td>
                {/* RMSE of excess P&L — lower = tighter hedge */}
                <td className="px-4 py-2.5 text-right tabular-nums font-mono text-neutral-700">
                  ${st.rmse.toFixed(2)}
                </td>
                {/* Max drawdown of excess P&L */}
                <td className="px-4 py-2.5 text-right tabular-nums font-mono text-red-600">
                  -${st.maxDrawdown.toFixed(2)}
                </td>
                {/* Avg absolute replication error */}
                <td className="px-4 py-2.5 text-right tabular-nums font-mono text-neutral-700">
                  ${st.avgAbsError.toFixed(2)}
                </td>
                {/* Final ε */}
                <td className={`px-4 py-2.5 text-right tabular-nums font-mono ${pnlColor(st.finalError)}`}>
                  {fmtUsd(st.finalError)}
                </td>
                {/* Excess P&L over risk-free */}
                <td className={`px-4 py-2.5 text-right tabular-nums font-mono font-semibold ${pnlColor(st.excessPnl)}`}>
                  {fmtUsd(st.excessPnl)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-neutral-600">
                  {st.trades}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="text-neutral-400 hover:text-blue-600 text-[10px]">Detail →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Legend for metrics */}
        <div className="px-4 py-3 border-t border-neutral-50 flex flex-wrap gap-x-6 gap-y-1">
          {[
            ['Sharpe', 'Annualised Sharpe of daily excess P&L changes. Near 0 = hedge absorbs variance. High = directional drift.'],
            ['RMSE', 'Root-mean-square of excess P&L (ε_t − W0·e^rt). Lower = tighter hedge.'],
            ['Max DD', 'Maximum peak-to-trough drawdown of excess P&L.'],
            ['Avg |ε|', 'Average absolute replication error. Lower = portfolio tracks option liability closely.'],
            ['Excess P&L', 'Final (ε_T − W0·e^rT). Positive = hedge outperformed risk-free. Near 0 = perfect.'],
          ].map(([label, desc]) => (
            <div key={label} className="flex items-start gap-1 text-[10px] text-neutral-400 max-w-xs">
              <span className="font-semibold text-neutral-500 shrink-0">{label}:</span>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

import type { FrequencyComparisonRow } from '../types'

interface FrequencyComparisonPanelProps {
  rows: FrequencyComparisonRow[]
}

/**
 * Static comparison table showing how replication error scales with hedge frequency.
 * Pre-computed at module load, not animated.
 *
 * Core insight: more frequent hedging → smaller εt → better continuous replication.
 */
export function FrequencyComparisonPanel({ rows }: FrequencyComparisonPanelProps) {
  // Find row with smallest RMSE to highlight
  const bestIdx = rows.reduce(
    (best, row, i) => (row.rmse < rows[best].rmse ? i : best),
    0,
  )

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="text-sm font-semibold text-neutral-700">Discrete vs Continuous</h3>
        <p className="text-[10px] text-neutral-400 mt-0.5">
          Effect of hedge frequency on replication error ε<sub>t</sub>
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="px-3 py-2 text-left font-semibold text-neutral-500">Interval</th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-500">Trades</th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-500">Terminal ε</th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-500">Max |ε|</th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-500">RMSE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isBest = i === bestIdx
              return (
                <tr
                  key={row.hedgeInterval}
                  className={[
                    'border-b border-neutral-100 last:border-0',
                    isBest ? 'bg-emerald-50' : 'hover:bg-neutral-50',
                  ].join(' ')}
                >
                  <td className="px-3 py-2 text-neutral-700 font-medium">
                    every {row.hedgeInterval}
                    {isBest && (
                      <span className="ml-1 text-[9px] text-emerald-600 font-semibold">★</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                    {row.totalTrades}
                  </td>
                  <td className={[
                    'px-3 py-2 text-right tabular-nums font-medium',
                    row.terminalError >= 0 ? 'text-emerald-600' : 'text-red-600',
                  ].join(' ')}>
                    {row.terminalError >= 0 ? '+' : ''}${row.terminalError.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-700">
                    ${row.maxAbsError.toFixed(2)}
                  </td>
                  <td className={[
                    'px-3 py-2 text-right tabular-nums font-semibold',
                    isBest ? 'text-emerald-700' : 'text-neutral-700',
                  ].join(' ')}>
                    ${row.rmse.toFixed(2)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="px-3 py-2 border-t border-neutral-100 bg-neutral-50">
        <p className="text-[10px] text-neutral-400 leading-relaxed">
          In Black–Scholes theory, continuous hedging achieves <em>exact</em> replication.
          Discrete intervals leave a residual γ-induced error that grows with hedge spacing.
        </p>
      </div>
    </div>
  )
}

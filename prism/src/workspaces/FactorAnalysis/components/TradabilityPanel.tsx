interface TradabilityPanelProps {
  grossSharpe: number
  estimatedCostBps: number
  netSharpe: number
  dailyTurnover: number
  grossReturn: number  // annualised
  netReturn: number
}

export function TradabilityPanel({
  grossSharpe,
  estimatedCostBps,
  netSharpe,
  dailyTurnover,
  grossReturn,
  netReturn,
}: TradabilityPanelProps) {
  const rows: { label: string; value: string; cls: string; note?: string }[] = [
    {
      label: 'Gross Ann. Return',
      value: `${grossReturn >= 0 ? '+' : ''}${(grossReturn * 100).toFixed(1)}%`,
      cls: grossReturn >= 0 ? 'text-emerald-600' : 'text-red-600',
    },
    {
      label: 'Gross Sharpe',
      value: grossSharpe.toFixed(2),
      cls: grossSharpe >= 1.5 ? 'text-emerald-600' : grossSharpe >= 1 ? 'text-blue-600' : 'text-amber-600',
    },
    {
      label: 'Daily Turnover',
      value: `${(dailyTurnover * 100).toFixed(1)}% / bar`,
      cls: dailyTurnover > 0.8 ? 'text-amber-600' : 'text-neutral-700',
      note: 'Higher turnover = higher implementation cost',
    },
    {
      label: 'Est. Cost / Bar',
      value: `${estimatedCostBps.toFixed(1)} bps`,
      cls: 'text-amber-600',
      note: '2 bps round-trip assumption',
    },
    {
      label: 'Net Ann. Return',
      value: `${netReturn >= 0 ? '+' : ''}${(netReturn * 100).toFixed(1)}%`,
      cls: netReturn >= 0 ? 'text-emerald-600' : 'text-red-600',
    },
    {
      label: 'Net Sharpe',
      value: netSharpe.toFixed(2),
      cls: netSharpe >= 1.0 ? 'text-emerald-600' : netSharpe >= 0.5 ? 'text-amber-600' : 'text-red-600',
    },
  ]

  const verdict =
    netSharpe >= 1.5 ? { label: 'Tradable', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
    : netSharpe >= 1.0 ? { label: 'Marginal', cls: 'text-amber-600 bg-amber-50 border-amber-200' }
    : { label: 'Not Tradable', cls: 'text-red-600 bg-red-50 border-red-200' }

  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-700">Tradability Assessment</h3>
          <p className="text-[10px] text-neutral-400 mt-0.5">After cost, can this factor be implemented?</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 border rounded ${verdict.cls}`}>
          {verdict.label}
        </span>
      </div>

      <div className="px-3 py-2 space-y-0">
        {rows.map((row, i) => {
          const isDivider = i === 1  // divider before cost section
          return (
            <div key={row.label}>
              {isDivider && <div className="my-1.5 border-t border-dashed border-neutral-200" />}
              <div className="flex items-center justify-between py-1.5">
                <div>
                  <p className="text-xs text-neutral-600">{row.label}</p>
                  {row.note && <p className="text-[10px] text-neutral-400">{row.note}</p>}
                </div>
                <p className={`text-sm font-semibold tabular-nums ${row.cls}`}>{row.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-3 py-2 border-t border-neutral-100 bg-neutral-50">
        <p className="text-[10px] text-neutral-400">
          Cost model: 2 bps/bar × daily turnover. Excludes market impact, slippage, and capacity constraints.
        </p>
      </div>
    </div>
  )
}

interface PortfolioPanelProps {
  sharesHeld: number
  sharePrice: number
  optionValue: number   // current option mark (positive = liability we owe)
  cash: number
  nav: number
  pnl: number
}

interface RowProps {
  label: string
  qty?: string
  price?: string
  value: string
  pnl?: string
  pnlClass?: string
  bold?: boolean
}

function Row({ label, qty, price, value, pnl, pnlClass = 'text-neutral-500', bold = false }: RowProps) {
  const base = bold ? 'text-neutral-900 font-semibold' : 'text-neutral-700'
  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className={`py-2 text-xs ${base}`}>{label}</td>
      <td className="py-2 text-right tabular-nums text-xs text-neutral-600">{qty ?? '—'}</td>
      <td className="py-2 text-right tabular-nums text-xs text-neutral-600">{price ?? '—'}</td>
      <td className={`py-2 text-right tabular-nums text-xs ${base}`}>{value}</td>
      <td className={`py-2 text-right tabular-nums text-xs font-medium ${pnlClass}`}>{pnl ?? '—'}</td>
    </tr>
  )
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPnl(n: number) {
  const s = `${n >= 0 ? '+' : ''}$${fmt(Math.abs(n))}`
  return { text: s, cls: n >= 0 ? 'text-emerald-600' : 'text-red-600' }
}

export function PortfolioPanel({ sharesHeld, sharePrice, optionValue, cash, nav, pnl }: PortfolioPanelProps) {
  const stockValue = sharesHeld * sharePrice
  const stockCost = sharesHeld * sharePrice   // simplified: mark-to-market
  const stockPnl = fmtPnl(stockValue - stockCost)
  const navPnl = fmtPnl(pnl)

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="text-sm font-semibold text-neutral-700">Portfolio</h3>
      </div>

      <div className="panel-body">
        <table className="table-dense">
          <thead>
            <tr>
              <th>Asset</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Px</th>
              <th className="text-right">Value</th>
              <th className="text-right">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            <Row
              label="STOCK"
              qty={`${sharesHeld >= 0 ? '+' : ''}${sharesHeld}`}
              price={`$${fmt(sharePrice)}`}
              value={`$${fmt(stockValue)}`}
              pnl={stockPnl.text}
              pnlClass={stockPnl.cls}
            />
            <Row
              label="CALL (short)"
              qty="−100"
              price={`$${fmt(optionValue)}`}
              value={`−$${fmt(optionValue * 100)}`}
              pnl="—"
            />
            <Row
              label="Cash"
              value={`$${fmt(cash)}`}
              pnl="—"
            />
            <Row
              label="NAV"
              value={`$${fmt(nav)}`}
              pnl={navPnl.text}
              pnlClass={navPnl.cls}
              bold
            />
          </tbody>
        </table>
      </div>
    </div>
  )
}

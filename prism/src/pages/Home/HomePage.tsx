import { Link } from 'react-router-dom'
import { Chart } from '../../shared/components/Chart'

type Trend = 'up' | 'down' | 'flat'

interface StatCardProps {
  label: string
  value: string
  sub: string
  trend: Trend
}

const TREND_CLASSES: Record<Trend, string> = {
  up:   'text-emerald-600',
  down: 'text-red-600',
  flat: 'text-neutral-500',
}

const TREND_ICONS: Record<Trend, string> = {
  up:   '▲',
  down: '▼',
  flat: '—',
}

function StatCard({ label, value, sub, trend }: StatCardProps) {
  return (
    <div className="panel p-5">
      <p className="metric-label mb-2">{label}</p>
      <p className="metric-value text-3xl mb-1">{value}</p>
      <p className={['metric-change', TREND_CLASSES[trend]].join(' ')}>
        {TREND_ICONS[trend]} {sub}
      </p>
    </div>
  )
}

const STATS: StatCardProps[] = [
  { label: 'Portfolio Delta', value: '+2.34',  sub: '+0.18 today',  trend: 'up'   },
  { label: 'Gamma Exposure',  value: '−0.087', sub: '−0.012 today', trend: 'down' },
  { label: 'Vega (×100)',     value: '148.20', sub: '±0.4 range',   trend: 'flat' },
  { label: 'Daily P&L',      value: '+$4,210', sub: '+1.8% on NAV', trend: 'up'   },
  { label: 'Theta Decay',    value: '−$127',   sub: 'per day',      trend: 'down' },
  { label: 'IV Rank',        value: '68.4%',   sub: '30d percentile', trend: 'up' },
]

export function HomePage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="px-8 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Portfolio Dashboard</h1>
            <p className="text-sm text-neutral-500 mt-1">Real-time risk metrics and market overview</p>
          </div>
          <div className="text-xs text-neutral-500 tabular-nums">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>

        {/* Stats Grid - 6 columns for high density */}
        <div className="grid grid-cols-6 gap-4">
          {STATS.map((s) => <StatCard key={s.label} {...s} />)}
        </div>

        {/* Chart Section - Full width */}
        <div className="panel">
          <div className="panel-header flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-700">Market Price</h2>
            <div className="flex items-center gap-3 text-xs text-neutral-500 tabular-nums">
              <span className="text-emerald-600 font-medium">● BTC/USDT</span>
              <span>1D</span>
              <span>Last: $42,156.80</span>
            </div>
          </div>
          <div className="p-4">
            <Chart />
          </div>
        </div>

        {/* Quick Access */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="text-sm font-semibold text-neutral-700">Workspaces</h2>
          </div>
          <div className="p-4 grid grid-cols-4 gap-3">
            <Link
              to="/delta-hedging"
              className="group p-4 border border-neutral-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <p className="text-sm font-semibold text-neutral-900 group-hover:text-blue-600">
                Delta Hedging
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Automated delta-neutral rebalancing
              </p>
            </Link>

            <Link
              to="/factor-analysis"
              className="group p-4 border border-neutral-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <p className="text-sm font-semibold text-neutral-900 group-hover:text-blue-600">
                Factor Analysis
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Single-factor IC / return backtest
              </p>
            </Link>

            <div className="p-4 border border-neutral-200 bg-neutral-50 opacity-60">
              <p className="text-sm font-semibold text-neutral-500">Backtest</p>
              <p className="text-xs text-neutral-400 mt-1">Coming soon</p>
            </div>

            <div className="p-4 border border-neutral-200 bg-neutral-50 opacity-60">
              <p className="text-sm font-semibold text-neutral-500">Live Trading</p>
              <p className="text-xs text-neutral-400 mt-1">Coming soon</p>
            </div>

            <div className="p-4 border border-neutral-200 bg-neutral-50 opacity-60">
              <p className="text-sm font-semibold text-neutral-500">Risk Monitor</p>
              <p className="text-xs text-neutral-400 mt-1">Coming soon</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

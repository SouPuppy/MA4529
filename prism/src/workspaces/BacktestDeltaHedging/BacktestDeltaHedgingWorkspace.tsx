import { useEffect, useState } from 'react'
import type { EnhancedSnapshot } from '../DeltaHedging/types'
import { loadSpyCsvSnapshots } from '../SPYDeltaHedging/spyCsvLoader'
import { STRATEGIES } from './components/StrategyTabs'
import { StrategyTabs } from './components/StrategyTabs'
import { OverviewPanel } from './components/OverviewPanel'
import { StrategyDetailPanel } from './components/StrategyDetailPanel'

type TabId = 'overview' | string

export function BacktestDeltaHedgingWorkspace() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [data, setData]           = useState<Record<string, EnhancedSnapshot[]>>({})
  const [loaded, setLoaded]       = useState<Set<string>>(new Set())
  const [errors, setErrors]       = useState<Record<string, string>>({})

  // Load all CSVs in parallel on mount
  useEffect(() => {
    for (const s of STRATEGIES) {
      loadSpyCsvSnapshots(s.file)
        .then((snaps) => {
          setData((prev) => ({ ...prev, [s.id]: snaps }))
          setLoaded((prev) => new Set([...prev, s.id]))
        })
        .catch((e) => {
          setErrors((prev) => ({ ...prev, [s.id]: String(e) }))
          setLoaded((prev) => new Set([...prev, s.id]))
        })
    }
  }, [])

  const activeStrategy = STRATEGIES.find((s) => s.id === activeTab)
  const activeSnaps    = activeStrategy ? data[activeStrategy.id] : undefined

  return (
    <div className="flex flex-col h-full min-h-0 bg-neutral-50">

      {/* Controls bar */}
      <div className="flex items-center gap-4 px-6 py-2.5 border-b border-neutral-200 bg-white shrink-0">
        <div className="flex flex-col leading-none">
          <span className="text-xs font-bold text-neutral-900 tracking-tight">SPY Δ-Hedge · C600 · Dec 18 '26</span>
          <span className="text-[10px] text-neutral-400 mt-0.5">
            Self-financing · W₀ = $10,000 · r = 4.5% · {loaded.size}/{STRATEGIES.length} strategies loaded
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <StrategyTabs active={activeTab} loaded={loaded} onChange={setActiveTab} />

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'overview' ? (
          <OverviewPanel data={data} onSelect={setActiveTab} />
        ) : activeStrategy && activeSnaps && activeSnaps.length > 0 ? (
          <StrategyDetailPanel strategy={activeStrategy} snapshots={activeSnaps} />
        ) : activeStrategy && errors[activeStrategy.id] ? (
          <div className="flex h-full items-center justify-center text-sm text-red-500 px-6">
            {errors[activeStrategy.id]}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">
            Loading {activeStrategy?.label}…
          </div>
        )}
      </div>

    </div>
  )
}

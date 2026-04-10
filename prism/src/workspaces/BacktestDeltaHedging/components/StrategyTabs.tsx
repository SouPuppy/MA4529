export interface StrategyDef {
  id:    string
  label: string
  file:  string
  color: string
}

export const STRATEGIES: StrategyDef[] = [
  { id: 'A_1d',    label: '1d Analytic',  file: '/data/A_analytic_1d.csv',  color: '#2563eb' },
  { id: 'A_5d',    label: '5d Analytic',  file: '/data/A_analytic_5d.csv',  color: '#16a34a' },
  { id: 'A_20d',   label: '20d Analytic', file: '/data/A_analytic_20d.csv', color: '#d97706' },
  { id: 'B_mc500', label: 'MC 500',       file: '/data/B_mc_500.csv',       color: '#9333ea' },
  { id: 'B_mc5k',  label: 'MC 5000',      file: '/data/B_mc_5000.csv',      color: '#dc2626' },
]

type TabId = 'overview' | string

interface Props {
  active:   TabId
  loaded:   Set<string>   // strategy ids that have finished loading
  onChange: (id: TabId) => void
}

export function StrategyTabs({ active, loaded, onChange }: Props) {
  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...STRATEGIES.map((s) => ({ id: s.id, label: s.label })),
  ]

  return (
    <div className="flex items-center gap-0 border-b border-neutral-200 bg-white shrink-0 px-6">
      {tabs.map((tab) => {
        const isActive  = active === tab.id
        const isLoading = tab.id !== 'overview' && !loaded.has(tab.id)

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={[
              'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors',
              isActive
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300',
            ].join(' ')}
          >
            {isLoading && (
              <span className="w-2 h-2 rounded-full border border-neutral-400 border-t-transparent animate-spin" />
            )}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

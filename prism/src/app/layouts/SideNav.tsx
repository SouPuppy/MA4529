import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  // { to: '/', label: 'Dashboard', end: true },
  // { to: '/factor-analysis', label: 'Factor Analysis', end: false },
  // { to: '/delta-hedging',     label: 'Delta Hedging',     end: false },
  { to: '/', label: 'SPY Δ-Hedge', end: true },
]

export function SideNav() {
  return (
    <aside className="w-36 shrink-0 flex flex-col h-full border-r border-ink-2d bg-paper-white">

      {/* Brand */}
      <div className="px-4 py-3 border-b border-ink-2d">
        <span className="text-[13px] font-bold text-ink-2b tracking-tight">Prism</span>
      </div>

      {/* Workspace links */}
      <nav className="flex-1 py-2">
        {NAV_ITEMS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex items-center px-4 py-1.5 text-[12px] border-r-2 transition-colors',
                isActive
                  ? 'border-ink-2b text-ink-2b font-semibold bg-black-a05'
                  : 'border-transparent text-ink-5b hover:text-ink-2b hover:bg-black-a05',
              ].join(' ')
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Status */}
      <div className="px-4 py-3 border-t border-ink-2d">
        <div className="flex items-center gap-1.5 text-[10px] text-ink-5b">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          Live
        </div>
      </div>

    </aside>
  )
}

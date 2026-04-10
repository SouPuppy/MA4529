import { NavLink, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'

const WORKSPACES = [
  { to: '/app/delta-hedging', label: 'Delta Hedging' },
  { to: '/app/factor-analysis', label: 'Factor Analysis' },
  { to: '/app/backtest', label: 'Backtest' },
  { to: '/app/live-trading', label: 'Live Trading' },
]

export function Navbar() {
  const { pathname } = useLocation()
  const [showWorkspaces, setShowWorkspaces] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isWorkspace = pathname.startsWith('/app/')

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowWorkspaces(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <nav className="border-b border-neutral-200 bg-white">
      <div className="flex items-center gap-8 px-6 py-3">
        <NavLink to="/" className="text-xl font-bold text-neutral-900">
          Prism
        </NavLink>

        <div className="flex items-center gap-6">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `text-sm font-medium transition-colors ${
                isActive && !isWorkspace
                  ? 'text-blue-600 border-b-2 border-blue-600 pb-0.5'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`
            }
          >
            Dashboard
          </NavLink>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowWorkspaces(!showWorkspaces)}
              className={`text-sm font-medium transition-colors flex items-center gap-1 ${
                isWorkspace
                  ? 'text-blue-600 border-b-2 border-blue-600 pb-0.5'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Workspaces
              <svg
                className={`w-4 h-4 transition-transform ${showWorkspaces ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showWorkspaces && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-neutral-200 shadow-lg z-50">
                {WORKSPACES.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setShowWorkspaces(false)}
                    className={({ isActive }) =>
                      `block px-4 py-2.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-neutral-700 hover:bg-neutral-50'
                      }`
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </div>
        </div>
      </div>
    </nav>
  )
}

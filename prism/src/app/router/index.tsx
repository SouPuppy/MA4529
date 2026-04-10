import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '../layouts/AppShell'
import { NotFoundPage } from '../../pages/NotFound'

// Lazy-load workspaces so heavyweight deps (vega, lightweight-charts) are
// split into separate chunks and not included in the initial bundle.
const DeltaHedgingWorkspace = lazy(() =>
  import('../../workspaces/DeltaHedging').then((m) => ({ default: m.DeltaHedgingWorkspace })),
)
const FactorAnalysisWorkspace = lazy(() =>
  import('../../workspaces/FactorAnalysis').then((m) => ({ default: m.FactorAnalysisWorkspace })),
)
const SPYDeltaHedgingWorkspace = lazy(() =>
  import('../../workspaces/SPYDeltaHedging').then((m) => ({ default: m.SPYDeltaHedgingWorkspace })),
)
const BacktestDeltaHedgingWorkspace = lazy(() =>
  import('../../workspaces/BacktestDeltaHedging').then((m) => ({ default: m.BacktestDeltaHedgingWorkspace })),
)

function WorkspaceLoader() {
  return (
    <div className="flex h-full items-center justify-center text-subtle text-sm">
      Loading workspace…
    </div>
  )
}

// Single layout — AppShell wraps everything.
// Dashboard lives at / alongside the workspaces; no separate SiteLayout.
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      {
        path: '/',
        element: (
          <Suspense fallback={<WorkspaceLoader />}>
            <BacktestDeltaHedgingWorkspace />
          </Suspense>
        ),
      },
      {
        path: 'factor-analysis',
        element: (
          <Suspense fallback={<WorkspaceLoader />}>
            <FactorAnalysisWorkspace />
          </Suspense>
        ),
      },
      {
        path: 'delta-hedging',
        element: (
          <Suspense fallback={<WorkspaceLoader />}>
            <DeltaHedgingWorkspace />
          </Suspense>
        ),
      },
      {
        path: 'spy-delta-hedging',
        element: (
          <Suspense fallback={<WorkspaceLoader />}>
            <SPYDeltaHedgingWorkspace />
          </Suspense>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])

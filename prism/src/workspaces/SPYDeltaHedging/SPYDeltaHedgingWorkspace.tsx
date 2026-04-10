import { useEffect, useMemo, useRef, useState } from 'react'
import { LineChartPanel } from '../../features/TradingChart'
import type { PricePoint, TradeMark } from '../../features/TradingChart'
import { DeltaPathChart } from '../DeltaHedging/components/DeltaPathChart'
import { ReplicationErrorChart } from '../DeltaHedging/components/ReplicationErrorChart'
import { EventLog } from '../DeltaHedging/components/EventLog'
import type { EnhancedSnapshot } from '../DeltaHedging/types'
import { loadSpyCsvSnapshots } from './spyCsvLoader'
import { SPYControlsBar } from './components/SPYControlsBar'
import type { SPYSpeed } from './components/SPYControlsBar'
import { SPYContractStrip } from './components/SPYContractStrip'
import { SPYGreeksChart } from './components/SPYGreeksChart'
import { SPYPortfolioCard } from './components/SPYPortfolioCard'
import { SPYPnLCard } from './components/SPYPnLCard'

// ── Workspace ─────────────────────────────────────────────────────────────────

export function SPYDeltaHedgingWorkspace() {
  const [snapshots, setSnapshots] = useState<EnhancedSnapshot[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const [step, setStep]           = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed]         = useState<SPYSpeed>(1)
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load CSV on mount
  useEffect(() => {
    loadSpyCsvSnapshots('/data/spy_delta_hedging_log.csv')
      .then((data) => { setSnapshots(data); setLoading(false) })
      .catch((e)  => { setError(String(e)); setLoading(false) })
  }, [])

  const total   = snapshots.length - 1
  const current = snapshots[step] ?? snapshots[0]

  // Playback
  useEffect(() => {
    if (!isPlaying || snapshots.length === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    if (step >= total) { setIsPlaying(false); return }
    intervalRef.current = setInterval(() => {
      setStep((s) => {
        if (s >= total) { setIsPlaying(false); return s }
        return s + 1
      })
    }, Math.round(600 / speed))
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isPlaying, speed, step, total, snapshots.length])

  // Derived data
  const visible = useMemo(() => snapshots.slice(0, step + 1), [step, snapshots])

  const priceData = useMemo<PricePoint[]>(
    () => visible.map((s) => ({ time: s.date, value: s.price })),
    [visible],
  )
  const trades = useMemo<TradeMark[]>(
    () => visible
      .filter((s) => s.hedgeTrade !== undefined)
      .map((s) => ({
        time:  s.date,
        side:  s.hedgeTrade!.side,
        qty:   s.hedgeTrade!.qty,
        price: s.hedgeTrade!.price,
      })),
    [visible],
  )
  const events = useMemo(() => visible.map((s) => s.event), [visible])

  // Loading / error states
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-400">
        Loading CSV…
      </div>
    )
  }
  if (error || snapshots.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-500">
        {error ?? 'No data — rebuild the strategy and regenerate the CSV.'}
      </div>
    )
  }

  const ivolPct = current ? current.greeks.delta >= 0
    ? (snapshots[0]?.greeks.vega ?? 0) > 0 ? 24.49 : 24.49  // Bloomberg static
    : 24.49 : 24.49

  return (
    <div className="flex flex-col h-full min-h-0 bg-neutral-50">

      {/* Controls bar */}
      <SPYControlsBar
        step={step}
        total={total}
        currentDate={current?.date ?? ''}
        isPlaying={isPlaying}
        speed={speed}
        onPlay={()  => setIsPlaying(true)}
        onPause={()  => setIsPlaying(false)}
        onReset={()  => { setIsPlaying(false); setStep(0) }}
        onSpeedChange={setSpeed}
      />

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 py-3 space-y-3">

          {/* Contract strip — full width */}
          <SPYContractStrip totalRows={snapshots.length} ivolPct={ivolPct} />

          {/* Main 12-col grid */}
          <div className="grid grid-cols-12 gap-3">

            {/* ── Left col: charts ── */}
            <div className="col-span-9 space-y-3">

              {/* Spot price + trade markers */}
              <div className="panel">
                <div className="panel-header">
                  <h3 className="text-xs font-semibold text-neutral-700">
                    Spot Price · Hedge Trades
                  </h3>
                </div>
                <LineChartPanel
                  priceData={priceData}
                  trades={trades}
                  height={280}
                  autoFollow={false}
                />
              </div>

              {/* Delta path */}
              <div className="panel">
                <div className="panel-header">
                  <h3 className="text-xs font-semibold text-neutral-700">
                    Delta Path · Hedge Ratio
                  </h3>
                </div>
                <DeltaPathChart snapshots={visible} height={180} />
              </div>

              {/* Replication error */}
              <div className="panel">
                <div className="panel-header">
                  <h3 className="text-xs font-semibold text-neutral-700">
                    Replication Error ε<sub>t</sub>
                  </h3>
                </div>
                <ReplicationErrorChart snapshots={visible} height={150} />
              </div>

            </div>

            {/* ── Right col: cards ── */}
            <div className="col-span-3 space-y-3">
              <SPYGreeksChart snapshots={visible} height={280} />
              {current && (
                <>
                  <SPYPortfolioCard snapshot={current} />
                  <SPYPnLCard       snapshot={current} />
                </>
              )}
            </div>

          </div>

          {/* Event log — full width */}
          <div style={{ height: 260 }}>
            <EventLog events={events} />
          </div>

        </div>
      </div>
    </div>
  )
}

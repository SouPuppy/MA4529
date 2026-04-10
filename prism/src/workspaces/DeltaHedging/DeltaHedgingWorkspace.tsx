import 'katex/dist/katex.min.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LineChartPanel } from '../../features/TradingChart'
import type { PricePoint, TradeMark } from '../../features/TradingChart'
import {
  runHedgeSimulation,
  runFrequencyComparison,
  DEFAULT_PARAMS,
} from './mock/hedgeEngine'
import { loadCsvSnapshots, CSV_PARAMS } from './loaders/csvLoader'
import type { EnhancedSnapshot } from './types'
import { ControlsBar } from './components/ControlsBar'
import type { Speed, DataSource } from './components/ControlsBar'
import { ParameterPanel } from './components/ParameterPanel'
import { TheoryStateCards } from './components/TheoryStateCards'
import { DeltaPathChart } from './components/DeltaPathChart'
import { ReplicationErrorChart } from './components/ReplicationErrorChart'
import { EventLog } from './components/EventLog'
import { FrequencyComparisonPanel } from './components/FrequencyComparisonPanel'

// ── Pre-compute mock simulation once at module load ───────────────────────────

const MOCK_SIMULATION: EnhancedSnapshot[] = runHedgeSimulation(DEFAULT_PARAMS)
const COMPARISON = runFrequencyComparison(DEFAULT_PARAMS, [1, 5, 10, 20, 50])

// ── Workspace ─────────────────────────────────────────────────────────────────

export function DeltaHedgingWorkspace() {
  const [step, setStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── CSV data source ────────────────────────────────────────────────────────
  const [dataSource, setDataSource] = useState<DataSource>('csv')
  const [csvData, setCsvData] = useState<EnhancedSnapshot[] | null>(null)
  const [csvLoading, setCsvLoading] = useState(true)

  useEffect(() => {
    setCsvLoading(true)
    loadCsvSnapshots('/data/spy_delta_hedging_log.csv')
      .then((data) => { setCsvData(data); setCsvLoading(false) })
      .catch(() => { setCsvLoading(false) })
  }, [])

  // Switch to mock if CSV failed to load
  const effectiveSource: DataSource =
    dataSource === 'csv' && !csvLoading && csvData === null ? 'mock' : dataSource

  const simulation: EnhancedSnapshot[] =
    effectiveSource === 'csv' && csvData ? csvData : MOCK_SIMULATION

  const totalSteps = simulation.length - 1
  const params = effectiveSource === 'csv' ? CSV_PARAMS : DEFAULT_PARAMS

  // Reset step when source changes
  useEffect(() => { setIsPlaying(false); setStep(0) }, [dataSource])

  // Auto-advance playback
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    if (step >= totalSteps) {
      setIsPlaying(false)
      return
    }
    intervalRef.current = setInterval(() => {
      setStep((s) => {
        if (s >= totalSteps) { setIsPlaying(false); return s }
        return s + 1
      })
    }, Math.round(600 / speed))
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isPlaying, speed, step, totalSteps])

  const current = simulation[step] ?? simulation[0]

  // ── Derived data (memoised off step) ──────────────────────────────────────

  const visible = useMemo(
    () => simulation.slice(0, step + 1),
    [step, simulation],
  )

  const priceData = useMemo<PricePoint[]>(
    () => visible.map((s) => ({ time: s.date, value: s.price })),
    [visible],
  )

  const trades = useMemo<TradeMark[]>(
    () =>
      visible
        .filter((s) => s.hedgeTrade !== undefined)
        .map((s) => ({
          time: s.date,
          side: s.hedgeTrade!.side,
          qty: s.hedgeTrade!.qty,
          price: s.hedgeTrade!.price,
        })),
    [visible],
  )

  const events = useMemo(
    () => visible.map((s) => s.event),
    [visible],
  )

  return (
    <div className="flex flex-col h-full min-h-0 bg-neutral-50">
      {/* Controls bar */}
      <ControlsBar
        step={step}
        total={totalSteps}
        isPlaying={isPlaying}
        speed={speed}
        params={params}
        dataSource={effectiveSource}
        csvLoading={csvLoading}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onReset={() => { setIsPlaying(false); setStep(0) }}
        onSpeedChange={setSpeed}
        onDataSourceToggle={() => setDataSource((d) => d === 'csv' ? 'mock' : 'csv')}
      />

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-8 py-4 space-y-3">

          {/* Module 1: Parameter & theory strip */}
          <ParameterPanel params={params} />

          {/* Main grid: 8-col charts | 4-col right sidebar */}
          <div className="grid grid-cols-12 gap-3">

            {/* Left: stacked charts */}
            <div className="col-span-8 space-y-3">

              {/* Module 3a: Price path + hedge trades */}
              <div className="panel">
                <div className="panel-header">
                  <h3 className="text-sm font-semibold text-neutral-700">Price Path · Hedge Trades</h3>
                </div>
                <LineChartPanel
                  priceData={priceData}
                  trades={trades}
                  height={320}
                  autoFollow={false}
                />
              </div>

              {/* Module 3b: Delta path chart */}
              <div className="panel">
                <div className="panel-header">
                  <h3 className="text-sm font-semibold text-neutral-700">Delta Path · Hedge Ratio</h3>
                </div>
                <DeltaPathChart snapshots={visible} height={220} />
              </div>

              {/* Module 4: Replication error */}
              <div className="panel">
                <div className="panel-header">
                  <h3 className="text-sm font-semibold text-neutral-700">Replication Error ε<sub>t</sub></h3>
                </div>
                <ReplicationErrorChart snapshots={visible} height={180} />
              </div>

            </div>

            {/* Right: theory state + frequency comparison */}
            <div className="col-span-4 space-y-3">
              {/* Module 2: Theory state cards */}
              <TheoryStateCards snapshot={current} />
              {/* Module 6: Frequency comparison (always mock — CSV has no trades) */}
              <FrequencyComparisonPanel rows={COMPARISON} />
            </div>

          </div>

          {/* Module 5: Event log */}
          <div style={{ height: 280 }}>
            <EventLog events={events} />
          </div>

        </div>
      </div>
    </div>
  )
}

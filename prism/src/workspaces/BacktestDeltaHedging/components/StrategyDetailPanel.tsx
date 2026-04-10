import { useMemo, useRef, useState, useEffect } from 'react'
import { LineChartPanel } from '../../../features/TradingChart'
import type { PricePoint, TradeMark } from '../../../features/TradingChart'
import { DeltaPathChart } from '../../DeltaHedging/components/DeltaPathChart'
import { ReplicationErrorChart } from '../../DeltaHedging/components/ReplicationErrorChart'
import { EventLog } from '../../DeltaHedging/components/EventLog'
import type { SPYSpeed } from '../../SPYDeltaHedging/components/SPYControlsBar'
import { SPYContractStrip } from '../../SPYDeltaHedging/components/SPYContractStrip'
import { SPYGreeksChart } from '../../SPYDeltaHedging/components/SPYGreeksChart'
import { SPYPortfolioCard } from '../../SPYDeltaHedging/components/SPYPortfolioCard'
import { SPYPnLCard } from '../../SPYDeltaHedging/components/SPYPnLCard'
import type { EnhancedSnapshot } from '../../DeltaHedging/types'
import type { StrategyDef } from './StrategyTabs'

interface Props {
  strategy:  StrategyDef
  snapshots: EnhancedSnapshot[]
}

export function StrategyDetailPanel({ strategy, snapshots }: Props) {
  const [step, setStep]           = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed]         = useState<SPYSpeed>(1)
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset when strategy changes
  useEffect(() => {
    setStep(0)
    setIsPlaying(false)
  }, [strategy.id])

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

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Strategy-specific controls bar (reuse SPYControlsBar layout inline) */}
      <div className="flex items-center gap-5 px-6 py-2.5 border-b border-neutral-200 bg-white shrink-0">
        <div className="flex flex-col leading-none">
          <span className="text-xs font-bold tracking-tight" style={{ color: strategy.color }}>{strategy.label}</span>
          <span className="text-[10px] text-neutral-400 mt-0.5">C600 · Dec 18 '26 · W₀ = $10,000</span>
        </div>
        <div className="h-6 w-px bg-neutral-200" />
        <div className="tabular-nums text-xs font-mono text-neutral-600 bg-neutral-100 px-2 py-1 rounded">
          {current?.date || '—'}
        </div>
        <div className="tabular-nums text-xs text-neutral-500">
          <span className="font-semibold text-neutral-800">{step}</span>
          <span> / {total}</span>
        </div>
        <div className="flex-1 max-w-xs h-1 bg-neutral-200 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-150 rounded-full"
            style={{ width: `${total > 0 ? Math.round((step / total) * 100) : 0}%`, backgroundColor: strategy.color }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => { setIsPlaying(false); setStep(0) }} className="btn btn-sm" title="Reset">↺</button>
          <button
            onClick={() => setIsPlaying((p) => !p)}
            disabled={!isPlaying && step >= total}
            className="btn-primary btn-sm px-3"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-neutral-400 mr-1">Speed</span>
          {([0.5, 1, 2, 5, 10, 20] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={[
                'px-1.5 py-0.5 text-[11px] font-medium tabular-nums rounded transition-colors',
                speed === s ? 'text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200',
              ].join(' ')}
              style={speed === s ? { backgroundColor: strategy.color } : {}}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 py-3 space-y-3">

          <SPYContractStrip totalRows={snapshots.length} ivolPct={24.49} />

          <div className="grid grid-cols-12 gap-3">

            <div className="col-span-9 space-y-3">

              <div className="panel">
                <div className="panel-header">
                  <h3 className="text-xs font-semibold text-neutral-700">
                    Spot Price · Hedge Trades · <span style={{ color: strategy.color }}>{strategy.label}</span>
                  </h3>
                </div>
                <LineChartPanel priceData={priceData} trades={trades} height={280} autoFollow={false} />
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h3 className="text-xs font-semibold text-neutral-700">Delta Path · Hedge Ratio</h3>
                </div>
                <DeltaPathChart snapshots={visible} height={180} />
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h3 className="text-xs font-semibold text-neutral-700">
                    Replication Error ε<sub>t</sub>
                  </h3>
                </div>
                <ReplicationErrorChart snapshots={visible} height={150} />
              </div>

            </div>

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

          <div style={{ height: 260 }}>
            <EventLog events={events} />
          </div>

        </div>
      </div>
    </div>
  )
}

import type { SimParams } from '../mock/hedgeEngine'

const SPEEDS = [0.5, 1, 2, 5] as const
export type Speed = typeof SPEEDS[number]

export type DataSource = 'csv' | 'mock'

export interface ControlsBarProps {
  step: number
  total: number
  isPlaying: boolean
  speed: Speed
  params: SimParams
  dataSource: DataSource
  csvLoading?: boolean
  onPlay: () => void
  onPause: () => void
  onReset: () => void
  onSpeedChange: (s: Speed) => void
  onDataSourceToggle: () => void
}

export function ControlsBar({
  step, total, isPlaying, speed, params,
  dataSource, csvLoading,
  onPlay, onPause, onReset, onSpeedChange, onDataSourceToggle,
}: ControlsBarProps) {
  const pct = Math.round((step / total) * 100)

  return (
    <div className="flex items-center gap-6 px-8 py-3 border-b border-neutral-200 bg-white shrink-0">
      {/* Simulation identity */}
      <div className="flex items-center gap-3">
        <div className="text-sm font-semibold text-neutral-900">Delta Hedging Lab</div>
        <div className="text-xs text-neutral-500">
          European Call · K=${params.K} · σ={(params.sigma * 100).toFixed(0)}% · T={(params.T * 365).toFixed(0)}d · GBM
        </div>
      </div>

      <div className="h-5 w-px bg-neutral-200" />

      {/* Step counter */}
      <div className="tabular-nums text-sm text-neutral-600">
        Step <span className="font-semibold text-neutral-900">{step}</span>
        <span className="text-neutral-400"> / {total}</span>
      </div>

      {/* Progress bar */}
      <div className="flex-1 max-w-sm h-1.5 bg-neutral-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-200 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onReset}
          className="btn btn-sm"
          title="Reset to step 0"
        >
          ↺
        </button>
        <button
          onClick={isPlaying ? onPause : onPlay}
          disabled={!isPlaying && step >= total}
          className="btn-primary btn-sm px-4"
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
      </div>

      {/* Speed selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-neutral-400">Speed</span>
        <div className="flex items-center gap-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={[
                'px-2 py-1 text-xs font-medium tabular-nums transition-colors',
                speed === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
              ].join(' ')}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div className="ml-auto">
        <button
          onClick={onDataSourceToggle}
          disabled={csvLoading}
          className={[
            'flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-colors',
            dataSource === 'csv'
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200',
          ].join(' ')}
          title={dataSource === 'csv' ? 'Showing CSV backtest data — click for mock' : 'Showing mock simulation — click for CSV'}
        >
          {csvLoading ? '⏳' : dataSource === 'csv' ? '📄 CSV' : '🔬 SIM'}
        </button>
      </div>
    </div>
  )
}

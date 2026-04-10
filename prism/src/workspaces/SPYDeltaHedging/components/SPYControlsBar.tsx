const SPEEDS = [0.5, 1, 2, 5, 10, 20] as const
export type SPYSpeed = typeof SPEEDS[number]

export interface SPYControlsBarProps {
  step:        number
  total:       number
  currentDate: string   // "YYYY-MM-DD"
  isPlaying:   boolean
  speed:       SPYSpeed
  onPlay:      () => void
  onPause:     () => void
  onReset:     () => void
  onSpeedChange: (s: SPYSpeed) => void
}

export function SPYControlsBar({
  step, total, currentDate, isPlaying, speed,
  onPlay, onPause, onReset, onSpeedChange,
}: SPYControlsBarProps) {
  const pct = total > 0 ? Math.round((step / total) * 100) : 0

  return (
    <div className="flex items-center gap-5 px-6 py-2.5 border-b border-neutral-200 bg-white shrink-0">

      {/* Identity */}
      <div className="flex flex-col leading-none">
        <span className="text-xs font-bold text-neutral-900 tracking-tight">SPY Delta Hedge</span>
        <span className="text-[10px] text-neutral-400 mt-0.5">C600 · Dec 18 '26 · GBM Backtest</span>
      </div>

      <div className="h-6 w-px bg-neutral-200" />

      {/* Date badge */}
      <div className="tabular-nums text-xs font-mono text-neutral-600 bg-neutral-100 px-2 py-1 rounded">
        {currentDate || '—'}
      </div>

      {/* Step counter */}
      <div className="tabular-nums text-xs text-neutral-500">
        <span className="font-semibold text-neutral-800">{step}</span>
        <span> / {total}</span>
      </div>

      {/* Progress bar */}
      <div className="flex-1 max-w-xs h-1 bg-neutral-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-150 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Playback */}
      <div className="flex items-center gap-1.5">
        <button onClick={onReset} className="btn btn-sm" title="Reset">↺</button>
        <button
          onClick={isPlaying ? onPause : onPlay}
          disabled={!isPlaying && step >= total}
          className="btn-primary btn-sm px-3"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>

      {/* Speed */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-neutral-400 mr-1">Speed</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={[
              'px-1.5 py-0.5 text-[11px] font-medium tabular-nums rounded transition-colors',
              speed === s
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200',
            ].join(' ')}
          >
            {s}×
          </button>
        ))}
      </div>

    </div>
  )
}

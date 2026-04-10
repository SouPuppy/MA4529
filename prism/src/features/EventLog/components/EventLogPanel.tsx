import type { TradeEvent } from '../../../domains/Trading/model'

interface EventLogPanelProps {
  events: TradeEvent[]
}

const TYPE_STYLES = {
  HEDGE: { dot: 'bg-blue-600',  label: 'text-blue-600 bg-blue-50'  },
  PRICE: { dot: 'bg-neutral-400',  label: 'text-neutral-600 bg-neutral-50'  },
  INFO:  { dot: 'bg-neutral-300',   label: 'text-neutral-500 bg-neutral-50'   },
} satisfies Record<TradeEvent['type'], { dot: string; label: string }>

export function EventLogPanel({ events }: EventLogPanelProps) {
  // Show most recent at top
  const reversed = [...events].reverse()

  return (
    <div className="panel flex flex-col h-full">
      {/* Header */}
      <div className="panel-header flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-neutral-700">Event Log</h3>
        <span className="tabular-nums text-xs text-neutral-500">{events.length} events</span>
      </div>

      {/* Scrollable log */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {reversed.length === 0 && (
          <p className="px-4 py-8 text-xs text-neutral-400 text-center">Waiting for simulation…</p>
        )}
        {reversed.map((evt) => {
          const style = TYPE_STYLES[evt.type]
          return (
            <div
              key={evt.id}
              className="flex items-start gap-3 px-4 py-2.5 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors"
            >
              {/* Type dot */}
              <span className={`mt-1.5 shrink-0 size-1.5 rounded-full ${style.dot}`} />

              {/* Timestamp */}
              <span className="shrink-0 tabular-nums text-[11px] text-neutral-500 w-24 pt-0.5">
                {evt.timestamp}
              </span>

              {/* Type badge */}
              <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 ${style.label}`}>
                {evt.type}
              </span>

              {/* Message */}
              <span className="text-xs text-neutral-700 leading-relaxed flex-1">
                {evt.message}
              </span>

              {/* Delta context for hedge events */}
              {evt.type === 'HEDGE' && evt.delta !== undefined && (
                <span className="shrink-0 tabular-nums text-[11px] text-neutral-500 whitespace-nowrap">
                  Δ-before: {evt.delta.toFixed(1)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

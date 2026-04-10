import { useEffect, useRef, useState } from 'react'
import { Dropdown } from '../../../shared/components/Dropdown'
import type { DropdownOption } from '../../../shared/components/Dropdown'
import type { SimEvent, EventKind } from '../types'

// ─── Filter options ───────────────────────────────────────────────────────────

type FilterValue = 'ALL' | EventKind

const FILTER_OPTIONS: DropdownOption<FilterValue>[] = [
  { value: 'ALL',        label: 'All'       },
  { value: 'REBALANCE',  label: 'Rebalance' },
  { value: 'PRICE_MOVE', label: 'Market'    },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

// (removed unused fmtDollar helper)

// ─── Single-line row (uniform column grid) ────────────────────────────────────
//
// Layout: dot · ts_event · kind badge · action · delta · epsilon · tau
// Fixed widths keep all rows visually aligned regardless of event kind.
// Each column maps to a concept present in both REBALANCE and PRICE_MOVE events,
// making it straightforward to extend to other event kinds later.

function EventRow({ evt, filter }: { evt: SimEvent; filter: FilterValue }) {
  const p = evt.payload

  // Common columns for ALL filter
  const dateCell = <span className="w-24 shrink-0 tabular-nums font-mono text-neutral-600">{evt.ts_event}</span>
  const typeCell = (
    <span className={[
      'w-20 shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded inline-block text-center',
      evt.kind === 'REBALANCE' ? 'text-violet-700 bg-violet-50' : 'text-neutral-500 bg-neutral-50'
    ].join(' ')}>
      {evt.kind === 'REBALANCE' ? 'Trade' : 'Market'}
    </span>
  )

  // When filter is ALL, show minimal common data
  if (filter === 'ALL') {
    return (
      <div className="flex items-center gap-4 px-3 py-1.5 border-b border-neutral-100 text-[11px]">
        {dateCell}
        {typeCell}
        <span className="text-neutral-500 flex-1 truncate">
          {evt.kind === 'REBALANCE'
            ? `${evt.payload.rebalance.sharesChange >= 0 ? 'Buy' : 'Sell'} ${Math.abs(evt.payload.rebalance.sharesChange)} @ $${p.St.toFixed(2)}`
            : `Spot $${p.St.toFixed(2)}`
          }
        </span>
      </div>
    )
  }

  // When filtered to specific type, show detailed columns
  if (evt.kind === 'REBALANCE') {
    const rb = evt.payload.rebalance
    const bought = rb.sharesChange >= 0
    return (
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-neutral-100 text-[11px]">
        {dateCell}
        <span className={['font-medium tabular-nums w-40 shrink-0', bought ? 'text-emerald-600' : 'text-red-600'].join(' ')}>
          {bought ? 'Buy' : 'Sell'} {Math.abs(rb.sharesChange)} @ ${p.St.toFixed(2)}
        </span>
        <span className="w-28 shrink-0 tabular-nums font-mono text-neutral-600 text-right">
          φ: {p.sharesHeld.toFixed(2)}
        </span>
        <span className="w-28 shrink-0 tabular-nums font-mono text-neutral-600 text-right">
          B: ${p.cash.toFixed(2)}
        </span>
        <span className="w-32 shrink-0 tabular-nums font-mono text-neutral-500 text-right">
          NPV: ${p.replicationValue.toFixed(2)}
        </span>
        <span className={['w-24 shrink-0 tabular-nums font-mono text-right', rb.errorAfter >= 0 ? 'text-emerald-600' : 'text-red-600'].join(' ')}>
          {rb.errorAfter >= 0 ? '+' : ''}${rb.errorAfter.toFixed(2)}
        </span>
      </div>
    )
  } else {
    return (
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-neutral-100 text-[11px]">
        {dateCell}
        <span className="tabular-nums text-neutral-700 flex-1">
          Spot ${p.St.toFixed(2)} · Option ${p.Vt.toFixed(2)}
        </span>
        <span className="w-24 shrink-0 tabular-nums font-mono text-neutral-500">
          Delta: {p.optionDelta.toFixed(4)}
        </span>
        <span className={['w-24 shrink-0 tabular-nums font-mono text-right', p.replicationError >= 0 ? 'text-emerald-600' : 'text-red-600'].join(' ')}>
          {p.replicationError >= 0 ? '+' : ''}${p.replicationError.toFixed(2)}
        </span>
      </div>
    )
  }
}

// ─── Column header ────────────────────────────────────────────────────────────

function ColumnHeader({ filter }: { filter: FilterValue }) {
  if (filter === 'ALL') {
    return (
      <div className="flex items-center gap-4 px-3 py-1 border-b border-neutral-200 bg-neutral-50 text-[10px] text-neutral-500 select-none uppercase tracking-wide">
        <span className="w-24 shrink-0">Date</span>
        <span className="w-20 shrink-0 text-center">Type</span>
        <span className="flex-1">Message</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-3 py-1 border-b border-neutral-200 bg-neutral-50 text-[10px] text-neutral-500 select-none uppercase tracking-wide">
      <span className="w-24 shrink-0">Date</span>
      <span className="w-40 shrink-0">Trade</span>
      <span className="w-28 shrink-0 text-right">Shares</span>
      <span className="w-28 shrink-0 text-right">Cash</span>
      <span className="w-32 shrink-0 text-right">NPV</span>
      <span className="w-24 shrink-0 text-right">Error</span>
    </div>
  )
}

// ─── EventLog ─────────────────────────────────────────────────────────────────

interface EventLogProps {
  events: SimEvent[]
}

export function EventLog({ events }: EventLogProps) {
  const [filter, setFilter] = useState<FilterValue>('ALL')
  const scrollRef = useRef<HTMLDivElement>(null)

  const reversed = [...events].reverse()
  const filtered = filter === 'ALL' ? reversed : reversed.filter((e) => e.kind === filter)

  // Counts for each option label
  const counts: Record<FilterValue, number> = {
    ALL:        events.length,
    REBALANCE:  events.filter((e) => e.kind === 'REBALANCE').length,
    PRICE_MOVE: events.filter((e) => e.kind === 'PRICE_MOVE').length,
  }

  const filterOptions: DropdownOption<FilterValue>[] = FILTER_OPTIONS.map((o) => ({
    value: o.value,
    label: `${o.label} (${counts[o.value]})`,
  }))

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [events.length])

  return (
    <div className="panel flex flex-col h-full">
      <div className="panel-header flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-neutral-700">Event Log</h3>
          <Dropdown
            options={filterOptions}
            value={filter}
            onChange={setFilter}
            ariaLabel="Filter events by kind"
          />
        </div>
      </div>

      <ColumnHeader filter={filter} />

      <div ref={scrollRef} className="overflow-y-auto flex-1 min-h-0">
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-xs text-neutral-400 text-center">
            {events.length === 0 ? 'Waiting for simulation…' : 'No events match this filter.'}
          </p>
        )}
        {filtered.map((evt) => <EventRow key={evt.id} evt={evt} filter={filter} />)}
      </div>
    </div>
  )
}

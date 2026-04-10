import { useEffect, useRef, useState } from 'react'
import { FACTOR_DEFS } from '../types'
import type { ResearchParams } from '../types'

interface Props {
  params: ResearchParams
  onApply: (p: ResearchParams) => void
}

// ── Inline dropdown (no clipping issues, portal-free) ─────────────────────────

interface InlineSelectProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}

function InlineSelect({ label, value, options, onChange }: InlineSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const display = options.find((o) => o.value === value)?.label ?? value

  return (
    <div ref={ref} className="relative flex items-center gap-1">
      <span className="text-[9px] text-ink-5b whitespace-nowrap">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-0.5 border-b border-ink-2d hover:border-ink-2b text-[12px] text-ink-2b transition-colors pr-4 py-0.5 relative min-w-[48px]"
      >
        <span>{display}</span>
        <svg className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-5b transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul className="absolute top-full left-0 mt-0.5 bg-paper-white border border-black-a10 shadow-lg z-[200] min-w-[100px] max-h-48 overflow-y-auto"
          style={{ marginLeft: label ? `${label.length * 7}px` : 0 }}>
          {options.map((o) => (
            <li key={o.value}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`px-3 py-1.5 text-[12px] cursor-pointer whitespace-nowrap hover:bg-black-a05 ${o.value === value ? 'font-semibold text-ink-2b bg-black-a05' : 'text-ink-2b'}`}>
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Pill group for freq / horizon ─────────────────────────────────────────────

function PillGroup<T extends string | number>({
  label, options, value, onChange,
}: {
  label: string
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-ink-5b uppercase tracking-wider shrink-0">{label}</span>
      <div className="flex gap-0.5">
        {options.map((o) => (
          <button
            key={String(o)}
            onClick={() => onChange(o)}
            className={`ap-pill ${value === o ? 'ap-pill-active' : 'ap-pill-inactive'}`}
          >
            {String(o)}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Factor selector ───────────────────────────────────────────────────────────

function FactorSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = FACTOR_DEFS.find((d) => d.id === value)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const CATEGORY_LABELS: Record<string, string> = {
    orderflow: 'Flow', microstructure: 'Micro', momentum: 'Mom', info: 'Info',
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 border-b border-ink-2d hover:border-ink-2b transition-colors py-0.5 pr-5 relative"
      >
        <span className="text-[13px] font-semibold text-ink-2b">{current?.label ?? value}</span>
        {current && (
          <span className="text-[9px] text-ink-5b border border-ink-2d px-1 py-px">
            {CATEGORY_LABELS[current.category]}
          </span>
        )}
        <svg className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-5b transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-paper-white border border-black-a10 shadow-lg z-[200] w-72">
          {(['orderflow', 'microstructure', 'momentum', 'info'] as const).map((cat) => {
            const defs = FACTOR_DEFS.filter((d) => d.category === cat)
            if (defs.length === 0) return null
            return (
              <div key={cat}>
                <div className="px-3 py-1 text-[9px] font-semibold text-ink-5b uppercase tracking-wider bg-black-a05 border-b border-black-a10">
                  {CATEGORY_LABELS[cat]}
                </div>
                {defs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => { onChange(d.id); setOpen(false) }}
                    className={`w-full text-left px-3 py-2 hover:bg-black-a05 transition-colors border-b border-black-a10 last:border-0 ${d.id === value ? 'bg-black-a05' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[12px] ${d.id === value ? 'font-semibold text-ink-2b' : 'text-ink-2b'}`}>{d.label}</span>
                      <span className="text-[9px] text-ink-5b">τ½ {d.typicalHalfLifeSec}s</span>
                    </div>
                    <p className="text-[10px] text-ink-5b mt-0.5 leading-tight">{d.description}</p>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Controls bar ──────────────────────────────────────────────────────────────

const FREQ_OPTIONS: ResearchParams['frequency'][] = ['100ms', '500ms', '1s', '5s', '10s', '30s', '1m']
const HORIZON_OPTIONS: ResearchParams['horizon'][] = [1, 2, 3, 5, 10, 20, 60]

export function ResearchControlsBar({ params, onApply }: Props) {
  function set<K extends keyof ResearchParams>(key: K, val: ResearchParams[K]) {
    onApply({ ...params, [key]: val })
  }

  return (
    <div className="shrink-0 relative z-[50] bg-paper-white border-b border-ink-2d">
      <div className="flex items-center gap-5 px-5 py-2 flex-wrap">

        {/* Factor */}
        <FactorSelector value={params.factorId} onChange={(id) => set('factorId', id)} />

        <div className="w-px h-4 bg-ink-2d shrink-0" />

        {/* Frequency */}
        <PillGroup
          label="Freq"
          options={FREQ_OPTIONS}
          value={params.frequency}
          onChange={(v) => set('frequency', v)}
        />

        <div className="w-px h-4 bg-ink-2d shrink-0" />

        {/* Horizon */}
        <PillGroup
          label="Horizon"
          options={HORIZON_OPTIONS}
          value={params.horizon}
          onChange={(v) => set('horizon', v)}
        />

        <div className="w-px h-4 bg-ink-2d shrink-0" />

        {/* Secondary params */}
        <InlineSelect label="Instr" value={params.instrument}
          options={[
            { value: 'btc-usdt', label: 'BTC-USDT' },
            { value: 'eth-usdt', label: 'ETH-USDT' },
            { value: 'aapl', label: 'AAPL' },
            { value: 'es-fut', label: 'ES Fut' },
            { value: 'custom', label: 'Custom' },
          ]}
          onChange={(v) => set('instrument', v as ResearchParams['instrument'])}
        />

        <InlineSelect label="Session" value={params.session}
          options={[
            { value: 'full', label: 'Full' },
            { value: 'open30', label: 'Open 30m' },
            { value: 'mid', label: 'Mid' },
            { value: 'close30', label: 'Close 30m' },
          ]}
          onChange={(v) => set('session', v as ResearchParams['session'])}
        />

        <InlineSelect label="Return" value={params.returnDef}
          options={[
            { value: 'mid', label: 'Mid' },
            { value: 'last', label: 'Last' },
            { value: 'weighted', label: 'VWAP' },
          ]}
          onChange={(v) => set('returnDef', v as ResearchParams['returnDef'])}
        />

        <InlineSelect label="Norm" value={params.normalization}
          options={[
            { value: 'rank', label: 'Rank' },
            { value: 'zscore', label: 'Z-score' },
            { value: 'robust', label: 'Robust' },
            { value: 'none', label: 'None' },
          ]}
          onChange={(v) => set('normalization', v as ResearchParams['normalization'])}
        />

        <InlineSelect label="Clip" value={params.winsorize}
          options={[
            { value: '3sigma', label: '3σ' },
            { value: '2sigma', label: '2σ' },
            { value: 'pct1', label: '1%–99%' },
            { value: 'none', label: 'None' },
          ]}
          onChange={(v) => set('winsorize', v as ResearchParams['winsorize'])}
        />

        <InlineSelect label="Cost" value={params.costModel}
          options={[
            { value: 'half-spread', label: '½ Spr' },
            { value: 'full-spread', label: 'Full Spr' },
            { value: 'zero', label: 'Zero' },
          ]}
          onChange={(v) => set('costModel', v as ResearchParams['costModel'])}
        />

      </div>
    </div>
  )
}

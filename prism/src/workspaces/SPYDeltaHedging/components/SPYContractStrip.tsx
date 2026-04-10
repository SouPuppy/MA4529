import { SPY_CONTRACT } from '../spyCsvLoader'

interface SlotProps { label: string; value: string }

function Slot({ label, value }: SlotProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 first:pl-0">
      <span className="text-[10px] text-neutral-400 leading-none">{label}</span>
      <span className="tabular-nums text-xs font-semibold text-neutral-900 leading-none">{value}</span>
    </div>
  )
}

interface SPYContractStripProps {
  totalRows: number
  ivolPct:   number   // current ivol from CSV
}

export function SPYContractStrip({ totalRows, ivolPct }: SPYContractStripProps) {
  const startDate  = new Date('2025-10-05T00:00:00Z')
  const endDate    = new Date('2026-04-07T00:00:00Z')
  const daysWindow = Math.round((endDate.getTime() - startDate.getTime()) / 86400_000)

  return (
    <div className="panel py-1.5 px-4">
      <div className="flex items-center gap-0">
        <div className="flex items-center divide-x divide-neutral-200">
          <Slot label="Underlying"  value="SPY US" />
          <Slot label="Type"        value="European Call" />
          <Slot label="Strike K"    value={`$${SPY_CONTRACT.strike}`} />
          <Slot label="Expiry"      value={SPY_CONTRACT.expiry} />
          <Slot label="Notional"    value={`${SPY_CONTRACT.notional} shares`} />
          <Slot label="σ (ivol)"    value={`${(ivolPct).toFixed(2)}%`} />
          <Slot label="r"           value={`${(SPY_CONTRACT.rate * 100).toFixed(1)}%`} />
          <Slot label="S₀"          value={`$${SPY_CONTRACT.S0}`} />
          <Slot label="Window"      value={`${daysWindow}d`} />
          <Slot label="Rows"        value={`${totalRows}`} />
        </div>

        <div className="ml-auto flex items-center gap-1.5 text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-emerald-600 font-semibold">CSV Live</span>
          <span className="text-neutral-300">·</span>
          <span className="text-neutral-400">Bloomberg σ · GBM path</span>
        </div>
      </div>
    </div>
  )
}

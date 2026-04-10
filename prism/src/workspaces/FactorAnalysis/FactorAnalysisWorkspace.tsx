import { useMemo, useState } from 'react'
import { DEFAULT_PARAMS, FACTOR_DEFS } from './types'
import type { ResearchParams } from './types'
import { buildFactorOutput } from './mock/factorEngine'
import { ResearchControlsBar } from './components/ResearchControlsBar'
import { ICTimeSeriesChart } from './components/ICTimeSeriesChart'
import { ICDecayChart } from './components/ICDecayChart'
import { QuantileReturnChart } from './components/QuantileReturnChart'
import { SignalACFChart } from './components/SignalACFChart'
import { ICDistributionChart } from './components/ICDistributionChart'
import { IntradayHeatmap } from './components/IntradayHeatmap'
import { SpreadSensitivityChart } from './components/SpreadSensitivityChart'
import { VolumeTierChart } from './components/VolumeTierChart'
import { LSReturnChart } from './components/LSReturnChart'
import { LatencyDegradationChart } from './components/LatencyDegradationChart'
import { ImplementationScorecard } from './components/ImplementationScorecard'
import { StatusBar } from './components/StatusBar'

function Section({ title }: { title: string }) {
  return (
    <div className="pt-1">
      <h2 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">{title}</h2>
    </div>
  )
}

function Panel({ title, children, className = '' }: {
  title: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-white border border-neutral-200 flex flex-col ${className}`}>
      <div className="px-3 py-1.5 border-b border-neutral-100 bg-neutral-50 shrink-0">
        <h3 className="text-[11px] font-semibold text-neutral-700">{title}</h3>
      </div>
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  )
}

const FREQ_MS: Record<ResearchParams['frequency'], number> = {
  '100ms': 100, '500ms': 500, '1s': 1000, '5s': 5000,
  '10s': 10000, '30s': 30000, '1m': 60000,
}

const COST_LABELS: Record<ResearchParams['costModel'], string> = {
  'zero': 'Zero cost', 'half-spread': '½ Spread', 'full-spread': 'Full Spread',
}

export function FactorAnalysisWorkspace() {
  const [params, setParams] = useState<ResearchParams>(DEFAULT_PARAMS)
  const output = useMemo(() => buildFactorOutput(params), [params])
  const factorLabel = FACTOR_DEFS.find((d) => d.id === params.factorId)?.label ?? params.factorId

  const dateRange: [string, string] = output.icTimeSeries.length > 0
    ? [output.icTimeSeries[0]!.date, output.icTimeSeries[output.icTimeSeries.length - 1]!.date]
    : ['—', '—']

  return (
    <div className="flex flex-col h-full min-h-0 bg-neutral-50">
      <ResearchControlsBar params={params} onApply={setParams} />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-5 py-3 space-y-3">

          {/* Predictive Evidence */}
          <Section title={`Predictive Evidence · ${factorLabel}`} />
          <div className="grid grid-cols-12 gap-2">

            <div className="col-span-7">
              <Panel title="IC Time Series · 5-Session MA">
                <ICTimeSeriesChart snapshots={output.icTimeSeries} height={196} />
              </Panel>
            </div>

            <div className="col-span-3">
              <Panel title="IC Decay">
                <ICDecayChart
                  data={output.icDecay}
                  halfLifeSec={output.diagnostics.halfLifeSec}
                  horizonMarkerSec={output.icDecayHorizonMarkerSec}
                  height={196}
                />
              </Panel>
            </div>

            <div className="col-span-2">
              <Panel title="Quintile Return">
                <QuantileReturnChart data={output.quantileReturns} height={196} />
              </Panel>
            </div>

            <div className="col-span-8">
              <Panel title="IC Distribution · Normal Q–Q">
                <ICDistributionChart icValues={output.icValues} height={160} />
              </Panel>
            </div>

            <div className="col-span-4">
              <Panel title="Signal ACF">
                <SignalACFChart data={output.signalACF} height={160} />
              </Panel>
            </div>

          </div>

          {/* Microstructure */}
          <Section title="Microstructure" />
          <div className="grid grid-cols-12 gap-2">

            <div className="col-span-6">
              <Panel title="Intraday IC Heatmap">
                <IntradayHeatmap data={output.intradayBuckets} height={210} />
              </Panel>
            </div>

            <div className="col-span-3">
              <Panel title="Spread Sensitivity">
                <SpreadSensitivityChart data={output.spreadSensitivity} height={210} />
              </Panel>
            </div>

            <div className="col-span-3">
              <Panel title="Volume Tier">
                <VolumeTierChart data={output.volumeTiers} height={210} />
              </Panel>
            </div>

          </div>

          {/* Implementation */}
          <Section title="Implementation" />
          <div className="grid grid-cols-12 gap-2 pb-4">

            <div className="col-span-7">
              <Panel title="L/S Cumulative Return">
                <LSReturnChart data={output.lsReturns} height={172} />
              </Panel>
            </div>

            <div className="col-span-3">
              <Panel title="Latency Degradation">
                <LatencyDegradationChart
                  data={output.latencyDegradation}
                  barFreqMs={FREQ_MS[params.frequency]}
                  height={172}
                />
              </Panel>
            </div>

            <div className="col-span-2">
              <ImplementationScorecard
                metrics={output.implMetrics}
                costModelLabel={COST_LABELS[params.costModel]}
              />
            </div>

          </div>

        </div>
      </div>

      <StatusBar
        params={params}
        diagnostics={output.diagnostics}
        sessionDays={output.icTimeSeries.length}
        dateRange={dateRange}
      />
    </div>
  )
}

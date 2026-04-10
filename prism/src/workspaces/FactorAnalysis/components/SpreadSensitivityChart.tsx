import { useMemo } from 'react'
import type { SpreadSensitivityPoint } from '../types'
import { VegaChart, vegaSpec } from './ui/VegaChart'

interface Props { data: SpreadSensitivityPoint[]; height?: number }

export function SpreadSensitivityChart({ data, height = 216 }: Props) {
  const overallMean = data.length ? data.reduce((s, d) => s + d.icMean, 0) / data.length : 0

  const spec = useMemo(() => vegaSpec({
    layer: [
      // Mean reference line
      {
        mark: { type: 'rule', color: '#7c3aed', strokeDash: [4, 3], opacity: 0.6, strokeWidth: 1 },
        encoding: { x: { datum: overallMean, type: 'quantitative' } },
      },
      // Bars
      {
        data: { values: data },
        mark: { type: 'bar', cornerRadius: 1.5 },
        encoding: {
          y: { field: 'spreadBpsLabel', type: 'nominal', sort: null, title: 'Spread (bps)',
               axis: { labelAngle: 0 } },
          x: { field: 'icMean', type: 'quantitative', title: 'IC Mean',
               axis: { format: '.3f', grid: true } },
          opacity: {
            field: 'sampleFrac', type: 'quantitative',
            scale: { domain: [0, 0.45], range: [0.3, 1.0] }, legend: null,
          },
          color: {
            condition: { test: 'datum.icMean >= 0', value: '#2563eb' },
            value: '#d4d4d4',
          },
          tooltip: [
            { field: 'spreadBpsLabel', title: 'Spread' },
            { field: 'icMean', title: 'IC Mean', format: '.4f' },
            { field: 'sampleFrac', title: 'Sample', format: '.0%' },
          ],
        },
      },
    ],
  }, height), [data, height, overallMean])

  return <VegaChart spec={spec} height={height} />
}

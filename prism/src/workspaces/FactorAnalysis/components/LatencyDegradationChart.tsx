import { useMemo } from 'react'
import type { LatencyPoint } from '../types'
import { VegaChart, vegaSpec } from './ui/VegaChart'

interface Props {
  data: LatencyPoint[]
  barFreqMs: number
  height?: number
}

export function LatencyDegradationChart({ data, barFreqMs, height = 172 }: Props) {
  const spec = useMemo(() => vegaSpec({
    encoding: {
      x: {
        field: 'delayMs', type: 'quantitative',
        scale: { type: 'log', domain: [0.8, 1100] },
        axis: { values: [1, 5, 10, 25, 50, 100, 250, 500, 1000], format: 'd', title: 'Delay (ms)' },
      },
    },
    layer: [
      // Area + line in one mark
      {
        data: { values: data },
        mark: { type: 'area', color: '#2563eb', opacity: 0.06,
                line: { color: '#2563eb', strokeWidth: 1.5 } },
        encoding: {
          y: { field: 'icFraction', type: 'quantitative', title: 'IC Retained',
               axis: { format: '.0%', grid: true } },
        },
      },
      // Data points with tooltip
      {
        data: { values: data },
        mark: { type: 'point', color: '#2563eb', filled: true, size: 32 },
        encoding: {
          y: { field: 'icFraction', type: 'quantitative' },
          tooltip: [
            { field: 'label', title: 'Delay' },
            { field: 'icFraction', title: 'IC Retained', format: '.1%' },
          ],
        },
      },
      // Bar frequency marker
      {
        mark: { type: 'rule', color: '#7c3aed', strokeDash: [5, 3], strokeWidth: 1.5, opacity: 0.8 },
        encoding: { x: { datum: barFreqMs, type: 'quantitative' } },
      },
    ],
  }, height), [data, barFreqMs, height])

  return <VegaChart spec={spec} height={height} />
}

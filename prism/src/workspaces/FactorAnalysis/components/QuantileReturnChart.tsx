import { useMemo } from 'react'
import type { QuantilePoint } from '../types'
import { VegaChart, vegaSpec } from './ui/VegaChart'

interface Props { data: QuantilePoint[]; height?: number }

export function QuantileReturnChart({ data, height = 196 }: Props) {
  const spec = useMemo(() => vegaSpec({
    data: { values: data },
    mark: { type: 'bar', cornerRadius: 1.5 },
    encoding: {
      x: { field: 'label', type: 'nominal', sort: null,
           axis: { labelAngle: 0, title: null } },
      y: { field: 'meanRetBps', type: 'quantitative', title: 'bps / bar',
           axis: { format: '.2f', grid: true } },
      color: {
        condition: { test: 'datum.meanRetBps >= 0', value: '#059669' },
        value: '#dc2626',
      },
      tooltip: [
        { field: 'label', title: 'Quintile' },
        { field: 'meanRetBps', title: 'Mean Ret (bps/bar)', format: '.3f' },
      ],
    },
  }, height), [data, height])

  return <VegaChart spec={spec} height={height} />
}

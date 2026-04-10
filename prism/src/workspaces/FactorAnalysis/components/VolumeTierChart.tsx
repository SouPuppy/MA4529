import { useMemo } from 'react'
import type { VolumeTierPoint } from '../types'
import { VegaChart, vegaSpec } from './ui/VegaChart'

interface Props { data: VolumeTierPoint[]; height?: number }

export function VolumeTierChart({ data, height = 216 }: Props) {
  const spec = useMemo(() => vegaSpec({
    data: { values: data },
    mark: { type: 'bar', cornerRadius: 1.5 },
    encoding: {
      x: { field: 'label', type: 'nominal', sort: null,
           axis: { labelAngle: -20, title: null, labelLimit: 80 } },
      y: { field: 'icMean', type: 'quantitative', title: 'IC Mean',
           axis: { format: '.3f', grid: true } },
      color: {
        field: 'icMean', type: 'quantitative',
        scale: { scheme: 'blues' }, legend: null,
      },
      tooltip: [
        { field: 'label', title: 'Volume Tier' },
        { field: 'icMean', title: 'IC Mean', format: '.4f' },
        { field: 'avgAdvLabel', title: 'Avg ADV' },
      ],
    },
  }, height), [data, height])

  return <VegaChart spec={spec} height={height} />
}

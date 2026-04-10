import { useMemo } from 'react'
import type { SignalACFPoint } from '../types'
import { VegaChart, vegaSpec } from './ui/VegaChart'

interface Props { data: SignalACFPoint[]; height?: number }

export function SignalACFChart({ data, height = 160 }: Props) {
  const ciUpper = data[0]?.ciUpper ?? 0.1

  const spec = useMemo(() => vegaSpec({
    layer: [
      // Significance band (full-width rect)
      {
        mark: { type: 'rect', color: '#7c3aed', opacity: 0.06 },
        encoding: {
          y: { datum: -ciUpper, type: 'quantitative' },
          y2: { datum: ciUpper },
        },
      },
      // Significance boundary lines
      {
        data: { values: [{ v: ciUpper }, { v: -ciUpper }] },
        mark: { type: 'rule', color: '#7c3aed', strokeDash: [4, 3], opacity: 0.7, strokeWidth: 1 },
        encoding: { y: { field: 'v', type: 'quantitative' } },
      },
      // ACF bars
      {
        data: { values: data },
        mark: { type: 'bar', width: { band: 0.65 } },
        encoding: {
          x: { field: 'lag', type: 'ordinal',
               axis: { labelAngle: 0, title: 'Lag (bars)', values: [1, 5, 10, 15, 20] } },
          y: { field: 'acf', type: 'quantitative', title: 'ACF',
               axis: { format: '.2f', grid: true } },
          color: {
            condition: { test: 'abs(datum.acf) > datum.ciUpper', value: '#2563eb' },
            value: '#d4d4d4',
          },
          opacity: {
            condition: { test: 'abs(datum.acf) > datum.ciUpper', value: 0.9 },
            value: 0.45,
          },
          tooltip: [
            { field: 'lag', title: 'Lag' },
            { field: 'acf', title: 'ACF', format: '.3f' },
          ],
        },
      },
    ],
  }, height), [data, height, ciUpper])

  return <VegaChart spec={spec} height={height} />
}

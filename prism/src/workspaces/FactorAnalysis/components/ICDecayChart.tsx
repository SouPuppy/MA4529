import { useMemo } from 'react'
import type { ICDecayPoint } from '../types'
import { VegaChart, vegaSpec } from './ui/VegaChart'

interface Props {
  data: ICDecayPoint[]
  halfLifeSec: number
  horizonMarkerSec?: number
  height?: number
}

export function ICDecayChart({ data, halfLifeSec, horizonMarkerSec, height = 196 }: Props) {
  const IC0 = data[0]?.icMean ?? 0.048
  const halfLifePoint = halfLifeSec * Math.LN2

  // Smooth theoretical reference curve
  const refData = useMemo(() => {
    const lags = [0.1, 0.15, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2, 3, 5, 7, 10, 15, 20, 30, 45, 60]
    return lags.map((l) => ({ lagSec: l, icRef: IC0 * Math.exp(-l / halfLifeSec) }))
  }, [IC0, halfLifeSec])

  const spec = useMemo(() => vegaSpec({
    // Shared x-axis encoding for all layers
    encoding: {
      x: {
        field: 'lagSec', type: 'quantitative',
        scale: { type: 'log', domain: [0.09, 65] },
        axis: { values: [0.1, 0.5, 1, 2, 5, 10, 30, 60], format: '.3~g', title: 'Lag (s)' },
      },
    },
    layer: [
      // Area fill
      {
        data: { values: data },
        mark: { type: 'area', color: '#2563eb', opacity: 0.06, line: false },
        encoding: { y: { field: 'icMean', type: 'quantitative' } },
      },
      // Theoretical reference (amber dashed)
      {
        data: { values: refData },
        mark: { type: 'line', color: '#d97706', strokeDash: [4, 3], opacity: 0.45, strokeWidth: 1 },
        encoding: { y: { field: 'icRef', type: 'quantitative' } },
      },
      // Main decay line
      {
        data: { values: data },
        mark: { type: 'line', color: '#2563eb', strokeWidth: 1.5 },
        encoding: { y: { field: 'icMean', type: 'quantitative' } },
      },
      // Data points (amber at τ½)
      {
        data: { values: data },
        mark: { type: 'point', filled: true },
        encoding: {
          y: { field: 'icMean', type: 'quantitative', title: 'IC Mean',
               axis: { format: '.3f', grid: true } },
          color: {
            condition: { test: 'datum.isHalfLife', value: '#d97706' },
            value: '#2563eb',
          },
          size: {
            condition: { test: 'datum.isHalfLife', value: 72 },
            value: 36,
          },
          tooltip: [
            { field: 'label', title: 'Lag' },
            { field: 'icMean', title: 'IC', format: '.4f' },
            { field: 'icir', title: 'ICIR', format: '.2f' },
            { field: 'isHalfLife', title: 'τ½ point' },
          ],
        },
      },
      // Half-life rule (amber dashed vertical)
      {
        mark: { type: 'rule', color: '#d97706', strokeDash: [3, 3], opacity: 0.5, strokeWidth: 1 },
        encoding: { x: { datum: halfLifePoint, type: 'quantitative' } },
      },
      // Horizon marker (purple)
      ...(horizonMarkerSec != null ? [{
        mark: { type: 'rule', color: '#7c3aed', strokeDash: [5, 3], strokeWidth: 1.5, opacity: 0.8 },
        encoding: { x: { datum: horizonMarkerSec, type: 'quantitative' } },
      }] : []),
    ],
  }, height), [data, refData, halfLifePoint, horizonMarkerSec, height])

  return <VegaChart spec={spec} height={height} />
}

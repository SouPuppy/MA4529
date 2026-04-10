import { useEffect, useMemo, useRef } from 'react'
import embed, { type VisualizationSpec } from 'vega-embed'
import {
  qqNormalPoints, gaussianKDE, linspace, histogramDensity,
  mean, sampleStd, skewness,
} from '../utils/icStats'

interface Props {
  /** Per-bar IC samples (300+). Use output.icValues, NOT session aggregates. */
  icValues: number[]
  height?: number
}

// Aperture NPG color palette
const HIST_BAR = '#4DBBD5'
const KDE_LINE = '#3C5488'
const QQ_POINT = '#3C5488'
const QQ_REF = '#E64B35'

/**
 * IC Distribution — histogram + KDE on left, Normal Q-Q plot on right.
 * Uses two side-by-side vega-embed views.
 * Pattern from ~/Projects/asro.cc/aperture/src/widgets/Chart/IcAnalysisPanel.tsx
 */
export function ICDistributionChart({ icValues, height = 200 }: Props) {
  const distRef = useRef<HTMLDivElement>(null)
  const qqRef = useRef<HTMLDivElement>(null)

  const stats = useMemo(() => {
    if (icValues.length < 2) return null
    return {
      mean: mean(icValues),
      std: sampleStd(icValues),
      skew: skewness(icValues),
    }
  }, [icValues])

  const distSpec = useMemo((): VisualizationSpec | null => {
    if (icValues.length < 5 || !stats) return null
    const bins = Math.max(12, Math.min(30, Math.ceil(Math.sqrt(icValues.length))))
    const hist = histogramDensity(icValues, bins)
    const minV = Math.min(...icValues)
    const maxV = Math.max(...icValues)
    const pad = (maxV - minV) * 0.12 || 0.05
    const lo = minV - pad, hi = maxV + pad
    const grid = linspace(lo, hi, 80)
    const kde = gaussianKDE(icValues, grid)
    const kdeRows = grid.map((x, i) => ({ x, density: kde[i]! }))
    const histMax = Math.max(0, ...hist.map((h) => h.density))
    const kdeMax = Math.max(0, ...kde)
    const yMax = Math.max(histMax, kdeMax) * 1.15 || 1e-6

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: 'container',
      height: height - 4,
      background: '#ffffff',
      autosize: { type: 'fit', contains: 'padding' },
      padding: { left: 6, right: 6, top: 4, bottom: 4 },
      layer: [
        {
          data: { values: hist },
          mark: { type: 'bar', color: HIST_BAR, opacity: 0.7 },
          encoding: {
            x: { field: 'x0', type: 'quantitative', scale: { domain: [lo, hi] }, title: 'IC value', axis: { labelFontSize: 9, titleFontSize: 9 } },
            x2: { field: 'x1' },
            y: { field: 'density', type: 'quantitative', title: 'Density', scale: { domain: [0, yMax] }, axis: { labelFontSize: 9, titleFontSize: 9 } },
          },
        },
        {
          data: { values: kdeRows },
          mark: { type: 'line', color: KDE_LINE, strokeWidth: 2 },
          encoding: {
            x: { field: 'x', type: 'quantitative', scale: { domain: [lo, hi] } },
            y: { field: 'density', type: 'quantitative', scale: { domain: [0, yMax] } },
          },
        },
        {
          mark: { type: 'rule', strokeDash: [5, 4], color: '#94a3b8', strokeWidth: 1 },
          encoding: { x: { datum: stats.mean, type: 'quantitative', scale: { domain: [lo, hi] } } },
        },
      ],
      config: {
        view: { stroke: 'rgba(0,0,0,0.08)' },
        axis: { gridColor: '#f4f4f5', labelColor: '#737373', titleColor: '#a3a3a3' },
      },
    } as VisualizationSpec
  }, [icValues, height, stats])

  const qqSpec = useMemo((): VisualizationSpec | null => {
    if (icValues.length < 5) return null
    const pts = qqNormalPoints(icValues)
    const t = pts.map((p) => p.theoretical)
    const o = pts.map((p) => p.observed)
    const lo = Math.min(...t, ...o)
    const hi = Math.max(...t, ...o)
    const pad = (hi - lo) * 0.06 || 0.02
    const domain: [number, number] = [lo - pad, hi + pad]

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: 'container',
      height: height - 4,
      background: '#ffffff',
      autosize: { type: 'fit', contains: 'padding' },
      padding: { left: 6, right: 6, top: 4, bottom: 4 },
      layer: [
        {
          data: { values: [{ x: domain[0], y: domain[0] }, { x: domain[1], y: domain[1] }] },
          mark: { type: 'line', color: QQ_REF, strokeWidth: 1.5 },
          encoding: {
            x: { field: 'x', type: 'quantitative', scale: { domain }, title: 'Normal quantile', axis: { labelFontSize: 9, titleFontSize: 9 } },
            y: { field: 'y', type: 'quantitative', scale: { domain }, title: 'Observed quantile', axis: { labelFontSize: 9, titleFontSize: 9 } },
          },
        },
        {
          data: { values: pts },
          mark: { type: 'circle', color: QQ_POINT, size: 28, opacity: 0.8 },
          encoding: {
            x: { field: 'theoretical', type: 'quantitative', scale: { domain } },
            y: { field: 'observed', type: 'quantitative', scale: { domain } },
          },
        },
      ],
      config: {
        view: { stroke: 'rgba(0,0,0,0.08)' },
        axis: { gridColor: '#f4f4f5', labelColor: '#737373', titleColor: '#a3a3a3' },
      },
    } as VisualizationSpec
  }, [icValues, height])

  useEffect(() => {
    const el = distRef.current
    if (!el || !distSpec) return
    let result: Awaited<ReturnType<typeof embed>> | undefined
    embed(el, distSpec, { actions: false, renderer: 'svg' }).then((r) => { result = r }).catch(() => {})
    return () => { if (result?.finalize) result.finalize(); el.innerHTML = '' }
  }, [distSpec])

  useEffect(() => {
    const el = qqRef.current
    if (!el || !qqSpec) return
    let result: Awaited<ReturnType<typeof embed>> | undefined
    embed(el, qqSpec, { actions: false, renderer: 'svg' }).then((r) => { result = r }).catch(() => {})
    return () => { if (result?.finalize) result.finalize(); el.innerHTML = '' }
  }, [qqSpec])

  return (
    <div className="flex h-full min-h-0">
      {/* Distribution */}
      <div className="flex-1 min-w-0 relative">
        {stats && (
          <div className="absolute top-1.5 right-2 z-10 text-[9px] text-neutral-500 tabular-nums leading-tight text-right pointer-events-none">
            <div>μ {stats.mean >= 0 ? '+' : ''}{stats.mean.toFixed(4)}</div>
            <div>σ {stats.std.toFixed(4)}</div>
            <div>skew {stats.skew.toFixed(2)}</div>
          </div>
        )}
        <div ref={distRef} className="w-full" style={{ height }} />
      </div>
      {/* Divider */}
      <div className="w-px bg-neutral-100 shrink-0" />
      {/* Q-Q */}
      <div className="flex-1 min-w-0">
        <div ref={qqRef} className="w-full" style={{ height }} />
      </div>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import {
  createChart,
  LineSeries,
  LineStyle,
  createSeriesMarkers,
} from 'lightweight-charts'
import type {
  IChartApi,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  SeriesType,
  Time,
} from 'lightweight-charts'
import type { EnhancedSnapshot } from '../types'
import { MULTIPLIER } from '../mock/hedgeEngine'

interface DeltaPathChartProps {
  snapshots: EnhancedSnapshot[]
  height?: number
}

/**
 * Two-series chart showing:
 *   Blue (solid)  — option delta Δt ∈ [0,1]
 *   Amber (dashed) — normalised hedge position φt / MULTIPLIER ∈ [0,1]
 *
 * Both series live on the same 0–1 scale, so the gap between them
 * is the instantaneous tracking error before the next rebalance.
 * Violet markers indicate rebalance events.
 */
export function DeltaPathChart({ snapshots, height = 220 }: DeltaPathChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const deltaSeriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null)
  const sharesSeriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#ffffff' },
        textColor: '#737373',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#f5f5f5' },
        horzLines: { color: '#f5f5f5' },
      },
      crosshair: {
        vertLine: { color: '#7c3aed', labelBackgroundColor: '#7c3aed' },
        horzLine: { color: '#7c3aed', labelBackgroundColor: '#7c3aed' },
      },
      rightPriceScale: {
        borderColor: '#e5e5e5',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#e5e5e5',
        timeVisible: true,
      },
      width: containerRef.current.clientWidth,
      height,
    })

    // Series 1: option delta Δt (blue solid)
    const deltaSeries = chart.addSeries(LineSeries, {
      color: '#2563eb',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Δt',
    })

    // Series 2: hedge position φt/100 (amber dashed)
    const sharesSeries = chart.addSeries(LineSeries, {
      color: '#d97706',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'φt/100',
    })

    deltaSeriesRef.current = deltaSeries
    sharesSeriesRef.current = sharesSeries
    markersRef.current = createSeriesMarkers(deltaSeries, [])
    chartRef.current = chart

    const onResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      chart.remove()
      chartRef.current = null
      deltaSeriesRef.current = null
      sharesSeriesRef.current = null
      markersRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  // Update data
  useEffect(() => {
    if (!deltaSeriesRef.current || !sharesSeriesRef.current || !markersRef.current) return
    if (snapshots.length === 0) return

    deltaSeriesRef.current.setData(
      snapshots.map((s) => ({ time: s.date as Time, value: s.greeks.delta })),
    )

    sharesSeriesRef.current.setData(
      snapshots.map((s) => ({ time: s.date as Time, value: s.sharesHeld / MULTIPLIER })),
    )

    // Violet circle markers at rebalance steps
    markersRef.current.setMarkers(
      snapshots
        .filter((s) => s.hedgeTrade !== undefined)
        .map((s) => ({
          time: s.date as Time,
          position: 'inBar' as const,
          shape: 'circle' as const,
          color: '#7c3aed',
          size: 1,
        })),
    )
  }, [snapshots])

  return (
    <div className="relative w-full bg-white border border-neutral-200">
      {/* Legend */}
      <div className="absolute top-2 left-3 z-10 flex items-center gap-4 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-0.5 bg-blue-600" />
          <span className="text-neutral-600">Δ<sub>t</sub> option delta</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 border-t border-dashed border-amber-500" />
          <span className="text-neutral-600">φ<sub>t</sub>/100 hedge ratio</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-violet-600" />
          <span className="text-neutral-600">rebalance</span>
        </span>
      </div>
      <div ref={containerRef} style={{ height }} />
    </div>
  )
}

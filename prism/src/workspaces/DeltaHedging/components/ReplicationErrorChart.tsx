import { useEffect, useRef } from 'react'
import {
  createChart,
  BaselineSeries,
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

interface ReplicationErrorChartProps {
  snapshots: EnhancedSnapshot[]
  height?: number
}

/**
 * Baseline chart showing the replication error εt = (φt·St + Bt) − Vt·100.
 *
 * Green fill above zero (over-replication), red fill below (under-replication).
 * A second dashed series shows cumulative transaction costs.
 * Orange markers indicate rebalance events where error is corrected.
 *
 * This is the theoretically most important chart: it directly answers
 * "why can't discrete hedging perfectly replicate continuous time theory?"
 */
export function ReplicationErrorChart({ snapshots, height = 180 }: ReplicationErrorChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const errorSeriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null)
  const cumulSeriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null)
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
        vertLine: { color: '#ea580c', labelBackgroundColor: '#ea580c' },
        horzLine: { color: '#ea580c', labelBackgroundColor: '#ea580c' },
      },
      rightPriceScale: {
        borderColor: '#e5e5e5',
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      timeScale: {
        borderColor: '#e5e5e5',
        timeVisible: true,
      },
      width: containerRef.current.clientWidth,
      height,
    })

    // Primary: replication error with green/red baseline fill
    const errorSeries = chart.addSeries(BaselineSeries, {
      baseValue: { type: 'price', price: 0 },
      topLineColor: '#059669',
      topFillColor1: 'rgba(5, 150, 105, 0.20)',
      topFillColor2: 'rgba(5, 150, 105, 0.02)',
      bottomLineColor: '#dc2626',
      bottomFillColor1: 'rgba(220, 38, 38, 0.02)',
      bottomFillColor2: 'rgba(220, 38, 38, 0.20)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'εt',
    })

    // Secondary: cumulative transaction costs (gray dashed)
    const cumulSeries = chart.addSeries(LineSeries, {
      color: '#a3a3a3',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'Cumul. Cost',
    })

    errorSeriesRef.current = errorSeries
    cumulSeriesRef.current = cumulSeries
    markersRef.current = createSeriesMarkers(errorSeries, [])
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
      errorSeriesRef.current = null
      cumulSeriesRef.current = null
      markersRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  // Update data
  useEffect(() => {
    if (!errorSeriesRef.current || !cumulSeriesRef.current || !markersRef.current) return
    if (snapshots.length === 0) return

    errorSeriesRef.current.setData(
      snapshots.map((s) => ({ time: s.date as Time, value: s.replicationError })),
    )

    cumulSeriesRef.current.setData(
      snapshots.map((s) => ({ time: s.date as Time, value: s.cumulativeCost })),
    )

    // Rebalance markers (reload symbol)
    markersRef.current.setMarkers(
      snapshots
        .filter((s) => s.hedgeTrade !== undefined)
        .map((s) => ({
          time: s.date as Time,
          position: 'inBar' as const,
          shape: 'square' as const,
          color: '#ea580c'
        })),
    )
  }, [snapshots])

  return (
    <div className="relative w-full bg-white border border-neutral-200">
      {/* Legend */}
      <div className="absolute top-2 left-3 z-10 flex items-center gap-4 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-500" />
          <span className="text-neutral-600">εt &gt; 0 (over-replicated)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-100 border border-red-500" />
          <span className="text-neutral-600">εt &lt; 0 (under-replicated)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 border-t border-dashed border-neutral-400" />
          <span className="text-neutral-600">Cumul. Cost</span>
        </span>
      </div>
      <div ref={containerRef} style={{ height }} />
    </div>
  )
}

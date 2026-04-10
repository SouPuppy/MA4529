import { useEffect, useRef } from 'react'
import { createChart, LineSeries } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts'

interface PnLPoint {
  date: string
  pnl: number
}

interface PnLChartProps {
  data: PnLPoint[]
  height?: number
  autoFollow?: boolean
  onVisibleRangeChange?: (range: { from: number; to: number } | null) => void
  syncVisibleRange?: { from: number; to: number } | null
}

export function PnLChart({
  data,
  height = 180,
  autoFollow = true,
  onVisibleRangeChange,
  syncVisibleRange,
}: PnLChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null)
  const isSyncingRef = useRef(false)

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
        vertLine: { color: '#0d9488', labelBackgroundColor: '#0d9488' },
        horzLine: { color: '#0d9488', labelBackgroundColor: '#0d9488' },
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

    const series = chart.addSeries(LineSeries, {
      color: '#0d9488',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    })

    chartRef.current = chart
    seriesRef.current = series

    // Listen to visible range changes
    if (onVisibleRangeChange) {
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (!isSyncingRef.current && range) {
          onVisibleRangeChange({ from: range.from, to: range.to })
        }
      })
    }

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
      seriesRef.current = null
    }
  }, [height, onVisibleRangeChange])

  // Update data
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || data.length === 0) return
    const chartData = data.map((d) => ({ time: d.date as Time, value: d.pnl }))
    seriesRef.current.setData(chartData)

    // Only auto-fit if autoFollow is enabled
    if (autoFollow) {
      chartRef.current.timeScale().fitContent()
    }
  }, [data, autoFollow])

  // Sync visible range from external source
  useEffect(() => {
    if (!chartRef.current || !syncVisibleRange) return

    isSyncingRef.current = true
    chartRef.current.timeScale().setVisibleLogicalRange({
      from: syncVisibleRange.from,
      to: syncVisibleRange.to,
    })
    isSyncingRef.current = false
  }, [syncVisibleRange])

  return <div ref={containerRef} style={{ height }} />
}

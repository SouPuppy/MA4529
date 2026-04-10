import { useEffect, useRef } from 'react'
import {
  createChart,
  LineSeries,
  createSeriesMarkers,
} from 'lightweight-charts'
import type {
  IChartApi,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  SeriesMarkerBar,
  SeriesType,
  Time,
} from 'lightweight-charts'

export interface PricePoint {
  time: string
  value: number
}

export interface TradeMark {
  time: string
  side: 'buy' | 'sell'
  qty: number
  price: number
}

interface LineChartPanelProps {
  priceData: PricePoint[]
  trades: TradeMark[]
  height?: number
  autoFollow?: boolean
}

export function LineChartPanel({
  priceData,
  trades,
  height = 400,
  autoFollow = true,
}: LineChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)

  // ── Create chart once ──────────────────────────────────────────────────────
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
        vertLine: { color: '#2563eb', labelBackgroundColor: '#2563eb' },
        horzLine: { color: '#2563eb', labelBackgroundColor: '#2563eb' },
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

    const priceSeries = chart.addSeries(LineSeries, {
      color: '#2563eb',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    })

    seriesRef.current = priceSeries
    markersRef.current = createSeriesMarkers(priceSeries, [])
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
      seriesRef.current = null
      markersRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  // ── Update price data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || priceData.length === 0) return
    seriesRef.current.setData(priceData)

    // Only auto-fit if autoFollow is enabled
    if (autoFollow) {
      chartRef.current.timeScale().fitContent()
    }
  }, [priceData, autoFollow])

  // ── Update markers ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!markersRef.current) return
    const markers: SeriesMarkerBar<Time>[] = trades.map((t) => ({
      time: t.time as Time,
      position: t.side === 'buy' ? 'belowBar' : 'aboveBar',
      shape: t.side === 'buy' ? 'arrowUp' : 'arrowDown',
      color: t.side === 'buy' ? '#10b981' : '#dc2626',
      text: `${t.side === 'buy' ? 'Buy' : 'Sell'} @ ${t.price.toFixed(2)}`,
    }))
    markersRef.current.setMarkers(markers)
  }, [trades])

  return (
    <div className="w-full bg-white border border-neutral-200">
      <div ref={containerRef} style={{ height }} />
    </div>
  )
}

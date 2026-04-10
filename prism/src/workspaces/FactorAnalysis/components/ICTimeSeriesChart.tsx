import { useEffect, useRef } from 'react'
import {
  createChart,
  LineSeries,
  LineStyle,
} from 'lightweight-charts'
import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts'
import type { ICDailySnapshot } from '../types'

interface Props {
  snapshots: ICDailySnapshot[]
  height?: number
}

export function ICTimeSeriesChart({ snapshots, height = 196 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const icRef = useRef<ISeriesApi<SeriesType, Time> | null>(null)
  const maRef = useRef<ISeriesApi<SeriesType, Time> | null>(null)

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
        vertLine: { color: '#d4d4d4', labelBackgroundColor: '#525252' },
        horzLine: { color: '#d4d4d4', labelBackgroundColor: '#525252' },
      },
      rightPriceScale: {
        borderColor: '#e5e5e5',
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: { borderColor: '#e5e5e5', timeVisible: true },
      width: containerRef.current.clientWidth,
      height,
    })

    // IC line — thin, neutral
    const icSeries = chart.addSeries(LineSeries, {
      color: '#2563eb',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'IC',
    })

    // Rolling mean — amber, slightly thicker
    const maSeries = chart.addSeries(LineSeries, {
      color: '#d97706',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'MA5',
    })

    icRef.current = icSeries
    maRef.current = maSeries
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
      icRef.current = null
      maRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  useEffect(() => {
    if (!icRef.current || !maRef.current || !chartRef.current) return
    if (snapshots.length === 0) return

    icRef.current.setData(snapshots.map((s) => ({ time: s.date as Time, value: s.ic })))

    // 5-session MA — skip first 4 points
    maRef.current.setData(
      snapshots
        .filter((_, i) => i >= 4)
        .map((s) => ({ time: s.date as Time, value: s.rollingMean })),
    )

    // Zero reference line
    icRef.current.createPriceLine({
      price: 0,
      color: '#d4d4d4',
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      title: '',
      axisLabelVisible: false,
    })

    chartRef.current.timeScale().fitContent()
  }, [snapshots])

  return (
    <div className="w-full bg-white">
      <div className="flex items-center gap-4 px-3 pt-2 pb-0.5 text-[10px] text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t border-blue-500" />
          IC
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t-2 border-amber-500" />
          5-session MA
        </span>
      </div>
      <div ref={containerRef} style={{ height }} />
    </div>
  )
}

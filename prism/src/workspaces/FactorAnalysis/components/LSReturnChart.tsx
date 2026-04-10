import { useEffect, useRef } from 'react'
import { createChart, BaselineSeries } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts'

interface LSReturnChartProps {
  data: { time: string; value: number }[]
  height?: number
}

/**
 * L/S cumulative return using BaselineSeries at 0:
 *   - Green fill above zero: factor P&L accruing
 *   - Red fill below zero: factor in drawdown
 * Uses LC built-in baseline feature — more informative than plain line chart.
 */
export function LSReturnChart({ data, height = 200 }: LSReturnChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null)

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
        vertLine: { color: '#059669', labelBackgroundColor: '#059669' },
        horzLine: { color: '#059669', labelBackgroundColor: '#059669' },
      },
      rightPriceScale: {
        borderColor: '#e5e5e5',
        scaleMargins: { top: 0.1, bottom: 0.1 },
        // Format as percentage
        mode: 0,
      },
      timeScale: { borderColor: '#e5e5e5', timeVisible: true },
      width: containerRef.current.clientWidth,
      height,
    })

    seriesRef.current = chart.addSeries(BaselineSeries, {
      baseValue: { type: 'price', price: 0 },
      topLineColor: '#059669',
      topFillColor1: 'rgba(5, 150, 105, 0.20)',
      topFillColor2: 'rgba(5, 150, 105, 0.03)',
      bottomLineColor: '#dc2626',
      bottomFillColor1: 'rgba(220, 38, 38, 0.03)',
      bottomFillColor2: 'rgba(220, 38, 38, 0.20)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'L/S bps',
    })

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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || data.length === 0) return
    seriesRef.current.setData(data.map((d) => ({ time: d.time as Time, value: d.value })))
    chartRef.current.timeScale().fitContent()
  }, [data])

  return (
    <div className="w-full bg-white border border-neutral-200">
      <div className="flex items-center gap-4 px-3 pt-2 pb-0.5 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-500" />
          <span className="text-neutral-500">Positive return</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-100 border border-red-500" />
          <span className="text-neutral-500">Drawdown</span>
        </span>
      </div>
      <div ref={containerRef} style={{ height }} />
    </div>
  )
}

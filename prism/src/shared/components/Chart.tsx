import { useEffect, useRef } from 'react'
import { createChart, CandlestickSeries, type IChartApi } from 'lightweight-charts'

const candleData = [
  { time: '2025-02-01', open: 100, high: 105, low: 98, close: 103 },
  { time: '2025-02-02', open: 103, high: 108, low: 101, close: 106 },
  { time: '2025-02-03', open: 106, high: 110, low: 104, close: 107 },
  { time: '2025-02-04', open: 107, high: 112, low: 105, close: 109 },
  { time: '2025-02-05', open: 109, high: 115, low: 108, close: 113 },
  { time: '2025-02-06', open: 113, high: 118, low: 111, close: 116 },
  { time: '2025-02-07', open: 116, high: 120, low: 114, close: 117 },
  { time: '2025-02-08', open: 117, high: 122, low: 115, close: 119 },
  { time: '2025-02-09', open: 119, high: 124, low: 117, close: 121 },
  { time: '2025-02-10', open: 121, high: 126, low: 119, close: 123 },
]

export function Chart() {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

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
      width: containerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#e5e5e5',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
    })

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#059669',
      downColor: '#dc2626',
      borderVisible: false,
      wickUpColor: '#059669',
      wickDownColor: '#dc2626',
    })

    candlestickSeries.setData(candleData)
    chart.timeScale().fitContent()

    chartRef.current = chart

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
    }
  }, [])

  return (
    <div className="w-full border border-neutral-200 bg-white">
      <div ref={containerRef} className="w-full h-[400px]" />
    </div>
  )
}

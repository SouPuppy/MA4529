import { useEffect, useRef } from 'react'
import embed from 'vega-embed'
import type { IntradayBucket } from '../types'

interface Props {
  data: IntradayBucket[]
  height?: number
}

/**
 * Intraday IC heatmap — 30-min time buckets on y-axis, session-days on x-axis.
 * Reveals time-of-day effects: when is the factor most predictive during the session?
 * Rendered with vega-embed (declarative spec, diverging color scale).
 */
export function IntradayHeatmap({ data, height = 220 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: 'container' as const,
      height: height - 8,
      autosize: { type: 'fit' as const, contains: 'padding' as const },
      padding: { left: 4, right: 4, top: 4, bottom: 4 },
      background: '#ffffff',
      config: {
        axis: {
          gridColor: '#f5f5f5',
          domainColor: '#e5e5e5',
          tickColor: '#e5e5e5',
          labelFont: 'system-ui, sans-serif',
          labelFontSize: 9,
          titleFontSize: 9,
          titleColor: '#a3a3a3',
          labelColor: '#737373',
        },
        view: { stroke: null },
      },
      data: { values: data },
      mark: {
        type: 'rect' as const,
        stroke: '#ffffff',
        strokeWidth: 1,
      },
      encoding: {
        x: {
          field: 'day',
          type: 'ordinal' as const,
          title: 'Session',
          axis: {
            labelAngle: -40,
            labelFontSize: 8,
          },
        },
        y: {
          field: 'bucketLabel',
          type: 'ordinal' as const,
          title: 'Time of Day',
          sort: null as unknown as undefined,
        },
        color: {
          field: 'icMean',
          type: 'quantitative' as const,
          scale: {
            scheme: 'blueorange',
            domainMid: 0,
          },
          legend: {
            title: 'IC',
            titleFontSize: 9,
            labelFontSize: 8,
            orient: 'right',
            gradientLength: 80,
          },
        },
        tooltip: [
          { field: 'day', title: 'Date' },
          { field: 'bucketLabel', title: 'Time' },
          { field: 'icMean', title: 'IC Mean', format: '.4f' },
          { field: 'sampleCount', title: 'N Bars', format: ',.0f' },
        ],
      },
    }

    let view: { finalize: () => void } | null = null
    embed(containerRef.current, spec, { actions: false, renderer: 'svg' as const })
      .then((result) => { view = result.view })
      .catch(() => {})

    return () => { view?.finalize() }
  }, [data, height])

  return <div ref={containerRef} className="w-full" style={{ minHeight: height }} />
}

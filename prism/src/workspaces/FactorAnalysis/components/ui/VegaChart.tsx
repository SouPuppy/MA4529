import { useEffect, useRef } from 'react'
import embed, { type VisualizationSpec } from 'vega-embed'

/** Shared axis/view config — applied to all Vega charts in this workspace. */
export const V_CONFIG = {
  view: { stroke: null },
  axis: {
    gridColor: '#f4f4f5',
    gridWidth: 0.75,
    domainColor: '#e5e5e5',
    tickColor: '#e5e5e5',
    labelColor: '#737373',
    titleColor: '#a3a3a3',
    labelFontSize: 9,
    titleFontSize: 9,
    labelFont: 'system-ui, -apple-system, sans-serif',
    titleFont: 'system-ui, -apple-system, sans-serif',
  },
  bar: { cornerRadius: 1.5 },
  point: { size: 36, filled: true },
  line: { strokeWidth: 1.5 },
  area: { opacity: 0.07 },
}

/** Wraps any spec with the shared base options. */
export function vegaSpec(inner: object, height: number): VisualizationSpec {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: 'container',
    height,
    background: '#ffffff',
    autosize: { type: 'fit', contains: 'padding' },
    padding: { left: 4, right: 4, top: 2, bottom: 4 },
    config: V_CONFIG,
    ...inner,
  } as VisualizationSpec
}

interface Props {
  spec: VisualizationSpec
  height: number
}

/**
 * Renders a Vega-Lite spec inside a responsive container.
 * Re-embeds whenever `spec` reference changes.
 */
export function VegaChart({ spec, height }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let result: Awaited<ReturnType<typeof embed>> | undefined
    embed(el, spec, { actions: false, renderer: 'svg' })
      .then((r) => { result = r })
      .catch(() => {})
    return () => {
      result?.finalize()
      if (el) el.innerHTML = ''
    }
  }, [spec])

  return <div ref={ref} className="w-full" style={{ minHeight: height }} />
}

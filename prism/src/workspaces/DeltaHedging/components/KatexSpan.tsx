import { useEffect, useRef } from 'react'
import katex from 'katex'

interface KatexSpanProps {
  formula: string
  displayMode?: boolean
  className?: string
}

/**
 * Renders a KaTeX formula inside a <span>.
 * Uses useEffect with [formula, displayMode] deps — static formula strings
 * (the common case here) only render once on mount, never on re-renders.
 */
export function KatexSpan({ formula, displayMode = false, className }: KatexSpanProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!ref.current) return
    katex.render(formula, ref.current, {
      throwOnError: false,
      displayMode,
    })
  }, [formula, displayMode])

  return <span ref={ref} className={className} />
}

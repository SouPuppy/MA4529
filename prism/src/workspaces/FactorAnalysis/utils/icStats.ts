/**
 * Statistical helpers for IC distribution analysis.
 * Math copied from ~/Projects/asro.cc/aperture/src/widgets/Chart/icAnalysis.ts
 */

export interface HistogramBin {
  x0: number
  x1: number
  xc: number
  density: number
}

// Rational approximation of the normal quantile function (Beasley-Springer-Moro)
function invNorm(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [0, -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239]
  const b = [0, -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const pLow = 0.02425
  const pHigh = 1 - pLow
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0]!*q+c[1]!)*q+c[2]!)*q+c[3]!)*q+c[4]!)*q+c[5]!) /
           ((((d[0]!*q+d[1]!)*q+d[2]!)*q+d[3]!)*q+1)
  } else if (p <= pHigh) {
    const q = p - 0.5
    const r = q * q
    return (((((a[1]!*r+a[2]!)*r+a[3]!)*r+a[4]!)*r+a[5]!)*r+a[6]!)*q /
           (((((b[1]!*r+b[2]!)*r+b[3]!)*r+b[4]!)*r+b[5]!)*r+1)
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0]!*q+c[1]!)*q+c[2]!)*q+c[3]!)*q+c[4]!)*q+c[5]!) /
            ((((d[0]!*q+d[1]!)*q+d[2]!)*q+d[3]!)*q+1)
  }
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function sampleStd(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const m = mean(values)
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1))
}

export function skewness(values: number[]): number {
  const n = values.length
  if (n < 3) return 0
  const m = mean(values)
  const s = sampleStd(values) || 1e-9
  return values.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0) / n
}

export function qqNormalPoints(values: number[]): { theoretical: number; observed: number }[] {
  if (values.length === 0) return []
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const mu = mean(values)
  const sd = sampleStd(values) || 1e-9
  return sorted.map((obs, i) => {
    const p = (i + 0.375) / (n + 0.25)
    return { theoretical: mu + sd * invNorm(p), observed: obs }
  })
}

export function gaussianKDE(samples: number[], xs: number[]): number[] {
  const n = samples.length
  if (n === 0) return xs.map(() => 0)
  const m = mean(samples)
  let v = 0
  for (const s of samples) { const d = s - m; v += d * d }
  const sd = Math.sqrt(v / Math.max(1, n - 1)) || Math.abs(m) * 0.1 || 0.1
  const h = 1.06 * sd * Math.pow(n, -0.2)
  const inv = 1 / (n * h * Math.sqrt(2 * Math.PI))
  return xs.map((x) => {
    let sum = 0
    for (const xi of samples) { const u = (x - xi) / h; sum += Math.exp(-0.5 * u * u) }
    return sum * inv
  })
}

export function linspace(a: number, b: number, count: number): number[] {
  if (count < 2) return [a]
  const out: number[] = []
  const step = (b - a) / (count - 1)
  for (let i = 0; i < count; i++) out.push(a + step * i)
  return out
}

export function histogramDensity(values: number[], binCount: number): HistogramBin[] {
  if (values.length === 0 || binCount < 1) return []
  let min = Infinity, max = -Infinity
  for (const v of values) { if (v < min) min = v; if (v > max) max = v }
  const span = max - min || Math.abs(max) * 0.1 || 0.1
  const width = span / binCount
  const counts = new Array<number>(binCount).fill(0)
  for (const v of values) {
    let i = Math.floor((v - min) / width)
    if (i >= binCount) i = binCount - 1
    if (i < 0) i = 0
    counts[i]!++
  }
  const n = values.length
  return counts.map((c, i) => {
    const x0 = min + i * width
    const x1 = min + (i + 1) * width
    return { x0, x1, xc: (x0 + x1) / 2, density: c / (n * width) }
  })
}

export { mean, sampleStd }

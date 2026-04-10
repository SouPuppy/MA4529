import { useMemo } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { EnhancedSnapshot } from '../../DeltaHedging/types'

interface SPYGreeksChartProps {
  snapshots: EnhancedSnapshot[]
  height?: number
}

export function SPYGreeksChart({ snapshots, height = 280 }: SPYGreeksChartProps) {
  const data = useMemo(() => {
    return snapshots.map((s, idx) => ({
      idx,
      delta: s.greeks.delta,
      gamma: s.greeks.gamma * 100,  // scale for visibility
      theta: s.greeks.theta,
      vega: s.greeks.vega / 10,     // scale for visibility
    }))
  }, [snapshots])

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="text-xs font-semibold text-neutral-700">Greeks Time Series</h3>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <XAxis
            dataKey="idx"
            tick={{ fontSize: 10, fill: '#a3a3a3' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e5e5' }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#a3a3a3' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e5e5' }}
            width={40}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              backgroundColor: 'rgba(255,255,255,0.95)',
              border: '1px solid #e5e5e5',
              borderRadius: 4,
            }}
            formatter={(value: number, name: string) => {
              if (name === 'gamma') return [(value / 100).toFixed(5), 'Γ']
              if (name === 'vega') return [(value * 10).toFixed(2), 'ν']
              if (name === 'theta') return [value.toFixed(2), 'Θ']
              if (name === 'delta') return [value.toFixed(4), 'Δ']
              return [value, name]
            }}
          />
          <Line
            type="monotone"
            dataKey="delta"
            stroke="#2563eb"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="gamma"
            stroke="#7c3aed"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="theta"
            stroke="#ea580c"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="vega"
            stroke="#0d9488"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

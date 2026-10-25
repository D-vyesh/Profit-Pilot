import { useEffect } from 'react'
import { LineSeries, type Time } from 'lightweight-charts'
import type { BacktestPayload } from '../types'
import { useChart } from '../lib/chart'
import { tsToSeconds } from '../lib/format'

const TERMS: Array<{ key: 'reward_ret' | 'reward_cost' | 'reward_risk' | 'reward_vol'; label: string; color: string }> = [
  { key: 'reward_ret', label: 'return', color: '#34d399' },
  { key: 'reward_cost', label: 'cost penalty', color: '#f43f5e' },
  { key: 'reward_risk', label: 'risk penalty', color: '#fbbf24' },
  { key: 'reward_vol', label: 'volatility bonus', color: '#a78bfa' },
]

/** Cumulative reward split into its weighted components. */
export default function RewardBreakdownChart({ run, height = 220 }: { run: BacktestPayload; height?: number }) {
  const { containerRef, chartRef } = useChart()

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const { ts } = run.series
    const series: ReturnType<typeof chart.addSeries>[] = []

    for (const term of TERMS) {
      const values = run.series[term.key]
      if (!values || values.every((v) => v === 0)) continue
      const cumulative: number[] = []
      let acc = 0
      for (const v of values) {
        acc += v
        cumulative.push(acc)
      }
      const line = chart.addSeries(LineSeries, {
        color: term.color,
        lineWidth: term.key === 'reward_ret' ? 2 : 1,
        priceLineVisible: false,
      })
      line.setData(ts.map((s, i) => ({ time: tsToSeconds(s) as Time, value: cumulative[i] })))
      series.push(line)
    }

    chart.timeScale().fitContent()
    return () => {
      series.forEach((s) => chart.removeSeries(s))
    }
  }, [run, chartRef])

  const active = TERMS.filter((t) => {
    const values = run.series[t.key]
    return values && !values.every((v) => v === 0)
  })

  return (
    <div className="relative px-1">
      <div ref={containerRef} style={{ height }} />
      <div className="pointer-events-none absolute top-2 left-4 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        {active.map((term) => (
          <span key={term.key} className="flex items-center gap-1.5">
            <span className="h-[3px] w-4 rounded-full" style={{ background: term.color }} />
            {term.label}
          </span>
        ))}
      </div>
    </div>
  )
}

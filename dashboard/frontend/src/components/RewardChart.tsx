import { useEffect } from 'react'
import { AreaSeries, type Time } from 'lightweight-charts'
import type { BacktestPayload } from '../types'
import { useChart } from '../lib/chart'
import { tsToSeconds } from '../lib/format'

/** Cumulative reward — the actual optimization objective. */
export default function RewardChart({ run, height = 160 }: { run: BacktestPayload; height?: number }) {
  const { containerRef, chartRef } = useChart()

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const { ts, reward } = run.series
    const cumulative: number[] = []
    let acc = 0
    for (const r of reward) {
      acc += r
      cumulative.push(acc)
    }

    const rewardSeries = chart.addSeries(AreaSeries, {
      lineColor: '#34d399',
      topColor: 'rgba(52, 211, 153, 0.22)',
      bottomColor: 'rgba(52, 211, 153, 0.02)',
      lineWidth: 2,
      priceLineVisible: false,
    })
    rewardSeries.setData(ts.map((s, i) => ({ time: tsToSeconds(s) as Time, value: cumulative[i] })))

    chart.timeScale().fitContent()
    return () => {
      chart.removeSeries(rewardSeries)
    }
  }, [run, chartRef])

  return (
    <div className="relative px-1">
      <div ref={containerRef} style={{ height }} />
      <div className="pointer-events-none absolute top-2 left-4 text-[11px] text-slate-400">
        cumulative reward · total {run.metrics.agent.total_reward?.toFixed(3) ?? '—'}
      </div>
    </div>
  )
}

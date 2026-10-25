import { useEffect } from 'react'
import { AreaSeries, LineSeries, type Time } from 'lightweight-charts'
import type { BacktestPayload } from '../types'
import { useChart } from '../lib/chart'
import { tsToSeconds } from '../lib/format'

/** Drawdown (inverted area, red) + rolling volatility (line, violet). */
export default function RiskChart({ run, height = 180 }: { run: BacktestPayload; height?: number }) {
  const { containerRef, chartRef } = useChart()

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const { ts, drawdown, volatility } = run.series
    const ddSeries = chart.addSeries(AreaSeries, {
      lineColor: '#f43f5e',
      topColor: 'rgba(244, 63, 94, 0.25)',
      bottomColor: 'rgba(244, 63, 94, 0.02)',
      lineWidth: 1,
      priceLineVisible: false,
    })
    ddSeries.setData(ts.map((s, i) => ({ time: tsToSeconds(s) as Time, value: -drawdown[i] * 100 })))

    const volSeries = chart.addSeries(LineSeries, {
      color: 'rgba(192, 132, 252, 0.8)',
      lineWidth: 1,
      priceLineVisible: false,
    })
    volSeries.setData(ts.map((s, i) => ({ time: tsToSeconds(s) as Time, value: volatility[i] * 100 })))

    chart.timeScale().fitContent()
    return () => {
      chart.removeSeries(ddSeries)
      chart.removeSeries(volSeries)
    }
  }, [run, chartRef])

  return (
    <div className="relative px-1">
      <div ref={containerRef} style={{ height }} />
      <div className="pointer-events-none absolute top-2 left-4 flex items-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full bg-rose-500" /> drawdown %
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full bg-violet-400" /> rolling volatility %
        </span>
      </div>
    </div>
  )
}

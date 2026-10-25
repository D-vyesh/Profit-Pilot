import { useEffect } from 'react'
import { AreaSeries, type ISeriesApi, type Time } from 'lightweight-charts'
import type { BacktestPayload } from '../types'
import { useChart } from '../lib/chart'
import { tsToSeconds } from '../lib/format'

const POSITION_COLORS = ['#818cf8', '#c084f252']

/** Stacked per-symbol position value over the episode (cash is the gap to the portfolio line). */
export default function AllocationChart({ run, height = 200 }: { run: BacktestPayload; height?: number }) {
  const { containerRef, chartRef } = useChart()

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const { ts, portfolio, positions } = run.series
    const series: ISeriesApi<'Area'>[] = []

    // topmost series draws the portfolio value; each position series stacks below it
    const totalSeries = chart.addSeries(AreaSeries, {
      lineColor: 'transparent',
      topColor: 'transparent',
      bottomColor: 'transparent',
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    totalSeries.setData(ts.map((s, i) => ({ time: tsToSeconds(s) as Time, value: portfolio[i] })))
    series.push(totalSeries)

    run.symbols.forEach((_, idx) => {
      const color = POSITION_COLORS[idx % POSITION_COLORS.length]
      const posSeries = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: color,
        bottomColor: 'transparent',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
      const cumulative = ts.map(
        (_, i) => positions.slice(0, idx + 1).reduce((acc, p) => acc + p[i], 0),
      )
      posSeries.setData(ts.map((s, i) => ({ time: tsToSeconds(s) as Time, value: cumulative[i] })))
      series.push(posSeries)
    })

    chart.applyOptions({ timeScale: { visible: false } })
    chart.timeScale().fitContent()
    return () => {
      series.forEach((s) => chart.removeSeries(s))
    }
  }, [run, chartRef])

  return (
    <div className="relative px-1">
      <div ref={containerRef} style={{ height }} />
      <div className="pointer-events-none absolute top-1 left-4 flex items-center gap-3 text-[11px] text-slate-400">
        {run.symbols.map((symbol, idx) => (
          <span key={symbol} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-[2px]"
              style={{ background: POSITION_COLORS[idx % POSITION_COLORS.length] }}
            />
            {symbol.replace('/USDT', '')}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px] bg-slate-600" /> cash
        </span>
      </div>
    </div>
  )
}

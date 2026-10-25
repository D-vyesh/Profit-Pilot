import { useEffect } from 'react'
import { AreaSeries, LineSeries, createSeriesMarkers, type SeriesMarker, type Time } from 'lightweight-charts'
import type { BacktestPayload } from '../types'
import { useChart } from '../lib/chart'
import { tsToSeconds } from '../lib/format'

/** Agent equity vs equal-weight benchmark, with a risk-halt marker if the episode stopped early. */
export default function EquityChart({ run, height = 320 }: { run: BacktestPayload; height?: number }) {
  const { containerRef, chartRef } = useChart()

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const { ts, portfolio, benchmark } = run.series
    const agentSeries = chart.addSeries(AreaSeries, {
      lineColor: '#818cf8',
      topColor: 'rgba(129, 140, 248, 0.28)',
      bottomColor: 'rgba(129, 140, 248, 0.01)',
      lineWidth: 2,
      priceLineVisible: false,
    })
    const benchSeries = chart.addSeries(LineSeries, {
      color: 'rgba(148, 163, 184, 0.55)',
      lineWidth: 1,
      lineStyle: 2, // dotted
      priceLineVisible: false,
    })

    agentSeries.setData(ts.map((s, i) => ({ time: tsToSeconds(s) as Time, value: portfolio[i] })))
    benchSeries.setData(ts.map((s, i) => ({ time: tsToSeconds(s) as Time, value: benchmark[i] })))

    let markersApi: ReturnType<typeof createSeriesMarkers<Time>> | null = null
    if (run.metrics.agent.risk_halted && ts.length > 0) {
      const markers: SeriesMarker<Time>[] = [
        {
          time: tsToSeconds(ts[ts.length - 1]) as Time,
          position: 'aboveBar',
          color: '#ef4444',
          shape: 'arrowDown',
          text: 'risk halt',
        },
      ]
      markersApi = createSeriesMarkers(agentSeries, markers)
    }

    chart.timeScale().fitContent()
    return () => {
      markersApi?.detach()
      chart.removeSeries(agentSeries)
      chart.removeSeries(benchSeries)
    }
  }, [run, chartRef])

  return (
    <div className="relative px-1">
      <div ref={containerRef} style={{ height }} />
      <div className="pointer-events-none absolute top-2 left-4 flex items-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full bg-indigo-400" /> Agent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full bg-slate-500" style={{ borderTop: '1px dashed #94a3b8' }} />
          Equal-weight BTC+ETH
        </span>
      </div>
    </div>
  )
}

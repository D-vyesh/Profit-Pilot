import { useEffect, useState } from 'react'
import { CandlestickSeries, createSeriesMarkers, type SeriesMarker, type Time } from 'lightweight-charts'
import type { BacktestPayload, CandlePayload } from '../types'
import { useChart } from '../lib/chart'
import { tsToSeconds } from '../lib/format'

const UP = '#22c55e'
const DOWN = '#ef4444'

/** Candlestick chart for one symbol with agent buy/sell markers from the backtest. */
export default function PriceChart({
  candles,
  run,
  symbolIndex,
  symbol,
  height = 300,
}: {
  candles: CandlePayload | null
  run: BacktestPayload | null
  symbolIndex: number
  symbol: string
  height?: number
}) {
  const { containerRef, chartRef } = useChart()
  const [showMarkers, setShowMarkers] = useState(true)

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !candles) return

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
    })
    candleSeries.setData(
      candles.time.map((time, i) => ({
        time: time as Time,
        open: candles.open[i],
        high: candles.high[i],
        low: candles.low[i],
        close: candles.close[i],
      })),
    )

    let markersApi: ReturnType<typeof createSeriesMarkers<Time>> | null = null
    if (run && showMarkers) {
      const markers: SeriesMarker<Time>[] = run.markers
        .filter((m) => m.s === symbolIndex)
        .map((m) => ({
          time: tsToSeconds(m.ts) as Time,
          position: m.side === 'buy' ? 'belowBar' : 'aboveBar',
          color: m.side === 'buy' ? '#22c55e' : '#f43f5e',
          shape: m.side === 'buy' ? 'arrowUp' : 'arrowDown',
          text: m.count > 1 ? `${m.count}×` : undefined,
        }))
      if (markers.length > 0) markersApi = createSeriesMarkers(candleSeries, markers)
    }

    chart.timeScale().fitContent()
    return () => {
      markersApi?.detach()
      chart.removeSeries(candleSeries)
    }
  }, [candles, run, symbolIndex, showMarkers, chartRef])

  return (
    <div className="relative px-1">
      <div ref={containerRef} style={{ height }} />
      <div className="pointer-events-none absolute top-2 left-4 flex items-center gap-3 text-[11px]">
        <span className="font-semibold text-slate-300">{symbol}</span>
        <span className="text-slate-500">
          {candles
            ? `${candles.stride === 1 ? candles.timeframe : `${candles.timeframe} ×${candles.stride}`} candles`
            : 'loading…'}
        </span>
      </div>
      <label className="absolute top-1.5 right-4 z-10 flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-400">
        <input
          type="checkbox"
          checked={showMarkers}
          onChange={(e) => setShowMarkers(e.target.checked)}
          className="h-3 w-3 accent-indigo-400"
        />
        trades
      </label>
    </div>
  )
}

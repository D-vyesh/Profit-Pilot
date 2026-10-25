import { useEffect, useRef } from 'react'
import { createChart, type IChartApi, type DeepPartial, type ChartOptions } from 'lightweight-charts'

export const darkChartOptions: DeepPartial<ChartOptions> = {
  layout: {
    background: { color: 'transparent' },
    textColor: '#8ea0b8',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    fontSize: 11,
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: 'rgba(148, 163, 184, 0.05)' },
    horzLines: { color: 'rgba(148, 163, 184, 0.07)' },
  },
  rightPriceScale: {
    borderColor: 'rgba(148, 163, 184, 0.12)',
    scaleMargins: { top: 0.12, bottom: 0.08 },
  },
  timeScale: {
    borderColor: 'rgba(148, 163, 184, 0.12)',
    timeVisible: true,
    secondsVisible: false,
    rightOffset: 4,
  },
  crosshair: {
    vertLine: { color: 'rgba(129, 140, 248, 0.4)', labelBackgroundColor: '#1e293b' },
    horzLine: { color: 'rgba(129, 140, 248, 0.4)', labelBackgroundColor: '#1e293b' },
  },
}

/** Creates a chart that auto-resizes with its container; returns a ref holder. */
export function useChart(options: DeepPartial<ChartOptions> = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      ...darkChartOptions,
      ...options,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      autoSize: true,
    })
    chartRef.current = chart
    return () => {
      chart.remove()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { containerRef, chartRef }
}

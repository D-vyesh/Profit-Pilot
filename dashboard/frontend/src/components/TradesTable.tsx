import { useMemo, useState } from 'react'
import type { BacktestPayload } from '../types'
import { pnlColor, usd, num, shortTs } from '../lib/format'
import { Badge } from './ui'

const PAGE_SIZE = 60

const REASON_TONE: Record<string, 'slate' | 'red' | 'amber' | 'violet'> = {
  agent: 'slate',
  'stop-loss': 'red',
  'risk-halt': 'red',
  'position-cap': 'amber',
}

export default function TradesTable({ run }: { run: BacktestPayload }) {
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell' | 'stop-loss'>('all')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (filter === 'all') return run.trades
    if (filter === 'stop-loss') return run.trades.filter((t) => t.reason === 'stop-loss')
    return run.trades.filter((t) => t.side === filter)
  }, [run, filter])

  const nPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe = Math.min(page, nPages - 1)
  const rows = filtered.slice(pageSafe * PAGE_SIZE, (pageSafe + 1) * PAGE_SIZE)

  const tabs: Array<{ key: typeof filter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: run.trades.length },
    { key: 'buy', label: 'Buys', count: run.trades.filter((t) => t.side === 'buy').length },
    { key: 'sell', label: 'Sells', count: run.trades.filter((t) => t.side === 'sell').length },
    { key: 'stop-loss', label: 'Stop-loss', count: run.trades.filter((t) => t.reason === 'stop-loss').length },
  ]

  return (
    <div className="pb-3">
      <div className="flex items-center gap-1.5 px-4 pt-3 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setFilter(tab.key)
              setPage(0)
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              filter === tab.key
                ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/40'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label} <span className="tabular opacity-70">{tab.count.toLocaleString()}</span>
          </button>
        ))}
      </div>
      <div className="max-h-[380px] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#0d1425] text-[11px] tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-2 py-2 font-medium">Symbol</th>
              <th className="px-2 py-2 font-medium">Side</th>
              <th className="px-2 py-2 text-right font-medium">Price</th>
              <th className="px-2 py-2 text-right font-medium">Qty</th>
              <th className="px-2 py-2 text-right font-medium">Value</th>
              <th className="px-2 py-2 text-right font-medium">Fee</th>
              <th className="px-2 py-2 text-right font-medium">Realized P&L</th>
              <th className="px-4 py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-white/5">
            {rows.map((trade, i) => (
              <tr key={`${trade.t}-${trade.s}-${i}`} className="hover:bg-white/[0.03]">
                <td className="px-4 py-1.5 whitespace-nowrap text-slate-400">{shortTs(trade.ts)}</td>
                <td className="px-2 py-1.5 font-medium text-slate-200">
                  {run.symbols[trade.s].replace('/USDT', '')}
                </td>
                <td className="px-2 py-1.5">
                  <span className={trade.side === 'buy' ? 'font-semibold text-emerald-400' : 'font-semibold text-red-400'}>
                    {trade.side.toUpperCase()}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right text-slate-300">{usd(trade.price, 2)}</td>
                <td className="px-2 py-1.5 text-right text-slate-400">{num(trade.qty, 6)}</td>
                <td className="px-2 py-1.5 text-right text-slate-300">{usd(trade.value, 2)}</td>
                <td className="px-2 py-1.5 text-right text-slate-500">{usd(trade.fee, 2)}</td>
                <td className={`px-2 py-1.5 text-right font-semibold ${pnlColor(trade.pnl)}`}>
                  {trade.pnl == null ? '—' : usd(trade.pnl, 2)}
                </td>
                <td className="px-4 py-1.5">
                  {trade.reason !== 'agent' && <Badge tone={REASON_TONE[trade.reason]}>{trade.reason}</Badge>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No trades match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {nPages > 1 && (
        <div className="flex items-center justify-between px-4 pt-2 text-xs text-slate-500">
          <span className="tabular">
            {pageSafe * PAGE_SIZE + 1}–{Math.min((pageSafe + 1) * PAGE_SIZE, filtered.length)} of{' '}
            {filtered.length.toLocaleString()}
          </span>
          <span className="flex gap-1.5">
            <button
              type="button"
              disabled={pageSafe === 0}
              onClick={() => setPage(pageSafe - 1)}
              className="rounded px-2 py-1 text-slate-300 hover:bg-white/10 disabled:text-slate-600"
            >
              ← prev
            </button>
            <button
              type="button"
              disabled={pageSafe >= nPages - 1}
              onClick={() => setPage(pageSafe + 1)}
              className="rounded px-2 py-1 text-slate-300 hover:bg-white/10 disabled:text-slate-600"
            >
              next →
            </button>
          </span>
        </div>
      )}
    </div>
  )
}

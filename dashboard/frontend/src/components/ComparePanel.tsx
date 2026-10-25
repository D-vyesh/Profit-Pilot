import type { Run } from '../types'
import { pnlColor, pct, num, usd } from '../lib/format'

export default function ComparePanel({
  runs,
  activeRunId,
  onSelect,
  onRemove,
}: {
  runs: Run[]
  activeRunId: string
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}) {
  const sorted = [...runs].sort(
    (a, b) => a.payload.metrics.agent.total_return_pct - b.payload.metrics.agent.total_return_pct,
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead className="text-[11px] tracking-wide text-slate-500 uppercase">
          <tr className="border-b border-white/5">
            <th className="px-4 py-2 font-medium">Run</th>
            <th className="px-2 py-2 text-right font-medium">Return</th>
            <th className="px-2 py-2 text-right font-medium">Alpha</th>
            <th className="px-2 py-2 text-right font-medium">Sharpe</th>
            <th className="px-2 py-2 text-right font-medium">Max DD</th>
            <th className="px-2 py-2 text-right font-medium">Final value</th>
            <th className="px-2 py-2 text-right font-medium">Reward</th>
            <th className="px-2 py-2 text-right font-medium">Trades</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody className="tabular divide-y divide-white/5">
          {sorted.map((run) => {
            const m = run.payload.metrics.agent
            const active = run.id === activeRunId
            return (
              <tr
                key={run.id}
                onClick={() => onSelect(run.id)}
                className={`cursor-pointer transition-colors ${
                  active ? 'bg-indigo-500/10' : 'hover:bg-white/[0.03]'
                }`}
              >
                <td className="max-w-[260px] truncate px-4 py-2 font-medium text-slate-200" title={run.label}>
                  {active && <span className="mr-1.5 text-indigo-400">●</span>}
                  {run.label}
                </td>
                <td className={`px-2 py-2 text-right font-semibold ${pnlColor(m.total_return_pct)}`}>
                  {pct(m.total_return_pct)}
                </td>
                <td className={`px-2 py-2 text-right ${pnlColor(m.alpha_vs_benchmark_pct)}`}>
                  {pct(m.alpha_vs_benchmark_pct ?? 0)}
                </td>
                <td className="px-2 py-2 text-right text-slate-300">{num(m.sharpe)}</td>
                <td className="px-2 py-2 text-right text-rose-400">{m.max_drawdown_pct.toFixed(2)}%</td>
                <td className="px-2 py-2 text-right text-slate-300">{usd(m.final_value, 0)}</td>
                <td className="px-2 py-2 text-right text-emerald-400">{num(m.total_reward ?? 0, 1)}</td>
                <td className="px-2 py-2 text-right text-slate-400">{(m.trade_events ?? 0).toLocaleString()}</td>
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    title="Remove run"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(run.id)
                    }}
                    className="rounded px-1.5 text-slate-500 hover:bg-red-500/15 hover:text-red-400"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

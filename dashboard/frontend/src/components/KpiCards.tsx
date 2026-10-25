import type { StrategyMetrics } from '../types'
import { pnlColor, pct, usd, num } from '../lib/format'

function Kpi({
  label,
  value,
  sub,
  color = 'text-slate-100',
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="panel panel-hover px-3.5 py-3 transition-colors">
      <div className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{label}</div>
      <div className={`tabular mt-1 text-lg font-bold ${color}`}>{value}</div>
      {sub && <div className="tabular mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

export default function KpiCards({ agent, benchmark }: { agent: StrategyMetrics; benchmark: StrategyMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      <Kpi
        label="Final value"
        value={usd(agent.final_value, 2)}
        sub={`from ${usd(agent.initial_value)}`}
        color={agent.final_value >= agent.initial_value ? 'text-emerald-400' : 'text-red-400'}
      />
      <Kpi
        label="Total return"
        value={pct(agent.total_return_pct)}
        sub={`benchmark ${pct(benchmark.total_return_pct)}`}
        color={pnlColor(agent.total_return_pct)}
      />
      <Kpi
        label="Alpha vs bench"
        value={pct(agent.alpha_vs_benchmark_pct ?? 0)}
        sub="agent − equal-weight"
        color={pnlColor(agent.alpha_vs_benchmark_pct)}
      />
      <Kpi
        label="Max drawdown"
        value={`${agent.max_drawdown_pct.toFixed(2)}%`}
        sub={`benchmark ${benchmark.max_drawdown_pct.toFixed(2)}%`}
        color="text-rose-400"
      />
      <div className="col-span-2 sm:col-span-1">
        <Kpi label="Sharpe" value={num(agent.sharpe)} sub={`sortino ${num(agent.sortino)}`} />
      </div>
      <div className="col-span-2 sm:col-span-2 lg:col-span-1">
        <Kpi
          label="Trades"
          value={num(agent.trade_events ?? 0, 0)}
          sub={`${usd(agent.total_fees ?? 0, 2)} fees · ${agent.risk_halted ? 'risk-halted ⚠' : 'no halt'}`}
        />
      </div>
    </div>
  )
}

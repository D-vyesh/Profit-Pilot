import { useState } from 'react'
import type { EnvParams } from '../types'
import { Badge, Button } from './ui'
import RewardModeSection from './RewardModeSection'

interface SliderSpec {
  key: keyof EnvParams
  label: string
  min: number
  max: number
  step: number
  format: (v: number) => string
  hint?: string
}

const REWARD_SLIDERS: SliderSpec[] = [
  {
    key: 'cost_penalty_weight',
    label: 'Cost penalty w',
    min: 0,
    max: 10,
    step: 0.1,
    format: (v) => v.toFixed(1),
    hint: 'penalty on trading fees',
  },
  {
    key: 'risk_penalty_weight',
    label: 'Risk penalty w',
    min: 0,
    max: 0.5,
    step: 0.005,
    format: (v) => v.toFixed(3),
    hint: 'penalty on drawdown',
  },
  {
    key: 'volatility_reward_weight',
    label: 'Volatility reward w',
    min: 0,
    max: 0.2,
    step: 0.001,
    format: (v) => v.toFixed(3),
    hint: 'risk-adjusted return bonus (volatility mode only)',
  },
]

const RISK_SLIDERS: SliderSpec[] = [
  {
    key: 'stop_loss_pct',
    label: 'Stop-loss',
    min: 0.01,
    max: 0.5,
    step: 0.005,
    format: (v) => `${(v * 100).toFixed(1)}%`,
  },
  {
    key: 'max_drawdown_pct',
    label: 'Max drawdown halt',
    min: 0.05,
    max: 0.9,
    step: 0.01,
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
  {
    key: 'max_position_fraction',
    label: 'Max position',
    min: 0.05,
    max: 1,
    step: 0.05,
    format: (v) => `${(v * 100).toFixed(0)}% of portfolio`,
  },
  {
    key: 'max_trade_fraction',
    label: 'Max trade size',
    min: 0.01,
    max: 1,
    step: 0.01,
    format: (v) => `${(v * 100).toFixed(0)}% of portfolio`,
  },
  {
    key: 'cooldown_steps',
    label: 'Cooldown after sell',
    min: 0,
    max: 200,
    step: 1,
    format: (v) => `${v} bars`,
  },
]

export default function ParamsPanel({
  params,
  onChange,
  defaults,
  onRun,
  onReset,
  running,
}: {
  params: EnvParams
  onChange: (p: EnvParams) => void
  defaults: EnvParams
  onRun: () => void
  onReset: () => void
  running: boolean
}) {
  const [advanced, setAdvanced] = useState(false)
  const set = (patch: Partial<EnvParams>) => onChange({ ...params, ...patch })

  const dirtyKeys = (Object.keys(params) as Array<keyof EnvParams>).filter(
    (k) => params[k] !== defaults[k],
  )

  const slider = (spec: SliderSpec) => (
    <div key={spec.key} className="px-4 py-2">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-medium text-slate-300">{spec.label}</label>
        <span className="tabular text-xs font-semibold text-indigo-300">{spec.format(params[spec.key] as number)}</span>
      </div>
      <input
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={params[spec.key] as number}
        onChange={(e) => set({ [spec.key]: parseFloat(e.target.value) } as Partial<EnvParams>)}
        className="mt-1.5"
      />
      {spec.hint && <p className="mt-0.5 text-[10px] text-slate-500">{spec.hint}</p>}
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
        <h3 className="text-[13px] font-semibold tracking-wide text-slate-200 uppercase">Reward engineering</h3>
        {dirtyKeys.length > 0 && <Badge tone="amber">{dirtyKeys.length} changed</Badge>}
      </div>

      <RewardModeSection params={params} onChange={onChange} />

      <div className="border-t border-white/5 px-4 py-2">
        <div className="flex items-baseline justify-between">
          <label className="text-xs font-medium text-slate-300">Reward scaling</label>
          <span className="tabular text-xs font-semibold text-indigo-300">
            {(params.reward_scaling as number).toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={0.1}
          value={params.reward_scaling as number}
          onChange={(e) => set({ reward_scaling: parseFloat(e.target.value) })}
          className="mt-1.5"
        />
        <p className="mt-0.5 text-[10px] text-slate-500">global multiplier on the reward</p>
      </div>

      {REWARD_SLIDERS.map(slider)}

      <button
        type="button"
        onClick={() => setAdvanced((a) => !a)}
        className="mt-1 w-full px-4 py-2 text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase hover:text-slate-300"
      >
        {advanced ? '▾' : '▸'} Risk &amp; execution limits
      </button>

      {advanced && (
        <div className="border-t border-white/5">
          {RISK_SLIDERS.map(slider)}
          <div className="grid grid-cols-2 gap-2 px-4 py-2">
            <div>
              <label className="text-xs font-medium text-slate-300">Buy fee</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={params.buy_cost_pct}
                onChange={(e) => set({ buy_cost_pct: parseFloat(e.target.value) || 0 })}
                className="tabular mt-1 w-full"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300">Sell fee</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={params.sell_cost_pct}
                onChange={(e) => set({ sell_cost_pct: parseFloat(e.target.value) || 0 })}
                className="tabular mt-1 w-full"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 px-4 pt-1 pb-3">
            <div>
              <label className="text-xs font-medium text-slate-300">Volatility window</label>
              <input
                type="number"
                step="1"
                min="2"
                value={params.volatility_window}
                onChange={(e) => set({ volatility_window: parseInt(e.target.value) || 2 })}
                className="tabular mt-1 w-full"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300">Initial cash $</label>
              <input
                type="number"
                step="1000"
                min="100"
                value={params.initial_cash}
                onChange={(e) => set({ initial_cash: parseFloat(e.target.value) || 100 })}
                className="tabular mt-1 w-full"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-t border-white/5 px-4 py-3">
        <Button variant="accent" onClick={onRun} disabled={running} className="flex-1">
          {running ? 'Running…' : '▶ Run backtest'}
        </Button>
        <Button variant="ghost" onClick={onReset} disabled={running} title="Reset to training defaults">
          Reset
        </Button>
      </div>
    </div>
  )
}

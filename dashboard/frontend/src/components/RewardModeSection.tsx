import type { EnvParams } from '../types'

const MODES: Array<{
  key: EnvParams['reward_mode']
  title: string
  tag: string
  terms: Array<{ text: string; tone: 'pos' | 'neg' | 'accent' }>
  desc: string
}> = [
  {
    key: 'return_cost_risk',
    title: 'Simple',
    tag: 'return − cost − risk',
    terms: [
      { text: 'portfolio return', tone: 'pos' },
      { text: '− cost_penalty_weight · fees', tone: 'neg' },
      { text: '− risk_penalty_weight · drawdown', tone: 'neg' },
    ],
    desc: 'Plain profit objective with penalties for fees and drawdown.',
  },
  {
    key: 'return_cost_risk_volatility',
    title: 'Volatility-added',
    tag: 'return − cost − risk + risk-adjusted bonus',
    terms: [
      { text: 'portfolio return', tone: 'pos' },
      { text: '− cost_penalty_weight · fees', tone: 'neg' },
      { text: '− risk_penalty_weight · drawdown', tone: 'neg' },
      { text: '+ volatility_reward_weight · tanh(return / vol)', tone: 'accent' },
    ],
    desc: 'Adds a risk-adjusted return bonus — rewards smooth gains over volatile ones.',
  },
]

const TONE_CLASS = {
  pos: 'text-emerald-300',
  neg: 'text-red-300',
  accent: 'text-violet-300',
}

export default function RewardModeSection({
  params,
  onChange,
}: {
  params: EnvParams
  onChange: (p: EnvParams) => void
}) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-2 px-4 pt-3 pb-2">
        {MODES.map((mode) => {
          const selected = params.reward_mode === mode.key
          return (
            <button
              key={mode.key}
              type="button"
              onClick={() => onChange({ ...params, reward_mode: mode.key })}
              className={`rounded-xl border p-3 text-left transition-all ${
                selected
                  ? 'border-indigo-400/60 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[13px] font-bold ${selected ? 'text-indigo-300' : 'text-slate-200'}`}>
                  {mode.title}
                </span>
                {selected && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white">
                    ✓
                  </span>
                )}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-slate-500">{mode.tag}</div>
              <div className="mt-2 space-y-0.5">
                {mode.terms.map((term) => (
                  <div key={term.text} className={`font-mono text-[11px] ${TONE_CLASS[term.tone]}`}>
                    {term.text}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{mode.desc}</p>
            </button>
          )
        })}
      </div>
      <p className="px-4 pb-2 text-[10px] text-slate-600">
        Weighted terms per step · total reward = Σ (terms × reward_scaling)
      </p>
    </div>
  )
}

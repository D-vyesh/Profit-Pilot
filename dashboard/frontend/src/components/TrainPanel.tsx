import { useEffect, useRef, useState } from 'react'
import type { Catalog, EnvParams, ModelInfo, TrainJob } from '../types'
import { pollTraining, startTraining } from '../api'
import { Badge, Button, Spinner } from './ui'
import { pct, pnlColor } from '../lib/format'

const TIMESTEP_PRESETS = [10_000, 25_000, 50_000, 100_000]

const ALGOS = [
  { key: 'ppo', label: 'PPO', hint: 'feed-forward MLP (256×256)' },
  { key: 'recurrent_ppo', label: 'RecurrentPPO', hint: 'LSTM policy — memory of past bars' },
] as const

export default function TrainPanel({
  catalog,
  currentModel,
  currentDatasetId,
  params,
  onJobDone,
}: {
  catalog: Catalog
  currentModel: ModelInfo
  currentDatasetId: string
  params: EnvParams
  onJobDone: (job: TrainJob) => void
}) {
  const [job, setJob] = useState<TrainJob | null>(null)
  const [timesteps, setTimesteps] = useState(25_000)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)

  const trainingDatasets = catalog.datasets.filter((d) => d.kind === 'train' || d.kind === 'eval')
  const evalDatasets = catalog.datasets.filter((d) => d.kind !== 'train')

  // '' means "same as the base model"
  const [algoSelection, setAlgoSelection] = useState<string>('')
  const [trainDatasetId, setTrainDatasetId] = useState('')
  const [valDatasetId, setValDatasetId] = useState('')
  const [testDatasetId, setTestDatasetId] = useState('')

  useEffect(() => {
    if (!trainDatasetId) {
      const preferred =
        trainingDatasets.find((d) => d.timeframe === currentModel.timeframe && d.id.includes('colab')) ??
        trainingDatasets.find((d) => d.timeframe === currentModel.timeframe) ??
        trainingDatasets[0]
      if (preferred) setTrainDatasetId(preferred.id)
    }
    if (!valDatasetId) {
      const preferred =
        evalDatasets.find((d) => d.timeframe === currentModel.timeframe && d.id.includes('forward')) ??
        evalDatasets.find((d) => d.timeframe === currentModel.timeframe && d.id.includes('test')) ??
        evalDatasets.find((d) => d.timeframe === currentModel.timeframe)
      if (preferred) setValDatasetId(preferred.id)
    }
    if (!testDatasetId) setTestDatasetId(currentDatasetId)
  }, [catalog, trainingDatasets, evalDatasets, trainDatasetId, valDatasetId, testDatasetId, currentDatasetId, currentModel.timeframe])

  // poll while the job runs
  useEffect(() => {
    if (!job || job.status === 'done' || job.status === 'error') return
    const timer = setInterval(async () => {
      try {
        const updated = await pollTraining(job.id)
        setJob(updated)
        if (updated.status === 'done') onJobDone(updated)
      } catch {
        /* transient poll failure — keep trying */
      }
    }, 2500)
    return () => clearInterval(timer)
  }, [job, onJobDone])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [job?.log])

  const busy = job?.status === 'running' || job?.status === 'queued'
  const effectiveAlgo = algoSelection || currentModel.algo
  const mode = algoSelection === '' || algoSelection === currentModel.algo ? 'fine-tune' : 'train from scratch'

  const launch = async () => {
    setError(null)
    try {
      const started = await startTraining({
        base_model_id: currentModel.id,
        algo: algoSelection,
        train_dataset_id: trainDatasetId,
        val_dataset_id: valDatasetId || null,
        test_dataset_id: testDatasetId,
        params,
        total_timesteps: timesteps,
        learning_rate: null,
        run_label: label.trim(),
      })
      setJob(started)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const resultCard = (payload: TrainJob['result'] extends null ? never : NonNullable<TrainJob['result']>['validation'], title: string) => {
    if (!payload) return null
    const m = payload.metrics.agent
    return (
      <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-inset ring-white/10">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">{title}</span>
          <span className="text-[10px] text-slate-500">{payload.dataset_label}</span>
        </div>
        <div className="tabular mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
          <span className="text-slate-500">return</span>
          <span className={`text-right font-semibold ${pnlColor(m.total_return_pct)}`}>
            {pct(m.total_return_pct)}
          </span>
          <span className="text-slate-500">alpha</span>
          <span className={`text-right ${pnlColor(m.alpha_vs_benchmark_pct)}`}>
            {pct(m.alpha_vs_benchmark_pct ?? 0)}
          </span>
          <span className="text-slate-500">max DD</span>
          <span className="text-right text-rose-400">{m.max_drawdown_pct.toFixed(2)}%</span>
          <span className="text-slate-500">sharpe</span>
          <span className="text-right text-slate-300">{m.sharpe.toFixed(2)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-3">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
        <h3 className="text-[13px] font-semibold tracking-wide text-slate-200 uppercase">Train agent</h3>
        {job && (
          <Badge tone={job.status === 'done' ? 'green' : job.status === 'error' ? 'red' : 'indigo'}>
            {job.status}
          </Badge>
        )}
      </div>

      {/* algorithm */}
      <div className="px-4 py-2">
        <label className="text-xs font-medium text-slate-300">Algorithm</label>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setAlgoSelection('')}
            className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
              algoSelection === ''
                ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/40'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={`Fine-tune the current ${currentModel.algo === 'ppo' ? 'PPO' : 'LSTM'} model`}
          >
            Same as base
          </button>
          {ALGOS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setAlgoSelection(a.key)}
              className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                algoSelection === a.key
                  ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/40'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title={a.hint}
            >
              {a.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          {effectiveAlgo === 'recurrent_ppo' ? 'RecurrentPPO (LSTM)' : 'PPO'} · {mode}
          {mode === 'train from scratch' && ' — new policy, notebook hyperparameters'}
        </p>
      </div>

      {/* splits */}
      <div className="grid grid-cols-1 gap-2 px-4 py-1">
        <div>
          <label className="text-xs font-medium text-slate-300">
            <span className="mr-1 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300">TRAIN</span>{' '}
            data
          </label>
          <select value={trainDatasetId} onChange={(e) => setTrainDatasetId(e.target.value)} className="mt-1 w-full">
            {trainingDatasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label} · {d.timeframe} · {d.n_steps.toLocaleString()} bars
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-300">
            <span className="mr-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">VAL</span>{' '}
            dataset
          </label>
          <select value={valDatasetId} onChange={(e) => setValDatasetId(e.target.value)} className="mt-1 w-full">
            <option value="">— skip validation —</option>
            {evalDatasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label} · {d.timeframe}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-300">
            <span className="mr-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">TEST</span>{' '}
            dataset
          </label>
          <select value={testDatasetId} onChange={(e) => setTestDatasetId(e.target.value)} className="mt-1 w-full">
            {evalDatasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label} · {d.timeframe}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-300">Timesteps</label>
          <div className="mt-1.5 flex gap-1.5">
            {TIMESTEP_PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTimesteps(v)}
                className={`tabular flex-1 rounded-md px-1 py-1 text-[11px] font-semibold transition-colors ${
                  timesteps === v
                    ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/40'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {v >= 1000 ? `${v / 1000}k` : v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-300">Run label (optional)</label>
          <input
            type="text"
            value={label}
            placeholder="e.g. volatility reward ×2"
            onChange={(e) => setLabel(e.target.value)}
            className="mt-1 w-full"
          />
        </div>
      </div>

      <div className="px-4 pt-3">
        <Button variant="primary" onClick={launch} disabled={busy} className="w-full">
          {busy ? (
            <>
              <Spinner /> Training {Math.round((job?.progress ?? 0) * 100)}%
            </>
          ) : (
            '⚙ Start training'
          )}
        </Button>
      </div>

      {error && <p className="px-4 pt-2 text-xs text-red-400">{error}</p>}

      {job && busy && (
        <div className="px-4 pt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-500"
              style={{ width: `${Math.max(2, (job.progress ?? 0) * 100)}%` }}
            />
          </div>
          <div
            ref={logRef}
            className="tabular mt-2 max-h-28 overflow-y-auto rounded-lg bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-slate-400"
          >
            {job.log.map((line, i) => (
              <div key={i} className={line.includes('Error') || line.includes('Traceback') ? 'text-red-400' : ''}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {job?.status === 'error' && (
        <div className="px-4 pt-2 text-xs text-red-400">
          {job.error}
          <div className="tabular mt-2 max-h-28 overflow-y-auto rounded-lg bg-black/30 p-2 font-mono text-[10px] text-slate-400">
            {job.log.slice(-8).map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {job?.status === 'done' && job.result && (
        <div className="mt-3 space-y-2 px-4">
          <div className="rounded-lg bg-emerald-500/10 p-2.5 text-[11px] text-emerald-300 ring-1 ring-inset ring-emerald-400/25">
            Model saved: <span className="font-mono">{job.new_model_id}</span> — now in the model selector.
          </div>
          {resultCard(job.result.validation, 'Validation')}
          {resultCard(job.result.test, 'Test')}
        </div>
      )}
    </div>
  )
}

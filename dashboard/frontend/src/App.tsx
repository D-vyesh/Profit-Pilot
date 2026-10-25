import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CandlePayload, Catalog, EnvParams, Run, TrainJob } from './types'
import { fetchCatalog, fetchCandles, runBacktest } from './api'
import EquityChart from './components/EquityChart'
import PriceChart from './components/PriceChart'
import RiskChart from './components/RiskChart'
import AllocationChart from './components/AllocationChart'
import RewardChart from './components/RewardChart'
import RewardBreakdownChart from './components/RewardBreakdownChart'
import KpiCards from './components/KpiCards'
import TradesTable from './components/TradesTable'
import ParamsPanel from './components/ParamsPanel'
import TrainPanel from './components/TrainPanel'
import ComparePanel from './components/ComparePanel'
import { Badge, Button, Panel, SectionTitle, Spinner } from './components/ui'

let runSeq = 0

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [modelId, setModelId] = useState('')
  const [datasetId, setDatasetId] = useState('')
  const [params, setParams] = useState<EnvParams | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [activeRunId, setActiveRunId] = useState('')
  const [candlesBtc, setCandlesBtc] = useState<CandlePayload | null>(null)
  const [candlesEth, setCandlesEth] = useState<CandlePayload | null>(null)
  const [running, setRunning] = useState(false)
  const [bootError, setBootError] = useState<string | null>(null)
  const [tab, setTab] = useState<'trades' | 'compare'>('trades')
  const runSeqRef = useRef(0)

  const activeRun = useMemo(() => runs.find((r) => r.id === activeRunId) ?? null, [runs, activeRunId])

  // ---------------------------------------------------------------- bootstrap
  useEffect(() => {
    ;(async () => {
      try {
        const cat = await fetchCatalog()
        setCatalog(cat)
        setParams(cat.defaultEnvParams)
        setModelId(cat.defaultSelection.model_id)
        setDatasetId(cat.defaultSelection.dataset_id)
      } catch (e) {
        setBootError(
          e instanceof Error
            ? `Backend not reachable: ${e.message}`
            : 'Backend not reachable — is it running on port 8000?',
        )
      }
    })()
  }, [])

  const loadCandles = useCallback(async (dsId: string) => {
    if (!dsId) return
    setCandlesBtc(null)
    setCandlesEth(null)
    try {
      const [btc, eth] = await Promise.all([
        fetchCandles(dsId, 'BTC/USDT'),
        fetchCandles(dsId, 'ETH/USDT'),
      ])
      setCandlesBtc(btc)
      setCandlesEth(eth)
    } catch {
      /* candle data is optional — charts just stay hidden */
    }
  }, [])

  const executeRun = useCallback(
    async (mid: string, did: string, p: EnvParams, label?: string) => {
      setRunning(true)
      try {
        const payload = await runBacktest(mid, did, p)
        const id = `run-${++runSeq}`
        const run: Run = {
          id,
          label: label ?? payload.run_label ?? `${payload.model_name}`,
          createdAt: Date.now(),
          payload,
        }
        setRuns((prev) => [...prev.slice(-7), run])
        setActiveRunId(id)
      } finally {
        setRunning(false)
      }
    },
    [],
  )

  // first automatic backtest once the catalog is in
  const bootstrapped = useRef(false)
  useEffect(() => {
    if (bootstrapped.current || !catalog || !modelId || !datasetId || !params) return
    bootstrapped.current = true
    loadCandles(datasetId)
    executeRun(modelId, datasetId, params).catch(() => {})
  }, [catalog, modelId, datasetId, params, loadCandles, executeRun])

  const handleDatasetChange = (dsId: string) => {
    setDatasetId(dsId)
    loadCandles(dsId)
  }

  const handleJobDone = useCallback(
    (job: TrainJob) => {
      if (job.result && job.new_model_id) {
        const results = [job.result.validation, job.result.test].filter(Boolean)
        const newRuns = results.map((payload) => ({
          id: `run-${++runSeqRef.current}`,
          label: payload!.run_label ?? 'trained model',
          createdAt: Date.now(),
          payload: payload!,
        }))
        if (newRuns.length > 0) {
          setRuns((prev) => [...prev.slice(-7), ...newRuns])
          // land on the test result
          const testRun = newRuns[newRuns.length - 1]
          setActiveRunId(testRun.id)
        }
        // refresh catalog so the new model appears in selectors
        fetchCatalog()
          .then((cat) => setCatalog(cat))
          .catch(() => {})
      }
    },
    [],
  )

  if (bootError) {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center p-8">
        <Panel className="max-w-lg p-8 text-center">
          <h1 className="text-xl font-bold text-slate-100">Profit-Pilot Dashboard</h1>
          <p className="mt-3 text-sm text-red-400">{bootError}</p>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            Start the backend first:
            <code className="mt-2 block rounded bg-black/40 p-2 font-mono text-[11px] text-slate-300">
              cd dashboard/backend{'\n'}
              ../../.venv/Scripts/python -m uvicorn app.main:app --port 8000
            </code>
          </p>
        </Panel>
      </div>
    )
  }

  if (!catalog || !params) {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center gap-3 text-slate-400">
        <Spinner /> <span className="text-sm">Loading Profit-Pilot catalog…</span>
      </div>
    )
  }

  const models = [...catalog.models].sort((a, b) => {
    const rank = (m: typeof a) => (m.id.startsWith('finetuned/') ? 0 : 0)
    return rank(a) - rank(b) || a.id.localeCompare(b.id)
  })
  const datasets = catalog.datasets

  return (
    <div className="app-bg min-h-screen">
      {/* ------------------------------------------------------------ header */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#060911]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
              <span className="text-lg">🛩</span>
            </div>
            <div>
              <h1 className="text-[15px] leading-tight font-extrabold tracking-tight text-slate-100">
                Profit<span className="text-indigo-400">·</span>Pilot
              </h1>
              <p className="text-[10px] tracking-wide text-slate-500 uppercase">
                RL crypto trading · PPO · BTC + ETH
              </p>
            </div>
          </div>

          <div className="ml-2 flex flex-wrap items-center gap-2">
            <select value={modelId} onChange={(e) => setModelId(e.target.value)} title="Model">
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.algo === 'ppo' ? 'PPO' : 'LSTM'}) · {m.timeframe}
                </option>
              ))}
            </select>
            <select value={datasetId} onChange={(e) => handleDatasetChange(e.target.value)} title="Dataset">
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} · {d.kind}
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              onClick={() => executeRun(modelId, datasetId, params).catch(() => {})}
              disabled={running}
            >
              {running ? <Spinner /> : '▶'} Backtest
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {activeRun && (
              <>
                <Badge tone="indigo">{activeRun.payload.model_name}</Badge>
                <Badge tone="violet">{activeRun.payload.dataset_label}</Badge>
                {activeRun.payload.split && (
                  <Badge tone={activeRun.payload.split === 'validation' ? 'amber' : 'green'}>
                    {activeRun.payload.split}
                  </Badge>
                )}
                <Badge tone="slate">{activeRun.payload.timeframe} bars</Badge>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-5">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
          {/* -------------------------------------------------- left column */}
          <div className="flex flex-col gap-4">
            <Panel>
              <ParamsPanel
                params={params}
                onChange={setParams}
                defaults={catalog.defaultEnvParams}
                onRun={() => executeRun(modelId, datasetId, params).catch(() => {})}
                onReset={() => setParams(catalog.defaultEnvParams)}
                running={running}
              />
            </Panel>
            <Panel>
              <TrainPanel
                catalog={catalog}
                currentModel={models.find((m) => m.id === modelId) ?? catalog.models[0]}
                currentDatasetId={datasetId}
                params={params}
                onJobDone={handleJobDone}
              />
            </Panel>
          </div>

          {/* -------------------------------------------------- right column */}
          <div className="flex min-w-0 flex-col gap-4">
            {activeRun ? (
              <>
                <KpiCards agent={activeRun.payload.metrics.agent} benchmark={activeRun.payload.metrics.benchmark} />

                <Panel>
                  <SectionTitle
                    title="Portfolio value"
                    subtitle="agent vs equal-weight BTC + ETH benchmark"
                    right={
                      <span className="tabular text-[11px] text-slate-500">
                        {activeRun.payload.n_steps.toLocaleString()} steps · lookback {activeRun.payload.lookback}
                      </span>
                    }
                  />
                  <EquityChart run={activeRun.payload} />
                </Panel>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Panel>
                    <SectionTitle title="BTC / USDT" subtitle="candles with agent trades" />
                    <PriceChart candles={candlesBtc} run={activeRun.payload} symbolIndex={0} symbol="BTC/USDT" height={300} />
                  </Panel>
                  <Panel>
                    <SectionTitle title="ETH / USDT" subtitle="candles with agent trades" />
                    <PriceChart candles={candlesEth} run={activeRun.payload} symbolIndex={1} symbol="ETH/USDT" height={300} />
                  </Panel>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Panel>
                    <SectionTitle title="Allocation" subtitle="cash vs position value over time" />
                    <AllocationChart run={activeRun.payload} />
                  </Panel>
                  <Panel>
                    <SectionTitle title="Cumulative reward" subtitle="the optimization objective" />
                    <RewardChart run={activeRun.payload} />
                  </Panel>
                </div>

                  <Panel>
                    <SectionTitle
                      title="Reward engineering"
                      subtitle={
                        activeRun.payload.params.reward_mode === 'return_cost_risk_volatility'
                          ? 'volatility-added mode · cumulative weighted terms'
                          : 'simple mode · cumulative weighted terms'
                      }
                      right={
                        <Badge tone={activeRun.payload.params.reward_mode === 'return_cost_risk_volatility' ? 'violet' : 'slate'}>
                          {activeRun.payload.params.reward_mode === 'return_cost_risk_volatility' ? 'volatility-added' : 'simple'}
                        </Badge>
                      }
                    />
                    <RewardBreakdownChart run={activeRun.payload} />
                  </Panel>
                  <Panel>
                    <SectionTitle title="Risk" subtitle="drawdown & rolling volatility" />
                    <RiskChart run={activeRun.payload} />
                  </Panel>

                <Panel>
                  <div className="flex items-center gap-1.5 border-b border-white/5 px-4 pt-3 pb-2">
                    {(
                      [
                        ['trades', `Trades (${activeRun.payload.trades.length.toLocaleString()})`],
                        ['compare', `Compare runs (${runs.length})`],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTab(key)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          tab === key
                            ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/40'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {tab === 'trades' ? (
                    <TradesTable run={activeRun.payload} />
                  ) : (
                    <ComparePanel
                      runs={runs}
                      activeRunId={activeRunId}
                      onSelect={setActiveRunId}
                      onRemove={(id) => {
                        setRuns((prev) => prev.filter((r) => r.id !== id))
                        if (id === activeRunId) {
                          const remaining = runs.filter((r) => r.id !== id)
                          setActiveRunId(remaining.length ? remaining[remaining.length - 1].id : '')
                        }
                      }}
                    />
                  )}
                </Panel>
              </>
            ) : running ? (
              <Panel className="flex items-center justify-center gap-3 p-16 text-slate-400">
                <Spinner /> <span className="text-sm">Running backtest…</span>
              </Panel>
            ) : (
              <Panel className="p-16 text-center text-sm text-slate-400">
                Pick a model &amp; dataset, then press <span className="font-semibold text-indigo-300">Backtest</span>.
              </Panel>
            )}
          </div>
        </div>

        <footer className="mt-6 pb-4 text-center text-[11px] text-slate-600">
          Profit-Pilot · reinforcement-learning portfolio pilot · deterministic evaluation on historical data — not
          financial advice
        </footer>
      </main>
    </div>
  )
}

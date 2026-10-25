export interface ModelInfo {
  id: string
  name: string
  algo: 'ppo' | 'recurrent_ppo'
  lookback: number
  total_timesteps: number
  symbols: string[]
  timeframe: string
  train_window: string[] | null
  description: string
}

export interface DatasetInfo {
  id: string
  label: string
  kind: 'train' | 'test' | 'forward' | 'eval'
  timeframe: string
  symbols: string[]
  n_steps: number
  first_timestamp: string
  last_timestamp: string
}

export interface EnvParams {
  initial_cash: number
  buy_cost_pct: number
  sell_cost_pct: number
  reward_mode: 'return_cost_risk' | 'return_cost_risk_volatility'
  reward_scaling: number
  cost_penalty_weight: number
  risk_penalty_weight: number
  volatility_reward_weight: number
  volatility_window: number
  risk_adjusted_return_clip: number
  max_position_fraction: number
  max_trade_fraction: number
  stop_loss_pct: number
  max_drawdown_pct: number
  cooldown_steps: number
}

export interface Catalog {
  models: ModelInfo[]
  datasets: DatasetInfo[]
  defaultEnvParams: EnvParams
  defaultSelection: { model_id: string; dataset_id: string }
}

export interface StrategyMetrics {
  initial_value: number
  final_value: number
  total_return_pct: number
  annualized_return_pct: number
  annualized_volatility_pct: number
  sharpe: number
  sortino: number
  max_drawdown_pct: number
  calmar: number
  win_rate_pct: number
  total_reward?: number
  total_fees?: number
  trade_events?: number
  risk_halted?: boolean
  alpha_vs_benchmark_pct?: number
}

export interface Trade {
  t: number
  ts: string
  s: number
  side: 'buy' | 'sell'
  price: number
  qty: number
  value: number
  fee: number
  pnl: number | null
  reason: 'agent' | 'stop-loss' | 'risk-halt' | 'position-cap'
}

export interface TradeMarker {
  s: number
  side: 'buy' | 'sell'
  t: number
  ts: string
  count: number
  value: number
  pnl: number | null
}

export interface SeriesPayload {
  t: number[]
  ts: string[]
  portfolio: number[]
  benchmark: number[]
  cash: number[]
  positions: number[][]
  reward: number[]
  reward_ret: number[]
  reward_cost: number[]
  reward_risk: number[]
  reward_vol: number[]
  fees_cum: number[]
  drawdown: number[]
  volatility: number[]
}

export interface SymbolStat {
  symbol: string
  buys: number
  sells: number
  realized_pnl: number
  fees: number
  win_rate_pct: number
}

export interface BacktestPayload {
  model_id: string
  model_name: string
  dataset_id: string
  dataset_label: string
  timeframe: string
  symbols: string[]
  lookback: number
  params: EnvParams
  metrics: { agent: StrategyMetrics; benchmark: StrategyMetrics }
  symbol_stats: SymbolStat[]
  series: SeriesPayload
  trades: Trade[]
  markers: TradeMarker[]
  n_steps: number
  run_label?: string
  split?: 'validation' | 'test'
}

export interface CandlePayload {
  symbol: string
  timeframe: string
  source: string
  stride: number
  time: number[]
  open: number[]
  high: number[]
  low: number[]
  close: number[]
  volume: number[]
}

export interface TrainJob {
  id: string
  status: 'queued' | 'running' | 'done' | 'error'
  progress: number
  total_timesteps: number
  timesteps_done: number
  error: string | null
  log: string[]
  new_model_id: string | null
  result: { validation: BacktestPayload | null; test: BacktestPayload | null } | null
}

export interface Run {
  id: string
  label: string
  createdAt: number
  payload: BacktestPayload
}

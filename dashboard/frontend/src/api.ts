import type { BacktestPayload, CandlePayload, Catalog, EnvParams, TrainJob } from './types'

async function json_or_throw<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export async function fetchCatalog(): Promise<Catalog> {
  return json_or_throw<Catalog>(await fetch('/api/catalog'))
}

export async function runBacktest(modelId: string, datasetId: string, params: EnvParams): Promise<BacktestPayload> {
  const res = await fetch('/api/backtest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_id: modelId, dataset_id: datasetId, params }),
  })
  return json_or_throw<BacktestPayload>(res)
}

export async function fetchCandles(datasetId: string, symbol: string, maxCandles = 1200): Promise<CandlePayload> {
  const res = await fetch('/api/candles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_id: datasetId, symbol, max_candles: maxCandles }),
  })
  return json_or_throw<CandlePayload>(res)
}

export async function startTraining(req: {
  base_model_id: string
  algo: string
  train_dataset_id: string
  val_dataset_id: string | null
  test_dataset_id: string
  params: EnvParams
  total_timesteps: number
  learning_rate: number | null
  run_label: string
}): Promise<TrainJob> {
  const res = await fetch('/api/train', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  return json_or_throw<TrainJob>(res)
}

export async function pollTraining(jobId: string): Promise<TrainJob> {
  return json_or_throw<TrainJob>(await fetch(`/api/train/${jobId}`))
}

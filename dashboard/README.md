# Profit-Pilot Dashboard

Interactive web UI for the Profit-Pilot RL crypto-trading project. It wraps the real
trained models, market data and trading environment — no simulation shortcuts.

## What it does

- **Backtest any trained model on any dataset** with your published results reproduced exactly
  (PPO T4 5m on the 2026 test set → $10,179.18 final value, +1.79% return, 9.55% max drawdown).
- **Reward-engineering controls**: change reward mode, reward/cost/risk/volatility weights,
  fees, stop-loss, drawdown halt, position caps and cooldowns, then re-run instantly to see
  the effect on the trajectory and metrics.
- **Full trade log**: every buy/sell reconstructed with timestamp, price, quantity, fees and
  realized P&L (marked whether it was an agent decision, stop-loss, position-cap or risk-halt).
- **Charts**: equity vs equal-weight benchmark, BTC & ETH candlesticks with trade markers,
  allocation over time, cumulative reward, drawdown & volatility.
- **Fine-tune from the UI**: continue training the selected model with the current reward
  settings (background job with progress), then the new model is auto-backtested and added
  to the run comparison table.

## Run it

```bash
# from the repo root — first time only
py -3.11 -m venv .venv
.venv/Scripts/pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv/Scripts/pip install -r dashboard/backend/requirements.txt

cd dashboard/frontend && npm install && npm run build && cd ../..

# start (Windows)
dashboard\start.bat
# or manually:
cd dashboard/backend && ../../.venv/Scripts/python -m uvicorn app.main:app --port 8000
```

Then open **http://127.0.0.1:8000** (the backend serves the built frontend).
For frontend development with hot reload: `npm run dev` in `dashboard/frontend`
(proxy to :8000 is configured in `vite.config.ts`).

## Notes

- A full 5m test-set backtest (~31.5k steps) takes about a minute on CPU; progress is shown
  in the header while running.
- Fine-tuned models are saved to `models/finetuned/` and appear in the model selector.
- The 1h models referenced by the original `config/*.yaml` files are not in the repo;
  only the two 5m models ship with checkpoints, so 1h datasets can't be backtested until
  such a model is trained.

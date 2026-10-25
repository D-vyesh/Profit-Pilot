# Profit-Pilot: Reinforcement Learning for Cryptocurrency Trading

Profit-Pilot is a research-grade framework for developing, training, and evaluating reinforcement learning (RL) agents for multi-asset cryptocurrency portfolio management. It is designed for academic, educational, and practical experimentation with RL-based trading strategies, using real historical market data and robust evaluation metrics.

---

## 🚀 Project Goal

Build a reinforcement learning agent that learns a profitable portfolio-allocation policy from historical crypto market data. The agent observes market conditions, selects trading actions, receives reward from portfolio performance, and improves its policy through repeated interaction with a custom environment.

## 📚 Why Reinforcement Learning?
- Trading is a sequential decision-making problem: actions affect future outcomes.
- RL optimizes long-term cumulative reward, not just one-step prediction.
- RL directly models the trading loop: observe → act → reward → learn.

## 🏗️ Project Architecture

1. **Data Download**: Fetch historical OHLCV data for multiple crypto assets (e.g., BTC/USDT, ETH/USDT) from Binance.
2. **Feature Engineering**: Compute technical indicators and process data into arrays.
3. **Custom Environment**: Feed arrays into a Gymnasium-style multi-asset trading environment with realistic constraints (fees, slippage, risk limits).
4. **Agent Training**: Train a PPO (Proximal Policy Optimization) agent on the environment.
5. **Evaluation**: Test on unseen data, compare to benchmarks, and analyze risk/return metrics.
6. **Dashboard**: Interactively backtest, engineer the reward function, and train agents from the browser.
7. **Extensions**: Add original features (e.g., LSTM, risk overlays, new reward functions).

## 🧩 Key Features

- Modular pipeline: data, features, environment, agent, evaluation
- Multi-asset support (BTC, ETH, etc.)
- Realistic trading constraints (fees, max drawdown, stop-loss, cooldown)
- PPO baseline + RecurrentPPO (LSTM) support
- **Interactive dashboard** for backtesting, reward engineering, and training (see below)
- Academic references and methodology included
- Ready-to-run Colab and local Jupyter notebooks
- Reproducible experiments and artifact tracking

## 📊 Example Results

**Colab 5m PPO Agent vs. Equal-Weight Benchmark (2024-2026 test set):**

| Metric                | PPO Agent | Equal-Weight |
|-----------------------|-----------|--------------|
| Final Value           | $10,179   | $8,200       |
| Total Return (%)      | 1.79      | -17.99       |
| Annualized Return (%) | 6.10      | -48.37       |
| Sharpe Ratio          | 0.39      | -0.78        |
| Max Drawdown (%)      | 9.55      | 43.20        |
| Trade Events          | 28,246    | 0            |

See `reports/colab_5m_2024_2026/profit_pilot_ppo_5m_t4_test_metrics.json` for full details.

## 📦 Directory Structure

- `src/profit_pilot/` — Core package (data, env, features, train, utils)
- `dashboard/` — Interactive web dashboard (FastAPI backend + React frontend)
- `data/` — Raw and processed market data bundles
- `models/` — Saved agent checkpoints and training summaries
- `reports/` — Evaluation metrics, plots, and experiment artifacts
- `notebooks/` — Jupyter/Colab notebooks for training and analysis
- `docs/` — Methodology, setup guide, reference analysis, slides
- `config/` — Project and experiment configuration files
- `tests/` — Unit tests

## 🖥️ Interactive Dashboard

A built-in web UI (`dashboard/`) for exploring and experimenting with the trained agents — no code changes needed:

- **Backtesting** — run any trained model on any dataset and reproduce the published results exactly
- **Reward engineering** — switch between the two reward modes with live weight controls:
  - *Simple*: `return − cost_penalty − risk_penalty`
  - *Volatility-added*: `+ volatility_reward_weight · tanh(return / vol)`
  - plus a per-term reward decomposition chart showing exactly which term drives performance
- **Training from the UI** — choose PPO or RecurrentPPO (LSTM), fine-tune existing weights or train fresh, with a proper **train / validation / test** split workflow and side-by-side val/test results (catch overfitting before trusting a reward tweak)
- **Full trade log** — every buy/sell with timestamp, price, fees, realized P&L, and reason (agent decision / stop-loss / position-cap / risk-halt)
- **Charts** — equity vs equal-weight benchmark, BTC & ETH candlesticks with trade markers, allocation over time, cumulative reward, drawdown & volatility
- **Run comparison** — every experiment kept in a sortable table (return, alpha, Sharpe, max drawdown, reward)

Run it (after cloning):

```bat
dashboard\start.bat
```

Then open **http://127.0.0.1:8000** — the script installs dependencies and builds the frontend on first run. Details in `dashboard/README.md`.

## ⚡ Quickstart

> 📘 **All setup and run commands in one place: see [COMMANDS.md](COMMANDS.md).**

1. **Clone the repo and set up the environment:**
   ```powershell
   git clone <repo-url>
   cd ProfitPilot
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   pip install -e .
   ```
2. **Configure API keys:**
   - Copy `.env.example` to `.env` and fill in your Binance API credentials (or use sandbox mode).
3. **Run a notebook:**
   - Open `notebooks/colab_t4_5m_profit_pilot_training.ipynb` or `notebooks/Local Run/Local_run_5m.ipynb` in Jupyter/Colab.
   - Follow the cells to train and evaluate the agent.
4. **Or use the dashboard:**
   - Run `dashboard\start.bat` and open http://127.0.0.1:8000 to backtest, tweak rewards, and train agents interactively.

## 🛠️ Main Modules

- `src/profit_pilot/data/download_ohlcv.py` — Download historical OHLCV data
- `src/profit_pilot/features/build_features.py` — Compute technical indicators
- `src/profit_pilot/env/multi_crypto_env.py` — Custom multi-asset trading environment
- `src/profit_pilot/train/train_ppo.py` — PPO agent training loop
- `src/profit_pilot/train/evaluate_model.py` — Evaluation and metrics
- `src/profit_pilot/utils/io.py` — I/O utilities

## 🧪 Testing

- Run `pytest` or check `tests/test_multi_crypto_env.py` for environment tests.

## 📖 Documentation

- `docs/METHODOLOGY.md` — Project methodology and academic rationale
- `docs/SETUP_GUIDE.md` — Step-by-step setup instructions
- `docs/REFERENCE_ANALYSIS.md` — Analysis of reference repositories
- `docs/PRESENTATION_SLIDES.md` — Slide-ready project summary

## 📝 References

- [FinRL_Crypto](https://github.com/AI4Finance-Foundation/FinRL_Crypto)
- [oyi77/Crypto-RL-Trading-Bot](https://github.com/oyi77/Crypto-RL-Trading-Bot)
- [notadamking/RLTrader](https://github.com/notadamking/RLTrader)
- [Automated-Cryptocurrency-trading-using-Deep-RL](https://github.com/llSourcell/Automated-Cryptocurrency-trading-using-Deep-RL)
- Moody & Saffell (2001), "Learning to Trade via Direct Reinforcement"
- Recent RL trading literature (see `docs/METHODOLOGY.md`)

## 👥 Authors & Acknowledgements

- Divyesh, Utsker, Smit

## 📄 License

Specify your license here (MIT, Apache 2.0, etc.)

---

For questions, open an issue or see the documentation in the `docs/` folder.

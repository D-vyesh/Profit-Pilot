# 📘 Profit-Pilot — Setup & Run Commands

All commands to get the project running after downloading/cloning the repo.

> **Repo:** `https://github.com/D-vyesh/Profit-Pilot`
> **Requirements:** Python 3.11, Node.js 18+ (for the dashboard), Git

---

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/D-vyesh/Profit-Pilot.git
cd Profit-Pilot
```

---

## 2️⃣ Option A — Interactive Dashboard (recommended)

### Windows — one command

```bat
dashboard\start.bat
```

The script automatically creates the virtual environment, installs all dependencies,
builds the frontend, and starts the server on first run.

Then open: **http://127.0.0.1:8000**

### Windows — manual steps

```powershell
# Python environment
py -3.11 -m venv .venv
.venv\Scripts\pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv\Scripts\pip install -r dashboard\backend\requirements.txt

# Frontend build
cd dashboard\frontend
npm install
npm run build
cd ..\..

# Start the server
cd dashboard\backend
..\..\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### macOS / Linux

```bash
# Python environment
python3.11 -m venv .venv
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install -r dashboard/backend/requirements.txt

# Frontend build
cd dashboard/frontend
npm install
npm run build
cd ../..

# Start the server
cd dashboard/backend
../../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Frontend development mode (hot reload)

```bash
cd dashboard/frontend
npm run dev        # serves on http://localhost:5173, proxies /api to :8000
```

> **Note:** the first 5m backtest (~31.5k steps) takes about a minute on CPU —
> the header shows progress while it runs.

---

## 3️⃣ Option B — Python Pipeline (notebooks / scripts)

### Setup

```powershell
# Windows
python -m venv .venv
.venv\Scripts\Activate.ps1
.venv\Scripts\pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv\Scripts\pip install -r dashboard\backend\requirements.txt
# make the profit_pilot package importable
set PYTHONPATH=src
```

```bash
# macOS / Linux
python3.11 -m venv .venv
source .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r dashboard/backend/requirements.txt
# make the profit_pilot package importable
export PYTHONPATH=src
```

### Configure API keys (only needed to download fresh data)

```bash
cp .env.example .env    # then edit .env with your Binance API key/secret
```

### Train an agent

```bash
python -m profit_pilot.train.train_ppo --config config/project_config.yaml
```

### Evaluate a trained agent

```bash
python -m profit_pilot.train.evaluate_model --config config/project_config.yaml          # PPO
python -m profit_pilot.train.evaluate_model --config config/project_config.yaml --use-lstm  # RecurrentPPO (LSTM)
```

### Run notebooks

```bash
jupyter notebook "notebooks/colab_t4_5m_profit_pilot_training.ipynb"
# or locally:
jupyter notebook "notebooks/Local Run/Local_run_5m.ipynb"
```

---

## 4️⃣ Run Tests

```bash
pytest
```

---

## 5️⃣ Quick Reference

| Action | Command |
|---|---|
| Start dashboard (Windows) | `dashboard\start.bat` |
| Start backend manually | `cd dashboard/backend && ../../.venv/Scripts/python -m uvicorn app.main:app --port 8000` |
| Dashboard URL | http://127.0.0.1:8000 |
| Frontend dev server | `cd dashboard/frontend && npm run dev` |
| Build frontend | `cd dashboard/frontend && npm run build` |
| Train agent (CLI) | `python -m profit_pilot.train.train_ppo --config config/project_config.yaml` |
| Evaluate agent (CLI) | `python -m profit_pilot.train.evaluate_model --config config/project_config.yaml` |
| Run tests | `pytest` |

---

For architecture details see the [README](README.md); for dashboard internals see
[dashboard/README.md](dashboard/README.md).

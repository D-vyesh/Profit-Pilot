@echo off
REM Profit-Pilot dashboard launcher (Windows)
setlocal
cd /d "%~dp0.."

if not exist ".venv\Scripts\python.exe" (
  echo [setup] creating venv...
  py -3.11 -m venv .venv
  .venv\Scripts\pip install torch --index-url https://download.pytorch.org/whl/cpu
  .venv\Scripts\pip install -r dashboard\backend\requirements.txt
)

if not exist "dashboard\frontend\dist\index.html" (
  echo [setup] building frontend...
  pushd dashboard\frontend
  if not exist node_modules call npm install
  call npm run build
  popd
)

echo Starting Profit-Pilot dashboard at http://127.0.0.1:8000
cd dashboard\backend
..\..\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

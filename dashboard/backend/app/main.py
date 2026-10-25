from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import REPO_ROOT
from .candles import CandleService
from .registry import Registry
from .schemas import BacktestRequest, CandleRequest, TrainRequest
from .simulation import run_backtest
from .training import TrainingManager

app = FastAPI(title="Profit-Pilot Dashboard", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

registry = Registry(REPO_ROOT)
candles = CandleService(REPO_ROOT)
trainer = TrainingManager(registry)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "repo_root": str(REPO_ROOT)}


@app.get("/api/catalog")
def catalog() -> dict:
    registry.refresh()
    return registry.catalog()


@app.post("/api/backtest")
def backtest(req: BacktestRequest) -> dict:
    try:
        model_info = registry.get_model_info(req.model_id)
        model = registry.get_model(req.model_id)
        bundle = registry.get_bundle(req.dataset_id)
        if bundle.info.timeframe != model_info.timeframe:
            raise ValueError(
                f"Model trained on {model_info.timeframe} data — dataset is {bundle.info.timeframe}."
            )
        payload = run_backtest(model, model_info, bundle, req.params.model_dump())
        payload["run_label"] = f"{model_info.name} · {bundle.info.label}"
        return payload
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/candles")
def get_candles(req: CandleRequest) -> dict:
    try:
        info = registry.get_dataset_info(req.dataset_id)
        if not info.first_timestamp or not info.last_timestamp:
            raise ValueError("Dataset has no timestamp range")
        return candles.get_candles(
            symbol=req.symbol,
            timeframe=info.timeframe,
            start=info.first_timestamp,
            end=info.last_timestamp,
            max_candles=req.max_candles,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/train")
def start_training(req: TrainRequest) -> dict:
    try:
        job = trainer.start_job(req.model_dump())
        return job.public()
    except (KeyError, ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/train/{job_id}")
def training_status(job_id: str) -> dict:
    try:
        return trainer.get_job(job_id).public()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ---------------------------------------------------------------- static SPA
_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _dist.is_dir():
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str) -> FileResponse:
        candidate = _dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_dist / "index.html")

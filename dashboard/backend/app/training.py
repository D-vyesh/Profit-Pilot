from __future__ import annotations

import json
import threading
import time
import traceback
import uuid
from dataclasses import dataclass, field

from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.vec_env import DummyVecEnv, VecMonitor

from profit_pilot.env.multi_crypto_env import MultiCryptoTradingEnv

from .registry import Registry
from .simulation import run_backtest

ALGOS = ("ppo", "recurrent_ppo")

ALGO_LABELS = {"ppo": "PPO", "recurrent_ppo": "RecurrentPPO (LSTM)"}


class _ProgressCallback(BaseCallback):
    def __init__(self, job: "TrainJob") -> None:
        super().__init__()
        self.job = job

    def _on_step(self) -> bool:
        self.job.timesteps_done = self.model.num_timesteps
        self.job.progress = min(1.0, self.num_timesteps / max(self.job.total_timesteps, 1))
        return True


@dataclass
class TrainJob:
    id: str
    status: str = "queued"  # queued | running | done | error
    progress: float = 0.0
    total_timesteps: int = 0
    timesteps_done: int = 0
    created_at: float = field(default_factory=time.time)
    finished_at: float | None = None
    error: str | None = None
    log: list[str] = field(default_factory=list)
    new_model_id: str | None = None
    result: dict | None = None  # {"validation": payload | None, "test": payload | None}
    request: dict = field(default_factory=dict)

    def public(self) -> dict:
        return {
            "id": self.id,
            "status": self.status,
            "progress": self.progress,
            "total_timesteps": self.total_timesteps,
            "timesteps_done": self.timesteps_done,
            "error": self.error,
            "log": self.log[-30:],
            "new_model_id": self.new_model_id,
            "result": self.result,
        }


def _fresh_hyperparams(total_timesteps: int) -> dict:
    """Rollout/batch sizes scaled down for small runs (from the Colab notebook defaults)."""
    if total_timesteps >= 4096:
        n_steps, batch_size = 4096, 1024
    elif total_timesteps >= 2048:
        n_steps, batch_size = 2048, 512
    elif total_timesteps >= 1024:
        n_steps, batch_size = 1024, 256
    else:
        n_steps, batch_size = 512, 128
    return {"n_steps": n_steps, "batch_size": batch_size}


class TrainingManager:
    def __init__(self, registry: Registry) -> None:
        self.registry = registry
        self.jobs: dict[str, TrainJob] = {}
        self._lock = threading.Lock()
        self._worker: threading.Thread | None = None

    def start_job(self, request: dict) -> TrainJob:
        base_info = self.registry.get_model_info(request["base_model_id"])
        algo = request.get("algo") or base_info.algo
        if algo not in ALGOS:
            raise ValueError(f"Unknown algo: {algo}. Choose one of {ALGOS}")

        dataset_ids = {
            "train": request["train_dataset_id"],
            "validation": request.get("val_dataset_id") or None,
            "test": request["test_dataset_id"],
        }
        infos = {}
        for split, ds_id in dataset_ids.items():
            if ds_id is None:
                continue
            info = self.registry.get_dataset_info(ds_id)
            if info.timeframe != base_info.timeframe:
                raise ValueError(
                    f"{split} dataset timeframe ({info.timeframe}) does not match the model ({base_info.timeframe})"
                )
            infos[split] = info

        if "train" not in infos:
            raise ValueError("A training dataset is required")

        job = TrainJob(
            id=uuid.uuid4().hex[:10],
            total_timesteps=int(request["total_timesteps"]),
            request=request,
        )
        mode = "fine-tune" if algo == base_info.algo else "fresh training"
        job.log.append(
            f"{ALGO_LABELS[algo]} · {mode} · {job.total_timesteps:,} steps on {infos['train'].label}"
        )
        with self._lock:
            if self._worker is not None and self._worker.is_alive():
                raise RuntimeError("A training job is already running — wait for it to finish first.")
            self.jobs[job.id] = job
            self._worker = threading.Thread(target=self._run, args=(job,), daemon=True)
            self._worker.start()
        return job

    def get_job(self, job_id: str) -> TrainJob:
        if job_id not in self.jobs:
            raise KeyError(f"Unknown job: {job_id}")
        return self.jobs[job_id]

    # ------------------------------------------------------------------ worker
    def _run(self, job: TrainJob) -> None:
        try:
            job.status = "running"
            req = job.request
            base_info = self.registry.get_model_info(req["base_model_id"])
            algo = req.get("algo") or base_info.algo
            params = req["params"]

            train_bundle = self.registry.get_bundle(req["train_dataset_id"])
            job.log.append(f"Training data: {train_bundle.info.label} ({train_bundle.price_array.shape[0]:,} bars)")

            def _make_env() -> MultiCryptoTradingEnv:
                return MultiCryptoTradingEnv(
                    price_array=train_bundle.price_array,
                    tech_array=train_bundle.tech_array,
                    tickers=train_bundle.info.symbols,
                    lookback=base_info.lookback,
                    cash_norm=1e-4,
                    holdings_norm=1.0,
                    tech_norm=1.0,
                    **{k: v for k, v in params.items() if k != "initial_cash"},
                    initial_cash=params.get("initial_cash", 10_000.0),
                )

            vec_env = VecMonitor(DummyVecEnv([_make_env]))
            learning_rate = req.get("learning_rate") or 3e-4

            if algo == base_info.algo:
                # fine-tune the existing weights; drop the saved tensorboard logger
                # config, which would require tensorboard to be installed
                model = self.registry.get_model(req["base_model_id"])
                model.tensorboard_log = None
                model.logger = None
                model.learning_rate = float(learning_rate)
                model.set_env(vec_env)
                model_name = f"{base_info.name}_ft_{time.strftime('%Y%m%d_%H%M%S')}"
                job.log.append(f"Fine-tuning weights of {base_info.name}…")
            else:
                # different algorithm — train from scratch with the notebook hyperparameters
                hyper = _fresh_hyperparams(job.total_timesteps)
                common = dict(
                    env=vec_env,
                    verbose=0,
                    learning_rate=float(learning_rate),
                    gamma=0.995,
                    gae_lambda=0.95,
                    clip_range=0.2,
                    ent_coef=0.01,
                    device="cpu",
                    **hyper,
                )
                if algo == "recurrent_ppo":
                    from sb3_contrib import RecurrentPPO

                    model = RecurrentPPO("MlpLstmPolicy", **common)
                else:
                    from stable_baselines3 import PPO

                    model = PPO("MlpPolicy", policy_kwargs={"net_arch": [256, 256]}, **common)
                model_name = f"profit_pilot_{algo}_{time.strftime('%Y%m%d_%H%M%S')}"
                job.log.append(f"Training a fresh {ALGO_LABELS[algo]} policy from scratch…")

            model.learn(
                total_timesteps=job.total_timesteps,
                callback=_ProgressCallback(job),
                progress_bar=False,
            )
            job.progress = 1.0

            # persist the model + summary so it appears in the catalog
            finetune_dir = self.registry.repo_root / "models" / "finetuned"
            finetune_dir.mkdir(parents=True, exist_ok=True)
            model.save(finetune_dir / model_name)
            (finetune_dir / f"{model_name}_summary.json").write_text(
                json.dumps(
                    {
                        "model_name": model_name,
                        "use_lstm": algo == "recurrent_ppo",
                        "total_timesteps": job.total_timesteps,
                        "symbols": base_info.symbols,
                        "timeframe": base_info.timeframe,
                        "lookback": base_info.lookback,
                        "train_window": [train_bundle.info.first_timestamp, train_bundle.info.last_timestamp],
                        "finetuned_from": base_info.name if algo == base_info.algo else None,
                        "reward_params": {
                            k: v
                            for k, v in params.items()
                            if "reward" in k or "penalty" in k or "volatility" in k
                        },
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            new_model_id = f"finetuned/{model_name}"
            job.new_model_id = new_model_id
            self.registry.scan_models()
            job.log.append(f"Saved model: {new_model_id}")

            # train / validation / test — backtest the new model on val + test sets
            new_info = self.registry.get_model_info(new_model_id)
            new_model = self.registry.get_model(new_model_id)
            base_label = req.get("run_label") or f"{ALGO_LABELS[algo]} +{job.total_timesteps:,} steps"

            result: dict = {"validation": None, "test": None}
            for split in ("validation", "test"):
                ds_id = req.get("val_dataset_id") if split == "validation" else req.get("test_dataset_id")
                if not ds_id:
                    continue
                job.log.append(f"Running {split} backtest…")
                bundle = self.registry.get_bundle(ds_id)
                payload = run_backtest(new_model, new_info, bundle, params)
                payload["run_label"] = f"{base_label} · {split}"
                payload["split"] = split
                result[split] = payload
                job.log.append(
                    f"{split}: return {payload['metrics']['agent']['total_return_pct']:.2f}% · "
                    f"alpha {payload['metrics']['agent'].get('alpha_vs_benchmark_pct', 0):.2f}%"
                )

            job.result = result
            job.status = "done"
            job.finished_at = time.time()
            job.log.append("Done.")
        except Exception as exc:  # noqa: BLE001 — surface any failure to the UI
            job.status = "error"
            job.error = f"{type(exc).__name__}: {exc}"
            job.log.append(traceback.format_exc()[-1500:])
            job.finished_at = time.time()

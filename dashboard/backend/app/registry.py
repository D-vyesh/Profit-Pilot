from __future__ import annotations

import json
import threading
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd


@dataclass
class ModelInfo:
    id: str
    name: str
    path: Path
    algo: str  # "ppo" | "recurrent_ppo"
    lookback: int
    total_timesteps: int
    symbols: list[str]
    timeframe: str
    train_window: list[str] | None = None
    description: str = ""


@dataclass
class DatasetInfo:
    id: str
    label: str
    kind: str  # train | test | forward | eval
    timeframe: str
    symbols: list[str]
    n_steps: int
    first_timestamp: str
    last_timestamp: str
    bundle_dir: Path


@dataclass
class Bundle:
    info: DatasetInfo
    price_array: np.ndarray
    tech_array: np.ndarray
    timestamps: pd.Series  # datetime strings aligned with price rows
    metadata: dict = field(default_factory=dict)


# Reward-engineering defaults actually used to train the released 5m models
# (from notebooks/colab_t4_5m_profit_pilot_training.ipynb ENV_KWARGS).
DEFAULT_ENV_PARAMS: dict = {
    "initial_cash": 10_000.0,
    "buy_cost_pct": 0.001,
    "sell_cost_pct": 0.001,
    "reward_mode": "return_cost_risk_volatility",
    "reward_scaling": 1.0,
    "cost_penalty_weight": 1.0,
    "risk_penalty_weight": 0.005,
    "volatility_reward_weight": 0.01,
    "volatility_window": 288,
    "risk_adjusted_return_clip": 5.0,
    "max_position_fraction": 0.50,
    "max_trade_fraction": 0.25,
    "stop_loss_pct": 0.08,
    "max_drawdown_pct": 0.20,
    "cooldown_steps": 0,
}


class Registry:
    """Discovers models / datasets under the repo and caches loaded bundles."""

    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root
        self.models: dict[str, ModelInfo] = {}
        self.datasets: dict[str, DatasetInfo] = {}
        self._bundle_cache: dict[str, Bundle] = {}
        self._model_cache: dict[str, object] = {}
        self._lock = threading.RLock()
        self.refresh()

    # ---------------------------------------------------------------- discovery
    def refresh(self) -> None:
        self.scan_models()
        self.scan_datasets()

    def scan_models(self) -> None:
        models_dir = self.repo_root / "models"
        found: dict[str, ModelInfo] = {}
        if models_dir.exists():
            for zip_path in sorted(models_dir.rglob("*.zip")):
                rel = zip_path.relative_to(models_dir).with_suffix("")
                if "checkpoints" in rel.parts:
                    continue  # keep the UI focused on final models
                model_id = str(rel).replace("\\", "/")
                summary = self._read_summary(zip_path.parent)
                use_lstm = bool(summary.get("use_lstm", False)) or "recurrent" in zip_path.stem
                found[model_id] = ModelInfo(
                    id=model_id,
                    name=summary.get("model_name", zip_path.stem),
                    path=zip_path,
                    algo="recurrent_ppo" if use_lstm else "ppo",
                    lookback=int(summary.get("lookback", 96)),
                    total_timesteps=int(summary.get("total_timesteps", 0)),
                    symbols=summary.get("symbols", ["BTC/USDT", "ETH/USDT"]),
                    timeframe=summary.get("timeframe", "5m"),
                    train_window=summary.get("train_window"),
                    description=self._model_description(summary, zip_path),
                )
        with self._lock:
            self.models = found
            # drop cached models that no longer exist
            for mid in list(self._model_cache):
                if mid not in found:
                    self._model_cache.pop(mid, None)

    @staticmethod
    def _read_summary(model_dir: Path) -> dict:
        best: dict = {}
        for candidate in sorted(model_dir.glob("*summary*.json")):
            try:
                data = json.loads(candidate.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    # prefer the training summary with richer metadata
                    if not best or "lookback" in data:
                        best = data
            except (OSError, ValueError):
                continue
        return best

    @staticmethod
    def _model_description(summary: dict, zip_path: Path) -> str:
        algo = "RecurrentPPO (LSTM)" if summary.get("use_lstm") else "PPO"
        steps = summary.get("total_timesteps")
        window = summary.get("train_window")
        parts = [algo]
        if steps:
            parts.append(f"{int(steps):,} steps")
        if window and len(window) == 2:
            parts.append(f"trained {str(window[0])[:10]} → {str(window[1])[:10]}")
        return " · ".join(parts)

    def scan_datasets(self) -> None:
        data_dir = self.repo_root / "data"
        found: dict[str, DatasetInfo] = {}
        if not data_dir.exists():
            return
        for bundle_dir in sorted(data_dir.glob("processed*/**/"), ):
            metadata_path = bundle_dir / "metadata.json"
            if not metadata_path.is_file():
                continue
            try:
                metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            rel = bundle_dir.relative_to(data_dir)
            dataset_id = str(rel).replace("\\", "/")
            kind = "eval"
            name = rel.parts[0].lower()
            if "forward" in name:
                kind = "forward"
            elif "test" in name:
                kind = "test"
            elif "train" in name:
                kind = "train"
            found[dataset_id] = DatasetInfo(
                id=dataset_id,
                label=metadata.get("label", bundle_dir.name),
                kind=kind,
                timeframe=metadata.get("timeframe", "5m"),
                symbols=metadata.get("symbols", ["BTC/USDT", "ETH/USDT"]),
                n_steps=int(metadata.get("price_array_shape", [0])[0]),
                first_timestamp=metadata.get("first_timestamp_after_warmup", ""),
                last_timestamp=metadata.get("last_timestamp", ""),
                bundle_dir=bundle_dir,
            )
        self.datasets = found

    # ---------------------------------------------------------------- accessors
    def get_model_info(self, model_id: str) -> ModelInfo:
        if model_id not in self.models:
            self.scan_models()
        if model_id not in self.models:
            raise KeyError(f"Unknown model: {model_id}")
        return self.models[model_id]

    def get_dataset_info(self, dataset_id: str) -> DatasetInfo:
        if dataset_id not in self.datasets:
            self.scan_datasets()
        if dataset_id not in self.datasets:
            raise KeyError(f"Unknown dataset: {dataset_id}")
        return self.datasets[dataset_id]

    def get_bundle(self, dataset_id: str) -> Bundle:
        with self._lock:
            cached = self._bundle_cache.get(dataset_id)
        if cached is not None:
            return cached
        info = self.get_dataset_info(dataset_id)
        price = np.load(info.bundle_dir / "price_array.npy")
        tech = np.load(info.bundle_dir / "tech_array.npy")
        timestamps = pd.read_csv(info.bundle_dir / "timestamps.csv")["datetime"]
        metadata = json.loads((info.bundle_dir / "metadata.json").read_text(encoding="utf-8"))
        bundle = Bundle(info=info, price_array=price, tech_array=tech, timestamps=timestamps, metadata=metadata)
        with self._lock:
            self._bundle_cache[dataset_id] = bundle
        return bundle

    def get_model(self, model_id: str):
        """Load (and cache) an SB3 model. Fine-tuned saves invalidate the cache."""
        info = self.get_model_info(model_id)
        with self._lock:
            cached = self._model_cache.get(model_id)
        key = (info.path, info.path.stat().st_mtime_ns)
        if cached is not None and cached[0] == key:
            return cached[1]
        if info.algo == "recurrent_ppo":
            from sb3_contrib import RecurrentPPO

            model = RecurrentPPO.load(info.path, device="cpu")
        else:
            from stable_baselines3 import PPO

            model = PPO.load(info.path, device="cpu")
        with self._lock:
            self._model_cache[model_id] = (key, model)
        return model

    def catalog(self) -> dict:
        return {
            "models": [vars(m) | {"path": str(m.path)} for m in self.models.values()],
            "datasets": [vars(d) | {"bundle_dir": str(d.bundle_dir)} for d in self.datasets.values()],
            "defaultEnvParams": DEFAULT_ENV_PARAMS,
            "defaultSelection": self._default_selection(),
        }

    def _default_selection(self) -> dict:
        preferred_model = next(
            (m for m in self.models if "colab" in m and m.endswith("t4")),
            next(iter(self.models), ""),
        )
        preferred_dataset = next(
            (d for d in self.datasets if d.endswith("5m_btc_usdt_eth_usdt") and "colab" in d and "test" in d),
            next(iter(self.datasets), ""),
        )
        return {"model_id": preferred_model, "dataset_id": preferred_dataset}

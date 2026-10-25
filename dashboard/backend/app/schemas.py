from __future__ import annotations

from pydantic import BaseModel, Field


class EnvParams(BaseModel):
    """Parameters exposed to the dashboard. All optional — defaults come from the catalog."""

    initial_cash: float = Field(default=10_000.0, gt=0, le=10_000_000)
    buy_cost_pct: float = Field(default=0.001, ge=0, le=0.05)
    sell_cost_pct: float = Field(default=0.001, ge=0, le=0.05)
    reward_mode: str = Field(default="return_cost_risk_volatility")
    reward_scaling: float = Field(default=1.0, ge=0, le=100)
    cost_penalty_weight: float = Field(default=1.0, ge=0, le=100)
    risk_penalty_weight: float = Field(default=0.005, ge=0, le=100)
    volatility_reward_weight: float = Field(default=0.01, ge=0, le=100)
    volatility_window: int = Field(default=288, ge=2, le=10_000)
    risk_adjusted_return_clip: float = Field(default=5.0, gt=0, le=100)
    max_position_fraction: float = Field(default=0.50, gt=0, le=1)
    max_trade_fraction: float = Field(default=0.25, gt=0, le=1)
    stop_loss_pct: float = Field(default=0.08, gt=0, lt=1)
    max_drawdown_pct: float = Field(default=0.20, gt=0, lt=1)
    cooldown_steps: int = Field(default=0, ge=0, le=10_000)


class BacktestRequest(BaseModel):
    model_id: str
    dataset_id: str
    params: EnvParams = Field(default_factory=EnvParams)


class TrainRequest(BaseModel):
    base_model_id: str
    algo: str = Field(default="", description="'' = same as base model; else 'ppo' | 'recurrent_ppo'")
    train_dataset_id: str
    val_dataset_id: str | None = Field(default=None)
    test_dataset_id: str
    params: EnvParams = Field(default_factory=EnvParams)
    total_timesteps: int = Field(default=20_000, ge=500, le=2_000_000)
    learning_rate: float | None = Field(default=None, gt=0, le=0.1)
    run_label: str = Field(default="")


class CandleRequest(BaseModel):
    dataset_id: str
    symbol: str  # "BTC/USDT" or "ETH/USDT"
    max_candles: int = Field(default=1200, ge=100, le=4000)

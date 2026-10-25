from __future__ import annotations

import numpy as np

from profit_pilot.env.multi_crypto_env import MultiCryptoTradingEnv

from .registry import Bundle, ModelInfo

# steps per year for annualized metrics
STEPS_PER_YEAR = {"5m": 365 * 24 * 12, "1h": 365 * 24, "1d": 365}

TRADE_EPSILON = 1e-6


def _downsample(values: list, max_points: int) -> list:
    n = len(values)
    if n <= max_points:
        return values
    idx = np.unique(np.linspace(0, n - 1, max_points, dtype=int))
    return [values[int(i)] for i in idx]


def compute_metrics(values: list[float], ann_factor: float) -> dict:
    arr = np.asarray(values, dtype=np.float64)
    initial, final = float(arr[0]), float(arr[-1])
    rets = np.diff(arr) / np.maximum(arr[:-1], 1e-8)
    n = max(len(rets), 1)
    years = n / ann_factor

    total_return = final / initial - 1.0
    growth = max(final / initial, 1e-8)
    ann_return = growth ** (1.0 / max(years, 1e-8)) - 1.0

    std = float(np.std(rets, ddof=1)) if n > 1 else 0.0
    sharpe = float(np.mean(rets) / std * np.sqrt(ann_factor)) if std > 0 else 0.0
    downside = rets[rets < 0]
    dstd = float(np.std(downside, ddof=1)) if len(downside) > 1 else 0.0
    sortino = float(np.mean(rets) / dstd * np.sqrt(ann_factor)) if dstd > 0 else 0.0

    peaks = np.maximum.accumulate(arr)
    drawdowns = (peaks - arr) / np.maximum(peaks, 1e-8)
    max_dd = float(np.max(drawdowns))
    calmar = ann_return / max_dd if max_dd > 0 else 0.0
    win_rate = float(np.mean(rets > 0)) if n else 0.0

    return {
        "initial_value": round(initial, 2),
        "final_value": round(final, 2),
        "total_return_pct": round(total_return * 100, 4),
        "annualized_return_pct": round(ann_return * 100, 4),
        "annualized_volatility_pct": round(std * np.sqrt(ann_factor) * 100, 4),
        "sharpe": round(sharpe, 4),
        "sortino": round(sortino, 4),
        "max_drawdown_pct": round(max_dd * 100, 4),
        "calmar": round(calmar, 4),
        "win_rate_pct": round(win_rate * 100, 2),
    }


def run_backtest(
    model,
    model_info: ModelInfo,
    bundle: Bundle,
    params: dict,
    max_points: int = 2800,
    max_markers: int = 1600,
) -> dict:
    """Deterministic evaluation identical to evaluate_model.py, with full telemetry.

    Trades are reconstructed from per-step holdings deltas (the env itself keeps
    no trade log), fees are split across a step's fills proportionally to gross
    value, and realized P&L on sells uses the env's weighted-average entry price.
    """
    tickers = bundle.info.symbols
    env_kwargs = {k: v for k, v in params.items() if k != "initial_cash"}
    env = MultiCryptoTradingEnv(
        price_array=bundle.price_array,
        tech_array=bundle.tech_array,
        tickers=tickers,
        lookback=model_info.lookback,
        initial_cash=params.get("initial_cash", 10_000.0),
        cash_norm=1e-4,
        holdings_norm=1.0,
        tech_norm=1.0,
        **env_kwargs,
    )

    timestamps = bundle.timestamps.tolist()
    n_assets = env.n_assets

    observation, _ = env.reset()
    use_lstm = model_info.algo == "recurrent_ppo"
    lstm_state = None
    episode_start = np.array([True])

    # per-step series (step 0 = state right after reset)
    series_t: list[int] = [env.time]
    series_pv: list[float] = [env.portfolio_value]
    series_bench: list[float] = [env.equal_weight_value]
    series_cash: list[float] = [env.cash]
    series_pos: list[list[float]] = [[0.0] * n_assets]
    series_reward: list[float] = [0.0]
    series_fees_cum: list[float] = [0.0]
    series_drawdown: list[float] = [0.0]
    series_vol: list[float] = [0.0]
    # per-step reward decomposition (weighted, so they sum to the step reward)
    series_reward_ret: list[float] = [0.0]
    series_reward_cost: list[float] = [0.0]
    series_reward_risk: list[float] = [0.0]
    series_reward_vol: list[float] = [0.0]

    trades: list[dict] = []
    symbols_by_index = tickers

    prev_holdings = np.zeros(n_assets, dtype=np.float64)
    prev_entry = np.zeros(n_assets, dtype=np.float64)

    done = False
    total_reward = 0.0
    total_fees_cum = 0.0
    while not done:
        if use_lstm:
            action, lstm_state = model.predict(
                observation, state=lstm_state, episode_start=episode_start, deterministic=True
            )
        else:
            action, _ = model.predict(observation, deterministic=True)

        observation, reward, terminated, truncated, info = env.step(action)
        done = terminated or truncated
        total_reward += float(reward)

        t = env.time
        prices = env.price_array[t]
        holdings = info["holdings"].astype(np.float64)
        step_fee_total = float(info["total_fees"])

        # ---- reconstruct fills from the holdings delta
        deltas = holdings - prev_holdings
        active = np.where(np.abs(deltas) > TRADE_EPSILON)[0]
        if len(active) > 0:
            gross_values = np.array([abs(float(deltas[i])) * float(prices[i]) for i in active])
            gross_sum = float(gross_values.sum())
            for k, i in enumerate(active):
                qty = abs(float(deltas[i]))
                price = float(prices[i])
                is_buy = deltas[i] > 0
                if info["risk_halted"]:
                    reason = "risk-halt"
                elif symbols_by_index[i] in info["stop_loss_symbols"]:
                    reason = "stop-loss"
                elif (not is_buy) and symbols_by_index[i] in info["position_cap_symbols"]:
                    reason = "position-cap"
                else:
                    reason = "agent"
                fee = step_fee_total * (float(gross_values[k]) / gross_sum) if gross_sum > 0 else 0.0
                realized_pnl = None
                if not is_buy and prev_entry[i] > 0:
                    realized_pnl = (price - float(prev_entry[i])) * qty
                trades.append(
                    {
                        "t": t,
                        "ts": timestamps[t],
                        "s": int(i),
                        "side": "buy" if is_buy else "sell",
                        "price": round(price, 2),
                        "qty": float(round(qty, 8)),
                        "value": round(float(gross_values[k]), 2),
                        "fee": round(float(fee), 4),
                        "pnl": round(float(realized_pnl), 2) if realized_pnl is not None else None,
                        "reason": reason,
                    }
                )

        total_fees_cum += step_fee_total
        scale = float(params.get("reward_scaling", 1.0))
        comp_ret = float(info["portfolio_return"]) * scale
        comp_cost = -float(params.get("cost_penalty_weight", 1.0)) * float(info["cost_penalty"]) * scale
        comp_risk = -float(params.get("risk_penalty_weight", 0.005)) * float(info["drawdown"]) * scale
        comp_vol = (
            float(params.get("volatility_reward_weight", 0.01)) * float(info["risk_adjusted_return"]) * scale
            if params.get("reward_mode") == "return_cost_risk_volatility"
            else 0.0
        )
        series_t.append(t)
        series_pv.append(float(info["portfolio_value"]))
        series_bench.append(float(info["benchmark_value"]))
        series_cash.append(float(info["cash"]))
        series_pos.append([float(holdings[i] * float(prices[i])) for i in range(n_assets)])
        series_reward.append(float(reward))
        series_reward_ret.append(comp_ret)
        series_reward_cost.append(comp_cost)
        series_reward_risk.append(comp_risk)
        series_reward_vol.append(comp_vol)
        series_fees_cum.append(total_fees_cum)
        series_drawdown.append(float(info["drawdown"]))
        series_vol.append(float(info["rolling_volatility"]))

        prev_holdings = holdings.copy()
        prev_entry = info["entry_prices"].astype(np.float64).copy()
        episode_start = np.array([done])

    ann_factor = STEPS_PER_YEAR.get(bundle.info.timeframe, 365 * 24)
    agent_metrics = compute_metrics(series_pv, ann_factor)
    bench_metrics = compute_metrics(series_bench, ann_factor)
    agent_metrics["total_reward"] = round(total_reward, 4)
    agent_metrics["total_fees"] = round(total_fees_cum, 2)
    agent_metrics["trade_events"] = len(trades)
    agent_metrics["risk_halted"] = bool(env.risk_halted)
    agent_metrics["alpha_vs_benchmark_pct"] = round(
        agent_metrics["total_return_pct"] - bench_metrics["total_return_pct"], 4
    )

    # per-symbol aggregates
    symbol_stats = []
    for i, sym in enumerate(symbols_by_index):
        sym_trades = [tr for tr in trades if tr["s"] == i]
        sells = [tr for tr in sym_trades if tr["side"] == "sell" and tr["pnl"] is not None]
        wins = [tr for tr in sells if tr["pnl"] > 0]
        symbol_stats.append(
            {
                "symbol": sym,
                "buys": sum(1 for tr in sym_trades if tr["side"] == "buy"),
                "sells": sum(1 for tr in sym_trades if tr["side"] == "sell"),
                "realized_pnl": round(sum(tr["pnl"] for tr in sells), 2),
                "fees": round(sum(tr["fee"] for tr in sym_trades), 2),
                "win_rate_pct": round(100 * len(wins) / len(sells), 2) if sells else 0.0,
            }
        )

    # downsampled series payloads
    ts_sampled = _downsample(series_t, max_points)
    ts_map = {t: timestamps[t] for t in ts_sampled}
    down = {
        "t": ts_sampled,
        "ts": [ts_map[t] for t in ts_sampled],
        "portfolio": _downsample(series_pv, max_points),
        "benchmark": _downsample(series_bench, max_points),
        "cash": _downsample(series_cash, max_points),
        "positions": [_downsample([p[i] for p in series_pos], max_points) for i in range(n_assets)],
        "reward": _downsample(series_reward, max_points),
        "reward_ret": _downsample(series_reward_ret, max_points),
        "reward_cost": _downsample(series_reward_cost, max_points),
        "reward_risk": _downsample(series_reward_risk, max_points),
        "reward_vol": _downsample(series_reward_vol, max_points),
        "fees_cum": _downsample(series_fees_cum, max_points),
        "drawdown": _downsample(series_drawdown, max_points),
        "volatility": _downsample(series_vol, max_points),
    }

    # compact chart markers: group consecutive same-side trades per symbol
    markers = _build_markers(trades, timestamps, max_markers)

    return {
        "model_id": model_info.id,
        "model_name": model_info.name,
        "dataset_id": bundle.info.id,
        "dataset_label": bundle.info.label,
        "timeframe": bundle.info.timeframe,
        "symbols": symbols_by_index,
        "lookback": model_info.lookback,
        "params": params,
        "metrics": {"agent": agent_metrics, "benchmark": bench_metrics},
        "symbol_stats": symbol_stats,
        "series": down,
        "trades": trades,
        "markers": markers,
        "n_steps": len(series_t) - 1,
    }


def _build_markers(trades: list[dict], timestamps: list[str], max_markers: int) -> list[dict]:
    def key(tr: dict) -> tuple:
        return (tr["s"], tr["side"])

    grouped: list[dict] = []
    for tr in trades:
        if grouped and key(grouped[-1]) == key(tr) and tr["t"] - grouped[-1]["t0"] <= 3:
            g = grouped[-1]
            g["count"] += 1
            g["value"] += tr["value"]
            g["t"] = tr["t"]  # marker at end of the run
            g["pnl"] = (g["pnl"] or 0) + (tr["pnl"] or 0) if tr["side"] == "sell" else g["pnl"]
        else:
            grouped.append(
                {
                    "s": tr["s"],
                    "side": tr["side"],
                    "t": tr["t"],
                    "t0": tr["t"],
                    "count": 1,
                    "value": tr["value"],
                    "pnl": tr["pnl"],
                }
            )
    if len(grouped) > max_markers:
        idx = np.unique(np.linspace(0, len(grouped) - 1, max_markers, dtype=int))
        grouped = [grouped[int(i)] for i in idx]
    for g in grouped:
        g.pop("t0", None)
        g["ts"] = timestamps[g["t"]]
    return grouped

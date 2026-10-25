from __future__ import annotations

import threading
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

SYMBOL_SLUGS = {"BTC/USDT": "btc_usdt", "ETH/USDT": "eth_usdt"}


@dataclass
class RawFile:
    symbol_slug: str
    timeframe: str
    path: Path
    start: pd.Timestamp
    end: pd.Timestamp


class CandleService:
    """Indexes the repo's raw OHLCV CSVs and serves downsampled candles."""

    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root
        self._index: list[RawFile] = []
        self._cache: dict[Path, pd.DataFrame] = {}
        self._lock = threading.Lock()
        self.build_index()

    @staticmethod
    def _last_line(path: Path) -> str:
        with path.open("rb") as handle:
            handle.seek(0, 2)  # end of file
            size = handle.tell()
            handle.seek(max(0, size - 4096))
            tail = handle.read()
        return tail.rstrip(b"\r\n").splitlines()[-1].decode("utf-8", errors="replace")

    def build_index(self) -> None:
        files: list[RawFile] = []
        for csv_path in sorted((self.repo_root / "data").glob("raw*/**/*.csv")):
            slug = csv_path.stem
            if slug not in SYMBOL_SLUGS.values():
                continue
            timeframe = csv_path.parent.name
            try:
                first_row = pd.read_csv(csv_path, nrows=1).iloc[0]
                first_ts = pd.Timestamp(first_row["datetime"])
                # last line holds "<ts>,<o>,<h>,<l>,<c>,<v>,<datetime>,<symbol>" — take the datetime column
                last_ts = pd.Timestamp(self._last_line(csv_path).split(",")[6])
            except (OSError, KeyError, ValueError, IndexError):
                continue
            files.append(
                RawFile(
                    symbol_slug=slug,
                    timeframe=timeframe,
                    path=csv_path,
                    start=first_ts,
                    end=last_ts,
                )
            )
        with self._lock:
            self._index = files
            self._cache.clear()

    def _load_frame(self, path: Path) -> pd.DataFrame:
        with self._lock:
            cached = self._cache.get(path)
        if cached is not None:
            return cached
        df = pd.read_csv(path, usecols=["datetime", "open", "high", "low", "close", "volume"])
        df["datetime"] = pd.to_datetime(df["datetime"], utc=True)
        df = df.sort_values("datetime").reset_index(drop=True)
        with self._lock:
            # keep the cache bounded
            if len(self._cache) >= 8:
                self._cache.clear()
            self._cache[path] = df
        return df

    def _best_file(self, symbol: str, timeframe: str, start: pd.Timestamp, end: pd.Timestamp) -> RawFile | None:
        slug = SYMBOL_SLUGS.get(symbol, symbol.lower().replace("/", "_"))
        candidates = [f for f in self._index if f.symbol_slug == slug and f.timeframe == timeframe]
        if not candidates:
            return None
        # prefer full coverage, then the longest overlap
        def coverage(f: RawFile) -> tuple[bool, float]:
            overlap = (min(f.end, end) - max(f.start, start)).total_seconds()
            covers = f.start <= start and f.end >= end
            return (covers, overlap)

        return max(candidates, key=coverage)

    def get_candles(
        self,
        symbol: str,
        timeframe: str,
        start: str,
        end: str,
        max_candles: int = 1200,
    ) -> dict:
        start_ts = pd.Timestamp(start)
        end_ts = pd.Timestamp(end)
        if start_ts.tzinfo is None:
            start_ts = start_ts.tz_localize("UTC")
        if end_ts.tzinfo is None:
            end_ts = end_ts.tz_localize("UTC")

        raw = self._best_file(symbol, timeframe, start_ts, end_ts)
        if raw is None:
            raise KeyError(f"No raw OHLCV data for {symbol} ({timeframe}) covering {start} → {end}")

        df = self._load_frame(raw.path)
        window = df[(df["datetime"] >= start_ts) & (df["datetime"] <= end_ts)].reset_index(drop=True)
        if window.empty:
            raise KeyError(f"No candles in range for {symbol}")

        stride = max(1, int(np.ceil(len(window) / max_candles)))
        if stride == 1:
            sampled = window
        else:
            n_groups = int(np.ceil(len(window) / stride))
            trimmed = window.iloc[: n_groups * stride]
            grouped = trimmed.assign(_group=np.arange(len(trimmed)) // stride).groupby("_group")
            sampled = pd.DataFrame(
                {
                    "datetime": window["datetime"].iloc[::stride].iloc[:n_groups].to_numpy(),
                    "open": grouped["open"].first(),
                    "high": grouped["high"].max(),
                    "low": grouped["low"].min(),
                    "close": grouped["close"].last(),
                    "volume": grouped["volume"].sum(),
                }
            ).reset_index(drop=True)

        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "source": str(raw.path.relative_to(self.repo_root)),
            "stride": stride,
            "time": [(int(t.timestamp())) for t in sampled["datetime"]],
            "open": [float(v) for v in sampled["open"]],
            "high": [float(v) for v in sampled["high"]],
            "low": [float(v) for v in sampled["low"]],
            "close": [float(v) for v in sampled["close"]],
            "volume": [float(v) for v in sampled["volume"]],
        }

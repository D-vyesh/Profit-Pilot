"""Profit-Pilot dashboard backend package."""

from __future__ import annotations

import sys
from pathlib import Path

# repo_root = dashboard/backend/app -> up three levels
REPO_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

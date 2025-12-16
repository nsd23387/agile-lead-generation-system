from __future__ import annotations

from typing import Any

from .config import ScoreRule
from .segments import match_filter


def score_lead(lead: dict[str, Any], rules: list[ScoreRule]) -> int:
    score = 0
    for r in rules:
        if match_filter(lead, r):
            score += int(r.points)
    return score

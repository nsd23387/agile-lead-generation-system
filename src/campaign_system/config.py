from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class FilterRule:
    field: str
    op: str
    value: Any | None = None


@dataclass(frozen=True)
class Segment:
    name: str
    filters: list[FilterRule]


@dataclass(frozen=True)
class ScoreRule:
    points: int
    field: str
    op: str
    value: Any | None = None


@dataclass(frozen=True)
class SystemConfig:
    segments: list[Segment]
    score_rules: list[ScoreRule]
    defaults: dict[str, Any]

    @staticmethod
    def load(path: str | Path) -> "SystemConfig":
        p = Path(path)
        data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}

        segments: list[Segment] = []
        for s in data.get("segments", []) or []:
            filters = [
                FilterRule(field=f["field"], op=f["op"], value=f.get("value"))
                for f in (s.get("filters", []) or [])
            ]
            segments.append(Segment(name=s["name"], filters=filters))

        score_rules: list[ScoreRule] = []
        scoring = data.get("scoring", {}) or {}
        for r in scoring.get("rules", []) or []:
            score_rules.append(
                ScoreRule(points=int(r["points"]), field=r["field"], op=r["op"], value=r.get("value"))
            )

        defaults = data.get("defaults", {}) or {}
        return SystemConfig(segments=segments, score_rules=score_rules, defaults=defaults)

    def get_segment(self, name: str) -> Segment:
        for s in self.segments:
            if s.name == name:
                return s
        raise KeyError(f"Unknown segment: {name}")

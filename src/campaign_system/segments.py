from __future__ import annotations

import re
from typing import Any

from .config import FilterRule


def _get(lead: dict[str, Any], field: str) -> Any:
    return lead.get(field)


def match_filter(lead: dict[str, Any], rule: FilterRule) -> bool:
    v = _get(lead, rule.field)
    op = rule.op
    target = rule.value

    if op == "not_empty":
        return v is not None and str(v).strip() != ""
    if op == "equals":
        return ("" if v is None else str(v)) == ("" if target is None else str(target))
    if op == "contains":
        if v is None or target is None:
            return False
        return str(target).lower() in str(v).lower()
    if op == "in":
        if target is None:
            return False
        values = target if isinstance(target, list) else [target]
        return str(v) in {str(x) for x in values}
    if op == "regex":
        if v is None or target is None:
            return False
        return re.search(str(target), str(v)) is not None

    raise ValueError(f"Unknown filter op: {op}")


def apply_filters(leads: list[dict[str, Any]], rules: list[FilterRule]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for lead in leads:
        if all(match_filter(lead, r) for r in rules):
            out.append(lead)
    return out

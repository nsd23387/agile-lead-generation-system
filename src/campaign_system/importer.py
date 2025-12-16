from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path

from .types import Lead


def _norm_key(k: str) -> str:
    return k.strip().lower()


def import_leads_csv(path: str | Path, source: str | None = None) -> list[Lead]:
    p = Path(path)
    out: list[Lead] = []
    now = datetime.now(timezone.utc)
    with p.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            r = {_norm_key(k): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
            email = (r.get("email") or "").strip()
            if not email:
                continue
            out.append(
                Lead(
                    id=None,
                    email=email,
                    first_name=r.get("first_name") or r.get("firstname"),
                    last_name=r.get("last_name") or r.get("lastname"),
                    company=r.get("company"),
                    title=r.get("title"),
                    website=r.get("website"),
                    source=source,
                    tags=None,
                    score=0,
                    created_at=now,
                )
            )
    return out

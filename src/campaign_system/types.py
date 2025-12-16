from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class Lead:
    id: int | None
    email: str
    first_name: str | None = None
    last_name: str | None = None
    company: str | None = None
    title: str | None = None
    website: str | None = None
    source: str | None = None
    tags: list[str] | None = None
    score: int = 0
    created_at: datetime | None = None

    def as_context(self) -> dict[str, Any]:
        return {
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "company": self.company,
            "title": self.title,
            "website": self.website,
            "source": self.source,
            "tags": self.tags or [],
            "score": self.score,
        }

from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from .types import Lead


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self, path: str | Path):
        self.path = str(path)

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def init(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS leads (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  email TEXT NOT NULL UNIQUE,
                  first_name TEXT,
                  last_name TEXT,
                  company TEXT,
                  title TEXT,
                  website TEXT,
                  source TEXT,
                  tags_json TEXT,
                  score INTEGER NOT NULL DEFAULT 0,
                  created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS campaigns (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT NOT NULL,
                  segment_name TEXT NOT NULL,
                  subject_template TEXT NOT NULL,
                  body_template TEXT NOT NULL,
                  channel TEXT NOT NULL,
                  created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS messages (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
                  channel TEXT NOT NULL,
                  subject TEXT NOT NULL,
                  body TEXT NOT NULL,
                  status TEXT NOT NULL,
                  created_at TEXT NOT NULL,
                  UNIQUE(campaign_id, lead_id)
                );

                CREATE TABLE IF NOT EXISTS events (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
                  event_type TEXT NOT NULL,
                  payload_json TEXT,
                  created_at TEXT NOT NULL
                );
                """
            )

    def upsert_leads(self, leads: Iterable[Lead]) -> int:
        count = 0
        with self.connect() as conn:
            for lead in leads:
                tags_json = json.dumps(lead.tags or [])
                conn.execute(
                    """
                    INSERT INTO leads (email, first_name, last_name, company, title, website, source, tags_json, score, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(email) DO UPDATE SET
                      first_name=excluded.first_name,
                      last_name=excluded.last_name,
                      company=excluded.company,
                      title=excluded.title,
                      website=excluded.website,
                      source=excluded.source,
                      tags_json=excluded.tags_json,
                      score=excluded.score
                    """,
                    (
                        lead.email,
                        lead.first_name,
                        lead.last_name,
                        lead.company,
                        lead.title,
                        lead.website,
                        lead.source,
                        tags_json,
                        int(lead.score),
                        lead.created_at.isoformat() if lead.created_at else utcnow_iso(),
                    ),
                )
                count += 1
        return count

    def list_leads(self, limit: int = 50) -> list[Lead]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT id, email, first_name, last_name, company, title, website, source, tags_json, score, created_at FROM leads ORDER BY score DESC, id DESC LIMIT ?",
                (int(limit),),
            ).fetchall()

        out: list[Lead] = []
        for r in rows:
            out.append(
                Lead(
                    id=int(r["id"]),
                    email=str(r["email"]),
                    first_name=r["first_name"],
                    last_name=r["last_name"],
                    company=r["company"],
                    title=r["title"],
                    website=r["website"],
                    source=r["source"],
                    tags=json.loads(r["tags_json"] or "[]"),
                    score=int(r["score"] or 0),
                    created_at=datetime.fromisoformat(r["created_at"]),
                )
            )
        return out

    def get_all_leads_as_dicts(self) -> list[dict[str, Any]]:
        leads = self.list_leads(limit=1000000)
        out: list[dict[str, Any]] = []
        for l in leads:
            d = l.as_context()
            d["id"] = l.id
            out.append(d)
        return out

    def create_campaign(
        self,
        name: str,
        segment_name: str,
        subject_template: str,
        body_template: str,
        channel: str,
    ) -> int:
        with self.connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO campaigns (name, segment_name, subject_template, body_template, channel, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (name, segment_name, subject_template, body_template, channel, utcnow_iso()),
            )
            return int(cur.lastrowid)

    def get_campaign(self, campaign_id: int) -> dict[str, Any]:
        with self.connect() as conn:
            r = conn.execute(
                "SELECT id, name, segment_name, subject_template, body_template, channel, created_at FROM campaigns WHERE id=?",
                (int(campaign_id),),
            ).fetchone()
        if r is None:
            raise KeyError(f"Unknown campaign id: {campaign_id}")
        return dict(r)

    def insert_messages(self, campaign_id: int, rows: Iterable[dict[str, Any]]) -> int:
        count = 0
        with self.connect() as conn:
            for row in rows:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO messages (campaign_id, lead_id, channel, subject, body, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        int(campaign_id),
                        int(row["lead_id"]),
                        str(row["channel"]),
                        str(row["subject"]),
                        str(row["body"]),
                        str(row.get("status", "draft")),
                        utcnow_iso(),
                    ),
                )
                count += 1
        return count

    def list_messages(self, campaign_id: int, limit: int = 20) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT m.id, m.lead_id, m.channel, m.subject, m.body, m.status, m.created_at,
                       l.email, l.first_name, l.last_name, l.company, l.title, l.website, l.score
                FROM messages m
                JOIN leads l ON l.id = m.lead_id
                WHERE m.campaign_id = ?
                ORDER BY l.score DESC, m.id ASC
                LIMIT ?
                """,
                (int(campaign_id), int(limit)),
            ).fetchall()
        return [dict(r) for r in rows]

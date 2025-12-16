from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from .config import SystemConfig
from .importer import import_leads_csv
from .render import render_from_file
from .scoring import score_lead
from .segments import apply_filters
from .storage import Database

app = typer.Typer(add_completion=False, no_args_is_help=True)
console = Console()


def _db(db: str) -> Database:
    return Database(db)


@app.command()
def init_db(db: str = typer.Option("campaign.db", help="SQLite DB file")) -> None:
    """Initialize the SQLite database."""
    d = _db(db)
    d.init()
    console.print(f"Initialized DB at {db}")


@app.command()
def import_leads(
    csv_path: str = typer.Argument(..., help="Path to leads CSV"),
    db: str = typer.Option("campaign.db", help="SQLite DB file"),
    source: Optional[str] = typer.Option(None, help="Source label stored with leads"),
    config: str = typer.Option("config/system.yaml", help="System config YAML"),
) -> None:
    """Import leads from CSV (upsert by email)."""
    d = _db(db)
    d.init()

    cfg = SystemConfig.load(config)
    leads = import_leads_csv(csv_path, source=source)

    # score before persisting
    scored = []
    for l in leads:
        ctx = l.as_context()
        s = score_lead(ctx, cfg.score_rules)
        scored.append(type(l)(**{**l.__dict__, "score": s}))

    n = d.upsert_leads(scored)
    console.print(f"Imported {n} leads into {db}")


@app.command()
def list_leads(
    db: str = typer.Option("campaign.db", help="SQLite DB file"),
    limit: int = typer.Option(20, help="Max rows"),
) -> None:
    """List leads ordered by score."""
    d = _db(db)
    d.init()
    leads = d.list_leads(limit=limit)

    t = Table(title="Leads")
    t.add_column("id", justify="right")
    t.add_column("score", justify="right")
    t.add_column("email")
    t.add_column("name")
    t.add_column("company")
    t.add_column("title")
    for l in leads:
        name = " ".join([x for x in [l.first_name, l.last_name] if x])
        t.add_row(str(l.id), str(l.score), l.email, name, l.company or "", l.title or "")
    console.print(t)


@app.command()
def create_campaign(
    name: str = typer.Argument(..., help="Campaign name"),
    segment: str = typer.Option("default", help="Segment name from config"),
    db: str = typer.Option("campaign.db", help="SQLite DB file"),
    config: str = typer.Option("config/system.yaml", help="System config YAML"),
    channel: Optional[str] = typer.Option(None, help="Channel (default from config)"),
    subject_template: Optional[str] = typer.Option(None, help="Path to Jinja subject template"),
    body_template: Optional[str] = typer.Option(None, help="Path to Jinja body template"),
    sender_name: str = typer.Option("Your Name", help="Used in templates"),
    topic: str = typer.Option("campaign performance", help="Used in templates"),
) -> None:
    """Create a campaign and generate draft messages (dry-run)."""
    d = _db(db)
    d.init()
    cfg = SystemConfig.load(config)

    seg = cfg.get_segment(segment)
    channel = channel or str(cfg.defaults.get("channel", "email"))
    subject_template = subject_template or str(cfg.defaults.get("subject_template"))
    body_template = body_template or str(cfg.defaults.get("body_template"))

    leads = d.get_all_leads_as_dicts()
    matched = apply_filters(leads, seg.filters)

    campaign_id = d.create_campaign(
        name=name,
        segment_name=segment,
        subject_template=subject_template,
        body_template=body_template,
        channel=channel,
    )

    rows = []
    for lead in matched:
        context = {
            **lead,
            "sender_name": sender_name,
            "topic": topic,
        }
        subject = render_from_file(subject_template, context)
        body = render_from_file(body_template, context)
        rows.append(
            {
                "lead_id": int(lead["id"]),
                "channel": channel,
                "subject": subject.strip("\n"),
                "body": body,
                "status": "draft",
            }
        )

    d.insert_messages(campaign_id, rows)
    console.print(
        f"Created campaign {campaign_id} with {len(rows)} draft messages (dry-run; no sending)."
    )


@app.command()
def preview_campaign(
    campaign_id: int = typer.Argument(..., help="Campaign id"),
    db: str = typer.Option("campaign.db", help="SQLite DB file"),
    limit: int = typer.Option(5, help="Max messages to print"),
) -> None:
    """Preview generated messages (dry-run)."""
    d = _db(db)
    d.init()
    camp = d.get_campaign(campaign_id)
    msgs = d.list_messages(campaign_id, limit=limit)

    console.print(f"Campaign: {camp['id']} {camp['name']} (segment={camp['segment_name']})")
    for m in msgs:
        console.rule(f"Message {m['id']} → {m['email']} (score={m['score']}, status={m['status']})")
        console.print(f"Subject: {m['subject']}")
        console.print(m["body"].rstrip())


@app.command()
def export_messages(
    campaign_id: int = typer.Argument(..., help="Campaign id"),
    out: str = typer.Option("messages.jsonl", help="Output JSONL path"),
    db: str = typer.Option("campaign.db", help="SQLite DB file"),
) -> None:
    """Export messages as JSONL (for review/approval workflows)."""
    d = _db(db)
    d.init()
    msgs = d.list_messages(campaign_id, limit=1000000)

    p = Path(out)
    with p.open("w", encoding="utf-8") as f:
        for m in msgs:
            f.write(json.dumps(m, ensure_ascii=False) + "\n")

    console.print(f"Exported {len(msgs)} messages to {out}")

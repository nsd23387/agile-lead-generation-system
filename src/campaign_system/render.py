from __future__ import annotations

from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined


def _env(root: Path) -> Environment:
    return Environment(
        loader=FileSystemLoader(str(root)),
        undefined=StrictUndefined,
        autoescape=False,
        keep_trailing_newline=True,
    )


def render_from_file(template_path: str | Path, context: dict[str, Any]) -> str:
    p = Path(template_path)
    env = _env(p.parent)
    tmpl = env.get_template(p.name)
    return tmpl.render(**context)

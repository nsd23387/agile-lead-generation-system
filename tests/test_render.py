from pathlib import Path

from campaign_system.render import render_from_file


def test_render_from_file(tmp_path: Path):
    t = tmp_path / "t.j2"
    t.write_text("Hi {{ name }}", encoding="utf-8")
    assert render_from_file(t, {"name": "Alex"}) == "Hi Alex"

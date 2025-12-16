from campaign_system.config import FilterRule
from campaign_system.segments import apply_filters


def test_apply_filters_not_empty():
    leads = [
        {"email": "a@example.com", "company": "Acme"},
        {"email": "", "company": "Nope"},
        {"email": None, "company": "Nope"},
    ]
    rules = [FilterRule(field="email", op="not_empty")]
    out = apply_filters(leads, rules)
    assert [x["email"] for x in out] == ["a@example.com"]


def test_apply_filters_contains():
    leads = [
        {"email": "a@example.com", "title": "Head of Growth"},
        {"email": "b@example.com", "title": "Marketing Manager"},
    ]
    rules = [FilterRule(field="title", op="contains", value="head")]
    out = apply_filters(leads, rules)
    assert [x["email"] for x in out] == ["a@example.com"]

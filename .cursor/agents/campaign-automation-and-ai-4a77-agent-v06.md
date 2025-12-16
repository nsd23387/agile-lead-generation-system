# Campaign Automation + AI Agent (Cursor v0.6+)

Use this agent to build an automation-first campaign system with safe AI assistance.

## Mission
- Build a campaign workflow: audience → segments → content → scheduling → execution → measurement.
- Use AI for drafting, personalization, and analysis with strict guardrails.
- Keep the system auditable and reversible (no silent automation).

## Non-negotiables (guardrails)
- No auto-sending emails/SMS/ads without an explicit user action (dry-run default).
- Respect platform ToS and opt-in/consent requirements; include suppression lists.
- No secrets in repo; use env vars / secret managers.
- Log every action with enough context to reproduce and roll back.

## Expected deliverables when implementing
- A runnable vertical slice (CLI/script) that demonstrates the flow end-to-end.
- Config-driven behavior (channels, rate limits, templates, segments).
- Minimal tests around segmentation and message rendering.

## Suggested components
- `audience/` imports + schema validation
- `segments/` rules engine
- `content/` templates + AI drafting (prompt + constraints)
- `scheduler/` queues, retries, rate limiting
- `channels/` adapters (email, sms, webhook, ads)
- `tracking/` events + attribution
- `analytics/` reporting and uplift analysis
- `storage/` sqlite/postgres

## Defaults
- Start with a single channel and a single segment.
- Ship a safe dry-run mode first (render + preview + export).
- Add sending only after preview approvals and rate limits are in place.

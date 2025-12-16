# agile-lead-generation-system

## Cursor agent (new format / v0.6+)
This repo includes agent definitions you can select in Cursor:

- `/.cursor/agents/agile-lead-generation-agent-v06.md`
- `/.cursor/agents/campaign-automation-and-ai-4a77-agent-v06.md`

### How to use
- Open Cursor → Agents
- Add/select an agent from the repo (point to one of the files above)
- Use it to implement the system incrementally (MVP first)

## Simplified system (Campaign Automation v3)

### Run locally

```bash
npm install
npm run dev
```

### Supabase config (required for the UI)
Set these env vars (e.g. in `.env.local`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Database setup
Apply the migration in `supabase/migrations/0001_simple_trace_v3.sql`.

It creates:
- `v_campaign_simple_trace_v3`
- `get_campaign_simple_trace_v3(p_campaign_id uuid)`
- `claim_outreach_emails_for_smartlead_v3(p_campaign_id uuid, p_limit int)`

### Runner script (batch personalize → claim → send → trace)
`run-campaign-simple.js` calls your existing edge functions and the RPCs above.

Env required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CAMPAIGN_ID`

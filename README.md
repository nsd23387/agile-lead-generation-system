# agile-lead-generation-system

## Cursor agent (new format / v0.6+)
This repo includes agent definitions you can select in Cursor:

- `/.cursor/agents/agile-lead-generation-agent-v06.md`
- `/.cursor/agents/campaign-automation-and-ai-4a77-agent-v06.md`

### How to use
- Open Cursor → Agents
- Add/select an agent from the repo (point to one of the files above)
- Use it to implement the system incrementally (MVP first)

## Simplified system (React + optional Supabase)

### Run locally

```bash
npm install
npm run dev
```

### Optional: Supabase persistence
Set these env vars (e.g. in `.env.local`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The app will still work without Supabase (draft generation is always dry-run).

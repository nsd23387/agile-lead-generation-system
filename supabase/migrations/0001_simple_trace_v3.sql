-- Simplified campaign automation schema (v3)
--
-- Goal: one traceable campaign flow
-- - Trace counts at each stage (view + RPC)
-- - Queue ready outreach emails for Smartlead (RPC)
-- - Replies are captured in reply_events

create extension if not exists pgcrypto;

-- Core campaign + audience
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists campaign_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  company text,
  title text,
  website text,
  created_at timestamptz not null default now(),
  unique (campaign_id, email)
);

create index if not exists campaign_leads_campaign_id_idx on campaign_leads(campaign_id);

-- Outbound emails created after personalization
-- (ai-personalization edge function is expected to populate subject/body)
create table if not exists outreach_emails (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  lead_id uuid not null references campaign_leads(id) on delete cascade,
  subject text,
  body text,
  status text not null default 'ready' check (status in ('ready', 'claimed', 'sent', 'failed')),
  claimed_at timestamptz,
  sent_at timestamptz,
  smartlead_payload jsonb,
  created_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);

create index if not exists outreach_emails_campaign_status_idx on outreach_emails(campaign_id, status);

-- Replies captured by your existing reply ingestion
create table if not exists reply_events (
  id bigserial primary key,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  lead_id uuid references campaign_leads(id) on delete set null,
  message_id text,
  reply_text text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reply_events_campaign_id_idx on reply_events(campaign_id);

-- RPC: return a single JSON trace for a campaign
create or replace function public.get_campaign_simple_trace_v3(p_campaign_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_leads_total int;
  v_outreach_total int;
  v_ready int;
  v_claimed int;
  v_sent int;
  v_failed int;
  v_replies int;
begin
  select count(*) into v_leads_total from campaign_leads where campaign_id = p_campaign_id;

  select count(*) into v_outreach_total from outreach_emails where campaign_id = p_campaign_id;
  select count(*) into v_ready from outreach_emails where campaign_id = p_campaign_id and status = 'ready';
  select count(*) into v_claimed from outreach_emails where campaign_id = p_campaign_id and status = 'claimed';
  select count(*) into v_sent from outreach_emails where campaign_id = p_campaign_id and status = 'sent';
  select count(*) into v_failed from outreach_emails where campaign_id = p_campaign_id and status = 'failed';

  select count(*) into v_replies from reply_events where campaign_id = p_campaign_id;

  return jsonb_build_object(
    'campaign_id', p_campaign_id,
    'audience_total', coalesce(v_leads_total, 0),
    'personalized_total', coalesce(v_outreach_total, 0),
    'ready_total', coalesce(v_ready, 0),
    'claimed_total', coalesce(v_claimed, 0),
    'sent_total', coalesce(v_sent, 0),
    'failed_total', coalesce(v_failed, 0),
    'replies_total', coalesce(v_replies, 0),
    'updated_at', now()
  );
end;
$$;

-- RPC: claim a batch of ready outreach emails for Smartlead
-- Marks them as claimed and returns the rows needed for sending.
create or replace function public.claim_outreach_emails_for_smartlead_v3(
  p_campaign_id uuid,
  p_limit int default 50
)
returns table (
  outreach_email_id uuid,
  lead_id uuid,
  email text,
  first_name text,
  last_name text,
  company text,
  title text,
  website text,
  subject text,
  body text,
  smartlead_payload jsonb
)
language plpgsql
volatile
as $$
begin
  return query
  with to_claim as (
    select oe.id
    from outreach_emails oe
    where oe.campaign_id = p_campaign_id
      and oe.status = 'ready'
      and coalesce(oe.subject, '') <> ''
      and coalesce(oe.body, '') <> ''
    order by oe.created_at asc
    limit greatest(p_limit, 0)
    for update skip locked
  ), updated as (
    update outreach_emails oe
      set status = 'claimed',
          claimed_at = now()
    where oe.id in (select id from to_claim)
    returning oe.*
  )
  select
    u.id as outreach_email_id,
    l.id as lead_id,
    l.email,
    l.first_name,
    l.last_name,
    l.company,
    l.title,
    l.website,
    u.subject,
    u.body,
    u.smartlead_payload
  from updated u
  join campaign_leads l on l.id = u.lead_id;
end;
$$;

-- View: one row per campaign with embedded trace JSON
create or replace view public.v_campaign_simple_trace_v3 as
select
  c.id as campaign_id,
  c.name as campaign_name,
  public.get_campaign_simple_trace_v3(c.id) as trace
from campaigns c;

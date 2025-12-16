#!/usr/bin/env node

/**
 * Simplified campaign runner (v3)
 *
 * Flow:
 * 1) Call ai-personalization edge function (batch)
 * 2) Claim ready outreach emails via RPC
 * 3) Call outreach-engine edge function for each claimed email
 * 4) Print updated trace via RPC
 *
 * Required env:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - CAMPAIGN_ID
 *
 * Optional env:
 * - PERSONALIZATION_FN (default: ai-personalization)
 * - OUTREACH_FN (default: outreach-engine)
 * - BATCH_SIZE (default: 50)
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CAMPAIGN_ID = process.env.CAMPAIGN_ID;

const PERSONALIZATION_FN = process.env.PERSONALIZATION_FN || 'ai-personalization';
const OUTREACH_FN = process.env.OUTREACH_FN || 'outreach-engine';
const BATCH_SIZE = Number(process.env.BATCH_SIZE || '50');

function required(name, v) {
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function headers() {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    'Content-Type': 'application/json'
  };
}

async function callRpc(fn, body) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/${fn}`;
  const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const txt = await res.text();
  if (!res.ok) throw new Error(`RPC ${fn} failed (${res.status}): ${txt}`);
  return txt ? JSON.parse(txt) : null;
}

async function callEdgeFunction(fn, body) {
  const url = `${SUPABASE_URL}/functions/v1/${fn}`;
  const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Edge ${fn} failed (${res.status}): ${txt}`);
  try {
    return txt ? JSON.parse(txt) : null;
  } catch {
    return txt;
  }
}

async function main() {
  required('SUPABASE_URL', SUPABASE_URL);
  required('SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE);
  required('CAMPAIGN_ID', CAMPAIGN_ID);

  console.log(`Campaign: ${CAMPAIGN_ID}`);

  console.log(`1) Personalize (edge: ${PERSONALIZATION_FN})...`);
  await callEdgeFunction(PERSONALIZATION_FN, { campaign_id: CAMPAIGN_ID, limit: BATCH_SIZE });

  console.log('2) Claim ready emails (rpc: claim_outreach_emails_for_smartlead_v3)...');
  const claimed = await callRpc('claim_outreach_emails_for_smartlead_v3', {
    p_campaign_id: CAMPAIGN_ID,
    p_limit: BATCH_SIZE
  });

  console.log(`Claimed: ${Array.isArray(claimed) ? claimed.length : 0}`);

  if (Array.isArray(claimed) && claimed.length > 0) {
    console.log(`3) Send to Smartlead (edge: ${OUTREACH_FN})...`);
    for (const c of claimed) {
      await callEdgeFunction(OUTREACH_FN, {
        campaign_id: CAMPAIGN_ID,
        outreach_email_id: c.outreach_email_id,
        lead_id: c.lead_id,
        to: c.email,
        subject: c.subject,
        body: c.body,
        smartlead_payload: c.smartlead_payload
      });
    }
  }

  console.log('4) Trace (rpc: get_campaign_simple_trace_v3)...');
  const trace = await callRpc('get_campaign_simple_trace_v3', { p_campaign_id: CAMPAIGN_ID });
  console.log(JSON.stringify(trace, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

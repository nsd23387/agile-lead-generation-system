import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';
import type { CampaignSimpleTrace, CampaignSimpleTraceRow } from './lib/types';

function asNumber(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : Number(x ?? 0) || 0;
}

function normalizeTrace(raw: any): CampaignSimpleTrace {
  return {
    campaign_id: String(raw?.campaign_id ?? ''),
    audience_total: asNumber(raw?.audience_total),
    personalized_total: asNumber(raw?.personalized_total),
    ready_total: asNumber(raw?.ready_total),
    claimed_total: asNumber(raw?.claimed_total),
    sent_total: asNumber(raw?.sent_total),
    failed_total: asNumber(raw?.failed_total),
    replies_total: asNumber(raw?.replies_total),
    updated_at: String(raw?.updated_at ?? '')
  };
}

export default function App() {
  const [rows, setRows] = useState<CampaignSimpleTraceRow[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [trace, setTrace] = useState<CampaignSimpleTrace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = supabase != null;

  const selectedName = useMemo(() => {
    const r = rows.find((x) => x.campaign_id === selectedCampaignId);
    return r?.campaign_name ?? '';
  }, [rows, selectedCampaignId]);

  async function refreshCampaignList() {
    setError(null);
    if (!supabase) return;
    setLoading(true);
    try {
      const res = await supabase
        .from('v_campaign_simple_trace_v3')
        .select('campaign_id,campaign_name,trace');

      if (res.error) throw res.error;

      const list: CampaignSimpleTraceRow[] = (res.data ?? []).map((r: any) => ({
        campaign_id: String(r.campaign_id),
        campaign_name: String(r.campaign_name ?? ''),
        trace: normalizeTrace(r.trace)
      }));

      setRows(list);
      if (!selectedCampaignId && list.length > 0) setSelectedCampaignId(list[0].campaign_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function refreshTrace() {
    setError(null);
    if (!supabase) return;
    if (!selectedCampaignId) {
      setTrace(null);
      return;
    }

    setLoading(true);
    try {
      // Prefer single-RPC trace (matches the simplified design)
      const rpc = await supabase.rpc('get_campaign_simple_trace_v3', {
        p_campaign_id: selectedCampaignId
      });
      if (rpc.error) throw rpc.error;
      setTrace(normalizeTrace(rpc.data));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshCampaignList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refreshTrace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaignId]);

  if (!configured) {
    return (
      <div style={{ fontFamily: 'ui-sans-serif, system-ui', padding: 24, maxWidth: 980, margin: '0 auto' }}>
        <h2 style={{ margin: 0 }}>Campaign Automation (Simplified)</h2>
        <p style={{ color: '#555' }}>
          This panel reads from <code>v_campaign_simple_trace_v3</code>.
        </p>
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', padding: 12, borderRadius: 8 }}>
          Missing Supabase env vars. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'ui-sans-serif, system-ui', padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <h2 style={{ margin: 0 }}>Campaign Automation (Simplified)</h2>
      <p style={{ color: '#555' }}>
        Trace campaigns end-to-end (audience → personalized → ready → claimed → sent → replies). No sending happens from this UI.
      </p>

      {error && (
        <div style={{ background: '#fee', border: '1px solid #f99', padding: 12, borderRadius: 8 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={() => void refreshCampaignList()} disabled={loading} style={{ padding: '8px 12px' }}>
          Refresh list
        </button>
        <button onClick={() => void refreshTrace()} disabled={loading || !selectedCampaignId} style={{ padding: '8px 12px' }}>
          Refresh trace
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginTop: 16 }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Campaigns</div>
          <select
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            style={{ width: '100%', padding: 8 }}
          >
            {rows.length === 0 ? (
              <option value="">(none)</option>
            ) : (
              rows.map((r) => (
                <option key={r.campaign_id} value={r.campaign_id}>
                  {r.campaign_name || r.campaign_id}
                </option>
              ))
            )}
          </select>
          <div style={{ marginTop: 10, color: '#666', fontSize: 12 }}>
            Source: <code>v_campaign_simple_trace_v3</code>
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Trace {selectedName ? `— ${selectedName}` : ''}</div>
          {!trace ? (
            <div style={{ color: '#666' }}>Select a campaign to load its trace.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <Stat label="Audience" value={trace.audience_total} />
              <Stat label="Personalized" value={trace.personalized_total} />
              <Stat label="Ready" value={trace.ready_total} />
              <Stat label="Claimed" value={trace.claimed_total} />
              <Stat label="Sent" value={trace.sent_total} />
              <Stat label="Replies" value={trace.replies_total} />
              <Stat label="Failed" value={trace.failed_total} />
              <div style={{ gridColumn: '1 / -1', marginTop: 6, color: '#666', fontSize: 12 }}>
                Updated: <code>{trace.updated_at}</code>
              </div>
              <details style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                <summary>Raw trace JSON</summary>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(trace, null, 2)}</pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat(props: { label: string; value: number }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: 'white' }}>
      <div style={{ color: '#666', fontSize: 12 }}>{props.label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 2 }}>{props.value}</div>
    </div>
  );
}

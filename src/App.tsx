import React, { useMemo, useState } from 'react';
import { getSupabaseClient } from './lib/supabase';
import { parseLeadsCsv } from './lib/csv';
import type { DraftMessage, Lead } from './lib/types';
import { scoreLead, segmentLeads, type ScoringRule } from './lib/rules';
import { renderEmailDraft } from './lib/templates';

const DEFAULT_SEGMENT = { name: 'default', requireEmail: true } as const;
const DEFAULT_SCORING: ScoringRule[] = [
  { points: 10, field: 'title', op: 'contains', value: 'Head' },
  { points: 5, field: 'company', op: 'not_empty' }
];

function uid(): string {
  return crypto.randomUUID();
}

export default function App() {
  const [csvText, setCsvText] = useState<string>(
    'email,first_name,last_name,company,title,website\n' +
      'alex@example.com,Alex,Kim,Acme Inc,Head of Growth,https://acme.example\n' +
      'sam@example.com,Sam,Patel,Example Co,Marketing Manager,https://example.example\n'
  );
  const [senderName, setSenderName] = useState('Your Name');
  const [topic, setTopic] = useState('campaign performance');
  const [drafts, setDrafts] = useState<DraftMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabaseEnabled = useMemo(() => getSupabaseClient() != null, []);

  const leads: Lead[] = useMemo(() => {
    const parsed = parseLeadsCsv(csvText);
    const withScore = parsed
      .filter((l) => (l.email ?? '').trim() !== '')
      .map((l) => {
        const score = scoreLead(l, DEFAULT_SCORING);
        return {
          id: uid(),
          email: l.email,
          first_name: l.first_name,
          last_name: l.last_name,
          company: l.company,
          title: l.title,
          website: l.website,
          score,
          segment: DEFAULT_SEGMENT.name
        } satisfies Lead;
      });

    return segmentLeads(withScore, DEFAULT_SEGMENT).sort((a, b) => b.score - a.score);
  }, [csvText]);

  function generateDrafts() {
    setError(null);
    try {
      const out = leads.map((l) => renderEmailDraft(l, { senderName, topic }));
      setDrafts(out);
    } catch (e) {
      setDrafts(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function saveToSupabase() {
    setError(null);
    const client = getSupabaseClient();
    if (!client) {
      setError('Supabase not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
      return;
    }
    if (!drafts || drafts.length === 0) {
      setError('Generate drafts first.');
      return;
    }

    // This is intentionally a best-effort placeholder. You’ll need tables:
    // - leads(id uuid, email text, first_name text, last_name text, company text, title text, website text, score int, segment text)
    // - drafts(id uuid, lead_id uuid, to text, subject text, body text)
    try {
      const leadsPayload = leads.map((l) => ({
        id: l.id,
        email: l.email,
        first_name: l.first_name ?? null,
        last_name: l.last_name ?? null,
        company: l.company ?? null,
        title: l.title ?? null,
        website: l.website ?? null,
        score: l.score,
        segment: l.segment
      }));

      const draftsPayload = drafts.map((d) => ({
        id: uid(),
        lead_id: d.leadId,
        to: d.to,
        subject: d.subject,
        body: d.body
      }));

      const a = await client.from('leads').upsert(leadsPayload, { onConflict: 'id' });
      if (a.error) throw a.error;

      const b = await client.from('drafts').insert(draftsPayload);
      if (b.error) throw b.error;

      setError(null);
      alert(`Saved ${leadsPayload.length} leads and ${draftsPayload.length} drafts to Supabase.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div style={{ fontFamily: 'ui-sans-serif, system-ui', padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <h2 style={{ margin: 0 }}>Campaign Automation (Simplified, Dry-run)</h2>
      <p style={{ color: '#555' }}>
        Import audience → score/segment → generate email drafts. Nothing is sent automatically.
      </p>

      {error && (
        <div style={{ background: '#fee', border: '1px solid #f99', padding: 12, borderRadius: 8 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div>
          <h3 style={{ marginBottom: 8 }}>1) Paste CSV</h3>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={12}
            style={{ width: '100%', fontFamily: 'ui-monospace, SFMono-Regular', fontSize: 13 }}
          />
          <div style={{ marginTop: 8, color: '#555' }}>
            Expected columns: <code>email, first_name, last_name, company, title, website</code>
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: 8 }}>2) Draft settings</h3>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Sender name
            <input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              style={{ display: 'block', width: '100%', padding: 8 }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Topic
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              style={{ display: 'block', width: '100%', padding: 8 }}
            />
          </label>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={generateDrafts} style={{ padding: '8px 12px' }}>
              Generate drafts
            </button>
            <button
              onClick={saveToSupabase}
              disabled={!supabaseEnabled}
              title={supabaseEnabled ? '' : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'}
              style={{ padding: '8px 12px' }}
            >
              Save to Supabase
            </button>
          </div>

          <div style={{ marginTop: 12, color: '#555' }}>
            Scoring rules (hardcoded MVP): +10 title contains “Head”, +5 company not empty.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 8 }}>Leads ({leads.length})</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Score</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Email</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Company</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Title</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{l.score}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{l.email}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{l.company ?? ''}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{l.title ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 8 }}>Drafts {drafts ? `(${drafts.length})` : ''}</h3>
        {!drafts ? (
          <div style={{ color: '#555' }}>Click “Generate drafts” to preview.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {drafts.slice(0, 5).map((d) => (
              <div key={`${d.leadId}-${d.subject}`} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: '#666' }}>To: {d.to}</div>
                <div style={{ marginTop: 6, fontWeight: 600 }}>Subject: {d.subject}</div>
                <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{d.body}</pre>
              </div>
            ))}
            {drafts.length > 5 && <div style={{ color: '#555' }}>Showing first 5 drafts.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

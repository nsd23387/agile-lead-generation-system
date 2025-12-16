import type { Lead } from './types';

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Minimal CSV parser for simple comma-separated data (no quoted commas).
 * Good enough for the example import UX.
 */
export function parseLeadsCsv(text: string): Omit<Lead, 'id' | 'score' | 'segment'>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(norm);
  const rows = lines.slice(1);

  return rows.map((line) => {
    const cols = line.split(',');
    const r: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) r[headers[i]] = (cols[i] ?? '').trim();

    return {
      email: r.email ?? '',
      first_name: r.first_name || r.firstname || undefined,
      last_name: r.last_name || r.lastname || undefined,
      company: r.company || undefined,
      title: r.title || undefined,
      website: r.website || undefined
    };
  });
}

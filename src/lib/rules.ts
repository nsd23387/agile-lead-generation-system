import type { Lead } from './types';

export type SegmentRule = {
  name: string;
  requireEmail?: boolean;
};

export type ScoringRule =
  | { points: number; field: keyof Omit<Lead, 'score' | 'segment' | 'id'>; op: 'contains'; value: string }
  | { points: number; field: keyof Omit<Lead, 'score' | 'segment' | 'id'>; op: 'not_empty' };

export function scoreLead(raw: Partial<Lead>, rules: ScoringRule[]): number {
  let score = 0;
  for (const r of rules) {
    const v = raw[r.field];
    if (r.op === 'not_empty') {
      if (typeof v === 'string' ? v.trim() !== '' : v != null) score += r.points;
    }
    if (r.op === 'contains') {
      if (typeof v === 'string' && v.toLowerCase().includes(r.value.toLowerCase())) score += r.points;
    }
  }
  return score;
}

export function segmentLeads(leads: Lead[], segment: SegmentRule): Lead[] {
  if (segment.requireEmail) return leads.filter((l) => l.email.trim() !== '');
  return leads;
}

import type { DraftMessage, Lead } from './types';

export function renderEmailDraft(lead: Lead, opts: { senderName: string; topic: string }): DraftMessage {
  const firstName = lead.first_name?.trim() || 'there';
  const company = lead.company?.trim() || 'your team';

  const subject = `Quick question for ${company}`;
  const body = [
    `Hi ${firstName},`,
    '',
    `I noticed ${company} and thought this might be relevant.`,
    '',
    `Would it be helpful if I shared a short checklist for improving ${opts.topic}?`,
    '',
    'Best,',
    opts.senderName
  ].join('\n');

  return {
    leadId: lead.id,
    to: lead.email,
    subject,
    body
  };
}

export type Lead = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  website?: string;
  score: number;
  segment: string;
};

export type DraftMessage = {
  leadId: string;
  to: string;
  subject: string;
  body: string;
};

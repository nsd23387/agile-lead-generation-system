export type CampaignSimpleTrace = {
  campaign_id: string;
  audience_total: number;
  personalized_total: number;
  ready_total: number;
  claimed_total: number;
  sent_total: number;
  failed_total: number;
  replies_total: number;
  updated_at: string;
};

export type CampaignSimpleTraceRow = {
  campaign_id: string;
  campaign_name: string;
  trace: CampaignSimpleTrace;
};

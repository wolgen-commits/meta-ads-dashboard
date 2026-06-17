export interface MetaCampaign {
  id: string; account_id: string; name: string;
  objective: string | null; status: string | null;
  daily_budget: number | null; synced_at: string; created_at: string;
}
export interface MetaAdset {
  id: string; campaign_id: string; account_id: string;
  name: string; status: string | null;
  daily_budget: number | null; synced_at: string;
}
export interface MetaAd {
  id: string; adset_id: string; campaign_id: string; account_id: string;
  name: string; status: string | null;
  creative_id: string | null; synced_at: string;
}
export interface AdPerformance {
  id: string; ad_id: string; adset_id: string; campaign_id: string;
  account_id: string; date_start: string; date_stop: string; hour: number | null;
  impressions: number; reach: number; clicks: number; spend: number;
  cpm: number | null; cpc: number | null; ctr: number | null;
  purchases: number; purchase_value: number; leads: number; roas: number | null; synced_at: string;
}
export interface EngagementMetric {
  id: string; ad_id: string; campaign_id: string; account_id: string;
  date_start: string; date_stop: string; hour: number | null;
  post_engagement: number; post_reactions: number; post_comments: number;
  post_shares: number; post_saves: number; video_views: number; synced_at: string;
}
export interface AudienceInsight {
  id: string; campaign_id: string; account_id: string;
  date_start: string; date_stop: string; breakdown_type: string;
  age: string | null; gender: string | null; region: string | null;
  device_platform: string | null; placement: string | null;
  impressions: number; reach: number; clicks: number; spend: number; ctr: number | null; synced_at: string;
}
export interface SyncLog {
  id: string; sync_type: string; status: string; records_upserted: number;
  error_message: string | null; started_at: string; finished_at: string | null;
  duration_ms: number | null; meta_api_calls: number;
}
export interface CampaignDailySummary {
  campaign_id: string; campaign_name: string; objective: string | null;
  date_start: string; month: string;
  impressions: number; reach: number; clicks: number; link_clicks: number;
  spend: number; results: number; result_value: number; leads: number;
  post_engagement: number; ctr: number; cpc: number; cost_per_lead: number;
}
export interface CampaignEngagementDaily {
  campaign_id: string; date_start: string;
  post_reactions: number; post_comments: number; post_shares: number;
  post_saves: number; video_views: number;
}
export interface AudienceTopSegment {
  campaign_id: string; campaign_name: string; breakdown_type: string;
  age: string | null; gender: string | null; region: string | null;
  device_platform: string | null; placement: string | null;
  impressions: number; clicks: number; spend: number; avg_ctr: number;
}
export type Database = {
  public: {
    Tables: {
      meta_campaigns:     { Row: MetaCampaign;     Insert: MetaCampaign;     Update: Partial<MetaCampaign> };
      meta_adsets:        { Row: MetaAdset;        Insert: MetaAdset;        Update: Partial<MetaAdset> };
      meta_ads:           { Row: MetaAd;           Insert: MetaAd;           Update: Partial<MetaAd> };
      ad_performance:     { Row: AdPerformance;    Insert: AdPerformance;    Update: Partial<AdPerformance> };
      engagement_metrics: { Row: EngagementMetric; Insert: EngagementMetric; Update: Partial<EngagementMetric> };
      audience_insights:  { Row: AudienceInsight;  Insert: AudienceInsight;  Update: Partial<AudienceInsight> };
      meta_sync_log:      { Row: SyncLog;           Insert: SyncLog;          Update: Partial<SyncLog> };
    };
    Views: {
      v_adperf_daily:          { Row: CampaignDailySummary };
      v_audience_top_segments: { Row: AudienceTopSegment };
    };
  };
};

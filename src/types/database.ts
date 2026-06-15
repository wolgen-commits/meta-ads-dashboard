export interface MetaCampaign {
  id: string; account_id: string; name: string;
  objective: string | null; status: string | null;
  daily_budget: number | null; synced_at: string; created_at: string;
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
export interface IgAccount {
  id: string; name: string; username: string;
  followers_count: number; media_count: number; synced_at: string;
}
export interface IgMedia {
  id: string; ig_account_id: string; media_type: string;
  media_product_type: string; caption: string | null;
  permalink: string | null; timestamp: string; thumbnail_url: string | null;
}
export interface IgMediaInsight {
  media_id: string; ig_account_id: string;
  likes: number; comments: number; shares: number; saved: number;
  reach: number; impressions: number; video_views: number;
}
export interface CampaignDailySummary {
  campaign_id: string; campaign_name: string; objective: string | null;
  campaign_status: string | null; date_start: string; account_id: string;
  total_impressions: number; total_reach: number; total_clicks: number;
  total_spend: number; total_purchases: number; total_purchase_value: number;
  total_leads: number; ctr_pct: number; cpc: number; roas: number;
}
export interface CampaignEngagementDaily {
  campaign_id: string; campaign_name: string; date_start: string; account_id: string;
  total_engagement: number; total_reactions: number; total_comments: number;
  total_shares: number; total_saves: number; total_video_views: number;
  total_reach: number; engagement_rate_pct: number;
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
      ad_performance:     { Row: AdPerformance;    Insert: AdPerformance;    Update: Partial<AdPerformance> };
      engagement_metrics: { Row: EngagementMetric; Insert: EngagementMetric; Update: Partial<EngagementMetric> };
      audience_insights:  { Row: AudienceInsight;  Insert: AudienceInsight;  Update: Partial<AudienceInsight> };
      meta_sync_log:      { Row: SyncLog;           Insert: SyncLog;          Update: Partial<SyncLog> };
      ig_accounts:        { Row: IgAccount;        Insert: IgAccount;        Update: Partial<IgAccount> };
      ig_media:           { Row: IgMedia;          Insert: IgMedia;          Update: Partial<IgMedia> };
      ig_media_insights:  { Row: IgMediaInsight;   Insert: IgMediaInsight;   Update: Partial<IgMediaInsight> };
    };
    Views: {
      v_campaign_daily_summary:    { Row: CampaignDailySummary };
      v_campaign_engagement_daily: { Row: CampaignEngagementDaily };
      v_audience_top_segments:     { Row: AudienceTopSegment };
    };
  };
};

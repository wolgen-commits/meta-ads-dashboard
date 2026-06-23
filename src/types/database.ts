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
  device_platform: string | null; impression_device: string | null;
  placement: string | null; publisher_platform: string | null;
  impressions: number; reach: number; clicks: number; spend: number; ctr: number | null;
  messaging_conversations: number | null;
  synced_at: string;
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
export interface IgAccountInsight {
  id: string;
  ig_account_id: string;
  date: string;
  followers_count: number;
  reach: number;
  impressions: number;
  profile_views: number;
  website_clicks: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
  synced_at: string;
}

export interface AdLibraryAd {
  id: string;
  page_id: string;
  page_name: string;
  ad_creation_time: string;
  ad_delivery_start_time: string;
  ad_delivery_stop_time: string | null;
  ad_creative_bodies: string[] | null;
  ad_creative_link_captions: string[] | null;
  ad_creative_link_titles: string[] | null;
  ad_snapshot_url: string;
  currency: string | null;
  funding_entity: string | null;
  impressions: { lower_bound: number; upper_bound: number } | null;
  spend: { lower_bound: number; upper_bound: number } | null;
  publisher_platforms: string[] | null;
}
export interface AdLibraryResponse {
  data: AdLibraryAd[];
  paging?: { cursors: { before: string; after: string }; next?: string };
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
      competitor_ads:     { Row: CompetitorAd;     Insert: Omit<CompetitorAd, "id">; Update: Partial<CompetitorAd> };
    };
    Views: {
      v_adperf_daily:          { Row: CampaignDailySummary };
      v_audience_top_segments: { Row: AudienceTopSegment };
    };
  };
};

export interface CompetitorAd {
  id: string;
  ad_id: string | null;
  competitor_name: string;
  page_name: string | null;
  ad_copy: string | null;
  cta: string | null;
  platforms: string[] | null;
  media_type: string | null;
  started_running: string | null;
  started_running_date: string | null;
  country: string | null;
  snapshot_url: string | null;
  scraped_at: string;
  inferred_objective: string | null;
  objective_confidence: string | null;
  objective_reasoning: string | null;
  creative_strategy: string | null;
  target_audience_guess: string | null;
  key_messages: string[] | null;
  ad_strength_score: number | null;
  competitive_insight: string | null;
  suggested_counter_strategy: string | null;
  analyzed_at: string | null;
}

export interface JobProgress {
  step: "starting" | "opening" | "analyzing" | "saving" | "done";
  message: string;
  ads_found?: number;
  ads_analyzed?: number;
  current_page?: string;
}

export interface JobStatusResponse {
  status: "running" | "done" | "error";
  competitor?: string;
  progress?: JobProgress;
  summary?: { total_ads_scraped: number; total_analyzed: number; completed_at: string };
  error?: string;
}

export interface CompetitorAdsSummary {
  total_ads: number;
  objectives_distribution: Record<string, number>;
  creative_strategies: Record<string, number>;
  ads_per_competitor: Record<string, number>;
  average_strength_score: number;
}

// ── Google Ads ────────────────────────────────────────────────────────────────

export interface GoogleCampaign {
  id: string;
  customer_id: string;
  name: string;
  status: string | null;
  advertising_channel_type: string | null;
  synced_at: string;
}

export interface GoogleAdPerformance {
  id: string;
  campaign_id: string;
  customer_id: string;
  date: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  conversions_value: number;
  ctr: number;
  average_cpc: number;
  cost_per_conversion: number;
  synced_at: string;
}

// Row dari view v_google_adperf_daily — biaya sudah dalam IDR
export interface GoogleAdPerfDaily {
  campaign_id: string;
  campaign_name: string;
  campaign_status: string | null;
  advertising_channel_type: string | null;
  date: string;
  impressions: number;
  clicks: number;
  cost_idr: number;
  conversions: number;
  conversions_value: number;
  ctr_pct: number;
  avg_cpc_idr: number;
  cost_per_conversion_idr: number;
}

// ── Google Analytics 4 ────────────────────────────────────────────────────────

export interface Ga4WebsiteDaily {
  id: string;
  property_id: string;
  date: string;
  source: string;
  medium: string;
  sessions: number;
  users: number;
  new_users: number;
  bounce_rate: number;
  engagement_rate: number;
  avg_session_duration: number;
  conversions: number;
  synced_at: string;
}

// Row dari view v_ga4_traffic_summary — rate sudah dalam %
export interface Ga4TrafficSummary {
  date: string;
  source: string;
  medium: string;
  channel_group: string;
  sessions: number;
  users: number;
  new_users: number;
  bounce_rate_pct: number;
  engagement_rate_pct: number;
  avg_session_duration_sec: number;
  conversions: number;
}

export interface Ga4Demographics {
  id: string;
  property_id: string;
  date: string;
  age_group: string;
  gender: string;
  sessions: number;
  users: number;
  new_users: number;
  conversions: number;
}

export interface Ga4Platform {
  id: string;
  property_id: string;
  date: string;
  device_category: string;
  operating_system: string;
  browser: string;
  sessions: number;
  users: number;
  conversions: number;
}

export interface Ga4LandingPage {
  id: string;
  property_id: string;
  date: string;
  landing_page: string;
  sessions: number;
  users: number;
  bounce_rate: number;
  engagement_rate: number;
  avg_session_duration: number;
  conversions: number;
}

export interface Ga4Page {
  id: string;
  property_id: string;
  date: string;
  page_path: string;
  page_title: string;
  screen_page_views: number;
  users: number;
  engagement_duration: number;
}

export interface Ga4Geography {
  id: string;
  property_id: string;
  date: string;
  country: string;
  city: string;
  sessions: number;
  users: number;
  new_users: number;
  conversions: number;
}

export interface Ga4SearchTerm {
  id: string;
  property_id: string;
  date: string;
  search_term: string;
  sessions: number;
  users: number;
  conversions: number;
}

export interface Ga4SearchConsole {
  id: string;
  property_id: string;
  date: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// ── Google Ads expanded ────────────────────────────────────────────────────────

export interface GoogleAdGroup {
  id: string;
  campaign_id: string;
  customer_id: string;
  name: string;
  status: string | null;
  type: string | null;
  cpc_bid_micros: number;
  synced_at: string;
}

export interface GoogleAd {
  id: string;
  adgroup_id: string;
  campaign_id: string;
  customer_id: string;
  name: string | null;
  status: string | null;
  type: string | null;
  final_urls: string[];
  headlines: string[];
  descriptions: string[];
  synced_at: string;
}

export interface GoogleAdGroupPerfDaily {
  adgroup_id: string;
  adgroup_name: string;
  adgroup_status: string | null;
  campaign_id: string;
  campaign_name: string;
  advertising_channel_type: string | null;
  date: string;
  impressions: number;
  clicks: number;
  cost_idr: number;
  conversions: number;
  ctr_pct: number;
  avg_cpc_idr: number;
  cost_per_conversion_idr: number;
}

export interface GoogleKeywordPerfDaily {
  criterion_id: string;
  keyword_text: string;
  match_type: string | null;
  keyword_status: string | null;
  quality_score: number | null;
  adgroup_id: string;
  campaign_id: string;
  campaign_name: string;
  date: string;
  impressions: number;
  clicks: number;
  cost_idr: number;
  conversions: number;
  ctr_pct: number;
  avg_cpc_idr: number;
}

export interface GoogleSearchTermPerfDaily {
  id: string;
  search_term: string;
  status: string | null;
  campaign_id: string;
  campaign_name: string;
  adgroup_id: string | null;
  date: string;
  impressions: number;
  clicks: number;
  cost_idr: number;
  conversions: number;
  ctr_pct: number;
  avg_cpc_idr: number;
}

export interface GooglePerfDeviceDaily {
  campaign_id: string;
  campaign_name: string;
  date: string;
  device: string;
  impressions: number;
  clicks: number;
  cost_idr: number;
  conversions: number;
  ctr_pct: number;
  avg_cpc_idr: number;
}

export interface GooglePerfAgeDaily {
  id: string;
  campaign_id: string;
  campaign_name: string;
  date: string;
  age_range: string;
  impressions: number;
  clicks: number;
  cost_idr: number;
  conversions: number;
  ctr_pct: number;
  avg_cpc_idr: number;
}

export interface GooglePerfGenderDaily {
  id: string;
  campaign_id: string;
  campaign_name: string;
  date: string;
  gender: string;
  impressions: number;
  clicks: number;
  cost_idr: number;
  conversions: number;
  ctr_pct: number;
  avg_cpc_idr: number;
}

export interface GooglePerfGeoDaily {
  id: string;
  campaign_id: string;
  campaign_name: string;
  date: string;
  country_criterion_id: string;
  location_type: string;
  impressions: number;
  clicks: number;
  cost_idr: number;
  conversions: number;
  ctr_pct: number;
  avg_cpc_idr: number;
}

export interface GooglePerfHourDaily {
  id: string;
  campaign_id: string;
  campaign_name: string;
  date: string;
  hour: number;
  day_of_week: string;
  impressions: number;
  clicks: number;
  cost_idr: number;
  conversions: number;
  ctr_pct: number;
  avg_cpc_idr: number;
}

export interface GoogleGeoTarget {
  criterion_id: string;
  name: string;
  canonical_name: string | null;
  country_code: string | null;
  target_type: string | null;
}

export interface GoogleLocationTargeting {
  id: string;
  campaign_id: string;
  campaign_name: string;
  criterion_id: string;
  location_name: string;
  canonical_name: string | null;
  target_type: string | null;
  country_code: string | null;
  status: string | null;
  is_negative: boolean;
  bid_modifier: number;
}

export interface GooglePerfCityDaily {
  id: string;
  campaign_id: string;
  campaign_name: string;
  date: string;
  city_criterion_id: string | null;
  city_name: string;
  city_canonical: string | null;
  region_criterion_id: string | null;
  region_name: string;
  impressions: number;
  clicks: number;
  cost_idr: number;
  conversions: number;
  ctr_pct: number;
  avg_cpc_idr: number;
}

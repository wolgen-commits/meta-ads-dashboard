-- ══════════════════════════════════════════════════════════════════════════════
-- Google Ads Extended Data — Fase 2, 3, 4
-- Jalankan di Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Fase 2: Tambah kolom Impression Share + metrik baru ──────────────────────

ALTER TABLE google_ad_performance
  ADD COLUMN IF NOT EXISTS search_impression_share      NUMERIC(8,6),
  ADD COLUMN IF NOT EXISTS budget_lost_impression_share NUMERIC(8,6),
  ADD COLUMN IF NOT EXISTS rank_lost_impression_share   NUMERIC(8,6),
  ADD COLUMN IF NOT EXISTS abs_top_impression_pct       NUMERIC(8,6),
  ADD COLUMN IF NOT EXISTS top_impression_pct           NUMERIC(8,6),
  ADD COLUMN IF NOT EXISTS video_views                  BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_view_rate              NUMERIC(8,6),
  ADD COLUMN IF NOT EXISTS view_through_conversions     NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_view_impressions      BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_view_viewability      NUMERIC(8,6);

-- Update view untuk expose kolom baru (rate sudah dalam %)
CREATE OR REPLACE VIEW v_google_adperf_daily AS
SELECT
  p.campaign_id,
  c.name                                          AS campaign_name,
  c.status                                        AS campaign_status,
  c.advertising_channel_type,
  p.date,
  p.impressions,
  p.clicks,
  ROUND(p.cost_micros::NUMERIC / 1000000, 0)     AS cost_idr,
  p.conversions,
  p.conversions_value,
  ROUND(p.ctr * 100, 4)                          AS ctr_pct,
  ROUND(p.average_cpc::NUMERIC / 1000000, 0)     AS avg_cpc_idr,
  ROUND(p.cost_per_conversion / 1000000, 0)      AS cost_per_conversion_idr,
  -- Impression Share
  ROUND(COALESCE(p.search_impression_share, 0) * 100, 2)      AS search_impression_share_pct,
  ROUND(COALESCE(p.budget_lost_impression_share, 0) * 100, 2) AS budget_lost_is_pct,
  ROUND(COALESCE(p.rank_lost_impression_share, 0) * 100, 2)   AS rank_lost_is_pct,
  ROUND(COALESCE(p.abs_top_impression_pct, 0) * 100, 2)       AS abs_top_is_pct,
  ROUND(COALESCE(p.top_impression_pct, 0) * 100, 2)           AS top_is_pct,
  -- Video
  COALESCE(p.video_views, 0)                                   AS video_views,
  ROUND(COALESCE(p.video_view_rate, 0) * 100, 2)              AS video_view_rate_pct,
  COALESCE(p.view_through_conversions, 0)                      AS view_through_conversions,
  -- Viewability
  COALESCE(p.active_view_impressions, 0)                       AS active_view_impressions,
  ROUND(COALESCE(p.active_view_viewability, 0) * 100, 2)      AS active_view_viewability_pct
FROM google_ad_performance p
JOIN google_campaigns c ON c.id = p.campaign_id;

-- ── Fase 4 C1: Komponen Quality Score ke google_keywords ─────────────────────

ALTER TABLE google_keywords
  ADD COLUMN IF NOT EXISTS expected_ctr            TEXT,
  ADD COLUMN IF NOT EXISTS ad_relevance            TEXT,
  ADD COLUMN IF NOT EXISTS landing_page_experience TEXT;

-- ── Fase 3 B1: Auction Insights (Analisa Lelang) ─────────────────────────────

CREATE TABLE IF NOT EXISTS google_auction_insights (
  id                   TEXT PRIMARY KEY,
  campaign_id          TEXT NOT NULL REFERENCES google_campaigns(id),
  customer_id          TEXT NOT NULL,
  date                 DATE NOT NULL,
  domain               TEXT NOT NULL,
  impression_share     NUMERIC(8,6),
  outranking_share     NUMERIC(8,6),
  overlap_rate         NUMERIC(8,6),
  position_above_rate  NUMERIC(8,6),
  top_of_page_rate     NUMERIC(8,6),
  abs_top_of_page_rate NUMERIC(8,6),
  synced_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (campaign_id, date, domain)
);
ALTER TABLE google_auction_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_google_auction_insights"
  ON google_auction_insights FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_google_auction_date ON google_auction_insights (date);
CREATE INDEX IF NOT EXISTS idx_google_auction_campaign ON google_auction_insights (campaign_id);

CREATE OR REPLACE VIEW v_google_auction_insights AS
SELECT
  a.campaign_id,
  c.name                                             AS campaign_name,
  a.date,
  a.domain,
  ROUND(COALESCE(a.impression_share, 0) * 100, 2)     AS impression_share_pct,
  ROUND(COALESCE(a.outranking_share, 0) * 100, 2)     AS outranking_share_pct,
  ROUND(COALESCE(a.overlap_rate, 0) * 100, 2)         AS overlap_rate_pct,
  ROUND(COALESCE(a.position_above_rate, 0) * 100, 2)  AS position_above_rate_pct,
  ROUND(COALESCE(a.top_of_page_rate, 0) * 100, 2)     AS top_of_page_rate_pct,
  ROUND(COALESCE(a.abs_top_of_page_rate, 0) * 100, 2) AS abs_top_of_page_rate_pct
FROM google_auction_insights a
JOIN google_campaigns c ON c.id = a.campaign_id;

-- ── Fase 3 B2: Performa Per Iklan Individual (Ad-level Daily) ────────────────

CREATE TABLE IF NOT EXISTS google_ad_perf_daily (
  id           TEXT PRIMARY KEY,
  ad_id        TEXT NOT NULL,
  adgroup_id   TEXT NOT NULL,
  campaign_id  TEXT NOT NULL,
  customer_id  TEXT NOT NULL,
  date         DATE NOT NULL,
  impressions  BIGINT DEFAULT 0,
  clicks       BIGINT DEFAULT 0,
  cost_micros  BIGINT DEFAULT 0,
  conversions  NUMERIC(10,2) DEFAULT 0,
  ctr          NUMERIC(8,6) DEFAULT 0,
  average_cpc  BIGINT DEFAULT 0,
  synced_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (ad_id, date)
);
ALTER TABLE google_ad_perf_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_google_ad_perf_daily"
  ON google_ad_perf_daily FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_google_adperf_daily_date ON google_ad_perf_daily (date);
CREATE INDEX IF NOT EXISTS idx_google_adperf_daily_campaign ON google_ad_perf_daily (campaign_id);

CREATE OR REPLACE VIEW v_google_ad_perf_daily AS
SELECT
  p.ad_id,
  COALESCE(a.name, p.ad_id)                        AS ad_name,
  a.type                                            AS ad_type,
  a.status                                          AS ad_status,
  a.headlines,
  p.adgroup_id,
  p.campaign_id,
  c.name                                            AS campaign_name,
  p.date,
  p.impressions,
  p.clicks,
  ROUND(p.cost_micros::NUMERIC / 1000000, 0)       AS cost_idr,
  p.conversions,
  ROUND(p.ctr * 100, 4)                            AS ctr_pct,
  ROUND(p.average_cpc::NUMERIC / 1000000, 0)       AS avg_cpc_idr
FROM google_ad_perf_daily p
LEFT JOIN google_ads a ON a.id = p.ad_id
JOIN google_campaigns c ON c.id = p.campaign_id;

-- ── Fase 3 B3: Performa Aset RSA ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS google_asset_performance (
  id                TEXT PRIMARY KEY,
  ad_id             TEXT NOT NULL,
  adgroup_id        TEXT NOT NULL,
  campaign_id       TEXT NOT NULL,
  customer_id       TEXT NOT NULL,
  asset_field_type  TEXT NOT NULL,
  asset_text        TEXT,
  performance_label TEXT,
  impressions       BIGINT DEFAULT 0,
  clicks            BIGINT DEFAULT 0,
  synced_at         TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE google_asset_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_google_asset_performance"
  ON google_asset_performance FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_google_asset_campaign ON google_asset_performance (campaign_id);
CREATE INDEX IF NOT EXISTS idx_google_asset_ad ON google_asset_performance (ad_id);

CREATE OR REPLACE VIEW v_google_asset_performance AS
SELECT
  ap.id,
  ap.ad_id,
  ap.adgroup_id,
  ap.campaign_id,
  c.name       AS campaign_name,
  ap.asset_field_type,
  ap.asset_text,
  ap.performance_label,
  ap.impressions,
  ap.clicks
FROM google_asset_performance ap
JOIN google_campaigns c ON c.id = ap.campaign_id;

-- ── Fase 3 B4: Konversi per Jenis (Conversion Action Breakdown) ──────────────

CREATE TABLE IF NOT EXISTS google_conversion_actions (
  id                         TEXT PRIMARY KEY,
  campaign_id                TEXT NOT NULL,
  customer_id                TEXT NOT NULL,
  date                       DATE NOT NULL,
  conversion_action_id       TEXT NOT NULL,
  conversion_action_name     TEXT NOT NULL,
  conversion_action_category TEXT,
  conversions                NUMERIC(10,2) DEFAULT 0,
  conversions_value          NUMERIC(15,2) DEFAULT 0,
  synced_at                  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (campaign_id, date, conversion_action_id)
);
ALTER TABLE google_conversion_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_google_conversion_actions"
  ON google_conversion_actions FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_google_conv_date ON google_conversion_actions (date);
CREATE INDEX IF NOT EXISTS idx_google_conv_campaign ON google_conversion_actions (campaign_id);

CREATE OR REPLACE VIEW v_google_conversion_actions AS
SELECT
  ca.campaign_id,
  c.name                      AS campaign_name,
  ca.date,
  ca.conversion_action_id,
  ca.conversion_action_name,
  ca.conversion_action_category,
  ca.conversions,
  ca.conversions_value
FROM google_conversion_actions ca
JOIN google_campaigns c ON c.id = ca.campaign_id;

-- ── Fase 3 B5: Jaringan/Platform (Ad Network Type) ───────────────────────────

CREATE TABLE IF NOT EXISTS google_perf_network (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL,
  customer_id  TEXT NOT NULL,
  date         DATE NOT NULL,
  network      TEXT NOT NULL,
  impressions  BIGINT DEFAULT 0,
  clicks       BIGINT DEFAULT 0,
  cost_micros  BIGINT DEFAULT 0,
  conversions  NUMERIC(10,2) DEFAULT 0,
  ctr          NUMERIC(8,6) DEFAULT 0,
  average_cpc  BIGINT DEFAULT 0,
  synced_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (campaign_id, date, network)
);
ALTER TABLE google_perf_network ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_google_perf_network"
  ON google_perf_network FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_google_perf_network_date ON google_perf_network (date);
CREATE INDEX IF NOT EXISTS idx_google_perf_network_campaign ON google_perf_network (campaign_id);

CREATE OR REPLACE VIEW v_google_perf_network AS
SELECT
  pn.campaign_id,
  c.name                                         AS campaign_name,
  c.advertising_channel_type,
  pn.date,
  pn.network,
  pn.impressions,
  pn.clicks,
  ROUND(pn.cost_micros::NUMERIC / 1000000, 0)   AS cost_idr,
  pn.conversions,
  ROUND(pn.ctr * 100, 4)                        AS ctr_pct,
  ROUND(pn.average_cpc::NUMERIC / 1000000, 0)   AS avg_cpc_idr
FROM google_perf_network pn
JOIN google_campaigns c ON c.id = pn.campaign_id;

-- ── Fase 4 C2: Landing Page Performance ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS google_landing_pages (
  id                         TEXT PRIMARY KEY,
  customer_id                TEXT NOT NULL,
  date                       DATE NOT NULL,
  unexpanded_final_url       TEXT NOT NULL,
  clicks                     BIGINT DEFAULT 0,
  speed_score                INTEGER,
  mobile_friendly_clicks_pct NUMERIC(8,6),
  valid_amp_clicks_pct       NUMERIC(8,6),
  synced_at                  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (date, unexpanded_final_url)
);
ALTER TABLE google_landing_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_google_landing_pages"
  ON google_landing_pages FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_google_landing_date ON google_landing_pages (date);

CREATE OR REPLACE VIEW v_google_landing_pages AS
SELECT
  id,
  customer_id,
  date,
  unexpanded_final_url,
  clicks,
  speed_score,
  ROUND(COALESCE(mobile_friendly_clicks_pct, 0) * 100, 2) AS mobile_friendly_pct,
  ROUND(COALESCE(valid_amp_clicks_pct, 0) * 100, 2)       AS amp_pct
FROM google_landing_pages;

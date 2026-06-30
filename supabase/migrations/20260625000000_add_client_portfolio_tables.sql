-- ============================================================
-- Client Portfolio Tables (Putrama Group)
-- Unified schema dengan portfolio_slug untuk semua 4 portofolio:
-- putrama, aneka, brownpaper, jogja
-- ============================================================

-- 1. client_campaigns
CREATE TABLE IF NOT EXISTS client_campaigns (
  portfolio_slug  TEXT        NOT NULL,
  id              TEXT        NOT NULL,
  account_id      TEXT,
  name            TEXT,
  objective       TEXT,
  status          TEXT,
  daily_budget    NUMERIC,
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (portfolio_slug, id)
);

-- 2. client_adsets
CREATE TABLE IF NOT EXISTS client_adsets (
  portfolio_slug  TEXT        NOT NULL,
  id              TEXT        NOT NULL,
  campaign_id     TEXT,
  account_id      TEXT,
  name            TEXT,
  status          TEXT,
  daily_budget    NUMERIC,
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (portfolio_slug, id)
);

-- 3. client_ads
CREATE TABLE IF NOT EXISTS client_ads (
  portfolio_slug  TEXT        NOT NULL,
  id              TEXT        NOT NULL,
  adset_id        TEXT,
  campaign_id     TEXT,
  account_id      TEXT,
  name            TEXT,
  status          TEXT,
  creative_id     TEXT,
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (portfolio_slug, id)
);

-- 4. client_ad_performance (per-iklan per-hari)
CREATE TABLE IF NOT EXISTS client_ad_performance (
  portfolio_slug          TEXT        NOT NULL,
  ad_id                   TEXT        NOT NULL,
  adset_id                TEXT,
  campaign_id             TEXT,
  account_id              TEXT,
  date_start              DATE        NOT NULL,
  date_stop               DATE,
  impressions             BIGINT      DEFAULT 0,
  reach                   BIGINT      DEFAULT 0,
  frequency               NUMERIC,
  clicks                  BIGINT      DEFAULT 0,
  link_clicks             BIGINT      DEFAULT 0,
  spend                   NUMERIC     DEFAULT 0,
  cpm                     NUMERIC,
  cpc                     NUMERIC,
  ctr                     NUMERIC,
  results                 BIGINT      DEFAULT 0,
  cost_per_result         NUMERIC,
  leads                   BIGINT      DEFAULT 0,
  purchases               BIGINT      DEFAULT 0,
  purchase_value          NUMERIC     DEFAULT 0,
  roas                    NUMERIC,
  messaging_conversations BIGINT      DEFAULT 0,
  post_engagement         BIGINT      DEFAULT 0,
  post_reactions          BIGINT      DEFAULT 0,
  post_comments           BIGINT      DEFAULT 0,
  post_shares             BIGINT      DEFAULT 0,
  post_saves              BIGINT      DEFAULT 0,
  video_views             BIGINT      DEFAULT 0,
  synced_at               TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (portfolio_slug, ad_id, date_start)
);

-- 5. client_engagement_metrics
CREATE TABLE IF NOT EXISTS client_engagement_metrics (
  portfolio_slug   TEXT        NOT NULL,
  ad_id            TEXT        NOT NULL,
  campaign_id      TEXT,
  account_id       TEXT,
  date_start       DATE        NOT NULL,
  date_stop        DATE,
  post_engagement  BIGINT      DEFAULT 0,
  post_reactions   BIGINT      DEFAULT 0,
  post_comments    BIGINT      DEFAULT 0,
  post_shares      BIGINT      DEFAULT 0,
  post_saves       BIGINT      DEFAULT 0,
  video_views      BIGINT      DEFAULT 0,
  synced_at        TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (portfolio_slug, ad_id, date_start)
);

-- 6. client_audience_insights
CREATE TABLE IF NOT EXISTS client_audience_insights (
  portfolio_slug          TEXT        NOT NULL,
  campaign_id             TEXT        NOT NULL,
  account_id              TEXT,
  date_start              DATE        NOT NULL,
  date_stop               DATE,
  breakdown_type          TEXT        NOT NULL,
  age                     TEXT,
  gender                  TEXT,
  region                  TEXT,
  device_platform         TEXT,
  impression_device       TEXT,
  placement               TEXT,
  publisher_platform      TEXT,
  impressions             BIGINT      DEFAULT 0,
  reach                   BIGINT      DEFAULT 0,
  clicks                  BIGINT      DEFAULT 0,
  spend                   NUMERIC     DEFAULT 0,
  ctr                     NUMERIC,
  messaging_conversations BIGINT,
  synced_at               TIMESTAMPTZ DEFAULT NOW()
);

-- 7. client_sync_log
CREATE TABLE IF NOT EXISTS client_sync_log (
  id               BIGSERIAL   PRIMARY KEY,
  portfolio_slug   TEXT        NOT NULL,
  function_name    TEXT,
  status           TEXT,
  records_upserted INT         DEFAULT 0,
  error_message    TEXT,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  finished_at      TIMESTAMPTZ,
  duration_ms      INT,
  meta_api_calls   INT         DEFAULT 0
);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE client_campaigns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_adsets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_ads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_ad_performance    ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_audience_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_sync_log          ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- anon: SELECT only
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_client_campaigns'          AND tablename = 'client_campaigns')          THEN CREATE POLICY "anon_read_client_campaigns"          ON client_campaigns          FOR SELECT TO anon USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_client_adsets'             AND tablename = 'client_adsets')             THEN CREATE POLICY "anon_read_client_adsets"             ON client_adsets             FOR SELECT TO anon USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_client_ads'                AND tablename = 'client_ads')                THEN CREATE POLICY "anon_read_client_ads"                ON client_ads                FOR SELECT TO anon USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_client_ad_performance'     AND tablename = 'client_ad_performance')     THEN CREATE POLICY "anon_read_client_ad_performance"     ON client_ad_performance     FOR SELECT TO anon USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_client_engagement_metrics' AND tablename = 'client_engagement_metrics') THEN CREATE POLICY "anon_read_client_engagement_metrics" ON client_engagement_metrics FOR SELECT TO anon USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_client_audience_insights'  AND tablename = 'client_audience_insights')  THEN CREATE POLICY "anon_read_client_audience_insights"  ON client_audience_insights  FOR SELECT TO anon USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_client_sync_log'           AND tablename = 'client_sync_log')           THEN CREATE POLICY "anon_read_client_sync_log"           ON client_sync_log           FOR SELECT TO anon USING (true); END IF;
  -- service_role: full access
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_full_client_campaigns'          AND tablename = 'client_campaigns')          THEN CREATE POLICY "service_full_client_campaigns"          ON client_campaigns          FOR ALL TO service_role USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_full_client_adsets'             AND tablename = 'client_adsets')             THEN CREATE POLICY "service_full_client_adsets"             ON client_adsets             FOR ALL TO service_role USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_full_client_ads'                AND tablename = 'client_ads')                THEN CREATE POLICY "service_full_client_ads"                ON client_ads                FOR ALL TO service_role USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_full_client_ad_performance'     AND tablename = 'client_ad_performance')     THEN CREATE POLICY "service_full_client_ad_performance"     ON client_ad_performance     FOR ALL TO service_role USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_full_client_engagement_metrics' AND tablename = 'client_engagement_metrics') THEN CREATE POLICY "service_full_client_engagement_metrics" ON client_engagement_metrics FOR ALL TO service_role USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_full_client_audience_insights'  AND tablename = 'client_audience_insights')  THEN CREATE POLICY "service_full_client_audience_insights"  ON client_audience_insights  FOR ALL TO service_role USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_full_client_sync_log'           AND tablename = 'client_sync_log')           THEN CREATE POLICY "service_full_client_sync_log"           ON client_sync_log           FOR ALL TO service_role USING (true) WITH CHECK (true); END IF;
END $$;

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_client_ad_perf_portfolio_date  ON client_ad_performance (portfolio_slug, date_start);
CREATE INDEX IF NOT EXISTS idx_client_ad_perf_campaign        ON client_ad_performance (portfolio_slug, campaign_id);
CREATE INDEX IF NOT EXISTS idx_client_campaigns_portfolio      ON client_campaigns (portfolio_slug);
CREATE INDEX IF NOT EXISTS idx_client_sync_log_portfolio       ON client_sync_log (portfolio_slug, started_at DESC);

-- Unique index untuk client_audience_insights (pakai COALESCE agar NULL dianggap sama)
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_audience_insights
  ON client_audience_insights (
    portfolio_slug, campaign_id, date_start, breakdown_type,
    COALESCE(age,''), COALESCE(gender,''), COALESCE(region,''),
    COALESCE(publisher_platform,''), COALESCE(impression_device,'')
  );

-- ============================================================
-- Migrate data Putrama dari _putrama tables (best-effort)
-- ============================================================

DO $$
BEGIN
  -- Migrate meta_campaigns_putrama → client_campaigns
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'meta_campaigns_putrama') THEN
    INSERT INTO client_campaigns (portfolio_slug, id, account_id, name, objective, status, daily_budget, synced_at)
    SELECT 'putrama', id, account_id, name, objective, status, daily_budget, synced_at
    FROM meta_campaigns_putrama
    ON CONFLICT (portfolio_slug, id) DO NOTHING;
  END IF;

  -- Migrate meta_adsets_putrama → client_adsets
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'meta_adsets_putrama') THEN
    INSERT INTO client_adsets (portfolio_slug, id, campaign_id, account_id, name, status, daily_budget, synced_at)
    SELECT 'putrama', id, campaign_id, account_id, name, status, daily_budget, synced_at
    FROM meta_adsets_putrama
    ON CONFLICT (portfolio_slug, id) DO NOTHING;
  END IF;

  -- Migrate meta_ads_putrama → client_ads
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'meta_ads_putrama') THEN
    INSERT INTO client_ads (portfolio_slug, id, adset_id, campaign_id, account_id, name, status, creative_id, synced_at)
    SELECT 'putrama', id, adset_id, campaign_id, account_id, name, status, creative_id, synced_at
    FROM meta_ads_putrama
    ON CONFLICT (portfolio_slug, id) DO NOTHING;
  END IF;

  -- Migrate ad_performance_putrama → client_ad_performance
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ad_performance_putrama') THEN
    INSERT INTO client_ad_performance (
      portfolio_slug, ad_id, adset_id, campaign_id, account_id,
      date_start, date_stop, impressions, reach, clicks, spend,
      cpm, cpc, ctr, leads, purchases, purchase_value, roas, synced_at
    )
    SELECT
      'putrama', ad_id, adset_id, campaign_id, account_id,
      date_start, date_stop, impressions, reach, clicks, spend,
      cpm, cpc, ctr, leads, purchases, purchase_value, roas, synced_at
    FROM ad_performance_putrama
    ON CONFLICT (portfolio_slug, ad_id, date_start) DO NOTHING;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migrasi _putrama partial: %', SQLERRM;
END $$;

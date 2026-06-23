-- ═══════════════════════════════════════════════════════════════════
-- SQL MIGRATION: Google Ads Demografis, Wilayah, Jadwal
-- Jalankan di Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Tabel Usia (age_range_view) ────────────────────────────────
CREATE TABLE IF NOT EXISTS google_perf_age (
  id          TEXT PRIMARY KEY,          -- '{campaign_id}_{date}_{age_range}'
  campaign_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  date        DATE NOT NULL,
  age_range   TEXT NOT NULL,             -- AGE_RANGE_18_24, 25_34, 35_44, 45_54, 55_64, 65_UP, UNDETERMINED
  impressions BIGINT DEFAULT 0,
  clicks      BIGINT DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,          -- IDR × 1.000.000 (JANGAN bagi 100)
  conversions NUMERIC(10,2) DEFAULT 0,
  ctr         NUMERIC(8,6) DEFAULT 0,
  average_cpc BIGINT DEFAULT 0,
  synced_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (campaign_id, date, age_range)
);
ALTER TABLE google_perf_age ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_google_perf_age" ON google_perf_age FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_gpa_date ON google_perf_age (date);

-- ── 2. Tabel Gender (gender_view) ────────────────────────────────
CREATE TABLE IF NOT EXISTS google_perf_gender (
  id          TEXT PRIMARY KEY,          -- '{campaign_id}_{date}_{gender}'
  campaign_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  date        DATE NOT NULL,
  gender      TEXT NOT NULL,             -- MALE, FEMALE, UNDETERMINED
  impressions BIGINT DEFAULT 0,
  clicks      BIGINT DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,
  conversions NUMERIC(10,2) DEFAULT 0,
  ctr         NUMERIC(8,6) DEFAULT 0,
  average_cpc BIGINT DEFAULT 0,
  synced_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (campaign_id, date, gender)
);
ALTER TABLE google_perf_gender ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_google_perf_gender" ON google_perf_gender FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_gpg_date ON google_perf_gender (date);

-- ── 3. Tabel Wilayah/Geografis (geographic_view) ─────────────────
CREATE TABLE IF NOT EXISTS google_perf_geo (
  id                   TEXT PRIMARY KEY,   -- '{campaign_id}_{date}_{country_id}_{loc_type}'
  campaign_id          TEXT NOT NULL,
  customer_id          TEXT NOT NULL,
  date                 DATE NOT NULL,
  country_criterion_id TEXT NOT NULL,      -- Nomor ID wilayah (Indonesia = 2360)
  location_type        TEXT NOT NULL,      -- COUNTRY, CITY, PROVINCE, REGION, dll
  impressions          BIGINT DEFAULT 0,
  clicks               BIGINT DEFAULT 0,
  cost_micros          BIGINT DEFAULT 0,
  conversions          NUMERIC(10,2) DEFAULT 0,
  ctr                  NUMERIC(8,6) DEFAULT 0,
  average_cpc          BIGINT DEFAULT 0,
  synced_at            TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (campaign_id, date, country_criterion_id, location_type)
);
ALTER TABLE google_perf_geo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_google_perf_geo" ON google_perf_geo FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_gpgeo_date ON google_perf_geo (date);

-- ── 4. Tabel Jadwal/Waktu (segments.hour + day_of_week) ───────────
CREATE TABLE IF NOT EXISTS google_perf_hour (
  id           TEXT PRIMARY KEY,          -- '{campaign_id}_{date}_{hour}'
  campaign_id  TEXT NOT NULL,
  customer_id  TEXT NOT NULL,
  date         DATE NOT NULL,
  hour         SMALLINT NOT NULL,         -- 0-23
  day_of_week  TEXT NOT NULL,             -- MONDAY, TUESDAY, dst
  impressions  BIGINT DEFAULT 0,
  clicks       BIGINT DEFAULT 0,
  cost_micros  BIGINT DEFAULT 0,
  conversions  NUMERIC(10,2) DEFAULT 0,
  ctr          NUMERIC(8,6) DEFAULT 0,
  average_cpc  BIGINT DEFAULT 0,
  synced_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (campaign_id, date, hour)
);
ALTER TABLE google_perf_hour ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_google_perf_hour" ON google_perf_hour FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_gph_date ON google_perf_hour (date);

-- ── Views (cost sudah dalam IDR) ──────────────────────────────────

CREATE OR REPLACE VIEW v_google_perf_age AS
SELECT
  a.id, a.campaign_id,
  c.name  AS campaign_name,
  c.status AS campaign_status,
  a.date,
  a.age_range,
  a.impressions, a.clicks,
  ROUND(a.cost_micros::NUMERIC / 1000000, 0)  AS cost_idr,
  a.conversions,
  ROUND(a.ctr * 100, 4)                        AS ctr_pct,
  ROUND(a.average_cpc::NUMERIC / 1000000, 0)  AS avg_cpc_idr
FROM google_perf_age a
LEFT JOIN google_campaigns c ON c.id = a.campaign_id;

CREATE OR REPLACE VIEW v_google_perf_gender AS
SELECT
  a.id, a.campaign_id,
  c.name  AS campaign_name,
  c.status AS campaign_status,
  a.date,
  a.gender,
  a.impressions, a.clicks,
  ROUND(a.cost_micros::NUMERIC / 1000000, 0)  AS cost_idr,
  a.conversions,
  ROUND(a.ctr * 100, 4)                        AS ctr_pct,
  ROUND(a.average_cpc::NUMERIC / 1000000, 0)  AS avg_cpc_idr
FROM google_perf_gender a
LEFT JOIN google_campaigns c ON c.id = a.campaign_id;

CREATE OR REPLACE VIEW v_google_perf_geo AS
SELECT
  a.id, a.campaign_id,
  c.name  AS campaign_name,
  c.status AS campaign_status,
  a.date,
  a.country_criterion_id,
  a.location_type,
  a.impressions, a.clicks,
  ROUND(a.cost_micros::NUMERIC / 1000000, 0)  AS cost_idr,
  a.conversions,
  ROUND(a.ctr * 100, 4)                        AS ctr_pct,
  ROUND(a.average_cpc::NUMERIC / 1000000, 0)  AS avg_cpc_idr
FROM google_perf_geo a
LEFT JOIN google_campaigns c ON c.id = a.campaign_id;

CREATE OR REPLACE VIEW v_google_perf_hour AS
SELECT
  a.id, a.campaign_id,
  c.name  AS campaign_name,
  c.status AS campaign_status,
  a.date,
  a.hour,
  a.day_of_week,
  a.impressions, a.clicks,
  ROUND(a.cost_micros::NUMERIC / 1000000, 0)  AS cost_idr,
  a.conversions,
  ROUND(a.ctr * 100, 4)                        AS ctr_pct,
  ROUND(a.average_cpc::NUMERIC / 1000000, 0)  AS avg_cpc_idr
FROM google_perf_hour a
LEFT JOIN google_campaigns c ON c.id = a.campaign_id;

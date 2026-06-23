-- ═══════════════════════════════════════════════════════════════════
-- SQL MIGRATION: Google Ads — Data Kota/Wilayah Detail
-- Jalankan di Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Tabel lookup nama lokasi (dari geo_target_constant API) ───
CREATE TABLE IF NOT EXISTS google_geo_targets (
  criterion_id  TEXT PRIMARY KEY,    -- nomor ID (misal: "1011254")
  name          TEXT NOT NULL,       -- "Surabaya"
  canonical_name TEXT,               -- "Surabaya,East Java,Indonesia"
  country_code  TEXT,                -- "ID"
  target_type   TEXT                 -- "City", "Province", "Country", dll
);
ALTER TABLE google_geo_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_google_geo_targets" ON google_geo_targets FOR SELECT TO anon USING (true);

-- ── 2. Tabel performa per kota/provinsi ──────────────────────────
CREATE TABLE IF NOT EXISTS google_perf_city (
  id                  TEXT PRIMARY KEY,   -- '{campaign_id}_{date}_{city_id}_{region_id}'
  campaign_id         TEXT NOT NULL,
  customer_id         TEXT NOT NULL,
  date                DATE NOT NULL,
  city_criterion_id   TEXT,               -- criterion ID kota (bisa null kalau tidak terdeteksi)
  region_criterion_id TEXT,               -- criterion ID provinsi
  impressions         BIGINT DEFAULT 0,
  clicks              BIGINT DEFAULT 0,
  cost_micros         BIGINT DEFAULT 0,   -- IDR × 1.000.000
  conversions         NUMERIC(10,2) DEFAULT 0,
  ctr                 NUMERIC(8,6) DEFAULT 0,
  average_cpc         BIGINT DEFAULT 0,
  synced_at           TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (campaign_id, date, city_criterion_id, region_criterion_id)
);
ALTER TABLE google_perf_city ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_google_perf_city" ON google_perf_city FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_gpc_date ON google_perf_city (date);
CREATE INDEX IF NOT EXISTS idx_gpc_city ON google_perf_city (city_criterion_id);
CREATE INDEX IF NOT EXISTS idx_gpc_region ON google_perf_city (region_criterion_id);

-- ── 3. View: performa kota dengan nama lengkap ────────────────────
CREATE OR REPLACE VIEW v_google_perf_city AS
SELECT
  p.id,
  p.campaign_id,
  c.name  AS campaign_name,
  p.date,
  p.city_criterion_id,
  COALESCE(gt_city.name,   p.city_criterion_id,   '(tidak diketahui)') AS city_name,
  gt_city.canonical_name   AS city_canonical,
  p.region_criterion_id,
  COALESCE(gt_reg.name,    p.region_criterion_id,  '(tidak diketahui)') AS region_name,
  p.impressions,
  p.clicks,
  ROUND(p.cost_micros::NUMERIC / 1000000, 0) AS cost_idr,
  p.conversions,
  ROUND(p.ctr * 100, 4)                       AS ctr_pct,
  ROUND(p.average_cpc::NUMERIC / 1000000, 0)  AS avg_cpc_idr
FROM google_perf_city p
LEFT JOIN google_campaigns     c       ON c.id      = p.campaign_id
LEFT JOIN google_geo_targets   gt_city ON gt_city.criterion_id = p.city_criterion_id
LEFT JOIN google_geo_targets   gt_reg  ON gt_reg.criterion_id  = p.region_criterion_id;

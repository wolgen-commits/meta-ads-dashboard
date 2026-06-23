-- ═══════════════════════════════════════════════════════════════════
-- SQL: Google Ads — Tabel Lokasi yang Ditargetkan (campaign_criterion)
-- Jalankan di Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS google_location_targeting (
  id           TEXT PRIMARY KEY,   -- '{campaign_id}_{criterion_id}'
  campaign_id  TEXT NOT NULL,
  customer_id  TEXT NOT NULL,
  criterion_id TEXT NOT NULL,      -- ID dari google_geo_targets
  status       TEXT,               -- ENABLED, PAUSED, REMOVED
  is_negative  BOOLEAN DEFAULT false,
  bid_modifier NUMERIC(6,3) DEFAULT 1.0,
  synced_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE google_location_targeting ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_google_location_targeting" ON google_location_targeting FOR SELECT TO anon USING (true);

-- View: join dengan nama lokasi dan kampanye
CREATE OR REPLACE VIEW v_google_location_targeting AS
SELECT
  lt.id, lt.campaign_id,
  c.name  AS campaign_name,
  lt.criterion_id,
  COALESCE(gt.name, lt.criterion_id)          AS location_name,
  gt.canonical_name,
  gt.target_type,
  gt.country_code,
  lt.status, lt.is_negative, lt.bid_modifier
FROM google_location_targeting lt
LEFT JOIN google_campaigns   c  ON c.id  = lt.campaign_id
LEFT JOIN google_geo_targets gt ON gt.criterion_id = lt.criterion_id;

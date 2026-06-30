-- RPC aggregasi audience_insights server-side untuk Magenta
-- audience_insights punya 51.453 baris, PostgREST max_rows=1000 menyebabkan chart salah

-- Drop versi lama dulu kalau ada
DROP FUNCTION IF EXISTS get_magenta_audience_segments(text,date,date,text[]);
DROP FUNCTION IF EXISTS get_magenta_audience_with_messaging(text,date,date,text[]);

-- Agregasi per segmen — semua kolom segmen disertakan agar komponen dapat membaca field yang sesuai
CREATE OR REPLACE FUNCTION get_magenta_audience_segments(
  p_breakdown_type TEXT,
  p_date_start     DATE,
  p_date_stop      DATE,
  p_campaign_ids   TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  age                TEXT,
  gender             TEXT,
  region             TEXT,
  device_platform    TEXT,
  impression_device  TEXT,
  publisher_platform TEXT,
  placement          TEXT,
  impressions        BIGINT,
  reach              BIGINT,
  clicks             BIGINT,
  spend              NUMERIC,
  avg_ctr            NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    age,
    gender,
    region,
    device_platform,
    impression_device,
    publisher_platform,
    placement,
    COALESCE(SUM(impressions), 0)::BIGINT,
    COALESCE(SUM(reach),       0)::BIGINT,
    COALESCE(SUM(clicks),      0)::BIGINT,
    COALESCE(SUM(spend),       0),
    CASE WHEN COALESCE(SUM(impressions), 0) > 0
         THEN SUM(COALESCE(ctr, 0) * COALESCE(impressions, 0)) / SUM(impressions)
         ELSE 0 END
  FROM audience_insights
  WHERE breakdown_type = p_breakdown_type
    AND date_start >= p_date_start
    AND date_start <= p_date_stop
    AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
  GROUP BY age, gender, region, device_platform, impression_device, publisher_platform, placement
  ORDER BY SUM(COALESCE(impressions, 0)) DESC
  LIMIT 50;
$$;

-- Agregasi dengan messaging_conversations proporsional dari ad_performance
CREATE OR REPLACE FUNCTION get_magenta_audience_with_messaging(
  p_breakdown_type TEXT,
  p_date_start     DATE,
  p_date_stop      DATE,
  p_campaign_ids   TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  age                     TEXT,
  gender                  TEXT,
  region                  TEXT,
  device_platform         TEXT,
  impression_device       TEXT,
  publisher_platform      TEXT,
  placement               TEXT,
  impressions             BIGINT,
  reach                   BIGINT,
  clicks                  BIGINT,
  spend                   NUMERIC,
  avg_ctr                 NUMERIC,
  messaging_conversations BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH aud AS (
    SELECT
      age, gender, region, device_platform, impression_device, publisher_platform, placement,
      COALESCE(SUM(impressions), 0) AS impr,
      COALESCE(SUM(reach),       0) AS rch,
      COALESCE(SUM(clicks),      0) AS clk,
      COALESCE(SUM(spend),       0) AS spnd,
      CASE WHEN COALESCE(SUM(impressions), 0) > 0
           THEN SUM(COALESCE(ctr, 0) * COALESCE(impressions, 0)) / SUM(impressions)
           ELSE 0 END AS actr
    FROM audience_insights
    WHERE breakdown_type = p_breakdown_type
      AND date_start >= p_date_start
      AND date_start <= p_date_stop
      AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
    GROUP BY age, gender, region, device_platform, impression_device, publisher_platform, placement
  ),
  total_aud AS (SELECT NULLIF(SUM(impr), 0) AS total_impr FROM aud),
  total_mc  AS (
    SELECT COALESCE(SUM(messaging_conversations), 0) AS total_mc
    FROM ad_performance
    WHERE date_start >= p_date_start
      AND date_start <= p_date_stop
      AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
  )
  SELECT
    aud.age, aud.gender, aud.region, aud.device_platform,
    aud.impression_device, aud.publisher_platform, aud.placement,
    aud.impr::BIGINT,
    aud.rch::BIGINT,
    aud.clk::BIGINT,
    aud.spnd,
    aud.actr,
    CASE WHEN total_aud.total_impr IS NOT NULL
         THEN ROUND(total_mc.total_mc * aud.impr / total_aud.total_impr)::BIGINT
         ELSE 0 END
  FROM aud, total_aud, total_mc
  ORDER BY aud.impr DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION get_magenta_audience_segments       TO anon, service_role;
GRANT EXECUTE ON FUNCTION get_magenta_audience_with_messaging TO anon, service_role;

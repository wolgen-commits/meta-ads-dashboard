-- Fix: reach di demographic chart hanya ~1.8jt padahal KPI 11.6jt
-- Root cause: audience_insights.reach adalah reach harian per segmen, tidak bisa di-SUM
-- Fix: scale reach proporsional dari total KPI reach (sama seperti messaging_conversations)

-- ── Magenta ──────────────────────────────────────────────────────────────────

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
  kpi AS (
    SELECT
      COALESCE(SUM(messaging_conversations), 0) AS total_mc,
      COALESCE(SUM(reach),                   0) AS total_rch
    FROM ad_performance
    WHERE date_start >= p_date_start
      AND date_start <= p_date_stop
      AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
  )
  SELECT
    aud.age, aud.gender, aud.region, aud.device_platform,
    aud.impression_device, aud.publisher_platform, aud.placement,
    aud.impr::BIGINT,
    -- reach di-scale proporsional dari total KPI reach
    CASE WHEN total_aud.total_impr IS NOT NULL
         THEN ROUND(kpi.total_rch * aud.impr / total_aud.total_impr)::BIGINT
         ELSE 0 END,
    aud.clk::BIGINT,
    aud.spnd,
    aud.actr,
    CASE WHEN total_aud.total_impr IS NOT NULL
         THEN ROUND(kpi.total_mc * aud.impr / total_aud.total_impr)::BIGINT
         ELSE 0 END
  FROM aud, total_aud, kpi
  ORDER BY aud.impr DESC
  LIMIT 50;
$$;

-- Fix yang sama untuk get_magenta_audience_segments (dipakai GenderChart)
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
  WITH aud AS (
    SELECT
      age, gender, region, device_platform, impression_device, publisher_platform, placement,
      COALESCE(SUM(impressions), 0) AS impr,
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
  kpi AS (
    SELECT COALESCE(SUM(reach), 0) AS total_rch
    FROM ad_performance
    WHERE date_start >= p_date_start
      AND date_start <= p_date_stop
      AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
  )
  SELECT
    aud.age, aud.gender, aud.region, aud.device_platform,
    aud.impression_device, aud.publisher_platform, aud.placement,
    aud.impr::BIGINT,
    CASE WHEN total_aud.total_impr IS NOT NULL
         THEN ROUND(kpi.total_rch * aud.impr / total_aud.total_impr)::BIGINT
         ELSE 0 END,
    aud.clk::BIGINT,
    aud.spnd,
    aud.actr
  FROM aud, total_aud, kpi
  ORDER BY aud.impr DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION get_magenta_audience_segments       TO anon, service_role;
GRANT EXECUTE ON FUNCTION get_magenta_audience_with_messaging TO anon, service_role;

-- ── Client (Putrama / Jogja / dll) ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_client_audience_with_messaging(
  p_portfolio_slug TEXT,
  p_breakdown_type TEXT,
  p_date_start     DATE,
  p_date_stop      DATE,
  p_campaign_ids   TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  age                    TEXT,
  gender                 TEXT,
  region                 TEXT,
  device_platform        TEXT,
  impression_device      TEXT,
  publisher_platform     TEXT,
  placement              TEXT,
  impressions            BIGINT,
  reach                  BIGINT,
  clicks                 BIGINT,
  spend                  NUMERIC,
  messaging_conversations BIGINT,
  avg_ctr                NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH aud AS (
    SELECT
      age, gender, region, device_platform, impression_device, publisher_platform, placement,
      SUM(impressions)::BIGINT AS impr,
      SUM(clicks)::BIGINT      AS clk,
      SUM(spend)::NUMERIC      AS spnd
    FROM client_audience_insights
    WHERE portfolio_slug = p_portfolio_slug
      AND date_start >= p_date_start
      AND date_start <= p_date_stop
      AND breakdown_type = p_breakdown_type
      AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
    GROUP BY age, gender, region, device_platform, impression_device, publisher_platform, placement
  ),
  total_aud AS (SELECT NULLIF(SUM(impr), 0) AS total_impr FROM aud),
  kpi AS (
    SELECT
      COALESCE(SUM(messaging_conversations), 0)::BIGINT AS total_mc,
      COALESCE(SUM(reach),                   0)::BIGINT AS total_rch
    FROM client_ad_performance
    WHERE portfolio_slug = p_portfolio_slug
      AND date_start >= p_date_start
      AND date_start <= p_date_stop
      AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
  )
  SELECT
    aud.age, aud.gender, aud.region, aud.device_platform,
    aud.impression_device, aud.publisher_platform, aud.placement,
    aud.impr,
    -- reach di-scale proporsional dari total KPI reach
    CASE WHEN ta.total_impr IS NOT NULL
      THEN ROUND(aud.impr::NUMERIC / ta.total_impr * kpi.total_rch)::BIGINT
      ELSE 0
    END,
    aud.clk,
    aud.spnd,
    CASE WHEN ta.total_impr IS NOT NULL
      THEN ROUND(aud.impr::NUMERIC / ta.total_impr * kpi.total_mc)::BIGINT
      ELSE 0
    END,
    CASE WHEN aud.impr > 0
      THEN ROUND((aud.clk::NUMERIC / aud.impr) * 100, 4)
      ELSE 0
    END
  FROM aud, total_aud ta, kpi
  ORDER BY aud.impr DESC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION get_client_audience_segments(
  p_portfolio_slug TEXT,
  p_breakdown_type TEXT,
  p_date_start     DATE,
  p_date_stop      DATE,
  p_campaign_ids   TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  age                    TEXT,
  gender                 TEXT,
  region                 TEXT,
  device_platform        TEXT,
  impression_device      TEXT,
  publisher_platform     TEXT,
  placement              TEXT,
  impressions            BIGINT,
  reach                  BIGINT,
  clicks                 BIGINT,
  spend                  NUMERIC,
  messaging_conversations BIGINT,
  avg_ctr                NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH aud AS (
    SELECT
      age, gender, region, device_platform, impression_device, publisher_platform, placement,
      SUM(impressions)::BIGINT AS impr,
      SUM(clicks)::BIGINT      AS clk,
      SUM(spend)::NUMERIC      AS spnd
    FROM client_audience_insights
    WHERE portfolio_slug = p_portfolio_slug
      AND date_start >= p_date_start
      AND date_start <= p_date_stop
      AND breakdown_type = p_breakdown_type
      AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
    GROUP BY age, gender, region, device_platform, impression_device, publisher_platform, placement
  ),
  total_aud AS (SELECT NULLIF(SUM(impr), 0) AS total_impr FROM aud),
  kpi AS (
    SELECT
      COALESCE(SUM(reach),                   0)::BIGINT AS total_rch,
      COALESCE(SUM(messaging_conversations), 0)::BIGINT AS total_mc
    FROM client_ad_performance
    WHERE portfolio_slug = p_portfolio_slug
      AND date_start >= p_date_start
      AND date_start <= p_date_stop
      AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
  )
  SELECT
    aud.age, aud.gender, aud.region, aud.device_platform,
    aud.impression_device, aud.publisher_platform, aud.placement,
    aud.impr,
    CASE WHEN ta.total_impr IS NOT NULL
      THEN ROUND(aud.impr::NUMERIC / ta.total_impr * kpi.total_rch)::BIGINT
      ELSE 0
    END,
    aud.clk,
    aud.spnd,
    CASE WHEN ta.total_impr IS NOT NULL
      THEN ROUND(aud.impr::NUMERIC / ta.total_impr * kpi.total_mc)::BIGINT
      ELSE 0
    END,
    CASE WHEN aud.impr > 0
      THEN ROUND((aud.clk::NUMERIC / aud.impr) * 100, 4)
      ELSE 0
    END
  FROM aud, total_aud ta, kpi
  ORDER BY aud.impr DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION get_client_audience_with_messaging TO anon, service_role;
GRANT EXECUTE ON FUNCTION get_client_audience_segments       TO anon, service_role;

-- Migration: Add unique constraint to client_audience_insights + RPC functions
-- 2026-06-30

-- 1. Tambah UNIQUE constraint
ALTER TABLE client_audience_insights
  ADD CONSTRAINT client_audience_insights_unique
  UNIQUE (portfolio_slug, account_id, date_start, breakdown_type, age, gender, region, device_platform, impression_device, publisher_platform, placement);

-- 2. RPC: get_client_audience_segments
DROP FUNCTION IF EXISTS get_client_audience_segments(TEXT, TEXT, DATE, DATE, TEXT[]);
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
  SELECT
    age,
    gender,
    region,
    device_platform,
    impression_device,
    publisher_platform,
    placement,
    SUM(impressions)::BIGINT           AS impressions,
    SUM(reach)::BIGINT                 AS reach,
    SUM(clicks)::BIGINT                AS clicks,
    SUM(spend)::NUMERIC                AS spend,
    SUM(messaging_conversations)::BIGINT AS messaging_conversations,
    CASE WHEN SUM(impressions) > 0
      THEN ROUND((SUM(clicks)::NUMERIC / SUM(impressions)) * 100, 4)
      ELSE 0
    END                                AS avg_ctr
  FROM client_audience_insights
  WHERE portfolio_slug = p_portfolio_slug
    AND date_start >= p_date_start
    AND date_start <= p_date_stop
    AND breakdown_type = p_breakdown_type
    AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
  GROUP BY age, gender, region, device_platform, impression_device, publisher_platform, placement
  ORDER BY SUM(impressions) DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION get_client_audience_segments(TEXT, TEXT, DATE, DATE, TEXT[]) TO anon, service_role;

-- 3. RPC: get_client_audience_with_messaging (distribusi mc proporsional dari ad_performance)
DROP FUNCTION IF EXISTS get_client_audience_with_messaging(TEXT, TEXT, DATE, DATE, TEXT[]);
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
      SUM(impressions)::BIGINT AS impressions,
      SUM(reach)::BIGINT       AS reach,
      SUM(clicks)::BIGINT      AS clicks,
      SUM(spend)::NUMERIC      AS spend
    FROM client_audience_insights
    WHERE portfolio_slug = p_portfolio_slug
      AND date_start >= p_date_start
      AND date_start <= p_date_stop
      AND breakdown_type = p_breakdown_type
      AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
    GROUP BY age, gender, region, device_platform, impression_device, publisher_platform, placement
  ),
  total_aud AS (SELECT COALESCE(SUM(impressions), 0) AS total FROM aud),
  total_mc  AS (
    SELECT COALESCE(SUM(messaging_conversations), 0)::BIGINT AS total
    FROM client_ad_performance
    WHERE portfolio_slug = p_portfolio_slug
      AND date_start >= p_date_start
      AND date_start <= p_date_stop
      AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
  )
  SELECT
    aud.age, aud.gender, aud.region, aud.device_platform,
    aud.impression_device, aud.publisher_platform, aud.placement,
    aud.impressions, aud.reach, aud.clicks, aud.spend,
    CASE WHEN ta.total > 0
      THEN ROUND(aud.impressions::NUMERIC / ta.total * tm.total)::BIGINT
      ELSE 0
    END AS messaging_conversations,
    CASE WHEN aud.impressions > 0
      THEN ROUND((aud.clicks::NUMERIC / aud.impressions) * 100, 4)
      ELSE 0
    END AS avg_ctr
  FROM aud, total_aud ta, total_mc tm
  ORDER BY aud.impressions DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION get_client_audience_with_messaging(TEXT, TEXT, DATE, DATE, TEXT[]) TO anon, service_role;

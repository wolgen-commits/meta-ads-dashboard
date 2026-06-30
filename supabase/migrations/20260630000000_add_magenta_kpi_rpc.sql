-- RPC aggregasi server-side untuk Magenta ad_performance
-- Menghindari batas max_rows PostgREST (default 1000), tabel punya 1773+ baris

CREATE OR REPLACE FUNCTION get_magenta_kpi_totals(
  p_date_start   DATE,
  p_date_stop    DATE,
  p_campaign_ids TEXT[] DEFAULT NULL,
  p_adset_ids    TEXT[] DEFAULT NULL,
  p_ad_ids       TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  impressions             BIGINT,
  reach                   BIGINT,
  clicks                  BIGINT,
  link_clicks             BIGINT,
  spend                   NUMERIC,
  messaging_conversations BIGINT,
  leads                   BIGINT,
  purchases               BIGINT,
  purchase_value          NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    COALESCE(SUM(impressions),             0)::BIGINT,
    COALESCE(SUM(reach),                   0)::BIGINT,
    COALESCE(SUM(clicks),                  0)::BIGINT,
    COALESCE(SUM(link_clicks),             0)::BIGINT,
    COALESCE(SUM(spend),                   0),
    COALESCE(SUM(messaging_conversations), 0)::BIGINT,
    COALESCE(SUM(leads),                   0)::BIGINT,
    COALESCE(SUM(purchases),               0)::BIGINT,
    COALESCE(SUM(purchase_value),          0)
  FROM ad_performance
  WHERE date_start >= p_date_start
    AND date_start <= p_date_stop
    AND (p_ad_ids       IS NULL OR ad_id     = ANY(p_ad_ids))
    AND (p_adset_ids    IS NULL OR (p_ad_ids IS NOT NULL OR adset_id = ANY(p_adset_ids)))
    AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids));
$$;

CREATE OR REPLACE FUNCTION get_magenta_spend_chart(
  p_date_start   DATE,
  p_date_stop    DATE,
  p_campaign_ids TEXT[] DEFAULT NULL,
  p_adset_ids    TEXT[] DEFAULT NULL,
  p_ad_ids       TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  date_start              TEXT,
  spend                   NUMERIC,
  messaging_conversations BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    date_start::TEXT,
    COALESCE(SUM(spend),                   0),
    COALESCE(SUM(messaging_conversations), 0)::BIGINT
  FROM ad_performance
  WHERE date_start >= p_date_start
    AND date_start <= p_date_stop
    AND (p_ad_ids       IS NULL OR ad_id     = ANY(p_ad_ids))
    AND (p_adset_ids    IS NULL OR (p_ad_ids IS NOT NULL OR adset_id = ANY(p_adset_ids)))
    AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
  GROUP BY date_start
  ORDER BY date_start;
$$;

GRANT EXECUTE ON FUNCTION get_magenta_kpi_totals    TO anon, service_role;
GRANT EXECUTE ON FUNCTION get_magenta_spend_chart   TO anon, service_role;

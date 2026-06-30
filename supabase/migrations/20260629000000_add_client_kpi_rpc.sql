-- RPC untuk aggregasi KPI client portfolio server-side
-- Menghindari batas max_rows PostgREST (default 1000)

CREATE OR REPLACE FUNCTION get_client_kpi_totals(
  p_portfolio_slug TEXT,
  p_date_start     DATE,
  p_date_stop      DATE,
  p_campaign_ids   TEXT[] DEFAULT NULL
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
  purchase_value          NUMERIC,
  results                 BIGINT
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
    COALESCE(SUM(purchase_value),          0),
    COALESCE(SUM(results),                 0)::BIGINT
  FROM client_ad_performance
  WHERE portfolio_slug = p_portfolio_slug
    AND date_start >= p_date_start
    AND date_start <= p_date_stop
    AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids));
$$;

-- RPC untuk chart spend harian
CREATE OR REPLACE FUNCTION get_client_spend_chart(
  p_portfolio_slug TEXT,
  p_date_start     DATE,
  p_date_stop      DATE,
  p_campaign_ids   TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  date    TEXT,
  spend   NUMERIC,
  results BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    date_start::TEXT,
    COALESCE(SUM(spend),   0),
    COALESCE(SUM(results), 0)::BIGINT
  FROM client_ad_performance
  WHERE portfolio_slug = p_portfolio_slug
    AND date_start >= p_date_start
    AND date_start <= p_date_stop
    AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
  GROUP BY date_start
  ORDER BY date_start;
$$;

-- RPC untuk chart engagement harian
CREATE OR REPLACE FUNCTION get_client_engagement_chart(
  p_portfolio_slug TEXT,
  p_date_start     DATE,
  p_date_stop      DATE,
  p_campaign_ids   TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  date          TEXT,
  reactions     BIGINT,
  comments      BIGINT,
  shares        BIGINT,
  saves         BIGINT,
  conversations BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    date_start::TEXT,
    COALESCE(SUM(post_reactions),            0)::BIGINT,
    COALESCE(SUM(post_comments),             0)::BIGINT,
    COALESCE(SUM(post_shares),               0)::BIGINT,
    COALESCE(SUM(post_saves),                0)::BIGINT,
    COALESCE(SUM(messaging_conversations),   0)::BIGINT
  FROM client_ad_performance
  WHERE portfolio_slug = p_portfolio_slug
    AND date_start >= p_date_start
    AND date_start <= p_date_stop
    AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
  GROUP BY date_start
  ORDER BY date_start;
$$;

-- RPC untuk tabel performa per campaign
CREATE OR REPLACE FUNCTION get_client_campaign_table(
  p_portfolio_slug TEXT,
  p_date_start     DATE,
  p_date_stop      DATE,
  p_campaign_ids   TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  campaign_id   TEXT,
  impressions   BIGINT,
  reach         BIGINT,
  clicks        BIGINT,
  spend         NUMERIC,
  results       BIGINT,
  leads         BIGINT,
  conversations BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    campaign_id,
    COALESCE(SUM(impressions),             0)::BIGINT,
    COALESCE(SUM(reach),                   0)::BIGINT,
    COALESCE(SUM(clicks),                  0)::BIGINT,
    COALESCE(SUM(spend),                   0),
    COALESCE(SUM(results),                 0)::BIGINT,
    COALESCE(SUM(leads),                   0)::BIGINT,
    COALESCE(SUM(messaging_conversations), 0)::BIGINT
  FROM client_ad_performance
  WHERE portfolio_slug = p_portfolio_slug
    AND date_start >= p_date_start
    AND date_start <= p_date_stop
    AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
  GROUP BY campaign_id
  ORDER BY SUM(spend) DESC;
$$;

-- Grant akses ke anon dan service_role
GRANT EXECUTE ON FUNCTION get_client_kpi_totals       TO anon, service_role;
GRANT EXECUTE ON FUNCTION get_client_spend_chart       TO anon, service_role;
GRANT EXECUTE ON FUNCTION get_client_engagement_chart  TO anon, service_role;
GRANT EXECUTE ON FUNCTION get_client_campaign_table    TO anon, service_role;

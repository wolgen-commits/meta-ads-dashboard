-- Tambah kolom conversations ke get_client_spend_chart
-- Dibutuhkan agar chart Spend Harian & CPA bisa pakai CPA = Spend ÷ Percakapan

DROP FUNCTION IF EXISTS get_client_spend_chart(text, date, date, text[]);

CREATE FUNCTION get_client_spend_chart(
  p_portfolio_slug TEXT,
  p_date_start     DATE,
  p_date_stop      DATE,
  p_campaign_ids   TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  date          TEXT,
  spend         NUMERIC,
  results       BIGINT,
  conversations BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    date_start::TEXT,
    COALESCE(SUM(spend),                    0),
    COALESCE(SUM(results),                  0)::BIGINT,
    COALESCE(SUM(messaging_conversations),  0)::BIGINT
  FROM client_ad_performance
  WHERE portfolio_slug = p_portfolio_slug
    AND date_start >= p_date_start
    AND date_start <= p_date_stop
    AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
  GROUP BY date_start
  ORDER BY date_start;
$$;

GRANT EXECUTE ON FUNCTION get_client_spend_chart TO anon, service_role;

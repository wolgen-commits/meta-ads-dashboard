-- Fix: upsert ig_account_insights tanpa menimpa followers_count yang valid dengan 0
-- Masalah: chunk 1-2 hanya fetch reach (bukan follower_count), sehingga upsert biasa
-- menulis followers_count = 0 dan menimpa data valid dari chunk 0.
-- Solusi: ON CONFLICT DO UPDATE dengan CASE yang mempertahankan nilai lama jika baru = 0.

CREATE OR REPLACE FUNCTION upsert_ig_account_insights(p_rows jsonb)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO ig_account_insights (
    ig_account_id, date, impressions, reach,
    profile_views, website_clicks,
    followers_count, likes_count, comments_count,
    shares_count, saves_count, synced_at
  )
  SELECT
    r->>'ig_account_id',
    (r->>'date')::date,
    COALESCE((r->>'impressions')::int, 0),
    COALESCE((r->>'reach')::int, 0),
    COALESCE((r->>'profile_views')::int, 0),
    COALESCE((r->>'website_clicks')::int, 0),
    COALESCE((r->>'followers_count')::int, 0),
    COALESCE((r->>'likes_count')::int, 0),
    COALESCE((r->>'comments_count')::int, 0),
    COALESCE((r->>'shares_count')::int, 0),
    COALESCE((r->>'saves_count')::int, 0),
    now()
  FROM jsonb_array_elements(p_rows) r
  ON CONFLICT (ig_account_id, date) DO UPDATE SET
    reach           = EXCLUDED.reach,
    followers_count = CASE
                        WHEN EXCLUDED.followers_count > 0
                        THEN EXCLUDED.followers_count
                        ELSE ig_account_insights.followers_count
                      END,
    synced_at       = EXCLUDED.synced_at;
END;
$$;

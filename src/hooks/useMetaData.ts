import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { CampaignDailySummary, CampaignEngagementDaily, AudienceTopSegment, SyncLog, MetaCampaign, IgAccount, IgMedia, IgMediaInsight } from "@/types/database";

const REVALIDATE = 5 * 60 * 1000;

// ── Daftar campaign untuk dropdown filter ─────────────────────────────────────
export function useCampaignList(objectives: string[] = []) {
  return useSWR<MetaCampaign[]>(
    ["campaign_list", objectives.join(",")],
    async () => {
      let query = supabase
        .from("meta_campaigns")
        .select("id,name,status,objective")
        .order("name", { ascending: true });

      if (objectives.length > 0) {
        query = query.in("objective", objectives);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    { refreshInterval: REVALIDATE },
  );
}

// ── Daftar objective unik ─────────────────────────────────────────────────────
export function useObjectiveList() {
  return useSWR<string[]>(
    "objective_list",
    async () => {
      const { data, error } = await supabase
        .from("meta_campaigns")
        .select("objective")
        .not("objective", "is", null);
      if (error) throw error;
      const rows = (data ?? []) as { objective: string | null }[];
      const unique = Array.from(new Set(rows.map((r) => r.objective).filter((o): o is string => o !== null)));
      return unique.sort();
    },
    { refreshInterval: REVALIDATE },
  );
}

// ── Campaign summary dengan filter ────────────────────────────────────────────
export function useCampaignSummary(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  return useSWR<CampaignDailySummary[]>(
    ["campaign_summary", dateStart, dateStop, campaignIds.join(",")],
    async () => {
      let query = supabase
        .from("v_campaign_daily_summary")
        .select("*")
        .gte("date_start", dateStart)
        .lte("date_start", dateStop)
        .order("date_start", { ascending: true });

      if (campaignIds.length > 0) {
        query = query.in("campaign_id", campaignIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    { refreshInterval: REVALIDATE },
  );
}

// ── KPI totals ────────────────────────────────────────────────────────────────
export function useKpiTotals(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const { data, error, isLoading } = useCampaignSummary(dateStart, dateStop, campaignIds);
  const totals = data
    ? data.reduce(
        (acc, row) => ({
          impressions:    acc.impressions    + (row.total_impressions ?? 0),
          reach:          acc.reach          + (row.total_reach ?? 0),
          clicks:         acc.clicks         + (row.total_clicks ?? 0),
          spend:          acc.spend          + (row.total_spend ?? 0),
          purchases:      acc.purchases      + (row.total_purchases ?? 0),
          purchase_value: acc.purchase_value + (row.total_purchase_value ?? 0),
          leads:          acc.leads          + (row.total_leads ?? 0),
        }),
        { impressions: 0, reach: 0, clicks: 0, spend: 0, purchases: 0, purchase_value: 0, leads: 0 },
      )
    : null;
  const derived = totals ? {
    ...totals,
    ctr:  totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc:  totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    roas: totals.spend > 0  ? totals.purchase_value / totals.spend : 0,
  } : null;
  return { totals: derived, error, isLoading };
}

// ── Spend chart ────────────────────────────────────────────────────────────────
export function useSpendChart(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const { data, error, isLoading } = useCampaignSummary(dateStart, dateStop, campaignIds);
  const chartData = data
    ? Object.values(
        data.reduce<Record<string, { date: string; spend: number; roas: number; impressions: number }>>(
          (acc, row) => {
            const d = row.date_start;
            if (!acc[d]) acc[d] = { date: d, spend: 0, roas: 0, impressions: 0 };
            acc[d].spend       += row.total_spend ?? 0;
            acc[d].impressions += row.total_impressions ?? 0;
            const s = acc[d].spend;
            if (s > 0) acc[d].roas = ((acc[d].roas * (s - (row.total_spend ?? 0))) + ((row.roas ?? 0) * (row.total_spend ?? 0))) / s;
            return acc;
          }, {},
        ),
      ).sort((a, b) => a.date.localeCompare(b.date))
    : [];
  return { chartData, error, isLoading };
}

// ── Engagement summary ─────────────────────────────────────────────────────────
export function useEngagementSummary(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  return useSWR<CampaignEngagementDaily[]>(
    ["engagement_summary", dateStart, dateStop, campaignIds.join(",")],
    async () => {
      let query = supabase
        .from("v_campaign_engagement_daily")
        .select("*")
        .gte("date_start", dateStart)
        .lte("date_start", dateStop)
        .order("date_start", { ascending: true });

      if (campaignIds.length > 0) {
        query = query.in("campaign_id", campaignIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    { refreshInterval: REVALIDATE },
  );
}

// ── Audience segments ──────────────────────────────────────────────────────────
export function useAudienceSegments(breakdownType: string, campaignIds: string[] = []) {
  return useSWR<AudienceTopSegment[]>(
    ["audience_segments", breakdownType, campaignIds.join(",")],
    async () => {
      let query = supabase
        .from("v_audience_top_segments")
        .select("*")
        .eq("breakdown_type", breakdownType)
        .order("impressions", { ascending: false })
        .limit(20);

      if (campaignIds.length > 0) {
        query = query.in("campaign_id", campaignIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    { refreshInterval: REVALIDATE },
  );
}

// ── Sync log ──────────────────────────────────────────────────────────────────
export function useSyncLog() {
  return useSWR<SyncLog[]>(
    "sync_log",
    async () => {
      const { data, error } = await supabase
        .from("meta_sync_log")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    { refreshInterval: 60_000 },
  );
}

// ── Instagram hooks ───────────────────────────────────────────────────────────

export function useIgAccounts() {
  return useSWR<IgAccount[]>(
    "ig_accounts",
    async () => {
      const { data, error } = await supabase.from("ig_accounts").select("*");
      if (error) throw error;
      return data ?? [];
    },
    { refreshInterval: REVALIDATE },
  );
}

export function useIgTopMedia(accountId: string, limit = 12) {
  return useSWR<(IgMedia & IgMediaInsight)[]>(
    ["ig_top_media", accountId, limit],
    async () => {
      const { data, error } = await supabase
        .from("ig_media_insights")
        .select("*, ig_media!inner(id, ig_account_id, media_type, media_product_type, caption, permalink, timestamp, thumbnail_url)")
        .eq("ig_account_id", accountId)
        .not("ig_media.media_product_type", "eq", "STORY")
        .order("ig_media(timestamp)", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        ...m.ig_media,
        likes:      m.likes,
        comments:   m.comments,
        shares:     m.shares,
        saved:      m.saved,
        reach:      m.reach,
        impressions: m.impressions,
        video_views: m.video_views,
        plays:      m.plays,
      }));
    },
    { refreshInterval: REVALIDATE },
  );
}

export function useIgSummary(accountId: string) {
  return useSWR<{
    total_likes: number; total_comments: number;
    total_shares: number; total_saved: number;
    total_reach: number; avg_engagement_rate: number;
  }>(
    ["ig_summary", accountId],
    async () => {
      const { data, error } = await supabase
        .from("ig_media_insights")
        .select("likes,comments,shares,saved,reach")
        .eq("ig_account_id", accountId);
      if (error) throw error;
      const rows = (data ?? []) as Pick<IgMediaInsight, "likes" | "comments" | "shares" | "saved" | "reach">[];
      const total_likes    = rows.reduce((s, r) => s + (r.likes ?? 0), 0);
      const total_comments = rows.reduce((s, r) => s + (r.comments ?? 0), 0);
      const total_shares   = rows.reduce((s, r) => s + (r.shares ?? 0), 0);
      const total_saved    = rows.reduce((s, r) => s + (r.saved ?? 0), 0);
      const total_reach    = rows.reduce((s, r) => s + (r.reach ?? 0), 0);
      const total_eng      = total_likes + total_comments + total_shares + total_saved;
      return {
        total_likes, total_comments, total_shares, total_saved, total_reach,
        avg_engagement_rate: total_reach > 0 ? (total_eng / total_reach) * 100 : 0,
      };
    },
    { refreshInterval: REVALIDATE },
  );
}

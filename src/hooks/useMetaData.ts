import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { CampaignDailySummary, CampaignEngagementDaily, AudienceInsight, AudienceTopSegment, SyncLog, MetaCampaign } from "@/types/database";

const REVALIDATE = 5 * 60 * 1000;

// Ambil SEMUA campaign sekaligus — filtering dilakukan di komponen
export function useCampaignList() {
  return useSWR<MetaCampaign[]>(
    "campaign_list",
    async () => {
      const { data, error } = await supabase
        .from("meta_campaigns")
        .select("id,name,status,objective")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    { refreshInterval: REVALIDATE },
  );
}

// Ambil daftar objective unik
export function useObjectiveList() {
  return useSWR<string[]>(
    "objective_list",
    async () => {
      const { data, error } = await supabase
        .from("meta_campaigns")
        .select("objective")
        .not("objective", "is", null);
      if (error) throw error;
      const rows = (data ?? []) as Array<Pick<MetaCampaign, "objective">>;
      const unique = [...new Set(rows.map((d) => d.objective).filter(Boolean))] as string[];
      return unique.sort();
    },
    { refreshInterval: REVALIDATE },
  );
}

export function useCampaignSummary(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  return useSWR<CampaignDailySummary[]>(
    ["campaign_summary", dateStart, dateStop, campaignIds.sort().join(",")],
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

export function useEngagementSummary(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  return useSWR<CampaignEngagementDaily[]>(
    ["engagement_summary", dateStart, dateStop, campaignIds.sort().join(",")],
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

export function useAudienceSegments(
  breakdownType: string,
  dateStart: string,
  dateStop: string,
  campaignIds: string[] = [],
) {
  const sortedIds = [...campaignIds].sort();
  return useSWR<AudienceTopSegment[]>(
    ["audience_segments", breakdownType, dateStart, dateStop, sortedIds.join(",")],
    async () => {
      const baseQuery = () =>
        supabase
          .from("audience_insights")
          .select("*")
          .eq("breakdown_type", breakdownType)
          .gte("date_start", dateStart)
          .lte("date_start", dateStop);

      let q = baseQuery();
      if (sortedIds.length > 0) q = q.in("campaign_id", sortedIds);

      let { data, error } = await q;
      if (error) throw error;

      // Fallback: jika filter campaign menghasilkan kosong, coba tanpa filter campaign
      // (audience_insights mungkin tidak di-keyed per campaign di database ini)
      if ((!data || data.length === 0) && sortedIds.length > 0) {
        const fallback = await baseQuery();
        if (fallback.error) throw fallback.error;
        data = fallback.data;
      }
      const rows = (data ?? []) as AudienceInsight[];
      const grouped = rows.reduce<Record<string, AudienceTopSegment & { ctr_weight: number }>>((acc, row) => {
        const segmentKey =
          breakdownType === "age,gender" ? `${row.age ?? "-"}|${row.gender ?? "-"}` :
          breakdownType === "region" ? row.region ?? "-" :
          breakdownType === "impression_device" ? row.device_platform ?? "-" :
          row.placement ?? "-";

        if (!acc[segmentKey]) {
          acc[segmentKey] = {
            campaign_id: row.campaign_id,
            campaign_name: row.campaign_id,
            breakdown_type: row.breakdown_type,
            age: row.age,
            gender: row.gender,
            region: row.region,
            device_platform: row.device_platform,
            placement: row.placement,
            impressions: 0,
            clicks: 0,
            spend: 0,
            avg_ctr: 0,
            ctr_weight: 0,
          };
        }

        acc[segmentKey].impressions += row.impressions ?? 0;
        acc[segmentKey].clicks += row.clicks ?? 0;
        acc[segmentKey].spend += row.spend ?? 0;
        acc[segmentKey].ctr_weight += (row.ctr ?? 0) * (row.impressions ?? 0);
        return acc;
      }, {});

      return Object.values(grouped)
        .map(({ ctr_weight, ...row }) => ({
          ...row,
          avg_ctr: row.impressions > 0 ? ctr_weight / row.impressions : 0,
        }))
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 20);
    },
    { refreshInterval: REVALIDATE },
  );
}

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

export interface IgAccount {
  id: string; name: string; username: string;
  followers_count: number; media_count: number; synced_at: string;
}

export interface IgMedia {
  id: string; ig_account_id: string; media_type: string;
  media_product_type: string; caption: string | null;
  permalink: string | null; timestamp: string; thumbnail_url: string | null;
}

export interface IgMediaInsight {
  media_id: string; ig_account_id: string;
  likes: number; comments: number; shares: number; saved: number;
  reach: number; impressions: number; video_views: number;
}

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
      const { data: mediaData, error: mediaError } = await supabase
        .from("ig_media")
        .select("*")
        .eq("ig_account_id", accountId)
        .not("media_product_type", "eq", "STORY")
        .order("timestamp", { ascending: false })
        .limit(limit);
      if (mediaError) throw mediaError;

      const mediaItems = mediaData ?? [];
      if (mediaItems.length === 0) return [];

      const mediaIds = mediaItems.map((m: IgMedia) => m.id);
      const { data: insightData, error: insightError } = await supabase
        .from("ig_media_insights")
        .select("*")
        .in("media_id", mediaIds);
      if (insightError) throw insightError;

      const insightsMap = new Map(
        (insightData ?? []).map((i: IgMediaInsight) => [i.media_id, i])
      );

      return mediaItems.map((m: IgMedia) => ({
        ...m,
        ...(insightsMap.get(m.id) ?? {}),
      })) as (IgMedia & IgMediaInsight)[];
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
      const rows = (data ?? []) as Array<Pick<IgMediaInsight, "likes" | "comments" | "shares" | "saved" | "reach">>;
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

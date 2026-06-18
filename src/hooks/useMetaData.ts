import useSWR from "swr";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { CampaignDailySummary, CampaignEngagementDaily, AudienceInsight, AudienceTopSegment, SyncLog, MetaCampaign, MetaAdset, MetaAd } from "@/types/database";

const REVALIDATE = 5 * 60 * 1000;

// Ambil campaign berdasarkan rentang tanggal atau semua jika tanggal kosong
export function useCampaignList(dateStart?: string, dateStop?: string) {
  return useSWR<MetaCampaign[]>(
    ["campaign_list", dateStart, dateStop],
    async () => {
      if (dateStart && dateStop) {
        // Ambil ID campaign yang aktif (mempunyai data performa) dalam rentang tanggal
        const { data: perfData, error: perfError } = await supabase
          .from("ad_performance")
          .select("campaign_id")
          .gte("date_start", dateStart)
          .lte("date_start", dateStop);
        if (perfError) throw perfError;

        const rows = (perfData ?? []) as Array<{ campaign_id: string }>;
        const activeCampaignIds = Array.from(new Set(rows.map((p) => p.campaign_id).filter(Boolean)));
        if (activeCampaignIds.length === 0) return [];

        const { data, error } = await supabase
          .from("meta_campaigns")
          .select("id,name,status,objective")
          .in("id", activeCampaignIds)
          .order("name", { ascending: true });
        if (error) throw error;
        return data ?? [];
      }

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

export function useAdsetList(dateStart?: string, dateStop?: string, campaignIds: string[] = []) {
  const sorted = [...campaignIds].sort();
  return useSWR<MetaAdset[]>(
    ["adset_list", dateStart, dateStop, sorted.join(",")],
    async () => {
      if (dateStart && dateStop) {
        let perfQuery = supabase
          .from("ad_performance")
          .select("adset_id")
          .gte("date_start", dateStart)
          .lte("date_start", dateStop);

        if (sorted.length > 0) perfQuery = perfQuery.in("campaign_id", sorted);

        const { data: perfData, error: perfError } = await perfQuery;
        if (perfError) throw perfError;

        const rows = (perfData ?? []) as Array<{ adset_id: string }>;
        const activeAdsetIds = Array.from(new Set(rows.map((p) => p.adset_id).filter(Boolean)));
        if (activeAdsetIds.length === 0) return [];

        const { data, error } = await supabase
          .from("meta_adsets")
          .select("id,name,campaign_id,status")
          .in("id", activeAdsetIds)
          .order("name", { ascending: true });
        if (error) throw error;
        return data ?? [];
      }

      let query = supabase
        .from("meta_adsets")
        .select("id,name,campaign_id,status")
        .order("name", { ascending: true });
      if (sorted.length > 0) query = query.in("campaign_id", sorted);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    { refreshInterval: REVALIDATE },
  );
}

export function useAdList(adsetIds: string[] = [], campaignIds: string[] = []) {
  const sortedAdsets = [...adsetIds].sort();
  const sortedCampaigns = [...campaignIds].sort();
  return useSWR<MetaAd[]>(
    ["ad_list", sortedAdsets.join(","), sortedCampaigns.join(",")],
    async () => {
      let query = supabase
        .from("meta_ads")
        .select("id,name,adset_id,campaign_id,status")
        .order("name", { ascending: true });
      if (sortedAdsets.length > 0) query = query.in("adset_id", sortedAdsets);
      else if (sortedCampaigns.length > 0) query = query.in("campaign_id", sortedCampaigns);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    { refreshInterval: REVALIDATE },
  );
}

export function useCampaignSummary(
  dateStart: string,
  dateStop: string,
  campaignIds: string[] = [],
  adsetIds: string[] = [],
  adIds: string[] = [],
) {
  const sc = [...campaignIds].sort();
  const sa = [...adsetIds].sort();
  const si = [...adIds].sort();
  return useSWR<CampaignDailySummary[]>(
    ["campaign_summary", dateStart, dateStop, sc.join(","), sa.join(","), si.join(",")],
    async () => {
      // When filtering by adset or ad, query ad_performance directly
      if (sa.length > 0 || si.length > 0) {
        type PerfRow = { campaign_id: string; date_start: string; impressions: number; reach: number; clicks: number; spend: number; purchases: number; purchase_value: number; leads: number };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = supabase
          .from("ad_performance")
          .select("campaign_id,date_start,impressions,reach,clicks,spend,purchases,purchase_value,leads")
          .gte("date_start", dateStart)
          .lte("date_start", dateStop);
        if (si.length > 0) q = q.in("ad_id", si);
        else if (sa.length > 0) q = q.in("adset_id", sa);
        if (sc.length > 0) q = q.in("campaign_id", sc);
        const { data: rawData, error } = await q as { data: PerfRow[] | null; error: { message: string } | null };
        if (error) throw error;
        const grouped: Record<string, CampaignDailySummary> = {};
        for (const row of (rawData ?? [])) {
          const key = `${row.campaign_id}|${row.date_start}`;
          if (!grouped[key]) {
            grouped[key] = {
              campaign_id: row.campaign_id, campaign_name: row.campaign_id,
              objective: null, date_start: row.date_start, month: row.date_start.slice(0, 7),
              impressions: 0, reach: 0, clicks: 0, link_clicks: 0,
              spend: 0, results: 0, result_value: 0, leads: 0,
              post_engagement: 0, ctr: 0, cpc: 0, cost_per_lead: 0,
            };
          }
          const g = grouped[key];
          g.impressions  += row.impressions    ?? 0;
          g.reach        += row.reach          ?? 0;
          g.clicks       += row.clicks         ?? 0;
          g.spend        += row.spend          ?? 0;
          g.results      += row.purchases      ?? 0;
          g.result_value += row.purchase_value ?? 0;
          g.leads        += row.leads          ?? 0;
        }
        return Object.values(grouped).sort((a, b) => a.date_start.localeCompare(b.date_start));
      }
      // Default: use v_adperf_daily (campaign-level aggregated view)
      let query = supabase
        .from("v_adperf_daily")
        .select("*")
        .gte("date_start", dateStart)
        .lte("date_start", dateStop)
        .order("date_start", { ascending: true });
      if (sc.length > 0) query = query.in("campaign_id", sc);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    { refreshInterval: REVALIDATE },
  );
}

export function useKpiTotals(dateStart: string, dateStop: string, campaignIds: string[] = [], adsetIds: string[] = [], adIds: string[] = []) {
  const sc = [...campaignIds].sort();
  const sa = [...adsetIds].sort();
  const si = [...adIds].sort();

  type KpiRow = {
    impressions: number | null; reach: number | null; clicks: number | null;
    link_clicks: number | null; spend: number | null;
    messaging_conversations: number | null; leads: number | null;
    purchases: number | null; purchase_value: number | null;
  };
  type KpiSums = {
    impressions: number; reach: number; clicks: number; link_clicks: number;
    spend: number; messaging_conversations: number; leads: number;
    purchases: number; purchase_value: number;
  };

  const { data, error, isLoading } = useSWR<KpiRow[]>(
    ["kpi_totals", dateStart, dateStop, sc.join(","), sa.join(","), si.join(",")],
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from("ad_performance")
        .select("impressions,reach,clicks,link_clicks,spend,messaging_conversations,leads,purchases,purchase_value")
        .gte("date_start", dateStart)
        .lte("date_start", dateStop);
      if (si.length > 0) q = q.in("ad_id", si);
      else if (sa.length > 0) q = q.in("adset_id", sa);
      if (sc.length > 0) q = q.in("campaign_id", sc);
      const { data: rows, error: err } = await q as { data: KpiRow[] | null; error: { message: string } | null };
      if (err) throw err;
      return rows ?? [];
    },
    { refreshInterval: REVALIDATE },
  );

  const sums = data
    ? data.reduce<KpiSums>(
        (acc, row) => ({
          impressions:             acc.impressions             + (row.impressions             ?? 0),
          reach:                   acc.reach                   + (row.reach                   ?? 0),
          clicks:                  acc.clicks                  + (row.clicks                  ?? 0),
          link_clicks:             acc.link_clicks             + (row.link_clicks             ?? 0),
          spend:                   acc.spend                   + (row.spend                   ?? 0),
          messaging_conversations: acc.messaging_conversations + (row.messaging_conversations ?? 0),
          leads:                   acc.leads                   + (row.leads                   ?? 0),
          purchases:               acc.purchases               + (row.purchases               ?? 0),
          purchase_value:          acc.purchase_value          + (row.purchase_value          ?? 0),
        }),
        { impressions: 0, reach: 0, clicks: 0, link_clicks: 0, spend: 0, messaging_conversations: 0, leads: 0, purchases: 0, purchase_value: 0 },
      )
    : null;

  const totals = sums ? {
    ...sums,
    ctr_all: sums.impressions > 0 ? (sums.clicks / sums.impressions) * 100 : 0,
    cpc_all: sums.clicks      > 0 ? sums.spend / sums.clicks : 0,
    cpm:     sums.impressions > 0 ? (sums.spend / sums.impressions) * 1000 : 0,
  } : null;

  return { totals, error, isLoading };
}

export function useSpendChart(dateStart: string, dateStop: string, campaignIds: string[] = [], adsetIds: string[] = [], adIds: string[] = []) {
  const sc = [...campaignIds].sort();
  const sa = [...adsetIds].sort();
  const si = [...adIds].sort();

  type SpendRow = { date_start: string; spend: number | null; messaging_conversations: number | null; };

  const { data, error, isLoading } = useSWR<SpendRow[]>(
    ["spend_chart", dateStart, dateStop, sc.join(","), sa.join(","), si.join(",")],
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from("ad_performance")
        .select("date_start,spend,messaging_conversations")
        .gte("date_start", dateStart)
        .lte("date_start", dateStop)
        .order("date_start", { ascending: true });
      if (si.length > 0) q = q.in("ad_id", si);
      else if (sa.length > 0) q = q.in("adset_id", sa);
      if (sc.length > 0) q = q.in("campaign_id", sc);
      const { data: rows, error: err } = await q as { data: SpendRow[] | null; error: { message: string } | null };
      if (err) throw err;
      return rows ?? [];
    },
    { refreshInterval: REVALIDATE },
  );

  // CPA = spend / messaging_conversations (biaya per percakapan dimulai)
  const chartData = data
    ? Object.values(
        data.reduce<Record<string, { date: string; spend: number; conversations: number }>>(
          (acc, row) => {
            const d = row.date_start;
            if (!acc[d]) acc[d] = { date: d, spend: 0, conversations: 0 };
            acc[d].spend         += row.spend                   ?? 0;
            acc[d].conversations += row.messaging_conversations ?? 0;
            return acc;
          }, {},
        ),
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, cpa: d.conversations > 0 ? d.spend / d.conversations : 0 }))
    : [];

  return { chartData, error, isLoading };
}

export function useEngagementSummary(
  dateStart: string,
  dateStop: string,
  campaignIds: string[] = [],
  adsetIds: string[] = [],
  adIds: string[] = [],
  platform: string = "all"
) {
  const sc = [...campaignIds].sort();
  const sa = [...adsetIds].sort();
  const si = [...adIds].sort();
  return useSWR<CampaignEngagementDaily[]>(
    ["engagement_summary", dateStart, dateStop, sc.join(","), sa.join(","), si.join(","), platform],
    async () => {
      let activeAdIds: string[] = [];
      const isPlatformFiltered = platform !== "all";

      if (isPlatformFiltered) {
        let q = supabase
          .from("ad_breakdown_platform")
          .select("ad_id")
          .eq("publisher_platform", platform)
          .gte("date_start", dateStart)
          .lte("date_start", dateStop);

        if (si.length > 0) {
          q = q.in("ad_id", si);
        } else if (sa.length > 0) {
          const { data: adsInAdsets } = await supabase
            .from("meta_ads")
            .select("id")
            .in("adset_id", sa);
          const adRows = (adsInAdsets ?? []) as Array<{ id: string }>;
          const adIdsInAdsets = adRows.map((a) => a.id);
          if (adIdsInAdsets.length > 0) {
            q = q.in("ad_id", adIdsInAdsets);
          } else {
            return []; // Tidak ada ad di adset ini
          }
        }

        if (sc.length > 0) {
          q = q.in("campaign_id", sc);
        }

        const { data: platRows, error: platErr } = await q;
        if (platErr) throw platErr;

        const rows = platRows as Array<{ ad_id: string }>;
        activeAdIds = Array.from(new Set(rows.map((r) => r.ad_id).filter(Boolean)));
        if (activeAdIds.length === 0) return [];
      }

      let query = supabase
        .from("engagement_metrics")
        .select("campaign_id,date_start,post_reactions,post_comments,post_shares,post_saves,video_views")
        .gte("date_start", dateStart)
        .lte("date_start", dateStop)
        .order("date_start", { ascending: true });

      if (isPlatformFiltered) {
        query = query.in("ad_id", activeAdIds);
      } else {
        if (si.length > 0) query = query.in("ad_id", si);
        else if (sa.length > 0) query = query.in("adset_id", sa);
        if (sc.length > 0) query = query.in("campaign_id", sc);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CampaignEngagementDaily[];
    },
    { refreshInterval: REVALIDATE },
  );
}

export function useAudienceRaw(
  breakdownType: string,
  dateStart: string,
  dateStop: string,
  campaignIds: string[] = [],
) {
  const sortedIds = [...campaignIds].sort();
  return useSWR<AudienceInsight[]>(
    ["audience_raw", breakdownType, dateStart, dateStop, sortedIds.join(",")],
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
      if ((!data || data.length === 0) && sortedIds.length > 0) {
        const fb = await baseQuery();
        if (fb.error) throw fb.error;
        data = fb.data;
      }
      return (data ?? []) as AudienceInsight[];
    },
    { refreshInterval: REVALIDATE },
  );
}

/**
 * Seperti useAudienceRaw, tapi mengisi messaging_conversations secara proporsional
 * dari data ad_performance (total per campaign+tanggal × bagian impresi segmen).
 * Digunakan oleh chart breakdown agar tab "Percakapan" menampilkan data nyata.
 */
export function useAudienceWithMessaging(
  breakdownType: string,
  dateStart: string,
  dateStop: string,
  campaignIds: string[] = [],
) {
  const sortedIds = [...campaignIds].sort();
  const sortedKey = sortedIds.join(",");

  const { data: audienceData, isLoading: loadAud } = useAudienceRaw(
    breakdownType, dateStart, dateStop, campaignIds,
  );

  // Total messaging_conversations per (campaign_id, date_start) dari ad_performance
  const { data: mcTotals, isLoading: loadMc } = useSWR<Record<string, number>>(
    ["mc_totals_by_day", dateStart, dateStop, sortedKey],
    async () => {
      type Row = { campaign_id: string; date_start: string; messaging_conversations: number | null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from("ad_performance")
        .select("campaign_id,date_start,messaging_conversations")
        .gte("date_start", dateStart)
        .lte("date_start", dateStop);
      if (sortedIds.length > 0) q = q.in("campaign_id", sortedIds);
      const { data, error } = await q as { data: Row[] | null; error: { message: string } | null };
      if (error) throw error;
      const totals: Record<string, number> = {};
      for (const row of (data ?? [])) {
        const key = `${row.campaign_id}|${row.date_start}`;
        totals[key] = (totals[key] ?? 0) + (row.messaging_conversations ?? 0);
      }
      return totals;
    },
    { refreshInterval: REVALIDATE },
  );

  const enriched = useMemo((): AudienceInsight[] | undefined => {
    if (!audienceData) return undefined;
    if (!mcTotals)     return audienceData;

    // Hitung total impresi per (campaign_id, date_start) dari breakdown ini
    const totalImpr: Record<string, number> = {};
    for (const row of audienceData) {
      const k = `${row.campaign_id}|${row.date_start}`;
      totalImpr[k] = (totalImpr[k] ?? 0) + (row.impressions ?? 0);
    }

    // Distribusikan messaging_conversations secara proporsional ke tiap segmen
    return audienceData.map(row => {
      const k         = `${row.campaign_id}|${row.date_start}`;
      const imprTotal = totalImpr[k]  ?? 0;
      const mcTotal   = mcTotals[k]   ?? 0;
      const share     = imprTotal > 0 ? (row.impressions ?? 0) / imprTotal : 0;
      return { ...row, messaging_conversations: Math.round(mcTotal * share) };
    });
  }, [audienceData, mcTotals]);

  return { data: enriched, isLoading: loadAud || loadMc };
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
  plays: number; profile_visits: number;
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

type ContentType = "semua" | "postingan" | "cerita";

export function useIgContentOverview(
  accountId: string,
  dateStart: string,
  dateStop: string,
  contentType: ContentType,
) {
  type MediaRow   = { id: string; media_product_type: string; timestamp: string };
  type InsightRow = { media_id: string; impressions: number; reach: number; likes: number; comments: number; shares: number; saved: number };
  type DayData    = { date: string; impressions: number; reach: number; engagement: number };

  return useSWR(
    ["ig_content_overview", accountId, dateStart, dateStop, contentType],
    async () => {
      if (!accountId) return { impressions: 0, reach: 0, engagement: 0, byDate: [] as DayData[] };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from("ig_media")
        .select("id,media_product_type,timestamp")
        .eq("ig_account_id", accountId)
        .gte("timestamp", `${dateStart}T00:00:00`)
        .lte("timestamp", `${dateStop}T23:59:59`);

      if (contentType === "postingan") q = q.in("media_product_type", ["FEED", "REELS"]);
      else if (contentType === "cerita") q = q.eq("media_product_type", "STORY");

      const { data: mediaData, error: mediaError } = await q as { data: MediaRow[] | null; error: { message: string } | null };
      if (mediaError) throw mediaError;

      const media = mediaData ?? [];
      if (media.length === 0) return { impressions: 0, reach: 0, engagement: 0, byDate: [] as DayData[] };

      const { data: insightData, error: insightError } = await supabase
        .from("ig_media_insights")
        .select("media_id,impressions,reach,likes,comments,shares,saved")
        .in("media_id", media.map(m => m.id));
      if (insightError) throw insightError;

      const insMap = new Map((insightData ?? []).map((i: InsightRow) => [i.media_id, i]));
      const byDate: Record<string, DayData> = {};
      let totalImpressions = 0, totalReach = 0, totalEngagement = 0;

      for (const m of media) {
        const date = m.timestamp.slice(0, 10);
        const ins  = insMap.get(m.id);
        const imp  = ins?.impressions ?? 0;
        const rch  = ins?.reach       ?? 0;
        const eng  = (ins?.likes ?? 0) + (ins?.comments ?? 0) + (ins?.shares ?? 0) + (ins?.saved ?? 0);
        if (!byDate[date]) byDate[date] = { date, impressions: 0, reach: 0, engagement: 0 };
        byDate[date].impressions += imp;
        byDate[date].reach       += rch;
        byDate[date].engagement  += eng;
        totalImpressions += imp;
        totalReach       += rch;
        totalEngagement  += eng;
      }

      return {
        impressions: totalImpressions,
        reach:       totalReach,
        engagement:  totalEngagement,
        byDate:      Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)),
      };
    },
    { refreshInterval: REVALIDATE },
  );
}

type IgDayData = { date: string; total: number; organic: number; paid: number };

export function useIgDailyChart(accountId: string, dateStart: string, dateStop: string) {
  return useSWR<IgDayData[]>(
    ["ig_daily_chart", accountId, dateStart, dateStop],
    async () => {
      if (!accountId) return [];

      // Query 1: daily reach dari ig_account_insights (impressions deprecated di v22.0)
      const { data: acctData, error: acctError } = await supabase
        .from("ig_account_insights")
        .select("date,reach")
        .eq("ig_account_id", accountId)
        .gte("date", dateStart)
        .lte("date", dateStop)
        .order("date", { ascending: true });
      if (acctError) throw acctError;

      // Query 2: paid reach dari Instagram placements di ad_breakdown_platform
      const { data: paidData, error: paidError } = await supabase
        .from("ad_breakdown_platform")
        .select("date_start,reach")
        .eq("publisher_platform", "instagram")
        .gte("date_start", dateStart)
        .lte("date_start", dateStop);
      if (paidError) throw paidError;

      const paidByDate: Record<string, number> = {};
      for (const row of (paidData ?? []) as { date_start: string; reach: number }[]) {
        paidByDate[row.date_start] = (paidByDate[row.date_start] ?? 0) + (row.reach ?? 0);
      }

      return ((acctData ?? []) as { date: string; reach: number }[]).map(row => {
        const total = row.reach ?? 0;
        const paid  = paidByDate[row.date] ?? 0;
        return { date: row.date, total, paid, organic: Math.max(0, total - paid) };
      });
    },
    { refreshInterval: REVALIDATE },
  );
}

export function useIgTopMedia(accountId: string, dateStart: string, dateStop: string, limit = 10) {
  return useSWR<(IgMedia & IgMediaInsight)[]>(
    ["ig_top_media", accountId, dateStart, dateStop, limit],
    async () => {
      if (!accountId) return [];

      const { data: mediaData, error: mediaError } = await supabase
        .from("ig_media")
        .select("*")
        .eq("ig_account_id", accountId)
        .gte("timestamp", `${dateStart}T00:00:00`)
        .lte("timestamp", `${dateStop}T23:59:59`)
        .not("media_product_type", "eq", "STORY")
        .order("timestamp", { ascending: false })
        .limit(limit * 3);
      if (mediaError) throw mediaError;

      const mediaItems = (mediaData ?? []) as IgMedia[];
      if (mediaItems.length === 0) return [];

      const { data: insightData, error: insightError } = await supabase
        .from("ig_media_insights")
        .select("*")
        .in("media_id", mediaItems.map(m => m.id));
      if (insightError) throw insightError;

      const insightsMap = new Map(
        (insightData ?? []).map((i: IgMediaInsight) => [i.media_id, i]),
      );

      return mediaItems
        .map(m => ({ ...m, ...(insightsMap.get(m.id) ?? {}) }) as IgMedia & IgMediaInsight)
        .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))
        .slice(0, limit);
    },
    { refreshInterval: REVALIDATE },
  );
}

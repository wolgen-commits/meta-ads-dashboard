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
      const isPlatformFiltered = platform !== "all";

      if (isPlatformFiltered) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let platformQuery: any = supabase
          .from("ad_breakdown_platform")
          .select("ad_id,campaign_id,date_start,publisher_platform,impressions")
          .gte("date_start", dateStart)
          .lte("date_start", dateStop);

        if (si.length > 0) {
          platformQuery = platformQuery.in("ad_id", si);
        } else if (sa.length > 0) {
          const { data: adsInAdsets } = await supabase
            .from("meta_ads")
            .select("id")
            .in("adset_id", sa);
          const adRows = (adsInAdsets ?? []) as Array<{ id: string }>;
          const adIdsInAdsets = adRows.map((a) => a.id);
          if (adIdsInAdsets.length > 0) {
            platformQuery = platformQuery.in("ad_id", adIdsInAdsets);
          } else {
            return []; // Tidak ada ad di adset ini
          }
        }

        if (sc.length > 0) {
          platformQuery = platformQuery.in("campaign_id", sc);
        }

        const { data: allPlatformRows, error: allPlatformErr } = await platformQuery as {
          data: Array<{ ad_id: string; campaign_id: string; date_start: string; publisher_platform: string | null; impressions: number | null }> | null;
          error: { message: string } | null;
        };
        if (allPlatformErr) throw allPlatformErr;

        const selectedPlatformRows = (allPlatformRows ?? []).filter((row) => row.publisher_platform === platform);
        const activeAdIds = Array.from(new Set(selectedPlatformRows.map((row) => row.ad_id).filter(Boolean)));
        if (activeAdIds.length === 0) return [];

        const totalImpressionsByAdDate: Record<string, number> = {};
        const selectedImpressionsByAdDate: Record<string, number> = {};
        for (const row of allPlatformRows ?? []) {
          const key = `${row.ad_id}|${row.date_start}`;
          totalImpressionsByAdDate[key] = (totalImpressionsByAdDate[key] ?? 0) + (row.impressions ?? 0);
        }
        for (const row of selectedPlatformRows) {
          const key = `${row.ad_id}|${row.date_start}`;
          selectedImpressionsByAdDate[key] = (selectedImpressionsByAdDate[key] ?? 0) + (row.impressions ?? 0);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let engagementQuery: any = supabase
          .from("engagement_metrics")
          .select("ad_id,campaign_id,date_start,post_reactions,post_comments,post_shares,post_saves,video_views")
          .gte("date_start", dateStart)
          .lte("date_start", dateStop)
          .in("ad_id", activeAdIds)
          .order("date_start", { ascending: true });
        if (sc.length > 0) engagementQuery = engagementQuery.in("campaign_id", sc);

        const { data: engagementRows, error: engagementErr } = await engagementQuery as {
          data: Array<CampaignEngagementDaily & { ad_id: string }> | null;
          error: { message: string } | null;
        };
        if (engagementErr) throw engagementErr;

        return (engagementRows ?? []).map((row) => {
          const key = `${row.ad_id}|${row.date_start}`;
          const total = totalImpressionsByAdDate[key] ?? 0;
          const selected = selectedImpressionsByAdDate[key] ?? 0;
          const share = total > 0 ? selected / total : 0;

          return {
            ...row,
            post_reactions: Math.round((row.post_reactions ?? 0) * share),
            post_comments:  Math.round((row.post_comments  ?? 0) * share),
            post_shares:    Math.round((row.post_shares    ?? 0) * share),
            post_saves:     Math.round((row.post_saves     ?? 0) * share),
            video_views:     Math.round((row.video_views     ?? 0) * share),
          };
        });
      }

      let query = supabase
        .from("engagement_metrics")
        .select("campaign_id,date_start,post_reactions,post_comments,post_shares,post_saves,video_views")
        .gte("date_start", dateStart)
        .lte("date_start", dateStop)
        .order("date_start", { ascending: true });

      if (si.length > 0) query = query.in("ad_id", si);
      else if (sa.length > 0) query = query.in("adset_id", sa);
      if (sc.length > 0) query = query.in("campaign_id", sc);

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

    const mcTotal = Object.values(mcTotals).reduce((sum, value) => sum + value, 0);
    const imprTotal = audienceData.reduce((sum, row) => sum + (row.impressions ?? 0), 0);
    let assigned = 0;

    // Distribusikan total percakapan periode filter ke semua segmen yang tersedia.
    // Ini menjaga total chart tetap mengikuti KPI meski breakdown wilayah tidak ada
    // untuk setiap campaign+tanggal.
    const allocations = audienceData.map((row) => {
      const raw = imprTotal > 0
        ? mcTotal * ((row.impressions ?? 0) / imprTotal)
        : mcTotal / audienceData.length;
      const base = Math.floor(raw);
      assigned += base;
      return { row, base, remainder: raw - base };
    });

    let remaining = mcTotal - assigned;
    return allocations
      .sort((a, b) => b.remainder - a.remainder)
      .map((allocation) => {
        const extra = remaining > 0 ? 1 : 0;
        remaining -= extra;
        return {
          ...allocation.row,
          messaging_conversations: allocation.base + extra,
        };
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
  type DayData = { date: string; impressions: number; reach: number; engagement: number };

  return useSWR(
    ["ig_content_overview", accountId, dateStart, dateStop, contentType],
    async () => {
      const empty = {
        views: 0, reach: 0, engagement: 0,
        prevViews: 0, prevReach: 0, prevEngagement: 0,
        viewsGrowth:      null as number | null,
        reachGrowth:      null as number | null,
        engagementGrowth: null as number | null,
        noInsights: false,
        byDate: [] as DayData[],
      };
      if (!accountId) return empty;

      // Periode sebelumnya (sama durasi, tepat sebelum dateStart)
      const startMs      = new Date(dateStart).getTime();
      const stopMs       = new Date(dateStop).getTime();
      const durMs        = stopMs - startMs + 86_400_000;
      const prevStartStr = new Date(startMs - durMs).toISOString().slice(0, 10);
      const prevStopStr  = new Date(startMs - 86_400_000).toISOString().slice(0, 10);

      // Untuk cerita: gunakan per-post metrics dari Supabase (account-level tidak ada breakdown cerita)
      if (contentType === "cerita") {
        type MediaRow   = { id: string };
        type InsightRow = { media_id: string; reach: number; likes: number; comments: number; shares: number; saved: number };

        async function fetchStoriesPeriod(from: string, to: string) {
          const { data: mediaData } = await supabase
            .from("ig_media")
            .select("id")
            .eq("ig_account_id", accountId)
            .eq("media_product_type", "STORY")
            .gte("timestamp", `${from}T00:00:00`)
            .lte("timestamp", `${to}T23:59:59`) as { data: MediaRow[] | null };

          const media = mediaData ?? [];
          if (media.length === 0) return { views: 0, reach: 0, engagement: 0, noInsights: false };

          const { data: insightData } = await supabase
            .from("ig_media_insights")
            .select("media_id,reach,likes,comments,shares,saved")
            .in("media_id", media.map(m => m.id)) as { data: InsightRow[] | null };

          const ins = insightData ?? [];
          const noInsights = ins.length === 0 && media.length > 0;
          return {
            views:      0,
            reach:      ins.reduce((s, i) => s + (i.reach ?? 0), 0),
            engagement: ins.reduce((s, i) => s + (i.likes ?? 0) + (i.comments ?? 0) + (i.shares ?? 0) + (i.saved ?? 0), 0),
            noInsights,
          };
        }

        const [curr, prev] = await Promise.all([
          fetchStoriesPeriod(dateStart, dateStop),
          fetchStoriesPeriod(prevStartStr, prevStopStr),
        ]);
        const growth = (c: number, p: number): number | null =>
          p === 0 ? null : Math.round(((c - p) / p) * 100);
        return {
          ...empty,
          views: curr.views, reach: curr.reach, engagement: curr.engagement,
          prevViews: prev.views, prevReach: prev.reach, prevEngagement: prev.engagement,
          viewsGrowth: growth(curr.views, prev.views),
          reachGrowth: growth(curr.reach, prev.reach),
          engagementGrowth: growth(curr.engagement, prev.engagement),
          noInsights: curr.noInsights,
        };
      }

      // Untuk semua/postingan: gunakan account-level metrics dari Meta API via API route
      // (metric_type=total_value agar cocok dengan angka di Meta Business Suite)
      async function fetchAccountPeriod(from: string, to: string) {
        const params = new URLSearchParams({ igAccountId: accountId, dateStart: from, dateStop: to });
        const res  = await fetch(`/api/ig-summary?${params}`);
        if (!res.ok) return { views: 0, reach: 0, engagement: 0, noInsights: false };
        const json = await res.json() as {
          views: number; reach: number; totalInteractions: number;
          likes: number; comments: number; shares: number; saves: number;
        };
        return {
          views:      json.views             ?? 0,
          reach:      json.reach             ?? 0,
          engagement: json.totalInteractions ?? 0,
          noInsights: false,
        };
      }

      const [curr, prev] = await Promise.all([
        fetchAccountPeriod(dateStart, dateStop),
        fetchAccountPeriod(prevStartStr, prevStopStr),
      ]);

      const growth = (c: number, p: number): number | null =>
        p === 0 ? null : Math.round(((c - p) / p) * 100);

      return {
        ...empty,
        views: curr.views, reach: curr.reach, engagement: curr.engagement,
        prevViews: prev.views, prevReach: prev.reach, prevEngagement: prev.engagement,
        viewsGrowth:      growth(curr.views,      prev.views),
        reachGrowth:      growth(curr.reach,      prev.reach),
        engagementGrowth: growth(curr.engagement, prev.engagement),
        noInsights: false,
      };
    },
    { refreshInterval: REVALIDATE },
  );
}

type IgDayData = { date: string; total: number; organic: number; paid: number; paidImpressions: number };

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

      // Query 2: paid reach + impressions dari Instagram placements di ad_breakdown_platform
      const { data: paidData, error: paidError } = await supabase
        .from("ad_breakdown_platform")
        .select("date_start,reach,impressions")
        .eq("publisher_platform", "instagram")
        .gte("date_start", dateStart)
        .lte("date_start", dateStop);
      if (paidError) throw paidError;

      const paidByDate: Record<string, { reach: number; impressions: number }> = {};
      for (const row of (paidData ?? []) as { date_start: string; reach: number; impressions: number }[]) {
        const d = row.date_start;
        if (!paidByDate[d]) paidByDate[d] = { reach: 0, impressions: 0 };
        paidByDate[d].reach       += row.reach       ?? 0;
        paidByDate[d].impressions += row.impressions ?? 0;
      }

      return ((acctData ?? []) as { date: string; reach: number }[]).map(row => {
        const total           = row.reach ?? 0;
        const paid            = paidByDate[row.date]?.reach       ?? 0;
        const paidImpressions = paidByDate[row.date]?.impressions ?? 0;
        return { date: row.date, total, paid, organic: Math.max(0, total - paid), paidImpressions };
      });
    },
    { refreshInterval: REVALIDATE },
  );
}

export type IgInsightTrend = {
  date: string;
  followers_count: number;
  reach: number;
  reach_followers: number;
  reach_non_followers: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
};

export function useIgAccountInsightsTrend(accountId: string, dateStart: string, dateStop: string) {
  return useSWR<IgInsightTrend[]>(
    ["ig_account_insights_trend", accountId, dateStart, dateStop],
    async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("ig_account_insights")
        .select("date,followers_count,reach,reach_followers,reach_non_followers,likes_count,comments_count,shares_count,saves_count")
        .eq("ig_account_id", accountId)
        .gte("date", dateStart)
        .lte("date", dateStop)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as IgInsightTrend[];
    },
    { refreshInterval: REVALIDATE },
  );
}

export type IgAudienceBreakdown = {
  breakdown_type: string;
  breakdown_value: string;
  follower_count: number;
};

const AGE_ORDER_AUD = ["13-17","18-24","25-34","35-44","45-54","55-64","65+"];

export function useIgAudienceDemographics(accountId: string | null) {
  const { data, isLoading } = useSWR<IgAudienceBreakdown[]>(
    accountId ? ["ig_audience", accountId] : null,
    async () => {
      const { data: rows, error } = await supabase
        .from("ig_audience_breakdown")
        .select("breakdown_type,breakdown_value,follower_count")
        .eq("ig_account_id", accountId as string)
        .order("follower_count", { ascending: false });
      if (error) throw error;
      return (rows ?? []) as IgAudienceBreakdown[];
    },
    { refreshInterval: REVALIDATE },
  );
  const all = data ?? [];
  return {
    isLoading,
    byAge:     all.filter(r => r.breakdown_type === "age")
                  .sort((a, b) => AGE_ORDER_AUD.indexOf(a.breakdown_value) - AGE_ORDER_AUD.indexOf(b.breakdown_value)),
    byGender:  all.filter(r => r.breakdown_type === "gender"),
    byCountry: all.filter(r => r.breakdown_type === "country").slice(0, 10),
    byCity:    all.filter(r => r.breakdown_type === "city").slice(0, 10),
    hasData:   all.length > 0,
  };
}

export type IgOnlineFollowerHour = { hour: number; avg_followers: number };

export function useIgOnlineFollowers(accountId: string | null) {
  const { data, isLoading } = useSWR<IgOnlineFollowerHour[]>(
    accountId ? ["ig_online_followers", accountId] : null,
    async () => {
      const { data: rows, error } = await supabase
        .from("ig_online_followers")
        .select("hour,follower_count")
        .eq("ig_account_id", accountId as string)
        .order("date", { ascending: false })
        .limit(7 * 24);
      if (error) throw error;
      const byHour: Record<number, number[]> = {};
      for (const r of (rows ?? []) as { hour: number; follower_count: number }[]) {
        if (!byHour[r.hour]) byHour[r.hour] = [];
        byHour[r.hour].push(r.follower_count);
      }
      return Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        avg_followers: byHour[h]?.length
          ? Math.round(byHour[h].reduce((s, v) => s + v, 0) / byHour[h].length)
          : 0,
      }));
    },
    { refreshInterval: REVALIDATE },
  );
  return { data: data ?? [], isLoading };
}

export function useIgTopMedia(accountId: string, _dateStart: string, _dateStop: string, limit = 10) {
  return useSWR<(IgMedia & IgMediaInsight)[]>(
    ["ig_top_media_alltime", accountId, limit],
    async () => {
      if (!accountId) return [];

      // Step 1: Ambil semua media ID (non-story) untuk akun ini
      const { data: mediaIdRows, error: mediaIdErr } = await supabase
        .from("ig_media")
        .select("id")
        .eq("ig_account_id", accountId)
        .not("media_product_type", "eq", "STORY");
      if (mediaIdErr) throw mediaIdErr;

      const allIds = (mediaIdRows ?? []).map((r: { id: string }) => r.id);
      if (allIds.length === 0) return [];

      // Step 2: Ambil top N insights berdasarkan tayangan (impressions) tertinggi
      const { data: insightData, error: insightErr } = await supabase
        .from("ig_media_insights")
        .select("*")
        .in("media_id", allIds)
        .order("impressions", { ascending: false })
        .limit(limit);
      if (insightErr) throw insightErr;

      const topInsights = (insightData ?? []) as IgMediaInsight[];
      if (topInsights.length === 0) return [];

      // Step 3: Ambil detail media untuk top N tersebut
      const topIds = topInsights.map(i => i.media_id);
      const { data: mediaData, error: mediaErr } = await supabase
        .from("ig_media")
        .select("*")
        .in("id", topIds);
      if (mediaErr) throw mediaErr;

      const mediaMap = new Map(
        (mediaData ?? []).map((m: IgMedia) => [m.id, m]),
      );

      return topInsights
        .map(ins => ({ ...mediaMap.get(ins.media_id)!, ...ins }) as IgMedia & IgMediaInsight)
        .filter(m => m.id);
    },
    { refreshInterval: REVALIDATE },
  );
}

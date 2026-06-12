import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { CampaignDailySummary, CampaignEngagementDaily, AudienceTopSegment, SyncLog } from "@/types/database";

const REVALIDATE = 5 * 60 * 1000;

export function useCampaignSummary(dateStart: string, dateStop: string) {
  return useSWR<CampaignDailySummary[]>(
    ["campaign_summary", dateStart, dateStop],
    async () => {
      const { data, error } = await supabase
        .from("v_campaign_daily_summary")
        .select("*")
        .gte("date_start", dateStart)
        .lte("date_start", dateStop)
        .order("date_start", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    { refreshInterval: REVALIDATE },
  );
}

export function useKpiTotals(dateStart: string, dateStop: string) {
  const { data, error, isLoading } = useCampaignSummary(dateStart, dateStop);
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

export function useSpendChart(dateStart: string, dateStop: string) {
  const { data, error, isLoading } = useCampaignSummary(dateStart, dateStop);
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

export function useEngagementSummary(dateStart: string, dateStop: string) {
  return useSWR<CampaignEngagementDaily[]>(
    ["engagement_summary", dateStart, dateStop],
    async () => {
      const { data, error } = await supabase
        .from("v_campaign_engagement_daily")
        .select("*")
        .gte("date_start", dateStart)
        .lte("date_start", dateStop)
        .order("date_start", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    { refreshInterval: REVALIDATE },
  );
}

export function useAudienceSegments(breakdownType: string) {
  return useSWR<AudienceTopSegment[]>(
    ["audience_segments", breakdownType],
    async () => {
      const { data, error } = await supabase
        .from("v_audience_top_segments")
        .select("*")
        .eq("breakdown_type", breakdownType)
        .order("impressions", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
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

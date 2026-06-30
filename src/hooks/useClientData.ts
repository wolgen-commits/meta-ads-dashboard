import useSWR from "swr";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";

const REVALIDATE = 5 * 60 * 1000;

// ── Campaign list ──────────────────────────────────────────────────────────────

export function useClientCampaigns(portfolioSlug: string, dateStart?: string, dateStop?: string) {
  return useSWR<{ id: string; name: string; status: string | null; objective: string | null }[]>(
    ["client_campaigns", portfolioSlug, dateStart, dateStop],
    async () => {
      if (dateStart && dateStop) {
        // Ambil campaign_id unik dari performance table via RPC (hindari batas 1000 baris)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: perfData, error: perfErr } = await (supabase as any)
          .rpc("get_client_campaign_table", {
            p_portfolio_slug: portfolioSlug,
            p_date_start: dateStart,
            p_date_stop: dateStop,
          });
        if (perfErr) throw perfErr;

        const ids = Array.from(new Set((perfData ?? []).map((r: { campaign_id: string }) => r.campaign_id).filter(Boolean)));
        if (ids.length === 0) return [];

        const { data, error } = await supabase
          .from("client_campaigns")
          .select("id,name,status,objective")
          .eq("portfolio_slug", portfolioSlug)
          .in("id", ids)
          .order("name", { ascending: true });
        if (error) throw error;
        return data ?? [];
      }

      const { data, error } = await supabase
        .from("client_campaigns")
        .select("id,name,status,objective")
        .eq("portfolio_slug", portfolioSlug)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    { refreshInterval: REVALIDATE },
  );
}

// ── KPI totals — via RPC (aggregasi server-side, tidak ada batas baris) ────────

export function useClientKpiTotals(
  portfolioSlug: string,
  dateStart: string,
  dateStop: string,
  campaignIds: string[] = [],
) {
  const sc = [...campaignIds].sort();

  type RpcResult = {
    impressions: number; reach: number; clicks: number; link_clicks: number;
    spend: number; messaging_conversations: number; leads: number;
    purchases: number; purchase_value: number; results: number;
  };

  const { data, error, isLoading } = useSWR<RpcResult>(
    ["client_kpi", portfolioSlug, dateStart, dateStop, sc.join(",")],
    async () => {
      const { data: row, error: err } = await (supabase as any).rpc("get_client_kpi_totals", {
        p_portfolio_slug: portfolioSlug,
        p_date_start:     dateStart,
        p_date_stop:      dateStop,
        p_campaign_ids:   sc.length > 0 ? sc : null,
      });
      if (err) throw err;
      // RPC mengembalikan array dengan satu baris
      const r = Array.isArray(row) ? row[0] : row;
      return r ?? null;
    },
    { refreshInterval: REVALIDATE },
  );

  const totals = useMemo(() => {
    if (!data) return null;
    const spend = Number(data.spend ?? 0);
    const impressions = Number(data.impressions ?? 0);
    const clicks = Number(data.clicks ?? 0);
    const results = Number(data.results ?? 0);
    return {
      spend,
      impressions,
      reach:                   Number(data.reach                   ?? 0),
      clicks,
      link_clicks:             Number(data.link_clicks             ?? 0),
      messaging_conversations: Number(data.messaging_conversations ?? 0),
      leads:                   Number(data.leads                   ?? 0),
      purchases:               Number(data.purchases               ?? 0),
      purchase_value:          Number(data.purchase_value          ?? 0),
      results,
      ctr:            impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc:            clicks > 0 ? spend / clicks : 0,
      cpm:            impressions > 0 ? (spend / impressions) * 1000 : 0,
      cost_per_result: results > 0 ? spend / results : 0,
    };
  }, [data]);

  return { totals, error, isLoading };
}

// ── Spend chart (harian) — via RPC ────────────────────────────────────────────

export function useClientSpendChart(
  portfolioSlug: string,
  dateStart: string,
  dateStop: string,
  campaignIds: string[] = [],
) {
  const sc = [...campaignIds].sort();

  type RpcRow = { date: string; spend: number; results: number };

  const { data, error, isLoading } = useSWR<RpcRow[]>(
    ["client_spend_chart", portfolioSlug, dateStart, dateStop, sc.join(",")],
    async () => {
      const { data: rows, error: err } = await (supabase as any).rpc("get_client_spend_chart", {
        p_portfolio_slug: portfolioSlug,
        p_date_start:     dateStart,
        p_date_stop:      dateStop,
        p_campaign_ids:   sc.length > 0 ? sc : null,
      });
      if (err) throw err;
      return (rows ?? []).map((r: RpcRow) => ({
        date:    r.date,
        spend:   Number(r.spend   ?? 0),
        results: Number(r.results ?? 0),
      }));
    },
    { refreshInterval: REVALIDATE },
  );

  return { chartData: data ?? [], error, isLoading };
}

// ── Campaign performance table — via RPC ──────────────────────────────────────

export function useClientCampaignTable(
  portfolioSlug: string,
  dateStart: string,
  dateStop: string,
  campaignIds: string[] = [],
) {
  const sc = [...campaignIds].sort();

  type RpcRow = {
    campaign_id: string; impressions: number; reach: number; clicks: number;
    spend: number; results: number; leads: number; conversations: number;
  };

  const { data, error, isLoading } = useSWR<RpcRow[]>(
    ["client_campaign_table", portfolioSlug, dateStart, dateStop, sc.join(",")],
    async () => {
      const { data: rows, error: err } = await (supabase as any).rpc("get_client_campaign_table", {
        p_portfolio_slug: portfolioSlug,
        p_date_start:     dateStart,
        p_date_stop:      dateStop,
        p_campaign_ids:   sc.length > 0 ? sc : null,
      });
      if (err) throw err;
      return (rows ?? []).map((r: RpcRow) => ({
        campaign_id: r.campaign_id,
        impressions: Number(r.impressions   ?? 0),
        reach:       Number(r.reach         ?? 0),
        clicks:      Number(r.clicks        ?? 0),
        spend:       Number(r.spend         ?? 0),
        results:     Number(r.results       ?? 0),
        leads:       Number(r.leads         ?? 0),
        conversations: Number(r.conversations ?? 0),
      }));
    },
    { refreshInterval: REVALIDATE },
  );

  return { tableData: data ?? [], error, isLoading };
}

// ── Engagement chart (harian) — via RPC ──────────────────────────────────────

export function useClientEngagementChart(
  portfolioSlug: string,
  dateStart: string,
  dateStop: string,
  campaignIds: string[] = [],
) {
  const sc = [...campaignIds].sort();

  type RpcRow = {
    date: string; reactions: number; comments: number;
    shares: number; saves: number; conversations: number;
  };

  const { data, error, isLoading } = useSWR<RpcRow[]>(
    ["client_engagement_chart", portfolioSlug, dateStart, dateStop, sc.join(",")],
    async () => {
      const { data: rows, error: err } = await (supabase as any).rpc("get_client_engagement_chart", {
        p_portfolio_slug: portfolioSlug,
        p_date_start:     dateStart,
        p_date_stop:      dateStop,
        p_campaign_ids:   sc.length > 0 ? sc : null,
      });
      if (err) throw err;
      return (rows ?? []).map((r: RpcRow) => ({
        date:          r.date,
        reactions:     Number(r.reactions     ?? 0),
        comments:      Number(r.comments      ?? 0),
        shares:        Number(r.shares        ?? 0),
        saves:         Number(r.saves         ?? 0),
        conversations: Number(r.conversations ?? 0),
      }));
    },
    { refreshInterval: REVALIDATE },
  );

  return { chartData: data ?? [], error, isLoading };
}

// ── Audience segments — via RPC ───────────────────────────────────────────────

export type ClientAudienceRow = {
  age: string | null;
  gender: string | null;
  region: string | null;
  device_platform: string | null;
  impression_device: string | null;
  publisher_platform: string | null;
  placement: string | null;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  messaging_conversations: number;
  avg_ctr: number;
};

function makeAudienceFetcher(rpcName: string) {
  return function useClientAudience(
    portfolioSlug: string,
    breakdownType: string,
    dateStart: string,
    dateStop: string,
    campaignIds: string[] = [],
  ) {
    const sc = [...campaignIds].sort();
    return useSWR<ClientAudienceRow[]>(
      [rpcName, portfolioSlug, breakdownType, dateStart, dateStop, sc.join(",")],
      async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc(rpcName, {
          p_portfolio_slug: portfolioSlug,
          p_breakdown_type: breakdownType,
          p_date_start:     dateStart,
          p_date_stop:      dateStop,
          p_campaign_ids:   sc.length > 0 ? sc : null,
        });
        if (error) throw error;
        return (data ?? []).map((r: ClientAudienceRow) => ({
          age:                     r.age                     ?? null,
          gender:                  r.gender                  ?? null,
          region:                  r.region                  ?? null,
          device_platform:         r.device_platform         ?? null,
          impression_device:       r.impression_device       ?? null,
          publisher_platform:      r.publisher_platform      ?? null,
          placement:               r.placement               ?? null,
          impressions:             Number(r.impressions             ?? 0),
          reach:                   Number(r.reach                   ?? 0),
          clicks:                  Number(r.clicks                  ?? 0),
          spend:                   Number(r.spend                   ?? 0),
          messaging_conversations: Number(r.messaging_conversations ?? 0),
          avg_ctr:                 Number(r.avg_ctr                 ?? 0),
        }));
      },
      { refreshInterval: REVALIDATE },
    );
  };
}

export const useClientAudienceSegments      = makeAudienceFetcher("get_client_audience_segments");
export const useClientAudienceWithMessaging = makeAudienceFetcher("get_client_audience_with_messaging");

// ── Sync log ───────────────────────────────────────────────────────────────────

export function useClientSyncLog(portfolioSlug: string) {
  return useSWR(
    ["client_sync_log", portfolioSlug],
    async () => {
      const { data, error } = await supabase
        .from("client_sync_log")
        .select("*")
        .eq("portfolio_slug", portfolioSlug)
        .order("started_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    { refreshInterval: REVALIDATE },
  );
}

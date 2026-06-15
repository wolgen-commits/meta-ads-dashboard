import useSWR from "swr";
import { supabase } from "@/lib/supabase";

export type TableKey =
  | "meta_campaigns"
  | "ad_performance"
  | "engagement_metrics"
  | "audience_insights"
  | "meta_sync_log"
  | "v_campaign_daily_summary"
  | "v_campaign_engagement_daily"
  | "v_audience_top_segments";

export interface TableFilters {
  dateStart?: string;
  dateStop?: string;
  campaignIds?: string[];
  statuses?: string[];
  breakdownType?: string;
  searchName?: string;
  objectiveFilter?: string;
}

const DATE_COL: Partial<Record<TableKey, string>> = {
  ad_performance: "date_start",
  engagement_metrics: "date_start",
  audience_insights: "date_start",
  v_campaign_daily_summary: "date_start",
  v_campaign_engagement_daily: "date_start",
};

const CAMPAIGN_COL: Partial<Record<TableKey, string>> = {
  ad_performance: "campaign_id",
  engagement_metrics: "campaign_id",
  audience_insights: "campaign_id",
  v_campaign_daily_summary: "campaign_id",
  v_campaign_engagement_daily: "campaign_id",
  v_audience_top_segments: "campaign_id",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(q: any, tableKey: TableKey, filters: TableFilters): any {
  const dc = DATE_COL[tableKey];
  if (dc) {
    if (filters.dateStart) q = q.gte(dc, filters.dateStart);
    if (filters.dateStop)  q = q.lte(dc, filters.dateStop);
  }

  const cc = CAMPAIGN_COL[tableKey];
  if (cc && filters.campaignIds?.length) {
    q = q.in(cc, filters.campaignIds);
  }

  if (tableKey === "meta_campaigns") {
    if (filters.statuses?.length)   q = q.in("status", filters.statuses);
    if (filters.objectiveFilter)    q = q.eq("objective", filters.objectiveFilter);
    if (filters.searchName)         q = q.ilike("name", `%${filters.searchName}%`);
  }

  if (tableKey === "meta_sync_log") {
    if (filters.statuses?.length) q = q.in("status", filters.statuses);
  }

  if (tableKey === "audience_insights" || tableKey === "v_audience_top_segments") {
    if (filters.breakdownType) q = q.eq("breakdown_type", filters.breakdownType);
  }

  return q;
}

export function useTableData(
  tableKey: TableKey,
  filters: TableFilters,
  page: number,
  pageSize: number,
  sortCol: string,
  sortAsc: boolean,
) {
  const cacheKey = JSON.stringify({ tableKey, filters, page, pageSize, sortCol, sortAsc });

  return useSWR<{ rows: Record<string, unknown>[]; total: number }>(
    ["db_table", cacheKey],
    async () => {
      const fromIdx = (page - 1) * pageSize;
      const toIdx   = fromIdx + pageSize - 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from(tableKey)
        .select("*", { count: "exact" })
        .order(sortCol, { ascending: sortAsc })
        .range(fromIdx, toIdx);

      q = applyFilters(q, tableKey, filters);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as Record<string, unknown>[], total: count ?? 0 };
    },
    { refreshInterval: 5 * 60 * 1000 },
  );
}

export async function exportTableData(
  tableKey: TableKey,
  filters: TableFilters,
  sortCol: string,
  sortAsc: boolean,
): Promise<Record<string, unknown>[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from(tableKey)
    .select("*")
    .order(sortCol, { ascending: sortAsc })
    .limit(5000);

  q = applyFilters(q, tableKey, filters);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

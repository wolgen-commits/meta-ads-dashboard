import useSWR from "swr";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { CompetitorAd, CompetitorAdsSummary, JobStatusResponse, JobProgress } from "@/types/database";

// re-export for component use
export type { JobProgress };

export function useCompetitorAdsList(
  competitor?: string,
  objective?: string,
  limit = 50
) {
  return useSWR<CompetitorAd[]>(
    ["competitor_ads_list", competitor, objective, limit],
    async () => {
      let query = supabase
        .from("competitor_ads")
        .select("*")
        .order("scraped_at", { ascending: false })
        .limit(limit);
      if (competitor) query = query.eq("competitor_name", competitor);
      if (objective) query = query.eq("inferred_objective", objective);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CompetitorAd[];
    },
    { refreshInterval: 0 }
  );
}

export function useCompetitorAdsSummary(competitor?: string) {
  const { data: rows, ...rest } = useSWR<
    Pick<CompetitorAd, "competitor_name" | "inferred_objective" | "ad_strength_score" | "creative_strategy">[]
  >(
    ["competitor_ads_summary_raw", competitor],
    async () => {
      let query = supabase
        .from("competitor_ads")
        .select("competitor_name,inferred_objective,ad_strength_score,creative_strategy");
      if (competitor) query = query.eq("competitor_name", competitor);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CompetitorAd[];
    },
    { refreshInterval: 0 }
  );

  const summary = useMemo<CompetitorAdsSummary>(() => {
    if (!rows || rows.length === 0)
      return { total_ads: 0, objectives_distribution: {}, creative_strategies: {}, ads_per_competitor: {}, average_strength_score: 0 };

    const objectives_distribution: Record<string, number> = {};
    const creative_strategies: Record<string, number> = {};
    const ads_per_competitor: Record<string, number> = {};
    let score_sum = 0;
    let score_count = 0;

    for (const row of rows) {
      if (row.inferred_objective) {
        objectives_distribution[row.inferred_objective] = (objectives_distribution[row.inferred_objective] ?? 0) + 1;
      }
      if (row.creative_strategy) {
        creative_strategies[row.creative_strategy] = (creative_strategies[row.creative_strategy] ?? 0) + 1;
      }
      if (row.competitor_name) {
        ads_per_competitor[row.competitor_name] = (ads_per_competitor[row.competitor_name] ?? 0) + 1;
      }
      if (row.ad_strength_score != null) {
        score_sum += row.ad_strength_score;
        score_count++;
      }
    }

    return {
      total_ads: rows.length,
      objectives_distribution,
      creative_strategies,
      ads_per_competitor,
      average_strength_score: score_count > 0 ? score_sum / score_count : 0,
    };
  }, [rows]);

  return { data: summary, ...rest };
}

export function useJobStatus(jobId: string | null) {
  return useSWR<JobStatusResponse>(
    jobId ? ["job_status", jobId] : null,
    async () => {
      const res = await fetch(`/api/competitor-ads/status/${jobId}`);
      if (!res.ok) throw new Error("Gagal cek status job");
      return res.json();
    },
    {
      refreshInterval: (data) => (data?.status === "running" ? 2000 : 0),
    }
  );
}

export function useCompetitorList() {
  return useSWR<string[]>(
    "competitor_names_list",
    async () => {
      const { data, error } = await supabase
        .from("competitor_ads")
        .select("competitor_name")
        .order("competitor_name", { ascending: true });
      if (error) throw error;
      const unique = [...new Set((data ?? []).map((r: { competitor_name: string }) => r.competitor_name).filter(Boolean))];
      return unique as string[];
    },
    { refreshInterval: 5 * 60 * 1000 }
  );
}

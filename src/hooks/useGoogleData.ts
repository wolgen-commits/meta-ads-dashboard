import useSWR from "swr";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type {
  GoogleCampaign, GoogleAdPerfDaily, GoogleAdGroup, GoogleAd,
  GoogleAdGroupPerfDaily, GoogleKeywordPerfDaily, GoogleSearchTermPerfDaily, GooglePerfDeviceDaily,
  GooglePerfAgeDaily, GooglePerfGenderDaily, GooglePerfGeoDaily, GooglePerfHourDaily,
  GooglePerfCityDaily, GoogleLocationTargeting,
  Ga4TrafficSummary,
  Ga4Demographics, Ga4Platform, Ga4LandingPage, Ga4Page, Ga4Geography, Ga4SearchTerm, Ga4SearchConsole,
} from "@/types/database";

const REVALIDATE = 5 * 60 * 1000;

export function useGoogleCampaigns() {
  return useSWR<GoogleCampaign[]>(
    "google_campaigns",
    async () => {
      const { data, error } = await supabase
        .from("google_campaigns")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    { refreshInterval: REVALIDATE }
  );
}

export function useGoogleAdPerf(
  dateStart: string,
  dateStop: string,
  campaignIds: string[] = []
) {
  const sorted = [...campaignIds].sort();
  return useSWR<GoogleAdPerfDaily[]>(
    ["google_adperf", dateStart, dateStop, sorted.join(",")],
    async () => {
      let q = supabase
        .from("v_google_adperf_daily")
        .select("*")
        .gte("date", dateStart)
        .lte("date", dateStop)
        .order("date", { ascending: true });
      if (sorted.length > 0) q = q.in("campaign_id", sorted);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GoogleAdPerfDaily[];
    },
    { refreshInterval: REVALIDATE }
  );
}

export function useGoogleKpiTotals(
  dateStart: string,
  dateStop: string,
  campaignIds: string[] = []
) {
  const { data, isLoading, error } = useGoogleAdPerf(dateStart, dateStop, campaignIds);

  const totals = useMemo(() => {
    if (!data || data.length === 0) return null;
    const spend       = data.reduce((s, r) => s + (r.cost_idr ?? 0), 0);
    const impressions = data.reduce((s, r) => s + (r.impressions ?? 0), 0);
    const clicks      = data.reduce((s, r) => s + (r.clicks ?? 0), 0);
    const conversions = data.reduce((s, r) => s + (r.conversions ?? 0), 0);
    return {
      spend,
      impressions,
      clicks,
      conversions,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      cpa: conversions > 0 ? spend / conversions : 0,
    };
  }, [data]);

  return { totals, isLoading, error };
}

// Spend + clicks per hari untuk chart ComposedChart
export function useGoogleDailyChart(
  dateStart: string,
  dateStop: string,
  campaignIds: string[] = []
) {
  const { data, isLoading } = useGoogleAdPerf(dateStart, dateStop, campaignIds);

  const dailyChart = useMemo(() => {
    if (!data) return [];
    const grouped: Record<string, { date: string; spend: number; clicks: number; impressions: number }> = {};
    for (const row of data) {
      if (!grouped[row.date]) grouped[row.date] = { date: row.date, spend: 0, clicks: 0, impressions: 0 };
      grouped[row.date].spend       += row.cost_idr ?? 0;
      grouped[row.date].clicks      += row.clicks ?? 0;
      grouped[row.date].impressions += row.impressions ?? 0;
    }
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  return { dailyChart, isLoading };
}

// Performa per campaign untuk tabel ringkasan
export function useGoogleCampaignSummary(
  dateStart: string,
  dateStop: string,
  campaignIds: string[] = []
) {
  const { data, isLoading } = useGoogleAdPerf(dateStart, dateStop, campaignIds);

  const campaignSummary = useMemo(() => {
    if (!data) return [];
    const grouped: Record<string, {
      campaign_id: string;
      campaign_name: string;
      advertising_channel_type: string | null;
      spend: number; impressions: number; clicks: number; conversions: number;
    }> = {};
    for (const row of data) {
      if (!grouped[row.campaign_id]) {
        grouped[row.campaign_id] = {
          campaign_id:              row.campaign_id,
          campaign_name:            row.campaign_name,
          advertising_channel_type: row.advertising_channel_type,
          spend: 0, impressions: 0, clicks: 0, conversions: 0,
        };
      }
      grouped[row.campaign_id].spend       += row.cost_idr ?? 0;
      grouped[row.campaign_id].impressions += row.impressions ?? 0;
      grouped[row.campaign_id].clicks      += row.clicks ?? 0;
      grouped[row.campaign_id].conversions += row.conversions ?? 0;
    }
    return Object.values(grouped).sort((a, b) => b.spend - a.spend);
  }, [data]);

  return { campaignSummary, isLoading };
}

// ── Google Ads expanded hooks ──────────────────────────────────────────────────

export function useGoogleAdGroups(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const sorted = [...campaignIds].sort();
  return useSWR<GoogleAdGroupPerfDaily[]>(
    ["google_adgroup_perf", dateStart, dateStop, sorted.join(",")],
    async () => {
      let q = supabase.from("v_google_adgroup_perf").select("*").gte("date", dateStart).lte("date", dateStop);
      if (sorted.length > 0) q = q.in("campaign_id", sorted);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GoogleAdGroupPerfDaily[];
    },
    { refreshInterval: REVALIDATE }
  );
}

export function useGoogleAdGroupSummary(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const { data, isLoading } = useGoogleAdGroups(dateStart, dateStop, campaignIds);
  const summary = useMemo(() => {
    if (!data) return [];
    const agg: Record<string, { adgroup_id: string; adgroup_name: string; campaign_name: string; spend: number; impressions: number; clicks: number; conversions: number }> = {};
    for (const r of data) {
      if (!agg[r.adgroup_id]) agg[r.adgroup_id] = { adgroup_id: r.adgroup_id, adgroup_name: r.adgroup_name, campaign_name: r.campaign_name, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
      agg[r.adgroup_id].spend       += r.cost_idr ?? 0;
      agg[r.adgroup_id].impressions += r.impressions ?? 0;
      agg[r.adgroup_id].clicks      += r.clicks ?? 0;
      agg[r.adgroup_id].conversions += r.conversions ?? 0;
    }
    return Object.values(agg).sort((a, b) => b.spend - a.spend);
  }, [data]);
  return { summary, isLoading };
}

export function useGoogleKeywords(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const sorted = [...campaignIds].sort();
  return useSWR<GoogleKeywordPerfDaily[]>(
    ["google_keyword_perf", dateStart, dateStop, sorted.join(",")],
    async () => {
      let q = supabase.from("v_google_keyword_perf").select("*").gte("date", dateStart).lte("date", dateStop);
      if (sorted.length > 0) q = q.in("campaign_id", sorted);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GoogleKeywordPerfDaily[];
    },
    { refreshInterval: REVALIDATE }
  );
}

export function useGoogleKeywordSummary(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const { data, isLoading } = useGoogleKeywords(dateStart, dateStop, campaignIds);
  const summary = useMemo(() => {
    if (!data) return [];
    const agg: Record<string, { key: string; keyword_text: string; match_type: string | null; quality_score: number | null; campaign_name: string; spend: number; impressions: number; clicks: number; conversions: number }> = {};
    for (const r of data) {
      const key = `${r.criterion_id}`;
      if (!agg[key]) agg[key] = { key, keyword_text: r.keyword_text, match_type: r.match_type, quality_score: r.quality_score, campaign_name: r.campaign_name, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
      agg[key].spend       += r.cost_idr ?? 0;
      agg[key].impressions += r.impressions ?? 0;
      agg[key].clicks      += r.clicks ?? 0;
      agg[key].conversions += r.conversions ?? 0;
      if (r.quality_score != null) agg[key].quality_score = r.quality_score;
    }
    return Object.values(agg).sort((a, b) => b.clicks - a.clicks);
  }, [data]);
  return { summary, isLoading };
}

export function useGoogleSearchTerms(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const sorted = [...campaignIds].sort();
  return useSWR<GoogleSearchTermPerfDaily[]>(
    ["google_search_term_perf", dateStart, dateStop, sorted.join(",")],
    async () => {
      let q = supabase.from("v_google_search_term_perf").select("*").gte("date", dateStart).lte("date", dateStop);
      if (sorted.length > 0) q = q.in("campaign_id", sorted);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GoogleSearchTermPerfDaily[];
    },
    { refreshInterval: REVALIDATE }
  );
}

export function useGoogleSearchTermSummary(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const { data, isLoading } = useGoogleSearchTerms(dateStart, dateStop, campaignIds);
  const summary = useMemo(() => {
    if (!data) return [];
    const agg: Record<string, { search_term: string; status: string | null; campaign_name: string; spend: number; impressions: number; clicks: number; conversions: number }> = {};
    for (const r of data) {
      const key = r.search_term;
      if (!agg[key]) agg[key] = { search_term: key, status: r.status, campaign_name: r.campaign_name, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
      agg[key].spend       += r.cost_idr ?? 0;
      agg[key].impressions += r.impressions ?? 0;
      agg[key].clicks      += r.clicks ?? 0;
      agg[key].conversions += r.conversions ?? 0;
    }
    return Object.values(agg).sort((a, b) => b.clicks - a.clicks);
  }, [data]);
  return { summary, isLoading };
}

export function useGoogleDevice(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const sorted = [...campaignIds].sort();
  return useSWR<GooglePerfDeviceDaily[]>(
    ["google_perf_device", dateStart, dateStop, sorted.join(",")],
    async () => {
      let q = supabase.from("v_google_perf_device").select("*").gte("date", dateStart).lte("date", dateStop);
      if (sorted.length > 0) q = q.in("campaign_id", sorted);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GooglePerfDeviceDaily[];
    },
    { refreshInterval: REVALIDATE }
  );
}

export function useGoogleDeviceSummary(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const { data, isLoading } = useGoogleDevice(dateStart, dateStop, campaignIds);
  const summary = useMemo(() => {
    if (!data) return [];
    const agg: Record<string, { device: string; spend: number; impressions: number; clicks: number; conversions: number }> = {};
    for (const r of data) {
      if (!agg[r.device]) agg[r.device] = { device: r.device, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
      agg[r.device].spend       += r.cost_idr ?? 0;
      agg[r.device].impressions += r.impressions ?? 0;
      agg[r.device].clicks      += r.clicks ?? 0;
      agg[r.device].conversions += r.conversions ?? 0;
    }
    return Object.values(agg).sort((a, b) => b.impressions - a.impressions);
  }, [data]);
  return { summary, isLoading };
}

export function useGoogleAds(campaignIds: string[] = []) {
  const sorted = [...campaignIds].sort();
  return useSWR<GoogleAd[]>(
    ["google_ads_list", sorted.join(",")],
    async () => {
      let q = supabase.from("google_ads").select("*").order("campaign_id");
      if (sorted.length > 0) q = q.in("campaign_id", sorted);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GoogleAd[];
    },
    { refreshInterval: REVALIDATE }
  );
}

export function useGoogleAdGroupsList(campaignIds: string[] = []) {
  const sorted = [...campaignIds].sort();
  return useSWR<GoogleAdGroup[]>(
    ["google_adgroups_list", sorted.join(",")],
    async () => {
      let q = supabase.from("google_adgroups").select("*").order("name");
      if (sorted.length > 0) q = q.in("campaign_id", sorted);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GoogleAdGroup[];
    },
    { refreshInterval: REVALIDATE }
  );
}

// ── Google Ads demographic hooks ──────────────────────────────────────────────

export function useGoogleAge(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const sorted = [...campaignIds].sort();
  return useSWR<GooglePerfAgeDaily[]>(
    ["google_perf_age", dateStart, dateStop, sorted.join(",")],
    async () => {
      let q = supabase.from("v_google_perf_age").select("*").gte("date", dateStart).lte("date", dateStop);
      if (sorted.length > 0) q = q.in("campaign_id", sorted);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GooglePerfAgeDaily[];
    },
    { refreshInterval: REVALIDATE }
  );
}

const AGE_ORDER = [
  "AGE_RANGE_18_24", "AGE_RANGE_25_34", "AGE_RANGE_35_44",
  "AGE_RANGE_45_54", "AGE_RANGE_55_64", "AGE_RANGE_65_UP", "UNDETERMINED",
];
const AGE_LABEL: Record<string, string> = {
  "AGE_RANGE_18_24": "18–24", "AGE_RANGE_25_34": "25–34", "AGE_RANGE_35_44": "35–44",
  "AGE_RANGE_45_54": "45–54", "AGE_RANGE_55_64": "55–64", "AGE_RANGE_65_UP": "65+",
  "UNDETERMINED": "Tidak diketahui",
};

export function useGoogleAgeSummary(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const { data, isLoading } = useGoogleAge(dateStart, dateStop, campaignIds);
  const summary = useMemo(() => {
    if (!data) return [];
    const agg: Record<string, { age_range: string; label: string; impressions: number; clicks: number; cost_idr: number; conversions: number }> = {};
    for (const r of data) {
      if (!agg[r.age_range]) agg[r.age_range] = { age_range: r.age_range, label: AGE_LABEL[r.age_range] ?? r.age_range, impressions: 0, clicks: 0, cost_idr: 0, conversions: 0 };
      agg[r.age_range].impressions += r.impressions ?? 0;
      agg[r.age_range].clicks      += r.clicks ?? 0;
      agg[r.age_range].cost_idr    += r.cost_idr ?? 0;
      agg[r.age_range].conversions += r.conversions ?? 0;
    }
    return Object.values(agg).sort((a, b) => AGE_ORDER.indexOf(a.age_range) - AGE_ORDER.indexOf(b.age_range));
  }, [data]);
  return { summary, isLoading };
}

export function useGoogleGender(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const sorted = [...campaignIds].sort();
  return useSWR<GooglePerfGenderDaily[]>(
    ["google_perf_gender", dateStart, dateStop, sorted.join(",")],
    async () => {
      let q = supabase.from("v_google_perf_gender").select("*").gte("date", dateStart).lte("date", dateStop);
      if (sorted.length > 0) q = q.in("campaign_id", sorted);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GooglePerfGenderDaily[];
    },
    { refreshInterval: REVALIDATE }
  );
}

const GENDER_LABEL: Record<string, string> = { "MALE": "Pria", "FEMALE": "Wanita", "UNDETERMINED": "Tidak diketahui" };

export function useGoogleGenderSummary(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const { data, isLoading } = useGoogleGender(dateStart, dateStop, campaignIds);
  const summary = useMemo(() => {
    if (!data) return [];
    const agg: Record<string, { gender: string; label: string; impressions: number; clicks: number; cost_idr: number; conversions: number }> = {};
    for (const r of data) {
      if (!agg[r.gender]) agg[r.gender] = { gender: r.gender, label: GENDER_LABEL[r.gender] ?? r.gender, impressions: 0, clicks: 0, cost_idr: 0, conversions: 0 };
      agg[r.gender].impressions += r.impressions ?? 0;
      agg[r.gender].clicks      += r.clicks ?? 0;
      agg[r.gender].cost_idr    += r.cost_idr ?? 0;
      agg[r.gender].conversions += r.conversions ?? 0;
    }
    return Object.values(agg).sort((a, b) => b.impressions - a.impressions);
  }, [data]);
  return { summary, isLoading };
}

export function useGoogleGeo(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const sorted = [...campaignIds].sort();
  return useSWR<GooglePerfGeoDaily[]>(
    ["google_perf_geo", dateStart, dateStop, sorted.join(",")],
    async () => {
      let q = supabase.from("v_google_perf_geo").select("*").gte("date", dateStart).lte("date", dateStop);
      if (sorted.length > 0) q = q.in("campaign_id", sorted);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GooglePerfGeoDaily[];
    },
    { refreshInterval: REVALIDATE }
  );
}

const GEO_CRITERION_NAME: Record<string, string> = {
  "2360": "Indonesia", "2458": "Malaysia", "2702": "Singapore",
  "2764": "Thailand", "2608": "Filipina", "2704": "Vietnam",
  "2036": "Australia", "2840": "Amerika Serikat", "2826": "Inggris",
  "2276": "Jerman", "2392": "Jepang", "2410": "Korea Selatan",
  "2356": "India", "2156": "China", "2682": "Arab Saudi",
  "2784": "Uni Emirat Arab", "2528": "Belanda", "2250": "Prancis",
  "2380": "Italia", "2724": "Spanyol", "2643": "Rusia",
  "2124": "Kanada", "2076": "Brasil", "2484": "Meksiko",
  "2554": "Selandia Baru", "2344": "Hong Kong", "2158": "Taiwan",
  "2586": "Pakistan", "2050": "Bangladesh", "2600": "Peru",
  "2032": "Argentina", "2566": "Nigeria", "2818": "Mesir",
};

export function useGoogleGeoSummary(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const { data, isLoading } = useGoogleGeo(dateStart, dateStop, campaignIds);
  const summary = useMemo(() => {
    if (!data) return [];
    const agg: Record<string, { criterion_id: string; country_name: string; impressions: number; clicks: number; cost_idr: number; conversions: number }> = {};
    for (const r of data) {
      const key = r.country_criterion_id;
      if (!agg[key]) agg[key] = {
        criterion_id: key,
        country_name: GEO_CRITERION_NAME[key] ?? `ID:${key}`,
        impressions: 0, clicks: 0, cost_idr: 0, conversions: 0,
      };
      agg[key].impressions += r.impressions ?? 0;
      agg[key].clicks      += r.clicks ?? 0;
      agg[key].cost_idr    += r.cost_idr ?? 0;
      agg[key].conversions += r.conversions ?? 0;
    }
    return Object.values(agg).sort((a, b) => b.impressions - a.impressions);
  }, [data]);
  return { summary, isLoading };
}

export function useGoogleHour(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const sorted = [...campaignIds].sort();
  return useSWR<GooglePerfHourDaily[]>(
    ["google_perf_hour", dateStart, dateStop, sorted.join(",")],
    async () => {
      let q = supabase.from("v_google_perf_hour").select("*").gte("date", dateStart).lte("date", dateStop);
      if (sorted.length > 0) q = q.in("campaign_id", sorted);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GooglePerfHourDaily[];
    },
    { refreshInterval: REVALIDATE }
  );
}

const DOW_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DOW_LABEL: Record<string, string> = {
  "MONDAY": "Senin", "TUESDAY": "Selasa", "WEDNESDAY": "Rabu",
  "THURSDAY": "Kamis", "FRIDAY": "Jumat", "SATURDAY": "Sabtu", "SUNDAY": "Minggu",
};

export function useGoogleHourSummary(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const { data, isLoading } = useGoogleHour(dateStart, dateStop, campaignIds);
  const summary = useMemo(() => {
    if (!data) return { byHour: [] as { hour: number; label: string; impressions: number; clicks: number; cost_idr: number }[], byDay: [] as { day: string; label: string; impressions: number; clicks: number; cost_idr: number }[] };
    const byHour: Record<number, { hour: number; label: string; impressions: number; clicks: number; cost_idr: number }> = {};
    const byDay:  Record<string, { day: string; label: string; impressions: number; clicks: number; cost_idr: number }>  = {};
    for (const r of data) {
      if (!byHour[r.hour]) byHour[r.hour] = { hour: r.hour, label: `${String(r.hour).padStart(2, "0")}:00`, impressions: 0, clicks: 0, cost_idr: 0 };
      byHour[r.hour].impressions += r.impressions ?? 0;
      byHour[r.hour].clicks      += r.clicks ?? 0;
      byHour[r.hour].cost_idr    += r.cost_idr ?? 0;
      if (!byDay[r.day_of_week]) byDay[r.day_of_week] = { day: r.day_of_week, label: DOW_LABEL[r.day_of_week] ?? r.day_of_week, impressions: 0, clicks: 0, cost_idr: 0 };
      byDay[r.day_of_week].impressions += r.impressions ?? 0;
      byDay[r.day_of_week].clicks      += r.clicks ?? 0;
      byDay[r.day_of_week].cost_idr    += r.cost_idr ?? 0;
    }
    return {
      byHour: Array.from({ length: 24 }, (_, i) => byHour[i] ?? { hour: i, label: `${String(i).padStart(2, "0")}:00`, impressions: 0, clicks: 0, cost_idr: 0 }),
      byDay:  DOW_ORDER.map((d) => byDay[d] ?? { day: d, label: DOW_LABEL[d] ?? d, impressions: 0, clicks: 0, cost_idr: 0 }),
    };
  }, [data]);
  return { summary, isLoading };
}

export function useGoogleLocationTargeting(campaignIds: string[] = []) {
  const sorted = [...campaignIds].sort();
  return useSWR<GoogleLocationTargeting[]>(
    ["google_location_targeting", sorted.join(",")],
    async () => {
      let q = supabase
        .from("v_google_location_targeting")
        .select("*")
        .order("campaign_name")
        .order("is_negative")
        .order("location_name");
      if (sorted.length > 0) q = q.in("campaign_id", sorted);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GoogleLocationTargeting[];
    },
    { refreshInterval: REVALIDATE }
  );
}

export function useGoogleCity(dateStart: string, dateStop: string, campaignIds: string[] = []) {
  const sorted = [...campaignIds].sort();
  return useSWR<GooglePerfCityDaily[]>(
    ["google_perf_city", dateStart, dateStop, sorted.join(",")],
    async () => {
      let q = supabase.from("v_google_perf_city").select("*").gte("date", dateStart).lte("date", dateStop);
      if (sorted.length > 0) q = q.in("campaign_id", sorted);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GooglePerfCityDaily[];
    },
    { refreshInterval: REVALIDATE }
  );
}

export function useGoogleCitySummary(dateStart: string, dateStop: string, campaignIds: string[] = [], groupBy: "city" | "region" = "city") {
  const { data, isLoading } = useGoogleCity(dateStart, dateStop, campaignIds);
  const summary = useMemo(() => {
    if (!data) return [];
    const agg: Record<string, { key: string; name: string; canonical: string | null; impressions: number; clicks: number; cost_idr: number; conversions: number }> = {};
    for (const r of data) {
      const key  = groupBy === "city" ? (r.city_criterion_id ?? r.region_criterion_id ?? "?") : (r.region_criterion_id ?? "?");
      const name = groupBy === "city" ? r.city_name : r.region_name;
      const canonical = groupBy === "city" ? (r.city_canonical ?? null) : null;
      if (!key || key === "?" || key === "null") continue;
      if (!agg[key]) agg[key] = { key, name, canonical, impressions: 0, clicks: 0, cost_idr: 0, conversions: 0 };
      agg[key].impressions += r.impressions ?? 0;
      agg[key].clicks      += r.clicks ?? 0;
      agg[key].cost_idr    += r.cost_idr ?? 0;
      agg[key].conversions += r.conversions ?? 0;
    }
    return Object.values(agg).sort((a, b) => b.impressions - a.impressions);
  }, [data, groupBy]);
  return { summary, isLoading };
}

// ── GA4 hooks ─────────────────────────────────────────────────────────────────

export function useGa4Traffic(dateStart: string, dateStop: string) {
  return useSWR<Ga4TrafficSummary[]>(
    ["ga4_traffic", dateStart, dateStop],
    async () => {
      const { data, error } = await supabase
        .from("v_ga4_traffic_summary")
        .select("*")
        .gte("date", dateStart)
        .lte("date", dateStop)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Ga4TrafficSummary[];
    },
    { refreshInterval: REVALIDATE }
  );
}

export function useGa4KpiTotals(dateStart: string, dateStop: string) {
  const { data, isLoading, error } = useGa4Traffic(dateStart, dateStop);

  const totals = useMemo(() => {
    if (!data || data.length === 0) return null;
    const sessions    = data.reduce((s, r) => s + (r.sessions ?? 0), 0);
    const users       = data.reduce((s, r) => s + (r.users ?? 0), 0);
    const newUsers    = data.reduce((s, r) => s + (r.new_users ?? 0), 0);
    const conversions = data.reduce((s, r) => s + (r.conversions ?? 0), 0);
    const wBounce     = data.reduce((s, r) => s + (r.bounce_rate_pct ?? 0) * (r.sessions ?? 0), 0);
    const wEngagement = data.reduce((s, r) => s + (r.engagement_rate_pct ?? 0) * (r.sessions ?? 0), 0);
    return {
      sessions,
      users,
      new_users:       newUsers,
      conversions,
      bounce_rate:     sessions > 0 ? wBounce / sessions : 0,
      engagement_rate: sessions > 0 ? wEngagement / sessions : 0,
    };
  }, [data]);

  return { totals, isLoading, error };
}

// Sessions per channel untuk bar chart
export function useGa4ByChannel(dateStart: string, dateStop: string) {
  const { data, isLoading } = useGa4Traffic(dateStart, dateStop);

  const byChannel = useMemo(() => {
    if (!data) return [];
    const grouped: Record<string, number> = {};
    for (const row of data) {
      grouped[row.channel_group] = (grouped[row.channel_group] ?? 0) + row.sessions;
    }
    return Object.entries(grouped)
      .map(([channel, sessions]) => ({ channel, sessions }))
      .sort((a, b) => b.sessions - a.sessions);
  }, [data]);

  return { byChannel, isLoading };
}

// Sessions + users per hari untuk area chart
export function useGa4DailyTrend(dateStart: string, dateStop: string) {
  const { data, isLoading } = useGa4Traffic(dateStart, dateStop);

  const dailyTrend = useMemo(() => {
    if (!data) return [];
    const grouped: Record<string, { date: string; sessions: number; users: number; conversions: number }> = {};
    for (const row of data) {
      if (!grouped[row.date]) grouped[row.date] = { date: row.date, sessions: 0, users: 0, conversions: 0 };
      grouped[row.date].sessions    += row.sessions;
      grouped[row.date].users       += row.users;
      grouped[row.date].conversions += row.conversions;
    }
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  return { dailyTrend, isLoading };
}

// ── GA4 extended hooks ────────────────────────────────────────────────────────

export function useGa4Demographics(dateStart: string, dateStop: string) {
  return useSWR<Ga4Demographics[]>(
    ["ga4_demographics", dateStart, dateStop],
    async () => {
      const { data, error } = await supabase.from("ga4_demographics").select("*").gte("date", dateStart).lte("date", dateStop);
      if (error) throw error;
      return (data ?? []) as Ga4Demographics[];
    },
    { refreshInterval: REVALIDATE }
  );
}

export function useGa4DemographicsSummary(dateStart: string, dateStop: string) {
  const { data, isLoading } = useGa4Demographics(dateStart, dateStop);
  const summary = useMemo(() => {
    if (!data) return { byAge: [], byGender: [] };
    const byAge: Record<string, number> = {};
    const byGender: Record<string, number> = {};
    for (const r of data) {
      byAge[r.age_group]   = (byAge[r.age_group]   ?? 0) + r.sessions;
      byGender[r.gender]   = (byGender[r.gender]   ?? 0) + r.sessions;
    }
    return {
      byAge:    Object.entries(byAge).map(([age, sessions]) => ({ age, sessions })).sort((a, b) => a.age.localeCompare(b.age)),
      byGender: Object.entries(byGender).map(([gender, sessions]) => ({ gender, sessions })).sort((a, b) => b.sessions - a.sessions),
    };
  }, [data]);
  return { summary, isLoading };
}

export function useGa4Platform(dateStart: string, dateStop: string) {
  return useSWR<Ga4Platform[]>(
    ["ga4_platform", dateStart, dateStop],
    async () => {
      const { data, error } = await supabase.from("ga4_platform").select("*").gte("date", dateStart).lte("date", dateStop);
      if (error) throw error;
      return (data ?? []) as Ga4Platform[];
    },
    { refreshInterval: REVALIDATE }
  );
}

export function useGa4PlatformSummary(dateStart: string, dateStop: string) {
  const { data, isLoading } = useGa4Platform(dateStart, dateStop);
  const summary = useMemo(() => {
    if (!data) return { byDevice: [], byOS: [], byBrowser: [] };
    const byDevice: Record<string, number> = {};
    const byOS: Record<string, number> = {};
    const byBrowser: Record<string, number> = {};
    for (const r of data) {
      byDevice[r.device_category]  = (byDevice[r.device_category]  ?? 0) + r.sessions;
      byOS[r.operating_system]     = (byOS[r.operating_system]     ?? 0) + r.sessions;
      byBrowser[r.browser]         = (byBrowser[r.browser]         ?? 0) + r.sessions;
    }
    const sortDesc = (obj: Record<string, number>) =>
      Object.entries(obj).map(([k, sessions]) => ({ name: k, sessions })).sort((a, b) => b.sessions - a.sessions);
    return { byDevice: sortDesc(byDevice), byOS: sortDesc(byOS).slice(0, 10), byBrowser: sortDesc(byBrowser).slice(0, 10) };
  }, [data]);
  return { summary, isLoading };
}

export function useGa4LandingPages(dateStart: string, dateStop: string, limit = 20) {
  return useSWR<Ga4LandingPage[]>(
    ["ga4_landing_pages", dateStart, dateStop, limit],
    async () => {
      const { data, error } = await supabase
        .from("ga4_landing_pages").select("*").gte("date", dateStart).lte("date", dateStop);
      if (error) throw error;
      // aggregate by landing_page
      const agg: Record<string, Ga4LandingPage & { _sessions: number }> = {};
      for (const r of (data ?? []) as Ga4LandingPage[]) {
        if (!agg[r.landing_page]) {
          agg[r.landing_page] = { ...r, _sessions: 0, sessions: 0, users: 0, conversions: 0, bounce_rate: 0, engagement_rate: 0, avg_session_duration: 0 };
        }
        agg[r.landing_page].sessions           += r.sessions;
        agg[r.landing_page].users              += r.users;
        agg[r.landing_page].conversions        += r.conversions;
        agg[r.landing_page].bounce_rate        += r.bounce_rate * r.sessions;
        agg[r.landing_page].engagement_rate    += r.engagement_rate * r.sessions;
        agg[r.landing_page].avg_session_duration += r.avg_session_duration * r.sessions;
        agg[r.landing_page]._sessions          += r.sessions;
      }
      return Object.values(agg).map((r) => ({
        ...r,
        bounce_rate:          r._sessions > 0 ? r.bounce_rate / r._sessions : 0,
        engagement_rate:      r._sessions > 0 ? r.engagement_rate / r._sessions : 0,
        avg_session_duration: r._sessions > 0 ? r.avg_session_duration / r._sessions : 0,
      })).sort((a, b) => b.sessions - a.sessions).slice(0, limit);
    },
    { refreshInterval: REVALIDATE }
  );
}

export function useGa4Pages(dateStart: string, dateStop: string, limit = 20) {
  return useSWR<Ga4Page[]>(
    ["ga4_pages", dateStart, dateStop, limit],
    async () => {
      const { data, error } = await supabase.from("ga4_pages").select("*").gte("date", dateStart).lte("date", dateStop);
      if (error) throw error;
      const agg: Record<string, { page_path: string; page_title: string; views: number; users: number; duration: number }> = {};
      for (const r of (data ?? []) as Ga4Page[]) {
        if (!agg[r.page_path]) agg[r.page_path] = { page_path: r.page_path, page_title: r.page_title, views: 0, users: 0, duration: 0 };
        agg[r.page_path].views    += r.screen_page_views;
        agg[r.page_path].users    += r.users;
        agg[r.page_path].duration += r.engagement_duration;
      }
      return Object.values(agg).map((r) => ({
        id: r.page_path, property_id: "", date: "", page_path: r.page_path, page_title: r.page_title,
        screen_page_views: r.views, users: r.users,
        engagement_duration: r.views > 0 ? r.duration / r.views : 0,
      } as Ga4Page)).sort((a, b) => b.screen_page_views - a.screen_page_views).slice(0, limit);
    },
    { refreshInterval: REVALIDATE }
  );
}

export function useGa4Geography(dateStart: string, dateStop: string, limit = 20) {
  return useSWR<Ga4Geography[]>(
    ["ga4_geography", dateStart, dateStop, limit],
    async () => {
      const { data, error } = await supabase.from("ga4_geography").select("*").gte("date", dateStart).lte("date", dateStop);
      if (error) throw error;
      const byCountry: Record<string, { country: string; sessions: number; users: number; new_users: number; conversions: number }> = {};
      for (const r of (data ?? []) as Ga4Geography[]) {
        if (!byCountry[r.country]) byCountry[r.country] = { country: r.country, sessions: 0, users: 0, new_users: 0, conversions: 0 };
        byCountry[r.country].sessions    += r.sessions;
        byCountry[r.country].users       += r.users;
        byCountry[r.country].new_users   += r.new_users;
        byCountry[r.country].conversions += r.conversions;
      }
      return Object.values(byCountry)
        .map((r) => ({ ...r, id: r.country, property_id: "", date: "", city: "" } as Ga4Geography))
        .sort((a, b) => b.sessions - a.sessions).slice(0, limit);
    },
    { refreshInterval: REVALIDATE }
  );
}

export function useGa4SearchTerms(dateStart: string, dateStop: string, limit = 20) {
  return useSWR<Ga4SearchTerm[]>(
    ["ga4_search_terms", dateStart, dateStop, limit],
    async () => {
      const { data, error } = await supabase.from("ga4_search_terms").select("*").gte("date", dateStart).lte("date", dateStop);
      if (error) throw error;
      const agg: Record<string, { search_term: string; sessions: number; users: number; conversions: number }> = {};
      for (const r of (data ?? []) as Ga4SearchTerm[]) {
        if (!agg[r.search_term]) agg[r.search_term] = { search_term: r.search_term, sessions: 0, users: 0, conversions: 0 };
        agg[r.search_term].sessions    += r.sessions;
        agg[r.search_term].users       += r.users;
        agg[r.search_term].conversions += r.conversions;
      }
      return Object.values(agg)
        .map((r) => ({ ...r, id: r.search_term, property_id: "", date: "" } as Ga4SearchTerm))
        .sort((a, b) => b.sessions - a.sessions).slice(0, limit);
    },
    { refreshInterval: REVALIDATE }
  );
}

export function useGa4SearchConsole(dateStart: string, dateStop: string, limit = 50) {
  return useSWR<Ga4SearchConsole[]>(
    ["ga4_search_console", dateStart, dateStop, limit],
    async () => {
      const { data, error } = await supabase
        .from("ga4_search_console")
        .select("*")
        .gte("date", dateStart)
        .lte("date", dateStop);
      if (error) throw error;
      // aggregate by query across dates
      const agg: Record<string, { query: string; clicks: number; impressions: number; ctr_sum: number; pos_sum: number; days: number }> = {};
      for (const r of (data ?? []) as Ga4SearchConsole[]) {
        if (!agg[r.query]) agg[r.query] = { query: r.query, clicks: 0, impressions: 0, ctr_sum: 0, pos_sum: 0, days: 0 };
        agg[r.query].clicks      += r.clicks;
        agg[r.query].impressions += r.impressions;
        agg[r.query].ctr_sum     += r.ctr;
        agg[r.query].pos_sum     += r.position;
        agg[r.query].days        += 1;
      }
      return Object.values(agg)
        .map((r) => ({
          id: r.query, property_id: "", date: "",
          query: r.query,
          clicks:      r.clicks,
          impressions: r.impressions,
          ctr:         r.days > 0 ? r.ctr_sum / r.days : 0,
          position:    r.days > 0 ? r.pos_sum / r.days : 0,
        } as Ga4SearchConsole))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, limit);
    },
    { refreshInterval: REVALIDATE }
  );
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEVELOPER_TOKEN = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")!;
const CUSTOMER_ID     = Deno.env.get("GOOGLE_ADS_CUSTOMER_ID")!;
const CLIENT_ID       = Deno.env.get("GOOGLE_ADS_CLIENT_ID")!;
const CLIENT_SECRET   = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")!;
const REFRESH_TOKEN   = Deno.env.get("GOOGLE_ADS_REFRESH_TOKEN")!;
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Row = Record<string, Record<string, unknown>>;

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type:    "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function runGaql(accessToken: string, gaql: string): Promise<Row[]> {
  const url = `https://googleads.googleapis.com/v21/customers/${CUSTOMER_ID}/googleAds:searchStream`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization":   `Bearer ${accessToken}`,
      "developer-token": DEVELOPER_TOKEN,
      "Content-Type":    "application/json",
    },
    body: JSON.stringify({ query: gaql }),
  });
  if (!res.ok) throw new Error(`Google Ads API ${res.status}: ${await res.text()}`);
  const batches = JSON.parse(await res.text()) as Array<{ results?: Row[] }>;
  const out: Row[] = [];
  for (const b of batches) if (b.results) out.push(...b.results);
  return out;
}

// deno-lint-ignore no-explicit-any
async function upsertBatch(sb: any, table: string, rows: Record<string, unknown>[], onConflict: string): Promise<number> {
  let n = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`Upsert ${table} @${i}: ${error.message}`);
    n += Math.min(500, rows.length - i);
  }
  return n;
}

const now = () => new Date().toISOString();
const isoDate = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const toInt   = (v: unknown) => Math.round(Number(v) || 0);
const toFloat = (v: unknown) => Number(v) || 0;

// ── 1. Campaigns + daily campaign performance ──────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncCampaigns(sb: any, tok: string, ds: string, de: string) {
  const rows = await runGaql(tok, `
    SELECT
      campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
      segments.date,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value,
      metrics.ctr, metrics.average_cpc, metrics.cost_per_conversion,
      metrics.search_impression_share,
      metrics.search_budget_lost_impression_share,
      metrics.search_rank_lost_impression_share,
      metrics.absolute_top_impression_percentage,
      metrics.top_impression_percentage,
      metrics.video_views,
      metrics.video_view_rate,
      metrics.view_through_conversions,
      metrics.active_view_impressions,
      metrics.active_view_viewability
    FROM campaign
    WHERE segments.date BETWEEN '${ds}' AND '${de}'
      AND campaign.status != 'REMOVED'
  `);

  const campMap = new Map<string, Record<string, unknown>>();
  const perf: Record<string, unknown>[] = [];

  for (const row of rows) {
    const c = row.campaign, s = row.segments, m = row.metrics;
    const id = String(c.id);
    campMap.set(id, { id, customer_id: CUSTOMER_ID, name: c.name, status: c.status, advertising_channel_type: c.advertisingChannelType, synced_at: now() });
    perf.push({ id: `${id}_${s.date}`, campaign_id: id, customer_id: CUSTOMER_ID, date: s.date,
      impressions: toInt(m.impressions), clicks: toInt(m.clicks), cost_micros: toInt(m.costMicros),
      conversions: toFloat(m.conversions), conversions_value: toFloat(m.conversionsValue),
      ctr: toFloat(m.ctr), average_cpc: toInt(m.averageCpc), cost_per_conversion: toFloat(m.costPerConversion),
      search_impression_share:      m.searchImpressionShare              != null ? toFloat(m.searchImpressionShare)              : null,
      budget_lost_impression_share: m.searchBudgetLostImpressionShare    != null ? toFloat(m.searchBudgetLostImpressionShare)    : null,
      rank_lost_impression_share:   m.searchRankLostImpressionShare      != null ? toFloat(m.searchRankLostImpressionShare)      : null,
      abs_top_impression_pct:       m.absoluteTopImpressionPercentage    != null ? toFloat(m.absoluteTopImpressionPercentage)    : null,
      top_impression_pct:           m.topImpressionPercentage            != null ? toFloat(m.topImpressionPercentage)            : null,
      video_views:                  toInt(m.videoViews),
      video_view_rate:              m.videoViewRate         != null ? toFloat(m.videoViewRate)         : null,
      view_through_conversions:     toFloat(m.viewThroughConversions),
      active_view_impressions:      toInt(m.activeViewImpressions),
      active_view_viewability:      m.activeViewViewability != null ? toFloat(m.activeViewViewability) : null,
      synced_at: now() });
  }

  const camps = [...campMap.values()];
  if (camps.length) { const { error } = await sb.from("google_campaigns").upsert(camps, { onConflict: "id" }); if (error) throw new Error(error.message); }
  const perfN = await upsertBatch(sb, "google_ad_performance", perf, "campaign_id,date");
  return { campaigns: camps.length, campaign_perf_rows: perfN };
}

// ── 2. Ad groups ───────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncAdGroups(sb: any, tok: string) {
  const rows = await runGaql(tok, `
    SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.type, ad_group.cpc_bid_micros, campaign.id
    FROM ad_group
    WHERE campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED'
  `);

  const mapped = rows.map((row) => {
    const ag = row.adGroup, c = row.campaign;
    return { id: String(ag.id), campaign_id: String(c.id), customer_id: CUSTOMER_ID,
      name: ag.name, status: ag.status, type: ag.type,
      cpc_bid_micros: toInt(ag.cpcBidMicros), synced_at: now() };
  });
  const n = await upsertBatch(sb, "google_adgroups", mapped, "id");
  return { adgroups: n };
}

// ── 3. Ads (creative info) ─────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncAds(sb: any, tok: string) {
  const rows = await runGaql(tok, `
    SELECT
      ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status, ad_group_ad.ad.type,
      ad_group_ad.ad.final_urls,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group.id, campaign.id
    FROM ad_group_ad
    WHERE campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED'
      AND ad_group_ad.status != 'REMOVED'
  `);

  const mapped = rows.map((row) => {
    const ada = row.adGroupAd as Record<string, unknown>;
    const ad  = ada.ad as Record<string, unknown>;
    const rsa = (ad.responsiveSearchAd ?? {}) as Record<string, unknown>;
    const ag  = row.adGroup, c = row.campaign;
    const headlines    = ((rsa.headlines    ?? []) as Array<{text?:string}>).map((h) => h.text ?? "").filter(Boolean);
    const descriptions = ((rsa.descriptions ?? []) as Array<{text?:string}>).map((d) => d.text ?? "").filter(Boolean);
    return { id: String(ad.id), adgroup_id: String(ag.id), campaign_id: String(c.id), customer_id: CUSTOMER_ID,
      name: ad.name ?? null, status: ada.status, type: ad.type,
      final_urls: (ad.finalUrls as string[] | undefined) ?? [],
      headlines, descriptions, synced_at: now() };
  });
  const n = await upsertBatch(sb, "google_ads", mapped, "id");
  return { ads: n };
}

// ── 4. Ad group daily performance ─────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncAdGroupPerf(sb: any, tok: string, ds: string, de: string) {
  const rows = await runGaql(tok, `
    SELECT
      ad_group.id, campaign.id, segments.date,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value,
      metrics.ctr, metrics.average_cpc, metrics.cost_per_conversion
    FROM ad_group
    WHERE segments.date BETWEEN '${ds}' AND '${de}'
      AND campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED'
      AND metrics.impressions > 0
  `);

  const mapped = rows.map((row) => {
    const ag = row.adGroup, c = row.campaign, s = row.segments, m = row.metrics;
    const agId = String(ag.id);
    return { id: `${agId}_${s.date}`, adgroup_id: agId, campaign_id: String(c.id), customer_id: CUSTOMER_ID, date: s.date,
      impressions: toInt(m.impressions), clicks: toInt(m.clicks), cost_micros: toInt(m.costMicros),
      conversions: toFloat(m.conversions), conversions_value: toFloat(m.conversionsValue),
      ctr: toFloat(m.ctr), average_cpc: toInt(m.averageCpc), cost_per_conversion: toFloat(m.costPerConversion),
      synced_at: now() };
  });
  const n = await upsertBatch(sb, "google_adgroup_performance", mapped, "adgroup_id,date");
  return { adgroup_perf_rows: n };
}

// ── 5. Keywords daily performance ─────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncKeywords(sb: any, tok: string, ds: string, de: string) {
  const rows = await runGaql(tok, `
    SELECT
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      ad_group_criterion.quality_info.quality_score,
      ad_group_criterion.quality_info.expected_ctr,
      ad_group_criterion.quality_info.ad_relevance,
      ad_group_criterion.quality_info.landing_page_experience,
      ad_group.id, campaign.id, segments.date,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.ctr, metrics.average_cpc
    FROM keyword_view
    WHERE segments.date BETWEEN '${ds}' AND '${de}'
      AND campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED'
      AND metrics.impressions > 0
  `);

  const rawMapped = rows.map((row) => {
    const agc = row.adGroupCriterion as Record<string, unknown>;
    const kw  = (agc.keyword     ?? {}) as Record<string, unknown>;
    const qi  = (agc.qualityInfo ?? {}) as Record<string, unknown>;
    const ag = row.adGroup, c = row.campaign, s = row.segments, m = row.metrics;
    const critId = String(agc.criterionId);
    return { id: `${critId}_${s.date}`, criterion_id: critId, adgroup_id: String(ag.id), campaign_id: String(c.id), customer_id: CUSTOMER_ID,
      keyword_text: kw.text ?? "", match_type: kw.matchType ?? null, status: agc.status,
      quality_score: qi.qualityScore ? Number(qi.qualityScore) : null,
      expected_ctr:            qi.expectedCtr           ? String(qi.expectedCtr)           : null,
      ad_relevance:            qi.adRelevance           ? String(qi.adRelevance)           : null,
      landing_page_experience: qi.landingPageExperience ? String(qi.landingPageExperience) : null,
      date: s.date, impressions: toInt(m.impressions), clicks: toInt(m.clicks),
      cost_micros: toInt(m.costMicros), conversions: toFloat(m.conversions),
      ctr: toFloat(m.ctr), average_cpc: toInt(m.averageCpc), synced_at: now() };
  });
  const deduped = new Map<string, Record<string, unknown>>();
  for (const r of rawMapped) deduped.set(r.id, r);
  const n = await upsertBatch(sb, "google_keywords", [...deduped.values()], "criterion_id,date");
  return { keyword_rows: n };
}

// ── 6. Search terms (kueri penelusuran aktual) ─────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncSearchTerms(sb: any, tok: string, ds: string, de: string) {
  const rows = await runGaql(tok, `
    SELECT
      search_term_view.search_term, search_term_view.status,
      campaign.id, ad_group.id, segments.date,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.ctr, metrics.average_cpc
    FROM search_term_view
    WHERE segments.date BETWEEN '${ds}' AND '${de}'
      AND campaign.status != 'REMOVED'
      AND metrics.impressions > 0
  `);

  const rawSt = rows.map((row) => {
    const stv = row.searchTermView as Record<string, unknown>;
    const c = row.campaign, ag = row.adGroup, s = row.segments, m = row.metrics;
    const term = String(stv.searchTerm ?? "");
    const cId  = String(c.id);
    const agId = String(ag.id);
    return { id: `${cId}_${agId}_${s.date}_${term}`.slice(0, 255),
      search_term: term, status: stv.status ?? null,
      campaign_id: cId, adgroup_id: agId, customer_id: CUSTOMER_ID, date: s.date,
      impressions: toInt(m.impressions), clicks: toInt(m.clicks),
      cost_micros: toInt(m.costMicros), conversions: toFloat(m.conversions),
      ctr: toFloat(m.ctr), average_cpc: toInt(m.averageCpc), synced_at: now() };
  });
  const dedupedSt = new Map<string, Record<string, unknown>>();
  for (const r of rawSt) dedupedSt.set(r.id, r);
  const n = await upsertBatch(sb, "google_search_terms", [...dedupedSt.values()], "id");
  return { search_term_rows: n };
}

// ── 7. Age range breakdown (age_range_view) ───────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncAge(sb: any, tok: string, ds: string, de: string) {
  const rows = await runGaql(tok, `
    SELECT
      ad_group_criterion.age_range.type,
      campaign.id, campaign.status, segments.date,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.ctr, metrics.average_cpc
    FROM age_range_view
    WHERE segments.date BETWEEN '${ds}' AND '${de}'
      AND campaign.status != 'REMOVED'
      AND metrics.impressions > 0
  `);

  const rawMapped = rows.map((row) => {
    const agc  = row.adGroupCriterion as Record<string, unknown>;
    const ar   = (agc.ageRange ?? {}) as Record<string, unknown>;
    const c = row.campaign, s = row.segments, m = row.metrics;
    const cId = String(c.id);
    const age = String(ar.type ?? "UNDETERMINED");
    return { id: `${cId}_${s.date}_${age}`, campaign_id: cId, customer_id: CUSTOMER_ID,
      date: s.date, age_range: age,
      impressions: toInt(m.impressions), clicks: toInt(m.clicks), cost_micros: toInt(m.costMicros),
      conversions: toFloat(m.conversions), ctr: toFloat(m.ctr), average_cpc: toInt(m.averageCpc),
      synced_at: now() };
  });
  const deduped = new Map<string, Record<string, unknown>>();
  for (const r of rawMapped) deduped.set(r.id, r);
  const n = await upsertBatch(sb, "google_perf_age", [...deduped.values()], "campaign_id,date,age_range");
  return { age_rows: n };
}

// ── 8. Gender breakdown (gender_view) ─────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncGender(sb: any, tok: string, ds: string, de: string) {
  const rows = await runGaql(tok, `
    SELECT
      ad_group_criterion.gender.type,
      campaign.id, campaign.status, segments.date,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.ctr, metrics.average_cpc
    FROM gender_view
    WHERE segments.date BETWEEN '${ds}' AND '${de}'
      AND campaign.status != 'REMOVED'
      AND metrics.impressions > 0
  `);

  const rawMapped = rows.map((row) => {
    const agc    = row.adGroupCriterion as Record<string, unknown>;
    const g      = (agc.gender ?? {}) as Record<string, unknown>;
    const c = row.campaign, s = row.segments, m = row.metrics;
    const cId    = String(c.id);
    const gender = String(g.type ?? "UNDETERMINED");
    return { id: `${cId}_${s.date}_${gender}`, campaign_id: cId, customer_id: CUSTOMER_ID,
      date: s.date, gender,
      impressions: toInt(m.impressions), clicks: toInt(m.clicks), cost_micros: toInt(m.costMicros),
      conversions: toFloat(m.conversions), ctr: toFloat(m.ctr), average_cpc: toInt(m.averageCpc),
      synced_at: now() };
  });
  const deduped = new Map<string, Record<string, unknown>>();
  for (const r of rawMapped) deduped.set(r.id, r);
  const n = await upsertBatch(sb, "google_perf_gender", [...deduped.values()], "campaign_id,date,gender");
  return { gender_rows: n };
}

// ── 9. Geographic breakdown (geographic_view) ─────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncGeo(sb: any, tok: string, ds: string, de: string) {
  const rows = await runGaql(tok, `
    SELECT
      geographic_view.country_criterion_id,
      geographic_view.location_type,
      campaign.id, campaign.status, segments.date,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.ctr, metrics.average_cpc
    FROM geographic_view
    WHERE segments.date BETWEEN '${ds}' AND '${de}'
      AND campaign.status != 'REMOVED'
      AND metrics.impressions > 0
  `);

  const rawMapped = rows.map((row) => {
    const gv = row.geographicView as Record<string, unknown>;
    const c  = row.campaign, s = row.segments, m = row.metrics;
    const cId     = String(c.id);
    const cntryId = String(gv.countryCriterionId ?? "0");
    const locType = String(gv.locationType ?? "UNKNOWN");
    return { id: `${cId}_${s.date}_${cntryId}_${locType}`, campaign_id: cId, customer_id: CUSTOMER_ID,
      date: s.date, country_criterion_id: cntryId, location_type: locType,
      impressions: toInt(m.impressions), clicks: toInt(m.clicks), cost_micros: toInt(m.costMicros),
      conversions: toFloat(m.conversions), ctr: toFloat(m.ctr), average_cpc: toInt(m.averageCpc),
      synced_at: now() };
  });
  const deduped = new Map<string, Record<string, unknown>>();
  for (const r of rawMapped) deduped.set(r.id, r);
  const n = await upsertBatch(sb, "google_perf_geo", [...deduped.values()], "campaign_id,date,country_criterion_id,location_type");
  return { geo_rows: n };
}

// ── 10. Hourly breakdown (segments.hour + day_of_week) ────────────────────────

// deno-lint-ignore no-explicit-any
async function syncHour(sb: any, tok: string, ds: string, de: string) {
  const rows = await runGaql(tok, `
    SELECT
      campaign.id, segments.date, segments.hour, segments.day_of_week,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.ctr, metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${ds}' AND '${de}'
      AND campaign.status != 'REMOVED'
      AND metrics.impressions > 0
  `);

  const rawMapped = rows.map((row) => {
    const c = row.campaign, s = row.segments, m = row.metrics;
    const cId  = String(c.id);
    const hour = Number(s.hour ?? 0);
    const dow  = String(s.dayOfWeek ?? "UNKNOWN");
    return { id: `${cId}_${s.date}_${hour}`, campaign_id: cId, customer_id: CUSTOMER_ID,
      date: s.date, hour, day_of_week: dow,
      impressions: toInt(m.impressions), clicks: toInt(m.clicks), cost_micros: toInt(m.costMicros),
      conversions: toFloat(m.conversions), ctr: toFloat(m.ctr), average_cpc: toInt(m.averageCpc),
      synced_at: now() };
  });
  const deduped = new Map<string, Record<string, unknown>>();
  for (const r of rawMapped) deduped.set(r.id, r);
  const n = await upsertBatch(sb, "google_perf_hour", [...deduped.values()], "campaign_id,date,hour");
  return { hour_rows: n };
}

// ── 11. Device breakdown per campaign per day ──────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncDevice(sb: any, tok: string, ds: string, de: string) {
  const rows = await runGaql(tok, `
    SELECT
      campaign.id, segments.date, segments.device,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.ctr, metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${ds}' AND '${de}'
      AND campaign.status != 'REMOVED'
      AND metrics.impressions > 0
  `);

  const mapped = rows.map((row) => {
    const c = row.campaign, s = row.segments, m = row.metrics;
    const cId    = String(c.id);
    const device = String(s.device ?? "UNSPECIFIED");
    return { id: `${cId}_${s.date}_${device}`, campaign_id: cId, customer_id: CUSTOMER_ID,
      date: s.date, device,
      impressions: toInt(m.impressions), clicks: toInt(m.clicks),
      cost_micros: toInt(m.costMicros), conversions: toFloat(m.conversions),
      ctr: toFloat(m.ctr), average_cpc: toInt(m.averageCpc), synced_at: now() };
  });
  const n = await upsertBatch(sb, "google_perf_device", mapped, "campaign_id,date,device");
  return { device_rows: n };
}

// ── 12. Geo target constants lookup (nama kota/provinsi) ──────────────────────

// deno-lint-ignore no-explicit-any
async function syncGeoTargets(sb: any, tok: string) {
  // Ambil semua lokasi Indonesia (kota + provinsi) + semua negara dunia
  const [rowsID, rowsCountry] = await Promise.all([
    runGaql(tok, `
      SELECT
        geo_target_constant.id, geo_target_constant.name,
        geo_target_constant.canonical_name, geo_target_constant.country_code,
        geo_target_constant.target_type
      FROM geo_target_constant
      WHERE geo_target_constant.status = 'ENABLED'
        AND geo_target_constant.country_code = 'ID'
    `),
    runGaql(tok, `
      SELECT
        geo_target_constant.id, geo_target_constant.name,
        geo_target_constant.canonical_name, geo_target_constant.country_code,
        geo_target_constant.target_type
      FROM geo_target_constant
      WHERE geo_target_constant.status = 'ENABLED'
        AND geo_target_constant.target_type = 'Country'
    `),
  ]);

  const all = [...rowsID, ...rowsCountry];
  const deduped = new Map<string, Record<string, unknown>>();
  for (const row of all) {
    const g = row.geoTargetConstant as Record<string, unknown>;
    const id = String(g.id ?? "");
    if (!id) continue;
    deduped.set(id, {
      criterion_id:   id,
      name:           String(g.name ?? ""),
      canonical_name: String(g.canonicalName ?? ""),
      country_code:   String(g.countryCode ?? ""),
      target_type:    String(g.targetType ?? ""),
    });
  }
  const rows = [...deduped.values()];
  if (rows.length) {
    const { error } = await sb.from("google_geo_targets").upsert(rows, { onConflict: "criterion_id" });
    if (error) throw new Error(`Upsert google_geo_targets: ${error.message}`);
  }
  return { geo_target_rows: rows.length };
}

// ── 13. City-level performance (segments.geo_target_city + region via ad_group) ─

// deno-lint-ignore no-explicit-any
async function syncCity(sb: any, tok: string, ds: string, de: string) {
  // segments.geo_target_city is NOT compatible with 'campaign' resource — use ad_group
  const rows = await runGaql(tok, `
    SELECT
      campaign.id, campaign.status, segments.date,
      segments.geo_target_city, segments.geo_target_region,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.ctr, metrics.average_cpc
    FROM ad_group
    WHERE segments.date BETWEEN '${ds}' AND '${de}'
      AND campaign.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
      AND metrics.impressions > 0
  `);

  const extractId = (resourceName: unknown) => {
    const s = String(resourceName ?? "");
    return s ? (s.split("/")[1] ?? "") : "";
  };

  // Aggregate by campaign + date + city + region (multiple ad groups → 1 row per campaign)
  const agg = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const c = row.campaign, s = row.segments, m = row.metrics;
    const cId    = String(c.id);
    const cityId = extractId(s.geoTargetCity);
    const regId  = extractId(s.geoTargetRegion);
    if (!cityId && !regId) continue;

    const key = `${cId}_${s.date}_${cityId || "0"}_${regId || "0"}`;
    if (!agg.has(key)) {
      agg.set(key, {
        id: key, campaign_id: cId, customer_id: CUSTOMER_ID, date: s.date,
        city_criterion_id:   cityId || null,
        region_criterion_id: regId  || null,
        impressions: 0, clicks: 0, cost_micros: 0, conversions: 0.0,
        ctr: 0, average_cpc: 0, synced_at: now(),
      });
    }
    const r = agg.get(key)!;
    r.impressions = (r.impressions as number) + toInt(m.impressions);
    r.clicks      = (r.clicks      as number) + toInt(m.clicks);
    r.cost_micros = (r.cost_micros as number) + toInt(m.costMicros);
    r.conversions = (r.conversions as number) + toFloat(m.conversions);
  }

  // Recalculate derived metrics after aggregation
  for (const r of agg.values()) {
    const impr = r.impressions as number;
    const clk  = r.clicks as number;
    const cost = r.cost_micros as number;
    r.ctr         = impr > 0 ? clk / impr : 0;
    r.average_cpc = clk  > 0 ? Math.round(cost / clk) : 0;
  }

  // segments.geo_target_city is incompatible with ad_group in v21 — skip if no data
  if (agg.size === 0) return { city_rows: 0, note: "segments.geo_target_city not supported for ad_group in v21" };
  const n = await upsertBatch(sb, "google_perf_city", [...agg.values()], "id");
  return { city_rows: n };
}

// ── 14. Location targeting (campaign_criterion type=LOCATION) ──────────────────

// deno-lint-ignore no-explicit-any
async function syncLocationTargeting(sb: any, tok: string) {
  const rows = await runGaql(tok, `
    SELECT
      campaign.id, campaign.name, campaign.status,
      campaign_criterion.status, campaign_criterion.negative,
      campaign_criterion.bid_modifier,
      campaign_criterion.location.geo_target_constant
    FROM campaign_criterion
    WHERE campaign.status != 'REMOVED'
      AND campaign_criterion.type = 'LOCATION'
  `);

  const extractId = (resourceName: unknown) => {
    const s = String(resourceName ?? "");
    return s ? (s.split("/")[1] ?? "") : "";
  };

  const mapped = rows.map((row) => {
    const c   = row.campaign;
    const cc  = row.campaignCriterion as Record<string, unknown>;
    const loc = (cc.location ?? {}) as Record<string, unknown>;
    const criterionId = extractId(loc.geoTargetConstant);
    if (!criterionId) return null;
    return {
      id:                  `${String(c.id)}_${criterionId}`,
      campaign_id:         String(c.id),
      customer_id:         CUSTOMER_ID,
      criterion_id:        criterionId,
      status:              cc.status ?? null,
      is_negative:         cc.negative === true,
      bid_modifier:        Number(cc.bidModifier ?? 1.0),
      synced_at:           now(),
    };
  }).filter(Boolean) as Record<string, unknown>[];

  if (!mapped.length) return { location_targeting_rows: 0 };
  const { error } = await sb.from("google_location_targeting").upsert(mapped, { onConflict: "id" });
  if (error) throw new Error(`Upsert google_location_targeting: ${error.message}`);
  return { location_targeting_rows: mapped.length };
}

// ── 15. Auction Insights (Analisa Lelang) ────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncAuctionInsights(sb: any, tok: string, ds: string, de: string) {
  // Auction insight data hanya tersedia jika akun punya Search campaigns aktif
  // Field domain diakses dari resource auction_insight
  let rows: Record<string, unknown>[];
  try {
    rows = await runGaql(tok, `
      SELECT
        auction_insight.domain,
        campaign.id, segments.date,
        metrics.auction_insight_search_impression_share,
        metrics.auction_insight_search_outranking_share,
        metrics.auction_insight_search_overlap_rate,
        metrics.auction_insight_search_position_above_rate,
        metrics.auction_insight_search_top_impression_percentage,
        metrics.auction_insight_search_absolute_top_impression_percentage
      FROM auction_insight
      WHERE segments.date BETWEEN '${ds}' AND '${de}'
        AND campaign.status != 'REMOVED'
    `);
  } catch (e) {
    // Tidak ada auction insight data (bukan Search campaign atau belum ada data)
    console.log("syncAuctionInsights skipped:", String(e));
    return { auction_insight_rows: 0 };
  }

  const rawMapped = rows.map((row) => {
    const ai = (row.auctionInsight ?? {}) as Record<string, unknown>;
    const c = row.campaign, s = row.segments, m = row.metrics;
    const cId   = String(c.id);
    const domain = String(ai.domain ?? "unknown");
    return {
      id: `${cId}_${s.date}_${domain}`,
      campaign_id: cId, customer_id: CUSTOMER_ID, date: s.date, domain,
      impression_share:     m.auctionInsightSearchImpressionShare                   != null ? toFloat(m.auctionInsightSearchImpressionShare)                   : null,
      outranking_share:     m.auctionInsightSearchOutrankingShare                   != null ? toFloat(m.auctionInsightSearchOutrankingShare)                   : null,
      overlap_rate:         m.auctionInsightSearchOverlapRate                        != null ? toFloat(m.auctionInsightSearchOverlapRate)                        : null,
      position_above_rate:  m.auctionInsightSearchPositionAboveRate                 != null ? toFloat(m.auctionInsightSearchPositionAboveRate)                 : null,
      top_of_page_rate:     m.auctionInsightSearchTopImpressionPercentage           != null ? toFloat(m.auctionInsightSearchTopImpressionPercentage)           : null,
      abs_top_of_page_rate: m.auctionInsightSearchAbsoluteTopImpressionPercentage   != null ? toFloat(m.auctionInsightSearchAbsoluteTopImpressionPercentage)   : null,
      synced_at: now(),
    };
  });
  const deduped = new Map<string, Record<string, unknown>>();
  for (const r of rawMapped) deduped.set(r.id, r);
  const n = await upsertBatch(sb, "google_auction_insights", [...deduped.values()], "campaign_id,date,domain");
  return { auction_insight_rows: n };
}

// ── 16. Ad-level daily performance ───────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncAdPerfDaily(sb: any, tok: string, ds: string, de: string) {
  const rows = await runGaql(tok, `
    SELECT
      ad_group_ad.ad.id, ad_group.id, campaign.id, segments.date,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.ctr, metrics.average_cpc
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${ds}' AND '${de}'
      AND campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED'
      AND ad_group_ad.status != 'REMOVED'
      AND metrics.impressions > 0
  `);

  const rawMapped = rows.map((row) => {
    const ada = row.adGroupAd as Record<string, unknown>;
    const ad  = (ada.ad ?? {}) as Record<string, unknown>;
    const ag = row.adGroup, c = row.campaign, s = row.segments, m = row.metrics;
    const adId = String(ad.id);
    return {
      id: `${adId}_${s.date}`, ad_id: adId, adgroup_id: String(ag.id),
      campaign_id: String(c.id), customer_id: CUSTOMER_ID, date: s.date,
      impressions: toInt(m.impressions), clicks: toInt(m.clicks), cost_micros: toInt(m.costMicros),
      conversions: toFloat(m.conversions), ctr: toFloat(m.ctr), average_cpc: toInt(m.averageCpc),
      synced_at: now(),
    };
  });
  const deduped = new Map<string, Record<string, unknown>>();
  for (const r of rawMapped) deduped.set(r.id, r);
  const n = await upsertBatch(sb, "google_ad_perf_daily", [...deduped.values()], "ad_id,date");
  return { ad_perf_daily_rows: n };
}

// ── 17. Asset performance (RSA headlines & descriptions) ─────────────────────

// deno-lint-ignore no-explicit-any
async function syncAssets(sb: any, tok: string) {
  const rows = await runGaql(tok, `
    SELECT
      ad_group_ad_asset_view.ad_group_ad,
      ad_group_ad_asset_view.field_type,
      ad_group_ad_asset_view.performance_label,
      asset.text_asset.text,
      ad_group.id, campaign.id,
      metrics.impressions, metrics.clicks
    FROM ad_group_ad_asset_view
    WHERE campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED'
  `);

  const extractId = (resourceName: unknown) => {
    const s = String(resourceName ?? "");
    const parts = s.split("~");
    return parts[parts.length - 1] ?? s;
  };

  const rawMapped = rows.map((row) => {
    const view   = row.adGroupAdAssetView as Record<string, unknown>;
    const asset  = (row.asset ?? {}) as Record<string, unknown>;
    const text_a = (asset.textAsset ?? {}) as Record<string, unknown>;
    const ag = row.adGroup, c = row.campaign, m = row.metrics;
    const adId       = extractId(view.adGroupAd);
    const fieldType  = String(view.fieldType ?? "UNKNOWN");
    const label      = String(view.performanceLabel ?? "UNRATED");
    const assetText  = String(text_a.text ?? "");
    const key        = `${adId}_${fieldType}_${assetText.slice(0, 50)}`;
    return {
      id: key, ad_id: adId, adgroup_id: String(ag.id), campaign_id: String(c.id),
      customer_id: CUSTOMER_ID, asset_field_type: fieldType, asset_text: assetText || null,
      performance_label: label,
      impressions: toInt(m.impressions), clicks: toInt(m.clicks),
      synced_at: now(),
    };
  }).filter((r) => r.asset_text);

  const deduped = new Map<string, Record<string, unknown>>();
  for (const r of rawMapped) deduped.set(r.id, r);
  const n = await upsertBatch(sb, "google_asset_performance", [...deduped.values()], "id");
  return { asset_rows: n };
}

// ── 18. Conversion action breakdown (konversi per jenis) ─────────────────────

// deno-lint-ignore no-explicit-any
async function syncConversionActions(sb: any, tok: string, ds: string, de: string) {
  const rows = await runGaql(tok, `
    SELECT
      campaign.id, segments.date,
      segments.conversion_action,
      segments.conversion_action_name,
      segments.conversion_action_category,
      metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${ds}' AND '${de}'
      AND campaign.status != 'REMOVED'
      AND metrics.conversions > 0
  `);

  const extractId = (resourceName: unknown) => {
    const s = String(resourceName ?? "");
    return s.split("/").pop() ?? s;
  };

  const rawMapped = rows.map((row) => {
    const c = row.campaign, s = row.segments, m = row.metrics;
    const cId    = String(c.id);
    const convId = extractId(s.conversionAction);
    return {
      id: `${cId}_${s.date}_${convId}`,
      campaign_id: cId, customer_id: CUSTOMER_ID, date: s.date,
      conversion_action_id:       convId,
      conversion_action_name:     String(s.conversionActionName ?? ""),
      conversion_action_category: String(s.conversionActionCategory ?? ""),
      conversions:       toFloat(m.conversions),
      conversions_value: toFloat(m.conversionsValue),
      synced_at: now(),
    };
  });
  const deduped = new Map<string, Record<string, unknown>>();
  for (const r of rawMapped) deduped.set(r.id, r);
  const n = await upsertBatch(sb, "google_conversion_actions", [...deduped.values()], "campaign_id,date,conversion_action_id");
  return { conversion_action_rows: n };
}

// ── 19. Network/Platform breakdown ───────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncNetwork(sb: any, tok: string, ds: string, de: string) {
  const rows = await runGaql(tok, `
    SELECT
      campaign.id, segments.date, segments.ad_network_type,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.ctr, metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${ds}' AND '${de}'
      AND campaign.status != 'REMOVED'
      AND metrics.impressions > 0
  `);

  const mapped = rows.map((row) => {
    const c = row.campaign, s = row.segments, m = row.metrics;
    const cId    = String(c.id);
    const network = String(s.adNetworkType ?? "UNKNOWN");
    return {
      id: `${cId}_${s.date}_${network}`,
      campaign_id: cId, customer_id: CUSTOMER_ID, date: s.date, network,
      impressions: toInt(m.impressions), clicks: toInt(m.clicks), cost_micros: toInt(m.costMicros),
      conversions: toFloat(m.conversions), ctr: toFloat(m.ctr), average_cpc: toInt(m.averageCpc),
      synced_at: now(),
    };
  });
  const n = await upsertBatch(sb, "google_perf_network", mapped, "campaign_id,date,network");
  return { network_rows: n };
}

// ── 20. Landing page performance ─────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function syncLandingPages(sb: any, tok: string, ds: string, de: string) {
  const rows = await runGaql(tok, `
    SELECT
      landing_page_view.unexpanded_final_url,
      segments.date,
      metrics.clicks,
      metrics.speed_score,
      metrics.mobile_friendly_clicks_percentage,
      metrics.valid_accelerated_mobile_pages_clicks_percentage
    FROM landing_page_view
    WHERE segments.date BETWEEN '${ds}' AND '${de}'
      AND metrics.clicks > 0
  `);

  const rawMapped = rows.map((row) => {
    const lp = row.landingPageView as Record<string, unknown>;
    const s  = row.segments, m = row.metrics;
    const url = String(lp.unexpandedFinalUrl ?? "");
    if (!url) return null;
    const urlHash = url.slice(0, 200);
    return {
      id: `${s.date}_${urlHash}`,
      customer_id: CUSTOMER_ID, date: s.date,
      unexpanded_final_url: url,
      clicks: toInt(m.clicks),
      speed_score: m.speedScore != null ? Number(m.speedScore) : null,
      mobile_friendly_clicks_pct: m.mobileFriendlyClicksPercentage != null ? toFloat(m.mobileFriendlyClicksPercentage) : null,
      valid_amp_clicks_pct:       m.validAcceleratedMobilePagesClicksPercentage != null ? toFloat(m.validAcceleratedMobilePagesClicksPercentage) : null,
      synced_at: now(),
    };
  }).filter(Boolean) as Record<string, unknown>[];

  const deduped = new Map<string, Record<string, unknown>>();
  for (const r of rawMapped) deduped.set(r.id, r);
  const n = await upsertBatch(sb, "google_landing_pages", [...deduped.values()], "date,unexpanded_final_url");
  return { landing_page_rows: n };
}

// ── Main handler ───────────────────────────────────────────────────────────────

type SyncType = "all" | "campaigns" | "adgroups" | "ads" | "adgroup_perf" | "keywords" | "search_terms" | "device" | "age" | "gender" | "geo" | "hour" | "demographics" | "geo_targets" | "city" | "location_targeting" | "auction_insights" | "ad_perf_daily" | "assets" | "conversion_actions" | "network" | "landing_pages" | "extended";

Deno.serve(async (req) => {
  try {
    let body: { date_start?: string; date_stop?: string; type?: SyncType } = {};
    try { body = await req.json(); } catch { /* use defaults */ }

    const dateStart = body.date_start ?? isoDate(-29);
    const dateStop  = body.date_stop  ?? isoDate(0);
    const type      = body.type ?? "all";

    console.log(`fetch-google-ads type=${type} ${dateStart}→${dateStop}`);

    const sb  = createClient(SUPABASE_URL, SUPABASE_KEY);
    const tok = await getAccessToken();

    const results: Record<string, unknown> = { type, date_start: dateStart, date_stop: dateStop };

    if (type === "campaigns"    || type === "all") Object.assign(results, await syncCampaigns  (sb, tok, dateStart, dateStop));
    if (type === "adgroups"     || type === "all") Object.assign(results, await syncAdGroups   (sb, tok));
    if (type === "ads"          || type === "all") Object.assign(results, await syncAds        (sb, tok));
    if (type === "adgroup_perf" || type === "all") Object.assign(results, await syncAdGroupPerf(sb, tok, dateStart, dateStop));
    if (type === "keywords"     || type === "all") Object.assign(results, await syncKeywords   (sb, tok, dateStart, dateStop));
    if (type === "search_terms" || type === "all") Object.assign(results, await syncSearchTerms(sb, tok, dateStart, dateStop));
    if (type === "device"       || type === "all" || type === "demographics") Object.assign(results, await syncDevice     (sb, tok, dateStart, dateStop));
    if (type === "age"          || type === "all" || type === "demographics") Object.assign(results, await syncAge        (sb, tok, dateStart, dateStop));
    if (type === "gender"       || type === "all" || type === "demographics") Object.assign(results, await syncGender     (sb, tok, dateStart, dateStop));
    if (type === "geo"          || type === "all" || type === "demographics") Object.assign(results, await syncGeo        (sb, tok, dateStart, dateStop));
    if (type === "hour"         || type === "all" || type === "demographics") Object.assign(results, await syncHour       (sb, tok, dateStart, dateStop));
    if (type === "geo_targets"        || type === "all") Object.assign(results, await syncGeoTargets        (sb, tok));
    if (type === "city"               || type === "all") Object.assign(results, await syncCity               (sb, tok, dateStart, dateStop));
    if (type === "location_targeting" || type === "all") Object.assign(results, await syncLocationTargeting  (sb, tok));
    if (type === "auction_insights"   || type === "extended") Object.assign(results, await syncAuctionInsights  (sb, tok, dateStart, dateStop));
    if (type === "ad_perf_daily"      || type === "extended") Object.assign(results, await syncAdPerfDaily      (sb, tok, dateStart, dateStop));
    if (type === "assets"             || type === "extended") Object.assign(results, await syncAssets            (sb, tok));
    if (type === "conversion_actions" || type === "extended") Object.assign(results, await syncConversionActions (sb, tok, dateStart, dateStop));
    if (type === "network"            || type === "extended") Object.assign(results, await syncNetwork            (sb, tok, dateStart, dateStop));
    if (type === "landing_pages"      || type === "extended") Object.assign(results, await syncLandingPages       (sb, tok, dateStart, dateStop));

    console.log("Done:", JSON.stringify(results));
    return new Response(JSON.stringify({ ok: true, ...results }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("fetch-google-ads error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

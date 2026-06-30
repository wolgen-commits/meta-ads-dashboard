// supabase/functions/fetch-meta-clients/index.ts
// Sync Meta Ads data untuk semua portfolio klien (Putrama Group)
// Token: META_ACCESS_TOKEN (System User "Digitalisasi" — akses ke semua akun)
//
// Cara invoke manual:
//   curl -X POST https://visicwecchgxonxnwmwd.supabase.co/functions/v1/fetch-meta-clients \
//     -H "Authorization: Bearer <service_role_key>" \
//     -H "Content-Type: application/json" \
//     -d '{"date_start":"2026-06-01","date_stop":"2026-06-24"}'
//
// Untuk sync satu portfolio saja:
//   -d '{"portfolio":"putrama","date_start":"2026-06-01","date_stop":"2026-06-24"}'

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CLIENTS } from "./config.ts";
import type { ClientConfig } from "./config.ts";

const META_API_BASE = "https://graph.facebook.com/v22.0";
const META_TOKEN    = Deno.env.get("META_ACCESS_TOKEN")!;
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const AD_PERF_FIELDS = [
  "ad_id", "adset_id", "campaign_id", "account_id",
  "date_start", "date_stop",
  "impressions", "reach", "frequency", "clicks", "spend",
  "cpm", "cpc", "ctr", "actions", "action_values",
  "inline_link_clicks",
].join(",");

const ENGAGEMENT_ACTIONS = [
  "post_engagement", "post_reaction", "comment", "post",
  "onsite_conversion.post_save", "video_view",
  "onsite_conversion.messaging_conversation_started_7d",
];

function isoDate(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function apiFetch<T>(path: string, apiCalls: { count: number }): Promise<T | null> {
  try {
    apiCalls.count++;
    const sep = path.includes("?") ? "&" : "?";
    const url = `${META_API_BASE}/${path}${sep}access_token=${META_TOKEN}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || data?.error) {
      console.error(`API error [${path.split("?")[0]}]:`, data?.error?.message ?? "unknown");
      return null;
    }
    return data as T;
  } catch (e) {
    console.error("apiFetch exception:", e);
    return null;
  }
}

async function apiFetchPaginated<T>(path: string, apiCalls: { count: number }): Promise<T[]> {
  const results: T[] = [];
  try {
    const sep = path.includes("?") ? "&" : "?";
    let nextUrl: string | null = `${META_API_BASE}/${path}${sep}access_token=${META_TOKEN}`;
    while (nextUrl) {
      apiCalls.count++;
      const res = await fetch(nextUrl);
      const data = await res.json();
      if (!res.ok || data?.error) {
        console.error("Paginated error:", data?.error?.message ?? "unknown");
        break;
      }
      if (data.data) results.push(...data.data);
      nextUrl = data.paging?.next ?? null;
      if (nextUrl) await new Promise((r) => setTimeout(r, 300));
    }
  } catch (e) {
    console.error("apiFetchPaginated exception:", e);
  }
  return results;
}

function extractAction(actions: Array<{ action_type: string; value: string }> | undefined, type: string): number {
  if (!actions) return 0;
  const found = actions.find((a) => a.action_type === type);
  return found ? parseInt(found.value, 10) || 0 : 0;
}

function extractActionValue(actionValues: Array<{ action_type: string; value: string }> | undefined, type: string): number {
  if (!actionValues) return 0;
  const found = actionValues.find((a) => a.action_type === type);
  return found ? parseFloat(found.value) || 0 : 0;
}

async function syncCampaigns(
  supabase: ReturnType<typeof createClient>,
  client: ClientConfig,
  apiCalls: { count: number },
): Promise<{ campaignIds: string[]; count: number }> {
  const campaignIds: string[] = [];
  let upsertCount = 0;

  for (const accountId of client.ad_accounts) {
    if (!accountId || accountId.startsWith("TODO")) continue;

    const data = await apiFetchPaginated<{
      id: string; name: string; objective: string; status: string;
      daily_budget?: string; account_id: string;
    }>(`${accountId}/campaigns?fields=id,name,objective,status,daily_budget,account_id&limit=100`, apiCalls);

    if (data.length === 0) continue;

    const rows = data.map((c) => ({
      portfolio_slug: client.slug,
      id:             c.id,
      account_id:     c.account_id ?? accountId.replace("act_", ""),
      name:           c.name,
      objective:      c.objective ?? null,
      status:         c.status ?? null,
      daily_budget:   c.daily_budget ? parseInt(c.daily_budget, 10) : null,
      synced_at:      new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("client_campaigns")
      .upsert(rows, { onConflict: "portfolio_slug,id" });

    if (error) {
      console.error(`[${client.slug}] upsert campaigns ${accountId}:`, error.message);
    } else {
      upsertCount += rows.length;
      campaignIds.push(...data.map((c) => c.id));
    }
  }

  return { campaignIds, count: upsertCount };
}

async function syncAdsets(
  supabase: ReturnType<typeof createClient>,
  client: ClientConfig,
  campaignIds: string[],
  apiCalls: { count: number },
): Promise<{ adsetIds: string[]; count: number }> {
  const adsetIds: string[] = [];
  let upsertCount = 0;

  for (const accountId of client.ad_accounts) {
    if (!accountId || accountId.startsWith("TODO")) continue;

    const data = await apiFetchPaginated<{
      id: string; name: string; campaign_id: string; status: string;
      daily_budget?: string; account_id: string;
    }>(`${accountId}/adsets?fields=id,name,campaign_id,status,daily_budget,account_id&limit=100`, apiCalls);

    const filtered = campaignIds.length > 0
      ? data.filter((a) => campaignIds.includes(a.campaign_id))
      : data;

    if (filtered.length === 0) continue;

    const rows = filtered.map((a) => ({
      portfolio_slug: client.slug,
      id:             a.id,
      campaign_id:    a.campaign_id,
      account_id:     a.account_id ?? accountId.replace("act_", ""),
      name:           a.name,
      status:         a.status ?? null,
      daily_budget:   a.daily_budget ? parseInt(a.daily_budget, 10) : null,
      synced_at:      new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("client_adsets")
      .upsert(rows, { onConflict: "portfolio_slug,id" });

    if (error) {
      console.error(`[${client.slug}] upsert adsets ${accountId}:`, error.message);
    } else {
      upsertCount += rows.length;
      adsetIds.push(...filtered.map((a) => a.id));
    }
  }

  return { adsetIds, count: upsertCount };
}

async function syncAds(
  supabase: ReturnType<typeof createClient>,
  client: ClientConfig,
  adsetIds: string[],
  apiCalls: { count: number },
): Promise<{ adIds: string[]; count: number }> {
  const adIds: string[] = [];
  let upsertCount = 0;

  for (const accountId of client.ad_accounts) {
    if (!accountId || accountId.startsWith("TODO")) continue;

    const data = await apiFetchPaginated<{
      id: string; name: string; adset_id: string; campaign_id: string;
      status: string; creative?: { id: string }; account_id: string;
    }>(`${accountId}/ads?fields=id,name,adset_id,campaign_id,status,creative,account_id&limit=100`, apiCalls);

    const filtered = adsetIds.length > 0
      ? data.filter((a) => adsetIds.includes(a.adset_id))
      : data;

    if (filtered.length === 0) continue;

    const rows = filtered.map((a) => ({
      portfolio_slug: client.slug,
      id:             a.id,
      adset_id:       a.adset_id,
      campaign_id:    a.campaign_id,
      account_id:     a.account_id ?? accountId.replace("act_", ""),
      name:           a.name,
      status:         a.status ?? null,
      creative_id:    a.creative?.id ?? null,
      synced_at:      new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("client_ads")
      .upsert(rows, { onConflict: "portfolio_slug,id" });

    if (error) {
      console.error(`[${client.slug}] upsert ads ${accountId}:`, error.message);
    } else {
      upsertCount += rows.length;
      adIds.push(...filtered.map((a) => a.id));
    }
  }

  return { adIds, count: upsertCount };
}

async function syncAdPerformance(
  supabase: ReturnType<typeof createClient>,
  client: ClientConfig,
  dateStart: string,
  dateStop: string,
  apiCalls: { count: number },
): Promise<number> {
  let upsertCount = 0;

  for (const accountId of client.ad_accounts) {
    if (!accountId || accountId.startsWith("TODO")) continue;

    const data = await apiFetchPaginated<{
      ad_id: string; adset_id: string; campaign_id: string; account_id: string;
      date_start: string; date_stop: string;
      impressions?: string; reach?: string; frequency?: string;
      clicks?: string; spend?: string;
      cpm?: string; cpc?: string; ctr?: string;
      inline_link_clicks?: string;
      actions?: Array<{ action_type: string; value: string }>;
      action_values?: Array<{ action_type: string; value: string }>;
    }>(
      `${accountId}/insights?fields=${AD_PERF_FIELDS}&time_increment=1` +
      `&time_range={"since":"${dateStart}","until":"${dateStop}"}` +
      `&level=ad&limit=500`,
      apiCalls,
    );

    if (data.length === 0) continue;

    const rows = data.map((row) => {
      const actions       = row.actions ?? [];
      const actionValues  = row.action_values ?? [];
      const leads         = extractAction(actions, "lead") + extractAction(actions, "onsite_conversion.lead_grouped");
      const purchases     = extractAction(actions, "purchase");
      const purchaseValue = extractActionValue(actionValues, "purchase");
      const results       = leads > 0 ? leads : purchases > 0 ? purchases : extractAction(actions, "post_engagement");
      const spend         = parseFloat(row.spend ?? "0");
      const costPerResult = results > 0 && spend > 0 ? spend / results : null;
      const roas          = purchaseValue > 0 && spend > 0 ? purchaseValue / spend : null;

      return {
        portfolio_slug:          client.slug,
        ad_id:                   row.ad_id,
        adset_id:                row.adset_id,
        campaign_id:             row.campaign_id,
        account_id:              row.account_id,
        date_start:              row.date_start,
        date_stop:               row.date_stop,
        impressions:             parseInt(row.impressions ?? "0", 10),
        reach:                   parseInt(row.reach ?? "0", 10),
        frequency:               row.frequency ? parseFloat(row.frequency) : null,
        clicks:                  parseInt(row.clicks ?? "0", 10),
        link_clicks:             parseInt(row.inline_link_clicks ?? "0", 10),
        spend,
        cpm:                     row.cpm ? parseFloat(row.cpm) : null,
        cpc:                     row.cpc ? parseFloat(row.cpc) : null,
        ctr:                     row.ctr ? parseFloat(row.ctr) : null,
        results,
        cost_per_result:         costPerResult,
        leads,
        purchases,
        purchase_value:          purchaseValue,
        roas,
        messaging_conversations: extractAction(actions, "onsite_conversion.messaging_conversation_started_7d"),
        post_engagement:         extractAction(actions, "post_engagement"),
        post_reactions:          extractAction(actions, "post_reaction"),
        post_comments:           extractAction(actions, "comment"),
        post_shares:             extractAction(actions, "post"),
        post_saves:              extractAction(actions, "onsite_conversion.post_save"),
        video_views:             extractAction(actions, "video_view"),
        synced_at:               new Date().toISOString(),
      };
    });

    // Batch upsert 200 rows per request
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { error } = await supabase
        .from("client_ad_performance")
        .upsert(batch, { onConflict: "portfolio_slug,ad_id,date_start" });
      if (error) {
        console.error(`[${client.slug}] upsert ad_performance ${accountId} batch ${i}:`, error.message);
      } else {
        upsertCount += batch.length;
      }
    }
  }

  return upsertCount;
}

const AUDIENCE_BREAKDOWN_CONFIGS = [
  {
    type: "age,gender",
    fields: "impressions,reach,clicks,spend,ctr,date_start,date_stop",
    toKeys: (row: Record<string, unknown>) => ({
      age: (row.age as string) ?? null,
      gender: (row.gender as string) ?? null,
      region: null,
      device_platform: null,
      impression_device: null,
      publisher_platform: null,
      placement: null,
    }),
  },
  {
    type: "region",
    fields: "impressions,reach,clicks,spend,ctr,date_start,date_stop",
    toKeys: (row: Record<string, unknown>) => ({
      age: null,
      gender: null,
      region: (row.region as string) ?? null,
      device_platform: null,
      impression_device: null,
      publisher_platform: null,
      placement: null,
    }),
  },
  {
    type: "publisher_platform,impression_device",
    fields: "impressions,reach,clicks,spend,ctr,date_start,date_stop",
    toKeys: (row: Record<string, unknown>) => ({
      age: null,
      gender: null,
      region: null,
      device_platform: null,
      impression_device: (row.impression_device as string) ?? null,
      publisher_platform: (row.publisher_platform as string) ?? null,
      placement: (row.platform_position as string) ?? null,
    }),
  },
];

async function syncAudienceInsights(
  supabase: ReturnType<typeof createClient>,
  client: ClientConfig,
  dateStart: string,
  dateStop: string,
  apiCalls: { count: number },
): Promise<number> {
  let upsertCount = 0;

  for (const accountId of client.ad_accounts) {
    if (!accountId || accountId.startsWith("TODO")) continue;
    const rawAccountId = accountId.replace("act_", "");

    for (const breakdown of AUDIENCE_BREAKDOWN_CONFIGS) {
      const data = await apiFetchPaginated<Record<string, unknown>>(
        `${accountId}/insights?fields=${breakdown.fields}` +
        `&breakdowns=${breakdown.type}` +
        `&time_increment=1` +
        `&time_range={"since":"${dateStart}","until":"${dateStop}"}` +
        `&level=account&limit=500`,
        apiCalls,
      );

      if (data.length === 0) continue;

      const rows = data.map((row) => ({
        portfolio_slug:          client.slug,
        campaign_id:             rawAccountId,
        account_id:              rawAccountId,
        date_start:              row.date_start as string,
        date_stop:               row.date_stop as string,
        breakdown_type:          breakdown.type,
        ...breakdown.toKeys(row),
        impressions:             parseInt((row.impressions as string) ?? "0", 10),
        reach:                   parseInt((row.reach as string) ?? "0", 10),
        clicks:                  parseInt((row.clicks as string) ?? "0", 10),
        spend:                   parseFloat((row.spend as string) ?? "0"),
        ctr:                     row.ctr ? parseFloat(row.ctr as string) : null,
        messaging_conversations: 0,
        synced_at:               new Date().toISOString(),
      }));

      for (let i = 0; i < rows.length; i += 200) {
        const batch = rows.slice(i, i + 200);
        const { error } = await supabase
          .from("client_audience_insights")
          .upsert(batch, {
            onConflict: "portfolio_slug,account_id,date_start,breakdown_type,age,gender,region,device_platform,impression_device,publisher_platform,placement",
          });
        if (error) {
          console.error(`[${client.slug}] upsert audience ${accountId} ${breakdown.type}:`, error.message);
        } else {
          upsertCount += batch.length;
        }
      }
    }
  }

  return upsertCount;
}

async function syncPortfolio(
  supabase: ReturnType<typeof createClient>,
  client: ClientConfig,
  dateStart: string,
  dateStop: string,
): Promise<{ success: boolean; records: number; apiCalls: number; error?: string }> {
  const startedAt = Date.now();
  const apiCalls  = { count: 0 };
  let totalRecords = 0;

  // Catat sync dimulai
  const { data: logRow } = await supabase
    .from("client_sync_log")
    .insert({
      portfolio_slug: client.slug,
      function_name:  "fetch-meta-clients",
      status:         "running",
      started_at:     new Date().toISOString(),
    })
    .select("id")
    .single();
  const logId = logRow?.id;

  try {
    console.log(`[${client.slug}] Mulai sync (${dateStart} - ${dateStop})`);

    // Skip portfolio yang belum dikonfigurasi
    const configuredAccounts = client.ad_accounts.filter((a) => a && !a.startsWith("TODO"));
    if (configuredAccounts.length === 0) {
      console.log(`[${client.slug}] Tidak ada ad account — skip`);
      if (logId) {
        await supabase.from("client_sync_log").update({
          status: "skipped", finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt, records_upserted: 0, meta_api_calls: 0,
        }).eq("id", logId);
      }
      return { success: true, records: 0, apiCalls: 0 };
    }

    const { campaignIds, count: c1 } = await syncCampaigns(supabase, client, apiCalls);
    totalRecords += c1;
    console.log(`[${client.slug}] Campaigns: ${c1}`);

    const { adsetIds, count: c2 } = await syncAdsets(supabase, client, campaignIds, apiCalls);
    totalRecords += c2;
    console.log(`[${client.slug}] Adsets: ${c2}`);

    const { count: c3 } = await syncAds(supabase, client, adsetIds, apiCalls);
    totalRecords += c3;
    console.log(`[${client.slug}] Ads: ${c3}`);

    const c4 = await syncAdPerformance(supabase, client, dateStart, dateStop, apiCalls);
    totalRecords += c4;
    console.log(`[${client.slug}] AdPerformance: ${c4}`);

    const c5 = await syncAudienceInsights(supabase, client, dateStart, dateStop, apiCalls);
    totalRecords += c5;
    console.log(`[${client.slug}] AudienceInsights: ${c5}`);

    if (logId) {
      await supabase.from("client_sync_log").update({
        status: "success", finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt, records_upserted: totalRecords,
        meta_api_calls: apiCalls.count,
      }).eq("id", logId);
    }

    return { success: true, records: totalRecords, apiCalls: apiCalls.count };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[${client.slug}] Error:`, msg);

    if (logId) {
      await supabase.from("client_sync_log").update({
        status: "error", error_message: msg, finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt, records_upserted: totalRecords,
        meta_api_calls: apiCalls.count,
      }).eq("id", logId);
    }

    return { success: false, records: totalRecords, apiCalls: apiCalls.count, error: msg };
  }
}

Deno.serve(async (req: Request) => {
  let body: { date_start?: string; date_stop?: string; portfolio?: string } = {};
  try { body = await req.json(); } catch { /* pakai default */ }

  const dateStart = body.date_start ?? isoDate(-90);
  const dateStop  = body.date_stop  ?? isoDate(0);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const targets = body.portfolio
    ? CLIENTS.filter((c) => c.slug === body.portfolio)
    : CLIENTS;

  if (targets.length === 0) {
    return new Response(
      JSON.stringify({ error: `Portfolio '${body.portfolio}' tidak ditemukan` }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const results: Record<string, unknown> = {};

  for (const client of targets) {
    results[client.slug] = await syncPortfolio(supabase, client, dateStart, dateStop);
  }

  return new Response(
    JSON.stringify({ date_start: dateStart, date_stop: dateStop, results }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

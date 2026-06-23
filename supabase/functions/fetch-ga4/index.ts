import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROPERTY_ID  = Deno.env.get("GA4_PROPERTY_ID")!;
const SA_EMAIL     = Deno.env.get("GA4_SERVICE_ACCOUNT_EMAIL")!;
const SA_PRIVKEY   = (Deno.env.get("GA4_SERVICE_ACCOUNT_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SC_SITE_URL  = Deno.env.get("SEARCH_CONSOLE_SITE_URL") ?? "https://magentaindopack.com/";

type ReportType = "traffic" | "demographics" | "platform" | "landing_pages" | "pages" | "geography" | "search_terms" | "search_console" | "all";

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getToken(scope = "https://www.googleapis.com/auth/analytics.readonly"): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: SA_EMAIL, scope,
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }));
  const pemBody = SA_PRIVKEY.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("pkcs8", binaryKey.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sigBytes = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(`${header}.${payload}`));
  const sig = b64url(String.fromCharCode(...new Uint8Array(sigBytes)));
  const jwt = `${header}.${payload}.${sig}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await res.json() as { access_token?: string };
  if (!data.access_token) throw new Error(`SA token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function runReport(token: string, body: object): Promise<{ rows?: Array<{ dimensionValues: Array<{ value: string }>; metricValues: Array<{ value: string }> }> }> {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GA4 API error ${res.status}: ${await res.text()}`);
  return res.json();
}

function isoDate(offsetDays: number): string {
  const d = new Date(); d.setDate(d.getDate() + offsetDays); return d.toISOString().slice(0, 10);
}
function ga4Date(raw: string): string { return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`; }
function safeId(...parts: string[]): string { return parts.join("_").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 255); }

async function upsertBatch<T extends Record<string, unknown>>(
  supabase: ReturnType<typeof createClient>, table: string, rows: T[], conflict: string
): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: conflict });
    if (error) throw new Error(`Upsert ${table}: ${error.message}`);
    total += batch.length;
  }
  return total;
}

// ── TRAFFIC ──────────────────────────────────────────────────────────────────
async function syncTraffic(token: string, supabase: ReturnType<typeof createClient>, dateStart: string, dateStop: string) {
  const report = await runReport(token, {
    dateRanges: [{ startDate: dateStart, endDate: dateStop }],
    dimensions: [{ name: "date" }, { name: "sessionSource" }, { name: "sessionMedium" }],
    metrics: [
      { name: "sessions" }, { name: "totalUsers" }, { name: "newUsers" },
      { name: "bounceRate" }, { name: "engagementRate" }, { name: "averageSessionDuration" }, { name: "conversions" },
    ],
    limit: 10000,
  });
  const rows = (report.rows ?? []).map((row) => {
    const [rawDate, source, medium] = row.dimensionValues.map((d) => d.value);
    const [sessions, users, newUsers, bounceRate, engagementRate, avgDuration, conversions] = row.metricValues.map((m) => m.value);
    const date = ga4Date(rawDate);
    return {
      id: safeId(date, source, medium),
      property_id: PROPERTY_ID, date,
      source: source || "(direct)", medium: medium || "(none)",
      sessions: parseInt(sessions) || 0, users: parseInt(users) || 0, new_users: parseInt(newUsers) || 0,
      bounce_rate: parseFloat(bounceRate) || 0, engagement_rate: parseFloat(engagementRate) || 0,
      avg_session_duration: parseFloat(avgDuration) || 0, conversions: parseInt(conversions) || 0,
      synced_at: new Date().toISOString(),
    };
  });
  return upsertBatch(supabase, "ga4_website_daily", rows, "date,source,medium");
}

// ── DEMOGRAPHICS ──────────────────────────────────────────────────────────────
async function syncDemographics(token: string, supabase: ReturnType<typeof createClient>, dateStart: string, dateStop: string) {
  const report = await runReport(token, {
    dateRanges: [{ startDate: dateStart, endDate: dateStop }],
    dimensions: [{ name: "date" }, { name: "userAgeBracket" }, { name: "userGender" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "newUsers" }, { name: "conversions" }],
    limit: 10000,
  });
  const rows = (report.rows ?? []).map((row) => {
    const [rawDate, ageGroup, gender] = row.dimensionValues.map((d) => d.value);
    const [sessions, users, newUsers, conversions] = row.metricValues.map((m) => m.value);
    const date = ga4Date(rawDate);
    return {
      id: safeId(date, ageGroup, gender),
      property_id: PROPERTY_ID, date,
      age_group: ageGroup || "(not set)", gender: gender || "(not set)",
      sessions: parseInt(sessions) || 0, users: parseInt(users) || 0,
      new_users: parseInt(newUsers) || 0, conversions: parseInt(conversions) || 0,
      synced_at: new Date().toISOString(),
    };
  });
  return upsertBatch(supabase, "ga4_demographics", rows, "date,age_group,gender");
}

// ── PLATFORM ──────────────────────────────────────────────────────────────────
async function syncPlatform(token: string, supabase: ReturnType<typeof createClient>, dateStart: string, dateStop: string) {
  const report = await runReport(token, {
    dateRanges: [{ startDate: dateStart, endDate: dateStop }],
    dimensions: [{ name: "date" }, { name: "deviceCategory" }, { name: "operatingSystem" }, { name: "browser" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "conversions" }],
    limit: 10000,
  });
  const rows = (report.rows ?? []).map((row) => {
    const [rawDate, device, os, browser] = row.dimensionValues.map((d) => d.value);
    const [sessions, users, conversions] = row.metricValues.map((m) => m.value);
    const date = ga4Date(rawDate);
    return {
      id: safeId(date, device, os, browser),
      property_id: PROPERTY_ID, date,
      device_category: device || "(not set)", operating_system: os || "(not set)", browser: browser || "(not set)",
      sessions: parseInt(sessions) || 0, users: parseInt(users) || 0, conversions: parseInt(conversions) || 0,
      synced_at: new Date().toISOString(),
    };
  });
  return upsertBatch(supabase, "ga4_platform", rows, "date,device_category,operating_system,browser");
}

// ── LANDING PAGES ─────────────────────────────────────────────────────────────
async function syncLandingPages(token: string, supabase: ReturnType<typeof createClient>, dateStart: string, dateStop: string) {
  const report = await runReport(token, {
    dateRanges: [{ startDate: dateStart, endDate: dateStop }],
    dimensions: [{ name: "date" }, { name: "landingPage" }],
    metrics: [
      { name: "sessions" }, { name: "totalUsers" }, { name: "bounceRate" },
      { name: "engagementRate" }, { name: "averageSessionDuration" }, { name: "conversions" },
    ],
    limit: 10000,
  });
  const rows = (report.rows ?? []).map((row) => {
    const [rawDate, landingPage] = row.dimensionValues.map((d) => d.value);
    const [sessions, users, bounceRate, engagementRate, avgDuration, conversions] = row.metricValues.map((m) => m.value);
    const date = ga4Date(rawDate);
    return {
      id: safeId(date, landingPage),
      property_id: PROPERTY_ID, date,
      landing_page: (landingPage || "(not set)").slice(0, 500),
      sessions: parseInt(sessions) || 0, users: parseInt(users) || 0,
      bounce_rate: parseFloat(bounceRate) || 0, engagement_rate: parseFloat(engagementRate) || 0,
      avg_session_duration: parseFloat(avgDuration) || 0, conversions: parseInt(conversions) || 0,
      synced_at: new Date().toISOString(),
    };
  });
  return upsertBatch(supabase, "ga4_landing_pages", rows, "date,landing_page");
}

// ── PAGES ─────────────────────────────────────────────────────────────────────
async function syncPages(token: string, supabase: ReturnType<typeof createClient>, dateStart: string, dateStop: string) {
  const report = await runReport(token, {
    dateRanges: [{ startDate: dateStart, endDate: dateStop }],
    dimensions: [{ name: "date" }, { name: "pagePath" }, { name: "pageTitle" }],
    metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }, { name: "userEngagementDuration" }],
    limit: 10000,
  });
  // Aggregate by date+pagePath (multiple titles for same path → sum)
  const agg = new Map<string, Record<string, unknown>>();
  for (const row of report.rows ?? []) {
    const [rawDate, pagePath, pageTitle] = row.dimensionValues.map((d) => d.value);
    const [views, users, duration] = row.metricValues.map((m) => m.value);
    const date = ga4Date(rawDate);
    const key = safeId(date, pagePath);
    const existing = agg.get(key);
    if (existing) {
      (existing.screen_page_views as number) += parseInt(views) || 0;
      (existing.users as number) += parseInt(users) || 0;
      (existing.engagement_duration as number) += parseFloat(duration) || 0;
    } else {
      agg.set(key, {
        id: key, property_id: PROPERTY_ID, date,
        page_path: (pagePath || "(not set)").slice(0, 500),
        page_title: (pageTitle || "(not set)").slice(0, 300),
        screen_page_views: parseInt(views) || 0, users: parseInt(users) || 0,
        engagement_duration: parseFloat(duration) || 0,
        synced_at: new Date().toISOString(),
      });
    }
  }
  return upsertBatch(supabase, "ga4_pages", [...agg.values()], "date,page_path");
}

// ── GEOGRAPHY ─────────────────────────────────────────────────────────────────
async function syncGeography(token: string, supabase: ReturnType<typeof createClient>, dateStart: string, dateStop: string) {
  const report = await runReport(token, {
    dateRanges: [{ startDate: dateStart, endDate: dateStop }],
    dimensions: [{ name: "date" }, { name: "country" }, { name: "city" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "newUsers" }, { name: "conversions" }],
    limit: 10000,
  });
  const rows = (report.rows ?? []).map((row) => {
    const [rawDate, country, city] = row.dimensionValues.map((d) => d.value);
    const [sessions, users, newUsers, conversions] = row.metricValues.map((m) => m.value);
    const date = ga4Date(rawDate);
    return {
      id: safeId(date, country, city),
      property_id: PROPERTY_ID, date,
      country: country || "(not set)", city: city || "(not set)",
      sessions: parseInt(sessions) || 0, users: parseInt(users) || 0,
      new_users: parseInt(newUsers) || 0, conversions: parseInt(conversions) || 0,
      synced_at: new Date().toISOString(),
    };
  });
  return upsertBatch(supabase, "ga4_geography", rows, "date,country,city");
}

// ── SEARCH TERMS ──────────────────────────────────────────────────────────────
async function syncSearchTerms(token: string, supabase: ReturnType<typeof createClient>, dateStart: string, dateStop: string) {
  const report = await runReport(token, {
    dateRanges: [{ startDate: dateStart, endDate: dateStop }],
    dimensions: [{ name: "date" }, { name: "searchTerm" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "conversions" }],
    limit: 10000,
  });
  const rows = (report.rows ?? []).map((row) => {
    const [rawDate, searchTerm] = row.dimensionValues.map((d) => d.value);
    const [sessions, users, conversions] = row.metricValues.map((m) => m.value);
    const date = ga4Date(rawDate);
    return {
      id: safeId(date, searchTerm),
      property_id: PROPERTY_ID, date,
      search_term: (searchTerm || "(not set)").slice(0, 500),
      sessions: parseInt(sessions) || 0, users: parseInt(users) || 0, conversions: parseInt(conversions) || 0,
      synced_at: new Date().toISOString(),
    };
  });
  return upsertBatch(supabase, "ga4_search_terms", rows, "date,search_term");
}

// ── SEARCH CONSOLE (kueri organik Google via Search Console API) ───────────────
async function syncSearchConsole(supabase: ReturnType<typeof createClient>, dateStart: string, dateStop: string) {
  // Search Console API memerlukan scope webmasters.readonly
  const scToken = await getToken("https://www.googleapis.com/auth/webmasters.readonly");

  type ScRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };
  type ScResponse = { rows?: ScRow[] };

  const allRows: Record<string, unknown>[] = [];
  let startRow = 0;
  const rowLimit = 5000;

  while (true) {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SC_SITE_URL)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${scToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: dateStart,
          endDate: dateStop,
          dimensions: ["date", "query"],
          rowLimit,
          startRow,
        }),
      }
    );
    if (!res.ok) throw new Error(`Search Console API error ${res.status}: ${await res.text()}`);
    const data = await res.json() as ScResponse;
    const batch = data.rows ?? [];
    for (const row of batch) {
      const [date, query] = row.keys;
      allRows.push({
        id: safeId(date, query),
        property_id: PROPERTY_ID,
        date,
        query: (query || "(not set)").slice(0, 500),
        clicks:      Math.round(row.clicks)      || 0,
        impressions: Math.round(row.impressions) || 0,
        ctr:         row.ctr      || 0,
        position:    row.position || 0,
        synced_at: new Date().toISOString(),
      });
    }
    if (batch.length < rowLimit) break;
    startRow += rowLimit;
  }

  // Deduplikasi berdasarkan id sebelum upsert
  const deduped = new Map<string, Record<string, unknown>>();
  for (const row of allRows) deduped.set(row.id as string, row);

  return upsertBatch(supabase, "ga4_search_console", [...deduped.values()], "date,query");
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    let body: { date_start?: string; date_stop?: string; report_type?: ReportType; list_sc_sites?: boolean } = {};
    try { body = await req.json(); } catch { /* use defaults */ }

    // Mode khusus: list semua Search Console sites yang bisa diakses service account
    if (body.list_sc_sites) {
      const scToken = await getToken("https://www.googleapis.com/auth/webmasters.readonly");
      const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
        headers: { "Authorization": `Bearer ${scToken}` },
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    }

    const dateStart   = body.date_start   ?? isoDate(-29);
    const dateStop    = body.date_stop    ?? isoDate(0);
    const reportType  = body.report_type  ?? "traffic";

    console.log(`fetch-ga4 [${reportType}]: ${dateStart} → ${dateStop}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const token    = await getToken();

    const results: Record<string, number> = {};

    const run = async (type: Exclude<ReportType, "all">) => {
      try {
        switch (type) {
          case "traffic":       results.traffic       = await syncTraffic(token, supabase, dateStart, dateStop); break;
          case "demographics":  results.demographics  = await syncDemographics(token, supabase, dateStart, dateStop); break;
          case "platform":      results.platform      = await syncPlatform(token, supabase, dateStart, dateStop); break;
          case "landing_pages": results.landing_pages = await syncLandingPages(token, supabase, dateStart, dateStop); break;
          case "pages":         results.pages         = await syncPages(token, supabase, dateStart, dateStop); break;
          case "geography":     results.geography     = await syncGeography(token, supabase, dateStart, dateStop); break;
          case "search_terms":    results.search_terms    = await syncSearchTerms(token, supabase, dateStart, dateStop); break;
          case "search_console":  results.search_console  = await syncSearchConsole(supabase, dateStart, dateStop); break;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results[`${type}_error`] = msg;
        console.error(`Error syncing ${type}:`, msg);
      }
    };

    if (reportType === "all") {
      for (const t of ["traffic","demographics","platform","landing_pages","pages","geography","search_terms","search_console"] as const) {
        await run(t);
      }
    } else {
      await run(reportType);
    }

    return new Response(JSON.stringify({ ok: true, ...results }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("fetch-ga4 error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

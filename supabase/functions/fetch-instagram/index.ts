// supabase/functions/fetch-instagram/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_API_BASE = "https://graph.facebook.com/v22.0";
const META_TOKEN    = Deno.env.get("META_ACCESS_TOKEN")!;
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const IG_ACCOUNTS = [
  { id: "17841457712254566", business_id: "924702955331274", name: "Magenta Indopack" },
  { id: "17841402922059062", business_id: "561995191381892", name: "Putrama Packaging" },
];

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
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
    console.error(`API fetch exception:`, e);
    return null;
  }
}

async function apiFetchPaginated<T>(path: string): Promise<T[]> {
  const results: T[] = [];
  try {
    const sep = path.includes("?") ? "&" : "?";
    let nextUrl: string | null = `${META_API_BASE}/${path}${sep}access_token=${META_TOKEN}`;
    while (nextUrl) {
      const res = await fetch(nextUrl);
      const data = await res.json();
      if (!res.ok || data?.error) {
        console.error(`Paginated error:`, data?.error?.message ?? "unknown");
        break;
      }
      if (data.data) results.push(...data.data);
      nextUrl = data.paging?.next ?? null;
      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (e) {
    console.error(`Paginated fetch exception:`, e);
  }
  return results;
}

async function syncAccountInfo(
  supabase: ReturnType<typeof createClient>,
  account: typeof IG_ACCOUNTS[number],
): Promise<boolean> {
  try {
    const data = await apiFetch<{
      id: string; name: string; username: string;
      followers_count: number; media_count: number;
    }>(`${account.id}?fields=id,name,username,followers_count,media_count`);

    if (!data) return false;

    const { error } = await supabase.from("ig_accounts").upsert({
      id: data.id, business_id: account.business_id,
      name: data.name ?? account.name, username: data.username ?? null,
      followers_count: data.followers_count ?? 0, media_count: data.media_count ?? 0,
      synced_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (error) console.error("upsert ig_accounts:", error.message);
    return !error;
  } catch (e) {
    console.error("syncAccountInfo exception:", e);
    return false;
  }
}

async function syncMedia(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
): Promise<{ id: string; media_product_type: string }[]> {
  const synced: { id: string; media_product_type: string }[] = [];

  try {
    const media = await apiFetchPaginated<{
      id: string; media_type: string; media_product_type: string;
      caption?: string; permalink?: string; timestamp: string;
      thumbnail_url?: string; like_count?: number; comments_count?: number;
    }>(`${accountId}/media?fields=id,media_type,media_product_type,caption,permalink,timestamp,thumbnail_url,like_count,comments_count&limit=100`);

    if (media.length > 0) {
      await supabase.from("ig_media").upsert(
        media.map((m) => ({
          id: m.id, ig_account_id: accountId,
          media_type: m.media_type ?? "IMAGE",
          media_product_type: m.media_product_type ?? "FEED",
          caption: m.caption ?? null, permalink: m.permalink ?? null,
          timestamp: m.timestamp, thumbnail_url: m.thumbnail_url ?? null,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: "id", ignoreDuplicates: false },
      );

      await supabase.from("ig_media_insights").upsert(
        media.map((m) => ({
          media_id: m.id, ig_account_id: accountId,
          likes: m.like_count ?? 0, comments: m.comments_count ?? 0,
          shares: 0, saved: 0, reach: 0, impressions: 0,
          video_views: 0, plays: 0, exits: 0, replies: 0,
          taps_forward: 0, taps_back: 0, profile_visits: 0, follows: 0,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: "media_id", ignoreDuplicates: false },
      );

      synced.push(...media.map((m) => ({ id: m.id, media_product_type: m.media_product_type ?? "FEED" })));
    }
  } catch (e) {
    console.error("syncMedia exception:", e);
  }

  // Stories — bisa gagal, tidak masalah
  try {
    const stories = await apiFetchPaginated<{
      id: string; media_type: string; timestamp: string; permalink?: string;
    }>(`${accountId}/stories?fields=id,media_type,timestamp,permalink&limit=100`);

    if (stories.length > 0) {
      await supabase.from("ig_media").upsert(
        stories.map((s) => ({
          id: s.id, ig_account_id: accountId,
          media_type: s.media_type ?? "IMAGE", media_product_type: "STORY",
          caption: null, permalink: s.permalink ?? null,
          timestamp: s.timestamp, thumbnail_url: null,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: "id", ignoreDuplicates: false },
      );
      synced.push(...stories.map((s) => ({ id: s.id, media_product_type: "STORY" })));
    }
  } catch (e) {
    console.error("syncMedia stories exception:", e);
  }

  return synced;
}

async function syncMediaInsights(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  mediaId: string,
  mediaProductType: string,
): Promise<void> {
  try {
    let metrics: string;
    if (mediaProductType === "STORY") {
      metrics = "exits,reach,replies,taps_forward,taps_back";
    } else if (mediaProductType === "REELS") {
      metrics = "comments,likes,reach,saved,shares,total_interactions";
    } else {
      metrics = "comments,likes,reach,saved,shares";
    }

    const data = await apiFetch<{
      data: Array<{ name: string; values?: Array<{ value: number }>; value?: number }>;
    }>(`${mediaId}/insights?metric=${metrics}`);

    if (!data?.data || !Array.isArray(data.data)) return;

    const getValue = (name: string): number => {
      const item = data.data.find((d) => d.name === name);
      if (!item) return 0;
      if (typeof item.value === "number") return item.value;
      if (Array.isArray(item.values) && item.values.length > 0) return item.values[0]?.value ?? 0;
      return 0;
    };

    await supabase.from("ig_media_insights").upsert({
      media_id: mediaId, ig_account_id: accountId,
      likes: getValue("likes"), comments: getValue("comments"),
      shares: getValue("shares"), saved: getValue("saved"),
      reach: getValue("reach"), impressions: 0, video_views: 0, plays: 0,
      exits: getValue("exits"), replies: getValue("replies"),
      taps_forward: getValue("taps_forward"), taps_back: getValue("taps_back"),
      profile_visits: 0, follows: 0,
      synced_at: new Date().toISOString(),
    }, { onConflict: "media_id", ignoreDuplicates: false });
  } catch (e) {
    console.error(`syncMediaInsights exception ${mediaId}:`, e);
  }
}

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  let totalRecords = 0;
  const results: Record<string, { success: boolean; media: number; error?: string }> = {};

  for (const account of IG_ACCOUNTS) {
    console.log(`Syncing ${account.name}...`);

    try {
      const ok = await syncAccountInfo(supabase, account);
      if (!ok) {
        results[account.name] = { success: false, media: 0, error: "Cannot access account" };
        continue;
      }

      const synced = await syncMedia(supabase, account.id);
      totalRecords += synced.length;

      // Insight per media untuk 50 terbaru
      const { data: recentMedia } = await supabase
        .from("ig_media")
        .select("id,media_product_type")
        .eq("ig_account_id", account.id)
        .order("timestamp", { ascending: false })
        .limit(50);

      for (const media of recentMedia ?? []) {
        await syncMediaInsights(supabase, account.id, media.id, media.media_product_type ?? "FEED");
        await new Promise((r) => setTimeout(r, 200));
      }
      totalRecords += (recentMedia ?? []).length;

      results[account.name] = { success: true, media: synced.length };
    } catch (e) {
      console.error(`Account ${account.name} exception:`, e);
      results[account.name] = { success: false, media: 0, error: String(e) };
    }
  }

  // ── Sync account-level daily insights (@magentaindopack saja) ──────────
  async function syncAccountInsights(igAccountId: string): Promise<void> {
    // Meta API batasi max 30 hari per request — query 3 chunk x 28 hari (total ~84 hari)
    // Hanya metric yang mendukung time series (values array) di v22.0
    // profile_views/views/website_clicks hanya tersedia sebagai total_value aggregate
    const CHUNK_DAYS = 28;
    const NUM_CHUNKS = 3;
    const nowSec = Math.floor(Date.now() / 1000);

    const byDate: Record<string, Record<string, number>> = {};

    for (let i = 0; i < NUM_CHUNKS; i++) {
      const chunkUntil = nowSec - i * CHUNK_DAYS * 86400;
      const chunkSince = chunkUntil - CHUNK_DAYS * 86400;

      // follower_count hanya tersedia 30 hari terakhir — chunk 0 saja
      const metric = i === 0 ? "reach,follower_count" : "reach";
      const data = await apiFetchPaginated<{
        name: string;
        values: Array<{ value: number; end_time: string }>;
      }>(`${igAccountId}/insights?metric=${metric}&period=day&since=${chunkSince}&until=${chunkUntil}`);
      console.log(`Account insights chunk ${i} count for ${igAccountId}: ${data.length}`);

      for (const metric of data) {
        for (const v of (metric.values ?? [])) {
          const date = v.end_time.slice(0, 10);
          if (!byDate[date]) byDate[date] = {};
          byDate[date][metric.name] = v.value ?? 0;
        }
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    const rows = Object.entries(byDate).map(([date, vals]) => ({
      ig_account_id:   igAccountId,
      date,
      impressions:     0,
      reach:           vals.reach           ?? 0,
      profile_views:   0,
      website_clicks:  0,
      followers_count: vals.follower_count  ?? 0,
      likes_count:     0,
      comments_count:  0,
      shares_count:    0,
      saves_count:     0,
    }));

    if (rows.length === 0) {
      console.log(`No account insight data for ${igAccountId}`);
      return;
    }
    const { error } = await supabase
      .from("ig_account_insights")
      .upsert(rows, { onConflict: "ig_account_id,date" });
    if (error) console.error("upsert ig_account_insights:", error.message);
    else console.log(`Upserted ${rows.length} account insight rows for ${igAccountId}`);
  }

  await syncAccountInsights("17841457712254566"); // @magentaindopack


  return new Response(
    JSON.stringify({ status: "success", total_records: totalRecords, accounts: results }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
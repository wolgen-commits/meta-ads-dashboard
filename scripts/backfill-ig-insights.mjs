// Backfill ig_account_insights dari API Meta
// Upsert safe — tidak akan duplikat karena UNIQUE(ig_account_id, date)
// Jalankan: node scripts/backfill-ig-insights.mjs

const TOKEN        = process.env.META_ACCESS_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IG_ID        = "17841457712254566"; // @magentaindopack

if (!TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set META_ACCESS_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchChunk(since, until) {
  // follower_count hanya tersedia 30 hari terakhir — pakai reach saja untuk historis
  const url = `https://graph.facebook.com/v22.0/${IG_ID}/insights?metric=reach&period=day&since=${since}&until=${until}&access_token=${TOKEN}`;
  const res  = await fetch(url);
  const json = await res.json();
  if (json.error) {
    console.warn(`  API error: ${json.error.message}`);
    return [];
  }
  return json.data ?? [];
}

async function upsertRows(rows) {
  if (rows.length === 0) return;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/ig_account_insights?on_conflict=ig_account_id,date`,
    {
      method: "POST",
      headers: {
        "apikey":        SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type":  "application/json",
        "Prefer":        "resolution=merge-duplicates",
      },
      body: JSON.stringify(rows),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    console.error(`  Supabase upsert error: ${err}`);
  } else {
    console.log(`  Upserted ${rows.length} rows`);
  }
}

async function backfill() {
  // Mulai dari Jan 2025, sampai hari ini, chunk 28 hari
  const START_DATE = new Date("2025-01-01T00:00:00Z");
  const END_DATE   = new Date();
  const CHUNK_DAYS = 28;

  let cursor = new Date(START_DATE);
  let totalRows = 0;

  while (cursor < END_DATE) {
    const since = Math.floor(cursor.getTime() / 1000);
    const nextCursor = new Date(cursor.getTime() + CHUNK_DAYS * 86400 * 1000);
    const until = Math.floor(Math.min(nextCursor.getTime(), END_DATE.getTime()) / 1000);

    const sinceStr = cursor.toISOString().slice(0, 10);
    const untilStr = new Date(until * 1000).toISOString().slice(0, 10);
    console.log(`Fetching ${sinceStr} → ${untilStr} ...`);

    const metrics = await fetchChunk(since, until);

    // Pivot: { date → { reach, follower_count } }
    const byDate = {};
    for (const m of metrics) {
      for (const v of (m.values ?? [])) {
        const date = v.end_time.slice(0, 10);
        if (!byDate[date]) byDate[date] = {};
        byDate[date][m.name] = v.value ?? 0;
      }
    }

    const rows = Object.entries(byDate).map(([date, vals]) => ({
      ig_account_id:   IG_ID,
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

    await upsertRows(rows);
    totalRows += rows.length;

    cursor = nextCursor;
    await sleep(400); // hindari rate limit
  }

  console.log(`\nSelesai! Total: ${totalRows} baris di-upsert.`);
}

backfill().catch(console.error);

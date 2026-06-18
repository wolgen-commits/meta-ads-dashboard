// Backfill ig_media_insights untuk semua post FEED/REELS yang impressions=0
// Jalankan: node scripts/backfill-ig-media-insights.mjs

const TOKEN        = process.env.META_ACCESS_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IG_ID        = "17841457712254566";

if (!TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set META_ACCESS_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const h = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Ambil semua media FEED/REELS yang impressions masih 0
const zeroRes = await fetch(
  `${SUPABASE_URL}/rest/v1/ig_media_insights?select=media_id&impressions=eq.0&ig_account_id=eq.${IG_ID}&limit=1000`,
  { headers: h }
);
const zeroRows = await zeroRes.json();
const zeroIds  = new Set(zeroRows.map(r => r.media_id));
console.log(`Media dengan impressions=0: ${zeroIds.size}`);

// 2. Ambil detail media (type) untuk filter STORY
const mediaRes = await fetch(
  `${SUPABASE_URL}/rest/v1/ig_media?select=id,media_product_type&ig_account_id=eq.${IG_ID}&limit=1000`,
  { headers: h }
);
const allMedia = await mediaRes.json();
const targets = allMedia.filter(m =>
  zeroIds.has(m.id) && m.media_product_type !== "STORY"
);
console.log(`Target post FEED/REELS yang perlu diisi: ${targets.length}`);

let ok = 0, fail = 0;

for (let i = 0; i < targets.length; i++) {
  const { id, media_product_type } = targets[i];

  // Metric sama dengan syncMediaInsights di Edge Function
  const metrics = media_product_type === "REELS"
    ? "comments,likes,reach,saved,shares,views"
    : "comments,likes,reach,saved,shares,views";

  const apiUrl = `https://graph.facebook.com/v22.0/${id}/insights?metric=${metrics}&access_token=${TOKEN}`;
  const res  = await fetch(apiUrl);
  const json = await res.json();

  if (json.error || !Array.isArray(json.data)) {
    fail++;
    if (i % 50 === 0 || fail <= 3) console.warn(`  [${i+1}] FAIL ${id}: ${json.error?.message ?? "no data"}`);
    await sleep(200);
    continue;
  }

  const getValue = (name) => {
    const item = json.data.find(d => d.name === name);
    if (!item) return 0;
    if (typeof item.value === "number") return item.value;
    if (Array.isArray(item.values) && item.values.length > 0) return item.values[0]?.value ?? 0;
    return 0;
  };

  const row = {
    media_id:      id,
    ig_account_id: IG_ID,
    likes:         getValue("likes"),
    comments:      getValue("comments"),
    shares:        getValue("shares"),
    saved:         getValue("saved"),
    reach:         getValue("reach"),
    impressions:   getValue("views"),
    synced_at:     new Date().toISOString(),
  };

  const upRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ig_media_insights?on_conflict=media_id`,
    {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify(row),
    }
  );

  if (!upRes.ok) {
    const err = await upRes.text();
    console.error(`  [${i+1}] UPSERT FAIL ${id}: ${err}`);
    fail++;
  } else {
    ok++;
    if (i % 50 === 0) console.log(`  [${i+1}/${targets.length}] ok=${ok} fail=${fail}`);
  }

  await sleep(220); // ~4-5 req/sec, aman dari rate limit Meta
}

console.log(`\nSelesai. Berhasil: ${ok}, Gagal: ${fail}`);

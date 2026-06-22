import { NextRequest, NextResponse } from "next/server";

const MAX_DAYS = 29; // Meta API: max 30 hari per request (aman pakai 29)

// Proxy ke Meta API — metric_type=total_value agar cocok dengan Meta Business Suite.
// Jika range > MAX_DAYS, dibagi jadi beberapa chunk dan dijumlah.
// Catatan: reach (jangkauan) tidak bisa di-deduplikasi antar chunk,
//          sehingga untuk periode > 30 hari bisa sedikit lebih tinggi dari Meta Business Suite.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const igAccountId = searchParams.get("igAccountId");
  const dateStart   = searchParams.get("dateStart");
  const dateStop    = searchParams.get("dateStop");

  if (!igAccountId || !dateStart || !dateStop) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "META_ACCESS_TOKEN not set" }, { status: 500 });
  }

  // Bagi rentang jadi chunk-chunk MAX_DAYS hari
  const chunks: Array<{ since: number; until: number }> = [];
  let cursor = new Date(dateStart);
  const end  = new Date(dateStop);

  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + MAX_DAYS - 1);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());

    chunks.push({
      since: Math.floor(cursor.getTime() / 1000),
      until: Math.floor(chunkEnd.getTime() / 1000) + 86400,
    });

    cursor = new Date(chunkEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  const metrics = "impressions,reach,total_interactions,likes,comments,shares,saves";
  const totals: Record<string, number> = {
    impressions: 0, reach: 0, total_interactions: 0,
    likes: 0, comments: 0, shares: 0, saves: 0,
  };

  for (const { since, until } of chunks) {
    const url =
      `https://graph.facebook.com/v22.0/${igAccountId}/insights` +
      `?metric=${metrics}&period=day&metric_type=total_value` +
      `&since=${since}&until=${until}&access_token=${token}`;

    const res  = await fetch(url, { next: { revalidate: 0 } });
    const json = await res.json() as {
      data?: Array<{ name: string; total_value?: { value: number } }>;
      error?: { message: string };
    };

    if (json.error) {
      console.error("[ig-summary] Meta API error:", json.error.message);
      return NextResponse.json({ error: json.error.message }, { status: 502 });
    }

    for (const d of json.data ?? []) {
      const key = d.name as keyof typeof totals;
      if (key in totals) totals[key] += d.total_value?.value ?? 0;
    }

    // Jeda kecil antar chunk agar tidak rate-limit
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 200));
  }

  return NextResponse.json({
    views:             totals.impressions,
    reach:             totals.reach,
    totalInteractions: totals.total_interactions,
    likes:             totals.likes,
    comments:          totals.comments,
    shares:            totals.shares,
    saves:             totals.saves,
  });
}

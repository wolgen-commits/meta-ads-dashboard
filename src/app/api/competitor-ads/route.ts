// app/api/competitor-ads/route.ts
// Next.js App Router — proxy ke Python FastAPI agent

import { NextRequest, NextResponse } from "next/server";

const AGENT_API = (process.env.AGENT_API_URL || "http://localhost:8000").replace(/\/$/, "");

// POST /api/competitor-ads → trigger scraping agent
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { competitor_name, country = "ID", max_ads = 20 } = body;

  if (!competitor_name) {
    return NextResponse.json(
      { error: "competitor_name wajib diisi" },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${AGENT_API}/api/agent/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitor_name, country, max_ads }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    clearTimeout(timeout);
    return NextResponse.json(
      { error: "Agent tidak bisa dihubungi. Pastikan Python server sudah berjalan (uvicorn api_server:app --port 8000)." },
      { status: 503 }
    );
  }
}

// GET /api/competitor-ads?competitor=X&objective=Y&limit=50
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const competitor = searchParams.get("competitor") || "";
  const objective = searchParams.get("objective") || "";
  const limit = searchParams.get("limit") || "50";

  const params = new URLSearchParams({ limit });
  if (competitor) params.append("competitor", competitor);
  if (objective) params.append("objective", objective);

  try {
    const res = await fetch(`${AGENT_API}/api/ads?${params}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Gagal fetch data dari agent" }, { status: 503 });
  }
}

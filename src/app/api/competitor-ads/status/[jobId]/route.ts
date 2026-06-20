import { NextRequest, NextResponse } from "next/server";

const AGENT_API = process.env.AGENT_API_URL || "http://localhost:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  try {
    const res = await fetch(`${AGENT_API}/api/agent/status/${jobId}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Agent tidak bisa dihubungi" },
      { status: 503 }
    );
  }
}

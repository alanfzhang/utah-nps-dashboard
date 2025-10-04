// app/api/nps/alerts/route.ts
import { NextResponse } from "next/server";

const NPS_BASE = "https://developer.nps.gov/api/v1";

export async function GET(req: Request) {
  const key = process.env.NPS_API_KEY;
  if (!key) return NextResponse.json({ error: "Missing NPS key" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const parkCode = searchParams.get("parkCode") ?? "arch,cany,care,zion,brca";
  const limit = searchParams.get("limit") ?? "100";

  const url = `${NPS_BASE}/alerts?parkCode=${parkCode}&limit=${limit}`;
  const r = await fetch(url, { headers: { "X-Api-Key": key }, cache: "no-store" });
  const data = await r.json();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
  });
}
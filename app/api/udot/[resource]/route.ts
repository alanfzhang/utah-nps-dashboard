// app/api/udot/[resource]/route.ts
import { NextResponse } from "next/server";

const UDOT_BASE = "https://www.udottraffic.utah.gov/api/v2/get";

export async function GET(
  req: Request,
  { params }: { params: { resource: string } }
) {
  const key = process.env.UDOT_API_KEY;
  const { resource } = params; // roadconditions | cameras | weatherstations | alerts
  if (!key || !resource) {
    return NextResponse.json({ error: "Missing UDOT key or resource" }, { status: 400 });
  }
  const url = `${UDOT_BASE}/${resource}?key=${encodeURIComponent(key)}&format=json`;
  const r = await fetch(url, { cache: "no-store" });
  const data = await r.json();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
  });
}

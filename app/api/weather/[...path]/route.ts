// app/api/weather/[...path]/route.ts
import type { NextRequest } from "next/server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params; // await Promise-based params
  const incoming = new URL(req.url);

  const upstream = `https://api.open-meteo.com/${(path || []).join("/")}${incoming.search}`;

  const r = await fetch(upstream, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const body = await r.text();
  return new Response(body, {
    status: r.status,
    headers: {
      "content-type": r.headers.get("content-type") || "application/json",
      "cache-control": "no-store",
    },
  });
}

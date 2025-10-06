import type { NextRequest } from "next/server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;

  const base = (process.env.UDOT_API_BASE || "").replace(/\/$/, "");
  const key  = process.env.UDOT_API_KEY || "";
  if (!base || !key) {
    return Response.json(
      { error: "UDOT not configured (set UDOT_API_BASE and UDOT_API_KEY)" },
      { status: 500 }
    );
  }

  const incoming = new URL(req.url);
  const search = new URLSearchParams(incoming.search);

  // UDOT docs: key usually required as a query string param
  if (!search.has("key")) search.set("key", key);

  // Some endpoints like a format hint; harmless if ignored
  if (!search.has("format")) search.set("format", "json");

  const upstream = `${base}/${(path || []).join("/")}?${search.toString()}`;

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

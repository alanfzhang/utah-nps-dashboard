import type { NextRequest } from "next/server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// IMPORTANT: Next's typed routes (your setup) expect Promise-based params here.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params; // <-- await the promise

  const incoming = new URL(req.url);
  const search = new URLSearchParams(incoming.search);

  // Attach NPS key if absent
  if (!search.has("api_key")) {
    const key = process.env.NPS_API_KEY || "";
    if (!key) {
      return Response.json({ error: "Missing NPS_API_KEY on server" }, { status: 500 });
    }
    search.set("api_key", key);
  }

  const upstream = `https://developer.nps.gov/api/v1/${(path || []).join("/")}?${search.toString()}`;

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

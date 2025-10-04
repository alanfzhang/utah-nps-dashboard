import type { NextRequest } from "next/server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// IMPORTANT: Promise-based params to satisfy Next's validator.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params; // <-- await the promise

  const base = (process.env.UDOT_API_BASE || "").replace(/\/$/, "");
  const key  = process.env.UDOT_API_KEY || "";

  if (!base || !key) {
    return Response.json(
      { error: "UDOT not configured (set UDOT_API_BASE and UDOT_API_KEY)" },
      { status: 502 }
    );
  }

  const incoming = new URL(req.url);
  const upstream = `${base}/${(path || []).join("/")}${incoming.search}`;

  const r = await fetch(upstream, {
    headers: {
      Accept: "application/json",
      "x-api-key": key, // change to query param if UDOT requires
    },
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

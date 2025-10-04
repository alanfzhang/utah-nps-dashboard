import type { NextRequest } from "next/server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: { path?: string[] } }) {
  const base = (process.env.UDOT_API_BASE || "").replace(/\/$/, "");
  const key  = process.env.UDOT_API_KEY || "";

  if (!base || !key) {
    return Response.json(
      { error: "UDOT not configured (set UDOT_API_BASE and UDOT_API_KEY)" },
      { status: 502 }
    );
  }

  const path = (ctx.params.path || []).join("/");
  const incoming = new URL(req.url);
  const search = incoming.search ? incoming.search : "";

  const upstream = `${base}/${path}${search}`;

  // If your API needs the key as a query parameter instead of a header, replace headers with:
  //   const u = new URL(upstream);
  //   u.searchParams.set("api_key", key);  // or "key" per docs
  //   const finalUrl = u.toString();

  const r = await fetch(upstream, {
    headers: {
      Accept: "application/json",
      "x-api-key": key, // TODO: change header name if UDOT expects a different one
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

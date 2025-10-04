// app/api/udot/[...path]/route.ts
import type { NextRequest } from "next/server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> } // Next 14/15 typing
) {
  const { path } = await context.params; // await per new typing
  const base = (process.env.UDOT_API_BASE || "").replace(/\/$/, "");
  const key = process.env.UDOT_API_KEY || "";

  if (!base || !key) {
    return Response.json(
      { error: "UDOT not configured (set UDOT_API_BASE and UDOT_API_KEY)" },
      { status: 502 }
    );
  }

  const incoming = new URL(req.url);
  const search = incoming.search; // includes the leading "?"
  const upstream = `${base}/${(path || []).join("/")}${search}`;

  const r = await fetch(upstream, {
    headers: {
      Accept: "application/json",
      "x-api-key": key, // change header/query shape if UDOT docs require
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

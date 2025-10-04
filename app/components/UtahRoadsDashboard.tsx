'use client';

import React, { useEffect, useMemo, useState } from "react";

// --- Dark notice + error pretty printer ---
function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "bad" | "ok";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    info: "bg-neutral-900/70 border-neutral-700 text-neutral-200",
    warn: "bg-amber-900/30 border-amber-800 text-amber-200",
    bad: "bg-rose-900/30 border-rose-800 text-rose-200",
    ok: "bg-emerald-900/30 border-emerald-800 text-emerald-200",
  };
  return (
    <div className={`mb-3 rounded-xl border p-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

function prettyError(msg?: string) {
  const m = msg || "";
  if (/401|403/.test(m)) {
    return "Unauthorized: check UDOT_API_KEY / NPS_API_KEY in .env.local, then restart the dev server.";
  }
  if (/500|Internal Server Error/i.test(m)) {
    return "Server returned 500. If your UDOT key is still pending approval, this is expected—NPS will still load; UDOT will work after approval.";
  }
  if (/Failed to fetch|fetch failed|network/i.test(m)) {
    return "Network/CORS hiccup or proxy URL issue. Ensure NEXT_PUBLIC_UDOT_PROXY=/api/udot and NEXT_PUBLIC_NPS_PROXY=/api/nps.";
  }
  return m || "Unknown error.";
}


// Reusable styles
// Reusable styles (dark theme)
const cardBase =
  "rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur p-4 shadow-sm transition-all hover:shadow-md hover:border-neutral-700";
const sectionTitle = "text-xl font-medium mb-2 text-neutral-100";

function Badge({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "ok" | "warn" | "bad" }) {
  const tones: Record<string, string> = {
    neutral: "bg-neutral-800 text-neutral-200 border-neutral-700",
    ok: "bg-emerald-900/40 text-emerald-300 border-emerald-800",
    warn: "bg-amber-900/40 text-amber-300 border-amber-800",
    bad: "bg-rose-900/40 text-rose-300 border-rose-800",
  };
  return <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full border ${tones[tone]}`}>{text}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="w-28 shrink-0 text-neutral-400">{label}</span>
      <div className="flex-1 text-neutral-200">{children}</div>
    </div>
  );
}


// ---- Config -----------------------------------------------------------------
const PROXY_URLS = {
  // Expect serverless endpoints that forward to UDOT & NPS (examples below).
  udot: process.env.NEXT_PUBLIC_UDOT_PROXY?.replace(/\/$/, "") || "/api/udot",
  nps: process.env.NEXT_PUBLIC_NPS_PROXY?.replace(/\/$/, "") || "/api/nps",
};

// Utah routes we care about (matches substrings in UDOT payloads)
const ROUTES: { key: string; label: string; match: string[] }[] = [
  { key: "I-15", label: "I‑15 (UT)", match: ["I-15"] },
  { key: "I-70", label: "I‑70 (UT)", match: ["I-70"] },
  { key: "US-191", label: "US‑191 (Moab)", match: ["US-191", "US 191"] },
  { key: "SR-313", label: "SR‑313 (to Canyonlands Is. in the Sky)", match: ["SR-313", "SR 313", "UT-313", "UT 313"] },
  { key: "SR-24", label: "SR‑24 (Hanksville ↔ Torrey)", match: ["SR-24", "SR 24", "UT-24", "UT 24"] },
  { key: "SR-12", label: "SR‑12 (Boulder Mtn)", match: ["SR-12", "SR 12", "UT-12", "UT 12"] },
  { key: "SR-63", label: "SR‑63 (Bryce spur)", match: ["SR-63", "SR 63", "UT-63", "UT 63"] },
  { key: "US-89", label: "US‑89 (Bryce ↔ Zion)", match: ["US-89", "US 89"] },
  { key: "SR-9", label: "SR‑9 (Zion–Mt. Carmel)", match: ["SR-9", "SR 9", "UT-9", "UT 9"] },
];

// NPS park codes for this trip (add BRCA=Bryce as optional)
const PARKS = [
  { code: "arch", name: "Arches" },
  { code: "cany", name: "Canyonlands" },
  { code: "care", name: "Capitol Reef" },
  { code: "zion", name: "Zion" },
  { code: "brca", name: "Bryce Canyon" },
];

// Auto-refresh intervals (ms)
const REFRESH = {
  udot: 2 * 60 * 1000, // every 2 min
  nps: 10 * 60 * 1000, // every 10 min (NPS alerts refresh ~2h on their side)
};

// ---- Helpers ----------------------------------------------------------------
function relativeTime(utcSeconds?: number) {
  if (!utcSeconds) return "—";
  const now = Date.now();
  const then = utcSeconds * 1000;
  const diff = Math.max(0, now - then);
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}

function matchesRoute(name: string, route: { match: string[] }) {
  const n = (name || "").toUpperCase();
  return route.match.some(m => n.includes(m.toUpperCase()));
}

async function getJSON(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

// ---- Main Component ----------------------------------------------------------
export default function UtahRoadsDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roadConds, setRoadConds] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [npsAlerts, setNpsAlerts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);

async function refreshNow() {
  try {
    setRefreshing(true);
    await Promise.all([loadUDOT(), loadNPS()]);
    setLastRefresh(Date.now());
  } finally {
    setRefreshing(false);
  }
}

  const loadUDOT = async () => {
    const base = PROXY_URLS.udot;
    const [rc, ca, ws, al] = await Promise.all([
      getJSON(`${base}/roadconditions`),
      getJSON(`${base}/cameras`),
      getJSON(`${base}/weatherstations`),
      getJSON(`${base}/alerts`),
    ]);
    setRoadConds(rc || []);
    setCameras(ca || []);
    setStations(ws || []);
    setAlerts(al || []);
  };

  const loadNPS = async () => {
    const base = PROXY_URLS.nps;
    const codes = PARKS.map(p => p.code).join(",");
    const data = await getJSON(`${base}/alerts?parkCode=${codes}&limit=100`);
    const items = data?.data || data?.alerts || [];
    setNpsAlerts(items);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([loadUDOT(), loadNPS()]);
        if (!mounted) return;
        setError(null);
      } catch (e: any) {
        setError(e?.message || "Load failed");
      } finally {
        setLoading(false);
      }
    })();

    const t1 = setInterval(loadUDOT, REFRESH.udot);
    const t2 = setInterval(loadNPS, REFRESH.nps);
    return () => {
      mounted = false;
      clearInterval(t1);
      clearInterval(t2);
    };
  }, []);

  const byRoute = useMemo(() => {
    const map: Record<string, any> = {};
    for (const r of ROUTES) map[r.key] = { route: r, conds: [], cams: [], stations: [] };

    for (const rc of roadConds) {
      for (const r of ROUTES) if (matchesRoute(rc.RoadwayName || "", r)) map[r.key].conds.push(rc);
    }
    for (const cam of cameras) {
      for (const r of ROUTES) if (matchesRoute(cam.Roadway || cam.Location || "", r)) map[r.key].cams.push(cam);
    }
    for (const st of stations) {
      for (const r of ROUTES) if (matchesRoute(st.StationName || "", r)) map[r.key].stations.push(st);
    }
    return map;
  }, [roadConds, cameras, stations]);

  const npsByPark = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const p of PARKS) map[p.code] = [];
    for (const a of npsAlerts) {
      const codes = (a?.parkCode || a?.parkCodes || "").toString().split(",");
      for (const c of codes) if (map[c]) map[c].push(a);
    }
    return map;
  }, [npsAlerts]);

  return (
  <div className="space-y-6" data-component="DashboardRoot">
    {/* Error notice */}
    {error && (
      <Notice tone="bad">
        <div className="font-medium text-neutral-100">Load error</div>
        <div className="mt-0.5">{prettyError(String(error))}</div>
      </Notice>
    )}

    {/* Toolbar */}
    <div className="mb-4 flex items-center justify-between">
      <div className="text-sm text-neutral-400">
        UDOT auto-refresh 2m · NPS 10m
        {lastRefresh && (
          <span className="ml-2 text-neutral-500">
            · Last manual refresh {new Date(lastRefresh).toLocaleTimeString()}
          </span>
        )}
      </div>
      <button
        onClick={refreshNow}
        disabled={refreshing}
        className="inline-flex items-center gap-2 text-sm rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-800/70 text-neutral-200 px-3 py-1.5 disabled:opacity-60"
      >
        {refreshing && (
          <span className="h-3 w-3 rounded-full border-2 border-neutral-400 border-t-transparent animate-spin" />
        )}
        Refresh
      </button>
    </div>

    {/* UDOT — Highway Status */}
    <section>
      <h2 className={sectionTitle}>UDOT — Highway Status</h2>
      <p className="text-sm text-neutral-400 mb-3">
        Live highway conditions, cameras, and RWIS readings for I-15 · I-70 · US-191 · SR-313 · SR-24 · SR-12 · SR-63 · US-89 · SR-9
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {ROUTES.map((r) => (
          <CollapsibleRouteCard key={r.key} routeKey={r.key} data={byRoute[r.key]} />
        ))}
      </div>
    </section>

    {/* NPS — Park Alerts */}
    <section>
      <h2 className={sectionTitle}>NPS — Park Alerts</h2>
      <p className="text-sm text-neutral-400 mb-3">
        Current alerts from Arches, Canyonlands, Capitol Reef, Zion (Bryce optional)
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {PARKS.map((p) => (
          <CollapsibleParkAlerts key={p.code} park={p} alerts={npsByPark[p.code] || []} />
        ))}
      </div>
    </section>

    <footer className="text-xs text-neutral-500 mt-6">
      Data: UDOT Traffic API &amp; NPS API. Camera thumbnails open UDOT viewer. Weather stations show latest surface/air data when matched by name.
    </footer>
  </div>
);
}

// ---- Child Components --------------------------------------------------------

function CollapsibleRouteCard({ routeKey, data }: { routeKey: string; data: any }) {
  const r = data?.route as { label?: string } | undefined;
  const conds = data?.conds ?? [];
  const cams = data?.cams ?? [];
  const stations = data?.stations ?? [];

  const latest = conds[0] ?? null;
  const roadCond = latest?.RoadCondition ?? "—";
  const wxCond = latest?.WeatherCondition ?? "—";

  let tone: "neutral" | "ok" | "warn" | "bad" = "neutral";
  if (/dry/i.test(roadCond) && /fair|clear/i.test(wxCond)) tone = "ok";
  if (/(snow|ice|slush)/i.test(roadCond) || /(snow|freez|icy)/i.test(wxCond)) tone = "bad";
  if (/(wet|slick)/i.test(roadCond) || /(wind|rain)/i.test(wxCond)) tone = tone === "bad" ? "bad" : "warn";

  return (
    <div className={cardBase} data-component="CollapsibleRouteCard">
      {/* Header (no toggle button) */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-neutral-100">{r?.label || routeKey}</h3>
        <Badge text={roadCond} tone={tone} />
      </div>

      {/* Body (always visible) */}
      <div className="space-y-2 mt-2">
        <Field label="Weather">
          <div className="flex flex-wrap items-center gap-2">
            <span>{wxCond}</span>
            {latest?.Restriction && latest.Restriction !== "none" && (
              <Badge text={`Restriction: ${latest.Restriction}`} tone="warn" />
            )}
            {latest?.LastUpdated && (
              <span className="text-xs text-neutral-500">Updated {relativeTime(latest.LastUpdated)}</span>
            )}
          </div>
        </Field>

        <Field label="Segments">
          <div className="text-xs text-neutral-300 space-y-1 max-h-28 overflow-auto pr-1">
            {conds.length ? (
              conds.slice(0, 6).map((c: any) => (
                <div key={c.Id ?? `${c.RoadwayName}-${c.BeginMile}`} className="flex items-center gap-2">
                  <span className="truncate">{c.RoadwayName}</span>
                  <span className="text-[11px] text-neutral-500">{relativeTime(c.LastUpdated)}</span>
                </div>
              ))
            ) : (
              <span className="text-neutral-500">No matching segments from UDOT right now.</span>
            )}
            {conds.length > 6 && <div className="text-[11px] text-neutral-500">+{conds.length - 6} more…</div>}
          </div>
        </Field>

        <Field label="Cameras">
          <div className="flex flex-wrap gap-2">
            {cams.length ? (
              cams.slice(0, 4).map((cam: any) => (
                <a
                  key={cam.Id ?? cam.Location}
                  href={cam.Views?.[0]?.Url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-2 py-1 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-800/70 text-neutral-200"
                >
                  {cam.Location || cam.Roadway || `Camera ${cam.Id}`}
                </a>
              ))
            ) : (
              <span className="text-xs text-neutral-500">No cameras matched by name</span>
            )}
          </div>
        </Field>

        <Field label="RWIS (Weather)">
          <div className="grid grid-cols-1 gap-1">
            {stations.length ? (
              stations.slice(0, 3).map((st: any) => (
                <div key={st.Id ?? st.StationName} className="text-xs text-neutral-200 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-neutral-100">{st.StationName}</span>
                  {st.SurfaceStatus && (
                    <Badge
                      text={st.SurfaceStatus}
                      tone={
                        /Dry/i.test(st.SurfaceStatus)
                          ? "ok"
                          : /(Ice|Snow|Wet)/i.test(st.SurfaceStatus)
                          ? "warn"
                          : "neutral"
                      }
                    />
                  )}
                  {st.AirTemperature != null && <span>Air {Number(st.AirTemperature).toFixed(0)}°F</span>}
                  {st.SurfaceTemp != null && <span>Road {Number(st.SurfaceTemp).toFixed(0)}°F</span>}
                  {st.LastUpdated && <span className="text-neutral-500">{relativeTime(st.LastUpdated)}</span>}
                </div>
              ))
            ) : (
              <span className="text-xs text-neutral-500">No nearby stations matched by name</span>
            )}
          </div>
        </Field>
      </div>
    </div>
  );
}

function CollapsibleParkAlerts({ park, alerts }: { park: { code: string; name: string }; alerts: any[] }) {
  const hasClosure = alerts?.some((a: any) => /closure|closed/i.test(a?.category || a?.title || ""));
  const tone: "ok" | "warn" | "bad" = alerts?.length ? (hasClosure ? "bad" : "warn") : "ok";

  return (
    <div className={cardBase} data-component="CollapsibleParkAlerts">
      {/* Header (no toggle button) */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-neutral-100">{park.name}</h3>
        <Badge text={`${alerts.length} alert${alerts.length !== 1 ? "s" : ""}`} tone={tone} />
      </div>

      {/* Body (always visible) */}
      <div className="space-y-2 max-h-44 overflow-auto pr-1 mt-2">
        {alerts.length ? (
          alerts.map((a: any) => (
            <div key={a.id || a.title} className="text-sm rounded-lg border border-neutral-800 bg-neutral-900/70 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-neutral-100">{a.title || a.category || "Alert"}</div>
                {a.severity && (
                  <Badge
                    text={String(a.severity)}
                    tone={/closure|danger|urgent/i.test(String(a.severity)) ? "bad" : "warn"}
                  />
                )}
              </div>
              {a.description && (
                <div
                  className="text-xs text-neutral-300 mt-0.5 line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: a.description }}
                />
              )}
              <div className="flex items-center gap-2 mt-1">
                {a.lastIndexedDate && (
                  <span className="text-[11px] text-neutral-500">
                    Updated {new Date(a.lastIndexedDate).toLocaleDateString()}
                  </span>
                )}
                {a.url && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline text-neutral-300 hover:text-neutral-100"
                  >
                    Learn more
                  </a>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-xs text-neutral-500">No active NPS alerts.</div>
        )}
      </div>
    </div>
  );
}



// ---- Example Serverless Proxies (paste into your project) -------------------
// Next.js /pages/api/udot/[resource].ts
// -------------------------------------
// import type { NextApiRequest, NextApiResponse } from 'next';
// const UDOT_BASE = 'https://www.udottraffic.utah.gov/api/v2/get';
// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   const { resource } = req.query; // roadconditions | cameras | weatherstations | alerts
//   const key = process.env.UDOT_API_KEY;
//   if (!key || typeof resource !== 'string') return res.status(400).json({ error: 'Missing' });
//   const url = `${UDOT_BASE}/${resource}?key=${encodeURIComponent(key)}&format=json`;
//   const r = await fetch(url);
//   const data = await r.json();
//   res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
//   res.status(200).json(data);
// }
// 
// Next.js /pages/api/nps/alerts.ts
// --------------------------------
// import type { NextApiRequest, NextApiResponse } from 'next';
// const NPS_BASE = 'https://developer.nps.gov/api/v1';
// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   const key = process.env.NPS_API_KEY;
//   const { parkCode = '', limit = '50' } = req.query;
//   if (!key) return res.status(400).json({ error: 'Missing NPS key' });
//   const url = `${NPS_BASE}/alerts?parkCode=${parkCode}&limit=${limit}`;
//   const r = await fetch(url, { headers: { 'X-Api-Key': key as string } });
//   const data = await r.json();
//   res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
//   res.status(200).json(data);
// }
//
// .env.local (example)
// --------------------
// UDOT_API_KEY=your_udot_key_here
// NPS_API_KEY=your_nps_key_here
// NEXT_PUBLIC_UDOT_PROXY=/api/udot
// NEXT_PUBLIC_NPS_PROXY=/api/nps
//
// Vite? Create /api proxies with Netlify/Vercel functions or a tiny Express server.
// For Express, map GET /api/udot/:resource and /api/nps/alerts as above.
//
// That’s it — deploy and load the component. The dashboard will auto-refresh.

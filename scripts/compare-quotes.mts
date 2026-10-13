/**
 * Before-and-after comparison of per-kilometre ("custom route") prices for representative journeys, under different routing sources.
 * It changes nothing: it only reads routes and applies the site's own per-kilometre fare function (distanceFare). It does not touch
 * prices, the database, fixed-route rates or any setting.
 *
 *   npx tsx scripts/compare-quotes.mts                       (current = public OSRM demo, plus the straight-line estimate)
 *   ORS_API_KEY=...  npx tsx scripts/compare-quotes.mts      (adds the OpenRouteService column; set the variable in YOUR shell or
 *                                                             .env.local, never in a commit or in chat)
 *
 * Columns: current = what production quotes use today (public OSRM demo, lib/geo/index.ts); ors = OpenRouteService driving-car;
 * estimate = what the site falls back to when routing is unreachable (straight line x 1.35). The last two columns are the price
 * difference of ors and of estimate against current. ORS requests are spaced out to stay under its 40 per minute limit; the key is
 * sent in a header and never printed.
 *
 * Journeys that have a row in the fixed price table are NOT affected by routing at all (the table price is used and the distance is
 * never read); this script cannot evaluate those because the table lives in the database.
 */
import { distanceFare } from "../lib/pricing";
import { estimateRoad } from "../lib/geo";

type P = { lat: number; lng: number };
const BCN_AIRPORT: P = { lat: 41.2971, lng: 2.0785 };
const PL_CATALUNYA: P = { lat: 41.3874, lng: 2.1686 };
const JOURNEYS: Array<[string, P, P]> = [
  ["Airport to Plaça Catalunya", BCN_AIRPORT, PL_CATALUNYA],
  ["Hotel Arts to Camp Nou", { lat: 41.3869, lng: 2.1965 }, { lat: 41.3809, lng: 2.1228 }],
  ["Airport to Sitges", BCN_AIRPORT, { lat: 41.2372, lng: 1.8059 }],
  ["Barcelona to Montserrat", PL_CATALUNYA, { lat: 41.5933, lng: 1.8376 }],
  ["Barcelona to Tarragona", PL_CATALUNYA, { lat: 41.1189, lng: 1.2445 }],
  ["Barcelona to Lloret de Mar", PL_CATALUNYA, { lat: 41.6995, lng: 2.8458 }],
  ["Airport to Girona", BCN_AIRPORT, { lat: 41.9794, lng: 2.8214 }],
  ["Barcelona to Andorra la Vella", PL_CATALUNYA, { lat: 42.5063, lng: 1.5218 }],
];
const CLASSES = ["ECONOMY", "BUSINESS", "VCLASS"] as const;

const DEMO = (process.env.ROUTING_URL_CURRENT ?? "https://router.project-osrm.org").replace(/\/+$/, "");
const ORS_KEY = process.env.ORS_API_KEY?.trim();
const ORS_BASE = (process.env.ORS_BASE_URL ?? "https://api.openrouteservice.org").replace(/\/+$/, "");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function osrm(a: P, b: P): Promise<number | null> {
  try {
    const res = await fetch(`${DEMO}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const r = ((await res.json()) as { routes?: Array<{ distance: number }> }).routes?.[0];
    return r ? Math.round(r.distance / 100) / 10 : null;
  } catch {
    return null;
  }
}

async function ors(a: P, b: P): Promise<number | null> {
  if (!ORS_KEY) return null;
  try {
    const res = await fetch(`${ORS_BASE}/v2/directions/driving-car/geojson`, {
      method: "POST",
      headers: { Authorization: ORS_KEY, "Content-Type": "application/json", Accept: "application/geo+json" },
      body: JSON.stringify({ coordinates: [[a.lng, a.lat], [b.lng, b.lat]], instructions: false }),
      signal: AbortSignal.timeout(10000),
    });
    await sleep(1600); // stay under 40 requests per minute
    if (!res.ok) return null;
    const d = ((await res.json()) as { features?: Array<{ properties?: { summary?: { distance?: number } } }> }).features?.[0]?.properties?.summary?.distance;
    return typeof d === "number" ? Math.round(d / 100) / 10 : null;
  } catch {
    return null;
  }
}

const km = (n: number | null, none: string) => (n === null ? none : `${n} km`);
const eur = (n: number | null) => (n === null ? "n/a" : String(n));
const diff = (a: number | null, b: number | null) => (a === null || b === null ? "n/a" : `${a - b >= 0 ? "+" : ""}${a - b}`);

console.log(`current  = ${DEMO} (what production quotes use today)`);
console.log(`ors      = ${ORS_KEY ? ORS_BASE : "(not run: set ORS_API_KEY in your own shell to compare)"}`);
console.log(`estimate = straight line x 1.35 (used when routing is unreachable)\n`);

const distances = [];
for (const [name, a, b] of JOURNEYS) {
  distances.push({ name, cur: await osrm(a, b), ors: await ors(a, b), est: estimateRoad(a, b).distanceKm });
}

for (const cls of CLASSES) {
  console.log(`\n=== ${cls} (EUR, weekday, per-km fare only) ===`);
  console.log("journey".padEnd(32) + "current".padEnd(22) + "ors".padEnd(22) + "estimate".padEnd(20) + "ors-cur".padEnd(9) + "est-cur");
  for (const d of distances) {
    const f = (x: number | null) => (x === null ? null : distanceFare(x, cls));
    const pc = f(d.cur);
    const po = f(d.ors);
    const pe = f(d.est);
    console.log(d.name.padEnd(32) + `${km(d.cur, "unreachable")} ${eur(pc)}`.padEnd(22) + `${km(d.ors, ORS_KEY ? "no route" : "not run")} ${eur(po)}`.padEnd(22) + `${d.est} km ${eur(pe)}`.padEnd(20) + diff(po, pc).padEnd(9) + diff(pe, pc));
  }
}

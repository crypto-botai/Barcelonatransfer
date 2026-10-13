/**
 * Before-and-after comparison of per-kilometre ("custom route") prices for representative journeys, under different routing setups.
 * It changes nothing: it only reads from the routing servers you name and prints a table.
 *
 *   npx tsx scripts/compare-quotes.mts
 *   ROUTING_URL_CURRENT=https://router.project-osrm.org ROUTING_URL_PROPOSED=https://routing.example.com npx tsx scripts/compare-quotes.mts
 *
 * Columns: the road distance each setup returns, the per-km price that distance gives (weekday, normal hours, no surcharges), and
 * the difference against the CURRENT setup. A third setup, "estimate", is what the site falls back to when routing is unreachable
 * (straight line x 1.35). Journeys that have a row in the fixed price table are NOT affected by routing at all (the table price is
 * used and the distance is never read); this script cannot evaluate those because the table lives in the database.
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

const CURRENT = (process.env.ROUTING_URL_CURRENT ?? "https://router.project-osrm.org").replace(/\/+$/, "");
const PROPOSED = process.env.ROUTING_URL_PROPOSED?.replace(/\/+$/, "");

async function road(base: string, a: P, b: P): Promise<{ km: number; min: number } | null> {
  try {
    const res = await fetch(`${base}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const r = ((await res.json()) as { routes?: Array<{ distance: number; duration: number }> }).routes?.[0];
    return r ? { km: Math.round(r.distance / 100) / 10, min: Math.ceil(r.duration / 60) } : null;
  } catch {
    return null;
  }
}

const eur = (n: number | null) => (n === null ? "n/a" : `${n}`.padStart(5));
const km = (n: number | null) => (n === null ? "unreachable" : `${n} km`);

console.log(`current  = ${CURRENT}`);
console.log(`proposed = ${PROPOSED ?? "(not set: set ROUTING_URL_PROPOSED to compare)"}`);
console.log(`estimate = straight line x 1.35 (used when routing is unreachable)\n`);

for (const cls of CLASSES) {
  console.log(`\n=== ${cls} (EUR, weekday, per-km fare only) ===`);
  console.log("journey".padEnd(32) + "current".padEnd(24) + "proposed".padEnd(24) + "estimate".padEnd(20) + "proposed vs current");
  for (const [name, a, b] of JOURNEYS) {
    const cur = await road(CURRENT, a, b);
    const prop = PROPOSED ? await road(PROPOSED, a, b) : null;
    const est = estimateRoad(a, b);
    const f = (d: number | null) => (d === null ? null : distanceFare(d, cls));
    const pc = f(cur?.km ?? null);
    const pp = f(prop?.km ?? null);
    const pe = f(est.distanceKm);
    const diff = pc !== null && pp !== null ? `${pp - pc >= 0 ? "+" : ""}${pp - pc}` : "n/a";
    console.log(name.padEnd(32) + `${km(cur?.km ?? null)} EUR ${eur(pc)}`.padEnd(24) + `${km(prop?.km ?? null)} EUR ${eur(pp)}`.padEnd(24) + `${est.distanceKm} km EUR ${eur(pe)}`.padEnd(20) + diff);
  }
}

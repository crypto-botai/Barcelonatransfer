import { estimateRoad, haversineKm, type LatLng } from "@/lib/geo";

/**
 * Driving routes for live ride tracking: the line to draw, the road distance and the driving time.
 *
 * Provider: any OSRM-compatible /route/v1/driving endpoint, set with ROUTING_BASE_URL. The default is the public OSRM demo server,
 * which has no uptime promise and a fair-use policy; it is fine for testing and light use but must be replaced for production
 * (self-hosted OSRM, or Valhalla behind an OSRM-compatible adapter). Nothing outside this file depends on the provider.
 *
 * Honesty: these are road-network durations at the provider's normal speeds. They are NOT live-traffic estimates and are labelled
 * `basis: "road-network"` so no screen presents them as traffic-aware. When the provider is down the straight-line estimate is used
 * and labelled `basis: "estimate"`.
 *
 * Cost control: a route is only recomputed when the start point has moved about 150 m or the cached answer is over 60 seconds
 * old, so a GPS fix every few seconds does not become a routing call every few seconds.
 */

export type RouteBasis = "road-network" | "estimate";

export interface LiveRoute {
  distanceKm: number;
  durationMin: number;
  /** [lng, lat] pairs, ready for a map line. Empty for the estimate. */
  coordinates: [number, number][];
  basis: RouteBasis;
}

const base = () => (process.env.ROUTING_BASE_URL ?? "https://router.project-osrm.org").replace(/\/$/, "");
const UA = "EliteBCN-LiveTracking/1.0 (info@elitebcn.info)";
const MAX_POINTS = 400;

/** Keeps a long route light for a phone: every n-th point, always including the last. */
export function thin(coords: [number, number][], max = MAX_POINTS): [number, number][] {
  if (coords.length <= max) return coords;
  const step = Math.ceil(coords.length / max);
  const out = coords.filter((_, i) => i % step === 0);
  const last = coords[coords.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

async function fetchRoute(from: LatLng, to: LatLng): Promise<LiveRoute | null> {
  try {
    const url = `${base()}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { routes?: Array<{ distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }> };
    const r = data.routes?.[0];
    if (!r || !Number.isFinite(r.distance) || !Number.isFinite(r.duration)) return null;
    return { distanceKm: Math.round(r.distance / 100) / 10, durationMin: Math.max(1, Math.round(r.duration / 60)), coordinates: thin(r.geometry?.coordinates ?? []), basis: "road-network" };
  } catch {
    return null;
  }
}

interface Cached { at: number; from: LatLng; to: LatLng; route: LiveRoute }
const cache = new Map<string, Cached>();
const MOVE_KM = 0.15;
const MAX_AGE_MS = 60_000;

/**
 * The route from `from` to `to`, reused while the start has not moved meaningfully and the answer is fresh. `key` identifies the
 * leg (booking id + which leg) so different rides never share an entry.
 */
export async function liveRoute(key: string, from: LatLng, to: LatLng, now = Date.now()): Promise<LiveRoute> {
  const hit = cache.get(key);
  if (hit && now - hit.at < MAX_AGE_MS && haversineKm(hit.from, from) < MOVE_KM && haversineKm(hit.to, to) < 0.01) return hit.route;
  const fresh = await fetchRoute(from, to);
  const est = estimateRoad(from, to);
  const route: LiveRoute = fresh ?? { distanceKm: est.distanceKm, durationMin: Math.max(1, est.durationMin), coordinates: [], basis: "estimate" };
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: now, from, to, route });
  return route;
}

export const arrivalAt = (durationMin: number, now = Date.now()): string => new Date(now + durationMin * 60_000).toISOString();

/** Freshness of a GPS fix, in the words the apps use. */
export function freshness(ageSeconds: number): "live" | "delayed" | "stale" {
  return ageSeconds <= 30 ? "live" : ageSeconds <= 120 ? "delayed" : "stale";
}

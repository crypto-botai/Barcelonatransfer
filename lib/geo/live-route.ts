import { estimateRoad, haversineKm, type LatLng } from "@/lib/geo";

/**
 * Driving routes for live ride tracking: the line to draw, the road distance and the driving time.
 *
 * Provider: any OSRM-compatible /route/v1/driving endpoint, set with ROUTING_BASE_URL (see routingConfig for the production rules:
 * the public demo server is refused in production). Nothing outside this file depends on the provider.
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

export const PUBLIC_OSRM_DEMO = "https://router.project-osrm.org";
const UA = "EliteBCN-LiveTracking/1.0 (info@elitebcn.info)";
const MAX_POINTS = 400;

export interface RoutingConfig {
  /** Where routes are requested, or null when routing is switched off (the apps then show a labelled straight-line estimate). */
  baseUrl: string | null;
  /** True when the address is the public OSRM demo server. */
  isDemo: boolean;
  /** Why routing is off, for logs and the health check. Never shown to passengers. */
  reason?: string;
}

/**
 * Which routing server to use, decided from the environment.
 *
 * The public OSRM demo server is only ever used when NODE_ENV is not "production" (local development and tests). In production it
 * is refused outright and NO setting can turn it back on: with ROUTING_BASE_URL unset, invalid, plain http or pointing at the demo
 * host, routing is switched off and the apps show a labelled straight-line estimate. (Staging and preview deployments also run with
 * NODE_ENV=production, so they need their own routing server too.) Plain http is refused in production.
 */
export function routingConfig(env: Record<string, string | undefined> = process.env): RoutingConfig {
  const production = env.NODE_ENV === "production";
  const raw = (env.ROUTING_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!raw) {
    if (!production) return { baseUrl: PUBLIC_OSRM_DEMO, isDemo: true };
    return { baseUrl: null, isDemo: false, reason: "ROUTING_BASE_URL is not set in production" };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { baseUrl: null, isDemo: false, reason: "ROUTING_BASE_URL is not a valid URL" };
  }
  if (production && url.protocol !== "https:") return { baseUrl: null, isDemo: false, reason: "ROUTING_BASE_URL must be https in production" };
  const isDemo = url.hostname === new URL(PUBLIC_OSRM_DEMO).hostname;
  if (isDemo && production) return { baseUrl: null, isDemo: true, reason: "the public OSRM demo server is not allowed in production" };
  return { baseUrl: raw, isDemo };
}

/** Keeps a long route light for a phone: every n-th point, always including the last. */
export function thin(coords: [number, number][], max = MAX_POINTS): [number, number][] {
  if (coords.length <= max) return coords;
  const step = Math.ceil(coords.length / max);
  const out = coords.filter((_, i) => i % step === 0);
  const last = coords[coords.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

const TIMEOUT_MS = 3500;
const RETRIES = 1;
const BREAKER_AFTER = 3;
const BREAKER_OPEN_MS = 30_000;
const MAX_CALLS_PER_MINUTE = 40;

const breaker = { failures: 0, openUntil: 0 };
let callWindow = { start: 0, calls: 0 };

/** Test hook: forget breaker and rate-limit state. */
export function resetRoutingState(): void {
  breaker.failures = 0;
  breaker.openUntil = 0;
  callWindow = { start: 0, calls: 0 };
  cache.clear();
}

/** One attempt, with a timeout. Returns null when the server answered but had no route; throws on network errors and 5xx. */
async function attempt(baseUrl: string, from: LatLng, to: LatLng): Promise<LiveRoute | null> {
  const url = `${baseUrl}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status >= 500) throw new Error(`routing ${res.status}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { routes?: Array<{ distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }> };
  const r = data.routes?.[0];
  if (!r || !Number.isFinite(r.distance) || !Number.isFinite(r.duration)) return null;
  return { distanceKm: Math.round(r.distance / 100) / 10, durationMin: Math.max(1, Math.round(r.duration / 60)), coordinates: thin(r.geometry?.coordinates ?? []), basis: "road-network" };
}

/**
 * Asks the routing server, with: a short timeout, at most one retry (only for network errors and 5xx), a circuit breaker (after
 * three failures in a row routing is skipped for 30 seconds so a dead server is not hammered and requests are not slowed), and a
 * ceiling of 40 calls a minute per server instance. Any of these returns null and the caller uses the labelled estimate.
 */
async function fetchRoute(from: LatLng, to: LatLng, now = Date.now()): Promise<LiveRoute | null> {
  const cfg = routingConfig();
  if (!cfg.baseUrl) return null;
  if (now < breaker.openUntil) return null;
  if (now - callWindow.start > 60_000) callWindow = { start: now, calls: 0 };
  if (callWindow.calls >= MAX_CALLS_PER_MINUTE) return null;
  callWindow.calls++;
  for (let i = 0; i <= RETRIES; i++) {
    try {
      const route = await attempt(cfg.baseUrl, from, to);
      breaker.failures = 0;
      return route;
    } catch {
      if (i < RETRIES) await new Promise((r) => setTimeout(r, 200));
    }
  }
  breaker.failures++;
  if (breaker.failures >= BREAKER_AFTER) breaker.openUntil = now + BREAKER_OPEN_MS;
  return null;
}

export interface RoutingHealth {
  configured: boolean;
  isDemo: boolean;
  ok: boolean;
  latencyMs: number | null;
  breakerOpen: boolean;
  reason?: string;
}

/** A real test route (Barcelona airport to the city centre) against the configured server; used by the admin health check. */
export async function routingHealth(now = Date.now()): Promise<RoutingHealth> {
  const cfg = routingConfig();
  const base = { configured: cfg.baseUrl !== null, isDemo: cfg.isDemo, breakerOpen: now < breaker.openUntil };
  if (!cfg.baseUrl) return { ...base, ok: false, latencyMs: null, reason: cfg.reason };
  const t0 = Date.now();
  try {
    const r = await attempt(cfg.baseUrl, { lat: 41.2971, lng: 2.0785 }, { lat: 41.3874, lng: 2.1686 });
    return { ...base, ok: r !== null && r.distanceKm > 5 && r.distanceKm < 40, latencyMs: Date.now() - t0 };
  } catch (e) {
    return { ...base, ok: false, latencyMs: Date.now() - t0, reason: e instanceof Error ? e.message : "failed" };
  }
}

interface Cached { at: number; from: LatLng; to: LatLng; route: LiveRoute }
const cache = new Map<string, Cached>();
const MOVE_KM = 0.15;
const MAX_AGE_MS = 60_000;
/** The labelled estimate is only reused briefly, so routing is tried again soon after it recovers. */
const FALLBACK_AGE_MS = 10_000;

/**
 * The route from `from` to `to`, reused while the start has not moved meaningfully and the answer is fresh. `key` identifies the
 * leg (booking id + which leg) so different rides never share an entry.
 */
export async function liveRoute(key: string, from: LatLng, to: LatLng, now = Date.now()): Promise<LiveRoute> {
  const hit = cache.get(key);
  if (hit && now - hit.at < (hit.route.basis === "estimate" ? FALLBACK_AGE_MS : MAX_AGE_MS) && haversineKm(hit.from, from) < MOVE_KM && haversineKm(hit.to, to) < 0.01) return hit.route;
  const fresh = await fetchRoute(from, to, now);
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

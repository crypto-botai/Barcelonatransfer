import { estimateRoad, haversineKm, type LatLng } from "@/lib/geo";

/**
 * Driving routes for live ride tracking: the line to draw, the road distance and the driving time.
 *
 * Providers (ROUTING_PROVIDER):
 *  - "ors"  OpenRouteService (HeiGIT) Directions V2, driving-car. The API key (ORS_API_KEY) lives only on the server, is sent in the
 *           Authorization header, and is never put in a URL, a log line, an error message or anything sent to the apps.
 *  - "osrm" any OSRM-compatible /route/v1/driving server (ROUTING_BASE_URL). Kept as a development default; the public OSRM demo is
 *           refused in production.
 * Nothing outside this file depends on the provider, so another one can be added here without touching the apps or the endpoints.
 *
 * Honesty: these are road-network durations at the provider's normal speeds. They are NOT live-traffic estimates and are labelled
 * `basis: "road-network"` so no screen presents them as traffic-aware. When routing is off, throttled or failing, the straight-line
 * estimate is used and labelled `basis: "estimate"`. Routing never throws: GPS tracking carries on whatever the routing service does.
 *
 * Cost and rate control (ORS standard plan, confirmed by HeiGIT staff: 2,000 directions requests per day, 40 per minute):
 *  - routes are cached per ride leg and only recomputed when the start has moved far enough or the answer is old enough;
 *  - the journey from pickup to destination never changes, so it is cached for six hours;
 *  - a per-minute cap and a per-day cap (per server instance) switch routing to the estimate before the provider's limits are hit;
 *  - HTTP 429 from the provider pauses routing for the time it asks (at most five minutes); 401/403 (bad key) pauses it for ten.
 */

export type RouteBasis = "road-network" | "estimate";

export interface LiveRoute {
  distanceKm: number;
  durationMin: number;
  /** [lng, lat] pairs, ready for a map line. Empty for the estimate. */
  coordinates: [number, number][];
  basis: RouteBasis;
}

export type RoutingProvider = "ors" | "osrm";

export const PUBLIC_OSRM_DEMO = "https://router.project-osrm.org";
export const ORS_DEFAULT_BASE = "https://api.openrouteservice.org";

/** How far (metres) ORS may move a start or end point to reach a drivable road. */
export const ORS_SNAP_RADIUS_M = 1500;
const UA = "EliteBCN-LiveTracking/1.0 (info@elitebcn.info)";
const MAX_POINTS = 400;

export interface RoutingConfig {
  provider: RoutingProvider;
  /** Where routes are requested, or null when routing is switched off (the apps then show a labelled straight-line estimate). */
  baseUrl: string | null;
  /** True when the address is the public OSRM demo server. */
  isDemo: boolean;
  /** The ORS key. Server only: never serialise this object into a response or a log. */
  apiKey?: string;
  /** Why routing is off, for logs and the health check. Never shown to passengers. */
  reason?: string;
}

const off = (provider: RoutingProvider, reason: string, isDemo = false): RoutingConfig => ({ provider, baseUrl: null, isDemo, reason });

/**
 * Which routing service to use, decided from the environment.
 *
 *  - ROUTING_PROVIDER=ors needs ORS_API_KEY (and optionally ORS_BASE_URL for a dedicated or self-hosted ORS; https only in
 *    production). Without a key, routing is switched off: it never falls back to another provider by itself.
 *  - Otherwise OSRM: the public demo server is only used when NODE_ENV is not "production" (development and tests); in production it
 *    is refused and no setting turns it back on. Plain http is refused in production.
 * Staging and preview deployments run with NODE_ENV=production too, so they need their own key (or no routing at all).
 */
export function routingConfig(env: Record<string, string | undefined> = process.env): RoutingConfig {
  const production = env.NODE_ENV === "production";
  const provider: RoutingProvider = (env.ROUTING_PROVIDER ?? "").trim().toLowerCase() === "ors" ? "ors" : "osrm";

  if (provider === "ors") {
    const key = (env.ORS_API_KEY ?? "").trim();
    if (!key) return off("ors", "ORS_API_KEY is not set");
    const raw = (env.ORS_BASE_URL ?? ORS_DEFAULT_BASE).trim().replace(/\/+$/, "");
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return off("ors", "ORS_BASE_URL is not a valid URL");
    }
    if (production && url.protocol !== "https:") return off("ors", "ORS_BASE_URL must be https in production");
    return { provider: "ors", baseUrl: raw, isDemo: false, apiKey: key };
  }

  const raw = (env.ROUTING_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!raw) {
    if (!production) return { provider: "osrm", baseUrl: PUBLIC_OSRM_DEMO, isDemo: true };
    return off("osrm", "no routing provider is configured in production (set ROUTING_PROVIDER=ors and ORS_API_KEY)");
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return off("osrm", "ROUTING_BASE_URL is not a valid URL");
  }
  if (production && url.protocol !== "https:") return off("osrm", "ROUTING_BASE_URL must be https in production");
  const isDemo = url.hostname === new URL(PUBLIC_OSRM_DEMO).hostname;
  if (isDemo && production) return off("osrm", "the public OSRM demo server is not allowed in production", true);
  return { provider: "osrm", baseUrl: raw, isDemo };
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
const MAX_CALLS_PER_MINUTE = 30; // under ORS's 40 per minute, leaving room for other instances
const DEFAULT_MAX_CALLS_PER_DAY = 1800; // under ORS's 2,000 per day
const KEY_REJECTED_PAUSE_MS = 10 * 60_000;
const MAX_RATE_PAUSE_MS = 5 * 60_000;

const breaker = { failures: 0, openUntil: 0 };
let callWindow = { start: 0, calls: 0 };
let dayWindow = { day: "", calls: 0 };
let pausedUntil = 0;

interface Cached { at: number; from: LatLng; to: LatLng; route: LiveRoute }
const cache = new Map<string, Cached>();

/** Test hook: forget breaker, pause, rate-limit and cache state. */
export function resetRoutingState(): void {
  breaker.failures = 0;
  breaker.openUntil = 0;
  callWindow = { start: 0, calls: 0 };
  dayWindow = { day: "", calls: 0 };
  pausedUntil = 0;
  cache.clear();
}

function dailyLimit(): number {
  const n = Number(process.env.ROUTING_MAX_CALLS_PER_DAY);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_CALLS_PER_DAY;
}

/** Thrown to stop retries and pause routing; the message never contains the key. */
class RoutingPause extends Error {
  constructor(readonly ms: number) {
    super("routing paused");
  }
}

type Parsed = LiveRoute | null;

async function attemptOsrm(baseUrl: string, from: LatLng, to: LatLng): Promise<Parsed> {
  const url = `${baseUrl}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status >= 500) throw new Error(`routing ${res.status}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { routes?: Array<{ distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }> };
  const r = data.routes?.[0];
  if (!r || !Number.isFinite(r.distance) || !Number.isFinite(r.duration)) return null;
  return { distanceKm: Math.round(r.distance / 100) / 10, durationMin: Math.max(1, Math.round(r.duration / 60)), coordinates: thin(r.geometry?.coordinates ?? []), basis: "road-network" };
}

async function attemptOrs(cfg: RoutingConfig, from: LatLng, to: LatLng): Promise<Parsed> {
  const res = await fetch(`${cfg.baseUrl}/v2/directions/driving-car/geojson`, {
    method: "POST",
    headers: { Authorization: cfg.apiKey!, "Content-Type": "application/json", Accept: "application/geo+json", "User-Agent": UA },
    // ORS looks only 350 m from a point for a road by default. A pickup inside an airport terminal or a big building can be further, and
    // would then get no route at all (a labelled estimate instead). 1500 m is a bounded, generous search.
    body: JSON.stringify({ coordinates: [[from.lng, from.lat], [to.lng, to.lat]], radiuses: [ORS_SNAP_RADIUS_M, ORS_SNAP_RADIUS_M], instructions: false }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 429) {
    const reset = Number(res.headers.get("retry-after") ?? res.headers.get("x-ratelimit-reset"));
    // Retry-After is seconds; an implausible value falls back to one minute.
    const ms = Number.isFinite(reset) && reset > 0 && reset < 3600 ? reset * 1000 : 60_000;
    throw new RoutingPause(Math.min(ms, MAX_RATE_PAUSE_MS));
  }
  if (res.status === 401 || res.status === 403) throw new RoutingPause(KEY_REJECTED_PAUSE_MS);
  if (res.status >= 500) throw new Error(`routing ${res.status}`);
  // 404 = no route / point not near a road, 400 = bad request: a real answer, not a failure of the service.
  if (!res.ok) return null;
  const data = (await res.json()) as { features?: Array<{ properties?: { summary?: { distance?: number; duration?: number } }; geometry?: { coordinates?: [number, number][] } }> };
  const f = data.features?.[0];
  const sum = f?.properties?.summary;
  if (!f || typeof sum?.distance !== "number" || typeof sum.duration !== "number" || !Number.isFinite(sum.distance) || !Number.isFinite(sum.duration)) return null;
  return { distanceKm: Math.round(sum.distance / 100) / 10, durationMin: Math.max(1, Math.round(sum.duration / 60)), coordinates: thin(f.geometry?.coordinates ?? []), basis: "road-network" };
}

const attempt = (cfg: RoutingConfig, from: LatLng, to: LatLng): Promise<Parsed> => (cfg.provider === "ors" ? attemptOrs(cfg, from, to) : attemptOsrm(cfg.baseUrl!, from, to));

const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);

/**
 * Asks the routing service, with: a short timeout, at most one retry (network errors and 5xx only), a circuit breaker (three failed
 * rounds in a row pause routing for 30 s), provider pauses for 429 and rejected keys, and per-minute and per-day ceilings. Anything
 * that stops a call returns null and the caller uses the labelled estimate.
 */
async function fetchRoute(from: LatLng, to: LatLng, now = Date.now()): Promise<Parsed> {
  const cfg = routingConfig();
  if (!cfg.baseUrl) return null;
  if (now < breaker.openUntil || now < pausedUntil) return null;
  if (now - callWindow.start > 60_000) callWindow = { start: now, calls: 0 };
  if (callWindow.calls >= MAX_CALLS_PER_MINUTE) return null;
  const day = dayKey(now);
  if (dayWindow.day !== day) dayWindow = { day, calls: 0 };
  if (cfg.provider === "ors" && dayWindow.calls >= dailyLimit()) return null;
  callWindow.calls++;
  dayWindow.calls++;
  for (let i = 0; i <= RETRIES; i++) {
    try {
      const route = await attempt(cfg, from, to);
      breaker.failures = 0;
      return route;
    } catch (e) {
      if (e instanceof RoutingPause) {
        pausedUntil = now + e.ms;
        return null;
      }
      if (i < RETRIES) await new Promise((r) => setTimeout(r, 200));
    }
  }
  breaker.failures++;
  if (breaker.failures >= BREAKER_AFTER) breaker.openUntil = now + BREAKER_OPEN_MS;
  return null;
}

export interface RoutingHealth {
  provider: RoutingProvider;
  configured: boolean;
  isDemo: boolean;
  ok: boolean;
  latencyMs: number | null;
  breakerOpen: boolean;
  /** Calls made today by this server instance, against the daily ceiling (ORS only). */
  callsToday: number;
  dailyLimit: number | null;
  reason?: string;
}

/**
 * A real test route (Barcelona airport to the city centre) against the configured service; used by the admin health check. It
 * counts as one provider call. Never returns the key.
 */
export async function routingHealth(now = Date.now()): Promise<RoutingHealth> {
  const cfg = routingConfig();
  const base = {
    provider: cfg.provider,
    configured: cfg.baseUrl !== null,
    isDemo: cfg.isDemo,
    breakerOpen: now < breaker.openUntil || now < pausedUntil,
    callsToday: dayWindow.day === dayKey(now) ? dayWindow.calls : 0,
    dailyLimit: cfg.provider === "ors" ? dailyLimit() : null,
  };
  if (!cfg.baseUrl) return { ...base, ok: false, latencyMs: null, reason: cfg.reason };
  const t0 = Date.now();
  try {
    const r = await attempt(cfg, { lat: 41.2971, lng: 2.0785 }, { lat: 41.3874, lng: 2.1686 });
    return { ...base, ok: r !== null && r.distanceKm > 5 && r.distanceKm < 40, latencyMs: Date.now() - t0 };
  } catch (e) {
    const reason = e instanceof RoutingPause ? "the provider refused the request (rate limit or key)" : e instanceof Error ? e.message : "failed";
    return { ...base, ok: false, latencyMs: Date.now() - t0, reason };
  }
}

/** How far the start must move before a route is asked for again, and how old an answer may get. */
const MOVE_KM = 0.2;
const MAX_AGE_MS = 75_000;
/** The planned journey between two fixed points: kept for hours, not seconds. */
const STATIC_AGE_MS = 6 * 3600_000;
/** The labelled estimate is only reused briefly, so routing is tried again soon after it recovers. */
const FALLBACK_AGE_MS = 10_000;

/**
 * The route from `from` to `to`, reused while the start has not moved meaningfully and the answer is fresh. `key` identifies the leg
 * (ride id plus which leg): the passenger, driver and admin views share one key per leg so a ride costs about one routing call a
 * minute, not three. Never throws.
 */
export async function liveRoute(key: string, from: LatLng, to: LatLng, now = Date.now()): Promise<LiveRoute> {
  const hit = cache.get(key);
  const isStatic = key.endsWith(":trip");
  if (hit && haversineKm(hit.to, to) < 0.01 && haversineKm(hit.from, from) < (isStatic ? 0.01 : MOVE_KM)) {
    const limit = hit.route.basis === "estimate" ? FALLBACK_AGE_MS : isStatic ? STATIC_AGE_MS : MAX_AGE_MS;
    if (now - hit.at < limit) return hit.route;
  }
  let fresh: LiveRoute | null = null;
  try {
    fresh = await fetchRoute(from, to, now);
  } catch {
    fresh = null;
  }
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

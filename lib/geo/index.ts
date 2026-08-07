/**
 * Geocoding and road routing on open data — no API key, no billing account.
 *
 * Geocoding: Nominatim (OpenStreetMap)
 * Routing:   OSRM public demo server
 *
 * Both are free community infrastructure with usage policies rather than
 * contracts, which shapes the design here:
 *
 *  - Every call goes through the server, never the browser. Nominatim's policy
 *    requires a User-Agent identifying the application, and a browser will not
 *    let you set one. Calling it directly from the client also means one
 *    request per keystroke per visitor straight from their IP, which is exactly
 *    the "heavy use" the policy asks you not to do.
 *  - Results are cached hard. An address does not move, and a road route
 *    between two fixed points changes on the timescale of roadworks.
 *  - Requests are serialised to respect the 1 req/sec guidance.
 *  - Every function degrades instead of throwing. These are best-effort
 *    services with no SLA; a quote must still be produced when they are down.
 */

import { unstable_cache } from "next/cache";

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OSRM      = "https://router.project-osrm.org";

/** Identifies this application to Nominatim as their policy requires. */
const UA = "EliteBCNTransfers/1.0 (+https://www.elitebcn.info; vtcbcn2025@gmail.com)";

/**
 * Road-distance estimate used when OSRM is unreachable.
 *
 * Straight-line distance under-reads real driving distance; 1.35 is a
 * reasonable detour factor for Catalonia's road network. Defined once here
 * because this constant previously existed in two places with two different
 * companion speeds, so the same journey could be quoted two durations
 * depending on which code path produced it.
 */
export const DETOUR_FACTOR = 1.35;
export const FALLBACK_AVG_KMH = 50;

export interface LatLng { lat: number; lng: number }

export interface Place extends LatLng {
  label: string;
  /** Nominatim's own place id, useful as a stable React key. */
  id?: string;
}

export interface RouteDistance {
  distanceKm: number;
  durationMin: number;
  /** False when this came from the straight-line fallback rather than OSRM. */
  precise: boolean;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const l1 = (a.lat * Math.PI) / 180;
  const l2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(l1) * Math.cos(l2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Straight-line distance inflated to an estimated road distance. */
export function estimateRoad(a: LatLng, b: LatLng): RouteDistance {
  const distanceKm = Math.round(haversineKm(a, b) * DETOUR_FACTOR * 10) / 10;
  return {
    distanceKm,
    durationMin: Math.ceil((distanceKm / FALLBACK_AVG_KMH) * 60),
    precise: false,
  };
}

// ─── request serialisation ───────────────────────────────────────────────────

/**
 * Nominatim asks for at most one request per second. This chains calls through
 * a promise so concurrent callers queue rather than burst.
 *
 * On serverless each instance holds its own chain, so this is a courtesy rather
 * than a guarantee — the cache below is what actually keeps volume down.
 */
let chain: Promise<unknown> = Promise.resolve();
function serialise<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(() => new Promise((r) => setTimeout(r, 1100)), () => undefined);
  return run;
}

// ─── geocoding ───────────────────────────────────────────────────────────────

interface NominatimResult {
  place_id?: number;
  lat: string;
  lon: string;
  display_name: string;
}

async function searchUncached(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  try {
    const url =
      `${NOMINATIM}/search?q=${encodeURIComponent(q)}&format=json&limit=6` +
      // Biased to Spain and Andorra: this business does not drive anywhere else,
      // and an unbiased search happily returns a Barcelona in Venezuela.
      `&countrycodes=es,ad&addressdetails=0`;

    const res = await serialise(() =>
      fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "en" },
        signal: AbortSignal.timeout(6000),
      }),
    );
    if (!res.ok) return [];

    const data = (await res.json()) as NominatimResult[];
    return data
      .map((r) => ({
        lat: Number(r.lat),
        lng: Number(r.lon),
        label: r.display_name,
        id: r.place_id ? String(r.place_id) : undefined,
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  } catch {
    return [];
  }
}

/**
 * Address search for autocomplete. Cached for a week — the coordinates of a
 * street do not change, and the same handful of airports and hotels are
 * searched over and over.
 */
export const searchPlaces = unstable_cache(searchUncached, ["nominatim-search"], {
  revalidate: 604_800,
  tags: ["geo"],
});

/** First match for an address, or null. Never guesses a location. */
export async function geocode(address: string): Promise<Place | null> {
  const results = await searchPlaces(address);
  return results[0] ?? null;
}

// ─── routing ─────────────────────────────────────────────────────────────────

async function osrmUncached(
  fromLat: number, fromLng: number, toLat: number, toLng: number,
): Promise<RouteDistance | null> {
  try {
    // https, not http. This was previously called over plain http in one of the
    // two copies of this logic, which redirects and can drop the request.
    const url =
      `${OSRM}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;

    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { routes?: Array<{ distance: number; duration: number }> };
    const route = data.routes?.[0];
    if (!route || !Number.isFinite(route.distance)) return null;

    return {
      distanceKm:  Math.round(route.distance / 100) / 10,
      durationMin: Math.ceil(route.duration / 60),
      precise: true,
    };
  } catch {
    return null;
  }
}

const osrmCached = unstable_cache(osrmUncached, ["osrm-route"], {
  // A day. Road geometry between two fixed points is stable; this exists to
  // stop a popular route re-querying the public demo server on every quote.
  revalidate: 86_400,
  tags: ["geo"],
});

/**
 * Road distance between two points, always returning an answer.
 *
 * `precise` tells the caller whether this came from real road routing or the
 * straight-line estimate, so pricing can decide whether to trust it. Fixed-
 * matrix routes never reach here at all — the route table is authoritative.
 */
export async function roadDistance(from: LatLng, to: LatLng): Promise<RouteDistance> {
  const routed = await osrmCached(from.lat, from.lng, to.lat, to.lng);
  return routed ?? estimateRoad(from, to);
}

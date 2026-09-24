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
const UA = "EliteBCNTransfers/1.0 (+https://www.elitebcn.info; booking@elitebcn.info)";

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
  /** The whole thing on one line. What gets stored on the booking. */
  label: string;
  /** The first line in the picker: "Terminal 1", "Hotel Arts". */
  name?: string;
  /** The second line, enough to tell two places of the same name apart. */
  context?: string;
  /** Decides the icon beside the row. */
  kind?: PlaceKind;
  /** The source's own place id, useful as a stable React key. */
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

/**
 * Where this business drives, as a bounding box.
 *
 * Iberia, Andorra and southern France: the Costa Brava, Andorra, Lourdes and
 * the Pyrenees are all real destinations on the price table. It stops short of
 * Italy, which is what keeps "andora" meaning the principality rather than the
 * town in Liguria.
 *
 * minLon, minLat, maxLon, maxLat.
 */
const SERVICE_BBOX = "-9.8,35.5,4.6,44.5";

/** Barcelona. Results near here rank first, which is where the cars are. */
const HOME = { lat: 41.3851, lng: 2.1734 };

/**
 * Photon: OpenStreetMap data served by an index built for type-ahead.
 *
 * Nominatim is a geocoder, not a search engine, and it showed. It matched
 * literally, so one wrong letter returned nothing at all: "zaragosa" gave zero
 * results, which left the customer with an empty dropdown and — because the
 * quote geocodes the typed address when no suggestion was clicked — no price
 * either. It also had no notion of where the customer is, so "terminal 1"
 * returned Madrid Barajas and "camp nou" a village in the Alt Empordà.
 *
 * Photon is the same OSM data behind ElasticSearch, with fuzzy matching and a
 * proximity bias. All eight of the queries that failed above resolve correctly
 * through it. Free, no key, no rate limit published, same open licence.
 *
 * Nominatim stays as the fallback, so an outage at one degrades to the other
 * rather than to an empty field.
 */
const PHOTON = "https://photon.komoot.io";

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number; osm_key?: string; osm_value?: string;
    name?: string; housenumber?: string; street?: string;
    city?: string; district?: string; county?: string; state?: string;
    postcode?: string; country?: string; countrycode?: string;
  };
}

/**
 * The kind of place, for the icon the picker shows beside it.
 *
 * An airport, a hotel and a street corner are different enough errands that
 * telling them apart at a glance is most of what makes a long list scannable.
 */
export type PlaceKind = "airport" | "train" | "port" | "hotel" | "city" | "landmark" | "address";

function kindOf(key?: string, value?: string): PlaceKind {
  if (key === "aeroway" || value === "aerodrome" || value === "terminal") return "airport";
  if (key === "railway" || value === "station" || value === "bus_station") return "train";
  if (value === "ferry_terminal" || value === "harbour" || value === "port" || value === "cruise_terminal") return "port";
  if (value === "hotel" || value === "hostel" || value === "guest_house" || value === "apartments" || value === "resort") return "hotel";
  if (key === "place" && ["city", "town", "village", "suburb", "municipality", "hamlet"].includes(value ?? "")) return "city";
  if (key === "tourism" || key === "leisure" || key === "amenity" || key === "historic") return "landmark";
  return "address";
}

/**
 * A Photon feature as two readable lines.
 *
 * The old dropdown printed Nominatim's display_name whole, which for the
 * airport is ninety characters of administrative hierarchy ending in "España"
 * — truncated in the row, so every airport suggestion looked identical. The
 * name goes on the first line and just enough to disambiguate on the second.
 */
function photonPlace(f: PhotonFeature): Place | null {
  const c = f.geometry?.coordinates;
  const p = f.properties;
  if (!c || !p) return null;
  const [lng, lat] = c;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const name = p.name || street || p.city || p.county || p.state;
  if (!name) return null;

  const context = [
    p.name && street && street !== p.name ? street : null,
    p.district && p.district !== p.city ? p.district : null,
    p.city && p.city !== name ? p.city : null,
    p.county && !p.city && p.county !== name ? p.county : null,
    p.state && p.state !== name ? p.state : null,
    p.countrycode && p.countrycode !== "ES" ? p.country : null,
  ].filter(Boolean).join(", ");

  return {
    lat, lng,
    name,
    context,
    // The single-line form the rest of the system stores and prices from.
    label: context ? `${name}, ${context}` : name,
    kind: kindOf(p.osm_key, p.osm_value),
    id: p.osm_id ? `photon-${p.osm_id}` : undefined,
  };
}

/**
 * Five, and not more, because Photon re-ranks as this grows.
 *
 * Asking for eight moves a parish church in Sabadell above the Sagrada
 * Família for "sagrada famili" — reproducibly, the flip happening between
 * five and eight. Whatever it is doing inside, a longer list is a worse one
 * here, and five rows is as many as anyone reads in a dropdown anyway.
 */
const PHOTON_LIMIT = 5;

async function photonSearch(q: string): Promise<Place[]> {
  try {
    const url =
      `${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=${PHOTON_LIMIT}&lang=en` +
      // Rank by distance from Barcelona, then clip to where we actually drive.
      `&lat=${HOME.lat}&lon=${HOME.lng}&bbox=${SERVICE_BBOX}`;

    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { features?: PhotonFeature[] };
    const seen = new Set<string>();
    return (data.features ?? [])
      .map(photonPlace)
      .filter((p): p is Place => p !== null)
      // Photon returns a city and its centre point as separate features often
      // enough that the same line appears twice in the dropdown.
      .filter((p) => (seen.has(p.label) ? false : (seen.add(p.label), true)));
  } catch {
    return [];
  }
}

interface NominatimResult {
  place_id?: number;
  lat: string;
  lon: string;
  display_name: string;
}

async function nominatimSearch(q: string): Promise<Place[]> {
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
      .map((r) => {
        // display_name is "Name, Street, District, City, Province, Postcode,
        // España". The first part is the name; the rest, minus the country and
        // the postcode, is the context line.
        const parts = r.display_name.split(",").map((s) => s.trim()).filter(Boolean);
        const name = parts[0] ?? r.display_name;
        const context = parts.slice(1).filter((s) => !/^\d{5}$/.test(s) && s !== "España" && s !== "Spain").join(", ");
        return {
          lat: Number(r.lat),
          lng: Number(r.lon),
          name,
          context,
          label: r.display_name,
          kind: "address" as PlaceKind,
          id: r.place_id ? String(r.place_id) : undefined,
        };
      })
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  } catch {
    return [];
  }
}

async function searchUncached(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const photon = await photonSearch(q);
  if (photon.length > 0) return photon;

  // Photon down, or a query it genuinely has nothing for. Either way the
  // customer gets the older, stricter search rather than an empty field.
  return nominatimSearch(q);
}

/**
 * Address search for autocomplete. Cached for a week — the coordinates of a
 * street do not change, and the same handful of airports and hotels are
 * searched over and over.
 */
// The suffix is part of the cache key, so it has to change whenever the shape
// or the ranking of a result changes. A week-long cache otherwise keeps
// serving the previous version of this function's answers to everyone: the
// limit went from eight to five and the old eight-row answers stayed up.
export const searchPlaces = unstable_cache(searchUncached, ["place-search-v3-limit5"], {
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

/** 0,0 is in the Gulf of Guinea — for this business it means "not set". */
export function hasCoords(lat?: number | null, lng?: number | null): boolean {
  return Boolean(lat && lng && Number.isFinite(lat) && Number.isFinite(lng));
}

/**
 * Resolves an endpoint to coordinates, geocoding the address text when the
 * client did not supply any.
 *
 * The booking form only attaches coordinates when the customer picks a
 * suggestion from the autocomplete dropdown. Type a valid address and press on
 * without clicking one, and it posts 0,0 — which left the quote with no
 * distance to price from, so a perfectly ordinary journey came back as
 * "contact us" instead of a fare.
 *
 * Pricing must not depend on the customer having used the dropdown, so the
 * server resolves it either way. Returns null when the address cannot be
 * geocoded at all; that is a genuine "we cannot price this".
 */
export async function resolveEndpoint(
  lat: number | undefined | null,
  lng: number | undefined | null,
  address?: string | null,
): Promise<LatLng | null> {
  if (hasCoords(lat, lng)) return { lat: lat as number, lng: lng as number };
  if (!address?.trim()) return null;

  const place = await geocode(address);
  return place ? { lat: place.lat, lng: place.lng } : null;
}

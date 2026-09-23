import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// unstable_cache needs a Next.js request context that does not exist under
// vitest. Caching is Next's concern, not this module's -- these tests are about
// the request shape and the fallback behaviour, so it passes straight through.
vi.mock("next/cache", () => ({
  unstable_cache: <T,>(fn: T) => fn,
}));

import {
  haversineKm,
  estimateRoad,
  DETOUR_FACTOR,
  FALLBACK_AVG_KMH,
} from "@/lib/geo";

const BCN_AIRPORT = { lat: 41.2971, lng: 2.0785 };
const BCN_CENTRE  = { lat: 41.3851, lng: 2.1734 };
const SITGES      = { lat: 41.2243, lng: 1.8144 };

describe("haversineKm", () => {
  it("measures a known short hop", () => {
    // El Prat to the city centre is roughly 12 km straight-line.
    expect(haversineKm(BCN_AIRPORT, BCN_CENTRE)).toBeGreaterThan(11);
    expect(haversineKm(BCN_AIRPORT, BCN_CENTRE)).toBeLessThan(14);
  });

  it("measures a known longer hop", () => {
    // Airport to Sitges is roughly 22 km straight-line.
    expect(haversineKm(BCN_AIRPORT, SITGES)).toBeGreaterThan(20);
    expect(haversineKm(BCN_AIRPORT, SITGES)).toBeLessThan(25);
  });

  it("is zero for a point to itself and symmetric", () => {
    expect(haversineKm(BCN_CENTRE, BCN_CENTRE)).toBeCloseTo(0);
    expect(haversineKm(BCN_AIRPORT, SITGES)).toBeCloseTo(haversineKm(SITGES, BCN_AIRPORT));
  });
});

describe("estimateRoad", () => {
  it("inflates straight-line distance by the detour factor", () => {
    const straight = haversineKm(BCN_AIRPORT, BCN_CENTRE);
    const est = estimateRoad(BCN_AIRPORT, BCN_CENTRE);
    expect(est.distanceKm).toBeCloseTo(Math.round(straight * DETOUR_FACTOR * 10) / 10, 1);
  });

  it("marks itself as not precise so pricing knows it is an estimate", () => {
    expect(estimateRoad(BCN_AIRPORT, SITGES).precise).toBe(false);
  });

  it("derives duration from the single shared fallback speed", () => {
    // This constant used to exist twice with two different values (40 and 50
    // km/h), so the same journey quoted two durations depending on code path.
    const est = estimateRoad(BCN_AIRPORT, SITGES);
    expect(est.durationMin).toBe(Math.ceil((est.distanceKm / FALLBACK_AVG_KMH) * 60));
  });
});

describe("roadDistance", () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); vi.resetModules(); });
  afterEach(() => vi.unstubAllGlobals());

  it("uses OSRM road geometry when it answers", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [{ distance: 18_400, duration: 1_320 }] }),
    });
    const { roadDistance } = await import("@/lib/geo");
    const r = await roadDistance(BCN_AIRPORT, BCN_CENTRE);
    expect(r.distanceKm).toBe(18.4);
    expect(r.durationMin).toBe(22);
    expect(r.precise).toBe(true);
  });

  it("falls back to the estimate rather than failing when OSRM is down", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    const { roadDistance } = await import("@/lib/geo");
    const r = await roadDistance(BCN_AIRPORT, BCN_CENTRE);
    expect(r.precise).toBe(false);
    expect(r.distanceKm).toBeGreaterThan(0);
  });

  it("falls back when OSRM returns no route at all", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ routes: [] }) });
    const { roadDistance } = await import("@/lib/geo");
    const r = await roadDistance(BCN_AIRPORT, SITGES);
    expect(r.precise).toBe(false);
  });

  it("falls back when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const { roadDistance } = await import("@/lib/geo");
    const r = await roadDistance(BCN_AIRPORT, SITGES);
    expect(r.precise).toBe(false);
    expect(r.distanceKm).toBeGreaterThan(0);
  });

  it("calls OSRM over https", async () => {
    // One copy of this logic previously used plain http, which redirects.
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ routes: [{ distance: 1000, duration: 60 }] }) });
    const { roadDistance } = await import("@/lib/geo");
    await roadDistance(BCN_AIRPORT, BCN_CENTRE);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\//);
  });

  it("sends lng,lat order as OSRM expects, not lat,lng", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ routes: [{ distance: 1000, duration: 60 }] }) });
    const { roadDistance } = await import("@/lib/geo");
    await roadDistance(BCN_AIRPORT, BCN_CENTRE);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain(`${BCN_AIRPORT.lng},${BCN_AIRPORT.lat};${BCN_CENTRE.lng},${BCN_CENTRE.lat}`);
  });
});

describe("searchPlaces", () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); vi.resetModules(); });
  afterEach(() => vi.unstubAllGlobals());

  /** A Photon answer, which is GeoJSON rather than Nominatim's bare array. */
  const photon = (...features: object[]) => ({ ok: true, json: async () => ({ features }) });
  const feature = (lng: number, lat: number, properties: object) => ({ geometry: { coordinates: [lng, lat] }, properties });

  it("ignores a single character without calling out", async () => {
    const { searchPlaces } = await import("@/lib/geo");
    expect(await searchPlaces("a")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /** "T1" and "BCN" are both things customers type, and both used to be ignored. */
  it("searches on two characters", async () => {
    fetchMock.mockResolvedValue(photon(feature(2.07, 41.29, { name: "Terminal 1", city: "el Prat de Llobregat", osm_key: "aeroway" })));
    const { searchPlaces } = await import("@/lib/geo");
    expect(await searchPlaces("T1")).toHaveLength(1);
  });

  /**
   * Nominatim matched literally and knew nothing of where the customer is, so
   * "zaragosa" returned nothing at all and "terminal 1" returned Madrid.
   * Photon is asked first: fuzzy, and ranked from Barcelona outwards.
   */
  it("asks the type-ahead index first, from Barcelona and inside the service area", async () => {
    fetchMock.mockResolvedValue(photon());
    const { searchPlaces } = await import("@/lib/geo");
    await searchPlaces("zaragosa");

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("photon");
    expect(url).toContain("lat=41.3851");
    expect(url).toContain("lon=2.1734");
    // Iberia, Andorra and southern France; short of Italy, so "andora" is the
    // principality rather than the town in Liguria.
    expect(url).toContain("bbox=-9.8,35.5,4.6,44.5");
  });

  /**
   * Photon re-ranks as the limit grows: at eight, a parish church in Sabadell
   * outranks the Sagrada Família for "sagrada famili", reproducibly, with the
   * flip somewhere between five and eight. Raising this to show more choices
   * makes the first one wrong.
   */
  it("asks for five results, because more makes the ranking worse", () => {
    const src = readFileSync(join(__dirname, "..", "geo", "index.ts"), "utf-8");
    expect(src).toContain("const PHOTON_LIMIT = 5;");
    // The cache runs a week, so the key has to name the limit: changing one
    // without the other left the old eight-row answers being served live.
    expect(src).toMatch(/unstable_cache\(searchUncached, \["place-search-[^"]*limit5"\]/);
  });

  it("splits a result into the two lines the picker shows", async () => {
    fetchMock.mockResolvedValue(photon(
      feature(2.1962, 41.3874, { osm_id: 7, name: "Hotel Arts", street: "Carrer de la Marina", city: "Barcelona", state: "Catalonia", countrycode: "ES", osm_value: "hotel" }),
    ));
    const { searchPlaces } = await import("@/lib/geo");
    const [p] = await searchPlaces("hotel arts");

    expect(p.name).toBe("Hotel Arts");
    expect(p.context).toBe("Carrer de la Marina, Barcelona, Catalonia");
    // The one-line form is what gets stored on the booking and priced from.
    expect(p.label).toBe("Hotel Arts, Carrer de la Marina, Barcelona, Catalonia");
    expect(p.kind).toBe("hotel");
    expect(p).toMatchObject({ lat: 41.3874, lng: 2.1962 });
  });

  it("names the kind of place, so an airport is not drawn as a street corner", async () => {
    fetchMock.mockResolvedValue(photon(
      feature(2.07, 41.29, { name: "Terminal 1", osm_key: "aeroway", osm_value: "terminal" }),
      feature(2.14, 41.38, { name: "Barcelona Sants", osm_key: "railway", osm_value: "station" }),
      feature(2.18, 41.37, { name: "Port de Barcelona", osm_value: "ferry_terminal" }),
      feature(-0.88, 41.65, { name: "Zaragoza", osm_key: "place", osm_value: "city" }),
    ));
    const { searchPlaces } = await import("@/lib/geo");
    expect((await searchPlaces("x")).length).toBe(0); // below the minimum
    expect((await searchPlaces("xx")).map((p) => p.kind)).toEqual(["airport", "train", "port", "city"]);
  });

  it("does not list the same place twice", async () => {
    fetchMock.mockResolvedValue(photon(
      feature(-0.88, 41.65, { name: "Zaragoza", state: "Aragon" }),
      feature(-0.87, 41.66, { name: "Zaragoza", state: "Aragon" }),
    ));
    const { searchPlaces } = await import("@/lib/geo");
    expect(await searchPlaces("zaragosa")).toHaveLength(1);
  });

  /**
   * One free community service being down must not empty the field, because an
   * empty field is a booking that cannot be priced.
   */
  it("falls back to the older search when the first returns nothing", async () => {
    fetchMock
      .mockResolvedValueOnce(photon())
      .mockResolvedValueOnce({ ok: true, json: async () => [{ place_id: 3, lat: "41.65", lon: "-0.88", display_name: "Zaragoza, Aragón, 50001, España" }] });
    const { searchPlaces } = await import("@/lib/geo");
    const out = await searchPlaces("zaragoza");

    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Zaragoza");
    // The postcode and the country are dropped: they do not tell two places apart.
    expect(out[0].context).toBe("Aragón");

    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("countrycodes=es,ad");
    // Nominatim's usage policy requires a User-Agent naming the application.
    expect((init as RequestInit).headers).toMatchObject({
      "User-Agent": expect.stringContaining("EliteBCNTransfers"),
    });
  });

  it("falls back when the first search errors outright", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("photon down"))
      .mockResolvedValueOnce({ ok: true, json: async () => [{ lat: "41.65", lon: "-0.88", display_name: "Zaragoza" }] });
    const { searchPlaces } = await import("@/lib/geo");
    expect(await searchPlaces("zaragoza")).toHaveLength(1);
  });

  it("maps results and drops any with unusable coordinates", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        { place_id: 1, lat: "41.4036", lon: "2.1744", display_name: "Sagrada Família, Barcelona" },
        { place_id: 2, lat: "not-a-number", lon: "2.0", display_name: "Broken" },
      ],
    });
    const { searchPlaces } = await import("@/lib/geo");
    const out = await searchPlaces("sagrada familia");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ lat: 41.4036, lng: 2.1744, id: "1" });
  });

  it("returns an empty list instead of throwing when Nominatim errors", async () => {
    fetchMock.mockRejectedValue(new Error("blocked"));
    const { searchPlaces } = await import("@/lib/geo");
    expect(await searchPlaces("anywhere")).toEqual([]);
  });
});

describe("resolveEndpoint", () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); vi.resetModules(); });
  afterEach(() => vi.unstubAllGlobals());

  it("uses supplied coordinates without calling out", async () => {
    const { resolveEndpoint } = await import("@/lib/geo");
    const r = await resolveEndpoint(41.2971, 2.0785, "Terminal 1");
    expect(r).toEqual({ lat: 41.2971, lng: 2.0785 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("geocodes the address when the client sent 0,0", async () => {
    // The booking form only attaches coordinates when the customer clicks a
    // dropdown suggestion. Typing an address and moving on posts 0,0, which
    // left a per-km journey with no distance and quoted "contact us".
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ place_id: 9, lat: "41.4500", lon: "1.9720", display_name: "Sant Andreu de la Barca" }],
    });
    const { resolveEndpoint } = await import("@/lib/geo");
    const r = await resolveEndpoint(0, 0, "Sant Andreu de la Barca");
    expect(r).toEqual({ lat: 41.45, lng: 1.972 });
  });

  it("treats missing and null coordinates the same as 0,0", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ lat: "41.45", lon: "1.97", display_name: "Somewhere" }],
    });
    const { resolveEndpoint } = await import("@/lib/geo");
    expect(await resolveEndpoint(undefined, undefined, "Somewhere")).toEqual({ lat: 41.45, lng: 1.97 });
    expect(await resolveEndpoint(null, null, "Somewhere")).toEqual({ lat: 41.45, lng: 1.97 });
  });

  it("returns null when there is nothing to work from", async () => {
    const { resolveEndpoint } = await import("@/lib/geo");
    expect(await resolveEndpoint(0, 0, "")).toBeNull();
    expect(await resolveEndpoint(0, 0, undefined)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when the address cannot be geocoded", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    const { resolveEndpoint } = await import("@/lib/geo");
    expect(await resolveEndpoint(0, 0, "qqqzzz not a place")).toBeNull();
  });
});

describe("hasCoords", () => {
  it("treats 0,0 as unset", async () => {
    const { hasCoords } = await import("@/lib/geo");
    // 0,0 is in the Gulf of Guinea; for a Barcelona transfer it means "not set".
    expect(hasCoords(0, 0)).toBe(false);
    expect(hasCoords(41.4, 0)).toBe(false);
    expect(hasCoords(41.4, 2.1)).toBe(true);
    expect(hasCoords(NaN, 2.1)).toBe(false);
    expect(hasCoords(undefined, undefined)).toBe(false);
  });
});

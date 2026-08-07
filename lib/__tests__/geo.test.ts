import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

  it("ignores queries below the minimum length without calling out", async () => {
    const { searchPlaces } = await import("@/lib/geo");
    expect(await searchPlaces("ab")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("identifies the application and biases to Spain and Andorra", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    const { searchPlaces } = await import("@/lib/geo");
    await searchPlaces("sagrada familia");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("countrycodes=es,ad");
    // Nominatim's usage policy requires a User-Agent naming the application.
    expect((init as RequestInit).headers).toMatchObject({
      "User-Agent": expect.stringContaining("EliteBCNTransfers"),
    });
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

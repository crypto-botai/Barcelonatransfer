import { afterEach, describe, expect, it, vi } from "vitest";
import { arrivalAt, freshness, liveRoute, thin } from "@/lib/geo/live-route";

const A = { lat: 41.39, lng: 2.17 };
const B = { lat: 41.4, lng: 2.19 };

function osrm(distance: number, duration: number) {
  return { ok: true, json: async () => ({ routes: [{ distance, duration, geometry: { coordinates: [[2.17, 41.39], [2.19, 41.4]] } }] }) } as Response;
}

afterEach(() => vi.restoreAllMocks());

describe("liveRoute", () => {
  it("returns the road line, distance and time, labelled as road-network (no traffic)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(osrm(3200, 420));
    const r = await liveRoute("t1:leg", A, B);
    expect(r).toMatchObject({ distanceKm: 3.2, durationMin: 7, basis: "road-network" });
    expect(r.coordinates).toHaveLength(2);
  });

  it("reuses the answer until the car has moved about 150 m or a minute has passed", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(osrm(3200, 420));
    await liveRoute("t2:leg", A, B, 1_000);
    await liveRoute("t2:leg", { lat: A.lat + 0.0003, lng: A.lng }, B, 5_000);
    expect(spy).toHaveBeenCalledTimes(1);
    await liveRoute("t2:leg", { lat: A.lat + 0.01, lng: A.lng }, B, 6_000);
    expect(spy).toHaveBeenCalledTimes(2);
    await liveRoute("t2:leg", { lat: A.lat + 0.01, lng: A.lng }, B, 80_000);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("falls back to a labelled straight-line estimate when the routing service fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    const r = await liveRoute("t3:leg", A, B);
    expect(r.basis).toBe("estimate");
    expect(r.coordinates).toEqual([]);
    expect(r.durationMin).toBeGreaterThan(0);
  });
});

describe("helpers", () => {
  it("thins long lines but keeps both ends", () => {
    const line = Array.from({ length: 1000 }, (_, i) => [i, i] as [number, number]);
    const out = thin(line, 100);
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([999, 999]);
  });

  it("grades GPS freshness", () => {
    expect(freshness(10)).toBe("live");
    expect(freshness(90)).toBe("delayed");
    expect(freshness(400)).toBe("stale");
  });

  it("adds the driving time to now", () => {
    expect(arrivalAt(10, Date.UTC(2026, 0, 1, 10, 0))).toBe("2026-01-01T10:10:00.000Z");
  });
});

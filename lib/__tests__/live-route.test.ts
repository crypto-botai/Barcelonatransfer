import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_OSRM_DEMO, arrivalAt, freshness, liveRoute, resetRoutingState, routingConfig, routingHealth, thin } from "@/lib/geo/live-route";

const A = { lat: 41.39, lng: 2.17 };
const B = { lat: 41.4, lng: 2.19 };

function osrm(distance: number, duration: number) {
  return { ok: true, status: 200, json: async () => ({ routes: [{ distance, duration, geometry: { coordinates: [[2.17, 41.39], [2.19, 41.4]] } }] }) } as Response;
}
const status = (code: number) => ({ ok: code < 400, status: code, json: async () => ({}) }) as Response;

beforeEach(() => {
  resetRoutingState();
  delete process.env.ROUTING_BASE_URL;
  delete process.env.ROUTING_ALLOW_PUBLIC_DEMO;
});
afterEach(() => vi.restoreAllMocks());

describe("routingConfig: production can never silently use the public demo", () => {
  const prod = { NODE_ENV: "production" } as Record<string, string>;

  it("outside production the demo is the default so local work needs no setup", () => {
    expect(routingConfig({ NODE_ENV: "development" })).toEqual({ baseUrl: PUBLIC_OSRM_DEMO, isDemo: true });
  });

  it("in production an unset address switches routing off instead of falling back to the demo", () => {
    const c = routingConfig(prod);
    expect(c.baseUrl).toBeNull();
    expect(c.reason).toMatch(/not set/);
  });

  it("in production the demo address is refused unless allowed on purpose", () => {
    expect(routingConfig({ ...prod, ROUTING_BASE_URL: PUBLIC_OSRM_DEMO }).baseUrl).toBeNull();
    expect(routingConfig({ ...prod, ROUTING_BASE_URL: PUBLIC_OSRM_DEMO + "/" }).baseUrl).toBeNull();
    expect(routingConfig({ ...prod, ROUTING_ALLOW_PUBLIC_DEMO: "1" }).baseUrl).toBe(PUBLIC_OSRM_DEMO);
  });

  it("in production plain http and garbage are refused; a self-hosted https server is accepted", () => {
    expect(routingConfig({ ...prod, ROUTING_BASE_URL: "http://10.0.0.5:5000" }).baseUrl).toBeNull();
    expect(routingConfig({ ...prod, ROUTING_BASE_URL: "not a url" }).baseUrl).toBeNull();
    expect(routingConfig({ ...prod, ROUTING_BASE_URL: "https://routing.elitebcn.info/" })).toEqual({ baseUrl: "https://routing.elitebcn.info", isDemo: false });
  });
});

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

  it("retries once on a network error or a 5xx, then succeeds", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("reset")).mockResolvedValueOnce(osrm(1000, 120));
    expect((await liveRoute("t4:leg", A, B)).basis).toBe("road-network");
    expect(spy).toHaveBeenCalledTimes(2);
    const spy2 = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(status(503)).mockResolvedValueOnce(osrm(1000, 120));
    expect((await liveRoute("t5:leg", { lat: 41.5, lng: 2.2 }, B)).basis).toBe("road-network");
    expect(spy2).toHaveBeenCalled();
  });

  it("does not retry a clean 'no route' answer (4xx or empty)", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(status(400));
    expect((await liveRoute("t6:leg", A, B)).basis).toBe("estimate");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("a timeout counts as a failure and ends in the estimate", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    expect((await liveRoute("t7:leg", A, B)).basis).toBe("estimate");
  });

  it("opens a circuit breaker after three failed rounds and stops calling the server for a while", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    for (let i = 0; i < 3; i++) await liveRoute(`b${i}:leg`, A, B, 1_000 + i);
    const callsAtOpen = spy.mock.calls.length;
    await liveRoute("b9:leg", A, B, 5_000);
    expect(spy.mock.calls.length).toBe(callsAtOpen);
    // after the breaker window the server is tried again
    spy.mockResolvedValue(osrm(1000, 120));
    expect((await liveRoute("b10:leg", A, B, 40_000)).basis).toBe("road-network");
  });

  it("caps calls per minute so GPS traffic cannot become routing traffic", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(osrm(1000, 120));
    for (let i = 0; i < 60; i++) await liveRoute(`c${i}:leg`, A, B, 1_000);
    expect(spy.mock.calls.length).toBe(40);
  });

  it("never calls the network in production when routing is not configured, and says so with the estimate label", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(osrm(1000, 120));
    expect((await liveRoute("p1:leg", A, B)).basis).toBe("estimate");
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("the estimate is only reused for a few seconds, so routing is tried again soon after recovery", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("x")).mockRejectedValueOnce(new Error("x")).mockResolvedValue(osrm(1000, 120));
    expect((await liveRoute("r1:leg", A, B, 1_000)).basis).toBe("estimate");
    expect((await liveRoute("r1:leg", A, B, 5_000)).basis).toBe("estimate");
    expect((await liveRoute("r1:leg", A, B, 20_000)).basis).toBe("road-network");
    expect(spy).toHaveBeenCalled();
  });
});

describe("routingHealth", () => {
  it("reports healthy for a sensible airport-to-centre route", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(osrm(14100, 1200));
    expect(await routingHealth()).toMatchObject({ configured: true, ok: true });
  });

  it("reports unhealthy when the server fails, or answers nonsense", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    expect(await routingHealth()).toMatchObject({ ok: false });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(osrm(100, 10));
    expect(await routingHealth()).toMatchObject({ ok: false });
  });

  it("reports not configured in production without an address", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await routingHealth()).toMatchObject({ configured: false, ok: false });
    vi.unstubAllEnvs();
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

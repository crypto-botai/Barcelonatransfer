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
  delete process.env.ROUTING_PROVIDER;
  delete process.env.ORS_API_KEY;
  delete process.env.ORS_BASE_URL;
  delete process.env.ROUTING_MAX_CALLS_PER_DAY;
});
afterEach(() => vi.restoreAllMocks());

describe("routingConfig: production can never silently use the public demo", () => {
  const prod = { NODE_ENV: "production" } as Record<string, string>;

  it("outside production the demo is the default so local work needs no setup", () => {
    expect(routingConfig({ NODE_ENV: "development" })).toMatchObject({ baseUrl: PUBLIC_OSRM_DEMO, isDemo: true });
  });

  it("in production an unset address switches routing off instead of falling back to the demo", () => {
    const c = routingConfig(prod);
    expect(c.baseUrl).toBeNull();
    expect(c.reason).toMatch(/no routing provider is configured/);
  });

  it("in production the demo address is refused, and no setting can turn it back on", () => {
    for (const extra of [{}, { ROUTING_ALLOW_PUBLIC_DEMO: "1" }, { ROUTING_ALLOW_PUBLIC_DEMO: "true" }]) {
      expect(routingConfig({ ...prod, ...extra, ROUTING_BASE_URL: PUBLIC_OSRM_DEMO }).baseUrl).toBeNull();
      expect(routingConfig({ ...prod, ...extra, ROUTING_BASE_URL: PUBLIC_OSRM_DEMO + "/" }).baseUrl).toBeNull();
      expect(routingConfig({ ...prod, ...extra, ROUTING_BASE_URL: "https://ROUTER.project-osrm.org/route" }).baseUrl).toBeNull();
      expect(routingConfig({ ...prod, ...extra }).baseUrl).toBeNull();
    }
  });

  it("the demo is available only when NODE_ENV is not production (local development and tests)", () => {
    expect(routingConfig({ NODE_ENV: "development" }).baseUrl).toBe(PUBLIC_OSRM_DEMO);
    expect(routingConfig({ NODE_ENV: "test" }).baseUrl).toBe(PUBLIC_OSRM_DEMO);
    expect(routingConfig({}).baseUrl).toBe(PUBLIC_OSRM_DEMO);
    expect(routingConfig({ NODE_ENV: "production" }).baseUrl).toBeNull();
  });

  it("in production plain http and garbage are refused; a self-hosted https server is accepted", () => {
    expect(routingConfig({ ...prod, ROUTING_BASE_URL: "http://10.0.0.5:5000" }).baseUrl).toBeNull();
    expect(routingConfig({ ...prod, ROUTING_BASE_URL: "not a url" }).baseUrl).toBeNull();
    expect(routingConfig({ ...prod, ROUTING_BASE_URL: "https://routing.elitebcn.info/" })).toMatchObject({ baseUrl: "https://routing.elitebcn.info", isDemo: false });
  });
});

describe("liveRoute", () => {
  it("returns the road line, distance and time, labelled as road-network (no traffic)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(osrm(3200, 420));
    const r = await liveRoute("t1:leg", A, B);
    expect(r).toMatchObject({ distanceKm: 3.2, durationMin: 7, basis: "road-network" });
    expect(r.coordinates).toHaveLength(2);
  });

  it("reuses the answer until the car has moved about 200 m or 75 seconds have passed", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(osrm(3200, 420));
    await liveRoute("t2:leg", A, B, 1_000);
    await liveRoute("t2:leg", { lat: A.lat + 0.0003, lng: A.lng }, B, 5_000);
    expect(spy).toHaveBeenCalledTimes(1);
    await liveRoute("t2:leg", { lat: A.lat + 0.01, lng: A.lng }, B, 6_000);
    expect(spy).toHaveBeenCalledTimes(2);
    await liveRoute("t2:leg", { lat: A.lat + 0.01, lng: A.lng }, B, 90_000);
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

  it("caps calls per minute (30, under ORS's 40) so GPS traffic cannot become routing traffic", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(osrm(1000, 120));
    for (let i = 0; i < 60; i++) await liveRoute(`c${i}:leg`, A, B, 1_000);
    expect(spy.mock.calls.length).toBe(30);
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


/* ───────────────────────────── OpenRouteService ───────────────────────────── */

const KEY = "ors-test-key-not-a-real-secret-0123456789";
const orsEnv = () => {
  process.env.ROUTING_PROVIDER = "ors";
  process.env.ORS_API_KEY = KEY;
};
function orsOk(distance = 3200, duration = 420) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ type: "FeatureCollection", features: [{ properties: { summary: { distance, duration } }, geometry: { coordinates: [[2.17, 41.39], [2.19, 41.4]] } }] }),
  } as Response;
}
const orsStatus = (code: number, headers: Record<string, string> = {}) => ({ ok: code < 400, status: code, headers: new Headers(headers), json: async () => ({ error: { code: 1, message: "x" } }) }) as Response;

describe("routingConfig with OpenRouteService", () => {
  const prod = { NODE_ENV: "production", ROUTING_PROVIDER: "ors" } as Record<string, string>;

  it("needs the key: without it routing is off and never falls back to another provider", () => {
    const c = routingConfig(prod);
    expect(c.baseUrl).toBeNull();
    expect(c.provider).toBe("ors");
    expect(c.reason).toMatch(/ORS_API_KEY/);
    expect(routingConfig({ ...prod, ROUTING_BASE_URL: "https://routing.example.com" }).baseUrl).toBeNull();
  });

  it("works in production with a key, over https only", () => {
    expect(routingConfig({ ...prod, ORS_API_KEY: KEY })).toMatchObject({ provider: "ors", baseUrl: "https://api.openrouteservice.org", isDemo: false });
    expect(routingConfig({ ...prod, ORS_API_KEY: KEY, ORS_BASE_URL: "http://ors.internal:8082" }).baseUrl).toBeNull();
    expect(routingConfig({ ...prod, ORS_API_KEY: KEY, ORS_BASE_URL: "https://ors.example.com/" }).baseUrl).toBe("https://ors.example.com");
    expect(routingConfig({ ...prod, ORS_API_KEY: KEY, ORS_BASE_URL: "nonsense" }).baseUrl).toBeNull();
  });

  it("an unknown provider name means OSRM, whose production rules still refuse the public demo", () => {
    expect(routingConfig({ NODE_ENV: "production", ROUTING_PROVIDER: "other" }).baseUrl).toBeNull();
    expect(routingConfig({ NODE_ENV: "production", ROUTING_PROVIDER: "other", ROUTING_BASE_URL: PUBLIC_OSRM_DEMO }).baseUrl).toBeNull();
  });
});

describe("liveRoute with OpenRouteService", () => {
  beforeEach(orsEnv);

  it("posts [lng, lat] pairs with the key in the Authorization header and never in the URL or body", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(orsOk());
    const r = await liveRoute("o1:to-pickup", A, B);
    expect(r).toMatchObject({ distanceKm: 3.2, durationMin: 7, basis: "road-network" });
    expect(r.coordinates).toHaveLength(2);
    const [url, init] = spy.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.openrouteservice.org/v2/directions/driving-car/geojson");
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>).Authorization).toBe(KEY);
    expect(String(init.body)).not.toContain(KEY);
    expect(JSON.parse(String(init.body))).toEqual({ coordinates: [[A.lng, A.lat], [B.lng, B.lat]], radiuses: [1500, 1500], instructions: false });
    expect(init.method).toBe("POST");
  });

  it("falls back to the labelled estimate on errors, timeouts, empty answers and a missing route (404)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    expect((await liveRoute("o2:to-pickup", A, B)).basis).toBe("estimate");
    resetRoutingState();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(orsStatus(404));
    expect((await liveRoute("o3:to-pickup", A, B)).basis).toBe("estimate");
    resetRoutingState();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, headers: new Headers(), json: async () => ({ features: [] }) } as Response);
    expect((await liveRoute("o4:to-pickup", A, B)).basis).toBe("estimate");
  });

  it("retries once on a 5xx and then succeeds", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(orsStatus(503)).mockResolvedValueOnce(orsOk());
    expect((await liveRoute("o5:to-pickup", A, B)).basis).toBe("road-network");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("pauses routing when ORS says 429, honouring Retry-After, and uses the estimate meanwhile", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(orsStatus(429, { "retry-after": "30" }));
    expect((await liveRoute("p1:to-pickup", A, B, 1_000)).basis).toBe("estimate");
    expect(spy).toHaveBeenCalledTimes(1);
    expect((await liveRoute("p2:to-pickup", A, B, 20_000)).basis).toBe("estimate");
    expect(spy).toHaveBeenCalledTimes(1); // still paused
    spy.mockResolvedValue(orsOk());
    expect((await liveRoute("p3:to-pickup", A, B, 40_000)).basis).toBe("road-network"); // 1_000 + 30_000 has passed
  });

  it("a rejected key (401 or 403) pauses routing for ten minutes instead of hammering the service", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(orsStatus(401));
    await liveRoute("k1:to-pickup", A, B, 1_000);
    await liveRoute("k2:to-pickup", A, B, 120_000);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockResolvedValue(orsOk());
    expect((await liveRoute("k3:to-pickup", A, B, 700_000)).basis).toBe("road-network");
  });

  it("stops calling ORS at the daily ceiling and shows the estimate until the next day", async () => {
    process.env.ROUTING_MAX_CALLS_PER_DAY = "5";
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(orsOk());
    const day1 = Date.UTC(2026, 9, 13, 10, 0);
    for (let i = 0; i < 8; i++) await liveRoute(`d${i}:to-pickup`, A, B, day1 + i * 61_000);
    expect(spy).toHaveBeenCalledTimes(5);
    expect((await liveRoute("d9:to-pickup", A, B, day1 + 600_000)).basis).toBe("estimate");
    expect((await liveRoute("d10:to-pickup", A, B, day1 + 24 * 3600_000)).basis).toBe("road-network");
  });

  it("the planned journey is cached for hours; the leg to the next stop for about a minute", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(orsOk());
    await liveRoute("t9:trip", A, B, 1_000);
    await liveRoute("t9:trip", A, B, 3 * 3600_000);
    expect(spy).toHaveBeenCalledTimes(1);
    await liveRoute("t9:to-pickup", A, B, 1_000);
    await liveRoute("t9:to-pickup", A, B, 50_000);
    expect(spy).toHaveBeenCalledTimes(2);
    await liveRoute("t9:to-pickup", A, B, 80_000);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("the passenger, driver and admin views of one leg share one cache entry, so one ride is one call a minute", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(orsOk());
    await liveRoute("same:to-pickup", A, B, 1_000);
    await liveRoute("same:to-pickup", { lat: A.lat + 0.0005, lng: A.lng }, B, 2_000);
    await liveRoute("same:to-pickup", { lat: A.lat + 0.001, lng: A.lng }, B, 3_000);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("health: healthy with a sensible answer, 'refused' on 401 or 429, not configured without a key, and never contains the key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(orsOk(14100, 1200));
    const ok = await routingHealth();
    expect(ok).toMatchObject({ provider: "ors", configured: true, ok: true, dailyLimit: 1800 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(orsStatus(401));
    const bad = await routingHealth();
    expect(bad.ok).toBe(false);
    expect(JSON.stringify([ok, bad])).not.toContain(KEY);
    delete process.env.ORS_API_KEY;
    expect(await routingHealth()).toMatchObject({ configured: false, ok: false });
  });

  it("never throws, whatever the provider does", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("synchronous failure");
    });
    await expect(liveRoute("n1:to-pickup", A, B)).resolves.toMatchObject({ basis: "estimate" });
  });
});

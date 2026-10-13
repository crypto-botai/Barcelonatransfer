import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/v1/driver/rides/:id/flight: a driver gets the flight of their own ride, and only that. The website's lookup and the
 * ownership checks are replaced by controllable stand-ins; what is tested is what the route does with them.
 */
const state = vi.hoisted(() => ({
  ride: null as null | { id: string; confirmationCode: string; flightNumber: string | null },
  lookups: [] as string[],
  lookup: { status: 200, json: { tracked: true, status: { flightNumber: "IB3456", state: "en_route" } } as Record<string, unknown> },
}));

vi.mock("@/lib/api/v1/driver-rides", async () => {
  const { ApiError } = await import("@/lib/api/v1/errors");
  return {
    requireDriver: async (userId: string) => {
      if (userId !== "u-driver") throw new ApiError("FORBIDDEN", "Your driver account is not active.");
      return { id: "drv1" };
    },
    requireDriverRide: async (id: string, driverId: string) => {
      if (!state.ride || state.ride.id !== id || driverId !== "drv1") throw new ApiError("NOT_FOUND", "We could not find that ride.");
      return state.ride;
    },
  };
});

vi.mock("@/app/api/flights/status/route", () => ({
  GET: async (req: Request) => {
    state.lookups.push(new URL(req.url).search);
    return new Response(JSON.stringify(state.lookup.json), { status: state.lookup.status, headers: { "content-type": "application/json" } });
  },
}));

import { MemoryRateLimiter, setRateLimiter } from "@/lib/api/v1/rate-limit";
import { setAuditSink } from "@/lib/api/v1/audit";
import { mobileAuthConfig, signAccessToken } from "@/lib/api/v1/tokens";
import { GET } from "@/app/api/v1/driver/rides/[id]/flight/route";

let ip = 0;
const token = (userId: string, role: string) => signAccessToken({ userId, role: role as never, sessionId: "s1" }, mobileAuthConfig());
const call = async (id: string, who?: { userId: string; role: string }) =>
  GET(new Request(`http://localhost/api/v1/driver/rides/${id}/flight`, { headers: { "x-forwarded-for": `10.9.0.${++ip}`, ...(who ? { authorization: `Bearer ${await token(who.userId, who.role)}` } : {}) } }), { params: Promise.resolve({ id }) });
const json = async (r: Response) => (await r.json()) as { ok: boolean; data?: Record<string, any>; error?: { code: string } };
const driver = { userId: "u-driver", role: "DRIVER" };

beforeEach(() => {
  process.env.MOBILE_JWT_SECRET = "test-only-mobile-secret-0123456789abcdef";
  delete process.env.NEXTAUTH_SECRET;
  setRateLimiter(new MemoryRateLimiter());
  setAuditSink(async () => {});
  state.ride = { id: "b1", confirmationCode: "ELT-AB12", flightNumber: "IB3456" };
  state.lookups.length = 0;
  state.lookup = { status: 200, json: { tracked: true, status: { flightNumber: "IB3456", state: "en_route" } } };
});

describe("driver flight status", () => {
  it("returns the live flight for the driver's own ride, asking the website lookup with that ride's code", async () => {
    const res = await call("b1", driver);
    expect(res.status).toBe(200);
    expect((await json(res)).data).toMatchObject({ tracked: true, status: { flightNumber: "IB3456", state: "en_route" } });
    expect(state.lookups).toEqual(["?bookingId=b1&code=ELT-AB12"]);
  });

  it("does not spend a lookup on a ride with no flight number", async () => {
    state.ride = { id: "b1", confirmationCode: "ELT-AB12", flightNumber: null };
    expect((await json(await call("b1", driver))).data).toEqual({ tracked: false, reason: "no_flight_number" });
    expect(state.lookups).toHaveLength(0);
  });

  it("shows 'not tracked' rather than an error when the lookup is unavailable", async () => {
    state.lookup = { status: 500, json: { error: "provider down" } };
    const res = await call("b1", driver);
    expect(res.status).toBe(200);
    expect((await json(res)).data).toEqual({ tracked: false, reason: "unavailable" });
  });

  it("another driver's ride is not found, and nothing is looked up", async () => {
    const res = await call("someone-elses", driver);
    expect(res.status).toBe(404);
    expect(state.lookups).toHaveLength(0);
  });

  it("customers and signed-out callers are refused", async () => {
    expect((await call("b1", { userId: "u-customer", role: "CUSTOMER" })).status).toBe(403);
    expect((await call("b1")).status).toBe(401);
    expect(state.lookups).toHaveLength(0);
  });
});

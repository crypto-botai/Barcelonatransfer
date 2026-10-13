import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin side of live tracking: who may open the live fleet and the routing health check, what the fleet endpoint returns about
 * a passenger, what the access log keeps, and what the retention job deletes.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const state = vi.hoisted(() => ({
  session: null as null | { user: { role?: string; id?: string; name?: string } },
  bookings: [] as Row[],
  fixes: {} as Record<string, Row | null>,
  logs: [] as Row[],
  deleteWhere: null as Row | null,
  clearWhere: null as Row | null,
  clearData: null as Row | null,
  driverWhere: null as Row | null,
  driverData: null as Row | null,
}));

vi.mock("next-auth", () => ({ getServerSession: async () => state.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/geo/live-route", async (orig) => {
  const real = await orig<typeof import("@/lib/geo/live-route")>();
  return {
    ...real,
    routingHealth: async () => ({ configured: true, isDemo: false, ok: true, latencyMs: 40, breakerOpen: false }),
    liveRoute: async () => ({ distanceKm: 3, durationMin: 6, coordinates: [[2.1, 41.3], [2.2, 41.4]] as [number, number][], basis: "road-network" as const }),
  };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findMany: async () => state.bookings,
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        state.clearWhere = where;
        state.clearData = data;
        return { count: 2 };
      },
    },
    rideTracking: {
      findFirst: async ({ where }: { where: Row }) => state.fixes[where.bookingId] ?? null,
      deleteMany: async ({ where }: { where: Row }) => {
        state.deleteWhere = where;
        return { count: 5 };
      },
    },
    driver: {
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        state.driverWhere = where;
        state.driverData = data;
        return { count: 3 };
      },
    },
    activityLog: { create: async ({ data }: { data: Row }) => { state.logs.push(data); return data; } },
  },
}));

import { GET as liveFleet } from "@/app/api/admin/live-fleet/route";
import { GET as routingHealthRoute } from "@/app/api/admin/routing-health/route";
import { GET as purge } from "@/app/api/cron/purge-tracking/route";

const ADMIN = { user: { role: "ADMIN", id: "a1", name: "Office" } };
const base = (over: Row = {}): Row => ({
  id: "r1", confirmationCode: "ABC123", status: "IN_PROGRESS", rideStage: "ON_THE_WAY", pickupDatetime: new Date(),
  pickupAddress: "BCN T1", pickupLat: 41.29, pickupLng: 2.07, dropoffAddress: "Hotel Arts", dropoffLat: 41.38, dropoffLng: 2.19,
  customerLat: 41.35, customerLng: 2.15, customerLocatedAt: new Date(),
  driver: { id: "d1", user: { name: "Omar", phone: "+34600" }, vehicles: [{ make: "Mercedes", model: "V-Class", licensePlate: "1234 ABC" }] },
  ...over,
});

beforeEach(() => {
  state.session = null;
  state.bookings = [base()];
  state.fixes = { r1: { lat: 41.3, lng: 2.1, speed: 8, heading: 90, createdAt: new Date(Date.now() - 4000) } };
  state.logs = [];
  state.deleteWhere = state.clearWhere = state.clearData = state.driverWhere = state.driverData = null;
  process.env.CRON_SECRET = "cron-test-secret";
});

describe("/api/admin/live-fleet and /api/admin/routing-health", () => {
  it("refuse anyone who is not signed in as an administrator", async () => {
    for (const session of [null, { user: { role: "CUSTOMER", id: "c1" } }, { user: { role: "DRIVER", id: "d1" } }, { user: { id: "x" } }]) {
      state.session = session;
      expect((await liveFleet()).status).toBe(401);
      expect((await routingHealthRoute()).status).toBe(401);
    }
    expect(state.logs).toHaveLength(0);
  });

  it("give an administrator the active rides with driver freshness, the road leg and the passenger only while sharing", async () => {
    state.session = ADMIN;
    const res = await liveFleet();
    expect(res.status).toBe(200);
    const body = await res.json();
    const r = body.rides[0];
    expect(r).toMatchObject({ code: "ABC123", stage: "ON_THE_WAY", trackingState: "live", driver: { name: "Omar", plate: "1234 ABC" } });
    expect(r.position).toMatchObject({ lat: 41.3, lng: 2.1 });
    expect(r.leg).toMatchObject({ toward: "PICKUP", minutes: 6, basis: "road-network" });
    expect(r.customer).toMatchObject({ lat: 41.35, lng: 2.15 });
  });

  it("hide the passenger when they are not sharing, when sharing is stale, and after it is switched off", async () => {
    state.session = ADMIN;
    for (const patch of [{ customerLat: null, customerLng: null, customerLocatedAt: null }, { customerLocatedAt: new Date(Date.now() - 5 * 60_000) }]) {
      state.bookings = [base(patch)];
      const body = await (await liveFleet()).json();
      expect(body.rides[0].customer).toBeNull();
      expect(JSON.stringify(body)).not.toContain("41.35");
    }
    expect(state.logs).toHaveLength(0);
  });

  it("report no signal, delayed and stale GPS honestly, and never invent a position", async () => {
    state.session = ADMIN;
    state.fixes = { r1: null };
    let r = (await (await liveFleet()).json()).rides[0];
    expect(r.trackingState).toBe("no-signal");
    expect(r.position).toBeNull();
    expect(r.leg).toBeNull();
    state.fixes = { r1: { lat: 41.3, lng: 2.1, speed: 0, heading: 0, createdAt: new Date(Date.now() - 60_000) } };
    r = (await (await liveFleet()).json()).rides[0];
    expect(r.trackingState).toBe("delayed");
    state.fixes = { r1: { lat: 41.3, lng: 2.1, speed: 0, heading: 0, createdAt: new Date(Date.now() - 10 * 60_000) } };
    r = (await (await liveFleet()).json()).rides[0];
    expect(r.trackingState).toBe("stale");
  });

  it("log that passenger positions were viewed, with a count and no coordinates", async () => {
    state.session = ADMIN;
    await liveFleet();
    expect(state.logs).toHaveLength(1);
    expect(state.logs[0]).toMatchObject({ action: "VIEW_LIVE_CUSTOMER_LOCATIONS", adminId: "a1", details: { rides: 1 } });
    const text = JSON.stringify(state.logs[0]);
    for (const coordinate of ["41.35", "2.15", "41.3", "2.1"]) expect(text).not.toContain(`"${coordinate}"`);
    expect(text).not.toMatch(/lat|lng/i);
  });

  it("do not route a ride that is arrived or waiting (the car is already there)", async () => {
    state.session = ADMIN;
    state.bookings = [base({ rideStage: "ARRIVED" })];
    expect((await (await liveFleet()).json()).rides[0].leg).toBeNull();
  });

  it("the routing health check answers an administrator only", async () => {
    state.session = ADMIN;
    expect(await (await routingHealthRoute()).json()).toMatchObject({ configured: true, ok: true });
  });
});

describe("/api/cron/purge-tracking", () => {
  const call = (secret?: string) => purge(new Request("http://localhost/api/cron/purge-tracking", { headers: secret ? { authorization: `Bearer ${secret}` } : {} }) as never);

  it("needs the cron secret; without one set, nobody gets in", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("wrong")).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await call("cron-test-secret")).status).toBe(401);
    expect((await call("undefined")).status).toBe(401);
    expect(state.deleteWhere).toBeNull();
  });

  it("deletes driver GPS older than 30 days and clears passenger positions on finished or old bookings", async () => {
    const before = Date.now();
    const res = await call("cron-test-secret");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deletedTrackingRows: 5, clearedCustomerLocations: 2, clearedDriverPositions: 3 });
    const cutoff = (state.deleteWhere!.createdAt.lt as Date).getTime();
    expect(before - cutoff).toBeGreaterThanOrEqual(30 * 86_400_000 - 5000);
    expect(before - cutoff).toBeLessThan(31 * 86_400_000);
    expect(state.clearWhere!.OR[0].status.in).toEqual(["COMPLETED", "CANCELLED", "REFUNDED"]);
    expect(state.clearWhere!.OR[1].customerLocatedAt.lt).toBeInstanceOf(Date);
    expect(state.clearData).toEqual({ customerLat: null, customerLng: null, customerLocatedAt: null });
    // a driver's last-known position is cleared when it is more than a day old (or was never timestamped)
    expect(state.driverWhere!.currentLat).toEqual({ not: null });
    expect(state.driverWhere!.OR[0]).toEqual({ lastLocationAt: null });
    expect(before - (state.driverWhere!.OR[1].lastLocationAt.lt as Date).getTime()).toBeGreaterThanOrEqual(24 * 3600_000 - 5000);
    expect(state.driverData).toEqual({ currentLat: null, currentLng: null });
  });
});

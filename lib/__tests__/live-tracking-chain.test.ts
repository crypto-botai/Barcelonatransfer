import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The whole live-tracking chain through the REAL route handlers on one in-memory database (no phones, no network):
 *
 *   driver app  POST /api/v1/driver/location  ->  website tracking handler (/api/tracking)  ->  ride_tracking row
 *   customer app GET  /api/v1/rides/:id/track  <- same row
 *   admin map    GET  /api/admin/live-fleet    <- same row
 *
 * Only the database, the session library and the outbound routing HTTP call are replaced. This proves the pieces fit together in
 * code; it does not prove anything about real GPS hardware, Android background behaviour, the real database or the real routing
 * provider. Those are in docs/LIVE_TRACKING_DEVICE_TESTS.md.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const db = vi.hoisted(() => ({
  bookings: [] as Row[],
  drivers: [] as Row[],
  users: [] as Row[],
  tracking: [] as Row[],
  logs: [] as Row[],
  adminSession: null as null | { user: { role: string; id: string; name: string } },
}));

vi.mock("next-auth", () => ({ getServerSession: async () => db.adminSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => {
  const byWhere = (b: Row, where: Row) => Object.entries(where).every(([k, v]) => (typeof v === "object" && v !== null ? true : b[k] === v));
  return {
    prisma: {
      booking: {
        findFirst: async ({ where }: { where: Row }) => db.bookings.find((b) => byWhere(b, where)) ?? null,
        findUnique: async ({ where }: { where: Row }) => db.bookings.find((b) => b.id === where.id) ?? null,
        findMany: async () => db.bookings.filter((b) => ["DRIVER_ASSIGNED", "IN_PROGRESS"].includes(b.status)),
        update: async ({ where, data }: { where: Row; data: Row }) => Object.assign(db.bookings.find((b) => b.id === where.id)!, data),
      },
      driver: {
        findUnique: async ({ where }: { where: Row }) => db.drivers.find((d) => (where.userId ? d.userId === where.userId : d.id === where.id)) ?? null,
        update: async ({ where, data }: { where: Row; data: Row }) => Object.assign(db.drivers.find((d) => d.id === where.id)!, data),
      },
      user: { findUnique: async ({ where }: { where: Row }) => db.users.find((u) => u.id === where.id) ?? null },
      rideTracking: {
        create: async ({ data }: { data: Row }) => {
          const row = { ...data, createdAt: data.createdAt ?? new Date() };
          db.tracking.push(row);
          return row;
        },
        findFirst: async ({ where }: { where: Row }) => [...db.tracking].reverse().find((t) => t.bookingId === where.bookingId) ?? null,
      },
      activityLog: { create: async ({ data }: { data: Row }) => { db.logs.push(data); return data; }, findFirst: async () => null, findMany: async () => [] },
      $transaction: async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
    },
  };
});

import { MemoryRateLimiter, setRateLimiter } from "@/lib/api/v1/rate-limit";
import { setAuditSink } from "@/lib/api/v1/audit";
import { mobileAuthConfig, signAccessToken } from "@/lib/api/v1/tokens";
import { resetRoutingState } from "@/lib/geo/live-route";
import { POST as driverLocation } from "@/app/api/v1/driver/location/route";
import { GET as customerTrack } from "@/app/api/v1/rides/[id]/track/route";
import { POST as shareLocation } from "@/app/api/v1/rides/[id]/location/route";
import { GET as driverRide } from "@/app/api/v1/driver/rides/[id]/route";
import { POST as stage } from "@/app/api/v1/driver/rides/[id]/stage/route";
import { GET as liveFleet } from "@/app/api/admin/live-fleet/route";

vi.mock("@/app/api/driver/ride/route", async () => {
  const { prisma } = await import("@/lib/prisma");
  return {
    PATCH: async (req: Request) => {
      const { bookingId, stage: st } = (await req.json()) as { bookingId: string; stage: string };
      await prisma.booking.update({ where: { id: bookingId }, data: { rideStage: st as never, status: st === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS" } });
      return Response.json({ ok: true, status: st === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS" });
    },
  };
});

let n = 0;
const token = (userId: string, role: string) => signAccessToken({ userId, role: role as never, sessionId: "s1" }, mobileAuthConfig());
async function call(handler: (r: Request, c?: { params?: Promise<Record<string, string>> }) => Promise<Response>, who: [string, string] | null, opts: { method?: string; body?: unknown; id?: string; path?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": `10.2.0.${++n}` };
  if (who) headers.authorization = `Bearer ${await token(who[0], who[1])}`;
  const res = await handler(new Request(`http://localhost${opts.path ?? "/x"}`, { method: opts.method ?? "GET", headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }), opts.id ? { params: Promise.resolve({ id: opts.id }) } : undefined);
  return { status: res.status, json: (await res.json()) as { data?: Row; error?: { code: string } } };
}

const ANA: [string, string] = ["c1", "CUSTOMER"];
const BEN: [string, string] = ["c2", "CUSTOMER"];
const OMAR: [string, string] = ["du1", "DRIVER"];
const LEO: [string, string] = ["du2", "DRIVER"];

beforeEach(() => {
  process.env.MOBILE_JWT_SECRET = "test-only-mobile-secret-0123456789abcdef";
  process.env.NEXTAUTH_SECRET = "test-only-nextauth-secret-0123456789";
  setRateLimiter(new MemoryRateLimiter());
  setAuditSink(async () => {});
  resetRoutingState();
  db.bookings.length = db.drivers.length = db.users.length = db.tracking.length = db.logs.length = 0;
  db.adminSession = null;
  db.drivers.push({ id: "d1", userId: "du1", status: "ONLINE", partnerId: null, rating: 4.8, totalRides: 10 }, { id: "d2", userId: "du2", status: "ONLINE", partnerId: null, rating: 4, totalRides: 1 });
  db.users.push(
    { id: "c1", email: "ana@example.com", name: "Ana", role: "CUSTOMER" },
    { id: "c2", email: "ben@example.com", name: "Ben", role: "CUSTOMER" },
    { id: "du1", email: "omar@example.com", name: "Omar", role: "DRIVER" },
    { id: "du2", email: "leo@example.com", name: "Leo", role: "DRIVER" },
  );
  db.bookings.push({
    id: "r1", confirmationCode: "EBC-TEST0001", status: "DRIVER_ASSIGNED", rideStage: null, rideStageAt: null,
    pickupAddress: "BCN T1", pickupLat: 41.2971, pickupLng: 2.0785, dropoffAddress: "Hotel Arts", dropoffLat: 41.3869, dropoffLng: 2.1965,
    pickupDatetime: new Date(Date.now() + 20 * 60_000), vehicleClass: "BUSINESS", passengers: 2, luggage: 1, flightNumber: null, specialRequests: null,
    guestName: "Ana", guestPhone: "+34600", userId: "c1", driverId: "d1", isDeleted: false, totalAmount: 90, paymentStatus: "PAID", paymentMethod: null,
    balanceAmount: null, balancePaidAt: null, protectionFee: 0, durationMin: 0, baseFare: 80, rating: null, review: null, createdAt: new Date(), driverAmount: 50,
    driverAssignedAt: new Date(), driverResponse: "ACCEPTED", driverRespondedAt: new Date(), driverResponseBy: "d1",
    customerLat: null, customerLng: null, customerLocatedAt: null, returnOfId: null, partnerId: null,
    driver: { id: "d1", rating: 4.8, user: { name: "Omar", phone: "+34600999" }, vehicles: [] },
    rideEvents: [],
  });
});

const fix = (over: Row = {}) => ({ bookingId: "r1", lat: 41.31, lng: 2.09, speed: 8, heading: 80, accuracy: 9, at: Date.now() - 1000, ...over });

describe("driver GPS -> backend -> customer map -> admin map, through the real handlers", () => {
  it("a fix from the assigned driver reaches the customer and the admin, and nobody else", async () => {
    db.bookings[0].rideStage = "ON_THE_WAY";
    db.bookings[0].status = "IN_PROGRESS";
    expect((await call(driverLocation, OMAR, { method: "POST", body: fix() })).status).toBe(200);
    expect(db.tracking).toHaveLength(1);
    expect(db.drivers[0]).toMatchObject({ currentLat: 41.31 });

    const seen = (await call(customerTrack, ANA, { id: "r1" })).json.data!;
    expect(seen).toMatchObject({ live: true, toward: "PICKUP", freshness: "live" });
    expect(seen.point).toMatchObject({ lat: 41.31, lng: 2.09, heading: 80 });

    db.adminSession = { user: { role: "ADMIN", id: "a1", name: "Office" } };
    const fleet = await (await liveFleet()).json();
    expect(fleet.rides[0]).toMatchObject({ code: "EBC-TEST0001", trackingState: "live", position: { lat: 41.31, lng: 2.09 } });

    // someone else's customer account, another driver and a signed-out caller get nothing
    expect((await call(customerTrack, BEN, { id: "r1" })).status).toBe(404);
    expect((await call(driverLocation, LEO, { method: "POST", body: fix() })).status).toBe(404);
    expect(db.tracking).toHaveLength(1);
    db.adminSession = null;
    expect((await liveFleet()).status).toBe(401);
  });

  it("a ride that has not started shows nothing to the customer even though the driver already sends fixes (within the hour before pickup)", async () => {
    expect((await call(driverLocation, OMAR, { method: "POST", body: fix() })).status).toBe(200);
    expect((await call(customerTrack, ANA, { id: "r1" })).json.data).toMatchObject({ live: false });
  });

  it("ORS failing, rate-limited, rejecting the key or not configured never interrupts GPS: positions are still stored and shown, labelled as an estimate", async () => {
    db.bookings[0].rideStage = "ON_THE_WAY";
    db.bookings[0].status = "IN_PROGRESS";
    process.env.ROUTING_PROVIDER = "ors";
    process.env.ORS_API_KEY = "chain-test-key-not-real-0123456789";
    for (const behaviour of ["network", "429", "401", "500", "unconfigured"]) {
      resetRoutingState();
      if (behaviour === "unconfigured") delete process.env.ORS_API_KEY;
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        if (behaviour === "network") throw new Error("down");
        return { ok: false, status: Number(behaviour), headers: new Headers(), json: async () => ({}) } as Response;
      });
      const before = db.tracking.length;
      expect((await call(driverLocation, OMAR, { method: "POST", body: fix({ lat: 41.31 + before * 0.001 }) })).status).toBe(200);
      expect(db.tracking.length).toBe(before + 1);
      const seen = (await call(customerTrack, ANA, { id: "r1" })).json.data!;
      expect(seen.live).toBe(true);
      expect(seen.point).toBeTruthy();
      expect(seen.basis).toBe("estimate");
      expect(seen.trafficAware).toBe(false);
      expect(seen.route.toNextStop).toEqual([]);
      expect((await call(driverRide, OMAR, { id: "r1" })).status).toBe(200);
      vi.restoreAllMocks();
    }
    delete process.env.ROUTING_PROVIDER;
    delete process.env.ORS_API_KEY;
  });

  it("with ORS answering, the customer gets the road line and an arrival time, and the key is only ever in the request header", async () => {
    db.bookings[0].rideStage = "ON_THE_WAY";
    db.bookings[0].status = "IN_PROGRESS";
    process.env.ROUTING_PROVIDER = "ors";
    process.env.ORS_API_KEY = "chain-test-key-not-real-0123456789";
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true, status: 200, headers: new Headers(),
      json: async () => ({ features: [{ properties: { summary: { distance: 6000, duration: 600 } }, geometry: { coordinates: [[2.09, 41.31], [2.0785, 41.2971]] } }] }),
    } as Response);
    await call(driverLocation, OMAR, { method: "POST", body: fix() });
    const res = await call(customerTrack, ANA, { id: "r1" });
    expect(res.json.data).toMatchObject({ basis: "road-network", etaMinutes: 10, roadKm: 6, trafficAware: false });
    expect(typeof res.json.data!.eta.pickupAt).toBe("string");
    expect(JSON.stringify(res.json)).not.toContain("chain-test-key");
    expect(spy.mock.calls.every(([url]) => !String(url).includes("chain-test-key"))).toBe(true);
    vi.restoreAllMocks();
    delete process.env.ROUTING_PROVIDER;
    delete process.env.ORS_API_KEY;
  });

  it("stale GPS: customer and admin both call it stale and the arrival time disappears from the data the screen uses only when the age is over two minutes", async () => {
    db.bookings[0].rideStage = "ON_THE_WAY";
    db.bookings[0].status = "IN_PROGRESS";
    await call(driverLocation, OMAR, { method: "POST", body: fix() });
    db.tracking[0].createdAt = new Date(Date.now() - 5 * 60_000);
    const seen = (await call(customerTrack, ANA, { id: "r1" })).json.data!;
    expect(seen.freshness).toBe("stale");
    expect(seen.ageSeconds).toBeGreaterThanOrEqual(300);
    db.adminSession = { user: { role: "ADMIN", id: "a1", name: "Office" } };
    expect((await (await liveFleet()).json()).rides[0].trackingState).toBe("stale");
  });

  it("the passenger's consent: nothing is shared until they send it, the driver sees it only while fresh, and stopping or completion deletes it", async () => {
    db.bookings[0].rideStage = "ON_THE_WAY";
    db.bookings[0].status = "IN_PROGRESS";
    expect((await call(driverRide, OMAR, { id: "r1" })).json.data!.customerLocation).toBeNull();
    db.adminSession = { user: { role: "ADMIN", id: "a1", name: "Office" } };
    expect((await (await liveFleet()).json()).rides[0].customer).toBeNull();

    expect((await call(shareLocation, ANA, { method: "POST", body: { lat: 41.35, lng: 2.15, accuracy: 12, at: Date.now() }, id: "r1" })).status).toBe(200);
    expect((await call(driverRide, OMAR, { id: "r1" })).json.data!.customerLocation).toMatchObject({ lat: 41.35 });
    expect((await (await liveFleet()).json()).rides[0].customer).toMatchObject({ lat: 41.35 });
    expect(db.logs.some((l) => l.action === "VIEW_LIVE_CUSTOMER_LOCATIONS")).toBe(true);
    expect(JSON.stringify(db.logs)).not.toContain("41.35");

    // another customer cannot read or clear it; another driver cannot read it
    expect((await call(shareLocation, BEN, { method: "POST", body: { lat: 1, lng: 1 }, id: "r1" })).status).toBe(404);
    expect((await call(driverRide, LEO, { id: "r1" })).status).toBe(404);

    // completion deletes it
    expect((await call(stage, OMAR, { method: "POST", body: { stage: "COMPLETED" }, id: "r1" })).status).toBe(200);
    expect(db.bookings[0]).toMatchObject({ customerLat: null, customerLng: null, customerLocatedAt: null, status: "COMPLETED" });
  });

  it("after completion the customer sees no position, the driver cannot send more, and the admin map no longer lists the ride", async () => {
    db.bookings[0].rideStage = "ON_THE_WAY";
    db.bookings[0].status = "IN_PROGRESS";
    await call(driverLocation, OMAR, { method: "POST", body: fix() });
    expect((await call(stage, OMAR, { method: "POST", body: { stage: "COMPLETED" }, id: "r1" })).status).toBe(200);
    expect((await call(customerTrack, ANA, { id: "r1" })).json.data).toMatchObject({ live: false });
    expect((await call(driverLocation, OMAR, { method: "POST", body: fix() })).status).toBe(409);
    db.adminSession = { user: { role: "ADMIN", id: "a1", name: "Office" } };
    expect((await (await liveFleet()).json()).rides).toHaveLength(0);
  });

  it("reassigning the ride to another driver cuts the first driver off at once", async () => {
    db.bookings[0].rideStage = "ON_THE_WAY";
    db.bookings[0].status = "IN_PROGRESS";
    db.bookings[0].driverId = "d2";
    db.bookings[0].driverResponseBy = "d2";
    expect((await call(driverLocation, OMAR, { method: "POST", body: fix() })).status).toBe(404);
    expect((await call(driverRide, OMAR, { id: "r1" })).status).toBe(404);
  });
});

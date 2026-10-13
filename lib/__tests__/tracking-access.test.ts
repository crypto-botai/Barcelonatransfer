import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Public tracking access: the signed token that replaces the bare confirmation code for position requests, the legacy code path that
 * is kept for old links, the failed-guess limiter, what the public page reveals, and the website driver route's own checks.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const s = vi.hoisted(() => ({
  session: null as null | { user: { id?: string; role?: string } },
  booking: null as Row | null,
  drivers: [] as Row[],
  fix: null as Row | null,
  trailAsked: 0,
  writes: [] as Row[],
}));

vi.mock("next-auth", () => ({ getServerSession: async () => s.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/request-session", () => ({ getRequestSession: async () => s.session }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findUnique: async () => s.booking,
      findFirst: async ({ where }: { where: Row }) => (s.booking && where.driverId === s.booking.driverId ? s.booking : null),
    },
    driver: {
      findUnique: async ({ where }: { where: { userId: string } }) => s.drivers.find((d) => d.userId === where.userId) ?? null,
      update: async () => ({}),
    },
    fleetPartner: { findUnique: async () => null },
    rideTracking: {
      findFirst: async () => s.fix,
      findMany: async () => { s.trailAsked++; return [{ lat: 1, lng: 1 }]; },
      create: async ({ data }: { data: Row }) => { s.writes.push(data); return data; },
    },
    $transaction: async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
  },
}));

import { GET as trackingGet, POST as trackingPost } from "@/app/api/tracking/route";
import TrackPage from "@/app/track/[code]/page";
import { codeAccessAllowed, recordFailure, resetTrackingLimiter, safeEqual, signTrackingToken, tooManyFailures, verifyTrackingToken } from "@/lib/tracking-access";
import { generateConfirmationCode } from "@/lib/utils";

const CODE = "EBC-ABCD1234";
const pickup = () => new Date(Date.now() + 30 * 60_000);
const get = (qs: string, ip = "10.0.0.1") => trackingGet(new NextRequest(`http://localhost/api/tracking?${qs}`, { headers: { "x-forwarded-for": ip } }));
const post = (body: unknown) => trackingPost(new NextRequest("http://localhost/api/tracking", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "test-only-nextauth-secret-0123456789";
  delete process.env.TRACKING_ALLOW_CODE;
  resetTrackingLimiter();
  s.session = null;
  s.booking = { id: "b1", userId: "u-cust", driverId: "d1", partnerId: null, confirmationCode: CODE, status: "IN_PROGRESS", isDeleted: false, pickupDatetime: pickup() };
  s.drivers = [{ id: "d1", userId: "u-d1" }, { id: "d2", userId: "u-d2" }];
  s.fix = { lat: 41.3, lng: 2.1, speed: 5, heading: 90, createdAt: new Date() };
  s.trailAsked = 0;
  s.writes = [];
});

describe("tracking tokens", () => {
  it("verify for their own booking until 12 hours after pickup, and for no other booking", () => {
    const at = new Date(Date.UTC(2026, 9, 13, 10, 0));
    const t = signTrackingToken("b1", at, Date.UTC(2026, 9, 13, 9, 0));
    expect(verifyTrackingToken(t, "b1", Date.UTC(2026, 9, 13, 9, 30))).toBe(true);
    expect(verifyTrackingToken(t, "b1", Date.UTC(2026, 9, 13, 21, 59))).toBe(true);
    expect(verifyTrackingToken(t, "b1", Date.UTC(2026, 9, 13, 22, 1))).toBe(false);
    expect(verifyTrackingToken(t, "b2", Date.UTC(2026, 9, 13, 9, 30))).toBe(false);
  });

  it("are valid for at least an hour even for a ride booked for right now or in the past", () => {
    const now = Date.UTC(2026, 9, 13, 10, 0);
    const t = signTrackingToken("b1", new Date(now - 20 * 3600_000), now);
    expect(verifyTrackingToken(t, "b1", now + 30 * 60_000)).toBe(true);
  });

  it("reject tampering, other secrets and garbage", () => {
    const t = signTrackingToken("b1", pickup());
    const [payload, sig] = t.split(".") as [string, string];
    const forged = Buffer.from(JSON.stringify({ b: "b1", x: Date.now() + 1e12 })).toString("base64url");
    expect(verifyTrackingToken(`${forged}.${sig}`, "b1")).toBe(false);
    expect(verifyTrackingToken(`${payload}.AAAA`, "b1")).toBe(false);
    expect(verifyTrackingToken("", "b1")).toBe(false);
    expect(verifyTrackingToken("nope", "b1")).toBe(false);
    process.env.NEXTAUTH_SECRET = "a-different-secret-entirely-0123456789";
    expect(verifyTrackingToken(t, "b1")).toBe(false);
  });

  it("fail closed when the server secret is missing", () => {
    const t = signTrackingToken("b1", pickup());
    delete process.env.NEXTAUTH_SECRET;
    expect(verifyTrackingToken(t, "b1")).toBe(false);
  });

  it("compare in constant time and treat different lengths as unequal", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("the limiter blocks after 20 wrong attempts per client and forgets after ten minutes", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 20; i++) recordFailure("c1", t0 + i);
    expect(tooManyFailures("c1", t0 + 100)).toBe(true);
    expect(tooManyFailures("c2", t0 + 100)).toBe(false);
    expect(tooManyFailures("c1", t0 + 11 * 60_000)).toBe(false);
  });

  it("the code path is on by default and can be switched off", () => {
    expect(codeAccessAllowed({})).toBe(true);
    expect(codeAccessAllowed({ TRACKING_ALLOW_CODE: "0" })).toBe(false);
  });
});

describe("GET /api/tracking with a token or a code", () => {
  const token = () => signTrackingToken("b1", pickup());

  it("a valid token shows the car; the old code link keeps working", async () => {
    expect((await get(`bookingId=b1&t=${encodeURIComponent(token())}`)).status).toBe(200);
    expect((await get(`bookingId=b1&code=${CODE}`)).status).toBe(200);
  });

  it("a token for another booking, an expired token and a wrong code are refused", async () => {
    const other = signTrackingToken("b2", pickup());
    expect((await get(`bookingId=b1&t=${encodeURIComponent(other)}`)).status).toBe(401);
    const old = signTrackingToken("b1", new Date(Date.now() - 40 * 3600_000), Date.now() - 40 * 3600_000);
    expect((await get(`bookingId=b1&t=${encodeURIComponent(old)}`)).status).toBe(401);
    expect((await get("bookingId=b1&code=EBC-WRONG000")).status).toBe(401);
  });

  it("with TRACKING_ALLOW_CODE=0 the code stops working but the token and the signed-in owner still do", async () => {
    process.env.TRACKING_ALLOW_CODE = "0";
    expect((await get(`bookingId=b1&code=${CODE}`)).status).toBe(401);
    expect((await get(`bookingId=b1&t=${encodeURIComponent(token())}`)).status).toBe(200);
    s.session = { user: { id: "u-cust", role: "CUSTOMER" } };
    expect((await get("bookingId=b1")).status).toBe(200);
  });

  it("an unknown booking answers exactly like a wrong credential", async () => {
    const wrong = await get("bookingId=b1&code=EBC-WRONG000");
    s.booking = null;
    const unknown = await get("bookingId=nope&code=EBC-WRONG000");
    expect(unknown.status).toBe(wrong.status);
    expect(await unknown.json()).toEqual(await wrong.json());
  });

  it("a deleted booking is not readable, even with its code", async () => {
    s.booking!.isDeleted = true;
    expect((await get(`bookingId=b1&code=${CODE}`)).status).toBe(401);
  });

  it("repeated wrong guesses from one client are cut off with 429, other clients are unaffected", async () => {
    for (let i = 0; i < 20; i++) expect((await get(`bookingId=b1&code=EBC-BAD${i}`, "9.9.9.9")).status).toBe(401);
    expect((await get(`bookingId=b1&code=${CODE}`, "9.9.9.9")).status).toBe(429);
    expect((await get(`bookingId=b1&code=${CODE}`, "8.8.8.8")).status).toBe(200);
  });

  it("shows nothing once the ride is over, even with a valid token", async () => {
    for (const status of ["COMPLETED", "CANCELLED", "REFUNDED"]) {
      s.booking!.status = status;
      expect(await (await get(`bookingId=b1&t=${encodeURIComponent(token())}`)).json()).toEqual({ live: false, status });
    }
  });

  it("the trail (where the car has been) is for staff, the assigned driver and the dispatching partner only", async () => {
    await get(`bookingId=b1&trail=1&t=${encodeURIComponent(token())}`);
    await get(`bookingId=b1&trail=1&code=${CODE}`);
    s.session = { user: { id: "u-cust", role: "CUSTOMER" } };
    await get("bookingId=b1&trail=1");
    expect(s.trailAsked).toBe(0);
    s.session = { user: { id: "u-a", role: "ADMIN" } };
    await get("bookingId=b1&trail=1");
    expect(s.trailAsked).toBe(1);
    s.session = { user: { id: "u-d1", role: "DRIVER" } };
    await get("bookingId=b1&trail=1");
    expect(s.trailAsked).toBe(2);
  });
});

describe("POST /api/tracking (website driver route)", () => {
  beforeEach(() => {
    s.session = { user: { id: "u-d1", role: "DRIVER" } };
  });
  const fix = { bookingId: "b1", lat: 41.3, lng: 2.1 };

  it("takes a fresh position for the assigned driver on a live ride", async () => {
    expect((await post({ ...fix, accuracy: 10, at: Date.now() - 1000 })).status).toBe(200);
    expect(s.writes).toHaveLength(1);
  });

  it("refuses an unassigned driver, a non-driver and no session", async () => {
    s.session = { user: { id: "u-d2", role: "DRIVER" } };
    expect((await post(fix)).status).toBe(403);
    s.session = { user: { id: "u-cust", role: "CUSTOMER" } };
    expect((await post(fix)).status).toBe(401);
    s.session = null;
    expect((await post(fix)).status).toBe(401);
    expect(s.writes).toHaveLength(0);
  });

  it("refuses positions for a completed, cancelled or unconfirmed ride", async () => {
    for (const status of ["COMPLETED", "CANCELLED", "CONFIRMED", "PENDING"]) {
      s.booking!.status = status;
      expect((await post(fix)).status).toBe(409);
    }
    expect(s.writes).toHaveLength(0);
  });

  it("refuses old, imprecise, future-dated and 0,0 positions", async () => {
    const t = Date.now();
    for (const bad of [{ ...fix, at: t - 5 * 60_000 }, { ...fix, accuracy: 500 }, { ...fix, at: t + 5 * 60_000 }, { ...fix, lat: 0, lng: 0 }]) {
      expect((await post(bad)).status).toBe(422);
    }
    expect(s.writes).toHaveLength(0);
  });
});

describe("the public tracking page", () => {
  const render = async (over: Row = {}) => {
    s.booking = {
      id: "b1", confirmationCode: CODE, status: "DRIVER_ASSIGNED", isDeleted: false, pickupAddress: "BCN", dropoffAddress: "Hotel", pickupDatetime: pickup(),
      pickupLat: 41.3, pickupLng: 2.1, dropoffLat: 41.4, dropoffLng: 2.2,
      driver: { whatsappNumber: null, user: { name: "Omar", phone: "+34600", email: "omar@example.com" }, vehicles: [{ make: "Mercedes", model: "V-Class", licensePlate: "1234 ABC" }] },
      ...over,
    };
    const tree = (await TrackPage({ params: Promise.resolve({ code: CODE }) })) as { props: { children: { props: { booking: Row } } } };
    return tree.props.children.props.booking;
  };

  it("gives the page a signed token (the code itself is not what the page uses to ask for positions)", async () => {
    const b = await render();
    expect(verifyTrackingToken(b.trackToken, "b1")).toBe(true);
  });

  it("shows the driver's name, phone and car only while the ride is live", async () => {
    expect(await render()).toMatchObject({ driverName: "Omar", driverPhone: "+34600", plate: "1234 ABC" });
    for (const status of ["COMPLETED", "CANCELLED"]) {
      expect(await render({ status })).toMatchObject({ driverName: null, driverPhone: null, driverEmail: null, vehicle: null, plate: null });
    }
  });
});

describe("generateConfirmationCode", () => {
  it("keeps its format and is not repeated across many draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const c = generateConfirmationCode();
      expect(c).toMatch(/^EBC-[A-Z0-9]{8}$/);
      seen.add(c);
    }
    expect(seen.size).toBe(2000);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The website's own tracking endpoints (the public /track page, the partner tool and the old customer-location route) read the
 * same coordinates the apps do, so they get the same rules: only the people on the booking, only while the ride is live.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const s = vi.hoisted(() => ({
  session: null as null | { user: { id?: string; role?: string; name?: string } },
  booking: {} as Row,
  drivers: [] as Row[],
  fix: null as Row | null,
}));

vi.mock("next-auth", () => ({ getServerSession: async () => s.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/request-session", () => ({ getRequestSession: async () => s.session }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findUnique: async () => s.booking,
      update: async ({ data }: { data: Row }) => Object.assign(s.booking, data),
    },
    driver: { findUnique: async ({ where }: { where: { userId: string } }) => s.drivers.find((d) => d.userId === where.userId) ?? null },
    fleetPartner: { findUnique: async () => null },
    rideTracking: { findFirst: async () => s.fix, findMany: async () => [] },
  },
}));

import { GET as trackingGet } from "@/app/api/tracking/route";
import { GET as locGet, POST as locPost } from "@/app/api/bookings/[id]/customer-location/route";

const CODE = "ABC123";
import { NextRequest } from "next/server";
const req = (url: string, init?: RequestInit) => new NextRequest(url, init as never);
const read = (qs = "") => trackingGet(req(`http://localhost/api/tracking?bookingId=b1${qs}`));

beforeEach(() => {
  s.session = null;
  s.booking = { id: "b1", userId: "u-cust", driverId: "d1", partnerId: null, confirmationCode: CODE, status: "IN_PROGRESS", isDeleted: false, guestName: "Ana", customerLat: 41.35, customerLng: 2.15, customerLocatedAt: new Date() };
  s.drivers = [{ id: "d1", userId: "u-d1" }, { id: "d2", userId: "u-d2" }];
  s.fix = { lat: 41.3, lng: 2.1, speed: 5, heading: 90, createdAt: new Date() };
});

describe("GET /api/tracking", () => {
  it("shows the car to the assigned driver, the owner, an admin and anyone holding the confirmation code", async () => {
    for (const session of [{ user: { id: "u-d1", role: "DRIVER" } }, { user: { id: "u-cust", role: "CUSTOMER" } }, { user: { id: "u-a", role: "ADMIN" } }]) {
      s.session = session;
      expect((await read()).status).toBe(200);
    }
    s.session = null;
    expect((await read(`&code=${CODE}`)).status).toBe(200);
  });

  it("refuses an unassigned driver, another customer, a wrong code and a stranger", async () => {
    s.session = { user: { id: "u-d2", role: "DRIVER" } };
    expect((await read()).status).toBe(401);
    s.session = { user: { id: "u-other", role: "CUSTOMER" } };
    expect((await read()).status).toBe(401);
    s.session = null;
    expect((await read("&code=WRONG")).status).toBe(401);
    expect((await read()).status).toBe(401);
  });

  it("a driver the ride was taken from loses access at once", async () => {
    s.session = { user: { id: "u-d1", role: "DRIVER" } };
    expect((await read()).status).toBe(200);
    s.booking.driverId = "d2";
    expect((await read()).status).toBe(401);
  });

  it("shows nothing once the ride is completed, cancelled or refunded", async () => {
    s.session = { user: { id: "u-d1", role: "DRIVER" } };
    for (const status of ["COMPLETED", "CANCELLED", "REFUNDED", "CONFIRMED"]) {
      s.booking.status = status;
      const body = await (await read()).json();
      expect(body).toEqual({ live: false, status });
    }
  });
});

describe("the passenger's shared position on the website routes", () => {
  const params = { params: Promise.resolve({ id: "b1" }) };
  const post = (body: unknown) => locPost(req("http://localhost/x", { method: "POST", body: JSON.stringify(body) }), params);
  const get = (qs = "") => locGet(req(`http://localhost/x${qs}`), params);

  it("is readable by the assigned driver and an admin only while the ride is live and the position is fresh", async () => {
    s.session = { user: { id: "u-d1", role: "DRIVER" } };
    expect(await (await get()).json()).toMatchObject({ sharing: true, lat: 41.35 });
    s.booking.customerLocatedAt = new Date(Date.now() - 5 * 60_000);
    expect(await (await get()).json()).toMatchObject({ sharing: false, lat: null, lng: null });
    s.booking.customerLocatedAt = new Date();
    s.booking.status = "COMPLETED";
    expect(await (await get()).json()).toMatchObject({ sharing: false, lat: null, lng: null });
  });

  it("is not readable by an unassigned driver or a stranger", async () => {
    s.session = { user: { id: "u-d2", role: "DRIVER" } };
    expect((await get()).status).toBe(401);
    s.session = null;
    expect((await get()).status).toBe(401);
  });

  it("can be sent by the owner (or the code holder) only while the chauffeur is assigned or on the way", async () => {
    s.session = { user: { id: "u-cust", role: "CUSTOMER" } };
    expect((await post({ lat: 41.4, lng: 2.2 })).status).toBe(200);
    s.booking.status = "COMPLETED";
    expect((await post({ lat: 41.4, lng: 2.2 })).status).toBe(409);
    s.booking.status = "IN_PROGRESS";
    s.session = { user: { id: "u-d1", role: "DRIVER" } };
    expect((await post({ lat: 41.4, lng: 2.2 })).status).toBe(401);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The customer and driver ride APIs, against an in-memory database:
 * who may see which ride, what each of them is never shown, the accept and
 * decline rules, and that the website's own handlers are what run underneath.
 */

type Row = Record<string, any>;
const db = vi.hoisted(() => ({
  bookings: [] as Row[],
  drivers: [] as Row[],
  users: [] as Row[],
  admins: [] as Row[],
  logs: [] as Row[],
  notes: [] as Row[],
  lastFindManyWhere: null as Row | null,
  legacyCalls: [] as { name: string; body: unknown; actorId: string | null }[],
}));

vi.mock("@/lib/prisma", () => {
  const match = (r: Row, where: Row) => Object.entries(where).every(([k, v]) => (typeof v === "object" && v !== null ? true : r[k] === v));
  return {
    prisma: {
      booking: {
        findFirst: async ({ where }: { where: Row }) => db.bookings.find((b) => match(b, where)) ?? null,
        findMany: async ({ where }: { where: Row }) => { db.lastFindManyWhere = where; return db.bookings.filter((b) => b.userId === where.userId || b.driverId === where.driverId); },
        updateMany: async ({ where, data }: { where: Row; data: Row }) => {
          const hit = db.bookings.filter((b) => b.id === where.id && b.driverId === where.driverId && b.status === where.status);
          hit.forEach((b) => Object.assign(b, data));
          return { count: hit.length };
        },
      },
      driver: {
        findUnique: async ({ where }: { where: { userId: string } }) => db.drivers.find((d) => d.userId === where.userId) ?? null,
        update: async () => ({}),
      },
      user: {
        findUnique: async ({ where }: { where: { id: string } }) => db.users.find((u) => u.id === where.id) ?? null,
        findMany: async () => db.admins,
      },
      activityLog: { create: async ({ data }: { data: Row }) => { db.logs.push(data); return data; } },
      notification: { createMany: async ({ data }: { data: Row[] }) => { db.notes.push(...data); return { count: data.length }; } },
      rideTracking: { findFirst: async () => ({ lat: 41.39, lng: 2.17, speed: 5, heading: 90, createdAt: new Date() }) },
    },
  };
});

// The website's own handlers: replaced by probes that report who they were run as.
vi.mock("@/app/api/quote/route", () => ({ POST: async () => Response.json({ totalAmount: 65 }) }));
vi.mock("@/app/api/bookings/route", async () => {
  const { getRequestSession } = await import("@/lib/request-session");
  return {
    POST: async (req: Request) => {
      const body = await req.json();
      const s = await getRequestSession();
      db.legacyCalls.push({ name: "booking", body, actorId: (s?.user as { id?: string } | undefined)?.id ?? null });
      return Response.json({ bookingId: "b-new", checkoutUrl: "https://checkout.sumup.com/pay/x", accountCreated: true, email: "x@y.z", tempPassword: "TEMP-SECRET" });
    },
  };
});
vi.mock("@/app/api/bookings/[id]/cancel/route", async () => {
  const { getRequestSession } = await import("@/lib/request-session");
  return {
    POST: async () => {
      const s = await getRequestSession();
      db.legacyCalls.push({ name: "cancel", body: null, actorId: (s?.user as { id?: string } | undefined)?.id ?? null });
      return Response.json({ success: true, status: "CANCELLED", refundProcessed: true, refundAmount: 60, keptAmount: 5, message: "Cancelled." });
    },
  };
});
vi.mock("@/app/api/bookings/review/route", () => ({ POST: async (req: Request) => { db.legacyCalls.push({ name: "review", body: await req.json(), actorId: null }); return Response.json({ success: true }); } }));
vi.mock("@/app/api/payments/create-checkout/route", () => ({ POST: async () => Response.json({ checkoutUrl: "https://checkout.sumup.com/pay/y" }) }));
vi.mock("@/app/api/driver/ride/route", async () => {
  const { getRequestSession } = await import("@/lib/request-session");
  return {
    PATCH: async (req: Request) => {
      const s = await getRequestSession();
      db.legacyCalls.push({ name: "stage", body: await req.json(), actorId: (s?.user as { id?: string } | undefined)?.id ?? null });
      return Response.json({ ok: true });
    },
  };
});
vi.mock("@/app/api/tracking/route", () => ({ POST: async (req: Request) => { db.legacyCalls.push({ name: "track", body: await req.json(), actorId: null }); return Response.json({ ok: true }); } }));
vi.mock("@/app/api/driver/status/route", () => ({ PATCH: async (req: Request) => { const b = await req.json(); return Response.json({ status: b.status }); } }));

import { MemoryRateLimiter, setRateLimiter } from "@/lib/api/v1/rate-limit";
import { setAuditSink } from "@/lib/api/v1/audit";
import { mobileAuthConfig, signAccessToken } from "@/lib/api/v1/tokens";
import { GET as listRides } from "@/app/api/v1/rides/route";
import { GET as getRide } from "@/app/api/v1/rides/[id]/route";
import { POST as cancelRide } from "@/app/api/v1/rides/[id]/cancel/route";
import { POST as payRide } from "@/app/api/v1/rides/[id]/pay/route";
import { POST as rateRide } from "@/app/api/v1/rides/[id]/rating/route";
import { GET as trackRide } from "@/app/api/v1/rides/[id]/track/route";
import { POST as createBooking } from "@/app/api/v1/bookings/route";
import { POST as quote } from "@/app/api/v1/quotes/route";
import { GET as driverRides } from "@/app/api/v1/driver/rides/route";
import { GET as driverRide } from "@/app/api/v1/driver/rides/[id]/route";
import { POST as respond } from "@/app/api/v1/driver/rides/[id]/respond/route";
import { POST as stage } from "@/app/api/v1/driver/rides/[id]/stage/route";
import { POST as location } from "@/app/api/v1/driver/location/route";
import { POST as setStatus } from "@/app/api/v1/driver/status/route";
import { getRequestSession } from "@/lib/request-session";

let n = 0;
const token = (userId: string, role: string) => signAccessToken({ userId, role: role as never, sessionId: "s1" }, mobileAuthConfig());
async function call(handler: (r: Request, c?: any) => Promise<Response>, who: [string, string] | null, opts: { path?: string; method?: string; body?: unknown; id?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": `10.1.0.${++n}` };
  if (who) headers.authorization = `Bearer ${await token(who[0], who[1])}`;
  const res = await handler(
    new Request(`http://localhost${opts.path ?? "/x"}`, { method: opts.method ?? "GET", headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }),
    opts.id ? { params: Promise.resolve({ id: opts.id }) } : undefined,
  );
  return { status: res.status, json: (await res.json()) as { ok: boolean; data?: any; error?: { code: string; message: string } } };
}

const ANA: [string, string] = ["c1", "CUSTOMER"];
const BEN: [string, string] = ["c2", "CUSTOMER"];
const OMAR: [string, string] = ["du1", "DRIVER"];
const LEO: [string, string] = ["du2", "DRIVER"];

const future = () => new Date(Date.now() + 5 * 3600_000);
function ride(over: Row = {}): Row {
  return {
    id: "r1", confirmationCode: "ABC123", status: "DRIVER_ASSIGNED", rideStage: null, rideStageAt: null,
    pickupAddress: "BCN T1", pickupLat: 41.29, pickupLng: 2.07, dropoffAddress: "Hotel Arts", dropoffLat: 41.38, dropoffLng: 2.19,
    pickupDatetime: future(), vehicleClass: "BUSINESS", passengers: 2, luggage: 1, flightNumber: "VY1234",
    specialRequests: '[META]{"bookingType":"TRANSFER","extras":[{"id":"meet","label":"Meet & Greet","price":5,"quantity":1}]}[/META]\nGate B',
    guestName: "Ana Ruiz", guestPhone: "+34600111222", userId: "c1", driverId: "d1", isDeleted: false,
    totalAmount: 777.77, paymentStatus: "PAID", paymentMethod: null, balanceAmount: null, balancePaidAt: null, protectionFee: 11.11,
    durationMin: 0, baseFare: 700, rating: null, review: null, createdAt: new Date(),
    driverAmount: 45.5, partnerPayout: 999.01, adminNotes: "SECRET-OFFICE-NOTE", partnerId: null,
    driverAssignedAt: new Date(), driverResponse: null, driverRespondedAt: null, driverResponseBy: null,
    customerLat: null, customerLng: null, customerLocatedAt: null, returnOfId: null,
    driver: { rating: 4.8, user: { name: "Omar Khan", phone: "+34600999888" }, vehicles: [{ make: "Mercedes", model: "E-Class", color: "Black", licensePlate: "1234 ABC" }] },
    rideEvents: [],
    ...over,
  };
}

beforeEach(() => {
  process.env.MOBILE_JWT_SECRET = "test-only-mobile-secret-0123456789abcdef";
  delete process.env.NEXTAUTH_SECRET;
  setRateLimiter(new MemoryRateLimiter());
  setAuditSink(async () => {});
  db.bookings.length = db.drivers.length = db.users.length = db.admins.length = db.logs.length = db.notes.length = db.legacyCalls.length = 0;
  db.drivers.push({ id: "d1", userId: "du1", status: "ONLINE", partnerId: null, rating: 4.8, totalRides: 10 }, { id: "d2", userId: "du2", status: "ONLINE", partnerId: null, rating: 4.1, totalRides: 3 });
  db.users.push(
    { id: "c1", email: "ana@example.com", name: "Ana Ruiz", role: "CUSTOMER" },
    { id: "c2", email: "ben@example.com", name: "Ben Ito", role: "CUSTOMER" },
    { id: "du1", email: "omar@example.com", name: "Omar Khan", role: "DRIVER" },
    { id: "du2", email: "leo@example.com", name: "Leo Mar", role: "DRIVER" },
  );
  db.admins.push({ id: "a1" });
  db.bookings.push(ride());
});

describe("customer rides: who sees what", () => {
  it("every call needs a customer token", async () => {
    expect((await call(getRide, null, { id: "r1" })).status).toBe(401);
    expect((await call(getRide, OMAR, { id: "r1" })).status).toBe(403);
    expect((await call(listRides, OMAR)).status).toBe(403);
  });

  it("a customer reads their own ride, and another customer gets NOT_FOUND", async () => {
    expect((await call(getRide, ANA, { id: "r1" })).json.data.code).toBe("ABC123");
    const other = await call(getRide, BEN, { id: "r1" });
    expect(other.status).toBe(404);
    expect(other.json.error?.code).toBe("NOT_FOUND");
  });

  it("the list is filtered to the caller", async () => {
    await call(listRides, ANA);
    expect(db.lastFindManyWhere?.userId).toBe("c1");
    await call(listRides, BEN);
    expect(db.lastFindManyWhere?.userId).toBe("c2");
  });

  it("the customer sees their price and the assigned driver, and never a payout or an office note", async () => {
    const { json } = await call(getRide, ANA, { id: "r1" });
    const text = JSON.stringify(json);
    expect(json.data.price.total).toBe(777.77);
    expect(json.data.driver).toMatchObject({ name: "Omar Khan", vehicle: { plate: "1234 ABC" } });
    for (const secret of ["45.5", "999.01", "SECRET-OFFICE-NOTE", "driverAmount", "partnerPayout", "adminNotes"]) expect(text).not.toContain(secret);
    expect(json.data.extras).toEqual([{ label: "Meet & Greet", quantity: 1, price: 5 }]);
    expect(json.data.notes).toBe("Gate B");
  });

  it("the driver is hidden until one is assigned", async () => {
    db.bookings[0] = ride({ status: "CONFIRMED", driverId: null, driver: null });
    expect((await call(getRide, ANA, { id: "r1" })).json.data.driver).toBeNull();
  });

  it("describes an hourly booking by the hours charged", async () => {
    db.bookings[0] = ride({ specialRequests: '[META]{"bookingType":"DAY_HIRE","durationHours":4}[/META]', durationMin: 480, dropoffAddress: "" });
    const { json } = await call(getRide, ANA, { id: "r1" });
    expect(json.data.hire).toEqual({ kind: "FULL_DAY", hours: 8 });
    expect(json.data.dropoff).toBeNull();
  });
});

describe("customer actions go through the website's own handlers, as the caller", () => {
  it("cancel runs the website's cancellation as the owner, and refuses someone else's ride without calling it", async () => {
    const ok = await call(cancelRide, ANA, { id: "r1", method: "POST" });
    expect(ok.json.data).toMatchObject({ status: "CANCELLED", refundProcessed: true, refundAmount: 60 });
    expect(db.legacyCalls).toEqual([{ name: "cancel", body: null, actorId: "c1" }]);

    db.legacyCalls.length = 0;
    expect((await call(cancelRide, BEN, { id: "r1", method: "POST" })).status).toBe(404);
    expect(db.legacyCalls).toHaveLength(0);
  });

  it("booking: the account's email wins over the body, and a temporary password never comes back", async () => {
    const res = await call(createBooking, ANA, { method: "POST", body: { guestEmail: "victim@example.com", guestName: "", pickupAddress: "x" } });
    expect(res.status).toBe(200);
    expect(db.legacyCalls[0]).toMatchObject({ name: "booking", actorId: "c1" });
    expect((db.legacyCalls[0].body as Row).guestEmail).toBe("ana@example.com");
    expect((db.legacyCalls[0].body as Row).guestName).toBe("Ana Ruiz");
    const text = JSON.stringify(res.json);
    expect(text).not.toContain("TEMP-SECRET");
    expect(text).not.toContain("tempPassword");
    expect(res.json.data).toMatchObject({ bookingId: "b-new", payment: "ONLINE", checkoutUrl: "https://checkout.sumup.com/pay/x" });
  });

  it("the quote is public and is the website's quote", async () => {
    const res = await call(quote, null, { method: "POST", body: { pickupLat: 41.3 } });
    expect(res.json.data).toEqual({ totalAmount: 65 });
  });

  it("pay needs an unpaid ride of your own", async () => {
    expect((await call(payRide, ANA, { id: "r1", method: "POST" })).status).toBe(409); // already PAID
    db.bookings[0] = ride({ paymentStatus: "PENDING", status: "PENDING" });
    expect((await call(payRide, ANA, { id: "r1", method: "POST" })).json.data.checkoutUrl).toMatch(/^https:\/\//);
    expect((await call(payRide, BEN, { id: "r1", method: "POST" })).status).toBe(404);
  });

  it("rating: only the owner, only when completed, only once", async () => {
    expect((await call(rateRide, ANA, { id: "r1", method: "POST", body: { rating: 5 } })).status).toBe(409); // not completed
    db.bookings[0] = ride({ status: "COMPLETED" });
    expect((await call(rateRide, BEN, { id: "r1", method: "POST", body: { rating: 5 } })).status).toBe(404);
    expect((await call(rateRide, ANA, { id: "r1", method: "POST", body: { rating: 9 } })).status).toBe(422);
    expect((await call(rateRide, ANA, { id: "r1", method: "POST", body: { rating: 5, review: "Great" } })).status).toBe(201);
    db.bookings[0] = ride({ status: "COMPLETED", rating: 5 });
    expect((await call(rateRide, ANA, { id: "r1", method: "POST", body: { rating: 4 } })).status).toBe(409);
  });

  it("tracking shows nothing until the driver has set off, then only the latest point", async () => {
    expect((await call(trackRide, ANA, { id: "r1" })).json.data.live).toBe(false);
    db.bookings[0] = ride({ status: "IN_PROGRESS", rideStage: "ON_THE_WAY" });
    const live = (await call(trackRide, ANA, { id: "r1" })).json.data;
    expect(live).toMatchObject({ live: true, toward: "PICKUP" });
    expect(live.point.lat).toBe(41.39);
    expect((await call(trackRide, BEN, { id: "r1" })).status).toBe(404);
    db.bookings[0] = ride({ status: "COMPLETED", rideStage: "COMPLETED" });
    expect((await call(trackRide, ANA, { id: "r1" })).json.data.live).toBe(false);
  });
});

describe("driver rides: who sees what", () => {
  it("drivers only, and only their own rides", async () => {
    expect((await call(driverRide, ANA, { id: "r1" })).status).toBe(403);
    expect((await call(driverRide, OMAR, { id: "r1" })).status).toBe(200);
    expect((await call(driverRide, LEO, { id: "r1" })).status).toBe(404);
    await call(driverRides, OMAR);
    expect(db.lastFindManyWhere?.driverId).toBe("d1");
  });

  it("a suspended or pending driver is refused at once", async () => {
    db.drivers[0].status = "SUSPENDED";
    expect((await call(driverRide, OMAR, { id: "r1" })).status).toBe(403);
    db.drivers[0].status = "PENDING_APPROVAL";
    expect((await call(driverRides, OMAR)).status).toBe(403);
  });

  it("the driver sees where to go, who to collect, what to bring and their own payout, but never the customer's price", async () => {
    const { json } = await call(driverRide, OMAR, { id: "r1" });
    const text = JSON.stringify(json);
    expect(json.data).toMatchObject({ payout: 45.5, customer: { name: "Ana Ruiz", phone: "+34600111222" }, passengers: 2, flightNumber: "VY1234" });
    expect(json.data.extras).toEqual([{ label: "Meet & Greet", quantity: 1 }]);
    for (const secret of ["777.77", "11.11", "999.01", "SECRET-OFFICE-NOTE", "totalAmount", "protectionFee", "partnerPayout", "adminNotes", "\"price\""]) expect(text).not.toContain(secret);
  });

  it("shows what to collect in cash", async () => {
    db.bookings[0] = ride({ paymentMethod: "CASH", paymentStatus: "PENDING", totalAmount: 80 });
    expect((await call(driverRide, OMAR, { id: "r1" })).json.data.collect).toBe(80);
  });
});

describe("accept and decline", () => {
  const post = (who: [string, string], response: string, id = "r1") => call(respond, who, { id, method: "POST", body: { response } });

  it("accepting is recorded for this driver", async () => {
    const res = await post(OMAR, "ACCEPT");
    expect(res.json.data.response).toBe("ACCEPTED");
    expect(db.bookings[0]).toMatchObject({ driverResponse: "ACCEPTED", driverResponseBy: "d1", driverId: "d1", status: "DRIVER_ASSIGNED" });
    expect((await call(driverRide, OMAR, { id: "r1" })).json.data.response).toBe("ACCEPTED");
  });

  it("a second answer cannot flip the first", async () => {
    await post(OMAR, "ACCEPT");
    const again = await post(OMAR, "REJECT");
    expect(again.status).toBe(409);
    expect(db.bookings[0].driverId).toBe("d1");
  });

  it("declining sends the ride back to the dispatcher and tells the office", async () => {
    const res = await post(OMAR, "REJECT");
    expect(res.json.data.response).toBe("REJECTED");
    expect(db.bookings[0]).toMatchObject({ driverId: null, status: "CONFIRMED", driverAssignedAt: null });
    expect(db.notes).toHaveLength(1);
    expect(db.notes[0]).toMatchObject({ userId: "a1", type: "DRIVER_REJECTED" });
    expect(db.logs.some((l) => l.action === "DRIVER_REJECTED_RIDE")).toBe(true);
  });

  it("another driver cannot answer for this one", async () => {
    expect((await post(LEO, "ACCEPT")).status).toBe(404);
    expect(db.bookings[0].driverResponse).toBeNull();
  });

  it("an answer given by a previous driver does not count for the new one", async () => {
    db.bookings[0] = ride({ driverResponse: "ACCEPTED", driverResponseBy: "d2", driverId: "d1" });
    expect((await call(driverRide, OMAR, { id: "r1" })).json.data.response).toBe("PENDING");
  });

  it("a started ride cannot be declined", async () => {
    db.bookings[0] = ride({ status: "IN_PROGRESS", driverResponse: "ACCEPTED", driverResponseBy: "d1" });
    expect((await post(OMAR, "REJECT")).status).toBe(409);
  });
});

describe("driver actions", () => {
  const accepted = () => { db.bookings[0] = ride({ driverResponse: "ACCEPTED", driverResponseBy: "d1" }); };

  it("a stage cannot be set before the ride is accepted", async () => {
    expect((await call(stage, OMAR, { id: "r1", method: "POST", body: { stage: "ON_THE_WAY" } })).status).toBe(409);
    expect(db.legacyCalls).toHaveLength(0);
  });

  it("an accepted ride's stage runs the website's ride handler as the driver", async () => {
    accepted();
    const res = await call(stage, OMAR, { id: "r1", method: "POST", body: { stage: "ON_THE_WAY", lat: 41.3, lng: 2.1 } });
    expect(res.status).toBe(200);
    expect(db.legacyCalls).toEqual([{ name: "stage", body: { bookingId: "r1", stage: "ON_THE_WAY", lat: 41.3, lng: 2.1 }, actorId: "du1" }]);
    expect((await call(stage, LEO, { id: "r1", method: "POST", body: { stage: "ON_THE_WAY" } })).status).toBe(404);
    expect((await call(stage, OMAR, { id: "r1", method: "POST", body: { stage: "FLYING" } })).status).toBe(422);
  });

  it("location is accepted only for an accepted, live ride", async () => {
    const fix = { bookingId: "r1", lat: 41.3, lng: 2.1 };
    expect((await call(location, OMAR, { method: "POST", body: fix })).status).toBe(409); // not accepted
    accepted();
    db.bookings[0].pickupDatetime = new Date(Date.now() + 5 * 3600_000);
    expect((await call(location, OMAR, { method: "POST", body: fix })).status).toBe(409); // hours away, not set off
    db.bookings[0].pickupDatetime = new Date(Date.now() + 20 * 60_000);
    expect((await call(location, OMAR, { method: "POST", body: fix })).status).toBe(200);
    db.bookings[0].rideStage = "COMPLETED";
    expect((await call(location, OMAR, { method: "POST", body: fix })).status).toBe(409);
    expect((await call(location, LEO, { method: "POST", body: fix })).status).toBe(404);
    expect((await call(location, OMAR, { method: "POST", body: { ...fix, lat: 999 } })).status).toBe(422);
  });

  it("going offline is refused mid-ride", async () => {
    expect((await call(setStatus, OMAR, { method: "POST", body: { status: "OFFLINE" } })).json.data.status).toBe("OFFLINE");
    db.drivers[0].status = "ON_RIDE";
    expect((await call(setStatus, OMAR, { method: "POST", body: { status: "OFFLINE" } })).status).toBe(409);
  });
});

describe("the actor can only be set by /api/v1", () => {
  it("without an actor the website's cookie session is used, as before", async () => {
    // No actor is active here, so getRequestSession falls through to next-auth (no cookies in a test: null).
    expect(await getRequestSession().catch(() => null)).toBeNull();
  });

  it("no file outside app/api/v1 and lib/api/v1 imports runAsActor", () => {
    const root = join(__dirname, "..", "..");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (["node_modules", ".next", ".git", "__tests__"].includes(name)) continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(name)) continue;
        const rel = p.slice(root.length + 1).replace(/\\/g, "/");
        if (rel.startsWith("app/api/v1/") || rel.startsWith("lib/api/v1/") || rel === "lib/request-session.ts") continue;
        if (readFileSync(p, "utf8").includes("runAsActor")) hits.push(rel);
      }
    };
    for (const d of ["app", "lib", "components"]) walk(join(root, d));
    expect(hits).toEqual([]);
  });
});

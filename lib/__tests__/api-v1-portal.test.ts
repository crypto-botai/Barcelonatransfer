import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, any>;
const db = vi.hoisted(() => ({
  notifications: [] as Row[],
  profiles: [] as Row[],
  bookings: [] as Row[],
  users: [] as Row[],
  flightCalls: 0,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findMany: async ({ where }: { where: { userId: string } }) => db.notifications.filter((n) => n.userId === where.userId).sort((a, b) => b.createdAt - a.createdAt),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const hit = db.notifications.filter((n) => Object.entries(where).every(([k, v]) => n[k] === v));
        hit.forEach((n) => Object.assign(n, data));
        return { count: hit.length };
      },
    },
    customerProfile: { findUnique: async ({ where }: { where: { userId: string } }) => db.profiles.find((p) => p.userId === where.userId) ?? null },
    booking: {
      count: async ({ where }: { where: Row }) => db.bookings.filter((b) => b.userId === where.userId && b.status === where.status).length,
      findFirst: async ({ where }: { where: Row }) => db.bookings.find((b) => b.id === where.id && b.userId === where.userId) ?? null,
    },
    user: {
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const u = db.users.find((x) => x.id === where.id)!;
        Object.assign(u, data);
        return { id: u.id, name: u.name, email: u.email, phone: u.phone };
      },
    },
    activityLog: { create: async () => ({}) },
  },
}));

vi.mock("@/app/api/flights/status/route", () => ({
  GET: async (req: Request) => {
    db.flightCalls++;
    return Response.json({ tracked: true, status: { flight: new URL(req.url).searchParams.get("bookingId") } });
  },
}));

import { MemoryRateLimiter, setRateLimiter } from "@/lib/api/v1/rate-limit";
import { setAuditSink } from "@/lib/api/v1/audit";
import { mobileAuthConfig, signAccessToken } from "@/lib/api/v1/tokens";
import { GET as listNotes, PATCH as readNotes } from "@/app/api/v1/notifications/route";
import { GET as loyalty } from "@/app/api/v1/me/loyalty/route";
import { PATCH as updateMe } from "@/app/api/v1/me/route";
import { GET as flight } from "@/app/api/v1/rides/[id]/flight/route";
import { GET as catalog } from "@/app/api/v1/catalog/route";

let n = 0;
const bearer = (userId: string, role: string) => signAccessToken({ userId, role: role as never, sessionId: "s1" }, mobileAuthConfig());
async function call(handler: (r: Request, c?: any) => Promise<Response>, who: [string, string] | null, o: { method?: string; body?: unknown; id?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": `10.3.0.${++n}` };
  if (who) headers.authorization = `Bearer ${await bearer(who[0], who[1])}`;
  const res = await handler(new Request("http://localhost/x", { method: o.method ?? "GET", headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) }), o.id ? { params: Promise.resolve({ id: o.id }) } : undefined);
  return { status: res.status, json: (await res.json()) as { ok: boolean; data?: any; error?: { code: string } } };
}
const ANA: [string, string] = ["c1", "CUSTOMER"];
const BEN: [string, string] = ["c2", "CUSTOMER"];

beforeEach(() => {
  process.env.MOBILE_JWT_SECRET = "test-only-mobile-secret-0123456789abcdef";
  delete process.env.NEXTAUTH_SECRET;
  setRateLimiter(new MemoryRateLimiter());
  setAuditSink(async () => {});
  db.flightCalls = 0;
  db.notifications.length = db.profiles.length = db.bookings.length = db.users.length = 0;
  const now = Date.now();
  db.notifications.push(
    { id: "n1", userId: "c1", title: "Booking confirmed", body: "Your ride", type: "BOOKING_CONFIRMED", read: false, data: { bookingId: "b1" }, createdAt: new Date(now - 1000) },
    { id: "n2", userId: "c1", title: "Driver assigned", body: "Omar", type: "DRIVER_ASSIGNED", read: true, data: null, createdAt: new Date(now - 5000) },
    { id: "n3", userId: "c2", title: "Someone else", body: "private", type: "BOOKING_CONFIRMED", read: false, data: null, createdAt: new Date(now) },
  );
  db.users.push({ id: "c1", name: "Ana Ruiz", email: "ana@example.com", phone: null, role: "CUSTOMER", passwordHash: "x" });
  db.bookings.push({ id: "b1", userId: "c1", status: "COMPLETED", flightNumber: "VY1234", confirmationCode: "ABC123" }, { id: "b2", userId: "c1", status: "COMPLETED", flightNumber: null, confirmationCode: "DEF456" });
});

describe("notifications", () => {
  it("lists only the caller's own, newest first, with the unread count", async () => {
    const { json } = await call(listNotes, ANA);
    expect(json.data.notifications.map((x: Row) => x.id)).toEqual(["n1", "n2"]);
    expect(json.data.unread).toBe(1);
    expect(json.data.notifications[0]).toMatchObject({ bookingId: "b1", read: false });
    expect(JSON.stringify(json)).not.toContain("private");
    expect((await call(listNotes, null)).status).toBe(401);
  });

  it("marks one or all as read, and never touches another person's", async () => {
    expect((await call(readNotes, ANA, { method: "PATCH", body: { id: "n3" } })).json.data.updated).toBe(0);
    expect(db.notifications.find((x) => x.id === "n3")!.read).toBe(false);
    expect((await call(readNotes, ANA, { method: "PATCH", body: { id: "n1" } })).json.data.updated).toBe(1);
    expect((await call(readNotes, BEN, { method: "PATCH", body: { all: true } })).json.data.updated).toBe(1);
    expect(db.notifications.find((x) => x.id === "n3")!.read).toBe(true);
    expect((await call(readNotes, ANA, { method: "PATCH", body: { nonsense: 1 } })).status).toBe(422);
  });
});

describe("loyalty", () => {
  it("reads the website's tier table: Silver at the start, Gold at 500, VIP only by hand", async () => {
    db.profiles.push({ userId: "c1", totalSpent: 260, isVip: false });
    const silver = (await call(loyalty, ANA)).json.data;
    expect(silver).toMatchObject({ tier: "Silver", spent: 260, ridesCompleted: 2 });
    expect(silver.next).toMatchObject({ tier: "Gold", threshold: 500, remaining: 240 });
    expect(silver.perks.length).toBeGreaterThan(0);

    db.profiles[0].totalSpent = 650;
    expect((await call(loyalty, ANA)).json.data.tier).toBe("Gold");
    db.profiles[0].isVip = true;
    expect((await call(loyalty, ANA)).json.data.tier).toBe("VIP");
  });

  it("a customer with no profile yet is Silver with nothing spent", async () => {
    const d = (await call(loyalty, BEN)).json.data;
    expect(d).toMatchObject({ tier: "Silver", spent: 0, ridesCompleted: 0 });
    expect(d.next.remaining).toBe(500);
  });
});

describe("changing your own name and phone", () => {
  it("changes only those two fields, whatever else is sent", async () => {
    const res = await call(updateMe, ANA, { method: "PATCH", body: { name: "Ana Maria Ruiz", phone: "+34 600 111 222", role: "ADMIN", email: "x@y.z", passwordHash: "hacked" } });
    expect(res.json.data).toMatchObject({ name: "Ana Maria Ruiz", phone: "+34 600 111 222", email: "ana@example.com" });
    expect(db.users[0].role).toBe("CUSTOMER");
    expect(db.users[0].passwordHash).toBe("x");
    expect((await call(updateMe, ANA, { method: "PATCH", body: { phone: "abc" } })).status).toBe(422);
    expect((await call(updateMe, null, { method: "PATCH", body: { name: "Ana" } })).status).toBe(401);
  });
});

describe("flight status", () => {
  it("answers for the owner's ride with a flight, and asks the provider only then", async () => {
    expect((await call(flight, ANA, { id: "b1" })).json.data).toMatchObject({ tracked: true });
    expect(db.flightCalls).toBe(1);
    expect((await call(flight, ANA, { id: "b2" })).json.data).toEqual({ tracked: false, reason: "no_flight_number" });
    expect(db.flightCalls).toBe(1);
  });

  it("another customer's ride is NOT_FOUND and costs no provider call", async () => {
    expect((await call(flight, BEN, { id: "b1" })).status).toBe(404);
    expect(db.flightCalls).toBe(0);
  });
});

describe("catalogue prices", () => {
  it("each vehicle carries the website's own from price", async () => {
    const { json } = await call(catalog, null);
    for (const v of json.data.vehicles) expect(v.fromPrice, v.name).toBeGreaterThan(0);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

type Row = Record<string, any>;
const db = vi.hoisted(() => ({
  users: [] as Row[],
  drivers: [] as Row[],
  tokens: [] as Row[],
  logs: [] as Row[],
  legacy: [] as { name: string; body: unknown; actorId: string | null }[],
  changeStatus: 200,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: async ({ where, include }: { where: { id: string }; include?: unknown }) => {
        const u = db.users.find((x) => x.id === where.id);
        if (!u) return null;
        return include ? { ...u, driver: null } : u;
      },
    },
    activityLog: { create: async ({ data }: { data: Row }) => { db.logs.push(data); return data; }, count: async () => 0 },
    mobileRefreshToken: {
      create: async ({ data }: { data: Row }) => { db.tokens.push({ usedAt: null, revokedAt: null, ...data }); return data; },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const hit = db.tokens.filter((t) => Object.entries(where).every(([k, v]) => t[k] === v));
        hit.forEach((t) => Object.assign(t, data));
        return { count: hit.length };
      },
    },
  },
}));

vi.mock("@/app/api/auth/forgot-password/route", () => ({
  POST: async (req: Request) => { db.legacy.push({ name: "forgot", body: await req.json(), actorId: null }); return Response.json({ ok: true }); },
}));
vi.mock("@/app/api/auth/change-password/route", async () => {
  const { getRequestSession } = await import("@/lib/request-session");
  return {
    POST: async (req: Request) => {
      const s = await getRequestSession();
      db.legacy.push({ name: "change", body: await req.json(), actorId: (s?.user as { id?: string } | undefined)?.id ?? null });
      return db.changeStatus === 200 ? Response.json({ success: true }) : Response.json({ error: "Current password is incorrect" }, { status: db.changeStatus });
    },
  };
});
vi.mock("@/app/api/account/route", async () => {
  const { getRequestSession } = await import("@/lib/request-session");
  return {
    DELETE: async () => {
      const s = await getRequestSession();
      db.legacy.push({ name: "delete", body: null, actorId: (s?.user as { id?: string } | undefined)?.id ?? null });
      return Response.json({ ok: true });
    },
  };
});
vi.mock("@/app/api/geo/search/route", () => ({
  GET: async (req: Request) => Response.json({ results: [{ lat: 41.29, lng: 2.07, label: "Barcelona Airport T1", q: new URL(req.url).searchParams.get("q") }] }),
}));

import { MemoryRateLimiter, setRateLimiter } from "@/lib/api/v1/rate-limit";
import { setAuditSink } from "@/lib/api/v1/audit";
import { mobileAuthConfig, signAccessToken } from "@/lib/api/v1/tokens";
import { POST as forgot } from "@/app/api/v1/auth/forgot-password/route";
import { POST as changePassword } from "@/app/api/v1/auth/change-password/route";
import { DELETE as deleteMe } from "@/app/api/v1/me/route";
import { GET as catalog } from "@/app/api/v1/catalog/route";
import { GET as places } from "@/app/api/v1/places/route";

let n = 0;
const bearer = (userId: string, role: string) => signAccessToken({ userId, role: role as never, sessionId: "s1" }, mobileAuthConfig());
async function call(handler: (r: Request) => Promise<Response>, who: [string, string] | null, o: { path?: string; method?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": `10.2.0.${++n}` };
  if (who) headers.authorization = `Bearer ${await bearer(who[0], who[1])}`;
  const res = await handler(new Request(`http://localhost${o.path ?? "/x"}`, { method: o.method ?? "GET", headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) }));
  return { status: res.status, json: (await res.json()) as { ok: boolean; data?: any; error?: { code: string; message: string } } };
}
const ANA: [string, string] = ["c1", "CUSTOMER"];

beforeEach(async () => {
  process.env.MOBILE_JWT_SECRET = "test-only-mobile-secret-0123456789abcdef";
  delete process.env.NEXTAUTH_SECRET;
  process.env.NEXTAUTH_URL = "https://www.elitebcn.info";
  setRateLimiter(new MemoryRateLimiter());
  setAuditSink(async (e) => { db.logs.push({ action: e.action }); });
  db.users.length = db.tokens.length = db.logs.length = db.legacy.length = 0;
  db.changeStatus = 200;
  db.users.push({ id: "c1", email: "ana@example.com", name: "Ana", phone: null, role: "CUSTOMER", mustChangePassword: false, passwordHash: await bcrypt.hash("right password", 4) });
  db.tokens.push(
    { id: "t1", userId: "c1", familyId: "f1", revokedAt: null, usedAt: null },
    { id: "t2", userId: "c1", familyId: "f2", revokedAt: null, usedAt: null },
    { id: "t3", userId: "other", familyId: "f3", revokedAt: null, usedAt: null },
  );
});

describe("forgot password", () => {
  it("answers the same for any address and never says whether it exists", async () => {
    const a = await call(forgot, null, { method: "POST", body: { email: "ana@example.com" } });
    const b = await call(forgot, null, { method: "POST", body: { email: "ghost@example.com" } });
    expect(a.json.data).toEqual({ sent: true });
    expect(b.json.data).toEqual({ sent: true });
    expect(db.legacy.map((l) => l.name)).toEqual(["forgot", "forgot"]);
    expect((await call(forgot, null, { method: "POST", body: { email: "nope" } })).status).toBe(422);
  });
});

describe("change password", () => {
  it("runs the website rule as the caller, signs every other phone out and gives this phone a new session", async () => {
    const res = await call(changePassword, ANA, { method: "POST", body: { currentPassword: "right password", newPassword: "a brand new one" } });
    expect(res.status).toBe(200);
    expect(db.legacy[0]).toMatchObject({ name: "change", actorId: "c1" });
    expect(res.json.data.accessToken).toBeTruthy();
    expect(res.json.data.refreshToken).toBeTruthy();
    // The old families of this user are revoked; someone else's is not.
    expect(db.tokens.find((t) => t.id === "t1")!.revokedAt).not.toBeNull();
    expect(db.tokens.find((t) => t.id === "t2")!.revokedAt).not.toBeNull();
    expect(db.tokens.find((t) => t.id === "t3")!.revokedAt).toBeNull();
    // ...and the new session's token is live.
    expect(db.tokens.filter((t) => t.userId === "c1" && !t.revokedAt)).toHaveLength(1);
  });

  it("a wrong current password changes nothing", async () => {
    db.changeStatus = 401;
    const res = await call(changePassword, ANA, { method: "POST", body: { currentPassword: "nope", newPassword: "a brand new one" } });
    expect(res.status).toBe(401);
    expect(db.tokens.find((t) => t.id === "t1")!.revokedAt).toBeNull();
  });

  it("refuses a weak new password before the website is asked", async () => {
    expect((await call(changePassword, ANA, { method: "POST", body: { newPassword: "short" } })).status).toBe(422);
    expect((await call(changePassword, ANA, { method: "POST", body: { newPassword: "a".repeat(73) } })).status).toBe(422);
    expect(db.legacy).toHaveLength(0);
  });

  it("needs a signed-in customer or driver", async () => {
    expect((await call(changePassword, null, { method: "POST", body: { newPassword: "a brand new one" } })).status).toBe(401);
    expect((await call(changePassword, ["a1", "ADMIN"], { method: "POST", body: { newPassword: "a brand new one" } })).status).toBe(403);
  });
});

describe("delete account", () => {
  it("needs the right password, then runs the website's deletion as the caller", async () => {
    const wrong = await call(deleteMe, ANA, { method: "DELETE", body: { password: "wrong" } });
    expect(wrong.status).toBe(403);
    expect(db.legacy).toHaveLength(0);

    const ok = await call(deleteMe, ANA, { method: "DELETE", body: { password: "right password" } });
    expect(ok.json.data).toEqual({ deleted: true });
    expect(db.legacy).toEqual([{ name: "delete", body: null, actorId: "c1" }]);
    expect(db.logs.some((l) => l.action === "API_V1_ACCOUNT_DELETED")).toBe(true);
  });

  it("an admin cannot use it", async () => {
    expect((await call(deleteMe, ["a1", "ADMIN"], { method: "DELETE", body: { password: "x" } })).status).toBe(403);
  });
});

describe("catalogue and places", () => {
  it("lists the fleet and the extras publicly, with no journey prices", async () => {
    const { json } = await call(catalog, null);
    expect(json.data.vehicles.length).toBeGreaterThanOrEqual(7);
    expect(json.data.vehicles[0]).toMatchObject({ id: expect.any(String), vehicleClass: expect.any(String), passengers: expect.any(Number) });
    expect(json.data.vehicles[0].imageUrl).toMatch(/^https:\/\//);
    expect(json.data.extras.find((e: Row) => e.id === "meet_greet")).toMatchObject({ price: 5, maxQty: 1 });
    expect(JSON.stringify(json.data)).not.toMatch(/baseFare|totalAmount|hourly/i);
  });

  it("searches places through the website's search", async () => {
    const { json } = await call(places, null, { path: "/api/v1/places?q=BCN%20T1" });
    expect(json.data.results[0]).toMatchObject({ label: "Barcelona Airport T1", q: "BCN T1" });
    expect((await call(places, null, { path: "/api/v1/places?q=a" })).status).toBe(422);
    expect((await call(places, null, { path: "/api/v1/places" })).status).toBe(422);
  });
});

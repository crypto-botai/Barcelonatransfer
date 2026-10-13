import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/v1/auth/apple, end to end against an in-memory database. The token check itself is covered in apple-token.test.ts; here it
 * is replaced by a controllable result, so these tests are about what the route does with a verified Apple identity.
 */

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ users: [] as Row[], drivers: [] as Row[], accounts: [] as Row[], logs: [] as Row[], tokens: [] as Row[], identity: null as null | { subject: string; email: string; isPrivateRelay: boolean }, reject: false }));

vi.mock("@/lib/api/v1/apple-token", () => ({
  verifyAppleIdentityToken: async () => {
    if (db.reject) {
      const { ApiError } = await import("@/lib/api/v1/errors");
      throw new ApiError("UNAUTHENTICATED", "Apple sign-in could not be confirmed. Try again.");
    }
    return db.identity;
  },
}));
vi.mock("@/lib/claim-bookings", () => ({ linkGuestBookings: async () => 0 }));

vi.mock("@/lib/prisma", () => {
  const withDriver = (u: Row | undefined, include: unknown) => {
    if (!u) return null;
    if (!include) return u;
    const d = db.drivers.find((x) => x.userId === u.id);
    return { ...u, driver: d ? { status: d.status } : null };
  };
  return {
    prisma: {
      user: {
        findFirst: async ({ where, include }: { where: { email: { equals: string } }; include?: unknown }) => withDriver(db.users.find((u) => String(u.email).toLowerCase() === where.email.equals.toLowerCase()), include),
        findUnique: async ({ where, include }: { where: { id: string }; include?: unknown }) => withDriver(db.users.find((u) => u.id === where.id), include),
        create: async ({ data }: { data: Row }) => {
          if (db.users.some((u) => String(u.email).toLowerCase() === String(data.email).toLowerCase())) throw Object.assign(new Error("unique"), { code: "P2002" });
          const row = { id: `u${db.users.length + 1}`, mustChangePassword: false, image: null, phone: null, ...data };
          db.users.push(row);
          return row;
        },
      },
      account: {
        findUnique: async ({ where }: { where: { provider_providerAccountId: { provider: string; providerAccountId: string } } }) =>
          db.accounts.find((a) => a.provider === where.provider_providerAccountId.provider && a.providerAccountId === where.provider_providerAccountId.providerAccountId) ?? null,
        create: async ({ data }: { data: Row }) => {
          if (db.accounts.some((a) => a.provider === data.provider && a.providerAccountId === data.providerAccountId)) throw Object.assign(new Error("unique"), { code: "P2002" });
          db.accounts.push(data);
          return data;
        },
      },
      activityLog: { count: async () => 0, create: async ({ data }: { data: Row }) => { db.logs.push(data); return data; } },
      mobileRefreshToken: { create: async ({ data }: { data: Row }) => { db.tokens.push(data); return data; } },
    },
  };
});

import { MemoryRateLimiter, setRateLimiter } from "@/lib/api/v1/rate-limit";
import { setAuditSink } from "@/lib/api/v1/audit";
import { POST as apple } from "@/app/api/v1/auth/apple/route";

let ip = 0;
const TOKEN = "t".repeat(120);
const NONCE = "n".repeat(32);
const call = (app: "customer" | "driver", extra: Row = {}) =>
  apple(new Request("http://localhost/api/v1/auth/apple", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.1.0.${++ip}` }, body: JSON.stringify({ identityToken: TOKEN, nonce: NONCE, app, ...extra }) }));
const json = async (r: Response) => (await r.json()) as { ok: boolean; data?: Record<string, any>; error?: { code: string; message: string } };

beforeEach(() => {
  process.env.MOBILE_JWT_SECRET = "test-only-mobile-secret-0123456789abcdef";
  delete process.env.NEXTAUTH_SECRET;
  setRateLimiter(new MemoryRateLimiter());
  setAuditSink(async () => {});
  db.users.length = db.drivers.length = db.accounts.length = db.logs.length = db.tokens.length = 0;
  db.reject = false;
  db.identity = { subject: "apple-sub-1", email: "ana@example.com", isPrivateRelay: false };
  db.users.push(
    { id: "c1", email: "ana@example.com", name: "Ana", phone: null, role: "CUSTOMER", passwordHash: "x", mustChangePassword: false },
    { id: "d1", email: "omar@example.com", name: "Omar", phone: null, role: "DRIVER", passwordHash: "x", mustChangePassword: false },
    { id: "d2", email: "pending@example.com", name: "Pia", phone: null, role: "DRIVER", passwordHash: "x", mustChangePassword: false },
    { id: "a1", email: "boss@example.com", name: "Boss", phone: null, role: "ADMIN", passwordHash: "x", mustChangePassword: false },
  );
  db.drivers.push({ userId: "d1", status: "APPROVED" }, { userId: "d2", status: "PENDING_APPROVAL" });
});

describe("Continue with Apple", () => {
  it("signs in the customer whose verified email matches, and remembers the Apple id", async () => {
    const res = await call("customer");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data?.user).toMatchObject({ id: "c1", role: "CUSTOMER" });
    expect(body.data?.accessToken).toBeTruthy();
    expect(db.accounts).toEqual([{ userId: "c1", type: "oauth", provider: "apple", providerAccountId: "apple-sub-1" }]);
    expect(JSON.stringify(body)).not.toMatch(/passwordHash/);
  });

  it("the next sign-in finds the account by the Apple id even if the email Apple shares has changed", async () => {
    await call("customer");
    db.identity = { subject: "apple-sub-1", email: "different-relay@privaterelay.appleid.com", isPrivateRelay: true };
    const body = await json(await call("customer"));
    expect(body.data?.user).toMatchObject({ id: "c1" });
    expect(db.users).toHaveLength(4);
    expect(db.accounts).toHaveLength(1);
  });

  it("creates a customer account for a new Apple user, using the name Apple gave the app", async () => {
    db.identity = { subject: "apple-sub-9", email: "new@privaterelay.appleid.com", isPrivateRelay: true };
    const res = await call("customer", { fullName: { givenName: "Nora", familyName: "Vale" } });
    expect(res.status).toBe(200);
    const created = db.users.find((u) => u.email === "new@privaterelay.appleid.com");
    expect(created).toMatchObject({ role: "CUSTOMER", name: "Nora Vale" });
    expect(db.accounts.some((a) => a.providerAccountId === "apple-sub-9")).toBe(true);
  });

  it("never creates a driver: an unknown Apple user in the driver app is refused", async () => {
    db.identity = { subject: "apple-sub-7", email: "stranger@example.com", isPrivateRelay: false };
    const res = await call("driver");
    expect(res.status).toBe(403);
    expect(db.users.some((u) => u.email === "stranger@example.com")).toBe(false);
  });

  it("signs an approved driver in to the driver app only", async () => {
    db.identity = { subject: "apple-sub-2", email: "omar@example.com", isPrivateRelay: false };
    expect((await json(await call("driver"))).data?.user).toMatchObject({ id: "d1", role: "DRIVER" });
    expect((await call("customer")).status).toBe(403);
  });

  it("keeps the same rules as a password sign-in: pending drivers, admins and cross-app use are refused", async () => {
    db.identity = { subject: "apple-sub-3", email: "pending@example.com", isPrivateRelay: false };
    expect((await call("driver")).status).toBe(403);
    db.identity = { subject: "apple-sub-4", email: "boss@example.com", isPrivateRelay: false };
    expect((await call("customer")).status).toBe(403);
    expect((await call("driver")).status).toBe(403);
    db.identity = { subject: "apple-sub-5", email: "ana@example.com", isPrivateRelay: false };
    expect((await call("driver")).status).toBe(403);
  });

  it("an Apple id linked to one person cannot be used to enter another person's account", async () => {
    await call("customer"); // links apple-sub-1 to Ana
    db.identity = { subject: "apple-sub-1", email: "omar@example.com", isPrivateRelay: false }; // same Apple id, now claiming Omar's email
    const body = await json(await call("customer"));
    expect(body.data?.user).toMatchObject({ id: "c1" }); // still Ana: the Apple id decides, not the email it presents
  });

  it("a token that does not verify gets nothing", async () => {
    db.reject = true;
    const res = await call("customer");
    expect(res.status).toBe(401);
    expect(db.tokens).toHaveLength(0);
  });

  it("rejects a malformed request before looking at Apple at all", async () => {
    const res = await apple(new Request("http://localhost/api/v1/auth/apple", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.2.0.1" }, body: JSON.stringify({ identityToken: "short", nonce: "x", app: "customer" }) }));
    expect(res.status).toBe(422);
  });

  it("is rate limited like the other sign-in routes", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      codes.push((await apple(new Request("http://localhost/api/v1/auth/apple", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.3.0.9" }, body: "{}" }))).status);
    }
    expect(codes).toContain(429);
  });
});

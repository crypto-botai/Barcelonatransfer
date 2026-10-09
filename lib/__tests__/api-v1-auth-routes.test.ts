import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

/**
 * The mobile sign-in routes, end to end, against an in-memory database: sign in,
 * call /me, refresh, replay a spent refresh token, sign out, register, and the
 * checks that make a suspended driver lose access.
 */

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  users: [] as Row[],
  drivers: [] as Row[],
  logs: [] as Row[],
  tokens: [] as Row[],
}));

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
        findFirst: async ({ where, include }: { where: { email: { equals: string } }; include?: unknown }) =>
          withDriver(db.users.find((u) => String(u.email).toLowerCase() === where.email.equals.toLowerCase()), include),
        findUnique: async ({ where, include }: { where: { id: string }; include?: unknown }) => withDriver(db.users.find((u) => u.id === where.id), include),
        create: async ({ data }: { data: Row }) => {
          if (db.users.some((u) => String(u.email).toLowerCase() === String(data.email).toLowerCase())) throw Object.assign(new Error("unique"), { code: "P2002" });
          const row = { id: `u${db.users.length + 1}`, mustChangePassword: false, image: null, ...data };
          db.users.push(row);
          return row;
        },
      },
      activityLog: {
        count: async ({ where }: { where: { action: string; entityId: string } }) => db.logs.filter((l) => l.action === where.action && l.entityId === where.entityId).length,
        create: async ({ data }: { data: Row }) => { db.logs.push(data); return data; },
      },
      mobileRefreshToken: {
        create: async ({ data }: { data: Row }) => { db.tokens.push({ usedAt: null, revokedAt: null, ...data }); return data; },
        findUnique: async ({ where }: { where: { tokenHash: string } }) => db.tokens.find((t) => t.tokenHash === where.tokenHash) ?? null,
        updateMany: async ({ where, data }: { where: Row; data: Row }) => {
          const hit = db.tokens.filter((t) => Object.entries(where).every(([k, v]) => t[k] === v));
          hit.forEach((t) => Object.assign(t, data));
          return { count: hit.length };
        },
      },
    },
  };
});

import { MemoryRateLimiter, setRateLimiter } from "@/lib/api/v1/rate-limit";
import { setAuditSink } from "@/lib/api/v1/audit";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as refresh } from "@/app/api/v1/auth/refresh/route";
import { POST as logout } from "@/app/api/v1/auth/logout/route";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { GET as me } from "@/app/api/v1/me/route";

let ip = 0;
const call = (handler: (r: Request) => Promise<Response>, path: string, body?: unknown, token?: string, method = "POST") =>
  handler(new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ip}`, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
const json = async (r: Response) => (await r.json()) as { ok: boolean; data?: Record<string, any>; error?: { code: string; message: string } };

beforeEach(async () => {
  process.env.MOBILE_JWT_SECRET = "test-only-mobile-secret-0123456789abcdef";
  delete process.env.NEXTAUTH_SECRET;
  setRateLimiter(new MemoryRateLimiter());
  setAuditSink(async () => {});
  db.users.length = db.drivers.length = db.logs.length = db.tokens.length = 0;
  const hash = await bcrypt.hash("correct horse", 4);
  db.users.push(
    { id: "c1", email: "ana@example.com", name: "Ana", phone: null, role: "CUSTOMER", passwordHash: hash, mustChangePassword: false },
    { id: "d1", email: "omar@example.com", name: "Omar", phone: null, role: "DRIVER", passwordHash: hash, mustChangePassword: false },
    { id: "a1", email: "boss@example.com", name: "Boss", phone: null, role: "ADMIN", passwordHash: hash, mustChangePassword: false },
  );
  db.drivers.push({ userId: "d1", status: "APPROVED" });
});

describe("sign in, refresh, sign out", () => {
  it("signs a customer in and /me knows them", async () => {
    const res = await call(login, "/api/v1/auth/login", { email: "ANA@example.com", password: "correct horse", app: "customer" });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data?.user).toMatchObject({ id: "c1", role: "CUSTOMER" });
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|HASH|\$2[aby]\$/);

    const who = await json(await call(me, "/api/v1/me", undefined, body.data!.accessToken, "GET"));
    expect(who.data).toMatchObject({ id: "c1", email: "ana@example.com", role: "CUSTOMER", mustChangePassword: false });
  });

  it("stores only a hash of the refresh token", async () => {
    const body = await json(await call(login, "/api/v1/auth/login", { email: "ana@example.com", password: "correct horse", app: "customer" }));
    const stored = JSON.stringify(db.tokens);
    expect(stored).not.toContain(body.data!.refreshToken);
    expect(db.tokens[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a wrong password and an unknown email look the same", async () => {
    const a = await json(await call(login, "/api/v1/auth/login", { email: "ana@example.com", password: "wrong", app: "customer" }));
    const b = await json(await call(login, "/api/v1/auth/login", { email: "ghost@example.com", password: "wrong", app: "customer" }));
    expect(a.error).toEqual(b.error);
    expect(a.error?.code).toBe("UNAUTHENTICATED");
  });

  it("keeps refusing one account after repeated failures, even from new addresses", async () => {
    for (let i = 0; i < 8; i++) await call(login, "/api/v1/auth/login", { email: "ana@example.com", password: "wrong", app: "customer" });
    const res = await call(login, "/api/v1/auth/login", { email: "ana@example.com", password: "correct horse", app: "customer" });
    expect(res.status).toBe(429);
  });

  it("refuses staff and the wrong app", async () => {
    expect((await call(login, "/api/v1/auth/login", { email: "boss@example.com", password: "correct horse", app: "customer" })).status).toBe(403);
    expect((await call(login, "/api/v1/auth/login", { email: "boss@example.com", password: "correct horse", app: "driver" })).status).toBe(403);
    expect((await call(login, "/api/v1/auth/login", { email: "omar@example.com", password: "correct horse", app: "customer" })).status).toBe(403);
    expect((await call(login, "/api/v1/auth/login", { email: "ana@example.com", password: "correct horse", app: "driver" })).status).toBe(403);
  });

  it("refresh hands out a new pair and spends the old token", async () => {
    const first = (await json(await call(login, "/api/v1/auth/login", { email: "ana@example.com", password: "correct horse", app: "customer" }))).data!;
    const second = await json(await call(refresh, "/api/v1/auth/refresh", { refreshToken: first.refreshToken }));
    expect(second.ok).toBe(true);
    expect(second.data!.refreshToken).not.toBe(first.refreshToken);

    // The spent token shown again: refused, and the whole family is revoked.
    const replay = await json(await call(refresh, "/api/v1/auth/refresh", { refreshToken: first.refreshToken }));
    expect(replay.error?.code).toBe("REFRESH_REUSED");
    const afterReplay = await json(await call(refresh, "/api/v1/auth/refresh", { refreshToken: second.data!.refreshToken }));
    expect(afterReplay.ok).toBe(false);
  });

  it("two refreshes at the same moment: one wins", async () => {
    const first = (await json(await call(login, "/api/v1/auth/login", { email: "ana@example.com", password: "correct horse", app: "customer" }))).data!;
    const [a, b] = await Promise.all([
      call(refresh, "/api/v1/auth/refresh", { refreshToken: first.refreshToken }),
      call(refresh, "/api/v1/auth/refresh", { refreshToken: first.refreshToken }),
    ]);
    expect([a.status, b.status].filter((s) => s === 200)).toHaveLength(1);
  });

  it("a suspended driver loses the session at the next refresh and at /me", async () => {
    const s = (await json(await call(login, "/api/v1/auth/login", { email: "omar@example.com", password: "correct horse", app: "driver" }))).data!;
    db.drivers[0].status = "SUSPENDED";
    expect((await call(me, "/api/v1/me", undefined, s.accessToken, "GET")).status).toBe(403);
    const r = await json(await call(refresh, "/api/v1/auth/refresh", { refreshToken: s.refreshToken }));
    expect(r.error?.code).toBe("TOKEN_INVALID");
    // ...and the new token that was just minted is dead too.
    expect(db.tokens.every((t) => t.revokedAt || t.usedAt)).toBe(true);
  });

  it("a pending driver cannot sign in", async () => {
    db.drivers[0].status = "PENDING_APPROVAL";
    const res = await call(login, "/api/v1/auth/login", { email: "omar@example.com", password: "correct horse", app: "driver" });
    expect(res.status).toBe(403);
  });

  it("sign out revokes the session", async () => {
    const s = (await json(await call(login, "/api/v1/auth/login", { email: "ana@example.com", password: "correct horse", app: "customer" }))).data!;
    expect((await call(logout, "/api/v1/auth/logout", { refreshToken: s.refreshToken })).status).toBe(200);
    const r = await json(await call(refresh, "/api/v1/auth/refresh", { refreshToken: s.refreshToken }));
    expect(r.ok).toBe(false);
    // An unknown token answers the same, so signing out cannot probe for valid tokens.
    expect((await call(logout, "/api/v1/auth/logout", { refreshToken: "x".repeat(40) })).status).toBe(200);
  });

  it("/me needs a token", async () => {
    expect((await call(me, "/api/v1/me", undefined, undefined, "GET")).status).toBe(401);
    expect((await call(me, "/api/v1/me", undefined, "garbage", "GET")).status).toBe(401);
  });
});

describe("register", () => {
  const good = { firstName: "Li", lastName: "Wei", email: "Li@Example.com", password: "a-long-enough-one", acceptTerms: true };

  it("creates a customer, never anything else, and signs them in", async () => {
    const res = await call(register, "/api/v1/auth/register", { ...good, role: "ADMIN" });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data?.user.role).toBe("CUSTOMER");
    expect(db.users.at(-1)).toMatchObject({ role: "CUSTOMER", email: "li@example.com", name: "Li Wei" });
    expect(String(db.users.at(-1)!.passwordHash)).toMatch(/^\$2[aby]\$/);
    const who = await json(await call(me, "/api/v1/me", undefined, body.data!.accessToken, "GET"));
    expect(who.data?.email).toBe("li@example.com");
  });

  it("refuses an address already in use, in any letter case", async () => {
    const res = await call(register, "/api/v1/auth/register", { ...good, email: "ANA@example.com" });
    expect(res.status).toBe(409);
  });

  it("insists on terms, a usable password and a real email", async () => {
    expect((await call(register, "/api/v1/auth/register", { ...good, acceptTerms: false })).status).toBe(422);
    expect((await call(register, "/api/v1/auth/register", { ...good, password: "short" })).status).toBe(422);
    expect((await call(register, "/api/v1/auth/register", { ...good, password: "a".repeat(73) })).status).toBe(422);
    expect((await call(register, "/api/v1/auth/register", { ...good, email: "not-an-email" })).status).toBe(422);
    const res = await json(await call(register, "/api/v1/auth/register", { ...good, password: "short" }));
    expect(JSON.stringify(res)).not.toContain("short\"");
  });
});

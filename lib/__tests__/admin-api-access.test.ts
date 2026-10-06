/// <reference types="vite/client" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Nobody may use an admin API route without being an administrator.
 *
 * Every route under app/api/admin is called here three ways: with no session at all, with a
 * signed-in CUSTOMER (anyone can register one), and with a DRIVER. Each must be refused (401
 * or 403) and must not reach the database. The database is replaced by an object that throws
 * the moment anything touches it, so a route that checks the caller too late is caught.
 *
 */

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; role: string } } }));

vi.mock("next-auth", () => ({ getServerSession: async () => session.current }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, { get: (_t, prop) => { throw new Error(`a refused caller reached the database (prisma.${String(prop)})`); } }),
}));

const ROOT = join(__dirname, "..", "..");
const modules = import.meta.glob("../../app/api/admin/**/route.ts") as Record<string, () => Promise<Record<string, unknown>>>;
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const ctx = { params: Promise.resolve({ id: "x", phone: "+34600000000", slug: "x", code: "x", key: "x" }) };

const call = (fn: unknown, method: string) =>
  (fn as (req: Request, c: typeof ctx) => Promise<Response>)(
    new Request("http://localhost/api/admin/probe", { method, headers: { "content-type": "application/json" }, body: method === "GET" || method === "DELETE" ? undefined : "{}" }),
    ctx,
  );

beforeEach(() => { session.current = null; });

describe("the admin API refuses everyone who is not an administrator", () => {
  const entries = Object.entries(modules).map(([path, load]) => [path.replace("../../", ""), load] as const);

  it("finds the admin routes", () => {
    expect(entries.length).toBeGreaterThan(40);
  });

  const callers: [string, null | { user: { id: string; role: string } }][] = [
    ["anonymous", null],
    ["a signed-in customer", { user: { id: "c1", role: "CUSTOMER" } }],
    ["a signed-in driver", { user: { id: "d1", role: "DRIVER" } }],
  ];

  for (const [who, sess] of callers) {
    it.each(entries)(`%s refuses ${who}`, async (path, load) => {
      session.current = sess;
      const mod = await load();
      const exported = METHODS.filter((m) => typeof mod[m] === "function");
      expect(exported.length, `${path} exports no HTTP handler`).toBeGreaterThan(0);
      for (const method of exported) {
        const res = await call(mod[method], method);
        expect([401, 403], `${method} ${path} answered ${res.status} to ${who}`).toContain(res.status);
      }
    });
  }
});

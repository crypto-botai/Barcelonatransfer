import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A baseline for who may open what.
 *
 * These pass today and must still pass after any change to Next.js, next-auth or the
 * middleware (the planned security upgrade in particular). They cover the two places
 * access is decided:
 *   1. middleware.ts: sign-in required and the role for each area, on the production hosts;
 *   2. the API handlers, which check the session themselves.
 */

const getToken = vi.hoisted(() => vi.fn());
vi.mock("next-auth/jwt", () => ({ getToken }));

import { middleware } from "@/middleware";

const PROD = "www.elitebcn.info";
const call = (path: string, host = PROD) => middleware(new NextRequest(`https://${host}${path}`, { headers: { host } }));
const signedIn = (role: string, extra: Record<string, unknown> = {}) => getToken.mockResolvedValue({ id: "u1", role, ...extra });
const signedOut = () => getToken.mockResolvedValue(null);

/** Where a response sends the visitor, as "path", or null when the request passes through. */
const redirectedTo = (res: Response) => {
  const loc = res.headers.get("location");
  return loc ? new URL(loc).pathname + new URL(loc).search : null;
};

beforeEach(() => getToken.mockReset());

describe("signed-out visitors", () => {
  it.each(["/admin", "/admin/bookings", "/driver", "/partner", "/partner/jobs", "/dashboard", "/dashboard/bookings"])("are sent from %s to the login page, with a way back", async (path) => {
    signedOut();
    const res = await call(path);
    expect(res.status).toBe(307);
    expect(redirectedTo(res)).toBe(`/auth/login?callbackUrl=${encodeURIComponent(path)}`);
  });

  it("may open the two sign-up pages and the public site", async () => {
    signedOut();
    for (const path of ["/driver/register", "/partner/register", "/", "/pricing", "/book", "/auth/login"]) {
      expect(redirectedTo(await call(path))).toBeNull();
    }
  });
});

describe("each role stays in its own area", () => {
  const cases: [role: string, path: string, to: string | null][] = [
    // ADMIN
    ["ADMIN", "/admin", null],
    ["ADMIN", "/admin/bookings", null],
    ["ADMIN", "/driver", "/admin"],
    ["ADMIN", "/dashboard", "/admin"],
    ["ADMIN", "/dashboard/tracking/abc123", null],
    ["ADMIN", "/partner", "/fleet-login"],
    // DRIVER
    ["DRIVER", "/driver", null],
    ["DRIVER", "/admin", "/driver"],
    ["DRIVER", "/dashboard", "/driver"],
    ["DRIVER", "/partner", "/fleet-login"],
    // PARTNER
    ["PARTNER", "/partner", null],
    ["PARTNER", "/admin", "/partner"],
    ["PARTNER", "/driver", "/partner"],
    ["PARTNER", "/dashboard", "/partner"],
    // CUSTOMER
    ["CUSTOMER", "/dashboard", null],
    ["CUSTOMER", "/admin", "/dashboard"],
    ["CUSTOMER", "/driver", "/dashboard"],
    ["CUSTOMER", "/partner", "/fleet-login"],
  ];

  it.each(cases)("%s opening %s", async (role, path, to) => {
    signedIn(role);
    expect(redirectedTo(await call(path))).toBe(to);
  });

  it("sends a signed-in person who opens the login page to their own area", async () => {
    for (const [role, home] of [["ADMIN", "/admin"], ["DRIVER", "/driver"], ["PARTNER", "/partner"], ["CUSTOMER", "/dashboard"]] as const) {
      signedIn(role);
      expect(redirectedTo(await call("/auth/login"))).toBe(home);
    }
  });

  it("treats a token whose account no longer exists as signed out", async () => {
    getToken.mockResolvedValue({ role: "ADMIN" }); // no id: the account was deleted
    expect((await call("/admin")).status).toBe(307);
    expect(redirectedTo(await call("/admin"))).toContain("/auth/login");
  });
});

describe("temporary passwords", () => {
  it("send a page request to the change-password page", async () => {
    signedIn("DRIVER", { mustChangePassword: true });
    expect(redirectedTo(await call("/driver"))).toBe("/auth/change-password");
  });

  it("never redirect an API call, or the change-password page itself, or logout", async () => {
    signedIn("DRIVER", { mustChangePassword: true });
    for (const path of ["/api/auth/change-password", "/api/bookings", "/auth/change-password", "/auth/logout"]) {
      expect(redirectedTo(await call(path))).not.toBe("/auth/change-password");
    }
  });
});

describe("search engines and other hosts", () => {
  it("marks every staff and auth area noindex", async () => {
    signedIn("ADMIN");
    for (const path of ["/admin", "/auth/login", "/dashboard/tracking/x", "/partner/register"]) {
      expect((await call(path)).headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
    signedOut();
    expect((await call("/admin")).headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("does not mark a public page noindex", async () => {
    signedOut();
    expect((await call("/pricing")).headers.get("x-robots-tag")).toBeNull();
  });

  it("on any other host (a preview or staging) only adds noindex and does no role gating", async () => {
    signedOut();
    for (const host of ["elitebcn-staging.vercel.app", "barcelonatransfer-git-staging-team.vercel.app", "localhost:3000"]) {
      const res = await call("/admin", host);
      expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(redirectedTo(res)).toBeNull();
    }
    // The consequence is documented: gating on those hosts rests on the handlers below.
    expect(getToken).not.toHaveBeenCalled();
  });

  it("recognises both production hostnames", async () => {
    signedOut();
    expect((await call("/admin", "elitebcn.info")).status).toBe(307);
    expect((await call("/admin", "www.elitebcn.info")).status).toBe(307);
  });
});

/* ───────────────────────── the handlers check access themselves ───────────────────────── */

const ROOT = join(__dirname, "..", "..");

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...routeFiles(path));
    else if (name === "route.ts") out.push(path);
  }
  return out;
}

const rel = (p: string) => p.slice(ROOT.length + 1).split("\\").join("/");
const ADMIN_CHECK = /getServerSession|requireAdmin|requireRole|authorize|isAdmin/;

/**
 * How many admin API handlers may lack a session and role check. Every new admin route
 * must have one. The allowance below is for one older route that is tracked in the
 * private security plan and scheduled for removal; this number may only fall, never rise.
 */
const MAX_UNCHECKED_ADMIN_ROUTES = 1;

describe("API handlers verify the caller, whatever the middleware does", () => {
  const admin = routeFiles(join(ROOT, "app", "api", "admin")).map(rel);

  it("finds the admin API routes", () => {
    expect(admin.length).toBeGreaterThan(40);
  });

  it("every admin API route checks the session and role, apart from the one tracked allowance", () => {
    const unchecked = admin.filter((f) => !ADMIN_CHECK.test(readFileSync(join(ROOT, f), "utf8")));
    expect(unchecked.length).toBeLessThanOrEqual(MAX_UNCHECKED_ADMIN_ROUTES);
  });

  it.each(["driver", "partner"])("every %s API route checks the session", (area) => {
    const files = routeFiles(join(ROOT, "app", "api", area)).map(rel);
    expect(files.length).toBeGreaterThan(0);
    const unchecked = files.filter((f) => !/getServerSession|requireDriver|requirePartner|requireRole|requireAdmin|session/.test(readFileSync(join(ROOT, f), "utf8")));
    expect(unchecked).toEqual([]);
  });
});

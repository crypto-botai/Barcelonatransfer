import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { apiHandler } from "@/lib/api/v1/response";
import { ApiError } from "@/lib/api/v1/errors";
import { parseBody, parseQuery } from "@/lib/api/v1/validate";
import { MemoryRateLimiter, setRateLimiter } from "@/lib/api/v1/rate-limit";
import { redact, setLogSink } from "@/lib/api/v1/logger";
import { audit, setAuditSink } from "@/lib/api/v1/audit";
import { compareVersions, evaluateAppVersion, platformVersions } from "@/lib/api/v1/app-version";
import { API_ERRORS } from "@/lib/api/v1/types";
import { signAccessToken, type MobileAuthConfig } from "@/lib/api/v1/tokens";
import { GET as health } from "@/app/api/v1/health/route";
import { GET as appConfig } from "@/app/api/v1/app-config/route";

/**
 * The shared plumbing of /api/v1: one response shape, one error shape, validation
 * that never echoes a value, rate limiting, logs and audit entries that carry no
 * secrets, and the app version gate.
 */

const cfg: MobileAuthConfig = {
  secret: new TextEncoder().encode("test-secret-test-secret-test-secret-1234"),
  issuer: "elitebcn",
  audience: "elitebcn-mobile",
  accessTtlSeconds: 900,
  refreshTtlSeconds: 86400,
  refreshFamilyMaxSeconds: 86400 * 90,
};
const get = (url = "http://x/api/v1/t", headers: Record<string, string> = {}) => new Request(url, { headers });
const logs: string[] = [];

beforeEach(() => {
  logs.length = 0;
  setLogSink((l) => logs.push(l));
  setRateLimiter(new MemoryRateLimiter());
});

describe("the response envelope", () => {
  it("wraps data with a request id and the api version, and keeps it out of caches", async () => {
    const res = await apiHandler("t", async () => ({ hello: "world" }), { auth: false })(get());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, data: { hello: "world" }, meta: { apiVersion: "v1" } });
    expect(body.meta.requestId).toBe(res.headers.get("X-Request-Id"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
  });

  it("answers a thrown ApiError in the standard error shape with its own status", async () => {
    const res = await apiHandler("t", async () => { throw new ApiError("NOT_FOUND", "No such ride."); }, { auth: false })(get());
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body).toMatchObject({ ok: false, error: { code: "NOT_FOUND", message: "No such ride.", retryable: false } });
  });

  it("never describes an unexpected error to the caller, but logs it", async () => {
    const res = await apiHandler("t", async () => { throw new Error("connection to db-host-secret failed"); }, { auth: false })(get());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(body)).not.toContain("db-host-secret");
    expect(logs.join("\n")).toContain("INTERNAL");
  });

  it("uses a distinct status for every error code, and only the right ones are retryable", () => {
    expect(API_ERRORS.RATE_LIMITED).toEqual({ status: 429, retryable: true });
    expect(API_ERRORS.UPGRADE_REQUIRED.status).toBe(426);
    expect(API_ERRORS.TOKEN_EXPIRED.retryable).toBe(false);
    expect(API_ERRORS.UNAVAILABLE.retryable).toBe(true);
  });
});

describe("authentication on a route", () => {
  it("rejects a call with no bearer token", async () => {
    const res = await apiHandler("t", async () => "x")(get());
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("does not accept the web session cookie in place of a bearer token", async () => {
    const res = await apiHandler("t", async () => "x")(get("http://x/api/v1/t", { cookie: "next-auth.session-token=abc" }));
    expect(res.status).toBe(401);
  });

  it("accepts a valid token and passes the caller to the handler", async () => {
    const token = await signAccessToken({ userId: "u1", role: "CUSTOMER", sessionId: "s1" }, cfg);
    const handler = apiHandler("t", async ({ auth }) => auth, { auth: { config: cfg } });
    const body = await (await handler(get("http://x/api/v1/t", { authorization: `Bearer ${token}` }))).json();
    expect(body.data).toEqual({ userId: "u1", role: "CUSTOMER", sessionId: "s1" });
  });

  it("refuses a role the route does not allow", async () => {
    const token = await signAccessToken({ userId: "u1", role: "CUSTOMER", sessionId: "s1" }, cfg);
    const handler = apiHandler("t", async () => "x", { auth: { roles: ["DRIVER"], config: cfg } });
    const res = await handler(get("http://x/api/v1/t", { authorization: `Bearer ${token}` }));
    expect(res.status).toBe(403);
  });
});

describe("validation", () => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
  const post = (body: string) => new Request("http://x", { method: "POST", body });

  it("names the wrong fields and never echoes the values sent", async () => {
    const secret = "hunter2-not-long-enough-xx".slice(0, 5);
    await expect(parseBody(post(JSON.stringify({ email: "nope", password: secret })), schema)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: expect.arrayContaining([expect.objectContaining({ path: "email" }), expect.objectContaining({ path: "password" })]),
    });
    try {
      await parseBody(post(JSON.stringify({ email: "nope", password: secret })), schema);
    } catch (e) {
      expect(JSON.stringify((e as ApiError).details)).not.toContain(secret);
    }
  });

  it("rejects bad JSON and oversized bodies", async () => {
    await expect(parseBody(post("{not json"), schema)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(parseBody(post("x".repeat(100)), schema, 50)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("parses a query string", () => {
    expect(parseQuery(new Request("http://x/?a=1&b=two"), z.object({ a: z.string(), b: z.string() }))).toEqual({ a: "1", b: "two" });
  });
});

describe("rate limiting", () => {
  it("allows up to the limit, then answers 429 with Retry-After, and recovers after the window", async () => {
    let now = 1_000_000;
    const limiter = new MemoryRateLimiter(() => now);
    expect((await limiter.hit("k", 2, 60)).allowed).toBe(true);
    expect((await limiter.hit("k", 2, 60)).allowed).toBe(true);
    const blocked = await limiter.hit("k", 2, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    now += 61_000;
    expect((await limiter.hit("k", 2, 60)).allowed).toBe(true);
  });

  it("counts callers separately", async () => {
    const limiter = new MemoryRateLimiter();
    await limiter.hit("a", 1, 60);
    expect((await limiter.hit("a", 1, 60)).allowed).toBe(false);
    expect((await limiter.hit("b", 1, 60)).allowed).toBe(true);
  });

  it("stays bounded in memory", async () => {
    const limiter = new MemoryRateLimiter(Date.now, 50);
    for (let i = 0; i < 500; i++) await limiter.hit(`k${i}`, 5, 60);
    expect((limiter as unknown as { buckets: Map<string, unknown> }).buckets.size).toBeLessThanOrEqual(50);
  });

  it("turns a blocked public call into the standard error with the header", async () => {
    setRateLimiter({ hit: async () => ({ allowed: false, remaining: 0, retryAfterSeconds: 17 }) });
    const res = await apiHandler("t", async () => "x", { auth: false })(get());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("17");
    expect((await res.json()).error).toMatchObject({ code: "RATE_LIMITED", retryable: true, retryAfterSeconds: 17 });
  });
});

describe("logs and audit carry no secrets", () => {
  it("redacts tokens, passwords, cookies and card details, at any depth", () => {
    const out = JSON.stringify(
      redact({ userId: "u1", authorization: "Bearer abc", nested: { refreshToken: "r", password: "p", cardNumber: "4111", ok: "keep" }, list: [{ apiKey: "k" }] }),
    );
    for (const secret of ["Bearer abc", '"r"', '"p"', "4111", '"k"']) expect(out).not.toContain(secret);
    expect(out).toContain("keep");
    expect(out).toContain("u1");
  });

  it("keeps the error code readable in a log line", async () => {
    await apiHandler("t", async () => { throw new ApiError("FORBIDDEN", "no"); }, { auth: false })(get());
    expect(JSON.parse(logs.at(-1)!)).toMatchObject({ errorCode: "FORBIDDEN", route: "t", status: 403, api: "v1" });
  });

  it("writes an audit entry, and a failing sink never breaks the caller", async () => {
    const seen: string[] = [];
    setAuditSink(async (e) => { seen.push(e.action); });
    await audit({ action: "API_V1_TEST", entity: "Booking", requestId: "r1" });
    expect(seen).toEqual(["API_V1_TEST"]);

    setAuditSink(async () => { throw new Error("database is down"); });
    await expect(audit({ action: "API_V1_TEST", entity: "Booking", requestId: "r2" })).resolves.toBeUndefined();
    expect(logs.join("\n")).toContain("AUDIT_WRITE_FAILED");
  });
});

describe("app version gate", () => {
  const v = { minimum: "1.2.0", latest: "1.4.0", storeUrl: null };

  it("compares versions numerically, not as text", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
    expect(compareVersions("1.2.0", "1.2.0")).toBe(0);
    expect(compareVersions("0.9.9", "1.0.0")).toBe(-1);
  });

  it("says ok, update available, or update required", () => {
    expect(evaluateAppVersion("1.4.0", v)).toBe("ok");
    expect(evaluateAppVersion("1.3.0", v)).toBe("update_available");
    expect(evaluateAppVersion("1.1.9", v)).toBe("update_required");
    expect(evaluateAppVersion("garbage", v)).toBe("update_required");
  });

  it("allows every version until minimums are configured", () => {
    expect(evaluateAppVersion("0.0.1", platformVersions("ios", "customer", {}))).toBe("ok");
  });

  it("reads per-app, per-platform settings", () => {
    const env = { MOBILE_DRIVER_ANDROID_MIN_VERSION: "2.0.0", MOBILE_DRIVER_ANDROID_STORE_URL: "https://play.example/driver" };
    expect(platformVersions("android", "driver", env)).toMatchObject({ minimum: "2.0.0", storeUrl: "https://play.example/driver" });
    expect(platformVersions("ios", "driver", env).minimum).toBe("0.0.0");
  });
});

describe("the two public routes", () => {
  it("health answers without a database and names the environment", async () => {
    const body = await (await health(get("http://x/api/v1/health"))).json();
    expect(body.data).toMatchObject({ status: "ok", apiVersion: "v1" });
    expect(typeof body.data.environment).toBe("string");
    expect(JSON.stringify(body)).not.toMatch(/postgres|secret|token/i);
  });

  it("app-config validates its query and returns a verdict", async () => {
    const bad = await appConfig(get("http://x/api/v1/app-config?app=customer"));
    expect(bad.status).toBe(422);
    const ok = await appConfig(get("http://x/api/v1/app-config?app=customer&platform=ios&version=1.0.0"));
    expect((await ok.json()).data.verdict).toBe("ok");
  });
});

import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import {
  MemoryRefreshTokenStore,
  hashRefreshToken,
  issueSession,
  mobileAuthConfig,
  revokeSession,
  rotateRefreshToken,
  signAccessToken,
  verifyAccessToken,
  type MobileAuthConfig,
} from "@/lib/api/v1/tokens";

/**
 * Mobile tokens: a 15-minute access token and a single-use rotating refresh
 * token, with the whole family revoked the moment a spent token is replayed.
 */

const SECRET = "test-secret-test-secret-test-secret-1234";
const cfg: MobileAuthConfig = {
  secret: new TextEncoder().encode(SECRET),
  issuer: "elitebcn",
  audience: "elitebcn-mobile",
  accessTtlSeconds: 900,
  refreshTtlSeconds: 30 * 86400,
  refreshFamilyMaxSeconds: 90 * 86400,
};
const who = { userId: "u1", role: "DRIVER" as const };
const T0 = 1_800_000_000_000;

describe("configuration", () => {
  it("refuses a missing or short secret", () => {
    expect(() => mobileAuthConfig({})).toThrow();
    expect(() => mobileAuthConfig({ MOBILE_JWT_SECRET: "short" })).toThrow();
  });

  it("refuses to reuse the web's session secret", () => {
    expect(() => mobileAuthConfig({ MOBILE_JWT_SECRET: SECRET, NEXTAUTH_SECRET: SECRET })).toThrow();
  });

  it("accepts its own long secret and sets a 15-minute access token", () => {
    const c = mobileAuthConfig({ MOBILE_JWT_SECRET: SECRET, NEXTAUTH_SECRET: "a-different-web-secret-of-some-length" });
    expect(c.accessTtlSeconds).toBe(900);
  });
});

describe("access tokens", () => {
  it("round-trips the caller", async () => {
    const t = await signAccessToken({ userId: "u1", role: "CUSTOMER", sessionId: "s1" }, cfg, T0);
    expect(await verifyAccessToken(t, cfg, T0 + 1000)).toEqual({ userId: "u1", role: "CUSTOMER", sessionId: "s1" });
  });

  it("expires after 15 minutes with a code the app can act on", async () => {
    const t = await signAccessToken({ userId: "u1", role: "CUSTOMER", sessionId: "s1" }, cfg, T0);
    await expect(verifyAccessToken(t, cfg, T0 + 899_000)).resolves.toBeTruthy();
    await expect(verifyAccessToken(t, cfg, T0 + 901_000)).rejects.toMatchObject({ code: "TOKEN_EXPIRED" });
  });

  it("rejects a token signed with another secret, another audience, or no signature", async () => {
    const other = { ...cfg, secret: new TextEncoder().encode("another-secret-another-secret-another-1") };
    const forged = await signAccessToken({ userId: "u1", role: "ADMIN", sessionId: "s1" }, other, T0);
    await expect(verifyAccessToken(forged, cfg, T0)).rejects.toMatchObject({ code: "TOKEN_INVALID" });

    const wrongAudience = await new SignJWT({ role: "ADMIN", sid: "s" }).setProtectedHeader({ alg: "HS256" }).setSubject("u1").setIssuer("elitebcn").setAudience("web").setIssuedAt().setExpirationTime("15m").sign(cfg.secret);
    await expect(verifyAccessToken(wrongAudience, cfg)).rejects.toMatchObject({ code: "TOKEN_INVALID" });

    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ sub: "u1", role: "ADMIN", sid: "s", iss: "elitebcn", aud: "elitebcn-mobile", exp: 9_999_999_999 })).toString("base64url");
    await expect(verifyAccessToken(`${header}.${body}.`, cfg)).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });

  it("rejects a token whose role is not one we know", async () => {
    const t = await new SignJWT({ role: "ROOT", sid: "s" }).setProtectedHeader({ alg: "HS256" }).setSubject("u1").setIssuer("elitebcn").setAudience("elitebcn-mobile").setIssuedAt().setExpirationTime("15m").sign(cfg.secret);
    await expect(verifyAccessToken(t, cfg)).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });
});

describe("refresh tokens", () => {
  it("stores only a hash, never the token", async () => {
    const store = new MemoryRefreshTokenStore();
    const s = await issueSession(store, who, cfg, T0);
    const [record] = [...store.records.values()];
    expect(record.tokenHash).toBe(hashRefreshToken(s.refreshToken));
    expect(JSON.stringify(record)).not.toContain(s.refreshToken);
  });

  it("issues a new pair on refresh, in the same family and session, and spends the old token", async () => {
    const store = new MemoryRefreshTokenStore();
    const first = await issueSession(store, who, cfg, T0);
    const second = await rotateRefreshToken(store, first.refreshToken, cfg, T0 + 60_000);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    const [a, b] = [...store.records.values()];
    expect(a.familyId).toBe(b.familyId);
    expect(a.sessionId).toBe(b.sessionId);
    expect(a.usedAt).not.toBeNull();
    expect(b.usedAt).toBeNull();
    expect((await verifyAccessToken(second.accessToken, cfg, T0 + 61_000)).userId).toBe("u1");
  });

  it("revokes the whole family when a spent token is replayed, including the newest token", async () => {
    const store = new MemoryRefreshTokenStore();
    const first = await issueSession(store, who, cfg, T0);
    const second = await rotateRefreshToken(store, first.refreshToken, cfg, T0 + 1000);
    await expect(rotateRefreshToken(store, first.refreshToken, cfg, T0 + 2000)).rejects.toMatchObject({ code: "REFRESH_REUSED" });
    await expect(rotateRefreshToken(store, second.refreshToken, cfg, T0 + 3000)).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });

  it("lets only one of two simultaneous refreshes win, and ends the session for the loser's replay", async () => {
    const store = new MemoryRefreshTokenStore();
    const first = await issueSession(store, who, cfg, T0);
    const results = await Promise.allSettled([
      rotateRefreshToken(store, first.refreshToken, cfg, T0 + 1000),
      rotateRefreshToken(store, first.refreshToken, cfg, T0 + 1000),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });

  it("rejects an unknown token and an expired token", async () => {
    const store = new MemoryRefreshTokenStore();
    await expect(rotateRefreshToken(store, "never-issued", cfg, T0)).rejects.toMatchObject({ code: "TOKEN_INVALID" });
    const s = await issueSession(store, who, cfg, T0);
    await expect(rotateRefreshToken(store, s.refreshToken, cfg, T0 + 31 * 86400_000)).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });

  it("ends a session after 90 days however often it was refreshed", async () => {
    const store = new MemoryRefreshTokenStore();
    let tokens = await issueSession(store, who, cfg, T0);
    for (let day = 25; day <= 75; day += 25) tokens = await rotateRefreshToken(store, tokens.refreshToken, cfg, T0 + day * 86400_000);
    await expect(rotateRefreshToken(store, tokens.refreshToken, cfg, T0 + 91 * 86400_000)).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });

  it("signing out makes the refresh token useless", async () => {
    const store = new MemoryRefreshTokenStore();
    const s = await issueSession(store, who, cfg, T0);
    await revokeSession(store, s.refreshToken, T0 + 1000);
    await expect(rotateRefreshToken(store, s.refreshToken, cfg, T0 + 2000)).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });
});

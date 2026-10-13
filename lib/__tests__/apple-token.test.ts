import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT, generateKeyPair, type JWTVerifyGetKey, type KeyLike } from "jose";
import { appleAudiences, hashNonce, verifyAppleIdentityToken } from "@/lib/api/v1/apple-token";

const AUD = "info.elitebcn.customer";
const RAW_NONCE = "a-random-value-kept-by-the-app-0001";
const NOW = 1_800_000_000_000;

let priv: KeyLike;
let other: KeyLike;
let getKey: JWTVerifyGetKey;

beforeAll(async () => {
  const a = await generateKeyPair("RS256");
  const b = await generateKeyPair("RS256");
  priv = a.privateKey;
  other = b.privateKey;
  getKey = (async () => a.publicKey) as unknown as JWTVerifyGetKey;
});

async function token(claims: Record<string, unknown> = {}, opts: { key?: KeyLike; iss?: string; aud?: string; exp?: number } = {}) {
  return new SignJWT({ email: "Rider@Example.com", email_verified: "true", nonce: hashNonce(RAW_NONCE), ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opts.iss ?? "https://appleid.apple.com")
    .setAudience(opts.aud ?? AUD)
    .setSubject(typeof claims.sub === "string" ? claims.sub : "001234.abcdef.5678")
    .setIssuedAt(Math.floor(NOW / 1000) - 60)
    .setExpirationTime(opts.exp ?? Math.floor(NOW / 1000) + 600)
    .sign(opts.key ?? priv);
}

const verify = (t: string, nonce = RAW_NONCE) => verifyAppleIdentityToken(t, nonce, { getKey, audiences: [AUD], nowMs: NOW });

describe("Sign in with Apple token check", () => {
  it("accepts a good token and lower-cases the email", async () => {
    expect(await verify(await token())).toEqual({ subject: "001234.abcdef.5678", email: "rider@example.com", isPrivateRelay: false });
  });

  it("recognises a private relay address and still accepts it", async () => {
    const r = await verify(await token({ email: "xyz@privaterelay.appleid.com", is_private_email: "true" }));
    expect(r.isPrivateRelay).toBe(true);
    expect(r.email).toBe("xyz@privaterelay.appleid.com");
  });

  it("refuses a token signed by someone else", async () => {
    await expect(verify(await token({}, { key: other }))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("refuses the wrong issuer, the wrong app, and an expired token", async () => {
    await expect(verify(await token({}, { iss: "https://evil.example" }))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(verify(await token({}, { aud: "com.someone.else" }))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(verify(await token({}, { exp: Math.floor(NOW / 1000) - 10 }))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("refuses an unverified email or a missing one", async () => {
    await expect(verify(await token({ email_verified: "false" }))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(verify(await token({ email: undefined }))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("refuses a replay: the nonce must match the sign-in that was started", async () => {
    const t = await token();
    await expect(verify(t, "a-different-random-value-0002")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(verify(await token({ nonce: undefined }))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(verify(await token({ nonce: RAW_NONCE }))).rejects.toMatchObject({ code: "UNAUTHENTICATED" }); // the raw value, not its hash
  });

  it("refuses garbage, and treats an unreachable key service as 'unavailable', not as a bad login", async () => {
    await expect(verify("not.a.jwt")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    const down = (async () => { throw new Error("network down"); }) as unknown as JWTVerifyGetKey;
    await expect(verifyAppleIdentityToken(await token(), RAW_NONCE, { getKey: down, audiences: [AUD], nowMs: NOW })).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
});

describe("which apps' tokens are accepted", () => {
  it("production accepts only the two store apps", () => {
    expect(appleAudiences({})).toEqual(["info.elitebcn.customer", "info.elitebcn.driver"]);
  });
  it("staging also accepts the two staging apps; production never does", () => {
    expect(appleAudiences({ APP_ENV: "staging" })).toEqual(["info.elitebcn.customer", "info.elitebcn.driver", "info.elitebcn.customer.staging", "info.elitebcn.driver.staging"]);
    expect(appleAudiences({ APP_ENV: "production" })).not.toContain("info.elitebcn.customer.staging");
  });
});

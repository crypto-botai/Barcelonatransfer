import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { ApiError } from "./errors";

/**
 * Checking a "Sign in with Apple" identity token sent by a mobile app.
 *
 * The phone signs the person in with Apple and gets an identity token (a signed JWT). The server never trusts it as it arrives:
 * the signature is checked against Apple's published keys, the issuer must be Apple, the audience must be one of OUR apps'
 * bundle identifiers, it must not have expired, the email must be one Apple has verified, and the token must carry the nonce this
 * sign-in was started with. The nonce is what stops a token captured from one sign-in being replayed in another.
 *
 * Apple may give a private relay address (xyz@privaterelay.appleid.com) instead of the person's own email. That is still a
 * working, verified address for that person and app, and it is accepted. The stable identity is `sub`, which the route stores.
 */

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_KEYS = "https://appleid.apple.com/auth/keys";

/** The bundle identifiers whose tokens are accepted. Staging identifiers are accepted only by a staging deployment. */
export function appleAudiences(env: Record<string, string | undefined> = process.env): string[] {
  const ids = ["info.elitebcn.customer", "info.elitebcn.driver"];
  if ((env.APP_ENV ?? "").trim().toLowerCase() === "staging") ids.push("info.elitebcn.customer.staging", "info.elitebcn.driver.staging");
  const extra = (env.APPLE_MOBILE_AUDIENCES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return [...ids, ...extra];
}

export interface AppleIdentity {
  /** Apple's stable id for this person and our team. */
  subject: string;
  email: string;
  isPrivateRelay: boolean;
}

/** What the app must send as `nonce` to Apple: the SHA-256 (hex) of the random value it keeps. The server recomputes it. */
export function hashNonce(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

let remote: JWTVerifyGetKey | null = null;
const appleKeys = (): JWTVerifyGetKey => (remote ??= createRemoteJWKSet(new URL(APPLE_KEYS), { timeoutDuration: 5000, cooldownDuration: 30_000 }));

export async function verifyAppleIdentityToken(
  identityToken: string,
  rawNonce: string,
  opts: { getKey?: JWTVerifyGetKey; audiences?: string[]; nowMs?: number } = {},
): Promise<AppleIdentity> {
  const invalid = () => new ApiError("UNAUTHENTICATED", "Apple sign-in could not be confirmed. Try again.");
  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(identityToken, opts.getKey ?? appleKeys(), {
      issuer: APPLE_ISSUER,
      audience: opts.audiences ?? appleAudiences(),
      algorithms: ["RS256"],
      currentDate: new Date(opts.nowMs ?? Date.now()),
    });
    payload = verified.payload as Record<string, unknown>;
  } catch (e) {
    const code = typeof e === "object" && e !== null ? String((e as { code?: unknown }).code ?? "") : "";
    // A bad or expired token, wrong audience, wrong key: the person's sign-in is refused. Anything else is Apple's key service being
    // unreachable, which is not the person's fault.
    if (code.startsWith("ERR_JWT") || code.startsWith("ERR_JWS") || code === "ERR_JWKS_NO_MATCHING_KEY" || code === "ERR_JWKS_MULTIPLE_MATCHING_KEYS" || code === "ERR_JOSE_ALG_NOT_ALLOWED") throw invalid();
    throw new ApiError("UNAVAILABLE", "Apple sign-in is not available right now. Try again shortly.");
  }

  const subject = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const verified = payload.email_verified === true || payload.email_verified === "true";
  const nonce = typeof payload.nonce === "string" ? payload.nonce : "";
  if (!subject || !email || !verified) throw invalid();
  if (!nonce || nonce !== hashNonce(rawNonce)) throw invalid();

  return { subject, email, isPrivateRelay: payload.is_private_email === true || payload.is_private_email === "true" };
}

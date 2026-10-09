import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import { ApiError } from "./errors";
import type { ApiRole, AuthContext } from "./types";

/**
 * Mobile sign-in tokens: a short-lived access token and a rotating refresh token.
 *
 * ACCESS TOKEN
 *   A signed JWT (HS256) that lives 15 minutes. It names the user, the role and the
 *   device session. It is sent as "Authorization: Bearer ..." and is checked
 *   without touching the database, so it cannot be revoked early: that is why it
 *   is short. Routes that change money or data re-read the user and the session.
 *
 * REFRESH TOKEN
 *   A random 256-bit string, not a JWT. Only its SHA-256 hash is ever stored, so a
 *   database leak does not leak sign-ins. It is single use: each refresh returns a
 *   new refresh token and marks the old one used. Tokens from one sign-in share a
 *   "family". If an already-used token is presented again, someone holds a copy,
 *   so the whole family is revoked and the person signs in again. That is
 *   rotation with reuse detection.
 *
 * The apps keep both tokens in the platform's secure storage (iOS Keychain,
 * Android Keystore), never in AsyncStorage or any plain storage.
 *
 * This module holds the logic and a storage interface. The Prisma-backed store
 * arrives with the sign-in endpoints in the next phase, because it needs a new
 * table and no production schema change is made in this phase.
 */

export interface MobileAuthConfig {
  secret: Uint8Array;
  issuer: string;
  audience: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  /** A refresh family dies after this long however often it is used, so a stolen device cannot stay signed in forever. */
  refreshFamilyMaxSeconds: number;
}

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 3600;
export const REFRESH_FAMILY_MAX_SECONDS = 90 * 24 * 3600;
const MIN_SECRET_LENGTH = 32;

/** Reads MOBILE_JWT_SECRET. It must be its own secret, never the web's NEXTAUTH_SECRET. */
export function mobileAuthConfig(env: Record<string, string | undefined> = process.env): MobileAuthConfig {
  const secret = env.MOBILE_JWT_SECRET ?? "";
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new ApiError("UNAVAILABLE", "Mobile sign-in is not configured.", { retryable: false });
  }
  if (env.NEXTAUTH_SECRET && secret === env.NEXTAUTH_SECRET) {
    throw new ApiError("UNAVAILABLE", "Mobile sign-in is not configured.", { retryable: false });
  }
  return {
    secret: new TextEncoder().encode(secret),
    issuer: "elitebcn",
    audience: "elitebcn-mobile",
    accessTtlSeconds: ACCESS_TTL_SECONDS,
    refreshTtlSeconds: REFRESH_TTL_SECONDS,
    refreshFamilyMaxSeconds: REFRESH_FAMILY_MAX_SECONDS,
  };
}

const ROLES: readonly ApiRole[] = ["CUSTOMER", "DRIVER", "ADMIN", "PARTNER", "DISPATCHER", "SUPER_ADMIN"];

export async function signAccessToken(ctx: AuthContext, cfg: MobileAuthConfig, nowMs = Date.now()): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  return new SignJWT({ role: ctx.role, sid: ctx.sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(ctx.userId)
    .setIssuer(cfg.issuer)
    .setAudience(cfg.audience)
    .setIssuedAt(iat)
    .setExpirationTime(iat + cfg.accessTtlSeconds)
    .setJti(randomUUID())
    .sign(cfg.secret);
}

export async function verifyAccessToken(token: string, cfg: MobileAuthConfig, nowMs = Date.now()): Promise<AuthContext> {
  try {
    const { payload } = await jwtVerify(token, cfg.secret, {
      issuer: cfg.issuer,
      audience: cfg.audience,
      algorithms: ["HS256"],
      currentDate: new Date(nowMs),
    });
    const role = payload.role as ApiRole | undefined;
    const sessionId = payload.sid as string | undefined;
    if (!payload.sub || !sessionId || !role || !ROLES.includes(role)) throw new ApiError("TOKEN_INVALID", "Sign in again.");
    return { userId: payload.sub, role, sessionId };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof joseErrors.JWTExpired) throw new ApiError("TOKEN_EXPIRED", "Your session needs refreshing.");
    throw new ApiError("TOKEN_INVALID", "Sign in again.");
  }
}

/* ───────────────────────────── refresh tokens ───────────────────────────── */

export interface RefreshRecord {
  id: string;
  userId: string;
  role: ApiRole;
  sessionId: string;
  /** All tokens from one sign-in. Revoked together on reuse. */
  familyId: string;
  /** SHA-256 of the token. The token itself is never stored. */
  tokenHash: string;
  expiresAt: number;
  familyStartedAt: number;
  usedAt: number | null;
  revokedAt: number | null;
}

/** Storage the rotation logic needs. Implemented over Prisma in the sign-in phase and in memory for tests. */
export interface RefreshTokenStore {
  findByHash(hash: string): Promise<RefreshRecord | null>;
  insert(record: RefreshRecord): Promise<void>;
  /**
   * Marks a record used if, and only if, it was not used already. Returns false when
   * another request got there first. This must be one atomic write (a conditional
   * UPDATE), not a read followed by a write, or two parallel refreshes could both win.
   */
  markUsed(id: string, at: number): Promise<boolean>;
  revokeFamily(familyId: string, at: number): Promise<void>;
}

export const hashRefreshToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newRefreshToken = () => randomBytes(32).toString("base64url");

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires, for the app's own timer. */
  expiresIn: number;
}

/** Called once, right after the password (or other credential) has been checked. Starts a new family. */
export async function issueSession(
  store: RefreshTokenStore,
  who: { userId: string; role: ApiRole },
  cfg: MobileAuthConfig,
  nowMs = Date.now(),
): Promise<IssuedTokens> {
  const sessionId = randomUUID();
  return mint(store, { ...who, sessionId, familyId: randomUUID(), familyStartedAt: nowMs }, cfg, nowMs);
}

/**
 * Exchanges a refresh token for a new pair. The old token is spent.
 * Errors: TOKEN_INVALID (unknown, expired, revoked), REFRESH_REUSED (spent token replayed).
 */
export async function rotateRefreshToken(store: RefreshTokenStore, presented: string, cfg: MobileAuthConfig, nowMs = Date.now()): Promise<IssuedTokens> {
  const record = await store.findByHash(hashRefreshToken(presented));
  if (!record || record.revokedAt) throw new ApiError("TOKEN_INVALID", "Sign in again.");

  if (record.usedAt) {
    await store.revokeFamily(record.familyId, nowMs);
    throw new ApiError("REFRESH_REUSED", "Your session ended for your security. Sign in again.");
  }
  if (record.expiresAt <= nowMs || record.familyStartedAt + cfg.refreshFamilyMaxSeconds * 1000 <= nowMs) {
    throw new ApiError("TOKEN_INVALID", "Sign in again.");
  }

  // Two refreshes with the same token at the same moment: one wins, the other is a replay.
  const won = await store.markUsed(record.id, nowMs);
  if (!won) {
    await store.revokeFamily(record.familyId, nowMs);
    throw new ApiError("REFRESH_REUSED", "Your session ended for your security. Sign in again.");
  }

  return mint(store, { userId: record.userId, role: record.role, sessionId: record.sessionId, familyId: record.familyId, familyStartedAt: record.familyStartedAt }, cfg, nowMs);
}

/** Signing out: spends the whole family so the refresh token cannot be used again. */
export async function revokeSession(store: RefreshTokenStore, presented: string, nowMs = Date.now()): Promise<void> {
  const record = await store.findByHash(hashRefreshToken(presented));
  if (record) await store.revokeFamily(record.familyId, nowMs);
}

async function mint(
  store: RefreshTokenStore,
  s: { userId: string; role: ApiRole; sessionId: string; familyId: string; familyStartedAt: number },
  cfg: MobileAuthConfig,
  nowMs: number,
): Promise<IssuedTokens> {
  const refreshToken = newRefreshToken();
  await store.insert({
    id: randomUUID(),
    userId: s.userId,
    role: s.role,
    sessionId: s.sessionId,
    familyId: s.familyId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: nowMs + cfg.refreshTtlSeconds * 1000,
    familyStartedAt: s.familyStartedAt,
    usedAt: null,
    revokedAt: null,
  });
  const accessToken = await signAccessToken({ userId: s.userId, role: s.role, sessionId: s.sessionId }, cfg, nowMs);
  return { accessToken, refreshToken, expiresIn: cfg.accessTtlSeconds };
}

/** In-memory store for tests and local experiments. Not for production: it forgets everything on restart. */
export class MemoryRefreshTokenStore implements RefreshTokenStore {
  readonly records = new Map<string, RefreshRecord>();

  async findByHash(hash: string) {
    for (const r of this.records.values()) if (r.tokenHash === hash) return { ...r };
    return null;
  }
  async insert(record: RefreshRecord) {
    this.records.set(record.id, { ...record });
  }
  async markUsed(id: string, at: number) {
    const r = this.records.get(id);
    if (!r || r.usedAt) return false;
    r.usedAt = at;
    return true;
  }
  async revokeFamily(familyId: string, at: number) {
    for (const r of this.records.values()) if (r.familyId === familyId && !r.revokedAt) r.revokedAt = at;
  }
}

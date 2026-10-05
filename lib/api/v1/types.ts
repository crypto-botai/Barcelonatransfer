/**
 * The contract of the mobile API, /api/v1.
 *
 * This file is the source of truth. The mobile repository keeps a copy of these
 * types (packages/types) so the apps and the server agree on every envelope and
 * every error code. Change them here first, additively, and never reuse or
 * rename a code: an installed app cannot be updated on demand.
 */

export const API_VERSION = "v1" as const;

/** Every role the mobile API will eventually know. Only the first four exist in the database today. */
export type ApiRole = "CUSTOMER" | "DRIVER" | "ADMIN" | "PARTNER" | "DISPATCHER" | "SUPER_ADMIN";

export interface ApiMeta {
  /** Echoed in the X-Request-Id header and in every log line for this call. Quote it when reporting a problem. */
  requestId: string;
  apiVersion: typeof API_VERSION;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  ok: false;
  error: ApiErrorBody;
  meta: ApiMeta;
}

export interface ApiErrorBody {
  code: ApiErrorCode;
  /** Safe to show a person. Never contains a secret, a query or a stack trace. */
  message: string;
  /** Field-level problems for VALIDATION_FAILED. Paths only, never the rejected values. */
  details?: ApiFieldProblem[];
  /** True when sending the same request again may succeed (a timeout, a rate limit, an upstream blip). */
  retryable: boolean;
  /** Seconds to wait, for RATE_LIMITED and UNAVAILABLE. Also sent as Retry-After. */
  retryAfterSeconds?: number;
}

export interface ApiFieldProblem {
  path: string;
  message: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Error code, HTTP status, and whether a retry can help. Append only. */
export const API_ERRORS = {
  VALIDATION_FAILED: { status: 422, retryable: false },
  UNAUTHENTICATED: { status: 401, retryable: false },
  /** The access token has expired: refresh it and repeat the call once. */
  TOKEN_EXPIRED: { status: 401, retryable: false },
  TOKEN_INVALID: { status: 401, retryable: false },
  /** A refresh token was used twice. Its whole family is revoked and the person must sign in again. */
  REFRESH_REUSED: { status: 401, retryable: false },
  FORBIDDEN: { status: 403, retryable: false },
  NOT_FOUND: { status: 404, retryable: false },
  METHOD_NOT_ALLOWED: { status: 405, retryable: false },
  CONFLICT: { status: 409, retryable: false },
  /** This app version is no longer supported. The app shows an update screen. */
  UPGRADE_REQUIRED: { status: 426, retryable: false },
  RATE_LIMITED: { status: 429, retryable: true },
  INTERNAL: { status: 500, retryable: false },
  NOT_IMPLEMENTED: { status: 501, retryable: false },
  UPSTREAM_FAILED: { status: 502, retryable: true },
  UNAVAILABLE: { status: 503, retryable: true },
} as const;

export type ApiErrorCode = keyof typeof API_ERRORS;

/** What a verified bearer token says about the caller. */
export interface AuthContext {
  userId: string;
  role: ApiRole;
  /** One sign-in on one device. Revoking it signs that device out. */
  sessionId: string;
}

export type MobilePlatform = "ios" | "android";

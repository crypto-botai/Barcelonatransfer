import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, rateLimited } from "./errors";
import { authenticate, type AuthOptions } from "./auth";
import { logApi } from "./logger";
import { clientAddress, getRateLimiter, RATE_LIMITS } from "./rate-limit";
import { API_ERRORS, API_VERSION, type ApiErrorBody, type ApiFailure, type ApiMeta, type ApiSuccess, type AuthContext } from "./types";

/**
 * The one way a /api/v1 route is written, so every route answers the same way.
 *
 *   export const GET = apiHandler("health", async ({ requestId }) => ({ status: "ok" }), { auth: false });
 *
 * It generates a request id, applies the rate limit, authenticates when asked,
 * turns thrown ApiErrors and validation failures into the standard error
 * envelope, hides unexpected errors behind a plain INTERNAL response, logs one
 * line, and marks the response uncacheable and noindex.
 *
 * SUCCESS  { ok: true,  data, meta: { requestId, apiVersion } }
 * FAILURE  { ok: false, error: { code, message, details?, retryable, retryAfterSeconds? }, meta }
 */

export interface HandlerContext {
  req: Request;
  requestId: string;
  /** Null on routes declared with auth: false. */
  auth: AuthContext | null;
  /** Next's route params, when the route has any. Await it. */
  params: Promise<Record<string, string>> | undefined;
}

export interface HandlerOptions {
  /** false for public routes. Otherwise bearer authentication, optionally limited to roles. Default: required. */
  auth?: false | AuthOptions;
  /** Which limit applies. Default: publicRead for public routes, authenticated otherwise. */
  rateLimit?: keyof typeof RATE_LIMITS;
  /** HTTP status of a successful response. Default 200. */
  status?: number;
}

const BASE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Api-Version": API_VERSION,
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};

const meta = (requestId: string): ApiMeta => ({ requestId, apiVersion: API_VERSION });

export function successResponse<T>(data: T, requestId: string, status = 200, extra: Record<string, string> = {}): NextResponse {
  const body: ApiSuccess<T> = { ok: true, data, meta: meta(requestId) };
  return NextResponse.json(body, { status, headers: { ...BASE_HEADERS, "X-Request-Id": requestId, ...extra } });
}

export function failureResponse(error: ApiError, requestId: string, extra: Record<string, string> = {}): NextResponse {
  const errorBody: ApiErrorBody = {
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    ...(error.details ? { details: error.details } : {}),
    ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
  };
  const body: ApiFailure = { ok: false, error: errorBody, meta: meta(requestId) };
  const headers: Record<string, string> = { ...BASE_HEADERS, "X-Request-Id": requestId, ...extra };
  if (error.retryAfterSeconds) headers["Retry-After"] = String(error.retryAfterSeconds);
  return NextResponse.json(body, { status: error.status, headers });
}

/** Anything thrown becomes an ApiError. Unexpected errors are not described to the caller. */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof ZodError) {
    return new ApiError("VALIDATION_FAILED", "Some details are missing or not valid.", {
      details: e.issues.slice(0, 20).map((i) => ({ path: i.path.join(".") || "(body)", message: i.message })),
    });
  }
  return new ApiError("INTERNAL", "Something went wrong. Try again.", { retryable: false });
}

export function apiHandler<T>(route: string, handler: (ctx: HandlerContext) => Promise<T>, options: HandlerOptions = {}) {
  return async (req: Request, routeCtx?: { params?: Promise<Record<string, string>> }): Promise<NextResponse> => {
    const started = Date.now();
    const requestId = crypto.randomUUID();
    let auth: AuthContext | null = null;
    let status = options.status ?? 200;
    let errorCode: string | undefined;
    let response: NextResponse;

    try {
      const limitName = options.rateLimit ?? (options.auth === false ? "publicRead" : "authenticated");
      const limit = RATE_LIMITS[limitName];

      if (options.auth !== false) auth = await authenticate(req, options.auth);

      const who = auth ? `u:${auth.userId}` : `ip:${clientAddress(req)}`;
      const verdict = await getRateLimiter().hit(`${route}:${limitName}:${who}`, limit.limit, limit.windowSeconds);
      if (!verdict.allowed) throw rateLimited(verdict.retryAfterSeconds);

      const data = await handler({ req, requestId, auth, params: routeCtx?.params });
      response = successResponse(data, requestId, status, { "X-RateLimit-Remaining": String(verdict.remaining) });
    } catch (e) {
      const error = toApiError(e);
      status = error.status;
      errorCode = error.code;
      response = failureResponse(error, requestId);
      if (error.code === "INTERNAL") {
        logApi({ requestId, method: req.method, route, status, durationMs: Date.now() - started, errorCode, extra: { message: e instanceof Error ? e.message : "unknown" } });
        return response;
      }
    }

    logApi({ requestId, method: req.method, route, status, durationMs: Date.now() - started, userId: auth?.userId, role: auth?.role, errorCode });
    return response;
  };
}

/** For a method a route does not support. */
export const methodNotAllowed = (route: string) =>
  apiHandler(route, async () => {
    throw new ApiError("METHOD_NOT_ALLOWED", "This method is not supported.");
  }, { auth: false });

export { API_ERRORS };

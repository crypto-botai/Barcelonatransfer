import { NextRequest } from "next/server";
import { ApiError } from "./errors";
import { runAsActor, type ActorUser } from "@/lib/request-session";

/**
 * Calls one of the website's own route handlers from a /api/v1 route.
 *
 * The website already holds the rules for pricing, booking, cancellation,
 * refunds and ride stages. A /api/v1 route checks who is calling, runs that
 * handler as that person, and turns its answer into the v1 envelope, so the
 * apps and the website can never disagree on a price or a policy.
 */

export interface LegacyCall<P = Record<string, string>> {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** Path only, for the handler's own use (it may read the query string). */
  path: string;
  body?: unknown;
  params?: P;
  /** Run as this verified person. Omit for a public handler. */
  actor?: ActorUser;
  /** The caller's address, passed on so the handler's own limits and logs see it. */
  ip?: string;
}

type Handler<P> = (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response>;

const ORIGIN = "http://internal.elitebcn.invalid";

export async function callLegacy<P = Record<string, string>>(handler: Handler<P>, call: LegacyCall<P>): Promise<{ status: number; json: Record<string, unknown> }> {
  const headers = new Headers({ "content-type": "application/json" });
  if (call.ip) headers.set("x-forwarded-for", call.ip);
  const req = new NextRequest(`${ORIGIN}${call.path}`, {
    method: call.method,
    headers,
    body: call.body === undefined ? undefined : JSON.stringify(call.body),
  });
  const ctx = { params: Promise.resolve((call.params ?? {}) as P) };

  const run = () => handler(req, ctx);
  const res = call.actor ? await runAsActor(call.actor, run) : await run();

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status >= 400) throw legacyError(res.status, json);
  return { status: res.status, json };
}

/** The website's { error } answers, as v1 errors. The website's messages are already written for customers. */
export function legacyError(status: number, json: Record<string, unknown>): ApiError {
  const message = typeof json.error === "string" && json.error ? json.error : "That did not work. Try again.";
  const extra = { policy: json.policy, whatsappUrl: json.whatsappUrl, freeHours: json.freeHours };
  const withExtra = Object.values(extra).some((v) => v !== undefined);
  const details = withExtra ? [{ path: "policy", message: JSON.stringify(extra) }] : undefined;
  if (status === 401) return new ApiError("UNAUTHENTICATED", message);
  if (status === 403) return new ApiError("FORBIDDEN", message);
  if (status === 404) return new ApiError("NOT_FOUND", message);
  if (status === 409) return new ApiError("CONFLICT", message);
  if (status === 429) return new ApiError("RATE_LIMITED", message, { retryable: true });
  if (status === 400 || status === 422) return new ApiError("VALIDATION_FAILED", message, details ? { details } : undefined);
  return new ApiError(status >= 500 ? "UPSTREAM_FAILED" : "INTERNAL", "Something went wrong. Try again.");
}

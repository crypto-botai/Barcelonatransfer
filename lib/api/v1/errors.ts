import { API_ERRORS, type ApiErrorCode, type ApiFieldProblem } from "./types";

/** Thrown anywhere inside a /api/v1 handler; apiHandler turns it into the standard error response. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly details?: ApiFieldProblem[];
  readonly retryAfterSeconds?: number;

  constructor(code: ApiErrorCode, message: string, opts: { details?: ApiFieldProblem[]; retryAfterSeconds?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = API_ERRORS[code].status;
    this.retryable = opts.retryable ?? API_ERRORS[code].retryable;
    this.details = opts.details;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
}

export const unauthenticated = (message = "Sign in to continue.") => new ApiError("UNAUTHENTICATED", message);
export const forbidden = (message = "You do not have access to this.") => new ApiError("FORBIDDEN", message);
export const notFound = (message = "Not found.") => new ApiError("NOT_FOUND", message);
export const notImplemented = (message = "Not available yet.") => new ApiError("NOT_IMPLEMENTED", message);
export const rateLimited = (retryAfterSeconds: number) =>
  new ApiError("RATE_LIMITED", "Too many requests. Try again shortly.", { retryAfterSeconds });

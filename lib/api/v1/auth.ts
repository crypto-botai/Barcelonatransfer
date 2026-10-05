import { ApiError, forbidden, unauthenticated } from "./errors";
import { mobileAuthConfig, verifyAccessToken, type MobileAuthConfig } from "./tokens";
import type { ApiRole, AuthContext } from "./types";

/**
 * Who is calling a /api/v1 route.
 *
 * Mobile callers send "Authorization: Bearer <access token>". The web's cookie
 * session is not accepted here on purpose: a browser attaches cookies by itself,
 * which is what makes cross-site request forgery possible, and a bearer header
 * is never sent by a browser on its own.
 *
 * A token proves who the caller was when it was issued, up to 15 minutes ago.
 * Routes that move money, change a role or expose personal data must also check
 * the user and session in the database (pass `recheck`).
 */

export interface AuthOptions {
  /** Roles allowed to call this route. Omit to allow any signed-in role. */
  roles?: readonly ApiRole[];
  /** Extra check against the database, for sensitive routes. Throw an ApiError to refuse. */
  recheck?: (ctx: AuthContext) => Promise<void>;
  /** For tests. */
  config?: MobileAuthConfig;
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && value ? value : null;
}

export async function authenticate(req: Request, opts: AuthOptions = {}): Promise<AuthContext> {
  const token = bearerToken(req);
  if (!token) throw unauthenticated();

  const ctx = await verifyAccessToken(token, opts.config ?? mobileAuthConfig());

  if (opts.roles && !opts.roles.includes(ctx.role)) throw forbidden();
  if (opts.recheck) await opts.recheck(ctx);
  return ctx;
}

/**
 * Operations roles, in order of reach. ADMIN and SUPER_ADMIN must also pass MFA once
 * it exists; until then these roles are not issued mobile sessions (see docs/SECURITY.md).
 */
export const STAFF_ROLES: readonly ApiRole[] = ["DISPATCHER", "ADMIN", "SUPER_ADMIN"];

export function isStaff(role: ApiRole): boolean {
  return STAFF_ROLES.includes(role);
}

export { ApiError };

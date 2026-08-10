/**
 * Path rules for the forced-password-change gate.
 *
 * Kept out of middleware.ts so it can be tested directly: the rules are pure
 * string matching, and getting one prefix wrong locks every affected account
 * out of the site with no visible error.
 */

/** Paths that must stay reachable while an account still owes a password change. */
const EXEMPT = [
  // The page where the change is made, and the API call that records it.
  // Redirecting a POST turns it into a GET for an HTML page, so the caller sees
  // a JSON parse error instead of a result — the change could never complete.
  "/api",
  "/auth/change-password",
  // Always leave a way out that isn't "choose a new password".
  "/auth/logout",
];

/**
 * Whether a request should be diverted to the change-password page.
 *
 * @param pathname request path, e.g. "/driver"
 * @param mustChange the account's mustChangePassword flag
 */
export function shouldForcePasswordChange(
  pathname: string,
  mustChange: boolean | undefined,
): boolean {
  if (!mustChange) return false;
  return !EXEMPT.some((p) => pathname.startsWith(p));
}

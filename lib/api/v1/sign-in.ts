import { ApiError, rateLimited } from "./errors";
import type { ApiRole } from "./types";

/**
 * The rules for signing in to a mobile app, apart from the HTTP and the database.
 *
 * Kept separate so every rule is tested with plain objects:
 *   - one generic failure for "no such account" and "wrong password", so the
 *     answer never says which emails exist;
 *   - a password check that costs the same when the account does not exist;
 *   - a per-account failure limit that works across server instances, because
 *     the in-memory IP limiter does not;
 *   - the customer app signs in customers only, the driver app drivers only, and
 *     a driver must have been approved by the office;
 *   - the role and the driver's status are re-read from the database on every
 *     refresh, so suspending a driver ends their session within 15 minutes.
 */

export type AppName = "customer" | "driver";

export interface SignInUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  passwordHash: string | null;
  mustChangePassword: boolean;
  /** Present only for a driver account. */
  driverStatus: string | null;
}

export interface SignInDeps {
  findUserByEmail(email: string): Promise<SignInUser | null>;
  /** Failed sign-ins for this account in the last window, from the shared database. */
  recentFailures(emailKey: string, sinceMs: number): Promise<number>;
  recordFailure(emailKey: string, ip: string): Promise<void>;
  comparePassword(plain: string, hash: string): Promise<boolean>;
  /** A bcrypt hash of a throwaway string, compared against when the account does not exist. */
  dummyHash(): Promise<string>;
}

export const FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const FAILURE_LIMIT = 8;

export const GENERIC_FAILURE = "The email or password is not right.";

/** What the apps may do with a role. Staff roles are not issued mobile sessions until they have multi-factor sign-in. */
export const APP_ROLE: Record<AppName, ApiRole> = { customer: "CUSTOMER", driver: "DRIVER" };

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function failureKey(email: string): string {
  return normaliseEmail(email).slice(0, 120);
}

export interface SignedIn {
  user: SignInUser;
  role: ApiRole;
}

export async function checkCredentials(
  deps: SignInDeps,
  input: { email: string; password: string; app: AppName; ip: string },
  nowMs = Date.now(),
): Promise<SignedIn> {
  const email = normaliseEmail(input.email);
  const key = failureKey(email);

  const failures = await deps.recentFailures(key, nowMs - FAILURE_WINDOW_MS);
  if (failures >= FAILURE_LIMIT) throw rateLimited(Math.ceil(FAILURE_WINDOW_MS / 1000 / 3));

  const user = await deps.findUserByEmail(email);
  const hash = user?.passwordHash ?? (await deps.dummyHash());
  const matches = await deps.comparePassword(input.password, hash);

  if (!user || !user.passwordHash || !matches) {
    await deps.recordFailure(key, input.ip);
    throw new ApiError("UNAUTHENTICATED", GENERIC_FAILURE);
  }

  // The password is right, so it is safe to say what is wrong with the account.
  return { user, role: assertMayUseApp(user, input.app) };
}

/** Whether this account may hold a session in this app, right now. Used at sign-in and at every refresh. */
export function assertMayUseApp(user: Pick<SignInUser, "role" | "driverStatus">, app: AppName): ApiRole {
  const wanted = APP_ROLE[app];
  if (user.role !== wanted) {
    throw new ApiError(
      "FORBIDDEN",
      app === "customer" ? "This is not a customer account. Drivers use the EliteBCN Driver app." : "This is not a driver account. Customers use the EliteBCN app.",
    );
  }
  if (app === "driver") {
    if (user.driverStatus === null) throw new ApiError("FORBIDDEN", "This driver account is not set up yet. Contact the office.");
    if (user.driverStatus === "PENDING_APPROVAL") throw new ApiError("FORBIDDEN", "Your driver account is waiting for approval from the office.");
    if (user.driverStatus === "SUSPENDED") throw new ApiError("FORBIDDEN", "Your driver account is suspended. Contact the office.");
  }
  return wanted;
}

/** The app a role belongs to, or null for a role that gets no mobile session. */
export function appForRole(role: string): AppName | null {
  if (role === "CUSTOMER") return "customer";
  if (role === "DRIVER") return "driver";
  return null;
}

import { apiHandler } from "@/lib/api/v1/response";
import { ApiError } from "@/lib/api/v1/errors";
import { appForRole, assertMayUseApp } from "@/lib/api/v1/sign-in";
import { loadSignInUser } from "@/lib/api/v1/sign-in-db";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me
 *
 * Who the token belongs to, read fresh from the database. The app calls it at
 * launch to learn the person's name and whether they must change their password.
 * It also re-applies the sign-in rules, so a driver suspended since the token was
 * issued gets FORBIDDEN here at once.
 */
export const GET = apiHandler("me", async ({ auth }) => {
  const user = await loadSignInUser({ id: auth!.userId });
  const app = user ? appForRole(user.role) : null;
  if (!user || !app) throw new ApiError("TOKEN_INVALID", "Sign in again.");
  assertMayUseApp(user, app);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    ...(user.driverStatus ? { driverStatus: user.driverStatus } : {}),
  };
});

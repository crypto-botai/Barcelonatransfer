import { z } from "zod";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { ApiError } from "@/lib/api/v1/errors";
import { audit } from "@/lib/api/v1/audit";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { mobileAuthConfig, revokeSession, rotateRefreshToken, verifyAccessToken } from "@/lib/api/v1/tokens";
import { PrismaRefreshTokenStore } from "@/lib/api/v1/refresh-store";
import { appForRole, assertMayUseApp } from "@/lib/api/v1/sign-in";
import { loadSignInUser } from "@/lib/api/v1/sign-in-db";

export const dynamic = "force-dynamic";

const body = z.object({ refreshToken: z.string().min(20).max(200) });

/**
 * POST /api/v1/auth/refresh
 *
 * Spends the refresh token and returns a new pair. After the swap the account is
 * read again: a deleted user, a changed role or a suspended driver loses the
 * session here, so the longest a suspended driver keeps access is the 15 minutes
 * of an access token already issued.
 */
export const POST = apiHandler(
  "auth.refresh",
  async ({ req, requestId }) => {
    const { refreshToken } = await parseBody(req, body);
    const store = new PrismaRefreshTokenStore();
    const cfg = mobileAuthConfig();

    const tokens = await rotateRefreshToken(store, refreshToken, cfg);
    const who = await verifyAccessToken(tokens.accessToken, cfg);

    const user = await loadSignInUser({ id: who.userId });
    const app = user ? appForRole(user.role) : null;
    try {
      if (!user || !app || user.role !== who.role) throw new ApiError("TOKEN_INVALID", "Sign in again.");
      assertMayUseApp(user, app);
    } catch {
      await revokeSession(store, tokens.refreshToken);
      await audit({ action: "API_V1_REFRESH_REFUSED", entity: "user", entityId: who.userId, requestId, ip: clientAddress(req) });
      throw new ApiError("TOKEN_INVALID", "Sign in again.");
    }

    return tokens;
  },
  { auth: false, rateLimit: "refresh" },
);

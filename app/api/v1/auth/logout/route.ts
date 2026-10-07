import { z } from "zod";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { audit } from "@/lib/api/v1/audit";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { hashRefreshToken, revokeSession } from "@/lib/api/v1/tokens";
import { PrismaRefreshTokenStore } from "@/lib/api/v1/refresh-store";

export const dynamic = "force-dynamic";

const body = z.object({ refreshToken: z.string().min(20).max(200) });

/**
 * POST /api/v1/auth/logout
 *
 * Spends the whole token family so this phone's session cannot be revived. It
 * answers the same whether or not the token was known, so it cannot be used to
 * probe for valid tokens.
 */
export const POST = apiHandler(
  "auth.logout",
  async ({ req, requestId }) => {
    const { refreshToken } = await parseBody(req, body);
    const store = new PrismaRefreshTokenStore();
    const record = await store.findByHash(hashRefreshToken(refreshToken));
    await revokeSession(store, refreshToken);
    if (record) await audit({ action: "API_V1_SIGN_OUT", entity: "user", entityId: record.userId, actorId: record.userId, requestId, ip: clientAddress(req) });
    return {};
  },
  { auth: false, rateLimit: "refresh" },
);

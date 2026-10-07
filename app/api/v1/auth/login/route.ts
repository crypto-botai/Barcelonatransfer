import { z } from "zod";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { audit } from "@/lib/api/v1/audit";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { issueSession, mobileAuthConfig } from "@/lib/api/v1/tokens";
import { PrismaRefreshTokenStore } from "@/lib/api/v1/refresh-store";
import { checkCredentials } from "@/lib/api/v1/sign-in";
import { prismaSignInDeps } from "@/lib/api/v1/sign-in-db";

export const dynamic = "force-dynamic";

const body = z.object({
  email: z.string().trim().min(3).max(254).email(),
  password: z.string().min(1).max(200),
  app: z.enum(["customer", "driver"]),
});

/**
 * POST /api/v1/auth/login
 *
 * The customer app signs customers in, the driver app signs approved drivers in.
 * Success: { accessToken (15 min), refreshToken (single use), expiresIn, user, mustChangePassword }.
 * A wrong email and a wrong password get the same answer.
 */
export const POST = apiHandler(
  "auth.login",
  async ({ req, requestId }) => {
    const input = await parseBody(req, body);
    const ip = clientAddress(req);

    const { user, role } = await checkCredentials(prismaSignInDeps, { email: input.email, password: input.password, app: input.app, ip });
    const tokens = await issueSession(new PrismaRefreshTokenStore(), { userId: user.id, role }, mobileAuthConfig());

    await audit({ action: "API_V1_SIGN_IN", entity: "user", entityId: user.id, actorId: user.id, actorRole: role, requestId, ip, details: { app: input.app } });

    return {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role },
      mustChangePassword: user.mustChangePassword,
    };
  },
  { auth: false, rateLimit: "credentials" },
);

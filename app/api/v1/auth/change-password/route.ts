import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { actorFor } from "@/lib/api/v1/actor";
import { callLegacy } from "@/lib/api/v1/legacy";
import { audit } from "@/lib/api/v1/audit";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { issueSession, mobileAuthConfig } from "@/lib/api/v1/tokens";
import { PrismaRefreshTokenStore } from "@/lib/api/v1/refresh-store";
import { POST as websiteChange } from "@/app/api/auth/change-password/route";

export const dynamic = "force-dynamic";

const body = z.object({
  /** Not needed when the office set a temporary password (mustChangePassword). */
  currentPassword: z.string().max(200).optional(),
  newPassword: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(72, "Use at most 72 characters.")
    .refine((p) => !/^(.)\1+$/.test(p), "Choose a password that is not one repeated character."),
});

/**
 * POST /api/v1/auth/change-password
 *
 * The website's change-password rule (the current password is checked unless a
 * temporary one is being replaced). Every other signed-in phone is then signed
 * out, and this phone gets a fresh session, so a changed password also ends a
 * stolen session.
 */
export const POST = apiHandler(
  "auth.changePassword",
  async ({ req, auth, requestId }) => {
    const input = await parseBody(req, body);
    const actor = await actorFor(auth!);
    await callLegacy(websiteChange, { method: "POST", path: "/api/auth/change-password", body: input, actor, ip: clientAddress(req) });

    await prisma.mobileRefreshToken.updateMany({ where: { userId: actor.id, revokedAt: null }, data: { revokedAt: new Date() } });
    const tokens = await issueSession(new PrismaRefreshTokenStore(), { userId: actor.id, role: auth!.role }, mobileAuthConfig());
    await audit({ action: "API_V1_PASSWORD_CHANGED", entity: "user", entityId: actor.id, actorId: actor.id, actorRole: auth!.role, requestId, ip: clientAddress(req) });
    return tokens;
  },
  { auth: { roles: ["CUSTOMER", "DRIVER"] }, rateLimit: "credentials" },
);

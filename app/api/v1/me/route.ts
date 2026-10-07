import { z } from "zod";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { actorFor } from "@/lib/api/v1/actor";
import { callLegacy } from "@/lib/api/v1/legacy";
import { audit } from "@/lib/api/v1/audit";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { DELETE as websiteAccountDelete } from "@/app/api/account/route";
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

const deleteBody = z.object({ password: z.string().min(1).max(200) });

/**
 * DELETE /api/v1/me
 *
 * Deletes the signed-in account (required by both app stores). The password is
 * asked for again, so a phone left unlocked cannot erase an account. The
 * website's own deletion runs: login, profile, notifications and push
 * registrations go; bookings stay as the business's record of journeys and
 * payments, with no account attached. Every session of the account ends with it.
 */
export const DELETE = apiHandler(
  "me.delete",
  async ({ req, auth, requestId }) => {
    const { password } = await parseBody(req, deleteBody);
    const user = await loadSignInUser({ id: auth!.userId });
    if (!user || !user.passwordHash) throw new ApiError("TOKEN_INVALID", "Sign in again.");
    if (!(await bcrypt.compare(password, user.passwordHash))) throw new ApiError("FORBIDDEN", "That password is not right.");
    const actor = await actorFor(auth!);
    // Audited first: the account row is gone after this.
    await audit({ action: "API_V1_ACCOUNT_DELETED", entity: "user", entityId: user.id, actorId: user.id, actorRole: auth!.role, requestId, ip: clientAddress(req) });
    await callLegacy(websiteAccountDelete, { method: "DELETE", path: "/api/account", actor, ip: clientAddress(req) });
    return { deleted: true };
  },
  { auth: { roles: ["CUSTOMER", "DRIVER"] }, rateLimit: "credentials" },
);

const profileBody = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().regex(/^[+]?[0-9 ()-]{6,20}$/, "Enter a phone number with its country code.").nullable().optional(),
});

/** PATCH /api/v1/me — change your own name and phone. Nothing else about an account can be changed here. */
export const PATCH = apiHandler(
  "me.update",
  async ({ req, auth }) => {
    const input = await parseBody(req, profileBody);
    const user = await prisma.user.update({
      where: { id: auth!.userId },
      data: { ...(input.name ? { name: input.name } : {}), ...(input.phone !== undefined ? { phone: input.phone } : {}) },
      select: { id: true, name: true, email: true, phone: true },
    });
    return user;
  },
  { auth: { roles: ["CUSTOMER", "DRIVER"] } },
);

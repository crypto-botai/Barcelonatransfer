import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { ApiError } from "@/lib/api/v1/errors";
import { audit } from "@/lib/api/v1/audit";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { issueSession, mobileAuthConfig } from "@/lib/api/v1/tokens";
import { PrismaRefreshTokenStore } from "@/lib/api/v1/refresh-store";
import { assertMayUseApp } from "@/lib/api/v1/sign-in";
import { loadSignInUser } from "@/lib/api/v1/sign-in-db";
import { verifyGoogleIdToken } from "@/lib/api/v1/google-token";
import { linkGuestBookings } from "@/lib/claim-bookings";

export const dynamic = "force-dynamic";

const body = z.object({
  idToken: z.string().min(100).max(4096),
  app: z.enum(["customer", "driver"]),
});

/**
 * POST /api/v1/auth/google
 *
 * "Continue with Google" in the apps. The phone sends the Google ID token; Google confirms it (see google-token.ts) and the verified
 * email decides the account:
 *   - an account with that email exists: it is signed in, under the same rules as a password sign-in (the customer app takes
 *     customers, the driver app takes approved drivers);
 *   - none exists, in the customer app: a customer account is created (the email is verified by Google);
 *   - none exists, in the driver app: refused. Drivers are set up by the office; Google never creates one.
 * The answer is the same shape as /auth/login.
 */
export const POST = apiHandler(
  "auth.google",
  async ({ req, requestId }) => {
    const input = await parseBody(req, body);
    const ip = clientAddress(req);
    const google = await verifyGoogleIdToken(input.idToken);

    let user = await loadSignInUser({ emailInsensitive: google.email });
    let created = false;
    if (!user) {
      if (input.app === "driver") {
        throw new ApiError("FORBIDDEN", "There is no driver account for this Google email. Ask the office to set up your driver account with this address.");
      }
      try {
        // The account has a password nobody knows, so it can only be entered with Google until the person chooses one (Forgot password).
        const row = await prisma.user.create({
          data: { name: google.name ?? google.email.split("@")[0]!, email: google.email, passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10), role: "CUSTOMER", ...(google.picture ? { image: google.picture } : {}) },
          select: { id: true },
        });
        created = true;
        user = await loadSignInUser({ id: row.id });
      } catch (e) {
        // Two taps at once: the other request made the account first.
        if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") user = await loadSignInUser({ emailInsensitive: google.email });
        else throw e;
      }
    }
    if (!user) throw new ApiError("INTERNAL", "Sign-in could not be completed.");

    const role = assertMayUseApp(user, input.app);
    // Google has verified this email, so bookings made as a guest with it belong to this person: link them now.
    const claimed = role === "CUSTOMER" ? await linkGuestBookings(user.id, user.email).catch(() => 0) : 0;
    const tokens = await issueSession(new PrismaRefreshTokenStore(), { userId: user.id, role }, mobileAuthConfig());
    await audit({ action: created ? "API_V1_GOOGLE_REGISTER" : "API_V1_GOOGLE_SIGN_IN", entity: "user", entityId: user.id, actorId: user.id, actorRole: role, requestId, ip, details: { app: input.app, claimedBookings: claimed } });

    return {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role },
      mustChangePassword: false,
    };
  },
  { auth: false, rateLimit: "credentials" },
);

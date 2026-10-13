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
import { verifyAppleIdentityToken } from "@/lib/api/v1/apple-token";
import { linkGuestBookings } from "@/lib/claim-bookings";

export const dynamic = "force-dynamic";

const name = z.string().trim().max(60).optional();
const body = z.object({
  identityToken: z.string().min(100).max(4096),
  /** The random value the app kept; Apple was given its SHA-256. */
  nonce: z.string().min(16).max(128),
  app: z.enum(["customer", "driver"]),
  /** Apple only gives the name the first time, and only to the app. */
  fullName: z.object({ givenName: name, familyName: name }).optional(),
});

const PROVIDER = "apple";

/**
 * POST /api/v1/auth/apple
 *
 * "Continue with Apple" in the apps (iPhone). The phone sends Apple's identity token; Apple's signature, our audience, the expiry,
 * the verified email and the nonce are all checked (see apple-token.ts). Then:
 *   - this Apple id was linked before: that account is signed in;
 *   - else an account with the verified email exists: the Apple id is linked to it and it is signed in;
 *   - else, in the customer app: a customer account is created;
 *   - else, in the driver app: refused. Drivers are set up by the office; Apple never creates one. (A driver who hides their email
 *     from Apple cannot be matched; they sign in with their password or Google, or the office adds the relay address.)
 * The same rules as a password sign-in then apply. The answer has the same shape as /auth/login.
 */
export const POST = apiHandler(
  "auth.apple",
  async ({ req, requestId }) => {
    const input = await parseBody(req, body);
    const ip = clientAddress(req);
    const apple = await verifyAppleIdentityToken(input.identityToken, input.nonce);

    const linked = await prisma.account.findUnique({ where: { provider_providerAccountId: { provider: PROVIDER, providerAccountId: apple.subject } }, select: { userId: true } });
    let user = linked ? await loadSignInUser({ id: linked.userId }) : await loadSignInUser({ emailInsensitive: apple.email });
    let created = false;

    if (!user) {
      if (input.app === "driver") {
        throw new ApiError("FORBIDDEN", "There is no driver account for this Apple ID. Ask the office to set up your driver account with the email you use, or sign in with your password.");
      }
      const given = [input.fullName?.givenName, input.fullName?.familyName].filter(Boolean).join(" ").trim();
      try {
        // A password nobody knows, so the account can only be entered with Apple until the person chooses one (Forgot password).
        const row = await prisma.user.create({
          data: { name: given || apple.email.split("@")[0]!, email: apple.email, passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10), role: "CUSTOMER", emailVerified: new Date() },
          select: { id: true },
        });
        created = true;
        user = await loadSignInUser({ id: row.id });
      } catch (e) {
        // Two taps at once: the other request made the account first.
        if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") user = await loadSignInUser({ emailInsensitive: apple.email });
        else throw e;
      }
    }
    if (!user) throw new ApiError("INTERNAL", "Sign-in could not be completed.");

    const role = assertMayUseApp(user, input.app);

    if (!linked) {
      // Remember this Apple id for this account, so the next sign-in works even when the email Apple shares changes.
      await prisma.account
        .create({ data: { userId: user.id, type: "oauth", provider: PROVIDER, providerAccountId: apple.subject } })
        .catch((e: unknown) => {
          if (!(typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002")) throw e;
        });
    }

    // Apple has verified this email, so bookings made as a guest with it belong to this person: link them now.
    const claimed = role === "CUSTOMER" ? await linkGuestBookings(user.id, user.email).catch(() => 0) : 0;
    const tokens = await issueSession(new PrismaRefreshTokenStore(), { userId: user.id, role }, mobileAuthConfig());
    await audit({
      action: created ? "API_V1_APPLE_REGISTER" : "API_V1_APPLE_SIGN_IN",
      entity: "user",
      entityId: user.id,
      actorId: user.id,
      actorRole: role,
      requestId,
      ip,
      details: { app: input.app, claimedBookings: claimed, privateRelay: apple.isPrivateRelay },
    });

    return {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role },
      mustChangePassword: false,
    };
  },
  { auth: false, rateLimit: "credentials" },
);

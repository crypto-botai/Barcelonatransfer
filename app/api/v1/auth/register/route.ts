import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { ApiError } from "@/lib/api/v1/errors";
import { audit } from "@/lib/api/v1/audit";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { issueSession, mobileAuthConfig } from "@/lib/api/v1/tokens";
import { PrismaRefreshTokenStore } from "@/lib/api/v1/refresh-store";
import { normaliseEmail } from "@/lib/api/v1/sign-in";

export const dynamic = "force-dynamic";

/** bcrypt reads at most 72 bytes, so a longer password would be silently shortened. */
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.")
  .refine((p) => !/^(.)\1+$/.test(p), "Choose a password that is not one repeated character.");

const body = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().min(3).max(254).email(),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{6,20}$/, "Enter a phone number with its country code.").optional(),
  password,
  acceptTerms: z.literal(true, { message: "Accept the terms and the privacy policy to continue." }),
});

/**
 * POST /api/v1/auth/register
 *
 * Creates a CUSTOMER account and signs it in. Drivers are not created here: a
 * driver applies with documents and the office approves them before any session
 * exists. An address already in use answers CONFLICT.
 */
export const POST = apiHandler(
  "auth.register",
  async ({ req, requestId }) => {
    const input = await parseBody(req, body);
    const email = normaliseEmail(input.email);

    const taken = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
    if (taken) throw new ApiError("CONFLICT", "An account with this email already exists. Sign in instead.");

    let userId: string;
    try {
      const user = await prisma.user.create({
        data: {
          name: `${input.firstName} ${input.lastName}`,
          email,
          phone: input.phone,
          passwordHash: await bcrypt.hash(input.password, 12),
          role: "CUSTOMER",
        },
        select: { id: true, name: true, email: true, phone: true },
      });
      userId = user.id;
      const tokens = await issueSession(new PrismaRefreshTokenStore(), { userId, role: "CUSTOMER" }, mobileAuthConfig());
      await audit({ action: "API_V1_REGISTER", entity: "user", entityId: userId, actorId: userId, actorRole: "CUSTOMER", requestId, ip: clientAddress(req) });
      return { ...tokens, user: { ...user, role: "CUSTOMER" as const }, mustChangePassword: false };
    } catch (e) {
      // Two sign-ups with the same address at the same moment: the database's unique index decides.
      if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") {
        throw new ApiError("CONFLICT", "An account with this email already exists. Sign in instead.");
      }
      throw e;
    }
  },
  { auth: false, rateLimit: "credentials", status: 201 },
);

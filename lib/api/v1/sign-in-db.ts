import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { SignInDeps, SignInUser } from "./sign-in";

/**
 * The database side of mobile sign-in. The rules are in sign-in.ts.
 *
 * Failed attempts are written to activity_logs (an existing table), so the
 * limit is shared by every server instance and survives a restart. The email is
 * stored as the key; no password or password-derived value is ever written.
 */

export const FAILED_SIGN_IN = "API_V1_SIGN_IN_FAILED";

/** What a user row needs to become a SignInUser, including a driver's approval state. */
export async function loadSignInUser(where: { id: string } | { emailInsensitive: string }): Promise<SignInUser | null> {
  const user =
    "id" in where
      ? await prisma.user.findUnique({ where: { id: where.id }, include: { driver: { select: { status: true } } } })
      : await prisma.user.findFirst({
          where: { email: { equals: where.emailInsensitive, mode: "insensitive" } },
          include: { driver: { select: { status: true } } },
        });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    passwordHash: user.passwordHash,
    mustChangePassword: user.mustChangePassword,
    driverStatus: user.driver ? user.driver.status : null,
  };
}

let dummy: Promise<string> | null = null;

export const prismaSignInDeps: SignInDeps = {
  findUserByEmail: (email) => loadSignInUser({ emailInsensitive: email }),

  recentFailures: (emailKey, sinceMs) =>
    prisma.activityLog.count({
      where: { action: FAILED_SIGN_IN, entity: "mobile_sign_in", entityId: emailKey, createdAt: { gte: new Date(sinceMs) } },
    }),

  recordFailure: async (emailKey, ip) => {
    await prisma.activityLog.create({
      data: { action: FAILED_SIGN_IN, entity: "mobile_sign_in", entityId: emailKey, ip },
    });
  },

  comparePassword: (plain, hash) => bcrypt.compare(plain, hash),

  dummyHash: () => (dummy ??= bcrypt.hash("not-a-real-password", 12)),
};

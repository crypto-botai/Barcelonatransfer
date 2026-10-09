import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";

export const dynamic = "force-dynamic";

const body = z.object({
  /** An Expo push token, "ExponentPushToken[...]". It addresses one app on one phone and carries no secret. */
  token: z.string().regex(/^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]{10,80}\]$/, "Not a push token."),
  platform: z.enum(["ios", "android"]),
  appVersion: z.string().max(32).optional(),
});

/**
 * POST /api/v1/devices — register this phone for push notifications.
 *
 * The token moves to the caller if it was registered to someone else (a phone
 * handed on, or a driver and a customer sharing one device), so a person never
 * receives another person's notifications. The app is the caller's role.
 */
export const POST = apiHandler(
  "devices.register",
  async ({ req, auth }) => {
    const input = await parseBody(req, body);
    const app = auth!.role === "DRIVER" ? "driver" : "customer";
    await prisma.mobileDevice.upsert({
      where: { token: input.token },
      create: { userId: auth!.userId, token: input.token, platform: input.platform, app, appVersion: input.appVersion },
      update: { userId: auth!.userId, platform: input.platform, app, appVersion: input.appVersion, lastSeenAt: new Date() },
    });
    return { registered: true };
  },
  { auth: { roles: ["CUSTOMER", "DRIVER"] }, status: 201 },
);

/** DELETE /api/v1/devices — remove this phone, at sign-out. Only the caller's own registration is removed. */
export const DELETE = apiHandler(
  "devices.remove",
  async ({ req, auth }) => {
    const input = await parseBody(req, z.object({ token: z.string().min(10).max(120) }));
    await prisma.mobileDevice.deleteMany({ where: { token: input.token, userId: auth!.userId } });
    return { removed: true };
  },
  { auth: { roles: ["CUSTOMER", "DRIVER"] } },
);

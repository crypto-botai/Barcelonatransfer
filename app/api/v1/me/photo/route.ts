import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { audit } from "@/lib/api/v1/audit";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { parsePhoto, storePhoto } from "@/lib/api/v1/profile-photo";

export const dynamic = "force-dynamic";

const body = z.object({ image: z.string().min(32).max(700_000) });

/**
 * PUT /api/v1/me/photo
 *
 * Sets the signed-in person's profile photo. The app sends a small resized picture as a data address; it is checked (really a
 * JPEG, PNG or WebP, small) and kept in the website's file storage when that is set up. Works for customers and drivers, for
 * their own account only: the person is the token's owner, never anything in the body.
 */
export const PUT = apiHandler(
  "me.photo.set",
  async ({ req, auth, requestId }) => {
    const { image } = await parseBody(req, body, 800_000);
    const photo = parsePhoto(image);
    const url = await storePhoto(auth!.userId, photo);
    await prisma.user.update({ where: { id: auth!.userId }, data: { image: url } });
    await audit({ action: "API_V1_PHOTO_SET", entity: "user", entityId: auth!.userId, actorId: auth!.userId, actorRole: auth!.role, requestId, ip: clientAddress(req) });
    return { image: url };
  },
  { auth: { roles: ["CUSTOMER", "DRIVER"] } },
);

/** DELETE /api/v1/me/photo: takes the profile photo off the account. */
export const DELETE = apiHandler(
  "me.photo.remove",
  async ({ req, auth, requestId }) => {
    await prisma.user.update({ where: { id: auth!.userId }, data: { image: null } });
    await audit({ action: "API_V1_PHOTO_REMOVED", entity: "user", entityId: auth!.userId, actorId: auth!.userId, actorRole: auth!.role, requestId, ip: clientAddress(req) });
    return { image: null };
  },
  { auth: { roles: ["CUSTOMER", "DRIVER"] } },
);

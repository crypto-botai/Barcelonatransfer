import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { ApiError } from "@/lib/api/v1/errors";
import { requireOwnedRide } from "@/lib/api/v1/rides";
import { assertUsableFix, fixExtras } from "@/lib/api/v1/gps-fix";

export const dynamic = "force-dynamic";

const body = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), ...fixExtras });

const SHARE_WHILE = new Set(["DRIVER_ASSIGNED", "IN_PROGRESS"]);

/**
 * POST /api/v1/rides/:id/location
 *
 * The passenger's phone sharing where they are with their chauffeur, only while the chauffeur is assigned or on the way. Only the
 * latest fix is kept on the booking; the driver app already reads it back (customerLocation) and treats it as stale after 3 minutes.
 */
export const POST = apiHandler(
  "rides.location.set",
  async ({ req, auth, params }) => {
    const { id } = await params!;
    const input = await parseBody(req, body);
    assertUsableFix(input);
    const ride = await requireOwnedRide(id, auth!.userId);
    if (!SHARE_WHILE.has(ride.status)) throw new ApiError("CONFLICT", "Location can be shared while your chauffeur is on the way.");
    await prisma.booking.update({ where: { id }, data: { customerLat: input.lat, customerLng: input.lng, customerLocatedAt: new Date() } });
    return { shared: true };
  },
  { auth: { roles: ["CUSTOMER"] }, rateLimit: "tracking" },
);

/** DELETE /api/v1/rides/:id/location: stop sharing; nothing is kept. */
export const DELETE = apiHandler(
  "rides.location.clear",
  async ({ auth, params }) => {
    const { id } = await params!;
    await requireOwnedRide(id, auth!.userId);
    await prisma.booking.update({ where: { id }, data: { customerLat: null, customerLng: null, customerLocatedAt: null } });
    return { shared: false };
  },
  { auth: { roles: ["CUSTOMER"] } },
);

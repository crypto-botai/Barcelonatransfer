import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { ApiError } from "@/lib/api/v1/errors";
import { audit } from "@/lib/api/v1/audit";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { requireDriver, requireDriverRide } from "@/lib/api/v1/driver-rides";
import { CUSTOMER_RATED_ACTION } from "@/lib/api/v1/customer-rating";

export const dynamic = "force-dynamic";

const body = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

/**
 * POST /api/v1/driver/rides/:id/rating
 *
 * The chauffeur rating the passenger after a completed ride, once. Kept in the activity log for the office; the passenger is not
 * shown it. Only the driver of that ride can rate it.
 */
export const POST = apiHandler(
  "driver.rides.rate",
  async ({ req, auth, params, requestId }) => {
    const { id } = await params!;
    const input = await parseBody(req, body);
    const driver = await requireDriver(auth!.userId);
    const ride = await requireDriverRide(id, driver.id);
    if (ride.status !== "COMPLETED") throw new ApiError("CONFLICT", "You can rate the passenger once the ride is completed.");
    const done = await prisma.activityLog.findFirst({ where: { action: CUSTOMER_RATED_ACTION, entity: "booking", entityId: id }, select: { id: true } });
    if (done) throw new ApiError("CONFLICT", "You have already rated this passenger.");
    await audit({ action: CUSTOMER_RATED_ACTION, entity: "booking", entityId: id, actorId: auth!.userId, actorRole: "DRIVER", requestId, ip: clientAddress(req), details: { rating: input.rating, comment: input.comment ?? null } });
    return { rated: true };
  },
  { auth: { roles: ["DRIVER"] }, status: 201 },
);

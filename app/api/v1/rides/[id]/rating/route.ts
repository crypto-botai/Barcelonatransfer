import { z } from "zod";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { ApiError } from "@/lib/api/v1/errors";
import { callLegacy } from "@/lib/api/v1/legacy";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { requireOwnedRide } from "@/lib/api/v1/rides";
import { POST as websiteReview } from "@/app/api/bookings/review/route";

export const dynamic = "force-dynamic";

const body = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().trim().max(1000).optional(),
  companyRating: z.number().int().min(1).max(5).optional(),
});

/**
 * POST /api/v1/rides/:id/rating
 *
 * The website's rating handler decides nothing about who may rate (it trusts
 * the booking id), so this route does: only the account that owns a completed
 * ride may rate it, once.
 */
export const POST = apiHandler(
  "rides.rate",
  async ({ req, auth, params }) => {
    const { id } = await params!;
    const input = await parseBody(req, body);
    const ride = await requireOwnedRide(id, auth!.userId);
    if (ride.status !== "COMPLETED") throw new ApiError("CONFLICT", "You can rate a ride once it is completed.");
    if (ride.rating !== null) throw new ApiError("CONFLICT", "You have already rated this ride.");
    await callLegacy(websiteReview, { method: "POST", path: "/api/bookings/review", body: { bookingId: id, ...input }, ip: clientAddress(req) });
    return { rated: true };
  },
  { auth: { roles: ["CUSTOMER"] }, status: 201 },
);

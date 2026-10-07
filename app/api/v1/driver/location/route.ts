import { z } from "zod";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { ApiError } from "@/lib/api/v1/errors";
import { actorFor } from "@/lib/api/v1/actor";
import { callLegacy } from "@/lib/api/v1/legacy";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { effectiveResponse, requireDriver, requireDriverRide } from "@/lib/api/v1/driver-rides";
import { POST as websiteTracking } from "@/app/api/tracking/route";

export const dynamic = "force-dynamic";

/** How early before pickup a driver's position is accepted, so tracking never runs for a ride that is hours away. */
const TRACKING_LEAD_MINUTES = 60;

const body = z.object({
  bookingId: z.string().min(1).max(40),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().min(0).max(120).optional(),
  heading: z.number().min(0).max(360).optional(),
});

/**
 * POST /api/v1/driver/location
 *
 * One position fix for a ride the driver is on. Accepted only when ALL of these
 * hold: the ride is theirs, they accepted it, it is assigned or in progress, it
 * is not completed, and either they have set off or the pickup is within an
 * hour. Anything else is a CONFLICT and the app stops sending. The position is
 * stored by the website's tracking handler, which re-checks the assignment.
 */
export const POST = apiHandler(
  "driver.location",
  async ({ req, auth }) => {
    const input = await parseBody(req, body);
    const driver = await requireDriver(auth!.userId);
    const ride = await requireDriverRide(input.bookingId, driver.id);

    const open = ride.status === "DRIVER_ASSIGNED" || ride.status === "IN_PROGRESS";
    const finished = ride.rideStage === "COMPLETED";
    const soon = ride.pickupDatetime.getTime() - Date.now() <= TRACKING_LEAD_MINUTES * 60_000;
    if (!open || finished || effectiveResponse(ride) !== "ACCEPTED" || (ride.rideStage === null && !soon)) {
      throw new ApiError("CONFLICT", "Location is not shared for this ride right now.");
    }

    const actor = await actorFor(auth!);
    await callLegacy(websiteTracking, { method: "POST", path: "/api/tracking", body: input, actor, ip: clientAddress(req) });
    return { ok: true };
  },
  { auth: { roles: ["DRIVER"] }, rateLimit: "tracking" },
);

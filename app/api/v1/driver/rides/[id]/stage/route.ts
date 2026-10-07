import { z } from "zod";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { ApiError } from "@/lib/api/v1/errors";
import { actorFor } from "@/lib/api/v1/actor";
import { callLegacy } from "@/lib/api/v1/legacy";
import { audit } from "@/lib/api/v1/audit";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { effectiveResponse, requireDriver, requireDriverRide } from "@/lib/api/v1/driver-rides";
import { PATCH as websiteRide } from "@/app/api/driver/ride/route";

export const dynamic = "force-dynamic";

const body = z.object({
  stage: z.enum(["ON_THE_WAY", "ARRIVED", "WAITING_PASSENGER", "ON_BOARD", "COMPLETED"]),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

/**
 * POST /api/v1/driver/rides/:id/stage
 *
 * The driver's one-tap stage buttons, through the website's own ride handler:
 * forward only, one step at a time, the timeline event, the booking status at the
 * first and last stage, the customer notifications, the review request, settling
 * cash and deposit balances. A ride the driver has declined, or has not accepted
 * yet, cannot be started.
 */
export const POST = apiHandler(
  "driver.rides.stage",
  async ({ req, auth, params, requestId }) => {
    const { id } = await params!;
    const input = await parseBody(req, body);
    const driver = await requireDriver(auth!.userId);
    const ride = await requireDriverRide(id, driver.id);
    if (effectiveResponse(ride) !== "ACCEPTED") throw new ApiError("CONFLICT", "Accept this ride before you start it.");

    const actor = await actorFor(auth!);
    const { json } = await callLegacy(websiteRide, { method: "PATCH", path: "/api/driver/ride", body: { bookingId: id, ...input }, actor, ip: clientAddress(req) });
    await audit({ action: "API_V1_RIDE_STAGE", entity: "booking", entityId: id, actorId: actor.id, actorRole: "DRIVER", requestId, ip: clientAddress(req), details: { stage: input.stage } });
    return { stage: input.stage, ...(typeof json.status === "string" ? { status: json.status } : {}) };
  },
  { auth: { roles: ["DRIVER"] } },
);

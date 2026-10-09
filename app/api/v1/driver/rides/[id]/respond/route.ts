import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { ApiError } from "@/lib/api/v1/errors";
import { audit } from "@/lib/api/v1/audit";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { effectiveResponse, requireDriver, requireDriverRide } from "@/lib/api/v1/driver-rides";

export const dynamic = "force-dynamic";

const body = z.object({
  response: z.enum(["ACCEPT", "REJECT"]),
  reason: z.string().trim().max(300).optional(),
});

/**
 * POST /api/v1/driver/rides/:id/respond
 *
 * ACCEPT records the driver's yes. REJECT sends the ride back to the dispatcher:
 * the driver is unassigned, the booking returns to CONFIRMED and the office is
 * told. A ride can be answered once while it is assigned and not started; a
 * second answer is a CONFLICT, so a double tap cannot flip a decision.
 */
export const POST = apiHandler(
  "driver.rides.respond",
  async ({ req, auth, params, requestId }) => {
    const { id } = await params!;
    const input = await parseBody(req, body);
    const driver = await requireDriver(auth!.userId);
    const ride = await requireDriverRide(id, driver.id);

    if (ride.status !== "DRIVER_ASSIGNED") throw new ApiError("CONFLICT", "This ride can no longer be accepted or declined.");
    if (effectiveResponse(ride) !== "PENDING") throw new ApiError("CONFLICT", "You have already answered this ride.");

    const now = new Date();
    const accepted = input.response === "ACCEPT";

    // One conditional update: it only applies while this driver is still assigned and has not answered.
    const won = await prisma.booking.updateMany({
      where: { id, driverId: driver.id, status: "DRIVER_ASSIGNED", OR: [{ driverResponseBy: null }, { driverResponseBy: { not: driver.id } }, { driverResponse: null }] },
      data: accepted
        ? { driverResponse: "ACCEPTED", driverRespondedAt: now, driverResponseBy: driver.id }
        : { driverResponse: "REJECTED", driverRespondedAt: now, driverResponseBy: driver.id, driverId: null, driverAssignedAt: null, status: "CONFIRMED", rideStage: null, rideStageAt: null },
    });
    if (won.count !== 1) throw new ApiError("CONFLICT", "This ride changed. Refresh and check it again.");

    await prisma.activityLog.create({
      data: {
        adminId: auth!.userId, adminName: "Driver", action: accepted ? "DRIVER_ACCEPTED_RIDE" : "DRIVER_REJECTED_RIDE", entity: "BOOKING", entityId: id,
        details: { driverId: driver.id, code: ride.confirmationCode, reason: input.reason ?? null } as never, ip: clientAddress(req),
      },
    }).catch(() => {});

    if (!accepted) {
      // The dispatcher must see it: a ride with no driver and a clock running.
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true }, take: 20 });
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          title: "Driver declined a ride",
          body: `${ride.confirmationCode}: ${ride.pickupAddress} at ${ride.pickupDatetime.toISOString()} needs a new driver.${input.reason ? ` Reason: ${input.reason}` : ""}`,
          type: "DRIVER_REJECTED",
          data: { bookingId: id } as never,
        })),
      }).catch(() => {});
    }

    await audit({ action: accepted ? "API_V1_RIDE_ACCEPTED" : "API_V1_RIDE_REJECTED", entity: "booking", entityId: id, actorId: auth!.userId, actorRole: "DRIVER", requestId, ip: clientAddress(req) });
    return { response: accepted ? "ACCEPTED" : "REJECTED" };
  },
  { auth: { roles: ["DRIVER"] } },
);

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { requireDriver, requireDriverRide } from "@/lib/api/v1/driver-rides";
import { hasCoords } from "@/lib/geo";
import { arrivalAt, liveRoute } from "@/lib/geo/live-route";

export const dynamic = "force-dynamic";

const query = z.object({ lat: z.coerce.number().min(-90).max(90).optional(), lng: z.coerce.number().min(-180).max(180).optional() });

/**
 * GET /api/v1/driver/rides/:id/route?lat=&lng=
 *
 * What the driver's map draws: the road from where they are to the pickup, the planned journey from the pickup to the destination,
 * and the arrival times for both. `lat`/`lng` is the phone's own position; without it the last position sent for this ride is used.
 * Only the driver of this ride can read it. Road-network times at normal speeds: no live traffic (`trafficAware` is always false).
 */
export const GET = apiHandler(
  "driver.rides.route",
  async ({ req, auth, params }) => {
    const { id } = await params!;
    const q = query.parse(Object.fromEntries(new URL(req.url).searchParams));
    const driver = await requireDriver(auth!.userId);
    const ride = await requireDriverRide(id, driver.id);

    let from = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : null;
    if (!from) {
      const last = await prisma.rideTracking.findFirst({ where: { bookingId: id }, orderBy: { createdAt: "desc" }, select: { lat: true, lng: true } });
      if (last) from = { lat: last.lat, lng: last.lng };
    }

    const now = Date.now();
    const pickup = hasCoords(ride.pickupLat, ride.pickupLng) ? { lat: ride.pickupLat, lng: ride.pickupLng } : null;
    const drop = ride.dropoffAddress.trim() && hasCoords(ride.dropoffLat, ride.dropoffLng) ? { lat: ride.dropoffLat as number, lng: ride.dropoffLng as number } : null;
    const onBoard = ride.rideStage === "ON_BOARD";
    const toPickup = from && pickup && !onBoard ? await liveRoute(`${id}:d-pickup`, from, pickup) : null;
    const trip = pickup && drop ? await liveRoute(`${id}:trip`, pickup, drop) : null;
    const toDrop = onBoard && from && drop ? await liveRoute(`${id}:d-drop`, from, drop) : null;

    return {
      from,
      trafficAware: false,
      basis: (toPickup ?? toDrop ?? trip)?.basis ?? null,
      toPickup: toPickup ? { km: toPickup.distanceKm, minutes: toPickup.durationMin, arrivesAt: arrivalAt(toPickup.durationMin, now), line: toPickup.coordinates } : null,
      trip: trip ? { km: trip.distanceKm, minutes: trip.durationMin, line: trip.coordinates } : null,
      // Arrival at the destination: from now when already on board, otherwise after the pickup and the journey.
      dropoffAt: toDrop ? arrivalAt(toDrop.durationMin, now) : toPickup && trip ? arrivalAt(toPickup.durationMin + trip.durationMin, now) : null,
      toDropoff: toDrop ? { km: toDrop.distanceKm, minutes: toDrop.durationMin, line: toDrop.coordinates } : null,
    };
  },
  { auth: { roles: ["DRIVER"] }, rateLimit: "tracking" },
);

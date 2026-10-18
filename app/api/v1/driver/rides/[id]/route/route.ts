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

    // Routes only for an open ride: a completed or cancelled one has nothing left to drive.
    if (ride.status !== "DRIVER_ASSIGNED" && ride.status !== "IN_PROGRESS") {
      return { from: null, stage: ride.rideStage, routeAt: null, trafficAware: false as const, basis: null, toPickup: null, trip: null, dropoffAt: null, toDropoff: null };
    }

    const now = Date.now();
    const pickup = hasCoords(ride.pickupLat, ride.pickupLng) ? { lat: ride.pickupLat, lng: ride.pickupLng } : null;
    const drop = ride.dropoffAddress.trim() && hasCoords(ride.dropoffLat, ride.dropoffLng) ? { lat: ride.dropoffLat as number, lng: ride.dropoffLng as number } : null;
    const onBoard = ride.rideStage === "ON_BOARD";
    const toPickup = from && pickup && !onBoard ? await liveRoute(`${id}:to-pickup`, from, pickup) : null;
    const trip = pickup && drop ? await liveRoute(`${id}:trip`, pickup, drop) : null;
    const toDrop = onBoard && from && drop ? await liveRoute(`${id}:to-drop`, from, drop) : null;

    // The planned journey never changes, so only the leg from the car says how current the answer is.
    const live = toPickup ?? toDrop;
    const computed = Math.min(live?.computedAt ?? now, now);
    return {
      from,
      // Which stage this answer was worked out for, and when, so a screen that has since moved on can tell it is out of date.
      stage: ride.rideStage,
      routeAt: live ? new Date(computed).toISOString() : null,
      trafficAware: false,
      basis: (toPickup ?? toDrop ?? trip)?.basis ?? null,
      toPickup: toPickup ? { km: toPickup.distanceKm, minutes: toPickup.durationMin, arrivesAt: arrivalAt(toPickup.durationMin, now), line: toPickup.coordinates, steps: toPickup.steps ?? [] } : null,
      trip: trip ? { km: trip.distanceKm, minutes: trip.durationMin, line: trip.coordinates, steps: trip.steps ?? [] } : null,
      // Arrival at the destination: from now when already on board, otherwise after the pickup and the journey.
      dropoffAt: toDrop ? arrivalAt(toDrop.durationMin, now) : toPickup && trip ? arrivalAt(toPickup.durationMin + trip.durationMin, now) : null,
      toDropoff: toDrop ? { km: toDrop.distanceKm, minutes: toDrop.durationMin, line: toDrop.coordinates, steps: toDrop.steps ?? [] } : null,
    };
  },
  { auth: { roles: ["DRIVER"] }, rateLimit: "tracking" },
);

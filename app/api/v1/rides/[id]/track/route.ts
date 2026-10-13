import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { requireOwnedRide } from "@/lib/api/v1/rides";
import { distanceKm } from "@/lib/api/v1/distance";
import { hasCoords } from "@/lib/geo";
import { arrivalAt, freshness, liveRoute } from "@/lib/geo/live-route";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/rides/:id/track
 *
 * Where the driver is, for the owner of the ride, and only while it matters:
 * the driver has set off (a stage exists) and the journey is not over. Before
 * that, and after, there is nothing to show and nothing is disclosed. Only the
 * latest fix is returned, with its age, so the app can say "updated 8 s ago" and
 * fall back to the last known position when the signal drops.
 *
 * The app polls this every few seconds while the ride screen is open.
 */
export const GET = apiHandler(
  "rides.track",
  async ({ auth, params }) => {
    const { id } = await params!;
    const ride = await requireOwnedRide(id, auth!.userId);
    const active = (ride.status === "DRIVER_ASSIGNED" || ride.status === "IN_PROGRESS") && ride.rideStage !== null && ride.rideStage !== "COMPLETED";
    if (!active) return { live: false, status: ride.status, stage: ride.rideStage };

    const latest = await prisma.rideTracking.findFirst({
      where: { bookingId: id },
      orderBy: { createdAt: "desc" },
      select: { lat: true, lng: true, speed: true, heading: true, createdAt: true },
    });
    if (!latest) return { live: false, status: ride.status, stage: ride.rideStage };

    // Heading to the pickup until the passenger is on board, then to the drop-off.
    const target = ride.rideStage === "ON_BOARD" && ride.dropoffAddress.trim()
      ? { lat: ride.dropoffLat, lng: ride.dropoffLng }
      : { lat: ride.pickupLat, lng: ride.pickupLng };

    // Routes from the routing service (see lib/geo/live-route.ts): the driver to the next stop, and the journey itself. Road-network
    // times, not live traffic, and labelled so. The cache keeps a fix every few seconds from becoming a routing call every few seconds.
    const here = { lat: latest.lat, lng: latest.lng };
    const toward = ride.rideStage === "ON_BOARD" ? "DROPOFF" : "PICKUP";
    const nextStop = toward === "PICKUP" ? { lat: ride.pickupLat, lng: ride.pickupLng } : target;
    const leg = hasCoords(nextStop.lat, nextStop.lng) ? await liveRoute(`${id}:${toward === "PICKUP" ? "to-pickup" : "to-drop"}`, here, { lat: nextStop.lat as number, lng: nextStop.lng as number }) : null;
    const tripOk = hasCoords(ride.pickupLat, ride.pickupLng) && hasCoords(ride.dropoffLat, ride.dropoffLng) && ride.dropoffAddress.trim() !== "";
    const trip = tripOk ? await liveRoute(`${id}:trip`, { lat: ride.pickupLat, lng: ride.pickupLng }, { lat: ride.dropoffLat as number, lng: ride.dropoffLng as number }) : null;
    const now = Date.now();
    const ageSeconds = Math.max(0, Math.round((now - latest.createdAt.getTime()) / 1000));

    return {
      live: true,
      etaMinutes: leg ? leg.durationMin : null,
      roadKm: leg ? leg.distanceKm : null,
      etaPrecise: leg ? leg.basis === "road-network" : false,
      // basis tells the screen how to word the time: "road-network" is normal road speeds with no live traffic.
      basis: leg ? leg.basis : null,
      trafficAware: false,
      freshness: freshness(ageSeconds),
      eta: {
        pickupAt: toward === "PICKUP" && leg ? arrivalAt(leg.durationMin, now) : null,
        dropoffAt: leg && toward === "DROPOFF" ? arrivalAt(leg.durationMin, now) : trip && leg ? arrivalAt(leg.durationMin + trip.durationMin, now) : null,
      },
      route: {
        // The line from the car to the next stop, and the planned journey (pickup to destination).
        toNextStop: leg ? leg.coordinates : null,
        trip: trip ? trip.coordinates : null,
        tripKm: trip ? trip.distanceKm : null,
        tripMinutes: trip ? trip.durationMin : null,
      },
      status: ride.status,
      stage: ride.rideStage,
      point: { lat: latest.lat, lng: latest.lng, speed: latest.speed, heading: latest.heading, at: latest.createdAt.toISOString() },
      ageSeconds,
      straightLineKm: distanceKm(here, { lat: target.lat, lng: target.lng }),
      toward,
    };
  },
  { auth: { roles: ["CUSTOMER"] }, rateLimit: "tracking" },
);

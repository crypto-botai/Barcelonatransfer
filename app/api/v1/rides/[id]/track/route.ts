import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { requireOwnedRide } from "@/lib/api/v1/rides";
import { distanceKm } from "@/lib/api/v1/distance";

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

    return {
      live: true,
      status: ride.status,
      stage: ride.rideStage,
      point: { lat: latest.lat, lng: latest.lng, speed: latest.speed, heading: latest.heading, at: latest.createdAt.toISOString() },
      ageSeconds: Math.max(0, Math.round((Date.now() - latest.createdAt.getTime()) / 1000)),
      straightLineKm: distanceKm({ lat: latest.lat, lng: latest.lng }, target),
      toward: ride.rideStage === "ON_BOARD" ? "DROPOFF" : "PICKUP",
    };
  },
  { auth: { roles: ["CUSTOMER"] }, rateLimit: "tracking" },
);

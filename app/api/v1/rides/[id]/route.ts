import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { customerRideDto, requireOwnedRide } from "@/lib/api/v1/rides";
import { isAirportPickup } from "@/lib/api/v1/waiting";
import { vehiclePhotos } from "@/lib/api/v1/vehicle";
import { readArrival } from "@/lib/arrival-store";

export const dynamic = "force-dynamic";

/** GET /api/v1/rides/:id: one of the caller's own rides. Anyone else's is NOT_FOUND. */
export const GET = apiHandler(
  "rides.get",
  async ({ auth, params }) => {
    const { id } = await params!;
    const ride = await requireOwnedRide(id, auth!.userId);
    const landed = isAirportPickup(ride) ? (await readArrival(id).catch(() => [])).find((e) => e.stage === "LANDED") : undefined;
    // The chauffeur's picture and car photos only travel with a single ride, where the passenger is looking at who is coming.
    const full = await prisma.booking.findUnique({ where: { id }, select: { driverId: true, driver: { select: { user: { select: { image: true } } } } } });
    const shown = ride.driver && full?.driverId && ["DRIVER_ASSIGNED", "IN_PROGRESS", "COMPLETED"].includes(ride.status);
    return customerRideDto(ride, new Date(), {
      landedAt: landed ? new Date(landed.at) : null,
      driverImage: shown ? (full?.driver?.user.image ?? null) : null,
      carPhotos: shown && full?.driverId ? await vehiclePhotos(full.driverId) : undefined,
    });
  },
  { auth: { roles: ["CUSTOMER"] } },
);

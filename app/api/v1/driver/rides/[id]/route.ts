import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { driverRideDto, requireDriver, requireDriverRide } from "@/lib/api/v1/driver-rides";
import { isAirportPickup } from "@/lib/api/v1/waiting";
import { CUSTOMER_RATED_ACTION } from "@/lib/api/v1/customer-rating";
import { readArrival } from "@/lib/arrival-store";

export const dynamic = "force-dynamic";

/** GET /api/v1/driver/rides/:id: one of the caller's own rides. Any other driver's is NOT_FOUND. */
export const GET = apiHandler(
  "driver.rides.get",
  async ({ auth, params }) => {
    const { id } = await params!;
    const driver = await requireDriver(auth!.userId);
    const ride = await requireDriverRide(id, driver.id);
    const landed = isAirportPickup(ride) ? (await readArrival(id).catch(() => [])).find((e) => e.stage === "LANDED") : undefined;
    const rated = ride.status === "COMPLETED" ? await prisma.activityLog.findFirst({ where: { action: CUSTOMER_RATED_ACTION, entity: "booking", entityId: id }, select: { id: true } }) : null;
    return driverRideDto(ride, new Date(), { landedAt: landed ? new Date(landed.at) : null, ratedCustomer: ride.status === "COMPLETED" ? rated !== null : undefined });
  },
  { auth: { roles: ["DRIVER"] } },
);

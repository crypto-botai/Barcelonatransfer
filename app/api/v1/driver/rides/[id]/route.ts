import { apiHandler } from "@/lib/api/v1/response";
import { driverRideDto, requireDriver, requireDriverRide } from "@/lib/api/v1/driver-rides";

export const dynamic = "force-dynamic";

/** GET /api/v1/driver/rides/:id — one of the caller's own rides. Any other driver's is NOT_FOUND. */
export const GET = apiHandler(
  "driver.rides.get",
  async ({ auth, params }) => {
    const { id } = await params!;
    const driver = await requireDriver(auth!.userId);
    return driverRideDto(await requireDriverRide(id, driver.id));
  },
  { auth: { roles: ["DRIVER"] } },
);

import { apiHandler } from "@/lib/api/v1/response";
import { customerRideDto, requireOwnedRide } from "@/lib/api/v1/rides";

export const dynamic = "force-dynamic";

/** GET /api/v1/rides/:id — one of the caller's own rides. Anyone else's is NOT_FOUND. */
export const GET = apiHandler(
  "rides.get",
  async ({ auth, params }) => {
    const { id } = await params!;
    return customerRideDto(await requireOwnedRide(id, auth!.userId));
  },
  { auth: { roles: ["CUSTOMER"] } },
);

import { apiHandler } from "@/lib/api/v1/response";
import { callLegacy } from "@/lib/api/v1/legacy";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { requireOwnedRide } from "@/lib/api/v1/rides";
import { GET as websiteFlight } from "@/app/api/flights/status/route";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/rides/:id/flight
 *
 * Live status of the flight on a ride, from the website's own lookup (which counts
 * against a monthly quota, so it is only ever asked for a ride the caller owns).
 * { tracked: false } when there is no flight number or the lookup is not available.
 */
export const GET = apiHandler(
  "rides.flight",
  async ({ req, auth, params }) => {
    const { id } = await params!;
    const ride = await requireOwnedRide(id, auth!.userId);
    if (!ride.flightNumber) return { tracked: false, reason: "no_flight_number" };
    try {
      const { json } = await callLegacy(websiteFlight, {
        method: "GET",
        path: `/api/flights/status?bookingId=${encodeURIComponent(ride.id)}&code=${encodeURIComponent(ride.confirmationCode)}`,
        ip: clientAddress(req),
      });
      return json;
    } catch {
      return { tracked: false, reason: "unavailable" };
    }
  },
  { auth: { roles: ["CUSTOMER"] } },
);

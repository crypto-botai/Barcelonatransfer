import { apiHandler } from "@/lib/api/v1/response";
import { callLegacy } from "@/lib/api/v1/legacy";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { requireDriver, requireDriverRide } from "@/lib/api/v1/driver-rides";
import { GET as websiteFlight } from "@/app/api/flights/status/route";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/driver/rides/:id/flight
 *
 * Live status of the flight on a ride the driver is on: whether it is in the air or down, the expected landing time, the terminal,
 * gate and belt. It uses the website's own lookup, which counts against a monthly quota, so it is only ever asked for a ride that is
 * this driver's (the same check as every other driver ride route). { tracked: false } when the ride has no flight number or the
 * lookup is not available; the app then simply shows the flight number from the booking.
 */
export const GET = apiHandler(
  "driver.flight",
  async ({ req, auth, params }) => {
    const { id } = await params!;
    const driver = await requireDriver(auth!.userId);
    const ride = await requireDriverRide(id, driver.id);
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
  { auth: { roles: ["DRIVER"] } },
);

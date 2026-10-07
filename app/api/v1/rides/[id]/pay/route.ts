import { apiHandler } from "@/lib/api/v1/response";
import { ApiError } from "@/lib/api/v1/errors";
import { callLegacy } from "@/lib/api/v1/legacy";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { requireOwnedRide } from "@/lib/api/v1/rides";
import { POST as websiteCheckout } from "@/app/api/payments/create-checkout/route";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/rides/:id/pay
 *
 * The hosted SumUp checkout for a ride that is not paid yet, for the in-app
 * browser. The checkout is created by the website's own handler, so the amount
 * is the booking's server-side total. The app never sends an amount and never
 * sees card data. Payment is confirmed by SumUp's webhook and verification on
 * the server; the app fetches the ride until it shows PAID.
 */
export const POST = apiHandler(
  "rides.pay",
  async ({ req, auth, params }) => {
    const { id } = await params!;
    const ride = await requireOwnedRide(id, auth!.userId);
    if (ride.paymentStatus === "PAID") throw new ApiError("CONFLICT", "This ride is already paid.");
    if (ride.status === "CANCELLED" || ride.status === "REFUNDED" || ride.status === "COMPLETED") {
      throw new ApiError("CONFLICT", "This ride can no longer be paid.");
    }
    const { json } = await callLegacy(websiteCheckout, { method: "POST", path: "/api/payments/create-checkout", body: { bookingId: id }, ip: clientAddress(req) });
    const url = typeof json.checkoutUrl === "string" ? json.checkoutUrl : "";
    if (!/^https:\/\//.test(url)) throw new ApiError("UPSTREAM_FAILED", "Online payment is not available right now. Contact the office to pay.");
    return { checkoutUrl: url };
  },
  { auth: { roles: ["CUSTOMER"] } },
);

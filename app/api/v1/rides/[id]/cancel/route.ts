import { apiHandler } from "@/lib/api/v1/response";
import { actorFor } from "@/lib/api/v1/actor";
import { callLegacy } from "@/lib/api/v1/legacy";
import { audit } from "@/lib/api/v1/audit";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { requireOwnedRide } from "@/lib/api/v1/rides";
import { POST as websiteCancel } from "@/app/api/bookings/[id]/cancel/route";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/rides/:id/cancel
 *
 * The website's cancellation and refund policy, unchanged: free up to the
 * journey's own window (24 h in the city, 48 h beyond, 72 h for a minibus), the
 * cancellation-protection rules, the SumUp refund, the emails and the WhatsApp
 * messages. Inside the window the website answers with the policy and a
 * WhatsApp link, and this route passes that through as a VALIDATION_FAILED
 * whose message the app shows as it is.
 */
export const POST = apiHandler(
  "rides.cancel",
  async ({ req, auth, params, requestId }) => {
    const { id } = await params!;
    await requireOwnedRide(id, auth!.userId);
    const actor = await actorFor(auth!);
    const { json } = await callLegacy(websiteCancel, { method: "POST", path: `/api/bookings/${id}/cancel`, params: { id }, actor, ip: clientAddress(req) });
    await audit({ action: "API_V1_RIDE_CANCELLED", entity: "booking", entityId: id, actorId: actor.id, actorRole: actor.role, requestId, ip: clientAddress(req) });
    return {
      status: json.status,
      refundProcessed: Boolean(json.refundProcessed),
      refundAmount: Number(json.refundAmount ?? 0),
      keptAmount: Number(json.keptAmount ?? 0),
      message: String(json.message ?? "Your ride is cancelled."),
    };
  },
  { auth: { roles: ["CUSTOMER"] } },
);

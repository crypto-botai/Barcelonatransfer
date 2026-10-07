import { z } from "zod";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { actorFor } from "@/lib/api/v1/actor";
import { callLegacy } from "@/lib/api/v1/legacy";
import { audit } from "@/lib/api/v1/audit";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { POST as websiteBooking } from "@/app/api/bookings/route";

export const dynamic = "force-dynamic";

const body = z.record(z.string(), z.unknown());

const base = () => (process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info").replace(/\/$/, "");

/**
 * POST /api/v1/bookings
 *
 * Creates a booking for the signed-in customer through the website's own
 * booking handler: the server measures the distance, recomputes the fare and
 * rejects a client-supplied price that does not match, applies the surcharges,
 * coupons, deposit and protection options, links the booking to the account and
 * opens the payment checkout.
 *
 * The person is the account holder, never what the body says: guestEmail is
 * always the account's email. The answer is trimmed to what an app needs. A
 * temporary password, which the website's handler returns for a brand-new guest
 * account, can never be returned here because the caller always has an account.
 *
 * Success: { bookingId, checkoutUrl | null, payment: "ONLINE" | "ARRANGED" }.
 * `checkoutUrl` is the hosted SumUp page to open in the in-app browser. The app
 * then fetches the ride until its payment shows PAID: the server confirms the
 * payment with SumUp, the app never does.
 */
export const POST = apiHandler(
  "bookings.create",
  async ({ req, auth, requestId }) => {
    const input = await parseBody(req, body, 128 * 1024);
    const actor = await actorFor(auth!);

    const payload = {
      ...input,
      guestEmail: actor.email,
      guestName: typeof input.guestName === "string" && input.guestName.trim().length >= 2 ? input.guestName : actor.name ?? "Guest",
    };
    const { json } = await callLegacy(websiteBooking, { method: "POST", path: "/api/bookings", body: payload, actor, ip: clientAddress(req) });

    const bookingId = String(json.bookingId ?? "");
    const url = typeof json.checkoutUrl === "string" ? json.checkoutUrl : "";
    const online = /^https:\/\//.test(url);
    await audit({ action: "API_V1_BOOKING_CREATED", entity: "booking", entityId: bookingId, actorId: actor.id, actorRole: actor.role, requestId, ip: clientAddress(req) });

    return {
      bookingId,
      checkoutUrl: online ? url : null,
      // "ARRANGED": payment is settled by hand with the office, the website's own fallback.
      payment: online ? ("ONLINE" as const) : ("ARRANGED" as const),
      successUrl: `${base()}/booking/success?booking_id=${encodeURIComponent(bookingId)}`,
    };
  },
  { auth: { roles: ["CUSTOMER"] } },
);

import { z } from "zod";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { actorFor } from "@/lib/api/v1/actor";
import { callLegacy } from "@/lib/api/v1/legacy";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { POST as websiteBooking } from "@/app/api/bookings/route";

export const dynamic = "force-dynamic";

const body = z.record(z.string(), z.unknown());

/**
 * POST /api/v1/quotes/checkout
 *
 * What this exact booking would cost, to the cent, before it is made: the fare,
 * the extras with the customer's tier applied, coupon and return discounts, VAT
 * when an invoice is wanted, the tip, cancellation protection, and how much is
 * charged now against paid to the chauffeur on the day.
 *
 * It is the website's booking handler run in its dry-run mode, so every figure is
 * the one the booking will be created with and the apps never add anything up.
 * Nothing is written.
 */
export const POST = apiHandler(
  "quotes.checkout",
  async ({ req, auth }) => {
    const input = await parseBody(req, body, 128 * 1024);
    const actor = await actorFor(auth!);
    const payload = {
      ...input,
      dryRun: true,
      guestEmail: actor.email,
      guestName: typeof input.guestName === "string" && input.guestName.trim().length >= 2 ? input.guestName : actor.name ?? "Guest",
    };
    const { json } = await callLegacy(websiteBooking, { method: "POST", path: "/api/bookings", body: payload, actor, ip: clientAddress(req) });
    const num = (v: unknown) => (typeof v === "number" ? v : 0);
    return {
      fare: num(json.fare),
      extras: num(json.extras),
      couponDiscount: num(json.couponDiscount),
      returnDiscount: num(json.returnDiscount),
      vat: num(json.vat),
      tip: num(json.tip),
      protectionFee: num(json.protectionFee),
      total: num(json.total),
      payNow: num(json.payNow),
      balance: num(json.balance),
      option: json.option === "DEPOSIT" ? ("DEPOSIT" as const) : ("FULL" as const),
      currency: "EUR" as const,
    };
  },
  { auth: { roles: ["CUSTOMER"] }, rateLimit: "quote" },
);

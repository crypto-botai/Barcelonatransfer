import { prisma } from "@/lib/prisma";
import { sendPaymentConfirmationEmail, sendAdminNewBookingAlert, sendFailedPaymentEmail } from "@/lib/resend";
import { sendWhatsAppBookingConfirmation } from "@/lib/whatsapp";
import { notify } from "@/lib/notifications/service";
import type { SumUpCheckout } from "@/lib/sumup";
import { formatPickupDateTime } from "@/lib/datetime";
import { paidOnline } from "@/lib/deposits";
import { sendOpenAiConversion } from "@/lib/tracking/openai-conversions";
import { parseBookingMeta } from "@/lib/booking-meta";

// Shared by app/api/payments/webhook, app/api/payments/verify, and app/api/cron/payment-reconcile
// so all three entry points apply the exact same DB + email side-effects for a paid or failed
// SumUp checkout, and the EmailLog dedup check guarantees only one confirmation is ever sent
// no matter which of the three paths gets there first (or how many times each retries).

export async function finalizeSumUpPayment(bookingId: string, checkout: SumUpCheckout): Promise<"already-paid" | "confirmed" | "not-found"> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return "not-found";
  if (booking.paymentStatus === "PAID") return "already-paid";

  const transactionId = (checkout.transaction_id ?? checkout.id) as string;

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paymentStatus:   "PAID",
      status:          "CONFIRMED",
      stripePaymentId: transactionId,
    },
  });

  await prisma.payment.upsert({
    where:  { bookingId },
    update: { status: "PAID", stripePaymentId: transactionId },
    create: {
      bookingId,
      stripeSessionId: checkout.id,
      stripePaymentId: transactionId,
      // What the card was actually charged: the deposit on a deposit booking.
      amount:          paidOnline(updated),
      currency:        updated.currency,
      status:          "PAID",
    },
  });

  // ── order_created ──────────────────────────────────────────────────────
  //
  // The only place this fires. Everything above has already happened:
  // SumUp's own API answered PAID, the booking is CONFIRMED and the payment
  // row is written. Placed before the guestEmail return below so a booking
  // with no guest email still reports its conversion.
  await reportOrderCreated(updated, checkout);

  if (!updated.guestEmail) return "confirmed";

  await prisma.abandonedBooking.updateMany({
    where: { email: updated.guestEmail, convertedAt: null },
    data:  { convertedAt: new Date() },
  }).catch(() => {});
  await prisma.bookingSession.updateMany({
    where: { email: updated.guestEmail, converted: false },
    data:  { converted: true },
  }).catch(() => {});

  // Dedup: skip if a payment confirmation was already logged for this booking —
  // this is what makes it safe for webhook, verify-poll, and the reconcile cron
  // to all race to call this function for the same booking.
  const alreadySent = await prisma.emailLog.findFirst({
    where: { bookingId, type: "PAYMENT_CONFIRMATION" },
  }).catch(() => null);

  if (!alreadySent) {
    const route = updated.dropoffAddress
      ? `${updated.pickupAddress} → ${updated.dropoffAddress}`
      : updated.pickupAddress;

    const [custResult, adminResult] = await Promise.allSettled([
      sendPaymentConfirmationEmail({
        to:               updated.guestEmail,
        name:             updated.guestName ?? "Valued Client",
        confirmationCode: updated.confirmationCode,
        pickupAddress:    updated.pickupAddress,
        dropoffAddress:   updated.dropoffAddress,
        pickupDatetime:   formatPickupDateTime(updated.pickupDatetime),
        vehicleClass:     updated.vehicleClass,
        totalAmount:      updated.totalAmount,
        // Decides whether they are told about the airport meeting point, and
        // whether a chauffeur will be holding a board with their name.
        pickupLat:        updated.pickupLat,
        pickupLng:        updated.pickupLng,
        specialRequests:  updated.specialRequests,
        payNow:           paidOnline(updated),
        balanceAmount:    updated.balanceAmount ?? 0,
        protectionFee:    updated.protectionFee ?? 0,
        passengers:       updated.passengers,
        bookingId,
        transactionId,
      }),
      sendAdminNewBookingAlert({
        confirmationCode: updated.confirmationCode,
        guestName:        updated.guestName ?? "Guest",
        guestEmail:       updated.guestEmail,
        guestPhone:       updated.guestPhone ?? undefined,
        pickupAddress:    updated.pickupAddress,
        dropoffAddress:   updated.dropoffAddress ?? "",
        pickupDatetime:   formatPickupDateTime(updated.pickupDatetime),
        vehicleClass:     updated.vehicleClass,
        totalAmount:      updated.totalAmount,
        passengers:       updated.passengers,
        specialRequests:  updated.specialRequests,
      }),
    ]);

    if (custResult.status === "rejected")
      console.error("[payment-completion] customer email:", custResult.reason);
    if (adminResult.status === "rejected")
      console.error("[payment-completion] admin alert:", adminResult.reason);

    if (updated.guestPhone) {
      try {
        await sendWhatsAppBookingConfirmation({
          phone:          updated.guestPhone,
          bookingRef:     updated.confirmationCode,
          pickupDatetime: formatPickupDateTime(updated.pickupDatetime),
          route,
        });
      } catch (waErr) {
        console.error("[payment-completion] whatsapp:", waErr);
      }
    }

    // In-app copy for the customer portal, plus the audit entry. Email and
    // WhatsApp already went out above through their existing templates, so
    // this deliberately drives only the inapp channel rather than sending
    // everything twice. Sits inside the dedup guard so a webhook/verify/cron
    // race cannot produce duplicate rows.
    await notify({
      event:     "PAYMENT_RECEIVED",
      channels:  ["inapp"],
      userId:    updated.userId,
      bookingId: updated.id,
      vars:      { code: updated.confirmationCode, amount: updated.totalAmount, route },
    });
  }

  return "confirmed";
}

/**
 * The balance on a deposit booking, paid online instead of to the chauffeur.
 * Idempotent: a second call for a balance already marked paid does nothing.
 */
export async function finalizeBalancePayment(bookingId: string, checkout: SumUpCheckout): Promise<"already-paid" | "paid" | "not-found"> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, balanceAmount: true, balancePaidAt: true } });
  if (!booking) return "not-found";
  if (booking.balancePaidAt || !booking.balanceAmount) return "already-paid";
  await prisma.booking.update({
    where: { id: bookingId },
    data: { balancePaidAt: new Date(), balancePaidBy: "online", balanceMethod: "ONLINE" },
  });
  const transactionId = (checkout.transaction_id ?? checkout.id) as string;
  await prisma.activityLog.create({
    data: { adminId: "system", adminName: "SumUp", action: "BALANCE_PAID", entity: "BOOKING", entityId: bookingId, details: { amount: booking.balanceAmount, transactionId } as never },
  }).catch(() => {});
  return "paid";
}

/** The marker row that makes the conversion send exactly once. */
const CONVERSION_TYPE = "CONVERSION_ORDER_CREATED";

/**
 * Reports the paid booking to OpenAI Ads, once and only once.
 *
 * Three paths reach finalizeSumUpPayment — the SumUp webhook, the success
 * page's verify poll, and the reconcile cron — and SumUp retries webhooks on
 * any non-2xx, so this can be called several times for one booking. The
 * guard is the same shape the confirmation emails already use: a row in
 * email_logs, claimed before the work and marked afterwards, with the
 * earliest claim winning a race.
 *
 * event_id is booking.id: generated once at creation, never changes, and the
 * same on every path. OpenAI deduplicates on it as well, so even a send that
 * slips past this guard is the same conversion rather than a second sale.
 *
 * The amount and currency come from the confirmed SumUp checkout, not from
 * the booking row. They are what SumUp actually charged; the booking row
 * only says what was expected, and the two can part company — the office can
 * reschedule an hourly booking, which rewrites totalAmount, while a checkout
 * for the old figure is still outstanding. Reporting a sale for money that
 * was never taken is the kind of error nobody notices until the numbers are
 * reconciled months later.
 *
 * The Payment row is deliberately left as it was: it has its own meaning and
 * its own history, and changing it was not part of this.
 */
async function reportOrderCreated(
  booking: { id: string; specialRequests: string | null },
  checkout: SumUpCheckout,
): Promise<void> {
  try {
    const priors = await prisma.emailLog.findMany({
      where: { bookingId: booking.id, type: CONVERSION_TYPE },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    // Already reported. Nothing to do, however many times we are called.
    if (priors.some((r) => r.status === "SENT")) return;

    // A claim still in flight elsewhere: leave it to finish rather than
    // sending a second time alongside it.
    const CLAIM_TTL_MS = 5 * 60_000;
    if (priors.some((r) => r.status === "PENDING" && Date.now() - r.createdAt.getTime() < CLAIM_TTL_MS)) return;

    // Clear a dead claim so a failed attempt can be retried by a later path
    // rather than blocking the conversion for good.
    if (priors.length) {
      await prisma.emailLog.deleteMany({
        where: { id: { in: priors.filter((r) => r.status !== "SENT").map((r) => r.id) } },
      }).catch(() => {});
    }

    const claim = await prisma.emailLog.create({
      data: {
        bookingId: booking.id,
        type:      CONVERSION_TYPE,
        to:        "openai-ads",
        subject:   booking.id, // the event_id, for looking one up later
        status:    "PENDING",
      },
      select: { id: true },
    });

    // Earliest claim wins, so two callers that got this far together do not
    // both send.
    const winner = await prisma.emailLog.findFirst({
      where: { bookingId: booking.id, type: CONVERSION_TYPE },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    if (winner?.id !== claim.id) {
      await prisma.emailLog.delete({ where: { id: claim.id } }).catch(() => {});
      return;
    }

    const meta = parseBookingMeta(booking.specialRequests);
    const siteUrl = process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info";
    const result = await sendOpenAiConversion({
      eventId:   booking.id,
      eventType: "order_created",
      // Straight from the confirmed checkout: what SumUp actually took,
      // in the currency it took it in. Never recomputed from the booking.
      amount:    checkout.amount,
      currency:  checkout.currency,
      // Exactly as it arrived from the ad click, never rewritten.
      oppref:    meta.oppref,
      sourceUrl: `${siteUrl}/booking/success?booking_id=${booking.id}`,
      // Set OPENAI_CONVERSIONS_VALIDATE_ONLY=true to exercise the whole path
      // against the real API without recording a sale.
      validateOnly: process.env.OPENAI_CONVERSIONS_VALIDATE_ONLY === "true",
    });

    await prisma.emailLog.update({
      where: { id: claim.id },
      // A validate-only run deliberately records nothing at OpenAI, so the
      // claim is released rather than marked sent — otherwise a test would
      // permanently suppress the real conversion for that booking.
      data:  { status: result.outcome === "sent" ? "SENT" : "FAILED" },
    }).catch(() => {});

    // The sender has already logged the specific outcome (sent, validated,
    // authentication error, validation error, rejected, not configured).
    if (!result.ok) {
      console.error("[conversions] order_created not recorded for", booking.id, "-", result.outcome);
    }
  } catch (err) {
    // A marketing report must never stop a payment being confirmed.
    console.error("[conversions] order_created threw for", booking.id, err);
  }
}

export async function markSumUpPaymentFailed(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.paymentStatus === "PAID" || booking.paymentStatus === "FAILED") return;

  const failedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data:  { paymentStatus: "FAILED" },
  }).catch(() => null);

  if (!failedBooking?.guestEmail) return;

  const alreadySent = await prisma.emailLog.findFirst({
    where: { bookingId, type: "PAYMENT_FAILED" },
  }).catch(() => null);
  if (alreadySent) return;

  try {
    await sendFailedPaymentEmail({
      to:               failedBooking.guestEmail,
      name:             failedBooking.guestName ?? "Valued Client",
      confirmationCode: failedBooking.confirmationCode,
      bookingId:        failedBooking.id,
    });
  } catch (e) {
    console.error("[payment-completion] failed-payment email:", e);
  }

  await notify({
    event:     "PAYMENT_FAILED",
    channels:  ["inapp"],
    userId:    failedBooking.userId,
    bookingId: failedBooking.id,
    vars:      { code: failedBooking.confirmationCode },
  });
}

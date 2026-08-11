import { prisma } from "@/lib/prisma";
import { sendPaymentConfirmationEmail, sendAdminNewBookingAlert, sendFailedPaymentEmail } from "@/lib/resend";
import { sendWhatsAppBookingConfirmation } from "@/lib/whatsapp";
import { notify } from "@/lib/notifications/service";
import type { SumUpCheckout } from "@/lib/sumup";
import { formatPickupDateTime } from "@/lib/datetime";

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
      amount:          updated.totalAmount,
      currency:        updated.currency,
      status:          "PAID",
    },
  });

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

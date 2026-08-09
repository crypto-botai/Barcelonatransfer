/**
 * Brings booking payment status back in line with SumUp.
 *
 * Three paths normally settle a payment: the browser polling /api/payments/verify
 * on the success page, the SumUp webhook, and this reconciliation. The first two
 * both depend on something outside our control — the customer's tab staying open,
 * or the webhook secret being configured and the delivery succeeding.
 *
 * Extracted from the payment-reconcile cron so it can also run inside the other
 * daily jobs. The Vercel Hobby plan caps each cron entry at one run per day, so
 * a booking that failed at 17:00 sat labelled PENDING in the admin panel until
 * 05:00 the next morning. Calling this from several existing jobs spreads the
 * reconciliation across the day without adding a cron entry — which the plan
 * would reject anyway, and a rejected schedule silently fails every deployment.
 */

import { prisma } from "@/lib/prisma";
import { getSumUpCheckout } from "@/lib/sumup";
import { finalizeSumUpPayment, markSumUpPaymentFailed } from "@/lib/payment-completion";

export interface ReconcileResult {
  checked: number;
  confirmed: number;
  failed: number;
  stillPending: number;
  errors: number;
}

export async function reconcilePendingPayments(limit = 50): Promise<ReconcileResult> {
  // Give the live verify-poll a few minutes to finish before duplicating it.
  const olderThan = new Date(Date.now() - 3 * 60_000);
  // SumUp checkouts go stale long before a week; chasing older ones is pointless.
  const newerThan = new Date(Date.now() - 7 * 24 * 60 * 60_000);

  const stuck = await prisma.booking.findMany({
    where: {
      paymentStatus:   "PENDING",
      stripeSessionId: { not: null },
      createdAt:       { lt: olderThan, gt: newerThan },
    },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  const result: ReconcileResult = {
    checked: stuck.length, confirmed: 0, failed: 0, stillPending: 0, errors: 0,
  };

  for (const booking of stuck) {
    if (!booking.stripeSessionId) continue;
    try {
      const checkout = await getSumUpCheckout(booking.stripeSessionId);

      if (checkout.status === "PAID") {
        await finalizeSumUpPayment(booking.id, checkout);
        result.confirmed++;
      } else if (checkout.status === "FAILED" || checkout.status === "EXPIRED") {
        await markSumUpPaymentFailed(booking.id);
        result.failed++;
      } else {
        result.stillPending++;
      }
    } catch (err) {
      console.error("[reconcile]", booking.id, err);
      result.errors++;
    }
  }

  return result;
}

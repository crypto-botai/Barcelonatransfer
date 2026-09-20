/**
 * Server side of deposits: the online balance link. The money arithmetic
 * lives in lib/checkout-money.ts, which is safe to import from the browser;
 * everything there is re-exported here so existing imports keep working.
 */

import { prisma } from "@/lib/prisma";
import { createSumUpCheckout, getSumUpCheckoutUrl } from "@/lib/sumup";

export * from "@/lib/checkout-money";

export type BalanceState =
  | { due: false; reason: "not_a_deposit_booking" | "already_paid" }
  | { due: true; amount: number; checkoutUrl: string };

/**
 * Produces a payment link for the outstanding balance, for a customer who
 * would rather settle it online than with the chauffeur.
 *
 * Reuses an existing SumUp checkout when one is still pending, so sending the
 * customer a reminder does not create a second charge they might both pay.
 */
export async function getBalancePayment(bookingId: string): Promise<BalanceState> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true, confirmationCode: true, balanceAmount: true, balancePaidAt: true,
      balanceCheckoutId: true, guestEmail: true, currency: true,
      pickupAddress: true, dropoffAddress: true,
    },
  });

  if (!booking?.balanceAmount || booking.balanceAmount <= 0) {
    return { due: false, reason: "not_a_deposit_booking" };
  }
  if (booking.balancePaidAt) {
    return { due: false, reason: "already_paid" };
  }

  if (booking.balanceCheckoutId) {
    return {
      due: true,
      amount: booking.balanceAmount,
      checkoutUrl: getSumUpCheckoutUrl(booking.balanceCheckoutId, booking.id),
    };
  }

  const checkout = await createSumUpCheckout({
    // Suffixed so it cannot collide with the deposit checkout, which used the
    // bare booking id as its reference.
    bookingId: `${booking.id}-balance`,
    amount: booking.balanceAmount,
    currency: booking.currency,
    description: `Balance - transfer ${booking.confirmationCode.slice(0, 8).toUpperCase()}`,
    customerEmail: booking.guestEmail ?? undefined,
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data:  { balanceCheckoutId: checkout.id },
  });

  return {
    due: true,
    amount: booking.balanceAmount,
    checkoutUrl: getSumUpCheckoutUrl(checkout.id, booking.id),
  };
}

/**
 * Deposit bookings.
 *
 * Most transfers are paid in full at the time of booking. Deposits exist for
 * the cases where asking for the whole amount up front loses the sale — large
 * group minibus hires, long-distance runs, bookings made months ahead.
 *
 * The split is money, so it is computed in one place and stored on the booking
 * rather than recalculated at each step: a percentage re-applied to a rounded
 * figure drifts, and a customer who is charged a balance that does not match
 * their deposit receipt will dispute it.
 */

import { prisma } from "@/lib/prisma";
import { createSumUpCheckout, getSumUpCheckoutUrl } from "@/lib/sumup";

/** Share of the fare taken up front. */
export const DEPOSIT_PERCENT = 30;

/**
 * Below this, a deposit is not worth the second payment step — the customer
 * pays two card fees and gets two receipts to save very little cash flow.
 */
export const DEPOSIT_MIN_FARE = 200;

export interface DepositSplit {
  deposit: number;
  balance: number;
  total: number;
  percent: number;
}

export function isDepositEligible(total: number): boolean {
  return total >= DEPOSIT_MIN_FARE;
}

/**
 * Splits a fare into deposit and balance.
 *
 * The balance is derived by subtraction, never by a second percentage, so the
 * two parts always add back to exactly the total no matter how the rounding
 * falls.
 */
export function splitDeposit(total: number, percent = DEPOSIT_PERCENT): DepositSplit {
  const pct = Math.min(100, Math.max(0, percent));
  const gross = Math.round(total * 100) / 100;
  const deposit = Math.round(gross * (pct / 100) * 100) / 100;
  const balance = Math.round((gross - deposit) * 100) / 100;
  return { deposit, balance, total: gross, percent: pct };
}

export type BalanceState =
  | { due: false; reason: "not_a_deposit_booking" | "already_paid" }
  | { due: true; amount: number; checkoutUrl: string };

/**
 * Produces a payment link for the outstanding balance.
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

import { prisma } from "@/lib/prisma";
import { sendBookingConfirmation, sendJourneysConfirmation, sendPaymentConfirmationEmail } from "@/lib/resend";
import { formatPickupDateTime } from "@/lib/datetime";
import { paidOnline } from "@/lib/deposits";
import { loadJourneyGroup } from "@/lib/journeys";
import { calendarLinks } from "@/lib/calendar";

/**
 * The booking's contact email, and sending the customer their confirmation again, for the office.
 *
 * Only the email ON THE BOOKING changes. The customer's sign-in account (its email and password) is never touched here: moving a
 * login email is an account-takeover risk and belongs to the customer. A booking given to an account is a different action.
 */

export type ConfirmationKind = "confirmed" | "received";

/** A plausible address: one @, no spaces, a dot in the domain. The route also runs the schema check; this is the single rule for both. */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254;
}

/**
 * Sends the booking's confirmation to `to`. Paid bookings get the payment confirmation (the same email the customer got on payment,
 * including every journey booked with it); unpaid ones get "booking received". A cancelled or refunded booking is refused, because
 * "confirmed" would not be true.
 */
export async function sendConfirmationTo(bookingId: string, to: string): Promise<ConfirmationKind> {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b || b.isDeleted) throw new Error("Booking not found");
  if (b.status === "CANCELLED" || b.status === "REFUNDED") throw new Error("This booking is cancelled, so a confirmation cannot be sent.");
  const name = b.guestName ?? "Valued Client";

  if (b.paymentStatus === "PAID") {
    const group = await loadJourneyGroup(b).catch(() => null);
    if (group) {
      await sendJourneysConfirmation({
        to, name, stage: "confirmed", journeys: group.journeys, totalAmount: group.total, bookingId, logType: "CONFIRMATION",
        split: group.balance > 0 || (b.protectionFee ?? 0) > 0
          ? { payNow: paidOnline(b), balance: group.balance, protectionFee: b.protectionFee ?? 0, paid: true, note: "That balance is split between your journeys in proportion to each fare, so each chauffeur collects only for the journey they drive." }
          : null,
        arrivalFrom: { pickupLat: b.pickupLat, pickupLng: b.pickupLng, pickupAddress: b.pickupAddress, specialRequests: b.specialRequests },
      });
    } else {
      await sendPaymentConfirmationEmail({
        to, name, confirmationCode: b.confirmationCode, pickupAddress: b.pickupAddress, dropoffAddress: b.dropoffAddress,
        pickupDatetime: formatPickupDateTime(b.pickupDatetime), vehicleClass: b.vehicleClass, totalAmount: b.totalAmount,
        pickupLat: b.pickupLat, pickupLng: b.pickupLng, specialRequests: b.specialRequests,
        payNow: paidOnline(b), balanceAmount: b.balanceAmount ?? 0, protectionFee: b.protectionFee ?? 0, passengers: b.passengers, bookingId,
      });
    }
    return "confirmed";
  }

  await sendBookingConfirmation({
    to, name, confirmationCode: b.confirmationCode, pickupAddress: b.pickupAddress, dropoffAddress: b.dropoffAddress ?? "",
    pickupDatetime: formatPickupDateTime(b.pickupDatetime), vehicleClass: b.vehicleClass, totalAmount: b.totalAmount, passengers: b.passengers, bookingId,
    payNow: paidOnline(b), balanceAmount: b.balanceAmount ?? 0, protectionFee: b.protectionFee ?? 0,
    calendar: calendarLinks({ id: b.id, confirmationCode: b.confirmationCode, pickupAddress: b.pickupAddress, dropoffAddress: b.dropoffAddress, pickupDatetime: b.pickupDatetime, durationMin: b.durationMin ?? undefined }),
  });
  return "received";
}

/**
 * The journeys that belong to one booking.
 *
 * A return, an extra ride and an extra car are each a booking of their own, so
 * that each can have its own chauffeur and its own place on the dispatch board.
 * The customer, though, booked one arrangement and paid once, and should be
 * told about all of it in one place. This finds the rest of the arrangement
 * from the booking that was paid.
 *
 * There is no group column, and adding one needs a database change. What links
 * them is already written down:
 *   a return          returnOfId points at the outbound
 *   an extra ride     its note says it was booked together with the first
 * Anything this cannot account for returns null, and the caller sends the single
 * confirmation it always sent. Telling a customer about some of their journeys
 * is worse than telling them about one and saying nothing wrong.
 */

import { prisma } from "@/lib/prisma";
import { calendarLinks } from "@/lib/calendar";
import { parseBookingMeta } from "@/lib/booking-meta";
import { EXTRAS_CATALOG } from "@/types";
import type { JourneyInput } from "@/lib/resend";

/** The note written on an extra ride so the first booking can find it again. */
export function togetherNote(firstCode: string, own?: string | null): string {
  const tag = `Booked together with ${firstCode}.`;
  return own?.trim() ? `${own.trim()} ${tag}` : tag;
}

/** The marker the lookup searches for. */
export function togetherMarker(firstCode: string): string {
  return `Booked together with ${firstCode}.`;
}

/** Extras a customer chose, as a list the email can show. Not VAT, which is not an item. */
export function customerExtras(specialRequests: string | null | undefined): NonNullable<JourneyInput["extras"]> {
  return parseBookingMeta(specialRequests).extras
    .filter((e) => e.id !== "invoice_vat")
    .map((e) => {
      const known = EXTRAS_CATALOG.find((c) => c.id === e.id);
      return { label: known?.label ?? e.label, quantity: e.quantity, price: e.price };
    });
}

type Row = {
  id: string;
  confirmationCode: string;
  pickupAddress: string;
  dropoffAddress: string | null;
  pickupDatetime: Date;
  vehicleClass: string;
  passengers: number;
  totalAmount: number;
  specialRequests: string | null;
  balanceAmount: number | null;
};

const SELECT = {
  id: true, confirmationCode: true, pickupAddress: true, dropoffAddress: true,
  pickupDatetime: true, vehicleClass: true, passengers: true, totalAmount: true,
  specialRequests: true, balanceAmount: true,
} as const;

function input(role: JourneyInput["role"], b: Row, fare: number, extras?: JourneyInput["extras"]): JourneyInput {
  return {
    role,
    confirmationCode: b.confirmationCode,
    pickupAddress: b.pickupAddress,
    dropoffAddress: b.dropoffAddress ?? "",
    at: b.pickupDatetime,
    vehicleClass: b.vehicleClass,
    passengers: b.passengers,
    fare,
    extras,
    calendar: calendarLinks({
      id: b.id,
      confirmationCode: b.confirmationCode,
      pickupAddress: b.pickupAddress,
      dropoffAddress: b.dropoffAddress ?? undefined,
      pickupDatetime: b.pickupDatetime,
    }),
  };
}

export interface JourneyGroup {
  journeys: JourneyInput[];
  /** Everything charged for all of them. */
  total: number;
  /** The balance the chauffeurs collect on the day, across every journey. */
  balance: number;
}

/**
 * The journeys around a paid booking, or null when it travels alone, or when
 * the arrangement includes more than one car and so cannot be listed truthfully.
 */
export async function loadJourneyGroup(first: Row): Promise<JourneyGroup | null> {
  // More than one car is its own arrangement, with a share of the party and of
  // the money on each row. Listing it from these rows would misstate both.
  if (/Vehicle \d+ of \d+/.test(first.specialRequests ?? "")) return null;

  const [back, together] = await Promise.all([
    prisma.booking.findMany({
      where: { returnOfId: first.id, isDeleted: false, status: { notIn: ["CANCELLED", "REFUNDED"] } },
      select: SELECT,
    }),
    prisma.booking.findMany({
      where: {
        isDeleted: false,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
        specialRequests: { contains: togetherMarker(first.confirmationCode) },
      },
      select: SELECT,
    }),
  ]);

  const rest = [...back, ...together];
  if (rest.length === 0) return null;
  if (rest.some((b) => /Vehicle \d+ of \d+/.test(b.specialRequests ?? ""))) return null;

  const extras = customerExtras(first.specialRequests);
  const extrasCost = extras.reduce((s, e) => s + e.price * e.quantity, 0);

  const all = [first, ...rest];
  return {
    journeys: [
      // The extras are charged once for the trip and live on the outbound row,
      // so the fare is what is left of its total.
      input("outbound", first, Math.max(0, Math.round((first.totalAmount - extrasCost) * 100) / 100), extras),
      ...back.map((b) => input("return", b, b.totalAmount)),
      ...together.map((b) => input("extra", b, b.totalAmount)),
    ],
    total: Math.round(all.reduce((s, b) => s + b.totalAmount, 0) * 100) / 100,
    balance: Math.round(all.reduce((s, b) => s + (b.balanceAmount ?? 0), 0) * 100) / 100,
  };
}


const VEHICLE_SPLIT = /Vehicle \d+ of \d+/;

/**
 * The other bookings paid for by the same payment as `first`: the journey home of a round trip, and rides booked together with it.
 *
 * A return is a booking row of its own (its own chauffeur, its own place on the dispatch board) but the customer pays once, at one
 * checkout, which is attached to the outbound row. So when the outbound is paid, these have to be paid with it. Nothing did that for
 * a long time: the card was charged for both journeys, the outbound was confirmed, and the return stayed "unpaid" and unconfirmed, with
 * no chauffeur ever assigned to it.
 *
 * A split across several cars is a different arrangement with its own money on each row, so it is left alone (empty list).
 */
export async function companionIds(first: { id: string; confirmationCode: string; specialRequests: string | null }): Promise<string[]> {
  if (VEHICLE_SPLIT.test(first.specialRequests ?? "")) return [];
  const rows = await prisma.booking.findMany({
    where: {
      isDeleted: false,
      status: { notIn: ["CANCELLED", "REFUNDED"] },
      OR: [{ returnOfId: first.id }, { specialRequests: { contains: togetherMarker(first.confirmationCode) } }],
    },
    select: { id: true, specialRequests: true },
  });
  if (rows.some((r) => VEHICLE_SPLIT.test(r.specialRequests ?? ""))) return [];
  return rows.map((r) => r.id);
}

/**
 * Makes the companion journeys match the payment on `first`. Paid: they become paid, and confirmed if they were still pending (a
 * journey that already has a chauffeur keeps its status). Unpaid (the office undoing a payment): they go back to unpaid and nothing
 * else changes. Returns how many rows were touched. It never throws: the payment it follows has already happened, and a failure here
 * must not turn a taken payment into an error for the customer, so it logs and the office can still fix a leg by hand.
 */
export async function settleCompanions(
  first: { id: string; confirmationCode: string; specialRequests: string | null },
  change: { paid: true; transactionId?: string | null; paymentMethod?: string | null; markedBy?: string | null } | { paid: false },
): Promise<number> {
  try {
    const ids = await companionIds(first);
    if (ids.length === 0) return 0;
    if (change.paid) {
      const paidNow = await prisma.booking.updateMany({
        where: { id: { in: ids }, paymentStatus: { not: "PAID" } },
        data: {
          paymentStatus: "PAID",
          paidAt: new Date(),
          ...(change.transactionId ? { stripePaymentId: change.transactionId } : {}),
          ...(change.paymentMethod ? { paymentMethod: change.paymentMethod as never } : {}),
          ...(change.markedBy ? { paidMarkedBy: change.markedBy } : {}),
        },
      });
      await prisma.booking.updateMany({ where: { id: { in: ids }, status: "PENDING" }, data: { status: "CONFIRMED" } });
      return paidNow.count;
    }
    const undone = await prisma.booking.updateMany({
      where: { id: { in: ids }, paymentStatus: "PAID" },
      data: { paymentStatus: "PENDING", paidAt: null, paidMarkedBy: null },
    });
    return undone.count;
  } catch (e) {
    console.error("[journeys] could not settle the companion journeys of", first.confirmationCode, e);
    return 0;
  }
}

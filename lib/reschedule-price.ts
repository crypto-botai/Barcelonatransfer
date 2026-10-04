import { NIGHT_SURCHARGE_RATE, LAST_MINUTE_SURCHARGE_RATE, LAST_MINUTE_HOURS } from "@/lib/pricing";
import { isNightTime } from "@/lib/utils";
import { weekendOf, weekendPercent } from "@/lib/weekend-pricing";

/**
 * What moving a booking does to its price.
 *
 * For an hourly or day hire, two parts of the fare depend on when the car is
 * wanted rather than where it goes: a night pickup adds 20%, and a pickup
 * inside the last-minute window adds 15%.
 *
 * A TRANSFER carries neither. The price table is fixed and the quote API
 * returns nightSurcharge: 0 on every transfer whatever the hour. An earlier
 * version of this file applied the uplift to all bookings alike, which meant
 * moving a fixed-price airport run to 23:00 added 20% the booking engine would
 * never have charged. Only the types the engine actually surcharges are
 * surcharged here.
 *
 * What a transfer does depend on is the weekend. A pickup between Friday noon
 * and Monday noon costs that weekend's percentage (lib/weekend-pricing.ts), so
 * moving a booking into a weekend, out of one, or to a weekend with a different
 * percentage moves its fare. That is worked out below from the fare the booking
 * already carries, so a price the office adjusted by hand is moved, not undone.
 *
 * Only these two are recomputed. Distance, the route table price and the
 * vehicle are untouched by a change of time, so the base fare carries over
 * and the journey is not requoted from scratch.
 *
 * `isNightTime` is deliberately the same function the booking engine uses,
 * so a rescheduled booking is priced the way it would have been priced had
 * it been made for the new time in the first place. (That function reads the
 * server's clock rather than Barcelona's, which is worth fixing — but fixing
 * it here alone would make reschedules disagree with new bookings.)
 */

/**
 * The booking types whose fare moves with the hour.
 *
 * Kept as a list rather than "anything that is not a TRANSFER" so a new
 * booking type has to be added deliberately rather than inheriting a
 * surcharge nobody decided on.
 */
const SURCHARGED_TYPES = new Set(["HOURLY", "DAY_HIRE"]);

/** True when this booking's fare depends on the time of day at all. */
export function pricesByTimeOfDay(bookingType: string | null | undefined): boolean {
  return SURCHARGED_TYPES.has((bookingType ?? "").toUpperCase());
}

export interface TimeSurcharges {
  night: number;
  lastMinute: number;
  total: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The time-dependent part of a fare, for a given base and pickup instant. */
export function timeSurcharges(
  baseFare: number,
  pickupDatetime: Date,
  now: number = Date.now(),
): TimeSurcharges {
  const night = isNightTime(pickupDatetime) ? round(baseFare * NIGHT_SURCHARGE_RATE) : 0;

  const hoursUntil = (pickupDatetime.getTime() - now) / 3_600_000;
  const lastMinute = hoursUntil < LAST_MINUTE_HOURS
    ? round(baseFare * LAST_MINUTE_SURCHARGE_RATE)
    : 0;

  return { night, lastMinute, total: round(night + lastMinute) };
}

/**
 * The first moment a booking was priced with the weekend rule. A booking taken
 * before it was priced without, and keeps that price until it is moved.
 */
export const WEEKEND_PRICING_STARTS = new Date("2026-10-04T17:15:00Z");

export interface WeekendShift {
  /** The percentage the booking's current fare carries: 0 on a weekday, or if it predates the rule. */
  oldPercent: number;
  /** The percentage the new time carries. */
  newPercent: number;
  /** Whether the weekend part of the fare changes at all. */
  changed: boolean;
  /** The fare with the new weekend percentage, when it changed. */
  newBase: number | null;
}

/** What moving this booking does to the weekend part of its fare. */
export function weekendShift(
  booking: { baseFare: number; pickupDatetime: Date; createdAt?: Date | null },
  newPickup: Date,
): WeekendShift {
  const carriesRule = !booking.createdAt || booking.createdAt >= WEEKEND_PRICING_STARTS;
  const oldFriday = weekendOf(booking.pickupDatetime);
  const newFriday = weekendOf(newPickup);
  const oldPercent = carriesRule && oldFriday ? weekendPercent(oldFriday) : 0;
  const newPercent = newFriday ? weekendPercent(newFriday) : 0;
  if (oldPercent === newPercent) return { oldPercent, newPercent, changed: false, newBase: null };

  // Take the old percentage back off, then put the new one on. Table fares are whole euros,
  // so the round trip returns the same fare.
  const weekday = oldPercent ? Math.round(booking.baseFare / (1 + oldPercent / 100)) : booking.baseFare;
  return { oldPercent, newPercent, changed: true, newBase: Math.round(weekday * (1 + newPercent / 100)) };
}

export interface Repriced {
  /** The fare before any time-dependent surcharge. */
  baseFare: number;
  /** What the weekend does to this move. */
  weekend: WeekendShift;
  oldSurcharges: TimeSurcharges;
  newSurcharges: TimeSurcharges;
  oldTotal: number;
  newTotal: number;
  /** Positive when the new slot costs more, negative when it costs less. */
  difference: number;
}

/**
 * Reprices a booking for a new pickup time.
 *
 * `baseFare` is the fare with the old time-dependent surcharges already
 * taken back off, so the same journey is never charged two night uplifts.
 */
export function repriceForNewTime(
  booking: {
    baseFare: number; totalAmount: number; pickupDatetime: Date;
    /** From the booking's metadata. A transfer, or null, never takes the time-of-day surcharges. */
    bookingType?: string | null;
    /** When it was booked: a booking taken before the weekend rule keeps its old price until moved. */
    createdAt?: Date | null;
  },
  newPickup: Date,
  now: number = Date.now(),
): Repriced {
  const base = booking.baseFare;
  const nil: TimeSurcharges = { night: 0, lastMinute: 0, total: 0 };

  // A fixed-price transfer costs the same at 02:00 as at noon, so moving it
  // moves nothing. Both sides are zero rather than the difference being
  // zero, so the breakdown the office is shown says "no surcharge" instead
  // of "two surcharges that happen to cancel".
  const surcharged = pricesByTimeOfDay(booking.bookingType);
  const oldSurcharges = surcharged ? timeSurcharges(base, booking.pickupDatetime, now) : nil;
  const newSurcharges = surcharged ? timeSurcharges(base, newPickup, now) : nil;

  // The old total is what is actually on the booking, not a recomputation of
  // it: a fare the office adjusted by hand must not be quietly undone by a
  // change of time. Only the movement in surcharge is applied to it.
  const oldTotal = round(booking.totalAmount);
  // Hourly hire is priced by the hour and has no weekend rule; a transfer does.
  const weekend: WeekendShift = surcharged
    ? { oldPercent: 0, newPercent: 0, changed: false, newBase: null }
    : weekendShift({ baseFare: base, pickupDatetime: booking.pickupDatetime, createdAt: booking.createdAt }, newPickup);
  const weekendDifference = weekend.changed && weekend.newBase != null ? weekend.newBase - base : 0;

  const newTotal = round(oldTotal + (newSurcharges.total - oldSurcharges.total) + weekendDifference);

  return {
    baseFare: weekend.changed && weekend.newBase != null ? weekend.newBase : base,
    weekend,
    oldSurcharges,
    newSurcharges,
    oldTotal,
    newTotal,
    difference: round(newTotal - oldTotal),
  };
}

/**
 * How a repricing lands on a part-paid booking.
 *
 * The deposit has already been taken online and cannot change, so the whole
 * difference falls on the balance the chauffeur collects. A balance can never
 * go below zero — if the new price is lower than what was already paid, the
 * balance is nil and the surplus is the office's to refund, deliberately not
 * netted off silently.
 */
export function applyToBalance(
  booking: { depositAmount: number | null; balanceAmount: number | null },
  difference: number,
): { balanceAmount: number | null; refundDue: number } {
  if (booking.balanceAmount == null) return { balanceAmount: null, refundDue: 0 };

  const raw = round(booking.balanceAmount + difference);
  if (raw >= 0) return { balanceAmount: raw, refundDue: 0 };
  return { balanceAmount: 0, refundDue: round(-raw) };
}

import { NIGHT_SURCHARGE_RATE, LAST_MINUTE_SURCHARGE_RATE, LAST_MINUTE_HOURS } from "@/lib/pricing";
import { isNightTime } from "@/lib/utils";

/**
 * What moving a booking does to its price.
 *
 * Two parts of the fare depend on when the car is wanted rather than where it
 * goes: a night pickup adds 20%, and a pickup inside the last-minute window
 * adds 15%. Moving a booking from noon to 02:00 therefore changes what it
 * should cost, and the office had no way to see that — the date was simply
 * whatever was typed, and the total never moved.
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

export interface Repriced {
  /** The fare before any time-dependent surcharge. */
  baseFare: number;
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
  booking: { baseFare: number; totalAmount: number; pickupDatetime: Date },
  newPickup: Date,
  now: number = Date.now(),
): Repriced {
  const base = booking.baseFare;
  const oldSurcharges = timeSurcharges(base, booking.pickupDatetime, now);
  const newSurcharges = timeSurcharges(base, newPickup, now);

  // The old total is what is actually on the booking, not a recomputation of
  // it: a fare the office adjusted by hand must not be quietly undone by a
  // change of time. Only the movement in surcharge is applied to it.
  const oldTotal = round(booking.totalAmount);
  const newTotal = round(oldTotal + (newSurcharges.total - oldSurcharges.total));

  return {
    baseFare: base,
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

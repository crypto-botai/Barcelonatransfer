/**
 * What may be sent to anyone by WhatsApp on its own, and how often.
 *
 * WhatsApp is the one channel where an unwanted message costs more than money:
 * too many and customers block the number, which damages its quality rating
 * and, past a point, Meta restricts it. So the rules live in one place that
 * every sender passes through, rather than being a habit of each caller.
 *
 * Pure: no database, no network. The service looks up the facts and asks this
 * what to do, which keeps every rule testable on its own.
 *
 * What a customer can receive automatically:
 *   1. the booking confirmation, once, and only for a paid booking
 *   2. the driver's name, once per driver
 *   3. a flight delay, only when the landing time really moved
 *   4. one heads-up about an hour before pickup, never close behind another message
 * What a driver can receive: a flight delay on their own job.
 * Everything else a customer is told, by email or in their account, not here.
 * Replies to a customer who wrote to us are the office's own and are not covered.
 */

export const CUSTOMER_EVENTS = ["BOOKING_CONFIRMED", "DRIVER_ASSIGNED", "FLIGHT_DELAYED", "PICKUP_SOON"] as const;
export const DRIVER_EVENTS = ["FLIGHT_DELAYED_DRIVER"] as const;

/** Most WhatsApp messages of one kind a booking can ever trigger. */
export const MAX_PER_BOOKING: Record<string, number> = {
  BOOKING_CONFIRMED: 1,
  DRIVER_ASSIGNED: 2, // the driver can change once
  FLIGHT_DELAYED: 2, // a delay can grow once; more than that is the office's call
  PICKUP_SOON: 1,
  FLIGHT_DELAYED_DRIVER: 3,
};

/** A heads-up is held back when another message went to the same customer this recently. */
export const QUIET_WINDOW_MS = 2 * 3600_000;

export interface AutoMessageSettings {
  /** Also message customers who pay the chauffeur in cash. Off: only paid bookings. */
  cashBookings: boolean;
  /** The single message about an hour before pickup. */
  headsUp: boolean;
  /** Tell the customer when their flight is delayed. */
  flightAlerts: boolean;
  /** Tell the driver when their passenger's flight is delayed. */
  driverFlightAlerts: boolean;
}

export const DEFAULT_AUTO_MESSAGES: AutoMessageSettings = {
  cashBookings: false,
  headsUp: true,
  flightAlerts: true,
  driverFlightAlerts: true,
};

export interface BookingFacts {
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  pickupDatetime: Date;
}

export type Verdict = { send: true } | { send: false; reason: string };

export const isCustomerEvent = (e: string) => (CUSTOMER_EVENTS as readonly string[]).includes(e);
export const isDriverEvent = (e: string) => (DRIVER_EVENTS as readonly string[]).includes(e);

/**
 * What makes two messages "the same one": telling a customer the same driver
 * twice, or the same new landing time twice, is repetition and not news.
 */
export function sameness(event: string, vars: Record<string, unknown> | undefined, row: Record<string, unknown> | null | undefined): boolean {
  if (!vars || !row) return false;
  const key = event === "DRIVER_ASSIGNED" ? "driver" : event === "FLIGHT_DELAYED" ? "when" : event === "FLIGHT_DELAYED_DRIVER" ? "recipient" : null;
  if (!key) return false;
  const mine = vars[key];
  return mine !== undefined && mine !== null && String(mine) === String(row[key] ?? "");
}

export function decideWhatsApp(a: {
  event: string;
  booking: BookingFacts | null;
  /** Messages of this kind already sent for this booking. */
  sentBefore: number;
  /** Whether one of those was the same message again (same driver, same new time). */
  repeated: boolean;
  /** When a WhatsApp last went to this customer for this booking, from any of the four events. */
  lastCustomerSendAt: Date | null;
  now: Date;
  settings: AutoMessageSettings;
}): Verdict {
  const { event, booking, sentBefore, repeated, lastCustomerSendAt, now, settings } = a;
  const no = (reason: string): Verdict => ({ send: false, reason });

  if (!isCustomerEvent(event) && !isDriverEvent(event)) return no("not one of the automatic WhatsApp messages");

  const cap = MAX_PER_BOOKING[event] ?? 1;
  if (repeated) return no("this exact message was already sent");
  if (sentBefore >= cap) return no(`already sent ${sentBefore} of ${cap} for this booking`);

  if (isDriverEvent(event)) {
    return settings.driverFlightAlerts ? { send: true } : no("driver flight alerts are switched off");
  }

  // From here on it is a customer message, which needs the booking to judge.
  if (!booking) return { send: true };

  if (booking.status === "CANCELLED" || booking.status === "REFUNDED") return no("the booking is cancelled");

  const paid = booking.paymentStatus === "PAID";
  const cashOk = settings.cashBookings && booking.paymentMethod === "CASH";
  if (!paid && !cashOk) return no("the booking is not paid");

  if (event === "FLIGHT_DELAYED" && !settings.flightAlerts) return no("flight alerts are switched off");

  if (event === "PICKUP_SOON") {
    if (!settings.headsUp) return no("the heads-up message is switched off");
    if (booking.pickupDatetime.getTime() <= now.getTime()) return no("the pickup time has passed");
    if (lastCustomerSendAt && now.getTime() - lastCustomerSendAt.getTime() < QUIET_WINDOW_MS) {
      return no("another WhatsApp went to this customer in the last 2 hours");
    }
  }
  if (event === "FLIGHT_DELAYED" && booking.pickupDatetime.getTime() <= now.getTime()) return no("the pickup time has passed");

  return { send: true };
}

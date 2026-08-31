/**
 * Who can be given a booking.
 *
 * Every surface that offers a driver for assignment was deciding this for
 * itself, and both got it wrong in the same direction — by testing for the
 * statuses a driver happens to be sitting in rather than for whether they are
 * on the books.
 *
 * A driver is created APPROVED and leaves that status the first time they tap
 * "Go Online", after which they are ONLINE, OFFLINE or ON_RIDE and never
 * APPROVED again. The admin booking drawer listed only APPROVED drivers, so a
 * roster of eight showed exactly one: the single driver who had never logged
 * in. The dispatch board allowed ONLINE or APPROVED, which still hid anyone
 * off duty or mid-ride.
 *
 * The real question is the opposite one: a driver can be given work unless they
 * are waiting to be vetted or have been barred.
 */
import type { DriverStatus } from "@prisma/client";

/** Barred from assignment: not yet vetted, or suspended. */
const UNASSIGNABLE: ReadonlySet<string> = new Set<DriverStatus>([
  "PENDING_APPROVAL",
  "SUSPENDED",
]);

/**
 * True when a driver is on the books and may be assigned a booking.
 *
 * OFFLINE and ON_RIDE both qualify. An admin scheduling next Tuesday's airport
 * run does not care that the driver is off duty right now or currently on
 * another job, and hiding them makes the booking impossible to assign at all.
 * Surface the status in the UI instead of removing the person from the list.
 */
export function isAssignableDriver(status: string | null | undefined): boolean {
  if (!status) return false;
  return !UNASSIGNABLE.has(status);
}

/** Short label for a driver's current availability, for use beside their name. */
export function driverAvailabilityLabel(status: string | null | undefined): string {
  switch (status) {
    case "ONLINE":
      return "on duty";
    case "OFFLINE":
      return "off duty";
    case "ON_RIDE":
      return "on a ride";
    case "APPROVED":
      return "not yet online";
    default:
      return String(status ?? "unknown").toLowerCase();
  }
}

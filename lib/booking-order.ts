/**
 * The order a list of bookings belongs in.
 *
 * The admin list was ordered by createdAt descending — the order the office
 * happened to take the bookings, which tells nobody what is happening next.
 * A transfer at 09:00 tomorrow and one at 23:00 tonight sat wherever they
 * were entered, so the next job to dispatch was never at the top.
 *
 * What a dispatcher wants is the soonest job first. What they want after
 * that is the most recent history, not the oldest — a ride from 2024 has no
 * business above one from this morning. So the list runs forwards through
 * what is still to come, then backwards through what is done.
 */

export interface HasPickup {
  pickupDatetime: string | Date;
}

const ms = (v: string | Date): number => {
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  // A row with an unreadable date sorts last rather than throwing the whole
  // list into an arbitrary order.
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
};

/**
 * Compares two bookings for a dispatch-style list.
 *
 * Upcoming before past; upcoming ascending (soonest first); past descending
 * (most recent first). `now` is a parameter so the boundary is testable and
 * so a server and a browser rendering the same list agree on it.
 */
export function byPickupUpcomingFirst(now: number) {
  return (a: HasPickup, b: HasPickup): number => {
    const ta = ms(a.pickupDatetime);
    const tb = ms(b.pickupDatetime);

    const aUpcoming = ta >= now;
    const bUpcoming = tb >= now;

    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    // Two still to come: the nearer one first. Two already gone: the later
    // one first, so the list reads outwards from now in both directions.
    return aUpcoming ? ta - tb : tb - ta;
  };
}

/** The same order, applied to a copy rather than in place. */
export function sortBookingsForList<T extends HasPickup>(
  rows: readonly T[],
  now: number = Date.now(),
): T[] {
  return [...rows].sort(byPickupUpcomingFirst(now));
}

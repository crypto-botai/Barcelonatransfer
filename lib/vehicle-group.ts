/**
 * Several cars on one journey.
 *
 * A group of twenty-four is one journey and four vans, and four vans is four
 * chauffeurs, four job sheets and four rows on the dispatch board. There is no
 * way to express that as one booking that anybody can be assigned to drive, so
 * each vehicle becomes a booking of its own and these two functions are what
 * make the set legible: who is in which car, and which car of how many it is.
 */

/**
 * One vehicle's share of the party.
 *
 * A driver needs to know how many people are in their car, not how many are
 * on the trip: twenty-four across four vans is six each, and a job sheet
 * saying twenty-four would have them waiting for eighteen people who are in
 * somebody else's van.
 *
 * An uneven split puts the spare passengers in the first cars. Nobody gets
 * zero, because a booking for no passengers is not a job.
 */
export function seatShare(total: number, vehicles: number, index: number): number {
  if (vehicles <= 1) return total;
  const base = Math.floor(total / vehicles);
  const spare = total % vehicles;
  return Math.max(1, base + (index < spare ? 1 : 0));
}

/**
 * The chauffeur's note, saying which car of how many this is.
 *
 * Written into specialRequests rather than a column of its own, because that
 * is what reaches the driver's job sheet and the assignment email, and
 * because a group then needs no schema change to be legible: the first
 * vehicle's reference is the group's reference.
 */
export function vehicleNote(
  own: string | undefined | null,
  index: number,
  count: number,
  groupCode: string | null,
): string | undefined {
  if (count <= 1) return own ?? undefined;
  const tag = `Vehicle ${index + 1} of ${count}${groupCode ? ` for group booking ${groupCode}` : ""}.`;
  return own?.trim() ? `${own.trim()} ${tag}` : tag;
}

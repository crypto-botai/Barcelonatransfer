/**
 * Editing where a booking goes, as opposed to when.
 *
 * A change of time and a change of address are priced on deliberately
 * different bases, and conflating them would misprice one or the other:
 *
 *   Time only  — the agreed fare carries over and only the time-dependent
 *                surcharge moves (lib/reschedule-price). The journey is the
 *                same journey, so re-quoting it would silently reprice a
 *                booking taken weeks ago at whatever the table says today.
 *
 *   Address    — a different journey, so it is quoted afresh through the
 *                same getQuote the booking engine uses. Today's table price
 *                is the right price for a route nobody has agreed a fare for
 *                yet, and the office sees the old and new totals side by
 *                side before confirming.
 *
 * This module holds the part of that decision that can be tested without a
 * database or a routing provider: whether an endpoint actually moved.
 */

export interface Endpoint {
  address: string;
  lat: number;
  lng: number;
}

/**
 * How far two coordinates may differ and still be "the same place".
 *
 * Geocoders return slightly different coordinates for the same address
 * depending on the provider and the day, and the office re-picking an
 * unchanged suggestion from the dropdown must not requote the booking.
 * Roughly 11 metres at this latitude — tighter than any two distinct street
 * addresses, looser than provider jitter.
 */
export const SAME_PLACE_DEGREES = 0.0001;

/** Whitespace and case are not a change of destination. */
function normaliseAddress(a: string): string {
  return a.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * True when the proposed endpoint is meaningfully different from the stored
 * one. A null proposal means the office did not touch that end.
 */
export function endpointMoved(
  current: { address: string; lat: number; lng: number },
  proposed: Endpoint | null | undefined,
): boolean {
  if (!proposed) return false;
  if (normaliseAddress(current.address) !== normaliseAddress(proposed.address)) return true;
  return (
    Math.abs(current.lat - proposed.lat) > SAME_PLACE_DEGREES ||
    Math.abs(current.lng - proposed.lng) > SAME_PLACE_DEGREES
  );
}

/**
 * The endpoint to price and store: the proposal when it really moved,
 * otherwise what is already on the booking.
 */
export function effectiveEndpoint(
  current: { address: string; lat: number; lng: number },
  proposed: Endpoint | null | undefined,
): Endpoint {
  return endpointMoved(current, proposed)
    ? { address: proposed!.address.trim(), lat: proposed!.lat, lng: proposed!.lng }
    : { address: current.address, lat: current.lat, lng: current.lng };
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * What a requoted journey does to the fare.
 *
 * `oldTotal` is what is actually on the booking rather than a recomputation
 * of it, for the same reason a reschedule uses the stored total: a fare the
 * office adjusted by hand must not be quietly undone by an address change.
 */
export function differenceFromQuote(oldTotal: number, quotedTotal: number): {
  oldTotal: number;
  newTotal: number;
  difference: number;
} {
  const o = round(oldTotal);
  const n = round(quotedTotal);
  return { oldTotal: o, newTotal: n, difference: round(n - o) };
}

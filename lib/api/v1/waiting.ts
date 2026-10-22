import { isAirportLocation } from "@/lib/utils";
import { S_CLASS_WAIT_PER_HOUR } from "@/lib/s-class-pricing";

/**
 * Waiting time at the pickup, for the passenger's app and the driver's app alike.
 *
 * The fare includes 15 minutes of waiting at a city address (counted from the chauffeur's arrival, or the booked time if they
 * are early) and 60 minutes at the airport (counted from the passenger's landing). After that waiting is charged at 25 euros
 * per 30 minutes or part of it, the same terms the website shows. The charge here is information for both people; it is added
 * to the bill by the office, not taken from a card by this code.
 */

export const WAIT_BLOCK_MINUTES = 30;
export const WAIT_BLOCK_PRICE = 25;

/** The price of one waiting block. 25 euros for every car except the Mercedes-Maybach S 580, which is 160 an hour (80 a block). */
export function waitBlockPriceFor(vehicleClass?: string | null): number {
  return vehicleClass === "FIRST_CLASS" ? (S_CLASS_WAIT_PER_HOUR * WAIT_BLOCK_MINUTES) / 60 : WAIT_BLOCK_PRICE;
}

export function freeWaitFor(airport: boolean): number {
  return airport ? 60 : 15;
}

/** Airport (or cruise terminal) pickups, by coordinates or, for hand-typed office bookings, by the words in the address. */
export function isAirportPickup(b: { pickupLat?: number | null; pickupLng?: number | null; pickupAddress?: string | null }): boolean {
  const byCoords = typeof b.pickupLat === "number" && typeof b.pickupLng === "number" && (b.pickupLat !== 0 || b.pickupLng !== 0) ? isAirportLocation(b.pickupLat, b.pickupLng) : false;
  const byText = /airport|aeropuerto|aeroport|el prat|\bbcn\b|\bt1\b|\bt2\b|terminal/i.test(b.pickupAddress ?? "");
  return byCoords || byText;
}

export interface WaitingInput {
  airport: boolean;
  /** When the chauffeur reported arriving at the pickup. */
  arrivedAt: Date | null;
  /** When the passenger got into the car; ends the wait. */
  onBoardAt: Date | null;
  /** When the flight landed, when known (the passenger tapped "I've landed"). Airport pickups only. */
  landedAt: Date | null;
  pickupAt: Date;
  now: Date;
  /** The booked car's class, for the block price. Omitted means the standard 25 euros. */
  vehicleClass?: string | null;
}

export interface Waiting {
  airport: boolean;
  freeMinutes: number;
  /** True while the passenger has not yet boarded. */
  active: boolean;
  startedAt: string;
  freeEndsAt: string;
  minutesWaited: number;
  freeMinutesLeft: number;
  paidMinutes: number;
  charge: number;
  currency: "EUR";
  blockMinutes: number;
  blockPrice: number;
}

/** Null until the chauffeur has arrived. */
export function waitingState(i: WaitingInput): Waiting | null {
  if (!i.arrivedAt) return null;
  const free = freeWaitFor(i.airport);
  const startMs = i.airport ? (i.landedAt ?? i.pickupAt).getTime() : Math.max(i.arrivedAt.getTime(), i.pickupAt.getTime());
  const endMs = (i.onBoardAt ?? i.now).getTime();
  const waited = Math.max(0, Math.floor((endMs - startMs) / 60_000));
  const paid = Math.max(0, waited - free);
  const blocks = Math.ceil(paid / WAIT_BLOCK_MINUTES);
  const blockPrice = waitBlockPriceFor(i.vehicleClass);
  return {
    airport: i.airport,
    freeMinutes: free,
    active: i.onBoardAt === null,
    startedAt: new Date(startMs).toISOString(),
    freeEndsAt: new Date(startMs + free * 60_000).toISOString(),
    minutesWaited: waited,
    freeMinutesLeft: Math.max(0, free - waited),
    paidMinutes: paid,
    charge: blocks * blockPrice,
    currency: "EUR",
    blockMinutes: WAIT_BLOCK_MINUTES,
    blockPrice,
  };
}

export function eventTime(events: ReadonlyArray<{ stage: string; createdAt: Date }>, stage: string): Date | null {
  const hit = events.find((e) => e.stage === stage);
  return hit ? hit.createdAt : null;
}

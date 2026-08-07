/**
 * Flight status abstraction.
 *
 * The booking flow only needs one question answered — "when will this aircraft
 * actually be on the ground at BCN?" — so the interface is deliberately narrow.
 * Swapping AeroDataBox for AviationStack, FlightAware or a direct AENA feed
 * means writing one new implementation of FlightProvider; nothing that consumes
 * flight data changes.
 */

export type FlightState =
  | "scheduled"
  | "en_route"
  | "landed"
  | "delayed"
  | "cancelled"
  | "diverted"
  | "unknown";

export interface FlightStatus {
  /** Normalised IATA designator, e.g. "IB3456". */
  flightNumber: string;
  state: FlightState;
  /** Scheduled arrival, UTC. Null when the provider does not report one. */
  scheduledArrival: Date | null;
  /**
   * Best current estimate of arrival — revised or actual time when the provider
   * has one, otherwise null. Never silently falls back to the scheduled time:
   * "we don't know yet" and "it's on time" are different answers and the
   * customer-facing copy depends on telling them apart.
   */
  estimatedArrival: Date | null;
  /** Positive minutes late. Null when it cannot be computed. */
  delayMinutes: number | null;
  arrivalAirport: string | null;
  arrivalTerminal: string | null;
  departureAirport: string | null;
  airline: string | null;
  /** Which provider answered, for the audit trail. */
  source: string;
}

export interface FlightProvider {
  readonly name: string;
  /** True when the provider has the credentials it needs to be called. */
  isConfigured(): boolean;
  /**
   * Returns null when the flight genuinely cannot be found — callers must treat
   * that as "unknown" and never substitute a guess.
   * Throws only on transport or auth failures, which are the caller's cue to
   * fall back rather than to display anything.
   */
  lookup(flightNumber: string, date: Date): Promise<FlightStatus | null>;
}

/** "ib 3456" / "IB-3456" → "IB3456". Returns null if it isn't a plausible designator. */
export function normaliseFlightNumber(input: string): string | null {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // IATA airline code: 2 alphanumeric, at least one of them a letter (LH, U2,
  // 9W). ICAO: 3 letters (BAW). Either way followed by 1-4 digits.
  //
  // The leading lookahead is what rejects an all-numeric string: without it
  // "123456" parses as airline "12" + flight "3456" and sails through as a
  // valid designator.
  return /^(?=.*[A-Z])(?:[A-Z0-9]{2}|[A-Z]{3})\d{1,4}$/.test(clean) ? clean : null;
}

/**
 * A delay is only worth telling the customer about once it is material. Below
 * this the driver's 60 minutes of free waiting absorbs it, so messaging the
 * customer would be noise.
 */
export const MATERIAL_DELAY_MINUTES = 20;

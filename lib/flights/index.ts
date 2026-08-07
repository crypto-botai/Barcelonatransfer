/**
 * Flight provider registry.
 *
 * Providers are tried in order and the first configured one wins, so adding a
 * paid fallback later is one array entry. When none is configured, callers get
 * null and must degrade to "flight tracking unavailable" — never to a guess.
 */

import { AeroDataBoxProvider } from "./aerodatabox";
import {
  MATERIAL_DELAY_MINUTES,
  normaliseFlightNumber,
  type FlightProvider,
  type FlightStatus,
} from "./types";

export * from "./types";

const PROVIDERS: FlightProvider[] = [new AeroDataBoxProvider()];

export function getFlightProvider(): FlightProvider | null {
  return PROVIDERS.find((p) => p.isConfigured()) ?? null;
}

export function isFlightTrackingEnabled(): boolean {
  return getFlightProvider() !== null;
}

export type LookupOutcome =
  | { ok: true;  status: FlightStatus }
  | { ok: false; reason: "not_configured" | "invalid_number" | "not_found" | "provider_error"; detail?: string };

/**
 * Safe wrapper used by every caller. Distinguishes the four ways a lookup can
 * come back empty, because the UI copy differs for each — "we don't track
 * flights yet" must not be shown as "your flight wasn't found".
 */
export async function lookupFlight(flightNumber: string, date: Date): Promise<LookupOutcome> {
  const provider = getFlightProvider();
  if (!provider) return { ok: false, reason: "not_configured" };

  if (!normaliseFlightNumber(flightNumber)) return { ok: false, reason: "invalid_number" };

  try {
    const status = await provider.lookup(flightNumber, date);
    return status
      ? { ok: true, status }
      : { ok: false, reason: "not_found" };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[flights] lookup failed:", detail);
    return { ok: false, reason: "provider_error", detail };
  }
}

/** True when this status is worth interrupting the customer about. */
export function isMaterialDelay(status: FlightStatus): boolean {
  if (status.state === "cancelled" || status.state === "diverted") return true;
  return status.delayMinutes !== null && status.delayMinutes >= MATERIAL_DELAY_MINUTES;
}

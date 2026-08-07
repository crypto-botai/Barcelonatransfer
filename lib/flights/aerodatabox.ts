/**
 * AeroDataBox via RapidAPI.
 *
 * Chosen because its free tier (~700 calls/month) comfortably covers this
 * volume of airport bookings and it reports revised arrival times rather than
 * only a status label.
 *
 * Requires AERODATABOX_KEY (RapidAPI application key).
 * Endpoint: GET /flights/number/{number}/{yyyy-MM-dd}
 */

import {
  type FlightProvider,
  type FlightStatus,
  type FlightState,
  normaliseFlightNumber,
} from "./types";

const HOST = "aerodatabox.p.rapidapi.com";

/** AeroDataBox status strings → our states. Unlisted values become "unknown". */
const STATE_MAP: Record<string, FlightState> = {
  Expected:    "scheduled",
  CheckIn:     "scheduled",
  Boarding:    "scheduled",
  GateClosed:  "scheduled",
  Departed:    "en_route",
  EnRoute:     "en_route",
  Approaching: "en_route",
  Delayed:     "delayed",
  Arrived:     "landed",
  Landed:      "landed",
  Canceled:    "cancelled",
  Cancelled:   "cancelled",
  Diverted:    "diverted",
};

interface AdbTime { utc?: string; local?: string }
interface AdbPoint {
  airport?: { iata?: string; icao?: string; name?: string };
  scheduledTime?: AdbTime;
  revisedTime?: AdbTime;
  predictedTime?: AdbTime;
  actualTime?: AdbTime;
  runwayTime?: AdbTime;
  terminal?: string;
}
interface AdbFlight {
  number?: string;
  status?: string;
  airline?: { name?: string };
  departure?: AdbPoint;
  arrival?: AdbPoint;
}

/** AeroDataBox returns `"2026-08-08 14:35Z"` — not ISO-8601, so normalise first. */
function parseTime(t?: AdbTime): Date | null {
  const raw = t?.utc ?? t?.local;
  if (!raw) return null;
  const iso = raw.trim().replace(" ", "T").replace(/Z?$/, "Z");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class AeroDataBoxProvider implements FlightProvider {
  readonly name = "aerodatabox";

  isConfigured(): boolean {
    return Boolean(process.env.AERODATABOX_KEY);
  }

  async lookup(flightNumber: string, date: Date): Promise<FlightStatus | null> {
    const key = process.env.AERODATABOX_KEY;
    if (!key) throw new Error("AERODATABOX_KEY not configured");

    const number = normaliseFlightNumber(flightNumber);
    if (!number) return null;

    const res = await fetch(
      `https://${HOST}/flights/number/${number}/${ymd(date)}?withAircraftImage=false&withLocation=false`,
      {
        headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST },
        // Ten minutes is well inside the cadence at which airlines revise
        // arrival times, and keeps a burst of dashboard opens to one API call.
        next: { revalidate: 600 },
      },
    );

    // 204/404 mean the flight is not in their schedule for that date. That is a
    // legitimate "unknown", not an error — the customer may have mistyped, or
    // it may be a charter the provider does not cover.
    if (res.status === 204 || res.status === 404) return null;

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`AeroDataBox ${res.status}: ${body.slice(0, 200)}`);
    }

    const payload = await res.json().catch(() => null);
    const flights: AdbFlight[] = Array.isArray(payload) ? payload : [];
    if (flights.length === 0) return null;

    // A designator can return several legs on multi-sector days. Prefer the one
    // landing at Barcelona, since that is the leg this business meets.
    const f =
      flights.find((x) => {
        const a = x.arrival?.airport;
        return a?.iata === "BCN" || a?.icao === "LEBL";
      }) ?? flights[0];

    const arrival   = f.arrival ?? {};
    const scheduled = parseTime(arrival.scheduledTime);
    const estimated =
      parseTime(arrival.actualTime)  ??
      parseTime(arrival.runwayTime)  ??
      parseTime(arrival.revisedTime) ??
      parseTime(arrival.predictedTime);

    const delayMinutes =
      scheduled && estimated
        ? Math.round((estimated.getTime() - scheduled.getTime()) / 60000)
        : null;

    let state: FlightState = STATE_MAP[f.status ?? ""] ?? "unknown";
    // The label often still reads "Expected" while the revised time already
    // shows a material delay; trust the clock over the label.
    if (state === "scheduled" && delayMinutes !== null && delayMinutes >= 20) {
      state = "delayed";
    }

    return {
      flightNumber: number,
      state,
      scheduledArrival: scheduled,
      estimatedArrival: estimated,
      delayMinutes,
      arrivalAirport:   arrival.airport?.iata   ?? arrival.airport?.icao ?? null,
      arrivalTerminal:  arrival.terminal        ?? null,
      departureAirport: f.departure?.airport?.iata ?? null,
      airline:          f.airline?.name         ?? null,
      source:           this.name,
    };
  }
}

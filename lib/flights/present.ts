/**
 * What a flight means to the person driving to meet it.
 *
 * The provider reports a state, some times and a few places. A chauffeur needs
 * something plainer: is it down yet, when will it be, and which door. This turns
 * one into the other, in one place that can be tested, so the card on the
 * driver's phone and the one on the fleet company's screen cannot disagree.
 *
 * Everything here works from what the provider said. A gate that has not been
 * assigned reads "Not assigned yet", a landing time that has not happened is
 * left out, and a flight with no data says so. Nothing is guessed, because a
 * wrong gate sends someone to the wrong end of an airport.
 */

/** The status as it arrives over JSON: dates are ISO strings. */
export interface FlightStatusDTO {
  flightNumber: string;
  state: "scheduled" | "en_route" | "landed" | "delayed" | "cancelled" | "diverted" | "unknown";
  scheduledArrival: string | null;
  estimatedArrival: string | null;
  delayMinutes: number | null;
  arrivalAirport: string | null;
  arrivalAirportName: string | null;
  arrivalTerminal: string | null;
  arrivalGate: string | null;
  baggageBelt: string | null;
  departureAirport: string | null;
  departureAirportName: string | null;
  departureTerminal: string | null;
  departureGate: string | null;
  scheduledDeparture: string | null;
  actualDeparture: string | null;
  landedAt: string | null;
  airline: string | null;
  aircraft: string | null;
}

export type FlightTone = "good" | "late" | "bad" | "landed" | "neutral";

export interface FlightView {
  tone: FlightTone;
  /** Short status for the chip: "Landed", "In the air", "Delayed 45 min". */
  headline: string;
  /** One sentence for the driver about what to do or expect. */
  note: string;
  /** Times, in the order a driver reads them. Only ones that exist. */
  times: { label: string; value: string; emphasis?: boolean }[];
  /** Where to be. Always the three, so a missing one is visibly missing. */
  place: { label: string; value: string; known: boolean }[];
}

const ZONE = "Europe/Madrid";

export function clock(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: ZONE });
}

/** A day is added only when it is not today, which is the case that causes mistakes. */
function clockWithDay(iso: string | null | undefined, now: Date): string | null {
  const t = clock(iso);
  if (!t || !iso) return t;
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: ZONE });
  const d = new Date(iso);
  if (day(d) === day(now)) return t;
  return `${t} · ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: ZONE })}`;
}

function place(label: string, value: string | null): FlightView["place"][number] {
  return { label, value: value ? value : "Not assigned yet", known: Boolean(value) };
}

export function describeFlight(s: FlightStatusDTO, now: Date = new Date()): FlightView {
  const scheduled = clockWithDay(s.scheduledArrival, now);
  const expected = clockWithDay(s.estimatedArrival ?? s.scheduledArrival, now);
  const landed = clock(s.landedAt);
  const late = s.delayMinutes !== null && s.delayMinutes >= 20;

  const times: FlightView["times"] = [];
  if (scheduled) times.push({ label: "Scheduled", value: scheduled });
  if (s.state === "landed") {
    if (landed) times.push({ label: "Landed", value: landed, emphasis: true });
  } else if (s.estimatedArrival && s.state !== "cancelled" && s.state !== "diverted") {
    times.push({ label: "Expected", value: expected ?? "-", emphasis: true });
  }

  const where = [
    place("Terminal", s.arrivalTerminal ? `T${s.arrivalTerminal.replace(/^T/i, "")}` : null),
    place("Gate", s.arrivalGate),
    place("Belt", s.baggageBelt),
  ];

  const base = { times, place: where };

  switch (s.state) {
    case "cancelled":
      return { ...base, tone: "bad", headline: "Cancelled",
        note: "This flight is cancelled. Call dispatch before you drive to the airport.", times: scheduled ? [{ label: "Was scheduled", value: scheduled }] : [] };
    case "diverted":
      return { ...base, tone: "bad", headline: "Diverted",
        note: "This flight is not coming to the airport you expected. Call dispatch before you drive.", times: scheduled ? [{ label: "Was scheduled", value: scheduled }] : [] };
    case "landed":
      return { ...base, tone: "landed", headline: "Landed",
        note: landed
          ? `Landed at ${landed}. The passenger still has to reach arrivals, so watch for them from there.`
          : "The flight has landed. The passenger still has to reach arrivals." };
    case "en_route":
      return { ...base, tone: late ? "late" : "good", headline: late ? `In the air, ${s.delayMinutes} min late` : "In the air",
        note: expected ? `Expected to land at ${expected}.` : "In the air. No landing estimate yet." };
    case "delayed":
      return { ...base, tone: "late", headline: s.delayMinutes !== null ? `Delayed ${s.delayMinutes} min` : "Delayed",
        note: expected ? `The pickup moves with the plane. Expected to land at ${expected}.` : "The flight is delayed. No new landing time yet." };
    case "scheduled":
      return { ...base, tone: late ? "late" : "good", headline: late ? `${s.delayMinutes} min late` : "On schedule",
        note: s.actualDeparture
          ? `Left the gate at ${clock(s.actualDeparture)}.`
          : "Has not left yet." };
    default:
      return { ...base, tone: "neutral", headline: "No live update yet",
        note: "No live data for this flight yet. The pickup time on the booking still stands." };
  }
}

"use client";

import { useEffect, useState } from "react";
import { Plane, Loader2 } from "lucide-react";

/**
 * Live arrival status for a booking's flight.
 *
 * The scheduled sweep can only run a handful of times a day — the Hobby plan
 * caps each cron entry at one run, and every existing job fires before noon. A
 * flight delayed at 14:00 for a 19:00 pickup is therefore never caught by a
 * cron. This closes that gap the other way round: the driver checking their
 * jobs before setting off gets the status as it is right now.
 *
 * Server-side the lookup is cached for ten minutes, so opening the dashboard
 * repeatedly costs one API call, not one per open. The free tier allows 600
 * lookups a month.
 */
interface Status {
  state: string;
  scheduledArrival: string | null;
  estimatedArrival: string | null;
  delayMinutes: number | null;
  arrivalTerminal: string | null;
  departureAirport: string | null;
}

const TIME = { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" } as const;

export default function FlightStatusBadge({
  bookingId,
  flightNumber,
}: {
  bookingId: string;
  flightNumber: string;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "unknown">("loading");

  useEffect(() => {
    let alive = true;
    fetch(`/api/flights/status?bookingId=${encodeURIComponent(bookingId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (d?.tracked && d.status) { setStatus(d.status); setState("ok"); }
        else setState("unknown");
      })
      .catch(() => alive && setState("unknown"));
    return () => { alive = false; };
  }, [bookingId]);

  if (state === "loading") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-dark-500">
        <Loader2 size={10} className="animate-spin" /> {flightNumber}
      </span>
    );
  }

  // No data is not the same as on time. Show the flight number plainly rather
  // than implying we have checked and it is fine.
  if (state === "unknown" || !status) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-blue-400">
        <Plane size={10} /> {flightNumber}
      </span>
    );
  }

  const arrival = status.estimatedArrival ?? status.scheduledArrival;
  const arrivalText = arrival ? new Date(arrival).toLocaleTimeString("en-GB", TIME) : null;
  const late = status.delayMinutes !== null && status.delayMinutes >= 20;
  const cancelled = status.state === "cancelled" || status.state === "diverted";

  const tone = cancelled ? "text-red-400 bg-red-500/10 border-red-500/25"
    : late ? "text-amber-400 bg-amber-500/10 border-amber-500/25"
    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

  const label = cancelled ? status.state.toUpperCase()
    : late ? `+${status.delayMinutes} min late`
    : status.delayMinutes === null ? "no update yet"
    : "on time";

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium ${tone}`}>
      <Plane size={10} />
      {flightNumber}
      {status.departureAirport && <span className="opacity-60">from {status.departureAirport}</span>}
      <span className="opacity-50">·</span>
      {arrivalText && <span>lands {arrivalText}</span>}
      {status.arrivalTerminal && <span className="opacity-60">T{status.arrivalTerminal}</span>}
      <span className="opacity-50">·</span>
      <span>{label}</span>
    </span>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Check, Circle, Loader2, Plane, MapPin } from "lucide-react";
import { RIDE_STAGES, STAGE_META, waitMinutes } from "@/lib/ride-stages";
import type { RideStage } from "@prisma/client";

interface Event { stage: RideStage; createdAt: string; lat: number | null; lng: number | null }
interface Flight {
  state: string; scheduledArrival: string | null; estimatedArrival: string | null;
  delayMinutes: number | null; arrivalTerminal: string | null; departureAirport: string | null;
  flightNumber: string;
}

const TIME = { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" } as const;

/**
 * The operator's view of a journey: what the driver did and when, plus where
 * the flight actually is.
 *
 * The timeline answers the questions that come up after the fact — did the
 * driver really arrive on time, how long did they wait, when did the passenger
 * actually get in. Each stage carries the driver's coordinates where location
 * sharing was on, which makes "the driver never showed up" answerable rather
 * than a matter of opinion.
 */
export default function RideTimeline({
  bookingId,
  flightNumber,
}: {
  bookingId: string;
  flightNumber?: string | null;
}) {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [flightState, setFlightState] = useState<"loading" | "ok" | "none">("loading");

  useEffect(() => {
    let alive = true;
    fetch(`/api/bookings/${bookingId}/timeline`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setEvents(d?.events ?? []))
      .catch(() => alive && setEvents([]));

    if (!flightNumber) { setFlightState("none"); return; }
    fetch(`/api/flights/status?bookingId=${encodeURIComponent(bookingId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (d?.tracked && d.status) { setFlight(d.status); setFlightState("ok"); }
        else setFlightState("none");
      })
      .catch(() => alive && setFlightState("none"));

    return () => { alive = false; };
  }, [bookingId, flightNumber]);

  const at = (s: RideStage) => events?.find((e) => e.stage === s);
  const arrived = at("ARRIVED");
  const onBoard = at("ON_BOARD");
  const waited = waitMinutes(
    arrived ? new Date(arrived.createdAt) : null,
    onBoard ? new Date(onBoard.createdAt) : null,
  );

  return (
    <div className="space-y-4">
      {/* Live flight */}
      {flightNumber && (
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-dark-500 uppercase tracking-wider mb-2.5">Flight</p>
          {flightState === "loading" ? (
            <p className="text-dark-400 text-sm flex items-center gap-2">
              <Loader2 size={13} className="animate-spin" /> Checking {flightNumber}…
            </p>
          ) : flightState === "none" || !flight ? (
            <p className="text-dark-300 text-sm flex items-center gap-2">
              <Plane size={13} className="text-blue-400" /> {flightNumber}
              <span className="text-dark-500 text-xs">— no live data for this flight</span>
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-white text-sm flex items-center gap-2 flex-wrap">
                <Plane size={13} className="text-blue-400" />
                <span className="font-medium">{flight.flightNumber}</span>
                {flight.departureAirport && <span className="text-dark-400">from {flight.departureAirport}</span>}
                {flight.arrivalTerminal && <span className="text-dark-400">· T{flight.arrivalTerminal}</span>}
              </p>
              <div className="flex items-center gap-4 text-xs">
                {flight.scheduledArrival && (
                  <span className="text-dark-400">
                    scheduled {new Date(flight.scheduledArrival).toLocaleTimeString("en-GB", TIME)}
                  </span>
                )}
                {flight.estimatedArrival && (
                  <span className="text-white">
                    expected {new Date(flight.estimatedArrival).toLocaleTimeString("en-GB", TIME)}
                  </span>
                )}
                {flight.delayMinutes !== null && (
                  <span className={flight.delayMinutes >= 20 ? "text-amber-400 font-medium" : "text-emerald-400"}>
                    {flight.delayMinutes >= 20 ? `${flight.delayMinutes} min late` : "on time"}
                  </span>
                )}
                {flight.delayMinutes === null && <span className="text-dark-500">no update published yet</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Journey timeline */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-dark-500 uppercase tracking-wider">Journey</p>
          {waited !== null && (
            <span className={`text-[11px] ${waited > 15 ? "text-amber-400" : "text-dark-400"}`}>
              waited {waited} min for passenger
            </span>
          )}
        </div>

        {events === null ? (
          <p className="text-dark-400 text-sm flex items-center gap-2">
            <Loader2 size={13} className="animate-spin" /> Loading…
          </p>
        ) : events.length === 0 ? (
          <p className="text-dark-500 text-sm">The driver has not started this journey yet.</p>
        ) : (
          <ol className="space-y-2.5">
            {RIDE_STAGES.map((s) => {
              const ev = at(s);
              const done = Boolean(ev);
              return (
                <li key={s} className="flex items-start gap-2.5">
                  {done
                    ? <Check size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    : <Circle size={13} className="text-dark-700 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0 flex items-baseline justify-between gap-3">
                    <span className={done ? "text-white text-sm" : "text-dark-600 text-sm"}>
                      {STAGE_META[s].label}
                    </span>
                    {ev && (
                      <span className="text-dark-400 text-xs tabular-nums flex items-center gap-1.5 flex-shrink-0">
                        {ev.lat != null && ev.lng != null && (
                          <a
                            href={`https://www.google.com/maps?q=${ev.lat},${ev.lng}`}
                            target="_blank" rel="noopener noreferrer"
                            title="Where the driver was at this moment"
                            className="text-gold-500/70 hover:text-gold-400"
                          >
                            <MapPin size={10} />
                          </a>
                        )}
                        {new Date(ev.createdAt).toLocaleTimeString("en-GB", TIME)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

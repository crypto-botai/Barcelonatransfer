"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, MapPinOff, Loader2, AlertTriangle } from "lucide-react";

type State = "idle" | "starting" | "sharing" | "denied" | "unavailable" | "error";

const PING_INTERVAL_MS = 20_000;   // one write per 20s while a ride is running
const MIN_MOVE_METRES  = 25;       // below this, a "new" fix is GPS jitter

function metresBetween(a: GeolocationCoordinates, b: GeolocationCoordinates): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Driver GPS sharing for one in-progress ride.
 *
 * Deliberately opt-in and explicitly stoppable: the driver starts it, sees that
 * it is running, and can switch it off. Location goes to the server only while
 * this is mounted and running — there is no background collection.
 *
 * Two throttles keep this off the driver's data plan and off the database:
 * positions are written at most every 20 seconds, and only when the vehicle has
 * actually moved 25 metres. A car waiting at arrivals produces one write, not
 * one every twenty seconds.
 */
export default function LocationSharing({
  bookingId,
  active,
}: {
  bookingId: string;
  /** The ride is in progress. Sharing auto-stops when this goes false. */
  active: boolean;
}) {
  const [state, setState] = useState<State>("idle");
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef  = useRef<number | null>(null);
  const lastFixRef  = useRef<GeolocationCoordinates | null>(null);
  const lastSentAt  = useRef<number>(0);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    lastFixRef.current = null;
    lastSentAt.current = 0;
    setState("idle");
  }, []);

  const push = useCallback(
    async (coords: GeolocationCoordinates) => {
      try {
        const res = await fetch("/api/tracking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId,
            lat: coords.latitude,
            lng: coords.longitude,
            // The API range-checks these; omit rather than send null.
            ...(coords.speed   != null && coords.speed   >= 0 ? { speed:   coords.speed }   : {}),
            ...(coords.heading != null && coords.heading >= 0 ? { heading: coords.heading } : {}),
          }),
        });
        if (!res.ok) throw new Error(`server responded ${res.status}`);
        setLastSent(new Date());
        setError(null);
      } catch (e) {
        // A dropped ping is normal in a tunnel or a dead spot. Keep the watch
        // running and report it rather than tearing sharing down.
        setError(e instanceof Error ? e.message : "ping failed");
      }
    },
    [bookingId],
  );

  const start = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState("unavailable");
      return;
    }
    setState("starting");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState("sharing");
        const now = Date.now();
        const prev = lastFixRef.current;
        const movedEnough = !prev || metresBetween(prev, pos.coords) >= MIN_MOVE_METRES;
        const dueAnyway   = now - lastSentAt.current >= PING_INTERVAL_MS * 3;

        if ((movedEnough && now - lastSentAt.current >= PING_INTERVAL_MS) || dueAnyway) {
          lastFixRef.current = pos.coords;
          lastSentAt.current = now;
          void push(pos.coords);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setState("denied");
        else {
          setState("error");
          setError(err.message);
        }
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
  }, [push]);

  // Sharing follows the ride. When the ride ends, tracking ends — the driver
  // does not have to remember to switch it off.
  useEffect(() => {
    if (!active && watchIdRef.current !== null) stop();
  }, [active, stop]);

  useEffect(() => stop, [stop]);   // clear the watch on unmount

  if (!active) return null;

  if (state === "denied" || state === "unavailable") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
        <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-amber-200/90 text-xs leading-relaxed">
          {state === "denied"
            ? "Location permission is blocked. Enable it for this site in your browser settings to let the client see you approaching."
            : "This device cannot share location."}
        </p>
      </div>
    );
  }

  const sharing = state === "sharing" || state === "starting";

  return (
    <div className="rounded-xl border border-white/[0.06] p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {state === "starting" ? (
            <Loader2 size={15} className="text-gold-400 animate-spin flex-shrink-0" />
          ) : sharing ? (
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          ) : (
            <MapPinOff size={15} className="text-dark-500 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-white text-xs font-medium">
              {state === "starting" ? "Getting your location…" : sharing ? "Sharing live location" : "Location off"}
            </p>
            <p className="text-dark-500 text-[10px]">
              {sharing
                ? lastSent
                  ? `Client can see you · updated ${lastSent.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                  : "Client can see you"
                : "Turn on so the client can watch you approach"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={sharing ? stop : start}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium tracking-wide transition-colors flex-shrink-0 ${
            sharing
              ? "bg-white/[0.06] text-dark-300 hover:text-white"
              : "bg-gold-500/15 text-gold-300 hover:bg-gold-500/25"
          }`}
        >
          {sharing ? "Stop" : <span className="flex items-center gap-1"><MapPin size={12} /> Share</span>}
        </button>
      </div>

      {error && sharing && (
        <p className="text-amber-400/80 text-[10px]">Last update failed ({error}). Still trying.</p>
      )}
    </div>
  );
}

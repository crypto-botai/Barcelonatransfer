"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, LocateOff } from "lucide-react";

/**
 * A passenger choosing to show their chauffeur where they are.
 *
 * Off by default and off again the moment they leave the page: the browser
 * watch is cleared and the server is told to forget the fix. While on, a
 * position goes up every few seconds and the driver's panel shows how far
 * away they are.
 */
export default function ShareMyLocation({ bookingId, code }: { bookingId: string; code?: string }) {
  const [state, setState] = useState<"off" | "starting" | "on" | "denied" | "unavailable">("off");
  const watch = useRef<number | null>(null);
  const last = useRef(0);

  async function push(lat: number, lng: number) {
    if (Date.now() - last.current < 5000) return;
    last.current = Date.now();
    await fetch(`/api/bookings/${bookingId}/customer-location`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat, lng, code }),
    }).catch(() => {});
  }

  function stop() {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setState("off");
    fetch(`/api/bookings/${bookingId}/customer-location${code ? `?code=${encodeURIComponent(code)}` : ""}`, { method: "DELETE", keepalive: true }).catch(() => {});
  }

  function start() {
    if (!("geolocation" in navigator)) { setState("unavailable"); return; }
    setState("starting");
    watch.current = navigator.geolocation.watchPosition(
      (p) => { setState("on"); push(p.coords.latitude, p.coords.longitude); },
      (e) => { setState(e.code === e.PERMISSION_DENIED ? "denied" : "unavailable"); watch.current = null; },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }

  useEffect(() => () => { if (watch.current != null) stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const on = state === "on" || state === "starting";
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${on ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-white/[0.08] bg-white/[0.02]"}`}>
      <div className="min-w-0">
        <p className="text-sm text-white">{on ? "Sharing your location with your chauffeur" : "Show your chauffeur where you are"}</p>
        <p className="text-xs text-dark-400">
          {state === "denied" ? "Location is blocked for this site. Allow it in your browser settings to share."
            : state === "unavailable" ? "Location is not available on this device."
            : on ? "Stops when you leave this page." : "Helpful in a busy arrivals hall. Only while this page is open."}
        </p>
      </div>
      <button
        type="button" onClick={on ? stop : start} aria-pressed={on}
        className={`flex h-11 flex-shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium ${on ? "border border-emerald-500/40 text-emerald-300" : "bg-gold-500 text-black"}`}
      >
        {on ? <><LocateOff size={15} /> Stop</> : <><LocateFixed size={15} /> Share</>}
      </button>
    </div>
  );
}

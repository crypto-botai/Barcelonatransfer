"use client";

import { useEffect, useState } from "react";
import { Navigation, UserRound } from "lucide-react";
import { navUrl, type NavApp } from "@/lib/nav-links";

/**
 * Where the passenger says they are, when they have chosen to share it.
 * Distance from the driver's own position when the browser gives one; a
 * navigate button to the passenger either way.
 */
function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function PassengerLocation({ bookingId, app }: { bookingId: string; app: NavApp }) {
  const [pos, setPos] = useState<{ lat: number; lng: number; at: string } | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/bookings/${bookingId}/customer-location`, { cache: "no-store" });
        if (!r.ok || stop) return;
        const d = await r.json();
        setPos(d.sharing && d.lat != null ? { lat: d.lat, lng: d.lng, at: d.at } : null);
      } catch { /* next tick */ }
    };
    tick();
    const t = setInterval(tick, 10_000);
    return () => { stop = true; clearInterval(t); };
  }, [bookingId]);

  useEffect(() => {
    if (!pos || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition((p) => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { maximumAge: 30_000, timeout: 5000 });
  }, [pos]);

  if (!pos) return null;
  const dist = me ? haversineM(me, pos) : null;
  const age = Math.max(0, Math.round((Date.now() - new Date(pos.at).getTime()) / 1000));
  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2">
      <UserRound size={16} className="flex-shrink-0 text-emerald-300" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white">Passenger is sharing their location</p>
        <p className="text-xs text-dark-400">
          {dist != null ? (dist < 1000 ? `${Math.round(dist)} m from you` : `${(dist / 1000).toFixed(1)} km from you`) : "Position received"} · {age < 60 ? `${age}s ago` : `${Math.round(age / 60)} min ago`}
        </p>
      </div>
      <a href={navUrl(app, "Passenger", pos.lat, pos.lng)} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 text-xs text-emerald-200 hover:bg-emerald-500/10">
        <Navigation size={13} /> Go to them
      </a>
    </div>
  );
}

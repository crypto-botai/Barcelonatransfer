"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Loader2, MapPin, Phone, MessageCircle, CheckCircle2, Car } from "lucide-react";
import { useTranslations } from "@/components/language/I18nProvider";

const LiveMap = dynamic(() => import("@/components/dashboard/LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[320px] bg-white/[0.02] rounded-2xl flex items-center justify-center">
      <Loader2 className="text-gold-500 animate-spin" size={26} />
    </div>
  ),
});

export interface TrackBooking {
  id: string;
  code: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string | null;
  pickupDatetime: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  driverName: string | null;
  driverPhone: string | null;
  vehicle: string | null;
  plate: string | null;
}

interface Point { lat: number; lng: number; speed?: number | null; heading?: number | null; createdAt: string }

const STAGES = [
  { key: "CONFIRMED",       labelKey: "stageConfirmed" },
  { key: "DRIVER_ASSIGNED", labelKey: "stageDriverAssigned" },
  { key: "IN_PROGRESS",     labelKey: "stageOnTheWay" },
  { key: "COMPLETED",       labelKey: "stageCompleted" },
] as const;

const POLL_MS = 15_000;

export default function PublicTrackClient({ booking }: { booking: TrackBooking }) {
  const t = useTranslations("track");
  const [point, setPoint]   = useState<Point | null>(null);
  const [status, setStatus] = useState(booking.status);
  const [live, setLive]     = useState(false);
  const [loaded, setLoaded] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/tracking?bookingId=${encodeURIComponent(booking.id)}&code=${encodeURIComponent(booking.code)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = await res.json() as { live: boolean; status: string; point?: Point | null };
      setLive(data.live);
      setStatus(data.status);
      if (data.point) setPoint(data.point);
    } catch {
      // Transient network failure; the next tick retries. The last known
      // position stays on screen rather than blanking the map.
    } finally {
      setLoaded(true);
    }
  }, [booking.id, booking.code]);

  useEffect(() => {
    void poll();
    // Polling stops once the journey is over — there is nothing left to watch
    // and no reason to keep hitting the server.
    if (status === "COMPLETED" || status === "CANCELLED") return;
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll, status]);

  const stageIndex = STAGES.findIndex((s) => s.key === status);
  const when = new Date(booking.pickupDatetime).toLocaleString("en-GB", { timeZone: "Europe/Madrid",
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <header className="text-center">
        <p className="text-gold-500 text-[11px] tracking-[0.28em] uppercase mb-2">Elite BCN Transfers</p>
        <h1 className="font-display text-2xl sm:text-3xl text-white">{t("title")}</h1>
        <p className="text-dark-400 text-sm mt-1">
          {booking.pickupAddress}
          {booking.dropoffAddress ? ` → ${booking.dropoffAddress}` : ""}
        </p>
        <p className="text-dark-500 text-xs mt-1">{when}</p>
      </header>

      {/* Progress */}
      <ol className="flex items-center gap-1">
        {STAGES.map((s, i) => {
          const done   = stageIndex >= i && stageIndex !== -1;
          const active = stageIndex === i;
          return (
            <li key={s.key} className="flex-1 min-w-0">
              <div className={`h-1 rounded-full mb-2 ${done ? "bg-gold-500" : "bg-white/[0.08]"}`} />
              <p className={`text-[10px] leading-tight truncate ${active ? "text-gold-300" : done ? "text-dark-300" : "text-dark-600"}`}>
                {t(s.labelKey)}
              </p>
            </li>
          );
        })}
      </ol>

      {/* Map — only while there is something live to show */}
      {live && point ? (
        <div className="rounded-2xl overflow-hidden border border-white/[0.06] h-[320px]">
          <LiveMap
            driverLat={point.lat}
            driverLng={point.lng}
            pickupLat={booking.pickupLat}
            pickupLng={booking.pickupLng}
            dropoffLat={booking.dropoffLat}
            dropoffLng={booking.dropoffLng}
            driverStatus={status}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.06] p-8 text-center">
          {!loaded ? (
            <Loader2 className="text-gold-500 animate-spin mx-auto" size={22} />
          ) : status === "COMPLETED" ? (
            <>
              <CheckCircle2 size={26} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-white text-sm font-medium">{t("journeyCompleted")}</p>
              <p className="text-dark-400 text-xs mt-1">{t("thankYou")}</p>
            </>
          ) : (
            <>
              <MapPin size={24} className="text-dark-600 mx-auto mb-2" />
              <p className="text-white text-sm font-medium">{t("mapNotActive")}</p>
              <p className="text-dark-400 text-xs mt-1 leading-relaxed">
                {t("mapNotActiveBody")}
              </p>
            </>
          )}
        </div>
      )}

      {/* Driver — shown only once one is actually assigned. */}
      {booking.driverName && (
        <div className="rounded-2xl border border-white/[0.06] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0">
              <Car size={16} className="text-gold-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-medium truncate">{booking.driverName}</p>
              {booking.vehicle && (
                <p className="text-dark-400 text-xs truncate">
                  {booking.vehicle}{booking.plate ? ` · ${booking.plate}` : ""}
                </p>
              )}
            </div>
            {booking.driverPhone && (
              <div className="flex gap-2 flex-shrink-0">
                <a
                  href={`tel:${booking.driverPhone}`}
                  aria-label={t("callDriver")}
                  className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center text-dark-300 hover:text-white transition-colors"
                >
                  <Phone size={14} />
                </a>
                <a
                  href={`https://wa.me/${booking.driverPhone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("whatsappDriver")}
                  className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <MessageCircle size={14} />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-center text-dark-600 text-[11px]">
        {t("reference")} {booking.code} · {t("needHelp")} +34 635 383 712
      </p>
    </div>
  );
}

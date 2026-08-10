"use client";

import { useState } from "react";
import { Loader2, Check, Navigation, MapPin, Clock, UserCheck, FlagTriangleRight } from "lucide-react";
import toast from "react-hot-toast";
import { RIDE_STAGES, STAGE_META, nextStage } from "@/lib/ride-stages";
import type { RideStage } from "@prisma/client";

const ICON: Record<RideStage, React.ElementType> = {
  ON_THE_WAY:        Navigation,
  ARRIVED:           MapPin,
  WAITING_PASSENGER: Clock,
  ON_BOARD:          UserCheck,
  COMPLETED:         FlagTriangleRight,
};

const TONE: Record<string, string> = {
  blue:    "bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25",
  gold:    "bg-gold-500/15 text-gold-300 border-gold-500/30 hover:bg-gold-500/25",
  amber:   "bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25",
};

/**
 * The driver's journey controls.
 *
 * Shows one primary button — the next stage — rather than all five at once.
 * A driver operates this one-handed, often standing in an arrivals hall, and a
 * row of five similar buttons is how the wrong one gets tapped.
 *
 * "Waiting for passenger" is offered alongside "Passenger on board" once the
 * driver has arrived, because those are the two things that genuinely happen
 * next and the order between them varies.
 */
export default function RideStageControl({
  bookingId,
  currentStage,
  onAdvance,
}: {
  bookingId: string;
  currentStage: RideStage | null;
  onAdvance?: (stage: RideStage) => void;
}) {
  const [stage, setStage] = useState<RideStage | null>(currentStage);
  const [busy, setBusy] = useState<RideStage | null>(null);

  async function advance(to: RideStage) {
    setBusy(to);
    try {
      // Attach the driver's position where the browser will give it up quickly.
      // A stage change must never wait on a slow GPS fix, so this resolves
      // without coordinates rather than blocking the tap.
      const coords = await new Promise<{ lat?: number; lng?: number }>((resolve) => {
        if (!("geolocation" in navigator)) return resolve({});
        const timer = setTimeout(() => resolve({}), 3000);
        navigator.geolocation.getCurrentPosition(
          (p) => { clearTimeout(timer); resolve({ lat: p.coords.latitude, lng: p.coords.longitude }); },
          () => { clearTimeout(timer); resolve({}); },
          { enableHighAccuracy: true, timeout: 3000, maximumAge: 30_000 },
        );
      });

      const res = await fetch("/api/driver/ride", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, stage: to, ...coords }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update");

      setStage(to);
      onAdvance?.(to);
      toast.success(STAGE_META[to].label);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(null);
    }
  }

  if (stage === "COMPLETED") {
    return (
      <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
        <Check size={14} /> {STAGE_META.COMPLETED.label}
      </div>
    );
  }

  const next = nextStage(stage);
  // Once arrived, waiting and on-board are both plausible next taps.
  const choices: RideStage[] =
    stage === "ARRIVED" ? ["WAITING_PASSENGER", "ON_BOARD"] : next ? [next] : [];

  const done = stage ? RIDE_STAGES.slice(0, RIDE_STAGES.indexOf(stage) + 1) : [];

  return (
    <div className="space-y-2.5">
      {/* Where the journey has got to */}
      {done.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {done.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 text-[10px] text-dark-400">
              <Check size={9} className="text-emerald-500" /> {STAGE_META[s].label}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {choices.map((s) => {
          const Icon = ICON[s];
          const meta = STAGE_META[s];
          return (
            <button
              key={s}
              onClick={() => advance(s)}
              disabled={busy !== null}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors disabled:opacity-40 ${TONE[meta.tone]}`}
            >
              {busy === s ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
              {meta.action}
            </button>
          );
        })}
      </div>
    </div>
  );
}

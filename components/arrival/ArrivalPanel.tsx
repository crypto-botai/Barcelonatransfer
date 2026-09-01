"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, PlaneLanding, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import {
  PAX_STAGES,
  PAX_STAGE_META,
  currentSignal,
  furthestStage,
  stageIndex,
  type PaxEvent,
} from "@/lib/arrival";

/**
 * What the driver and the office see.
 *
 * The whole point of the feature is one clear signal, so the loudest thing on
 * the card is a single sentence saying what to do — "bring the vehicle to the
 * pickup zone now" — with the timestamped steps underneath as the evidence
 * behind it. A driver reads the sentence; the office reads the timeline when a
 * customer disputes a waiting charge.
 *
 * Polls rather than holding a socket open. A dashboard on a phone in an
 * arrivals hall loses its connection constantly, and a poll that silently
 * resumes is worth more here than instant delivery.
 */

const POLL_MS = 20_000;

export default function ArrivalPanel({
  bookingId,
  compact = false,
}: {
  bookingId: string;
  compact?: boolean;
}) {
  const [events, setEvents] = useState<PaxEvent[] | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/arrival/status?ids=${encodeURIComponent(bookingId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setEvents((data.arrivals?.[bookingId] ?? []) as PaxEvent[]);
      setLink((data.links?.[bookingId] ?? null) as string | null);
    } catch {
      // A failed poll leaves the last known timeline on screen, which is more
      // useful than an error where the passenger's progress used to be.
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => { void load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (events === null) {
    return (
      <div className="rounded-xl border border-white/[0.06] p-3.5">
        <p className="text-dark-500 text-xs">Loading arrival…</p>
      </div>
    );
  }

  const reached = furthestStage(events);

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Passenger link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3.5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <PlaneLanding size={13} className="text-gold-500 shrink-0" />
          <span className="text-[10px] uppercase tracking-[0.16em] text-dark-500">
            Passenger-reported arrival
          </span>
        </div>
        <button
          onClick={() => { void load(); }}
          className="text-dark-500 hover:text-gold-400 transition-colors shrink-0"
          aria-label="Refresh arrival status"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* The one clear signal. */}
      <p className={`text-sm leading-snug ${reached ? "text-white" : "text-dark-500"}`}>
        {currentSignal(events)}
      </p>

      {!compact && (
        <ol className="mt-3.5 space-y-1.5">
          {PAX_STAGES.map((stage) => {
            const hit = events.find((e) => e.stage === stage);
            const isDone = reached !== null && stageIndex(stage) <= stageIndex(reached);
            return (
              <li key={stage} className="flex items-center gap-2 text-xs">
                <span
                  className={`grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full border ${
                    isDone ? "border-gold-500 bg-gold-500 text-black" : "border-white/[0.12]"
                  }`}
                >
                  {isDone && <Check size={9} strokeWidth={3} />}
                </span>
                <span className={isDone ? "text-dark-200" : "text-dark-600"}>
                  {PAX_STAGE_META[stage].label}
                </span>
                {hit && (
                  <span className="ml-auto text-dark-500 tabular-nums">
                    {new Date(hit.at).toLocaleTimeString("en-GB", {
                      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid",
                    })}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {link && (
        <button
          onClick={copyLink}
          className="mt-3.5 flex items-center gap-1.5 text-[11px] text-dark-500 hover:text-gold-400 transition-colors"
        >
          <Copy size={10} /> Copy passenger link
        </button>
      )}
    </div>
  );
}

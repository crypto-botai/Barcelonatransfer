"use client";

import { useState } from "react";
import { Check, Loader2, MapPin, Plane, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import {
  PAX_STAGES,
  PAX_STAGE_META,
  furthestStage,
  nextPaxStage,
  stageIndex,
  type PaxEvent,
  type PaxStage,
} from "@/lib/arrival";

function timeOf(events: readonly PaxEvent[], stage: PaxStage): string | null {
  const hit = events.find((e) => e.stage === stage);
  if (!hit) return null;
  return new Date(hit.at).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid",
  });
}

/**
 * One tap per step, and only ever one button.
 *
 * The passenger is walking through a terminal holding a phone and a suitcase.
 * Offering the six steps at once is how the wrong one gets pressed, so this
 * shows the whole journey as a read-only timeline and exactly one action: the
 * step they are about to reach.
 */
export default function ArrivalClient({
  token,
  initialEvents,
  booking,
}: {
  token: string;
  initialEvents: PaxEvent[];
  booking: {
    confirmationCode: string;
    firstName: string | null;
    flightNumber: string | null;
    pickupAddress: string;
    driverName: string | null;
  };
}) {
  const [events, setEvents] = useState<PaxEvent[]>(initialEvents);
  const [busy, setBusy] = useState(false);

  const reached = furthestStage(events);
  const next = nextPaxStage(reached);
  const done = reached !== null && next === null;

  async function report(stage: PaxStage) {
    setBusy(true);
    // Shown as reported straight away. Airport wifi is slow and a button that
    // does nothing for four seconds gets pressed again; the server is the
    // authority and its reply replaces this a moment later either way.
    const optimistic: PaxEvent[] = [...events, { stage, at: new Date().toISOString() }];
    setEvents(optimistic);

    try {
      const res = await fetch(`/api/arrival/${token}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ stage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send that");
      setEvents(data.events as PaxEvent[]);
      toast.success("Thank you — your driver has been told.");
    } catch (e) {
      setEvents(events);
      toast.error(e instanceof Error ? e.message : "Could not send that");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-10">
      <div className="mx-auto w-full max-w-md">

        <header className="text-center mb-8">
          <p className="font-display text-[22px] tracking-[0.32em] text-white">
            ELITE<span className="text-gold-400">BCN</span>
          </p>
          <p className="text-[10px] uppercase tracking-[0.28em] text-dark-500 mt-2">
            Private Chauffeur · Barcelona
          </p>
        </header>

        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 mb-4">
          <h1 className="font-display text-2xl text-white leading-snug">
            {booking.firstName ? `Welcome to Barcelona, ${booking.firstName}.` : "Welcome to Barcelona."}
          </h1>
          <p className="text-dark-400 text-sm leading-relaxed mt-2">
            Tap each step as you go. Your driver sees it instantly, so nobody has to
            call anybody.
          </p>

          <dl className="mt-5 space-y-2.5 text-sm">
            {booking.flightNumber && (
              <div className="flex items-center gap-2.5">
                <Plane size={13} className="text-gold-500 shrink-0" />
                <dt className="sr-only">Flight</dt>
                <dd className="text-dark-200">{booking.flightNumber}</dd>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <MapPin size={13} className="text-gold-500 shrink-0 mt-1" />
              <dt className="sr-only">Meeting point</dt>
              <dd className="text-dark-200 leading-relaxed">{booking.pickupAddress}</dd>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={13} className="text-gold-500 shrink-0" />
              <dt className="sr-only">Reference</dt>
              <dd className="text-dark-200 tracking-[0.15em]">{booking.confirmationCode}</dd>
            </div>
          </dl>

          {booking.driverName && (
            <p className="text-dark-500 text-xs mt-4 pt-4 border-t border-white/[0.06]">
              Your chauffeur today is {booking.driverName}.
            </p>
          )}
        </section>

        {/* The journey so far */}
        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <h2 className="text-[10px] uppercase tracking-[0.24em] text-dark-500 mb-5">
            Your arrival
          </h2>

          <ol className="relative">
            {PAX_STAGES.map((stage, i) => {
              const at = timeOf(events, stage);
              const isDone = reached !== null && stageIndex(stage) <= stageIndex(reached);
              const isNext = stage === next;
              const last = i === PAX_STAGES.length - 1;

              return (
                <li key={stage} className="relative flex gap-3.5 pb-5 last:pb-0">
                  {!last && (
                    <span
                      aria-hidden
                      className={`absolute left-[13px] top-7 bottom-0 w-px ${isDone ? "bg-gold-500/40" : "bg-white/[0.08]"}`}
                    />
                  )}
                  <span
                    className={`relative z-10 grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full border ${
                      isDone
                        ? "border-gold-500 bg-gold-500 text-black"
                        : isNext
                          ? "border-gold-500/50 bg-[#050505] text-gold-400"
                          : "border-white/[0.12] bg-[#050505] text-dark-600"
                    }`}
                  >
                    {isDone ? <Check size={13} strokeWidth={3} /> : <span className="text-[11px]">{i + 1}</span>}
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className={`text-sm ${isDone ? "text-white" : isNext ? "text-gold-300" : "text-dark-500"}`}>
                      {PAX_STAGE_META[stage].label}
                    </p>
                    {at && <p className="text-dark-500 text-xs mt-0.5">Reported at {at}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* The one action */}
        <div className="mt-5">
          {done ? (
            <div className="rounded-2xl border border-gold-500/25 bg-gold-500/[0.06] p-5 text-center">
              <p className="text-gold-300 text-sm font-medium">Your driver is on the way to you.</p>
              <p className="text-dark-400 text-xs mt-1.5 leading-relaxed">
                Please stay at the meeting point. If anything changes, call us on{" "}
                <a href="tel:+34635383712" className="text-gold-400">+34 635 383 712</a>.
              </p>
            </div>
          ) : (
            next && (
              <button
                onClick={() => report(next)}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gold-500 px-6 py-4 text-base font-semibold text-black transition-opacity disabled:opacity-50"
              >
                {busy ? <Loader2 size={17} className="animate-spin" /> : null}
                {PAX_STAGE_META[next].action}
              </button>
            )
          )}

          <p className="text-dark-600 text-[11px] text-center leading-relaxed mt-4">
            We never track your location. Only the steps you tap are shared.
          </p>
        </div>

      </div>
    </main>
  );
}

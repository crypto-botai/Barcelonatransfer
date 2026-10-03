"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DoorOpen, Loader2, Luggage, Plane, PlaneLanding, RefreshCw, Building2 } from "lucide-react";
import { clock, describeFlight, type FlightStatusDTO, type FlightTone } from "@/lib/flights/present";

/**
 * The flight, as a driver needs to read it on the kerb.
 *
 * Status, when it lands or landed, and the three places that decide where to
 * stand: terminal, gate, baggage belt. The status is read from the same
 * endpoint as the small badge on the job list, which caches a flight for ten
 * minutes, so opening this on a dozen jobs is one lookup each and never a drain
 * on the provider's monthly allowance.
 *
 * It does not poll hard. It looks again every five minutes while the screen is
 * showing, and when the driver asks.
 */

const REFRESH_MS = 5 * 60 * 1000;

const TONE: Record<FlightTone, { chip: string; dot: string; edge: string }> = {
  good:    { chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400", edge: "border-emerald-500/20" },
  landed:  { chip: "border-gold-500/40 bg-gold-500/10 text-gold-300",          dot: "bg-gold-400",    edge: "border-gold-500/30" },
  late:    { chip: "border-amber-500/35 bg-amber-500/10 text-amber-300",       dot: "bg-amber-400",   edge: "border-amber-500/25" },
  bad:     { chip: "border-red-500/35 bg-red-500/10 text-red-300",             dot: "bg-red-400",     edge: "border-red-500/30" },
  neutral: { chip: "border-white/15 bg-white/[0.04] text-dark-300",            dot: "bg-dark-400",    edge: "border-white/[0.08]" },
};

type Load =
  | { kind: "loading" }
  | { kind: "ok"; status: FlightStatusDTO; checkedAt: string }
  | { kind: "none"; reason: string };

export default function FlightInfoCard({
  bookingId,
  flightNumber,
  className = "",
}: {
  bookingId: string;
  flightNumber: string;
  className?: string;
}) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  const fetchStatus = useCallback(async (manual: boolean) => {
    if (manual) setBusy(true);
    try {
      const r = await fetch(`/api/flights/status?bookingId=${encodeURIComponent(bookingId)}`, { cache: "no-store" });
      const d = r.ok ? await r.json() : null;
      if (!alive.current) return;
      if (d?.tracked && d.status) setLoad({ kind: "ok", status: d.status, checkedAt: d.checkedAt ?? new Date().toISOString() });
      else setLoad({ kind: "none", reason: d?.reason ?? "unavailable" });
    } catch {
      if (alive.current) setLoad((prev) => (prev.kind === "ok" ? prev : { kind: "none", reason: "unavailable" }));
    } finally {
      if (alive.current && manual) setBusy(false);
    }
  }, [bookingId]);

  useEffect(() => {
    alive.current = true;
    fetchStatus(false);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") fetchStatus(false);
    }, REFRESH_MS);
    return () => { alive.current = false; window.clearInterval(timer); };
  }, [fetchStatus]);

  if (load.kind === "loading") {
    return (
      <div className={`rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 ${className}`} aria-busy="true">
        <div className="flex items-center gap-2 text-sm text-dark-400">
          <Loader2 size={14} className="animate-spin" /> Checking flight {flightNumber}
        </div>
      </div>
    );
  }

  if (load.kind === "none") {
    const why =
      load.reason === "not_configured" ? "Flight tracking is not switched on."
      : load.reason === "not_found" ? "This flight was not found for the pickup date. Check the flight number with the passenger."
      : load.reason === "invalid_number" ? "The flight number on this booking does not look right. Check it with the passenger."
      : "Flight data is not available right now.";
    return (
      <div className={`rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 ${className}`}>
        <div className="flex items-center gap-2">
          <Plane size={14} className="text-gold-500" />
          <span className="font-display text-base tracking-wide text-white">{flightNumber}</span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-dark-400">{why} The pickup time on the booking still stands.</p>
        <button
          type="button"
          onClick={() => fetchStatus(true)}
          disabled={busy}
          className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/[0.12] px-3.5 text-xs text-dark-200 hover:border-gold-500/40 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> Try again
        </button>
      </div>
    );
  }

  const s = load.status;
  const view = describeFlight(s);
  const tone = TONE[view.tone];
  const from = [s.departureAirport, s.departureAirportName].filter(Boolean).join(" ");
  const route = `${s.departureAirport ?? "?"} to ${s.arrivalAirport ?? "BCN"}`;

  return (
    <section
      aria-label={`Flight ${s.flightNumber}: ${view.headline}`}
      className={`overflow-hidden rounded-2xl border ${tone.edge} bg-gradient-to-b from-white/[0.04] to-white/[0.01] ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-500/80">
            <Plane size={12} /> Flight
          </p>
          <p className="mt-1 font-display text-2xl leading-none tracking-wide text-white">{s.flightNumber}</p>
          <p className="mt-1.5 text-[12px] text-dark-400">
            {[s.airline, s.aircraft].filter(Boolean).join(" · ") || route}
          </p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${tone.chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
          {view.headline}
        </span>
      </header>

      {from && (
        <p className="px-4 pb-3 text-[12px] text-dark-400">
          From <span className="text-dark-200">{from}</span>
          {s.departureTerminal ? <> · T{s.departureTerminal.replace(/^T/i, "")}</> : null}
        </p>
      )}

      {view.times.length > 0 && (
        <dl className={`grid gap-px border-y border-white/[0.06] bg-white/[0.06] ${view.times.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {view.times.slice(0, 2).map((t) => (
            <div key={t.label} className="bg-[#0b0b0c] px-4 py-3">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-dark-500">{t.label}</dt>
              <dd className={`mt-1 tabular-nums ${t.emphasis ? "font-display text-2xl text-gold-300" : "text-lg text-dark-200"}`}>{t.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <dl className="grid grid-cols-3 gap-px border-b border-white/[0.06] bg-white/[0.06]">
        {view.place.map((p, i) => {
          const Icon = i === 0 ? Building2 : i === 1 ? DoorOpen : Luggage;
          return (
            <div key={p.label} className="bg-[#0b0b0c] px-3 py-3">
              <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-500">
                <Icon size={11} aria-hidden="true" /> {p.label}
              </dt>
              <dd className={`mt-1.5 leading-tight ${p.known ? "font-display text-xl text-white" : "text-[12px] text-dark-500"}`}>{p.value}</dd>
            </div>
          );
        })}
      </dl>

      <div className="flex items-start gap-3 px-4 py-3.5">
        <PlaneLanding size={15} className="mt-0.5 shrink-0 text-gold-500" aria-hidden="true" />
        <p className="text-[13px] leading-relaxed text-dark-200">{view.note}</p>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-2.5">
        <span className="text-[11px] text-dark-500">Checked {clock(load.checkedAt)} · updates every few minutes</span>
        <button
          type="button"
          onClick={() => fetchStatus(true)}
          disabled={busy}
          aria-label="Check the flight again"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs text-dark-300 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> Refresh
        </button>
      </footer>
    </section>
  );
}

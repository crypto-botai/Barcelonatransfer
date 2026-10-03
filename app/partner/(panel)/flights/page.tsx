"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Loader2, Plane, RefreshCw, Users } from "lucide-react";
import FlightInfoCard from "@/components/flight/FlightInfoCard";
import { describeFlight, type FlightStatusDTO, type FlightTone } from "@/lib/flights/present";
import { Empty, PageTitle, Skeleton, ghost } from "@/components/partner/ui";

/**
 * The flight board: every job with a flight on it, soonest first, with where
 * each aircraft has got to.
 *
 * The list comes from one request. Each flight's live status is then read one at
 * a time through the same endpoint the job sheet uses, which caches for ten
 * minutes. Only flights landing within two days are looked up on their own;
 * further ones wait for a tap, because the flight provider's allowance is
 * finite and nobody needs Friday's gate on Tuesday.
 */

type Job = {
  id: string; confirmationCode: string; status: string; flightNumber: string; pickupDatetime: string;
  pickupAddress: string; dropoffAddress: string; passengers: number; luggage: number;
  guestName: string | null; guestPhone: string | null;
  driver: { user: { name: string | null; phone: string | null } } | null;
};

type Load =
  | { kind: "loading" }
  | { kind: "ok"; status: FlightStatusDTO }
  | { kind: "none"; reason: string }
  | { kind: "idle" };

const AUTO_WITHIN_MS = 48 * 3600_000;
const POOL = 4;

const TONE: Record<FlightTone, { chip: string; dot: string }> = {
  good:    { chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400" },
  landed:  { chip: "border-gold-500/40 bg-gold-500/10 text-gold-300",          dot: "bg-gold-400" },
  late:    { chip: "border-amber-500/35 bg-amber-500/10 text-amber-300",       dot: "bg-amber-400" },
  bad:     { chip: "border-red-500/35 bg-red-500/10 text-red-300",             dot: "bg-red-400" },
  neutral: { chip: "border-white/15 bg-white/[0.04] text-dark-300",            dot: "bg-dark-400" },
};

const ZONE = "Europe/Madrid";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONE });
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit" });

function dayTitle(key: string) {
  const today = dayKey(new Date().toISOString());
  const tomorrow = dayKey(new Date(Date.now() + 86_400_000).toISOString());
  const long = new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
  return key === today ? `Today, ${long}` : key === tomorrow ? `Tomorrow, ${long}` : long;
}

export default function PartnerFlightsPage() {
  const reduce = useReducedMotion();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loads, setLoads] = useState<Record<string, Load>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [range, setRange] = useState<"day" | "week">("day");
  const [refreshing, setRefreshing] = useState(false);
  const started = useRef(new Set<string>());

  const loadList = useCallback(async () => {
    try {
      const r = await fetch("/api/partner/flights", { cache: "no-store" });
      if (!r.ok) throw new Error();
      setJobs((await r.json()).jobs);
      setFailed(false);
    } catch { setFailed(true); }
  }, []);
  useEffect(() => { void loadList(); }, [loadList]);

  const readFlight = useCallback(async (id: string) => {
    setLoads((l) => ({ ...l, [id]: { kind: "loading" } }));
    try {
      const r = await fetch(`/api/flights/status?bookingId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const d = r.ok ? await r.json() : null;
      setLoads((l) => ({ ...l, [id]: d?.tracked && d.status ? { kind: "ok", status: d.status } : { kind: "none", reason: d?.reason ?? "unavailable" } }));
    } catch {
      setLoads((l) => ({ ...l, [id]: { kind: "none", reason: "unavailable" } }));
    }
  }, []);

  // Look up the flights that are close, a few at a time.
  useEffect(() => {
    if (!jobs) return;
    const due = jobs.filter((j) => new Date(j.pickupDatetime).getTime() - Date.now() <= AUTO_WITHIN_MS && !started.current.has(j.id));
    due.forEach((j) => started.current.add(j.id));
    let next = 0;
    let alive = true;
    const worker = async () => { while (alive && next < due.length) await readFlight(due[next++].id); };
    void Promise.all(Array.from({ length: Math.min(POOL, due.length) }, worker));
    return () => { alive = false; };
  }, [jobs, readFlight]);

  const refresh = async () => {
    setRefreshing(true);
    started.current = new Set();
    setLoads({});
    await loadList();
    setRefreshing(false);
  };

  const shown = useMemo(() => {
    if (!jobs) return null;
    const limit = Date.now() + (range === "day" ? 24 : 24 * 7) * 3600_000;
    return jobs.filter((j) => new Date(j.pickupDatetime).getTime() <= limit);
  }, [jobs, range]);

  const groups = useMemo(() => {
    const m = new Map<string, Job[]>();
    for (const j of shown ?? []) m.set(dayKey(j.pickupDatetime), [...(m.get(dayKey(j.pickupDatetime)) ?? []), j]);
    return [...m.entries()];
  }, [shown]);

  const tally = useMemo(() => {
    const t = { total: shown?.length ?? 0, delayed: 0, landed: 0, trouble: 0, noDriver: 0 };
    for (const j of shown ?? []) {
      if (!j.driver) t.noDriver++;
      const l = loads[j.id];
      if (l?.kind !== "ok") continue;
      const tone = describeFlight(l.status).tone;
      if (tone === "late") t.delayed++; else if (tone === "landed") t.landed++; else if (tone === "bad") t.trouble++;
    }
    return t;
  }, [shown, loads]);

  return (
    <div>
      <PageTitle
        title="Flights"
        sub="Every arriving flight on your jobs, with where it is now."
        aside={
          <button type="button" onClick={refresh} disabled={refreshing} className={ghost}>
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="relative grid grid-cols-2 rounded-lg border border-white/[0.1] bg-white/[0.03] p-0.5" role="tablist" aria-label="How far ahead">
          {([["day", "Next 24 hours"], ["week", "This week"]] as const).map(([id, text]) => (
            <button key={id} role="tab" aria-selected={range === id} onClick={() => setRange(id)} className={`relative h-9 px-4 text-[13px] transition-colors ${range === id ? "text-black" : "text-dark-300 hover:text-white"}`}>
              {range === id && <motion.span layoutId="flight-range" className="absolute inset-0 rounded-md bg-gold-500" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }} />}
              <span className="relative font-medium">{text}</span>
            </button>
          ))}
        </div>

        {shown && shown.length > 0 && (
          <p className="text-sm text-dark-300" aria-live="polite">
            <span className="text-white">{tally.total}</span> flight{tally.total === 1 ? "" : "s"}
            {tally.delayed > 0 && <> · <span className="text-amber-300">{tally.delayed} delayed</span></>}
            {tally.trouble > 0 && <> · <span className="text-red-300">{tally.trouble} cancelled or diverted</span></>}
            {tally.landed > 0 && <> · <span className="text-gold-300">{tally.landed} landed</span></>}
            {tally.noDriver > 0 && <> · <span className="text-amber-300">{tally.noDriver} without a driver</span></>}
          </p>
        )}
      </div>

      {failed ? (
        <p className="text-sm text-red-300">Could not load your flights. Press Refresh to try again.</p>
      ) : shown === null ? (
        <Skeleton rows={4} h={96} />
      ) : shown.length === 0 ? (
        <Empty
          title={range === "day" ? "No flight in the next 24 hours" : "No flight this week"}
          body={jobs && jobs.length > 0 ? "Your next flight is further out. Choose This week to see it." : "Jobs with a flight number appear here, with the flight's live status, as soon as Elite BCN sends them."}
        />
      ) : (
        <div className="space-y-8">
          {groups.map(([key, list]) => (
            <section key={key} aria-label={dayTitle(key)}>
              <h2 className="mb-3 font-display text-xl text-white">{dayTitle(key)}</h2>
              <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                {list.map((j) => (
                  <FlightRow
                    key={j.id} job={j} load={loads[j.id] ?? { kind: "idle" }}
                    expanded={open === j.id} onToggle={() => { setOpen(open === j.id ? null : j.id); }}
                    onCheck={() => void readFlight(j.id)} reduce={Boolean(reduce)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FlightRow({ job, load, expanded, onToggle, onCheck, reduce }: { job: Job; load: Load; expanded: boolean; onToggle: () => void; onCheck: () => void; reduce: boolean }) {
  const view = load.kind === "ok" ? describeFlight(load.status) : null;
  const s = load.kind === "ok" ? load.status : null;
  const lands = view?.times[0];

  return (
    <li>
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-x-4 gap-y-3 px-4 py-4 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:px-5">
        <div>
          <p className="font-display text-[26px] leading-none tabular-nums text-white">{clock(job.pickupDatetime)}</p>
          <p className="mt-1.5 font-mono text-[10.5px] tracking-wider text-gold-400">{job.confirmationCode}</p>
        </div>

        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-display text-xl tracking-wide text-white"><Plane size={15} className="text-gold-500" />{job.flightNumber}</span>
            {s && (s.departureAirport || s.airline) && <span className="text-xs text-dark-400">{[s.airline, s.departureAirport ? `from ${s.departureAirport}` : null].filter(Boolean).join(" · ")}</span>}
          </p>
          <p className="mt-1 truncate text-sm text-dark-200">{job.guestName ?? "Passenger"} · {job.passengers} pax, {job.luggage} bags</p>
          <p className="mt-0.5 truncate text-xs text-dark-500">{job.pickupAddress} to {job.dropoffAddress || "as arranged"}</p>
          <p className={`mt-1.5 inline-flex items-center gap-1.5 text-xs ${job.driver ? "text-sky-300/90" : "text-amber-300"}`}>
            <Users size={12} /> {job.driver ? job.driver.user.name ?? "Driver assigned" : "No driver yet"}
          </p>
        </div>

        <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end sm:justify-start">
          {load.kind === "loading" && <span className="inline-flex items-center gap-2 text-xs text-dark-400"><Loader2 size={13} className="animate-spin" /> Checking</span>}
          {load.kind === "idle" && <button type="button" onClick={onCheck} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.12] px-3 text-xs text-dark-200 hover:border-gold-500/40 hover:text-white">Check status</button>}
          {load.kind === "none" && <span className="text-xs text-dark-400">{load.reason === "not_found" ? "Flight not found" : load.reason === "not_configured" ? "Tracking is off" : "No data yet"}</span>}
          {view && (
            <div className="sm:text-right">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${TONE[view.tone].chip}`}>
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${TONE[view.tone].dot}`} />{view.headline}
              </span>
              {lands && <p className="mt-1.5 text-xs text-dark-400">{lands.label} <span className="tabular-nums text-dark-100">{lands.value}</span>{s?.arrivalTerminal ? ` · T${s.arrivalTerminal.replace(/^T/i, "")}` : ""}</p>}
            </div>
          )}
          <button type="button" onClick={onToggle} aria-expanded={expanded} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs text-gold-400 hover:bg-white/[0.04]">
            {expanded ? "Hide details" : "Flight details"} <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-4 px-4 pb-5 sm:px-5 lg:grid-cols-2">
              <FlightInfoCard bookingId={job.id} flightNumber={job.flightNumber} />
              <div className="self-start rounded-2xl border border-white/[0.08] p-4 text-sm">
                <p className="text-[11px] text-dark-500">Passenger</p>
                <p className="mt-1 text-white">{job.guestName ?? "Not given"}</p>
                {job.guestPhone && <a href={`tel:${job.guestPhone}`} className="mt-1 inline-block text-gold-400 hover:underline">{job.guestPhone}</a>}
                <p className="mt-4 text-[11px] text-dark-500">Driver</p>
                <p className="mt-1 text-white">{job.driver?.user.name ?? "Nobody yet"}</p>
                {job.driver?.user.phone && <a href={`tel:${job.driver.user.phone}`} className="mt-1 inline-block text-gold-400 hover:underline">{job.driver.user.phone}</a>}
                <Link href={`/partner/jobs?view=board`} className="mt-4 block text-xs text-gold-400 hover:underline">Open the dispatch board to assign or change the driver</Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

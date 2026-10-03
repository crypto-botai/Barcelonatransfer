"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Plane } from "lucide-react";
import EarningsPanel from "@/components/partner/EarningsPanel";
import FlightStatusBadge from "@/components/driver/FlightStatusBadge";
import { Figures, PageTitle, Skeleton, Status, euro, vehicleLabel, whenParts, primary } from "@/components/partner/ui";

type Summary = {
  company: string;
  periods: { today: { rides: number; earned: number }; week: { rides: number; earned: number }; month: { rides: number; earned: number } };
  balance: { totalEarned: number; totalWithdrawn: number; available: number; completedRides: number };
  incoming: number;
  driverCount: number;
  flights: number;
  roster: { id: string; name: string; status: string; jobs: number }[];
  next: { id: string; confirmationCode: string; status: string; pickupAddress: string; dropoffAddress: string; pickupDatetime: string; partnerPayout: number | null; passengers: number; vehicleClass: string; flightNumber: string | null; driver: { user: { name: string | null } } | null }[];
};

function greeting() {
  const h = Number(new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }));
  return h < 12 ? "Good morning" : h < 19 ? "Good afternoon" : "Good evening";
}

/** Flights are only looked up for pick-ups close enough to matter: the provider's allowance is finite. */
const soonEnough = (iso: string) => new Date(iso).getTime() - Date.now() <= 48 * 3600_000;

const rise = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function PartnerToday() {
  const [s, setS] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    fetch("/api/partner/summary", { cache: "no-store" }).then(async (r) => {
      if (!r.ok) throw new Error("Could not load");
      setS(await r.json());
    }).catch((e) => setErr(e.message));
  }, []);

  const today = new Date().toLocaleDateString("en-GB", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <PageTitle title={`${greeting()}.`} sub={today} />

      {err ? (
        <p className="text-sm text-red-300">{err}. Refresh to try again.</p>
      ) : !s ? (
        <div className="space-y-6"><Skeleton rows={1} h={96} /><Skeleton rows={1} h={300} /><Skeleton rows={3} /></div>
      ) : (
        <motion.div
          className="space-y-8"
          initial={reduce ? false : "hidden"} animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
        >
          {/* Something to act on comes first. */}
          {(s.incoming > 0 || s.flights > 0) && (
            <motion.div variants={rise} className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              {s.incoming > 0 ? (
                <Link href="/partner/jobs?view=board" className="group flex items-center justify-between gap-4 rounded-2xl border border-gold-500/40 bg-gold-500/[0.08] px-6 py-5 transition-colors hover:bg-gold-500/[0.12]">
                  <div>
                    <p className="font-display text-2xl text-white">{s.incoming} job{s.incoming > 1 ? "s" : ""} waiting for a driver</p>
                    <p className="mt-1 text-sm text-gold-200/80">Sent by Elite BCN. Assign one so the client gets their chauffeur&apos;s details.</p>
                  </div>
                  <ArrowRight className="shrink-0 text-gold-400 transition-transform group-hover:translate-x-1" />
                </Link>
              ) : (
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-6 py-5">
                  <p className="font-display text-2xl text-white">Every job has a driver</p>
                  <p className="mt-1 text-sm text-emerald-200/80">Nothing is waiting to be dispatched.</p>
                </div>
              )}
              {s.flights > 0 && (
                <Link href="/partner/flights" className="group flex items-center justify-between gap-4 rounded-2xl border border-white/[0.1] bg-white/[0.03] px-6 py-5 transition-colors hover:border-gold-500/30">
                  <div>
                    <p className="inline-flex items-center gap-2 font-display text-2xl text-white"><Plane size={18} className="text-gold-500" />{s.flights} flight{s.flights > 1 ? "s" : ""} in 24 hours</p>
                    <p className="mt-1 text-sm text-dark-400">See which are late before you send a driver.</p>
                  </div>
                  <ArrowRight className="shrink-0 text-gold-400 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
            </motion.div>
          )}

          <motion.section variants={rise}>
            <Figures items={[
              { label: "Today",      value: String(s.periods.today.rides), note: `${euro(s.periods.today.earned)} earned` },
              { label: "This week",  value: String(s.periods.week.rides),  note: `${euro(s.periods.week.earned)} earned` },
              { label: "This month", value: String(s.periods.month.rides), note: `${euro(s.periods.month.earned)} earned` },
              { label: "Available",  value: euro(s.balance.available), note: "ready to withdraw", tone: "gold" },
            ]} />
          </motion.section>

          <motion.div variants={rise} className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <EarningsPanel compact />

            <section aria-label="Your drivers" className="self-start rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl text-white">Drivers, next 24 hours</h2>
                <Link href="/partner/drivers" className="text-xs text-gold-400 hover:underline">Manage</Link>
              </div>
              {s.roster.length === 0 ? (
                <p className="mt-4 text-sm text-dark-400">No active driver yet. Add one under Drivers, then you can dispatch jobs to them.</p>
              ) : (
                <ul className="mt-4 space-y-3.5">
                  {s.roster.map((d) => {
                    const top = Math.max(3, ...s.roster.map((x) => x.jobs));
                    return (
                      <li key={d.id}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate text-white">{d.name}</span>
                          <span className={`shrink-0 text-xs ${d.jobs ? "text-sky-300" : "text-dark-500"}`}>{d.jobs ? `${d.jobs} job${d.jobs === 1 ? "" : "s"}` : "free"}</span>
                        </div>
                        <div className="mt-1.5 h-1 rounded-full bg-white/[0.06]" aria-hidden>
                          <motion.div
                            className="h-full rounded-full bg-sky-400/70"
                            initial={reduce ? false : { width: 0 }} animate={{ width: `${(d.jobs / top) * 100}%` }}
                            transition={{ duration: reduce ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link href="/partner/jobs?view=board" className={`${primary} mt-6 w-full`}>Open the dispatch board</Link>
            </section>
          </motion.div>

          <motion.section variants={rise}>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-xl text-white">Next pick-ups</h2>
              <Link href="/partner/jobs" className="text-xs text-gold-400 hover:underline">All jobs</Link>
            </div>
            {s.next.length === 0 ? (
              <p className="rounded-2xl border border-white/[0.08] px-5 py-8 text-center text-sm text-dark-400">Nothing scheduled. New jobs from Elite BCN appear here and by email.</p>
            ) : (
              <ol className="relative ml-3 max-w-4xl border-l border-white/[0.1]">
                {s.next.map((j) => {
                  const w = whenParts(j.pickupDatetime);
                  return (
                    <li key={j.id} className="relative pb-6 pl-6 last:pb-0">
                      <span aria-hidden className={`absolute -left-[5px] top-2 h-[9px] w-[9px] rounded-full border ${j.status === "CONFIRMED" ? "border-gold-400 bg-gold-500" : "border-white/30 bg-[#0b0a08]"}`} />
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] text-dark-500">{w.day} at <span className="text-white">{w.time}</span></p>
                          <p className="mt-1 truncate text-white">{j.pickupAddress}</p>
                          <p className="truncate text-sm text-dark-400">to {j.dropoffAddress || "as arranged"}</p>
                          <p className="mt-1 text-xs text-dark-500">{vehicleLabel(j.vehicleClass)} · {j.passengers} pax{j.driver?.user.name ? ` · ${j.driver.user.name}` : " · no driver yet"}</p>
                          {j.flightNumber && soonEnough(j.pickupDatetime) && <div className="mt-2"><FlightStatusBadge bookingId={j.id} flightNumber={j.flightNumber} /></div>}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Status status={j.status} />
                          <span className="font-display text-lg text-gold-400">{euro(j.partnerPayout)}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </motion.section>
        </motion.div>
      )}
    </div>
  );
}

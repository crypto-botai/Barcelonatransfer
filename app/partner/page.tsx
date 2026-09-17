"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Figures, PageTitle, Skeleton, Status, euro, vehicleLabel, whenParts, primary } from "@/components/partner/ui";

type Summary = {
  company: string;
  periods: { today: { rides: number; earned: number }; week: { rides: number; earned: number }; month: { rides: number; earned: number } };
  balance: { totalEarned: number; totalWithdrawn: number; available: number; completedRides: number };
  incoming: number;
  driverCount: number;
  next: { id: string; confirmationCode: string; status: string; pickupAddress: string; dropoffAddress: string; pickupDatetime: string; partnerPayout: number | null; passengers: number; vehicleClass: string; driver: { user: { name: string | null } } | null }[];
};

function greeting() {
  const h = Number(new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }));
  return h < 12 ? "Good morning" : h < 19 ? "Good afternoon" : "Good evening";
}

export default function PartnerToday() {
  const [s, setS] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    fetch("/api/partner/summary").then(async (r) => {
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
        <div className="space-y-6"><Skeleton rows={1} h={96} /><Skeleton rows={3} /></div>
      ) : (
        <motion.div
          className="space-y-8"
          initial={reduce ? false : "hidden"} animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
        >
          {/* Something to act on comes first. */}
          {s.incoming > 0 && (
            <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
              <Link href="/partner/jobs?scope=incoming" className="group flex items-center justify-between rounded-2xl border border-gold-500/40 bg-gold-500/[0.08] px-6 py-5 transition-colors hover:bg-gold-500/[0.12]">
                <div>
                  <p className="font-display text-2xl text-white">{s.incoming} job{s.incoming > 1 ? "s" : ""} waiting for a driver</p>
                  <p className="mt-1 text-sm text-gold-200/80">Sent by Elite BCN. Dispatch them so the client gets their chauffeur's details.</p>
                </div>
                <ArrowRight className="text-gold-400 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          )}

          <motion.section variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
            <Figures items={[
              { label: "Today",      value: String(s.periods.today.rides), note: `${euro(s.periods.today.earned)} earned` },
              { label: "This week",  value: String(s.periods.week.rides),  note: `${euro(s.periods.week.earned)} earned` },
              { label: "This month", value: String(s.periods.month.rides), note: `${euro(s.periods.month.earned)} earned` },
              { label: "Available",  value: euro(s.balance.available), note: "ready to withdraw", tone: "gold" },
            ]} />
          </motion.section>

          <motion.section variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-xl text-white">Next pick-ups</h2>
              <Link href="/partner/jobs" className="text-xs text-gold-400 hover:underline">All jobs</Link>
            </div>
            {s.next.length === 0 ? (
              <p className="rounded-2xl border border-white/[0.08] px-5 py-8 text-center text-sm text-dark-400">Nothing scheduled. New jobs from Elite BCN appear here and by email.</p>
            ) : (
              <ol className="relative ml-3 border-l border-white/[0.1]">
                {s.next.map((j) => {
                  const w = whenParts(j.pickupDatetime);
                  return (
                    <li key={j.id} className="relative pb-6 pl-6 last:pb-0">
                      <span aria-hidden className={`absolute -left-[5px] top-2 h-[9px] w-[9px] rounded-full border ${j.status === "CONFIRMED" ? "border-gold-400 bg-gold-500" : "border-white/30 bg-[#0b0a08]"}`} />
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-[0.15em] text-dark-500">{w.day} at <span className="text-white">{w.time}</span></p>
                          <p className="mt-1 truncate text-white">{j.pickupAddress}</p>
                          <p className="truncate text-sm text-dark-400">to {j.dropoffAddress || "as arranged"}</p>
                          <p className="mt-1 text-xs text-dark-500">{vehicleLabel(j.vehicleClass)} · {j.passengers} pax{j.driver?.user.name ? ` · ${j.driver.user.name}` : ""}</p>
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

          <motion.section variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] px-6 py-5">
            <div>
              <p className="font-display text-xl text-white">{s.driverCount} driver{s.driverCount === 1 ? "" : "s"} on your roster</p>
              <p className="text-sm text-dark-400">Each has their own Elite BCN driver login for the jobs you give them.</p>
            </div>
            <Link href="/partner/drivers" className={primary}>Manage drivers</Link>
          </motion.section>
        </motion.div>
      )}
    </div>
  );
}

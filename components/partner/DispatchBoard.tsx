"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plane, Users } from "lucide-react";
import type { Driver, Job } from "./types";
import { Status, vehicleLabel, whenParts } from "./ui";

/**
 * The dispatcher's board: one lane for the jobs nobody has, then one lane per
 * driver with what they are carrying, in pick-up order.
 *
 * Reading it left to right answers the two questions that matter before a
 * shift: what is still unassigned, and who is already stacked. Choosing a job
 * opens its full record, and an unassigned one opens straight to the dispatch
 * sheet. Nothing is dragged: a dispatch also fixes what the driver is told they
 * will earn, and that decision deserves a form, not a drop.
 */

const lanesFor = (jobs: Job[], drivers: Driver[]) => {
  const open = jobs.filter((j) => j.status !== "COMPLETED" && j.status !== "CANCELLED" && j.status !== "REFUNDED");
  const unassigned = open.filter((j) => !j.driver);
  const byDriver = new Map<string, { id: string; name: string; car: string | null; jobs: Job[] }>();
  for (const d of drivers) {
    const v = d.vehicles[0];
    byDriver.set(d.id, { id: d.id, name: d.user.name ?? "Driver", car: v ? `${v.make} ${v.model} · ${v.licensePlate}` : null, jobs: [] });
  }
  for (const j of open) {
    if (!j.driver) continue;
    // A driver taken off the roster since still has the job on them: keep the lane rather than lose the job.
    const lane = byDriver.get(j.driver.id) ?? { id: j.driver.id, name: j.driver.user.name ?? "Driver", car: null, jobs: [] };
    lane.jobs.push(j);
    byDriver.set(j.driver.id, lane);
  }
  return { unassigned, drivers: [...byDriver.values()] };
};

function Card({ job, onOpen, onDispatch, needsDriver }: { job: Job; onOpen: (j: Job) => void; onDispatch: (j: Job) => void; needsDriver: boolean }) {
  const w = whenParts(job.pickupDatetime);
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 420, damping: 36 }}>
      <div className={`rounded-xl border p-3.5 transition-colors ${needsDriver ? "border-gold-500/30 bg-gold-500/[0.05] hover:border-gold-500/50" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"}`}>
        <button type="button" onClick={() => onOpen(job)} className="block w-full text-left focus-visible:outline-none">
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-display text-[22px] leading-none tabular-nums text-white">{w.time}</span>
            <span className="text-[11px] text-dark-400">{w.day}</span>
          </span>
          <span className="mt-2 block truncate text-sm text-white">{job.pickupAddress}</span>
          <span className="block truncate text-xs text-dark-400">to {job.dropoffAddress || "as arranged"}</span>
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-dark-400">
            <span className="font-mono tracking-wider text-gold-400">{job.confirmationCode}</span>
            <span>{job.passengers} pax</span>
            <span>{vehicleLabel(job.vehicleClass)}</span>
            {job.flightNumber && <span className="inline-flex items-center gap-1"><Plane size={11} /> {job.flightNumber}</span>}
          </span>
        </button>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Status status={needsDriver && job.status === "DRIVER_ASSIGNED" ? "CONFIRMED" : job.status} />
          {needsDriver && (
            <button type="button" onClick={() => onDispatch(job)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gold-500 px-3 text-xs font-semibold text-black transition-[transform,background-color] hover:bg-gold-400 active:scale-[0.97]">
              <Users size={12} /> Assign
            </button>
          )}
        </div>
      </div>
    </motion.li>
  );
}

export default function PartnerDispatchBoard({ jobs, drivers, onOpen, onDispatch }: { jobs: Job[]; drivers: Driver[]; onOpen: (j: Job) => void; onDispatch: (j: Job) => void }) {
  const reduce = useReducedMotion();
  const { unassigned, drivers: lanes } = lanesFor(jobs, drivers);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
      className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin] sm:mx-0 sm:px-0"
      role="list" aria-label="Dispatch board"
    >
      <section role="listitem" aria-label="Needs a driver" className="w-[17.5rem] shrink-0 snap-start sm:w-72">
        <header className="mb-3 min-h-[3.4rem] border-b border-gold-500/40 pb-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg text-gold-300">Needs a driver</h2>
            <span className="text-xs tabular-nums text-gold-300/80">{unassigned.length}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-gold-200/60">Waiting for you to assign</p>
        </header>
        {unassigned.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-8 text-center text-sm text-dark-400">Every job has a driver.</p>
        ) : (
          <ul className="space-y-3"><AnimatePresence initial={false}>{unassigned.map((j) => <Card key={j.id} job={j} needsDriver onOpen={(x) => onDispatch(x)} onDispatch={onDispatch} />)}</AnimatePresence></ul>
        )}
      </section>

      {lanes.map((d) => (
        <section key={d.id} role="listitem" aria-label={d.name} className="w-[17.5rem] shrink-0 snap-start sm:w-72">
          <header className="mb-3 min-h-[3.4rem] border-b border-white/[0.1] pb-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="truncate font-display text-lg text-white">{d.name}</h2>
              <span className="text-xs tabular-nums text-dark-400">{d.jobs.length ? `${d.jobs.length} job${d.jobs.length === 1 ? "" : "s"}` : "free"}</span>
            </div>
            {d.car && <p className="mt-0.5 truncate text-[11px] text-dark-500">{d.car}</p>}
          </header>
          {d.jobs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-8 text-center text-sm text-dark-500">Nothing assigned.</p>
          ) : (
            <ul className="space-y-3"><AnimatePresence initial={false}>{d.jobs.map((j) => <Card key={j.id} job={j} needsDriver={false} onOpen={onOpen} onDispatch={onDispatch} />)}</AnimatePresence></ul>
          )}
        </section>
      ))}

      {lanes.length === 0 && (
        <p className="self-start rounded-xl border border-dashed border-white/[0.1] px-5 py-8 text-sm text-dark-400">No driver on your roster yet. Add one under Drivers, then assign jobs from here.</p>
      )}
    </motion.div>
  );
}

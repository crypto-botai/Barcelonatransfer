"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle, Clock, Plane, Phone, MessageCircle, Users,
  Briefcase, CheckCircle2, Loader2, MapPin, CircleDot,
} from "lucide-react";
import toast from "react-hot-toast";
import { isAssignableDriver } from "@/lib/driver-roster";

export interface DispatchJob {
  id: string; code: string; status: string; paymentStatus: string;
  pickupAddress: string; dropoffAddress: string; pickupDatetime: string;
  passengers: number; luggage: number; vehicleClass: string;
  flightNumber: string | null; totalAmount: number;
  guestName: string | null; guestPhone: string | null;
  driverId: string | null; driverName: string | null;
}

export interface DispatchDriver {
  id: string; name: string; phone: string | null; status: string;
  rating: number; vehicle: string | null; plate: string | null;
  jobsToday: number; lastSeenAt: string | null; hasLocation: boolean;
}

const DRIVER_STATE: Record<string, { label: string; cls: string }> = {
  ONLINE:   { label: "Available", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  ON_RIDE:  { label: "On a ride", cls: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  OFFLINE:  { label: "Offline",   cls: "text-dark-400 bg-white/[0.04] border-white/[0.08]" },
  APPROVED: { label: "Approved",  cls: "text-dark-300 bg-white/[0.04] border-white/[0.08]" },
};

function hoursUntil(iso: string) {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const h = hoursUntil(iso);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (h < 0)  return `${time} · started`;
  if (h < 1)  return `${time} · in ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 24) return `${time} · in ${Math.round(h)} h`;
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${time}`;
}

export default function DispatchBoard({
  jobs: initialJobs,
  drivers,
}: {
  jobs: DispatchJob[];
  drivers: DispatchDriver[];
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [assigning, setAssigning] = useState<string | null>(null);

  const { unassigned, assigned, urgent } = useMemo(() => {
    const un = jobs.filter((j) => !j.driverId);
    return {
      unassigned: un,
      assigned:   jobs.filter((j) => j.driverId),
      // The number that should drive behaviour: jobs with nobody on them and
      // less than four hours to go.
      urgent: un.filter((j) => hoursUntil(j.pickupDatetime) < 4).length,
    };
  }, [jobs]);

  async function assign(jobId: string, driverId: string) {
    if (!driverId) return;
    setAssigning(jobId);
    try {
      const res = await fetch(`/api/bookings/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const name = drivers.find((d) => d.id === driverId)?.name ?? "Driver";
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, driverId, driverName: name, status: "DRIVER_ASSIGNED" } : j)),
      );
      toast.success(`Assigned to ${name} — customer notified`);
    } catch {
      toast.error("Could not assign. Try again.");
    } finally {
      setAssigning(null);
    }
  }

  // Was `ONLINE || APPROVED`, which hid every driver who was off duty or
  // already on a ride — so a booking for next week could not be given to
  // anyone who happened to be busy now. See lib/driver-roster.
  const available = drivers.filter((d) => isAssignableDriver(d.status));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-white font-semibold text-lg">Dispatch</h1>
          <p className="text-dark-400 text-sm mt-0.5">Next 36 hours</p>
        </div>
        <div className="flex gap-2">
          <Stat label="Need a driver" value={unassigned.length} tone={unassigned.length ? "warn" : "ok"} />
          <Stat label="Under 4 h"     value={urgent}            tone={urgent ? "bad" : "ok"} />
          <Stat label="Covered"       value={assigned.length}   tone="ok" />
          <Stat label="Drivers free"  value={available.length}  tone={available.length ? "ok" : "warn"} />
        </div>
      </header>

      {/* Unassigned first — this is the queue that needs action */}
      <section className="space-y-3">
        <h2 className="text-white text-sm font-medium flex items-center gap-2">
          <AlertTriangle size={14} className={unassigned.length ? "text-amber-400" : "text-dark-500"} />
          Waiting for a driver
          <span className="text-dark-500 font-normal">({unassigned.length})</span>
        </h2>

        {unassigned.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center border border-white/[0.06]">
            <CheckCircle2 size={26} className="text-emerald-400 mx-auto mb-2" />
            <p className="text-white text-sm font-medium">Every job has a driver</p>
            <p className="text-dark-400 text-xs mt-1">Nothing needs your attention right now.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {unassigned.map((j) => (
              <JobRow
                key={j.id}
                job={j}
                drivers={available}
                busy={assigning === j.id}
                onAssign={(driverId) => assign(j.id, driverId)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Covered jobs */}
      {assigned.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-white text-sm font-medium flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400" />
            Covered <span className="text-dark-500 font-normal">({assigned.length})</span>
          </h2>
          <div className="space-y-2">
            {assigned.map((j) => <JobRow key={j.id} job={j} drivers={available} busy={false} onAssign={() => {}} />)}
          </div>
        </section>
      )}

      {/* Fleet */}
      <section className="space-y-3">
        <h2 className="text-white text-sm font-medium">Drivers</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {drivers.map((d) => {
            const s = DRIVER_STATE[d.status] ?? DRIVER_STATE.OFFLINE;
            return (
              <div key={d.id} className="glass-card rounded-xl p-3.5 border border-white/[0.06]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{d.name}</p>
                    <p className="text-dark-500 text-xs truncate">
                      {d.vehicle ?? "No vehicle on file"}{d.plate ? ` · ${d.plate}` : ""}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-medium whitespace-nowrap ${s.cls}`}>
                    {s.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2.5 text-[11px] text-dark-500">
                  <span>{d.jobsToday} job{d.jobsToday === 1 ? "" : "s"}</span>
                  {d.rating > 0 && <span>{d.rating.toFixed(1)}★</span>}
                  <span className="flex items-center gap-1">
                    <CircleDot size={9} className={d.hasLocation ? "text-emerald-400" : "text-dark-500"} />
                    {d.hasLocation ? "Location on" : "No location"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "bad" }) {
  const cls =
    tone === "bad"  ? "text-red-400 border-red-500/25 bg-red-500/[0.07]"
  : tone === "warn" ? "text-amber-400 border-amber-500/25 bg-amber-500/[0.07]"
  :                   "text-dark-300 border-white/[0.08] bg-white/[0.03]";
  return (
    <div className={`rounded-xl border px-3 py-2 min-w-[5.5rem] ${cls}`}>
      <p className="text-xl font-semibold tabular-nums leading-none">{value}</p>
      <p className="text-[10px] mt-1 opacity-80">{label}</p>
    </div>
  );
}

function JobRow({
  job, drivers, busy, onAssign,
}: {
  job: DispatchJob;
  drivers: DispatchDriver[];
  busy: boolean;
  onAssign: (driverId: string) => void;
}) {
  const h = hoursUntil(job.pickupDatetime);
  const soon = !job.driverId && h < 4;
  const unpaid = job.paymentStatus !== "PAID";

  return (
    <div className={`glass-card rounded-xl p-3.5 border ${soon ? "border-amber-500/30 bg-amber-500/[0.03]" : "border-white/[0.06]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/admin/bookings?q=${job.code}`} className="text-gold-400 text-xs font-mono hover:underline">
              {job.code}
            </Link>
            <span className={`text-[11px] flex items-center gap-1 ${soon ? "text-amber-300" : "text-dark-400"}`}>
              <Clock size={10} /> {timeLabel(job.pickupDatetime)}
            </span>
            {job.flightNumber && (
              <span className="text-[11px] text-blue-400 flex items-center gap-1">
                <Plane size={10} /> {job.flightNumber}
              </span>
            )}
            {unpaid && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                UNPAID
              </span>
            )}
          </div>

          <p className="text-white text-sm mt-1.5 leading-snug">
            {job.pickupAddress} <span className="text-dark-500">→</span> {job.dropoffAddress}
          </p>

          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-dark-500 flex-wrap">
            <span className="flex items-center gap-1"><Users size={10} /> {job.passengers}</span>
            <span className="flex items-center gap-1"><Briefcase size={10} /> {job.luggage}</span>
            <span>{job.vehicleClass.replace(/_/g, " ")}</span>
            <span className="text-gold-400 font-medium">€{job.totalAmount}</span>
            {job.guestName && <span>{job.guestName}</span>}
            {job.guestPhone && (
              <span className="flex items-center gap-1.5">
                <a href={`tel:${job.guestPhone}`} className="hover:text-white" aria-label="Call customer"><Phone size={10} /></a>
                <a href={`https://wa.me/${job.guestPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                   className="text-emerald-400 hover:text-emerald-300" aria-label="WhatsApp customer">
                  <MessageCircle size={10} />
                </a>
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          {job.driverId ? (
            <div className="text-right">
              <p className="text-emerald-400 text-xs font-medium">{job.driverName}</p>
              <Link href={`/dashboard/tracking/${job.id}`} className="text-dark-500 text-[10px] hover:text-white flex items-center gap-1 justify-end mt-0.5">
                <MapPin size={9} /> Track
              </Link>
            </div>
          ) : busy ? (
            <div className="flex items-center gap-2 text-dark-400 text-xs px-3 py-2">
              <Loader2 size={13} className="animate-spin" /> Assigning…
            </div>
          ) : drivers.length === 0 ? (
            <p className="text-amber-400 text-[11px] max-w-[9rem] text-right">No driver is available</p>
          ) : (
            <select
              defaultValue=""
              onChange={(e) => onAssign(e.target.value)}
              aria-label={`Assign a driver to booking ${job.code}`}
              className="bg-white/[0.05] border border-white/[0.1] rounded-lg text-xs text-white px-2.5 py-2 focus:border-gold-500/50 outline-none"
            >
              <option value="" disabled>Assign driver…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id} className="bg-[#141310]">
                  {d.name}{d.jobsToday ? ` (${d.jobsToday})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}

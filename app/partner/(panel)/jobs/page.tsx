"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, Check, Loader2, MapPin, MessageSquare, Phone, Plane, Users } from "lucide-react";
import { ChatSheet, LiveLocationSheet, NoShowSheet } from "@/components/partner/JobTools";
import toast from "react-hot-toast";
import { Empty, PageTitle, Sheet, Skeleton, Status, euro, field, ghost, label, primary, vehicleLabel, whenParts } from "@/components/partner/ui";

type Job = {
  id: string; confirmationCode: string; status: string;
  guestName: string | null; guestPhone: string | null;
  pickupAddress: string; dropoffAddress: string; pickupDatetime: string;
  pickupLat?: number | null; pickupLng?: number | null; dropoffLat?: number | null; dropoffLng?: number | null;
  passengers: number; luggage: number; vehicleClass: string; flightNumber: string | null; specialRequests: string | null;
  noShow?: { images: string[]; note: string | null; waitedMin: number | null; createdAt: string; lat: number | null; lng: number | null } | null;
  partnerPayout: number | null; driverAmount: number | null; partnerDispatchedAt: string | null;
  driver: { id: string; user: { name: string | null; phone: string | null }; vehicles: { make: string; model: string; licensePlate: string }[] } | null;
};
type Driver = {
  id: string; status: string; user: { name: string | null; phone: string | null };
  vehicles: { make: string; model: string; licensePlate: string; class: string }[];
  _count: { bookings: number };
};

const SCOPES = [
  { id: "incoming",  label: "Incoming" },
  { id: "active",    label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;
type Scope = (typeof SCOPES)[number]["id"];

export default function PartnerJobsPage() {
  return <Suspense fallback={<Skeleton rows={4} />}><Jobs /></Suspense>;
}

function Jobs() {
  const params = useSearchParams();
  const router = useRouter();
  const reduce = useReducedMotion();
  const scope = (SCOPES.some((s) => s.id === params.get("scope")) ? params.get("scope") : "incoming") as Scope;

  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [dispatching, setDispatching] = useState<Job | null>(null);
  const [locating, setLocating] = useState<Job | null>(null);
  const [proof, setProof] = useState<Job | null>(null);
  const [chatting, setChatting] = useState<Job | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/partner/jobs?scope=${scope}`);
    if (r.ok) setJobs(await r.json());
  }, [scope]);

  useEffect(() => { setJobs(null); load(); }, [load]);
  useEffect(() => { fetch("/api/partner/drivers").then((r) => r.ok ? r.json() : []).then(setDrivers).catch(() => {}); }, []);

  const activeDrivers = useMemo(() => drivers.filter((d) => d.status !== "SUSPENDED" && d.status !== "PENDING_APPROVAL"), [drivers]);

  async function complete(job: Job) {
    if (!confirm(`Mark ${job.confirmationCode} as completed? Your payout of ${euro(job.partnerPayout)} becomes available.`)) return;
    setCompleting(job.id);
    try {
      const r = await fetch(`/api/partner/jobs/${job.id}/complete`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      toast.success("Completed. Payout added to your balance.");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setCompleting(null); }
  }

  return (
    <div>
      <PageTitle title="Jobs" sub="Everything Elite BCN has sent your company." />

      {/* Scope switch: one underline that travels. */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-white/[0.08]" role="tablist">
        {SCOPES.map((s) => {
          const active = s.id === scope;
          return (
            <button
              key={s.id} role="tab" aria-selected={active}
              onClick={() => router.replace(`/partner/jobs?scope=${s.id}`)}
              className={`relative h-11 whitespace-nowrap px-4 text-sm transition-colors ${active ? "text-white" : "text-dark-400 hover:text-white"}`}
            >
              {s.label}
              {active && <motion.span layoutId="jobs-scope" className="absolute inset-x-2 -bottom-px h-[2px] bg-gold-500" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} />}
            </button>
          );
        })}
      </div>

      {jobs === null ? (
        <Skeleton rows={4} h={120} />
      ) : jobs.length === 0 ? (
        <Empty
          title={scope === "incoming" ? "No job is waiting" : `Nothing ${scope}`}
          body={scope === "incoming" ? "When Elite BCN sends your company a job it appears here, and the contact on your account receives an email." : "Jobs move here as their status changes."}
        />
      ) : (
        <motion.ul className="space-y-3" initial={reduce ? false : "hidden"} animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
          <AnimatePresence initial={false}>
            {jobs.map((j) => {
              const w = whenParts(j.pickupDatetime);
              const canDispatch = j.status === "CONFIRMED";
              const canComplete = j.status === "DRIVER_ASSIGNED" || j.status === "IN_PROGRESS";
              const v = j.driver?.vehicles[0];
              return (
                <motion.li
                  key={j.id} layout
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="grid grid-cols-1 gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:grid-cols-[96px_minmax(0,1fr)_auto]"
                >
                  {/* When */}
                  <div className="sm:border-r sm:border-white/[0.08] sm:pr-4">
                    <p className="font-display text-[28px] leading-none text-white tabular-nums">{w.time}</p>
                    <p className="mt-1 text-xs text-dark-400">{w.day}</p>
                    <p className="mt-2 font-mono text-[11px] tracking-wider text-gold-400">{j.confirmationCode}</p>
                  </div>

                  {/* What */}
                  <div className="min-w-0">
                    <p className="truncate text-white">{j.pickupAddress}</p>
                    <p className="truncate text-sm text-dark-400">to {j.dropoffAddress || "as arranged"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dark-400">
                      <span className="inline-flex items-center gap-1"><Users size={12} /> {j.passengers} pax, {j.luggage} bags</span>
                      <span>{vehicleLabel(j.vehicleClass)}</span>
                      {j.flightNumber && <span className="inline-flex items-center gap-1"><Plane size={12} /> {j.flightNumber}</span>}
                    </div>
                    {(j.guestName || j.guestPhone) && (
                      <p className="mt-2 text-sm text-dark-200">
                        {j.guestName}
                        {j.guestPhone && <a href={`tel:${j.guestPhone}`} className="ml-2 inline-flex items-center gap-1 text-gold-400 hover:underline"><Phone size={12} /> {j.guestPhone}</a>}
                      </p>
                    )}
                    {j.specialRequests && <p className="mt-1 text-xs text-dark-500">{j.specialRequests}</p>}
                    {j.driver && (
                      <p className="mt-2 text-sm text-sky-200">
                        {j.driver.user.name}{v ? ` · ${v.make} ${v.model} · ${v.licensePlate}` : ""}
                        {j.driverAmount != null && <span className="text-dark-500"> · sees {euro(j.driverAmount)}</span>}
                      </p>
                    )}
                    {(canComplete || j.noShow) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canComplete && (
                          <button type="button" onClick={() => setLocating(j)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 text-xs text-dark-200 hover:border-white/20 hover:text-white">
                            <MapPin size={13} /> Live location
                          </button>
                        )}
                        {canComplete && (
                          <button type="button" onClick={() => setChatting(j)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 text-xs text-dark-200 hover:border-white/20 hover:text-white">
                            <MessageSquare size={13} /> Chat
                          </button>
                        )}
                        {j.noShow && (
                          <button type="button" onClick={() => setProof(j)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 text-xs text-amber-200 hover:bg-amber-500/20">
                            <Camera size={13} /> No-show proof
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Money and the one action */}
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-dark-500">Your payout</p>
                      <p className="font-display text-2xl text-gold-400">{euro(j.partnerPayout)}</p>
                    </div>
                    <Status status={j.status} />
                    {canDispatch && <button type="button" onClick={() => setDispatching(j)} className={primary}>Dispatch</button>}
                    {canComplete && (
                      <button type="button" onClick={() => complete(j)} disabled={completing === j.id} className={ghost}>
                        {completing === j.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Completed
                      </button>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      )}

      <DispatchSheet job={dispatching} drivers={activeDrivers} onClose={() => setDispatching(null)} onDone={() => { setDispatching(null); load(); }} />
      <LiveLocationSheet job={locating} onClose={() => setLocating(null)} />
      <NoShowSheet job={proof} onClose={() => setProof(null)} />
      <ChatSheet job={chatting} onClose={() => setChatting(null)} />
    </div>
  );
}

function DispatchSheet({ job, drivers, onClose, onDone }: { job: Job | null; drivers: Driver[]; onClose: () => void; onDone: () => void }) {
  const [driverId, setDriverId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (job) { setDriverId(""); setAmount(job.partnerPayout != null ? String(job.partnerPayout) : ""); }
  }, [job]);

  async function submit() {
    if (!job || !driverId) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/partner/jobs/${job.id}/dispatch`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId, driverAmount: amount === "" ? null : parseFloat(amount) }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      toast.success("Dispatched. The client, the driver and Elite BCN have been told.");
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }

  const w = job ? whenParts(job.pickupDatetime) : null;

  return (
    <Sheet open={Boolean(job)} onClose={onClose} title="Dispatch">
      {job && w && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/[0.08] p-4">
            <p className="font-mono text-[11px] tracking-wider text-gold-400">{job.confirmationCode}</p>
            <p className="mt-1 text-white">{w.day} at {w.time}</p>
            <p className="mt-1 text-sm text-dark-300">{job.pickupAddress}</p>
            <p className="text-sm text-dark-400">to {job.dropoffAddress || "as arranged"}</p>
          </div>

          <div>
            <p className={label}>Driver</p>
            {drivers.length === 0 ? (
              <p className="text-sm text-dark-400">No active driver on your roster. Add one under Drivers first.</p>
            ) : (
              <div className="space-y-2" role="radiogroup" aria-label="Driver">
                {drivers.map((d) => {
                  const v = d.vehicles[0];
                  const on = d.id === driverId;
                  return (
                    <button
                      key={d.id} type="button" role="radio" aria-checked={on}
                      onClick={() => setDriverId(d.id)}
                      className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${on ? "border-gold-500/60 bg-gold-500/[0.08]" : "border-white/[0.1] hover:border-white/20"}`}
                    >
                      <span>
                        <span className="block text-sm text-white">{d.user.name}</span>
                        <span className="block text-xs text-dark-400">{v ? `${v.make} ${v.model} · ${v.licensePlate}` : "No vehicle on file"}</span>
                      </span>
                      <span className="text-xs text-dark-500">{d._count.bookings ? `${d._count.bookings} active` : "free"}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="driver-amount" className={label}>What the driver sees (€)</label>
            <input id="driver-amount" type="number" min={0} step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
            <p className="mt-1.5 text-xs text-dark-500">Your payout from Elite BCN is {euro(job.partnerPayout)}. The driver is shown only this figure, on their job sheet and in their portal.</p>
          </div>

          <button type="button" onClick={submit} disabled={!driverId || busy} className={`${primary} w-full`}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Confirm dispatch
          </button>
          <p className="text-xs text-dark-500">The client receives the chauffeur's name, phone, vehicle and plate under the Elite BCN name. Your company is not mentioned.</p>
        </div>
      )}
    </Sheet>
  );
}

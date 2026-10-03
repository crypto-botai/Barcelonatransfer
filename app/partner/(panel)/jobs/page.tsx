"use client";


import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, Check, Loader2, Mail, MapPin, MessageSquare, Phone, Plane, Undo2, Users, Wallet } from "lucide-react";
import { ChatSheet, LiveLocationSheet, NoShowSheet } from "@/components/partner/JobTools";
import FlightInfoCard from "@/components/flight/FlightInfoCard";
import toast from "react-hot-toast";
import { Empty, PageTitle, Sheet, Skeleton, Status, euro, field, ghost, label, primary, vehicleLabel, whenParts } from "@/components/partner/ui";

type Job = {
  id: string; confirmationCode: string; status: string;
  guestName: string | null; guestPhone: string | null; guestEmail: string | null;
  pickupAddress: string; dropoffAddress: string; pickupDatetime: string;
  pickupLat?: number | null; pickupLng?: number | null; dropoffLat?: number | null; dropoffLng?: number | null;
  passengers: number; luggage: number; vehicleClass: string; flightNumber: string | null;
  /** The customer's own words, extras by name, stops. No prices: see the jobs route. */
  notes: string | null; extras: { id: string; label: string; quantity: number }[]; stops: string[]; durationHours: number | null;
  /** What the driver collects from the client on the day. */
  collect: number;
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
  const [counts, setCounts] = useState<Record<Scope, number> | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [dispatching, setDispatching] = useState<Job | null>(null);
  const [locating, setLocating] = useState<Job | null>(null);
  const [proof, setProof] = useState<Job | null>(null);
  const [chatting, setChatting] = useState<Job | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [detail, setDetail] = useState<Job | null>(null);
  const [undispatching, setUndispatching] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/partner/jobs?scope=${scope}`);
    if (r.ok) {
      const body = await r.json();
      setJobs(body.jobs);
      setCounts(body.counts);
    }
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

  /** Take the driver back off a job, leaving it waiting for another. */
  async function undispatch(job: Job) {
    const who = job.driver?.user.name ?? "the driver";
    if (!confirm(`Take ${who} off ${job.confirmationCode}? The job goes back to Incoming and can be given to someone else.`)) return;
    setUndispatching(job.id);
    try {
      const r = await fetch(`/api/partner/jobs/${job.id}/undispatch`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      toast.success("Driver taken off. The job is waiting under Incoming.");
      setDetail(null);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setUndispatching(null); }
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
              {/*
                The count is the point. An empty Incoming tab with no number
                beside the others reads as an empty portal, and the job, its
                driver and the dispatch button are one tab away.
                aria-label carries the meaning so a screen reader does not
                hear a bare digit.
              */}
              <span className="inline-flex items-center gap-2">
                {s.label}
                {counts && counts[s.id] > 0 && (
                  <span
                    aria-label={`${counts[s.id]} ${s.label.toLowerCase()}`}
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
                      s.id === "incoming"
                        ? "bg-gold-500/20 text-gold-300"
                        : active ? "bg-white/[0.12] text-white" : "bg-white/[0.06] text-dark-400"
                    }`}
                  >
                    {counts[s.id]}
                  </span>
                )}
              </span>
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
          body={
            // Say where the jobs went. An empty Incoming does not mean an
            // empty portal, and reading it that way is how a company concludes
            // the panel cannot dispatch at all.
            counts && counts.active > 0 && scope === "incoming"
              ? `Nothing new to dispatch. You have ${counts.active} job${counts.active === 1 ? "" : "s"} already with a driver under Active.`
              : scope === "incoming"
                ? "When Elite BCN sends your company a job it appears here, and the contact on your account receives an email."
                : "Jobs move here as their status changes."
          }
        />
      ) : (
        <motion.ul className="space-y-3" initial={reduce ? false : "hidden"} animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
          <AnimatePresence initial={false}>
            {jobs.map((j) => {
              const w = whenParts(j.pickupDatetime);
              // A job with no driver needs one, whatever the status says. A
              // deleted driver used to leave the status at DRIVER_ASSIGNED,
              // which read as "Dispatched" and hid the only button that could
              // put somebody back on it.
              const needsDriver = !j.driver;
              const canDispatch = j.status === "CONFIRMED" || (j.status === "DRIVER_ASSIGNED" && needsDriver);
              // Not before the ride. completePartnerJob refuses a pickup
              // more than an hour out, so offering the button earlier is
              // offering one that fails - and the failure it prevents is a
              // customer asked to rate a journey they have not taken.
              const rideIsDue = new Date(j.pickupDatetime).getTime() - Date.now() <= 60 * 60 * 1000;
              const canComplete = (j.status === "DRIVER_ASSIGNED" || j.status === "IN_PROGRESS") && rideIsDue;
              // The tools stay available for the whole dispatched job.
              const isLive = j.status === "DRIVER_ASSIGNED" || j.status === "IN_PROGRESS";
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
                    {/*
                      The row itself opens the full record. Everything below is
                      the summary a dispatcher scans; the sheet is where the
                      rest of it lives.
                    */}
                    <button
                      type="button" onClick={() => setDetail(j)}
                      className="mb-1 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-dark-500 transition-colors hover:text-gold-400"
                    >
                      Ride details
                    </button>
                    <p className="truncate text-white">{j.pickupAddress}</p>
                    <p className="truncate text-sm text-dark-400">to {j.dropoffAddress || "as arranged"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dark-400">
                      <span className="inline-flex items-center gap-1"><Users size={12} /> {j.passengers} pax, {j.luggage} bags</span>
                      <span>{vehicleLabel(j.vehicleClass)}</span>
                      {j.flightNumber && <span className="inline-flex items-center gap-1"><Plane size={12} /> {j.flightNumber}</span>}
                    </div>
                    {(j.guestName || j.guestPhone || j.guestEmail) && (
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-dark-200">
                        {j.guestName}
                        {j.guestPhone && <a href={`tel:${j.guestPhone}`} className="inline-flex items-center gap-1 text-gold-400 hover:underline"><Phone size={12} /> {j.guestPhone}</a>}
                        {j.guestEmail && <a href={`mailto:${j.guestEmail}`} className="inline-flex items-center gap-1 truncate text-gold-400/80 hover:underline"><Mail size={12} /> {j.guestEmail}</a>}
                      </p>
                    )}
                    {j.notes && <p className="mt-1 text-xs text-dark-500">{j.notes}</p>}
                    {j.extras.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {j.extras.map((x) => (
                          <span key={x.id} className="rounded-md border border-white/[0.1] bg-white/[0.03] px-2 py-0.5 text-[11px] text-dark-300">
                            {x.label}{x.quantity > 1 ? ` x${x.quantity}` : ""}
                          </span>
                        ))}
                      </p>
                    )}
                    {/*
                      Paid or to collect, stated either way.
                      Only the "collect" case was shown, so a driver on a
                      prepaid job had to infer from silence that there was
                      nothing to take. Silence is not an instruction.
                    */}
                    {j.collect > 0 ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gold-500/30 bg-gold-500/10 px-2.5 py-1 text-xs text-gold-300">
                        <Wallet size={12} /> Driver collects {euro(j.collect)} from the client, cash or card, at the end of the ride
                      </p>
                    ) : (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] px-2.5 py-1 text-xs text-emerald-300/90">
                        <Wallet size={12} /> Paid in full online. Nothing to collect from the client.
                      </p>
                    )}
                    {j.driver && (
                      <p className="mt-2 text-sm text-sky-200">
                        {j.driver.user.name}{v ? ` · ${v.make} ${v.model} · ${v.licensePlate}` : ""}
                        {j.driverAmount != null && <span className="text-dark-500"> · sees {euro(j.driverAmount)}</span>}
                      </p>
                    )}
                    {(isLive || j.noShow) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {isLive && (
                          <button type="button" onClick={() => setLocating(j)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 text-xs text-dark-200 hover:border-white/20 hover:text-white">
                            <MapPin size={13} /> Live location
                          </button>
                        )}
                        {isLive && (
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
                      {/* The margin, where the decision about it is made. */}
                      {j.partnerPayout != null && j.driverAmount != null && (
                        <p className="mt-1 text-[11px] leading-tight text-dark-400">
                          driver {euro(j.driverAmount)} · you keep{" "}
                          <span className="text-gold-500/80">{euro(j.partnerPayout - j.driverAmount)}</span>
                        </p>
                      )}
                    </div>
                    <Status status={needsDriver && j.status === "DRIVER_ASSIGNED" ? "CONFIRMED" : j.status} />
                    {canDispatch && <button type="button" onClick={() => setDispatching(j)} className={primary}>Dispatch</button>}
                    {/*
                      A job already with a driver can still change hands. A car
                      breaks down, a driver calls in sick, and the company had
                      no way to move the job without ringing the office.
                    */}
                    {/*
                      Only while it is still DRIVER_ASSIGNED. dispatchPartnerJob
                      refuses a job that is IN_PROGRESS, so offering the button
                      then would be a button that always fails.
                    */}
                    {j.status === "DRIVER_ASSIGNED" && !needsDriver && (
                      <>
                        <button type="button" onClick={() => setDispatching(j)} className={ghost}>
                          <Users size={14} /> Change driver
                        </button>
                        {/*
                          Undispatch, for when the answer is not yet "this
                          other driver". A delayed flight at 01:30 is a job
                          nobody can take until the new time is known.
                        */}
                        <button
                          type="button" onClick={() => undispatch(j)} disabled={undispatching === j.id}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 text-xs text-amber-200/90 hover:bg-amber-500/[0.12] disabled:opacity-50"
                        >
                          {undispatching === j.id ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Undispatch
                        </button>
                      </>
                    )}
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

      <DetailSheet
        job={detail}
        onClose={() => setDetail(null)}
        onDispatch={(j) => { setDetail(null); setDispatching(j); }}
        onUndispatch={undispatch}
        busy={undispatching}
      />
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
    if (job) {
      // Re-opening a job that already has a driver keeps what was decided for
      // it: the current driver selected, and the figure they were told. A
      // reassignment is usually one of the two changing, not both.
      setDriverId(job.driver?.id ?? "");
      setAmount(
        job.driverAmount != null ? String(job.driverAmount)
        : job.partnerPayout != null ? String(job.partnerPayout)
        : "",
      );
    }
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

/** One line of the record. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-white/[0.05] py-2.5 last:border-0">
      <p className="w-32 flex-shrink-0 text-[11px] uppercase tracking-[0.16em] text-dark-500">{label}</p>
      <div className="min-w-0 flex-1 text-sm text-dark-100">{children}</div>
    </div>
  );
}

/**
 * The whole ride, in one place.
 *
 * The list row is a summary a dispatcher scans at a glance. This is what they
 * open when they are deciding something: who the customer is and how to reach
 * them, what was bought, what the driver is owed and what the company keeps,
 * and the two actions that change who is driving.
 */
function DetailSheet({
  job, onClose, onDispatch, onUndispatch, busy,
}: {
  job: Job | null; onClose: () => void;
  onDispatch: (j: Job) => void; onUndispatch: (j: Job) => void; busy: string | null;
}) {
  if (!job) return <Sheet open={false} onClose={onClose} title="Ride"><span /></Sheet>;
  const w = whenParts(job.pickupDatetime);
  const v = job.driver?.vehicles?.[0];
  const needsDriver = !job.driver;
  const collect = job.collect;
  const margin = job.partnerPayout != null && job.driverAmount != null ? job.partnerPayout - job.driverAmount : null;

  return (
    <Sheet open onClose={onClose} title={`Ride ${job.confirmationCode}`}>
      <div className="space-y-6">
        <div>
          <p className="font-mono text-[11px] tracking-wider text-gold-400">{job.confirmationCode}</p>
          <p className="mt-1 font-display text-2xl text-white">{w.time} · {w.day}</p>
          <div className="mt-2"><Status status={needsDriver && job.status === "DRIVER_ASSIGNED" ? "CONFIRMED" : job.status} /></div>
        </div>

        <section>
          <h3 className="mb-1 text-[11px] uppercase tracking-[0.2em] text-dark-500">Journey</h3>
          <Row label="Pick-up">{job.pickupAddress}</Row>
          <Row label="Drop-off">{job.dropoffAddress || "As arranged"}</Row>
          <Row label="Vehicle">{vehicleLabel(job.vehicleClass)}</Row>
          <Row label="Party">{job.passengers} passengers, {job.luggage} bags</Row>
          {job.flightNumber && <Row label="Flight">{job.flightNumber}</Row>}
          {job.flightNumber && !["COMPLETED", "CANCELLED", "REFUNDED"].includes(job.status) && (
            <div className="pt-3"><FlightInfoCard bookingId={job.id} flightNumber={job.flightNumber} /></div>
          )}
          {job.stops.map((st, i) => <Row key={i} label={`Stop ${i + 1}`}>{st}</Row>)}
          {job.durationHours != null && <Row label="Hours booked">{job.durationHours}</Row>}
        </section>

        <section>
          <h3 className="mb-1 text-[11px] uppercase tracking-[0.2em] text-dark-500">Customer</h3>
          <Row label="Name">{job.guestName ?? "Not given"}</Row>
          {job.guestPhone && (
            <Row label="Phone"><a href={`tel:${job.guestPhone}`} className="text-gold-400 hover:underline">{job.guestPhone}</a></Row>
          )}
          {job.guestEmail && (
            <Row label="Email"><a href={`mailto:${job.guestEmail}`} className="break-all text-gold-400 hover:underline">{job.guestEmail}</a></Row>
          )}
          {job.notes && <Row label="Their note">{job.notes}</Row>}
        </section>

        {job.extras.length > 0 && (
          <section>
            <h3 className="mb-1 text-[11px] uppercase tracking-[0.2em] text-dark-500">The client asked for</h3>
            {job.extras.map((x) => (
              <Row key={x.id} label={x.label}>{x.quantity > 1 ? `x${x.quantity}` : "Yes"}</Row>
            ))}
          </section>
        )}

        <section>
          <h3 className="mb-1 text-[11px] uppercase tracking-[0.2em] text-dark-500">Money</h3>
          <Row label="Your payout">
            <span className="font-display text-lg text-gold-400">{euro(job.partnerPayout)}</span>
          </Row>
          {job.driverAmount != null && <Row label="Driver is told">{euro(job.driverAmount)}</Row>}
          {margin != null && (
            <Row label="You keep"><span className="text-gold-500/80">{euro(margin)}</span></Row>
          )}
          <Row label="At the ride">
            {collect > 0
              ? <span className="text-gold-300">Driver collects {euro(collect)} from the client</span>
              : <span className="text-emerald-300/90">Paid in full online. Nothing to collect.</span>}
          </Row>
        </section>

        <section>
          <h3 className="mb-1 text-[11px] uppercase tracking-[0.2em] text-dark-500">Driver</h3>
          {job.driver ? (
            <>
              <Row label="Name">{job.driver.user.name ?? "Unnamed"}</Row>
              {job.driver.user.phone && (
                <Row label="Phone"><a href={`tel:${job.driver.user.phone}`} className="text-gold-400 hover:underline">{job.driver.user.phone}</a></Row>
              )}
              {v && <Row label="Car">{v.make} {v.model} · {v.licensePlate}</Row>}
            </>
          ) : (
            <p className="py-2 text-sm text-dark-400">Nobody is on this job yet.</p>
          )}
        </section>

        <div className="flex flex-wrap gap-2 border-t border-white/[0.08] pt-5">
          {(job.status === "CONFIRMED" || needsDriver) && job.status !== "COMPLETED" && (
            <button type="button" onClick={() => onDispatch(job)} className={primary}>
              <Users size={15} /> {needsDriver ? "Assign a driver" : "Dispatch"}
            </button>
          )}
          {job.status === "DRIVER_ASSIGNED" && !needsDriver && (
            <>
              <button type="button" onClick={() => onDispatch(job)} className={ghost}>
                <Users size={14} /> Change driver
              </button>
              <button
                type="button" onClick={() => onUndispatch(job)} disabled={busy === job.id}
                className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-4 text-sm text-amber-200/90 hover:bg-amber-500/[0.12] disabled:opacity-50"
              >
                {busy === job.id ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />} Undispatch
              </button>
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}

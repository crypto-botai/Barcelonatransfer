"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { Empty, PageTitle, Sheet, Skeleton, field, ghost, label, primary, vehicleLabel } from "@/components/partner/ui";

type Driver = {
  id: string; status: string; licenseNumber: string | null; totalRides: number; rating: number; createdAt: string;
  user: { name: string | null; email: string; phone: string | null };
  vehicles: { id: string; make: string; model: string; licensePlate: string; class: string; color: string }[];
  _count: { bookings: number };
};

const CLASSES = ["ECONOMY", "BUSINESS", "LUXURY", "ELECTRIC_VIP", "MINIVAN", "LUXURY_MINIVAN", "MINIBUS"];

export default function PartnerDriversPage() {
  const [drivers, setDrivers] = useState<Driver[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/partner/drivers");
    if (r.ok) setDrivers(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setStatus(d: Driver, status: "APPROVED" | "SUSPENDED") {
    const r = await fetch(`/api/partner/drivers/${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (r.ok) { toast.success(status === "SUSPENDED" ? "Driver suspended" : "Driver active again"); load(); } else toast.error("Failed");
  }

  return (
    <div>
      <PageTitle
        title="Drivers"
        sub="Your roster. Each driver gets an Elite BCN driver login for the jobs you dispatch to them."
        aside={<button type="button" onClick={() => setAdding(true)} className={primary}><Plus size={16} /> Add driver</button>}
      />

      {drivers === null ? (
        <Skeleton rows={3} h={88} />
      ) : drivers.length === 0 ? (
        <Empty title="No driver yet" body="Add your first driver. They receive their sign-in details by email and can see every job you give them." action={<button type="button" onClick={() => setAdding(true)} className={primary}><Plus size={16} /> Add driver</button>} />
      ) : (
        <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          {drivers.map((d) => {
            const v = d.vehicles[0];
            const suspended = d.status === "SUSPENDED";
            return (
              <li key={d.id} className={`flex flex-wrap items-center gap-4 px-5 py-4 ${suspended ? "opacity-60" : ""}`}>
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-gold-500/30 font-display text-gold-300">
                  {(d.user.name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-white">{d.user.name} {suspended && <span className="ml-2 text-xs text-red-300">Suspended</span>}</p>
                  <p className="truncate text-xs text-dark-400">{d.user.phone} · {d.user.email}</p>
                  <p className="text-xs text-dark-500">{v ? `${v.make} ${v.model} · ${v.licensePlate} · ${vehicleLabel(v.class)}` : "No vehicle on file"}</p>
                </div>
                <div className="text-right text-xs text-dark-400">
                  <p>{d._count.bookings ? `${d._count.bookings} active job${d._count.bookings > 1 ? "s" : ""}` : "Free now"}</p>
                  <p className="text-dark-500">{d.totalRides} rides driven</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(d)} className={`${ghost} h-9 px-3 text-xs`}>Edit</button>
                  <button type="button" onClick={() => setStatus(d, suspended ? "APPROVED" : "SUSPENDED")} className={`${ghost} h-9 px-3 text-xs ${suspended ? "" : "hover:border-red-500/40 hover:text-red-300"}`}>
                    {suspended ? "Reactivate" : "Suspend"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <DriverSheet open={adding} driver={null} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />
      <DriverSheet open={Boolean(editing)} driver={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />
    </div>
  );
}

function DriverSheet({ open, driver, onClose, onDone }: { open: boolean; driver: Driver | null; onClose: () => void; onDone: () => void }) {
  const blank = { name: "", email: "", phone: "", licenseNumber: "", vehicleMake: "", vehicleModel: "", vehiclePlate: "", vehicleClass: "LUXURY_MINIVAN", vehicleColor: "Black" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const edit = Boolean(driver);

  useEffect(() => {
    if (!open) return;
    if (driver) {
      const v = driver.vehicles[0];
      setF({ name: driver.user.name ?? "", email: driver.user.email, phone: driver.user.phone ?? "", licenseNumber: driver.licenseNumber ?? "", vehicleMake: v?.make ?? "", vehicleModel: v?.model ?? "", vehiclePlate: v?.licensePlate ?? "", vehicleClass: v?.class ?? "LUXURY_MINIVAN", vehicleColor: v?.color ?? "Black" });
    } else setF(blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, driver]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const ready = f.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(f.email) && f.phone.trim().length >= 6 && f.vehicleMake && f.vehicleModel && f.vehiclePlate.trim().length >= 2;

  async function submit() {
    setBusy(true);
    try {
      const r = edit
        ? await fetch(`/api/partner/drivers/${driver!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, phone: f.phone, licenseNumber: f.licenseNumber || null, vehicleMake: f.vehicleMake, vehicleModel: f.vehicleModel, vehiclePlate: f.vehiclePlate, vehicleClass: f.vehicleClass, vehicleColor: f.vehicleColor }) })
        : await fetch("/api/partner/drivers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      toast.success(edit ? "Driver updated" : `Driver added. Sign-in details sent to ${f.email}.`);
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} title={edit ? "Edit driver" : "Add driver"}>
      <div className="space-y-5">
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-gold-400"><UserRound size={13} /> Driver</p>
          <div><label className={label} htmlFor="d-name">Full name</label><input id="d-name" className={field} value={f.name} onChange={set("name")} /></div>
          <div><label className={label} htmlFor="d-email">Email {edit && <span className="normal-case tracking-normal text-dark-500">(login, cannot change)</span>}</label><input id="d-email" type="email" className={field} value={f.email} onChange={set("email")} disabled={edit} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label} htmlFor="d-phone">Phone</label><input id="d-phone" className={field} value={f.phone} onChange={set("phone")} placeholder="+34 6…" /></div>
            <div><label className={label} htmlFor="d-lic">Licence no.</label><input id="d-lic" className={field} value={f.licenseNumber} onChange={set("licenseNumber")} /></div>
          </div>
        </div>
        <div className="space-y-3 border-t border-white/[0.06] pt-5">
          <p className="text-xs uppercase tracking-[0.15em] text-gold-400">Vehicle</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label} htmlFor="d-make">Make</label><input id="d-make" className={field} value={f.vehicleMake} onChange={set("vehicleMake")} placeholder="Mercedes-Benz" /></div>
            <div><label className={label} htmlFor="d-model">Model</label><input id="d-model" className={field} value={f.vehicleModel} onChange={set("vehicleModel")} placeholder="V-Class" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label} htmlFor="d-plate">Plate</label><input id="d-plate" className={`${field} uppercase`} value={f.vehiclePlate} onChange={set("vehiclePlate")} placeholder="1234 ABC" /></div>
            <div><label className={label} htmlFor="d-color">Colour</label><input id="d-color" className={field} value={f.vehicleColor} onChange={set("vehicleColor")} /></div>
          </div>
          <div>
            <label className={label} htmlFor="d-class">Class</label>
            <select id="d-class" className={field} value={f.vehicleClass} onChange={set("vehicleClass")}>
              {CLASSES.map((c) => <option key={c} value={c} className="bg-[#0f0e0b]">{vehicleLabel(c)}</option>)}
            </select>
          </div>
        </div>
        <button type="button" onClick={submit} disabled={!ready || busy} className={`${primary} w-full`}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {edit ? "Save changes" : "Add driver and send login"}
        </button>
        {!edit && <p className="text-xs text-dark-500">A temporary password goes to the driver's email. They choose their own at first sign-in.</p>}
      </div>
    </Sheet>
  );
}

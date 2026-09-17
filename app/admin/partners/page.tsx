"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Handshake, Loader2, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";

/**
 * Fleet partner companies: outside operators with their own drivers, who
 * take jobs the office sends them. Each has one login to its own panel.
 */
type Partner = {
  id: string; name: string; contactName: string; email: string; phone: string;
  active: boolean; createdAt: string;
  _count: { drivers: number; bookings: number; withdrawals: number };
  openJobs: number; totalEarned: number;
};

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/partners");
    if (res.ok) setPartners(await res.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-white">Fleet Partners</h1>
          <p className="text-dark-400 mt-1">Companies that drive jobs you send them, with their own drivers and panel.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-gold px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2">
          <Plus size={15} /> New company
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-dark-400 text-sm"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : partners.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <Handshake size={28} className="text-gold-500 mx-auto mb-3" />
          <p className="text-white">No fleet company yet</p>
          <p className="text-dark-400 text-sm mt-1">Add one and it receives a login by email. From the dispatch board you can then send it jobs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {partners.map((p) => (
            <Link key={p.id} href={`/admin/partners/${p.id}`} className={`glass-card gold-hover-border rounded-2xl p-5 block transition-colors ${p.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-white font-medium truncate">{p.name}</h2>
                  <p className="text-dark-400 text-xs mt-0.5 truncate">{p.contactName} · {p.phone}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${p.active ? "border-green-500/30 text-green-400 bg-green-500/10" : "border-white/10 text-dark-400"}`}>
                  {p.active ? "Active" : "Suspended"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div className="rounded-lg bg-white/[0.03] py-2">
                  <p className="text-white text-lg font-display">{p._count.drivers}</p>
                  <p className="text-dark-500 text-[10px] uppercase tracking-wider">Drivers</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] py-2">
                  <p className={`text-lg font-display ${p.openJobs ? "text-sky-300" : "text-white"}`}>{p.openJobs}</p>
                  <p className="text-dark-500 text-[10px] uppercase tracking-wider">Open jobs</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] py-2">
                  <p className="text-gold-400 text-lg font-display">{formatCurrency(p.totalEarned)}</p>
                  <p className="text-dark-500 text-[10px] uppercase tracking-wider">Earned</p>
                </div>
              </div>
              {p._count.withdrawals > 0 && (
                <p className="text-amber-400 text-xs mt-3">{p._count.withdrawals} withdrawal request{p._count.withdrawals > 1 ? "s" : ""} waiting</p>
              )}
            </Link>
          ))}
        </div>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ name: "", contactName: "", email: "", phone: "", taxId: "", address: "", notes: "" });
  const [busy, setBusy] = useState(false);
  // The email already belongs to a customer: the office can turn that
  // account into the company login instead of asking for a new address.
  const [existing, setExisting] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const field = "input-luxury w-full px-3 py-2.5 rounded-lg text-sm";
  const label = "block text-[10px] text-gold-500/80 uppercase tracking-[0.15em] font-semibold mb-1.5";

  async function submit(convertExisting = false) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, convertExisting }) });
      const data = await res.json();
      if (res.status === 409 && data.exists) { setExisting(true); return; }
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(convertExisting
        ? `${data.name} created — ${f.email} now signs in to the company panel with their existing password`
        : `${data.name} created — sign-in details emailed to ${f.email}`);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-white">New fleet company</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-dark-400 hover:text-white"><X size={14} /></button>
        </div>
        <div className="space-y-3">
          <div><label className={label}>Company name</label><input className={field} value={f.name} onChange={set("name")} placeholder="BCN Executive Cars SL" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Contact person</label><input className={field} value={f.contactName} onChange={set("contactName")} /></div>
            <div><label className={label}>Phone</label><input className={field} value={f.phone} onChange={set("phone")} placeholder="+34 6…" /></div>
          </div>
          <div><label className={label}>Login email</label><input className={field} type="email" value={f.email} onChange={set("email")} placeholder="dispatch@company.com" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Tax ID (CIF)</label><input className={field} value={f.taxId} onChange={set("taxId")} /></div>
            <div><label className={label}>Address</label><input className={field} value={f.address} onChange={set("address")} /></div>
          </div>
          <div><label className={label}>Notes (internal)</label><textarea className={`${field} min-h-[70px]`} value={f.notes} onChange={set("notes")} /></div>
        </div>
        {existing ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-100">{f.email} already has a customer account.</p>
            <p className="text-xs text-amber-200/80 mt-1">Turn that account into this company's login? They keep their password and sign in at the same place; their dashboard becomes the company panel.</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => submit(true)} disabled={busy} className="btn-gold flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-2">
                {busy ? <Loader2 size={14} className="animate-spin" /> : null} Convert to company login
              </button>
              <button onClick={() => setExisting(false)} className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-dark-300">Use another email</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-dark-500 mt-4">A temporary password is emailed to the login address. They choose their own on first sign-in.</p>
            <button onClick={() => submit(false)} disabled={busy || !f.name || !f.contactName || !f.email || !f.phone} className="btn-gold w-full mt-4 py-3 rounded-xl font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-2">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Create company
            </button>
          </>
        )}
      </div>
    </div>
  );
}

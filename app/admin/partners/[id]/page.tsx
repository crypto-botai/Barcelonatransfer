"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Loader2, Wallet, X } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, type BookingStatus } from "@/types";

type Detail = {
  id: string; name: string; contactName: string; email: string; phone: string;
  taxId: string | null; address: string | null; bankHolder: string | null; bankIban: string | null; bizumPhone: string | null;
  active: boolean; notes: string | null; createdAt: string;
  balance: { totalEarned: number; totalWithdrawn: number; available: number; completedRides: number };
  drivers: { id: string; status: string; user: { name: string | null; email: string; phone: string | null }; vehicles: { make: string; model: string; licensePlate: string }[] }[];
  withdrawals: { id: string; amount: number; method: string; bankIban: string | null; bankHolder: string | null; bizumPhone: string | null; status: string; notes: string | null; createdAt: string }[];
  bookings: {
    id: string; confirmationCode: string; status: BookingStatus; pickupAddress: string; dropoffAddress: string; pickupDatetime: string;
    totalAmount: number; partnerPayout: number | null; driverAmount: number | null; partnerDispatchedAt: string | null;
    driver: { user: { name: string | null }; vehicles: { licensePlate: string }[] } | null;
  }[];
};

const W_STATUS: Record<string, string> = { PENDING: "text-amber-400", COMPLETED: "text-green-400", TRANSFERRED: "text-sky-300" };

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Detail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/partners/${id}`);
    if (res.ok) setP(await res.json());
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function toggleActive() {
    if (!p) return;
    setBusy("active");
    await fetch(`/api/admin/partners/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !p.active }) });
    setBusy(null); load();
  }
  async function settle(wid: string, status: "COMPLETED" | "TRANSFERRED") {
    setBusy(wid);
    const res = await fetch(`/api/admin/partners/${id}/withdrawals/${wid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (res.ok) toast.success("Marked paid"); else toast.error("Failed");
    setBusy(null); load();
  }
  async function reject(wid: string) {
    if (!confirm("Reject this request? The amount returns to their available balance.")) return;
    setBusy(wid);
    await fetch(`/api/admin/partners/${id}/withdrawals/${wid}`, { method: "DELETE" });
    setBusy(null); load();
  }

  if (!p) return <div className="p-8 text-dark-400 text-sm inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>;

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8">
      <Link href="/admin/partners" className="inline-flex items-center gap-1.5 text-dark-400 hover:text-white text-sm mb-4"><ArrowLeft size={14} /> Fleet partners</Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl text-white">{p.name}</h1>
          <p className="text-dark-400 mt-1">{p.contactName} · {p.email} · {p.phone}{p.taxId ? ` · ${p.taxId}` : ""}</p>
        </div>
        <button onClick={toggleActive} disabled={busy === "active"} className={`px-3 py-2 rounded-lg text-xs border ${p.active ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-green-500/30 text-green-400 hover:bg-green-500/10"}`}>
          {p.active ? "Suspend company" : "Activate company"}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          ["Earned", formatCurrency(p.balance.totalEarned), "text-gold-400"],
          ["Withdrawn", formatCurrency(p.balance.totalWithdrawn), "text-white"],
          ["Available", formatCurrency(p.balance.available), "text-green-400"],
          ["Completed rides", String(p.balance.completedRides), "text-white"],
        ].map(([l, v, c]) => (
          <div key={l} className="glass-card rounded-xl p-4">
            <p className="text-dark-500 text-[10px] uppercase tracking-wider">{l}</p>
            <p className={`font-display text-2xl mt-1 ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <div className="space-y-6">
          <section className="glass-card rounded-2xl p-5">
            <h2 className="text-white font-medium mb-3">Jobs</h2>
            {p.bookings.length === 0 ? <p className="text-dark-500 text-sm">No job sent to this company yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-[10px] uppercase tracking-wider text-dark-500 text-left">
                    <th className="py-2 pr-3">Ref</th><th className="py-2 pr-3">Journey</th><th className="py-2 pr-3">When</th><th className="py-2 pr-3">Driver</th><th className="py-2 pr-3 text-right">Fare</th><th className="py-2 pr-3 text-right">Payout</th><th className="py-2">Status</th>
                  </tr></thead>
                  <tbody>
                    {p.bookings.map((b) => (
                      <tr key={b.id} className="border-t border-white/[0.05]">
                        <td className="py-2.5 pr-3 font-mono text-gold-400 text-xs">{b.confirmationCode}</td>
                        <td className="py-2.5 pr-3 text-dark-300 text-xs max-w-[220px]"><p className="truncate">{b.pickupAddress}</p><p className="truncate text-dark-500">→ {b.dropoffAddress}</p></td>
                        <td className="py-2.5 pr-3 text-dark-300 text-xs whitespace-nowrap">{new Date(b.pickupDatetime).toLocaleString("en-GB", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="py-2.5 pr-3 text-xs">{b.driver ? <span className="text-white">{b.driver.user.name}<span className="text-dark-500"> · {b.driver.vehicles[0]?.licensePlate}</span></span> : <span className="text-sky-300">Awaiting</span>}</td>
                        <td className="py-2.5 pr-3 text-right text-dark-300 text-xs">{formatCurrency(b.totalAmount)}</td>
                        <td className="py-2.5 pr-3 text-right text-gold-400 text-xs">{formatCurrency(b.partnerPayout ?? 0)}{b.driverAmount != null && <span className="block text-dark-500">driver {formatCurrency(b.driverAmount)}</span>}</td>
                        <td className="py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status] ?? ""}`}>{STATUS_LABELS[b.status] ?? b.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="glass-card rounded-2xl p-5">
            <h2 className="text-white font-medium mb-3">Their drivers</h2>
            {p.drivers.length === 0 ? <p className="text-dark-500 text-sm">They have not added a driver yet.</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {p.drivers.map((d) => (
                  <div key={d.id} className="rounded-lg border border-white/[0.06] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-white text-sm">{d.user.name}</p>
                      <span className={`text-[10px] ${d.status === "SUSPENDED" ? "text-red-400" : "text-green-400"}`}>{d.status === "SUSPENDED" ? "Suspended" : "Active"}</span>
                    </div>
                    <p className="text-dark-400 text-xs mt-0.5">{d.user.phone} · {d.user.email}</p>
                    <p className="text-dark-500 text-xs mt-0.5">{d.vehicles[0] ? `${d.vehicles[0].make} ${d.vehicles[0].model} · ${d.vehicles[0].licensePlate}` : "No vehicle"}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="glass-card rounded-2xl p-5">
            <h2 className="text-white font-medium mb-3 inline-flex items-center gap-2"><Wallet size={14} className="text-gold-500" /> Withdrawals</h2>
            {p.withdrawals.length === 0 ? <p className="text-dark-500 text-sm">None requested.</p> : (
              <div className="space-y-2">
                {p.withdrawals.map((w) => (
                  <div key={w.id} className="rounded-lg border border-white/[0.06] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-display text-lg">{formatCurrency(w.amount)}</p>
                      <span className={`text-[11px] ${W_STATUS[w.status] ?? ""}`}>{w.status === "PENDING" ? "Requested" : "Paid"}</span>
                    </div>
                    <p className="text-dark-400 text-xs mt-1">{w.method === "BANK" ? `IBAN ${w.bankIban ?? "—"}${w.bankHolder ? ` · ${w.bankHolder}` : ""}` : `Bizum ${w.bizumPhone ?? "—"}`}</p>
                    <p className="text-dark-500 text-[11px]">{new Date(w.createdAt).toLocaleString("en-GB", { timeZone: "Europe/Madrid" })}</p>
                    {w.status === "PENDING" && (
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => settle(w.id, "TRANSFERRED")} disabled={busy === w.id} className="flex-1 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs inline-flex items-center justify-center gap-1"><Check size={12} /> Mark paid</button>
                        <button onClick={() => reject(w.id)} disabled={busy === w.id} className="px-3 py-1.5 rounded-lg border border-white/10 text-dark-400 text-xs hover:text-red-400"><X size={12} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="glass-card rounded-2xl p-5 text-sm">
            <h2 className="text-white font-medium mb-3">Bank details on file</h2>
            <p className="text-dark-300">{p.bankHolder ?? <span className="text-dark-500">No holder</span>}</p>
            <p className="text-dark-300 font-mono text-xs mt-1">{p.bankIban ?? <span className="text-dark-500 font-sans">No IBAN yet</span>}</p>
            {p.bizumPhone && <p className="text-dark-300 text-xs mt-1">Bizum {p.bizumPhone}</p>}
            {p.address && <p className="text-dark-500 text-xs mt-3">{p.address}</p>}
            {p.notes && <p className="text-dark-500 text-xs mt-2 whitespace-pre-wrap">{p.notes}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}

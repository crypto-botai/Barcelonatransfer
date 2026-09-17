"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import AccountTypeChooser from "@/components/auth/AccountTypeChooser";

/**
 * A fleet company signing itself up.
 *
 * The account is created straight away but stays inactive until Elite BCN
 * approves it, so the company can sign in and see the panel while nothing
 * can yet be dispatched to it.
 */
export default function PartnerRegisterPage() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", contactName: "", email: "", phone: "", password: "", taxId: "", address: "", fleetSize: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const field = "input-luxury w-full px-3 py-3 rounded-xl text-sm";
  const label = "block text-[10px] text-gold-500/80 uppercase tracking-[0.15em] font-semibold mb-1.5";
  const ready = f.name.trim().length >= 2 && f.contactName.trim().length >= 2 && /\S+@\S+\.\S+/.test(f.email) && f.phone.trim().length >= 6 && f.password.length >= 8;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/auth/partner-register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Could not create the account");
      toast.success("Application received. Sign in to see your panel; Elite BCN will activate it.");
      router.push("/auth/login?callbackUrl=/partner");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.06),transparent)]" />
      <div className="glass-card rounded-2xl p-8 w-full max-w-lg relative z-10">
        <Link href="/" className="flex items-center gap-2 mb-8 w-fit">
          <div className="w-8 h-8 border border-gold-500 rotate-45 flex items-center justify-center"><div className="w-3 h-3 bg-gold-500" /></div>
          <span className="font-display text-xl tracking-[0.25em]"><span className="text-white">ELITE</span><span className="text-gold-500">BCN</span></span>
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Building2 size={20} className="text-gold-500" />
          <h1 className="font-display text-2xl text-white">Fleet Company Registration</h1>
        </div>
        <div className="mb-4"><AccountTypeChooser current="partner" compact /></div>
        <p className="text-dark-400 text-sm mb-6">
          For a company with its own drivers that wants to take jobs from Elite BCN. Your account is reviewed and activated by our office; you can sign in meanwhile.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div><label className={label} htmlFor="p-name">Company name</label><input id="p-name" className={field} value={f.name} onChange={set("name")} placeholder="BCN Executive Cars SL" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={label} htmlFor="p-contact">Contact person</label><input id="p-contact" className={field} value={f.contactName} onChange={set("contactName")} /></div>
            <div><label className={label} htmlFor="p-phone">Phone</label><input id="p-phone" type="tel" className={field} value={f.phone} onChange={set("phone")} placeholder="+34 6…" /></div>
          </div>
          <div><label className={label} htmlFor="p-email">Login email</label><input id="p-email" type="email" className={field} value={f.email} onChange={set("email")} placeholder="dispatch@company.com" /></div>
          <div><label className={label} htmlFor="p-pass">Password</label><input id="p-pass" type="password" className={field} value={f.password} onChange={set("password")} placeholder="Minimum 8 characters" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={label} htmlFor="p-tax">Tax ID (CIF)</label><input id="p-tax" className={field} value={f.taxId} onChange={set("taxId")} /></div>
            <div><label className={label} htmlFor="p-fleet">Vehicles in your fleet</label><input id="p-fleet" className={field} value={f.fleetSize} onChange={set("fleetSize")} placeholder="e.g. 4 vans, 2 sedans" /></div>
          </div>
          <div><label className={label} htmlFor="p-addr">Address</label><input id="p-addr" className={field} value={f.address} onChange={set("address")} /></div>

          <button type="submit" disabled={!ready || busy} className="btn-gold w-full py-3.5 rounded-xl font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />} Create company account
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/30">
          Already have an account? <Link href="/auth/login" className="text-[#c9a84c] hover:text-[#e4c97e] font-medium">Sign in</Link>
        </p>
      </div>
    </main>
  );
}

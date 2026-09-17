"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";
import { PageTitle, Skeleton, field, label, primary } from "@/components/partner/ui";

type Me = {
  name: string; contactName: string; email: string; phone: string;
  taxId: string | null; address: string | null; bankHolder: string | null; bankIban: string | null; bizumPhone: string | null;
};

export default function PartnerAccountPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [f, setF] = useState({ contactName: "", phone: "", taxId: "", address: "", bankHolder: "", bankIban: "", bizumPhone: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/partner/me").then((r) => r.json()).then((m: Me) => {
      setMe(m);
      setF({ contactName: m.contactName, phone: m.phone, taxId: m.taxId ?? "", address: m.address ?? "", bankHolder: m.bankHolder ?? "", bankIban: m.bankIban ?? "", bizumPhone: m.bizumPhone ?? "" });
    }).catch(() => {});
  }, []);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true);
    try {
      const r = await fetch("/api/partner/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        contactName: f.contactName, phone: f.phone,
        taxId: f.taxId || null, address: f.address || null,
        bankHolder: f.bankHolder || null, bankIban: f.bankIban || null, bizumPhone: f.bizumPhone || null,
      }) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      toast.success("Saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }

  if (!me) return <div><PageTitle title="Account" /><Skeleton rows={2} h={200} /></div>;

  return (
    <div className="max-w-2xl">
      <PageTitle title="Account" sub={`${me.name} · signed in as ${me.email}`} />

      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="font-display text-xl text-white">Contact</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={label} htmlFor="a-contact">Contact person</label><input id="a-contact" className={field} value={f.contactName} onChange={set("contactName")} /></div>
            <div><label className={label} htmlFor="a-phone">Phone</label><input id="a-phone" className={field} value={f.phone} onChange={set("phone")} /></div>
            <div><label className={label} htmlFor="a-tax">Tax ID (CIF)</label><input id="a-tax" className={field} value={f.taxId} onChange={set("taxId")} /></div>
            <div><label className={label} htmlFor="a-addr">Address</label><input id="a-addr" className={field} value={f.address} onChange={set("address")} /></div>
          </div>
          <p className="text-xs text-dark-500">Company name and login email are set by Elite BCN. Ask them to change either.</p>
        </section>

        <section className="space-y-3 border-t border-white/[0.06] pt-8">
          <h2 className="font-display text-xl text-white">Where to pay you</h2>
          <p className="text-sm text-dark-400">Used for every withdrawal request. Keep it current.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={label} htmlFor="a-holder">Account holder</label><input id="a-holder" className={field} value={f.bankHolder} onChange={set("bankHolder")} placeholder="Company legal name" /></div>
            <div className="sm:col-span-2"><label className={label} htmlFor="a-iban">IBAN</label><input id="a-iban" className={`${field} font-mono uppercase tracking-wider`} value={f.bankIban} onChange={set("bankIban")} placeholder="ES00 0000 0000 0000 0000 0000" /></div>
            <div><label className={label} htmlFor="a-bizum">Bizum number (optional)</label><input id="a-bizum" className={field} value={f.bizumPhone} onChange={set("bizumPhone")} placeholder="+34 6…" /></div>
          </div>
        </section>

        <button type="button" onClick={save} disabled={busy} className={primary}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
        </button>
      </div>
    </div>
  );
}

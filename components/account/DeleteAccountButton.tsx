"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Close this account. Same control on the customer, driver and company
 * portals, so anyone can remove one kind of account and open another with
 * the same email. Two steps: the button opens a confirmation that needs the
 * word DELETE typed, then the account is gone and they are signed out.
 */
export default function DeleteAccountButton({ kind }: { kind: "customer" | "driver" | "company" }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const consequences: Record<typeof kind, string> = {
    customer: "Your login, profile, saved addresses, loyalty points and notifications are removed. Past bookings stay on Elite BCN's records as guest bookings without an account.",
    driver:   "Your login, vehicle and withdrawal history are removed. Rides you drove stay on Elite BCN's records without a driver attached.",
    company:  "Your company login, bank details and withdrawal history are removed, and so are the driver logins your company created. Jobs stay on Elite BCN's records.",
  };

  async function confirm() {
    setBusy(true);
    try {
      const r = await fetch("/api/account", { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error ?? "Could not delete the account");
      toast.success("Account deleted");
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the account");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-red-300">Delete account</h3>
      <p className="mt-2 text-sm leading-relaxed text-dark-300">{consequences[kind]}</p>
      <p className="mt-1 text-xs text-dark-500">This cannot be undone. You can create a new account of any kind with the same email afterwards.</p>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl border border-red-500/40 px-4 text-sm font-medium text-red-300 hover:bg-red-500/10">
          <Trash2 size={15} /> Delete my account
        </button>
      ) : (
        <div className="mt-4 space-y-3 rounded-xl border border-red-500/30 bg-[#150a0a] p-4">
          <p className="inline-flex items-center gap-2 text-sm text-red-200"><AlertTriangle size={15} /> Type <span className="font-mono">DELETE</span> to confirm.</p>
          <input
            value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus
            aria-label="Type DELETE to confirm"
            className="h-11 w-full rounded-lg border border-red-500/30 bg-transparent px-3 font-mono text-sm text-white outline-none focus:border-red-400"
          />
          <div className="flex gap-2">
            <button type="button" onClick={confirm} disabled={typed !== "DELETE" || busy} className="inline-flex h-11 items-center gap-2 rounded-xl bg-red-500 px-4 text-sm font-semibold text-white disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Delete permanently
            </button>
            <button type="button" onClick={() => { setOpen(false); setTyped(""); }} className="h-11 rounded-xl border border-white/10 px-4 text-sm text-dark-300">Keep my account</button>
          </div>
        </div>
      )}
    </div>
  );
}

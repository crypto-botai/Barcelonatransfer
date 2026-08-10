"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, Plus } from "lucide-react";
import toast from "react-hot-toast";

interface Missing {
  slug: string;
  label: string;
  prices: Record<string, number>;
}

/**
 * Copies newly added routes from the code price table into the database.
 *
 * Nothing happens until the operator presses it, and the exact prices that
 * would be written are listed first — new routes ship in code, but putting a
 * price in front of a customer is the owner's decision, not a deployment's.
 */
export default function SyncRoutesButton() {
  const [missing, setMissing] = useState<Missing[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/pricing/sync")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setMissing(d?.missing ?? []))
      .catch(() => alive && setMissing([]));
    return () => { alive = false; };
  }, []);

  async function sync() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/pricing/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add the routes");
      setDone(true);
      toast.success(`${data.added} route${data.added === 1 ? "" : "s"} added to the price list`);
      // The grid above is server-rendered from the database it just changed.
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the routes", { duration: 8000 });
    } finally {
      setBusy(false);
    }
  }

  // Nothing to say when the database already matches the code.
  if (missing === null || missing.length === 0 || done) return null;

  return (
    <div className="mb-6 rounded-xl border border-gold-500/25 bg-gold-500/[0.05] p-4">
      <p className="text-gold-300 text-sm font-medium mb-1">
        {missing.length} new route{missing.length === 1 ? "" : "s"} ready to publish
      </p>
      <p className="text-dark-400 text-xs mb-3 leading-relaxed">
        These are already quoted correctly when a customer books. Adding them here
        also puts them on the public price list, and lets you edit the prices from
        this page afterwards.
      </p>

      <div className="rounded-lg border border-white/[0.06] overflow-hidden mb-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/[0.03] text-dark-400">
              <th className="text-left font-normal px-3 py-2">Route</th>
              {["Sedan", "Business", "Minivan", "V-Class", "Minibus"].map((h) => (
                <th key={h} className="text-right font-normal px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {missing.map((m) => (
              <tr key={m.slug} className="border-t border-white/[0.04]">
                <td className="px-3 py-2 text-white">{m.label}</td>
                {["ECONOMY", "BUSINESS", "MINIVAN", "VCLASS", "MINIBUS"].map((c) => (
                  <td key={c} className="px-3 py-2 text-gold-400 text-right tabular-nums">
                    {m.prices[c] != null ? `€${m.prices[c]}` : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={sync}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold-500/15 border border-gold-500/30 text-gold-300 hover:bg-gold-500/25 text-xs font-medium transition-colors disabled:opacity-40"
      >
        {busy ? <Loader2 size={12} className="animate-spin" />
              : done ? <Check size={12} /> : <Plus size={12} />}
        Add to price list
      </button>
    </div>
  );
}

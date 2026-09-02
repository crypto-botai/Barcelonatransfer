"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, ArrowDownToLine } from "lucide-react";
import toast from "react-hot-toast";

interface Row {
  slug: string;
  label: string;
  db: number | null;
  code: number;
}

const LABELS: Record<string, string> = {
  ECONOMY: "Sedan",
  BUSINESS: "Business",
  MINIVAN: "Minivan",
  VCLASS: "V-Class",
  MINIBUS: "Minibus",
};

/**
 * Publishes one vehicle's prices from the code table to the database.
 *
 * Worth knowing why this exists next to the other button: quotes read the
 * database first, so a price edited in code and deployed is not the price
 * anybody pays. The sync button beside this one does not fix that either — it
 * only adds routes the database has never seen, never touches one it has.
 *
 * Deliberately one vehicle at a time, and it shows every line it would write
 * before writing any of them. Putting a number in front of a customer is the
 * owner's decision, not a deployment's.
 */
export default function ApplyTablePricesButton({
  vehicleCode = "MINIBUS",
}: {
  vehicleCode?: "ECONOMY" | "BUSINESS" | "MINIVAN" | "VCLASS" | "MINIBUS";
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [lower, setLower] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/pricing/apply-from-table?vehicleCode=${vehicleCode}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        setRows(d?.toApply ?? []);
        setLower(d?.wouldLower ?? []);
      })
      .catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [vehicleCode]);

  async function apply() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/pricing/apply-from-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not publish the prices");
      setDone(true);
      toast.success(
        `${data.applied} ${LABELS[vehicleCode]} price${data.applied === 1 ? "" : "s"} published — live now`,
      );
      // The grid below is server-rendered from the table this just changed.
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish the prices", { duration: 8000 });
    } finally {
      setBusy(false);
    }
  }

  if (rows === null || done) return null;
  if (rows.length === 0 && lower.length === 0) return null;

  const name = LABELS[vehicleCode] ?? vehicleCode;

  return (
    <div className="mb-6 rounded-xl border border-gold-500/25 bg-gold-500/[0.05] p-4">
      <p className="text-gold-300 text-sm font-medium mb-1">
        {rows.length} {name} price{rows.length === 1 ? "" : "s"} ready to publish
      </p>
      <p className="text-dark-400 text-xs mb-3 leading-relaxed">
        These are set in the code but customers are still being charged the old amount, because
        quotes read this database first. Publishing writes the right-hand column and takes effect
        immediately. No other vehicle is touched.
      </p>

      {rows.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] overflow-hidden mb-3 max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0">
              <tr className="bg-[#141414] text-dark-400">
                <th className="text-left font-normal px-3 py-2">Route</th>
                <th className="text-right font-normal px-3 py-2">Charging now</th>
                <th className="text-right font-normal px-3 py-2">Will charge</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug} className="border-t border-white/[0.04]">
                  <td className="px-3 py-2 text-white">{r.label}</td>
                  <td className="px-3 py-2 text-right text-dark-400 tabular-nums">
                    {r.db != null ? `€${r.db}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-gold-400 tabular-nums">€{r.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lower.length > 0 && (
        <p className="text-dark-400 text-xs mb-3 leading-relaxed">
          {lower.length} route{lower.length === 1 ? " is" : "s are"} priced higher here than in the
          code and {lower.length === 1 ? "was" : "were"} left alone — a price above the table is
          treated as a decision, not something to overwrite.
        </p>
      )}

      {rows.length > 0 && (
        <button
          onClick={apply}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold-500/15 border border-gold-500/30 text-gold-300 hover:bg-gold-500/25 text-xs font-medium transition-colors disabled:opacity-40"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <ArrowDownToLine size={12} />}
          Publish {name} prices
        </button>
      )}
    </div>
  );
}

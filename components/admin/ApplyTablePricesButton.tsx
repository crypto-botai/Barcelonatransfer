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
  // Two-step for reductions only: the first click reveals what would be cut and
  // asks again. A price going down is the one direction that cannot be walked
  // back by re-running the same button.
  const [confirmLower, setConfirmLower] = useState(false);

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

  /**
   * @param allowDecrease publish the routes where the table is CHEAPER than the
   *   database. The endpoint has always accepted this flag; nothing here ever
   *   sent it, so a price cut could be listed by this banner and then had no
   *   button to publish it — reported forever and never applied. Kept as a
   *   separate, separately-confirmed action rather than folded into the button
   *   above, because lowering a live fare is the owner's decision.
   */
  async function apply(allowDecrease = false) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/pricing/apply-from-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleCode, allowDecrease }),
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
      {/* Counts both buckets. It used to name only `rows`, so a set of price
          cuts read "0 Sedan prices ready to publish" above a banner listing
          them — technically true of increases, and unreadable as anything but
          a bug. */}
      <p className="text-gold-300 text-sm font-medium mb-1">
        {rows.length + lower.length} {name} price{rows.length + lower.length === 1 ? "" : "s"} ready to publish
        {rows.length > 0 && lower.length > 0
          ? ` — ${rows.length} increase${rows.length === 1 ? "" : "s"}, ${lower.length} reduction${lower.length === 1 ? "" : "s"}`
          : lower.length > 0
            ? ` — ${lower.length === 1 ? "a reduction" : "all reductions"}`
            : ""}
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
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] p-3 mb-3">
          <p className="text-emerald-300 text-xs font-medium mb-1">
            {lower.length} price cut{lower.length === 1 ? "" : "s"} — publishing these charges customers LESS
          </p>
          <p className="text-dark-400 text-xs mb-2 leading-relaxed">
            The database is charging more than the code table says. That is normally a deliberate
            price the owner set here, so it is never overwritten automatically — but when the cut is
            the intended change, this is what publishes it.
          </p>

          <div className="rounded-lg border border-white/[0.06] overflow-hidden mb-2 max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0">
                <tr className="bg-[#141414] text-dark-400">
                  <th className="text-left font-normal px-3 py-2">Route</th>
                  <th className="text-right font-normal px-3 py-2">Charging now</th>
                  <th className="text-right font-normal px-3 py-2">Will charge</th>
                </tr>
              </thead>
              <tbody>
                {lower.map((r) => (
                  <tr key={r.slug} className="border-t border-white/[0.04]">
                    <td className="px-3 py-2 text-white">{r.label}</td>
                    <td className="px-3 py-2 text-right text-dark-400 tabular-nums">
                      {r.db != null ? `€${r.db}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-300 tabular-nums">€{r.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {confirmLower ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => apply(true)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-400/20 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-400/30 text-xs font-medium transition-colors disabled:opacity-40"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Yes — publish the {lower.length === 1 ? "cut" : "cuts"}
              </button>
              <button
                onClick={() => setConfirmLower(false)}
                disabled={busy}
                className="px-3 py-2 rounded-lg border border-white/[0.08] text-dark-400 hover:text-white text-xs transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmLower(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-400/15 border border-emerald-400/30 text-emerald-200 hover:bg-emerald-400/25 text-xs font-medium transition-colors disabled:opacity-40"
            >
              <ArrowDownToLine size={12} />
              Publish {lower.length} {name} price cut{lower.length === 1 ? "" : "s"}
            </button>
          )}
        </div>
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

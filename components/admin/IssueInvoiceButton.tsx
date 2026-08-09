"use client";

import { useState } from "react";
import { FileText, Loader2, Check } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Issues a VAT invoice for a paid booking.
 *
 * Customers request one on WhatsApp rather than self-serving, because issuing
 * creates a VAT liability and consumes a number in a sequence that legally
 * cannot have gaps. This is the operator's side of that request.
 *
 * The confirmation spells out the arithmetic before anything is issued: the
 * fare excludes VAT, so an invoice adds 10% and the customer owes more than the
 * amount already taken. That difference is worth seeing before you commit to a
 * numbered document that cannot be withdrawn.
 */
export default function IssueInvoiceButton({
  bookingId,
  netAmount,
}: {
  bookingId: string;
  netAmount: number;
}) {
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const vat   = Math.round(netAmount * 0.1 * 100) / 100;
  const gross = Math.round((netAmount + vat) * 100) / 100;

  async function issue() {
    const ok = window.confirm(
      [
        "Issue a VAT invoice for this booking?",
        "",
        `Fare (already paid):  €${netAmount.toFixed(2)}`,
        `VAT at 10%:           €${vat.toFixed(2)}`,
        `Invoice total:        €${gross.toFixed(2)}`,
        "",
        `The customer owes a further €${vat.toFixed(2)}.`,
        "Invoice numbers are sequential and cannot be withdrawn.",
      ].join("\n"),
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not issue the invoice");

      setReference(data.reference);
      toast.success(`Invoice ${data.reference} issued`);
      window.open(`/booking/${bookingId}/invoice`, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not issue the invoice");
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <span
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium"
        title={`Invoice ${reference} issued`}
      >
        <Check size={13} /> {reference}
      </span>
    );
  }

  return (
    <button
      onClick={issue}
      disabled={busy}
      title="Issue a VAT invoice (adds 10% on top of the fare)"
      className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-dark-200 hover:text-white hover:bg-white/[0.09] transition-colors text-xs font-medium disabled:opacity-40"
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
      Issue VAT invoice
    </button>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox, Loader2, Search, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { vehicleClassLabel } from "@/types";
import {
  prefillFromLead, prefillFromUnpaid,
  type ImportSource, type Lead, type Prefill, type Unpaid,
} from "@/lib/booking-import";

export type { ImportSource, Prefill };

/**
 * The picker that fills the office booking form from a near-booking.
 *
 * The mapping, and why the two sources behave differently on save, live in
 * lib/booking-import.ts.
 */

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function ImportPanel({ onPick, autoOpen }: {
  onPick: (p: Prefill) => void;
  /** A source named in the URL, so Abandoned can link straight into the form. */
  autoOpen?: { bookingId?: string; sessionId?: string };
}) {
  const [open, setOpen]   = useState(false);
  const [tab, setTab]     = useState<"unpaid" | "leads">("unpaid");
  const [q, setQ]         = useState("");
  const [data, setData]   = useState<{ leads: Lead[]; unpaid: Unpaid[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/admin/abandoned");
      if (!r.ok) throw new Error("Could not load the abandoned list");
      setData(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the abandoned list");
    }
  }, []);

  // Loaded once the office asks for it, or straight away when a link named a
  // source, so the common case of typing a fresh booking costs no request.
  const wanted = autoOpen?.bookingId || autoOpen?.sessionId;
  useEffect(() => { if (open || wanted) load(); }, [open, wanted, load]);

  // A link from Abandoned fills the form without the office picking anything.
  const [autoDone, setAutoDone] = useState(false);
  useEffect(() => {
    if (autoDone || !data || !wanted) return;
    const b = autoOpen?.bookingId ? data.unpaid.find((x) => x.id === autoOpen.bookingId) : undefined;
    const l = autoOpen?.sessionId ? data.leads.find((x) => x.sessionId === autoOpen.sessionId) : undefined;
    if (b) onPick(prefillFromUnpaid(b));
    else if (l) onPick(prefillFromLead(l));
    else setError("That booking or lead is no longer in the abandoned list. Nothing was filled in.");
    setAutoDone(true);
  }, [data, wanted, autoOpen, autoDone, onPick]);

  const match = useCallback((hay: (string | null | undefined)[]) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return hay.some((h) => (h ?? "").toLowerCase().includes(needle));
  }, [q]);

  // A lead with no pick-up address is somebody who typed an email and left;
  // there is nothing to turn into a booking, so it is not offered here.
  const convertible = useMemo(
    () => (data?.leads ?? []).filter((l) => !l.abandonedBooking?.convertedAt && !!l.formData?.pickupAddress),
    [data],
  );
  const leads = useMemo(
    () => convertible.filter((l) => match([l.name, l.email, l.phone, String(l.formData?.pickupAddress ?? ""), String(l.formData?.dropoffAddress ?? "")])),
    [convertible, match],
  );
  const unpaid = useMemo(
    () => (data?.unpaid ?? []).filter((b) => match([b.guestName, b.guestEmail, b.guestPhone, b.confirmationCode, b.pickupAddress, b.dropoffAddress])),
    [data, match],
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full glass-card rounded-2xl p-4 flex items-center gap-3 text-left hover:border-gold-500/30 border border-transparent transition-colors"
      >
        <span className="w-9 h-9 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center shrink-0">
          <Inbox size={16} className="text-gold-400" />
        </span>
        <span className="min-w-0">
          <span className="block text-white text-sm font-medium">Start from an abandoned cart or an unpaid booking</span>
          <span className="block text-dark-400 text-[12px] mt-0.5">Fills this form with what the customer already entered. Nothing is sent until you create the booking.</span>
        </span>
      </button>
    );
  }

  const rows = tab === "unpaid" ? unpaid.length : leads.length;

  return (
    <section className="glass-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-white font-medium">Import a started booking</h2>
          <p className="text-dark-400 text-[12px] mt-0.5">
            {tab === "unpaid"
              ? "These already have a reference. Choosing one completes that booking rather than making a second one."
              : "These never reached the checkout. Choosing one creates a new booking and stops the recovery emails."}
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-dark-400 hover:text-white shrink-0">
          <X size={14} />
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {([["unpaid", "Unpaid"], ["leads", "Abandoned carts"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === id ? "bg-gold-500 text-black" : "text-dark-400 hover:text-white"}`}
            >
              {label}
              {data && <span className="ml-1.5 opacity-60">{id === "unpaid" ? data.unpaid.length : convertible.length}</span>}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email, phone, reference or address"
            className="input-luxury w-full pl-8 pr-3 py-2 rounded-lg text-sm"
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {!data ? (
        <p className="inline-flex items-center gap-2 text-sm text-dark-400 py-6"><Loader2 size={14} className="animate-spin" /> Loading</p>
      ) : rows === 0 ? (
        <p className="text-dark-400 text-sm py-6">
          {q ? "Nothing matches that search." : tab === "unpaid" ? "No unpaid website booking in the last 30 days." : "No abandoned cart with a route in the last 30 days."}
        </p>
      ) : (
        <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {tab === "unpaid"
            ? unpaid.map((b) => (
                <Candidate
                  key={b.id}
                  title={b.guestName || b.guestEmail || "No name"}
                  badge={b.confirmationCode}
                  route={`${b.pickupAddress} → ${b.dropoffAddress || "—"}`}
                  meta={[when(b.pickupDatetime), `${b.passengers} pax`, vehicleClassLabel(b.vehicleClass), formatCurrency(b.totalAmount), `left ${when(b.createdAt)}`]}
                  onPick={() => { onPick(prefillFromUnpaid(b)); setOpen(false); }}
                />
              ))
            : leads.map((l) => {
                const fd = l.formData ?? {};
                const s = (k: string) => (fd[k] == null ? "" : String(fd[k]));
                const quoted = (fd.quote as { totalAmount?: number } | undefined)?.totalAmount ?? Number(fd.totalAmount);
                return (
                  <Candidate
                    key={l.sessionId}
                    title={l.name || l.email || "No name"}
                    badge={`step ${l.step} of 4`}
                    route={`${s("pickupAddress")} → ${s("dropoffAddress") || "—"}`}
                    meta={[
                      s("date") ? `${s("date")}${s("time") ? ` at ${s("time")}` : ""}` : "No date",
                      `${s("passengers") || "?"} pax`,
                      Number.isFinite(Number(quoted)) && Number(quoted) > 0 ? formatCurrency(Number(quoted)) : "No price yet",
                      `last seen ${when(l.lastActivity)}`,
                    ]}
                    onPick={() => { onPick(prefillFromLead(l)); setOpen(false); }}
                  />
                );
              })}
        </ul>
      )}
    </section>
  );
}

function Candidate({ title, badge, route, meta, onPick }: {
  title: string; badge: string; route: string; meta: (string | null)[]; onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="w-full text-left rounded-xl border border-white/[0.08] hover:border-gold-500/40 hover:bg-gold-500/[0.04] px-3.5 py-3 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-white text-sm font-medium truncate">{title}</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-gold-400/80 shrink-0">{badge}</span>
        </div>
        <p className="text-dark-200 text-[13px] mt-0.5 truncate">{route}</p>
        <p className="text-dark-500 text-[11px] mt-1">{meta.filter(Boolean).join(" · ")}</p>
      </button>
    </li>
  );
}

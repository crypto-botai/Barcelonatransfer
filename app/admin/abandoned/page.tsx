"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, MessageCircle, PenLine, RefreshCw, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import { vehicleClassLabel } from "@/types";

/**
 * Everyone who nearly booked, and the office's two ways of writing to them.
 *
 * Leads are form sessions with a name and an email that never became a
 * booking; unpaid are website bookings whose checkout was never completed.
 * Each shows whether the automatic recovery email went and when, offers the
 * card again, or a note in the office's own words. The report underneath is
 * every recovery email sent, automatic or by hand.
 */
type Lead = {
  sessionId: string; email: string | null; name: string | null; phone: string | null; step: number;
  formData: Record<string, unknown>; lastActivity: string; createdAt: string;
  abandonedBooking: { id: string; emailSentAt: string | null; convertedAt: string | null; coupon: { code: string } | null } | null;
};
type Unpaid = {
  id: string; confirmationCode: string; guestName: string | null; guestEmail: string | null; guestPhone: string | null;
  pickupAddress: string; dropoffAddress: string; pickupDatetime: string; passengers: number; vehicleClass: string;
  totalAmount: number; createdAt: string; recoveryEmailedAt: string | null; emailed: boolean;
};
type Report = { id: string; to: string; subject: string; type: string; status: string; createdAt: string; bookingId: string | null };

type Target = { to: string; name: string; bookingId?: string; sessionId?: string; label: string };

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AbandonedPage() {
  const [data, setData] = useState<{ leads: Lead[]; unpaid: Unpaid[]; report: Report[] } | null>(null);
  const [tab, setTab] = useState<"unpaid" | "leads" | "report">("unpaid");
  const [sweeping, setSweeping] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Target | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/abandoned");
    if (r.ok) setData(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function sweep() {
    setSweeping(true);
    try {
      const r = await fetch("/api/admin/abandoned", { method: "PUT" });
      const d = await r.json();
      toast.success(`Checked. ${d.sessionsEmailed + d.bookingsEmailed} recovery email${d.sessionsEmailed + d.bookingsEmailed === 1 ? "" : "s"} sent.`);
      load();
    } catch { toast.error("Failed"); } finally { setSweeping(false); }
  }

  async function resend(t: Target) {
    setBusy(t.to + (t.bookingId ?? t.sessionId ?? ""));
    try {
      const r = await fetch("/api/admin/abandoned", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "recovery", ...t }) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      toast.success(`Recovery email sent to ${t.to}`);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  }

  const leads = data?.leads.filter((l) => !l.abandonedBooking?.convertedAt) ?? [];
  const unpaid = data?.unpaid ?? [];
  const report = data?.report ?? [];

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl text-white">Abandoned</h1>
          <p className="text-dark-400 mt-1">People who nearly booked. Each gets one recovery email within a quarter of an hour; write again here whenever you like.</p>
        </div>
        <button onClick={sweep} disabled={sweeping} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.1] text-sm text-dark-200 hover:text-white">
          {sweeping ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Check now
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
        {([["unpaid", `Unpaid bookings (${unpaid.length})`], ["leads", `Leads (${leads.length})`], ["report", `Emails sent (${report.length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${tab === id ? "bg-gold-500 text-black" : "text-dark-400 hover:text-white"}`}>{label}</button>
        ))}
      </div>

      {!data ? (
        <p className="inline-flex items-center gap-2 text-sm text-dark-400"><Loader2 size={14} className="animate-spin" /> Loading</p>
      ) : tab === "unpaid" ? (
        unpaid.length === 0 ? <Empty text="No unpaid website booking in the last 30 days." /> : (
          <div className="space-y-2">
            {unpaid.map((b) => {
              const t: Target = { to: b.guestEmail ?? "", name: b.guestName ?? "there", bookingId: b.id, label: b.confirmationCode };
              return (
                <Row
                  key={b.id}
                  name={b.guestName ?? "No name"}
                  email={b.guestEmail}
                  phone={b.guestPhone}
                  fields={[
                    ["Pick-up", b.pickupAddress],
                    ["Drop-off", b.dropoffAddress],
                    ["Date", when(b.pickupDatetime)],
                    ["Guests", `${b.passengers} pax`],
                    ["Vehicle", vehicleClassLabel(b.vehicleClass)],
                    ["Price", formatCurrency(b.totalAmount)],
                    ["Reference", b.confirmationCode],
                    ["Created", when(b.createdAt)],
                  ]}
                  waText={`Hello ${(b.guestName ?? "").split(" ")[0] || "there"}, this is Elite BCN Transfers. I saw you were booking ${b.pickupAddress.split(",")[0]} to ${b.dropoffAddress.split(",")[0]} on ${when(b.pickupDatetime)} for ${formatCurrency(b.totalAmount)} and did not finish. Can I help you complete it? We will give you our best rate.`}
                  sent={b.recoveryEmailedAt}
                  consent
                  busy={busy === t.to + b.id}
                  onResend={b.guestEmail ? () => resend(t) : undefined}
                  onNote={b.guestEmail ? () => setNote(t) : undefined}
                />
              );
            })}
          </div>
        )
      ) : tab === "leads" ? (
        leads.length === 0 ? <Empty text="Nobody has left contact details without booking in the last 30 days." /> : (
          <div className="space-y-2">
            {leads.map((l) => {
              const fd = l.formData ?? {};
              const t: Target = { to: l.email ?? "", name: l.name ?? "there", sessionId: l.sessionId, label: l.sessionId };
              const q = (fd.quote as { totalAmount?: number } | undefined)?.totalAmount ?? fd.totalAmount;
              const str = (k: string) => { const v = fd[k]; return v == null || v === "" ? null : String(v); };
              const consent = fd.contactConsent === true;
              return (
                <Row
                  key={l.sessionId}
                  name={l.name ?? "No name"}
                  email={l.email}
                  phone={l.phone}
                  fields={[
                    ["Type", str("bookingType") === "HOURLY" ? `By the hour${str("durationHours") ? ` · ${str("durationHours")} h` : ""}` : str("returnDate") ? "Return" : "One way"],
                    ["Pick-up", str("pickupAddress") ?? "Not entered"],
                    ["Drop-off", str("dropoffAddress")],
                    ["Date", str("date") ? `${str("date")}${str("time") ? ` at ${str("time")}` : ""}` : null],
                    ["Return", str("returnDate") ? `${str("returnDate")}${str("returnTime") ? ` at ${str("returnTime")}` : ""}` : null],
                    ["Guests", str("passengers") ? `${str("passengers")} pax${str("luggage") ? `, ${str("luggage")} bags` : ""}` : null],
                    ["Vehicle", str("fleetVehicle") ? vehicleClassLabel(str("fleetVehicle")!) : str("vehicleClass") ? vehicleClassLabel(str("vehicleClass")!) : null],
                    ["Price quoted", q ? formatCurrency(Number(q)) : null],
                    ["Flight", str("flightNumber")],
                    ["Notes", str("specialRequests")],
                    ["Reached", `step ${l.step} of 4`],
                    ["Last seen", when(l.lastActivity)],
                  ]}
                  waText={`Hello ${(l.name ?? "").split(" ")[0] || "there"}, this is Elite BCN Transfers. I saw you were booking${str("pickupAddress") ? ` ${str("pickupAddress")!.split(",")[0]}` : " a transfer"}${str("dropoffAddress") ? ` to ${str("dropoffAddress")!.split(",")[0]}` : ""}${str("date") ? ` on ${str("date")}` : ""}${q ? ` for ${formatCurrency(Number(q))}` : ""} and did not finish. Can I help you complete it? We will give you our best rate.`}
                  sent={l.abandonedBooking?.emailSentAt ?? null}
                  consent={consent}
                  busy={busy === t.to + l.sessionId}
                  onResend={l.email ? () => resend(t) : undefined}
                  onNote={l.email ? () => setNote(t) : undefined}
                />
              );
            })}
          </div>
        )
      ) : (
        report.length === 0 ? <Empty text="No recovery email sent yet." /> : (
          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] uppercase tracking-wider text-dark-500 text-left border-b border-white/[0.06]">
                <th className="py-2.5 px-4">When</th><th className="py-2.5 px-4">To</th><th className="py-2.5 px-4">What</th><th className="py-2.5 px-4">By</th><th className="py-2.5 px-4">Status</th>
              </tr></thead>
              <tbody>
                {report.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.04]">
                    <td className="py-2.5 px-4 text-dark-300 whitespace-nowrap">{when(r.createdAt)}</td>
                    <td className="py-2.5 px-4 text-white">{r.to}</td>
                    <td className="py-2.5 px-4 text-dark-300">{r.subject}</td>
                    <td className="py-2.5 px-4 text-dark-400">{r.type === "ABANDONED_MANUAL" ? "Office" : "Automatic"}</td>
                    <td className={`py-2.5 px-4 ${r.status === "SENT" ? "text-green-400" : "text-red-400"}`}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {note && <NoteModal target={note} onClose={() => setNote(null)} onSent={() => { setNote(null); load(); }} />}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="glass-card rounded-2xl p-10 text-center text-dark-400 text-sm">{text}</div>;
}

function Row({ name, email, phone, fields, waText, sent, consent, busy, onResend, onNote }: {
  name: string; email: string | null; phone?: string | null;
  fields: [string, string | null | undefined][];
  /** Prefilled WhatsApp text: the route and the price they saw. */
  waText?: string;
  sent: string | null; consent: boolean; busy: boolean;
  onResend?: () => void; onNote?: () => void;
}) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-medium text-base">{name}</p>
          <p className="text-sm mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
            {email && <a href={`mailto:${email}`} className="text-gold-400 hover:underline break-all">{email}</a>}
            {phone && <a href={`tel:${phone}`} className="text-dark-200 hover:text-white">{phone}</a>}
          </p>
        </div>
        <p className={`text-[11px] inline-flex items-center gap-1 rounded-lg border px-2 py-1 ${sent ? "border-green-500/30 text-green-400 bg-green-500/10" : consent ? "border-amber-500/30 text-amber-300 bg-amber-500/10" : "border-white/10 text-dark-400"}`}>
          <Mail size={11} /> {sent ? `Recovery email sent ${when(sent)}` : consent ? "Recovery email goes 15 min after they go quiet" : "No automatic email: contact box not ticked"}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm border-t border-white/[0.06] pt-4">
        {fields.filter(([, v]) => v != null && v !== "").map(([k, v]) => (
          <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
            <dt className="text-[10px] uppercase tracking-[0.15em] text-dark-500 pt-0.5">{k}</dt>
            <dd className="text-dark-100 break-words">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {phone && (
          <a href={`https://wa.me/${phone.replace(/\D/g, "")}${waText ? `?text=${encodeURIComponent(waText)}` : ""}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs hover:bg-green-500/15">
            <MessageCircle size={12} /> WhatsApp them
          </a>
        )}
        {onResend && (
          <button onClick={onResend} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.1] text-dark-200 text-xs hover:text-white disabled:opacity-40">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} {sent ? "Send card again" : "Send card now"}
          </button>
        )}
        {onNote && (
          <button onClick={onNote} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold-500/10 border border-gold-500/30 text-gold-300 text-xs hover:bg-gold-500/20">
            <PenLine size={12} /> Write to them
          </button>
        )}
      </div>
    </div>
  );
}

function NoteModal({ target, onClose, onSent }: { target: Target; onClose: () => void; onSent: () => void }) {
  const [subject, setSubject] = useState("About your Elite BCN transfer");
  const [message, setMessage] = useState(`Hello ${target.name.split(" ")[0]},\n\nI saw you started booking a transfer with us and did not finish. If anything held you back, the price, the vehicle, the timing, tell me and I will find the best option for you.\n\nYou can reply to this email or write to us on WhatsApp at any hour.`);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/abandoned", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "note", to: target.to, name: target.name, bookingId: target.bookingId, sessionId: target.sessionId, subject, message }) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      toast.success(`Sent to ${target.to}`);
      onSent();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-xl text-white">Write to {target.name}</h2>
            <p className="text-dark-400 text-xs">{target.to} · sent on the Elite BCN card, with a button back to their booking</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-dark-400 hover:text-white"><X size={14} /></button>
        </div>
        <label className="block text-[10px] text-gold-500/80 uppercase tracking-[0.15em] font-semibold mb-1.5">Subject</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input-luxury w-full px-3 py-2.5 rounded-lg text-sm mb-3" />
        <label className="block text-[10px] text-gold-500/80 uppercase tracking-[0.15em] font-semibold mb-1.5">Your message</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={9} className="input-luxury w-full px-3 py-2.5 rounded-lg text-sm leading-relaxed" />
        <button onClick={send} disabled={busy || message.trim().length < 2} className="btn-gold w-full mt-4 py-3 rounded-xl font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send
        </button>
      </div>
    </div>
  );
}

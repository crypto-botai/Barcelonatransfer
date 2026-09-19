"use client";

import { useState } from "react";
import { BellRing, Loader2, Send, X } from "lucide-react";
import toast from "react-hot-toast";

/**
 * The office writing a notification to one customer's phone (by booking) or
 * one driver's. Push and in-app; a title and a short line, like any other
 * notification they get from the site.
 */
export default function SendNotificationButton({ bookingId, driverId, label = "Send notification", compact = false }: {
  bookingId?: string; driverId?: string; label?: string; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId, driverId, title, message }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      const push = d.push?.outcome;
      toast.success(push === "sent" ? "Sent to their phone" : `Saved to their notifications${push === "skipped" ? " (no phone has turned on push yet)" : ""}`);
      setOpen(false); setTitle(""); setMessage("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)} title={label}
        className={compact
          ? "p-1.5 rounded-lg bg-gold-500/10 text-gold-400 hover:bg-gold-500/20 transition-colors"
          : "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gold-500/30 bg-gold-500/10 text-gold-300 text-xs hover:bg-gold-500/20"}
      >
        <BellRing size={compact ? 14 : 13} />{!compact && label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-xl text-white">{label}</h2>
                <p className="text-dark-400 text-xs">Appears on their phone and in their notifications. Keep it short.</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-dark-400 hover:text-white"><X size={14} /></button>
            </div>
            <label className="block text-[10px] text-gold-500/80 uppercase tracking-[0.15em] font-semibold mb-1.5">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={driverId ? "Change of plan" : "A note from Elite BCN"} className="input-luxury w-full px-3 py-2.5 rounded-lg text-sm mb-3" />
            <label className="block text-[10px] text-gold-500/80 uppercase tracking-[0.15em] font-semibold mb-1.5">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} rows={3} placeholder={driverId ? "Please call the office before you set off." : "Your chauffeur will meet you at exit 3, next to the café."} className="input-luxury w-full px-3 py-2.5 rounded-lg text-sm" />
            <p className="text-[11px] text-dark-500 mt-1 text-right">{message.length}/300</p>
            <button onClick={send} disabled={busy || !title.trim() || !message.trim()} className="btn-gold w-full mt-3 py-3 rounded-xl font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

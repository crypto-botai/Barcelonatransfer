"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";

/**
 * The conversation on one journey, for whichever side is looking at it.
 *
 * Polls every few seconds rather than holding a socket: a ride's chat is a
 * handful of short messages, and the pages this sits on (a driver's phone in
 * a moving car, a customer's tracking link) are exactly where a socket would
 * drop and never come back.
 */
type Msg = { id: string; sender: "CUSTOMER" | "DRIVER" | "PARTNER" | "ADMIN"; senderName: string; body: string; createdAt: string };

const WHO: Record<Msg["sender"], string> = { CUSTOMER: "Customer", DRIVER: "Chauffeur", PARTNER: "Dispatch", ADMIN: "Elite BCN" };

export default function TripChat({
  bookingId, code, placeholder = "Write a message…", compact = false, pollMs = 5000,
}: {
  bookingId: string;
  /** The public tracking link's proof that the reader holds the booking. */
  code?: string;
  placeholder?: string;
  compact?: boolean;
  pollMs?: number;
}) {
  const [me, setMe] = useState<Msg["sender"] | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const q = code ? `&code=${encodeURIComponent(code)}` : "";

  const load = useCallback(async (after?: string) => {
    try {
      const r = await fetch(`/api/bookings/${bookingId}/messages?after=${encodeURIComponent(after ?? "")}${q}`, { cache: "no-store" });
      if (r.status === 401) { setError("You are not part of this journey."); setLoading(false); return; }
      if (!r.ok) return;
      const data = (await r.json()) as { me: Msg["sender"]; messages: Msg[] };
      setMe(data.me);
      setMsgs((prev) => {
        if (!after) return data.messages;
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...data.messages.filter((m) => !seen.has(m.id))];
      });
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden) return;
      const last = msgs[msgs.length - 1]?.createdAt;
      load(last);
    }, pollMs);
    return () => clearInterval(t);
  }, [load, msgs, pollMs]);

  // Keep the newest message in view without yanking the page: only the list scrolls.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/bookings/${bookingId}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, code }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Could not send");
      const m = (await r.json()) as Msg;
      setMsgs((prev) => [...prev, m]);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <div ref={listRef} className={`${compact ? "max-h-56" : "max-h-80"} min-h-[120px] space-y-2 overflow-y-auto px-4 py-3`} aria-live="polite">
        {loading ? (
          <p className="inline-flex items-center gap-2 text-xs text-dark-500"><Loader2 size={12} className="animate-spin" /> Loading messages</p>
        ) : msgs.length === 0 ? (
          <p className="text-xs text-dark-500">No messages yet. Anything you write here reaches {me === "CUSTOMER" ? "your chauffeur" : "the customer"} straight away.</p>
        ) : msgs.map((m) => {
          const mine = m.sender === me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${mine ? "rounded-br-md bg-gold-500/15 text-white" : "rounded-bl-md bg-white/[0.05] text-dark-100"}`}>
                <p className="text-[10px] uppercase tracking-[0.15em] text-dark-500">{mine ? "You" : `${m.senderName} · ${WHO[m.sender]}`}</p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{m.body}</p>
                <p className="mt-1 text-[10px] text-dark-500">{new Date(m.createdAt).toLocaleTimeString("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          );
        })}
        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex items-center gap-2 border-t border-white/[0.06] px-3 py-2"
      >
        <input
          value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={1000}
          aria-label="Message"
          className="h-10 min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-transparent px-3 text-sm text-white placeholder:text-dark-500 outline-none focus:border-gold-500/50"
        />
        <button type="submit" disabled={!text.trim() || sending} aria-label="Send" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gold-500 text-black disabled:opacity-40">
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </form>
    </div>
  );
}

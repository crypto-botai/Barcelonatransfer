"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, CheckCheck, Clock, Loader2, MessageCircle, Send, Image as ImageIcon } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

/**
 * Customers' WhatsApp messages to the UK number, and the office's replies.
 *
 * Two panes on a desktop, one at a time on a phone. It looks again every ten
 * seconds while open, which is enough for a conversation without a live
 * connection. Free-text replies are only possible within 24 hours of the
 * customer's last message, and the composer says so instead of failing.
 */

type Conversation = {
  phone: string; name: string | null; lastText: string; lastAt: string; lastDir: "in" | "out";
  unread: number; windowEndsAt: string | null; windowOpen: boolean;
};
type Message = {
  wamid: string; dir: "in" | "out"; text: string; type: string; mediaId: string | null; at: string;
  by: string | null; status: "sent" | "delivered" | "read" | "failed" | null; problem: string | null;
};
type Thread = {
  phone: string; messages: Message[]; canReplyFreely: boolean;
  booking: { id: string; confirmationCode: string; status: string; guestName: string | null; pickupAddress: string; dropoffAddress: string | null; pickupDatetime: string } | null;
};

const ZONE = "Europe/Madrid";
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: ZONE });
const fmtDay = (iso: string) => {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: ZONE });
  const now = new Date();
  if (day(d) === day(now)) return "Today";
  if (day(d) === day(new Date(now.getTime() - 86400_000))) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: ZONE });
};
/** The list shows a time for today and a day otherwise. */
const fmtList = (iso: string) => (fmtDay(iso) === "Today" ? fmtTime(iso) : fmtDay(iso));

function hoursLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left to reply` : `${m}m left to reply`;
}

function Ticks({ status }: { status: Message["status"] }) {
  if (status === "failed") return <AlertTriangle size={12} className="text-red-400" aria-label="Not delivered" />;
  if (status === "read") return <CheckCheck size={13} className="text-sky-300" aria-label="Read" />;
  if (status === "delivered") return <CheckCheck size={13} className="text-dark-400" aria-label="Delivered" />;
  return <Check size={13} className="text-dark-500" aria-label="Sent" />;
}

export default function WhatsAppInboxPage() {
  const [list, setList] = useState<Conversation[] | null>(null);
  const [setup, setSetup] = useState<{ sending: boolean; receiving: boolean } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = active;

  const loadList = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/whatsapp", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setList(d.conversations);
      setSetup(d.setup);
    } catch { /* the next tick tries again */ }
  }, []);

  const loadThread = useCallback(async (phone: string, markRead: boolean) => {
    try {
      const r = await fetch(`/api/admin/whatsapp/${encodeURIComponent(phone)}`, { cache: "no-store" });
      if (!r.ok || activeRef.current !== phone) return;
      setThread(await r.json());
      if (markRead) {
        fetch(`/api/admin/whatsapp/${encodeURIComponent(phone)}`, { method: "PUT" }).then(loadList).catch(() => {});
      }
    } catch { /* ditto */ }
  }, [loadList]);

  // First load, plus a deep link from the alert email: /admin/whatsapp?phone=+34...
  useEffect(() => {
    loadList();
    const p = new URLSearchParams(window.location.search).get("phone");
    if (p) setActive(p);
  }, [loadList]);

  useEffect(() => {
    if (!active) { setThread(null); return; }
    setThread(null);
    loadThread(active, true);
  }, [active, loadThread]);

  // Look again every ten seconds while the tab is showing.
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      loadList();
      if (activeRef.current) loadThread(activeRef.current, true);
    }, 10_000);
    return () => window.clearInterval(t);
  }, [loadList, loadThread]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [thread?.messages.length, active]);

  async function send() {
    if (!active || !text.trim() || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/admin/whatsapp/${encodeURIComponent(active)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Not sent");
      setText("");
      await loadThread(active, false);
      loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Not sent");
    } finally {
      setSending(false);
    }
  }

  const current = list?.find((c) => c.phone === active) ?? null;
  const title = current?.name ?? thread?.booking?.guestName ?? active ?? "";
  const left = hoursLeft(current?.windowEndsAt ?? null);

  return (
    <div className="flex h-[100dvh] flex-col p-3 pt-16 lg:p-6 lg:pt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-500/80">Admin &middot; Messages</p>
          <h1 className="font-display text-2xl text-white lg:text-3xl">WhatsApp inbox</h1>
        </div>
        <p className="hidden text-xs text-dark-500 sm:block">Customers write to +44 7455 731577</p>
      </div>

      {setup && !setup.receiving && (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3.5 py-3 text-[13px] text-amber-200/90">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>Messages are not arriving yet. The WhatsApp webhook is not set up (it needs the verify token and app secret in the site settings).</span>
        </div>
      )}
      {setup && !setup.sending && (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3.5 py-3 text-[13px] text-amber-200/90">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>WhatsApp sending is not switched on, so replies cannot go out.</span>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Conversations */}
        <section className={cn("glass-card flex min-h-0 flex-col overflow-hidden rounded-2xl", active && "hidden lg:flex")} aria-label="Conversations">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list === null && (
              <div className="space-y-px p-2" aria-busy="true">
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />)}
              </div>
            )}
            {list && list.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <MessageCircle size={28} className="text-gold-500/60" />
                <p className="text-sm text-white">No messages yet</p>
                <p className="max-w-[26ch] text-xs leading-relaxed text-dark-400">When a customer writes to the WhatsApp number, the conversation appears here.</p>
              </div>
            )}
            {list?.map((c) => (
              <button
                key={c.phone}
                type="button"
                onClick={() => setActive(c.phone)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-white/[0.05] px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04]",
                  active === c.phone && "bg-gold-500/[0.08]",
                )}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold-500/30 bg-gold-500/10 font-display text-base text-gold-300">
                  {(c.name ?? c.phone.replace("+", ""))[0]?.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm", c.unread ? "font-semibold text-white" : "text-dark-100")}>{c.name ?? c.phone}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-dark-500">{fmtList(c.lastAt)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className={cn("truncate text-[13px]", c.unread ? "text-dark-100" : "text-dark-400")}>
                      {c.lastDir === "out" && <span className="text-dark-500">You: </span>}{c.lastText}
                    </span>
                    {c.unread > 0 && (
                      <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-gold-500 px-1.5 text-[11px] font-bold text-black">{c.unread}</span>
                    )}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Conversation */}
        <section className={cn("glass-card flex min-h-0 flex-col overflow-hidden rounded-2xl", !active && "hidden lg:flex")} aria-label="Conversation">
          {!active ? (
            <div className="grid h-full place-items-center px-6 text-center">
              <div>
                <MessageCircle size={30} className="mx-auto text-gold-500/50" />
                <p className="mt-3 text-sm text-dark-400">Choose a conversation to read and reply.</p>
              </div>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
                <button type="button" onClick={() => setActive(null)} aria-label="Back to conversations" className="grid h-10 w-10 place-items-center rounded-full text-dark-300 hover:bg-white/[0.06] hover:text-white lg:hidden">
                  <ArrowLeft size={18} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{title}</p>
                  <p className="truncate text-[12px] text-dark-400">
                    <a href={`tel:${active}`} className="hover:text-gold-300">{active}</a>
                    {thread?.booking && (
                      <> &middot; <Link href="/admin/bookings" className="text-gold-400 hover:underline">{thread.booking.confirmationCode}</Link> {thread.booking.status.toLowerCase().replace("_", " ")}</>
                    )}
                  </p>
                </div>
                {current && (
                  <span className={cn("hidden shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] sm:inline-flex", current.windowOpen ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 text-dark-400")}>
                    <Clock size={11} /> {current.windowOpen ? left ?? "Open" : "Reply window closed"}
                  </span>
                )}
              </header>

              {thread?.booking && (
                <p className="border-b border-white/[0.05] bg-white/[0.02] px-4 py-2 text-[12px] text-dark-300">
                  {new Date(thread.booking.pickupDatetime).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: ZONE })}
                  {" · "}{thread.booking.pickupAddress.split(",")[0]}{thread.booking.dropoffAddress ? ` to ${thread.booking.dropoffAddress.split(",")[0]}` : ""}
                </p>
              )}

              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite">
                {thread === null && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-dark-500" size={18} /></div>}
                {thread?.messages.map((m, i) => {
                  const prev = thread.messages[i - 1];
                  const newDay = !prev || fmtDay(prev.at) !== fmtDay(m.at);
                  return (
                    <div key={m.wamid + i}>
                      {newDay && <p className="my-3 text-center text-[11px] uppercase tracking-wider text-dark-500">{fmtDay(m.at)}</p>}
                      <div className={cn("flex", m.dir === "out" ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed sm:max-w-[70%]",
                          m.dir === "out" ? "rounded-br-md bg-gold-500/15 text-white" : "rounded-bl-md bg-white/[0.07] text-dark-100",
                        )}>
                          {m.mediaId && m.type === "image" && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <a href={`/api/admin/whatsapp/media/${m.mediaId}`} target="_blank" rel="noopener noreferrer" className="mb-1.5 block">
                              <img src={`/api/admin/whatsapp/media/${m.mediaId}`} alt="Photo from the customer" className="max-h-64 rounded-lg" loading="lazy" />
                            </a>
                          )}
                          {m.mediaId && m.type !== "image" && (
                            <a href={`/api/admin/whatsapp/media/${m.mediaId}`} target="_blank" rel="noopener noreferrer" className="mb-1 inline-flex items-center gap-1.5 text-gold-300 hover:underline">
                              <ImageIcon size={13} /> Open the {m.type}
                            </a>
                          )}
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          <p className="mt-1 flex items-center justify-end gap-1.5 text-[10px] tabular-nums text-dark-500">
                            {m.dir === "out" && m.by && <span>{m.by}</span>}
                            {fmtTime(m.at)}
                            {m.dir === "out" && <Ticks status={m.status} />}
                          </p>
                          {m.problem && <p className="mt-1 text-[11px] text-red-300">Not delivered: {m.problem}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <footer className="border-t border-white/[0.06] p-3">
                {thread && !thread.canReplyFreely ? (
                  <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-[13px] leading-relaxed text-dark-300">
                    This customer last wrote more than 24 hours ago. WhatsApp only allows an approved template message now. Ask them to write again, or use <span className="text-gold-300">Send to phone</span> on their booking.
                  </p>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
                    <label htmlFor="wa-reply" className="sr-only">Reply</label>
                    <textarea
                      id="wa-reply"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      rows={1}
                      maxLength={4000}
                      placeholder="Write a reply"
                      className="input-luxury max-h-32 min-h-[44px] flex-1 resize-none rounded-xl px-3.5 py-3 text-[14px]"
                    />
                    <button
                      type="submit"
                      disabled={!text.trim() || sending || !thread}
                      aria-label="Send reply"
                      className="btn-gold grid h-11 w-11 shrink-0 place-items-center rounded-xl disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </form>
                )}
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

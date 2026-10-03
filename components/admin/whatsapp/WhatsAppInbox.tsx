"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, Clock, ExternalLink, EyeOff, Loader2, MessageCircle, Phone, Star, TriangleAlert, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import type { ChatMessage, Conversation } from "@/lib/whatsapp-inbox";
import type { QuickReply } from "@/lib/whatsapp-settings";
import type { ResolvedService } from "@/lib/whatsapp-services";
import { dayLabel, dayOf, windowLeft } from "@/lib/whatsapp-ui";
import { cn } from "@/lib/utils";
import { ACTIVE_CHAT_KEY } from "@/components/admin/WhatsAppAlerts";
import ConversationList, { Avatar, TagPill, type FilterKey } from "./ConversationList";
import { GroupDetail, GroupsList, useGroups } from "./Groups";
import Composer, { type ComposerHandle } from "./Composer";
import { MessageBubble, PendingBubble, type PendingMessage } from "./MessageBubble";
import { useDesktopAlerts } from "./useDesktopAlerts";

/**
 * The WhatsApp inbox: the customers' chats on the left, the open chat on the
 * right, laid out and behaving like WhatsApp Web, in the brand's dark and gold.
 *
 * It asks the server every few seconds whether anything changed, passing the
 * revision it last saw, so most answers are a few bytes. Messages the office
 * sends appear at once, marked as sending, and are replaced by the real ones
 * when the server confirms. A failed send stays in place with a way to retry.
 */

type Booking = { id: string; confirmationCode: string; status: string; guestName: string | null; pickupAddress: string; dropoffAddress: string | null; pickupDatetime: string };
type Thread = { rev: string; phone: string; messages: ChatMessage[]; canReplyFreely: boolean; windowEndsAt: string | null; booking: Booking | null };
type Setup = { sending: boolean; receiving: boolean };

const POLL_MS = 4_000;
const BANNER_KEY = "wa:alerts-banner-dismissed";

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

async function api<T = unknown>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, data };
}

export default function WhatsAppInbox() {
  const [list, setList] = useState<Conversation[] | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [view, setView] = useState<"chats" | "groups">("chats");
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [pending, setPending] = useState<Record<string, PendingMessage[]>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [services, setServices] = useState<ResolvedService[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [newBelow, setNewBelow] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(true); // true until storage says otherwise: no flash

  const alerts = useDesktopAlerts();
  const groups = useGroups(view === "groups");

  const listRev = useRef<string | null>(null);
  const threadRev = useRef<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const threadSeq = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<ComposerHandle>(null);
  const atBottom = useRef(true);
  const seenCount = useRef(0);
  const lastSeenSent = useRef<string | null>(null);
  const focused = useRef(true);
  const dragDepth = useRef(0);
  activeRef.current = active;

  // ── Loading ───────────────────────────────────────────────────────────────

  const loadList = useCallback(async (force = false) => {
    try {
      const r = await api<{ unchanged?: boolean; rev: string; conversations: Conversation[]; setup: Setup }>(
        `/api/admin/whatsapp${!force && listRev.current ? `?rev=${encodeURIComponent(listRev.current)}` : ""}`,
      );
      if (!r.ok || r.data.unchanged) return;
      listRev.current = r.data.rev;
      setList(r.data.conversations);
      setSetup(r.data.setup);
    } catch { /* the next tick tries again */ }
  }, []);

  /** `applied` runs in the same render as the new thread, so a confirmed message and its placeholder swap without a flicker. */
  const loadThread = useCallback(async (phone: string, force = false, applied?: () => void) => {
    const seq = ++threadSeq.current;
    try {
      const r = await api<Thread & { unchanged?: boolean }>(
        `/api/admin/whatsapp/${encodeURIComponent(phone)}${!force && threadRev.current ? `?rev=${encodeURIComponent(threadRev.current)}` : ""}`,
      );
      // Superseded, or the chat was closed meanwhile. A newer answer carries this message too, and a
      // placeholder waiting on `applied` must still be released, or it would sit there for good.
      if (seq !== threadSeq.current || activeRef.current !== phone) { applied?.(); return; }
      if (r.ok && !r.data.unchanged) {
        threadRev.current = r.data.rev;
        setThread(r.data);
      }
      applied?.();
    } catch { applied?.(); }
  }, []);

  const loadSettings = useCallback(async () => {
    const r = await api<{ settings: { quickReplies: QuickReply[] }; services: ResolvedService[] }>("/api/admin/whatsapp/settings").catch(() => null);
    if (r?.ok) { setQuickReplies(r.data.settings.quickReplies); setServices(r.data.services); }
  }, []);

  // First load, plus a deep link from the alert: /admin/whatsapp?phone=%2B34...
  useEffect(() => {
    void loadList(true);
    void loadSettings();
    const p = new URLSearchParams(window.location.search).get("phone");
    if (p) setActive(p);
    try { setBannerDismissed(localStorage.getItem(BANNER_KEY) === "1"); } catch { setBannerDismissed(false); }
  }, [loadList, loadSettings]);

  useEffect(() => {
    threadRev.current = null;
    setThread(null);
    setReplyingTo(null);
    setNewBelow(0);
    atBottom.current = true;
    seenCount.current = 0;
    lastSeenSent.current = null;
    window[ACTIVE_CHAT_KEY] = active;
    if (active) {
      void loadThread(active, true);
      const url = new URL(window.location.href);
      url.searchParams.set("phone", active);
      window.history.replaceState(null, "", url);
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete("phone");
      window.history.replaceState(null, "", url);
    }
    return () => { window[ACTIVE_CHAT_KEY] = null; };
  }, [active, loadThread]);

  // Polling: pauses while the tab is hidden, and catches up the moment it is shown again.
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        await Promise.all([loadList(), activeRef.current ? loadThread(activeRef.current) : Promise.resolve()]);
      }
      if (!stopped) timer = window.setTimeout(tick, POLL_MS);
    };
    timer = window.setTimeout(tick, POLL_MS);
    const catchUp = () => { window.clearTimeout(timer); void tick(); };
    document.addEventListener("visibilitychange", catchUp);
    return () => { stopped = true; window.clearTimeout(timer); document.removeEventListener("visibilitychange", catchUp); };
  }, [loadList, loadThread]);

  // The clock behind "left to reply" and the closing of the 24-hour window.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  // ── Reading: clears the unread count and turns the customer's ticks blue ──

  const markRead = useCallback(async () => {
    const phone = activeRef.current;
    if (!phone || document.visibilityState !== "visible" || !focused.current) return;
    const conv = list?.find((c) => c.phone === phone);
    if (!conv || conv.unread === 0) return;
    const key = `${phone}:${conv.lastInAt}`;
    if (lastSeenSent.current === key) return;
    lastSeenSent.current = key;
    const r = await api(`/api/admin/whatsapp/${encodeURIComponent(phone)}`, { method: "PUT" }).catch(() => null);
    if (r?.ok) void loadList(true);
    else lastSeenSent.current = null; // try again on the next pass
  }, [list, loadList]);

  useEffect(() => { void markRead(); }, [markRead, thread]);

  useEffect(() => {
    const on = () => { focused.current = true; void markRead(); };
    const off = () => { focused.current = false; };
    focused.current = document.hasFocus();
    window.addEventListener("focus", on);
    window.addEventListener("blur", off);
    return () => { window.removeEventListener("focus", on); window.removeEventListener("blur", off); };
  }, [markRead]);

  // ── Scrolling ─────────────────────────────────────────────────────────────

  const scrollToEnd = useCallback((smooth: boolean) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setNewBelow(0);
  }, []);

  const myPending = active ? pending[active] ?? [] : [];

  useEffect(() => {
    if (!thread) return;
    const count = thread.messages.length;
    const grew = count - seenCount.current;
    const first = seenCount.current === 0;
    seenCount.current = count;
    if (first) { requestAnimationFrame(() => scrollToEnd(false)); return; }
    if (grew > 0) {
      const last = thread.messages[count - 1];
      // Own messages always follow you down. A customer's only do when you were already at the bottom.
      if (atBottom.current || last.dir === "out") requestAnimationFrame(() => scrollToEnd(true));
      else setNewBelow((n) => n + grew);
    }
  }, [thread, scrollToEnd]);

  useEffect(() => { if (myPending.length) requestAnimationFrame(() => scrollToEnd(true)); }, [myPending.length, scrollToEnd]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (atBottom.current && newBelow) setNewBelow(0);
  };

  const jumpTo = useCallback((wamid: string) => {
    const el = document.getElementById(`wa-${wamid}`);
    if (!el) { toast("That message is older than this chat shows."); return; }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlight(wamid);
    window.setTimeout(() => setHighlight((h) => (h === wamid ? null : h)), 1600);
  }, []);

  // ── Sending ───────────────────────────────────────────────────────────────

  const setPendingFor = useCallback((phone: string, fn: (p: PendingMessage[]) => PendingMessage[]) => {
    setPending((all) => ({ ...all, [phone]: fn(all[phone] ?? []) }));
  }, []);

  /** Run one send, tracking it as a pending bubble until the server has it. */
  const sendTracked = useCallback(
    (phone: string, base: Omit<PendingMessage, "state" | "retry" | "error">, request: () => Promise<{ ok: boolean; status: number; data: { error?: string } }>) => {
      const run = async () => {
        setPendingFor(phone, (p) => p.map((m) => (m.tempId === base.tempId ? { ...m, state: "sending", error: undefined } : m)));
        try {
          const r = await request();
          if (r.ok) {
            const drop = () => setPendingFor(phone, (p) => p.filter((m) => m.tempId !== base.tempId));
            // Wait for the real message before removing the placeholder, so there is never a gap.
            await loadThread(phone, true, drop);
            if (base.previewUrl) URL.revokeObjectURL(base.previewUrl);
            void loadList(true);
            return;
          }
          if (r.status === 409) void loadThread(phone, true);
          setPendingFor(phone, (p) => p.map((m) => (m.tempId === base.tempId ? { ...m, state: "failed", error: r.data.error ?? "Not sent" } : m)));
        } catch {
          setPendingFor(phone, (p) => p.map((m) => (m.tempId === base.tempId ? { ...m, state: "failed", error: "No connection. Check the internet and try again." } : m)));
        }
      };
      const item: PendingMessage = { ...base, state: "sending", retry: () => void run() };
      setPendingFor(phone, (p) => [...p, item]);
      void run();
    },
    [loadList, loadThread, setPendingFor],
  );

  const sendText = useCallback(
    (text: string) => {
      if (!active) return;
      const reply = replyingTo;
      setReplyingTo(null);
      const phone = active;
      sendTracked(
        phone,
        { tempId: newId(), text, at: new Date().toISOString(), kind: "text", replyTo: reply ? { wamid: reply.wamid, text: reply.text, dir: reply.dir, type: reply.type } : null },
        () => api(`/api/admin/whatsapp/${encodeURIComponent(phone)}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, replyTo: reply?.wamid ?? null }),
        }),
      );
    },
    [active, replyingTo, sendTracked],
  );

  const sendFile = useCallback(
    (file: File, caption: string) => {
      if (!active) return;
      const reply = replyingTo;
      setReplyingTo(null);
      const phone = active;
      const isImage = file.type.startsWith("image/");
      sendTracked(
        phone,
        { tempId: newId(), text: caption, at: new Date().toISOString(), kind: isImage ? "image" : "document", fileName: file.name, previewUrl: isImage ? URL.createObjectURL(file) : null },
        () => {
          const form = new FormData();
          form.append("file", file);
          if (caption) form.append("caption", caption);
          if (reply) form.append("replyTo", reply.wamid);
          return api(`/api/admin/whatsapp/${encodeURIComponent(phone)}/media`, { method: "POST", body: form });
        },
      );
    },
    [active, replyingTo, sendTracked],
  );

  /** Menus, service cards and reactions have no placeholder: they act, then the chat refreshes. */
  const act = useCallback(
    async (body: Record<string, unknown>, done?: string) => {
      if (!active) return;
      setBusy(true);
      try {
        const r = await api(`/api/admin/whatsapp/${encodeURIComponent(active)}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!r.ok) { toast.error(r.data.error ?? "Not sent"); if (r.status === 409) void loadThread(active, true); return; }
        if (done) toast.success(done);
        await loadThread(active, true);
        void loadList(true);
      } catch {
        toast.error("No connection. Check the internet and try again.");
      } finally {
        setBusy(false);
      }
    },
    [active, loadList, loadThread],
  );

  // ── Drag and drop a file anywhere on the chat ─────────────────────────────

  const canReply = Boolean(thread?.windowEndsAt && new Date(thread.windowEndsAt) > now && thread.canReplyFreely !== false);

  const onDragEnter = (e: React.DragEvent) => {
    if (!canReply || !e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragDepth.current++;
    setDragging(true);
  };
  const onDragLeave = () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragging(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!canReply) return;
    const f = e.dataTransfer.files[0];
    if (!f) return;
    const problem = composer.current?.attach(f);
    if (problem) toast.error(problem);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const conv = list?.find((c) => c.phone === active) ?? null;
  const customerName = conv?.name ?? thread?.booking?.guestName ?? active ?? "";
  const left = windowLeft(thread?.windowEndsAt ?? conv?.windowEndsAt ?? null, now);
  const draft = active ? drafts[active] ?? "" : "";

  const rows = useMemo(() => {
    const out: { m: ChatMessage; first: boolean; day: string | null }[] = [];
    (thread?.messages ?? []).forEach((m, i, all) => {
      const prev = all[i - 1];
      const day = !prev || dayOf(prev.at) !== dayOf(m.at) ? dayLabel(m.at, now) : null;
      const first = !prev || day !== null || prev.dir !== m.dir || new Date(m.at).getTime() - new Date(prev.at).getTime() > 3 * 60_000;
      out.push({ m, first, day });
    });
    return out;
  }, [thread?.messages, now]);

  /** Star or unstar a chat. Shown at once, then confirmed by the server. */
  const toggleFavorite = useCallback(async (phone: string, value: boolean) => {
    setList((l) => l && l.map((c) => (c.phone === phone ? { ...c, favorite: value } : c)));
    const r = await api(`/api/admin/whatsapp/${encodeURIComponent(phone)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorite: value }),
    }).catch(() => null);
    if (!r?.ok) toast.error("Could not change the favorite. Try again.");
    void loadList(true);
  }, [loadList]);

  /** Keep a chat as unread so it is not forgotten, and go back to the list as WhatsApp does. */
  const markUnread = useCallback(async (phone: string) => {
    const r = await api(`/api/admin/whatsapp/${encodeURIComponent(phone)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unread: true }),
    }).catch(() => null);
    if (!r?.ok) { toast.error("Could not mark it unread. Try again."); return; }
    lastSeenSent.current = null;
    setActive(null);
    await loadList(true);
    toast.success("Marked as unread");
  }, [loadList]);

  const startChat = useCallback((phone: string) => { setQuery(""); setFilter("all"); setActive(phone); }, []);

  const dismissBanner = () => { setBannerDismissed(true); try { localStorage.setItem(BANNER_KEY, "1"); } catch { /* fine */ } };

  return (
    <div className="flex h-[calc(100dvh-5rem)] flex-col pt-14 lg:h-[100dvh] lg:pt-0">
      {setup && (!setup.receiving || !setup.sending) && (
        <div className="flex items-start gap-2.5 border-b border-amber-500/25 bg-amber-500/[0.07] px-4 py-2.5 text-[13px] text-amber-200/90" role="alert">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          <span>
            {!setup.receiving ? "Messages are not arriving: the WhatsApp webhook is not set up (it needs the verify token and app secret in the site settings)." : "WhatsApp sending is not switched on, so replies cannot go out."}
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 lg:p-4">
        <div className="flex min-h-0 flex-1 overflow-hidden bg-[#0c0c0c] lg:rounded-2xl lg:border lg:border-white/[0.07] lg:shadow-2xl lg:shadow-black/40">
          {/* ── Chats ─────────────────────────────────────────────────── */}
          <aside className={cn("flex w-full min-w-0 flex-col border-r border-white/[0.06] lg:w-[24rem] lg:shrink-0", (view === "groups" ? groups.activeId : active) && "hidden lg:flex")}>
            <ConversationList
              list={list}
              active={active}
              onSelect={setActive}
              filter={filter}
              onFilter={setFilter}
              query={query}
              onQuery={setQuery}
              onToggleFavorite={toggleFavorite}
              onStartChat={startChat}
              view={view}
              onView={(v) => { setView(v); setActive(null); groups.setActiveId(null); }}
              alerts={alerts}
              showAlertBanner={!bannerDismissed}
              onDismissBanner={dismissBanner}
            />
            {view === "groups" && <GroupsList g={groups} />}
          </aside>

          {/* ── One chat ──────────────────────────────────────────────── */}
          <section
            className={cn("relative flex min-w-0 flex-1 flex-col bg-[#0a0a0a]", !(view === "groups" ? groups.activeId : active) && "hidden lg:flex")}
            aria-label="Conversation"
            onDragEnter={onDragEnter}
            onDragOver={(e) => { if (canReply) e.preventDefault(); }}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {view === "groups" ? (
              groups.activeId ? (
                <GroupDetail g={groups} conversations={list ?? []} onBack={() => groups.setActiveId(null)} onOpenChat={(p) => { setView("chats"); setActive(p); }} />
              ) : (
                <div className="grid h-full place-items-center px-8 text-center">
                  <div>
                    <span className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-gold-500/25 bg-gold-500/[0.06] text-gold-400"><Users size={32} strokeWidth={1.4} /></span>
                    <h2 className="mt-5 font-display text-2xl text-white">Groups</h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-dark-400">Pick a group, or make a new one, to write to a list of customers at once. Each person gets it privately.</p>
                  </div>
                </div>
              )
            ) : !active ? (
              <div className="grid h-full place-items-center px-8 text-center">
                <div>
                  <span className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-gold-500/25 bg-gold-500/[0.06] text-gold-400"><MessageCircle size={34} strokeWidth={1.4} /></span>
                  <h2 className="mt-5 font-display text-2xl text-white">Elite BCN on WhatsApp</h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-dark-400">Choose a chat to read and reply. Send photos, documents, saved replies and your services with prices, all from here.</p>
                </div>
              </div>
            ) : (
              <>
                <header className="flex items-center gap-3 border-b border-white/[0.06] bg-[#0f0f0f] px-2.5 py-2 sm:px-4">
                  <button type="button" onClick={() => setActive(null)} aria-label="Back to chats" className="grid h-10 w-10 place-items-center rounded-full text-dark-300 hover:bg-white/[0.06] hover:text-white lg:hidden">
                    <ArrowLeft size={20} />
                  </button>
                  <Avatar name={conv?.name ?? thread?.booking?.guestName ?? null} phone={active} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-white">{customerName}</p>
                    <p className="truncate text-[12px] text-dark-400">
                      {active}
                      {thread?.booking && <> · booking {thread.booking.confirmationCode} ({thread.booking.status.toLowerCase().replace(/_/g, " ")})</>}
                    </p>
                  </div>
                  {conv?.booking && <TagPill tag={conv.booking.tag} label={conv.booking.label} title={conv.booking.detail ?? undefined} className="hidden sm:inline-flex" />}
                  {thread && (
                    <span className={cn("hidden shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] lg:inline-flex", canReply ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 text-dark-400")}>
                      <Clock size={11} /> {canReply ? left ?? "Window open" : "Reply window closed"}
                    </span>
                  )}
                  <button type="button" onClick={() => void toggleFavorite(active, !conv?.favorite)} aria-label={conv?.favorite ? "Remove from favorites" : "Add to favorites"} aria-pressed={Boolean(conv?.favorite)} title="Favorite" className={cn("grid h-10 w-10 place-items-center rounded-full hover:bg-white/[0.06]", conv?.favorite ? "text-gold-400" : "text-dark-300 hover:text-white")}>
                    <Star size={18} fill={conv?.favorite ? "currentColor" : "none"} />
                  </button>
                  <button type="button" onClick={() => void markUnread(active)} aria-label="Mark as unread" title="Mark as unread" className="grid h-10 w-10 place-items-center rounded-full text-dark-300 hover:bg-white/[0.06] hover:text-white"><EyeOff size={18} /></button>
                  <a href={`tel:${active}`} aria-label={`Call ${customerName}`} title="Call" className="grid h-10 w-10 place-items-center rounded-full text-dark-300 hover:bg-white/[0.06] hover:text-white"><Phone size={18} /></a>
                </header>

                {thread?.booking && (
                  <Link href="/admin/bookings" className="flex items-center gap-2 border-b border-white/[0.05] bg-gold-500/[0.04] px-4 py-2 text-[12.5px] text-dark-200 hover:bg-gold-500/[0.08]">
                    <span className="truncate">
                      {new Date(thread.booking.pickupDatetime).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}
                      {" · "}{thread.booking.pickupAddress.split(",")[0]}{thread.booking.dropoffAddress ? ` → ${thread.booking.dropoffAddress.split(",")[0]}` : ""}
                    </span>
                    <ExternalLink size={12} className="ml-auto shrink-0 text-gold-400" />
                  </Link>
                )}

                <div
                  ref={scroller}
                  onScroll={onScroll}
                  className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [background-image:radial-gradient(rgba(201,168,76,0.045)_1px,transparent_1px)] [background-size:22px_22px] sm:px-[6%]"
                  aria-live="polite"
                >
                  {thread === null && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-dark-500" size={20} aria-label="Loading messages" /></div>}

                  {thread && thread.messages.length === 0 && myPending.length === 0 && (
                    <p className="mx-auto mt-10 max-w-xs rounded-lg bg-black/40 px-4 py-3 text-center text-[13px] text-dark-300">No messages yet in this chat.</p>
                  )}

                  {rows.map(({ m, first, day }) => (
                    <div key={`${m.wamid}-${m.at}`}>
                      {day && (
                        <div className="my-3 flex justify-center"><span className="rounded-lg bg-[#1a1a1a] px-3 py-1 text-[11.5px] font-medium uppercase tracking-wide text-dark-300 shadow">{day}</span></div>
                      )}
                      <MessageBubble
                        m={m}
                        customerName={customerName}
                        first={first}
                        highlighted={highlight === m.wamid}
                        canReact={canReply}
                        onReply={(msg) => { setReplyingTo(msg); composer.current?.focus(); }}
                        onReact={(msg, emoji) => void act({ reaction: { wamid: msg.wamid, emoji } })}
                        onJumpTo={jumpTo}
                        onOpenImage={setLightbox}
                      />
                    </div>
                  ))}

                  {myPending.map((p, i) => <PendingBubble key={p.tempId} p={p} first={i === 0} />)}
                </div>

                {newBelow > 0 && (
                  <button
                    type="button"
                    onClick={() => scrollToEnd(true)}
                    className="absolute bottom-24 right-5 z-10 inline-flex items-center gap-1.5 rounded-full bg-gold-500 px-3 py-2 text-[12px] font-semibold text-black shadow-lg shadow-black/50 hover:bg-gold-400"
                  >
                    <ArrowDown size={14} /> {newBelow} new
                  </button>
                )}

                {thread && !canReply ? (
                  <div className="border-t border-white/[0.06] bg-[#0f0f0f] px-4 py-3.5">
                    <p className="text-[13px] leading-relaxed text-dark-300">
                      {thread.messages.length === 0 ? (
                        <><span className="font-medium text-white">This number has not written to you yet.</span> WhatsApp only lets a business start a conversation with an approved template. Use <span className="text-gold-300">Send to phone</span> on their booking, or ask them to message you first.</>
                      ) : (
                        <><span className="font-medium text-white">The 24-hour reply window has closed.</span> WhatsApp only lets you send a pre-approved template now. Ask the customer to write again, or use <span className="text-gold-300">Send to phone</span> on their booking.</>
                      )}
                    </p>
                  </div>
                ) : (
                  <Composer
                    ref={composer}
                    value={draft}
                    onChange={(v) => active && setDrafts((d) => ({ ...d, [active]: v }))}
                    onSendText={sendText}
                    onSendFile={sendFile}
                    onSendMenu={() => void act({ menu: true }, "Services menu sent")}
                    onSendService={(id) => void act({ service: id }, "Service sent")}
                    onCancelReply={() => setReplyingTo(null)}
                    onError={(m) => toast.error(m)}
                    replyingTo={replyingTo}
                    customerName={customerName}
                    quickReplies={quickReplies}
                    services={services}
                    busy={busy}
                  />
                )}

                {dragging && (
                  <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-black/70 backdrop-blur-sm">
                    <p className="rounded-2xl border-2 border-dashed border-gold-400 px-8 py-6 text-lg text-gold-200">Drop a photo or document to send</p>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Photo" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><X size={22} /></button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Photo from the conversation" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      <a href={src} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-5 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">Open original</a>
    </div>
  );
}


"use client";

import Link from "next/link";
import { Bell, BellRing, Camera, FileText, MessageSquarePlus, Mic, Search, Settings, Star, Users, X } from "lucide-react";
import type { Conversation } from "@/lib/whatsapp-inbox";
import { TAG_LABELS, TAG_ORDER, type PaymentTag } from "@/lib/whatsapp-tags";
import { toE164 } from "@/lib/phone";
import { avatarHue, initials, listStamp, matchesSearch, previewText } from "@/lib/whatsapp-ui";
import { cn } from "@/lib/utils";
import { Ticks } from "./MessageBubble";
import type { AlertState } from "./useDesktopAlerts";

export type FilterKey = "all" | "unread" | "favorites" | PaymentTag;

export function Avatar({ name, phone, size = 44 }: { name: string | null; phone: string; size?: number }) {
  const hue = avatarHue(phone);
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, background: `hsl(${hue} 32% 22%)`, color: `hsl(${hue} 70% 78%)`, fontSize: size * 0.38 }}
      className="grid shrink-0 place-items-center rounded-full font-medium"
    >
      {initials(name, phone)}
    </span>
  );
}

const TAG_STYLE: Record<PaymentTag, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  deposit: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  cash: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  paid: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  cancelled: "border-white/15 bg-white/5 text-dark-400",
};

/** The payment badge: where the customer's money is, at a glance. */
export function TagPill({ tag, label, className, title }: { tag: PaymentTag; label: string; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[10.5px] font-medium leading-4", TAG_STYLE[tag], className)}>
      {label}
    </span>
  );
}

function LastLine({ c }: { c: Conversation }) {
  const text = previewText(c.lastType, c.lastText);
  const icon =
    c.lastType === "image" || c.lastType === "video" || c.lastType === "sticker" ? <Camera size={13} className="shrink-0" /> :
    c.lastType === "audio" ? <Mic size={13} className="shrink-0" /> :
    c.lastType === "document" ? <FileText size={13} className="shrink-0" /> : null;
  return (
    <span className={cn("flex min-w-0 items-center gap-1 text-[13px]", c.unread ? "text-dark-100" : "text-dark-400")}>
      {c.lastDir === "out" && <Ticks status={c.lastStatus} className="shrink-0" />}
      {icon}
      <span className="truncate">{text || "Message"}</span>
    </span>
  );
}

interface Props {
  list: Conversation[] | null;
  active: string | null;
  onSelect: (phone: string) => void;
  filter: FilterKey;
  onFilter: (f: FilterKey) => void;
  query: string;
  onQuery: (q: string) => void;
  onToggleFavorite: (phone: string, value: boolean) => void;
  onStartChat: (phone: string) => void;
  view: "chats" | "groups";
  onView: (v: "chats" | "groups") => void;
  alerts: { state: AlertState; enable: () => void; error: string | null };
  showAlertBanner: boolean;
  onDismissBanner: () => void;
}

export default function ConversationList({
  list, active, onSelect, filter, onFilter, query, onQuery, onToggleFavorite, onStartChat, view, onView, alerts, showAlertBanner, onDismissBanner,
}: Props) {
  const all = list ?? [];
  const counts = {
    unread: all.filter((c) => c.unread > 0).length,
    favorites: all.filter((c) => c.favorite).length,
    ...Object.fromEntries(TAG_ORDER.map((t) => [t, all.filter((c) => c.booking?.tag === t).length])),
  } as Record<string, number>;

  const matches = (c: Conversation) =>
    (filter === "all" ? true : filter === "unread" ? c.unread > 0 : filter === "favorites" ? c.favorite : c.booking?.tag === filter) && matchesSearch(c, query);
  // Starred chats first, then the most recent: the order of the list itself is by recency already.
  const shown = [...all.filter(matches)].sort((a, b) => Number(b.favorite) - Number(a.favorite));

  // A number typed that matches no chat can be started: "Search by number" finds people too.
  const typedNumber = query.trim() && /^[+\d][\d\s().-]{6,}$/.test(query.trim()) ? toE164(query.trim().startsWith("+") || query.trim().startsWith("00") ? query : `+${query.replace(/\D/g, "")}`) : null;
  const canStart = Boolean(typedNumber && !all.some((c) => c.phone === typedNumber));

  const chips: { key: FilterKey; label: string; n?: number }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread", n: counts.unread },
    { key: "favorites", label: "Favorites", n: counts.favorites },
    ...TAG_ORDER.filter((t) => t !== "cancelled" || counts.cancelled > 0).map((t) => ({ key: t as FilterKey, label: TAG_LABELS[t], n: counts[t] })),
  ];

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-3.5">
        <div className="min-w-0">
          <h1 className="font-display text-xl text-white">WhatsApp</h1>
          <p className="truncate text-[11.5px] text-dark-500">Elite BCN Transfer · +44 7455 731577</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {alerts.state === "on" && <span title="Desktop alerts are on" className="grid h-9 w-9 place-items-center text-gold-400"><BellRing size={18} /></span>}
          <Link href="/admin/whatsapp/settings" aria-label="WhatsApp settings" title="Settings: profile, services, messages, saved replies, alerts" className="grid h-9 w-9 place-items-center rounded-full text-dark-300 transition-colors hover:bg-white/[0.06] hover:text-white">
            <Settings size={18} />
          </Link>
        </div>
      </header>

      <div className="mx-3 mb-2 grid grid-cols-2 gap-1 rounded-full bg-white/[0.05] p-1" role="tablist" aria-label="Chats or groups">
        {(["chats", "groups"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => onView(v)}
            className={cn("inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 text-[13px] font-medium capitalize transition-colors", view === v ? "bg-gold-500/20 text-gold-100" : "text-dark-300 hover:text-white")}
          >
            {v === "groups" && <Users size={13} />} {v}
          </button>
        ))}
      </div>

      {showAlertBanner && alerts.state === "off" && view === "chats" && (
        <div className="mx-3 mb-2 flex items-start gap-3 rounded-xl border border-gold-500/25 bg-gold-500/[0.07] p-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-500/15 text-gold-300"><Bell size={16} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-white">Get notified of new messages</p>
            <p className="text-[12px] leading-snug text-dark-300">Turn on desktop notifications and a customer&apos;s message appears on your screen, even with this tab closed.</p>
            <button type="button" onClick={alerts.enable} className="mt-2 rounded-lg bg-gold-500 px-3 py-1.5 text-[12px] font-semibold text-black hover:bg-gold-400">Turn on</button>
            {alerts.error && <p className="mt-1.5 text-[11.5px] text-red-300">{alerts.error}</p>}
          </div>
          <button type="button" onClick={onDismissBanner} aria-label="Dismiss" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-dark-400 hover:bg-white/[0.06] hover:text-white"><X size={14} /></button>
        </div>
      )}
      {alerts.state === "denied" && showAlertBanner && view === "chats" && (
        <p className="mx-3 mb-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-[12px] leading-snug text-dark-300">
          Notifications are blocked for this site. Click the padlock beside the address bar and set Notifications to Allow.
        </p>
      )}

      {view === "chats" && (
        <div className="px-3 pb-2">
          <label className="relative block">
            <span className="sr-only">Search chats or enter a phone number</span>
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search name, number or message"
              className="h-10 w-full rounded-full border border-white/[0.07] bg-[#171717] pl-10 pr-4 text-[14px] text-white placeholder:text-dark-500 focus:border-gold-500/40 focus:outline-none"
            />
          </label>
          <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Filter chats">
            {chips.map(({ key, label, n }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => onFilter(key)}
                className={cn("shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors", filter === key ? "bg-gold-500/20 text-gold-200" : "bg-white/[0.05] text-dark-300 hover:text-white")}
              >
                {label}{n ? <span className="ml-1.5 tabular-nums opacity-70">{n}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "chats" && (
        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-label="Conversations">
          {canStart && typedNumber && (
            <button type="button" onClick={() => onStartChat(typedNumber)} className="flex w-full items-center gap-3 border-b border-white/[0.04] bg-gold-500/[0.05] px-4 py-3 text-left hover:bg-gold-500/[0.09]">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold-500/15 text-gold-300"><MessageSquarePlus size={20} /></span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium text-white">Start a chat with {typedNumber}</span>
                <span className="block text-[12.5px] text-dark-400">Opens their conversation and booking, if they have one</span>
              </span>
            </button>
          )}

          {list === null && (
            <div className="space-y-px p-2" aria-busy="true" aria-label="Loading conversations">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl p-2.5">
                  <div className="h-11 w-11 animate-pulse rounded-full bg-white/[0.06]" />
                  <div className="flex-1 space-y-2"><div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.06]" /><div className="h-3 w-4/5 animate-pulse rounded bg-white/[0.04]" /></div>
                </div>
              ))}
            </div>
          )}

          {list && list.length === 0 && !canStart && (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-8 py-16 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-gold-500/10 text-gold-400"><Bell size={24} /></span>
              <p className="text-sm font-medium text-white">No conversations yet</p>
              <p className="max-w-[28ch] text-xs leading-relaxed text-dark-400">When a customer writes to the WhatsApp number, the chat appears here and you get a notification.</p>
            </div>
          )}

          {list && list.length > 0 && shown.length === 0 && !canStart && (
            <p className="px-6 py-12 text-center text-sm text-dark-400">
              {filter === "unread" && !query ? "Nothing unread. You are all caught up." : filter === "favorites" && !query ? "Star a chat to keep it here." : "No chat matches that."}
            </p>
          )}

          {shown.map((c) => (
            <div key={c.phone} className={cn("group relative border-b border-white/[0.04] transition-colors hover:bg-white/[0.04]", active === c.phone && "bg-gold-500/[0.08]")}>
              <button
                type="button"
                onClick={() => onSelect(c.phone)}
                aria-current={active === c.phone}
                className="flex w-full items-center gap-3 px-4 py-3 pr-11 text-left focus-visible:bg-white/[0.05] focus-visible:outline-none"
              >
                <Avatar name={c.name ?? c.booking?.name ?? null} phone={c.phone} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-[15px]", c.unread ? "font-semibold text-white" : "text-dark-100")}>{c.name ?? c.booking?.name ?? c.phone}</span>
                    <span className={cn("shrink-0 text-[11.5px] tabular-nums", c.unread ? "text-gold-400" : "text-dark-500")}>{listStamp(c.lastAt)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <LastLine c={c} />
                    {c.unread > 0 && (
                      <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-gold-500 px-1.5 text-[11px] font-bold text-black" aria-label={c.markedUnread && c.unread === 1 ? "Marked unread" : `${c.unread} unread`}>
                        {c.markedUnread && c.unread === 1 ? "" : c.unread}
                      </span>
                    )}
                  </span>
                  {c.booking && (
                    <span className="mt-1 flex items-center gap-1.5">
                      <TagPill tag={c.booking.tag} label={c.booking.label} title={c.booking.detail ?? undefined} />
                      <span className="truncate text-[11px] text-dark-500">{c.booking.code}</span>
                    </span>
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(c.phone, !c.favorite)}
                aria-label={c.favorite ? `Remove ${c.name ?? c.phone} from favorites` : `Add ${c.name ?? c.phone} to favorites`}
                aria-pressed={c.favorite}
                className={cn("absolute right-2 top-2.5 grid h-8 w-8 place-items-center rounded-full transition-opacity hover:bg-white/[0.08] focus-visible:opacity-100", c.favorite ? "text-gold-400 opacity-100" : "text-dark-500 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-60")}
              >
                <Star size={15} fill={c.favorite ? "currentColor" : "none"} />
              </button>
            </div>
          ))}
        </nav>
      )}
    </>
  );
}

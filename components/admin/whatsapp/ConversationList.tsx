"use client";

import Link from "next/link";
import { Bell, BellRing, Camera, FileText, Mic, Search, Settings, X } from "lucide-react";
import type { Conversation } from "@/lib/whatsapp-inbox";
import { avatarHue, initials, listStamp, matchesSearch, previewText } from "@/lib/whatsapp-ui";
import { cn } from "@/lib/utils";
import { Ticks } from "./MessageBubble";
import type { AlertState } from "./useDesktopAlerts";

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
  filter: "all" | "unread";
  onFilter: (f: "all" | "unread") => void;
  query: string;
  onQuery: (q: string) => void;
  alerts: { state: AlertState; enable: () => void; error: string | null };
  showAlertBanner: boolean;
  onDismissBanner: () => void;
}

export default function ConversationList({ list, active, onSelect, filter, onFilter, query, onQuery, alerts, showAlertBanner, onDismissBanner }: Props) {
  const unreadChats = list?.filter((c) => c.unread > 0).length ?? 0;
  const shown = (list ?? []).filter((c) => (filter === "unread" ? c.unread > 0 : true) && matchesSearch(c, query));

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-3.5">
        <div className="min-w-0">
          <h1 className="font-display text-xl text-white">WhatsApp</h1>
          <p className="truncate text-[11.5px] text-dark-500">Elite BCN Transfer · +44 7455 731577</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {alerts.state === "on" && <span title="Desktop alerts are on" className="grid h-9 w-9 place-items-center text-gold-400"><BellRing size={18} /></span>}
          <Link href="/admin/whatsapp/settings" aria-label="WhatsApp settings" title="Settings: profile photo, services, quick replies, alerts" className="grid h-9 w-9 place-items-center rounded-full text-dark-300 transition-colors hover:bg-white/[0.06] hover:text-white">
            <Settings size={18} />
          </Link>
        </div>
      </header>

      {showAlertBanner && alerts.state === "off" && (
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
      {alerts.state === "denied" && showAlertBanner && (
        <p className="mx-3 mb-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-[12px] leading-snug text-dark-300">
          Notifications are blocked for this site. Click the padlock beside the address bar and set Notifications to Allow.
        </p>
      )}

      <div className="px-3 pb-2">
        <label className="relative block">
          <span className="sr-only">Search chats</span>
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search by name, number or message"
            className="h-10 w-full rounded-full border border-white/[0.07] bg-[#171717] pl-10 pr-4 text-[14px] text-white placeholder:text-dark-500 focus:border-gold-500/40 focus:outline-none"
          />
        </label>
        <div className="mt-2 flex gap-1.5" role="tablist" aria-label="Filter chats">
          {([["all", "All"], ["unread", `Unread${unreadChats ? ` ${unreadChats}` : ""}`]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={filter === k}
              onClick={() => onFilter(k)}
              className={cn("rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors", filter === k ? "bg-gold-500/20 text-gold-200" : "bg-white/[0.05] text-dark-300 hover:text-white")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-label="Conversations">
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

        {list && list.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 py-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-gold-500/10 text-gold-400"><Bell size={24} /></span>
            <p className="text-sm font-medium text-white">No conversations yet</p>
            <p className="max-w-[28ch] text-xs leading-relaxed text-dark-400">When a customer writes to the WhatsApp number, the chat appears here and you get a notification.</p>
          </div>
        )}

        {list && list.length > 0 && shown.length === 0 && (
          <p className="px-6 py-12 text-center text-sm text-dark-400">{filter === "unread" && !query ? "Nothing unread. You are all caught up." : "No chat matches that."}</p>
        )}

        {shown.map((c) => (
          <button
            key={c.phone}
            type="button"
            onClick={() => onSelect(c.phone)}
            aria-current={active === c.phone}
            className={cn(
              "flex w-full items-center gap-3 border-b border-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.05] focus-visible:outline-none",
              active === c.phone && "bg-gold-500/[0.08]",
            )}
          >
            <Avatar name={c.name} phone={c.phone} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={cn("truncate text-[15px]", c.unread ? "font-semibold text-white" : "text-dark-100")}>{c.name ?? c.phone}</span>
                <span className={cn("shrink-0 text-[11.5px] tabular-nums", c.unread ? "text-gold-400" : "text-dark-500")}>{listStamp(c.lastAt)}</span>
              </span>
              <span className="mt-0.5 flex items-center justify-between gap-2">
                <LastLine c={c} />
                {c.unread > 0 && (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-gold-500 px-1.5 text-[11px] font-bold text-black" aria-label={`${c.unread} unread`}>{c.unread}</span>
                )}
              </span>
            </span>
          </button>
        ))}
      </nav>
    </>
  );
}

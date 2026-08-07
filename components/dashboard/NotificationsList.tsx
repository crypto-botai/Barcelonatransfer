"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Car, CreditCard, Plane, AlertCircle, Star, MapPin, XCircle } from "lucide-react";
import type { NotificationEvent } from "@/lib/notifications/events";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  bookingId?: string | null;
}

/**
 * Icon and colour per event. Keyed by the NotificationEvent strings the
 * service writes into `type`; anything unrecognised falls back to the bell.
 */
const TYPE_CONFIG: Partial<Record<NotificationEvent, { icon: React.ElementType; color: string; bg: string }>> = {
  BOOKING_CONFIRMED: { icon: Car,        color: "text-gold-400",    bg: "bg-gold-500/10 border-gold-500/20" },
  PAYMENT_RECEIVED:  { icon: CreditCard, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  PAYMENT_FAILED:    { icon: AlertCircle,color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
  DRIVER_ASSIGNED:   { icon: Car,        color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" },
  PICKUP_REMINDER:   { icon: Bell,       color: "text-gold-400",    bg: "bg-gold-500/10 border-gold-500/20" },
  FLIGHT_DELAYED:    { icon: Plane,      color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
  DRIVER_EN_ROUTE:   { icon: MapPin,     color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
  DRIVER_ARRIVED:    { icon: MapPin,     color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  RIDE_COMPLETED:    { icon: Star,       color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
  REVIEW_REQUEST:    { icon: Star,       color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
  BOOKING_CANCELLED: { icon: XCircle,    color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
};

const FALLBACK = { icon: Bell, color: "text-dark-300", bg: "bg-white/[0.04] border-white/[0.08]" };

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsList({ initial }: { initial: NotificationItem[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const unread = items.filter((n) => !n.read).length;

  async function markAll() {
    if (busy || unread === 0) return;
    setBusy(true);
    const previous = items;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));   // optimistic
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setItems(previous);                                          // roll back on failure
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold">Notifications</h2>
          {unread > 0 && <p className="text-dark-400 text-sm mt-0.5">{unread} unread</p>}
        </div>
        {unread > 0 && (
          <button
            onClick={markAll}
            disabled={busy}
            className="text-gold-400 hover:text-gold-300 disabled:opacity-40 text-xs transition-colors"
          >
            {busy ? "Marking…" : "Mark all read"}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border border-white/[0.06]">
          <Bell size={36} className="text-dark-600 mx-auto mb-3" />
          <p className="text-white font-semibold">All caught up</p>
          <p className="text-dark-400 text-sm mt-1">
            Updates about your transfers will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const { icon: Icon, color, bg } = TYPE_CONFIG[n.type as NotificationEvent] ?? FALLBACK;
            const card = (
              <div
                className={`glass-card rounded-2xl p-4 sm:p-5 border transition-all ${
                  n.read ? "border-white/[0.06]" : "border-gold-500/20 bg-gold-500/[0.02]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl border ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon size={16} className={color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold ${n.read ? "text-dark-200" : "text-white"}`}>{n.title}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-dark-500 text-[10px] whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-gold-500" />}
                      </div>
                    </div>
                    <p className="text-dark-400 text-xs mt-1 leading-relaxed">{n.body}</p>
                  </div>
                </div>
              </div>
            );

            return n.bookingId ? (
              <Link key={n.id} href={`/dashboard/bookings?id=${n.bookingId}`} className="block">
                {card}
              </Link>
            ) : (
              <div key={n.id}>{card}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

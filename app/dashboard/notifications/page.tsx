"use client";

import { motion } from "framer-motion";
import { Bell, Car, CheckCircle2, CreditCard, Plane, AlertCircle, Star, Gift } from "lucide-react";

const DEMO_NOTIFICATIONS = [
  { id: "1", type: "booking", title: "Booking Confirmed", body: "Your transfer #383712PT has been confirmed. Pickup on 23 May 2026 at 09:00.", read: false, createdAt: new Date(Date.now() - 1 * 3600000).toISOString() },
  { id: "2", type: "driver",  title: "Driver Assigned",   body: "Carlos Martinez has been assigned to your booking. He drives a Mercedes V-Class · 4B2 3921.", read: false, createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: "3", type: "payment", title: "Payment Received",   body: "Payment of €66.00 confirmed for booking #383712PT.", read: true,  createdAt: new Date(Date.now() - 24 * 3600000).toISOString() },
  { id: "4", type: "flight",  title: "Flight Update",      body: "Flight IB3456 is on time. Expected landing 08:45. Your driver will be ready.", read: true,  createdAt: new Date(Date.now() - 48 * 3600000).toISOString() },
  { id: "5", type: "review",  title: "Leave a Review",     body: "How was your trip with Carlos on 18 May? Share your experience.", read: true,  createdAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString() },
  { id: "6", type: "loyalty", title: "Points Earned",      body: "You earned 132 loyalty points from your last booking. Total: 1,320 pts.", read: true,  createdAt: new Date(Date.now() - 6 * 24 * 3600000).toISOString() },
];

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  booking: { icon: Car,           color: "text-gold-400",    bg: "bg-gold-500/10 border-gold-500/20" },
  driver:  { icon: Car,           color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" },
  payment: { icon: CreditCard,    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  flight:  { icon: Plane,         color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
  review:  { icon: Star,          color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
  loyalty: { icon: Gift,          color: "text-pink-400",    bg: "bg-pink-500/10 border-pink-500/20" },
  alert:   { icon: AlertCircle,   color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsPage() {
  const unread = DEMO_NOTIFICATIONS.filter(n => !n.read).length;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold">Notifications</h2>
          {unread > 0 && <p className="text-dark-400 text-sm mt-0.5">{unread} unread</p>}
        </div>
        <button className="text-gold-400 hover:text-gold-300 text-xs transition-colors">Mark all read</button>
      </div>

      {DEMO_NOTIFICATIONS.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border border-white/[0.06]">
          <Bell size={36} className="text-dark-600 mx-auto mb-3" />
          <p className="text-white font-semibold">All caught up</p>
          <p className="text-dark-400 text-sm mt-1">No new notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {DEMO_NOTIFICATIONS.map((n, i) => {
            const { icon: Icon, color, bg } = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.alert;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`glass-card rounded-2xl p-4 sm:p-5 border transition-all ${n.read ? "border-white/[0.06]" : "border-gold-500/20 bg-gold-500/[0.02]"}`}
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
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

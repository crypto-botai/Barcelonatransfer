"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Plus, Menu, X, Search, Phone } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
}

interface Props {
  userName?: string;
  memberTier?: string;
  notifications?: Notification[];
  onMenuToggle?: () => void;
  mobileMenuOpen?: boolean;
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/bookings": "My Bookings",
  "/dashboard/payments": "Payments & Invoices",
  "/dashboard/locations": "Saved Addresses",
  "/dashboard/loyalty": "Loyalty & Rewards",
  "/dashboard/notifications": "Notifications",
  "/dashboard/profile": "Profile Settings",
  "/dashboard/support": "Support",
  "/dashboard/refer": "Refer & Earn",
};

export default function DashboardHeader({ userName, memberTier = "Gold", notifications = [], onMenuToggle, mobileMenuOpen }: Props) {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter(n => !n.read).length;
  const title = PAGE_TITLES[pathname] ?? "Dashboard";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center h-16 px-4 sm:px-6 bg-[#050505]/95 backdrop-blur-xl border-b border-white/[0.06]">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-lg hover:bg-white/[0.06] text-dark-400 mr-3 transition-colors"
      >
        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-white font-display text-lg truncate">{title}</h1>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Phone */}
        <a
          href="tel:+34635383712"
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] text-dark-400 hover:text-white hover:border-gold-500/30 transition-all text-xs"
        >
          <Phone size={13} className="text-gold-500" />
          <span>+34 635 383 712</span>
        </a>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2.5 rounded-xl hover:bg-white/[0.06] text-dark-400 hover:text-white transition-all"
          >
            <Bell size={18} />
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-1.5 right-1.5 w-4 h-4 bg-gold-500 rounded-full flex items-center justify-center text-[9px] font-bold text-dark-950"
              >
                {unread > 9 ? "9+" : unread}
              </motion.span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 bg-dark-900 border border-white/[0.08] rounded-2xl shadow-luxury overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <span className="text-white font-semibold text-sm">Notifications</span>
                  {unread > 0 && (
                    <span className="bg-gold-500/20 text-gold-400 text-xs px-2 py-0.5 rounded-full">{unread} new</span>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center">
                      <Bell size={28} className="text-dark-600 mx-auto mb-2" />
                      <p className="text-dark-500 text-sm">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.slice(0, 6).map((n) => (
                      <div key={n.id} className={`px-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors ${!n.read ? "bg-gold-500/[0.03]" : ""}`}>
                        <div className="flex items-start gap-3">
                          {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-gold-500 mt-1.5 flex-shrink-0" />}
                          <div className={!n.read ? "" : "pl-4"}>
                            <p className="text-white text-xs font-medium">{n.title}</p>
                            <p className="text-dark-400 text-xs mt-0.5 line-clamp-2">{n.body}</p>
                            <p className="text-dark-600 text-[10px] mt-1">
                              {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-white/[0.06]">
                  <Link
                    href="/dashboard/notifications"
                    className="block text-center text-gold-400 hover:text-gold-300 text-xs py-2 hover:bg-gold-500/5 rounded-xl transition-colors"
                    onClick={() => setNotifOpen(false)}
                  >
                    View all notifications
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Book CTA */}
        <Link
          href="/book"
          className="btn-gold flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
        >
          <Plus size={13} />
          <span className="hidden sm:inline">Book Transfer</span>
        </Link>
      </div>
    </header>
  );
}

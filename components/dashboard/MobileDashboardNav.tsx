"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Calendar, CreditCard, MapPin, Star,
  Settings, HelpCircle, Gift, Bell, LogOut, X, Plane, Car
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Overview",   href: "/dashboard",            icon: LayoutDashboard },
  { label: "Bookings",   href: "/dashboard/bookings",   icon: Calendar },
  { label: "Payments",   href: "/dashboard/payments",   icon: CreditCard },
  { label: "Loyalty",    href: "/dashboard/loyalty",    icon: Star },
  { label: "Addresses",  href: "/dashboard/locations",  icon: MapPin },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { label: "Settings",   href: "/dashboard/profile",    icon: Settings },
  { label: "Support",    href: "/dashboard/support",    icon: HelpCircle },
  { label: "Refer & Earn", href: "/dashboard/refer",   icon: Gift },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  memberTier?: string;
}

export default function MobileDashboardNav({ isOpen, onClose, userName, memberTier = "Gold" }: Props) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-72 bg-[#050505] border-r border-white/[0.06] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-16 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gold-500/10 border border-gold-500/30 flex items-center justify-center">
                  <Car size={14} className="text-gold-500" />
                </div>
                <div>
                  <span className="text-white font-semibold text-sm">Élite BCN</span>
                  <p className="text-dark-500 text-[10px] tracking-widest uppercase">Dashboard</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.06] text-dark-400">
                <X size={18} />
              </button>
            </div>

            {/* User card */}
            <div className="mx-3 mt-4 mb-2 p-3 rounded-xl bg-gradient-to-br from-gold-500/10 to-transparent border border-gold-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center text-gold-400 font-semibold">
                  {userName?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{userName ?? "Guest"}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Star size={10} className="text-gold-500 fill-gold-500" />
                    <span className="text-gold-400 text-[10px] font-medium uppercase tracking-wide">{memberTier} Member</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
              {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
                const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all ${
                      active ? "bg-gold-500/10 text-gold-400 border border-gold-500/20" : "text-dark-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <Icon size={17} className={active ? "text-gold-500" : ""} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="p-3 border-t border-white/[0.06] space-y-2">
              <Link
                href="/book"
                onClick={onClose}
                className="btn-gold w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
              >
                <Plane size={15} /> Book New Transfer
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom mobile tab bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#050505]/95 backdrop-blur-xl border-t border-white/[0.06] safe-area-inset-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {[
            { label: "Home",     href: "/dashboard",          icon: LayoutDashboard },
            { label: "Bookings", href: "/dashboard/bookings", icon: Calendar },
            { label: "Book",     href: "/book",               icon: Plane, special: true },
            { label: "Pay",      href: "/dashboard/payments", icon: CreditCard },
            { label: "Loyalty",  href: "/dashboard/loyalty",  icon: Star },
          ].map(({ label, href, icon: Icon, special }) => {
            const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all ${
                  special
                    ? "btn-gold w-12 h-12 rounded-2xl flex-col gap-0 -mt-4 shadow-gold-lg"
                    : active ? "text-gold-400" : "text-dark-500 hover:text-dark-300"
                }`}
              >
                <Icon size={special ? 20 : 18} className={special ? "text-dark-950" : ""} />
                {!special && <span className="text-[10px] font-medium">{label}</span>}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

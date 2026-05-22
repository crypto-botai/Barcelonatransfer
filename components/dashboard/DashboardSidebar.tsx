"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Calendar, Clock, CheckCircle2, XCircle,
  CreditCard, MapPin, Star, Settings, HelpCircle, Gift, Bell,
  LogOut, ChevronRight, Plane, Car, ChevronLeft
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Overview",          href: "/dashboard",              icon: LayoutDashboard },
  { label: "My Bookings",       href: "/dashboard/bookings",     icon: Calendar },
  { label: "Upcoming Trips",    href: "/dashboard/bookings?tab=upcoming", icon: Clock },
  { label: "Past Trips",        href: "/dashboard/bookings?tab=completed", icon: CheckCircle2 },
  { label: "Cancelled",         href: "/dashboard/bookings?tab=cancelled", icon: XCircle },
  { label: "Payments",          href: "/dashboard/payments",     icon: CreditCard },
  { label: "Saved Addresses",   href: "/dashboard/locations",    icon: MapPin },
  { label: "Loyalty & Rewards", href: "/dashboard/loyalty",      icon: Star },
];

const NAV_BOTTOM = [
  { label: "Notifications",    href: "/dashboard/notifications", icon: Bell },
  { label: "Profile Settings", href: "/dashboard/profile",       icon: Settings },
  { label: "Support",          href: "/dashboard/support",       icon: HelpCircle },
  { label: "Refer & Earn",     href: "/dashboard/refer",         icon: Gift },
];

interface Props {
  userName?: string;
  memberTier?: string;
  notificationCount?: number;
}

export default function DashboardSidebar({ userName, memberTier = "Gold", notificationCount = 0 }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    const base = href.split("?")[0];
    if (base === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(base);
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="hidden lg:flex flex-col h-screen sticky top-0 overflow-hidden bg-[#050505] border-r border-white/[0.06] z-40 flex-shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-white/[0.06]">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2.5"
            >
              <div className="w-7 h-7 rounded-lg bg-gold-500/10 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                <Car size={14} className="text-gold-500" />
              </div>
              <div>
                <span className="text-white font-semibold text-sm tracking-wide">Élite BCN</span>
                <p className="text-dark-500 text-[10px] tracking-widest uppercase">Dashboard</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {collapsed && (
          <div className="w-7 h-7 rounded-lg bg-gold-500/10 border border-gold-500/30 flex items-center justify-center mx-auto">
            <Car size={14} className="text-gold-500" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1.5 rounded-lg hover:bg-white/[0.06] text-dark-400 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* User card */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-3 mt-4 mb-2 p-3 rounded-xl bg-gradient-to-br from-gold-500/10 to-transparent border border-gold-500/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center text-gold-400 font-semibold text-sm flex-shrink-0">
                {userName?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{userName ?? "Guest"}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Star size={10} className="text-gold-500 fill-gold-500" />
                  <span className="text-gold-400 text-[10px] font-medium tracking-wide uppercase">{memberTier} Member</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {!collapsed && (
          <p className="text-dark-600 text-[10px] uppercase tracking-widest px-3 py-2 mt-2">Main Menu</p>
        )}
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group relative
              ${isActive(href)
                ? "bg-gold-500/10 text-gold-400 border border-gold-500/20"
                : "text-dark-400 hover:text-white hover:bg-white/[0.04]"
              }
              ${collapsed ? "justify-center" : ""}
            `}
            title={collapsed ? label : undefined}
          >
            <Icon size={16} className={`flex-shrink-0 ${isActive(href) ? "text-gold-500" : "group-hover:text-gold-500 transition-colors"}`} />
            {!collapsed && (
              <span className="truncate">{label}</span>
            )}
            {!collapsed && isActive(href) && (
              <div className="ml-auto w-1 h-1 rounded-full bg-gold-500" />
            )}
          </Link>
        ))}

        <div className="my-3 border-t border-white/[0.06]" />
        {!collapsed && (
          <p className="text-dark-600 text-[10px] uppercase tracking-widest px-3 py-2">Account</p>
        )}

        {NAV_BOTTOM.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group relative
              ${isActive(href)
                ? "bg-gold-500/10 text-gold-400 border border-gold-500/20"
                : "text-dark-400 hover:text-white hover:bg-white/[0.04]"
              }
              ${collapsed ? "justify-center" : ""}
            `}
            title={collapsed ? label : undefined}
          >
            <div className="relative flex-shrink-0">
              <Icon size={16} className={`${isActive(href) ? "text-gold-500" : "group-hover:text-gold-500 transition-colors"}`} />
              {label === "Notifications" && notificationCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-gold-500 rounded-full flex items-center justify-center text-[8px] font-bold text-dark-950">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </div>
            {!collapsed && <span className="truncate">{label}</span>}
            {!collapsed && label === "Notifications" && notificationCount > 0 && (
              <span className="ml-auto bg-gold-500/20 text-gold-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                {notificationCount}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Book CTA + Logout */}
      <div className="p-3 border-t border-white/[0.06] space-y-2">
        {!collapsed && (
          <Link
            href="/book"
            className="btn-gold w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold tracking-wide"
          >
            <Plane size={13} /> Book New Transfer
          </Link>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut size={15} className="flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </motion.aside>
  );
}

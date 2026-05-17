"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarCheck, Car, Users, DollarSign,
  Settings, LogOut, ChevronRight
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const NAV = [
  { icon: LayoutDashboard, label: "Overview",  href: "/admin" },
  { icon: CalendarCheck,   label: "Bookings",  href: "/admin/bookings" },
  { icon: Users,           label: "Drivers",   href: "/admin/drivers" },
  { icon: Car,             label: "Fleet",     href: "/admin/fleet" },
  { icon: DollarSign,      label: "Pricing",   href: "/admin/pricing" },
  { icon: Settings,        label: "Settings",  href: "/admin/settings" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 bg-[#0a0a0a] border-r border-white/[0.06] min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-white/[0.06]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 border border-gold-500 rotate-45 flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-gold-500" />
          </div>
          <span className="font-display text-base tracking-[0.2em]">
            <span className="text-white">ÉLITE</span><span className="text-gold-500">BCN</span>
          </span>
        </Link>
        <p className="text-dark-500 text-xs mt-1 ml-9">Admin Panel</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV.map(({ icon: Icon, label, href }) => {
          const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                active ? "nav-active font-medium" : "text-dark-400 hover:text-white hover:bg-white/[0.04]"
              )}>
              <Icon size={16} />
              {label}
              {active && <ChevronRight size={12} className="ml-auto" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/[0.06]">
        <button onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-dark-400 hover:text-red-400 hover:bg-red-500/5 transition-all w-full">
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, CalendarCheck, Car, Users, DollarSign,
  Settings, LogOut, ChevronRight, ChevronDown, Wallet, Clock,
  Tag, Mail, BarChart2, TrendingUp, UserCheck, PieChart, Menu, X,
  Building2, Brain, Activity, Bell, BookOpen, Zap, CreditCard,
  FlaskConical, MessageSquare, Eye, Shield, Key, Radar,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

// ─── Nav structure ─────────────────────────────────────────────────────────────
interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  sub?: { icon: React.ElementType; label: string; href: string }[];
}

const NAV: NavItem[] = [
  { icon: LayoutDashboard, label: "Overview",    href: "/admin" },
  { icon: Radar,           label: "Dispatch",    href: "/admin/dispatch" },
  { icon: CalendarCheck,   label: "Bookings",    href: "/admin/bookings" },
  { icon: PieChart,        label: "Analytics",   href: "/admin/analytics" },
  { icon: TrendingUp,      label: "Revenue",     href: "/admin/revenue" },
  { icon: UserCheck,       label: "Customers",   href: "/admin/customers" },
  { icon: Building2,       label: "Companies",   href: "/admin/companies" },
  { icon: Users,           label: "Drivers",     href: "/admin/drivers" },
  { icon: Wallet,          label: "Withdrawals", href: "/admin/withdrawals" },
  { icon: Car,             label: "Fleet",       href: "/admin/fleet" },
  { icon: DollarSign,      label: "Pricing",     href: "/admin/pricing" },
  { icon: Clock,           label: "Abandoned",   href: "/admin/abandoned" },
  { icon: Tag,             label: "Coupons",     href: "/admin/coupons" },
  { icon: Mail,            label: "Newsletter",  href: "/admin/newsletter" },
  { icon: BarChart2,       label: "Email Logs",  href: "/admin/email-logs" },

  // ── AI System ────────────────────────────────────────────────────────────────
  {
    icon:  Building2,
    label: "AI HQ",
    href:  "/admin/hq",
    sub: [
      { icon: Eye,           label: "Live Office",      href: "/admin/hq" },
      { icon: Activity,      label: "Agent Reports",    href: "/admin/hq/reports" },
      { icon: FlaskConical,  label: "Learning Queue",   href: "/admin/hq/learning" },
    ],
  },
  {
    icon:  Brain,
    label: "AI System",
    href:  "/admin/ai",
    sub: [
      { icon: Shield,        label: "Command Center",   href: "/admin/ai" },
      { icon: Zap,           label: "Agent Control",    href: "/admin/ai/agents" },
      { icon: Brain,         label: "Memory / Brain",   href: "/admin/ai/memory" },
      { icon: BookOpen,      label: "Knowledge Base",   href: "/admin/ai/knowledge" },
      { icon: Bell,          label: "Alerts",           href: "/admin/ai/alerts" },
      { icon: Activity,      label: "Activity Logs",    href: "/admin/ai/logs" },
      { icon: MessageSquare, label: "Support Chats",    href: "/admin/ai/support" },
      { icon: CreditCard,    label: "Cost & Budget",    href: "/admin/ai/cost" },
      { icon: Key,           label: "API Keys",         href: "/admin/api-keys" },
    ],
  },

  { icon: Settings, label: "Settings", href: "/admin/settings" },
];

// Bottom-nav items for mobile
const MOBILE_BOTTOM_NAV = [
  { icon: LayoutDashboard, label: "Home",      href: "/admin" },
  { icon: CalendarCheck,   label: "Bookings",  href: "/admin/bookings" },
  { icon: Brain,           label: "AI",        href: "/admin/ai" },
  { icon: TrendingUp,      label: "Revenue",   href: "/admin/revenue" },
];

// ─── Sidebar component ─────────────────────────────────────────────────────────
export default function AdminSidebar() {
  const pathname = usePathname();
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [expandedSubs, setExpandedSubs] = useState<string[]>([]);

  // Auto-expand any group whose child is currently active
  useEffect(() => {
    const active = NAV.filter(n => n.sub && n.sub.some(s => pathname.startsWith(s.href) || pathname === s.href));
    if (active.length) {
      setExpandedSubs(prev => {
        const next = [...prev];
        active.forEach(n => { if (!next.includes(n.href)) next.push(n.href); });
        return next;
      });
    }
  }, [pathname]);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const toggleSub = (href: string) =>
    setExpandedSubs(prev => prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]);

  const NavLinks = () => (
    <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
      {NAV.map(({ icon: Icon, label, href, sub }) => {
        const active    = isActive(href);
        const expanded  = expandedSubs.includes(href);
        const hasActive = sub?.some(s => pathname.startsWith(s.href));

        if (sub) {
          return (
            <div key={href}>
              {/* Group header — click expands/collapses */}
              <button
                type="button"
                onClick={() => toggleSub(href)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  hasActive ? "nav-active font-medium" : "text-dark-400 hover:text-white hover:bg-white/[0.04]"
                )}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="truncate flex-1 text-left">{label}</span>
                {expanded
                  ? <ChevronDown size={12} className="flex-shrink-0 opacity-50" />
                  : <ChevronRight size={12} className="flex-shrink-0 opacity-50" />}
              </button>

              {/* Sub-links */}
              {expanded && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/[0.05] pl-3">
                  {sub.map(({ icon: SIcon, label: sLabel, href: sHref }) => {
                    const sActive = sHref === "/admin/hq" || sHref === "/admin/ai"
                      ? pathname === sHref
                      : pathname.startsWith(sHref);
                    return (
                      <Link
                        key={sHref}
                        href={sHref}
                        onClick={() => setDrawerOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all",
                          sActive
                            ? "text-[#c9a84c] bg-[#c9a84c]/10 font-medium"
                            : "text-dark-500 hover:text-white hover:bg-white/[0.04]"
                        )}
                      >
                        <SIcon size={13} className="flex-shrink-0" />
                        <span className="truncate">{sLabel}</span>
                        {sActive && <span className="ml-auto w-1 h-1 rounded-full bg-[#c9a84c]" />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        // Flat link
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setDrawerOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
              active ? "nav-active font-medium" : "text-dark-400 hover:text-white hover:bg-white/[0.04]"
            )}
          >
            <Icon size={16} className="flex-shrink-0" />
            <span className="truncate">{label}</span>
            {active && <ChevronRight size={12} className="ml-auto flex-shrink-0" />}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 bg-[#0a0a0a] border-r border-white/[0.06] min-h-screen flex-col sticky top-0">
        {/* Logo */}
        <div className="p-5 border-b border-white/[0.06]">
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
        <NavLinks />
        <div className="p-4 border-t border-white/[0.06]">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-dark-400 hover:text-red-400 hover:bg-red-500/5 transition-all w-full"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile top header ─────────────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#0a0a0a] border-b border-white/[0.06] flex items-center justify-between px-4 h-14">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 border border-gold-500 rotate-45 flex items-center justify-center">
            <div className="w-2 h-2 bg-gold-500" />
          </div>
          <span className="font-display text-sm tracking-[0.2em]">
            <span className="text-white">ÉLITE</span><span className="text-gold-500">BCN</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-dark-500 text-xs">Admin</span>
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 text-dark-400 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* ── Mobile drawer overlay ──────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer ─────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "lg:hidden fixed top-0 right-0 bottom-0 z-50 w-72 bg-[#0a0a0a] border-l border-white/[0.06] flex flex-col transition-transform duration-300 ease-in-out",
          drawerOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">Admin Panel</p>
            <p className="text-dark-500 text-xs mt-0.5">Élite BCN Transfers</p>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 text-dark-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <NavLinks />
        <div className="p-4 border-t border-white/[0.06]">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-dark-400 hover:text-red-400 hover:bg-red-500/5 transition-all w-full"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom navigation bar ──────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a] border-t border-white/[0.06] flex items-center">
        {MOBILE_BOTTOM_NAV.map(({ icon: Icon, label, href }) => {
          const active = isActive(href);
          return (
            <Link
              key={href} href={href}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors",
                active ? "text-gold-400" : "text-dark-500 hover:text-dark-200"
              )}
            >
              <Icon size={18} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
        {/* "More" button opens the drawer */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center gap-1 py-2.5 text-dark-500 hover:text-dark-200 transition-colors"
        >
          <Menu size={18} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>
    </>
  );
}

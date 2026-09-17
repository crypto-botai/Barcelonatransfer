"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion, useReducedMotion } from "framer-motion";
import { Sun, ListChecks, Users, Wallet, Building2, LogOut } from "lucide-react";

/**
 * The frame around every partner page: a rail on desktop, a tab bar on the
 * phone a dispatcher is more likely holding. Five destinations, no more.
 */
const NAV = [
  { href: "/partner",          label: "Today",    icon: Sun },
  { href: "/partner/jobs",     label: "Jobs",     icon: ListChecks },
  { href: "/partner/drivers",  label: "Drivers",  icon: Users },
  { href: "/partner/payments", label: "Payments", icon: Wallet },
  { href: "/partner/account",  label: "Account",  icon: Building2 },
];

export default function PartnerShell({
  company, contact, suspended, children,
}: {
  company: string; contact: string; suspended: boolean; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const isActive = (href: string) => href === "/partner" ? pathname === "/partner" : pathname.startsWith(href);

  return (
    <div className="min-h-[100dvh] bg-[#0b0a08] text-white">
      {/* A faint warm vignette so the black has depth without a gradient blob. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_50%_at_20%_0%,rgba(201,168,76,0.07),transparent_70%)]" />

      <div className="relative mx-auto flex max-w-[1400px]">
        {/* Rail */}
        <aside className="sticky top-0 hidden h-[100dvh] w-60 flex-shrink-0 flex-col border-r border-white/[0.06] px-5 py-7 lg:flex">
          <Link href="/partner" className="block">
            <span className="font-display text-[22px] tracking-[0.28em] text-white">ELITE<span className="text-gold-500">BCN</span></span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.3em] text-dark-500">Fleet partner</span>
          </Link>

          <div className="mt-8 border-t border-white/[0.06] pt-6">
            <p className="truncate font-medium text-white">{company}</p>
            <p className="truncate text-xs text-dark-400">{contact}</p>
          </div>

          <nav className="mt-8 flex flex-col gap-1" aria-label="Partner panel">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${active ? "text-white" : "text-dark-400 hover:text-white hover:bg-white/[0.03]"}`}
                >
                  {active && (
                    <motion.span
                      layoutId="partner-nav-active"
                      className="absolute inset-0 rounded-lg border border-gold-500/25 bg-gold-500/[0.08]"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                    />
                  )}
                  <Icon size={16} strokeWidth={1.6} className={`relative ${active ? "text-gold-400" : ""}`} />
                  <span className="relative">{label}</span>
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-auto flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-dark-400 transition-colors hover:bg-white/[0.03] hover:text-white"
          >
            <LogOut size={16} strokeWidth={1.6} /> Sign out
          </button>
        </aside>

        {/* Page */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
          <div className="mb-5 flex items-center justify-between lg:hidden">
            <span className="font-display text-lg tracking-[0.28em]">ELITE<span className="text-gold-500">BCN</span></span>
            <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="text-xs text-dark-400">Sign out</button>
          </div>
          {suspended && (
            <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              This account is not active yet. Elite BCN activates a new company after reviewing it; a suspended one after contact. Nothing can be dispatched meanwhile.
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Phone tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0b0a08]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Partner panel">
        <div className="grid grid-cols-5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex h-14 flex-col items-center justify-center gap-1 text-[10px] ${active ? "text-gold-400" : "text-dark-400"}`}>
                <Icon size={18} strokeWidth={1.6} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

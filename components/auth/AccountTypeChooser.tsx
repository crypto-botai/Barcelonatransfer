"use client";

import Link from "next/link";
import { Building2, Car, UserRound } from "lucide-react";

/**
 * The three kinds of account, side by side, so nobody signs up as the wrong
 * one. Each leads to its own sign-up; once created, the login page sends
 * every account to its own panel by role.
 */
const KINDS = [
  { key: "customer", href: "/auth/register",    icon: UserRound, title: "Customer",      body: "Book transfers, track your chauffeur, keep your history." },
  { key: "driver",   href: "/driver/register",  icon: Car,       title: "Driver",        body: "Drive for Elite BCN with your own licensed vehicle." },
  { key: "partner",  href: "/partner/register", icon: Building2, title: "Fleet company", body: "A company with several drivers, taking jobs from Elite BCN." },
] as const;

export default function AccountTypeChooser({ current, compact = false }: { current?: "customer" | "driver" | "partner"; compact?: boolean }) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3"}`} role="navigation" aria-label="Account type">
      {KINDS.map(({ key, href, icon: Icon, title, body }) => {
        const active = key === current;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-xl border px-3 py-3 transition-colors ${active ? "border-gold-500/60 bg-gold-500/10" : "border-white/[0.08] hover:border-white/20 hover:bg-white/[0.03]"}`}
          >
            <Icon size={16} className={active ? "text-gold-400" : "text-dark-400"} />
            <p className={`mt-2 text-sm font-medium ${active ? "text-white" : "text-dark-200"}`}>{title}</p>
            {!compact && <p className="mt-0.5 text-[11px] leading-snug text-dark-500">{body}</p>}
          </Link>
        );
      })}
    </div>
  );
}

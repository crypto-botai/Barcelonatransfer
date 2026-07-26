"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// The navbar's "Book Now" CTA is desktop-only (hidden lg:flex) — on mobile it's
// buried inside the hamburger menu, so a visitor scrolling a destination or
// pricing page has no visible way to start a booking without opening the menu
// first. This puts one persistent, thumb-reachable CTA at the bottom of the
// screen on every public marketing page.
const EXCLUDED_PREFIXES = ["/admin", "/dashboard", "/driver", "/auth", "/book", "/booking", "/review"];

export default function MobileBookBar() {
  const pathname = usePathname();
  if (EXCLUDED_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  return (
    <div
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/[0.08]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <Link
        href="/book"
        className="flex items-center justify-center gap-2 w-full py-3.5 text-[#0a0a0a] bg-[#c9a84c] font-semibold text-sm tracking-wide active:bg-[#b8983f] transition-colors"
      >
        Book Your Transfer — Fixed Price
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}

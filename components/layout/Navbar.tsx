"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu, X, Phone, ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTranslations } from "@/components/language/I18nProvider";
import { cn } from "@/lib/utils";
import LanguageSwitcher from "@/components/language/LanguageSwitcher";

export default function Navbar() {
  const t = useTranslations("nav");
  const [scrolled, setScrolled]   = useState(false);
  const [mobileOpen, setMobile]   = useState(false);
  const [dropdown, setDropdown]   = useState<string | null>(null);
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const dashboardHref = role === "ADMIN" ? "/admin" : role === "DRIVER" ? "/driver" : null;

  const NAV_LINKS = [
    { label: t("services"),   href: "/#services" },
    { label: t("fleet"),      href: "/fleet" },
    { label: t("pricing"),    href: "/pricing" },
    {
      label: t("transfers"),
      href: "/transfers",
      children: [
        { label: t("airportTransfers"),  href: "/airport-transfers" },
        { label: t("corporateTravel"),   href: "/corporate" },
        { label: t("hourlyChaufeur"),    href: "/hourly" },
      ],
    },
    { label: "Guides",     href: "/blog" },
    { label: t("about"),   href: "/about" },
    { label: t("contact"), href: "/contact" },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMobile(false); }, [pathname]);

  return (
    <>
      {/* No mount fade here. The navbar is above the fold on every page, and a
          framer-motion opacity:0 -> 1 leaves it invisible in the SSR HTML until
          hydration runs — the same JS-gated-first-paint problem that was costing
          the hero its LCP. The scroll background still transitions via CSS. */}
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          scrolled
            ? "bg-black/95 backdrop-blur-xl border-b border-gold-500/20 shadow-[0_8px_40px_rgba(0,0,0,0.8)]"
            : "bg-transparent"
        )}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 border border-gold-500 rotate-45 flex items-center justify-center group-hover:bg-gold-500 transition-colors duration-300">
                <div className="w-3 h-3 bg-gold-500 group-hover:bg-black transition-colors duration-300" />
              </div>
              <span className="font-display text-xl tracking-[0.25em] font-medium">
                <span className="text-white">ELITE</span>
                <span className="text-gold-500">BCN</span>
              </span>
            </Link>

            {/* Desktop Links */}
            <ul className="hidden lg:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <li key={link.label} className="relative">
                  {link.children ? (
                    <div
                      className="relative"
                      onMouseEnter={() => setDropdown(link.label)}
                      onMouseLeave={() => setDropdown(null)}
                    >
                      <Link
                        href={link.href}
                        className={cn(
                          "flex items-center gap-1 text-sm font-medium tracking-wider transition-colors duration-200",
                          "text-dark-300 hover:text-gold-400"
                        )}
                      >
                        {link.label}
                        <ChevronDown size={14} className={cn(
                          "transition-transform duration-200",
                          dropdown === link.label && "rotate-180"
                        )} />
                      </Link>
                      {dropdown === link.label && (
                        <div className="animate-menu-in absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 glass-card rounded-xl overflow-hidden">
                          {link.children.map((c) => (
                            <Link
                              key={c.href}
                              href={c.href}
                              className="block px-4 py-3 text-sm text-dark-300 hover:text-gold-400 hover:bg-gold-500/5 transition-colors border-b border-white/5 last:border-0"
                            >
                              {c.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link
                      href={link.href}
                      className={cn(
                        "text-sm font-medium tracking-wider transition-colors duration-200 hover:text-gold-400",
                        pathname === link.href ? "text-gold-400" : "text-dark-300"
                      )}
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>

            {/* CTA Group */}
            <div className="hidden lg:flex items-center gap-3">
              <a
                href="tel:+34635383712"
                className="flex items-center gap-2 text-sm text-dark-300 hover:text-gold-400 transition-colors"
              >
                <Phone size={14} />
                <span className="tracking-wide">+34 635 383 712</span>
              </a>
              <LanguageSwitcher />
              <Link
                href="/book"
                className="btn-gold px-5 py-2.5 rounded-lg text-sm font-semibold tracking-wide"
              >
                {t("bookNow")}
              </Link>
              {dashboardHref && (
                <Link
                  href={dashboardHref}
                  className="flex items-center gap-1.5 text-sm text-gold-400 hover:text-gold-300 transition-colors tracking-wide"
                >
                  <LayoutDashboard size={14} />
                  {t("dashboard")}
                </Link>
              )}
            </div>

            {/* Mobile right side */}
            <div className="lg:hidden flex items-center gap-2">
              <LanguageSwitcher compact />
              <button
                onClick={() => setMobile(!mobileOpen)}
                style={{ touchAction: "manipulation" }}
                className="p-2.5 text-dark-300 hover:text-gold-400 transition-colors"
                aria-label="Toggle menu"
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu. The drawer slides in with CSS; the per-item stagger is a
          CSS delay rather than seven more animated components. The panel is
          opaque instead of blurred — a full-screen backdrop-blur is one of the
          most expensive things a phone can be asked to composite. */}
      {mobileOpen && (
        <div className="animate-drawer-in fixed inset-0 z-40 bg-black flex flex-col pt-24 px-6 pb-8 overflow-y-auto">
            <nav className="flex flex-col gap-2">
              {NAV_LINKS.map((link, i) => (
                <div
                  key={link.label}
                  className="animate-menu-in"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {link.children ? (
                    <div>
                      <p className="text-dark-400 text-xs tracking-[0.2em] uppercase px-2 pt-4 pb-2">
                        {link.label}
                      </p>
                      {link.children.map((c) => (
                        <Link
                          key={c.href}
                          href={c.href}
                          className="block py-3 px-2 text-lg text-dark-200 hover:text-gold-400 transition-colors border-b border-white/5"
                          onClick={() => setMobile(false)}
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Link
                      href={link.href}
                      className="block py-4 px-2 text-xl font-display text-white hover:text-gold-400 transition-colors border-b border-white/5"
                      onClick={() => setMobile(false)}
                    >
                      {link.label}
                    </Link>
                  )}
                </div>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-3 pt-8">
              <Link
                href="/book"
                className="btn-gold w-full py-4 rounded-xl text-center text-base font-semibold tracking-wide"
                onClick={() => setMobile(false)}
              >
                {t("mobileBook")}
              </Link>
              {dashboardHref && (
                <Link
                  href={dashboardHref}
                  className="flex items-center justify-center gap-2 py-4 rounded-xl border border-gold-500/30 text-gold-400 hover:text-gold-300 transition-colors"
                  onClick={() => setMobile(false)}
                >
                  <LayoutDashboard size={16} />
                  <span>{t("dashboard")}</span>
                </Link>
              )}
              {dashboardHref && (
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex items-center justify-center gap-2 w-full py-4 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors font-semibold"
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              )}
              <a
                href="tel:+34635383712"
                className="flex items-center justify-center gap-2 py-4 rounded-xl border border-white/10 text-dark-300 hover:text-gold-400 transition-colors"
              >
                <Phone size={16} />
                <span>+34 635 383 712</span>
              </a>
            </div>
        </div>
      )}
    </>
  );
}

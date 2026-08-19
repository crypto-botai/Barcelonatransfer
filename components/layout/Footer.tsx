"use client";

import Link from "next/link";
import { Mail, Phone, MessageCircle, MapPin, Instagram, Facebook } from "lucide-react";
import { useTranslations } from "@/components/language/I18nProvider";
import NewsletterForm from "@/components/marketing/NewsletterForm";
import { COMPANY } from "@/lib/company-facts";

export default function Footer() {
  const t = useTranslations("footer");

  const SERVICES = [
    { key: "airportTransfers",  href: "/airport-transfers" },
    { key: "corporateTravel",   href: "/corporate" },
    { key: "hourlyChaufeur",    href: "/hourly" },
    { key: "cruisePort",        href: "/transfers/cruise-port" },
    { key: "hotelTransfers",    href: "/hotel-transfers" },
    { key: "vipTransportation", href: "/vip-transportation" },
    { key: "privateTours",      href: "/day-tours" },
  ];

  // All 7 fleet vehicles. business-sedan (Camry) was previously missing here,
  // which left /fleet/business-sedan with no inbound link anywhere on the site.
  const FLEET_LINKS = [
    { key: "standardSedan",    href: "/fleet/standard-sedan",    label: "Toyota Corolla" },
    { key: "businessSedan",    href: "/fleet/business-sedan",    label: "Toyota Camry" },
    { key: "electricVehicle",  href: "/fleet/tesla-model-3",     label: "Tesla Model 3" },
    { key: "luxurySedan",      href: "/fleet/eqe-300-electric",  label: null },
    { key: "executiveMinivan", href: "/fleet/executive-minivan", label: null },
    { key: "luxuryMinivan",    href: "/fleet/luxury-minivan",    label: null },
    { key: "groupMinibus",     href: "/fleet/group-minibus",     label: null },
  ];

  const DESTINATIONS = [
    { key: "barcelonaAirport", href: "/airport-transfers" },
    { key: "sitges",           href: "/transfers/sitges" },
    { key: "lloretDeMar",      href: "/transfers/lloret-de-mar" },
    { key: "portAventura",     href: "/transfers/port-aventura" },
    { key: "andorra",          href: "/transfers/andorra" },
    { key: "gironaAirport",    href: "/transfers/girona" },
    { key: "tarragona",        href: "/transfers/tarragona" },
    { key: "cadaques",         href: "/transfers/cadaques" },
  ] as const;

  return (
    <footer className="bg-[#050505] border-t border-white/[0.06]">
      {/* Newsletter bar */}
      <div className="border-b border-gold-500/15 bg-gradient-to-r from-transparent via-gold-500/5 to-transparent">
        <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="font-display text-xl text-white">{t("newsletter.title")}</p>
            <p className="text-dark-400 text-sm mt-1">{t("newsletter.subtitle")}</p>
          </div>
          <div className="w-full md:w-auto md:min-w-[340px]">
            <NewsletterForm source="footer" />
          </div>
        </div>
      </div>

      {/* Top CTA bar */}
      <div className="border-b border-gold-500/15">
        <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-display text-lg text-white">{t("cta.title")}</p>
            <p className="text-dark-400 text-sm mt-1">{t("cta.subtitle")}</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/book"
              className="btn-gold px-6 py-3 rounded-lg text-sm font-semibold tracking-wide whitespace-nowrap"
            >
              {t("cta.button")}
            </Link>
            <a
              href="https://wa.me/34635383712"
              target="_blank"
              rel="noreferrer"
              className="btn-outline-gold px-6 py-3 rounded-lg text-sm font-semibold tracking-wide whitespace-nowrap flex items-center gap-2"
            >
              <MessageCircle size={14} />
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-5 group w-fit">
              <div className="w-8 h-8 border border-gold-500 rotate-45 flex items-center justify-center">
                <div className="w-3 h-3 bg-gold-500" />
              </div>
              <span className="font-display text-xl tracking-[0.25em]">
                <span className="text-white">ELITE</span>
                <span className="text-gold-500">BCN</span>
              </span>
            </Link>
            <p className="text-dark-400 text-sm leading-relaxed mb-6 max-w-xs">
              {t("tagline")}
            </p>
            <div className="flex flex-col gap-3">
              <a href="tel:+34635383712" className="flex items-center gap-3 text-sm text-dark-400 hover:text-gold-400 transition-colors">
                <Phone size={14} className="text-gold-500/60" />
                +34 635 383 712
              </a>
              <a href={`mailto:${COMPANY.email}`} className="flex items-center gap-3 text-sm text-dark-400 hover:text-gold-400 transition-colors">
                <Mail size={14} className="text-gold-500/60" />
                {COMPANY.email}
              </a>
              <a href="https://wa.me/34635383712" target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm text-dark-400 hover:text-gold-400 transition-colors">
                <MessageCircle size={14} className="text-gold-500/60" />
                {t("contact.whatsapp")}
              </a>
              <p className="flex items-center gap-3 text-sm text-dark-400">
                <MapPin size={14} className="text-gold-500/60 flex-shrink-0" />
                {t("contact.location")}
              </p>
            </div>
            {/* The handle is elitebcn.info on all three. These previously
                pointed at "elitebcntransfers", which is not an account. */}
            <div className="flex gap-3 mt-5">
              <a
                href="https://www.instagram.com/elitebcn.info"
                target="_blank"
                rel="noreferrer"
                aria-label="Elite BCN on Instagram"
                className="w-9 h-9 border border-white/10 rounded-lg flex items-center justify-center text-dark-400 hover:text-gold-400 hover:border-gold-500/30 transition-all"
              >
                <Instagram size={16} />
              </a>
              <a
                href="https://www.facebook.com/elitebcn.info"
                target="_blank"
                rel="noreferrer"
                aria-label="Elite BCN on Facebook"
                className="w-9 h-9 border border-white/10 rounded-lg flex items-center justify-center text-dark-400 hover:text-gold-400 hover:border-gold-500/30 transition-all"
              >
                <Facebook size={16} />
              </a>
              <a
                href="https://www.tiktok.com/@elitebcn.info"
                target="_blank"
                rel="noreferrer"
                aria-label="Elite BCN on TikTok"
                className="w-9 h-9 border border-white/10 rounded-lg flex items-center justify-center text-dark-400 hover:text-gold-400 hover:border-gold-500/30 transition-all"
              >
                {/* lucide has no TikTok glyph, so the mark is inline. */}
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.83-2.48V9.77a5.68 5.68 0 1 0 4.92 5.63V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.24-1.48z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <p className="text-white text-xs tracking-[0.2em] uppercase mb-5 font-medium">{t("sections.services")}</p>
            <ul className="flex flex-col gap-2.5">
              {SERVICES.map((s) => (
                <li key={s.key}>
                  <Link href={s.href} className="text-sm text-dark-400 hover:text-gold-400 transition-colors">
                    {t(`links.${s.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Fleet */}
          <div>
            <p className="text-white text-xs tracking-[0.2em] uppercase mb-5 font-medium">{t("sections.fleet")}</p>
            <ul className="flex flex-col gap-2.5">
              {FLEET_LINKS.map((f) => (
                <li key={f.key}>
                  <Link href={f.href} className="text-sm text-dark-400 hover:text-gold-400 transition-colors">
                    {/* Vehicle names are proper nouns and identical in every
                        locale, so they bypass the translation table. */}
                    {f.label ?? t(`links.${f.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Destinations */}
          <div>
            <p className="text-white text-xs tracking-[0.2em] uppercase mb-5 font-medium">{t("sections.destinations")}</p>
            <ul className="flex flex-col gap-2.5">
              {DESTINATIONS.map(({ key, href }) => (
                <li key={key}>
                  <Link href={href} className="text-sm text-dark-400 hover:text-gold-400 transition-colors">
                    {t(`links.${key}`)}
                  </Link>
                </li>
              ))}
              {/* The only priority destination with no sitewide link. */}
              <li>
                <Link href="/transfers/costa-brava" className="text-sm text-dark-400 hover:text-gold-400 transition-colors">
                  Costa Brava
                </Link>
              </li>
              <li>
                <Link href="/transfers" className="text-sm text-dark-400 hover:text-gold-400 transition-colors">
                  All destinations
                </Link>
              </li>
              {/* The cost calculator had no inbound link anywhere on the site. */}
              <li>
                <Link href="/tools/transfer-cost-calculator" className="text-sm text-dark-400 hover:text-gold-400 transition-colors">
                  Transfer cost calculator
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-white/[0.06]">
        <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-dark-400 text-xs">
            © {new Date().getFullYear()} Elite BCN Transfers. {t("copyright")}
          </p>
          <div className="flex gap-5">
            <Link href="/blog"         className="text-xs text-dark-400 hover:text-gold-400 transition-colors">Travel Guides</Link>
            <Link href="/faq"          className="text-xs text-dark-400 hover:text-gold-400 transition-colors">{t("legal.faq")}</Link>
            <Link href="/privacy"      className="text-xs text-dark-400 hover:text-dark-300 transition-colors">{t("legal.privacy")}</Link>
            <Link href="/terms"        className="text-xs text-dark-400 hover:text-dark-300 transition-colors">{t("legal.terms")}</Link>
            <Link href="/cookies"      className="text-xs text-dark-400 hover:text-dark-300 transition-colors">{t("legal.cookies")}</Link>
            <Link href="/auth/login"   className="text-xs text-dark-400 hover:text-dark-300 transition-colors">Driver & Partner Login</Link>
          </div>
        </div>
      </div>

      {/* SEO text (visually hidden but crawlable) */}
      <div className="sr-only">
        <p>Barcelona Airport Transfer · Barcelona Chauffeur Service · Luxury Transfer Barcelona · Private Driver Barcelona · VIP Transfer Barcelona · Barcelona to Sitges · Barcelona to Andorra · Barcelona Cruise Port Transfer · Mercedes Chauffeur Barcelona · Executive Transfer Barcelona</p>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { Mail, Phone, MessageCircle, MapPin, Instagram, Facebook } from "lucide-react";

const SERVICES = [
  { label: "Airport Transfers",  href: "/airport-transfers" },
  { label: "Corporate Travel",   href: "/corporate" },
  { label: "Hourly Chauffeur",   href: "/hourly" },
  { label: "Cruise Port",        href: "/airport-transfers#cruise" },
  { label: "VIP Transportation", href: "/fleet" },
  { label: "Private Day Tours",  href: "/about#tours" },
];

const DESTINATIONS = [
  "Barcelona Airport",
  "Sitges",
  "Lloret de Mar",
  "PortAventura",
  "Andorra",
  "Girona Airport",
  "Tarragona",
  "Cadaqués",
];

const FLEET_LINKS = [
  { label: "Standard Sedan",    href: "/fleet#economy" },
  { label: "Luxury Sedan",      href: "/fleet#luxury" },
  { label: "Executive Minivan", href: "/fleet#minivan" },
  { label: "Luxury Minivan",    href: "/fleet#luxury-minivan" },
  { label: "Group Minibus",     href: "/fleet#minibus" },
  { label: "Electric Vehicle",  href: "/fleet#electric" },
];

export default function Footer() {
  return (
    <footer className="bg-[#050505] border-t border-white/[0.06]">
      {/* Top CTA bar */}
      <div className="border-b border-gold-500/15 bg-gradient-to-r from-transparent via-gold-500/5 to-transparent">
        <div className="container mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-xl text-white">Ready for your luxury transfer?</h3>
            <p className="text-dark-400 text-sm mt-1">Book online in 2 minutes. Instant confirmation.</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/book"
              className="btn-gold px-6 py-3 rounded-lg text-sm font-semibold tracking-wide whitespace-nowrap"
            >
              Book Now
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
                <span className="text-white">ÉLITE</span>
                <span className="text-gold-500">BCN</span>
              </span>
            </Link>
            <p className="text-dark-400 text-sm leading-relaxed mb-6 max-w-xs">
              Barcelona&apos;s premier luxury chauffeur service. Professional drivers,
              premium vehicles, impeccable service — 24/7, 365 days a year.
            </p>
            <div className="flex flex-col gap-3">
              <a href="tel:+34635383712" className="flex items-center gap-3 text-sm text-dark-400 hover:text-gold-400 transition-colors">
                <Phone size={14} className="text-gold-500/60" />
                +34 635 383 712
              </a>
              <a href="mailto:vtcbcn2025@gmail.com" className="flex items-center gap-3 text-sm text-dark-400 hover:text-gold-400 transition-colors">
                <Mail size={14} className="text-gold-500/60" />
                vtcbcn2025@gmail.com
              </a>
              <a href="https://wa.me/34635383712" target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm text-dark-400 hover:text-gold-400 transition-colors">
                <MessageCircle size={14} className="text-gold-500/60" />
                WhatsApp Chat
              </a>
              <p className="flex items-center gap-3 text-sm text-dark-400">
                <MapPin size={14} className="text-gold-500/60 flex-shrink-0" />
                Barcelona, Spain · Licensed VTC
              </p>
            </div>
            <div className="flex gap-3 mt-5">
              <a href="#" className="w-9 h-9 border border-white/10 rounded-lg flex items-center justify-center text-dark-400 hover:text-gold-400 hover:border-gold-500/30 transition-all">
                <Instagram size={16} />
              </a>
              <a href="#" className="w-9 h-9 border border-white/10 rounded-lg flex items-center justify-center text-dark-400 hover:text-gold-400 hover:border-gold-500/30 transition-all">
                <Facebook size={16} />
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-white text-xs tracking-[0.2em] uppercase mb-5 font-medium">Services</h4>
            <ul className="flex flex-col gap-2.5">
              {SERVICES.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="text-sm text-dark-400 hover:text-gold-400 transition-colors">
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Fleet */}
          <div>
            <h4 className="text-white text-xs tracking-[0.2em] uppercase mb-5 font-medium">Fleet</h4>
            <ul className="flex flex-col gap-2.5">
              {FLEET_LINKS.map((f) => (
                <li key={f.label}>
                  <Link href={f.href} className="text-sm text-dark-400 hover:text-gold-400 transition-colors">
                    {f.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Destinations */}
          <div>
            <h4 className="text-white text-xs tracking-[0.2em] uppercase mb-5 font-medium">Destinations</h4>
            <ul className="flex flex-col gap-2.5">
              {DESTINATIONS.map((d) => (
                <li key={d}>
                  <Link href="/pricing" className="text-sm text-dark-400 hover:text-gold-400 transition-colors">
                    {d}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-white/[0.06]">
        <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-dark-500 text-xs">
            © {new Date().getFullYear()} Élite BCN Transfers. All rights reserved. Licensed VTC Operator — Barcelona, Spain.
          </p>
          <div className="flex gap-5">
            <Link href="/faq" className="text-xs text-dark-500 hover:text-gold-400 transition-colors">FAQ</Link>
            {["Privacy Policy", "Terms & Conditions", "Cookie Policy"].map((t) => (
              <Link key={t} href="#" className="text-xs text-dark-500 hover:text-dark-300 transition-colors">
                {t}
              </Link>
            ))}
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

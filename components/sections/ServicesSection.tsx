"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Plane, Anchor, Briefcase, Building2, Theater, Clock, Waves, Sunset, Mountain, Hotel, Crown, Map, ArrowRight } from "lucide-react";

const SERVICES = [
  { icon: Plane,     title: "Airport Transfers",     href: "/airport-transfers", desc: "Meet & greet with real-time flight monitoring. Complimentary 60-minute wait." },
  { icon: Anchor,    title: "Cruise Port Transfers",  href: "/airport-transfers#cruise", desc: "Seamless door-to-ship service at Barcelona Cruise Terminal." },
  { icon: Briefcase, title: "Executive Chauffeur",    href: "/corporate", desc: "Dedicated professional chauffeur for business meetings and corporate events." },
  { icon: Building2, title: "Corporate Accounts",     href: "/corporate", desc: "Premium corporate accounts with priority fleet, invoicing, and dedicated manager." },
  { icon: Theater,   title: "VIP Events",             href: "/fleet", desc: "Luxury transportation for weddings, galas, film sets, and private events." },
  { icon: Clock,     title: "Hourly Chauffeur Hire",  href: "/hourly", desc: "Your private driver at your disposal — minimum 4 hours, maximum flexibility." },
  { icon: Waves,     title: "Costa Brava Transfers",  href: "/pricing", desc: "Lloret de Mar, Platja d'Aro, Tossa, Cadaqués — the complete coast." },
  { icon: Sunset,    title: "Costa Dorada Transfers", href: "/pricing", desc: "Sitges, Salou, PortAventura, Tarragona in maximum comfort." },
  { icon: Mountain,  title: "Andorra Transfers",      href: "/pricing", desc: "Premium transfer from Barcelona to Andorra — shopping, skiing, or business." },
  { icon: Hotel,     title: "Hotel Transfers",        href: "/book", desc: "Door-to-door luxury service to all 4 and 5-star hotels across Barcelona." },
  { icon: Crown,     title: "VIP Transportation",     href: "/fleet#first-class", desc: "Discrete, exclusive service for high-profile clients requiring absolute privacy." },
  { icon: Map,       title: "Private Day Tours",      href: "/about#tours", desc: "Montserrat, La Roca Village, Girona wine country, and Dalí's museums." },
];

export default function ServicesSection() {
  return (
    <section className="py-24 bg-dark-950" id="services">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4"
          >
            Our Services
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-display text-4xl sm:text-5xl text-white mb-4"
          >
            Premium Chauffeur <span className="text-gold-gradient">Services</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-dark-400 max-w-xl mx-auto"
          >
            Every journey crafted to perfection — from airport arrivals to private tours across Catalonia and Spain.
          </motion.p>
          <div className="gold-divider mt-6" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {SERVICES.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                href={s.href}
                className="group glass-card gold-hover-border rounded-xl p-5 flex flex-col h-full hover:bg-white/[0.04] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mb-4 group-hover:bg-gold-500/15 transition-colors">
                  <s.icon size={18} className="text-gold-500" />
                </div>
                <h3 className="text-white font-medium mb-2 group-hover:text-gold-400 transition-colors">
                  {s.title}
                </h3>
                <p className="text-dark-400 text-sm leading-relaxed flex-1">{s.desc}</p>
                <div className="flex items-center gap-1 mt-4 text-gold-500/60 group-hover:text-gold-400 transition-colors text-xs">
                  <span>Learn more</span>
                  <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          {[
            { icon: "🛫", title: "Flight Monitoring",   desc: "Real-time tracking" },
            { icon: "⏳", title: "Free Waiting",        desc: "60 min at airports" },
            { icon: "🪧", title: "Meet & Greet",        desc: "Name board in arrivals" },
            { icon: "💳", title: "Fixed Prices",        desc: "No surge, ever" },
          ].map((p) => (
            <div
              key={p.title}
              className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]"
            >
              <span className="text-2xl">{p.icon}</span>
              <div>
                <p className="text-white text-sm font-medium">{p.title}</p>
                <p className="text-dark-400 text-xs">{p.desc}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

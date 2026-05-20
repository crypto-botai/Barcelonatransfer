"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const TABS = ["Airport & City", "Costa Dorada", "Costa Brava", "Hourly"];

const AIRPORT = [
  { route: "El Prat Airport ⇄ Barcelona City",   p1: 50,  p2: 65,  p3: 95,  p4: 80  },
  { route: "El Prat Airport ⇄ Cruise Terminal",  p1: 50,  p2: 65,  p3: 95,  p4: 80  },
  { route: "Cruise Terminal ⇄ Barcelona City",   p1: 50,  p2: 65,  p3: 95,  p4: 80  },
  { route: "El Prat Airport ⇄ Sants Station",    p1: 55,  p2: 65,  p3: 105, p4: 90  },
  { route: "Barcelona ⇄ La Roca Village",        p1: 80,  p2: 100, p3: 170, p4: 150 },
  { route: "Barcelona ⇄ Montserrat",             p1: 120, p2: 140, p3: 210, p4: 190 },
  { route: "Barcelona ⇄ Girona Airport",         p1: 140, p2: 155, p3: 220, p4: 200 },
  { route: "Barcelona ⇄ Andorra",               p1: 260, p2: 285, p3: 380, p4: 350 },
];

const DORADA = [
  { route: "Barcelona ⇄ Castelldefels", p1: 50,  p2: 60,  p3: 100, p4: 85  },
  { route: "Barcelona ⇄ Sitges",        p1: 80,  p2: 100, p3: 160, p4: 140 },
  { route: "Barcelona ⇄ Cubelles",      p1: 90,  p2: 110, p3: 175, p4: 155 },
  { route: "Barcelona ⇄ Calafell",      p1: 100, p2: 120, p3: 190, p4: 170 },
  { route: "Barcelona ⇄ Tarragona",     p1: 150, p2: 170, p3: 240, p4: 220 },
  { route: "Barcelona ⇄ Salou",         p1: 155, p2: 175, p3: 250, p4: 230 },
  { route: "Barcelona ⇄ PortAventura",  p1: 155, p2: 175, p3: 250, p4: 230 },
  { route: "Barcelona ⇄ Cambrils",      p1: 160, p2: 180, p3: 260, p4: 240 },
];

const BRAVA = [
  { route: "Barcelona ⇄ Mataró",        p1: 90,  p2: 110, p3: 175, p4: 155 },
  { route: "Barcelona ⇄ Calella",       p1: 110, p2: 130, p3: 200, p4: 180 },
  { route: "Barcelona ⇄ Santa Susanna", p1: 120, p2: 140, p3: 210, p4: 190 },
  { route: "Barcelona ⇄ Blanes",        p1: 135, p2: 155, p3: 230, p4: 210 },
  { route: "Barcelona ⇄ Lloret de Mar", p1: 145, p2: 165, p3: 240, p4: 220 },
  { route: "Barcelona ⇄ Tossa de Mar",  p1: 155, p2: 175, p3: 255, p4: 235 },
  { route: "Barcelona ⇄ Platja d'Aro",  p1: 160, p2: 180, p3: 260, p4: 240 },
  { route: "Barcelona ⇄ Cadaqués",      p1: 240, p2: 260, p3: 360, p4: 330 },
];

const HOURLY = [
  { label: "Economy / Business",       price: 45,  unit: "/ hour", min: "Min. 4 hours" },
  { label: "Luxury Sedan",             price: 65,  unit: "/ hour", min: "Min. 4 hours" },
  { label: "First Class",              price: 110, unit: "/ hour", min: "Min. 4 hours" },
  { label: "Executive SUV",            price: 75,  unit: "/ hour", min: "Min. 4 hours" },
  { label: "Minivan (Vito)",           price: 55,  unit: "/ hour", min: "Min. 4 hours" },
  { label: "Luxury Minivan (V-Class)", price: 65,  unit: "/ hour", min: "Min. 4 hours" },
  { label: "Minibus",                  price: 160, unit: "/ hour", min: "Min. 4 hours" },
];

type Row = { route: string; p1: number; p2: number; p3: number; p4: number };

function PriceTable({ data, search }: { data: Row[]; search: string }) {
  const filtered = data.filter((r) =>
    r.route.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left py-3 px-4 text-xs text-dark-400 tracking-wider uppercase font-medium">Route</th>
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">Economy<br /><span className="text-dark-600 normal-case">1–3 pax</span></th>
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">Business<br /><span className="text-dark-600 normal-case">1–3 pax</span></th>
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">V-Class<br /><span className="text-dark-600 normal-case">5–7 pax</span></th>
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">Minivan<br /><span className="text-dark-600 normal-case">4–7 pax</span></th>
            <th className="py-3 px-4" />
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.route} className="price-row border-b border-white/[0.04]">
              <td className="py-3.5 px-4 text-sm text-dark-200">{r.route}</td>
              <td className="py-3.5 px-3 text-center text-sm text-white font-medium">€{r.p1}</td>
              <td className="py-3.5 px-3 text-center text-sm text-white font-medium">€{r.p2}</td>
              <td className="py-3.5 px-3 text-center text-sm text-gold-400 font-semibold">€{r.p3}</td>
              <td className="py-3.5 px-3 text-center text-sm text-white font-medium">€{r.p4}</td>
              <td className="py-3.5 px-4">
                <Link
                  href={`/book?route=${encodeURIComponent(r.route)}`}
                  className="text-xs text-gold-500/70 hover:text-gold-400 transition-colors whitespace-nowrap"
                >
                  Book →
                </Link>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-dark-500 text-sm">
                No routes found.{" "}
                <Link href="/book" className="text-gold-500 hover:text-gold-400">Request a custom quote</Link>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function PricingSection() {
  const [tab,    setTab]    = useState(0);
  const [search, setSearch] = useState("");

  return (
    <section className="py-24 bg-[#070707]" id="pricing">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4"
          >
            Fixed Pricing
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-display text-4xl sm:text-5xl text-white mb-4"
          >
            Transparent <span className="text-gold-gradient">Luxury Pricing</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-dark-400 max-w-xl mx-auto mb-6"
          >
            All prices are fixed and all-inclusive. No hidden fees. No surge pricing. Ever.
          </motion.p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-dark-400">
            {["No surge pricing", "Fixed fare guaranteed", "Free cancellation 24h", "Instant confirmation"].map((g) => (
              <span key={g} className="flex items-center gap-1.5">
                <span className="text-gold-500">✦</span> {g}
              </span>
            ))}
          </div>
          <div className="gold-divider mt-8" />
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Tab controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 border-b border-white/[0.06]">
            <div className="flex gap-2 flex-wrap">
              {TABS.map((t, i) => (
                <button
                  key={t}
                  onClick={() => { setTab(i); setSearch(""); }}
                  className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wider transition-all ${
                    tab === i
                      ? "bg-gold-500 text-black"
                      : "text-dark-400 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {tab < 3 && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
                <input
                  type="text"
                  placeholder="Search destination…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-luxury pl-8 pr-4 py-2 rounded-lg text-sm w-48"
                />
              </div>
            )}
          </div>

          {/* Table */}
          <div className="p-2">
            {tab === 0 && <PriceTable data={AIRPORT} search={search} />}
            {tab === 1 && <PriceTable data={DORADA}  search={search} />}
            {tab === 2 && <PriceTable data={BRAVA}   search={search} />}
            {tab === 3 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                {HOURLY.map((h) => (
                  <div key={h.label} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 text-center">
                    <h3 className="text-white text-sm font-medium mb-3">{h.label}</h3>
                    <p className="font-display text-3xl text-gold-400">{formatCurrency(h.price)}</p>
                    <p className="text-dark-400 text-xs mb-1">{h.unit}</p>
                    <p className="text-dark-500 text-xs mb-4">{h.min}</p>
                    <Link href="/hourly" className="btn-gold block py-2.5 rounded-lg text-xs font-semibold">
                      Book Hourly
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="p-5 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-dark-500 text-xs">
              All prices include professional chauffeur, luxury vehicle, tolls, and meet & greet. Child seats available free.
            </p>
            <Link href="/book" className="btn-gold flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap">
              Get Custom Quote <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

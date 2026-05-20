"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const TABS = ["Airport & City", "Costa Dorada", "Costa Brava", "Hourly"];

const AIRPORT = [
  { route: "El Prat Airport ⇄ Barcelona City",   eco: 50,  bus: 65,  van: 65,  vcl: 70,  mbs: 150 },
  { route: "El Prat Airport ⇄ Cruise Terminal",  eco: 50,  bus: 65,  van: 65,  vcl: 70,  mbs: 150 },
  { route: "Cruise Terminal ⇄ Barcelona City",   eco: 50,  bus: 65,  van: 65,  vcl: 70,  mbs: 150 },
  { route: "El Prat Airport ⇄ Sants Station",    eco: 55,  bus: 65,  van: 65,  vcl: 75,  mbs: 155 },
  { route: "Barcelona ⇄ La Roca Village",        eco: 80,  bus: 100, van: 100, vcl: 120, mbs: 200 },
  { route: "Barcelona ⇄ Montserrat",             eco: 120, bus: 140, van: 140, vcl: 160, mbs: 240 },
  { route: "Barcelona ⇄ Girona Airport",         eco: 140, bus: 155, van: 155, vcl: 175, mbs: 255 },
  { route: "Barcelona ⇄ Andorra",                eco: 285, bus: 350, van: 450, vcl: 550, mbs: 630 },
];

const DORADA = [
  { route: "Barcelona ⇄ Castelldefels", eco: 50,  bus: 60,  van: 60,  vcl: 70,  mbs: 150 },
  { route: "Barcelona ⇄ Sitges",        eco: 80,  bus: 100, van: 100, vcl: 120, mbs: 200 },
  { route: "Barcelona ⇄ Cubelles",      eco: 90,  bus: 110, van: 110, vcl: 130, mbs: 210 },
  { route: "Barcelona ⇄ Calafell",      eco: 100, bus: 120, van: 120, vcl: 140, mbs: 220 },
  { route: "Barcelona ⇄ Vendrell",      eco: 110, bus: 130, van: 130, vcl: 150, mbs: 230 },
  { route: "Barcelona ⇄ Tarragona",     eco: 150, bus: 170, van: 170, vcl: 190, mbs: 270 },
  { route: "Barcelona ⇄ La Pineda",     eco: 155, bus: 175, van: 175, vcl: 195, mbs: 275 },
  { route: "Barcelona ⇄ Salou",         eco: 155, bus: 175, van: 175, vcl: 195, mbs: 275 },
  { route: "Barcelona ⇄ PortAventura",  eco: 155, bus: 175, van: 175, vcl: 195, mbs: 275 },
  { route: "Barcelona ⇄ Cambrils",      eco: 160, bus: 180, van: 180, vcl: 200, mbs: 280 },
];

const BRAVA = [
  { route: "Barcelona ⇄ Mataró",         eco: 90,  bus: 110, van: 110, vcl: 130, mbs: 210 },
  { route: "Barcelona ⇄ Calella",        eco: 110, bus: 130, van: 130, vcl: 150, mbs: 230 },
  { route: "Barcelona ⇄ Pineda de Mar",  eco: 115, bus: 135, van: 135, vcl: 155, mbs: 235 },
  { route: "Barcelona ⇄ Santa Susanna",  eco: 120, bus: 140, van: 140, vcl: 160, mbs: 240 },
  { route: "Barcelona ⇄ Malgrat de Mar", eco: 125, bus: 145, van: 145, vcl: 165, mbs: 245 },
  { route: "Barcelona ⇄ Blanes",         eco: 135, bus: 155, van: 155, vcl: 175, mbs: 255 },
  { route: "Barcelona ⇄ Lloret de Mar",  eco: 145, bus: 165, van: 165, vcl: 185, mbs: 265 },
  { route: "Barcelona ⇄ Tossa de Mar",   eco: 155, bus: 175, van: 175, vcl: 195, mbs: 275 },
  { route: "Barcelona ⇄ S'Agaró",        eco: 155, bus: 175, van: 175, vcl: 195, mbs: 275 },
  { route: "Barcelona ⇄ Platja d'Aro",   eco: 160, bus: 180, van: 180, vcl: 200, mbs: 280 },
  { route: "Barcelona ⇄ Palamós",        eco: 185, bus: 205, van: 205, vcl: 225, mbs: 305 },
  { route: "Barcelona ⇄ Roses",          eco: 205, bus: 225, van: 225, vcl: 245, mbs: 325 },
  { route: "Barcelona ⇄ Empuriabrava",   eco: 210, bus: 230, van: 230, vcl: 250, mbs: 330 },
  { route: "Barcelona ⇄ Figueres",       eco: 200, bus: 220, van: 220, vcl: 240, mbs: 320 },
  { route: "Barcelona ⇄ Cadaqués",       eco: 240, bus: 260, van: 260, vcl: 280, mbs: 360 },
];

const HOURLY = [
  { label: "Economy (1–3 pax)",   price: 40, unit: "/ hour", min: "Min. 4 hours" },
  { label: "Business (1–3 pax)",  price: 40, unit: "/ hour", min: "Min. 4 hours" },
  { label: "Minivan (4–6 pax)",   price: 50, unit: "/ hour", min: "Min. 4 hours" },
  { label: "V-Class (7–8 pax)",   price: 60, unit: "/ hour", min: "Min. 4 hours" },
  { label: "Minibus (9+ pax)",    price: 80, unit: "/ hour", min: "Min. 4 hours" },
];

type Row = { route: string; eco: number; bus: number; van: number; vcl: number; mbs: number };

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
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">Minivan<br /><span className="text-dark-600 normal-case">4–6 pax</span></th>
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">V-Class<br /><span className="text-dark-600 normal-case">7–8 pax</span></th>
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">Minibus<br /><span className="text-dark-600 normal-case">9+ pax</span></th>
            <th className="py-3 px-4" />
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.route} className="price-row border-b border-white/[0.04]">
              <td className="py-3.5 px-4 text-sm text-dark-200">{r.route}</td>
              <td className="py-3.5 px-3 text-center text-sm text-white font-medium">€{r.eco}</td>
              <td className="py-3.5 px-3 text-center text-sm text-white font-medium">€{r.bus}</td>
              <td className="py-3.5 px-3 text-center text-sm text-white font-medium">€{r.van}</td>
              <td className="py-3.5 px-3 text-center text-sm text-gold-400 font-semibold">€{r.vcl}</td>
              <td className="py-3.5 px-3 text-center text-sm text-white font-medium">€{r.mbs}</td>
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
              <td colSpan={7} className="py-8 text-center text-dark-500 text-sm">
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
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 p-4">
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
              All prices include professional chauffeur, luxury vehicle, tolls, and meet & greet. VAT 10% included. Child seats available free.
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

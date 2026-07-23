"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ROUTES, HOURLY_RATES, MIN_HOURLY_HOURS, type RoutePrice } from "@/lib/pricing";
import PriceCell from "@/components/pricing/PriceCell";

const TABS = ["Airport & City", "Costa Dorada", "Costa Brava", "Hourly"];

const AIRPORT  = ROUTES.filter((r) => r.category === "airport");
const DORADA   = ROUTES.filter((r) => r.category === "costa-dorada");
const BRAVA    = ROUTES.filter((r) => r.category === "costa-brava");

const HOURLY = [
  { label: "Economy (1–3 pax)",      price: HOURLY_RATES.ECONOMY,        min: MIN_HOURLY_HOURS.ECONOMY        },
  { label: "Business (1–3 pax)",     price: HOURLY_RATES.BUSINESS,       min: MIN_HOURLY_HOURS.BUSINESS       },
  { label: "Minivan Vito (4–8 pax)", price: HOURLY_RATES.MINIVAN,        min: MIN_HOURLY_HOURS.MINIVAN        },
  { label: "V-Class Luxury (7 pax)", price: HOURLY_RATES.LUXURY_MINIVAN, min: MIN_HOURLY_HOURS.LUXURY_MINIVAN },
  { label: "Minibus (9+ pax)",       price: HOURLY_RATES.MINIBUS,        min: MIN_HOURLY_HOURS.MINIBUS        },
];


function PriceTable({ data, search }: { data: RoutePrice[]; search: string }) {
  const filtered = data.filter((r) =>
    r.label.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left py-3 px-4 text-xs text-dark-400 tracking-wider uppercase font-medium">Route</th>
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">Economy<br /><span className="text-dark-600 normal-case">1–3 pax</span></th>
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">Business<br /><span className="text-dark-600 normal-case">1–3 pax</span></th>
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">Minivan<br /><span className="text-dark-600 normal-case">4–8 pax</span></th>
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">V-Class<br /><span className="text-dark-600 normal-case">7 pax</span></th>
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">Minibus<br /><span className="text-dark-600 normal-case">9+ pax</span></th>
            <th className="py-3 px-4" />
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.label} className="price-row border-b border-white/[0.04]">
              <td className="py-3.5 px-4 text-sm text-dark-200">{r.label}</td>
              <PriceCell amount={r.economy}  wasAmount={r.wasEconomy}  />
              <PriceCell amount={r.business} wasAmount={r.wasBusiness} />
              <PriceCell amount={r.minivan} />
              <PriceCell amount={r.vclass} gold />
              <PriceCell amount={r.minibus} />
              <td className="py-3.5 px-4">
                <Link
                  href="/book"
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
                    <p className="text-dark-400 text-xs mb-1">/ hour</p>
                    <p className="text-dark-500 text-xs mb-4">Min. {h.min} hours</p>
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
              All prices are final and include VAT, tolls, professional chauffeur, and meet &amp; greet. Child seats free. Airport &amp; City routes include a limited-time promotional discount (struck price shows full rate).
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

"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { HOURLY_RATES, MIN_HOURLY_HOURS } from "@/lib/pricing";
import PriceCell from "@/components/pricing/PriceCell";
import type { PublicRoute } from "@/lib/pricing-service";
import { useTranslations } from "@/components/language/I18nProvider";

const TAB_KEYS = ["tabAirportCity", "tabCostaDorada", "tabCostaBrava", "tabHourly"] as const;

const HOURLY_CARDS = [
  { label: "Economy (1–3 pax)",      price: HOURLY_RATES.ECONOMY,        min: MIN_HOURLY_HOURS.ECONOMY        },
  { label: "Business (1–3 pax)",     price: HOURLY_RATES.BUSINESS,       min: MIN_HOURLY_HOURS.BUSINESS       },
  { label: "Minivan Vito (4–8 pax)", price: HOURLY_RATES.MINIVAN,        min: MIN_HOURLY_HOURS.MINIVAN        },
  { label: "V-Class Luxury (7 pax)", price: HOURLY_RATES.LUXURY_MINIVAN, min: MIN_HOURLY_HOURS.LUXURY_MINIVAN },
];

function PriceTable({ data, search }: { data: PublicRoute[]; search: string }) {
  const t = useTranslations("pricing");
  const filtered = data.filter((r) =>
    r.label.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left py-3 px-4 text-xs text-dark-400 tracking-wider uppercase font-medium">{t("colRoute")}</th>
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">Economy<br /><span className="text-dark-400 normal-case">1–3 pax</span></th>
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">Business<br /><span className="text-dark-400 normal-case">1–3 pax</span></th>
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">Minivan<br /><span className="text-dark-400 normal-case">4–8 pax</span></th>
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">V-Class<br /><span className="text-dark-400 normal-case">7 pax</span></th>
            <th className="text-center py-3 px-3 text-xs text-dark-400 tracking-wider uppercase font-medium">Minibus<br /><span className="text-dark-400 normal-case">9+ pax</span></th>
            {/* Screen-reader-only header: an empty <th> leaves every cell in the
                Book column headerless, which fails the td-has-header audit. */}
            <th className="py-3 px-4"><span className="sr-only">Book</span></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.slug} className="price-row border-b border-white/[0.04]">
              <td className="py-3.5 px-4 text-sm text-dark-200">
                {r.label}
                {r.note && <span className="ml-2 text-xs text-dark-400">({r.note})</span>}
              </td>
              <PriceCell amount={r.economy}  />
              <PriceCell amount={r.business} />
              <PriceCell amount={r.minivan} />
              <PriceCell amount={r.vclass} gold />
              <PriceCell amount={r.minibus} />
              <td className="py-3.5 px-4">
                <Link
                  href="/book"
                  className="text-xs text-gold-500/70 hover:text-gold-400 transition-colors whitespace-nowrap"
                >
                  {t("book")} →
                </Link>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-dark-400 text-sm">
                {t("noRoutes")}{" "}
                <Link href="/book" className="text-gold-500 hover:text-gold-400">{t("noRoutesCta")}</Link>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  routes: PublicRoute[];
}

export default function PricingSection({ routes }: Props) {
  const t = useTranslations("pricing");
  const [tab,    setTab]    = useState(0);
  const [search, setSearch] = useState("");

  const airport = routes.filter((r) => r.category === "airport");
  const dorada  = routes.filter((r) => r.category === "costa-dorada");
  const brava   = routes.filter((r) => r.category === "costa-brava");

  return (
    <section className="py-24 bg-[#070707]" id="pricing">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">
            Fixed Pricing
          </span>
          <h2 className="font-display text-4xl sm:text-5xl text-white mb-4">
            {t("headingLead")} <span className="text-gold-gradient">{t("headingAccent")}</span>
          </h2>
          <p className="text-dark-400 max-w-xl mx-auto mb-6">
            {t("footnote")}
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-dark-400">
            {[t("guarantee1"), t("guarantee2"), t("guarantee3"), t("guarantee4")].map((g) => (
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
              {TAB_KEYS.map((tabKey, i) => (
                <button
                  key={tabKey}
                  onClick={() => { setTab(i); setSearch(""); }}
                  className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wider transition-all ${
                    tab === i
                      ? "bg-gold-500 text-black"
                      : "text-dark-400 hover:text-white"
                  }`}
                >
                  {t(tabKey)}
                </button>
              ))}
            </div>
            {tab < 3 && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
                <input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-luxury pl-8 pr-4 py-2 rounded-lg text-sm w-48"
                />
              </div>
            )}
          </div>

          {/* Table */}
          <div className="p-2">
            {tab === 0 && <PriceTable data={airport} search={search} />}
            {tab === 1 && <PriceTable data={dorada}  search={search} />}
            {tab === 2 && <PriceTable data={brava}   search={search} />}
            {tab === 3 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 p-4">
                {HOURLY_CARDS.map((h) => (
                  <div key={h.label} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 text-center">
                    <h3 className="text-white text-sm font-medium mb-3">{h.label}</h3>
                    <p className="font-display text-3xl text-gold-400">{formatCurrency(h.price)}</p>
                    <p className="text-dark-400 text-xs mb-1">/ hour</p>
                    <p className="text-dark-400 text-xs mb-4">Min. {h.min} hours</p>
                    <Link href="/hourly" className="btn-gold block py-2.5 rounded-lg text-xs font-semibold">
                      {t("bookHourly")}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="p-5 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-dark-400 text-xs">
              {/* Translated, not hardcoded: this is the line that says VAT and
                  tolls sit outside the fare, and it stayed in English on every
                  locale page while the table around it changed language. */}
              <strong className="text-white">{t("vatNoteLead")}</strong>{" "}
              {t("vatNoteBody")}
            </p>
            <Link href="/book" className="btn-gold flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap">
              {t("getInstantPrice")} <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

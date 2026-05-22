"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Users, Briefcase, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { VEHICLE_CATALOG } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { DEFAULT_PRICING } from "@/lib/pricing";
import "@/lib/i18n";

function badgeClass(badge: string) {
  if (badge === "VIP")         return "bg-[#c9a84c] text-black";
  if (badge === "Eco")         return "bg-emerald-600/90 text-white";
  if (badge === "Popular")     return "bg-blue-600/80 text-white";
  if (badge === "Large Group") return "bg-violet-600/80 text-white";
  return "bg-white/10 text-white";
}

function FleetCard({
  vehicle,
  index,
  mobile = false,
}: {
  vehicle: (typeof VEHICLE_CATALOG)[number];
  index: number;
  mobile?: boolean;
}) {
  const { t } = useTranslation();
  const price = DEFAULT_PRICING[vehicle.class].minimumFare;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: mobile ? 0 : Math.min(index * 0.04, 0.28) }}
      className={mobile ? "flex-shrink-0 w-[268px] snap-start" : ""}
    >
      <div className="group flex flex-col h-full rounded-2xl overflow-hidden border border-white/[0.07] bg-[#0b0b0b] hover:border-[#c9a84c]/30 transition-colors duration-300">
        {/* Vehicle image */}
        <div className="relative h-44 bg-[#080808] overflow-hidden">
          {vehicle.badge && (
            <span className={`absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide ${badgeClass(vehicle.badge)}`}>
              {vehicle.badge}
            </span>
          )}
          <Image
            src={vehicle.image}
            alt={vehicle.label}
            fill
            sizes="(max-width: 1024px) 268px, (max-width: 1280px) 33vw, 25vw"
            className="object-contain p-6 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            style={{ filter: "drop-shadow(0 18px 36px rgba(0,0,0,0.92))" }}
          />
        </div>

        {/* Separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-[#c9a84c]/18 to-transparent" />

        {/* Content */}
        <div className="flex flex-col flex-1 p-5 gap-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-[1.1rem] text-white leading-snug">{vehicle.label}</h3>
              <p className="text-white/25 text-xs mt-0.5 truncate">{vehicle.models[0]}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[9px] text-white/20 uppercase tracking-widest">{t("fleet.from")}</p>
              <p className="font-display text-xl text-[#c9a84c] leading-tight">{formatCurrency(price)}</p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5 text-xs text-white/35">
              <Users size={11} className="text-[#c9a84c]/60" />
              {vehicle.maxPassengers} {t("fleet.pax")}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-white/35">
              <Briefcase size={11} className="text-[#c9a84c]/60" />
              {vehicle.maxLuggage} {t("fleet.bags")}
            </span>
          </div>

          <p className="text-[9px] text-white/15 tracking-wider">{t("fleet.inclVat")}</p>

          <div className="mt-auto">
            <Link
              href={`/book?vehicle=${vehicle.class}`}
              className="group/btn flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.07] text-sm text-white/45 hover:text-[#c9a84c] hover:border-[#c9a84c]/28 hover:bg-[#c9a84c]/[0.04] transition-all duration-300"
            >
              <span className="font-medium">{t("fleet.reserveVehicle")}</span>
              <ChevronRight size={14} className="text-white/25 group-hover/btn:text-[#c9a84c] group-hover/btn:translate-x-0.5 transition-all duration-300" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function FleetSection() {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section id="fleet" className="py-20 sm:py-28 bg-[#050505]">
      <div className="container mx-auto px-4">

        {/* Header */}
        <div className="text-center mb-14 sm:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="inline-flex items-center gap-4 mb-5"
          >
            <div className="h-px w-8 bg-[#c9a84c]/40" />
            <span className="text-[#c9a84c] text-[11px] tracking-[0.4em] uppercase font-medium">
              {t("fleet.sectionLabel")}
            </span>
            <div className="h-px w-8 bg-[#c9a84c]/40" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-4"
          >
            {t("fleet.title")}{" "}
            <span className="text-gold-gradient">{t("fleet.titleAccent")}</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="text-white/35 max-w-md mx-auto text-sm sm:text-base leading-relaxed"
          >
            {t("fleet.subtitle")}
          </motion.p>
        </div>

        {/* Mobile: CSS snap horizontal scroll */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 lg:hidden"
          style={{
            scrollbarWidth:          "none",
            msOverflowStyle:         "none",
            scrollSnapType:          "x mandatory",
            WebkitOverflowScrolling: "touch",
            paddingLeft:             "1rem",
            paddingRight:            "1rem",
          }}
        >
          <style>{`.fleet-scroll::-webkit-scrollbar { display: none; }`}</style>
          {VEHICLE_CATALOG.map((vehicle, i) => (
            <FleetCard key={vehicle.class} vehicle={vehicle} index={i} mobile />
          ))}
          {/* Right fade sentinel */}
          <div className="flex-shrink-0 w-4" />
        </div>

        {/* Desktop: grid */}
        <div className="hidden lg:grid lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {VEHICLE_CATALOG.map((vehicle, i) => (
            <FleetCard key={vehicle.class} vehicle={vehicle} index={i} />
          ))}
        </div>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="flex justify-center mt-12 sm:mt-16"
        >
          <Link
            href="/fleet"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-[#c9a84c]/30 text-[#c9a84c] text-sm font-semibold tracking-wide hover:bg-[#c9a84c]/[0.06] hover:border-[#c9a84c]/50 transition-all duration-300"
          >
            {t("fleet.allVehicles")}
            <ChevronRight size={14} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

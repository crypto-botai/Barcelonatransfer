"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Users, Briefcase, ChevronRight, Zap, Star } from "lucide-react";
import { useTranslations } from "@/components/language/I18nProvider";
import { VEHICLE_CATALOG, vehicleBadgeClass, BAG_SIZES } from "@/types";
import { fleetPagePath } from "@/lib/fleet-pages";
import { formatCurrency } from "@/lib/utils";
import { getFleetFromPrice, getFleetOffer } from "@/lib/pricing";
import type { VehicleOffer } from "@/lib/fixed-prices";

function BadgeIcon({ badge }: { badge: string }) {
  if (badge === "Electric VIP") return <Zap size={12} className="flex-shrink-0" />;
  if (badge === "Luxury") return <Star size={12} className="flex-shrink-0" />;
  return null;
}

function FleetCardInner({
  vehicle,
  t,
  price,
  offer,
  asHeading,
}: {
  vehicle: (typeof VEHICLE_CATALOG)[number];
  t: ReturnType<typeof useTranslations>;
  price: number;
  offer: VehicleOffer | null;
  asHeading: boolean;
}) {
  const Name = asHeading ? "h3" : "div";
  return (
    <div className="group flex flex-col h-full rounded-2xl overflow-hidden border border-white/[0.07] bg-[#0b0b0b] hover:border-[#c9a84c]/30 transition-colors duration-300">
      <div
        className="relative h-44 overflow-hidden"
        style={{ background: "radial-gradient(ellipse 70% 60% at 50% 45%, #17171a 0%, #0a0a0b 60%, #080808 100%)" }}
      >
        {/* Sits opposite the class badge so the two never collide. Green
            against a gold-and-black palette on purpose: it has to read as a
            price cut at a glance, which is the whole reason it is here. */}
        {offer && (
          <span className="absolute top-3 left-3 z-20 px-2.5 py-1.5 rounded-full text-xs font-bold tracking-wide bg-emerald-400 text-black shadow-lg shadow-black/40">
            −{offer.pctOff}%
          </span>
        )}
        {vehicle.badge && (
          <span className={`absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-lg shadow-black/40 ${vehicleBadgeClass(vehicle.badge)}`}>
            <BadgeIcon badge={vehicle.badge} />
            {vehicle.badge}
          </span>
        )}
        {/* NOTE: every file in public/fleet is PNG colour-type 2 — RGB with no
            alpha — so each car carries an opaque pale studio backdrop that
            reads as a grey rectangle on this near-black card. A CSS mask was
            tried here and removed again: it can only feather the outer edge,
            and the backdrop sits behind the car in the middle where a mask
            must stay opaque. The fix is to re-export these with a transparent
            background; nothing in the stylesheet can do it. */}
        <Image
          src={vehicle.image}
          alt={vehicle.label}
          fill
          loading="lazy"
          sizes="(max-width: 1024px) 268px, (max-width: 1280px) 33vw, 25vw"
          className="object-contain p-6 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          style={{ filter: "drop-shadow(0 18px 36px rgba(0,0,0,0.92))" }}
        />
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-[#c9a84c]/18 to-transparent" />
      <div className="flex flex-col flex-1 p-5 gap-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* The vehicle name links to its own page. Six of the seven detail
                pages had no in-content inbound link anywhere on the site, from
                the very hub that introduces them. Using the name as the anchor
                means all seven links read differently. */}
            <Name className="font-display text-[1.1rem] text-white leading-snug">
              <Link href={fleetPagePath(vehicle.class)} className="hover:text-[#c9a84c] transition-colors">
                {vehicle.label}
              </Link>
            </Name>
            <p className="text-white/60 text-xs mt-0.5 truncate">{vehicle.models[0]}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] text-white/50 uppercase tracking-widest">{t("from")}</p>
            <p className="font-display text-xl text-[#c9a84c] leading-tight">{formatCurrency(price)}</p>
            {offer && (
              <p className="text-[11px] leading-tight text-dark-500 line-through tabular-nums">
                {formatCurrency(offer.was)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5 text-xs text-white/60">
            <Users size={11} className="text-[#c9a84c]/60" />
            {vehicle.maxPassengers} {t("pax")}
          </span>
          <span
            className="flex items-center gap-1.5 text-xs text-white/60"
            title={`Boot fits: ${vehicle.largeBags} Large (${BAG_SIZES.large.cm}) · ${vehicle.mediumBags} Medium (${BAG_SIZES.medium.cm}) · ${vehicle.smallBags} Small (${BAG_SIZES.small.cm})`}
          >
            <Briefcase size={11} className="text-[#c9a84c]/60" />
            {vehicle.largeBags}L · {vehicle.mediumBags}M · {vehicle.smallBags}S
          </span>
        </div>
        <p className="text-[10px] text-white/60 tracking-wider">{t("inclVat")}</p>
        <div className="mt-auto">
          {/* rel=nofollow because the href carries a query parameter. An audit
              flags internal links with parameters unless they are nofollow, and
              the parameter has to stay: it is what tells the booking form which
              car was chosen, and losing it re-quotes a Camry at the Business
              price.

              The label names the car rather than reading "Reserve this vehicle"
              on all seven cards. Seven links sharing one anchor text was the
              other finding, and a screen reader hitting seven identical links
              had the same problem. */}
          <Link
            href={`/book?vehicle=${vehicle.class}`}
            rel="nofollow"
            className="group/btn flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.07] text-sm text-dark-300 hover:text-[#c9a84c] hover:border-[#c9a84c]/28 hover:bg-[#c9a84c]/[0.04] transition-all duration-300"
            tabIndex={asHeading ? 0 : -1}
          >
            <span className="font-medium">Reserve the {vehicle.label}</span>
            <ChevronRight size={14} aria-hidden className="text-dark-500 group-hover/btn:text-[#c9a84c] group-hover/btn:translate-x-0.5 transition-all duration-300" />
          </Link>
        </div>
      </div>
    </div>
  );
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
  const t = useTranslations("fleet");
  const price = getFleetFromPrice(vehicle.class);
  const offer = getFleetOffer(vehicle.class);
  const still = useReducedMotion();

  // One card set serves both layouts: a snap-scroll item on mobile, a normal
  // grid cell from lg up. Rendering two separate sets doubled the fleet DOM
  // and emitted every vehicle heading twice.
  //
  // The reveal is per-card rather than a parent variant because the cards are
  // laid out as a scroll-snap row on phones and a grid from lg — a single
  // container stagger would fire for off-screen carousel items the reader has
  // not swiped to yet. `once` so it plays on the way down and never again, and
  // `whileInView` rather than a mount animation so nothing here is hidden
  // before hydration; the hero learned that lesson for the whole site.
  const reveal = still
    ? undefined
    : {
        initial: { opacity: 0, y: 16, scale: 0.97 },
        whileInView: { opacity: 1, y: 0, scale: 1 },
        viewport: { once: true, amount: 0.25, margin: "0px 0px -40px 0px" },
        transition: {
          duration: 0.42,
          // Slight overshoot. The design guidance calls for back.out(1.4);
          // this is its cubic-bezier equivalent.
          ease: [0.34, 1.26, 0.64, 1] as const,
          delay: Math.min(index, 5) * 0.06,
        },
      };

  return (
    <motion.div
      {...reveal}
      className="flex-shrink-0 w-[268px] snap-center lg:flex-shrink lg:w-auto lg:snap-align-none"
    >
      <FleetCardInner vehicle={vehicle} t={t} price={price} offer={offer} asHeading />
    </motion.div>
  );
}

export default function FleetSection() {
  const t = useTranslations("fleet");

  return (
    <section id="fleet" className="py-20 sm:py-28 bg-[#050505]">
      <div className="container mx-auto px-4">

        {/* Header */}
        <div className="text-center mb-14 sm:mb-20">
          <div className="inline-flex items-center gap-4 mb-5">
            <div className="h-px w-8 bg-[#c9a84c]/40" />
            <span className="text-[#c9a84c] text-[11px] tracking-[0.4em] uppercase font-medium">
              {t("sectionLabel")}
            </span>
            <div className="h-px w-8 bg-[#c9a84c]/40" />
          </div>

          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-4">
            {t("title")}{" "}
            <span className="text-gold-gradient">{t("titleAccent")}</span>
          </h2>

          <p className="text-white/60 max-w-md mx-auto text-sm sm:text-base leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        {/* One card set, two layouts: free-swipe carousel below lg, grid from lg up.
            Previously this rendered the whole catalogue twice — 14 cards and 14
            duplicate vehicle headings in the DOM for 7 vehicles. */}
        <div
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-4 px-4
                     lg:grid lg:grid-cols-3 xl:grid-cols-4 lg:gap-5 lg:overflow-visible lg:mx-0 lg:px-0 lg:pb-0"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {VEHICLE_CATALOG.map((vehicle, i) => (
            <FleetCard key={vehicle.class} vehicle={vehicle} index={i} mobile />
          ))}
        </div>
        <p className="text-white/50 text-[11px] text-center mt-3 mb-1 lg:hidden">
          ← Swipe to see all {VEHICLE_CATALOG.length} vehicles →
        </p>

        {/* Bag-size legend — boot/trunk capacity only, never cabin space */}
        <p className="text-white/50 text-[10px] text-center mt-6 tracking-wide">
          L = Large ({BAG_SIZES.large.cm}) · M = Medium ({BAG_SIZES.medium.cm}) · S = Small ({BAG_SIZES.small.cm})
        </p>

        {/* CTA row */}
        <div className="flex justify-center mt-12 sm:mt-16">
          <Link
            href="/fleet"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-[#c9a84c]/30 text-[#c9a84c] text-sm font-semibold tracking-wide hover:bg-[#c9a84c]/[0.06] hover:border-[#c9a84c]/50 transition-all duration-300"
          >
            {t("allVehicles")}
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

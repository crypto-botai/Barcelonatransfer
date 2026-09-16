"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Plane, Anchor, Briefcase, Building2, Theater, Clock, Waves, Sunset, Mountain, Hotel, Crown, Map, ArrowRight } from "lucide-react";
import { useTranslations } from "@/components/language/I18nProvider";

const SERVICE_ICONS = [Plane, Anchor, Briefcase, Building2, Theater, Clock, Waves, Sunset, Mountain, Hotel, Crown, Map];
const SERVICE_KEYS = ["airport", "cruise", "executive", "corporate", "vipEvents", "hourly", "costaBrava", "costaDorada", "andorra", "hotel", "vip", "tours"] as const;
const SERVICE_HREFS = [
  "/airport-transfers", "/transfers/cruise-port", "/corporate", "/corporate",
  "/vip-transportation", "/hourly", "/transfers/costa-brava", "/transfers/costa-dorada", "/transfers/andorra", "/hotel-transfers", "/vip-transportation", "/day-tours",
];

/**
 * One photograph per service, supplied by the owner, shown above the text
 * rather than under it. The six full frames are 1200×640; the other six were
 * cut from a 3×2 sheet and are 548 wide, which still covers a 4-up grid cell
 * at 1.4× on the widest layout.
 */
const SERVICE_IMAGES: Record<(typeof SERVICE_KEYS)[number], string> = {
  airport: "/services/airport.webp",
  cruise: "/services/cruise.webp",
  executive: "/services/executive.webp",
  corporate: "/services/corporate.webp",
  vipEvents: "/services/vip-events.webp",
  hourly: "/services/hourly.webp",
  costaBrava: "/services/costa-brava.webp",
  costaDorada: "/services/costa-dorada.webp",
  andorra: "/services/andorra.webp",
  hotel: "/services/hotel.webp",
  vip: "/services/vip.webp",
  tours: "/services/tours.webp",
};

const SIZES = "(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

function ServiceCard({ index }: { index: number }) {
  const t = useTranslations("services");
  const still = useReducedMotion();
  const key = SERVICE_KEYS[index];
  const Icon = SERVICE_ICONS[index];
  const title = t(`list.${key}.title`);

  // Same per-card reveal the fleet grid used: `whileInView` so nothing is
  // hidden before hydration, `once` so it never replays on the way back up.
  const reveal = still
    ? undefined
    : {
        initial: { opacity: 0, y: 18 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.2, margin: "0px 0px -40px 0px" },
        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const, delay: (index % 4) * 0.07 },
      };

  return (
    <motion.div {...reveal} className="h-full">
      <Link
        href={SERVICE_HREFS[index]}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-dark-900 transition-[border-color,box-shadow] duration-500 hover:border-gold-500/50 hover:shadow-[0_24px_60px_-24px_rgba(212,175,55,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
      >
        <div className="relative aspect-[16/10] overflow-hidden">
          <Image
            src={SERVICE_IMAGES[key]}
            alt={title}
            fill
            sizes={SIZES}
            className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
          />
          {/* A hairline of the card background at the foot of the photo so it
              sits into the card rather than ending on a hard edge. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-dark-900 to-transparent" />
          <div className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-gold-500/30 bg-dark-950/60 backdrop-blur-sm">
            <Icon size={16} className="text-gold-400" />
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h3 className="font-display text-xl leading-tight text-white transition-colors duration-300 group-hover:text-gold-300">
            {title}
          </h3>
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-dark-400">
            {t(`list.${key}.desc`)}
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-gold-400 transition-colors group-hover:text-gold-300">
            <span>{t("learnMore")}</span>
            <ArrowRight size={12} className="transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function ServicesSection() {
  const t = useTranslations("services");

  const FEATURES = [
    { icon: "🛫", title: t("features.flightMonitoring"), desc: t("features.realTime") },
    { icon: "⏳", title: t("features.freeWaiting"),      desc: t("features.sixtyMin") },
    { icon: "🪧", title: t("features.meetGreet"),        desc: t("features.nameBoard") },
    { icon: "💳", title: t("features.fixedPrices"),      desc: t("features.noSurge") },
  ];

  return (
    <section className="py-24 bg-dark-950" id="services">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">
            {t("label")}
          </span>
          <h2 className="font-display text-4xl sm:text-5xl text-white mb-4">
            {t("title")} <span className="text-gold-gradient">{t("titleAccent")}</span>
          </h2>
          <p className="text-dark-400 max-w-xl mx-auto">
            {t("subtitle")}
          </p>
          <div className="gold-divider mt-6" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {SERVICE_KEYS.map((key, i) => (
            <ServiceCard key={key} index={i} />
          ))}
        </div>

        {/* Feature pills */}
        <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {FEATURES.map((p) => (
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
        </div>
      </div>
    </section>
  );
}

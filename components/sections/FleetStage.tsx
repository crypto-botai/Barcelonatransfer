"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, animate, motion, useReducedMotion, type Variants } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "@/components/language/I18nProvider";
import { VEHICLE_CATALOG, type FleetVehicle } from "@/types";
import { fleetPagePath } from "@/lib/fleet-pages";
import { getFleetFromPrice, getFleetOffer } from "@/lib/pricing";
import { formatCurrency } from "@/lib/utils";

/**
 * The fleet as a showroom window.
 *
 * One fixed frame; only the car moves. Swipe, the arrows, the keyboard or the
 * filmstrip change cars, and the car slides out of one side of the window
 * while the next slides in from the other, with its name, capacity, features
 * and fare following it. The frame, the floor and the gold ring never move,
 * which is what makes a change read as "the next car" rather than "a new
 * page".
 *
 * Every fare is read from getFleetFromPrice(), the same lookup the booking
 * uses, so this cannot show a price the checkout would not charge.
 *
 * The photographs are the owner's, supplied on white and cut to transparent
 * in public/fleet/stage. They are shown exactly as supplied: no filter, no
 * tint, no lift. An earlier version rendered them through a 3D scene with fog
 * and a colour-space mismatch and made black cars look like silhouettes;
 * the owner asked for the photos in their real style, and this is that.
 */

/** The owner's transparent cutouts, by vehicle. */
const STAGE_IMAGE: Record<FleetVehicle, string> = {
  COROLLA:  "/fleet/stage/sedan-corolla.webp",
  CAMRY:    "/fleet/stage/sedan-camry.webp",
  TESLA_M3: "/fleet/stage/tesla-model-3.webp",
  EQE_300:  "/fleet/stage/eqe-300.webp",
  VITO:     "/fleet/stage/mercedes-vito.webp",
  V_CLASS:  "/fleet/stage/v-class-mercedes.webp",
  SPRINTER: "/fleet/stage/minibus.webp",
};

/** The name a button can carry: "Reserve the V-Class", not "Reserve the Mercedes V-Class". */
const SHORT: Record<FleetVehicle, string> = {
  COROLLA: "Corolla", CAMRY: "Camry", TESLA_M3: "Model 3", EQE_300: "EQE", VITO: "Vito", V_CLASS: "V-Class", SPRINTER: "Sprinter",
};

const EASE = [0.16, 1, 0.3, 1] as const;

/* The window stays; the car crosses it. Direction comes from AnimatePresence's custom. */
const carVariants: Variants = {
  enter:  (dir: number) => ({ x: `${55 * dir}%`, opacity: 0, scale: 0.92 }),
  center: { x: 0, opacity: 1, scale: 1, transition: { duration: 1.1, ease: EASE } },
  exit:   (dir: number) => ({ x: `${-55 * dir}%`, opacity: 0, scale: 0.92, transition: { duration: 0.55, ease: [0.7, 0, 0.84, 0] } }),
};

const railVariants: Variants = {
  enter:  (dir: number) => ({ x: 18 * dir, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.7, ease: EASE } },
  exit:   (dir: number) => ({ x: -14 * dir, opacity: 0, transition: { duration: 0.22 } }),
};

/** A fare that counts to its new value rather than jumping. */
function CountingFare({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) { el.textContent = formatCurrency(value); shown.current = value; return; }
    const controls = animate(shown.current, value, {
      duration: 1, ease: EASE,
      onUpdate: (v) => { el.textContent = formatCurrency(Math.round(v)); },
    });
    shown.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return <span ref={ref} className="font-display text-5xl leading-none text-gold-300 tabular-nums">{formatCurrency(value)}</span>;
}

export default function FleetStage() {
  const t = useTranslations("fleet");
  const reduce = useReducedMotion();
  const cars = VEHICLE_CATALOG;
  const [[index, dir], setState] = useState<[number, number]>([0, 0]);
  const car = cars[index];
  const price = getFleetFromPrice(car.class);
  const offer = getFleetOffer(car.class);

  const go = useCallback((next: number) => {
    const n = cars.length;
    const i = ((next % n) + n) % n;
    setState(([cur]) => [i, i > cur ? 1 : i < cur ? -1 : 0]);
  }, [cars.length]);

  // Arrow keys change car when the stage is on screen.
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = stageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft")  go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);

  // The filmstrip keeps the current car in view on narrow screens.
  //
  // This scrolls the strip itself, sideways, and nothing else. It used
  // scrollIntoView, which is allowed to scroll every ancestor to reach the
  // element, and on desktop the strip sits below the fold: changing car made
  // the whole page jump down to the thumbnails. The owner reported it as a
  // glitch. It was.
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = stripRef.current;
    const b = strip?.children[index] as HTMLElement | undefined;
    if (!strip || !b) return;
    // Only a strip that actually scrolls needs moving; the desktop grid does not.
    if (strip.scrollWidth <= strip.clientWidth + 1) return;
    const left = b.offsetLeft - (strip.clientWidth - b.clientWidth) / 2;
    strip.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
  }, [index, reduce]);

  return (
    <section id="fleet" className="py-20 sm:py-24 bg-[#050505] border-t border-white/[0.06]" aria-label={t("sectionLabel")}>
      <div className="container mx-auto px-4">
        {/* Head */}
        <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
          <div>
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">{t("sectionLabel")}</span>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.02] max-w-[16ch]">
              {t("title")} <em className="not-italic text-gold-gradient">{t("titleAccent")}</em>
            </h2>
          </div>
          <p className="text-dark-400 text-[15px] leading-relaxed max-w-[40ch]">{t("subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[120px_minmax(0,1fr)_340px] md:grid-cols-[80px_minmax(0,1fr)] gap-5 md:gap-7 lg:gap-10 items-stretch">
          {/* Index: the seven are a real sequence, so the numeral means something. */}
          <div className="hidden md:block" aria-hidden="true">
            <div className="sticky top-28">
              <div className="relative h-[120px] font-display text-[120px] leading-none tabular-nums" style={{ color: "transparent", WebkitTextStroke: "1px rgba(201,168,76,0.45)" }}>
                <AnimatePresence initial={false} custom={dir} mode="popLayout">
                  <motion.span key={index} custom={dir} variants={railVariants} initial="enter" animate="center" exit="exit" className="absolute left-0 top-0">
                    {String(index + 1).padStart(2, "0")}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="font-mono text-[11px] tracking-[0.3em] text-dark-500 mt-2">OF {String(cars.length).padStart(2, "0")}</div>
            </div>
          </div>

          {/* The window */}
          <div
            ref={stageRef}
            className="relative h-[clamp(300px,46vw,560px)] border border-[#c9a84c]/30 overflow-hidden select-none touch-pan-y bg-[#0c0b09]"
            style={{ backgroundImage: "radial-gradient(ellipse 70% 55% at 50% 78%, rgba(201,168,76,0.14), rgba(201,168,76,0.03) 45%, transparent 70%)" }}
            role="region"
            aria-roledescription="carousel"
            aria-label={t("sectionLabel")}
          >
            {/* The floor ring, turning slowly. */}
            <div className="absolute left-1/2 -bottom-[24%] w-[72%] aspect-square pointer-events-none" style={{ transform: "translateX(-50%) rotateX(80deg)" }} aria-hidden="true">
              <motion.svg viewBox="0 0 200 200" className="w-full h-full" animate={reduce ? undefined : { rotate: 360 }} transition={{ repeat: Infinity, duration: 80, ease: "linear" }}>
                <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(201,168,76,0.5)" strokeWidth="0.5" />
                <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(201,168,76,0.2)" strokeWidth="0.4" />
                <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(237,201,110,0.9)" strokeWidth="2" strokeDasharray="0.6 9.4" pathLength={120} />
              </motion.svg>
            </div>

            <AnimatePresence initial={false} custom={dir} mode="sync">
              <motion.figure
                key={car.class}
                custom={dir}
                variants={carVariants}
                initial="enter"
                animate="center"
                exit="exit"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.55}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -70 || info.velocity.x < -400) go(index + 1);
                  else if (info.offset.x > 70 || info.velocity.x > 400) go(index - 1);
                }}
                className="absolute inset-0 m-0 flex items-end justify-center px-[8%] pt-[6%] pb-[12%] cursor-grab active:cursor-grabbing"
              >
                <div className="relative w-full h-full">
                  <Image
                    src={STAGE_IMAGE[car.class]}
                    alt={car.label}
                    fill
                    priority={index === 0}
                    sizes="(max-width: 768px) 92vw, (max-width: 1024px) 80vw, 720px"
                    className="object-contain object-bottom pointer-events-none"
                    draggable={false}
                  />
                  {/* Reflection: the same photo, mirrored and fading. */}
                  <div className="absolute left-0 right-0 top-[100%] h-[34%] overflow-hidden opacity-[0.28] pointer-events-none" style={{ WebkitMaskImage: "linear-gradient(to bottom, #000, transparent 70%)", maskImage: "linear-gradient(to bottom, #000, transparent 70%)" }} aria-hidden="true">
                    <Image src={STAGE_IMAGE[car.class]} alt="" fill sizes="720px" className="object-contain object-top" style={{ transform: "scaleY(-1)" }} draggable={false} />
                  </div>
                </div>
              </motion.figure>
            </AnimatePresence>

            {car.badge && (
              <span className="absolute left-5 top-4 z-10 text-gold-500 text-[11px] tracking-[0.32em] uppercase font-medium">{car.badge}</span>
            )}
            <button type="button" onClick={() => go(index - 1)} aria-label="Previous vehicle" className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-12 h-12 sm:w-14 sm:h-14 grid place-items-center text-dark-300 hover:text-gold-300 transition-colors">
              <ChevronLeft size={28} strokeWidth={1.2} />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Next vehicle" className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-12 h-12 sm:w-14 sm:h-14 grid place-items-center text-dark-300 hover:text-gold-300 transition-colors">
              <ChevronRight size={28} strokeWidth={1.2} />
            </button>
          </div>

          {/* Rail */}
          <aside className="md:col-span-2 lg:col-span-1 flex flex-col gap-5 pt-1 relative">
            <AnimatePresence initial={false} custom={dir} mode="popLayout">
              <motion.div key={car.class} custom={dir} variants={railVariants} initial="enter" animate="center" exit="exit" className="flex flex-col gap-5">
                <h3 className="font-display text-3xl sm:text-4xl text-white leading-[1.1]">{car.label}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border-t border-white/[0.08] pt-2.5 flex flex-col gap-1">
                    <span className="text-[10.5px] tracking-[0.22em] uppercase text-dark-500 font-medium">{t("passengers")}</span>
                    <b className="font-mono font-medium text-[22px] text-white">{car.maxPassengers}</b>
                  </div>
                  <div className="border-t border-white/[0.08] pt-2.5 flex flex-col gap-1">
                    <span className="text-[10.5px] tracking-[0.22em] uppercase text-dark-500 font-medium">{t("luggage")}</span>
                    <b className="font-mono font-medium text-[22px] text-white">{car.largeBags}</b>
                  </div>
                </div>
                <ul className="flex flex-col">
                  {car.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-center gap-3 py-2 border-b border-white/[0.08] text-[13px] text-dark-300">
                      <i className="block w-3.5 h-px bg-gold-500 flex-shrink-0" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>

            <div className="flex items-baseline justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10.5px] tracking-[0.22em] uppercase text-dark-500 font-medium">{t("from")}</span>
                <CountingFare value={price} />
              </div>
              {offer && <span className="font-display text-lg text-dark-500 line-through">{formatCurrency(offer.was)}</span>}
            </div>

            <Link
              href={`/book?vehicle=${car.class}`}
              className="h-[58px] flex items-center justify-center bg-gold-500 hover:bg-gold-300 text-[#0a0a0a] font-medium tracking-[0.18em] uppercase text-[11px] transition-colors active:translate-y-px"
            >
              {t("reserveVehicle")}: {SHORT[car.class]}
            </Link>
            <Link href={fleetPagePath(car.class)} className="text-xs text-dark-400 hover:text-gold-300 transition-colors underline underline-offset-4">
              {t("allVehicles")}
            </Link>
          </aside>
        </div>

        {/* Filmstrip */}
        <div ref={stripRef} role="tablist" aria-label={t("allVehicles")} className="mt-7 flex md:grid md:grid-cols-7 gap-2.5 overflow-x-auto md:overflow-visible snap-x snap-mandatory pb-1.5 scrollbar-hide relative">
          {cars.map((v, i) => (
            <button
              key={v.class}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => go(i)}
              className={`group relative flex-none w-[132px] md:w-auto snap-center flex flex-col gap-2 p-2.5 pb-3 border-t text-left transition-colors ${i === index ? "border-gold-500" : "border-white/[0.08]"}`}
            >
              <div className={`relative h-[54px] transition-all duration-500 ${i === index ? "opacity-100 -translate-y-1" : "opacity-60 group-hover:opacity-90"}`}>
                <Image src={STAGE_IMAGE[v.class]} alt="" fill sizes="160px" className="object-contain" />
              </div>
              <span className={`flex justify-between gap-1.5 text-[11px] tracking-wide ${i === index ? "text-white" : "text-dark-500"}`}>
                <span>{v.label}</span>
                <b className="font-display font-normal text-gold-300">{formatCurrency(getFleetFromPrice(v.class))}</b>
              </span>
            </button>
          ))}
        </div>
        <div className="h-px bg-white/[0.08] mt-2.5 relative" aria-hidden="true">
          <i className="absolute left-0 top-0 h-px bg-gold-500 transition-transform duration-500" style={{ width: `${100 / cars.length}%`, transform: `translateX(${index * 100}%)` }} />
        </div>

        <p className="text-dark-500 text-xs mt-6">{t("inclVat")}</p>
      </div>
    </section>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useSpring,
  useInView,
} from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Users, Briefcase, ChevronRight, ChevronLeft } from "lucide-react";
import { VEHICLE_CATALOG } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { DEFAULT_PRICING } from "@/lib/pricing";

// ── Per-vehicle ambient atmosphere ─────────────────────────────────────────────
type Atm = { glow: string; glowStrong: string; accent: string };

const ATM: Record<string, Atm> = {
  ECONOMY:        { glow: "rgba(150,150,150,0.10)", glowStrong: "rgba(150,150,150,0.22)", accent: "#a8a8a8" },
  BUSINESS:       { glow: "rgba(130,155,210,0.11)", glowStrong: "rgba(130,155,210,0.24)", accent: "#8fb0d8" },
  LUXURY:         { glow: "rgba(201,168,76,0.16)",  glowStrong: "rgba(201,168,76,0.34)",  accent: "#c9a84c" },
  FIRST_CLASS:    { glow: "rgba(201,168,76,0.13)",  glowStrong: "rgba(201,168,76,0.28)",  accent: "#c9a84c" },
  ELECTRIC_VIP:   { glow: "rgba(52,211,153,0.12)",  glowStrong: "rgba(52,211,153,0.26)",  accent: "#34d399" },
  SUV:            { glow: "rgba(185,145,75,0.12)",   glowStrong: "rgba(185,145,75,0.26)",  accent: "#b99148" },
  LUXURY_SUV:     { glow: "rgba(201,168,76,0.15)",  glowStrong: "rgba(201,168,76,0.32)",  accent: "#c9a84c" },
  MINIVAN:        { glow: "rgba(195,155,75,0.11)",   glowStrong: "rgba(195,155,75,0.24)",  accent: "#c39b4b" },
  LUXURY_MINIVAN: { glow: "rgba(201,168,76,0.20)",  glowStrong: "rgba(201,168,76,0.40)",  accent: "#c9a84c" },
  MINIBUS:        { glow: "rgba(95,135,220,0.11)",   glowStrong: "rgba(95,135,220,0.24)",  accent: "#5f87dc" },
};
const FALLBACK_ATM: Atm = ATM.LUXURY;
const getAtm = (cls: string): Atm => ATM[cls] ?? FALLBACK_ATM;

function badgeCls(badge: string): string {
  if (badge === "VIP")          return "bg-[#c9a84c] text-black";
  if (badge === "Eco")          return "bg-emerald-500/90 text-white";
  if (badge === "Popular")      return "bg-blue-500/80 text-white";
  if (badge === "Large Group")  return "bg-purple-500/80 text-white";
  return "bg-white/10 text-white";
}

// ── 3D-tilt fleet card ──────────────────────────────────────────────────────────
function VehicleCard({
  vehicle,
  isActive,
  onClick,
  index,
}: {
  vehicle: (typeof VEHICLE_CATALOG)[number];
  isActive: boolean;
  onClick: () => void;
  index: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mouseX  = useMotionValue(0.5);
  const mouseY  = useMotionValue(0.5);
  const rawRX   = useTransform(mouseY, [0, 1], [7, -7]);
  const rawRY   = useTransform(mouseX, [0, 1], [-7, 7]);
  const rotX    = useSpring(rawRX, { stiffness: 180, damping: 28 });
  const rotY    = useSpring(rawRY, { stiffness: 180, damping: 28 });
  const atm     = getAtm(vehicle.class);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    mouseX.set((e.clientX - r.left) / r.width);
    mouseY.set((e.clientY - r.top)  / r.height);
  };
  const onLeave = () => { mouseX.set(0.5); mouseY.set(0.5); };

  return (
    // Outer: perspective wrapper — no overflow so 3D tilt is visible on edges
    <div ref={wrapRef} onMouseMove={onMove} onMouseLeave={onLeave} style={{ perspective: 900 }}>
      <motion.div
        onClick={onClick}
        style={{
          rotateX:    rotX,
          rotateY:    rotY,
          background: `radial-gradient(ellipse 110% 80% at 50% 0%, ${atm.glow}, transparent 60%), #0d0d0d`,
          border:     `1px solid ${isActive ? atm.accent + "44" : "rgba(255,255,255,0.06)"}`,
          boxShadow:   isActive
            ? `0 0 55px ${atm.glow}, 0 0 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)`
            : `0 0 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`,
          transition: "border-color 0.5s, box-shadow 0.5s",
        }}
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.85, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl overflow-hidden cursor-pointer select-none h-full"
      >
        {/* Top rim highlight */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* ── Image stage ── */}
        <div className="relative h-52 overflow-hidden">
          {/* Spotlight behind car */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 75% 55% at 50% 30%, ${atm.glowStrong}, transparent 65%)`,
              opacity: 0.6,
            }}
          />

          {/* Floating vehicle */}
          <motion.div
            animate={{ y: [0, -9, 0] }}
            transition={{ duration: 4 + index * 0.2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Image
              src={vehicle.image}
              alt={vehicle.label}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-contain p-6"
              style={{
                filter: `drop-shadow(0 28px 56px rgba(0,0,0,0.97)) drop-shadow(0 0 30px ${atm.glow})`,
              }}
            />
          </motion.div>

          {/* Floor reflection glow */}
          <div
            aria-hidden
            className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 65% 100% at 50% 100%, ${atm.accent}20, transparent 70%)`,
            }}
          />

          {/* Vehicle class chip */}
          <div className="absolute top-3 left-3 z-10">
            <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-sm border border-white/[0.08] text-white/35 text-[10px] tracking-[0.2em] uppercase">
              {vehicle.class.replace(/_/g, " ")}
            </span>
          </div>

          {vehicle.badge && (
            <div className="absolute top-3 right-3 z-10">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider ${badgeCls(vehicle.badge)}`}>
                {vehicle.badge}
              </span>
            </div>
          )}
        </div>

        {/* ── Card content ── */}
        <div className="p-5 space-y-3.5">
          {/* Gold accent separator */}
          <div
            className="h-px"
            style={{ background: `linear-gradient(90deg, ${atm.accent}38, transparent 55%)` }}
          />

          {/* Title + price */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display text-[1.2rem] text-white leading-tight truncate">{vehicle.label}</h3>
              <p className="text-white/25 text-xs mt-0.5 truncate">{vehicle.models[0]}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-white/25 text-[9px] uppercase tracking-widest">From</p>
              <p className="font-display text-2xl leading-none" style={{ color: atm.accent }}>
                {formatCurrency(DEFAULT_PRICING[vehicle.class].minimumFare)}
              </p>
            </div>
          </div>

          {/* Capacity row */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <Users size={11} style={{ color: atm.accent }} />
              <span className="text-white/40 text-xs">{vehicle.maxPassengers} pax</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Briefcase size={11} style={{ color: atm.accent }} />
              <span className="text-white/40 text-xs">{vehicle.maxLuggage} bags</span>
            </div>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-1.5">
            {vehicle.features.slice(0, 3).map((f) => (
              <span
                key={f}
                className="px-2 py-0.5 rounded-md text-[10px] tracking-wide"
                style={{
                  background: `${atm.accent}0d`,
                  border:     `1px solid ${atm.accent}1e`,
                  color:      `${atm.accent}80`,
                }}
              >
                {f}
              </span>
            ))}
            {vehicle.features.length > 3 && (
              <span className="px-2 py-0.5 rounded-md text-[10px] text-white/20 border border-white/[0.05]">
                +{vehicle.features.length - 3}
              </span>
            )}
          </div>

          {/* Reserve CTA */}
          <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}>
            <Link
              href={`/book?vehicle=${vehicle.class}`}
              onClick={(e) => e.stopPropagation()}
              className="group/btn flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-semibold"
              style={{
                background:  `${atm.accent}0d`,
                border:      `1px solid ${atm.accent}28`,
                color:        atm.accent,
                transition:  "background 0.3s, border-color 0.3s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.background  = `${atm.accent}1a`;
                el.style.borderColor = `${atm.accent}50`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.background  = `${atm.accent}0d`;
                el.style.borderColor = `${atm.accent}28`;
              }}
            >
              Reserve This Vehicle
              <ChevronRight size={14} className="transition-transform duration-300 group-hover/btn:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>

        {/* Bottom rim */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </motion.div>
    </div>
  );
}

// ── Main FleetSection ───────────────────────────────────────────────────────────
export default function FleetSection() {
  const [active, setActive] = useState(0);
  const sectionRef          = useRef<HTMLElement>(null);
  const thumbsRef           = useRef<HTMLDivElement>(null);
  const timerRef            = useRef<ReturnType<typeof setInterval> | null>(null);
  const sectionInView       = useInView(sectionRef, { margin: "-150px 0px" });

  const vehicle = VEHICLE_CATALOG[active];
  const atm     = getAtm(vehicle.class);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(
      () => setActive((p) => (p + 1) % VEHICLE_CATALOG.length),
      5500
    );
  }, []);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const goTo = useCallback((i: number) => { setActive(i); resetTimer(); }, [resetTimer]);
  const prev = () => goTo((active - 1 + VEHICLE_CATALOG.length) % VEHICLE_CATALOG.length);
  const next = () => goTo((active + 1) % VEHICLE_CATALOG.length);

  useEffect(() => {
    const el  = thumbsRef.current;
    if (!el) return;
    const btn = el.querySelector(`[data-idx="${active}"]`) as HTMLElement | null;
    btn?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  return (
    <section ref={sectionRef} id="fleet" className="relative py-28 bg-[#050505] overflow-hidden">

      {/* ── Grain texture ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.028]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── Dynamic per-vehicle ambient ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`bg-${vehicle.class}`}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: `radial-gradient(ellipse 75% 50% at 50% 10%, ${atm.glow}, transparent)`,
          }}
        />
      </AnimatePresence>

      {/* ── Vignette ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse 130% 110% at 50% 50%, transparent 30%, rgba(5,5,5,0.88) 100%)",
        }}
      />

      <div className="relative z-10 container mx-auto">

        {/* ═══════════════════════════════════════════════════════
            Section Header
        ═══════════════════════════════════════════════════════ */}
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-4 mb-6"
          >
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-gold-500/50" />
            <span className="text-gold-500 text-[11px] tracking-[0.45em] uppercase font-medium">Our Fleet</span>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-gold-500/50" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.0, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-5xl sm:text-6xl lg:text-7xl text-white leading-[0.93] tracking-tight mb-6"
          >
            Choose Your
            <br />
            <span className="text-gold-gradient">Luxury Vehicle</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.35 }}
            className="text-dark-400 text-base sm:text-lg max-w-md mx-auto leading-relaxed"
          >
            Every vehicle under 3 years old, maintained to concierge standards.
          </motion.p>
        </div>

        {/* ═══════════════════════════════════════════════════════
            Cinematic Hero Panel
        ═══════════════════════════════════════════════════════ */}
        <div className="mb-16 lg:mb-24">
          <div className="grid lg:grid-cols-[1fr_360px] gap-8 lg:gap-14 items-center">

            {/* Vehicle stage */}
            <div className="relative aspect-[16/9] sm:aspect-[16/8]">

              {/* Dynamic spotlight */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`spot-${vehicle.class}`}
                  aria-hidden
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse 80% 65% at 50% 32%, ${atm.glowStrong}, transparent 60%)`,
                  }}
                />
              </AnimatePresence>

              {/* Cinematic vehicle swap */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`hero-${vehicle.class}`}
                  initial={{ opacity: 0, scale: 0.93, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -14 }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0"
                >
                  <motion.div
                    animate={{ y: [0, -14, 0] }}
                    transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Image
                      src={vehicle.image}
                      alt={vehicle.label}
                      fill
                      sizes="(max-width: 1024px) 100vw, 65vw"
                      className="object-contain p-4 sm:p-8 lg:p-10"
                      style={{
                        filter: `drop-shadow(0 50px 100px rgba(0,0,0,0.98)) drop-shadow(0 0 70px ${atm.glowStrong})`,
                      }}
                      priority
                    />
                  </motion.div>
                </motion.div>
              </AnimatePresence>

              {/* Ground glow */}
              <div
                aria-hidden
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/5 h-16 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse 100% 100% at 50% 100%, ${atm.accent}22, transparent)`,
                  filter: "blur(22px)",
                }}
              />

              {/* Prev / Next */}
              <button
                onClick={prev}
                aria-label="Previous vehicle"
                className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/[0.09] flex items-center justify-center text-white/40 hover:text-gold-400 hover:border-gold-500/30 transition-all duration-300"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={next}
                aria-label="Next vehicle"
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/[0.09] flex items-center justify-center text-white/40 hover:text-gold-400 hover:border-gold-500/30 transition-all duration-300"
              >
                <ChevronRight size={16} />
              </button>

              {/* Progress pip indicators */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                {VEHICLE_CATALOG.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    aria-label={`Select vehicle ${i + 1}`}
                    className="transition-all duration-500 focus:outline-none"
                    style={{
                      width:        i === active ? 22 : 4,
                      height:       4,
                      borderRadius: 2,
                      background:   i === active ? atm.accent : "rgba(255,255,255,0.12)",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Desktop sidebar */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`sidebar-${vehicle.class}`}
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="hidden lg:flex flex-col space-y-5"
              >
                {vehicle.badge && (
                  <span className={`inline-block w-fit px-3 py-1 rounded-full text-xs font-bold tracking-wider ${badgeCls(vehicle.badge)}`}>
                    {vehicle.badge}
                  </span>
                )}

                <div>
                  <p className="text-white/25 text-[10px] tracking-[0.35em] uppercase mb-2">
                    {vehicle.class.replace(/_/g, " ")}
                  </p>
                  <h3 className="font-display text-4xl xl:text-5xl text-white leading-tight">{vehicle.label}</h3>
                  <p className="text-dark-500 text-sm mt-1.5">{vehicle.models.join(" · ")}</p>
                </div>

                <p className="text-dark-400 leading-relaxed text-sm">{vehicle.description}</p>

                <div className="flex gap-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${atm.accent}0f`, border: `1px solid ${atm.accent}22`, color: atm.accent }}
                    >
                      <Users size={13} />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{vehicle.maxPassengers} passengers</p>
                      <p className="text-white/25 text-[10px]">max capacity</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${atm.accent}0f`, border: `1px solid ${atm.accent}22`, color: atm.accent }}
                    >
                      <Briefcase size={13} />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{vehicle.maxLuggage} bags</p>
                      <p className="text-white/25 text-[10px]">luggage</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {vehicle.features.map((f) => (
                    <span
                      key={f}
                      className="px-2.5 py-1 rounded-lg text-xs"
                      style={{
                        background: `${atm.accent}0a`,
                        border:     `1px solid ${atm.accent}1a`,
                        color:      `${atm.accent}80`,
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>

                <div
                  className="rounded-2xl p-5 flex items-center justify-between gap-4"
                  style={{ background: `${atm.accent}07`, border: `1px solid ${atm.accent}1e` }}
                >
                  <div>
                    <p className="text-white/25 text-[10px] tracking-widest uppercase mb-1">Starting from</p>
                    <p className="font-display text-4xl leading-none" style={{ color: atm.accent }}>
                      {formatCurrency(DEFAULT_PRICING[vehicle.class].minimumFare)}
                    </p>
                    <p className="text-white/20 text-[10px] mt-1.5 tracking-wider">incl. VAT · fixed price</p>
                  </div>
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                    <Link
                      href={`/book?vehicle=${vehicle.class}`}
                      className="group/book btn-gold flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold shrink-0"
                    >
                      Book Now
                      <ChevronRight size={13} className="transition-transform duration-300 group-hover/book:translate-x-0.5" />
                    </Link>
                  </motion.div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Mobile details */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`mob-${vehicle.class}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="lg:hidden mt-8 space-y-4"
            >
              {vehicle.badge && (
                <span className={`inline-block w-fit px-3 py-1 rounded-full text-xs font-bold tracking-wider ${badgeCls(vehicle.badge)}`}>
                  {vehicle.badge}
                </span>
              )}
              <div>
                <h3 className="font-display text-3xl text-white">{vehicle.label}</h3>
                <p className="text-dark-500 text-sm mt-1">{vehicle.models.join(" · ")}</p>
              </div>
              <p className="text-dark-400 text-sm leading-relaxed">{vehicle.description}</p>
              <div
                className="rounded-xl p-4 flex items-center justify-between gap-4"
                style={{ background: `${atm.accent}07`, border: `1px solid ${atm.accent}1e` }}
              >
                <div>
                  <p className="text-white/25 text-[10px] tracking-widest uppercase">From</p>
                  <p className="font-display text-3xl leading-none" style={{ color: atm.accent }}>
                    {formatCurrency(DEFAULT_PRICING[vehicle.class].minimumFare)}
                  </p>
                </div>
                <Link
                  href={`/book?vehicle=${vehicle.class}`}
                  className="btn-gold flex items-center gap-1.5 px-5 py-3 rounded-xl text-sm font-bold shrink-0"
                >
                  Book Now <ChevronRight size={13} />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ═══════════════════════════════════════════════════════
            Thumbnail Carousel
        ═══════════════════════════════════════════════════════ */}
        <div className="mb-20 lg:mb-28">
          <div className="flex items-center gap-4 mb-5">
            <div className="h-px flex-1 bg-gradient-to-r from-white/[0.05] to-transparent" />
            <p className="text-white/20 text-[10px] tracking-[0.45em] uppercase whitespace-nowrap">All Vehicles</p>
            <div className="h-px flex-1 bg-gradient-to-l from-white/[0.05] to-transparent" />
          </div>

          <div
            ref={thumbsRef}
            className="flex gap-3 overflow-x-auto pb-2"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none", scrollSnapType: "x mandatory" }}
          >
            {VEHICLE_CATALOG.map((v, i) => {
              const va    = getAtm(v.class);
              const isAct = i === active;
              return (
                <button
                  key={v.class}
                  data-idx={i}
                  onClick={() => goTo(i)}
                  className="flex-shrink-0 rounded-xl overflow-hidden focus:outline-none"
                  style={{
                    width:           isAct ? 198 : 162,
                    scrollSnapAlign: "center",
                    border:          `1px solid ${isAct ? va.accent + "45" : "rgba(255,255,255,0.05)"}`,
                    boxShadow:       isAct ? `0 0 35px ${va.glow}` : "none",
                    background:      `radial-gradient(ellipse at 50% 0%, ${va.glow}, #0d0d0d)`,
                    transition:      "width 0.5s cubic-bezier(0.22,1,0.36,1), border-color 0.5s, box-shadow 0.5s",
                  }}
                >
                  <div className="relative h-24 overflow-hidden">
                    <motion.div
                      animate={isAct ? { y: [0, -5, 0] } : { y: 0 }}
                      transition={{ duration: 3.5, repeat: isAct ? Infinity : 0, ease: "easeInOut" }}
                      className="absolute inset-0"
                    >
                      <Image
                        src={v.image}
                        alt={v.label}
                        fill
                        sizes="198px"
                        className="object-contain p-2"
                        style={{
                          filter:     "drop-shadow(0 6px 14px rgba(0,0,0,0.9))",
                          opacity:    isAct ? 1 : 0.45,
                          transition: "opacity 0.6s",
                        }}
                      />
                    </motion.div>
                    {isAct && (
                      <motion.div
                        aria-hidden
                        className="absolute inset-0 pointer-events-none"
                        animate={{ opacity: [0, 0.4, 0] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        style={{ background: `radial-gradient(ellipse at 50% 50%, ${va.accent}22, transparent)` }}
                      />
                    )}
                  </div>
                  <div
                    className="px-3 py-2.5 text-left"
                    style={{ borderTop: `1px solid ${isAct ? va.accent + "1e" : "rgba(255,255,255,0.04)"}` }}
                  >
                    <p
                      className="text-xs font-medium truncate"
                      style={{ color: isAct ? va.accent : "rgba(255,255,255,0.38)", transition: "color 0.4s" }}
                    >
                      {v.label}
                    </p>
                    <p className="text-[10px] mt-0.5 text-white/20">
                      from {formatCurrency(DEFAULT_PRICING[v.class].minimumFare)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            Full Fleet Cards Grid — 3D Tilt
        ═══════════════════════════════════════════════════════ */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-12"
          >
            <p className="text-white/20 text-[11px] tracking-[0.45em] uppercase mb-3">Full Collection</p>
            <h3 className="font-display text-3xl sm:text-4xl text-white">
              Every Vehicle, <span className="text-gold-gradient">Detailed</span>
            </h3>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {VEHICLE_CATALOG.map((v, i) => (
              <VehicleCard
                key={v.class}
                vehicle={v}
                isActive={active === i}
                onClick={() => goTo(i)}
                index={i}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          Sticky Mobile CTA — only visible while fleet section is in view
      ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {sectionInView && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-4 left-3 right-3 z-50 lg:hidden"
          >
            <Link
              href={`/book?vehicle=${vehicle.class}`}
              className="flex items-center justify-between w-full px-5 py-3.5 rounded-2xl"
              style={{
                background: "linear-gradient(135deg, #c9a84c 0%, #b8960c 100%)",
                color:      "#000",
                boxShadow:  "0 16px 48px rgba(201,168,76,0.48), 0 2px 0 rgba(255,255,255,0.18) inset",
              }}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-medium opacity-60 tracking-wider uppercase">Reserve Now</p>
                <p className="font-display text-[1.05rem] font-bold leading-tight truncate">{vehicle.label}</p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="text-right">
                  <p className="text-[10px] opacity-60">from</p>
                  <p className="font-display text-xl font-bold leading-tight">
                    {formatCurrency(DEFAULT_PRICING[vehicle.class].minimumFare)}
                  </p>
                </div>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,0.18)" }}
                >
                  <ChevronRight size={16} />
                </div>
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

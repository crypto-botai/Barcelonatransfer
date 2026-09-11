"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Users, Briefcase, Clock, Gauge, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { HOURLY_FLEET, type HourlyVehicle } from "@/lib/hourly-fleet";
import { HOURLY_INCLUDED_KM } from "@/lib/pricing";

/**
 * The rate cards, revealed as they enter the viewport.
 *
 * The motion here is doing one job: a seven-card price grid is a comparison,
 * and staggering the entry gives the eye an order to read them in rather than
 * dropping all seven at once. It is the only animation on the page, it runs
 * once, and it collapses to nothing under prefers-reduced-motion, where a
 * price list has to be legible immediately or it is broken.
 */
const EASE = [0.16, 1, 0.3, 1] as const;

function Spec({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-dark-400 text-xs">
      <Icon size={13} className="text-dark-500 flex-shrink-0" aria-hidden="true" />
      {children}
    </span>
  );
}

function Rate({ v, size }: { v: HourlyVehicle; size: "md" | "lg" }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span
        className={`font-display text-gold-400 leading-none ${size === "lg" ? "text-5xl" : "text-4xl"}`}
      >
        {formatCurrency(v.rate)}
      </span>
      <span className="text-dark-400 text-sm">per hour</span>
    </p>
  );
}

function CardBody({ v, wide }: { v: HourlyVehicle; wide: boolean }) {
  return (
    <div className={`flex flex-col gap-3 p-5 ${wide ? "sm:justify-center" : "flex-1"}`}>
      <div>
        <h3 className="text-white font-medium leading-snug">
          {v.label}
          {v.alsoOffered ? (
            <span className="text-dark-400 font-normal"> or {v.alsoOffered}</span>
          ) : null}
        </h3>
        <p className="text-dark-500 text-xs mt-0.5">{v.suitedTo}</p>
      </div>

      <Rate v={v} size={wide ? "lg" : "md"} />

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        <Spec icon={Users}>{v.maxPassengers} passengers</Spec>
        <Spec icon={Briefcase}>{v.largeBags} large cases</Spec>
        <Spec icon={Clock}>{v.minHours} hour minimum</Spec>
        <Spec icon={Gauge}>{HOURLY_INCLUDED_KM} km included</Spec>
      </div>

      <div className="flex items-center gap-3 mt-auto pt-1">
        <Link
          href="/book"
          className="btn-gold px-4 py-2.5 rounded-lg text-xs font-semibold"
        >
          Book by the hour
        </Link>
        <Link
          href={v.href}
          className="inline-flex items-center gap-0.5 text-dark-400 hover:text-gold-400 transition-colors text-xs"
        >
          About this car
          <ChevronRight size={13} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

/*
  The fleet photographs are PNGs with an opaque near-black background baked in,
  so they are sat on the same radial wash the fleet cards use rather than on a
  flat panel, where the seam would show.
*/
const PHOTO_WASH =
  "radial-gradient(ellipse 70% 60% at 50% 45%, #17171a 0%, #0a0a0b 60%, #080808 100%)";

export default function HourlyRateGrid() {
  const reduce = useReducedMotion();

  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto list-none p-0">
      {HOURLY_FLEET.map((v, i) => {
        /*
          Seven cars in a three-column grid leaves a lone cell on the last row.
          The Sprinter is the one that earns the full width: it is the only
          vehicle that is a different kind of job, at more than twice the rate
          of anything else and sixteen seats.
        */
        const wide = i === HOURLY_FLEET.length - 1;

        return (
          <motion.li
            key={v.vehicle}
            className={wide ? "lg:col-span-3" : undefined}
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: Math.min(i, 5) * 0.06, ease: EASE }}
          >
            <div
              className={`group h-full rounded-2xl overflow-hidden border border-white/[0.07] bg-[#0b0b0b] hover:border-[#c9a84c]/30 transition-colors duration-300 ${
                wide ? "sm:grid sm:grid-cols-[minmax(0,320px)_1fr]" : "flex flex-col"
              }`}
            >
              <div
                className={`relative overflow-hidden ${wide ? "h-44 sm:h-full sm:min-h-[190px]" : "h-40"}`}
                style={{ background: PHOTO_WASH }}
              >
                <Image
                  src={v.image}
                  alt={`${v.label} available for hourly chauffeur hire in Barcelona`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-contain p-3 transition-transform duration-500 group-hover:scale-[1.03]"
                />
                {v.badge ? (
                  <span className="absolute top-3 left-3 text-[10px] uppercase tracking-wider text-dark-300 bg-black/50 border border-white/10 rounded-full px-2 py-0.5">
                    {v.badge}
                  </span>
                ) : null}
              </div>
              <CardBody v={v} wide={wide} />
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}

"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Users, Briefcase, Zap, ChevronRight, ChevronLeft } from "lucide-react";
import { VEHICLE_CATALOG } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { DEFAULT_PRICING } from "@/lib/pricing";

export default function FleetSection() {
  const [active, setActive] = useState(0);
  const vehicle = VEHICLE_CATALOG[active];
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? 300 : -300, behavior: "smooth" });
  };

  return (
    <section className="py-24 bg-[#070707]" id="fleet">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4"
          >
            Our Fleet
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-display text-4xl sm:text-5xl text-white mb-4"
          >
            Choose Your <span className="text-gold-gradient">Luxury Vehicle</span>
          </motion.h2>
          <div className="gold-divider mt-6" />
        </div>

        {/* Filter tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-2 mb-12"
        >
          {VEHICLE_CATALOG.map((v, i) => (
            <button
              key={v.class}
              onClick={() => setActive(i)}
              className={`px-4 py-2 rounded-full text-xs font-medium tracking-wider transition-all duration-200 ${
                active === i
                  ? "bg-gold-500 text-black"
                  : "border border-white/10 text-dark-400 hover:border-gold-500/40 hover:text-gold-400"
              }`}
            >
              {v.label}
            </button>
          ))}
        </motion.div>

        {/* Vehicle showcase */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid lg:grid-cols-2 gap-8 items-center"
          >
            {/* Image panel */}
            <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-[#e8e8e8] vehicle-card group">
              <Image
                src={vehicle.image}
                alt={vehicle.label}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain p-4 transition-transform duration-700 group-hover:scale-105"
                priority={active === 0}
              />
              {/* Subtle bottom gradient for text legibility only */}
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-10" />

              {/* Vehicle class badge */}
              <div className="absolute top-4 left-4 z-20">
                <span className="px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-gold-500/30 text-gold-400 text-xs tracking-wider uppercase font-medium">
                  {vehicle.class.replace(/_/g, " ")}
                </span>
              </div>

              {/* Badge (VIP / Popular / Eco) */}
              {vehicle.badge && (
                <div className="absolute top-4 right-4 z-20">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider ${
                    vehicle.badge === "VIP"        ? "bg-gold-500 text-black" :
                    vehicle.badge === "Popular"    ? "bg-blue-500/80 text-white" :
                    vehicle.badge === "Large Group"? "bg-purple-500/80 text-white" :
                    "bg-green-500/80 text-white"
                  }`}>
                    {vehicle.badge}
                  </span>
                </div>
              )}

              {/* Bottom overlay: price */}
              <div className="absolute bottom-0 left-0 right-0 z-20 p-5">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-white/70 text-xs tracking-wider uppercase mb-1">From</p>
                    <p className="font-display text-3xl text-gold-400">
                      {formatCurrency(DEFAULT_PRICING[vehicle.class].minimumFare)}
                    </p>
                  </div>
                  <p className="text-white/80 text-sm">{vehicle.models[0]}</p>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-3xl text-white mb-1">{vehicle.label}</h3>
                <p className="text-dark-400 text-sm">{vehicle.models.join(" · ")}</p>
              </div>

              <p className="text-dark-300 leading-relaxed">{vehicle.description}</p>

              {/* Capacity */}
              <div className="flex gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center">
                    <Users size={16} className="text-gold-500" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Up to {vehicle.maxPassengers}</p>
                    <p className="text-dark-400 text-xs">Passengers</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center">
                    <Briefcase size={16} className="text-gold-500" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Up to {vehicle.maxLuggage}</p>
                    <p className="text-dark-400 text-xs">Luggage bags</p>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <p className="text-dark-400 text-xs tracking-wider uppercase mb-3">Included</p>
                <div className="flex flex-wrap gap-2">
                  {vehicle.features.map((f) => (
                    <span
                      key={f}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-dark-200 text-xs"
                    >
                      <Zap size={10} className="text-gold-500" />
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Pricing + CTA */}
              <div className="glass-card rounded-xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-dark-400 text-xs tracking-wider uppercase">Starting from</p>
                  <p className="font-display text-3xl text-gold-400 mt-1">
                    {formatCurrency(DEFAULT_PRICING[vehicle.class].minimumFare)}
                  </p>
                </div>
                <Link
                  href={`/book?vehicle=${vehicle.class}`}
                  className="btn-gold flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold"
                >
                  Book Now
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Fleet scroll strip */}
        <div className="mt-16">
          <div className="flex items-center justify-between mb-4">
            <p className="text-dark-400 text-xs tracking-[0.2em] uppercase">All Vehicles</p>
            <div className="flex gap-2">
              <button onClick={() => scroll("left")}
                className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-dark-400 hover:text-gold-400 hover:border-gold-500/30 transition-all">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => scroll("right")}
                className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-dark-400 hover:text-gold-400 hover:border-gold-500/30 transition-all">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scroll-smooth pb-3"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {VEHICLE_CATALOG.map((v, i) => (
              <button
                key={v.class}
                onClick={() => setActive(i)}
                className={`group flex-shrink-0 w-52 rounded-xl overflow-hidden border transition-all duration-200 ${
                  active === i
                    ? "border-gold-500/60 ring-1 ring-gold-500/30"
                    : "border-white/[0.06] hover:border-gold-500/30"
                }`}
              >
                {/* Car image — light background */}
                <div className="relative h-32 bg-[#e8e8e8]">
                  <Image
                    src={v.image}
                    alt={v.label}
                    fill
                    sizes="208px"
                    className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
                  />
                  {v.badge && (
                    <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      v.badge === "VIP"        ? "bg-gold-500 text-black" :
                      v.badge === "Popular"    ? "bg-blue-500/80 text-white" :
                      v.badge === "Large Group"? "bg-purple-500/80 text-white" :
                      "bg-green-500/80 text-white"
                    }`}>
                      {v.badge}
                    </span>
                  )}
                </div>
                {/* Label */}
                <div className="bg-[#0f0f0f] px-3 py-2.5 text-left">
                  <p className={`text-xs font-medium transition-colors ${
                    active === i ? "text-gold-400" : "text-white group-hover:text-gold-400"
                  }`}>
                    {v.label}
                  </p>
                  <p className="text-dark-500 text-[10px] mt-0.5">up to {v.maxPassengers} pax</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Users, Briefcase, Zap, ChevronRight } from "lucide-react";
import { VEHICLE_CATALOG } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { DEFAULT_PRICING } from "@/lib/pricing";
import Image from "next/image";

export default function FleetSection() {
  const [active, setActive] = useState(0);

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
            {/* Image */}
            <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-dark-800 vehicle-card">
              <div className="absolute inset-0 bg-gradient-to-br from-gold-500/5 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="font-display text-6xl text-gold-500/10 font-bold">
                    {VEHICLE_CATALOG[active].label}
                  </p>
                  <p className="text-dark-500 text-sm mt-2">{VEHICLE_CATALOG[active].models.join(" · ")}</p>
                </div>
              </div>
              {/* Vehicle class badge */}
              <div className="absolute top-4 left-4 z-20">
                <span className="px-3 py-1 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 text-xs tracking-wider uppercase font-medium">
                  {VEHICLE_CATALOG[active].class.replace(/_/g, " ")}
                </span>
              </div>
              {/* Price badge */}
              <div className="absolute top-4 right-4 z-20">
                <span className="px-3 py-1 rounded-full bg-black/60 border border-white/10 text-white text-xs">
                  From {formatCurrency(DEFAULT_PRICING[VEHICLE_CATALOG[active].class].minimumFare)}
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-3xl text-white mb-2">
                  {VEHICLE_CATALOG[active].label}
                </h3>
                <p className="text-dark-400">
                  {VEHICLE_CATALOG[active].models.join(", ")}
                </p>
              </div>

              <p className="text-dark-300 leading-relaxed">
                {VEHICLE_CATALOG[active].description}
              </p>

              {/* Capacity */}
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-gold-500/10 flex items-center justify-center">
                    <Users size={16} className="text-gold-500" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{VEHICLE_CATALOG[active].maxPassengers} passengers</p>
                    <p className="text-dark-400 text-xs">Maximum capacity</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-gold-500/10 flex items-center justify-center">
                    <Briefcase size={16} className="text-gold-500" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{VEHICLE_CATALOG[active].maxLuggage} bags</p>
                    <p className="text-dark-400 text-xs">Luggage capacity</p>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <p className="text-dark-400 text-xs tracking-wider uppercase mb-3">Included Features</p>
                <div className="flex flex-wrap gap-2">
                  {VEHICLE_CATALOG[active].features.map((f) => (
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

              {/* Pricing preview */}
              <div className="glass-card rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-dark-400 text-xs tracking-wider uppercase">Starting from</p>
                  <p className="font-display text-3xl text-gold-400 mt-1">
                    {formatCurrency(DEFAULT_PRICING[VEHICLE_CATALOG[active].class].minimumFare)}
                  </p>
                </div>
                <Link
                  href={`/book?vehicle=${VEHICLE_CATALOG[active].class}`}
                  className="btn-gold flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold"
                >
                  Book This Vehicle
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* All fleet grid below */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {VEHICLE_CATALOG.map((v, i) => (
            <motion.button
              key={v.class}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setActive(i)}
              className={`group relative p-4 rounded-xl border transition-all duration-200 text-left ${
                active === i
                  ? "border-gold-500/40 bg-gold-500/8"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-gold-500/20"
              }`}
            >
              <p className={`text-sm font-medium mb-1 transition-colors ${active === i ? "text-gold-400" : "text-dark-200 group-hover:text-gold-400"}`}>
                {v.label}
              </p>
              <p className="text-dark-500 text-xs">up to {v.maxPassengers} pax</p>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}

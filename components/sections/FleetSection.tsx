"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Users, Briefcase, Zap, ChevronRight } from "lucide-react";
import { VEHICLE_CATALOG } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { DEFAULT_PRICING } from "@/lib/pricing";

export default function FleetSection() {
  const [active, setActive] = useState(0);
  const vehicle = VEHICLE_CATALOG[active];

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
            <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-dark-800 vehicle-card group">
              <Image
                src={vehicle.image}
                alt={vehicle.label}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                priority={active === 0}
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent pointer-events-none z-10" />

              {/* Vehicle class badge */}
              <div className="absolute top-4 left-4 z-20">
                <span className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-gold-500/30 text-gold-400 text-xs tracking-wider uppercase font-medium">
                  {vehicle.class.replace(/_/g, " ")}
                </span>
              </div>

              {/* Badge (VIP / Popular / Eco) */}
              {vehicle.badge && (
                <div className="absolute top-4 right-4 z-20">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider ${
                    vehicle.badge === "VIP"     ? "bg-gold-500 text-black" :
                    vehicle.badge === "Popular" ? "bg-blue-500/80 text-white" :
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
                    <p className="text-dark-400 text-xs tracking-wider uppercase mb-1">From</p>
                    <p className="font-display text-3xl text-gold-400">
                      {formatCurrency(DEFAULT_PRICING[vehicle.class].minimumFare)}
                    </p>
                  </div>
                  <p className="text-dark-300 text-sm">{vehicle.models[0]}</p>
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

        {/* All fleet thumbnail grid */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {VEHICLE_CATALOG.map((v, i) => (
            <motion.button
              key={v.class}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setActive(i)}
              className={`group relative rounded-xl overflow-hidden border transition-all duration-200 aspect-[4/3] ${
                active === i
                  ? "border-gold-500/60 ring-1 ring-gold-500/30"
                  : "border-white/[0.06] hover:border-gold-500/30"
              }`}
            >
              <Image
                src={v.image}
                alt={v.label}
                fill
                sizes="200px"
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/10" />
              <div className="absolute bottom-0 left-0 right-0 p-2.5">
                <p className={`text-xs font-medium leading-tight transition-colors ${
                  active === i ? "text-gold-400" : "text-white group-hover:text-gold-400"
                }`}>
                  {v.label}
                </p>
                <p className="text-dark-500 text-[10px] mt-0.5">up to {v.maxPassengers} pax</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}

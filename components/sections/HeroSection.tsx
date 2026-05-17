"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Star, Shield, Clock, Award } from "lucide-react";
import BookingForm from "@/components/booking/BookingForm";

const TRUST_BADGES = [
  { icon: Star,   label: "4.9★ Rating",     sub: "1,200+ reviews" },
  { icon: Shield, label: "Licensed VTC",     sub: "Fully insured" },
  { icon: Clock,  label: "24/7 Service",     sub: "Always available" },
  { icon: Award,  label: "5,000+ Transfers", sub: "Since 2018" },
];

export default function HeroSection() {
  const [count, setCount] = useState({ clients: 0, rating: 0, years: 0 });

  useEffect(() => {
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setCount((prev) => ({
          clients: Math.min(prev.clients + 83, 5000),
          rating:  prev.rating >= 49 ? 49 : prev.rating + 1,
          years:   Math.min(prev.years + 1, 7),
        }));
      }, 16);
      return () => clearInterval(interval);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-[#050505]">
      {/* Background layers */}
      <div className="absolute inset-0 z-0">
        {/* Deep gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(201,168,76,0.08),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_60%,rgba(201,168,76,0.05),transparent)]" />

        {/* Gold orbs */}
        <div className="gold-orb w-[600px] h-[600px] -top-48 -left-48 opacity-60" />
        <div className="gold-orb w-[400px] h-[400px] top-1/2 -right-32 opacity-40" />
        <div className="gold-orb w-[300px] h-[300px] bottom-0 left-1/3 opacity-30" />

        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(201,168,76,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.5) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 pt-32 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left — Copy */}
          <div>
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold-500/30 bg-gold-500/5 mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-pulse" />
              <span className="text-gold-400 text-xs tracking-[0.2em] uppercase font-medium">
                Barcelona&apos;s #1 Luxury Chauffeur Service
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-display text-5xl sm:text-6xl xl:text-7xl leading-[1.05] mb-6"
            >
              <span className="text-white">Luxury</span>
              <br />
              <span className="text-gold-gradient">Private</span>
              <br />
              <span className="text-white">Transfers</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-dark-300 text-lg leading-relaxed mb-8 max-w-md"
            >
              Premium chauffeur service with Mercedes S-Class, BMW 7 Series, and Tesla Model S.
              Airport transfers, executive travel, and VIP transportation across Barcelona and Spain.
            </motion.p>

            {/* Trust pills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-2 mb-10"
            >
              {["Meet & Greet", "Flight Monitoring", "Free Waiting", "Fixed Prices", "24/7 Support"].map((t) => (
                <span
                  key={t}
                  className="text-xs text-dark-300 border border-white/10 rounded-full px-3 py-1 bg-white/[0.03]"
                >
                  ✦ {t}
                </span>
              ))}
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap gap-3 mb-12"
            >
              <Link
                href="/book"
                className="btn-gold flex items-center gap-2 px-7 py-4 rounded-xl text-sm font-semibold tracking-wide"
              >
                Book Your Transfer
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/fleet"
                className="btn-outline-gold flex items-center gap-2 px-7 py-4 rounded-xl text-sm font-semibold tracking-wide"
              >
                View Our Fleet
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex gap-8 border-t border-white/[0.06] pt-8"
            >
              <div>
                <p className="font-display text-3xl text-white stat-number">{count.clients.toLocaleString()}+</p>
                <p className="text-dark-400 text-xs tracking-wider uppercase mt-1">Happy Clients</p>
              </div>
              <div className="w-px bg-white/[0.06]" />
              <div>
                <p className="font-display text-3xl text-white stat-number">{(count.rating / 10).toFixed(1)}★</p>
                <p className="text-dark-400 text-xs tracking-wider uppercase mt-1">Google Rating</p>
              </div>
              <div className="w-px bg-white/[0.06]" />
              <div>
                <p className="font-display text-3xl text-white stat-number">{count.years}+</p>
                <p className="text-dark-400 text-xs tracking-wider uppercase mt-1">Years Active</p>
              </div>
            </motion.div>
          </div>

          {/* Right — Booking Form */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <BookingForm compact />
          </motion.div>
        </div>
      </div>

      {/* Trust badges strip */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="relative z-10 border-t border-white/[0.06] bg-black/40 backdrop-blur-sm"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {TRUST_BADGES.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} className="text-gold-500" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{label}</p>
                  <p className="text-dark-400 text-xs">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

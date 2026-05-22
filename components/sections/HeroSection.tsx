"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Star, Shield, Clock, Award } from "lucide-react";
import { useTranslation } from "react-i18next";
import BookingForm from "@/components/booking/BookingForm";
import "@/lib/i18n";

const fade = (delay = 0) => ({
  initial:    { opacity: 0, y: 14 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] },
});

export default function HeroSection() {
  const { t } = useTranslation();

  const TRUST_BADGES = [
    { icon: Star,   label: t("hero.badges.rating"),   sub: t("hero.badges.ratingsSub") },
    { icon: Shield, label: t("hero.badges.vtc"),       sub: t("hero.badges.vtcSub") },
    { icon: Clock,  label: t("hero.badges.service"),   sub: t("hero.badges.serviceSub") },
    { icon: Award,  label: t("hero.badges.transfers"), sub: t("hero.badges.transfersSub") },
  ];

  const TRUST_PILLS = [
    t("hero.trust.meetGreet"),
    t("hero.trust.flightMonitoring"),
    t("hero.trust.freeWaiting"),
    t("hero.trust.fixedPrices"),
    t("hero.trust.support"),
  ];

  return (
    <section className="relative min-h-[100dvh] flex flex-col justify-center overflow-hidden bg-[#050505]">
      {/* Static background — no motion */}
      <div aria-hidden className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,rgba(201,168,76,0.07),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_35%_at_80%_60%,rgba(201,168,76,0.04),transparent)]" />
        <div className="absolute -top-48 -left-48 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(201,168,76,0.1)_0%,transparent_65%)] blur-[70px]" />
        <div className="absolute bottom-0 left-1/3 w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(201,168,76,0.06)_0%,transparent_65%)] blur-[60px]" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(201,168,76,1) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,1) 1px,transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 pt-28 pb-12 sm:pt-32 sm:pb-16">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Left — Copy */}
          <div>
            <motion.div {...fade(0)} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#c9a84c]/25 bg-[#c9a84c]/[0.05] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]" />
              <span className="text-[#c9a84c] text-[11px] tracking-[0.22em] uppercase font-medium">
                {t("hero.badge")}
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.08 }}
              className="font-display text-[2.8rem] sm:text-[3.5rem] xl:text-[4.2rem] leading-[1.05] mb-6"
            >
              <span className="text-white">{t("hero.title1")}</span>
              <br />
              <span className="text-gold-gradient">{t("hero.title2")}</span>
              <br />
              <span className="text-white">{t("hero.title3")}</span>
            </motion.h1>

            <motion.p {...fade(0.14)} className="text-white/45 text-base sm:text-lg leading-relaxed mb-8 max-w-md">
              {t("hero.description")}
            </motion.p>

            {/* Trust pills */}
            <motion.div {...fade(0.2)} className="flex flex-wrap gap-2 mb-9">
              {TRUST_PILLS.map((pill) => (
                <span
                  key={pill}
                  className="text-xs text-white/35 border border-white/[0.08] rounded-full px-3 py-1"
                >
                  ✦ {pill}
                </span>
              ))}
            </motion.div>

            {/* CTAs */}
            <motion.div {...fade(0.25)} className="flex flex-wrap gap-3 mb-12">
              <Link
                href="/book"
                className="btn-gold inline-flex items-center gap-2 px-7 py-4 rounded-xl text-sm font-semibold tracking-wide"
              >
                {t("hero.cta.book")}
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/fleet"
                className="btn-outline-gold inline-flex items-center gap-2 px-7 py-4 rounded-xl text-sm font-semibold tracking-wide"
              >
                {t("hero.cta.fleet")}
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="flex gap-8 border-t border-white/[0.06] pt-8"
            >
              {[
                { value: "5,000+", label: t("hero.stats.clients") },
                { value: "4.9★",   label: t("hero.stats.rating") },
                { value: "7+",     label: t("hero.stats.years") },
              ].map((s, i) => (
                <div key={s.label} className="flex items-center gap-8">
                  {i > 0 && <div className="w-px h-8 bg-white/[0.06]" />}
                  <div>
                    <p className="font-display text-2xl sm:text-3xl text-white">{s.value}</p>
                    <p className="text-white/30 text-[11px] tracking-wider uppercase mt-1">{s.label}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — Booking Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 0.2 }}
          >
            <BookingForm compact />
          </motion.div>
        </div>
      </div>

      {/* Trust badges strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="relative z-10 border-t border-white/[0.05] bg-black/30 backdrop-blur-sm"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {TRUST_BADGES.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#c9a84c]/[0.08] border border-[#c9a84c]/15 flex items-center justify-center flex-shrink-0">
                  <Icon size={15} className="text-[#c9a84c]" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium leading-snug">{label}</p>
                  <p className="text-white/30 text-xs">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

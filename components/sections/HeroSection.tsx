"use client";

import Link from "next/link";
import { ArrowRight, Star, Shield, Clock, Award } from "lucide-react";
import { useTranslations } from "@/components/language/I18nProvider";
import BookingForm from "@/components/booking/BookingForm";
import { COMPANY_FACTS } from "@/lib/company-facts";

export default function HeroSection() {
  const t = useTranslations("hero");

  const TRUST_BADGES = [
    { icon: Star,   label: t("badges.rating"),   sub: `${COMPANY_FACTS.totalReviewCount} ${t("badges.ratingsSub")}` },
    { icon: Shield, label: t("badges.vtc"),       sub: t("badges.vtcSub") },
    { icon: Clock,  label: t("badges.service"),   sub: t("badges.serviceSub") },
    { icon: Award,  label: t("badges.transfers"), sub: t("badges.transfersSub") },
  ];

  const TRUST_PILLS = [
    t("trust.meetGreet"),
    t("trust.flightMonitoring"),
    t("trust.freeWaiting"),
    t("trust.fixedPrices"),
    t("trust.support"),
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
          {/* Above-the-fold: no mount animation here. This content (including the H1,
              which Lighthouse measures as the LCP element) previously sat at opacity:0
              until framer-motion hydrated and animated it in — on a throttled mobile
              connection that added ~2.7s of pure "element render delay" to LCP for a
              one-time fade the user never perceives as an "animation" anyway, since
              it's the very first thing they see. Rendered immediately instead. */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#c9a84c]/25 bg-[#c9a84c]/[0.05] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]" />
              <span className="text-[#c9a84c] text-[11px] tracking-[0.22em] uppercase font-medium">
                {t("badge")}
              </span>
            </div>

            <h1 className="font-display text-[2.8rem] sm:text-[3.5rem] xl:text-[4.2rem] leading-[1.05] mb-6">
              <span className="text-white">{t("title1")}</span>
              <br />
              <span className="text-gold-gradient">{t("title2")}</span>
              <br />
              <span className="text-white">{t("title3")}</span>
            </h1>

            <p className="text-white/45 text-base sm:text-lg leading-relaxed mb-8 max-w-md">
              {t("description")}
            </p>

            {/* Trust pills */}
            <div className="flex flex-wrap gap-2 mb-9">
              {TRUST_PILLS.map((pill) => (
                <span
                  key={pill}
                  className="text-xs text-white/35 border border-white/[0.08] rounded-full px-3 py-1"
                >
                  ✦ {pill}
                </span>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 mb-12">
              <Link
                href="/book"
                className="btn-gold inline-flex items-center gap-2 px-7 py-4 rounded-xl text-sm font-semibold tracking-wide"
              >
                {t("cta.book")}
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/fleet"
                className="btn-outline-gold inline-flex items-center gap-2 px-7 py-4 rounded-xl text-sm font-semibold tracking-wide"
              >
                {t("cta.fleet")}
              </Link>
            </div>

            {/* Stats */}
            <div className="flex gap-8 border-t border-white/[0.06] pt-8">
              {[
                { value: COMPANY_FACTS.transfersDisplay,   label: t("stats.clients") },
                { value: COMPANY_FACTS.ratingDisplay,      label: t("stats.rating") },
                { value: COMPANY_FACTS.yearsDisplay,       label: t("stats.years") },
              ].map((s, i) => (
                <div key={s.label} className="flex items-center gap-8">
                  {i > 0 && <div className="w-px h-8 bg-white/[0.06]" />}
                  <div>
                    <p className="font-display text-2xl sm:text-3xl text-white">{s.value}</p>
                    <p className="text-white/30 text-[11px] tracking-wider uppercase mt-1">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Booking Form */}
          <div>
            <BookingForm compact />
          </div>
        </div>
      </div>

      {/* Trust badges strip */}
      <div className="relative z-10 border-t border-white/[0.05] bg-black/30 backdrop-blur-sm">
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
      </div>
    </section>
  );
}

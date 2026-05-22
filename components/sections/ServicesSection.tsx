"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Plane, Anchor, Briefcase, Building2, Theater, Clock, Waves, Sunset, Mountain, Hotel, Crown, Map, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";

const SERVICE_ICONS = [Plane, Anchor, Briefcase, Building2, Theater, Clock, Waves, Sunset, Mountain, Hotel, Crown, Map];
const SERVICE_KEYS = ["airport", "cruise", "executive", "corporate", "vipEvents", "hourly", "costaBrava", "costaDorada", "andorra", "hotel", "vip", "tours"] as const;
const SERVICE_HREFS = [
  "/airport-transfers", "/airport-transfers#cruise", "/corporate", "/corporate",
  "/fleet", "/hourly", "/pricing", "/pricing", "/pricing", "/book", "/fleet#first-class", "/about#tours",
];

export default function ServicesSection() {
  const { t } = useTranslation();

  const FEATURES = [
    { icon: "🛫", title: t("services.features.flightMonitoring"), desc: t("services.features.realTime") },
    { icon: "⏳", title: t("services.features.freeWaiting"),      desc: t("services.features.sixtyMin") },
    { icon: "🪧", title: t("services.features.meetGreet"),        desc: t("services.features.nameBoard") },
    { icon: "💳", title: t("services.features.fixedPrices"),      desc: t("services.features.noSurge") },
  ];

  return (
    <section className="py-24 bg-dark-950" id="services">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4"
          >
            {t("services.label")}
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-display text-4xl sm:text-5xl text-white mb-4"
          >
            {t("services.title")} <span className="text-gold-gradient">{t("services.titleAccent")}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-dark-400 max-w-xl mx-auto"
          >
            {t("services.subtitle")}
          </motion.p>
          <div className="gold-divider mt-6" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {SERVICE_KEYS.map((key, i) => {
            const Icon = SERVICE_ICONS[i];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={SERVICE_HREFS[i]}
                  className="group glass-card gold-hover-border rounded-xl p-5 flex flex-col h-full hover:bg-white/[0.04] transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mb-4 group-hover:bg-gold-500/15 transition-colors">
                    <Icon size={18} className="text-gold-500" />
                  </div>
                  <h3 className="text-white font-medium mb-2 group-hover:text-gold-400 transition-colors">
                    {t(`services.list.${key}.title`)}
                  </h3>
                  <p className="text-dark-400 text-sm leading-relaxed flex-1">
                    {t(`services.list.${key}.desc`)}
                  </p>
                  <div className="flex items-center gap-1 mt-4 text-gold-500/60 group-hover:text-gold-400 transition-colors text-xs">
                    <span>{t("services.learnMore")}</span>
                    <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
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
        </motion.div>
      </div>
    </section>
  );
}

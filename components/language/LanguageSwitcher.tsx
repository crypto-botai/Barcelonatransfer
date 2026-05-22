"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { SUPPORTED_LOCALES, LANGUAGE_META, type SupportedLocale } from "@/lib/i18n";
import "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = (i18n.language?.split("-")[0] || "en") as SupportedLocale;
  const currentMeta = LANGUAGE_META[current] ?? LANGUAGE_META.en;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (locale: SupportedLocale) => {
    i18n.changeLanguage(locale);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border transition-all duration-200",
          "border-gold-500/20 bg-white/[0.03] hover:bg-white/[0.06] hover:border-gold-500/40",
          compact ? "px-2 py-1.5" : "px-3 py-2"
        )}
        aria-label="Select language"
      >
        <span className="text-base leading-none">{currentMeta.flag}</span>
        {!compact && (
          <span className="text-xs text-dark-300 font-medium tracking-wide hidden sm:block">
            {currentMeta.native}
          </span>
        )}
        <ChevronDown
          size={12}
          className={cn("text-gold-500/60 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className={cn(
              "absolute z-[200] mt-2 w-44 rounded-xl overflow-hidden",
              "bg-[#0f0f0f]/95 backdrop-blur-xl border border-gold-500/20",
              "shadow-[0_16px_48px_rgba(0,0,0,0.8),0_0_0_1px_rgba(201,168,76,0.08)]",
              "right-0"
            )}
          >
            <div className="py-1">
              {SUPPORTED_LOCALES.map((locale) => {
                const meta = LANGUAGE_META[locale];
                const isActive = locale === current;
                return (
                  <button
                    key={locale}
                    onClick={() => handleSelect(locale)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-150",
                      isActive
                        ? "bg-gold-500/10 text-gold-400"
                        : "text-dark-300 hover:bg-white/[0.04] hover:text-white"
                    )}
                  >
                    <span className="text-base leading-none">{meta.flag}</span>
                    <span className="text-sm font-medium flex-1">{meta.native}</span>
                    {isActive && <Check size={13} className="text-gold-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { SUPPORTED_LOCALES, LANGUAGE_META, type SupportedLocale } from "@/lib/i18n";
import { useI18n } from "@/components/language/I18nProvider";
import { cn } from "@/lib/utils";

/**
 * The language menu, without framer-motion.
 *
 * It sits in the header on every page, so it is one of the first things a
 * visitor taps — and it was the slowest thing on the site to respond. Three
 * reasons, all fixed here:
 *
 *   1. The open/close animation was framer-motion, which had to download and
 *      parse before the button did anything at all. The animation is now two
 *      CSS keyframes that need no JavaScript.
 *   2. The panel used backdrop-blur-xl. Blurring whatever is behind a menu is
 *      expensive on phone GPUs and it is invisible anyway over a near-opaque
 *      panel, so the panel is simply opaque now.
 *   3. The outside-click handler listened for mousedown only. Phones do send a
 *      synthetic mousedown, but late and not always, so the menu often refused
 *      to close on the first tap outside — which reads as the menu being stuck.
 *      It listens for pointerdown, which covers touch, pen and mouse alike.
 */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentMeta = LANGUAGE_META[locale] ?? LANGUAGE_META.en;

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    // Bound only while the menu is open, so a closed switcher costs nothing.
    document.addEventListener("pointerdown", handler);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("pointerdown", handler);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const handleSelect = (l: SupportedLocale) => {
    setLocale(l);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        // touch-action tells the browser this will never be a double-tap zoom,
        // so it fires the tap immediately instead of waiting to find out.
        style={{ touchAction: "manipulation" }}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border transition-colors duration-200",
          "border-gold-500/20 bg-white/[0.03] hover:bg-white/[0.06] hover:border-gold-500/40",
          compact ? "px-2 py-1.5" : "px-3 py-2"
        )}
        aria-label="Select language"
        aria-haspopup="listbox"
        aria-expanded={open}
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

      {open && (
        <div
          role="listbox"
          className={cn(
            "animate-menu-in absolute z-[200] mt-2 w-44 rounded-xl overflow-hidden right-0",
            "bg-[#0f0f0f] border border-gold-500/20",
            "shadow-[0_16px_48px_rgba(0,0,0,0.8),0_0_0_1px_rgba(201,168,76,0.08)]"
          )}
        >
          <div className="py-1">
            {SUPPORTED_LOCALES.map((l) => {
              const meta = LANGUAGE_META[l];
              const isActive = l === locale;
              return (
                <button
                  key={l}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelect(l)}
                  style={{ touchAction: "manipulation" }}
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
        </div>
      )}
    </div>
  );
}

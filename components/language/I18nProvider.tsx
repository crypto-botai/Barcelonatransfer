"use client";

/**
 * Self-contained i18n system using plain React context.
 * All 8 locale JSON files are bundled at build time.
 * The context DEFAULT VALUE is the English messages object, so even without
 * any Provider in the tree (which can happen during Next.js SSR of client
 * component subtrees), useTranslations() always returns real English text —
 * never raw keys.
 */

import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { SUPPORTED_LOCALES, RTL_LOCALES, LANGUAGE_META, type SupportedLocale } from "@/lib/i18n";

// Statically import all locales — bundled at build time, zero runtime fetch
import enMsg from "@/messages/en.json";
import esMsg from "@/messages/es.json";
import frMsg from "@/messages/fr.json";
import arMsg from "@/messages/ar.json";
import ruMsg from "@/messages/ru.json";
import zhMsg from "@/messages/zh.json";
import deMsg from "@/messages/de.json";
import itMsg from "@/messages/it.json";

type Messages = typeof enMsg;
type Namespace = keyof Messages;

const ALL_MESSAGES: Record<SupportedLocale, Messages> = {
  en: enMsg,
  es: esMsg as unknown as Messages,
  fr: frMsg as unknown as Messages,
  ar: arMsg as unknown as Messages,
  ru: ruMsg as unknown as Messages,
  zh: zhMsg as unknown as Messages,
  de: deMsg as unknown as Messages,
  it: itMsg as unknown as Messages,
};

// ─── Contexts ────────────────────────────────────────────────────────────────
// Default = English messages. useContext() falls back to this default during
// SSR even if the Provider hasn't rendered yet — guarantees real text in HTML.
const MessagesCtx = createContext<Messages>(enMsg);

interface LocaleCtxValue {
  locale: SupportedLocale;
  setLocale: (l: SupportedLocale) => void;
}
const LocaleCtx = createContext<LocaleCtxValue>({ locale: "en", setLocale: () => {} });

// ─── Public hooks ─────────────────────────────────────────────────────────────
export function useI18n(): LocaleCtxValue {
  return useContext(LocaleCtx);
}

/**
 * Drop-in replacement for next-intl's useTranslations().
 * Works identically: const t = useTranslations("hero"); t("title1");
 * Supports nested dot-notation: t("badges.rating")
 */
export function useTranslations(namespace: Namespace) {
  const messages = useContext(MessagesCtx);
  const ns = messages[namespace] as Record<string, unknown> | undefined;

  return function t(key: string): string {
    if (!ns) return key;
    const parts = key.split(".");
    let cur: unknown = ns;
    for (const part of parts) {
      if (cur == null || typeof cur !== "object") return key;
      cur = (cur as Record<string, unknown>)[part];
    }
    return typeof cur === "string" ? cur : key;
  };
}

// ─── Provider ────────────────────────────────────────────────────────────────
export default function I18nProvider({ children }: { children: ReactNode }) {
  // Start with English — guarantees SSR HTML has real text, not keys.
  // useEffect fires only on the client, after hydration is complete.
  const [locale, setLocaleState] = useState<SupportedLocale>("en");

  useEffect(() => {
    // Read stored preference from cookie (set by setLocale below)
    const cookie = document.cookie.split(";").find((c) => c.trim().startsWith("NEXT_LOCALE="));
    const stored = cookie?.split("=")?.[1]?.trim() as SupportedLocale | undefined;
    if (stored && SUPPORTED_LOCALES.includes(stored) && stored !== "en") {
      setLocaleState(stored);
    }
  }, []);

  function setLocale(newLocale: SupportedLocale) {
    setLocaleState(newLocale);
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;
    document.documentElement.lang = newLocale;
    document.documentElement.dir = RTL_LOCALES.includes(newLocale) ? "rtl" : "ltr";
    const meta = LANGUAGE_META[newLocale];
    if (meta?.font && !document.querySelector(`link[data-i18n-font="${newLocale}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = meta.font;
      link.setAttribute("data-i18n-font", newLocale);
      document.head.appendChild(link);
    }
  }

  return (
    <LocaleCtx.Provider value={{ locale, setLocale }}>
      <MessagesCtx.Provider value={ALL_MESSAGES[locale]}>
        {children}
      </MessagesCtx.Provider>
    </LocaleCtx.Provider>
  );
}

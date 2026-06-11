"use client";

import { useState, createContext, useContext, useEffect } from "react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import { SUPPORTED_LOCALES, RTL_LOCALES, LANGUAGE_META, type SupportedLocale } from "@/lib/i18n";

// Bundle all 8 locales at build time — no runtime fetching
import enMsg from "@/messages/en.json";
import esMsg from "@/messages/es.json";
import frMsg from "@/messages/fr.json";
import arMsg from "@/messages/ar.json";
import ruMsg from "@/messages/ru.json";
import zhMsg from "@/messages/zh.json";
import deMsg from "@/messages/de.json";
import itMsg from "@/messages/it.json";

const ALL_MESSAGES: Record<SupportedLocale, AbstractIntlMessages> = {
  en: enMsg as AbstractIntlMessages,
  es: esMsg as AbstractIntlMessages,
  fr: frMsg as AbstractIntlMessages,
  ar: arMsg as AbstractIntlMessages,
  ru: ruMsg as AbstractIntlMessages,
  zh: zhMsg as AbstractIntlMessages,
  de: deMsg as AbstractIntlMessages,
  it: itMsg as AbstractIntlMessages,
};

function getStoredLocale(): SupportedLocale {
  if (typeof document === "undefined") return "en";
  const cookie = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith("NEXT_LOCALE="));
  const val = cookie?.split("=")?.[1]?.trim() as SupportedLocale | undefined;
  return val && SUPPORTED_LOCALES.includes(val) ? val : "en";
}

interface I18nCtx {
  locale: SupportedLocale;
  setLocale: (l: SupportedLocale) => void;
}

export const I18nContext = createContext<I18nCtx>({
  locale: "en",
  setLocale: () => {},
});

export const useI18n = () => useContext(I18nContext);

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  // SSR always starts with English so the initial HTML has real text, not raw keys
  const [locale, setLocaleState] = useState<SupportedLocale>("en");

  useEffect(() => {
    // After hydration, sync to user's stored preference
    const stored = getStoredLocale();
    if (stored !== "en") setLocaleState(stored);
  }, []);

  const setLocale = (newLocale: SupportedLocale) => {
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
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={ALL_MESSAGES[locale]}>
        {children}
      </NextIntlClientProvider>
    </I18nContext.Provider>
  );
}

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import ar from "@/messages/ar.json";
import ru from "@/messages/ru.json";
import zh from "@/messages/zh.json";
import de from "@/messages/de.json";
import it from "@/messages/it.json";

export const SUPPORTED_LOCALES = ["en", "es", "fr", "ar", "ru", "zh", "de", "it"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "en";
export const RTL_LOCALES: SupportedLocale[] = ["ar"];

export const LANGUAGE_META: Record<SupportedLocale, { native: string; flag: string; font?: string }> = {
  en: { native: "English",  flag: "🇬🇧" },
  es: { native: "Español",  flag: "🇪🇸" },
  fr: { native: "Français", flag: "🇫🇷" },
  ar: { native: "العربية",  flag: "🇦🇪", font: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" },
  ru: { native: "Русский",  flag: "🇷🇺" },
  zh: { native: "中文",     flag: "🇨🇳", font: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap" },
  de: { native: "Deutsch",  flag: "🇩🇪" },
  it: { native: "Italiano", flag: "🇮🇹" },
};

// Detect country → language
const COUNTRY_MAP: Record<string, SupportedLocale> = {
  ES: "es", MX: "es", AR: "es", CO: "es", PE: "es", CL: "es",
  FR: "fr", BE: "fr", CH: "fr",
  AE: "ar", SA: "ar", QA: "ar", KW: "ar", BH: "ar", OM: "ar", EG: "ar",
  RU: "ru", UA: "ru", BY: "ru",
  CN: "zh", TW: "zh", HK: "zh", SG: "zh",
  DE: "de", AT: "de",
  IT: "it",
};

export function localeFromCountry(countryCode: string): SupportedLocale | null {
  return COUNTRY_MAP[countryCode.toUpperCase()] ?? null;
}

if (typeof window !== "undefined" && !i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        es: { translation: es },
        fr: { translation: fr },
        ar: { translation: ar },
        ru: { translation: ru },
        zh: { translation: zh },
        de: { translation: de },
        it: { translation: it },
      },
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED_LOCALES as unknown as string[],
      detection: {
        order: ["cookie", "localStorage", "navigator", "htmlTag"],
        caches: ["cookie", "localStorage"],
        lookupCookie: "NEXT_LOCALE",
        lookupLocalStorage: "i18nextLng",
        cookieOptions: { path: "/", maxAge: 31536000 },
      },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
}

export default i18n;

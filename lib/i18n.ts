// i18n constants — used by I18nProvider, LanguageSwitcher, and locale-aware utils

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

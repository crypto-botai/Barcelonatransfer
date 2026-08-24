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

// ─── URL-visible locales ─────────────────────────────────────────────────────
//
// Until now the language switcher only changed React state, so every language
// lived at the same URL. Google therefore only ever saw the English site and
// none of the seven translations could rank for anything. Giving each locale
// its own URL is what makes them indexable.
//
// English stays unprefixed so no existing URL moves and no link or ranking is
// lost: "/" remains "/", and French is served at "/fr".
export const PREFIXED_LOCALES = SUPPORTED_LOCALES.filter(
  (l): l is Exclude<SupportedLocale, "en"> => l !== DEFAULT_LOCALE,
);

/**
 * Routes whose PAGE CONTENT is translated, not merely the surrounding chrome.
 *
 * This deliberately excludes the destination pages, the blog and the marketing
 * pages: their prose is written in English inside the components, so a "/fr"
 * copy would be an English page wearing a French menu. Publishing those would
 * give Google eight near-identical URLs per page, which is how a site earns a
 * duplicate-content problem rather than a ranking. They join this list as their
  * content is genuinely translated.
 *
 * /book is not here yet either: its form is translated but the heading, the
 * six questions beneath it and the explainer are English inside the page.
 */
export const LOCALIZED_ROUTES = ["/"] as const;

export function isLocalizedRoute(path: string): boolean {
  return (LOCALIZED_ROUTES as readonly string[]).includes(path);
}

/** "/fr/book" → { locale: "fr", path: "/book" }; "/book" → { locale: "en", path: "/book" } */
export function splitLocale(pathname: string): { locale: SupportedLocale; path: string } {
  const match = /^\/([A-Za-z]{2})(\/.*)?$/.exec(pathname);
  if (match) {
    const candidate = match[1].toLowerCase() as SupportedLocale;
    if (candidate !== DEFAULT_LOCALE && (SUPPORTED_LOCALES as readonly string[]).includes(candidate)) {
      return { locale: candidate, path: match[2] || "/" };
    }
  }
  return { locale: DEFAULT_LOCALE, path: pathname };
}

/** The URL a given locale should use for a path. English keeps the bare path. */
export function localizedPath(locale: SupportedLocale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

const SITE = "https://www.elitebcn.info";

/**
 * The `alternates` block for a localized route: a self-referencing canonical
 * plus one hreflang per language.
 *
 * x-default points at English, which is what Google serves to a searcher whose
 * language we do not publish. Every locale must list every other locale,
 * including itself, or Google ignores the set.
 */
export function alternatesFor(path: string, locale: SupportedLocale = DEFAULT_LOCALE) {
  const languages: Record<string, string> = { "x-default": `${SITE}${path === "/" ? "" : path}` };
  for (const l of SUPPORTED_LOCALES) {
    const p = localizedPath(l, path);
    languages[l] = `${SITE}${p === "/" ? "" : p}`;
  }
  const self = localizedPath(locale, path);
  return { canonical: `${SITE}${self === "/" ? "" : self}`, languages };
}

import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALIZED_ROUTES,
  PREFIXED_LOCALES,
  SUPPORTED_LOCALES,
  alternatesFor,
  isLocalizedRoute,
  localizedPath,
  splitLocale,
} from "@/lib/i18n";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
// Aliased: the locale code for Italian collides with vitest's `it`.
import itMessages from "@/messages/it.json";
import ru from "@/messages/ru.json";
import zh from "@/messages/zh.json";

const FILES: Record<string, Record<string, unknown>> = { ar, de, en, es, fr, it: itMessages, ru, zh };

/**
 * The site was translated into eight languages that Google could not see: the
 * switcher changed React state without changing the URL, so every language
 * shared "/" and only English was ever indexed. These guard the fix.
 */
describe("locale URLs", () => {
  it("prefixes every language except English", () => {
    expect(PREFIXED_LOCALES).not.toContain(DEFAULT_LOCALE);
    expect(PREFIXED_LOCALES.length).toBe(SUPPORTED_LOCALES.length - 1);
  });

  it("leaves English URLs untouched so no ranking is thrown away", () => {
    expect(localizedPath("en", "/")).toBe("/");
    expect(localizedPath("en", "/book")).toBe("/book");
  });

  it("round-trips a prefixed path", () => {
    for (const locale of PREFIXED_LOCALES) {
      const url = localizedPath(locale, "/");
      expect(url).toBe(`/${locale}`);
      expect(splitLocale(url)).toEqual({ locale, path: "/" });
    }
  });

  it("does not mistake a two-letter page for a locale", () => {
    // A path like /faq must never be read as the locale "fa".
    expect(splitLocale("/faq")).toEqual({ locale: "en", path: "/faq" });
    expect(splitLocale("/about")).toEqual({ locale: "en", path: "/about" });
    expect(splitLocale("/xx")).toEqual({ locale: "en", path: "/xx" });
  });

  it("gives every locale page a self-referencing canonical", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { canonical } = alternatesFor("/", locale);
      const expected =
        locale === DEFAULT_LOCALE
          ? "https://www.elitebcn.info"
          : `https://www.elitebcn.info/${locale}`;
      expect(canonical).toBe(expected);
    }
  });

  it("lists every language, itself included, plus x-default", () => {
    // Google discards a hreflang set where the pages do not all point at each
    // other, so a missing self-reference would silently void the whole thing.
    for (const locale of SUPPORTED_LOCALES) {
      const { languages } = alternatesFor("/", locale);
      expect(Object.keys(languages).sort()).toEqual(
        [...SUPPORTED_LOCALES, "x-default"].sort(),
      );
      expect(languages[locale]).toBe(alternatesFor("/", locale).canonical);
      expect(languages["x-default"]).toBe("https://www.elitebcn.info");
    }
  });

  it("only publishes locale URLs for routes whose content is translated", () => {
    // Adding a route here without translating its prose would hand Google eight
    // near-identical English pages instead of one.
    expect(LOCALIZED_ROUTES).toEqual(["/"]);
    expect(isLocalizedRoute("/")).toBe(true);
    expect(isLocalizedRoute("/transfers/sitges")).toBe(false);
    expect(isLocalizedRoute("/blog")).toBe(false);
  });
});

describe("message files", () => {
  it("covers every supported locale", () => {
    expect(Object.keys(FILES).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it("carries the same namespaces in every language", () => {
    const reference = Object.keys(en).sort();
    for (const [locale, file] of Object.entries(FILES)) {
      expect(Object.keys(file).sort(), `${locale} namespaces`).toEqual(reference);
    }
  });

  it("has a translated title and description for every locale", () => {
    // Without these the French page would have carried the English title into
    // the French search result, which is most of what a searcher reads.
    for (const [locale, file] of Object.entries(FILES)) {
      const meta = file.meta as Record<string, string>;
      for (const key of ["homeTitle", "homeDescription"]) {
        expect(typeof meta?.[key], `${locale}.meta.${key}`).toBe("string");
        expect(meta[key].length, `${locale}.meta.${key}`).toBeGreaterThan(10);
      }
      expect(meta.homeTitle.length, `${locale} title length`).toBeLessThanOrEqual(60);
      expect(meta.homeDescription.length, `${locale} description length`).toBeLessThanOrEqual(158);
    }
  });

  it("translates the VAT and tolls footnote in every language", () => {
    for (const [locale, file] of Object.entries(FILES)) {
      const pricing = file.pricing as Record<string, string>;
      expect(typeof pricing?.vatNoteLead, `${locale} vatNoteLead`).toBe("string");
      expect(typeof pricing?.vatNoteBody, `${locale} vatNoteBody`).toBe("string");
    }
  });

  it("does not leave the English string sitting in another language", () => {
    const englishLead = (en.pricing as Record<string, string>).vatNoteLead;
    for (const [locale, file] of Object.entries(FILES)) {
      if (locale === "en") continue;
      const lead = (file.pricing as Record<string, string>).vatNoteLead;
      expect(lead, `${locale} still has the English footnote`).not.toBe(englishLead);
    }
  });
});

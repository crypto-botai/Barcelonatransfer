import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import itMessages from "@/messages/it.json";
import ru from "@/messages/ru.json";
import zh from "@/messages/zh.json";
import ar from "@/messages/ar.json";

const LOCALES: Record<string, unknown> = { es, fr, de, it: itMessages, ru, zh, ar };

/** Flattens nested messages to dotted paths: { footer: { links: { a: "x" } } } -> "footer.links.a". */
function flatten(obj: unknown, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      Object.assign(out, flatten(v, prefix ? `${prefix}.${k}` : k));
    }
  } else if (typeof obj === "string") {
    out[prefix] = obj;
  }
  return out;
}

const EN = flatten(en);

describe("translation completeness", () => {
  // A key present in English but missing elsewhere used to render its own dotted
  // path on screen — Spanish, Arabic and Chinese visitors saw the literal text
  // "links.hotelTransfers" in the footer. t() now falls back to English, but a
  // gap is still a gap, so it is caught here rather than shipped.
  it.each(Object.keys(LOCALES))("%s defines every key English defines", (lang) => {
    const theirs = flatten(LOCALES[lang]);
    const missing = Object.keys(EN).filter((k) => !(k in theirs));
    expect(missing, `${lang} is missing:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it.each(Object.keys(LOCALES))("%s has no empty strings", (lang) => {
    const theirs = flatten(LOCALES[lang]);
    const blank = Object.entries(theirs).filter(([, v]) => v.trim() === "").map(([k]) => k);
    expect(blank, `${lang} has blank values: ${blank.join(", ")}`).toEqual([]);
  });

  it.each(Object.keys(LOCALES))("%s is actually translated, not copied English", (lang) => {
    // Some overlap is legitimate — brand names, "Barcelona", "VIP", "WhatsApp",
    // "Email". But if most strings are byte-identical to English the file is a
    // placeholder rather than a translation, and the site would look untranslated
    // while reporting full coverage.
    const theirs = flatten(LOCALES[lang]);
    const shared = Object.keys(EN).filter((k) => k in theirs);
    const identical = shared.filter((k) => EN[k] === theirs[k]);
    const ratio = identical.length / shared.length;
    expect(ratio, `${lang}: ${(ratio * 100).toFixed(0)}% of strings are identical to English`)
      .toBeLessThan(0.5);
  });
});

describe("translation key hygiene", () => {
  it("English defines every namespace the other locales use", () => {
    // The reverse direction: keys that exist only in other locales can never be
    // reached, because the namespace type is derived from English. They are dead
    // weight in those bundles.
    const enNamespaces = new Set(Object.keys(en as Record<string, unknown>));
    for (const [lang, msgs] of Object.entries(LOCALES)) {
      const theirs = Object.keys(msgs as Record<string, unknown>);
      const orphan = theirs.filter((ns) => !enNamespaces.has(ns));
      expect(orphan, `${lang} has namespaces English lacks: ${orphan.join(", ")}`).toEqual([]);
    }
  });

  it("no key renders as a dotted path", () => {
    // Guards against a value accidentally set to its own key.
    for (const [lang, msgs] of Object.entries({ en, ...LOCALES })) {
      const flat = flatten(msgs);
      const looksLikeKey = Object.entries(flat)
        .filter(([k, v]) => v === k || v.endsWith(`.${k.split(".").pop()}`) && /^[a-z]+(\.[a-zA-Z]+)+$/.test(v))
        .map(([k]) => k);
      expect(looksLikeKey, `${lang}: ${looksLikeKey.join(", ")}`).toEqual([]);
    }
  });
});

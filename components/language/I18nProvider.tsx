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

// English is bundled: the server renders in it, so it must be present
// synchronously or the first paint would show translation keys.
import enMsg from "@/messages/en.json";

type Messages = typeof enMsg;
type Namespace = keyof Messages;

/**
 * The other seven locales load on demand.
 *
 * All eight were statically imported, which put roughly 125 KB of JSON into the
 * bundle every visitor downloads and parses — for seven languages the average
 * visitor never opens. On a phone that cost is paid before anything becomes
 * interactive, which is why the language menu felt slow to appear.
 *
 * Each locale is now its own chunk, fetched the first time it is chosen and
 * cached by the browser thereafter.
 */
const LOADERS: Record<Exclude<SupportedLocale, "en">, () => Promise<{ default: unknown }>> = {
  es: () => import("@/messages/es.json"),
  fr: () => import("@/messages/fr.json"),
  ar: () => import("@/messages/ar.json"),
  ru: () => import("@/messages/ru.json"),
  zh: () => import("@/messages/zh.json"),
  de: () => import("@/messages/de.json"),
  it: () => import("@/messages/it.json"),
};

const CACHE = new Map<SupportedLocale, Messages>([["en", enMsg]]);

async function loadMessages(locale: SupportedLocale): Promise<Messages> {
  const cached = CACHE.get(locale);
  if (cached) return cached;
  const loader = LOADERS[locale as Exclude<SupportedLocale, "en">];
  if (!loader) return enMsg;
  const mod = await loader();
  const msgs = mod.default as Messages;
  CACHE.set(locale, msgs);
  return msgs;
}

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
/** Walks a dot path into a messages namespace. Returns null if it isn't a string. */
function lookup(ns: unknown, key: string): string | null {
  if (ns == null || typeof ns !== "object") return null;
  let cur: unknown = ns;
  for (const part of key.split(".")) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : null;
}

export function useTranslations(namespace: Namespace) {
  const messages = useContext(MessagesCtx);

  return function t(key: string): string {
    const hit = lookup(messages[namespace], key);
    if (hit !== null) return hit;

    // Fall back to English rather than returning the raw key.
    //
    // Previously a key present in en.json but absent from another locale
    // rendered its own path as the label — Spanish, Arabic and Chinese visitors
    // saw the literal text "links.hotelTransfers" in the footer. An untranslated
    // string showing in English is a gap; a dotted key path on screen is a
    // visible defect.
    const english = lookup(enMsg[namespace], key);
    if (english !== null) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[i18n] missing translation: ${String(namespace)}.${key}`);
      }
      return english;
    }

    // Neither locale has it — the key itself is wrong. Surface that in
    // development; in production show nothing rather than debug text.
    if (process.env.NODE_ENV === "development") {
      console.error(`[i18n] unknown key: ${String(namespace)}.${key}`);
      return key;
    }
    return "";
  };
}

// ─── Provider ────────────────────────────────────────────────────────────────
export default function I18nProvider({ children }: { children: ReactNode }) {
  // Start with English — guarantees SSR HTML has real text, not keys.
  // useEffect fires only on the client, after hydration is complete.
  const [locale, setLocaleState] = useState<SupportedLocale>("en");
  const [messages, setMessages] = useState<Messages>(enMsg);

  useEffect(() => {
    // Read stored preference from cookie (set by setLocale below)
    const cookie = document.cookie.split(";").find((c) => c.trim().startsWith("NEXT_LOCALE="));
    const stored = cookie?.split("=")?.[1]?.trim() as SupportedLocale | undefined;
    if (stored && SUPPORTED_LOCALES.includes(stored) && stored !== "en") {
      setLocaleState(stored);
      // Text stays English until this resolves, which is the honest fallback:
      // the alternative is a flash of untranslated keys.
      loadMessages(stored).then(setMessages).catch(() => {});
    }
  }, []);

  function setLocale(newLocale: SupportedLocale) {
    setLocaleState(newLocale);
    loadMessages(newLocale).then(setMessages).catch(() => {});
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
      <MessagesCtx.Provider value={messages}>
        {children}
      </MessagesCtx.Provider>
    </LocaleCtx.Provider>
  );
}

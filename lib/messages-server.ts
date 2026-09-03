import "server-only";

import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import it from "@/messages/it.json";
import pt from "@/messages/pt.json";
import ru from "@/messages/ru.json";
import zh from "@/messages/zh.json";

/**
 * Locale messages, loaded on the server.
 *
 * I18nProvider fetches the non-English files as browser chunks, which is right
 * for a visitor who switches language mid-visit. It is the wrong shape for a
 * locale URL: the page must already be in the right language when the HTML
 * leaves the server, or Googlebot indexes English no matter what the address
 * says. These imports are server-side only, so nothing here reaches the client
 * bundle.
 */
const MESSAGES = { ar, de, en, es, fr, it, pt, ru, zh } as const;

export type Messages = typeof en;

export function messagesFor(locale: SupportedLocale): Messages {
  return (MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE]) as Messages;
}

/** A `meta` string for a locale, falling back to English if it is missing. */
export function metaString(locale: SupportedLocale, key: keyof Messages["meta"]): string {
  const m = messagesFor(locale).meta as Record<string, string> | undefined;
  const hit = m?.[key as string];
  if (typeof hit === "string" && hit.length > 0) return hit;
  return (MESSAGES[DEFAULT_LOCALE].meta as Record<string, string>)[key as string];
}

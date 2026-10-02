/**
 * What a text message says.
 *
 * Separate from the in-app copy in events.ts for a reason that is about money.
 * An SMS is billed per 160-character segment, and the in-app copy is written
 * for a screen: it carries a title, it uses em dashes and arrows, and a route
 * can be a hundred characters of street address. Sent as a text that is three
 * segments and, because of the dashes, billed as UCS-2 at 70 characters each.
 *
 * So these are written to be short, and the pieces that can run long are
 * clamped before they are placed in the sentence rather than after, so the
 * message is never cut off mid-word at the end.
 */

import { render, type Locale, type NotificationEvent } from "./events";
import { toGsmSafe } from "@/lib/sms";

/** The events that are worth a text. Everything else stays in-app, email or push. */
export type SmsEvent = "BOOKING_CONFIRMED" | "PICKUP_REMINDER" | "DRIVER_ASSIGNED" | "FLIGHT_DELAYED";

export const SMS_EVENTS: readonly SmsEvent[] = [
  "BOOKING_CONFIRMED",
  "PICKUP_REMINDER",
  "DRIVER_ASSIGNED",
  "FLIGHT_DELAYED",
];

export function isSmsEvent(event: NotificationEvent): event is SmsEvent {
  return (SMS_EVENTS as readonly string[]).includes(event);
}

const COPY: Record<SmsEvent, Record<Locale, string>> = {
  BOOKING_CONFIRMED: {
    en: "Elite BCN: transfer {{code}} confirmed for {{when}}. {{route}}",
    es: "Elite BCN: traslado {{code}} confirmado para {{when}}. {{route}}",
    fr: "Elite BCN : transfert {{code}} confirmé pour le {{when}}. {{route}}",
    de: "Elite BCN: Transfer {{code}} am {{when}} bestätigt. {{route}}",
  },
  PICKUP_REMINDER: {
    en: "Elite BCN: reminder, pickup {{when}}. {{route}} Ref {{code}}.",
    es: "Elite BCN: recordatorio, recogida {{when}}. {{route}} Ref {{code}}.",
    fr: "Elite BCN : rappel, prise en charge {{when}}. {{route}} Réf {{code}}.",
    de: "Elite BCN: Erinnerung, Abholung {{when}}. {{route}} Ref {{code}}.",
  },
  DRIVER_ASSIGNED: {
    en: "Elite BCN: {{driver}} will collect you {{when}}. Ref {{code}}.",
    es: "Elite BCN: {{driver}} te recogerá el {{when}}. Ref {{code}}.",
    fr: "Elite BCN : {{driver}} viendra vous chercher le {{when}}. Réf {{code}}.",
    de: "Elite BCN: {{driver}} holt Sie am {{when}} ab. Ref {{code}}.",
  },
  FLIGHT_DELAYED: {
    en: "Elite BCN: flight {{flight}} is delayed, new landing {{when}}. Your driver is updated, nothing to do. Ref {{code}}.",
    es: "Elite BCN: el vuelo {{flight}} va con retraso, nueva llegada {{when}}. Tu conductor está avisado. Ref {{code}}.",
    fr: "Elite BCN : le vol {{flight}} est retardé, nouvelle arrivée {{when}}. Votre chauffeur est prévenu. Réf {{code}}.",
    de: "Elite BCN: Flug {{flight}} ist verspätet, neue Landung {{when}}. Ihr Fahrer ist informiert. Ref {{code}}.",
  },
};

const TRACK_LABEL: Record<Locale, string> = {
  en: "Track",
  es: "Seguimiento",
  fr: "Suivi",
  de: "Verfolgen",
};

/** Cut at a word, with an ellipsis, so a long address never eats the message. */
function clamp(value: unknown, max: number): string {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 3);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), Math.floor(max / 2)))}...`;
}

/**
 * The text for an event, or null when this event does not send one.
 *
 * The tracking link goes last, and only when there is one. Putting it last
 * means a message that has to be shortened loses a street name and not the
 * link; leaving it out entirely when absent avoids a dangling "Track:".
 */
export function smsTextFor(
  event: NotificationEvent,
  locale: Locale,
  vars: Record<string, string | number> = {},
): string | null {
  if (!isSmsEvent(event)) return null;

  const safe: Record<string, string | number> = {
    ...vars,
    route: clamp(vars.route, 70),
    driver: clamp(vars.driver, 30),
    when: clamp(vars.when, 30),
  };

  const body = render(COPY[event][locale] ?? COPY[event].en, safe);
  const link = vars.link ? String(vars.link) : "";
  const text = link ? `${body} ${TRACK_LABEL[locale] ?? TRACK_LABEL.en}: ${link}` : body;
  return toGsmSafe(text).trim();
}

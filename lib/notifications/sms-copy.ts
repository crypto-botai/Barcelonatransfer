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
import { COMPANY } from "@/lib/company-facts";

/**
 * The two messages a customer who paid for text alerts gets, and no others.
 *
 * Not the reminder and not the flight notice: those go by email and in the
 * account, and a text for every status change is what the customer said they
 * did not want when they chose this.
 */
export type SmsEvent = "BOOKING_CONFIRMED" | "DRIVER_ASSIGNED";

export const SMS_EVENTS: readonly SmsEvent[] = ["BOOKING_CONFIRMED", "DRIVER_ASSIGNED"];

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
  DRIVER_ASSIGNED: {
    en: "Elite BCN: {{driver}} will collect you {{when}}. Ref {{code}}.",
    es: "Elite BCN: {{driver}} te recogerá el {{when}}. Ref {{code}}.",
    fr: "Elite BCN : {{driver}} viendra vous chercher le {{when}}. Réf {{code}}.",
    de: "Elite BCN: {{driver}} holt Sie am {{when}} ab. Ref {{code}}.",
  },
};

/**
 * Said at the end of every text.
 *
 * The text comes from a number nobody reads, so a customer who replies to it
 * is talking to no one at the moment they most want an answer. This sends them
 * to the line that is staffed, and the number is written without spaces so a
 * phone makes it tappable.
 */
export const NO_REPLY: Record<Locale, string> = {
  en: `Do not reply to this message. To talk to us, call, text or WhatsApp ${COMPANY.phone}`,
  es: `No respondas a este mensaje. Para hablar con nosotros, llama, escribe o usa WhatsApp ${COMPANY.phone}`,
  fr: `Ne repondez pas a ce message. Pour nous parler, appelez, ecrivez ou utilisez WhatsApp ${COMPANY.phone}`,
  de: `Bitte nicht auf diese Nachricht antworten. Anruf, SMS oder WhatsApp: ${COMPANY.phone}`,
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
  const tracked = link ? `${body} ${TRACK_LABEL[locale] ?? TRACK_LABEL.en}: ${link}` : body;
  // The notice is always last and never clamped: it is the part that says where
  // to get an answer, and the address above it is what gives way when space is short.
  return toGsmSafe(`${tracked} ${NO_REPLY[locale] ?? NO_REPLY.en}`).trim();
}

/**
 * The answer sent for the office when a customer writes and nobody replies.
 *
 * This is not an AI model. Meta's own assistant is not available on a number
 * run through the business API, and a language model answering customers about
 * prices and payments is a way to promise things the company has not offered.
 * This does something narrower that cannot go wrong that way: it recognises a
 * handful of common questions and answers each from facts the site already
 * holds (the live price table, the payment terms, the booking link), and for
 * anything else it says a person will reply.
 *
 * Every answer ends by saying a person will follow up, so a customer is never
 * left thinking a question has been settled by a robot when it has not.
 *
 * Pure: the services and prices are passed in.
 */

import { BASE_URL } from "@/lib/seo";
import type { ResolvedService } from "@/lib/whatsapp-services";

const FOLLOW_UP = "A member of our team will also reply to you personally.";

export type Intent = "greeting" | "price" | "book" | "payment" | "flight" | "cancel" | "meeting" | "thanks";

const has = (t: string, re: RegExp) => re.test(t);

/** What the message is asking, or null when it is not one of the common questions. */
export function detectIntent(text: string): Intent | null {
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  if (!t) return null;

  // Order matters: "how much to book" is a price question, "cancel" outranks "book".
  if (has(t, /\b(cancel|cancela|cancelar|refund|reembolso|annul|stornier|erstatt)/)) return "cancel";
  if (has(t, /\b(how much|price|prices|cost|fare|quote|cuanto|precio|tarifa|cuesta|combien|prix|tarif|preis|kosten|wie viel)\b/)) return "price";
  if (has(t, /\b(pay|payment|paying|cards?|cash|deposit|30 ?%|invoice|pago|pagar|efectivo|tarjeta|factura|paiement|especes|zahlung|bar)\b/)) return "payment";
  if (has(t, /\b(flight|vuelo|vol|flug|delay|delayed|late|landing|lands|retras|retard|verspat)/)) return "flight";
  if (has(t, /\b(where|meet|meeting|arrivals|terminal|pickup point|donde|encuentro|punto de|retrouv|treffpunkt)/)) return "meeting";
  if (has(t, /\b(book|booking|reserve|reservation|reserva|reservar|reserver|buchen|buchung)\b/)) return "book";
  if (has(t, /\b(thanks|thank you|gracias|merci|danke|cheers)\b/)) return "thanks";
  if (t.length <= 24 && has(t, /^(hi|hello|hey|hola|buenas|buenos dias|buenas tardes|bonjour|salut|hallo|good (morning|afternoon|evening))\b/)) return "greeting";
  return null;
}

/** The service a message is about, by the place it names. */
export function mentionedService(text: string, services: ResolvedService[]): ResolvedService | null {
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const find = (id: string) => services.find((s) => s.id === id && s.enabled) ?? null;
  if (/\b(tossa)\b/.test(t)) return find("tossa-de-mar");
  if (/\b(girona|gerona)\b/.test(t)) return find("girona");
  if (/\b(lloret)\b/.test(t)) return find("lloret-de-mar");
  if (/\b(sitges)\b/.test(t)) return find("sitges");
  if (/\b(hour|hourly|per hour|by the hour|hora|horas|heure|stunde)\b/.test(t)) return find("per-hour");
  if (/\b(to|from|a|al|desde)\b.*\b(airport|aeropuerto|aeroport|flughafen)\b|\b(airport|aeropuerto)\b/.test(t)) {
    // "to the airport" and "from the airport" are different services.
    return /\b(to|a|al|hacia)\s+(the\s+)?(airport|aeropuerto|aeroport|flughafen)\b/.test(t) ? find("city-to-airport") : find("airport-to-city");
  }
  return null;
}

const money = (s: ResolvedService) => (s.fromPrice ? `from €${Number.isInteger(s.fromPrice) ? s.fromPrice : s.fromPrice.toFixed(2)}${s.unit === "hour" ? " per hour" : ""}` : null);

/** The reply, or null when the message is not one the assistant knows. Never longer than a short paragraph. */
export function assistantReply(text: string, services: ResolvedService[]): string | null {
  const intent = detectIntent(text);
  if (!intent) return null;
  const book = `${BASE_URL}/book`;

  switch (intent) {
    case "greeting":
      return `Hello, and thank you for contacting Elite BCN Transfer. How can we help with your transfer? ${FOLLOW_UP}`;
    case "thanks":
      return "You are very welcome. Is there anything else we can help you with?";
    case "price": {
      const s = mentionedService(text, services);
      const p = s && money(s);
      if (s && p) {
        return `${s.title}: ${p}, fixed price with no surge pricing. For the exact price for your trip, and to book: ${s.url}. ${FOLLOW_UP}`;
      }
      return `Our prices are fixed, with no surge pricing. Tell us where you are going from and to, or see the exact price and book here: ${book}. ${FOLLOW_UP}`;
    }
    case "book":
      return `You can book online in about a minute, with a fixed price: ${book}. ${FOLLOW_UP}`;
    case "payment":
      return `At checkout you can pay in full, or pay 30% now and the rest to your chauffeur at the end of the journey, in cash or by card. ${FOLLOW_UP}`;
    case "flight":
      return `Please send us your flight number and the date. We use it to keep an eye on your arrival time. ${FOLLOW_UP}`;
    case "cancel":
      return `You can read our cancellation and refund terms here: ${BASE_URL}/refund-policy. Please tell us your booking reference. ${FOLLOW_UP}`;
    case "meeting":
      return `Your driver will meet you at your pickup place, and we send you their name and number before the transfer. If you cannot find each other, message us here. ${FOLLOW_UP}`;
  }
}

/** What to say: the assistant's answer when it has one and is switched on, otherwise the plain holding message. */
export function unansweredReply(opts: { text: string; type: string; assistant: boolean; holding: string; services: ResolvedService[] }): { text: string; kind: "assistant" | "holding" } {
  // A photo, a voice note or a location carries no question to read.
  if (opts.assistant && (opts.type === "text" || opts.type === "interactive" || opts.type === "button")) {
    const answer = assistantReply(opts.text, opts.services);
    if (answer) return { text: answer, kind: "assistant" };
  }
  return { text: opts.holding, kind: "holding" };
}

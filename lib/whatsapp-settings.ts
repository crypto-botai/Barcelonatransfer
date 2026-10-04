/**
 * What the office can change about WhatsApp without a developer: saved
 * replies, the services menu customers are offered, the automatic replies, and
 * whether each message also emails the owner.
 *
 * Pure: no database and no network, so the rules are testable. The settings
 * page saves whatever the browser sends, and the browser cannot be trusted, so
 * everything coming in passes through sanitizeSettings, which clamps lengths and
 * counts to what WhatsApp itself will accept. A menu row that is a character
 * too long is refused by Meta with an error that does not say which row, so the
 * limits are applied here, where they can be shown to the person editing.
 */

import { DEFAULT_AUTO_MESSAGES, type AutoMessageSettings } from "@/lib/whatsapp-policy";

export interface QuickReply {
  id: string;
  /** Typed after a slash in the reply box: "/price". */
  shortcut: string;
  text: string;
}

export interface ServiceItem {
  id: string;
  /** Row title in the WhatsApp menu. WhatsApp allows 24 characters. */
  title: string;
  /** Row description. WhatsApp allows 72 characters. */
  description: string;
  /** Price-table destination, or "hourly" for by-the-hour hire. Null means no automatic price. */
  zone: string | null;
  /** A price typed by hand, used instead of the table. Null means use the table. */
  manualFrom: number | null;
  /** Page on the website the Book button opens. Always a path on our own site. */
  path: string;
  /** Picture, as a path on our own site. */
  image: string;
  enabled: boolean;
}

export interface AutoReply {
  enabled: boolean;
  text: string;
}

export interface AwayHours {
  /** Days the office is open, 0 = Sunday. */
  days: number[];
  /** "HH:MM" in Barcelona time. */
  from: string;
  to: string;
}

export interface WhatsAppSettings {
  quickReplies: QuickReply[];
  services: ServiceItem[];
  /** Sent to a customer who writes after a quiet spell. */
  welcome: AutoReply;
  /** Sent when they write outside opening hours. */
  away: AutoReply & { hours: AwayHours };
  /** Also email the owner for every new customer message. */
  emailAlerts: boolean;
  /** Which messages the site sends to customers and drivers by itself. */
  autoMessages: AutoMessageSettings;
  /** What happens when a customer writes and nobody answers. */
  unanswered: {
    enabled: boolean;
    /** How long to wait for a person before answering for them. */
    minutes: number;
    /** Said when the question is not one the assistant can answer. */
    text: string;
    /** Answer the common questions (price, booking, payment, flights) from the live price table. */
    assistant: boolean;
  };
}

export const LIMITS = {
  quickReplies: 30,
  services: 10, // a WhatsApp list menu holds ten rows in all
  title: 24,
  description: 72,
  replyText: 1000,
  autoText: 1000,
  /** Shortest and longest wait before answering for the office. */
  minMinutes: 2,
  maxMinutes: 720,
} as const;

export const DEFAULT_SERVICES: ServiceItem[] = [
  { id: "airport-to-city", title: "Airport to City", description: "", zone: "barcelona_city", manualFrom: null, path: "/transfers/barcelona-city-centre", image: "/whatsapp/airport-to-city.jpg", enabled: true },
  { id: "city-to-airport", title: "City to Airport", description: "", zone: "barcelona_city", manualFrom: null, path: "/airport-transfers", image: "/whatsapp/city-to-airport.jpg", enabled: true },
  { id: "per-hour", title: "Chauffeur per hour", description: "", zone: "hourly", manualFrom: null, path: "/hourly", image: "/whatsapp/per-hour.jpg", enabled: true },
  { id: "tossa-de-mar", title: "Tossa de Mar", description: "", zone: "tossa", manualFrom: null, path: "/transfers/tossa-de-mar", image: "/whatsapp/tossa-de-mar.jpg", enabled: true },
  { id: "girona", title: "Girona", description: "", zone: "girona_city", manualFrom: null, path: "/transfers/girona", image: "/whatsapp/girona.jpg", enabled: true },
  { id: "lloret-de-mar", title: "Lloret de Mar", description: "", zone: "lloret", manualFrom: null, path: "/transfers/lloret-de-mar", image: "/whatsapp/lloret-de-mar.jpg", enabled: true },
  { id: "sitges", title: "Sitges", description: "", zone: "sitges", manualFrom: null, path: "/transfers/sitges", image: "/whatsapp/sitges.jpg", enabled: true },
];

export const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  { id: "hello", shortcut: "hello", text: "Hello, thank you for contacting Elite BCN Transfer. How can we help with your transfer?" },
  { id: "details", shortcut: "details", text: "To give you an exact price, could you tell us: pickup place, drop-off place, date and time, and the number of passengers?" },
  { id: "price", shortcut: "price", text: "Our prices are fixed, with no surge pricing. You can see the exact price for your trip, and book, at https://www.elitebcn.info/book" },
  { id: "book", shortcut: "book", text: "You can book online in one minute at https://www.elitebcn.info/book. Fixed price, no surge, pay securely by card." },
  { id: "payment", shortcut: "payment", text: "At checkout you can pay in full, or pay 30% now and the rest to your chauffeur at the end of the journey, in cash or by card." },
  { id: "cash", shortcut: "cash", text: "Yes, you can pay the balance to your chauffeur at the end of the journey, in cash or by card. Your booking is held once the first payment is made." },
  { id: "link", shortcut: "link", text: "Here is your secure payment link. Your booking is confirmed as soon as the payment goes through." },
  { id: "flight", shortcut: "flight", text: "Could you send us your flight number? We use it to keep an eye on your arrival time." },
  { id: "pickup", shortcut: "pickup", text: "We will send you your driver's name and number before you land. A name sign in the arrivals hall (meet & greet) can be added as an extra when you book." },
  { id: "location", shortcut: "location", text: "At Barcelona Airport your driver will meet you in the arrivals hall. If you cannot find each other, message us here and we will connect you straight away." },
  { id: "driver", shortcut: "driver", text: "Your driver's name and phone number are in your confirmation. He will contact you shortly before pickup." },
  { id: "delay", shortcut: "delay", text: "Thank you for letting us know. We have noted the change and your driver has been told, so there is nothing else you need to do." },
  { id: "wait", shortcut: "wait", text: "Your driver will wait for you. If you are going to be much later than planned, please message us here and we will arrange it." },
  { id: "child", shortcut: "child", text: "We can provide a child or baby seat for your transfer. Please tell us the age of each child and we will add it to your booking." },
  { id: "luggage", shortcut: "luggage", text: "How many suitcases and bags will you have? We will make sure the vehicle fits everyone and everything comfortably." },
  { id: "invoice", shortcut: "invoice", text: "We can issue an invoice for your company. Please send us the company name, address and VAT number." },
  { id: "change", shortcut: "change", text: "Of course, we can change your booking. Please tell us the new date, time or address and we will confirm it here." },
  { id: "cancel", shortcut: "cancel", text: "You can read our cancellation and refund terms here: https://www.elitebcn.info/refund-policy. If you need to cancel, tell us your booking reference." },
  { id: "lost", shortcut: "lost", text: "We are sorry about that. Please tell us your booking reference and what was left behind, and we will contact your driver straight away." },
  { id: "review", shortcut: "review", text: "We hope you enjoyed your transfer. If you have a minute, a review helps us a great deal. Thank you for travelling with Elite BCN." },
  { id: "thanks", shortcut: "thanks", text: "Thank you for choosing Elite BCN Transfer. Have a lovely stay in Barcelona!" },
];

export const DEFAULT_SETTINGS: WhatsAppSettings = {
  quickReplies: DEFAULT_QUICK_REPLIES,
  services: DEFAULT_SERVICES,
  welcome: {
    enabled: false,
    text: "Hello, and thank you for contacting Elite BCN Transfer. We have your message and will answer shortly. To book now: https://www.elitebcn.info/book",
  },
  away: {
    enabled: false,
    text: "Thank you for your message. The office is closed at the moment, and we will reply as soon as we are back. To book any time: https://www.elitebcn.info/book",
    hours: { days: [0, 1, 2, 3, 4, 5, 6], from: "08:00", to: "22:00" },
  },
  emailAlerts: true,
  autoMessages: DEFAULT_AUTO_MESSAGES,
  unanswered: {
    enabled: false,
    minutes: 10,
    text: "Thank you for your message. We are away from the phone for a moment and will reply as soon as we can. To see prices and book now: https://www.elitebcn.info/book",
    assistant: true,
  },
};

// ─── Cleaning what the browser sends ─────────────────────────────────────────

const str = (v: unknown, max: number): string => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

/** A short id safe to use in a URL and in a WhatsApp row id. */
const slug = (v: unknown, fallback: string): string =>
  String(v ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || fallback;

/** Only paths on our own site: never an absolute address, which would let a typo send customers elsewhere. */
export function sitePath(v: unknown, fallback: string): string {
  const s = String(v ?? "").trim();
  return /^\/(?!\/)[A-Za-z0-9\-_/.]*$/.test(s) ? s.slice(0, 200) : fallback;
}

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const hhmm = (v: unknown, fallback: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : fallback);

function uniqueIds<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.map((it) => {
    let id = it.id;
    for (let n = 2; seen.has(id); n++) id = `${it.id}-${n}`;
    seen.add(id);
    return { ...it, id };
  });
}

export function sanitizeSettings(input: unknown): WhatsAppSettings {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const d = DEFAULT_SETTINGS;

  const quickReplies = Array.isArray(raw.quickReplies)
    ? uniqueIds(
        raw.quickReplies
          .map((q: any, i: number) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            id: slug(q?.id ?? q?.shortcut, `reply-${i + 1}`),
            shortcut: slug(q?.shortcut, "").slice(0, 20),
            text: str(q?.text, LIMITS.replyText),
          }))
          .filter((q: QuickReply) => q.shortcut && q.text),
      ).slice(0, LIMITS.quickReplies)
    : d.quickReplies;

  const services = Array.isArray(raw.services)
    ? uniqueIds(
        raw.services
          .map((s: any, i: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            const base = DEFAULT_SERVICES.find((x) => x.id === slug(s?.id, ""));
            const from = Number(s?.manualFrom);
            return {
              id: slug(s?.id ?? s?.title, `service-${i + 1}`),
              title: str(s?.title, LIMITS.title),
              description: str(s?.description, LIMITS.description),
              zone: s?.zone ? slug(s.zone, "").replace(/-/g, "_") || null : null,
              manualFrom: Number.isFinite(from) && from > 0 && from < 10000 ? Math.round(from * 100) / 100 : null,
              path: sitePath(s?.path, base?.path ?? "/book"),
              image: sitePath(s?.image, base?.image ?? "/whatsapp/airport-to-city.jpg"),
              enabled: s?.enabled !== false,
            } satisfies ServiceItem;
          })
          .filter((s: ServiceItem) => s.title),
      ).slice(0, LIMITS.services)
    : d.services;

  const auto = (v: any, fallback: AutoReply): AutoReply => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    enabled: v?.enabled === true,
    text: str(v?.text, LIMITS.autoText) || fallback.text,
  });
  const days = Array.isArray(raw.away?.hours?.days)
    ? [...new Set<number>(raw.away.hours.days.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6))].sort()
    : d.away.hours.days;

  return {
    quickReplies,
    services,
    welcome: auto(raw.welcome, d.welcome),
    away: {
      ...auto(raw.away, d.away),
      hours: { days, from: hhmm(raw.away?.hours?.from, d.away.hours.from), to: hhmm(raw.away?.hours?.to, d.away.hours.to) },
    },
    emailAlerts: raw.emailAlerts !== false,
    autoMessages: {
      cashBookings: raw.autoMessages?.cashBookings === true,
      headsUp: raw.autoMessages?.headsUp !== false,
      flightAlerts: raw.autoMessages?.flightAlerts !== false,
      driverFlightAlerts: raw.autoMessages?.driverFlightAlerts !== false,
      driverJobAlerts: raw.autoMessages?.driverJobAlerts !== false,
      completionNote: raw.autoMessages?.completionNote !== false,
      cancellationNotice: raw.autoMessages?.cancellationNotice !== false,
      officeAlerts: raw.autoMessages?.officeAlerts !== false,
    },
    unanswered: {
      enabled: raw.unanswered?.enabled === true,
      minutes: clampInt(raw.unanswered?.minutes, LIMITS.minMinutes, LIMITS.maxMinutes, d.unanswered.minutes),
      text: str(raw.unanswered?.text, LIMITS.autoText) || d.unanswered.text,
      assistant: raw.unanswered?.assistant !== false,
    },
  };
}

// ─── Automatic replies ───────────────────────────────────────────────────────

/** Barcelona's clock, whatever the server's is. */
function madridParts(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")) };
}

const toMinutes = (hhmmValue: string) => Number(hhmmValue.slice(0, 2)) * 60 + Number(hhmmValue.slice(3));

/**
 * Is the office open at this moment, by the hours in the settings.
 * A closing time at or before the opening time means the shift runs past midnight.
 */
export function isOpenNow(hours: AwayHours, now: Date = new Date()): boolean {
  const { day, minutes } = madridParts(now);
  const from = toMinutes(hours.from);
  const to = toMinutes(hours.to);
  if (from < to) return hours.days.includes(day) && minutes >= from && minutes < to;
  if (from === to) return hours.days.includes(day); // same time twice: the whole day
  // Overnight: the part after opening belongs to today, the part before closing to yesterday's shift.
  const yesterday = (day + 6) % 7;
  return (hours.days.includes(day) && minutes >= from) || (hours.days.includes(yesterday) && minutes < to);
}

export const AUTO_REPLY_COOLDOWN_MS = 12 * 3600_000;

/**
 * Which automatic reply, if any, a new customer message should get.
 *
 * At most one, and never twice inside twelve hours: an away message sent to
 * every line of a five-message burst would be worse than none. The office
 * writing to the customer counts as a reply, so a conversation someone is
 * already having is left alone.
 */
export function pickAutoReply(args: {
  settings: WhatsAppSettings;
  now: Date;
  /** When we last sent this customer anything, a person or a robot. */
  lastOutboundAt: Date | null;
  /** When we last sent this customer an automatic reply. */
  lastAutoAt: Date | null;
}): { kind: "away" | "welcome"; text: string } | null {
  const { settings, now, lastOutboundAt, lastAutoAt } = args;
  const since = (d: Date | null) => (d ? now.getTime() - d.getTime() : Infinity);

  if (settings.away.enabled && !isOpenNow(settings.away.hours, now) && since(lastAutoAt) > AUTO_REPLY_COOLDOWN_MS) {
    return { kind: "away", text: settings.away.text };
  }
  if (settings.welcome.enabled && since(lastOutboundAt) > AUTO_REPLY_COOLDOWN_MS) {
    return { kind: "welcome", text: settings.welcome.text };
  }
  return null;
}

/**
 * The services the business offers on WhatsApp, with live prices.
 *
 * One list feeds three things, so they cannot disagree: the menu the office
 * sends a customer from the inbox, the "Book now" message sent when they pick a
 * row, and the product feed WhatsApp's catalogue reads. Prices are never typed
 * in here. They come from the same table the website quotes from (including the
 * admin's published overrides), so a price changed in the admin changes
 * everywhere at once. A price typed by hand in the settings is the exception,
 * and is used only when the office chooses to.
 */

import { BASE_URL } from "@/lib/seo";
import { getDestinationPrices } from "@/lib/destination-pricing";
import { HOURLY_RATES, MIN_HOURLY_HOURS } from "@/lib/pricing";
import { LIMITS, type ServiceItem } from "@/lib/whatsapp-settings";

export interface ResolvedService extends ServiceItem {
  /** The cheapest fare for this service, or null when it is priced by distance at booking. */
  fromPrice: number | null;
  unit: "trip" | "hour";
  /** The description shown: the one written in the settings, or one built from the price. */
  line: string;
  /** Absolute address of the page the Book button opens. */
  url: string;
  /** Absolute address of the picture. */
  imageUrl: string;
}

/** Some destinations are filed under more than one table name. First one that has a price wins. */
const ZONE_FALLBACKS: Record<string, string[]> = {
  girona_city: ["girona_city", "girona_airport"],
};

export type PriceLookup = (zone: string) => Promise<number | null>;

const tablePrice: PriceLookup = async (zone) => {
  if (zone === "hourly") return HOURLY_RATES.ECONOMY;
  for (const z of ZONE_FALLBACKS[zone] ?? [zone]) {
    // "Airport to X" is what these are called, so the airport fare is the one to quote.
    const p = (await getDestinationPrices(z, "airport").catch(() => null)) ?? (await getDestinationPrices(z).catch(() => null));
    if (p && p.economy > 0) return p.economy;
  }
  return null;
};

const euro = (n: number) => `€${Number.isInteger(n) ? n : n.toFixed(2)}`;

export async function resolveServices(items: ServiceItem[], lookup: PriceLookup = tablePrice): Promise<ResolvedService[]> {
  return Promise.all(
    items.map(async (s) => {
      const hourly = s.zone === "hourly";
      const auto = s.manualFrom ?? (s.zone ? await lookup(s.zone).catch(() => null) : null);
      const fromPrice = auto && auto > 0 ? auto : null;
      const built = fromPrice
        ? hourly
          ? `From ${euro(fromPrice)}/hour · ${MIN_HOURLY_HOURS.ECONOMY}h minimum`
          : `From ${euro(fromPrice)} · fixed price, no surge`
        : "Fixed price quoted when you book";
      return {
        ...s,
        fromPrice,
        unit: hourly ? ("hour" as const) : ("trip" as const),
        line: (s.description || built).slice(0, LIMITS.description),
        url: `${BASE_URL}${s.path}`,
        imageUrl: `${BASE_URL}${s.image}`,
      };
    }),
  );
}

// ─── What gets sent ──────────────────────────────────────────────────────────

/** Row ids carry a prefix so a pick from this menu is told apart from any other reply. */
export const CHOICE_PREFIX = "svc:";

export function parseServiceChoice(choiceId: string | null | undefined): string | null {
  return choiceId && choiceId.startsWith(CHOICE_PREFIX) ? choiceId.slice(CHOICE_PREFIX.length) : null;
}

/** The list menu. Null when there is nothing enabled to offer. */
export function buildServicesMenu(services: ResolvedService[]): Record<string, unknown> | null {
  const rows = services.filter((s) => s.enabled).slice(0, LIMITS.services);
  if (rows.length === 0) return null;
  return {
    type: "list",
    header: { type: "text", text: "Elite BCN Transfer" },
    body: { text: "Private transfers in Barcelona and the Costa Brava. Choose a service to see the price and book." },
    footer: { text: "Fixed prices · No surge pricing" },
    action: {
      button: "View services",
      sections: [
        {
          title: "Our services",
          rows: rows.map((s) => ({ id: `${CHOICE_PREFIX}${s.id}`, title: s.title.slice(0, LIMITS.title), description: s.line })),
        },
      ],
    },
  };
}

/** What a customer gets after choosing a row: the picture, the price and a button to book. */
export function buildServiceLink(s: ResolvedService): Record<string, unknown> {
  const price = s.fromPrice
    ? s.unit === "hour"
      ? `from ${euro(s.fromPrice)} per hour`
      : `from ${euro(s.fromPrice)}`
    : "priced when you book";
  return {
    type: "cta_url",
    header: { type: "image", image: { link: s.imageUrl } },
    body: { text: `${s.title}: ${price}.\nFixed price, no surge pricing. Tap to see the exact price for your trip and book in a minute.` },
    footer: { text: "Elite BCN Transfer" },
    action: { name: "cta_url", parameters: { display_text: "Book now", url: s.url } },
  };
}

// ─── The catalogue feed ──────────────────────────────────────────────────────

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * The product feed WhatsApp's catalogue imports on a schedule.
 *
 * A service with no price is left out: a catalogue item needs one, and a made-up
 * figure would be quoted to customers. By-the-hour hire is listed at its hourly
 * rate, which the title says.
 */
export function catalogCsv(services: ResolvedService[]): string {
  const head = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand"];
  const lines = [head.join(",")];
  for (const s of services) {
    if (!s.enabled || !s.fromPrice) continue;
    // "Girona" alone is a weak product name; "Airport to City" and "Chauffeur per hour" already read as products.
    const title = /airport|city|chauffeur|hour|transfer/i.test(s.title) ? s.title : `Airport transfer to ${s.title}`;
    const description = `${s.line}. Private chauffeur service in Barcelona.`;
    lines.push(
      [s.id, title, description, "in stock", "new", `${s.fromPrice.toFixed(2)} EUR`, s.url, s.imageUrl, "Elite BCN Transfer"].map(csvCell).join(","),
    );
  }
  return lines.join("\n") + "\n";
}

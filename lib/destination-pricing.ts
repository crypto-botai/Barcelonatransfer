import { getPublicRoutes } from "@/lib/pricing-service";
import { detectZoneFromCoords, distanceFare } from "@/lib/pricing";

/**
 * Prices for a destination page, read from the same authority that quotes a
 * booking.
 *
 * Every destination page used to carry its own hand-typed figures. They drifted:
 * the index advertised Sitges "from €65" while the booking engine charged €80,
 * and Andorra was advertised at €220 against a real fare of €300. The customer
 * saw one number and was billed another.
 *
 * Reading through getPublicRoutes() means these surfaces resolve exactly as a
 * quote does — the database first, the code table behind it — and an admin
 * price edit reaches them, because that call is cached under the "pricing" tag
 * the admin save already flushes.
 */

export interface DestinationPrices {
  economy:  number;
  business: number;
  minivan:  number;
  vclass:   number;
  minibus:  number;
  /** Which origin this came from, so a page can say so honestly. */
  fromKey:  string;
}

/** Origins a destination page quotes "from". */
const ORIGINS = ["airport", "barcelona_city"] as const;

/**
 * The cheapest published fare to `zoneKey` from Barcelona or its airport.
 *
 * Cheapest, because the pages present the figure as "from €X" — quoting the
 * dearer of two origins under that wording would be its own kind of wrong.
 *
 * @returns null when the destination has no row in the price table, which is
 *   the honest answer: those journeys are priced by distance at booking, and a
 *   page must not invent a number for them.
 */
export async function getDestinationPrices(
  zoneKey: string,
  /**
   * Restrict to one origin. Pages headed "Barcelona Airport to X" must quote
   * the airport fare: Girona is €165 from the airport and €140 from the city,
   * and showing the cheaper figure on an airport page understates what the
   * booking charges — the very fault this module exists to remove. Omit to take
   * the cheapest published origin, which is what a plain "from €X" means.
   */
  origin?: (typeof ORIGINS)[number],
): Promise<DestinationPrices | null> {
  const routes = await getPublicRoutes();

  let best: DestinationPrices | null = null;
  for (const r of routes) {
    // The table stores each pair once; either end may be the destination.
    const other =
      r.toKey === zoneKey   ? r.fromKey :
      r.fromKey === zoneKey ? r.toKey   : null;
    if (other === null || !ORIGINS.includes(other as (typeof ORIGINS)[number])) continue;
    if (origin && other !== origin) continue;
    if (r.economy <= 0) continue;

    if (!best || r.economy < best.economy) {
      best = {
        economy:  r.economy,
        business: r.business,
        minivan:  r.minivan,
        vclass:   r.vclass,
        minibus:  r.minibus,
        fromKey:  other,
      };
    }
  }
  return best;
}

/** Convenience for pages that only show a single "from €X" figure. */
export async function getDestinationFromPrice(zoneKey: string): Promise<number | null> {
  return (await getDestinationPrices(zoneKey))?.economy ?? null;
}

/** How a page's price was arrived at, so the page can describe it truthfully. */
export type PriceBasis = "fixed" | "distance";

export interface ResolvedPlacePrices extends DestinationPrices {
  basis: PriceBasis;
}

/**
 * Prices for a place described only by where it is.
 *
 * The programmatic hotel, cruise and event pages carry coordinates rather than
 * a zone name, so they resolve the same way a booking does: coordinates to
 * zone, zone to table price. Previously each page stored its own figure and
 * every one of them was below the fare actually charged — the Barcelona hotel
 * pages advertised €45 against a real €50.
 *
 * Somewhere with no table row is priced by distance, using the identical
 * function the quote engine uses, so the page and the checkout agree there too.
 *
 * @param distanceKm used only when the place has no table row.
 */
export async function getPlacePrices(
  lat: number,
  lng: number,
  distanceKm?: number,
  /** These pages are all headed "Barcelona Airport to …", so they quote that origin. */
  origin: (typeof ORIGINS)[number] = "airport",
): Promise<ResolvedPlacePrices | null> {
  const zone = detectZoneFromCoords(lat, lng);
  if (zone) {
    // Fall back to any origin if this destination is only priced from the other
    // one, rather than dropping to a distance estimate for a route we do price.
    const fixed = (await getDestinationPrices(zone, origin)) ?? (await getDestinationPrices(zone));
    if (fixed) return { ...fixed, basis: "fixed" };
  }

  if (!distanceKm || distanceKm <= 0) return null;
  return {
    economy:  distanceFare(distanceKm, "ECONOMY"),
    business: distanceFare(distanceKm, "BUSINESS"),
    minivan:  distanceFare(distanceKm, "MINIVAN"),
    vclass:   distanceFare(distanceKm, "VCLASS"),
    minibus:  distanceFare(distanceKm, "MINIBUS"),
    fromKey:  "airport",
    basis:    "distance",
  };
}

/**
 * Destination page slug → pricing zone key.
 *
 * The two vocabularies genuinely differ: the URL says "girona", the price table
 * says "girona_airport". Keeping the mapping in one place stops each page
 * inventing its own.
 *
 * A slug absent from here has no table route (Costa Brava and Costa Dorada are
 * regions, not single destinations) and is priced by distance at booking.
 */
export const SLUG_TO_ZONE: Record<string, string> = {
  sitges:          "sitges",
  girona:          "girona_airport",
  tarragona:       "tarragona",
  montserrat:      "montserrat",
  andorra:         "andorra",
  lourdes:         "lourdes",
  "cruise-port":   "cruise",
  "port-aventura": "portaventura",
  "lloret-de-mar": "lloret",
  cadaques:        "cadaques",
  figueres:        "figueres",
  "tossa-de-mar":  "tossa",
  salou:           "salou",
  castelldefels:   "castelldefels",
};

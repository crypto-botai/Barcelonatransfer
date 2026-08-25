import { getPublicRoutes } from "@/lib/pricing-service";
import { detectZoneFromCoords, distanceFare, ROUTES } from "@/lib/pricing";

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
  // Added 26 Aug: four zones that carried a published fare and had no page, so
  // routePageHref() returned null and their /pricing rows linked nowhere.
  "la-roca-village": "la_roca",
  "sants-station":   "sants",
  vilanova:          "vilanova",
  begur:             "begur",
};

/** The five price columns for one route, in display order. */
export interface PriceLadder {
  economy:  number;
  business: number;
  minivan:  number;
  vclass:   number;
  minibus:  number;
}

/**
 * Synchronous ladder for a statically rendered destination page.
 *
 * The destination pages each carried their own hand-typed ladder — five prices
 * per page, plus a figure inside the JSON-LD Offer. They matched the table on
 * the day they were written, which is exactly what made them dangerous: the
 * cruise page advertised a hotel-to-port fare of €35 against a real €60 for
 * however long it took someone to notice, because nothing connected the two.
 *
 * Reading the ladder means a price change in the table reaches the page, the
 * schema and the checkout together, or reaches none of them.
 *
 * Deliberately reads ROUTES rather than the database: these pages are
 * statically rendered, and a synchronous source keeps them so. The database is
 * seeded from the same table and the two are verified identical, so the figures
 * agree; a route repriced in the admin panel updates the booking immediately
 * and these pages at their next build.
 *
 * @param origin which end the page quotes from. Only Girona (€165 airport,
 *   €140 city) and the cruise port (€50 / €60) differ, but where they differ it
 *   is the whole point of the parameter.
 */
export function ladderFor(
  zoneKey: string,
  origin: "airport" | "barcelona_city" = "airport",
): PriceLadder | null {
  const r = ROUTES.find(
    (x) => (x.from === origin && x.to === zoneKey) || (x.from === zoneKey && x.to === origin),
  );
  if (!r) return null;
  return {
    economy:  r.economy,
    business: r.business,
    minivan:  r.minivan,
    vclass:   r.vclass,
    minibus:  r.minibus,
  };
}

/**
 * Cheapest published fare across a group of destinations.
 *
 * The two regional pages — Costa Brava and Costa Dorada — cover a stretch of
 * coast rather than one place, so neither has a route of its own in the table
 * and both advertised a "from" figure that nothing produced. Costa Brava said
 * €90 while the cheapest destination it names, Blanes, costs €135: a €45
 * understatement of the kind this module exists to stop.
 *
 * @param zoneKeys the destinations the page actually names. Deriving from that
 *   list keeps the headline honest as prices move, and keeps it tied to what
 *   the page claims to cover rather than to the cheapest route on the coast.
 */
export function cheapestOf(
  zoneKeys: string[],
  origin: "airport" | "barcelona_city" = "airport",
): number | null {
  const fares = zoneKeys
    .map((z) => ladderFor(z, origin)?.economy)
    .filter((n): n is number => typeof n === "number" && n > 0);
  return fares.length ? Math.min(...fares) : null;
}

/**
 * Pricing zone → the destination page that covers it.
 *
 * Inverts SLUG_TO_ZONE and adds the three zones whose page slug does not follow
 * from the zone name. Zones absent here have no page: the price row for them
 * stays unlinked rather than pointing somewhere that does not exist.
 */
const ZONE_TO_PAGE: Record<string, string> = {
  ...Object.fromEntries(Object.entries(SLUG_TO_ZONE).map(([slug, zone]) => [zone, slug])),
  barcelona_city: "barcelona-city-centre",
  girona_city:    "girona",
  mataro:         "mataro-transfer",
};

/**
 * The destination page for a priced route, or null when none exists.
 *
 * The price table lists 73 routes and linked none of them: /pricing had exactly
 * one outbound in-content link, to /book. A reader comparing fares is the
 * reader most likely to want the route detail, and those route pages were among
 * the least supported on the site.
 *
 * Routes are bidirectional, so either end may be the destination. The "to" end
 * is tried first, which puts the airport-origin rows on the place being
 * travelled to.
 */
export function routePageHref(fromKey: string, toKey: string): string | null {
  // Only the destination end. There used to be a `?? ZONE_TO_PAGE[fromKey]`
  // fallback here, from when barcelona_city had no page of its own and the
  // origin was the only end that could resolve. Once /transfers/barcelona-city-centre
  // was published, that fallback started firing on every route whose
  // destination has no page — and sending it to the origin instead.
  //
  // The result was live on two hubs and in the price table: a link reading
  // "Calella" pointing at /transfers/barcelona-city-centre, and another reading
  // "Cubelles" pointing at the same place. That is worse than no link. It tells
  // a reader the page is about their town when it is not, and it tells Google
  // that /transfers/barcelona-city-centre is about Calella.
  //
  // A destination with no page is now simply not linked, which is what the
  // comment above ZONE_TO_PAGE always said should happen.
  const page = ZONE_TO_PAGE[toKey];
  return page ? `/transfers/${page}` : null;
}

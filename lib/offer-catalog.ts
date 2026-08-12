import { ladderFor } from "@/lib/destination-pricing";
import { HOURLY_RATES, MIN_HOURLY_HOURS } from "@/lib/pricing";

/**
 * The sitewide JSON-LD offer catalogue, built from the price table.
 *
 * This markup ships on every page and is the version of the prices Google is
 * most likely to surface, which made it the worst place on the site to keep
 * numbers by hand — and it did. Seven of thirteen offers understated the fare
 * the checkout charges: Lloret de Mar was published at €100 against €145,
 * Roses at €155 against €205, Tossa at €110 against €155. Every one had been
 * correct when written.
 *
 * Nothing here restates a price. Both the Offer price and the sentence inside
 * the description are read from the same table the booking quotes from, so the
 * catalogue cannot describe a fare that no longer exists.
 *
 * A route with no table row is omitted rather than estimated. Structured data
 * has no way to say "quoted by distance", and publishing a guess is worse than
 * publishing nothing.
 */

interface OfferSpec {
  /** Offer name, as it appears in the catalogue. */
  name: string;
  /** Service name inside itemOffered. */
  service: string;
  /** Sentence describing the route, with the fares appended automatically. */
  blurb: string;
  zone: string;
  origin: "airport" | "barcelona_city";
  /** Name the dearest vehicle too, where the original markup did. */
  showRange?: "vclass" | "minibus";
}

const SPECS: OfferSpec[] = [
  { name: "BCN Airport to Barcelona City Centre", service: "El Prat Airport to Barcelona City Transfer",
    blurb: "Fixed-price luxury private transfer from Barcelona El Prat Airport (T1/T2) to city centre hotels.",
    zone: "barcelona_city", origin: "airport", showRange: "vclass" },
  { name: "BCN Airport to Cruise Port Transfer", service: "Barcelona Airport to Cruise Port Private Transfer",
    blurb: "Fixed-price transfer from El Prat Airport to Barcelona World Trade Centre or Moll Adossat cruise terminals.",
    zone: "cruise", origin: "airport" },
  { name: "BCN Airport to Andorra Transfer", service: "Barcelona Airport to Andorra la Vella Private Transfer",
    blurb: "Fixed-price luxury transfer from BCN Airport to Andorra la Vella.",
    zone: "andorra", origin: "airport", showRange: "minibus" },
  { name: "BCN Airport to Girona Airport Transfer", service: "Barcelona El Prat Airport to Girona Costa Brava Airport Transfer",
    blurb: "Inter-airport private transfer between BCN (El Prat) and GRO (Girona).",
    zone: "girona_airport", origin: "airport" },
  { name: "BCN Airport to Sitges Transfer", service: "Barcelona Airport to Sitges Private Transfer",
    blurb: "Fixed-price private transfer from Barcelona El Prat Airport to Sitges.",
    zone: "sitges", origin: "airport" },
  { name: "BCN Airport to Tarragona / PortAventura", service: "Barcelona Airport to Tarragona and PortAventura Transfer",
    blurb: "Fixed-price transfer from BCN Airport to Tarragona, Salou, La Pineda, and PortAventura World.",
    zone: "tarragona", origin: "airport" },
  { name: "BCN Airport to Salou Transfer", service: "Barcelona Airport to Salou Private Transfer",
    blurb: "Direct fixed-price transfer from BCN Airport to Salou resort.",
    zone: "salou", origin: "airport" },
  { name: "BCN Airport to Cambrils Transfer", service: "Barcelona Airport to Cambrils Private Transfer",
    blurb: "Direct fixed-price transfer from BCN Airport to Cambrils.",
    zone: "cambrils", origin: "airport" },
  { name: "BCN Airport to Lloret de Mar Transfer", service: "Barcelona Airport to Lloret de Mar Private Transfer",
    blurb: "Fixed-price transfer from BCN El Prat Airport to Lloret de Mar, Costa Brava.",
    zone: "lloret", origin: "airport" },
  { name: "BCN Airport to Tossa de Mar Transfer", service: "Barcelona Airport to Tossa de Mar Private Transfer",
    blurb: "Fixed-price transfer from BCN Airport to Tossa de Mar, Costa Brava.",
    zone: "tossa", origin: "airport" },
  { name: "BCN Airport to Roses / Empuriabrava", service: "Barcelona Airport to Roses and Empuriabrava Transfer",
    blurb: "Fixed-price transfer from BCN Airport to Roses and Empuriabrava, northern Costa Brava.",
    zone: "roses", origin: "airport" },
  { name: "Barcelona to Sitges Transfer", service: "Barcelona City to Sitges Private Transfer",
    blurb: "Fixed-price luxury transfer from Barcelona city centre to Sitges. No surge pricing.",
    zone: "sitges", origin: "barcelona_city" },
  { name: "Barcelona to Tarragona Transfer", service: "Barcelona City to Tarragona Private Transfer",
    blurb: "Fixed-price luxury transfer from Barcelona to Tarragona and PortAventura.",
    zone: "tarragona", origin: "barcelona_city" },
];

export interface CatalogOffer {
  "@type": "Offer";
  name: string;
  price: string;
  priceCurrency: "EUR";
  itemOffered: { "@type": "Service"; name: string; description: string };
}

/**
 * @returns one Offer per route that has a published fare. Routes without one
 *   are dropped, so the count can legitimately be smaller than SPECS.
 */
export function buildOfferCatalog(): CatalogOffer[] {
  const offers: CatalogOffer[] = [];

  for (const s of SPECS) {
    const l = ladderFor(s.zone, s.origin);
    if (!l) continue; // no published fare — say nothing rather than guess

    const range =
      s.showRange === "minibus" ? ` From €${l.economy} economy to €${l.minibus} minibus.`
    : s.showRange === "vclass"  ? ` From €${l.economy} economy to €${l.vclass} V-Class.`
    :                             ` From €${l.economy} economy.`;

    offers.push({
      "@type": "Offer",
      name: s.name,
      price: String(l.economy),
      priceCurrency: "EUR",
      itemOffered: { "@type": "Service", name: s.service, description: s.blurb + range },
    });
  }

  // Hourly hire is priced per hour rather than per route, so it is built from
  // the hourly rates instead of the route table.
  offers.push({
    "@type": "Offer",
    name: "Executive Hourly Chauffeur Barcelona",
    price: String(HOURLY_RATES.BUSINESS),
    priceCurrency: "EUR",
    itemOffered: {
      "@type": "Service",
      name: "Hourly Chauffeur Service Barcelona",
      description:
        `By-the-hour luxury chauffeur hire in Barcelona. From €${HOURLY_RATES.ECONOMY}/h economy, ` +
        `€${HOURLY_RATES.BUSINESS}/h business, €${HOURLY_RATES.LUXURY}/h luxury. ` +
        `Minimum ${MIN_HOURLY_HOURS.ECONOMY} hours.`,
    },
  });

  return offers;
}

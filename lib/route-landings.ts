import {
  ShoppingBag, Train, Waves, Umbrella, Clock, MapPin, ShieldCheck,
  Car, Luggage, Plane, CalendarClock, Route as RouteIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { lookupPriceByFleetVehicle, type ZoneCode } from "@/lib/fixed-prices";
import { VEHICLE_CATALOG, type VehicleInfo } from "@/types";

/**
 * The commercial route landing pages, as data.
 *
 * Four zones carried a published fare and had no page anywhere on the site:
 * LA_ROCA, SANTS_STATION, VILANOVA and BEGUR. Every one of them was already
 * bookable and already priced on /pricing — the price row simply pointed
 * nowhere, because routePageHref() returns null for a zone with no page.
 *
 * A route only belongs here if it clears three tests, all of which these four
 * pass and most of the remaining unpaged zones do not:
 *
 *   1. It is priced in the table, so nothing on the page has to be invented.
 *   2. It is a destination people search for by name, not a village inside a
 *      region already covered by a hub. Cubelles and Malgrat fail this; the
 *      Costa Dorada and Costa Brava hubs are the right home for them.
 *   3. There is something true and specific to say about the journey that does
 *      not appear on any other page. A page that only restates the fare is thin
 *      content whatever its word count.
 *
 * Prices are resolved through lookupPriceByFleetVehicle at module scope. No
 * fare, ladder or "from €X" string in this file is typed by hand.
 */

const BASE = "https://www.elitebcn.info";

export type PricedVehicle = VehicleInfo & { price: number };

export interface RouteOption {
  name: string;
  cost: string;
  time: string;
  best: string;
}

export interface RouteSection {
  h2: string;
  h2Accent?: string;
  paras: string[];
  cards?: Array<{ icon: LucideIcon; t: string; d: string }>;
}

export interface RouteLanding {
  slug: string;
  name: string;
  h1: string;
  eyebrow: string;
  EyebrowIcon: LucideIcon;
  title: string;
  description: string;
  keywords: string[];
  heroLead: string;
  facts: Array<{ icon: LucideIcon; k: string; v: string }>;
  priceTables: Array<{ heading: string; caption: string; vehicles: PricedVehicle[] }>;
  priceNote: string;
  included: string[];
  excluded: string[];
  options?: RouteOption[];
  optionsIntro?: string;
  optionsNote?: string;
  sections: RouteSection[];
  faqs: Array<{ q: string; a: string }>;
  bookingLead: string;
  ctaLead: string;
  cheapest: number;
  url: string;
  serviceSchema: Record<string, unknown>;
  breadcrumbSchema: Record<string, unknown>;
}

/** Every fleet car that has a fare on this leg, cheapest first in the table order. */
function ladder(from: ZoneCode, to: ZoneCode): PricedVehicle[] {
  return VEHICLE_CATALOG.map((v) => ({
    ...v,
    price: lookupPriceByFleetVehicle(from, to, v.class),
  })).filter((v): v is PricedVehicle => v.price !== null);
}

function cheapestOf(...ladders: PricedVehicle[][]): number {
  return Math.min(...ladders.flat().map((v) => v.price));
}

/**
 * Service and BreadcrumbList markup, built once rather than per page.
 *
 * `provider` is a reference to the single business entity the root layout
 * declares. Redeclaring the company would give it another identity, which is
 * exactly the fragmentation the 25 Aug schema consolidation removed. No
 * aggregateRating and no Review: Google does not accept self-serving review
 * markup, and the site publishes none anywhere.
 */
interface AreaSpec {
  /** schema.org type for the place: City, TrainStation, Place. */
  type: string;
  name: string;
  /**
   * Wikidata entity URI. Every other page on the site links its areaServed to
   * one; these four launched without because the identifiers were not verified
   * at the time. They are now — see the note at the top of this patch history.
   */
  sameAs?: string;
}

function schemaFor(
  slug: string,
  name: string,
  serviceName: string,
  description: string,
  price: number,
  area: AreaSpec,
) {
  const url = `${BASE}/transfers/${slug}`;
  return {
    url,
    serviceSchema: {
      "@context": "https://schema.org",
      "@type": "Service",
      name: serviceName,
      description,
      url,
      serviceType: "Private transfer",
      provider: { "@id": `${BASE}/#business` },
      areaServed: {
        "@type": area.type,
        name: area.name,
        ...(area.sameAs ? { sameAs: area.sameAs } : {}),
      },
      offers: {
        "@type": "Offer",
        price: String(price),
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        url: `${BASE}/book`,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price,
          priceCurrency: "EUR",
          unitText: "per vehicle",
        },
      },
    },
    breadcrumbSchema: {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE },
        { "@type": "ListItem", position: 2, name: "Transfers", item: `${BASE}/transfers` },
        { "@type": "ListItem", position: 3, name, item: url },
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La Roca Village
//
// Distance and time are derived from figures the site already publishes rather
// than invented: Mataró sits at 36 km / 38 min from the airport and Terrassa at
// 40 km / 42 min (data/destinations.json), and the airport-to-city leg is
// 12–18 km / 18–26 min across the twenty Barcelona hotels in the same file. The
// village is beyond the city on the inland side, so the airport run is the city
// run plus that leg. Stated as approximate ranges because that is what they are.
// ─────────────────────────────────────────────────────────────────────────────

const laRocaCity = ladder("BARCELONA_CITY", "LA_ROCA");
const laRocaAirport = ladder("BCN_AIRPORT", "LA_ROCA");
const laRocaCityFrom = cheapestOf(laRocaCity);
const laRocaAirportFrom = cheapestOf(laRocaAirport);

const LA_ROCA: RouteLanding = {
  slug: "la-roca-village",
  name: "La Roca Village",
  h1: "Barcelona to La Roca Village Transfer",
  eyebrow: "La Roca del Vallès",
  EyebrowIcon: ShoppingBag,
  title: `Barcelona to La Roca Village Transfer — from €${laRocaCityFrom}`,
  description: `Private car to La Roca Village from central Barcelona (€${laRocaCityFrom}) or BCN Airport (€${laRocaAirportFrom}). Fixed per vehicle, boot space for what you buy.`,
  keywords: [
    "barcelona to la roca village transfer",
    "la roca village private transfer",
    "la roca village from barcelona",
    "barcelona airport to la roca village",
    "la roca village shopping transport",
  ],
  heroLead: `A private car to the outlet and back, with a boot that stays yours for the day. Fixed at €${laRocaCityFrom} per vehicle from central Barcelona, or €${laRocaAirportFrom} direct from the airport — agreed before you travel, whatever you come back with.`,
  facts: [
    { icon: MapPin, k: "From the city", v: "about 35 km" },
    { icon: Clock, k: "Journey", v: "35–45 min" },
    { icon: Car, k: "Return trips", v: "Same car" },
    { icon: ShieldCheck, k: "From", v: `€${laRocaCityFrom}` },
  ],
  priceTables: [
    { heading: "From central Barcelona", caption: "Fixed fares from central Barcelona to La Roca Village by vehicle", vehicles: laRocaCity },
    { heading: "From BCN El Prat Airport", caption: "Fixed fares from Barcelona El Prat Airport to La Roca Village by vehicle", vehicles: laRocaAirport },
  ],
  priceNote: "The airport fare is higher because it is a longer run, and it includes flight tracking and 60 minutes of free waiting from landing.",
  included: [
    "Licensed chauffeur, vehicle and fuel",
    "Door-to-door pickup from any Barcelona address",
    "Parking at the village",
    "Free cancellation up to 24 hours before",
    "One fixed price, whatever the traffic does",
  ],
  excluded: [
    "The return journey, if you want one",
    "Driver waiting time, quoted before you book",
    "10% VAT — only if you request an invoice",
    "Motorway tolls on the route",
  ],
  optionsIntro: "A private car is not always the right answer. Here is when it is, and when it isn't.",
  options: [
    { name: "Private car", cost: `€${laRocaCityFrom} per vehicle from the city`, time: "35–45 minutes", best: "Groups, families, anyone expecting to leave with bags, and anyone who wants a fixed return time" },
    { name: "Shopping coach", cost: "Per person, sold by the operator", time: "Around an hour each way, plus the wait for a departure", best: "One or two people travelling light who are happy to work around a timetable" },
    { name: "Train, then local bus", cost: "Two separate per-person tickets", time: "Longest of the three, with a change and a walk", best: "Budget travellers with time and no luggage" },
    { name: "Driving yourself", cost: "Car hire, fuel and parking", time: "Similar to a private car", best: "Trips where you already have a hire car for other reasons" },
  ],
  optionsNote: "If you are one person going to browse and coming back with a single bag, the coach is cheaper and perfectly good. The private car earns its price when there are three or four of you, when you are going with the intention of buying, or when you want to leave at a time you choose rather than one a timetable chooses for you.",
  sections: [
    {
      h2: "The part everyone",
      h2Accent: "underestimates",
      paras: [
        "Every other journey you take in Barcelona, you arrive and leave with the same bags. This is the one where you don't. People plan the outbound trip carefully and give no thought at all to carrying eight stiff paper bags back, which is how a good day ends badly at a coach stop.",
        `Book by boot space rather than by seats. The [fleet page](/fleet) lists what each car actually holds — the ${laRocaCity[0].label} takes ${laRocaCity[0].largeBags} large cases, and the vans considerably more. For a dedicated shopping trip, one size up from your seating requirement is the right call and costs less than you would guess.`,
        "If you want the same car for the way home, ask for a wait-and-return when you book. Your driver parks, you go and shop, and the car is where you left it when you are done — with your morning purchases already in the boot rather than on your arms. Longer waits are priced by the hour; the [hourly chauffeur page](/hourly) explains how that works.",
      ],
      cards: [
        { icon: Luggage, t: "Book for the boot", d: "Seats and luggage are separate limits. On this trip the boot is the one that bites." },
        { icon: Clock, t: "Leave when you want", d: "No last departure to run for and no queue at closing time." },
        { icon: Car, t: "Same driver both ways", d: "The car stays yours, so shopping goes straight in as you go." },
      ],
    },
    {
      h2: "Combining it with the rest of your",
      h2Accent: "trip",
      paras: [
        "La Roca sits on the inland road north of Barcelona, which puts it roughly on the way to several places people already travel to. If the outlet is one stop of a longer day, say so when you book and we will price the whole thing as one journey rather than as separate legs.",
        "Common combinations are an airport pickup that stops at the village before the hotel — useful on an arrival day when the room is not ready — and a village stop on the way to or from [Girona](/transfers/girona) or the [Costa Brava](/transfers/costa-brava). For a full day with several stops, by-the-hour hire is usually cheaper than three point-to-point transfers.",
        "Coming straight from a flight? The [airport transfers page](/airport-transfers) covers how pickups work at T1 and T2, and the fare above already includes flight tracking and free waiting from landing.",
      ],
    },
  ],
  faqs: [
    { q: "How much is a transfer from Barcelona to La Roca Village?", a: `From €${laRocaCityFrom} for the ${laRocaCity[0].label} from central Barcelona, and from €${laRocaAirportFrom} from BCN El Prat Airport. The fare is per vehicle rather than per person, so a family of four pays the same as one shopper. Larger cars cost more and the full list is on this page. The price excludes VAT and tolls: 10% VAT is added only if you ask for an invoice.` },
    { q: "How long does it take to get to La Roca Village?", a: "About 35 km from central Barcelona and 35–45 minutes in normal traffic. From the airport it is about 50 km and 45–60 minutes. Allow longer on Saturdays and during the sale periods, when the approach road backs up." },
    { q: "Can the driver wait and bring us back?", a: "Yes. A wait-and-return keeps the same car and the same driver for the journey home, which means your shopping goes straight into a boot that is already yours and you are not queuing at closing time. Tell us roughly how long you want and we will quote it before you book — see the [hourly page](/hourly) for how by-the-hour hire is priced." },
    { q: "Is there room in the car for what we buy?", a: `Boot space is the limit that matters on this trip, not seats. The ${laRocaCity[0].label} takes ${laRocaCity[0].largeBags} large cases; the larger vehicles take considerably more. If you are going specifically to shop, book one size up from what your group needs for seating — it costs a little more and removes the only real problem with this journey.` },
    { q: "Can you collect us from the airport on the way into Barcelona?", a: `Yes, and it is a common request on arrival day. The airport pickup is priced separately at €${laRocaAirportFrom} because it is a longer run, and it includes 60 minutes of free waiting from landing plus flight tracking. Your cases travel with you and stay in the car while you shop.` },
    { q: "Is this a private car or a shared shuttle?", a: "Private. We never combine bookings, share the vehicle with other passengers or sell seats individually. The car is yours for the whole journey, in both directions if you book the return." },
  ],
  bookingLead: "Give us the pickup address, the date and the number of passengers, and say whether you want the return. The price is confirmed before you pay and does not move afterwards. If you are not sure how long you will want at the village, book the outbound now and add the return later — most people do.",
  ctaLead: `€${laRocaCityFrom} per vehicle from central Barcelona, €${laRocaAirportFrom} from the airport.`,
  cheapest: laRocaCityFrom,
  ...schemaFor(
    "la-roca-village",
    "La Roca Village",
    "Barcelona to La Roca Village Private Transfer",
    `Fixed-price private transfer to La Roca Village from central Barcelona (from €${laRocaCityFrom}) or Barcelona El Prat Airport (from €${laRocaAirportFrom}). About 35 km from the city, 35–45 minutes. Return and wait-and-return journeys available.`,
    laRocaCityFrom,
    { type: "City", name: "La Roca del Vallès", sameAs: "https://www.wikidata.org/wiki/Q15439" },
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Barcelona Sants station
//
// Sants is inside the city, so the distance is the site's own published city
// range rather than a new figure: 12–18 km / 18–26 min across the twenty
// Barcelona hotels in data/destinations.json. Sants sits at the near end of it,
// between the Diagonal hotels at 12 km and the Eixample ones at 15–16 km.
// ─────────────────────────────────────────────────────────────────────────────

const sants = ladder("BCN_AIRPORT", "SANTS_STATION");
const santsFrom = cheapestOf(sants);

const SANTS: RouteLanding = {
  slug: "sants-station",
  name: "Barcelona Sants Station",
  h1: "Barcelona Airport to Sants Station Transfer",
  eyebrow: "BCN El Prat · T1 & T2",
  EyebrowIcon: Train,
  title: `Barcelona Airport to Sants Station — from €${santsFrom}`,
  description: `Private transfer from BCN El Prat to Barcelona Sants station. Fixed €${santsFrom} per vehicle, 60 minutes free waiting from landing, cases to the door.`,
  keywords: [
    "barcelona airport to sants station",
    "bcn airport to sants transfer",
    "barcelona sants station transfer",
    "airport to sants train station taxi",
    "barcelona sants ave connection transfer",
  ],
  heroLead: `A private car from arrivals to the station door, timed around your train rather than a timetable. Fixed at €${santsFrom} per vehicle, with 60 minutes of free waiting from the moment you land.`,
  facts: [
    { icon: MapPin, k: "Distance", v: "13–15 km" },
    { icon: Clock, k: "Journey", v: "about 20 min" },
    { icon: Plane, k: "Free waiting", v: "60 minutes" },
    { icon: ShieldCheck, k: "From", v: `€${santsFrom}` },
  ],
  priceTables: [
    { heading: "From BCN El Prat Airport", caption: "Fixed fares from Barcelona El Prat Airport to Barcelona Sants station by vehicle", vehicles: sants },
  ],
  priceNote: "Sants is one of the closer city destinations to the airport, and the fare is the standard airport-to-city rate rather than a supplement.",
  included: [
    "Licensed chauffeur, vehicle and fuel",
    "Flight tracking, pickup moved to your landing time",
    "60 minutes free waiting from touchdown",
    "Parking and airport access fees",
    "Help with cases to the station entrance",
  ],
  excluded: [
    "10% VAT — only if you request an invoice",
    "Motorway tolls, on routes that use them",
    "Meet and greet with a name board",
    "Child, baby and booster seats",
  ],
  optionsIntro: "Sants is well served by public transport, and for some travellers that is genuinely the better choice. Here is the honest comparison.",
  options: [
    { name: "Private transfer", cost: `€${santsFrom} per vehicle`, time: "About 20 minutes, door to door", best: "Tight rail connections, groups, heavy luggage, or arriving late at night" },
    { name: "Rodalies R2 Nord train", cost: "Per person, cheapest option", time: "About 25 minutes, from T2 only", best: "Solo travellers landing at T2 with one bag and time in hand" },
    { name: "Aerobús to Plaça Espanya", cost: "Per person", time: "About 25 minutes, plus a metro hop or a walk", best: "Travelling light and not in a hurry" },
    { name: "Taxi", cost: "Metered, plus an airport supplement", time: "Similar to a private transfer, plus the rank queue", best: "Arriving off-peak with no wait at the rank" },
  ],
  optionsNote: "The R2 Nord train is cheap and quick, but it runs from T2 only — if you land at T1 you first take the shuttle bus between terminals, which is where connections get eaten. If your train south or to Madrid leaves within two hours of landing, the fixed transfer is the one that does not depend on how long passport control takes.",
  sections: [
    {
      h2: "Making a train connection",
      h2Accent: "safely",
      paras: [
        "This is the journey where the margin matters more than the price. A missed long-distance train is not a delay, it is a new ticket, and the gap between a comfortable connection and a lost one is usually twenty minutes of airport queue nobody planned for.",
        "We track your flight by number and move the pickup to the actual landing time, so a delayed flight does not mean a driver who has already left. Airport pickups include 60 minutes of free waiting from touchdown, which covers passport control and baggage reclaim on all but the worst days. Tell us your train departure time when you book and the driver will know what the journey is for.",
        "If your connection is genuinely tight, say so. It changes nothing about the price, but it changes how the driver plans the route and where they drop you — Sants has entrances on more than one side, and the right one saves several minutes with a case.",
      ],
      cards: [
        { icon: CalendarClock, t: "Give us the train time", d: "The driver plans the route around your departure, not just your pickup." },
        { icon: Plane, t: "Delays are tracked", d: "Pickup moves to your real landing time at no extra charge." },
        { icon: Luggage, t: "Cases to the door", d: "Dropped at the station entrance, not at a stop several minutes away." },
      ],
    },
    {
      h2: "Where Sants fits in your",
      h2Accent: "journey",
      paras: [
        "Sants is Barcelona's main intercity rail station and the point most travellers pass through on the way somewhere else — high-speed services south and west, regional trains along both coasts, and the metro lines that feed the rest of the city.",
        "That makes it a common first or last stop rather than a destination. If you are heading into town afterwards instead, the [Barcelona city centre transfer](/transfers/barcelona-city-centre) covers the door-to-door run to any central address for the same fixed fare. If you are travelling on to the coast, the [Costa Dorada](/transfers/costa-dorada) and [Costa Brava](/transfers/costa-brava) pages list the road fares, which for a group are often close to four rail tickets.",
        "Coming the other way — leaving Barcelona and needing to be at the airport for a flight — the same fare applies in reverse. The [airport transfers page](/airport-transfers) explains how departure pickups are timed.",
      ],
    },
  ],
  faqs: [
    { q: "How much is a transfer from Barcelona Airport to Sants station?", a: `From €${santsFrom} for the ${sants[0].label}, fixed per vehicle rather than per person. Larger cars cost more and the full list is on this page. The price excludes VAT and tolls: 10% VAT is added only if you ask for an invoice.` },
    { q: "How long does the journey take?", a: "13–15 km and about 20 minutes in normal traffic. Allow longer between 8–9am and 5–7pm, and on days with a major event at the Fira, which sits between the airport and the station." },
    { q: "How much time should I leave before my train?", a: "Beyond the journey itself, leave enough time to find your platform and clear the security check that long-distance services use. Give us your train departure time when you book and we will set the pickup to suit it — the transfer itself is the predictable part, so the buffer is for the station, not the road." },
    { q: "What happens if my flight is delayed?", a: "We track your flight by its number and move the pickup to the actual landing time at no charge. Airport pickups include 60 minutes of free waiting from touchdown. If a delay means you will miss your train, tell us and we will discuss the options — including running you on to your destination by road." },
    { q: "Can you collect me from Sants and take me to the airport?", a: "Yes, at the same fixed fare in the opposite direction. Departure pickups are timed from your flight, so give us the flight number when you book and we will work backwards from it." },
    { q: "Is this a private car or a shared shuttle?", a: "Private. We never combine bookings, share the vehicle with other passengers or sell seats individually. The car is yours from arrivals to the station." },
  ],
  bookingLead: "Give us your flight number, your train departure time if you have one, and the number of passengers. The price is confirmed before you pay and does not move afterwards, whatever the traffic or the delay does.",
  ctaLead: `Fixed at €${santsFrom} per vehicle from BCN El Prat to Barcelona Sants.`,
  cheapest: santsFrom,
  ...schemaFor(
    "sants-station",
    "Barcelona Sants Station",
    "Barcelona Airport to Sants Station Private Transfer",
    `Fixed-price private transfer between Barcelona El Prat Airport and Barcelona Sants railway station. From €${santsFrom} per vehicle, 13–15 km, about 20 minutes. Flight tracking and 60 minutes of free waiting from landing.`,
    santsFrom,
    { type: "TrainStation", name: "Barcelona Sants railway station", sameAs: "https://www.wikidata.org/wiki/Q800453" },
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Vilanova i la Geltrú
//
// 36 km by road is recorded in lib/fixed-prices.ts against the route itself,
// where it was used to set the fare between Sitges (30 km) and Cubelles (41 km).
// Journey time follows the site's own Mataró figure, which is 36 km / 38 min.
// ─────────────────────────────────────────────────────────────────────────────

const vilanovaAirport = ladder("BCN_AIRPORT", "VILANOVA");
const vilanovaCity = ladder("BARCELONA_CITY", "VILANOVA");
const vilanovaFrom = cheapestOf(vilanovaAirport, vilanovaCity);

const VILANOVA: RouteLanding = {
  slug: "vilanova",
  name: "Vilanova i la Geltrú",
  h1: "Barcelona Airport to Vilanova i la Geltrú Transfer",
  eyebrow: "Garraf coast",
  EyebrowIcon: Waves,
  title: `Barcelona to Vilanova i la Geltrú Transfer — from €${vilanovaFrom}`,
  description: `Private transfer from BCN El Prat or central Barcelona to Vilanova i la Geltrú. Fixed €${vilanovaFrom} per vehicle, 36 km, about 40 minutes, door to door.`,
  keywords: [
    "barcelona airport to vilanova i la geltru",
    "vilanova i la geltru transfer",
    "bcn airport to vilanova taxi",
    "vilanova private transfer barcelona",
    "garraf coast airport transfer",
  ],
  heroLead: `A private car from arrivals to your door on the Garraf coast, one town beyond Sitges. Fixed at €${vilanovaFrom} per vehicle from either BCN El Prat or central Barcelona, with 60 minutes of free waiting from landing.`,
  facts: [
    { icon: MapPin, k: "Distance", v: "36 km" },
    { icon: Clock, k: "Journey", v: "about 40 min" },
    { icon: Plane, k: "Free waiting", v: "60 minutes" },
    { icon: ShieldCheck, k: "From", v: `€${vilanovaFrom}` },
  ],
  priceTables: [
    { heading: "From BCN El Prat Airport", caption: "Fixed fares from Barcelona El Prat Airport to Vilanova i la Geltrú by vehicle", vehicles: vilanovaAirport },
    { heading: "From central Barcelona", caption: "Fixed fares from central Barcelona to Vilanova i la Geltrú by vehicle", vehicles: vilanovaCity },
  ],
  priceNote: "Both origins cost the same on this route. The airport and the city are a similar distance from the Garraf coast, so we do not charge a supplement for one over the other.",
  included: [
    "Licensed chauffeur, vehicle and fuel",
    "Flight tracking, pickup moved to your landing time",
    "60 minutes free waiting from touchdown",
    "Door-to-door to any address in Vilanova",
    "Free cancellation up to 24 hours before",
  ],
  excluded: [
    "10% VAT — only if you request an invoice",
    "Motorway tolls on the C-32",
    "Meet and greet with a name board",
    "Child, baby and booster seats",
  ],
  optionsIntro: "Vilanova is on the coastal rail line, so the train is a real alternative. It depends almost entirely on your luggage and your arrival time.",
  options: [
    { name: "Private transfer", cost: `€${vilanovaFrom} per vehicle`, time: "About 40 minutes, door to door", best: "Groups, families, holiday luggage, late arrivals and anyone staying outside the centre" },
    { name: "Rodalies R2 Sud train", cost: "Per person, cheapest option", time: "Around an hour from the airport, with a change", best: "Solo travellers with one bag arriving during the day" },
    { name: "Taxi", cost: "Metered, plus an airport supplement", time: "Similar to a private transfer", best: "Arriving off-peak with no wait at the rank" },
  ],
  optionsNote: "The train is genuinely good value if you are travelling light and landing in daylight. It stops being the better option the moment you have two suitcases, a late flight, or an apartment that is a fifteen-minute walk uphill from the station — which describes a large share of the accommodation here.",
  sections: [
    {
      h2: "One town beyond",
      h2Accent: "Sitges",
      paras: [
        "Vilanova i la Geltrú sits on the Garraf coast just past Sitges, and the two are usually mentioned together — but they are different places to stay. Vilanova is a working coastal town with a fishing port and a long stretch of beach, rather than a resort, and accommodation here is generally larger and further apart than in Sitges.",
        "That last part is why the transfer question comes up. Vilanova's apartments and villas are spread across a wide seafront and up into the streets behind it, which makes a door-to-door fare more useful than a station arrival. The price above is to any address in the town, not to a central drop-off point.",
        "If you are choosing between the two, or staying in one and visiting the other, the [Sitges transfer page](/transfers/sitges) has the fares for that side. Both towns sit on the same road out of Barcelona, so a stop in one on the way to the other is straightforward to arrange.",
      ],
      cards: [
        { icon: MapPin, t: "Any address in town", d: "Seafront, old town or the streets behind — one fare covers all of them." },
        { icon: Luggage, t: "Built for holiday luggage", d: "No station stairs and no walk at the far end with a case." },
        { icon: Umbrella, t: "Beach-season traffic", d: "The C-32 backs up on summer weekends. The fare does not move when it does." },
      ],
    },
    {
      h2: "Where it sits on the",
      h2Accent: "coast",
      paras: [
        "Vilanova is the northern end of a run of coastal towns that continues south through Cubelles and Calafell towards Tarragona. Everything along that stretch is priced in the same table, so if your stay involves more than one of them the fares are directly comparable — the [Costa Dorada page](/transfers/costa-dorada) covers the whole run.",
        "In the other direction it is a short hop back towards Barcelona, which makes day trips into the city practical without moving hotels. A return transfer costs the same as the outbound, and for a group it usually compares well with four or five rail tickets each way.",
        "For arrivals, the [airport transfers page](/airport-transfers) explains how pickups work at T1 and T2 and what happens when a flight is delayed. The fare above already includes flight tracking and free waiting from landing.",
      ],
    },
  ],
  faqs: [
    { q: "How much is a transfer from Barcelona Airport to Vilanova i la Geltrú?", a: `From €${vilanovaFrom} for the ${vilanovaAirport[0].label}, fixed per vehicle rather than per person. The same fare applies from central Barcelona. Larger cars cost more and the full list is on this page. The price excludes VAT and tolls: 10% VAT is added only if you ask for an invoice.` },
    { q: "How long does the journey take?", a: "36 km and about 40 minutes in normal traffic. Allow longer on summer weekends, when the C-32 coastal motorway carries a lot of beach traffic in both directions." },
    { q: "Will the driver take me to my apartment rather than the centre?", a: "Yes. The fare is door to door to any address in Vilanova, so a hotel, an apartment or a private villa all cost the same. Give the full address when you book — accommodation here is spread out, and the exact street matters more than it would in a smaller town." },
    { q: "Is Vilanova the same as Sitges?", a: "No. They are neighbouring towns on the same coast, about ten minutes apart by road, and they are priced separately. Vilanova is larger and more residential; Sitges is the resort. See the [Sitges page](/transfers/sitges) for that route, or ask us to include a stop in one on the way to the other." },
    { q: "What happens if my flight is delayed?", a: "We track your flight by its number and move the pickup to the actual landing time at no charge. Airport pickups include 60 minutes of free waiting from touchdown, which covers passport control and baggage reclaim on all but the worst days." },
    { q: "Is this a private car or a shared shuttle?", a: "Private. We never combine bookings, share the vehicle with other passengers or sell seats individually. The car is yours from arrivals to your door." },
  ],
  bookingLead: "Give us your flight number, the full address in Vilanova and the number of passengers. The price is confirmed before you pay and does not move afterwards. If you are staying somewhere without an obvious street number, a landmark or the property name is usually enough.",
  ctaLead: `Fixed at €${vilanovaFrom} per vehicle from BCN El Prat or central Barcelona.`,
  cheapest: vilanovaFrom,
  ...schemaFor(
    "vilanova",
    "Vilanova i la Geltrú",
    "Barcelona to Vilanova i la Geltrú Private Transfer",
    `Fixed-price private transfer to Vilanova i la Geltrú from Barcelona El Prat Airport or central Barcelona. From €${vilanovaFrom} per vehicle, 36 km, about 40 minutes. Flight tracking and 60 minutes of free waiting from landing.`,
    vilanovaFrom,
    { type: "City", name: "Vilanova i la Geltrú", sameAs: "https://www.wikidata.org/wiki/Q15553" },
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Begur & Aiguablava
//
// 146 km by road is recorded in lib/fixed-prices.ts against the route, where it
// was used to set the fare between Palamós (132 km) and Figueres (155 km).
// Journey time follows the site's own long-route figures: Girona airport is
// 103 km / 68 min and Reus 112 km / 70 min (data/destinations.json), which puts
// 146 km a little under two hours.
// ─────────────────────────────────────────────────────────────────────────────

const begurAirport = ladder("BCN_AIRPORT", "BEGUR");
const begurCity = ladder("BARCELONA_CITY", "BEGUR");
const begurFrom = cheapestOf(begurAirport, begurCity);

const BEGUR: RouteLanding = {
  slug: "begur",
  name: "Begur & Aiguablava",
  h1: "Barcelona Airport to Begur & Aiguablava Transfer",
  eyebrow: "Costa Brava",
  EyebrowIcon: Umbrella,
  title: `Barcelona to Begur & Aiguablava Transfer — from €${begurFrom}`,
  description: `Private transfer from BCN El Prat or central Barcelona to Begur and the Aiguablava coves. Fixed €${begurFrom} per vehicle, 146 km, about 1h45.`,
  keywords: [
    "barcelona airport to begur transfer",
    "begur private transfer",
    "aiguablava transfer barcelona",
    "bcn airport to costa brava begur",
    "begur villa transfer airport",
  ],
  heroLead: `A private car from arrivals to the coves, without a change, a connection or a hire-car desk. Fixed at €${begurFrom} per vehicle from either BCN El Prat or central Barcelona, with 60 minutes of free waiting from landing.`,
  facts: [
    { icon: MapPin, k: "Distance", v: "146 km" },
    { icon: Clock, k: "Journey", v: "about 1h 45" },
    { icon: Plane, k: "Free waiting", v: "60 minutes" },
    { icon: ShieldCheck, k: "From", v: `€${begurFrom}` },
  ],
  priceTables: [
    { heading: "From BCN El Prat Airport", caption: "Fixed fares from Barcelona El Prat Airport to Begur and Aiguablava by vehicle", vehicles: begurAirport },
    { heading: "From central Barcelona", caption: "Fixed fares from central Barcelona to Begur and Aiguablava by vehicle", vehicles: begurCity },
  ],
  priceNote: "Both origins cost the same. Aiguablava sits inside the Begur municipality, a few minutes down the same road, and takes the same fare as the town itself.",
  included: [
    "Licensed chauffeur, vehicle and fuel",
    "Flight tracking, pickup moved to your landing time",
    "60 minutes free waiting from touchdown",
    "Door-to-door to any address in Begur or the coves",
    "Free cancellation up to 24 hours before",
  ],
  excluded: [
    "10% VAT — only if you request an invoice",
    "Motorway tolls on the AP-7",
    "Meet and greet with a name board",
    "Child, baby and booster seats",
  ],
  optionsIntro: "This is far enough from Barcelona that the alternatives stop being close. Here is the honest comparison.",
  options: [
    { name: "Private transfer", cost: `€${begurFrom} per vehicle`, time: "About 1 hour 45 minutes, door to door", best: "Villa stays, families, groups, and anyone arriving with a full set of luggage" },
    { name: "Bus to Palafrugell, then local", cost: "Per person, plus a second leg", time: "Three hours or more with the connection", best: "Solo budget travellers arriving in the middle of the day" },
    { name: "Hire car", cost: "Rental, fuel, tolls and parking", time: "Similar to a private transfer, plus the desk queue", best: "Stays where you want a car for the whole week anyway" },
  ],
  optionsNote: "The hire car is the real alternative here, and for a two-week villa stay it often wins. For a shorter trip, or where the villa has parking you will not use, one fixed transfer each way is usually both cheaper and considerably less trouble than a week of Spanish motorway tolls and a fuel-policy argument at the desk.",
  sections: [
    {
      h2: "Arriving on the northern",
      h2Accent: "Costa Brava",
      paras: [
        "Begur is at the far end of the stretch of coast most Barcelona visitors never reach, and that distance is the whole point of the place — the coves below the town are reached by narrow roads that do not carry coach traffic. Aiguablava is one of them, four minutes down the same road, and it takes the same fare as the town.",
        "The practical consequence is that public transport gets you close and then stops. Buses serve Palafrugell and the larger towns; the coves themselves are a local connection or a taxi at the far end, after a journey that already involved a change. With luggage, after a flight, that final leg is where the day goes wrong.",
        "A door-to-door fare removes it. The car you get into at arrivals is the car that stops outside the villa, and the price is agreed before you travel regardless of what the AP-7 does on a July Saturday.",
      ],
      cards: [
        { icon: RouteIcon, t: "No connection to miss", d: "One car the whole way, so a delayed flight costs you nothing downstream." },
        { icon: Luggage, t: "Villa-sized luggage", d: "Book by boot space — a fortnight's bags for four rarely fits a saloon." },
        { icon: Clock, t: "Arrive at any hour", d: "Late flights are fine. There is no last bus to plan around." },
      ],
    },
    {
      h2: "Villa stays and the",
      h2Accent: "return leg",
      paras: [
        "Most bookings on this route are villa stays, which means two things practically. First, luggage is heavier than on a city break — book one vehicle size up from your seating requirement, because a fortnight's bags for four rarely fits a saloon boot. The [fleet page](/fleet) lists what each car actually holds.",
        "Second, the return is worth booking at the same time. Departure pickups this far out are timed backwards from your flight, and the drive is long enough that the margin matters; leaving it to arrange locally on the last morning is how people end up paying a premium for a car found at short notice.",
        "If you are touring rather than staying put, the wider [Costa Brava page](/transfers/costa-brava) lists the fares for the other towns along the coast, and [Girona](/transfers/girona) covers both the city and its airport — which for some routes is a shorter flight and a shorter drive than Barcelona.",
      ],
    },
  ],
  faqs: [
    { q: "How much is a transfer from Barcelona Airport to Begur?", a: `From €${begurFrom} for the ${begurAirport[0].label}, fixed per vehicle rather than per person. The same fare applies from central Barcelona, and to Aiguablava. Larger cars cost more and the full list is on this page. The price excludes VAT and tolls: 10% VAT is added only if you ask for an invoice.` },
    { q: "How long does the journey take?", a: "146 km and about 1 hour 45 minutes in normal traffic, most of it on the AP-7 motorway. Allow longer on summer Saturdays, which are changeover day for most villa lets on this coast." },
    { q: "Do you go to Aiguablava and the other coves?", a: "Yes, at the same fare. Aiguablava sits inside the Begur municipality a few minutes down the same road, and the surrounding coves are covered by the same price. Give the villa name or the full address when you book — the roads down to the coves are narrow and the exact destination matters." },
    { q: "Is a transfer better than hiring a car?", a: "It depends on your stay. For a fortnight where you want a car every day, hire usually wins. For a week or less, or where the plan is to stay near the coves, two fixed transfers are normally cheaper than rental plus fuel, tolls and parking — and there is no desk queue after a flight." },
    { q: "Should I book the return at the same time?", a: "We recommend it. Departure pickups are timed backwards from your flight, and on a drive this long the margin matters. Booking both legs together also fixes the return price, rather than leaving it to be arranged locally on your last morning." },
    { q: "Is this a private car or a shared shuttle?", a: "Private. We never combine bookings, share the vehicle with other passengers or sell seats individually. The car is yours from arrivals to the villa door." },
  ],
  bookingLead: "Give us your flight number, the villa or hotel address and the number of passengers, and say whether you want the return leg. The price is confirmed before you pay and does not move afterwards. If the address is hard to find, the property name and a nearby cove is usually enough for the driver to work with.",
  ctaLead: `Fixed at €${begurFrom} per vehicle from BCN El Prat or central Barcelona.`,
  cheapest: begurFrom,
  ...schemaFor(
    "begur",
    "Begur & Aiguablava",
    "Barcelona to Begur and Aiguablava Private Transfer",
    `Fixed-price private transfer to Begur and the Aiguablava coves from Barcelona El Prat Airport or central Barcelona. From €${begurFrom} per vehicle, 146 km, about 1 hour 45 minutes. Flight tracking and 60 minutes of free waiting from landing.`,
    begurFrom,
    { type: "City", name: "Begur", sameAs: "https://www.wikidata.org/wiki/Q13462" },
  ),
};

export const ROUTE_LANDINGS: RouteLanding[] = [LA_ROCA, SANTS, VILANOVA, BEGUR];

export function routeLanding(slug: string): RouteLanding | undefined {
  return ROUTE_LANDINGS.find((r) => r.slug === slug);
}

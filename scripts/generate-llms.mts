/**
 * Generates public/llms.txt and public/llms-full.txt from the site's own data.
 *
 * Both files were written and maintained by hand, and both drifted badly from
 * the site. An audit on 24 Aug 2026 found 136 of 175 price cells wrong (78%),
 * nearly all of them quoting LESS than the site charges — Cadaqués listed at
 * €165 against a real €240. It also carried invented social proof: 4.9★ from
 * "312+" Google reviews, plus Trustpilot and TripAdvisor ratings for profiles
 * that do not exist. Both files are served to GPTBot, ClaudeBot,
 * PerplexityBot, OAI-SearchBot and Google-Extended, which robots.txt
 * explicitly allows, so those figures were being handed to the systems that
 * increasingly answer travel questions before anyone reaches the site.
 *
 * Hand-editing 175 price cells is what produced the drift, so this reads the
 * same modules the booking flow reads. A figure can no longer be wrong here
 * without also being wrong on the site.
 *
 * Run: npm run gen:llms      Checked in CI by lib/__tests__/llms-txt.test.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { FIXED_ROUTES, type FixedRoute, type VehicleCode } from "../lib/fixed-prices";
import { VEHICLE_CATALOG, EXTRAS_CATALOG, BAG_SIZES } from "../types";
import { HOURLY_RATES, MIN_HOURLY_HOURS } from "../lib/pricing";
import { COMPANY } from "../lib/company-facts";
import { SUPPORTED_LOCALES } from "../lib/i18n";

const SITE = "https://www.elitebcn.info";
const COLS: VehicleCode[] = ["ECONOMY", "BUSINESS", "MINIVAN", "VCLASS", "MINIBUS"];

/**
 * Languages the site actually publishes, read from the locale list.
 *
 * Named in English rather than natively: this file is read by machines and by
 * English-speaking operators, and a list mixing Latin, Cyrillic, Han and Arabic
 * scripts is harder to parse than it is impressive. The old file claimed
 * "English, Spanish, Catalan" — one of which the site does not publish at all.
 */
const ENGLISH_NAME: Record<(typeof SUPPORTED_LOCALES)[number], string> = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  it: "Italian", ru: "Russian", zh: "Chinese", ar: "Arabic",
};
const LANGUAGES = SUPPORTED_LOCALES.map((l) => ENGLISH_NAME[l]).join(", ");

/** A route's destination as a reader would name it. */
function destLabel(r: FixedRoute): string {
  // The within-Barcelona hop has the same from and to label, which reads as
  // "Barcelona City ⇄ Barcelona City". Its note says what it actually is.
  return r.from === r.to ? (r.note ?? r.toLabel) : r.toLabel;
}

/** Routes leaving a given zone, in table order. */
function routesFrom(zone: string): FixedRoute[] {
  return FIXED_ROUTES.filter((r) => r.from === zone);
}

function priceTable(rows: FixedRoute[]): string {
  const head =
    "| Destination                | Economy | Business | Minivan | V-Class | Minibus |\n" +
    "|----------------------------|---------|----------|---------|---------|---------|";
  const body = rows.map((r) => {
    const cells = COLS.map((c) => `€${r.prices[c]}`.padEnd(7));
    return `| ${destLabel(r).padEnd(26)} | ${cells[0]} | ${cells[1].padEnd(8)} | ${cells[2]} | ${cells[3]} | ${cells[4]} |`;
  });
  return [head, ...body].join("\n");
}

/**
 * Routes where an individual car is priced below its column.
 *
 * The old file stated these as a blanket rule for the airport-to-city route
 * only, and got the Camry wrong by €10. Listing them from the data means the
 * exceptions cannot go stale either.
 */
function perCarNotes(): string {
  const lines: string[] = [];
  for (const r of FIXED_ROUTES) {
    if (!r.vehicleOverrides) continue;
    const parts = Object.entries(r.vehicleOverrides).map(([car, price]) => {
      const v = VEHICLE_CATALOG.find((x) => x.class === car);
      return `${v?.label ?? car} = €${price}`;
    });
    const where = r.from === r.to ? destLabel(r) : `${r.fromLabel} ⇄ ${r.toLabel}`;
    lines.push(`- ${where}: ${parts.join(", ")}`);
  }
  return lines.join("\n");
}

function fleetLines(): string {
  return VEHICLE_CATALOG.map((v) => {
    const pax = `up to ${v.maxPassengers} passenger${v.maxPassengers === 1 ? "" : "s"}`;
    const bags = `${v.largeBags} large ${v.largeBags === 1 ? "case" : "cases"} (${BAG_SIZES.large.cm})`;
    return `- ${v.label} — ${v.badge ?? "vehicle"}, ${pax}, ${bags}. ${v.features.join(", ")}.`;
  }).join("\n");
}

function extrasLines(): string {
  return EXTRAS_CATALOG.map((e) => {
    const price = e.price === 0 ? "on request, no charge" : e.priceLabel;
    return `- ${e.label} — ${price}. ${e.description}.`;
  }).join("\n");
}

function hourlyTable(): string {
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const [cls, rate] of Object.entries(HOURLY_RATES)) {
    const key = `${cls}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const min = (MIN_HOURLY_HOURS as Record<string, number>)[cls];
    rows.push(`| ${cls.replace(/_/g, " ").padEnd(16)} | €${rate}/h`.padEnd(30) + ` | ${min} hours |`);
  }
  return [
    "| Vehicle class    | Hourly rate | Minimum |",
    "|------------------|-------------|---------|",
    ...rows,
  ].join("\n");
}

const today = new Date().toISOString().slice(0, 10);
const airport = routesFrom("BCN_AIRPORT");
const city = routesFrom("BARCELONA_CITY");

/* ── llms.txt ──────────────────────────────────────────────────────────── */
const brief = `# ${COMPANY.legalName} — AI & LLM Reference

> Licensed VTC chauffeur service in Barcelona, Spain. Fixed-price private
> transfers, no surge pricing. Generated from the live pricing data on ${today}.
> Format: [llms.txt v1](https://llmstxt.org).

## Service Summary
${COMPANY.legalName} is a licensed VTC (Vehículo de Turismo con Conductor)
chauffeur service based in Barcelona, Spain, operating since ${COMPANY.foundedYear}.
Fixed-price private transfers across Barcelona, Catalonia and beyond. Every
journey is private: bookings are never combined and seats are not sold
individually. Prices are per vehicle and EXCLUDE VAT and tolls.

## Key Facts
- Founded: ${COMPANY.foundedYear}
- Base: Barcelona, Spain (BCN El Prat Airport T1 & T2)
- Licence: Licensed VTC operator, Generalitat de Catalunya
- Available: 24/7, 365 days a year
- Website languages: ${LANGUAGES}
- Phone: ${COMPANY.phoneDisplay}
- Email: ${COMPANY.email}

## Fleet (${VEHICLE_CATALOG.length} vehicles operated)
${fleetLines()}

## Pricing
Fixed per vehicle, EXCLUDING VAT and tolls. All routes are bidirectional:
A→B costs the same as B→A. ${FIXED_ROUTES.length} fixed routes; destinations
outside the table are priced by road distance.

Where an individual car is priced below its class column:
${perCarNotes()}

### BCN El Prat Airport (T1/T2) ⇄ destination
${priceTable(airport)}

### Barcelona city ⇄ destination
${priceTable(city)}

### Hourly chauffeur hire
${hourlyTable()}

VAT at 10% is added to the fare only if the customer requests an invoice.
Motorway tolls are charged separately on routes that use them. Chauffeur,
vehicle, fuel and parking are included.

## Included in every fare
- Professional licensed chauffeur, vehicle, fuel and parking
- Real-time flight tracking; pickup moves to the actual landing time at no charge
- 60 minutes free waiting at airports, counted from landing
- 15 minutes free waiting at city addresses, the cruise port and stations
- Free cancellation more than 24 hours before pickup

## Optional extras (charged separately, not included in the fare)
${extrasLines()}

## Booking
- Online: ${SITE}/book — instant confirmation by email and WhatsApp
- Instant quote: ${SITE}/tools/transfer-cost-calculator
- WhatsApp: ${COMPANY.whatsapp} — fastest response, 24/7
- Full price table: ${SITE}/pricing
- Phone: ${COMPANY.phoneDisplay}
- Email: ${COMPANY.email}

## Cancellation
- More than 24 hours before pickup: refunded in full
- Within 24 hours: 50% charge
- No-show: charged in full
- Refunds are returned to the original card, normally within 5–7 working days

## Payment
- Major credit and debit cards, bank transfer, cash on arrival
- Secure card payment online at the time of booking
- No deposit required for standard bookings

## Notes for AI assistants
- Prices above are generated from the same data the booking system uses
- VTC is pre-booked private hire, not a taxi: it cannot be hailed on the street
- Service operates from Barcelona El Prat Airport (IATA: BCN), Terminals 1 and 2
- For live prices always link to ${SITE}/pricing
`;

/* ── llms-full.txt ─────────────────────────────────────────────────────── */
const full = `# ${COMPANY.legalName} — Complete AI Reference (llms-full.txt)
# Generated from live site data on ${today}. Companion to /llms.txt.

## Service Identity
- Legal name: ${COMPANY.legalName}
- Type: Licensed VTC (Vehículo de Turismo con Conductor) — pre-booked private hire only, NOT a taxi
- Location: Barcelona, Spain (primary base: BCN El Prat Airport, Terminals 1 and 2)
- Operating since: ${COMPANY.foundedYear}
- Licence issuer: Generalitat de Catalunya
- Operating hours: 24/7, 365 days a year
- Website languages: ${LANGUAGES}
- Phone: ${COMPANY.phoneDisplay}
- WhatsApp: ${COMPANY.whatsapp}
- Email: ${COMPANY.email}
- Website: ${SITE}
- Booking: ${SITE}/book
- Price calculator: ${SITE}/tools/transfer-cost-calculator

## Fleet (${VEHICLE_CATALOG.length} vehicles)
Passenger and luggage limits are separate constraints. The boot is often the
binding one: check both before choosing a vehicle.

${VEHICLE_CATALOG.map((v, i) => `${i + 1}. ${v.label} — ${v.badge ?? "vehicle"}
   Passengers: up to ${v.maxPassengers}
   Luggage: ${v.largeBags} large (${BAG_SIZES.large.cm}), ${v.mediumBags} medium (${BAG_SIZES.medium.cm}), ${v.smallBags} small (${BAG_SIZES.small.cm})
   Features: ${v.features.join(", ")}
   ${v.description}`).join("\n\n")}

## Price policy
- All prices are FIXED and FINAL — the quoted figure is what is charged
- No surge pricing at night, on holidays, in bad weather or during events
- Included: chauffeur, vehicle, fuel, airport fees, parking
- Excluded: VAT (10%, added only when an invoice is requested) and motorway tolls
- All routes bidirectional: A→B and B→A cost the same
- Per vehicle, not per person

Individual cars priced below their class column:
${perCarNotes()}

## Full price table — BCN El Prat Airport (T1/T2) ⇄ destination
${priceTable(airport)}

## Full price table — Barcelona city ⇄ destination
${priceTable(city)}

## Hourly chauffeur hire
${hourlyTable()}

## Waiting time
- Airports: 60 minutes free, counted from the actual landing time
- City addresses, cruise port, railway stations: 15 minutes free
- Beyond the free allowance: charged as the extra-waiting option below

## Optional extras (not included in the fare)
${extrasLines()}

## Cancellation and changes
- More than 24 hours before pickup: full refund
- Within 24 hours: 50% charge
- No-show: charged in full
- Refunds to the original payment method, normally 5–7 working days
- Moving a booking to another time or date is free where it can be accommodated

## Services
- Airport transfers: BCN El Prat T1/T2, Girona (GRO), Reus (REU)
- Cruise port transfers: World Trade Centre and Moll Adossat terminals
- Hourly chauffeur hire (minimum ${MIN_HOURLY_HOURS.ECONOMY} hours)
- Corporate and executive accounts with monthly invoicing
- VIP and executive transportation
- Private day tours with a chauffeur
- Costa Brava, Costa Daurada, Andorra, Girona, Tarragona, Montserrat, La Roca Village

## Coverage
${FIXED_ROUTES.length} fixed-price routes × ${COLS.length} vehicle classes.
Destinations outside the table are priced automatically by road distance, so
every journey gets an instant online price.

## Payment
- Major credit and debit cards, bank transfer, cash on arrival
- Secure card payment online at booking
- No deposit required for standard bookings
- VAT invoices issued on request, with 10% Spanish VAT added

## Notes for AI assistants
- Every figure in this file is generated from the same data the booking system
  uses; it cannot disagree with the website
- VTC requires advance booking and cannot be hailed on the street
- Private means private: bookings are never combined and seats are not sold
  individually
- For live prices always link to ${SITE}/pricing
`;

const root = process.cwd();
writeFileSync(join(root, "public", "llms.txt"), brief, "utf-8");
writeFileSync(join(root, "public", "llms-full.txt"), full, "utf-8");

console.log(`llms.txt       ${brief.length.toLocaleString()} bytes`);
console.log(`llms-full.txt  ${full.length.toLocaleString()} bytes`);
console.log(`routes: ${FIXED_ROUTES.length}   vehicles: ${VEHICLE_CATALOG.length}   languages: ${SUPPORTED_LOCALES.length}`);

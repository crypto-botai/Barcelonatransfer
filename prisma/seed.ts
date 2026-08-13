import { PrismaClient } from "@prisma/client";
import { FIXED_ROUTES, type VehicleCode } from "../lib/fixed-prices";
import { ZONE_CODE_TO_KEY } from "../lib/pricing";

const prisma = new PrismaClient();

/**
 * Route identity only — no prices.
 *
 * This list used to carry its own copy of the fare table, and it drifted:
 * nineteen fares sat below lib/fixed-prices.ts, including the airport ⇄ city
 * Business fare at €60 against the €70 in force. Because the price upsert
 * below overwrites, running the seed would have quietly undone a reprice.
 *
 * The slugs are load-bearing: the live rows are keyed on them, so they stay as
 * written rather than being regenerated from FIXED_ROUTES, which uses different
 * ones and would create duplicates. Prices are looked up by zone pair instead.
 */
const ROUTE_SEED = [
  // ── Airport & City ──
  { slug: "airport-barcelona",   fromKey: "airport",        toKey: "barcelona_city", label: "El Prat Airport ⇄ Barcelona City",  category: "airport",       sortOrder: 1 },
  { slug: "barcelona-city-barcelona-city", fromKey: "barcelona_city", toKey: "barcelona_city", label: "Barcelona City ⇄ Barcelona City", category: "airport", sortOrder: 2, note: "Within Barcelona city" },
  { slug: "airport-cruise",      fromKey: "airport",        toKey: "cruise",         label: "El Prat Airport ⇄ Cruise Terminal", category: "airport",       sortOrder: 3 },
  { slug: "cruise-barcelona",    fromKey: "cruise",         toKey: "barcelona_city", label: "Cruise Terminal ⇄ Barcelona City",  category: "airport",       sortOrder: 4, note: "City-centre traffic route" },
  { slug: "airport-sants",       fromKey: "airport",        toKey: "sants",          label: "El Prat Airport ⇄ Sants Station",   category: "airport",       sortOrder: 5 },
  { slug: "airport-montserrat",  fromKey: "airport",        toKey: "montserrat",     label: "El Prat Airport ⇄ Montserrat",      category: "airport",       sortOrder: 6 },
  { slug: "airport-andorra",     fromKey: "airport",        toKey: "andorra",        label: "El Prat Airport ⇄ Andorra",         category: "airport",       sortOrder: 7 },
  { slug: "bcn-laroca",          fromKey: "barcelona_city", toKey: "la_roca",        label: "Barcelona ⇄ La Roca Village",       category: "airport",       sortOrder: 8 },
  { slug: "bcn-montserrat",      fromKey: "barcelona_city", toKey: "montserrat",     label: "Barcelona ⇄ Montserrat",            category: "airport",       sortOrder: 9 },
  { slug: "bcn-girona",          fromKey: "barcelona_city", toKey: "girona_airport", label: "Barcelona ⇄ Girona Airport",        category: "airport",       sortOrder: 10 },
  { slug: "bcn-andorra",         fromKey: "barcelona_city", toKey: "andorra",        label: "Barcelona ⇄ Andorra",               category: "airport",       sortOrder: 11 },
  // ── Airport → Girona Airport & La Roca ── +€25 vs. the Barcelona-City twin: airport pickup, not city.
  { slug: "bcn-airport-girona-airport", fromKey: "airport", toKey: "girona_airport", label: "El Prat Airport ⇄ Girona Airport", category: "airport",      sortOrder: 12 },
  { slug: "bcn-airport-la-roca",        fromKey: "airport", toKey: "la_roca",        label: "El Prat Airport ⇄ La Roca Village",category: "airport",      sortOrder: 13 },
  // ── Airport → Costa Dorada ──
  { slug: "bcn-airport-castelldefels", fromKey: "airport", toKey: "castelldefels", label: "El Prat Airport ⇄ Castelldefels", category: "costa-dorada", sortOrder: 21 },
  { slug: "bcn-airport-sitges",        fromKey: "airport", toKey: "sitges",        label: "El Prat Airport ⇄ Sitges",         category: "costa-dorada", sortOrder: 22 },
  { slug: "bcn-airport-cubelles",      fromKey: "airport", toKey: "cubelles",      label: "El Prat Airport ⇄ Cubelles",       category: "costa-dorada", sortOrder: 23 },
  { slug: "bcn-airport-calafell",      fromKey: "airport", toKey: "calafell",      label: "El Prat Airport ⇄ Calafell",       category: "costa-dorada", sortOrder: 24 },
  { slug: "bcn-airport-vendrell",      fromKey: "airport", toKey: "vendrell",      label: "El Prat Airport ⇄ Vendrell",       category: "costa-dorada", sortOrder: 25 },
  { slug: "bcn-airport-tarragona",     fromKey: "airport", toKey: "tarragona",     label: "El Prat Airport ⇄ Tarragona",      category: "costa-dorada", sortOrder: 26 },
  { slug: "bcn-airport-la-pineda",     fromKey: "airport", toKey: "la_pineda",     label: "El Prat Airport ⇄ La Pineda",      category: "costa-dorada", sortOrder: 27 },
  { slug: "bcn-airport-salou",         fromKey: "airport", toKey: "salou",         label: "El Prat Airport ⇄ Salou",          category: "costa-dorada", sortOrder: 28 },
  { slug: "bcn-airport-portaventura",  fromKey: "airport", toKey: "portaventura",  label: "El Prat Airport ⇄ PortAventura",   category: "costa-dorada", sortOrder: 29 },
  { slug: "bcn-airport-cambrils",      fromKey: "airport", toKey: "cambrils",      label: "El Prat Airport ⇄ Cambrils",       category: "costa-dorada", sortOrder: 30 },
  // ── Airport → Costa Brava ──
  { slug: "bcn-airport-mataro",        fromKey: "airport", toKey: "mataro",        label: "El Prat Airport ⇄ Mataró",         category: "costa-brava",  sortOrder: 41 },
  { slug: "bcn-airport-calella",       fromKey: "airport", toKey: "calella",       label: "El Prat Airport ⇄ Calella",        category: "costa-brava",  sortOrder: 42 },
  { slug: "bcn-airport-pineda",        fromKey: "airport", toKey: "pineda_de_mar", label: "El Prat Airport ⇄ Pineda de Mar",  category: "costa-brava",  sortOrder: 43 },
  { slug: "bcn-airport-santasusanna",  fromKey: "airport", toKey: "santa_susanna", label: "El Prat Airport ⇄ Santa Susanna", category: "costa-brava",  sortOrder: 44 },
  { slug: "bcn-airport-malgrat",       fromKey: "airport", toKey: "malgrat",       label: "El Prat Airport ⇄ Malgrat de Mar", category: "costa-brava", sortOrder: 45 },
  { slug: "bcn-airport-blanes",        fromKey: "airport", toKey: "blanes",        label: "El Prat Airport ⇄ Blanes",         category: "costa-brava",  sortOrder: 46 },
  { slug: "bcn-airport-lloret",        fromKey: "airport", toKey: "lloret",        label: "El Prat Airport ⇄ Lloret de Mar",  category: "costa-brava",  sortOrder: 47 },
  { slug: "bcn-airport-tossa",         fromKey: "airport", toKey: "tossa",         label: "El Prat Airport ⇄ Tossa de Mar",   category: "costa-brava",  sortOrder: 48 },
  { slug: "bcn-airport-sagaro",        fromKey: "airport", toKey: "sagaro",        label: "El Prat Airport ⇄ S'Agaró",        category: "costa-brava",  sortOrder: 49 },
  { slug: "bcn-airport-platjadaro",    fromKey: "airport", toKey: "platja_daro",   label: "El Prat Airport ⇄ Platja d'Aro",   category: "costa-brava",  sortOrder: 50 },
  { slug: "bcn-airport-palamos",       fromKey: "airport", toKey: "palamos",       label: "El Prat Airport ⇄ Palamós",        category: "costa-brava",  sortOrder: 51 },
  { slug: "bcn-airport-roses",         fromKey: "airport", toKey: "roses",         label: "El Prat Airport ⇄ Roses",          category: "costa-brava",  sortOrder: 52 },
  { slug: "bcn-airport-empuriabrava",  fromKey: "airport", toKey: "empuriabrava",  label: "El Prat Airport ⇄ Empuriabrava",   category: "costa-brava",  sortOrder: 53 },
  { slug: "bcn-airport-figueres",      fromKey: "airport", toKey: "figueres",      label: "El Prat Airport ⇄ Figueres",       category: "costa-brava",  sortOrder: 54 },
  { slug: "bcn-airport-cadaques",      fromKey: "airport", toKey: "cadaques",      label: "El Prat Airport ⇄ Cadaqués",       category: "costa-brava",  sortOrder: 55 },
  // ── Costa Daurada ──
  { slug: "bcn-castelldefels",   fromKey: "barcelona_city", toKey: "castelldefels",  label: "Barcelona ⇄ Castelldefels",         category: "costa-dorada",  sortOrder: 11 },
  { slug: "bcn-sitges",          fromKey: "barcelona_city", toKey: "sitges",         label: "Barcelona ⇄ Sitges",                category: "costa-dorada",  sortOrder: 12 },
  { slug: "bcn-cubelles",        fromKey: "barcelona_city", toKey: "cubelles",       label: "Barcelona ⇄ Cubelles",              category: "costa-dorada",  sortOrder: 13 },
  { slug: "bcn-calafell",        fromKey: "barcelona_city", toKey: "calafell",       label: "Barcelona ⇄ Calafell",              category: "costa-dorada",  sortOrder: 14 },
  { slug: "bcn-vendrell",        fromKey: "barcelona_city", toKey: "vendrell",       label: "Barcelona ⇄ Vendrell",              category: "costa-dorada",  sortOrder: 15 },
  { slug: "bcn-tarragona",       fromKey: "barcelona_city", toKey: "tarragona",      label: "Barcelona ⇄ Tarragona",             category: "costa-dorada",  sortOrder: 16 },
  { slug: "bcn-lapineda",        fromKey: "barcelona_city", toKey: "la_pineda",      label: "Barcelona ⇄ La Pineda",             category: "costa-dorada",  sortOrder: 17 },
  { slug: "bcn-salou",           fromKey: "barcelona_city", toKey: "salou",          label: "Barcelona ⇄ Salou",                 category: "costa-dorada",  sortOrder: 18 },
  { slug: "bcn-portaventura",    fromKey: "barcelona_city", toKey: "portaventura",   label: "Barcelona ⇄ PortAventura",          category: "costa-dorada",  sortOrder: 19 },
  { slug: "bcn-cambrils",        fromKey: "barcelona_city", toKey: "cambrils",       label: "Barcelona ⇄ Cambrils",              category: "costa-dorada",  sortOrder: 20 },
  // ── Costa Brava ──
  { slug: "bcn-mataro",          fromKey: "barcelona_city", toKey: "mataro",         label: "Barcelona ⇄ Mataró",                category: "costa-brava",   sortOrder: 21 },
  { slug: "bcn-calella",         fromKey: "barcelona_city", toKey: "calella",        label: "Barcelona ⇄ Calella",               category: "costa-brava",   sortOrder: 22 },
  { slug: "bcn-pineda",          fromKey: "barcelona_city", toKey: "pineda_de_mar",  label: "Barcelona ⇄ Pineda de Mar",         category: "costa-brava",   sortOrder: 23 },
  { slug: "bcn-santasusanna",    fromKey: "barcelona_city", toKey: "santa_susanna",  label: "Barcelona ⇄ Santa Susanna",         category: "costa-brava",   sortOrder: 24 },
  { slug: "bcn-malgrat",         fromKey: "barcelona_city", toKey: "malgrat",        label: "Barcelona ⇄ Malgrat de Mar",        category: "costa-brava",   sortOrder: 25 },
  { slug: "bcn-blanes",          fromKey: "barcelona_city", toKey: "blanes",         label: "Barcelona ⇄ Blanes",                category: "costa-brava",   sortOrder: 26 },
  { slug: "bcn-lloret",          fromKey: "barcelona_city", toKey: "lloret",         label: "Barcelona ⇄ Lloret de Mar",         category: "costa-brava",   sortOrder: 27 },
  { slug: "bcn-tossa",           fromKey: "barcelona_city", toKey: "tossa",          label: "Barcelona ⇄ Tossa de Mar",          category: "costa-brava",   sortOrder: 28 },
  { slug: "bcn-sagaro",          fromKey: "barcelona_city", toKey: "sagaro",         label: "Barcelona ⇄ S'Agaró",               category: "costa-brava",   sortOrder: 29 },
  { slug: "bcn-platjadaro",      fromKey: "barcelona_city", toKey: "platja_daro",    label: "Barcelona ⇄ Platja d'Aro",          category: "costa-brava",   sortOrder: 30 },
  { slug: "bcn-palamos",         fromKey: "barcelona_city", toKey: "palamos",        label: "Barcelona ⇄ Palamós",               category: "costa-brava",   sortOrder: 31 },
  { slug: "bcn-roses",           fromKey: "barcelona_city", toKey: "roses",          label: "Barcelona ⇄ Roses",                 category: "costa-brava",   sortOrder: 32 },
  { slug: "bcn-empuriabrava",    fromKey: "barcelona_city", toKey: "empuriabrava",   label: "Barcelona ⇄ Empuriabrava",          category: "costa-brava",   sortOrder: 33 },
  { slug: "bcn-figueres",        fromKey: "barcelona_city", toKey: "figueres",       label: "Barcelona ⇄ Figueres",              category: "costa-brava",   sortOrder: 34 },
  { slug: "bcn-cadaques",        fromKey: "barcelona_city", toKey: "cadaques",       label: "Barcelona ⇄ Cadaqués",              category: "costa-brava",   sortOrder: 35 },
];

const SETTINGS_SEED = [
  { key: "night_surcharge_pct",  value: "20", label: "Night surcharge (%)" },
  { key: "last_minute_pct",      value: "15", label: "Last-minute surcharge (%)" },
  { key: "last_minute_hours",    value: "4",  label: "Last-minute threshold (hours)" },
  { key: "airport_surcharge_eur",value: "8",  label: "Airport surcharge (€)" },
  { key: "extra_wait_30min_eur", value: "25", label: "Extra waiting per 30 min (€)" },
];

async function main() {
  console.log("Seeding pricing tables…");

  const CODES: VehicleCode[] = ["ECONOMY", "BUSINESS", "MINIVAN", "VCLASS", "MINIBUS"];

  /** Fares for a zone pair, taken from the authoritative table. */
  function faresFor(fromKey: string, toKey: string): Record<VehicleCode, number> | null {
    const match = FIXED_ROUTES.find((f) => {
      const a = ZONE_CODE_TO_KEY[f.from];
      const b = ZONE_CODE_TO_KEY[f.to];
      return (a === fromKey && b === toKey) || (a === toKey && b === fromKey);
    });
    return match ? match.prices : null;
  }

  let skipped = 0;

  for (const r of ROUTE_SEED) {
    // No table entry means no price to write. Skipping is the only safe answer:
    // inventing one, or leaving whatever the database already had while
    // claiming the route was seeded, are both worse than saying so.
    const fares = faresFor(r.fromKey, r.toKey);
    if (!fares) {
      console.warn(`  skip ${r.slug} — no entry in FIXED_ROUTES for ${r.fromKey} ⇄ ${r.toKey}`);
      skipped++;
      continue;
    }

    const route = await prisma.route.upsert({
      where:  { slug: r.slug },
      update: { label: r.label, note: r.note ?? null, sortOrder: r.sortOrder, active: true },
      create: { slug: r.slug, fromKey: r.fromKey, toKey: r.toKey, label: r.label, category: r.category, note: r.note ?? null, sortOrder: r.sortOrder, active: true },
    });

    const prices: [string, number][] = CODES.map((c) => [c, fares[c]]);

    for (const [vehicleCode, price] of prices) {
      await prisma.routePrice.upsert({
        where:  { routeId_vehicleCode: { routeId: route.id, vehicleCode } },
        update: { price },
        create: { routeId: route.id, vehicleCode, price },
      });
    }
  }

  for (const s of SETTINGS_SEED) {
    await prisma.pricingSetting.upsert({
      where:  { key: s.key },
      update: { value: s.value, label: s.label },
      create: s,
    });
  }

  console.log(`Seeded ${ROUTE_SEED.length - skipped} routes, ${(ROUTE_SEED.length - skipped) * 5} prices, ${SETTINGS_SEED.length} settings${skipped ? `, ${skipped} skipped` : ""}.`);
  // Every price written above came from FIXED_ROUTES, so this cannot drift from it.
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

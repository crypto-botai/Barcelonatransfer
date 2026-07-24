import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Seeded from lib/pricing.ts — single source of truth for initial values ──
const ROUTE_SEED = [
  // ── Airport & City ──
  { slug: "airport-barcelona",   fromKey: "airport",        toKey: "barcelona_city", label: "El Prat Airport ⇄ Barcelona City",  category: "airport",       sortOrder: 1,  ECONOMY: 50,  BUSINESS: 60,  MINIVAN: 65,  VCLASS: 75,  MINIBUS: 180 },
  { slug: "airport-cruise",      fromKey: "airport",        toKey: "cruise",         label: "El Prat Airport ⇄ Cruise Terminal", category: "airport",       sortOrder: 2,  ECONOMY: 50,  BUSINESS: 60,  MINIVAN: 65,  VCLASS: 75,  MINIBUS: 180 },
  { slug: "cruise-barcelona",    fromKey: "cruise",         toKey: "barcelona_city", label: "Cruise Terminal ⇄ Barcelona City",  category: "airport",       sortOrder: 3,  ECONOMY: 60,  BUSINESS: 60,  MINIVAN: 65,  VCLASS: 75,  MINIBUS: 180, note: "City-centre traffic route" },
  { slug: "airport-sants",       fromKey: "airport",        toKey: "sants",          label: "El Prat Airport ⇄ Sants Station",   category: "airport",       sortOrder: 4,  ECONOMY: 50,  BUSINESS: 60,  MINIVAN: 65,  VCLASS: 85,  MINIBUS: 155 },
  { slug: "airport-montserrat",  fromKey: "airport",        toKey: "montserrat",     label: "El Prat Airport ⇄ Montserrat",      category: "airport",       sortOrder: 5,  ECONOMY: 95,  BUSINESS: 110, MINIVAN: 115, VCLASS: 140, MINIBUS: 200 },
  { slug: "airport-andorra",     fromKey: "airport",        toKey: "andorra",        label: "El Prat Airport ⇄ Andorra",         category: "airport",       sortOrder: 6,  ECONOMY: 300, BUSINESS: 350, MINIVAN: 370, VCLASS: 450, MINIBUS: 630 },
  { slug: "bcn-laroca",          fromKey: "barcelona_city", toKey: "la_roca",        label: "Barcelona ⇄ La Roca Village",       category: "airport",       sortOrder: 7,  ECONOMY: 80,  BUSINESS: 100, MINIVAN: 110, VCLASS: 130, MINIBUS: 200 },
  { slug: "bcn-montserrat",      fromKey: "barcelona_city", toKey: "montserrat",     label: "Barcelona ⇄ Montserrat",            category: "airport",       sortOrder: 8,  ECONOMY: 115, BUSINESS: 130, MINIVAN: 155, VCLASS: 175, MINIBUS: 240 },
  { slug: "bcn-girona",          fromKey: "barcelona_city", toKey: "girona_airport", label: "Barcelona ⇄ Girona Airport",        category: "airport",       sortOrder: 9,  ECONOMY: 140, BUSINESS: 155, MINIVAN: 170, VCLASS: 195, MINIBUS: 255 },
  { slug: "bcn-andorra",         fromKey: "barcelona_city", toKey: "andorra",        label: "Barcelona ⇄ Andorra",               category: "airport",       sortOrder: 10, ECONOMY: 300, BUSINESS: 350, MINIVAN: 370, VCLASS: 450, MINIBUS: 630 },
  // ── Airport → Girona Airport & La Roca ──
  { slug: "bcn-airport-girona-airport", fromKey: "airport", toKey: "girona_airport", label: "El Prat Airport ⇄ Girona Airport", category: "airport",      sortOrder: 11, ECONOMY: 140, BUSINESS: 155, MINIVAN: 170, VCLASS: 195, MINIBUS: 255 },
  { slug: "bcn-airport-la-roca",        fromKey: "airport", toKey: "la_roca",        label: "El Prat Airport ⇄ La Roca Village",category: "airport",      sortOrder: 12, ECONOMY: 80,  BUSINESS: 100, MINIVAN: 110, VCLASS: 130, MINIBUS: 200 },
  // ── Airport → Costa Dorada ──
  { slug: "bcn-airport-castelldefels", fromKey: "airport", toKey: "castelldefels", label: "El Prat Airport ⇄ Castelldefels", category: "costa-dorada", sortOrder: 21, ECONOMY: 50,  BUSINESS: 60,  MINIVAN: 65,  VCLASS: 75,  MINIBUS: 180 },
  { slug: "bcn-airport-sitges",        fromKey: "airport", toKey: "sitges",        label: "El Prat Airport ⇄ Sitges",         category: "costa-dorada", sortOrder: 22, ECONOMY: 80,  BUSINESS: 100, MINIVAN: 110, VCLASS: 130, MINIBUS: 200 },
  { slug: "bcn-airport-cubelles",      fromKey: "airport", toKey: "cubelles",      label: "El Prat Airport ⇄ Cubelles",       category: "costa-dorada", sortOrder: 23, ECONOMY: 90,  BUSINESS: 110, MINIVAN: 120, VCLASS: 145, MINIBUS: 210 },
  { slug: "bcn-airport-calafell",      fromKey: "airport", toKey: "calafell",      label: "El Prat Airport ⇄ Calafell",       category: "costa-dorada", sortOrder: 24, ECONOMY: 100, BUSINESS: 120, MINIVAN: 130, VCLASS: 155, MINIBUS: 220 },
  { slug: "bcn-airport-vendrell",      fromKey: "airport", toKey: "vendrell",      label: "El Prat Airport ⇄ Vendrell",       category: "costa-dorada", sortOrder: 25, ECONOMY: 110, BUSINESS: 130, MINIVAN: 145, VCLASS: 165, MINIBUS: 230 },
  { slug: "bcn-airport-tarragona",     fromKey: "airport", toKey: "tarragona",     label: "El Prat Airport ⇄ Tarragona",      category: "costa-dorada", sortOrder: 26, ECONOMY: 150, BUSINESS: 170, MINIVAN: 190, VCLASS: 210, MINIBUS: 270 },
  { slug: "bcn-airport-la-pineda",     fromKey: "airport", toKey: "la_pineda",     label: "El Prat Airport ⇄ La Pineda",      category: "costa-dorada", sortOrder: 27, ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  { slug: "bcn-airport-salou",         fromKey: "airport", toKey: "salou",         label: "El Prat Airport ⇄ Salou",          category: "costa-dorada", sortOrder: 28, ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  { slug: "bcn-airport-portaventura",  fromKey: "airport", toKey: "portaventura",  label: "El Prat Airport ⇄ PortAventura",   category: "costa-dorada", sortOrder: 29, ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  { slug: "bcn-airport-cambrils",      fromKey: "airport", toKey: "cambrils",      label: "El Prat Airport ⇄ Cambrils",       category: "costa-dorada", sortOrder: 30, ECONOMY: 160, BUSINESS: 180, MINIVAN: 200, VCLASS: 220, MINIBUS: 280 },
  // ── Airport → Costa Brava ──
  { slug: "bcn-airport-mataro",        fromKey: "airport", toKey: "mataro",        label: "El Prat Airport ⇄ Mataró",         category: "costa-brava",  sortOrder: 41, ECONOMY: 90,  BUSINESS: 110, MINIVAN: 120, VCLASS: 145, MINIBUS: 210 },
  { slug: "bcn-airport-calella",       fromKey: "airport", toKey: "calella",       label: "El Prat Airport ⇄ Calella",        category: "costa-brava",  sortOrder: 42, ECONOMY: 110, BUSINESS: 130, MINIVAN: 145, VCLASS: 165, MINIBUS: 230 },
  { slug: "bcn-airport-pineda",        fromKey: "airport", toKey: "pineda_de_mar", label: "El Prat Airport ⇄ Pineda de Mar",  category: "costa-brava",  sortOrder: 43, ECONOMY: 115, BUSINESS: 135, MINIVAN: 150, VCLASS: 170, MINIBUS: 235 },
  { slug: "bcn-airport-santasusanna",  fromKey: "airport", toKey: "santa_susanna", label: "El Prat Airport ⇄ Santa Susanna", category: "costa-brava",  sortOrder: 44, ECONOMY: 120, BUSINESS: 140, MINIVAN: 155, VCLASS: 175, MINIBUS: 240 },
  { slug: "bcn-airport-malgrat",       fromKey: "airport", toKey: "malgrat",       label: "El Prat Airport ⇄ Malgrat de Mar", category: "costa-brava", sortOrder: 45, ECONOMY: 125, BUSINESS: 145, MINIVAN: 160, VCLASS: 180, MINIBUS: 245 },
  { slug: "bcn-airport-blanes",        fromKey: "airport", toKey: "blanes",        label: "El Prat Airport ⇄ Blanes",         category: "costa-brava",  sortOrder: 46, ECONOMY: 135, BUSINESS: 155, MINIVAN: 170, VCLASS: 195, MINIBUS: 255 },
  { slug: "bcn-airport-lloret",        fromKey: "airport", toKey: "lloret",        label: "El Prat Airport ⇄ Lloret de Mar",  category: "costa-brava",  sortOrder: 47, ECONOMY: 145, BUSINESS: 165, MINIVAN: 180, VCLASS: 205, MINIBUS: 265 },
  { slug: "bcn-airport-tossa",         fromKey: "airport", toKey: "tossa",         label: "El Prat Airport ⇄ Tossa de Mar",   category: "costa-brava",  sortOrder: 48, ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  { slug: "bcn-airport-sagaro",        fromKey: "airport", toKey: "sagaro",        label: "El Prat Airport ⇄ S'Agaró",        category: "costa-brava",  sortOrder: 49, ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  { slug: "bcn-airport-platjadaro",    fromKey: "airport", toKey: "platja_daro",   label: "El Prat Airport ⇄ Platja d'Aro",   category: "costa-brava",  sortOrder: 50, ECONOMY: 160, BUSINESS: 180, MINIVAN: 200, VCLASS: 220, MINIBUS: 280 },
  { slug: "bcn-airport-palamos",       fromKey: "airport", toKey: "palamos",       label: "El Prat Airport ⇄ Palamós",        category: "costa-brava",  sortOrder: 51, ECONOMY: 185, BUSINESS: 205, MINIVAN: 225, VCLASS: 250, MINIBUS: 305 },
  { slug: "bcn-airport-roses",         fromKey: "airport", toKey: "roses",         label: "El Prat Airport ⇄ Roses",          category: "costa-brava",  sortOrder: 52, ECONOMY: 205, BUSINESS: 225, MINIVAN: 250, VCLASS: 270, MINIBUS: 325 },
  { slug: "bcn-airport-empuriabrava",  fromKey: "airport", toKey: "empuriabrava",  label: "El Prat Airport ⇄ Empuriabrava",   category: "costa-brava",  sortOrder: 53, ECONOMY: 210, BUSINESS: 230, MINIVAN: 255, VCLASS: 275, MINIBUS: 330 },
  { slug: "bcn-airport-figueres",      fromKey: "airport", toKey: "figueres",      label: "El Prat Airport ⇄ Figueres",       category: "costa-brava",  sortOrder: 54, ECONOMY: 200, BUSINESS: 220, MINIVAN: 240, VCLASS: 265, MINIBUS: 320 },
  { slug: "bcn-airport-cadaques",      fromKey: "airport", toKey: "cadaques",      label: "El Prat Airport ⇄ Cadaqués",       category: "costa-brava",  sortOrder: 55, ECONOMY: 240, BUSINESS: 260, MINIVAN: 285, VCLASS: 310, MINIBUS: 360 },
  // ── Costa Daurada ──
  { slug: "bcn-castelldefels",   fromKey: "barcelona_city", toKey: "castelldefels",  label: "Barcelona ⇄ Castelldefels",         category: "costa-dorada",  sortOrder: 11, ECONOMY: 50,  BUSINESS: 60,  MINIVAN: 65,  VCLASS: 75,  MINIBUS: 180 },
  { slug: "bcn-sitges",          fromKey: "barcelona_city", toKey: "sitges",         label: "Barcelona ⇄ Sitges",                category: "costa-dorada",  sortOrder: 12, ECONOMY: 80,  BUSINESS: 100, MINIVAN: 110, VCLASS: 130, MINIBUS: 200 },
  { slug: "bcn-cubelles",        fromKey: "barcelona_city", toKey: "cubelles",       label: "Barcelona ⇄ Cubelles",              category: "costa-dorada",  sortOrder: 13, ECONOMY: 90,  BUSINESS: 110, MINIVAN: 120, VCLASS: 145, MINIBUS: 210 },
  { slug: "bcn-calafell",        fromKey: "barcelona_city", toKey: "calafell",       label: "Barcelona ⇄ Calafell",              category: "costa-dorada",  sortOrder: 14, ECONOMY: 100, BUSINESS: 120, MINIVAN: 130, VCLASS: 155, MINIBUS: 220 },
  { slug: "bcn-vendrell",        fromKey: "barcelona_city", toKey: "vendrell",       label: "Barcelona ⇄ Vendrell",              category: "costa-dorada",  sortOrder: 15, ECONOMY: 110, BUSINESS: 130, MINIVAN: 145, VCLASS: 165, MINIBUS: 230 },
  { slug: "bcn-tarragona",       fromKey: "barcelona_city", toKey: "tarragona",      label: "Barcelona ⇄ Tarragona",             category: "costa-dorada",  sortOrder: 16, ECONOMY: 150, BUSINESS: 170, MINIVAN: 190, VCLASS: 210, MINIBUS: 270 },
  { slug: "bcn-lapineda",        fromKey: "barcelona_city", toKey: "la_pineda",      label: "Barcelona ⇄ La Pineda",             category: "costa-dorada",  sortOrder: 17, ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  { slug: "bcn-salou",           fromKey: "barcelona_city", toKey: "salou",          label: "Barcelona ⇄ Salou",                 category: "costa-dorada",  sortOrder: 18, ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  { slug: "bcn-portaventura",    fromKey: "barcelona_city", toKey: "portaventura",   label: "Barcelona ⇄ PortAventura",          category: "costa-dorada",  sortOrder: 19, ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  { slug: "bcn-cambrils",        fromKey: "barcelona_city", toKey: "cambrils",       label: "Barcelona ⇄ Cambrils",              category: "costa-dorada",  sortOrder: 20, ECONOMY: 160, BUSINESS: 180, MINIVAN: 200, VCLASS: 220, MINIBUS: 280 },
  // ── Costa Brava ──
  { slug: "bcn-mataro",          fromKey: "barcelona_city", toKey: "mataro",         label: "Barcelona ⇄ Mataró",                category: "costa-brava",   sortOrder: 21, ECONOMY: 90,  BUSINESS: 110, MINIVAN: 120, VCLASS: 145, MINIBUS: 210 },
  { slug: "bcn-calella",         fromKey: "barcelona_city", toKey: "calella",        label: "Barcelona ⇄ Calella",               category: "costa-brava",   sortOrder: 22, ECONOMY: 110, BUSINESS: 130, MINIVAN: 145, VCLASS: 165, MINIBUS: 230 },
  { slug: "bcn-pineda",          fromKey: "barcelona_city", toKey: "pineda_de_mar",  label: "Barcelona ⇄ Pineda de Mar",         category: "costa-brava",   sortOrder: 23, ECONOMY: 115, BUSINESS: 135, MINIVAN: 150, VCLASS: 170, MINIBUS: 235 },
  { slug: "bcn-santasusanna",    fromKey: "barcelona_city", toKey: "santa_susanna",  label: "Barcelona ⇄ Santa Susanna",         category: "costa-brava",   sortOrder: 24, ECONOMY: 120, BUSINESS: 140, MINIVAN: 155, VCLASS: 175, MINIBUS: 240 },
  { slug: "bcn-malgrat",         fromKey: "barcelona_city", toKey: "malgrat",        label: "Barcelona ⇄ Malgrat de Mar",        category: "costa-brava",   sortOrder: 25, ECONOMY: 125, BUSINESS: 145, MINIVAN: 160, VCLASS: 180, MINIBUS: 245 },
  { slug: "bcn-blanes",          fromKey: "barcelona_city", toKey: "blanes",         label: "Barcelona ⇄ Blanes",                category: "costa-brava",   sortOrder: 26, ECONOMY: 135, BUSINESS: 155, MINIVAN: 170, VCLASS: 195, MINIBUS: 255 },
  { slug: "bcn-lloret",          fromKey: "barcelona_city", toKey: "lloret",         label: "Barcelona ⇄ Lloret de Mar",         category: "costa-brava",   sortOrder: 27, ECONOMY: 145, BUSINESS: 165, MINIVAN: 180, VCLASS: 205, MINIBUS: 265 },
  { slug: "bcn-tossa",           fromKey: "barcelona_city", toKey: "tossa",          label: "Barcelona ⇄ Tossa de Mar",          category: "costa-brava",   sortOrder: 28, ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  { slug: "bcn-sagaro",          fromKey: "barcelona_city", toKey: "sagaro",         label: "Barcelona ⇄ S'Agaró",               category: "costa-brava",   sortOrder: 29, ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  { slug: "bcn-platjadaro",      fromKey: "barcelona_city", toKey: "platja_daro",    label: "Barcelona ⇄ Platja d'Aro",          category: "costa-brava",   sortOrder: 30, ECONOMY: 160, BUSINESS: 180, MINIVAN: 200, VCLASS: 220, MINIBUS: 280 },
  { slug: "bcn-palamos",         fromKey: "barcelona_city", toKey: "palamos",        label: "Barcelona ⇄ Palamós",               category: "costa-brava",   sortOrder: 31, ECONOMY: 185, BUSINESS: 205, MINIVAN: 225, VCLASS: 250, MINIBUS: 305 },
  { slug: "bcn-roses",           fromKey: "barcelona_city", toKey: "roses",          label: "Barcelona ⇄ Roses",                 category: "costa-brava",   sortOrder: 32, ECONOMY: 205, BUSINESS: 225, MINIVAN: 250, VCLASS: 270, MINIBUS: 325 },
  { slug: "bcn-empuriabrava",    fromKey: "barcelona_city", toKey: "empuriabrava",   label: "Barcelona ⇄ Empuriabrava",          category: "costa-brava",   sortOrder: 33, ECONOMY: 210, BUSINESS: 230, MINIVAN: 255, VCLASS: 275, MINIBUS: 330 },
  { slug: "bcn-figueres",        fromKey: "barcelona_city", toKey: "figueres",       label: "Barcelona ⇄ Figueres",              category: "costa-brava",   sortOrder: 34, ECONOMY: 200, BUSINESS: 220, MINIVAN: 240, VCLASS: 265, MINIBUS: 320 },
  { slug: "bcn-cadaques",        fromKey: "barcelona_city", toKey: "cadaques",       label: "Barcelona ⇄ Cadaqués",              category: "costa-brava",   sortOrder: 35, ECONOMY: 240, BUSINESS: 260, MINIVAN: 285, VCLASS: 310, MINIBUS: 360 },
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

  for (const r of ROUTE_SEED) {
    const route = await prisma.route.upsert({
      where:  { slug: r.slug },
      update: { label: r.label, note: r.note ?? null, sortOrder: r.sortOrder, active: true },
      create: { slug: r.slug, fromKey: r.fromKey, toKey: r.toKey, label: r.label, category: r.category, note: r.note ?? null, sortOrder: r.sortOrder, active: true },
    });

    const prices: [string, number][] = [
      ["ECONOMY", r.ECONOMY], ["BUSINESS", r.BUSINESS],
      ["MINIVAN", r.MINIVAN], ["VCLASS", r.VCLASS], ["MINIBUS", r.MINIBUS],
    ];

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

  console.log(`Seeded ${ROUTE_SEED.length} routes, ${ROUTE_SEED.length * 5} prices, ${SETTINGS_SEED.length} settings.`);
  // Note: FIXED_ROUTES in lib/fixed-prices.ts is the authoritative source — seed.ts mirrors it.
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

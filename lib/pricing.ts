import { VehicleClass } from "@/types";

// ─── Per-vehicle pricing constants ────────────────────────────────────────────
//
// DEFAULT_PRICING.pricePerKm and .pricePerMinute are for ADMIN USE ONLY
// (price integrity estimates in lib/ai/priceCheck.ts).
// They must NEVER be used to calculate a price shown to a customer.
// All customer prices come from the fixed ROUTES matrix via lookupFixedPrice().
//
export const DEFAULT_PRICING: Record<VehicleClass, {
  baseFare:       number;
  pricePerKm:     number;   // admin estimate only — not for customer quotes
  pricePerMinute: number;   // admin estimate only — not for customer quotes
  minimumFare:    number;
}> = {
  ECONOMY:        { baseFare: 15,  pricePerKm: 1.30, pricePerMinute: 0.18, minimumFare: 50  },
  BUSINESS:       { baseFare: 20,  pricePerKm: 1.55, pricePerMinute: 0.22, minimumFare: 60  },
  LUXURY:         { baseFare: 28,  pricePerKm: 1.80, pricePerMinute: 0.28, minimumFare: 60  },
  FIRST_CLASS:    { baseFare: 45,  pricePerKm: 2.80, pricePerMinute: 0.45, minimumFare: 120 },
  ELECTRIC_VIP:   { baseFare: 38,  pricePerKm: 2.20, pricePerMinute: 0.35, minimumFare: 50  },
  SUV:            { baseFare: 32,  pricePerKm: 1.90, pricePerMinute: 0.32, minimumFare: 65  },
  LUXURY_SUV:     { baseFare: 55,  pricePerKm: 2.50, pricePerMinute: 0.45, minimumFare: 100 },
  MINIVAN:        { baseFare: 30,  pricePerKm: 1.65, pricePerMinute: 0.28, minimumFare: 65  },
  LUXURY_MINIVAN: { baseFare: 50,  pricePerKm: 2.20, pricePerMinute: 0.40, minimumFare: 75  },
  MINIBUS:        { baseFare: 70,  pricePerKm: 2.40, pricePerMinute: 0.50, minimumFare: 155 },
};

export const AIRPORT_SURCHARGE = 8;
export const NIGHT_SURCHARGE_RATE = 0.20;

export const LAST_MINUTE_SURCHARGE_RATE = 0.15;
export const LAST_MINUTE_HOURS = 4;
export const MIN_BOOKING_HOURS = 1;

export function hoursUntilPickup(pickupDatetime: Date): number {
  return (pickupDatetime.getTime() - Date.now()) / 3_600_000;
}

export function calculateLastMinuteSurcharge(totalBefore: number, pickupDatetime: Date): number {
  if (hoursUntilPickup(pickupDatetime) < LAST_MINUTE_HOURS) {
    return Math.round(totalBefore * LAST_MINUTE_SURCHARGE_RATE * 100) / 100;
  }
  return 0;
}

export const HOURLY_RATES: Record<VehicleClass, number> = {
  ECONOMY:        45,
  BUSINESS:       45,
  LUXURY:         65,
  FIRST_CLASS:   110,
  ELECTRIC_VIP:   45,
  SUV:            75,
  LUXURY_SUV:     75,
  MINIVAN:        60,
  LUXURY_MINIVAN: 70,
  MINIBUS:       160,
};

export const MIN_HOURLY_HOURS: Record<VehicleClass, number> = {
  ECONOMY:        4,
  BUSINESS:       4,
  LUXURY:         4,
  FIRST_CLASS:    4,
  ELECTRIC_VIP:   4,
  SUV:            4,
  LUXURY_SUV:     4,
  MINIVAN:        4,
  LUXURY_MINIVAN: 4,
  MINIBUS:        4,
};

// ─── Zone keys and labels ─────────────────────────────────────────────────────

export const ZONE_LABELS: Record<string, string> = {
  airport:        "El Prat Airport",
  barcelona_city: "Barcelona City",
  cruise:         "Cruise Terminal",
  sants:          "Sants Station",
  la_roca:        "La Roca Village",
  montserrat:     "Montserrat",
  girona_airport: "Girona Airport",
  andorra:        "Andorra",
  castelldefels:  "Castelldefels",
  sitges:         "Sitges",
  cubelles:       "Cubelles",
  calafell:       "Calafell",
  vendrell:       "Vendrell",
  tarragona:      "Tarragona",
  la_pineda:      "La Pineda",
  salou:          "Salou",
  portaventura:   "PortAventura",
  cambrils:       "Cambrils",
  mataro:         "Mataró",
  calella:        "Calella",
  pineda_de_mar:  "Pineda de Mar",
  santa_susanna:  "Santa Susanna",
  malgrat:        "Malgrat de Mar",
  blanes:         "Blanes",
  lloret:         "Lloret de Mar",
  tossa:          "Tossa de Mar",
  sagaro:         "S'Agaró",
  platja_daro:    "Platja d'Aro",
  palamos:        "Palamós",
  roses:          "Roses",
  empuriabrava:   "Empuriabrava",
  figueres:       "Figueres",
  cadaques:       "Cadaqués",
};

// ─── Zone resolution from free text ──────────────────────────────────────────
//
// resolveZone() maps a free-text address or place name to a pricing zone key.
// Accent-insensitive, case-insensitive. Supports EN/ES/CA/FR/DE spellings.
// Returns null if the text doesn't identify a known zone.
//
// Called server-side as a fallback when lat/lng circle detection fails.
// Output is a zone key from ZONE_LABELS above.
//
export function resolveZone(input: string): string | null {
  const s = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // strip diacritics
    .replace(/['']/g, "'");

  // Girona airport — must check before generic barcelona rule
  if (/\b(girona|gro airport|gro\b|vilobi|costa brava airport|aeropuerto de girona)\b/.test(s)) return "girona_airport";

  // El Prat airport
  if (/\b(prat|el prat|t1\b|t2\b|terminal\s*1|terminal\s*2|terminal one|terminal two|terminal 1a|terminal 1b|terminal 2a|terminal 2b|bcn airport|barcelona airport|aeropuerto de barcelona|aeroport de barcelona|aeroport barcelona)\b/.test(s)) return "airport";

  // Cruise / port
  if (/\b(cruise|port de barcelona|moll adossat|moll de la fusta|adossat|terminal [a-e]\b|world trade center|wtc\b|crucero|terminal creuers)\b/.test(s)) return "cruise";

  // Sants station
  if (/\b(sants|estacion sants|estacio sants|barcelona sants|sants estacio)\b/.test(s)) return "sants";

  // Andorra (before barcelona — "andorra la vella" doesn't contain barcelona)
  if (/\bandorra\b/.test(s)) return "andorra";

  // Montserrat
  if (/\bmontserrat\b/.test(s)) return "montserrat";

  // La Roca / La Roca Village outlet
  if (/\b(la roca|laroca|roca del valles|la roca village|outlet)\b/.test(s)) return "la_roca";

  // Barcelona city — broad match, after all specific-barcelona checks above
  if (/\bbarcelona\b/.test(s)) return "barcelona_city";

  // Costa Dorada
  if (/\bcastelldefels\b/.test(s)) return "castelldefels";
  if (/\bsitges\b/.test(s)) return "sitges";
  if (/\bcubelles\b/.test(s)) return "cubelles";
  if (/\bcalafell\b/.test(s)) return "calafell";
  if (/\bvendrell\b|el vendrell/.test(s)) return "vendrell";
  if (/\btarragona\b/.test(s)) return "tarragona";
  if (/\b(la pineda|pineda playa|platja la pineda)\b/.test(s)) return "la_pineda";
  if (/\b(portaventura|port aventura)\b/.test(s)) return "portaventura";
  if (/\bsalou\b/.test(s)) return "salou";
  if (/\bcambrils\b/.test(s)) return "cambrils";

  // Costa Brava — pineda_de_mar before mataro/calella
  if (/\b(pineda de mar|pineda mar)\b/.test(s)) return "pineda_de_mar";
  if (/\b(mataro|mataron)\b/.test(s)) return "mataro";
  if (/\bcalella\b/.test(s)) return "calella";
  if (/\b(santa susanna|santa susana)\b/.test(s)) return "santa_susanna";
  if (/\b(malgrat de mar|malgrat mar|malgrat)\b/.test(s)) return "malgrat";
  if (/\bblanes\b/.test(s)) return "blanes";
  if (/\b(lloret de mar|lloret mar|lloret)\b/.test(s)) return "lloret";
  if (/\b(tossa de mar|tossa mar|tossa)\b/.test(s)) return "tossa";
  if (/\b(s'agaro|s agaro|sagaro|sant feliu de guixols)\b/.test(s)) return "sagaro";
  if (/\b(platja d'aro|platja daro|playa de aro|s'agaro|platjadaro)\b/.test(s)) return "platja_daro";
  if (/\b(palamos|la fosca)\b/.test(s)) return "palamos";
  if (/\b(roses|rosas)\b/.test(s)) return "roses";
  if (/\b(empuriabrava|ampuriabrava|empuries)\b/.test(s)) return "empuriabrava";
  if (/\bfigueres\b/.test(s)) return "figueres";
  if (/\bcadaques\b/.test(s)) return "cadaques";

  return null;
}

// ─── Fixed-route pricing matrix ───────────────────────────────────────────────

interface GeoPoint { lat: number; lng: number; radiusKm: number; }

const KNOWN_LOCATIONS: Record<string, GeoPoint> = {
  airport:        { lat: 41.2971, lng: 2.0785,  radiusKm: 2.5 },
  cruise:         { lat: 41.3585, lng: 2.1833,  radiusKm: 1.0 },
  sants:          { lat: 41.3791, lng: 2.1402,  radiusKm: 0.6 },
  barcelona_city: { lat: 41.3851, lng: 2.1734,  radiusKm: 12  },
  la_roca:        { lat: 41.6080, lng: 2.3395,  radiusKm: 3   },
  montserrat:     { lat: 41.5932, lng: 1.8360,  radiusKm: 4   },
  girona_airport: { lat: 41.9010, lng: 2.7607,  radiusKm: 3   },
  andorra:        { lat: 42.5063, lng: 1.5218,  radiusKm: 12  },
  castelldefels:  { lat: 41.2800, lng: 1.9780,  radiusKm: 3   },
  sitges:         { lat: 41.2369, lng: 1.8140,  radiusKm: 3   },
  cubelles:       { lat: 41.2134, lng: 1.6764,  radiusKm: 2   },
  calafell:       { lat: 41.1977, lng: 1.5675,  radiusKm: 2   },
  vendrell:       { lat: 41.2172, lng: 1.5374,  radiusKm: 3   },
  tarragona:      { lat: 41.1189, lng: 1.2445,  radiusKm: 5   },
  la_pineda:      { lat: 41.0750, lng: 1.1540,  radiusKm: 2   },
  salou:          { lat: 41.0765, lng: 1.1426,  radiusKm: 3   },
  portaventura:   { lat: 41.0853, lng: 1.1561,  radiusKm: 2   },
  cambrils:       { lat: 41.0652, lng: 1.0594,  radiusKm: 3   },
  mataro:         { lat: 41.5388, lng: 2.4450,  radiusKm: 3   },
  calella:        { lat: 41.6175, lng: 2.6575,  radiusKm: 2   },
  pineda_de_mar:  { lat: 41.6249, lng: 2.6835,  radiusKm: 2   },
  santa_susanna:  { lat: 41.6736, lng: 2.7139,  radiusKm: 2   },
  malgrat:        { lat: 41.6475, lng: 2.7477,  radiusKm: 2   },
  blanes:         { lat: 41.6747, lng: 2.7897,  radiusKm: 2   },
  lloret:         { lat: 41.6980, lng: 2.8410,  radiusKm: 2   },
  tossa:          { lat: 41.7218, lng: 2.9330,  radiusKm: 2   },
  sagaro:         { lat: 41.7916, lng: 3.0370,  radiusKm: 2   },
  platja_daro:    { lat: 41.8174, lng: 3.0648,  radiusKm: 2   },
  palamos:        { lat: 41.8449, lng: 3.1304,  radiusKm: 3   },
  roses:          { lat: 42.2688, lng: 3.1760,  radiusKm: 3   },
  empuriabrava:   { lat: 42.2494, lng: 3.1166,  radiusKm: 3   },
  figueres:       { lat: 42.2676, lng: 2.9624,  radiusKm: 4   },
  cadaques:       { lat: 42.2882, lng: 3.2787,  radiusKm: 3   },
};

// 5-column fixed prices: Economy | Business | Minivan (4-6 pax) | V-Class (7-8 pax) | Minibus
type FixedPrices = { ECONOMY: number; BUSINESS: number; MINIVAN: number; VCLASS: number; MINIBUS: number };

const ROUTE_PRICES: Array<[string, string, FixedPrices]> = [
  // ── Airport & City ──
  ["airport", "barcelona_city", { ECONOMY: 50,  BUSINESS: 60,  MINIVAN: 65,  VCLASS: 75,  MINIBUS: 180 }],
  ["airport", "cruise",         { ECONOMY: 50,  BUSINESS: 60,  MINIVAN: 65,  VCLASS: 75,  MINIBUS: 180 }],
  ["cruise",  "barcelona_city", { ECONOMY: 60,  BUSINESS: 60,  MINIVAN: 65,  VCLASS: 75,  MINIBUS: 180 }],
  ["airport", "sants",          { ECONOMY: 50,  BUSINESS: 60,  MINIVAN: 65,  VCLASS: 85,  MINIBUS: 155 }],
  ["airport", "montserrat",     { ECONOMY: 95,  BUSINESS: 110, MINIVAN: 115, VCLASS: 140, MINIBUS: 200 }],
  ["airport", "andorra",        { ECONOMY: 300, BUSINESS: 350, MINIVAN: 370, VCLASS: 450, MINIBUS: 630 }],
  ["barcelona_city", "la_roca",        { ECONOMY: 80,  BUSINESS: 100, MINIVAN: 110, VCLASS: 130, MINIBUS: 200 }],
  ["barcelona_city", "montserrat",     { ECONOMY: 115, BUSINESS: 130, MINIVAN: 155, VCLASS: 175, MINIBUS: 240 }],
  ["barcelona_city", "girona_airport", { ECONOMY: 140, BUSINESS: 155, MINIVAN: 170, VCLASS: 195, MINIBUS: 255 }],
  ["barcelona_city", "andorra",        { ECONOMY: 300, BUSINESS: 350, MINIVAN: 370, VCLASS: 450, MINIBUS: 630 }],
  // ── Costa Daurada ────────────────────────────────────────────────────────────────
  ["barcelona_city", "castelldefels", { ECONOMY: 50,  BUSINESS: 60,  MINIVAN: 65,  VCLASS: 75,  MINIBUS: 180 }],
  ["barcelona_city", "sitges",        { ECONOMY: 80,  BUSINESS: 100, MINIVAN: 110, VCLASS: 130, MINIBUS: 200 }],
  ["barcelona_city", "cubelles",      { ECONOMY: 90,  BUSINESS: 110, MINIVAN: 120, VCLASS: 145, MINIBUS: 210 }],
  ["barcelona_city", "calafell",      { ECONOMY: 100, BUSINESS: 120, MINIVAN: 130, VCLASS: 155, MINIBUS: 220 }],
  ["barcelona_city", "vendrell",      { ECONOMY: 110, BUSINESS: 130, MINIVAN: 145, VCLASS: 165, MINIBUS: 230 }],
  ["barcelona_city", "tarragona",     { ECONOMY: 150, BUSINESS: 170, MINIVAN: 190, VCLASS: 210, MINIBUS: 270 }],
  ["barcelona_city", "la_pineda",     { ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 }],
  ["barcelona_city", "salou",         { ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 }],
  ["barcelona_city", "portaventura",  { ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 }],
  ["barcelona_city", "cambrils",      { ECONOMY: 160, BUSINESS: 180, MINIVAN: 200, VCLASS: 220, MINIBUS: 280 }],
  // ── Costa Brava ──────────────────────────────────────────────────────────────────
  ["barcelona_city", "mataro",        { ECONOMY: 90,  BUSINESS: 110, MINIVAN: 120, VCLASS: 145, MINIBUS: 210 }],
  ["barcelona_city", "calella",       { ECONOMY: 110, BUSINESS: 130, MINIVAN: 145, VCLASS: 165, MINIBUS: 230 }],
  ["barcelona_city", "pineda_de_mar", { ECONOMY: 115, BUSINESS: 135, MINIVAN: 150, VCLASS: 170, MINIBUS: 235 }],
  ["barcelona_city", "santa_susanna", { ECONOMY: 120, BUSINESS: 140, MINIVAN: 155, VCLASS: 175, MINIBUS: 240 }],
  ["barcelona_city", "malgrat",       { ECONOMY: 125, BUSINESS: 145, MINIVAN: 160, VCLASS: 180, MINIBUS: 245 }],
  ["barcelona_city", "blanes",        { ECONOMY: 135, BUSINESS: 155, MINIVAN: 170, VCLASS: 195, MINIBUS: 255 }],
  ["barcelona_city", "lloret",        { ECONOMY: 145, BUSINESS: 165, MINIVAN: 180, VCLASS: 205, MINIBUS: 265 }],
  ["barcelona_city", "tossa",         { ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 }],
  ["barcelona_city", "sagaro",        { ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 }],
  ["barcelona_city", "platja_daro",   { ECONOMY: 160, BUSINESS: 180, MINIVAN: 200, VCLASS: 220, MINIBUS: 280 }],
  ["barcelona_city", "palamos",       { ECONOMY: 185, BUSINESS: 205, MINIVAN: 225, VCLASS: 250, MINIBUS: 305 }],
  ["barcelona_city", "roses",         { ECONOMY: 205, BUSINESS: 225, MINIVAN: 250, VCLASS: 270, MINIBUS: 325 }],
  ["barcelona_city", "empuriabrava",  { ECONOMY: 210, BUSINESS: 230, MINIVAN: 255, VCLASS: 275, MINIBUS: 330 }],
  ["barcelona_city", "figueres",      { ECONOMY: 200, BUSINESS: 220, MINIVAN: 240, VCLASS: 265, MINIBUS: 320 }],
  ["barcelona_city", "cadaques",      { ECONOMY: 240, BUSINESS: 260, MINIVAN: 285, VCLASS: 310, MINIBUS: 360 }],
];

export type RouteCategory = "airport" | "costa-dorada" | "costa-brava";

export interface RoutePrice {
  from: string;
  to: string;
  label: string;
  category: RouteCategory;
  note?: string;
  economy: number;
  business: number;
  minivan: number;
  vclass: number;
  minibus: number;
}

export const ROUTES: RoutePrice[] = [
  // ── Airport & City ──
  { from: "airport",        to: "barcelona_city", label: "El Prat Airport ⇄ Barcelona City",  category: "airport",       economy: 50,  business: 60,  minivan: 65,  vclass: 75,  minibus: 180 },
  { from: "airport",        to: "cruise",         label: "El Prat Airport ⇄ Cruise Terminal", category: "airport",       economy: 50,  business: 60,  minivan: 65,  vclass: 75,  minibus: 180 },
  { from: "cruise",         to: "barcelona_city", label: "Cruise Terminal ⇄ Barcelona City",  category: "airport",       economy: 60,  business: 60,  minivan: 65,  vclass: 75,  minibus: 180, note: "City-centre traffic route" },
  { from: "airport",        to: "sants",          label: "El Prat Airport ⇄ Sants Station",   category: "airport",       economy: 50,  business: 60,  minivan: 65,  vclass: 85,  minibus: 155 },
  { from: "barcelona_city", to: "la_roca",        label: "Barcelona ⇄ La Roca Village",        category: "airport",       economy: 80,  business: 100, minivan: 110, vclass: 130, minibus: 200 },
  { from: "airport",        to: "montserrat",     label: "El Prat Airport ⇄ Montserrat",       category: "airport",       economy: 95,  business: 110, minivan: 115, vclass: 140, minibus: 200 },
  { from: "barcelona_city", to: "girona_airport", label: "Barcelona ⇄ Girona Airport",         category: "airport",       economy: 140, business: 155, minivan: 170, vclass: 195, minibus: 255 },
  { from: "barcelona_city", to: "andorra",        label: "Barcelona ⇄ Andorra",                category: "airport",       economy: 300, business: 350, minivan: 370, vclass: 450, minibus: 630 },
  // ── Costa Dorada ──
  { from: "barcelona_city", to: "castelldefels",  label: "Barcelona ⇄ Castelldefels",          category: "costa-dorada",  economy: 50,  business: 60,  minivan: 65,  vclass: 75,  minibus: 180 },
  { from: "barcelona_city", to: "sitges",         label: "Barcelona ⇄ Sitges",                 category: "costa-dorada",  economy: 80,  business: 100, minivan: 110, vclass: 130, minibus: 200 },
  { from: "barcelona_city", to: "cubelles",       label: "Barcelona ⇄ Cubelles",               category: "costa-dorada",  economy: 90,  business: 110, minivan: 120, vclass: 145, minibus: 210 },
  { from: "barcelona_city", to: "calafell",       label: "Barcelona ⇄ Calafell",               category: "costa-dorada",  economy: 100, business: 120, minivan: 130, vclass: 155, minibus: 220 },
  { from: "barcelona_city", to: "vendrell",       label: "Barcelona ⇄ Vendrell",               category: "costa-dorada",  economy: 110, business: 130, minivan: 145, vclass: 165, minibus: 230 },
  { from: "barcelona_city", to: "tarragona",      label: "Barcelona ⇄ Tarragona",              category: "costa-dorada",  economy: 150, business: 170, minivan: 190, vclass: 210, minibus: 270 },
  { from: "barcelona_city", to: "la_pineda",      label: "Barcelona ⇄ La Pineda",              category: "costa-dorada",  economy: 155, business: 175, minivan: 195, vclass: 215, minibus: 275 },
  { from: "barcelona_city", to: "salou",          label: "Barcelona ⇄ Salou",                  category: "costa-dorada",  economy: 155, business: 175, minivan: 195, vclass: 215, minibus: 275 },
  { from: "barcelona_city", to: "portaventura",   label: "Barcelona ⇄ PortAventura",           category: "costa-dorada",  economy: 155, business: 175, minivan: 195, vclass: 215, minibus: 275 },
  { from: "barcelona_city", to: "cambrils",       label: "Barcelona ⇄ Cambrils",               category: "costa-dorada",  economy: 160, business: 180, minivan: 200, vclass: 220, minibus: 280 },
  // ── Costa Brava ──
  { from: "barcelona_city", to: "mataro",         label: "Barcelona ⇄ Mataró",                 category: "costa-brava",   economy: 90,  business: 110, minivan: 120, vclass: 145, minibus: 210 },
  { from: "barcelona_city", to: "calella",        label: "Barcelona ⇄ Calella",                category: "costa-brava",   economy: 110, business: 130, minivan: 145, vclass: 165, minibus: 230 },
  { from: "barcelona_city", to: "pineda_de_mar",  label: "Barcelona ⇄ Pineda de Mar",          category: "costa-brava",   economy: 115, business: 135, minivan: 150, vclass: 170, minibus: 235 },
  { from: "barcelona_city", to: "santa_susanna",  label: "Barcelona ⇄ Santa Susanna",          category: "costa-brava",   economy: 120, business: 140, minivan: 155, vclass: 175, minibus: 240 },
  { from: "barcelona_city", to: "malgrat",        label: "Barcelona ⇄ Malgrat de Mar",         category: "costa-brava",   economy: 125, business: 145, minivan: 160, vclass: 180, minibus: 245 },
  { from: "barcelona_city", to: "blanes",         label: "Barcelona ⇄ Blanes",                 category: "costa-brava",   economy: 135, business: 155, minivan: 170, vclass: 195, minibus: 255 },
  { from: "barcelona_city", to: "lloret",         label: "Barcelona ⇄ Lloret de Mar",          category: "costa-brava",   economy: 145, business: 165, minivan: 180, vclass: 205, minibus: 265 },
  { from: "barcelona_city", to: "tossa",          label: "Barcelona ⇄ Tossa de Mar",           category: "costa-brava",   economy: 155, business: 175, minivan: 195, vclass: 215, minibus: 275 },
  { from: "barcelona_city", to: "sagaro",         label: "Barcelona ⇄ S'Agaró",                category: "costa-brava",   economy: 155, business: 175, minivan: 195, vclass: 215, minibus: 275 },
  { from: "barcelona_city", to: "platja_daro",    label: "Barcelona ⇄ Platja d'Aro",           category: "costa-brava",   economy: 160, business: 180, minivan: 200, vclass: 220, minibus: 280 },
  { from: "barcelona_city", to: "palamos",        label: "Barcelona ⇄ Palamós",                category: "costa-brava",   economy: 185, business: 205, minivan: 225, vclass: 250, minibus: 305 },
  { from: "barcelona_city", to: "roses",          label: "Barcelona ⇄ Roses",                  category: "costa-brava",   economy: 205, business: 225, minivan: 250, vclass: 270, minibus: 325 },
  { from: "barcelona_city", to: "empuriabrava",   label: "Barcelona ⇄ Empuriabrava",           category: "costa-brava",   economy: 210, business: 230, minivan: 255, vclass: 275, minibus: 330 },
  { from: "barcelona_city", to: "figueres",       label: "Barcelona ⇄ Figueres",               category: "costa-brava",   economy: 200, business: 220, minivan: 240, vclass: 265, minibus: 320 },
  { from: "barcelona_city", to: "cadaques",       label: "Barcelona ⇄ Cadaqués",               category: "costa-brava",   economy: 240, business: 260, minivan: 285, vclass: 310, minibus: 360 },
];

// ─── Coordinate-based zone detection ─────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function detectZoneFromCoords(lat: number, lng: number): string | null {
  for (const [name, geo] of Object.entries(KNOWN_LOCATIONS)) {
    if (haversineKm(lat, lng, geo.lat, geo.lng) <= geo.radiusKm) return name;
  }
  return null;
}

// ─── Matrix lookup ────────────────────────────────────────────────────────────

// Maps VehicleClass → the 5-column code in ROUTE_PRICES.
// LUXURY (EQE) → BUSINESS; ELECTRIC_VIP (Tesla) → ECONOMY
// LUXURY_SUV → midpoint of BUSINESS + VCLASS (handled separately)
export function vehicleCodeForClass(vc: VehicleClass): "ECONOMY" | "BUSINESS" | "MINIVAN" | "VCLASS" | "MINIBUS" | "LUXURY_SUV_MID" | null {
  if (vc === "ECONOMY" || vc === "ELECTRIC_VIP")          return "ECONOMY";
  if (vc === "BUSINESS" || vc === "SUV" || vc === "LUXURY" || vc === "FIRST_CLASS") return "BUSINESS";
  if (vc === "LUXURY_MINIVAN")                            return "VCLASS";
  if (vc === "MINIVAN")                                   return "MINIVAN";
  if (vc === "MINIBUS")                                   return "MINIBUS";
  if (vc === "LUXURY_SUV")                                return "LUXURY_SUV_MID";
  return null;
}

/**
 * The only place fixed prices are read from the static matrix.
 * Returns null when the pair is not in the table — caller must handle this.
 * Bidirectional: (A,B) === (B,A).
 */
export function lookupFixedPriceByZone(
  fromZone: string,
  toZone: string,
  vc: VehicleClass,
): number | null {
  if (!fromZone || !toZone || fromZone === toZone) return null;

  for (const [a, b, prices] of ROUTE_PRICES) {
    if ((a === fromZone && b === toZone) || (a === toZone && b === fromZone)) {
      const code = vehicleCodeForClass(vc);
      if (!code) return null;
      if (code === "LUXURY_SUV_MID") return Math.round((prices.BUSINESS + prices.VCLASS) / 2);
      return prices[code];
    }
  }
  return null;
}

export const FLEET_FROM_PRICE = {
  "eqe-300-electric": 60,
  "tesla-model-3":    50,
  "v-class-vip":      75,
  "vito":             65,
  "minibus":          155,
} as const;

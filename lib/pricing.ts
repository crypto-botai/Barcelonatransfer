import { VehicleClass, QuoteResponse } from "@/types";
import { isAirportLocation, isNightTime, haversineDistance } from "@/lib/utils";

export const DEFAULT_PRICING: Record<VehicleClass, {
  baseFare: number;
  pricePerKm: number;
  pricePerMinute: number;
  minimumFare: number;
}> = {
  // minimumFare = cheapest fixed route price for each class
  ECONOMY:        { baseFare: 15,  pricePerKm: 1.30, pricePerMinute: 0.18, minimumFare: 50  },
  BUSINESS:       { baseFare: 20,  pricePerKm: 1.55, pricePerMinute: 0.22, minimumFare: 60  },
  LUXURY:         { baseFare: 28,  pricePerKm: 1.80, pricePerMinute: 0.28, minimumFare: 60  },
  FIRST_CLASS:    { baseFare: 45,  pricePerKm: 2.80, pricePerMinute: 0.45, minimumFare: 120 },
  ELECTRIC_VIP:   { baseFare: 38,  pricePerKm: 2.20, pricePerMinute: 0.35, minimumFare: 60  },
  SUV:            { baseFare: 32,  pricePerKm: 1.90, pricePerMinute: 0.32, minimumFare: 65  },
  LUXURY_SUV:     { baseFare: 55,  pricePerKm: 2.50, pricePerMinute: 0.45, minimumFare: 100 },
  MINIVAN:        { baseFare: 30,  pricePerKm: 1.65, pricePerMinute: 0.28, minimumFare: 65  },
  LUXURY_MINIVAN: { baseFare: 50,  pricePerKm: 2.20, pricePerMinute: 0.40, minimumFare: 75  },
  MINIBUS:        { baseFare: 70,  pricePerKm: 2.40, pricePerMinute: 0.50, minimumFare: 155 },
};

export const AIRPORT_SURCHARGE = 8;
export const NIGHT_SURCHARGE_RATE = 0.20;

// Last-minute booking policy
export const LAST_MINUTE_SURCHARGE_RATE = 0.15; // +15% if pickup < 4h away
export const LAST_MINUTE_HOURS = 4;             // hours threshold for surcharge
export const MIN_BOOKING_HOURS = 1;             // minimum advance notice

export function hoursUntilPickup(pickupDatetime: Date): number {
  return (pickupDatetime.getTime() - Date.now()) / 3_600_000;
}

export function calculateLastMinuteSurcharge(totalBefore: number, pickupDatetime: Date): number {
  if (hoursUntilPickup(pickupDatetime) < LAST_MINUTE_HOURS) {
    return Math.round(totalBefore * LAST_MINUTE_SURCHARGE_RATE * 100) / 100;
  }
  return 0;
}

// Hourly rates (VAT-inclusive) — aligned with /hourly page rate cards
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

// Minimum hours for hourly bookings
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

// ─── Fixed-route pricing ─────────────────────────────────────
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

function nearLocation(lat: number, lng: number, loc: GeoPoint): boolean {
  return haversineDistance(lat, lng, loc.lat, loc.lng) <= loc.radiusKm;
}

function detectLocation(lat: number, lng: number): string | null {
  for (const [name, geo] of Object.entries(KNOWN_LOCATIONS)) {
    if (nearLocation(lat, lng, geo)) return name;
  }
  return null;
}

function lookupFixedPrice(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  vc: VehicleClass,
): number | null {
  const from = detectLocation(fromLat, fromLng);
  const to   = detectLocation(toLat, toLng);
  if (!from || !to || from === to) return null;

  for (const [a, b, prices] of ROUTE_PRICES) {
    if ((a === from && b === to) || (a === to && b === from)) {
      if (vc === "ECONOMY" || vc === "ELECTRIC_VIP")     return prices.ECONOMY;
      if (vc === "BUSINESS" || vc === "SUV")             return prices.BUSINESS;
      if (vc === "LUXURY" || vc === "FIRST_CLASS")       return prices.BUSINESS;
      if (vc === "LUXURY_SUV")                           return Math.round((prices.BUSINESS + prices.VCLASS) / 2);
      if (vc === "LUXURY_MINIVAN")                       return prices.VCLASS;
      if (vc === "MINIVAN")                              return prices.MINIVAN;
      if (vc === "MINIBUS")                              return prices.MINIBUS;
    }
  }
  return null;
}

export function calculateQuote(
  vehicleClass: VehicleClass,
  distanceKm: number,
  durationMin: number,
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  pickupDatetime: Date,
  pricing = DEFAULT_PRICING
): Omit<QuoteResponse, "vehicleClass"> {
  const p = pricing[vehicleClass];

  // Check for a fixed route price first.
  // Fixed prices are VAT-inclusive final amounts — no additional tax is added.
  const fixedPrice = lookupFixedPrice(pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleClass);
  if (fixedPrice !== null) {
    const lastMinuteSurcharge = calculateLastMinuteSurcharge(fixedPrice, pickupDatetime);
    return {
      distanceKm:          Math.round(distanceKm * 10) / 10,
      durationMin,
      baseFare:            fixedPrice,
      distanceFare:        0,
      airportSurcharge:    0,
      nightSurcharge:      0,
      lastMinuteSurcharge,
      vatAmount:           0,
      totalAmount:         Math.round((fixedPrice + lastMinuteSurcharge) * 100) / 100,
      currency:            "EUR",
    };
  }

  // Dynamic pricing for custom routes
  const distanceFare = distanceKm * p.pricePerKm;
  const subtotal     = p.baseFare + distanceFare;

  const hasAirport = isAirportLocation(pickupLat, pickupLng) || isAirportLocation(dropoffLat, dropoffLng);
  const airportSurcharge = hasAirport ? AIRPORT_SURCHARGE : 0;

  const isNight = isNightTime(pickupDatetime);
  const nightSurcharge = isNight ? subtotal * NIGHT_SURCHARGE_RATE : 0;

  const baseTotal = Math.max(subtotal + airportSurcharge + nightSurcharge, p.minimumFare);
  const lastMinuteSurcharge = calculateLastMinuteSurcharge(baseTotal, pickupDatetime);

  return {
    distanceKm:         Math.round(distanceKm * 10) / 10,
    durationMin,
    baseFare:           p.baseFare,
    distanceFare:       Math.round(distanceFare * 100) / 100,
    airportSurcharge,
    nightSurcharge:     Math.round(nightSurcharge * 100) / 100,
    lastMinuteSurcharge,
    vatAmount:          0,
    totalAmount:        Math.round((baseTotal + lastMinuteSurcharge) * 100) / 100,
    currency:           "EUR",
  };
}

// ─── Public pricing exports for UI components ─────────────────
// All prices are VAT-inclusive final amounts.

export type RouteCategory = "airport" | "costa-dorada" | "costa-brava";

export interface RoutePrice {
  from: string;
  to: string;
  label: string;
  category: RouteCategory;
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
  { from: "cruise",         to: "barcelona_city", label: "Cruise Terminal ⇄ Barcelona City",  category: "airport",       economy: 60,  business: 60,  minivan: 65,  vclass: 75,  minibus: 180 },
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

// Minimum "from" price per fleet vehicle slug — used in fleet cards and marketing pages.
export const FLEET_FROM_PRICE = {
  "eqe-300-electric": 60,
  "tesla-model-3":    50,
  "v-class-vip":      75,
  "vito":             65,
  "minibus":          155,
} as const;

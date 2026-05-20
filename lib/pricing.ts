import { VehicleClass, QuoteResponse } from "@/types";
import { isAirportLocation, isNightTime, haversineDistance } from "@/lib/utils";

export const DEFAULT_PRICING: Record<VehicleClass, {
  baseFare: number;
  pricePerKm: number;
  pricePerMinute: number;
  minimumFare: number;
}> = {
  // minimumFare = cheapest fixed route price for each class
  ECONOMY:        { baseFare: 15,  pricePerKm: 1.30, pricePerMinute: 0.18, minimumFare: 45  },
  BUSINESS:       { baseFare: 20,  pricePerKm: 1.55, pricePerMinute: 0.22, minimumFare: 55  },
  LUXURY:         { baseFare: 28,  pricePerKm: 1.80, pricePerMinute: 0.28, minimumFare: 70  },
  FIRST_CLASS:    { baseFare: 45,  pricePerKm: 2.80, pricePerMinute: 0.45, minimumFare: 120 },
  ELECTRIC_VIP:   { baseFare: 38,  pricePerKm: 2.20, pricePerMinute: 0.35, minimumFare: 50  },
  SUV:            { baseFare: 32,  pricePerKm: 1.90, pricePerMinute: 0.32, minimumFare: 60  },
  LUXURY_SUV:     { baseFare: 55,  pricePerKm: 2.50, pricePerMinute: 0.45, minimumFare: 100 },
  MINIVAN:        { baseFare: 30,  pricePerKm: 1.65, pricePerMinute: 0.28, minimumFare: 60  },
  LUXURY_MINIVAN: { baseFare: 50,  pricePerKm: 2.20, pricePerMinute: 0.40, minimumFare: 70  },
  MINIBUS:        { baseFare: 70,  pricePerKm: 2.40, pricePerMinute: 0.50, minimumFare: 150 },
};

export const AIRPORT_SURCHARGE = 8;
export const NIGHT_SURCHARGE_RATE = 0.20;

// Hourly rates: 1-3 pax €40/h · Minivan (4-6 pax) €50/h · V-Class (7-8 pax) €60/h
export const HOURLY_RATES: Record<VehicleClass, number> = {
  ECONOMY:        40,
  BUSINESS:       40,
  LUXURY:         40,
  FIRST_CLASS:    80,
  ELECTRIC_VIP:   40,
  SUV:            50,
  LUXURY_SUV:     60,
  MINIVAN:        50,
  LUXURY_MINIVAN: 60,
  MINIBUS:        80,
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
  // ── Airport & City (promotional discount: Economy -€5, Business -€10, Minivan -€5) ──
  ["airport", "barcelona_city", { ECONOMY: 45,  BUSINESS: 55,  MINIVAN: 60,  VCLASS: 70,  MINIBUS: 150 }],
  ["airport", "cruise",         { ECONOMY: 45,  BUSINESS: 55,  MINIVAN: 60,  VCLASS: 70,  MINIBUS: 150 }],
  ["cruise",  "barcelona_city", { ECONOMY: 45,  BUSINESS: 55,  MINIVAN: 60,  VCLASS: 70,  MINIBUS: 150 }],
  ["airport", "sants",          { ECONOMY: 50,  BUSINESS: 55,  MINIVAN: 60,  VCLASS: 75,  MINIBUS: 155 }],
  ["barcelona_city", "la_roca",        { ECONOMY: 75,  BUSINESS: 90,  MINIVAN: 100, VCLASS: 120, MINIBUS: 200 }],
  ["barcelona_city", "montserrat",     { ECONOMY: 115, BUSINESS: 130, MINIVAN: 140, VCLASS: 160, MINIBUS: 240 }],
  ["barcelona_city", "girona_airport", { ECONOMY: 135, BUSINESS: 145, MINIVAN: 155, VCLASS: 175, MINIBUS: 255 }],
  ["barcelona_city", "andorra",        { ECONOMY: 280, BUSINESS: 340, MINIVAN: 450, VCLASS: 550, MINIBUS: 630 }],
  // ── Costa Daurada ────────────────────────────────────────────────────────────────
  ["barcelona_city", "castelldefels", { ECONOMY: 50,  BUSINESS: 60,  MINIVAN: 60,  VCLASS: 70,  MINIBUS: 150 }],
  ["barcelona_city", "sitges",        { ECONOMY: 80,  BUSINESS: 100, MINIVAN: 100, VCLASS: 120, MINIBUS: 200 }],
  ["barcelona_city", "cubelles",      { ECONOMY: 90,  BUSINESS: 110, MINIVAN: 110, VCLASS: 130, MINIBUS: 210 }],
  ["barcelona_city", "calafell",      { ECONOMY: 100, BUSINESS: 120, MINIVAN: 120, VCLASS: 140, MINIBUS: 220 }],
  ["barcelona_city", "vendrell",      { ECONOMY: 110, BUSINESS: 130, MINIVAN: 130, VCLASS: 150, MINIBUS: 230 }],
  ["barcelona_city", "tarragona",     { ECONOMY: 150, BUSINESS: 170, MINIVAN: 170, VCLASS: 190, MINIBUS: 270 }],
  ["barcelona_city", "la_pineda",     { ECONOMY: 155, BUSINESS: 175, MINIVAN: 175, VCLASS: 195, MINIBUS: 275 }],
  ["barcelona_city", "salou",         { ECONOMY: 155, BUSINESS: 175, MINIVAN: 175, VCLASS: 195, MINIBUS: 275 }],
  ["barcelona_city", "portaventura",  { ECONOMY: 155, BUSINESS: 175, MINIVAN: 175, VCLASS: 195, MINIBUS: 275 }],
  ["barcelona_city", "cambrils",      { ECONOMY: 160, BUSINESS: 180, MINIVAN: 180, VCLASS: 200, MINIBUS: 280 }],
  // ── Costa Brava ──────────────────────────────────────────────────────────────────
  ["barcelona_city", "mataro",        { ECONOMY: 90,  BUSINESS: 110, MINIVAN: 110, VCLASS: 130, MINIBUS: 210 }],
  ["barcelona_city", "calella",       { ECONOMY: 110, BUSINESS: 130, MINIVAN: 130, VCLASS: 150, MINIBUS: 230 }],
  ["barcelona_city", "pineda_de_mar", { ECONOMY: 115, BUSINESS: 135, MINIVAN: 135, VCLASS: 155, MINIBUS: 235 }],
  ["barcelona_city", "santa_susanna", { ECONOMY: 120, BUSINESS: 140, MINIVAN: 140, VCLASS: 160, MINIBUS: 240 }],
  ["barcelona_city", "malgrat",       { ECONOMY: 125, BUSINESS: 145, MINIVAN: 145, VCLASS: 165, MINIBUS: 245 }],
  ["barcelona_city", "blanes",        { ECONOMY: 135, BUSINESS: 155, MINIVAN: 155, VCLASS: 175, MINIBUS: 255 }],
  ["barcelona_city", "lloret",        { ECONOMY: 145, BUSINESS: 165, MINIVAN: 165, VCLASS: 185, MINIBUS: 265 }],
  ["barcelona_city", "tossa",         { ECONOMY: 155, BUSINESS: 175, MINIVAN: 175, VCLASS: 195, MINIBUS: 275 }],
  ["barcelona_city", "sagaro",        { ECONOMY: 155, BUSINESS: 175, MINIVAN: 175, VCLASS: 195, MINIBUS: 275 }],
  ["barcelona_city", "platja_daro",   { ECONOMY: 160, BUSINESS: 180, MINIVAN: 180, VCLASS: 200, MINIBUS: 280 }],
  ["barcelona_city", "palamos",       { ECONOMY: 185, BUSINESS: 205, MINIVAN: 205, VCLASS: 225, MINIBUS: 305 }],
  ["barcelona_city", "roses",         { ECONOMY: 205, BUSINESS: 225, MINIVAN: 225, VCLASS: 245, MINIBUS: 325 }],
  ["barcelona_city", "empuriabrava",  { ECONOMY: 210, BUSINESS: 230, MINIVAN: 230, VCLASS: 250, MINIBUS: 330 }],
  ["barcelona_city", "figueres",      { ECONOMY: 200, BUSINESS: 220, MINIVAN: 220, VCLASS: 240, MINIBUS: 320 }],
  ["barcelona_city", "cadaques",      { ECONOMY: 240, BUSINESS: 260, MINIVAN: 260, VCLASS: 280, MINIBUS: 360 }],
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
      if (vc === "LUXURY" || vc === "FIRST_CLASS")       return prices.BUSINESS + 20;
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

  // Check for a fixed route price first
  const fixedPrice = lookupFixedPrice(pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleClass);
  if (fixedPrice !== null) {
    // Fixed routes: price + 10% VAT only — no surcharges
    const vatAmount = Math.round(fixedPrice * 0.10 * 100) / 100;
    return {
      distanceKm:       Math.round(distanceKm * 10) / 10,
      durationMin,
      baseFare:         fixedPrice,
      distanceFare:     0,
      airportSurcharge: 0,
      nightSurcharge:   0,
      vatAmount,
      totalAmount:      Math.round((fixedPrice + vatAmount) * 100) / 100,
      currency:         "EUR",
    };
  }

  // Dynamic pricing for custom routes
  const distanceFare = distanceKm * p.pricePerKm;
  const subtotal     = p.baseFare + distanceFare;

  const hasAirport = isAirportLocation(pickupLat, pickupLng) || isAirportLocation(dropoffLat, dropoffLng);
  const airportSurcharge = hasAirport ? AIRPORT_SURCHARGE : 0;

  const isNight = isNightTime(pickupDatetime);
  const nightSurcharge = isNight ? subtotal * NIGHT_SURCHARGE_RATE : 0;

  const total = Math.max(subtotal + airportSurcharge + nightSurcharge, p.minimumFare);

  return {
    distanceKm:      Math.round(distanceKm * 10) / 10,
    durationMin,
    baseFare:        p.baseFare,
    distanceFare:    Math.round(distanceFare * 100) / 100,
    airportSurcharge,
    nightSurcharge:  Math.round(nightSurcharge * 100) / 100,
    vatAmount:       0,
    totalAmount:     Math.round(total * 100) / 100,
    currency:        "EUR",
  };
}

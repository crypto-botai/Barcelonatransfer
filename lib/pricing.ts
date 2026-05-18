import { VehicleClass, QuoteResponse } from "@/types";
import { isAirportLocation, isNightTime, haversineDistance } from "@/lib/utils";

export const DEFAULT_PRICING: Record<VehicleClass, {
  baseFare: number;
  pricePerKm: number;
  pricePerMinute: number;
  minimumFare: number;
}> = {
  // minimumFare matches the standard Airport ⇄ Barcelona City price for each class
  ECONOMY:        { baseFare: 15,  pricePerKm: 1.30, pricePerMinute: 0.18, minimumFare: 50  },
  BUSINESS:       { baseFare: 20,  pricePerKm: 1.55, pricePerMinute: 0.22, minimumFare: 65  },
  LUXURY:         { baseFare: 28,  pricePerKm: 1.80, pricePerMinute: 0.28, minimumFare: 70  },
  FIRST_CLASS:    { baseFare: 45,  pricePerKm: 2.80, pricePerMinute: 0.45, minimumFare: 120 },
  ELECTRIC_VIP:   { baseFare: 38,  pricePerKm: 2.20, pricePerMinute: 0.35, minimumFare: 95  },
  SUV:            { baseFare: 32,  pricePerKm: 1.90, pricePerMinute: 0.32, minimumFare: 75  },
  LUXURY_SUV:     { baseFare: 55,  pricePerKm: 2.50, pricePerMinute: 0.45, minimumFare: 120 },
  MINIVAN:        { baseFare: 30,  pricePerKm: 1.65, pricePerMinute: 0.28, minimumFare: 80  },
  LUXURY_MINIVAN: { baseFare: 50,  pricePerKm: 2.20, pricePerMinute: 0.40, minimumFare: 110 },
  MINIBUS:        { baseFare: 70,  pricePerKm: 2.40, pricePerMinute: 0.50, minimumFare: 140 },
};

export const AIRPORT_SURCHARGE = 8;
export const NIGHT_SURCHARGE_RATE = 0.20;

// Hourly rates per user spec
// Economy/Business: €45/h · Vito: €55/h · V-Class: €65/h
export const HOURLY_RATES: Record<VehicleClass, number> = {
  ECONOMY:        45,
  BUSINESS:       45,
  LUXURY:         65,
  FIRST_CLASS:    110,
  ELECTRIC_VIP:   80,
  SUV:            75,
  LUXURY_SUV:     130,
  MINIVAN:        55,
  LUXURY_MINIVAN: 65,
  MINIBUS:        160,
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
// Overrides distance calculation for known Barcelona routes.
// Keys are canonical location names; values are { lat, lng, radiusKm }.

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
  tarragona:      { lat: 41.1189, lng: 1.2445,  radiusKm: 5   },
  salou:          { lat: 41.0765, lng: 1.1426,  radiusKm: 3   },
  portaventura:   { lat: 41.0853, lng: 1.1561,  radiusKm: 2   },
  cambrils:       { lat: 41.0652, lng: 1.0594,  radiusKm: 3   },
  mataro:         { lat: 41.5388, lng: 2.4450,  radiusKm: 3   },
  calella:        { lat: 41.6175, lng: 2.6575,  radiusKm: 2   },
  santa_susanna:  { lat: 41.6736, lng: 2.7139,  radiusKm: 2   },
  blanes:         { lat: 41.6747, lng: 2.7897,  radiusKm: 2   },
  lloret:         { lat: 41.6980, lng: 2.8410,  radiusKm: 2   },
  tossa:          { lat: 41.7218, lng: 2.9330,  radiusKm: 2   },
  platja_daro:    { lat: 41.8174, lng: 3.0648,  radiusKm: 2   },
  cadaques:       { lat: 42.2882, lng: 3.2787,  radiusKm: 3   },
};

// Prices indexed as [from][to][vehicleClass] — symmetric routes share one entry.
// "Economy" column also covers SUV at +€20, Luxury Minivan at +€30, Minibus at +€60.
// These are the FIXED prices from the spec (ECONOMY | BUSINESS | LUXURY | MINIVAN).
type FixedPrices = { ECONOMY: number; BUSINESS: number; LUXURY: number; MINIVAN: number };

const ROUTE_PRICES: Array<[string, string, FixedPrices]> = [
  ["airport", "barcelona_city", { ECONOMY: 50, BUSINESS: 65, LUXURY: 70, MINIVAN: 80 }],
  ["airport", "cruise",         { ECONOMY: 50, BUSINESS: 65, LUXURY: 70, MINIVAN: 80 }],
  ["cruise",  "barcelona_city", { ECONOMY: 50, BUSINESS: 65, LUXURY: 70, MINIVAN: 80 }],
  ["airport", "sants",          { ECONOMY: 55, BUSINESS: 65, LUXURY: 75, MINIVAN: 90 }],
  ["barcelona_city", "la_roca", { ECONOMY: 80,  BUSINESS: 100, LUXURY: 120, MINIVAN: 150 }],
  ["barcelona_city", "montserrat",   { ECONOMY: 120, BUSINESS: 140, LUXURY: 160, MINIVAN: 190 }],
  ["barcelona_city", "girona_airport", { ECONOMY: 140, BUSINESS: 155, LUXURY: 175, MINIVAN: 200 }],
  ["barcelona_city", "andorra",       { ECONOMY: 260, BUSINESS: 285, LUXURY: 300, MINIVAN: 350 }],
  // Costa Daurada
  ["barcelona_city", "castelldefels", { ECONOMY: 50,  BUSINESS: 60,  LUXURY: 70,  MINIVAN: 85  }],
  ["barcelona_city", "sitges",        { ECONOMY: 80,  BUSINESS: 100, LUXURY: 120, MINIVAN: 140 }],
  ["barcelona_city", "cubelles",      { ECONOMY: 90,  BUSINESS: 110, LUXURY: 130, MINIVAN: 155 }],
  ["barcelona_city", "calafell",      { ECONOMY: 100, BUSINESS: 120, LUXURY: 140, MINIVAN: 170 }],
  ["barcelona_city", "tarragona",     { ECONOMY: 150, BUSINESS: 170, LUXURY: 190, MINIVAN: 220 }],
  ["barcelona_city", "salou",         { ECONOMY: 155, BUSINESS: 175, LUXURY: 195, MINIVAN: 230 }],
  ["barcelona_city", "portaventura",  { ECONOMY: 155, BUSINESS: 175, LUXURY: 195, MINIVAN: 230 }],
  ["barcelona_city", "cambrils",      { ECONOMY: 160, BUSINESS: 180, LUXURY: 200, MINIVAN: 240 }],
  // Costa Brava
  ["barcelona_city", "mataro",        { ECONOMY: 90,  BUSINESS: 110, LUXURY: 130, MINIVAN: 155 }],
  ["barcelona_city", "calella",       { ECONOMY: 110, BUSINESS: 130, LUXURY: 150, MINIVAN: 180 }],
  ["barcelona_city", "santa_susanna", { ECONOMY: 120, BUSINESS: 140, LUXURY: 160, MINIVAN: 190 }],
  ["barcelona_city", "blanes",        { ECONOMY: 135, BUSINESS: 155, LUXURY: 175, MINIVAN: 210 }],
  ["barcelona_city", "lloret",        { ECONOMY: 145, BUSINESS: 165, LUXURY: 185, MINIVAN: 220 }],
  ["barcelona_city", "tossa",         { ECONOMY: 155, BUSINESS: 175, LUXURY: 195, MINIVAN: 235 }],
  ["barcelona_city", "platja_daro",   { ECONOMY: 160, BUSINESS: 180, LUXURY: 200, MINIVAN: 240 }],
  ["barcelona_city", "cadaques",      { ECONOMY: 240, BUSINESS: 260, LUXURY: 280, MINIVAN: 330 }],
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
      // Map vehicle class to price column
      if (vc === "ECONOMY" || vc === "ELECTRIC_VIP")  return prices.ECONOMY;
      if (vc === "BUSINESS")                           return prices.BUSINESS;
      if (vc === "LUXURY" || vc === "FIRST_CLASS")     return prices.LUXURY;
      if (vc === "SUV")                                return prices.BUSINESS;    // SUV = Business+
      if (vc === "LUXURY_SUV")                         return prices.LUXURY + 20; // premium
      if (vc === "MINIVAN")                            return prices.MINIVAN;
      if (vc === "LUXURY_MINIVAN")                     return prices.MINIVAN + 30;
      if (vc === "MINIBUS")                            return prices.MINIVAN + 60;
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
    // Apply night surcharge on top of fixed price
    const isNight = isNightTime(pickupDatetime);
    const nightSurcharge = isNight ? Math.round(fixedPrice * NIGHT_SURCHARGE_RATE * 100) / 100 : 0;
    return {
      distanceKm:      Math.round(distanceKm * 10) / 10,
      durationMin,
      baseFare:        fixedPrice,
      distanceFare:    0,
      airportSurcharge: 0,
      nightSurcharge,
      totalAmount:     Math.round((fixedPrice + nightSurcharge) * 100) / 100,
      currency:        "EUR",
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
    totalAmount:     Math.round(total * 100) / 100,
    currency:        "EUR",
  };
}

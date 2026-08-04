import type { VehicleClass, FleetVehicle } from "@/types";
import { FLEET_TO_DB_CLASS } from "@/types";
import {
  FIXED_ROUTES,
  lookupFixedPrice as lookupFixedPriceFn,
  lookupPriceByClass,
  VEHICLE_TO_PRICE_CLASS,
  DB_CLASS_TO_CODE,
  type VehicleCode,
  type ZoneCode,
} from "@/lib/fixed-prices";

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
  ELECTRIC_VIP:   { baseFare: 28,  pricePerKm: 1.80, pricePerMinute: 0.28, minimumFare: 60  },
  MINIVAN:        { baseFare: 30,  pricePerKm: 1.65, pricePerMinute: 0.28, minimumFare: 65  },
  LUXURY_MINIVAN: { baseFare: 50,  pricePerKm: 2.20, pricePerMinute: 0.40, minimumFare: 75  },
  MINIBUS:        { baseFare: 70,  pricePerKm: 2.40, pricePerMinute: 0.50, minimumFare: 180 },
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
  BUSINESS:       50,
  LUXURY:         65,
  ELECTRIC_VIP:   65,
  MINIVAN:        60,
  LUXURY_MINIVAN: 70,
  MINIBUS:       160,
};

export const MIN_HOURLY_HOURS: Record<VehicleClass, number> = {
  ECONOMY:        4,
  BUSINESS:       4,
  LUXURY:         4,
  ELECTRIC_VIP:   4,
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

// ─── Zone key ↔ ZoneCode bidirectional maps ───────────────────────────────────

export const ZONE_CODE_TO_KEY: Record<ZoneCode, string> = {
  BCN_AIRPORT:    "airport",
  BARCELONA_CITY: "barcelona_city",
  CRUISE_TERMINAL:"cruise",
  SANTS_STATION:  "sants",
  MONTSERRAT:     "montserrat",
  ANDORRA:        "andorra",
  LA_ROCA:        "la_roca",
  GIRONA_AIRPORT: "girona_airport",
  CASTELLDEFELS:  "castelldefels",
  SITGES:         "sitges",
  CUBELLES:       "cubelles",
  CALAFELL:       "calafell",
  VENDRELL:       "vendrell",
  TARRAGONA:      "tarragona",
  LA_PINEDA:      "la_pineda",
  SALOU:          "salou",
  PORTAVENTURA:   "portaventura",
  CAMBRILS:       "cambrils",
  MATARO:         "mataro",
  CALELLA:        "calella",
  PINEDA_DE_MAR:  "pineda_de_mar",
  SANTA_SUSANNA:  "santa_susanna",
  MALGRAT:        "malgrat",
  BLANES:         "blanes",
  LLORET:         "lloret",
  TOSSA:          "tossa",
  SAGARO:         "sagaro",
  PLATJA_DARO:    "platja_daro",
  PALAMOS:        "palamos",
  ROSES:          "roses",
  EMPURIABRAVA:   "empuriabrava",
  FIGUERES:       "figueres",
  CADAQUES:       "cadaques",
};

export const KEY_TO_ZONE_CODE: Record<string, ZoneCode> = Object.fromEntries(
  Object.entries(ZONE_CODE_TO_KEY).map(([code, key]) => [key, code as ZoneCode])
);

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

  // ── IMPORTANT: All specific cities are checked BEFORE their province names. ──
  // Nominatim display_names include province: "Cubelles, Garraf, Barcelona, Catalunya"
  // or "Lloret de Mar, Selva, Girona, Catalunya". If we checked "barcelona" or "girona"
  // first, every city in those provinces would resolve to the wrong zone.

  // Girona Airport — match ONLY specific airport terms, NOT bare "girona" which
  // appears in every Girona-province address (Lloret, Blanes, Roses, Figueres…).
  if (/\b(gro\b|gro airport|vilobi|costa brava airport|aeropuerto de girona|girona.*airport|airport.*girona)\b/.test(s)) return "girona_airport";

  // El Prat Airport — before generic "barcelona" check
  if (/\b(prat|el prat|t1\b|t2\b|terminal\s*1|terminal\s*2|terminal one|terminal two|terminal 1a|terminal 1b|terminal 2a|terminal 2b|bcn airport|barcelona airport|aeropuerto de barcelona|aeroport de barcelona|aeroport barcelona)\b/.test(s)) return "airport";

  // Cruise / Port — before "barcelona" check
  if (/\b(cruise|port de barcelona|moll adossat|moll de la fusta|adossat|terminal [a-e]\b|world trade center|wtc\b|crucero|terminal creuers)\b/.test(s)) return "cruise";

  // Sants Station — before "barcelona" check
  if (/\b(sants|estacion sants|estacio sants|barcelona sants|sants estacio)\b/.test(s)) return "sants";

  // Andorra
  if (/\bandorra\b/.test(s)) return "andorra";

  // Montserrat — before "barcelona" (address includes "Barcelona" as province)
  if (/\bmontserrat\b/.test(s)) return "montserrat";

  // La Roca Village — before "barcelona"
  if (/\b(la roca|laroca|roca del valles|la roca village|outlet)\b/.test(s)) return "la_roca";

  // ── Costa Dorada cities — ALL before "tarragona" (province) and "barcelona" (province) ──
  if (/\bcastelldefels\b/.test(s)) return "castelldefels";  // Barcelona province
  if (/\bsitges\b/.test(s))        return "sitges";          // Barcelona province
  if (/\bcubelles\b/.test(s))      return "cubelles";        // Barcelona province
  if (/\bcalafell\b/.test(s))      return "calafell";        // Tarragona province
  if (/\bvendrell\b|el vendrell/.test(s)) return "vendrell"; // Tarragona province
  if (/\b(la pineda|pineda playa|platja la pineda)\b/.test(s)) return "la_pineda";    // Tarragona province
  if (/\b(portaventura|port aventura)\b/.test(s)) return "portaventura";              // Tarragona province
  if (/\bsalou\b/.test(s))         return "salou";           // Tarragona province
  if (/\bcambrils\b/.test(s))      return "cambrils";        // Tarragona province

  // ── Costa Brava cities — ALL before "girona" (province) and "barcelona" (province) ──
  if (/\b(pineda de mar|pineda mar)\b/.test(s)) return "pineda_de_mar"; // Barcelona province
  if (/\b(mataro|mataron)\b/.test(s))  return "mataro";       // Barcelona province
  if (/\bcalella\b/.test(s))           return "calella";      // Barcelona province
  if (/\b(santa susanna|santa susana)\b/.test(s)) return "santa_susanna"; // Barcelona province
  if (/\b(malgrat de mar|malgrat mar|malgrat)\b/.test(s)) return "malgrat"; // Barcelona/Girona border
  if (/\bblanes\b/.test(s))            return "blanes";       // Girona province
  if (/\b(lloret de mar|lloret mar|lloret)\b/.test(s)) return "lloret"; // Girona province
  if (/\b(tossa de mar|tossa mar|tossa)\b/.test(s)) return "tossa";    // Girona province
  if (/\b(s'agaro|s agaro|sagaro|sant feliu de guixols)\b/.test(s)) return "sagaro";     // Girona province
  if (/\b(platja d'aro|platja daro|playa de aro|platjadaro)\b/.test(s)) return "platja_daro"; // Girona province
  if (/\b(palamos|la fosca)\b/.test(s)) return "palamos";     // Girona province
  if (/\b(roses|rosas)\b/.test(s))      return "roses";       // Girona province
  if (/\b(empuriabrava|ampuriabrava|empuries)\b/.test(s)) return "empuriabrava"; // Girona province
  if (/\bfigueres\b/.test(s))           return "figueres";    // Girona province
  if (/\bcadaques\b/.test(s))           return "cadaques";    // Girona province

  // ── Broad province / capital names — only reach here if no specific city matched ──
  // "Tarragona" as a city (all Tarragona-province sub-cities already matched above)
  if (/\btarragona\b/.test(s)) return "tarragona";
  // "Barcelona" as a city (all Barcelona-province sub-cities already matched above)
  if (/\bbarcelona\b/.test(s)) return "barcelona_city";
  // Note: bare "girona" (Girona city) has no fixed route → returns null → custom quote

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

// ─── Route type (backward compat — derived from FIXED_ROUTES) ────────────────

export type RouteCategory = "airport" | "costa-dorada" | "costa-brava";

export interface RoutePrice {
  from:      string;
  to:        string;
  label:     string;
  category:  RouteCategory;
  note?:     string;
  economy:   number;
  business:  number;
  minivan:   number;
  vclass:    number;
  minibus:   number;
}

// Derived from FIXED_ROUTES — single source of truth.
// "airport-city" category maps to "airport" for backward compat with DB / PricingSection.
export const ROUTES: RoutePrice[] = FIXED_ROUTES.map((r) => ({
  from:     ZONE_CODE_TO_KEY[r.from]  ?? r.from.toLowerCase(),
  to:       ZONE_CODE_TO_KEY[r.to]    ?? r.to.toLowerCase(),
  label:    `${r.fromLabel} ⇄ ${r.toLabel}`,
  category: (r.category === "airport-city" ? "airport" : r.category) as RouteCategory,
  note:     r.note,
  economy:  r.prices.ECONOMY,
  business: r.prices.BUSINESS,
  minivan:  r.prices.MINIVAN,
  vclass:   r.prices.VCLASS,
  minibus:  r.prices.MINIBUS,
}));

// ─── Vehicle identifier → price column ────────────────────────────────────────

// Resolves any fleet or DB vehicle identifier string to a VehicleCode.
// Handles both FleetVehicle keys (COROLLA, EQE_300 …) and VehicleClass DB values
// (ECONOMY, LUXURY …) so both the display layer and the API layer can use one path.
function resolveVehicleCode(vc: string): VehicleCode | null {
  if (vc in VEHICLE_TO_PRICE_CLASS) return VEHICLE_TO_PRICE_CLASS[vc as FleetVehicle];
  if (vc in DB_CLASS_TO_CODE)       return DB_CLASS_TO_CODE[vc as VehicleClass];
  return null;
}

// Service-layer helper: DB VehicleClass → price column.
export function vehicleCodeForClass(vc: VehicleClass): VehicleCode | null {
  return DB_CLASS_TO_CODE[vc] ?? null;
}

// ─── Matrix lookup ────────────────────────────────────────────────────────────

/**
 * The only place fixed prices are read from the static matrix.
 * Accepts old lowercase zone keys; converts to ZoneCode then delegates to
 * the canonical lookupFixedPrice() in lib/fixed-prices.ts.
 * Returns null when the pair is not in the table — caller must handle this.
 * Bidirectional: (A,B) === (B,A).
 * Accepts FleetVehicle, VehicleClass, or VehicleCode strings interchangeably.
 */
export function lookupFixedPriceByZone(
  fromZone: string,
  toZone:   string,
  vc:       string,
): number | null {
  // Same-zone lookups allowed — see lookupFixedPrice in lib/pricing-service.ts.
  if (!fromZone || !toZone) return null;

  const fromCode = KEY_TO_ZONE_CODE[fromZone];
  const toCode   = KEY_TO_ZONE_CODE[toZone];
  if (!fromCode || !toCode) return null;

  // FleetVehicle → convert to DB VehicleClass → class-aware lookup (respects overrides)
  if (vc in VEHICLE_TO_PRICE_CLASS) {
    const dbClass = FLEET_TO_DB_CLASS[vc as FleetVehicle];
    return lookupPriceByClass(fromCode, toCode, dbClass);
  }
  // DB VehicleClass → class-aware lookup (respects overrides)
  if (vc in DB_CLASS_TO_CODE) {
    return lookupPriceByClass(fromCode, toCode, vc as VehicleClass);
  }
  // VehicleCode direct lookup (no override support — legacy path)
  const code = resolveVehicleCode(vc);
  if (!code) return null;
  return lookupFixedPriceFn(fromCode, toCode, code);
}

/**
 * Returns the fixed price for El Prat Airport → Barcelona City for the given
 * fleet vehicle. Used on fleet listing pages as "from" price.
 */
export function getFleetFromPrice(fv: FleetVehicle): number {
  const dbClass = FLEET_TO_DB_CLASS[fv];
  const price   = lookupPriceByClass("BCN_AIRPORT", "BARCELONA_CITY", dbClass);
  return price ?? DEFAULT_PRICING[dbClass]?.minimumFare ?? 0;
}

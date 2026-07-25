export type VehicleCode = "ECONOMY" | "BUSINESS" | "MINIVAN" | "VCLASS" | "MINIBUS";

export const VEHICLES: Record<VehicleCode, { label: string; paxLabel: string; maxPax: number }> = {
  ECONOMY:  { label: "Economy",  paxLabel: "1–3 pax", maxPax: 3  },
  BUSINESS: { label: "Business", paxLabel: "1–3 pax", maxPax: 3  },
  MINIVAN:  { label: "Minivan",  paxLabel: "4–8 pax", maxPax: 8  },
  VCLASS:   { label: "V-Class",  paxLabel: "7 pax",   maxPax: 7  },
  MINIBUS:  { label: "Minibus",  paxLabel: "9+ pax",  maxPax: 16 },
};

export type ZoneCode =
  | "BCN_AIRPORT" | "BARCELONA_CITY" | "CRUISE_TERMINAL" | "SANTS_STATION"
  | "MONTSERRAT"  | "ANDORRA"        | "LA_ROCA"         | "GIRONA_AIRPORT"
  | "CASTELLDEFELS" | "SITGES"       | "CUBELLES"        | "CALAFELL"
  | "VENDRELL"    | "TARRAGONA"      | "LA_PINEDA"       | "SALOU"
  | "PORTAVENTURA"| "CAMBRILS"
  | "MATARO"      | "CALELLA"        | "PINEDA_DE_MAR"   | "SANTA_SUSANNA"
  | "MALGRAT"     | "BLANES"         | "LLORET"          | "TOSSA"
  | "SAGARO"      | "PLATJA_DARO"    | "PALAMOS"
  | "ROSES"       | "EMPURIABRAVA"   | "FIGUERES"        | "CADAQUES";

export type Category = "airport-city" | "costa-dorada" | "costa-brava";

export interface FixedRoute {
  slug:      string;
  from:      ZoneCode;
  to:        ZoneCode;
  fromLabel: string;
  toLabel:   string;
  category:  Category;
  note?:     string;
  prices:    Record<VehicleCode, number>;
  // Per-VehicleClass price overrides for this specific route.
  // Takes priority over the generic prices[] column lookup.
  // Used to differentiate vehicles that share a price column (e.g. Camry vs Tesla vs EQE).
  vehicleClassOverrides?: Partial<Record<import("@/types").VehicleClass, number>>;
}

export const FIXED_ROUTES: FixedRoute[] = [
  // ── Airport & City ────────────────────────────────────────────────────────
  {
    slug: "bcn-airport-barcelona-city",
    from: "BCN_AIRPORT", to: "BARCELONA_CITY",
    fromLabel: "El Prat Airport", toLabel: "Barcelona City",
    category: "airport-city",
    prices: { ECONOMY: 50, BUSINESS: 60, MINIVAN: 65, VCLASS: 75, MINIBUS: 180 },
    // Camry (BUSINESS) → €50, Tesla M3 (ELECTRIC_VIP) → €55 for this route only.
    // EQE 300 (LUXURY) is not overridden and keeps the BUSINESS column price (€60).
    vehicleClassOverrides: { BUSINESS: 50, ELECTRIC_VIP: 55 },
  },
  {
    slug: "bcn-airport-cruise-terminal",
    from: "BCN_AIRPORT", to: "CRUISE_TERMINAL",
    fromLabel: "El Prat Airport", toLabel: "Cruise Terminal",
    category: "airport-city",
    prices: { ECONOMY: 50, BUSINESS: 60, MINIVAN: 65, VCLASS: 75, MINIBUS: 180 },
  },
  {
    slug: "cruise-terminal-barcelona-city",
    from: "CRUISE_TERMINAL", to: "BARCELONA_CITY",
    fromLabel: "Cruise Terminal", toLabel: "Barcelona City",
    category: "airport-city",
    note: "City-centre traffic route",
    prices: { ECONOMY: 60, BUSINESS: 60, MINIVAN: 65, VCLASS: 75, MINIBUS: 180 },
  },
  {
    slug: "bcn-airport-sants-station",
    from: "BCN_AIRPORT", to: "SANTS_STATION",
    fromLabel: "El Prat Airport", toLabel: "Sants Station",
    category: "airport-city",
    prices: { ECONOMY: 50, BUSINESS: 60, MINIVAN: 65, VCLASS: 85, MINIBUS: 155 },
  },
  {
    slug: "bcn-airport-montserrat",
    from: "BCN_AIRPORT", to: "MONTSERRAT",
    fromLabel: "El Prat Airport", toLabel: "Montserrat",
    category: "airport-city",
    prices: { ECONOMY: 95, BUSINESS: 110, MINIVAN: 115, VCLASS: 140, MINIBUS: 200 },
  },
  {
    slug: "bcn-airport-andorra",
    from: "BCN_AIRPORT", to: "ANDORRA",
    fromLabel: "El Prat Airport", toLabel: "Andorra",
    category: "airport-city",
    prices: { ECONOMY: 300, BUSINESS: 350, MINIVAN: 370, VCLASS: 450, MINIBUS: 630 },
  },
  {
    slug: "bcn-airport-girona-airport",
    from: "BCN_AIRPORT", to: "GIRONA_AIRPORT",
    fromLabel: "El Prat Airport", toLabel: "Girona Airport",
    category: "airport-city",
    prices: { ECONOMY: 140, BUSINESS: 155, MINIVAN: 170, VCLASS: 195, MINIBUS: 255 },
  },
  {
    slug: "bcn-airport-la-roca",
    from: "BCN_AIRPORT", to: "LA_ROCA",
    fromLabel: "El Prat Airport", toLabel: "La Roca Village",
    category: "airport-city",
    prices: { ECONOMY: 80, BUSINESS: 100, MINIVAN: 110, VCLASS: 130, MINIBUS: 200 },
  },
  // ── Airport → Costa Dorada (same prices as Barcelona City → Costa Dorada) ──
  {
    slug: "bcn-airport-castelldefels",
    from: "BCN_AIRPORT", to: "CASTELLDEFELS",
    fromLabel: "El Prat Airport", toLabel: "Castelldefels",
    category: "costa-dorada",
    prices: { ECONOMY: 50, BUSINESS: 60, MINIVAN: 65, VCLASS: 75, MINIBUS: 180 },
  },
  {
    slug: "bcn-airport-sitges",
    from: "BCN_AIRPORT", to: "SITGES",
    fromLabel: "El Prat Airport", toLabel: "Sitges",
    category: "costa-dorada",
    prices: { ECONOMY: 80, BUSINESS: 100, MINIVAN: 110, VCLASS: 130, MINIBUS: 200 },
  },
  {
    slug: "bcn-airport-cubelles",
    from: "BCN_AIRPORT", to: "CUBELLES",
    fromLabel: "El Prat Airport", toLabel: "Cubelles",
    category: "costa-dorada",
    prices: { ECONOMY: 90, BUSINESS: 110, MINIVAN: 120, VCLASS: 145, MINIBUS: 210 },
  },
  {
    slug: "bcn-airport-calafell",
    from: "BCN_AIRPORT", to: "CALAFELL",
    fromLabel: "El Prat Airport", toLabel: "Calafell",
    category: "costa-dorada",
    prices: { ECONOMY: 100, BUSINESS: 120, MINIVAN: 130, VCLASS: 155, MINIBUS: 220 },
  },
  {
    slug: "bcn-airport-vendrell",
    from: "BCN_AIRPORT", to: "VENDRELL",
    fromLabel: "El Prat Airport", toLabel: "Vendrell",
    category: "costa-dorada",
    prices: { ECONOMY: 110, BUSINESS: 130, MINIVAN: 145, VCLASS: 165, MINIBUS: 230 },
  },
  {
    slug: "bcn-airport-tarragona",
    from: "BCN_AIRPORT", to: "TARRAGONA",
    fromLabel: "El Prat Airport", toLabel: "Tarragona",
    category: "costa-dorada",
    prices: { ECONOMY: 150, BUSINESS: 170, MINIVAN: 190, VCLASS: 210, MINIBUS: 270 },
  },
  {
    slug: "bcn-airport-la-pineda",
    from: "BCN_AIRPORT", to: "LA_PINEDA",
    fromLabel: "El Prat Airport", toLabel: "La Pineda",
    category: "costa-dorada",
    prices: { ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  },
  {
    slug: "bcn-airport-salou",
    from: "BCN_AIRPORT", to: "SALOU",
    fromLabel: "El Prat Airport", toLabel: "Salou",
    category: "costa-dorada",
    prices: { ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  },
  {
    slug: "bcn-airport-portaventura",
    from: "BCN_AIRPORT", to: "PORTAVENTURA",
    fromLabel: "El Prat Airport", toLabel: "PortAventura",
    category: "costa-dorada",
    prices: { ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  },
  {
    slug: "bcn-airport-cambrils",
    from: "BCN_AIRPORT", to: "CAMBRILS",
    fromLabel: "El Prat Airport", toLabel: "Cambrils",
    category: "costa-dorada",
    prices: { ECONOMY: 160, BUSINESS: 180, MINIVAN: 200, VCLASS: 220, MINIBUS: 280 },
  },
  // ── Airport → Costa Brava (same prices as Barcelona City → Costa Brava) ───
  {
    slug: "bcn-airport-mataro",
    from: "BCN_AIRPORT", to: "MATARO",
    fromLabel: "El Prat Airport", toLabel: "Mataró",
    category: "costa-brava",
    prices: { ECONOMY: 90, BUSINESS: 110, MINIVAN: 120, VCLASS: 145, MINIBUS: 210 },
  },
  {
    slug: "bcn-airport-calella",
    from: "BCN_AIRPORT", to: "CALELLA",
    fromLabel: "El Prat Airport", toLabel: "Calella",
    category: "costa-brava",
    prices: { ECONOMY: 110, BUSINESS: 130, MINIVAN: 145, VCLASS: 165, MINIBUS: 230 },
  },
  {
    slug: "bcn-airport-pineda-de-mar",
    from: "BCN_AIRPORT", to: "PINEDA_DE_MAR",
    fromLabel: "El Prat Airport", toLabel: "Pineda de Mar",
    category: "costa-brava",
    prices: { ECONOMY: 115, BUSINESS: 135, MINIVAN: 150, VCLASS: 170, MINIBUS: 235 },
  },
  {
    slug: "bcn-airport-santa-susanna",
    from: "BCN_AIRPORT", to: "SANTA_SUSANNA",
    fromLabel: "El Prat Airport", toLabel: "Santa Susanna",
    category: "costa-brava",
    prices: { ECONOMY: 120, BUSINESS: 140, MINIVAN: 155, VCLASS: 175, MINIBUS: 240 },
  },
  {
    slug: "bcn-airport-malgrat",
    from: "BCN_AIRPORT", to: "MALGRAT",
    fromLabel: "El Prat Airport", toLabel: "Malgrat de Mar",
    category: "costa-brava",
    prices: { ECONOMY: 125, BUSINESS: 145, MINIVAN: 160, VCLASS: 180, MINIBUS: 245 },
  },
  {
    slug: "bcn-airport-blanes",
    from: "BCN_AIRPORT", to: "BLANES",
    fromLabel: "El Prat Airport", toLabel: "Blanes",
    category: "costa-brava",
    prices: { ECONOMY: 135, BUSINESS: 155, MINIVAN: 170, VCLASS: 195, MINIBUS: 255 },
  },
  {
    slug: "bcn-airport-lloret",
    from: "BCN_AIRPORT", to: "LLORET",
    fromLabel: "El Prat Airport", toLabel: "Lloret de Mar",
    category: "costa-brava",
    prices: { ECONOMY: 145, BUSINESS: 165, MINIVAN: 180, VCLASS: 205, MINIBUS: 265 },
  },
  {
    slug: "bcn-airport-tossa",
    from: "BCN_AIRPORT", to: "TOSSA",
    fromLabel: "El Prat Airport", toLabel: "Tossa de Mar",
    category: "costa-brava",
    prices: { ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  },
  {
    slug: "bcn-airport-sagaro",
    from: "BCN_AIRPORT", to: "SAGARO",
    fromLabel: "El Prat Airport", toLabel: "S'Agaró",
    category: "costa-brava",
    prices: { ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  },
  {
    slug: "bcn-airport-platja-daro",
    from: "BCN_AIRPORT", to: "PLATJA_DARO",
    fromLabel: "El Prat Airport", toLabel: "Platja d'Aro",
    category: "costa-brava",
    prices: { ECONOMY: 160, BUSINESS: 180, MINIVAN: 200, VCLASS: 220, MINIBUS: 280 },
  },
  {
    slug: "bcn-airport-palamos",
    from: "BCN_AIRPORT", to: "PALAMOS",
    fromLabel: "El Prat Airport", toLabel: "Palamós",
    category: "costa-brava",
    prices: { ECONOMY: 185, BUSINESS: 205, MINIVAN: 225, VCLASS: 250, MINIBUS: 305 },
  },
  {
    slug: "bcn-airport-roses",
    from: "BCN_AIRPORT", to: "ROSES",
    fromLabel: "El Prat Airport", toLabel: "Roses",
    category: "costa-brava",
    prices: { ECONOMY: 205, BUSINESS: 225, MINIVAN: 250, VCLASS: 270, MINIBUS: 325 },
  },
  {
    slug: "bcn-airport-empuriabrava",
    from: "BCN_AIRPORT", to: "EMPURIABRAVA",
    fromLabel: "El Prat Airport", toLabel: "Empuriabrava",
    category: "costa-brava",
    prices: { ECONOMY: 210, BUSINESS: 230, MINIVAN: 255, VCLASS: 275, MINIBUS: 330 },
  },
  {
    slug: "bcn-airport-figueres",
    from: "BCN_AIRPORT", to: "FIGUERES",
    fromLabel: "El Prat Airport", toLabel: "Figueres",
    category: "costa-brava",
    prices: { ECONOMY: 200, BUSINESS: 220, MINIVAN: 240, VCLASS: 265, MINIBUS: 320 },
  },
  {
    slug: "bcn-airport-cadaques",
    from: "BCN_AIRPORT", to: "CADAQUES",
    fromLabel: "El Prat Airport", toLabel: "Cadaqués",
    category: "costa-brava",
    prices: { ECONOMY: 240, BUSINESS: 260, MINIVAN: 285, VCLASS: 310, MINIBUS: 360 },
  },
  {
    slug: "barcelona-city-la-roca",
    from: "BARCELONA_CITY", to: "LA_ROCA",
    fromLabel: "Barcelona City", toLabel: "La Roca Village",
    category: "airport-city",
    prices: { ECONOMY: 80, BUSINESS: 100, MINIVAN: 110, VCLASS: 130, MINIBUS: 200 },
  },
  {
    slug: "barcelona-city-montserrat",
    from: "BARCELONA_CITY", to: "MONTSERRAT",
    fromLabel: "Barcelona City", toLabel: "Montserrat",
    category: "airport-city",
    prices: { ECONOMY: 115, BUSINESS: 130, MINIVAN: 155, VCLASS: 175, MINIBUS: 240 },
  },
  {
    slug: "barcelona-city-girona-airport",
    from: "BARCELONA_CITY", to: "GIRONA_AIRPORT",
    fromLabel: "Barcelona City", toLabel: "Girona Airport",
    category: "airport-city",
    prices: { ECONOMY: 140, BUSINESS: 155, MINIVAN: 170, VCLASS: 195, MINIBUS: 255 },
  },
  {
    slug: "barcelona-city-andorra",
    from: "BARCELONA_CITY", to: "ANDORRA",
    fromLabel: "Barcelona City", toLabel: "Andorra",
    category: "airport-city",
    prices: { ECONOMY: 300, BUSINESS: 350, MINIVAN: 370, VCLASS: 450, MINIBUS: 630 },
  },
  // ── Costa Dorada ──────────────────────────────────────────────────────────
  {
    slug: "barcelona-city-castelldefels",
    from: "BARCELONA_CITY", to: "CASTELLDEFELS",
    fromLabel: "Barcelona City", toLabel: "Castelldefels",
    category: "costa-dorada",
    prices: { ECONOMY: 50, BUSINESS: 60, MINIVAN: 65, VCLASS: 75, MINIBUS: 180 },
  },
  {
    slug: "barcelona-city-sitges",
    from: "BARCELONA_CITY", to: "SITGES",
    fromLabel: "Barcelona City", toLabel: "Sitges",
    category: "costa-dorada",
    prices: { ECONOMY: 80, BUSINESS: 100, MINIVAN: 110, VCLASS: 130, MINIBUS: 200 },
  },
  {
    slug: "barcelona-city-cubelles",
    from: "BARCELONA_CITY", to: "CUBELLES",
    fromLabel: "Barcelona City", toLabel: "Cubelles",
    category: "costa-dorada",
    prices: { ECONOMY: 90, BUSINESS: 110, MINIVAN: 120, VCLASS: 145, MINIBUS: 210 },
  },
  {
    slug: "barcelona-city-calafell",
    from: "BARCELONA_CITY", to: "CALAFELL",
    fromLabel: "Barcelona City", toLabel: "Calafell",
    category: "costa-dorada",
    prices: { ECONOMY: 100, BUSINESS: 120, MINIVAN: 130, VCLASS: 155, MINIBUS: 220 },
  },
  {
    slug: "barcelona-city-vendrell",
    from: "BARCELONA_CITY", to: "VENDRELL",
    fromLabel: "Barcelona City", toLabel: "Vendrell",
    category: "costa-dorada",
    prices: { ECONOMY: 110, BUSINESS: 130, MINIVAN: 145, VCLASS: 165, MINIBUS: 230 },
  },
  {
    slug: "barcelona-city-tarragona",
    from: "BARCELONA_CITY", to: "TARRAGONA",
    fromLabel: "Barcelona City", toLabel: "Tarragona",
    category: "costa-dorada",
    prices: { ECONOMY: 150, BUSINESS: 170, MINIVAN: 190, VCLASS: 210, MINIBUS: 270 },
  },
  {
    slug: "barcelona-city-la-pineda",
    from: "BARCELONA_CITY", to: "LA_PINEDA",
    fromLabel: "Barcelona City", toLabel: "La Pineda",
    category: "costa-dorada",
    prices: { ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  },
  {
    slug: "barcelona-city-salou",
    from: "BARCELONA_CITY", to: "SALOU",
    fromLabel: "Barcelona City", toLabel: "Salou",
    category: "costa-dorada",
    prices: { ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  },
  {
    slug: "barcelona-city-portaventura",
    from: "BARCELONA_CITY", to: "PORTAVENTURA",
    fromLabel: "Barcelona City", toLabel: "PortAventura",
    category: "costa-dorada",
    prices: { ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  },
  {
    slug: "barcelona-city-cambrils",
    from: "BARCELONA_CITY", to: "CAMBRILS",
    fromLabel: "Barcelona City", toLabel: "Cambrils",
    category: "costa-dorada",
    prices: { ECONOMY: 160, BUSINESS: 180, MINIVAN: 200, VCLASS: 220, MINIBUS: 280 },
  },
  // ── Costa Brava ───────────────────────────────────────────────────────────
  {
    slug: "barcelona-city-mataro",
    from: "BARCELONA_CITY", to: "MATARO",
    fromLabel: "Barcelona City", toLabel: "Mataró",
    category: "costa-brava",
    prices: { ECONOMY: 90, BUSINESS: 110, MINIVAN: 120, VCLASS: 145, MINIBUS: 210 },
  },
  {
    slug: "barcelona-city-calella",
    from: "BARCELONA_CITY", to: "CALELLA",
    fromLabel: "Barcelona City", toLabel: "Calella",
    category: "costa-brava",
    prices: { ECONOMY: 110, BUSINESS: 130, MINIVAN: 145, VCLASS: 165, MINIBUS: 230 },
  },
  {
    slug: "barcelona-city-pineda-de-mar",
    from: "BARCELONA_CITY", to: "PINEDA_DE_MAR",
    fromLabel: "Barcelona City", toLabel: "Pineda de Mar",
    category: "costa-brava",
    prices: { ECONOMY: 115, BUSINESS: 135, MINIVAN: 150, VCLASS: 170, MINIBUS: 235 },
  },
  {
    slug: "barcelona-city-santa-susanna",
    from: "BARCELONA_CITY", to: "SANTA_SUSANNA",
    fromLabel: "Barcelona City", toLabel: "Santa Susanna",
    category: "costa-brava",
    prices: { ECONOMY: 120, BUSINESS: 140, MINIVAN: 155, VCLASS: 175, MINIBUS: 240 },
  },
  {
    slug: "barcelona-city-malgrat",
    from: "BARCELONA_CITY", to: "MALGRAT",
    fromLabel: "Barcelona City", toLabel: "Malgrat de Mar",
    category: "costa-brava",
    prices: { ECONOMY: 125, BUSINESS: 145, MINIVAN: 160, VCLASS: 180, MINIBUS: 245 },
  },
  {
    slug: "barcelona-city-blanes",
    from: "BARCELONA_CITY", to: "BLANES",
    fromLabel: "Barcelona City", toLabel: "Blanes",
    category: "costa-brava",
    prices: { ECONOMY: 135, BUSINESS: 155, MINIVAN: 170, VCLASS: 195, MINIBUS: 255 },
  },
  {
    slug: "barcelona-city-lloret",
    from: "BARCELONA_CITY", to: "LLORET",
    fromLabel: "Barcelona City", toLabel: "Lloret de Mar",
    category: "costa-brava",
    prices: { ECONOMY: 145, BUSINESS: 165, MINIVAN: 180, VCLASS: 205, MINIBUS: 265 },
  },
  {
    slug: "barcelona-city-tossa",
    from: "BARCELONA_CITY", to: "TOSSA",
    fromLabel: "Barcelona City", toLabel: "Tossa de Mar",
    category: "costa-brava",
    prices: { ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  },
  {
    slug: "barcelona-city-sagaro",
    from: "BARCELONA_CITY", to: "SAGARO",
    fromLabel: "Barcelona City", toLabel: "S'Agaró",
    category: "costa-brava",
    prices: { ECONOMY: 155, BUSINESS: 175, MINIVAN: 195, VCLASS: 215, MINIBUS: 275 },
  },
  {
    slug: "barcelona-city-platja-daro",
    from: "BARCELONA_CITY", to: "PLATJA_DARO",
    fromLabel: "Barcelona City", toLabel: "Platja d'Aro",
    category: "costa-brava",
    prices: { ECONOMY: 160, BUSINESS: 180, MINIVAN: 200, VCLASS: 220, MINIBUS: 280 },
  },
  {
    slug: "barcelona-city-palamos",
    from: "BARCELONA_CITY", to: "PALAMOS",
    fromLabel: "Barcelona City", toLabel: "Palamós",
    category: "costa-brava",
    prices: { ECONOMY: 185, BUSINESS: 205, MINIVAN: 225, VCLASS: 250, MINIBUS: 305 },
  },
  {
    slug: "barcelona-city-roses",
    from: "BARCELONA_CITY", to: "ROSES",
    fromLabel: "Barcelona City", toLabel: "Roses",
    category: "costa-brava",
    prices: { ECONOMY: 205, BUSINESS: 225, MINIVAN: 250, VCLASS: 270, MINIBUS: 325 },
  },
  {
    slug: "barcelona-city-empuriabrava",
    from: "BARCELONA_CITY", to: "EMPURIABRAVA",
    fromLabel: "Barcelona City", toLabel: "Empuriabrava",
    category: "costa-brava",
    prices: { ECONOMY: 210, BUSINESS: 230, MINIVAN: 255, VCLASS: 275, MINIBUS: 330 },
  },
  {
    slug: "barcelona-city-figueres",
    from: "BARCELONA_CITY", to: "FIGUERES",
    fromLabel: "Barcelona City", toLabel: "Figueres",
    category: "costa-brava",
    prices: { ECONOMY: 200, BUSINESS: 220, MINIVAN: 240, VCLASS: 265, MINIBUS: 320 },
  },
  {
    slug: "barcelona-city-cadaques",
    from: "BARCELONA_CITY", to: "CADAQUES",
    fromLabel: "Barcelona City", toLabel: "Cadaqués",
    category: "costa-brava",
    prices: { ECONOMY: 240, BUSINESS: 260, MINIVAN: 285, VCLASS: 310, MINIBUS: 360 },
  },
];

export function lookupFixedPrice(from: ZoneCode, to: ZoneCode, vehicle: VehicleCode): number | null {
  const route = FIXED_ROUTES.find(
    (r) => (r.from === from && r.to === to) || (r.from === to && r.to === from)
  );
  return route ? route.prices[vehicle] : null;
}

export function findRoute(from: ZoneCode, to: ZoneCode): FixedRoute | null {
  return FIXED_ROUTES.find(
    (r) => (r.from === from && r.to === to) || (r.from === to && r.to === from)
  ) ?? null;
}

import type { FleetVehicle, VehicleClass } from "@/types";

// FleetVehicle → price column. The single source that maps each physical vehicle
// to one of the 5 fixed-price columns. No arithmetic — every value is a literal code.
export const VEHICLE_TO_PRICE_CLASS: Record<FleetVehicle, VehicleCode> = {
  COROLLA:  "ECONOMY",
  CAMRY:    "BUSINESS",
  TESLA_M3: "BUSINESS",
  EQE_300:  "BUSINESS",
  VITO:     "MINIVAN",
  V_CLASS:  "VCLASS",
  SPRINTER: "MINIBUS",
};

// DB VehicleClass → price column (for API / service layer that receives Prisma enum values).
export const DB_CLASS_TO_CODE: Record<VehicleClass, VehicleCode> = {
  ECONOMY:        "ECONOMY",
  BUSINESS:       "BUSINESS",
  ELECTRIC_VIP:   "BUSINESS",
  LUXURY:         "BUSINESS",
  MINIVAN:        "MINIVAN",
  LUXURY_MINIVAN: "VCLASS",
  MINIBUS:        "MINIBUS",
};

/**
 * Class-aware fixed price lookup. Checks vehicleClassOverrides on the route first,
 * then falls back to the generic price column via DB_CLASS_TO_CODE.
 * Use this instead of lookupFixedPrice when you have a VehicleClass (not a VehicleCode),
 * so per-vehicle overrides (e.g. Camry vs Tesla for airport→city) are applied.
 */
export function lookupPriceByClass(
  from: ZoneCode,
  to:   ZoneCode,
  cls:  VehicleClass,
): number | null {
  const route = FIXED_ROUTES.find(
    (r) => (r.from === from && r.to === to) || (r.from === to && r.to === from)
  );
  if (!route) return null;
  const override = route.vehicleClassOverrides?.[cls];
  if (override !== undefined) return override;
  return route.prices[DB_CLASS_TO_CODE[cls]];
}

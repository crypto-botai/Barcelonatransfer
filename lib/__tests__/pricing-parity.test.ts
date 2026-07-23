/**
 * Pricing parity tests
 *
 * Asserts:
 *  1. FIXED_ROUTES.length === 35
 *  2. For every route × vehicle: lookupFixedPrice() returns the table value
 *  3. Bidirectionality: lookup(A,B,v) === lookup(B,A,v) for all 35 routes
 *  4. VEHICLE_CLASS_TO_CODE aliases resolve to the correct column
 *  5. ROUTES (derived) stays in sync with FIXED_ROUTES
 *  6. resolveZone() text matching
 */

import { describe, it, expect } from "vitest";
import {
  FIXED_ROUTES,
  lookupFixedPrice,
  VEHICLE_CLASS_TO_CODE,
  type VehicleCode,
} from "../fixed-prices";
import {
  ROUTES,
  lookupFixedPriceByZone,
  resolveZone,
  ZONE_CODE_TO_KEY,
} from "../pricing";

// ── 1. Route count ────────────────────────────────────────────────────────────

describe("FIXED_ROUTES count", () => {
  it("has exactly 35 routes", () => {
    expect(FIXED_ROUTES.length).toBe(35);
  });
});

// ── 2. Table × vehicle parity + 3. Bidirectionality ──────────────────────────

const VEHICLE_CODES: VehicleCode[] = ["ECONOMY", "BUSINESS", "MINIVAN", "VCLASS", "MINIBUS"];

describe("Pricing parity: FIXED_ROUTES × vehicle", () => {
  FIXED_ROUTES.forEach((route) => {
    VEHICLE_CODES.forEach((vc) => {
      const expected = route.prices[vc];

      it(`${route.slug} · ${vc} → €${expected}`, () => {
        expect(lookupFixedPrice(route.from, route.to, vc)).toBe(expected);
      });

      it(`${route.slug} · ${vc} is bidirectional`, () => {
        expect(lookupFixedPrice(route.from, route.to, vc)).toBe(
          lookupFixedPrice(route.to, route.from, vc)
        );
      });
    });
  });
});

// ── 4. VEHICLE_CLASS_TO_CODE aliases ─────────────────────────────────────────

describe("VEHICLE_CLASS_TO_CODE aliases", () => {
  const pivot = FIXED_ROUTES[0]; // airport → barcelona_city

  const cases: Array<[string, VehicleCode]> = [
    ["ELECTRIC_VIP", "ECONOMY"],   // Tesla → ECONOMY column
    ["LUXURY",       "BUSINESS"],  // EQE 300 → BUSINESS column
    ["SUV",          "BUSINESS"],
    ["FIRST_CLASS",  "BUSINESS"],
    ["LUXURY_MINIVAN", "VCLASS"],
  ];

  cases.forEach(([alias, canonical]) => {
    it(`${alias} resolves same price as ${canonical}`, () => {
      const aliasPrice     = lookupFixedPriceByZone(
        ZONE_CODE_TO_KEY[pivot.from],
        ZONE_CODE_TO_KEY[pivot.to],
        alias as Parameters<typeof lookupFixedPriceByZone>[2]
      );
      const canonicalPrice = lookupFixedPrice(pivot.from, pivot.to, canonical);
      expect(aliasPrice).toBe(canonicalPrice);
    });
  });

  it("LUXURY_SUV returns midpoint of BUSINESS and VCLASS", () => {
    const b   = lookupFixedPrice(pivot.from, pivot.to, "BUSINESS")!;
    const v   = lookupFixedPrice(pivot.from, pivot.to, "VCLASS")!;
    const mid = lookupFixedPriceByZone(
      ZONE_CODE_TO_KEY[pivot.from],
      ZONE_CODE_TO_KEY[pivot.to],
      "LUXURY_SUV"
    );
    expect(mid).toBe(Math.round((b + v) / 2));
  });

  it("all alias mappings exist in VEHICLE_CLASS_TO_CODE", () => {
    const allClasses = [
      "ECONOMY", "ELECTRIC_VIP", "BUSINESS", "LUXURY", "SUV",
      "FIRST_CLASS", "MINIVAN", "LUXURY_MINIVAN", "LUXURY_SUV", "MINIBUS",
    ];
    allClasses.forEach((cls) => {
      expect(VEHICLE_CLASS_TO_CODE[cls]).toBeDefined();
    });
  });
});

// ── 5. ROUTES derivation in sync with FIXED_ROUTES ───────────────────────────

describe("ROUTES derived from FIXED_ROUTES", () => {
  it("ROUTES.length === FIXED_ROUTES.length", () => {
    expect(ROUTES.length).toBe(FIXED_ROUTES.length);
  });

  it("each ROUTES entry has matching prices from FIXED_ROUTES", () => {
    ROUTES.forEach((r, i) => {
      const fr = FIXED_ROUTES[i];
      expect(r.economy).toBe(fr.prices.ECONOMY);
      expect(r.business).toBe(fr.prices.BUSINESS);
      expect(r.minivan).toBe(fr.prices.MINIVAN);
      expect(r.vclass).toBe(fr.prices.VCLASS);
      expect(r.minibus).toBe(fr.prices.MINIBUS);
    });
  });

  it("airport-city routes map to 'airport' category", () => {
    const airportRoutes = FIXED_ROUTES.filter((r) => r.category === "airport-city");
    airportRoutes.forEach((fr) => {
      const derived = ROUTES.find(
        (r) => r.from === ZONE_CODE_TO_KEY[fr.from] && r.to === ZONE_CODE_TO_KEY[fr.to]
      );
      expect(derived?.category).toBe("airport");
    });
  });
});

// ── Intentional price asymmetries ─────────────────────────────────────────────

describe("Intentional price asymmetries", () => {
  it("Airport→Montserrat (€95) is cheaper than Barcelona→Montserrat (€115)", () => {
    const airportToMontserrat = lookupFixedPrice("BCN_AIRPORT",    "MONTSERRAT", "ECONOMY")!;
    const barcelonaToMontserrat = lookupFixedPrice("BARCELONA_CITY", "MONTSERRAT", "ECONOMY")!;
    expect(airportToMontserrat).toBe(95);
    expect(barcelonaToMontserrat).toBe(115);
    expect(airportToMontserrat).toBeLessThan(barcelonaToMontserrat);
  });

  it("Cruise→Barcelona (€60) is more expensive than Airport→Barcelona (€50)", () => {
    const cruiseToBarcelona = lookupFixedPrice("CRUISE_TERMINAL", "BARCELONA_CITY", "ECONOMY")!;
    const airportToBarcelona = lookupFixedPrice("BCN_AIRPORT",     "BARCELONA_CITY", "ECONOMY")!;
    expect(cruiseToBarcelona).toBe(60);
    expect(airportToBarcelona).toBe(50);
    expect(cruiseToBarcelona).toBeGreaterThan(airportToBarcelona);
  });
});

// ── Null for unknown routes ────────────────────────────────────────────────────

describe("Null for unknown routes", () => {
  it("Airport→Sitges is NOT in table (custom quote)", () => {
    expect(lookupFixedPrice("BCN_AIRPORT", "SITGES", "ECONOMY")).toBeNull();
  });

  it("Airport→Tarragona is NOT in table (custom quote)", () => {
    expect(lookupFixedPrice("BCN_AIRPORT", "TARRAGONA", "ECONOMY")).toBeNull();
  });

  it("unknown zone returns null from lookupFixedPriceByZone", () => {
    expect(lookupFixedPriceByZone("madrid_centre", "barcelona_city", "ECONOMY")).toBeNull();
  });

  it("A→A returns null", () => {
    expect(lookupFixedPriceByZone("airport", "airport", "ECONOMY")).toBeNull();
  });

  it("empty string returns null", () => {
    expect(lookupFixedPriceByZone("", "barcelona_city", "ECONOMY")).toBeNull();
  });
});

// ── 6. resolveZone text matching ──────────────────────────────────────────────

describe("resolveZone text matching", () => {
  const cases: [string, string | null][] = [
    ["T1 Terminal El Prat",                    "airport"],
    ["Aeropuerto de Barcelona",                "airport"],
    ["Barcelona Airport Terminal 2",           "airport"],
    ["El Prat de Llobregat",                   "airport"],
    ["Carrer de Mallorca 401, Barcelona",      "barcelona_city"],
    ["Hotel Arts Barcelona, Carrer de la Marina", "barcelona_city"],
    ["Moll Adossat Terminal C",                "cruise"],
    ["Barcelona Cruise Port, Terminal E",      "cruise"],
    ["Sants Estació",                          "sants"],
    ["Estació de Sants, Barcelona",            "sants"],
    ["Girona Airport",                         "girona_airport"],
    ["GRO Airport",                            "girona_airport"],
    ["Andorra la Vella",                       "andorra"],
    ["Montserrat monastery",                   "montserrat"],
    ["Sitges town centre",                     "sitges"],
    ["PortAventura World, Salou",              "portaventura"],
    ["Lloret de Mar",                          "lloret"],
    ["Platja d'Aro",                           "platja_daro"],
    ["Cadaqués",                               "cadaques"],
    ["Random street, Madrid",                  null],
    ["London Heathrow Airport",                null],
  ];

  cases.forEach(([input, expected]) => {
    it(`resolveZone("${input}") → ${expected ?? "null"}`, () => {
      expect(resolveZone(input)).toBe(expected);
    });
  });
});

// ── Costa routes without airport origin (mandatory report) ───────────────────

describe("25 costa routes: no BCN_AIRPORT origin (custom quote for airport pickup)", () => {
  const costaRoutes = FIXED_ROUTES.filter(
    (r) => r.category === "costa-dorada" || r.category === "costa-brava"
  );

  it("has 25 costa routes total (10 dorada + 15 brava)", () => {
    expect(costaRoutes.length).toBe(25);
  });

  it("none of the 25 costa routes have BCN_AIRPORT as from or to", () => {
    const airportCosta = costaRoutes.filter(
      (r) => r.from === "BCN_AIRPORT" || r.to === "BCN_AIRPORT"
    );
    expect(airportCosta.length).toBe(0);
  });
});

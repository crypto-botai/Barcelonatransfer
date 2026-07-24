/**
 * Pricing parity tests
 *
 * Asserts:
 *  1. FIXED_ROUTES.length === 35
 *  2. For every route × vehicle: lookupFixedPrice() returns the table value
 *  3. Bidirectionality: lookup(A,B,v) === lookup(B,A,v) for all 35 routes
 *  4. VEHICLE_TO_PRICE_CLASS has exactly 7 fleet vehicles, all mapping to real codes
 *  5. Exactly 5 VehicleCode members — no arithmetic, no LUXURY_SUV_MID
 *  6. ROUTES (derived) stays in sync with FIXED_ROUTES
 *  7. resolveZone() text matching
 */

import { describe, it, expect } from "vitest";
import {
  FIXED_ROUTES,
  lookupFixedPrice,
  VEHICLE_TO_PRICE_CLASS,
  DB_CLASS_TO_CODE,
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

// ── 4. VEHICLE_TO_PRICE_CLASS — fleet vehicles, no arithmetic ────────────────

describe("VEHICLE_TO_PRICE_CLASS", () => {
  const VALID_CODES: VehicleCode[] = ["ECONOMY", "BUSINESS", "MINIVAN", "VCLASS", "MINIBUS"];

  it("has exactly 7 fleet vehicle entries", () => {
    expect(Object.keys(VEHICLE_TO_PRICE_CLASS).length).toBe(7);
  });

  it("all values are one of the 5 valid VehicleCodes (no arithmetic, no LUXURY_SUV_MID)", () => {
    Object.entries(VEHICLE_TO_PRICE_CLASS).forEach(([fleet, code]) => {
      expect(VALID_CODES).toContain(code);
    });
  });

  it("Tesla Model 3 (TESLA_M3) maps to BUSINESS — not ECONOMY", () => {
    expect(VEHICLE_TO_PRICE_CLASS["TESLA_M3"]).toBe("BUSINESS");
  });

  it("Mercedes EQE 300 (EQE_300) maps to BUSINESS", () => {
    expect(VEHICLE_TO_PRICE_CLASS["EQE_300"]).toBe("BUSINESS");
  });

  it("Mercedes V-Class (V_CLASS) maps to VCLASS", () => {
    expect(VEHICLE_TO_PRICE_CLASS["V_CLASS"]).toBe("VCLASS");
  });

  it("Mercedes Sprinter (SPRINTER) maps to MINIBUS", () => {
    expect(VEHICLE_TO_PRICE_CLASS["SPRINTER"]).toBe("MINIBUS");
  });
});

// ── 4b. Exactly 5 VehicleCode members ────────────────────────────────────────

describe("VehicleCode completeness", () => {
  it("exactly 5 distinct codes used across all fleet mappings", () => {
    const used = new Set(Object.values(VEHICLE_TO_PRICE_CLASS));
    expect(used.size).toBe(5);
    expect([...used].sort()).toEqual(["BUSINESS", "ECONOMY", "MINIBUS", "MINIVAN", "VCLASS"]);
  });
});

// ── 4c. FleetVehicle and DB VehicleClass lookups resolve same price ───────────

describe("Fleet and DB class price parity", () => {
  const pivot = FIXED_ROUTES[0]; // airport → barcelona_city
  const from  = ZONE_CODE_TO_KEY[pivot.from];
  const to    = ZONE_CODE_TO_KEY[pivot.to];

  const cases: Array<[string, string]> = [
    ["TESLA_M3",      "BUSINESS"],       // FleetVehicle → same as BUSINESS column
    ["EQE_300",       "BUSINESS"],
    ["V_CLASS",       "VCLASS"],
    ["ELECTRIC_VIP",  "BUSINESS"],       // DB class: Tesla → BUSINESS
    ["LUXURY",        "BUSINESS"],       // DB class: EQE 300 → BUSINESS
    ["LUXURY_MINIVAN","VCLASS"],         // DB class: V-Class → VCLASS
  ];

  cases.forEach(([alias, canonical]) => {
    it(`${alias} resolves same price as ${canonical} column`, () => {
      const aliasPrice     = lookupFixedPriceByZone(from, to, alias);
      const canonicalPrice = lookupFixedPrice(pivot.from, pivot.to, canonical as VehicleCode);
      expect(aliasPrice).toBe(canonicalPrice);
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

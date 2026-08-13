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
  lookupPriceByClass,
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

// ── 0. Public-surface price agreement ────────────────────────────────────────
//
// The homepage, /pricing and /book all display an "Airport ⇄ Barcelona City"
// row. They previously read from two different sources (the DB-backed
// pricing-service vs. the hardcoded ROUTES fallback), which meant an admin
// price edit could update some pages and not others — the two surfaces would
// quietly disagree about the same route. These assertions pin the canonical
// figures so any future change has to update the matrix deliberately.

describe("Airport ⇄ Barcelona City is one consistent set of numbers", () => {
  const route = ROUTES.find((r) => r.from === "airport" && r.to === "barcelona_city");

  it("exists and is categorised as an airport route (what /book filters on)", () => {
    expect(route).toBeDefined();
    expect(route!.category).toBe("airport");
  });

  it("matches the published per-class figures", () => {
    expect(route!.economy).toBe(50);
    expect(route!.business).toBe(70);
    expect(route!.minivan).toBe(65);
    expect(route!.vclass).toBe(75);
    expect(route!.minibus).toBe(180);
  });

  it("agrees with the class-aware lookup the booking engine quotes from", () => {
    // Note: this takes a DB VehicleClass, not a price-column VehicleCode —
    // the V-Class vehicle's class is LUXURY_MINIVAN, which maps to the VCLASS column.
    expect(lookupFixedPriceByZone("airport", "barcelona_city", "ECONOMY")).toBe(50);
    expect(lookupFixedPriceByZone("airport", "barcelona_city", "MINIVAN")).toBe(65);
    expect(lookupFixedPriceByZone("airport", "barcelona_city", "LUXURY_MINIVAN")).toBe(75);
    // Every Business vehicle pays the column. The Camry once had a €50
    // per-route override; it was removed, and the fare rose to €70 on the
    // owner's table of 13 Aug 2026. This is also the E-Class fare.
    expect(lookupPriceByClass("BCN_AIRPORT", "BARCELONA_CITY", "BUSINESS")).toBe(70);
    expect(lookupPriceByClass("BCN_AIRPORT", "BARCELONA_CITY", "LUXURY")).toBe(70);
    expect(lookupPriceByClass("BCN_AIRPORT", "BARCELONA_CITY", "LUXURY_MINIVAN")).toBe(75);
  });
});

// ── 1. Route count ────────────────────────────────────────────────────────────

describe("FIXED_ROUTES count", () => {
  // 73 since 13 Aug 2026: Girona city, Begur/Aiguablava, Vilanova i la Geltrú
  // and Reus Airport were added, each from both origins.
  it("has exactly 73 routes", () => {
    expect(FIXED_ROUTES.length).toBe(73);
  });
});

// ── 1b. Same-zone route (within Barcelona city) ──────────────────────────────

describe("Barcelona city → Barcelona city (same-zone route)", () => {
  it("resolves instead of falling through to a custom quote", () => {
    expect(lookupFixedPriceByZone("barcelona_city", "barcelona_city", "ECONOMY")).toBe(50);
    expect(lookupFixedPriceByZone("barcelona_city", "barcelona_city", "MINIVAN")).toBe(65);
  });

  it("matches the airport ⇄ city price for every vehicle class", () => {
    for (const vc of ["ECONOMY", "MINIVAN", "VCLASS", "MINIBUS"] as const) {
      expect(lookupFixedPriceByZone("barcelona_city", "barcelona_city", vc))
        .toBe(lookupFixedPriceByZone("airport", "barcelona_city", vc));
    }
  });

  it("prices Business at the same €70 as airport ⇄ city", () => {
    expect(lookupPriceByClass("BARCELONA_CITY", "BARCELONA_CITY", "BUSINESS")).toBe(70);
    expect(lookupPriceByClass("BARCELONA_CITY", "BARCELONA_CITY", "LUXURY")).toBe(70);
  });

  it("a same-zone pair with no defined route still returns null (custom quote)", () => {
    expect(lookupFixedPriceByZone("sitges", "sitges", "ECONOMY")).toBeNull();
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

  // Cars whose fare is still the column, i.e. those with no per-car price.
  // EQE_300 dropped off this list on 13 Aug 2026 when the owner priced it at
  // €65 against a €70 Business column; its class, LUXURY, still reads the
  // column and is asserted separately below.
  const sameCases: Array<[string, string]> = [
    ["V_CLASS",       "VCLASS"],
    ["LUXURY",        "BUSINESS"],       // DB class, no per-car price of its own
    ["LUXURY_MINIVAN","VCLASS"],         // DB class: V-Class → VCLASS
  ];

  sameCases.forEach(([alias, canonical]) => {
    it(`${alias} resolves same price as ${canonical} column`, () => {
      const aliasPrice     = lookupFixedPriceByZone(from, to, alias);
      const canonicalPrice = lookupFixedPrice(pivot.from, pivot.to, canonical as VehicleCode);
      expect(aliasPrice).toBe(canonicalPrice);
    });
  });
});

// ── 4d. Per-route vehicle class overrides (airport → city only) ───────────────

describe("Per-route vehicle class overrides (BCN Airport → Barcelona City)", () => {
  it("has no class-level override left — the class column answers €70", () => {
    // A €50 Camry override used to live here. It meant the fare depended on
    // which code path answered: the database returned €60 for every normal
    // booking while the offline fallback returned €50. The override went, and
    // the fare then rose to €70 on the owner's 13 Aug table.
    expect(lookupPriceByClass("BCN_AIRPORT", "BARCELONA_CITY", "BUSINESS")).toBe(70);
    expect(lookupFixedPrice("BCN_AIRPORT", "BARCELONA_CITY", "BUSINESS")).toBe(70);
  });

  // The owner set per-car prices on 13 Aug 2026: Camry €60, Tesla €60,
  // EQE €65. The class prices below are unchanged — the E-Class is a Business
  // car with no per-car price and still pays the €70 column.
  it("Tesla Model 3 costs €60, while its class still reads the €70 column", () => {
    expect(lookupFixedPriceByZone("airport", "barcelona_city", "TESLA_M3")).toBe(60);
    expect(lookupPriceByClass("BCN_AIRPORT", "BARCELONA_CITY", "ELECTRIC_VIP")).toBe(70);
    expect(lookupFixedPriceByZone("airport", "barcelona_city", "ELECTRIC_VIP")).toBe(70);
  });

  it("EQE 300 costs €65, while its class still reads the €70 column", () => {
    expect(lookupFixedPriceByZone("airport", "barcelona_city", "EQE_300")).toBe(65);
    expect(lookupPriceByClass("BCN_AIRPORT", "BARCELONA_CITY", "LUXURY")).toBe(70);
    expect(lookupFixedPriceByZone("airport", "barcelona_city", "LUXURY")).toBe(70);
  });

  it("Camry costs €60 — the price the E-Class cannot share with it", () => {
    expect(lookupFixedPriceByZone("airport", "barcelona_city", "CAMRY")).toBe(60);
    // Both are Business. Only the per-car price tells them apart.
    expect(lookupPriceByClass("BCN_AIRPORT", "BARCELONA_CITY", "BUSINESS")).toBe(70);
  });

  it("prices the same in both directions (city → airport same as airport → city)", () => {
    expect(lookupPriceByClass("BARCELONA_CITY", "BCN_AIRPORT", "BUSINESS")).toBe(70);
    expect(lookupPriceByClass("BARCELONA_CITY", "BCN_AIRPORT", "ELECTRIC_VIP")).toBe(70);
    expect(lookupPriceByClass("BARCELONA_CITY", "BCN_AIRPORT", "LUXURY")).toBe(70);
  });

  it("overrides do NOT affect other routes (e.g. airport → Montserrat stays at BUSINESS column)", () => {
    // The Camry override applies to the airport→city route alone. Montserrat
    // must keep reading its own BUSINESS column, whatever that column says.
    // Repriced to 140 on 13 Aug 2026; the point of the test is the isolation,
    // not the figure.
    expect(lookupPriceByClass("BCN_AIRPORT", "MONTSERRAT", "BUSINESS")).toBe(140);
    expect(lookupPriceByClass("BCN_AIRPORT", "MONTSERRAT", "ELECTRIC_VIP")).toBe(140);
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
  it("Montserrat costs the same from the airport as from the city", () => {
    // Until 7 Aug 2026 the airport route was €95 and the city route €115, and
    // this test asserted that gap was deliberate. The owner has since repriced
    // both routes to a single figure, so the asymmetry is gone on purpose.
    const airportToMontserrat   = lookupFixedPrice("BCN_AIRPORT",    "MONTSERRAT", "ECONOMY")!;
    const barcelonaToMontserrat = lookupFixedPrice("BARCELONA_CITY", "MONTSERRAT", "ECONOMY")!;
    expect(airportToMontserrat).toBe(110);
    expect(barcelonaToMontserrat).toBe(110);
  });

  it("pins the full Montserrat price ladder", () => {
    // Owner-set, 7 Aug 2026. Both routes carry the identical ladder, and each
    // vehicle must cost more than the one below it — the minibus in particular,
    // which was the figure not supplied and had to be derived.
    for (const from of ["BCN_AIRPORT", "BARCELONA_CITY"] as const) {
      const ladder = {
        ECONOMY:        lookupFixedPrice(from, "MONTSERRAT", "ECONOMY"),
        BUSINESS:       lookupFixedPrice(from, "MONTSERRAT", "BUSINESS"),
        MINIVAN:        lookupFixedPrice(from, "MONTSERRAT", "MINIVAN"),
        VCLASS:         lookupFixedPrice(from, "MONTSERRAT", "VCLASS"),
        MINIBUS:        lookupFixedPrice(from, "MONTSERRAT", "MINIBUS"),
      };
      expect(ladder, from).toEqual({
        ECONOMY: 110, BUSINESS: 140, MINIVAN: 145, VCLASS: 200, MINIBUS: 285,
      });
      // A 16-seat minibus must never be priced at or below a 7-seat V-Class.
      expect(ladder.MINIBUS!, from).toBeGreaterThan(ladder.VCLASS!);
    }
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
  it("Airport→Sitges has a fixed price (was added as a direct route)", () => {
    expect(lookupFixedPrice("BCN_AIRPORT", "SITGES", "ECONOMY")).not.toBeNull();
  });

  it("Airport→Tarragona has a fixed price (was added as a direct route)", () => {
    expect(lookupFixedPrice("BCN_AIRPORT", "TARRAGONA", "ECONOMY")).not.toBeNull();
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

describe("Costa routes", () => {
  const costaRoutes = FIXED_ROUTES.filter(
    (r) => r.category === "costa-dorada" || r.category === "costa-brava"
  );

  // 56 since 13 Aug 2026: Begur/Aiguablava on the Costa Brava, Vilanova i la
  // Geltrú and Reus Airport on the Costa Dorada, each from both origins.
  it("has 56 costa routes total (28 airport + 28 city-origin)", () => {
    expect(costaRoutes.length).toBe(56);
  });

  it("28 of the costa routes have BCN_AIRPORT as origin (direct airport pickups added)", () => {
    const airportCosta = costaRoutes.filter(
      (r) => r.from === "BCN_AIRPORT" || r.to === "BCN_AIRPORT"
    );
    expect(airportCosta.length).toBe(28);
  });
});

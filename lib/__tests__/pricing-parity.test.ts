/**
 * Pricing parity tests — Phase 6
 *
 * Asserts that for every route × vehicle combination:
 *   ROUTES[row].{economy|business|...} === lookupFixedPriceByZone(from, to, vc)
 *
 * Also asserts bidirectionality: lookup(A,B,v) === lookup(B,A,v).
 *
 * If any of these fail, the pricing table and booking form are out of sync.
 */

import { describe, it, expect } from "vitest";
import {
  ROUTES,
  lookupFixedPriceByZone,
  resolveZone,
} from "../pricing";
import type { VehicleClass } from "../../types";

// Map the 5 table columns to a VehicleClass that should resolve to each code
const COLUMN_TO_VC: Array<{ col: keyof typeof ROUTES[0]; vc: VehicleClass }> = [
  { col: "economy",  vc: "ECONOMY"        },
  { col: "business", vc: "BUSINESS"       },
  { col: "minivan",  vc: "MINIVAN"        },
  { col: "vclass",   vc: "LUXURY_MINIVAN" },
  { col: "minibus",  vc: "MINIBUS"        },
];

// Additional VehicleClass aliases that should map to an existing column
const ALIAS_CHECKS: Array<{ vc: VehicleClass; aliasOf: VehicleClass }> = [
  { vc: "ELECTRIC_VIP", aliasOf: "ECONOMY"        },
  { vc: "LUXURY",       aliasOf: "BUSINESS"       },
  { vc: "SUV",          aliasOf: "BUSINESS"       },
  { vc: "FIRST_CLASS",  aliasOf: "BUSINESS"       },
];

describe("Pricing parity: table vs lookupFixedPriceByZone", () => {
  ROUTES.forEach((route) => {
    const { from, to, label } = route;

    COLUMN_TO_VC.forEach(({ col, vc }) => {
      const expected = route[col] as number;

      it(`${label} · ${vc} → €${expected}`, () => {
        const result = lookupFixedPriceByZone(from, to, vc);
        expect(result).toBe(expected);
      });

      it(`${label} · ${vc} is bidirectional`, () => {
        const forward  = lookupFixedPriceByZone(from, to, vc);
        const reverse  = lookupFixedPriceByZone(to, from, vc);
        expect(forward).toBe(reverse);
      });
    });

    // Alias checks for the first route only (spot check — the mapping is class-level)
    if (route === ROUTES[0]) {
      ALIAS_CHECKS.forEach(({ vc, aliasOf }) => {
        const canonical = route[COLUMN_TO_VC.find((c) => c.vc === aliasOf)!.col] as number;

        it(`alias: ${vc} prices same as ${aliasOf} (€${canonical})`, () => {
          const result = lookupFixedPriceByZone(from, to, vc);
          expect(result).toBe(canonical);
        });
      });
    }
  });
});

describe("Pricing parity: null for unknown routes", () => {
  it("unknown from-zone returns null", () => {
    expect(lookupFixedPriceByZone("madrid_centre", "barcelona_city", "ECONOMY")).toBeNull();
  });

  it("same zone A → A returns null", () => {
    expect(lookupFixedPriceByZone("airport", "airport", "ECONOMY")).toBeNull();
  });

  it("empty string returns null", () => {
    expect(lookupFixedPriceByZone("", "barcelona_city", "ECONOMY")).toBeNull();
  });
});

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

describe("LUXURY_SUV midpoint pricing", () => {
  it("LUXURY_SUV is midpoint of BUSINESS and VCLASS for airport→barcelona_city", () => {
    const business = lookupFixedPriceByZone("airport", "barcelona_city", "BUSINESS"); // 60
    const vclass   = lookupFixedPriceByZone("airport", "barcelona_city", "LUXURY_MINIVAN"); // 75
    const mid      = lookupFixedPriceByZone("airport", "barcelona_city", "LUXURY_SUV");
    expect(mid).toBe(Math.round((business! + vclass!) / 2));
  });
});

import { describe, it, expect } from "vitest";
import {
  FIXED_ROUTES,
  lookupPriceByClass,
  lookupPriceByFleetVehicle,
} from "@/lib/fixed-prices";
import { getFleetFromPrice, lookupFixedPriceByZone } from "@/lib/pricing";
import { FLEET_TO_DB_CLASS, VEHICLE_CATALOG, type FleetVehicle } from "@/types";

/**
 * Per-car prices, set by the owner on 13 Aug 2026.
 *
 * The five price columns cannot separate cars that share one, and neither can
 * VehicleClass: the Camry and the E-Class are both Business, priced €60 and
 * €70. So the price is keyed on the car.
 *
 * The risk this carries is the one that made per-vehicle overrides suspect in
 * the first place — a route charging one figure on the page and another at the
 * checkout. The last describe block is what holds that shut.
 */

// The six routes whose Business column is €70.
const CITY_TIER = [
  "bcn-airport-barcelona-city",
  "barcelona-city-barcelona-city",
  "bcn-airport-cruise-terminal",
  "cruise-terminal-barcelona-city",
  "bcn-airport-castelldefels",
  "barcelona-city-castelldefels",
];

const EXPECTED: [FleetVehicle, number][] = [
  ["CAMRY", 60],
  ["TESLA_M3", 60],
  ["EQE_300", 65],
];

describe("the owner's per-car prices", () => {
  it.each(CITY_TIER)("%s prices each car as instructed", (slug) => {
    const route = FIXED_ROUTES.find((r) => r.slug === slug)!;
    expect(route, slug).toBeDefined();
    for (const [car, price] of EXPECTED) {
      expect(
        lookupPriceByFleetVehicle(route.from, route.to, car),
        `${slug} ${car}`,
      ).toBe(price);
    }
  });

  it("leaves the Business column at €70, which is the E-Class fare", () => {
    for (const slug of CITY_TIER) {
      const route = FIXED_ROUTES.find((r) => r.slug === slug)!;
      expect(route.prices.BUSINESS, slug).toBe(70);
      // Anything Business without a per-car price of its own still pays €70 —
      // which is what the E-Class will do when it joins the fleet.
      expect(lookupPriceByClass(route.from, route.to, "BUSINESS")).toBe(70);
    }
  });

  it("shows the per-car price on the fleet page", () => {
    expect(getFleetFromPrice("CAMRY")).toBe(60);
    expect(getFleetFromPrice("TESLA_M3")).toBe(60);
    expect(getFleetFromPrice("EQE_300")).toBe(65);
    // Untouched.
    expect(getFleetFromPrice("COROLLA")).toBe(50);
    expect(getFleetFromPrice("SPRINTER")).toBe(180);
  });

  it("changes nothing on routes outside the city tier", () => {
    // Sitges Business is €100 and no car is priced separately there.
    const sitges = FIXED_ROUTES.find((r) => r.slug === "bcn-airport-sitges")!;
    for (const [car] of EXPECTED) {
      expect(lookupPriceByFleetVehicle(sitges.from, sitges.to, car)).toBe(
        sitges.prices[car === "CAMRY" ? "BUSINESS" : "BUSINESS"],
      );
    }
  });

  it("prices a car with no override exactly as its class", () => {
    for (const v of VEHICLE_CATALOG) {
      const car = v.class;
      if (EXPECTED.some(([c]) => c === car)) continue;
      const route = FIXED_ROUTES.find((r) => r.slug === "bcn-airport-sitges")!;
      expect(
        lookupPriceByFleetVehicle(route.from, route.to, car),
        car,
      ).toBe(lookupPriceByClass(route.from, route.to, FLEET_TO_DB_CLASS[car]));
    }
  });
});

describe("the zone lookup the quote path uses agrees", () => {
  // lookupFixedPriceByZone is what the pricing service calls. If it disagreed
  // with the fleet page, the site would advertise one price and charge another.
  const ZONES: [string, string][] = [
    ["airport", "barcelona_city"],
    ["barcelona_city", "barcelona_city"],
    ["airport", "cruise"],
    ["cruise", "barcelona_city"],
    ["airport", "castelldefels"],
    ["barcelona_city", "castelldefels"],
  ];

  it.each(ZONES)("%s → %s quotes the per-car price", (from, to) => {
    for (const [car, price] of EXPECTED) {
      expect(lookupFixedPriceByZone(from, to, car), `${from}→${to} ${car}`).toBe(price);
    }
    // The class lookup still returns the column, for the E-Class.
    expect(lookupFixedPriceByZone(from, to, "BUSINESS")).toBe(70);
  });
});

describe("a per-car price cannot diverge from the column silently", () => {
  /**
   * Every override must be cheaper than the column it overrides.
   *
   * Not an arbitrary rule. A customer picks a car and is quoted for it; if an
   * override were ever ABOVE the column, the class lookup — still reachable
   * from any caller that has only a VehicleClass — would quote less than the
   * car actually costs, and the checkout would surprise them upwards. Cheaper
   * is safe in a way dearer is not.
   */
  it("never prices a car above its own class", () => {
    const wrong: string[] = [];
    for (const route of FIXED_ROUTES) {
      for (const [car, price] of Object.entries(route.vehicleOverrides ?? {})) {
        const cls = lookupPriceByClass(route.from, route.to, FLEET_TO_DB_CLASS[car as FleetVehicle]);
        if (cls !== null && price > cls) {
          wrong.push(`${route.slug} ${car} €${price} > class €${cls}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("only names cars that are actually in the fleet", () => {
    const known = new Set(VEHICLE_CATALOG.map((v) => v.class));
    const unknown: string[] = [];
    for (const route of FIXED_ROUTES) {
      for (const car of Object.keys(route.vehicleOverrides ?? {})) {
        if (!known.has(car as FleetVehicle)) unknown.push(`${route.slug}: ${car}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it("keeps every override a whole number of euros", () => {
    for (const route of FIXED_ROUTES) {
      for (const [car, price] of Object.entries(route.vehicleOverrides ?? {})) {
        expect(Number.isInteger(price), `${route.slug} ${car}`).toBe(true);
      }
    }
  });
});

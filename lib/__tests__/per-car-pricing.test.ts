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
 * The tiers as the customer sees them: Economy is the Corolla at €50, Standard
 * the Camry at €60, Electric the Tesla at €60, Business the EQE 300 at €65.
 *
 * Three of those four are columns. The Camry and the Tesla are not: they are
 * stored under BUSINESS and ELECTRIC_VIP, both of which read the €65 Business
 * column, so without a price of their own they would cost €65 rather than €60.
 * VehicleClass cannot fix that — a class is not a car — so the price is keyed
 * on the car.
 *
 * The risk this carries is the one that made per-vehicle overrides suspect in
 * the first place: a route charging one figure on the page and another at the
 * checkout. The last describe block is what holds that shut.
 */

// The six routes whose Business column is €65.
const CITY_TIER = [
  "bcn-airport-barcelona-city",
  "barcelona-city-barcelona-city",
  "bcn-airport-cruise-terminal",
  "cruise-terminal-barcelona-city",
  "bcn-airport-castelldefels",
  "barcelona-city-castelldefels",
];

// Cars with a price of their own. The EQE is not here: it is the Business car
// and the €65 column already says so, which is the point of naming the tier
// after the car that fills it.
const EXPECTED: [FleetVehicle, number][] = [
  ["CAMRY", 60],
  ["TESLA_M3", 60],
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

  it("sets the Business column to €65, which is the EQE — the Business car", () => {
    for (const slug of CITY_TIER) {
      const route = FIXED_ROUTES.find((r) => r.slug === slug)!;
      expect(route.prices.BUSINESS, slug).toBe(65);
      expect(lookupPriceByClass(route.from, route.to, "BUSINESS")).toBe(65);
      // The EQE needs no per-car price: the column is its price.
      expect(lookupPriceByFleetVehicle(route.from, route.to, "EQE_300"), slug).toBe(65);
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
    // The class lookup returns the column, which is the EQE's fare.
    expect(lookupFixedPriceByZone(from, to, "BUSINESS")).toBe(65);
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

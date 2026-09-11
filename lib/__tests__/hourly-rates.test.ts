import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOURLY_RATES, MIN_HOURLY_HOURS, HOURLY_INCLUDED_KM } from "@/lib/pricing";
import { HOURLY_FLEET, HOURLY_FROM } from "@/lib/hourly-fleet";
import { FLEET_TO_DB_CLASS, VEHICLE_CATALOG } from "@/types";

/**
 * /hourly publishes a price for every car, and /api/quote and /api/bookings
 * charge one. These guard the join between them.
 *
 * The page used to print four rate cards keyed on vehicle class, which left
 * three cars off it entirely and priced the Tesla and the EQE as one line at a
 * single figure. They are priced apart now, so the page has to read every rate
 * from lib/pricing rather than carry its own copy.
 */
const PAGE = readFileSync(join(process.cwd(), "app", "hourly", "page.tsx"), "utf-8");
const GRID = readFileSync(
  join(process.cwd(), "components", "hourly", "HourlyRateGrid.tsx"),
  "utf-8",
);

describe("hourly rates", () => {
  it("charges what the page publishes, for every car", () => {
    for (const v of HOURLY_FLEET) {
      expect(v.rate, v.label).toBe(HOURLY_RATES[FLEET_TO_DB_CLASS[v.vehicle]]);
      expect(v.minHours, v.label).toBe(MIN_HOURLY_HOURS[FLEET_TO_DB_CLASS[v.vehicle]]);
    }
  });

  it("holds the rates the owner set on 10 Sep 2026", () => {
    const byCar = Object.fromEntries(HOURLY_FLEET.map((v) => [v.vehicle, v.rate]));
    expect(byCar).toEqual({
      COROLLA:  45,
      CAMRY:    50,
      TESLA_M3: 55,
      EQE_300:  60,
      VITO:     65,
      V_CLASS:  75,
      SPRINTER: 160,
    });
  });

  it("shows every car, not a hand-picked few", () => {
    expect(HOURLY_FLEET).toHaveLength(VEHICLE_CATALOG.length);
    expect(HOURLY_FROM).toBe(Math.min(...Object.values(HOURLY_RATES)));
  });

  it("names the Lexus on the tier it shares a rate with", () => {
    // Offered by the hour but not a fleet vehicle: no page, no photograph and
    // no fixed fare, so it rides on the business saloon card rather than
    // getting invented ones.
    const camry = HOURLY_FLEET.find((v) => v.vehicle === "CAMRY");
    expect(camry?.alsoOffered).toBe("Lexus");
    expect(HOURLY_FLEET.filter((v) => v.alsoOffered)).toHaveLength(1);
  });

  it("never types a euro figure into the page or the grid", () => {
    // A literal "€45" here is how the rate and the charge drift apart.
    expect(PAGE).not.toMatch(/€\d/);
    expect(GRID).not.toMatch(/€\d/);
    expect(GRID).toContain("formatCurrency(v.rate)");
  });

  it("publishes the included distance rather than leaving it to be asked", () => {
    expect(HOURLY_INCLUDED_KM).toBe(150);
    expect(PAGE).toContain("HOURLY_INCLUDED_KM");
    expect(GRID).toContain("HOURLY_INCLUDED_KM");
  });
});

describe("hourly structured data", () => {
  /**
   * The /fleet markup published an hourly rate as a flat `price`, which reads
   * as "a V-Class costs 75 euros" when the smallest booking is four hours of
   * it, and put the four-hour minimum in `referenceQuantity`, which states a
   * quarter of the real rate. Neither mistake belongs on the page whose whole
   * subject is the hourly rate.
   */
  const SCHEMA = PAGE.slice(PAGE.indexOf("const HOURLY_SCHEMA"), PAGE.indexOf("const INCLUDED"));

  it("prices an hour as an hour", () => {
    expect(SCHEMA).toContain('"@type": "UnitPriceSpecification"');
    expect(SCHEMA).toContain('referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "HUR" }');
  });

  it("states the minimum booking as a minimum, not as the quantity priced", () => {
    expect(SCHEMA).toContain("eligibleQuantity");
    expect(SCHEMA).toContain("minValue: v.minHours");
  });

  it("does not advertise a bare hourly rate as the price of a car", () => {
    // `price:` is allowed inside the UnitPriceSpecification, where it is
    // qualified by a unit. It must not appear on the Offer itself.
    const offerHead = SCHEMA.slice(SCHEMA.indexOf("offers:"), SCHEMA.indexOf("priceSpecification"));
    expect(offerHead).not.toMatch(/\bprice:/);
  });
});

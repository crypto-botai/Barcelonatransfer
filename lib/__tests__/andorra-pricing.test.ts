import { describe, it, expect } from "vitest";
import {
  FIXED_ROUTES,
  RETURN_LEG_SURCHARGES,
  returnLegSurcharge,
  lookupPriceByClass,
  type VehicleCode,
  type ZoneCode,
} from "@/lib/fixed-prices";

/**
 * Andorra, repriced by the owner on 5 Sep 2026.
 *
 * Two things are being held here. The first is the fare itself, across all five
 * columns and both Andorra routes — the airport one and the city one — because
 * the previous reprice touched a single column and the risk with a table this
 * wide is silently moving a neighbour.
 *
 * The second is the return surcharge, which is the first direction-aware price
 * in the system. Every other lookup matches a route both ways round, so the
 * test that matters is not that the surcharge exists but that it stays on one
 * side: Andorra outbound must cost exactly what the table says, with nothing
 * added.
 */

const ANDORRA_FARES: Record<VehicleCode, number> = {
  ECONOMY:  350,
  BUSINESS: 450,
  MINIVAN:  465,
  VCLASS:   550,
  MINIBUS:  1100,
};

const ANDORRA_ROUTES = ["bcn-airport-andorra", "barcelona-city-andorra"];

describe("Andorra fares", () => {
  for (const slug of ANDORRA_ROUTES) {
    it(`${slug} charges the owner's figures in every column`, () => {
      const route = FIXED_ROUTES.find((r) => r.slug === slug);
      expect(route, `${slug} missing from the table`).toBeDefined();
      expect(route!.prices).toEqual(ANDORRA_FARES);
    });
  }

  it("prices the 16-seater at double the V-Class, the rule set for it", () => {
    expect(ANDORRA_FARES.MINIBUS).toBe(ANDORRA_FARES.VCLASS * 2);
  });

  it("leaves every other route alone", () => {
    // A guard against a reprice reaching further than it was meant to. Any
    // route that is not one of the two Andorra ones must not be carrying the
    // Andorra numbers by accident.
    const others = FIXED_ROUTES.filter((r) => !ANDORRA_ROUTES.includes(r.slug));
    expect(others).toHaveLength(FIXED_ROUTES.length - 2);
    for (const r of others) {
      expect(r.prices, `${r.slug} looks like an Andorra route`).not.toEqual(ANDORRA_FARES);
    }
  });
});

describe("return leg surcharge", () => {
  it("adds €20 coming back out of Andorra", () => {
    expect(returnLegSurcharge("ANDORRA", "BARCELONA_CITY")).toBe(20);
    expect(returnLegSurcharge("ANDORRA", "BCN_AIRPORT")).toBe(20);
  });

  it("adds nothing on the way there", () => {
    expect(returnLegSurcharge("BARCELONA_CITY", "ANDORRA")).toBe(0);
    expect(returnLegSurcharge("BCN_AIRPORT", "ANDORRA")).toBe(0);
  });

  it("leaves every other journey untouched", () => {
    // The surcharge is opt-in by ordered pair, so the thing worth proving is
    // that no pair outside the list picks it up.
    const listed = new Set(RETURN_LEG_SURCHARGES.map((s) => `${s.from}>${s.to}`));
    const zones = new Set<ZoneCode>();
    for (const r of FIXED_ROUTES) {
      zones.add(r.from);
      zones.add(r.to);
    }
    for (const from of zones) {
      for (const to of zones) {
        if (listed.has(`${from}>${to}`)) continue;
        expect(returnLegSurcharge(from, to), `${from} -> ${to}`).toBe(0);
      }
    }
  });

  it("does not disturb the table price it is added to", () => {
    // The surcharge lives outside the lookup on purpose: the table stays
    // direction-blind, and the route pages that read it keep quoting the
    // outbound fare.
    expect(lookupPriceByClass("ANDORRA", "BARCELONA_CITY", "ECONOMY")).toBe(350);
    expect(lookupPriceByClass("BARCELONA_CITY", "ANDORRA", "ECONOMY")).toBe(350);
  });
});

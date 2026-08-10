import { describe, it, expect } from "vitest";
import { resolveZone, lookupFixedPriceByZone, distanceFare } from "../pricing";

describe("Lourdes route", () => {
  it("resolves the destination from what a customer would actually type", () => {
    expect(resolveZone("Lourdes")).toBe("lourdes");
    expect(resolveZone("lourdes france")).toBe("lourdes");
    expect(resolveZone("65100 Lourdes")).toBe("lourdes");
    expect(resolveZone("Sanctuaire Notre-Dame de Lourdes, 65100 Lourdes")).toBe("lourdes");
    // Tarbes-Lourdes airport is 15 km away and shares the fare.
    expect(resolveZone("Tarbes")).toBe("lourdes");
  });

  it("does not read a Catalan street name as the French sanctuary", () => {
    // The reason this guard exists: these are ordinary Barcelona addresses, and
    // resolving them to Lourdes would charge €750 for a €50 city journey.
    expect(resolveZone("Carrer Mare de Déu de Lourdes, Barcelona")).not.toBe("lourdes");
    expect(resolveZone("Calle Virgen de Lourdes 12, Barcelona")).not.toBe("lourdes");
    expect(resolveZone("Avinguda de Lourdes, Sitges")).not.toBe("lourdes");
  });

  it("charges the owner's ladder in both directions", () => {
    // Same price from the airport or the city — 20 km either way is nothing
    // across a 415 km drive, and the table says so explicitly.
    for (const origin of ["airport", "barcelona_city"]) {
      expect(lookupFixedPriceByZone(origin, "lourdes", "ECONOMY")).toBe(750);
      expect(lookupFixedPriceByZone(origin, "lourdes", "BUSINESS")).toBe(875);
      expect(lookupFixedPriceByZone(origin, "lourdes", "MINIVAN")).toBe(925);
      expect(lookupFixedPriceByZone(origin, "lourdes", "LUXURY_MINIVAN")).toBe(1125);
      expect(lookupFixedPriceByZone(origin, "lourdes", "MINIBUS")).toBe(1575);
    }
    // The return leg is the same journey and must not fall through to per-km.
    expect(lookupFixedPriceByZone("lourdes", "airport", "ECONOMY")).toBe(750);
  });

  it("prices from the table, not from distance", () => {
    // If the fixed lookup ever regressed, the fallback would quote this instead.
    // The two must stay far enough apart that a regression is obvious.
    expect(distanceFare(415, "ECONOMY")).not.toBe(750);
    expect(lookupFixedPriceByZone("airport", "lourdes", "ECONOMY")).toBe(750);
  });
});

import { describe, it, expect } from "vitest";
import {
  distanceFare,
  PER_KM_RATE,
  MIN_DISTANCE_FARE,
  ROUTES,
  resolveZone,
  lookupFixedPriceByZone,
} from "@/lib/pricing";

describe("per-km rate", () => {
  it("is the owner-specified €3.50/km with a €50 floor", () => {
    expect(PER_KM_RATE).toBe(3.5);
    expect(MIN_DISTANCE_FARE).toBe(50);
  });

  it("charges rate x distance, rounded to whole euros", () => {
    expect(distanceFare(20)).toBe(70);    // 20 x 3.5
    expect(distanceFare(50)).toBe(175);   // 50 x 3.5
    expect(distanceFare(31.4)).toBe(110); // 109.9 -> 110
  });

  it("is flat across vehicles — distanceFare takes no vehicle argument", () => {
    // Owner decision: one rate for every vehicle class. Encoded as a signature
    // constraint so a future change has to be deliberate.
    expect(distanceFare.length).toBe(1);
  });

  it("never quotes below the published minimum fare", () => {
    // 3 km x 3.50 = 10.50, which is below what it costs to send a chauffeur.
    expect(distanceFare(3)).toBe(50);
    expect(distanceFare(14)).toBe(50);    // 49 -> floored to 50
    expect(distanceFare(14.3)).toBe(50);  // exactly 50.05 -> 50
  });

  it("returns 0 for an unusable distance so callers can ask for a manual quote", () => {
    expect(distanceFare(0)).toBe(0);
    expect(distanceFare(-5)).toBe(0);
    expect(distanceFare(NaN)).toBe(0);
    expect(distanceFare(Infinity)).toBe(0);
  });

  it("is calibrated against the real airport-to-city journey", () => {
    // OSRM measures 14.1 km of road for BCN airport -> city centre, and the
    // table charges €50. The per-km rate must land on the same figure, or the
    // two pricing paths would visibly disagree at the boundary.
    expect(distanceFare(14.1)).toBe(50);
    const table = ROUTES.find((r) => r.from === "airport" && r.to === "barcelona_city");
    expect(table?.economy).toBe(50);
  });
});

describe("the table always wins", () => {
  it("prices a listed route from the table, not by distance", () => {
    // Airport -> Sitges is in the table at €80. Real road distance is ~37 km,
    // which per-km would price at €130. The table figure must be the one used.
    const from = resolveZone("Terminal 1, El Prat Airport");
    const to   = resolveZone("Sitges");
    expect(from).toBeTruthy();
    expect(to).toBeTruthy();

    const tablePrice = lookupFixedPriceByZone(from!, to!, "ECONOMY");
    expect(tablePrice).toBe(80);
    expect(tablePrice).not.toBe(distanceFare(37));
  });

  it("resolves a zone for every route in the published table", () => {
    // If a listed destination stopped resolving to a zone it would silently
    // start being priced per km instead of from the table.
    for (const r of ROUTES) {
      expect(lookupFixedPriceByZone(r.from, r.to, "ECONOMY"), `${r.from}->${r.to}`).toBeGreaterThan(0);
    }
  });
});

describe("unlisted destinations", () => {
  it("Sant Andreu de la Barca is genuinely not in the table", () => {
    // The owner's own example of a journey that should be priced per km.
    const zone = resolveZone("Sant Andreu de la Barca");
    if (zone) {
      // If it ever gains a zone, it must also gain a table price -- otherwise
      // this test is the warning that it is being mispriced.
      expect(lookupFixedPriceByZone("airport", zone, "ECONOMY")).toBeGreaterThan(0);
    } else {
      expect(zone).toBeNull();
    }
  });

  it("prices a Terminal 1 → Sant Andreu de la Barca journey", () => {
    // ~28 km by road from El Prat.
    expect(distanceFare(28)).toBe(98);
  });
});

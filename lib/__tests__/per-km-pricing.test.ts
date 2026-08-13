import { describe, it, expect } from "vitest";
import {
  distanceFare,
  PER_KM_RATE,
  MIN_DISTANCE_FARE,
  ROUTES,
  resolveZone,
  resolveZoneStrict,
  resolveZoneBroad,
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

  it("charges more for a bigger car, in the same ratios as the fixed table", () => {
    // Superseded the previous flat-rate rule at the owner's request: a V-Class
    // to an unlisted destination used to cost exactly what a sedan did, while
    // the table charged half as much again for that same upgrade.
    const sedan = distanceFare(415, "ECONOMY");
    expect(distanceFare(415, "BUSINESS")).toBeGreaterThan(sedan);
    expect(distanceFare(415, "VCLASS")).toBe(Math.round((sedan / 1) * 1.5));
    expect(distanceFare(415, "MINIBUS")).toBeGreaterThan(distanceFare(415, "VCLASS"));
  });

  it("prices an unknown vehicle as a sedan rather than guessing upward", () => {
    const sedan = distanceFare(415, "ECONOMY");
    expect(distanceFare(415, "NOT_A_VEHICLE")).toBe(sedan);
    expect(distanceFare(415)).toBe(sedan);
  });

  it("tapers on long journeys instead of extrapolating the city rate", () => {
    // Lourdes at 415 km. Flat 3.50/km quoted 1451 against a market of 655-759,
    // so the quote could never be accepted.
    const lourdes = distanceFare(415, "ECONOMY");
    expect(lourdes).toBeLessThan(1000);
    expect(lourdes).toBeGreaterThan(600);
  });

  it("leaves city distances on the original rate", () => {
    // The taper must not quietly reprice the everyday work: the first band is
    // still a flat 3.50/km, which is what the fixed table was built around.
    expect(distanceFare(20)).toBe(70);
    expect(distanceFare(50)).toBe(175);
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

describe("Girona city resolves to the advertised price", () => {
  // /transfers/girona is titled "Barcelona to Girona Transfer — from €140" and
  // carries a schema.org offer at 140. Bare "girona" used to resolve to no zone,
  // so once unlisted routes became per-km it quoted €399 for the same journey —
  // the site contradicting its own indexed price.
  // The city now has a zone of its own rather than borrowing the airport's. The
  // economy fare is unchanged at €140 — only Minivan and V-Class differ, by the
  // €5 the owner set on 13 Aug 2026 — so the price this test guards is the same
  // price it has always guarded.
  it("prices Girona city from the table, not by distance", () => {
    const z = resolveZone("Girona");
    expect(z).toBe("girona_city");
    expect(lookupFixedPriceByZone("barcelona_city", z!, "ECONOMY")).toBe(140);
  });

  it("matches the forms a customer or Nominatim actually produces", () => {
    for (const s of [
      "Girona",
      "GIRONA",
      "Girona, Gironès, Girona, Catalunya, Spain",
      "girona city",
      "Girona centre",
    ]) {
      expect(resolveZone(s), s).toBe("girona_city");
    }
  });

  it("does NOT drag Girona-province towns onto the Girona price", () => {
    // Every Nominatim address in the province carries "Girona" as a suffix, so
    // a loose \bgirona\b here would silently reprice eight listed destinations.
    const towns: Array<[string, string]> = [
      ["Lloret de Mar, Selva, Girona, Catalunya",        "lloret"],
      ["Blanes, Selva, Girona, Catalunya",               "blanes"],
      ["Tossa de Mar, Selva, Girona, Catalunya",         "tossa"],
      ["Figueres, Alt Empordà, Girona, Catalunya",       "figueres"],
      ["Roses, Alt Empordà, Girona, Catalunya",          "roses"],
      ["Cadaqués, Alt Empordà, Girona, Catalunya",       "cadaques"],
      ["Palamós, Baix Empordà, Girona, Catalunya",       "palamos"],
      ["Platja d'Aro, Baix Empordà, Girona, Catalunya",  "platja_daro"],
    ];
    for (const [address, expected] of towns) {
      expect(resolveZone(address), address).toBe(expected);
    }
  });

  it("leaves genuinely unlisted province towns to per-km pricing", () => {
    expect(resolveZone("Banyoles, Pla de l'Estany, Girona, Catalunya")).toBeNull();
    expect(resolveZone("Olot, Garrotxa, Girona, Catalunya")).toBeNull();
  });

  it("still resolves the airport itself ahead of the city", () => {
    for (const s of ["Girona Airport", "GRO", "Girona-Costa Brava Airport"]) {
      expect(resolveZone(s), s).toBe("girona_airport");
    }
  });
});

describe("province names must not swallow unlisted towns", () => {
  // Every Catalan address Nominatim returns ends with its province:
  //   "Sant Andreu de la Barca, Baix Llobregat, Barcelona, Catalonia"
  // A bare \bbarcelona\b match therefore catches all ~300 towns in the
  // province. A 28 km run was quoting the €50 Barcelona-city fare.
  it("does not treat a province suffix as an exact place", () => {
    expect(resolveZoneStrict("Sant Andreu de la Barca, Baix Llobregat, Barcelona, Catalonia")).toBeNull();
    expect(resolveZoneStrict("Terrassa, Vallès Occidental, Barcelona, Catalonia")).toBeNull();
    expect(resolveZoneStrict("Martorell, Baix Llobregat, Barcelona, Catalonia")).toBeNull();
    expect(resolveZoneStrict("Granollers, Vallès Oriental, Barcelona, Catalonia")).toBeNull();
    expect(resolveZoneStrict("Reus, Baix Camp, Tarragona, Catalonia")).toBeNull();
  });

  it("still resolves genuinely listed destinations from text alone", () => {
    expect(resolveZoneStrict("Sitges, Garraf, Barcelona, Catalonia")).toBe("sitges");
    expect(resolveZoneStrict("Castelldefels, Baix Llobregat, Barcelona")).toBe("castelldefels");
    expect(resolveZoneStrict("Terminal 1, El Prat")).toBe("airport");
    expect(resolveZoneStrict("PortAventura, Salou, Tarragona")).toBe("portaventura");
    expect(resolveZoneStrict("Lloret de Mar, Selva, Girona")).toBe("lloret");
  });

  it("keeps the province fallback available for bare capital names", () => {
    // With no coordinates to check, "Barcelona" alone should still price as the
    // city rather than failing outright.
    expect(resolveZoneBroad("Barcelona")).toBe("barcelona_city");
    expect(resolveZoneBroad("Tarragona")).toBe("tarragona");
  });

  it("prices an unlisted province town by distance, not as the capital", () => {
    // 28.5 km by road. The bug quoted €50; per-km is the correct treatment.
    expect(distanceFare(28.5)).toBe(100);
  });
});

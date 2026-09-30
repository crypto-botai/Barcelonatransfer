import { describe, it, expect } from "vitest";
import { detectZoneFromCoords } from "@/lib/pricing";
import { FIXED_ROUTES } from "@/lib/fixed-prices";

/**
 * Girona city has to be identified from coordinates, not from address text.
 *
 * The text rule only fires on an address that starts with "Girona" or spells
 * out "Girona city". What a customer actually picks from the address box is
 * "Hotel AC Palau de Bellavista, Pujada dels Polvorins 1, Girona, Catalonia" —
 * city in the middle, matching neither. The bcn-airport-girona-city route was
 * therefore never found and the fare fell through to per-km: €327 charged
 * where the route says €165.
 *
 * Loosening the text rule to a bare "girona" would have traded that bug for a
 * worse one, because Girona is also the province. The towns at the bottom of
 * this file are the reason: each one carries "Girona" in its postal address
 * and each is well beyond the city.
 */

/** Hotel AC Palau de Bellavista, the drop-off that exposed this. */
const HOTEL = { lat: 41.9869, lng: 2.8270 };

describe("Girona city is found by coordinates", () => {
  it("resolves the city centre", () => {
    expect(detectZoneFromCoords(41.9794, 2.8214)).toBe("girona_city");
  });

  it("resolves a hotel address that the text rule cannot match", () => {
    expect(detectZoneFromCoords(HOTEL.lat, HOTEL.lng)).toBe("girona_city");
  });

  it("resolves the station and the old town", () => {
    expect(detectZoneFromCoords(41.9797, 2.8163)).toBe("girona_city"); // Girona station
    expect(detectZoneFromCoords(41.9874, 2.8253)).toBe("girona_city"); // cathedral
  });
});

describe("the fare it unlocks", () => {
  /**
   * The point of the zone: without it the route below is unreachable and the
   * customer is quoted per-km instead.
   */
  it("has a fixed route from the airport priced for every class", () => {
    const route = FIXED_ROUTES.find((r) => r.slug === "bcn-airport-girona-city");
    expect(route, "bcn-airport-girona-city is missing").toBeDefined();
    expect(route!.prices.ECONOMY).toBe(165);
    expect(route!.prices.BUSINESS).toBe(180);
  });

  it("is the zone that route names as its destination", () => {
    const route = FIXED_ROUTES.find((r) => r.slug === "bcn-airport-girona-city");
    expect(route!.to).toBe("GIRONA_CITY");
  });
});

describe("the province is not the city", () => {
  /**
   * Every one of these has "Girona" in its postal address and none may take
   * the Girona city fare. They are the reason the text rule stays tight and
   * the radius stays at 5 km.
   */
  const elsewhere: Array<[string, number, number]> = [
    ["Girona Airport", 41.9010, 2.7607],
    ["Lloret de Mar",  41.6980, 2.8410],
    ["Tossa de Mar",   41.7218, 2.9330],
    ["Figueres",       42.2676, 2.9624],
    ["Blanes",         41.6747, 2.7897],
    ["Olot",           42.1818, 2.4900],
    ["Banyoles",       42.1197, 2.7669],
    ["Palamos",        41.8449, 3.1304],
  ];

  for (const [name, lat, lng] of elsewhere) {
    it(`does not read ${name} as Girona city`, () => {
      expect(detectZoneFromCoords(lat, lng)).not.toBe("girona_city");
    });
  }

  /** Girona Airport keeps its own zone, and its own fare, as it always had. */
  it("still resolves Girona Airport to its own zone", () => {
    expect(detectZoneFromCoords(41.9010, 2.7607)).toBe("girona_airport");
  });

  /**
   * The two Girona zones must not overlap: the airport is 10.5 km from the
   * city centre, so a 5 km city radius and a 3 km airport radius leave a gap.
   */
  it("leaves a gap between the city and the airport", () => {
    expect(detectZoneFromCoords(41.9400, 2.7900)).toBe(null);
  });
});

import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: () => undefined }));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: () => new Proxy({}, { get: () => async () => [] }) }) }));

import { getQuote } from "@/lib/pricing-service";
import { FLEET_TO_DB_CLASS, VEHICLE_CATALOG } from "@/types";
import { hourlyRateFor } from "@/lib/pricing";
import { HOURLY_FLEET } from "@/lib/hourly-fleet";
import { isPortPlace, sClassKmFare, S_CLASS_MIN_FARE } from "@/lib/s-class-pricing";
import { waitBlockPriceFor, waitingState } from "@/lib/api/v1/waiting";

/**
 * The Mercedes-Maybach S 580, on the owner's rules of 22 Oct 2026:
 *  - instant, fixed: airport to city 250, city to airport 235, Sants to city 175, city to Sants 165,
 *    airport to Sants 250, Sants to airport 235
 *  - anywhere else but the port: 4.75 euros a kilometre
 *  - the port (cruise terminals, Moll Adossat) is never booked: a query instead
 *  - 160 an hour in the city, 195 outside it; waiting 160 an hour
 */

const AIRPORT = { lat: 41.2974, lng: 2.0833, address: "Barcelona Airport El Prat Terminal 1" };
const CITY = { lat: 41.3874, lng: 2.17, address: "Plaça de Catalunya, Barcelona" };
const HOTEL = { lat: 41.3874, lng: 2.1966, address: "Hotel Arts, Carrer de la Marina 19, Barcelona" };
const SANTS = { lat: 41.3791, lng: 2.1402, address: "Estació de Sants, Barcelona" };
const PORT = { lat: 41.3524, lng: 2.1827, address: "Barcelona Cruise Terminal, Port of Barcelona" };
const ADOSSAT = { lat: 41.3445, lng: 2.1655, address: "Moll Adossat, Terminal D" };
const TARRAGONA = { lat: 41.1189, lng: 1.2445, address: "Tarragona" };
const SITGES = { lat: 41.2372, lng: 1.8058, address: "Sitges" };
const WED = new Date("2026-11-04T10:00:00+01:00"); // not a weekend

type P = { lat: number; lng: number; address: string };
const quote = (from: P, to: P, extra: Record<string, unknown> = {}) =>
  getQuote({
    pickupLat: from.lat, pickupLng: from.lng, pickupAddress: from.address, dropoffLat: to.lat, dropoffLng: to.lng, dropoffAddress: to.address,
    vehicleClass: "FIRST_CLASS", fleetVehicle: "S_CLASS", pickupDatetime: WED, distanceKm: 20, durationMin: 25, ...extra,
  } as never);

describe("S 580: instant fixed fares", () => {
  it("airport to city 250 and city to airport 235", async () => {
    expect((await quote(AIRPORT, CITY)).totalAmount).toBe(250);
    expect((await quote(CITY, AIRPORT)).totalAmount).toBe(235);
  });

  it("Sants to city 175 and a hotel to Sants 165", async () => {
    expect((await quote(SANTS, CITY)).totalAmount).toBe(175);
    expect((await quote(HOTEL, SANTS)).totalAmount).toBe(165);
    expect((await quote(CITY, SANTS)).totalAmount).toBe(165);
  });

  it("airport to Sants is 250 and Sants to the airport is 235, the same as the city", async () => {
    expect((await quote(AIRPORT, SANTS)).totalAmount).toBe(250);
    expect((await quote(SANTS, AIRPORT)).totalAmount).toBe(235);
  });

  it("a request that names only the class gets the same fares", async () => {
    expect((await quote(AIRPORT, CITY, { fleetVehicle: undefined })).totalAmount).toBe(250);
    expect((await quote(SANTS, CITY, { fleetVehicle: undefined })).totalAmount).toBe(175);
  });

  it("does not move any other car's fare on those routes", async () => {
    expect((await quote(AIRPORT, CITY, { vehicleClass: "BUSINESS", fleetVehicle: "CAMRY" })).totalAmount).toBe(55);
    expect((await quote(CITY, AIRPORT, { vehicleClass: "BUSINESS", fleetVehicle: "CAMRY" })).totalAmount).toBe(55);
    expect((await quote(AIRPORT, CITY, { vehicleClass: "MINIVAN", fleetVehicle: "VITO" })).totalAmount).toBe(65);
  });
});

describe("S 580: the port is never booked", () => {
  it("every journey to or from the port is quoted by hand, whichever way and however it is typed", async () => {
    const places: [P, P][] = [[PORT, AIRPORT], [AIRPORT, PORT], [PORT, CITY], [CITY, PORT], [ADOSSAT, AIRPORT], [AIRPORT, ADOSSAT], [PORT, TARRAGONA]];
    for (const [a, b] of places) {
      const q = await quote(a, b);
      expect(q.totalAmount, `${a.address} -> ${b.address}`).toBe(0);
      expect(q.needsManualQuote).toBe(true);
    }
  });

  it("a terminal typed as a plain street address with port coordinates is still the port", async () => {
    const q = await quote({ lat: 41.3445, lng: 2.1655, address: "Carrer de Ocaña 1" }, AIRPORT);
    expect(q.needsManualQuote).toBe(true);
    expect(isPortPlace({ lat: 41.3445, lng: 2.1655 })).toBe(true);
    expect(isPortPlace({ address: "Moll Adossat" })).toBe(true);
    expect(isPortPlace({ lat: HOTEL.lat, lng: HOTEL.lng, address: HOTEL.address })).toBe(false);
    expect(isPortPlace({ lat: CITY.lat, lng: CITY.lng })).toBe(false);
  });

  it("other cars still go to the port at their own fares", async () => {
    const q = await quote(AIRPORT, PORT, { vehicleClass: "BUSINESS", fleetVehicle: "CAMRY" });
    expect(q.needsManualQuote).toBeFalsy();
    expect(q.totalAmount).toBeGreaterThan(0);
  });
});

describe("S 580: 4.75 euros a kilometre anywhere else", () => {
  it("charges the road distance at 4.75, rounded to the euro", async () => {
    expect((await quote(AIRPORT, TARRAGONA, { distanceKm: 100 })).totalAmount).toBe(475);
    expect((await quote(CITY, SITGES, { distanceKm: 42.4 })).totalAmount).toBe(Math.round(42.4 * 4.75));
    expect((await quote(TARRAGONA, AIRPORT, { distanceKm: 100 })).totalAmount).toBe(475);
  });

  it("never prices a short hop under the cheapest fixed S-Class fare", async () => {
    expect(sClassKmFare(5)).toBe(S_CLASS_MIN_FARE);
    expect((await quote(HOTEL, CITY, { distanceKm: 4 })).totalAmount).toBe(S_CLASS_MIN_FARE);
  });

  it("a journey with no distance cannot be priced", async () => {
    expect((await quote(AIRPORT, TARRAGONA, { distanceKm: 0 })).needsManualQuote).toBe(true);
  });
});

describe("S 580: by the hour and waiting", () => {
  it("is 160 an hour in the city and 195 outside it", () => {
    expect(hourlyRateFor("FIRST_CLASS", { lat: CITY.lat, lng: CITY.lng, address: CITY.address })).toBe(160);
    expect(hourlyRateFor("FIRST_CLASS", { lat: AIRPORT.lat, lng: AIRPORT.lng })).toBe(160);
    expect(hourlyRateFor("FIRST_CLASS", { lat: SANTS.lat, lng: SANTS.lng })).toBe(160);
    expect(hourlyRateFor("FIRST_CLASS", { lat: SITGES.lat, lng: SITGES.lng, address: SITGES.address })).toBe(195);
    expect(hourlyRateFor("FIRST_CLASS", { lat: TARRAGONA.lat, lng: TARRAGONA.lng })).toBe(195);
  });

  it("leaves every other car's hourly rate alone", () => {
    expect(hourlyRateFor("ECONOMY", { lat: SITGES.lat, lng: SITGES.lng })).toBe(45);
    expect(hourlyRateFor("LUXURY_MINIVAN", { lat: CITY.lat, lng: CITY.lng })).toBe(75);
  });

  it("is on the hourly page at 160", () => {
    expect(HOURLY_FLEET.find((h) => h.vehicle === "S_CLASS")?.rate).toBe(160);
    expect(HOURLY_FLEET).toHaveLength(VEHICLE_CATALOG.length);
  });

  it("charges waiting at 160 an hour (80 a half hour) for the S 580 and 25 a half hour for every other car", () => {
    expect(waitBlockPriceFor("FIRST_CLASS")).toBe(80);
    expect(waitBlockPriceFor("BUSINESS")).toBe(25);
    expect(waitBlockPriceFor(undefined)).toBe(25);
    const arrived = new Date("2026-11-04T10:00:00Z");
    const base = { airport: false, arrivedAt: arrived, onBoardAt: new Date(arrived.getTime() + 75 * 60_000), landedAt: null, pickupAt: arrived, now: arrived };
    // 75 minutes with 15 free = 60 paid = two half-hour blocks
    expect(waitingState({ ...base, vehicleClass: "FIRST_CLASS" })).toMatchObject({ charge: 160, blockPrice: 80 });
    expect(waitingState({ ...base, vehicleClass: "BUSINESS" })).toMatchObject({ charge: 50, blockPrice: 25 });
  });
});

describe("S 580 in the catalogue", () => {
  it("is First Class and maps to its own class", () => {
    expect(VEHICLE_CATALOG.find((c) => c.class === "S_CLASS")).toMatchObject({ label: "Mercedes-Maybach S 580", badge: "First Class", maxPassengers: 3 });
    expect(FLEET_TO_DB_CLASS.S_CLASS).toBe("FIRST_CLASS");
  });
});

import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: () => undefined }));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: () => new Proxy({}, { get: () => async () => [] }) }) }));

import { getQuote } from "@/lib/pricing-service";
import { FLEET_TO_DB_CLASS, VEHICLE_CATALOG } from "@/types";
import { hourlyAvailable } from "@/lib/pricing";
import { HOURLY_FLEET } from "@/lib/hourly-fleet";

/**
 * The Mercedes-Maybach S 580, added 22 Oct 2026 at the owner's prices:
 * airport to city €250, city to airport €235, port to airport €250, airport to port €250.
 *
 * It is a per-car price, one of the few that differs by direction, and it must never spill onto a route nobody priced for it.
 */

const AIRPORT = { lat: 41.2974, lng: 2.0833, address: "Barcelona Airport El Prat Terminal 1" };
const CITY = { lat: 41.3874, lng: 2.17, address: "Plaça de Catalunya, Barcelona" };
const PORT = { lat: 41.3524, lng: 2.1827, address: "Barcelona Cruise Terminal, Port of Barcelona" };
const TARRAGONA = { lat: 41.1189, lng: 1.2445, address: "Tarragona" };
const WHEN = new Date("2026-11-04T10:00:00+01:00"); // a Wednesday: no weekend uplift

const quote = (from: typeof AIRPORT, to: typeof AIRPORT, extra: Record<string, unknown> = {}) =>
  getQuote({
    pickupLat: from.lat, pickupLng: from.lng, pickupAddress: from.address, dropoffLat: to.lat, dropoffLng: to.lng, dropoffAddress: to.address,
    vehicleClass: "FIRST_CLASS", fleetVehicle: "S_CLASS", pickupDatetime: WHEN, distanceKm: 20, durationMin: 25, ...extra,
  } as never);

describe("Mercedes-Maybach S 580 fares", () => {
  it("airport to city is €250", async () => {
    expect((await quote(AIRPORT, CITY)).totalAmount).toBe(250);
  });

  it("city to airport is €235", async () => {
    expect((await quote(CITY, AIRPORT)).totalAmount).toBe(235);
  });

  it("port to airport and airport to port are both €250", async () => {
    expect((await quote(PORT, AIRPORT)).totalAmount).toBe(250);
    expect((await quote(AIRPORT, PORT)).totalAmount).toBe(250);
  });

  it("a request that names only the class (no car) gets the same prices", async () => {
    expect((await quote(AIRPORT, CITY, { fleetVehicle: undefined })).totalAmount).toBe(250);
    expect((await quote(CITY, AIRPORT, { fleetVehicle: undefined })).totalAmount).toBe(235);
  });

  it("is quoted by hand, never by distance or a column, anywhere it has no price", async () => {
    for (const [a, b] of [[AIRPORT, TARRAGONA], [CITY, PORT], [CITY, CITY]] as const) {
      const q = await quote(a, b);
      expect(q.totalAmount, `${a.address} to ${b.address}`).toBe(0);
      expect(q.needsManualQuote).toBe(true);
    }
  });

  it("does not move any other car's fare on the same routes", async () => {
    const camry = await quote(AIRPORT, CITY, { vehicleClass: "BUSINESS", fleetVehicle: "CAMRY" });
    const camryBack = await quote(CITY, AIRPORT, { vehicleClass: "BUSINESS", fleetVehicle: "CAMRY" });
    expect(camry.totalAmount).toBe(55);
    expect(camryBack.totalAmount).toBe(55);
    expect((await quote(AIRPORT, CITY, { vehicleClass: "MINIVAN", fleetVehicle: "VITO" })).totalAmount).toBe(65);
  });
});

describe("Mercedes-Maybach S 580 is a transfer car only", () => {
  it("is in the catalogue as First Class and maps to its own class", () => {
    const v = VEHICLE_CATALOG.find((c) => c.class === "S_CLASS");
    expect(v).toMatchObject({ label: "Mercedes-Maybach S 580", badge: "First Class", maxPassengers: 3 });
    expect(FLEET_TO_DB_CLASS.S_CLASS).toBe("FIRST_CLASS");
  });

  it("cannot be booked by the hour or the day, and is left off the hourly page", () => {
    expect(hourlyAvailable("FIRST_CLASS")).toBe(false);
    expect(hourlyAvailable("LUXURY_MINIVAN")).toBe(true);
    expect(HOURLY_FLEET.map((h) => h.vehicle)).not.toContain("S_CLASS");
    expect(HOURLY_FLEET).toHaveLength(VEHICLE_CATALOG.length - 1);
  });
});

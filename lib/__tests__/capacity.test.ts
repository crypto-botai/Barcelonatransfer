import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { seatsFor, smallestFor, capacityError } from "@/lib/capacity";

/**
 * The party has to fit in the car.
 *
 * The booking form filters its vehicle list by passenger count, so the normal
 * path was fine and nothing behind it checked. Two ways round that filter:
 *
 *   The customer picks a car for two and then raises the party to eight. The
 *   list re-filters; the selection does not. On the homepage widget it is
 *   worse — a select whose value is no longer among its options renders blank
 *   while still submitting the car that no longer fits.
 *
 *   A request sent directly. Sixteen passengers in a Toyota Corolla quoted
 *   EUR 80, against EUR 250 for the Sprinter actually needed.
 *
 * Either way a chauffeur arrives at an airport with a car the party cannot
 * get into, having been paid a third of the fare.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("how many a vehicle seats", () => {
  it("reads the exact car when one is named", () => {
    expect(seatsFor("ECONOMY", "COROLLA")).toBe(3);
    expect(seatsFor("LUXURY", "EQE_300")).toBe(4);
    expect(seatsFor("MINIBUS", "SPRINTER")).toBe(16);
    expect(seatsFor("MINIVAN", "VITO")).toBe(8);
  });

  /** A class holds more than one car, so it is measured by its roomiest. */
  it("falls back to the class when no car is named", () => {
    expect(seatsFor("MINIBUS")).toBe(16);
    expect(seatsFor("ECONOMY")).toBe(3);
  });

  /**
   * Pricing already falls back for a class it does not recognise. Refusing
   * the booking here would be stricter than anything else in the system.
   */
  it("does not refuse a class it has never heard of", () => {
    expect(seatsFor("SOMETHING_NEW")).toBe(Infinity);
    expect(capacityError(40, "SOMETHING_NEW")).toBeNull();
  });
});

describe("the smallest car that fits", () => {
  it("picks the smallest, not the first that happens to work", () => {
    expect(smallestFor(2)?.fleetVehicle).toBe("COROLLA");
    expect(smallestFor(4)?.fleetVehicle).toBe("TESLA_M3");
    expect(smallestFor(7)?.fleetVehicle).toBe("V_CLASS");
    expect(smallestFor(8)?.fleetVehicle).toBe("VITO");
    expect(smallestFor(16)?.fleetVehicle).toBe("SPRINTER");
  });

  it("has nothing for a party bigger than the largest vehicle", () => {
    expect(smallestFor(30)).toBeNull();
  });
});

describe("the mismatch, in words", () => {
  it("says nothing when the party fits", () => {
    expect(capacityError(3, "ECONOMY", "COROLLA")).toBeNull();
    expect(capacityError(16, "MINIBUS", "SPRINTER")).toBeNull();
    expect(capacityError(1, "LUXURY", "EQE_300")).toBeNull();
  });

  /** The case that found this. */
  it("refuses sixteen in a Corolla, and names what to pick", () => {
    const e = capacityError(16, "ECONOMY", "COROLLA");
    expect(e).toContain("Toyota Corolla seats 3");
    expect(e).toContain("Mercedes Sprinter");
  });

  it("refuses the EQE chosen for two and carried to eight", () => {
    const e = capacityError(8, "LUXURY", "EQE_300");
    expect(e).toContain("seats 4");
    expect(e).toContain("Mercedes Vito");
  });

  it("says to ring when no single car is big enough", () => {
    const e = capacityError(30, "MINIBUS", "SPRINTER");
    expect(e).toContain("more than one car");
  });

  it("ignores a nonsense passenger count rather than erroring on it", () => {
    expect(capacityError(0, "ECONOMY", "COROLLA")).toBeNull();
    expect(capacityError(NaN, "ECONOMY", "COROLLA")).toBeNull();
  });
});

describe("both endpoints enforce it", () => {
  it("the quote refuses before it prices", () => {
    const q = rd("app/api/quote/route.ts");
    expect(q).toContain('import { capacityError } from "@/lib/capacity"');
    expect(q).toContain("const tooMany = capacityError(body.passengers ?? 1, vehicleClass, body.fleetVehicle)");
    expect(q).toContain("{ status: 422 }");
  });

  it("the booking refuses before it charges", () => {
    const b = rd("app/api/bookings/route.ts");
    expect(b).toContain('import { capacityError } from "@/lib/capacity"');
    expect(b).toContain("const tooMany = capacityError(body.passengers, body.vehicleClass, body.fleetVehicle)");
  });

  /** The gap left when the quote endpoint was bounded and this one was not. */
  it("the booking bounds its coordinates too", () => {
    const b = rd("app/api/bookings/route.ts");
    expect(b).toContain("pickupLat:       z.number().min(-90).max(90)");
    expect(b).toContain("pickupLng:       z.number().min(-180).max(180)");
    expect(b).toContain("dropoffLat:      z.number().min(-90).max(90).default(0)");
  });
});

describe("both forms drop a car that stops fitting", () => {
  it("the booking page clears the selection", () => {
    const f = rd("app/book/BookFormClient.tsx");
    expect(f).toContain('import { seatsFor } from "@/lib/capacity"');
    expect(f).toContain("seatsFor(d.vehicleClass, d.fleetVehicle) >= n");
    expect(f).toContain("fleetVehicle: undefined, vehicleClass: undefined");
  });

  it("the homepage widget moves up to one that fits", () => {
    const w = rd("components/booking/BookingForm.tsx");
    expect(w).toContain('import { seatsFor, smallestFor } from "@/lib/capacity"');
    expect(w).toContain("if (seatsFor(null, vehicle) < n)");
    expect(w).toContain("setVehicle(bigger.fleetVehicle)");
  });
});

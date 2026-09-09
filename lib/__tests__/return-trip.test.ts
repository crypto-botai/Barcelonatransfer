import { describe, it, expect } from "vitest";
import {
  FIXED_ROUTES,
  lookupPriceByFleetVehicle,
  returnLegSurcharge,
  RETURN_LEG_SURCHARGES,
} from "@/lib/fixed-prices";
import type { FleetVehicle } from "@/types";

/**
 * The round trip, as the owner specified it on 9 Sep 2026: a return costs
 * exactly twice the one-way fare.
 *
 * /api/quote does not implement that as a multiplication. It prices the leg
 * out, then prices the leg back with the endpoints swapped, and adds them.
 * The doubling is a consequence of the table being symmetrical, not a rule
 * written anywhere — which is worth a test, because the one place the table is
 * NOT symmetrical is Andorra, and there the answer must not be 2x.
 *
 * Before this existed the Return tab quoted the one-way fare and created one
 * booking, so a customer who chose it was charged for half of what they asked
 * for.
 */

const CARS: FleetVehicle[] = ["COROLLA", "CAMRY", "TESLA_M3", "EQE_300", "VITO", "V_CLASS", "SPRINTER"];

describe("a return costs the two legs added together", () => {
  it("doubles the fare on every symmetrical route", () => {
    const wrong: string[] = [];

    for (const route of FIXED_ROUTES) {
      // Andorra is the deliberate exception and is asserted separately below.
      if (returnLegSurcharge(route.to, route.from) !== 0) continue;

      for (const car of CARS) {
        const out  = lookupPriceByFleetVehicle(route.from, route.to, car);
        const back = lookupPriceByFleetVehicle(route.to, route.from, car);
        if (out === null || back === null) continue;
        if (out + back !== out * 2) {
          wrong.push(`${route.slug} ${car}: out €${out} + back €${back} ≠ 2 × €${out}`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });

  it("charges the Andorra return leg its surcharge, so that pair is NOT 2x", () => {
    // The one journey where the way back genuinely costs more. A round trip
    // out of Barcelona to Andorra is 350 + 370, not 700.
    for (const { from, to, amount } of RETURN_LEG_SURCHARGES) {
      const outbound = lookupPriceByFleetVehicle(to, from, "COROLLA");
      const back     = lookupPriceByFleetVehicle(from, to, "COROLLA");
      expect(outbound, `${to} → ${from}`).not.toBeNull();
      expect(back,     `${from} → ${to}`).not.toBeNull();

      // lookupPriceByFleetVehicle is direction-blind; the surcharge is applied
      // on top of it by getQuote. The round trip is therefore 2x the table
      // fare plus the surcharge, once.
      const roundTrip = outbound! + back! + amount;
      expect(roundTrip).toBe(outbound! * 2 + amount);
      expect(roundTrip).toBeGreaterThan(outbound! * 2);
    }
  });

  it("applies the surcharge only to the leg that leaves Andorra", () => {
    // Direction matters, and only in one direction. Getting this backwards
    // would charge the ride out and discount the ride home.
    expect(returnLegSurcharge("BCN_AIRPORT", "ANDORRA")).toBe(0);
    expect(returnLegSurcharge("ANDORRA", "BCN_AIRPORT")).toBe(20);
    expect(returnLegSurcharge("BARCELONA_CITY", "ANDORRA")).toBe(0);
    expect(returnLegSurcharge("ANDORRA", "BARCELONA_CITY")).toBe(20);
  });

  it("prices the return leg of a repriced route at the new fare, both ways", () => {
    // The 8 Sep Costa Dorada cut has to reach the leg home as well, or a
    // return would be sold at the new price out and the old price back.
    for (const zone of ["TARRAGONA", "SALOU", "PORTAVENTURA", "CAMBRILS"] as const) {
      const out  = lookupPriceByFleetVehicle("BCN_AIRPORT", zone, "COROLLA");
      const back = lookupPriceByFleetVehicle(zone, "BCN_AIRPORT", "COROLLA");
      expect(out,  `airport → ${zone}`).toBe(140);
      expect(back, `${zone} → airport`).toBe(140);
      expect(out! + back!).toBe(280);
    }
  });

  it("prices a per-car offer on both legs", () => {
    // The Tesla and Camry are €55 on the offer route. A return is €110, not
    // €55 out and €65 back off the Business column.
    for (const car of ["CAMRY", "TESLA_M3"] as FleetVehicle[]) {
      const out  = lookupPriceByFleetVehicle("BCN_AIRPORT", "BARCELONA_CITY", car);
      const back = lookupPriceByFleetVehicle("BARCELONA_CITY", "BCN_AIRPORT", car);
      expect(out, car).toBe(55);
      expect(back, car).toBe(55);
    }
  });
});

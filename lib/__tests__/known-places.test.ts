import { describe, it, expect } from "vitest";
import { knownPlace } from "@/lib/geo";

/**
 * The places this business cannot afford to get wrong.
 *
 * "Terminal 1 Barcelona airport" came back as Terminal F1 Balearia, a ferry
 * berth in Sants-Montjuïc eleven kilometres from the runway, because
 * "Terminal F1" is a close string match and "Barcelona" pulls toward the
 * city. Plain "terminal 1" resolved correctly — so the more precise the
 * customer was, the worse the answer got.
 *
 * On a fixed-table route the fare survives, since the table matches zones
 * rather than distance. Nothing else does: the distance is wrong, any
 * off-table fare computed from it is wrong, and the coordinates a chauffeur
 * is sent to are a different part of the city.
 */

const near = (a: { lat: number; lng: number }, lat: number, lng: number, km = 2) => {
  const dLat = (a.lat - lat) * 111;
  const dLng = (a.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng) <= km;
};

const BCN_T1 = [41.2971, 2.0785] as const;
const BCN_T2 = [41.2894, 2.0718] as const;

describe("the airport, however it is typed", () => {
  it("resolves the phrasing that used to fail", () => {
    const p = knownPlace("Terminal 1 Barcelona airport");
    expect(p).not.toBeNull();
    expect(near(p!, ...BCN_T1), `got ${p!.lat},${p!.lng}`).toBe(true);
    expect(p!.kind).toBe("airport");
  });

  for (const q of [
    "terminal 1", "T1", "t1 el prat", "Terminal 1 BCN",
    "barcelona airport terminal 1", "aeropuerto barcelona terminal 1",
  ]) {
    it(`"${q}" is Terminal 1`, () => {
      const p = knownPlace(q);
      expect(p, q).not.toBeNull();
      expect(near(p!, ...BCN_T1), `${q} -> ${p!.lat},${p!.lng}`).toBe(true);
    });
  }

  for (const q of ["terminal 2", "T2", "Terminal 2 Barcelona airport"]) {
    it(`"${q}" is Terminal 2`, () => {
      const p = knownPlace(q);
      expect(p, q).not.toBeNull();
      expect(near(p!, ...BCN_T2), `${q} -> ${p!.lat},${p!.lng}`).toBe(true);
    });
  }

  for (const q of ["Barcelona airport", "BCN airport", "el prat airport", "aeropuerto de barcelona"]) {
    it(`"${q}" is El Prat`, () => {
      const p = knownPlace(q);
      expect(p, q).not.toBeNull();
      expect(near(p!, ...BCN_T1, 3), `${q} -> ${p!.lat},${p!.lng}`).toBe(true);
    });
  }
});

describe("the other airports are not swallowed by El Prat", () => {
  it("Girona stays Girona", () => {
    const p = knownPlace("Girona airport");
    expect(p).not.toBeNull();
    expect(near(p!, 41.9011, 2.7604), `got ${p!.lat},${p!.lng}`).toBe(true);
  });

  it("Reus stays Reus", () => {
    const p = knownPlace("Reus airport");
    expect(p).not.toBeNull();
    expect(near(p!, 41.1474, 1.1672), `got ${p!.lat},${p!.lng}`).toBe(true);
  });
});

describe("the other hubs", () => {
  it("the cruise port is the cruise port, not a ferry berth", () => {
    const p = knownPlace("barcelona cruise port");
    expect(p).not.toBeNull();
    expect(p!.kind).toBe("port");
    expect(near(p!, 41.3611, 2.1761)).toBe(true);
  });

  it("Sants is the station", () => {
    const p = knownPlace("barcelona sants station");
    expect(p).not.toBeNull();
    expect(p!.kind).toBe("train");
    expect(near(p!, 41.3794, 2.1401)).toBe(true);
  });
});

describe("what it deliberately does not claim", () => {
  /**
   * El Prat de Llobregat is a town of sixty thousand people. Somebody being
   * collected from a flat there is not going to the airport.
   */
  it("leaves a residential address in El Prat alone", () => {
    expect(knownPlace("Carrer del Riu 12, el Prat de Llobregat")).toBeNull();
    expect(knownPlace("el Prat de Llobregat")).toBeNull();
  });

  /** Catalan door notation reads like a terminal number. */
  it("leaves a street address with T1 in it alone", () => {
    expect(knownPlace("Carrer de Mallorca 401, 3r T1")).toBeNull();
    expect(knownPlace("Avinguda Diagonal 200, T2")).toBeNull();
  });

  it("says nothing about a place it does not know", () => {
    expect(knownPlace("Hotel Arts Barcelona")).toBeNull();
    expect(knownPlace("Sitges")).toBeNull();
    expect(knownPlace("Camp Nou")).toBeNull();
  });
});

describe("what it returns", () => {
  it("is one answer, not a list to choose wrongly from", () => {
    const p = knownPlace("Terminal 1 Barcelona airport")!;
    expect(p.name).toBe("Terminal 1");
    expect(p.context).toContain("El Prat");
    expect(p.label).toContain("Terminal 1");
    expect(p.id).toBeTruthy();
  });
});

import { describe, it, expect } from "vitest";
import {
  resolveZone,
  detectZoneFromCoords,
  isSkiStation,
  lookupFixedPriceByZone,
  distanceFare,
} from "../pricing";

/**
 * Ski stations are charged as destinations outside Andorra, by the owner's
 * decision. The €300 Andorra fare covers Andorra la Vella and the valley towns;
 * the stations are further, higher, and an hour more on winter roads.
 */

describe("Andorran ski stations are not the Andorra fare", () => {
  const STATIONS: [string, string, number, number][] = [
    ["Grandvalira / Soldeu", "Grandvalira, Soldeu, Andorra",       42.5766, 1.6672],
    ["Pas de la Casa",       "Pas de la Casa, Encamp, Andorra",    42.5427, 1.7336],
    ["Vallnord / Arinsal",   "Vallnord, Arinsal, Andorra",         42.5720, 1.4850],
    ["Ordino-Arcalis",       "Ordino-Arcalis ski resort, Andorra", 42.6320, 1.5030],
    ["El Tarter",            "El Tarter, Canillo, Andorra",        42.5760, 1.6470],
  ];

  it.each(STATIONS)("%s does not resolve to the Andorra zone by name", (_l, address) => {
    // Their addresses nearly all contain the word "Andorra", and text is
    // trusted ahead of coordinates — so the name guard has to win.
    expect(address.toLowerCase()).toContain("andorra");
    expect(resolveZone(address)).not.toBe("andorra");
    expect(resolveZone(address)).toBeNull();
  });

  it.each(STATIONS)("%s does not resolve to the Andorra zone by coordinates", (_l, _a, lat, lng) => {
    expect(detectZoneFromCoords(lat, lng)).not.toBe("andorra");
  });

  it("catches Arinsal, which sits inside the Andorra radius", () => {
    // The one that was already mispriced: 8 km from Andorra la Vella, so the
    // 12 km zone radius swallowed it and quoted EUR 300 on coordinates alone.
    expect(isSkiStation(undefined, 42.5720, 1.4850)).toBe(true);
    expect(detectZoneFromCoords(42.5720, 1.4850)).toBeNull();
  });

  it("prices a ski station well above the Andorra fare", () => {
    const andorra = lookupFixedPriceByZone("airport", "andorra", "ECONOMY")!;
    // ~220 km to Grandvalira; the exact figure comes from the router at booking.
    const station = distanceFare(220, "ECONOMY");
    expect(station).toBeGreaterThan(andorra);
  });

  it("charges more for a bigger car at a ski station", () => {
    // Ski trips are the group case — the vehicle ladder has to apply.
    expect(distanceFare(220, "VCLASS")).toBeGreaterThan(distanceFare(220, "ECONOMY"));
  });
});

describe("Andorra proper keeps its fare", () => {
  const TOWNS: [string, string, number, number][] = [
    ["Andorra la Vella",   "Andorra la Vella, Andorra",       42.5063, 1.5218],
    ["Escaldes-Engordany", "Escaldes-Engordany, Andorra",     42.5100, 1.5340],
  ];

  it.each(TOWNS)("%s still resolves to the Andorra zone", (_l, address, lat, lng) => {
    expect(resolveZone(address)).toBe("andorra");
    expect(detectZoneFromCoords(lat, lng)).toBe("andorra");
    expect(lookupFixedPriceByZone("airport", "andorra", "ECONOMY")).toBe(300);
  });

  it("leaves ordinary valley towns alone", () => {
    // Encamp and Canillo have gondolas but are towns, not stations. Excluding
    // them would reprice residents' journeys, which nobody asked for.
    expect(isSkiStation("Encamp, Andorra")).toBe(false);
    expect(isSkiStation("Canillo, Andorra")).toBe(false);
  });

  it("does not mistake unrelated addresses for ski stations", () => {
    expect(isSkiStation("Carrer de Pal, Barcelona")).toBe(false);
    expect(isSkiStation("Palamos, Girona")).toBe(false);
  });
});

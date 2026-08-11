import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ladderFor, SLUG_TO_ZONE } from "../destination-pricing";
import { lookupFixedPriceByZone } from "../pricing";

/**
 * Price integrity across every customer-visible surface.
 *
 * A destination page used to carry its own hand-typed ladder. The cruise page
 * advertised a Barcelona-hotel-to-port fare of €35 while the booking charged
 * €60, and nothing connected the two, so nothing caught it. The Phase 1 audit
 * missed it as well, because that pass matched rows named after a vehicle and
 * the broken rows were named after a route.
 *
 * The structural test below is the one that matters: it fails if anyone types a
 * price into a page again, whatever the row is called.
 */

const TRANSFERS = "app/transfers";

function destinationPages(): string[] {
  return fs.readdirSync(TRANSFERS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("["))
    .map((e) => path.join(TRANSFERS, e.name, "page.tsx"))
    .filter((p) => fs.existsSync(p));
}

describe("no destination page hardcodes a price", () => {
  // A row is any object literal carrying both a label and a price. The label
  // key varies by page — vehicle, route, or v — which is exactly how the
  // cruise rows escaped an audit that only looked for one of them.
  const PRICED_ROW = /\{[^{}]*?\b(?:vehicle|route|v)\s*:\s*"[^"]+"[^{}]*?\bprice\s*:\s*"([^"]*)"/g;

  it.each(destinationPages())("%s states no literal fare in a price row", (page) => {
    const src = fs.readFileSync(page, "utf8");
    const literals = [...src.matchAll(PRICED_ROW)]
      .map((m) => m[1])
      // Text such as "Quoted by distance" or "On request" is a deliberate
      // statement that no fixed price exists, not a stale number.
      .filter((v) => /\d/.test(v));

    expect(literals, `${page} hardcodes ${literals.join(", ")} — read it from the price table instead`).toEqual([]);
  });

  it("also keeps literal prices out of JSON-LD offers", () => {
    for (const page of destinationPages()) {
      const src = fs.readFileSync(page, "utf8");
      const offers = [...src.matchAll(/price:\s*"(\d+)"\s*,\s*priceCurrency/g)].map((m) => m[1]);
      expect(offers, `${page} hardcodes a schema price`).toEqual([]);
    }
  });
});

describe("page ladders equal the booking price", () => {
  const CASES: [string, string, "airport" | "barcelona_city"][] = [
    ["sitges",        "sitges",         "airport"],
    ["cadaques",      "cadaques",       "airport"],
    ["lloret-de-mar", "lloret",         "airport"],
    ["tarragona",     "tarragona",      "airport"],
    ["girona",        "girona_airport", "barcelona_city"],
    ["lourdes",       "lourdes",        "airport"],
  ];

  it.each(CASES)("%s reads every column from the table", (_slug, zone, origin) => {
    const l = ladderFor(zone, origin);
    expect(l).not.toBeNull();
    expect(l!.economy).toBe(lookupFixedPriceByZone(origin, zone, "ECONOMY"));
    expect(l!.business).toBe(lookupFixedPriceByZone(origin, zone, "BUSINESS"));
    expect(l!.minivan).toBe(lookupFixedPriceByZone(origin, zone, "MINIVAN"));
    expect(l!.vclass).toBe(lookupFixedPriceByZone(origin, zone, "LUXURY_MINIVAN"));
    expect(l!.minibus).toBe(lookupFixedPriceByZone(origin, zone, "MINIBUS"));
  });

  it("distinguishes the two routes where origin actually changes the fare", () => {
    // Everywhere else the airport and the city cost the same, so a page quoting
    // the wrong origin would look correct. These two would not.
    expect(ladderFor("girona_airport", "airport")!.economy).toBe(165);
    expect(ladderFor("girona_airport", "barcelona_city")!.economy).toBe(140);
    expect(ladderFor("cruise", "airport")!.economy).toBe(50);
    expect(ladderFor("cruise", "barcelona_city")!.economy).toBe(60);
  });
});

describe("cruise port fares — the €35/€60 regression", () => {
  it("charges the table fare from a city hotel, not the €35 once advertised", () => {
    // The exact defect: the page said €35, the checkout said €60.
    const fare = lookupFixedPriceByZone("barcelona_city", "cruise", "ECONOMY");
    expect(fare).toBe(60);
    expect(fare).not.toBe(35);
  });

  it("keeps the airport and the city fares apart", () => {
    expect(lookupFixedPriceByZone("airport", "cruise", "ECONOMY")).toBe(50);
    expect(lookupFixedPriceByZone("barcelona_city", "cruise", "ECONOMY")).toBe(60);
  });

  it("has no table row for the onward runs the page once priced", () => {
    // Sitges and Tarragona from the port were advertised at €65 and €95 with
    // nothing behind them. They price by distance, and the page must say so
    // rather than name a figure.
    expect(lookupFixedPriceByZone("cruise", "sitges", "ECONOMY")).toBeNull();
    expect(lookupFixedPriceByZone("cruise", "tarragona", "ECONOMY")).toBeNull();
  });

  it("does not restate the cruise fares in the page source", () => {
    const src = fs.readFileSync("app/transfers/cruise-port/page.tsx", "utf8");
    expect(src).not.toMatch(/price:\s*"€35"/);
    expect(src).not.toMatch(/price:\s*"€65"/);
    expect(src).not.toMatch(/price:\s*"€95"/);
  });
});

describe("every priced destination slug maps to a real table route", () => {
  it.each(Object.entries(SLUG_TO_ZONE))("%s -> %s exists in the table", (_slug, zone) => {
    const fromAirport = ladderFor(zone, "airport");
    const fromCity    = ladderFor(zone, "barcelona_city");
    expect(fromAirport ?? fromCity, `${zone} has no route in the price table`).not.toBeNull();
  });
});

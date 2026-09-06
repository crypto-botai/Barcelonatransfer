import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  FIXED_ROUTES,
  RETURN_LEG_SURCHARGES,
  returnLegSurcharge,
  lookupPriceByClass,
  lookupPriceByFleetVehicle,
  type VehicleCode,
  type ZoneCode,
} from "@/lib/fixed-prices";
import { ROUTES, returnSurchargeForRoute } from "@/lib/pricing";
import { routeLanding } from "@/lib/route-landings";
import { STATIC_TRANSFER_PAGES } from "@/data/static-transfer-pages";

/**
 * Andorra, repriced by the owner on 5 Sep 2026.
 *
 * Two things are being held here. The first is the fare itself, across all five
 * columns and both Andorra routes — the airport one and the city one — because
 * the previous reprice touched a single column and the risk with a table this
 * wide is silently moving a neighbour.
 *
 * The second is the return surcharge, which is the first direction-aware price
 * in the system. Every other lookup matches a route both ways round, so the
 * test that matters is not that the surcharge exists but that it stays on one
 * side: Andorra outbound must cost exactly what the table says, with nothing
 * added.
 */

const ANDORRA_FARES: Record<VehicleCode, number> = {
  ECONOMY:  350,
  BUSINESS: 450,
  MINIVAN:  465,
  VCLASS:   550,
  MINIBUS:  1100,
};

const ANDORRA_ROUTES = ["bcn-airport-andorra", "barcelona-city-andorra"];

describe("Andorra fares", () => {
  for (const slug of ANDORRA_ROUTES) {
    it(`${slug} charges the owner's figures in every column`, () => {
      const route = FIXED_ROUTES.find((r) => r.slug === slug);
      expect(route, `${slug} missing from the table`).toBeDefined();
      expect(route!.prices).toEqual(ANDORRA_FARES);
    });
  }

  it("prices the 16-seater at double the V-Class, the rule set for it", () => {
    expect(ANDORRA_FARES.MINIBUS).toBe(ANDORRA_FARES.VCLASS * 2);
  });

  it("leaves every other route alone", () => {
    // A guard against a reprice reaching further than it was meant to. Any
    // route that is not one of the two Andorra ones must not be carrying the
    // Andorra numbers by accident.
    const others = FIXED_ROUTES.filter((r) => !ANDORRA_ROUTES.includes(r.slug));
    expect(others).toHaveLength(FIXED_ROUTES.length - 2);
    for (const r of others) {
      expect(r.prices, `${r.slug} looks like an Andorra route`).not.toEqual(ANDORRA_FARES);
    }
  });
});

describe("return leg surcharge", () => {
  it("adds €20 coming back out of Andorra", () => {
    expect(returnLegSurcharge("ANDORRA", "BARCELONA_CITY")).toBe(20);
    expect(returnLegSurcharge("ANDORRA", "BCN_AIRPORT")).toBe(20);
  });

  it("adds nothing on the way there", () => {
    expect(returnLegSurcharge("BARCELONA_CITY", "ANDORRA")).toBe(0);
    expect(returnLegSurcharge("BCN_AIRPORT", "ANDORRA")).toBe(0);
  });

  it("leaves every other journey untouched", () => {
    // The surcharge is opt-in by ordered pair, so the thing worth proving is
    // that no pair outside the list picks it up.
    const listed = new Set(RETURN_LEG_SURCHARGES.map((s) => `${s.from}>${s.to}`));
    const zones = new Set<ZoneCode>();
    for (const r of FIXED_ROUTES) {
      zones.add(r.from);
      zones.add(r.to);
    }
    for (const from of zones) {
      for (const to of zones) {
        if (listed.has(`${from}>${to}`)) continue;
        expect(returnLegSurcharge(from, to), `${from} -> ${to}`).toBe(0);
      }
    }
  });

  it("does not disturb the table price it is added to", () => {
    // The surcharge lives outside the lookup on purpose: the table stays
    // direction-blind, and the route pages that read it keep quoting the
    // outbound fare.
    expect(lookupPriceByClass("ANDORRA", "BARCELONA_CITY", "ECONOMY")).toBe(350);
    expect(lookupPriceByClass("BARCELONA_CITY", "ANDORRA", "ECONOMY")).toBe(350);
  });
});

describe("the return leg has somewhere to be read", () => {
  // The fare existed before the surfaces did: the quote engine charged the
  // extra €20 while /pricing showed a single figure with a "⇄", the Andorra
  // page listed six ways in and no way out, and no page anywhere was about the
  // journey people search for as "Andorra to Barcelona". These check the
  // figure reaches a reader, not merely a customer at the checkout.

  const landing = routeLanding("andorra-to-barcelona");

  it("has a landing page for the direction", () => {
    expect(landing, "andorra-to-barcelona missing from ROUTE_LANDINGS").toBeDefined();
  });

  it("prices every vehicle on it at the outbound fare plus the surcharge", () => {
    const extra = returnLegSurcharge("ANDORRA", "BCN_AIRPORT");
    expect(extra).toBeGreaterThan(0);
    for (const v of landing!.priceTables[0].vehicles) {
      const outbound = lookupPriceByFleetVehicle("BCN_AIRPORT", "ANDORRA", v.class);
      expect(outbound, `${v.class} has no outbound fare`).not.toBeNull();
      expect(v.price, v.class).toBe(outbound! + extra);
    }
  });

  it("quotes the surcharged fare in its own copy, not the outbound one", () => {
    // The failure worth catching is a page that advertises €350 and a checkout
    // that takes €370, so the cheapest figure it leads with has to be the one
    // getQuote produces.
    const cheapest = Math.min(...landing!.priceTables[0].vehicles.map((v) => v.price));
    expect(landing!.cheapest).toBe(cheapest);
    expect(landing!.title).toContain(String(cheapest));
    expect(landing!.description).toContain(String(cheapest));
  });

  it("is published in the sitemap and the static page registry", () => {
    const sitemap = readFileSync("app/sitemap.ts", "utf-8");
    expect(sitemap).toContain("/transfers/andorra-to-barcelona");
    expect(STATIC_TRANSFER_PAGES.some((p) => p.slug === "andorra-to-barcelona")).toBe(true);
  });

  it("has a page file wired to the landing data", () => {
    const page = readFileSync("app/transfers/andorra-to-barcelona/page.tsx", "utf-8");
    expect(page).toContain('routeLanding("andorra-to-barcelona")');
  });

  it("lists both ways out on the Andorra page", () => {
    const page = readFileSync("app/transfers/andorra/page.tsx", "utf-8");
    expect(page).toContain("Andorra la Vella → BCN Airport");
    expect(page).toContain("Andorra la Vella → Barcelona city");
    // and links to the page that explains why they differ
    expect(page).toContain("/transfers/andorra-to-barcelona");
  });

  it("tells the AI crawlers, whose files claim every route is symmetric", () => {
    for (const name of ["llms.txt", "llms-full.txt"]) {
      const text = readFileSync(join("public", name), "utf-8");
      expect(text, name).toMatch(/Andorra la Vella to Barcelona City: add EUR 20/);
      expect(text, name).toMatch(/Andorra la Vella to El Prat Airport: add EUR 20/);
      // the unqualified claim must be gone
      expect(text, name).not.toMatch(/All routes (are )?bidirectional/);
    }
  });
});

describe("returnSurchargeForRoute, which /pricing renders from", () => {
  it("finds the surcharge whichever way round the row is stored", () => {
    // A route row has no direction, so the pair may be stored either way. Both
    // have to report the same surcharge and name the same end as the dear one.
    for (const [a, b] of [["airport", "andorra"], ["andorra", "airport"]] as const) {
      const hit = returnSurchargeForRoute(a, b);
      expect(hit, `${a}/${b}`).not.toBeNull();
      expect(hit!.amount).toBe(20);
      expect(hit!.leavingLabel).toBe("Andorra");
    }
  });

  it("returns null for every other route in the table", () => {
    const skip = new Set(["airport|andorra", "andorra|airport", "barcelona_city|andorra", "andorra|barcelona_city"]);
    for (const r of ROUTES) {
      if (skip.has(`${r.from}|${r.to}`) || skip.has(`${r.to}|${r.from}`)) continue;
      expect(returnSurchargeForRoute(r.from, r.to), `${r.from} -> ${r.to}`).toBeNull();
    }
  });

  it("returns null for an unknown zone key rather than throwing", () => {
    expect(returnSurchargeForRoute("nowhere", "andorra")).toBeNull();
    expect(returnSurchargeForRoute("", "")).toBeNull();
  });
});

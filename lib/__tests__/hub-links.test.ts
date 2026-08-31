import { describe, expect, it } from "vitest";
import {
  airportChildren, costaBravaChildren, costaDoradaChildren,
  cruiseLineChildren, hotelChildren,
} from "@/lib/hub-children";
import { routePageHref } from "@/lib/destination-pricing";
import { ROUTES } from "@/lib/pricing";

/**
 * A link's text and its target have to be about the same place.
 *
 * routePageHref() used to fall back from the destination end of a route to the
 * origin end. That was harmless while barcelona_city had no page: the fallback
 * simply found nothing and the row stayed unlinked. Publishing
 * /transfers/barcelona-city-centre turned it into a trap — every route whose
 * destination had no page started resolving to the origin instead.
 *
 * It shipped. /transfers/costa-brava carried a link reading "Calella" pointing
 * at /transfers/barcelona-city-centre, /transfers/costa-dorada carried
 * "Cubelles" pointing at the same page, and /pricing did the same on both rows.
 * A reader clicking their own town landed somewhere else, and Google was told
 * that the city-centre page was about two towns it does not mention.
 *
 * These check the property that was actually violated — that a derived link
 * points at the place it names — rather than re-asserting the current lists.
 */

const HUBS = {
  airport: airportChildren(),
  "costa-brava": costaBravaChildren(),
  "costa-dorada": costaDoradaChildren(),
  cruise: cruiseLineChildren(),
  hotel: hotelChildren(),
};

describe("derived hub links point at the place they name", () => {
  it("every hub resolves at least a few children", () => {
    for (const [hub, children] of Object.entries(HUBS)) {
      expect(children.length, hub).toBeGreaterThan(3);
    }
  });

  it("no two children of a hub share a target", () => {
    for (const [hub, children] of Object.entries(HUBS)) {
      const hrefs = children.map((c) => c.href);
      expect(new Set(hrefs).size, `${hub} has duplicate targets`).toBe(hrefs.length);
    }
  });

  it("no child is labelled one place and pointed at another", () => {
    // The specific regression: a link named after a town with no page, aimed at
    // whichever page the route happened to start from.
    const GENERIC = ["/transfers/barcelona-city-centre", "/airport-transfers"];
    for (const [hub, children] of Object.entries(HUBS)) {
      for (const c of children) {
        if (!GENERIC.includes(c.href)) continue;
        // Landing on a generic origin page is only correct if that is what the
        // link is actually named after.
        expect(
          /barcelona|city centre|airport/i.test(c.label),
          `${hub}: "${c.label}" -> ${c.href}`,
        ).toBe(true);
      }
    }
  });

  it("every child href is a real transfers path", () => {
    for (const [hub, children] of Object.entries(HUBS)) {
      for (const c of children) {
        expect(c.href, hub).toMatch(/^\/transfers\/[a-z0-9-]+$/);
        expect(c.label.trim().length, `${hub} empty label`).toBeGreaterThan(0);
      }
    }
  });
});

describe("routePageHref resolves the destination end only", () => {
  it("returns null when the destination has no page, rather than the origin's", () => {
    // Calella and Cubelles are priced, have no page, and are reached from both
    // generic origins. Either one resolving to a page is the bug returning.
    expect(routePageHref("airport", "calella")).toBeNull();
    expect(routePageHref("barcelona_city", "calella")).toBeNull();
    expect(routePageHref("barcelona_city", "cubelles")).toBeNull();
    expect(routePageHref("airport", "malgrat")).toBeNull();
  });

  it("resolves destinations that do have a page", () => {
    expect(routePageHref("airport", "sitges")).toBe("/transfers/sitges");
    expect(routePageHref("airport", "la_roca")).toBe("/transfers/la-roca-village");
    expect(routePageHref("airport", "sants")).toBe("/transfers/sants-station");
    expect(routePageHref("airport", "begur")).toBe("/transfers/begur");
    expect(routePageHref("airport", "vilanova")).toBe("/transfers/vilanova");
    expect(routePageHref("airport", "barcelona_city")).toBe("/transfers/barcelona-city-centre");
  });

  it("never points a route at a page named after the other end", () => {
    for (const r of ROUTES) {
      const href = routePageHref(r.from, r.to);
      if (!href) continue;
      // The resolved page must belong to the destination zone, never the origin.
      expect(routePageHref("__nothing__", r.to), `${r.label}`).toBe(href);
    }
  });
});

describe("the four pages added for priced-but-pageless zones are wired in", () => {
  it("each appears under the hub that covers it", () => {
    const labels = (xs: Array<{ label: string }>) => xs.map((x) => x.label).join(" | ");
    expect(labels(HUBS.airport)).toContain("La Roca Village");
    expect(labels(HUBS.airport)).toContain("Sants Station");
    expect(labels(HUBS["costa-brava"])).toContain("Begur");
    expect(labels(HUBS["costa-dorada"])).toContain("Vilanova");
  });
});

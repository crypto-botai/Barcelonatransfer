import fs from "node:fs";
import { describe, it, expect } from "vitest";
import {
  FIXED_ROUTES,
  lookupPriceByClass,
  lookupPriceByFleetVehicle,
  offerForColumn,
  offerForFleetVehicle,
  type ZoneCode,
} from "@/lib/fixed-prices";
import { getFleetFromPrice, lookupFixedPriceByZone } from "@/lib/pricing";
import { FLEET_TO_DB_CLASS, VEHICLE_CATALOG, type FleetVehicle } from "@/types";

/**
 * Per-car prices, set by the owner on 13 Aug 2026.
 *
 * The tiers as the customer sees them: Economy is the Corolla at €50, Standard
 * the Camry at €60, Electric the Tesla at €60, Business the EQE 300 at €65.
 *
 * Three of those four are columns. The Camry and the Tesla are not: they are
 * stored under BUSINESS and ELECTRIC_VIP, both of which read the €65 Business
 * column, so without a price of their own they would cost €65 rather than €60.
 * VehicleClass cannot fix that — a class is not a car — so the price is keyed
 * on the car.
 *
 * The risk this carries is the one that made per-vehicle overrides suspect in
 * the first place: a route charging one figure on the page and another at the
 * checkout. The last describe block is what holds that shut.
 */

/**
 * The route carrying the 8 Sep 2026 offer: the Tesla at €55 and the EQE at €60,
 * cut from €60 and €65 because visitors were reading the old figures and
 * leaving. Airport ⇄ Barcelona city only — one table row serves both
 * directions, so the ride out and the ride back are both on offer.
 */
const OFFER_ROUTE = "bcn-airport-barcelona-city";

// The five remaining routes whose Business column is €65 and which the offer
// did not touch. Naming them individually is the point: if the offer ever
// leaks onto the cruise or Castelldefels runs, these fail.
const CITY_TIER_REST = [
  "barcelona-city-barcelona-city",
  "bcn-airport-cruise-terminal",
  "cruise-terminal-barcelona-city",
  "bcn-airport-castelldefels",
  "barcelona-city-castelldefels",
];

const CITY_TIER = [OFFER_ROUTE, ...CITY_TIER_REST];

// What each car costs on the offer route.
const OFFER_PRICES: [FleetVehicle, number][] = [
  ["CAMRY", 60],
  ["TESLA_M3", 55],
  ["EQE_300", 60],
];

// What each car costs everywhere else in the city tier. The EQE is €65 here
// because it reads the Business column, which is the point of naming the tier
// after the car that fills it.
const REST_PRICES: [FleetVehicle, number][] = [
  ["CAMRY", 60],
  ["TESLA_M3", 60],
  ["EQE_300", 65],
];

describe("the owner's per-car prices", () => {
  it("prices every car on the offer route as instructed", () => {
    const route = FIXED_ROUTES.find((r) => r.slug === OFFER_ROUTE)!;
    expect(route, OFFER_ROUTE).toBeDefined();
    for (const [car, price] of OFFER_PRICES) {
      expect(
        lookupPriceByFleetVehicle(route.from, route.to, car),
        `${OFFER_ROUTE} ${car}`,
      ).toBe(price);
    }
  });

  it.each(CITY_TIER_REST)("%s keeps the pre-offer prices", (slug) => {
    const route = FIXED_ROUTES.find((r) => r.slug === slug)!;
    expect(route, slug).toBeDefined();
    for (const [car, price] of REST_PRICES) {
      expect(
        lookupPriceByFleetVehicle(route.from, route.to, car),
        `${slug} ${car}`,
      ).toBe(price);
    }
  });

  it("leaves the Business column at €65 on every city-tier route", () => {
    // The offer is a per-car override, not a column change. The column still
    // prices the Minivan and every caller holding only a VehicleClass, so
    // moving it would have cut fares nobody asked to cut.
    for (const slug of CITY_TIER) {
      const route = FIXED_ROUTES.find((r) => r.slug === slug)!;
      expect(route.prices.BUSINESS, slug).toBe(65);
      expect(lookupPriceByClass(route.from, route.to, "BUSINESS")).toBe(65);
    }
  });

  it("shows the per-car price on the fleet page", () => {
    expect(getFleetFromPrice("CAMRY")).toBe(60);
    // On offer.
    expect(getFleetFromPrice("TESLA_M3")).toBe(55);
    expect(getFleetFromPrice("EQE_300")).toBe(60);
    // Untouched.
    expect(getFleetFromPrice("COROLLA")).toBe(50);
    expect(getFleetFromPrice("SPRINTER")).toBe(180);
  });

  it("changes nothing on routes outside the city tier", () => {
    // Sitges Business is €100 and no car is priced separately there.
    const sitges = FIXED_ROUTES.find((r) => r.slug === "bcn-airport-sitges")!;
    for (const [car] of OFFER_PRICES) {
      expect(lookupPriceByFleetVehicle(sitges.from, sitges.to, car)).toBe(
        sitges.prices.BUSINESS,
      );
    }
  });

  it("prices a car with no override exactly as its class", () => {
    for (const v of VEHICLE_CATALOG) {
      const car = v.class;
      if (OFFER_PRICES.some(([c]) => c === car)) continue;
      const route = FIXED_ROUTES.find((r) => r.slug === "bcn-airport-sitges")!;
      expect(
        lookupPriceByFleetVehicle(route.from, route.to, car),
        car,
      ).toBe(lookupPriceByClass(route.from, route.to, FLEET_TO_DB_CLASS[car]));
    }
  });
});

describe("the zone lookup the quote path uses agrees", () => {
  // lookupFixedPriceByZone is what the pricing service calls. If it disagreed
  // with the fleet page, the site would advertise one price and charge another.
  // The zone pair that reaches the offer route, in both directions — the
  // discount is on the journey, not on leaving the airport.
  const OFFER_ZONES: [string, string][] = [
    ["airport", "barcelona_city"],
    ["barcelona_city", "airport"],
  ];

  const REST_ZONES: [string, string][] = [
    ["barcelona_city", "barcelona_city"],
    ["airport", "cruise"],
    ["cruise", "barcelona_city"],
    ["airport", "castelldefels"],
    ["barcelona_city", "castelldefels"],
  ];

  it.each(OFFER_ZONES)("%s → %s quotes the offer price", (from, to) => {
    for (const [car, price] of OFFER_PRICES) {
      expect(lookupFixedPriceByZone(from, to, car), `${from}→${to} ${car}`).toBe(price);
    }
    // The column is unmoved: a caller holding only a VehicleClass still gets €65.
    expect(lookupFixedPriceByZone(from, to, "BUSINESS")).toBe(65);
  });

  it.each(REST_ZONES)("%s → %s quotes the pre-offer price", (from, to) => {
    for (const [car, price] of REST_PRICES) {
      expect(lookupFixedPriceByZone(from, to, car), `${from}→${to} ${car}`).toBe(price);
    }
    expect(lookupFixedPriceByZone(from, to, "BUSINESS")).toBe(65);
  });
});

describe("a per-car price cannot diverge from the column silently", () => {
  /**
   * Every override must be cheaper than the column it overrides.
   *
   * Not an arbitrary rule. A customer picks a car and is quoted for it; if an
   * override were ever ABOVE the column, the class lookup — still reachable
   * from any caller that has only a VehicleClass — would quote less than the
   * car actually costs, and the checkout would surprise them upwards. Cheaper
   * is safe in a way dearer is not.
   */
  it("never prices a car above its own class", () => {
    const wrong: string[] = [];
    for (const route of FIXED_ROUTES) {
      for (const [car, price] of Object.entries(route.vehicleOverrides ?? {})) {
        const cls = lookupPriceByClass(route.from, route.to, FLEET_TO_DB_CLASS[car as FleetVehicle]);
        if (cls !== null && price > cls) {
          wrong.push(`${route.slug} ${car} €${price} > class €${cls}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("only names cars that are actually in the fleet", () => {
    const known = new Set(VEHICLE_CATALOG.map((v) => v.class));
    const unknown: string[] = [];
    for (const route of FIXED_ROUTES) {
      for (const car of Object.keys(route.vehicleOverrides ?? {})) {
        if (!known.has(car as FleetVehicle)) unknown.push(`${route.slug}: ${car}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it("keeps every override a whole number of euros", () => {
    for (const route of FIXED_ROUTES) {
      for (const [car, price] of Object.entries(route.vehicleOverrides ?? {})) {
        expect(Number.isInteger(price), `${route.slug} ${car}`).toBe(true);
      }
    }
  });
});

describe("the price does not change between the widget and the booking page", () => {
  // The homepage widget quotes a car, then hands off to /book through the URL.
  // It used to send FLEET_TO_DB_CLASS[vehicle], which throws away which car was
  // chosen: a Camry quoted at €60 arrived as "BUSINESS" and was re-quoted at
  // the €65 column. The fare rose by €5 at the moment the customer committed.
  const src = fs.readFileSync("components/booking/BookingForm.tsx", "utf8");

  it("hands the car itself to /book, not its class", () => {
    const handoff = src.slice(src.indexOf("const params = new URLSearchParams"));
    const vehicleParam = handoff.match(/vehicle:\s*([^,\n]+)/)?.[1] ?? "";
    expect(
      vehicleParam,
      "the vehicle param must carry the FleetVehicle, or per-car pricing is lost in the handoff",
    ).not.toMatch(/FLEET_TO_DB_CLASS/);
  });

  it("every car the widget can send still resolves to its own price", () => {
    // What /book does with the parameter: a fleet key maps back to its class,
    // and the per-car price is found from the key itself.
    for (const v of VEHICLE_CATALOG) {
      const viaFleetKey = lookupFixedPriceByZone("airport", "barcelona_city", v.class);
      const expected = lookupPriceByFleetVehicle("BCN_AIRPORT", "BARCELONA_CITY", v.class);
      expect(viaFleetKey, `${v.class} handed off by fleet key`).toBe(expected);
    }
  });

  it("the cars with their own price are the ones that would have jumped", () => {
    // Regression evidence: each car quotes below the class column it sits in,
    // so losing the car in the handoff would raise the fare at the last step.
    expect(lookupFixedPriceByZone("airport", "barcelona_city", "CAMRY")).toBe(60);
    expect(lookupFixedPriceByZone("airport", "barcelona_city", "BUSINESS")).toBe(65);
    expect(lookupFixedPriceByZone("airport", "barcelona_city", "TESLA_M3")).toBe(55);
    expect(lookupFixedPriceByZone("airport", "barcelona_city", "ELECTRIC_VIP")).toBe(65);
    expect(lookupFixedPriceByZone("airport", "barcelona_city", "EQE_300")).toBe(60);
    expect(lookupFixedPriceByZone("airport", "barcelona_city", "LUXURY")).toBe(65);
  });
});

describe("the offer shown beside a fare", () => {
  /**
   * `vehicleOffers` is the only figure on the site that is advertised without
   * being charged, which is exactly the shape of the €35/€60 defect this file
   * exists to prevent. These hold it to being a display of the real cut.
   */
  it("advertises the cut the table actually makes", () => {
    const tesla = offerForFleetVehicle("BCN_AIRPORT", "BARCELONA_CITY", "TESLA_M3")!;
    expect(tesla).not.toBeNull();
    expect(tesla.now).toBe(55);
    expect(tesla.was).toBe(60);
    expect(tesla.pctOff).toBe(8);

    const eqe = offerForFleetVehicle("BCN_AIRPORT", "BARCELONA_CITY", "EQE_300")!;
    expect(eqe).not.toBeNull();
    expect(eqe.now).toBe(60);
    expect(eqe.was).toBe(65);
    expect(eqe.pctOff).toBe(8);
  });

  it("quotes `now` as the fare the checkout charges, never a second copy", () => {
    for (const route of FIXED_ROUTES) {
      for (const car of Object.keys(route.vehicleOffers ?? {}) as FleetVehicle[]) {
        const offer = offerForFleetVehicle(route.from, route.to, car);
        if (!offer) continue;
        expect(offer.now, `${route.slug} ${car}`).toBe(
          lookupPriceByFleetVehicle(route.from, route.to, car),
        );
      }
    }
  });

  it("never advertises a `was` at or below the fare charged", () => {
    // A "was" that has fallen to the current price is not a saving, and one
    // below it would be advertising a price rise as a discount.
    const wrong: string[] = [];
    for (const route of FIXED_ROUTES) {
      for (const [car, was] of Object.entries(route.vehicleOffers ?? {})) {
        const now = lookupPriceByFleetVehicle(route.from, route.to, car as FleetVehicle);
        if (now !== null && was <= now) wrong.push(`${route.slug} ${car}: was €${was} ≤ now €${now}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("runs on the airport ⇄ city route and nowhere else", () => {
    const onOffer = FIXED_ROUTES.filter((r) => r.vehicleOffers).map((r) => r.slug);
    expect(onOffer).toEqual([OFFER_ROUTE]);
  });

  /**
   * The 8 Sep 2026 Costa Dorada reprice: Tarragona, Salou, PortAventura and
   * Cambrils all moved onto one ladder, cut from four different ones. Business
   * is the rung where the origin matters — €150 from the city, €160 from the
   * airport — which is the owner's instruction and the reason these are
   * asserted per origin rather than once.
   */
  const COSTA_DORADA: ZoneCode[] = ["TARRAGONA", "SALOU", "PORTAVENTURA", "CAMBRILS"];

  it.each(COSTA_DORADA)("%s charges the new ladder from the airport", (zone) => {
    expect(lookupPriceByClass("BCN_AIRPORT", zone, "ECONOMY")).toBe(140);
    expect(lookupPriceByClass("BCN_AIRPORT", zone, "BUSINESS")).toBe(160);
    expect(lookupPriceByClass("BCN_AIRPORT", zone, "MINIVAN")).toBe(180);
    expect(lookupPriceByClass("BCN_AIRPORT", zone, "LUXURY_MINIVAN")).toBe(195);
  });

  it.each(COSTA_DORADA)("%s charges €150 Business from the city, not €160", (zone) => {
    expect(lookupPriceByClass("BARCELONA_CITY", zone, "ECONOMY")).toBe(140);
    expect(lookupPriceByClass("BARCELONA_CITY", zone, "BUSINESS")).toBe(150);
    expect(lookupPriceByClass("BARCELONA_CITY", zone, "MINIVAN")).toBe(180);
    expect(lookupPriceByClass("BARCELONA_CITY", zone, "LUXURY_MINIVAN")).toBe(195);
  });

  it.each(COSTA_DORADA)("%s shows each rung's own old price", (zone) => {
    // Every destination fell from a different ladder, so the saving shown must
    // be that destination's, not a figure shared across the four.
    for (const col of ["ECONOMY", "BUSINESS", "MINIVAN", "VCLASS"] as const) {
      const offer = offerForColumn("BCN_AIRPORT", zone, col);
      expect(offer, `${zone} ${col}`).not.toBeNull();
      expect(offer!.was, `${zone} ${col} was`).toBeGreaterThan(offer!.now);
    }
  });

  it("cuts Cambrils deepest, it having been the dearest of the four", () => {
    expect(offerForColumn("BCN_AIRPORT", "CAMBRILS", "ECONOMY")!.was).toBe(160);
    expect(offerForColumn("BCN_AIRPORT", "TARRAGONA", "ECONOMY")!.was).toBe(150);
    expect(offerForColumn("BCN_AIRPORT", "SALOU", "ECONOMY")!.was).toBe(155);
  });

  it("leaves the Minibus alone, so it shows no badge", () => {
    for (const zone of COSTA_DORADA) {
      expect(offerForColumn("BCN_AIRPORT", zone, "MINIBUS"), zone).toBeNull();
    }
  });

  it("does not touch the neighbouring routes the owner did not name", () => {
    // La Pineda and Reus sit in the same cluster and were NOT repriced, so
    // they still read their own ladder. Asserted so the change cannot spread
    // to them unnoticed.
    expect(lookupPriceByClass("BCN_AIRPORT", "LA_PINEDA", "ECONOMY")).toBe(155);
    expect(lookupPriceByClass("BCN_AIRPORT", "REUS_AIRPORT", "ECONOMY")).toBe(155);
    expect(offerForColumn("BCN_AIRPORT", "LA_PINEDA", "ECONOMY")).toBeNull();
    expect(offerForColumn("BCN_AIRPORT", "REUS_AIRPORT", "ECONOMY")).toBeNull();
  });

  it("gives a car with no price of its own the column's offer", () => {
    // The Corolla has no per-car price anywhere; on a column-offer route it
    // must still show the tier's saving rather than none at all.
    const corolla = offerForFleetVehicle("BCN_AIRPORT", "TARRAGONA", "COROLLA");
    expect(corolla).not.toBeNull();
    expect(corolla!.now).toBe(140);
    expect(corolla!.was).toBe(150);
  });

  it("shows no offer on a car that has none", () => {
    for (const car of ["COROLLA", "CAMRY", "VITO", "V_CLASS", "SPRINTER"] as FleetVehicle[]) {
      expect(
        offerForFleetVehicle("BCN_AIRPORT", "BARCELONA_CITY", car),
        car,
      ).toBeNull();
    }
    // Nor on a route the offer does not cover.
    expect(offerForFleetVehicle("BCN_AIRPORT", "SITGES", "TESLA_M3")).toBeNull();
  });
});

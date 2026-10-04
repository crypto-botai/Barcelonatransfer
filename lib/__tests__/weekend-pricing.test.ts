import { readFileSync } from "node:fs";
import fg from "fast-glob";
import { describe, it, expect } from "vitest";
import { pickupToUtc, parsePickupInput } from "@/lib/datetime";
import { upcomingWeekends, weekendOf, weekendPercent, withWeekend, WEEKEND_MAX_PERCENT, WEEKEND_MIN_PERCENT } from "@/lib/weekend-pricing";
import { getQuote } from "@/lib/pricing-service";
import { repriceForNewTime, weekendShift, WEEKEND_PRICING_STARTS } from "@/lib/reschedule-price";
import { BASELINE_HIGH, BASELINE_LOW, busier, demandFor, levelsFromCounts, MIN_BOOKINGS_TO_RANK } from "@/lib/demand";

/**
 * The weekend: Friday 12:00 to Monday 12:00, Barcelona time.
 *
 * What must hold: the boundaries are exactly noon on Barcelona's clock, a given
 * weekend always has the same percentage (so a quote is the charge), the
 * percentage stays between 15 and 22, it is not the same every weekend, and it
 * is never reachable from a quote.
 */

/** A Barcelona wall clock, as the instant it is. */
const at = (date: string, time: string) => pickupToUtc(date, time)!;

// October 2026: Friday the 9th, Saturday 10th, Sunday 11th, Monday 12th.
describe("when a weekend starts and ends", () => {
  it("starts at noon on Friday, not a minute before", () => {
    expect(weekendOf(at("2026-10-09", "11:59"))).toBeNull();
    expect(weekendOf(at("2026-10-09", "12:00"))).toBe("2026-10-09");
    expect(weekendOf(at("2026-10-09", "23:59"))).toBe("2026-10-09");
  });

  it("ends at noon on Monday, not a minute after", () => {
    expect(weekendOf(at("2026-10-12", "00:00"))).toBe("2026-10-09");
    expect(weekendOf(at("2026-10-12", "11:59"))).toBe("2026-10-09");
    expect(weekendOf(at("2026-10-12", "12:00"))).toBeNull();
  });

  it("covers all of Saturday and Sunday, and names the weekend by its Friday", () => {
    for (const [d, t] of [["2026-10-10", "00:00"], ["2026-10-10", "13:30"], ["2026-10-11", "03:00"], ["2026-10-11", "23:59"]]) {
      expect(weekendOf(at(d, t)), `${d} ${t}`).toBe("2026-10-09");
    }
  });

  it("is not Tuesday, Wednesday or Thursday", () => {
    for (const d of ["2026-10-13", "2026-10-14", "2026-10-15"]) expect(weekendOf(at(d, "12:00"))).toBeNull();
  });

  it("is judged on Barcelona's clock, not the server's", () => {
    // 10:30 UTC on Friday is 12:30 in Barcelona (summer time): inside the weekend.
    expect(weekendOf(new Date("2026-10-09T10:30:00Z"))).toBe("2026-10-09");
    // 09:30 UTC is 11:30 in Barcelona: not yet.
    expect(weekendOf(new Date("2026-10-09T09:30:00Z"))).toBeNull();
    // Monday 10:30 UTC is 12:30 in Barcelona: already over.
    expect(weekendOf(new Date("2026-10-12T10:30:00Z"))).toBeNull();
  });

  it("is unmoved by the clocks going back on Sunday 25 October 2026", () => {
    expect(weekendOf(at("2026-10-23", "12:00"))).toBe("2026-10-23");
    expect(weekendOf(at("2026-10-25", "02:30"))).toBe("2026-10-23");
    expect(weekendOf(at("2026-10-25", "18:00"))).toBe("2026-10-23");
    expect(weekendOf(at("2026-10-26", "11:59"))).toBe("2026-10-23");
    expect(weekendOf(at("2026-10-26", "12:00"))).toBeNull();
  });

  it("is unmoved by the clocks going forward on Sunday 29 March 2026", () => {
    expect(weekendOf(at("2026-03-27", "12:00"))).toBe("2026-03-27");
    expect(weekendOf(at("2026-03-29", "12:00"))).toBe("2026-03-27");
    expect(weekendOf(at("2026-03-30", "11:59"))).toBe("2026-03-27");
    expect(weekendOf(at("2026-03-30", "12:00"))).toBeNull();
  });

  it("is judged by when the car is wanted, however far ahead it is booked", () => {
    expect(weekendOf(at("2027-06-05", "10:00"))).toBe("2027-06-04"); // a Saturday, nine months away
  });

  it("says nothing for a date that is not one", () => {
    expect(weekendOf("not a date")).toBeNull();
    expect(weekendOf(NaN)).toBeNull();
  });
});

describe("the percentage", () => {
  it("is a whole number from 15 to 22", () => {
    let d = new Date("2026-01-02T00:00:00Z");
    for (let i = 0; i < 520; i++, d = new Date(d.getTime() + 7 * 86_400_000)) {
      const p = weekendPercent(d.toISOString().slice(0, 10));
      expect(Number.isInteger(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(WEEKEND_MIN_PERCENT);
      expect(p).toBeLessThanOrEqual(WEEKEND_MAX_PERCENT);
    }
  });

  it("is the same for a given weekend every time it is asked", () => {
    for (let i = 0; i < 50; i++) expect(weekendPercent("2026-10-09")).toBe(19);
  });

  it("is pinned: changing the algorithm would move every future weekend and every quote already given", () => {
    const pinned: Record<string, number> = {
      "2026-10-09": 19, "2026-10-16": 19, "2026-10-23": 20, "2026-10-30": 21, "2026-11-06": 15,
      "2026-11-13": 20, "2026-11-20": 22, "2026-11-27": 18, "2026-12-04": 20, "2026-12-11": 22,
    };
    for (const [friday, p] of Object.entries(pinned)) expect(weekendPercent(friday), friday).toBe(p);
  });

  it("differs from weekend to weekend, and uses the whole range", () => {
    const seen = new Set<number>();
    let d = new Date("2026-01-02T00:00:00Z");
    for (let i = 0; i < 260; i++, d = new Date(d.getTime() + 7 * 86_400_000)) seen.add(weekendPercent(d.toISOString().slice(0, 10)));
    expect([...seen].sort((a, b) => a - b)).toEqual([15, 16, 17, 18, 19, 20, 21, 22]);
  });
});

describe("the price for a pickup", () => {
  it("is the fare itself on a weekday", () => {
    expect(withWeekend(50, at("2026-10-14", "10:00"))).toEqual({ price: 50, weekend: false, percent: 0 });
  });

  it("adds the weekend's percentage inside a weekend, in whole euros", () => {
    const w = withWeekend(50, at("2026-10-10", "10:00")); // 19% that weekend
    expect(w).toEqual({ price: 60, weekend: true, percent: 19 }); // 59.5 rounds to 60
    expect(Number.isInteger(w.price)).toBe(true);
    expect(withWeekend(165, at("2026-10-10", "10:00")).price).toBe(196); // 196.35
  });

  it("is the same percentage for every route that weekend", () => {
    const pct = (fare: number) => withWeekend(fare, at("2026-10-10", "10:00")).percent;
    expect(new Set([50, 80, 145, 165, 600].map(pct)).size).toBe(1);
  });

  it("never prices a fare of nothing, and ignores a bad date", () => {
    expect(withWeekend(0, at("2026-10-10", "10:00")).price).toBe(0);
    expect(withWeekend(80, "garbage")).toEqual({ price: 80, weekend: false, percent: 0 });
  });

  it("reads a form's wall clock as Barcelona, so Friday noon is the line and not 14:00", () => {
    // The form posts "2026-10-09T12:00" with no zone.
    expect(withWeekend(100, parsePickupInput("2026-10-09T11:59")!).weekend).toBe(false);
    expect(withWeekend(100, parsePickupInput("2026-10-09T12:00")!).weekend).toBe(true);
    expect(withWeekend(100, parsePickupInput("2026-10-12T11:59")!).weekend).toBe(true);
    expect(withWeekend(100, parsePickupInput("2026-10-12T12:00")!).weekend).toBe(false);
  });
});

describe("the weekends the office can see", () => {
  it("lists the next ones with their percentages", () => {
    const w = upcomingWeekends(new Date("2026-10-07T10:00:00Z"), 3);
    expect(w.map((x) => [x.friday, x.monday, x.percent])).toEqual([["2026-10-09", "2026-10-12", 19], ["2026-10-16", "2026-10-19", 19], ["2026-10-23", "2026-10-26", 20]]);
    expect(w[0].current).toBe(false);
  });

  it("marks the weekend that is under way, and counts Friday morning as still ahead", () => {
    expect(upcomingWeekends(new Date("2026-10-10T10:00:00Z"), 2)[0]).toMatchObject({ friday: "2026-10-09", current: true });
    expect(upcomingWeekends(new Date("2026-10-09T07:00:00Z"), 2)[0]).toMatchObject({ friday: "2026-10-09", current: false }); // 09:00 Barcelona
    expect(upcomingWeekends(new Date("2026-10-12T11:00:00Z"), 2)[0]).toMatchObject({ friday: "2026-10-16", current: false }); // Monday 13:00
  });
});

// ─── The quote ───────────────────────────────────────────────────────────────

const AIRPORT = { lat: 41.2974, lng: 2.0833, address: "Barcelona Airport Terminal 1" };
const CITY = { lat: 41.3874, lng: 2.1686, address: "Passeig de Gracia, Barcelona" };

const quote = (when: Date, over: Record<string, unknown> = {}) =>
  getQuote({
    pickupLat: AIRPORT.lat, pickupLng: AIRPORT.lng, dropoffLat: CITY.lat, dropoffLng: CITY.lng,
    vehicleClass: "ECONOMY", pickupDatetime: when, distanceKm: 15, durationMin: 25,
    pickupAddress: AIRPORT.address, dropoffAddress: CITY.address, ...over,
  } as never);

describe("the quote", () => {
  it("costs more on a weekend by that weekend's percentage, and not otherwise", async () => {
    const weekday = await quote(at("2026-10-14", "10:00"));
    const saturday = await quote(at("2026-10-10", "10:00"));
    expect(weekday.totalAmount).toBeGreaterThan(0);
    expect(saturday.totalAmount).toBe(Math.round(weekday.totalAmount * 1.19));
    expect(saturday.totalAmount).toBeGreaterThan(weekday.totalAmount);
  });

  it("is a single price: the uplift is inside the fare, and no field says a percentage", async () => {
    const q = await quote(at("2026-10-10", "10:00"));
    expect(q.totalAmount).toBe(q.baseFare);
    expect(q.nightSurcharge).toBe(0);
    expect(q.lastMinuteSurcharge).toBe(0);
    expect(JSON.stringify(q)).not.toMatch(/weekend|percent|19|uplift|surge/i);
  });

  it("is the same on Friday afternoon, Saturday, Sunday and Monday morning, and drops back after noon on Monday", async () => {
    const prices = await Promise.all(
      [["2026-10-09", "12:00"], ["2026-10-10", "09:00"], ["2026-10-11", "21:00"], ["2026-10-12", "11:59"]].map(async ([d, t]) => (await quote(at(d, t))).totalAmount),
    );
    expect(new Set(prices).size).toBe(1);
    const before = (await quote(at("2026-10-09", "11:59"))).totalAmount;
    const after = (await quote(at("2026-10-12", "12:00"))).totalAmount;
    expect(before).toBe(after);
    expect(prices[0]).toBeGreaterThan(before);
  });

  it("applies the same percentage to every route and every car on a given weekend", async () => {
    const out = await Promise.all(
      (["ECONOMY", "BUSINESS", "MINIVAN"] as const).map(async (vehicleClass) => {
        const week = (await quote(at("2026-10-14", "10:00"), { vehicleClass })).totalAmount;
        const wknd = (await quote(at("2026-10-10", "10:00"), { vehicleClass })).totalAmount;
        return wknd === Math.round(week * 1.19);
      }),
    );
    expect(out).toEqual([true, true, true]);
  });

  it("applies to a journey priced by distance as well", async () => {
    const far = { pickupLat: 40.4, pickupLng: -3.7, dropoffLat: 40.9, dropoffLng: -3.2, pickupAddress: undefined, dropoffAddress: undefined, distanceKm: 120 };
    const weekday = await quote(at("2026-10-14", "10:00"), far);
    const saturday = await quote(at("2026-10-10", "10:00"), far);
    expect(weekday.isCustomRoute).toBe(true);
    expect(saturday.totalAmount).toBe(Math.round(weekday.totalAmount * 1.19));
  });

  it("keeps a booking made months ahead on the weekend it is for", async () => {
    // Priced in the year before: the same rule, the percentage of that weekend.
    const friday = weekendOf(at("2027-06-05", "10:00"))!;
    const p = weekendPercent(friday);
    const weekday = await quote(at("2027-06-09", "10:00"));
    const weekend = await quote(at("2027-06-05", "10:00"));
    expect(weekend.totalAmount).toBe(Math.round(weekday.totalAmount * (1 + p / 100)));
  });
});

// ─── Moving a booking ────────────────────────────────────────────────────────

describe("moving a booking across the line", () => {
  const AFTER_LAUNCH = new Date(WEEKEND_PRICING_STARTS.getTime() + 86_400_000);
  const booking = (pickup: Date, base: number, createdAt: Date | null = AFTER_LAUNCH) => ({ baseFare: base, totalAmount: base, pickupDatetime: pickup, bookingType: null, createdAt });

  it("adds the weekend when a weekday booking moves into one", () => {
    const r = repriceForNewTime(booking(at("2026-10-14", "10:00"), 50), at("2026-10-10", "10:00"));
    expect(r.weekend).toMatchObject({ changed: true, oldPercent: 0, newPercent: 19 });
    expect(r.newTotal).toBe(60);
    expect(r.baseFare).toBe(60);
    expect(r.difference).toBe(10);
  });

  it("takes it off when a weekend booking moves to a weekday", () => {
    const r = repriceForNewTime(booking(at("2026-10-10", "10:00"), 60), at("2026-10-14", "10:00"));
    expect(r.newTotal).toBe(50);
    expect(r.difference).toBe(-10);
  });

  it("charges nothing for a move inside the same weekend, or between weekdays", () => {
    expect(repriceForNewTime(booking(at("2026-10-10", "10:00"), 60), at("2026-10-11", "20:00")).difference).toBe(0);
    expect(repriceForNewTime(booking(at("2026-10-13", "10:00"), 50), at("2026-10-15", "10:00")).difference).toBe(0);
  });

  it("moves between weekends by the difference of their percentages", () => {
    // 19% to 20%: 50 -> 60 (59.5) then 50 -> 60 (60.0). Pick weekends that differ more: 2026-11-06 is 15%, 2026-11-20 is 22%.
    const r = repriceForNewTime(booking(at("2026-11-07", "10:00"), 58), at("2026-11-21", "10:00"));
    expect(r.weekend).toMatchObject({ oldPercent: 15, newPercent: 22 });
    expect(r.newTotal).toBe(Math.round(50 * 1.22)); // 58 is 50 at 15% (57.5 rounds to 58)
  });

  it("leaves a fare the office adjusted by hand adjusted, moving only by the weekend part", () => {
    const hand = { ...booking(at("2026-10-14", "10:00"), 50), totalAmount: 45 }; // a discount of 5
    expect(repriceForNewTime(hand, at("2026-10-10", "10:00")).newTotal).toBe(55);
  });

  it("does not take off a weekend a booking never had: it was made before the rule", () => {
    const old = booking(at("2026-10-10", "10:00"), 50, new Date("2026-09-01T00:00:00Z"));
    expect(weekendShift(old, at("2026-10-14", "10:00"))).toMatchObject({ oldPercent: 0, newPercent: 0, changed: false });
    // Moving it to another weekend does put the rule on.
    expect(weekendShift(old, at("2026-10-17", "10:00")).changed).toBe(true);
  });

  it("does not apply to hourly hire", () => {
    const hourly = { ...booking(at("2026-10-14", "10:00"), 200), bookingType: "HOURLY" };
    expect(repriceForNewTime(hourly, at("2026-10-10", "10:00")).weekend.changed).toBe(false);
  });
});

// ─── Demand ──────────────────────────────────────────────────────────────────

describe("high and low demand areas", () => {
  const ZONES = ["airport", "barcelona_city", "cruise", "sants", "sitges", "castelldefels", "andorra", "lourdes", "cadaques", "girona_airport", "tarragona", "lloret"];

  it("uses a fixed list until there are enough bookings to rank honestly", () => {
    const few = levelsFromCounts({ lloret: 5, airport: 2 }, ZONES);
    for (const z of BASELINE_HIGH) if (ZONES.includes(z)) expect(few[z], z).toBe("high");
    for (const z of BASELINE_LOW) if (ZONES.includes(z)) expect(few[z], z).toBe("low");
    expect(few.lloret).toBe("normal");
  });

  it("ranks by real bookings once there are enough: the busiest high, the quietest low", () => {
    const counts = { lloret: 60, tarragona: 25, airport: 20, barcelona_city: 15, sitges: 4, andorra: 2 };
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(MIN_BOOKINGS_TO_RANK);
    const l = levelsFromCounts(counts, ZONES);
    expect(l.lloret).toBe("high");
    expect(l.tarragona).toBe("high");
    expect(l.cadaques).toBe("low");     // nobody went
    expect(l.lourdes).toBe("low");
    expect(Object.values(l).filter((v) => v === "normal").length).toBeGreaterThan(0); // not everything is labelled
  });

  it("does not call an area high demand on two bookings", () => {
    const counts = { lloret: 38, tarragona: 2, airport: 2, barcelona_city: 2 };
    const l = levelsFromCounts(counts, ZONES);
    expect(l.lloret).toBe("high");
    expect(l.tarragona).not.toBe("high");
  });

  it("is one step busier inside a weekend", () => {
    expect(busier("low")).toBe("normal");
    expect(busier("normal")).toBe("high");
    expect(busier("high")).toBe("high");
    const levels = { andorra: "low", lloret: "normal", airport: "high" } as const;
    expect(demandFor("andorra", levels, at("2026-10-14", "10:00"))).toEqual({ label: "Andorra", level: "low" });
    expect(demandFor("andorra", levels, at("2026-10-10", "10:00"))).toBeNull();                 // now ordinary
    expect(demandFor("lloret", levels, at("2026-10-14", "10:00"))).toBeNull();                  // ordinary: no label
    expect(demandFor("lloret", levels, at("2026-10-10", "10:00"))).toEqual({ label: "Lloret de Mar", level: "high" });
    expect(demandFor("airport", levels, at("2026-10-10", "10:00"))).toEqual({ label: "El Prat Airport", level: "high" });
  });

  it("names nothing it does not know", () => {
    expect(demandFor("atlantis", {}, at("2026-10-14", "10:00"))).toBeNull();
    expect(demandFor(null, {}, at("2026-10-14", "10:00"))).toBeNull();
  });

  it("reaches the quote for each end, with no percentage and no price in it", async () => {
    const q = await quote(at("2026-10-14", "10:00"));
    expect(q.demand?.pickup).toEqual({ label: "El Prat Airport", level: "high" });
    expect(q.demand?.dropoff).toEqual({ label: "Barcelona City", level: "high" });
    expect(JSON.stringify(q.demand)).not.toMatch(/\d|€|%/);
  });
});

// ─── What the site promises ──────────────────────────────────────────────────

describe("what the site says about prices", () => {
  // Weekends cost more, so nothing a customer, a search engine or an assistant reads may say
  // there is no surge, no peak pricing, or that a price never moves with the day of the week.
  const FILES = fg.sync(["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.ts", "messages/*.json", "data/*.json"], { ignore: ["**/__tests__/**"] });
  const CLAIM = /no surge|never (?:apply )?surge|zero surge|surge pricing, ever|not a surge|sin tarifas din|jamais de (?:surcharges|tarification dynamique)|niemals (?:preisaufschl|dynamische)|mai tariffe dinamiche|mai prezzi dinamici|sem pre.os din|绝无溨价|绝不溨价/i;

  it("makes no claim that there is no surge or peak pricing", () => {
    const found = FILES.flatMap((f) => readFileSync(f, "utf-8").split(/\r?\n/).map((l, i) => ({ f, i: i + 1, l })).filter(({ l }) => CLAIM.test(l)).map(({ f, i, l }) => `${f}:${i} ${l.trim().slice(0, 90)}`));
    expect(found).toEqual([]);
  });

  it("never prints a weekend percentage anywhere a customer can read it", () => {
    for (const f of FILES.filter((x) => !x.startsWith("app/admin/") && !x.startsWith("lib/weekend-pricing") && !x.startsWith("lib/reschedule-price"))) {
      expect(readFileSync(f, "utf-8"), f).not.toMatch(/weekendPercent|upcomingWeekends|WEEKEND_(?:MIN|MAX)_PERCENT/);
    }
  });
});

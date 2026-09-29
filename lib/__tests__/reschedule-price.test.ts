import { describe, it, expect } from "vitest";
import { timeSurcharges, repriceForNewTime, applyToBalance, pricesByTimeOfDay } from "@/lib/reschedule-price";
import { NIGHT_SURCHARGE_RATE, LAST_MINUTE_SURCHARGE_RATE } from "@/lib/pricing";

/**
 * Moving a booking can change what it should cost, because two parts of the
 * fare depend on when the car is wanted: 20% for a night pickup and 15%
 * inside the last-minute window.
 *
 * These use the same clock the booking engine does (isNightTime reads the
 * running process's zone), so the tests build their instants with local hours
 * rather than a fixed UTC string. That keeps them honest about what the code
 * actually does instead of passing only in one timezone.
 */

/** A local instant, N days from a fixed base, at a given local hour. */
const localAt = (dayOffset: number, hour: number): Date => {
  const d = new Date(2026, 9, 15, hour, 0, 0, 0); // 15 Oct 2026, local
  d.setDate(d.getDate() + dayOffset);
  return d;
};

// Far enough out that the last-minute window never fires unless asked for.
const NOW = localAt(0, 12).getTime();

describe("time-dependent surcharges", () => {
  it("adds nothing to a midday pickup booked well ahead", () => {
    const s = timeSurcharges(100, localAt(5, 12), NOW);
    expect(s).toEqual({ night: 0, lastMinute: 0, total: 0 });
  });

  it("adds the night rate to a pickup after 22:00", () => {
    const s = timeSurcharges(100, localAt(5, 23), NOW);
    expect(s.night).toBe(100 * NIGHT_SURCHARGE_RATE);
    expect(s.total).toBe(20);
  });

  it("adds the night rate to a pickup before 06:00", () => {
    expect(timeSurcharges(100, localAt(5, 3), NOW).night).toBe(20);
  });

  it("adds the last-minute rate inside the window", () => {
    const s = timeSurcharges(100, localAt(0, 14), NOW); // 2 hours away
    expect(s.lastMinute).toBe(100 * LAST_MINUTE_SURCHARGE_RATE);
  });

  it("can add both at once", () => {
    const s = timeSurcharges(100, localAt(0, 14), localAt(0, 13).getTime());
    const night = timeSurcharges(100, localAt(0, 14), localAt(0, 13).getTime()).night;
    expect(s.total).toBe(Math.round((night + 15) * 100) / 100);
  });

  it("rounds to the cent", () => {
    const s = timeSurcharges(33.33, localAt(5, 23), NOW);
    expect(s.night).toBe(6.67);
  });
});

describe("repricing a booking for a new time", () => {
  // Hourly hire is the type whose fare actually moves with the hour. A
  // transfer is covered in its own block below, because it must not.
  const booking = (total: number, pickup: Date) => ({
    baseFare: 100, totalAmount: total, pickupDatetime: pickup, bookingType: "HOURLY",
  });

  it("charges more when moving a midday run into the night", () => {
    const r = repriceForNewTime(booking(100, localAt(5, 12)), localAt(5, 23), NOW);
    expect(r.difference).toBe(20);
    expect(r.newTotal).toBe(120);
  });

  it("charges less when moving a night run into the day", () => {
    const r = repriceForNewTime(booking(120, localAt(5, 23)), localAt(5, 12), NOW);
    expect(r.difference).toBe(-20);
    expect(r.newTotal).toBe(100);
  });

  it("does not move the price when both slots are ordinary", () => {
    const r = repriceForNewTime(booking(100, localAt(5, 12)), localAt(6, 14), NOW);
    expect(r.difference).toBe(0);
    expect(r.newTotal).toBe(100);
  });

  /**
   * A fare the office set by hand must survive a change of time. Only the
   * movement in surcharge is applied, so a negotiated €90 on a €100 base
   * stays €90 when the time moves within the day.
   */
  it("keeps a hand-adjusted fare rather than recomputing it", () => {
    const r = repriceForNewTime(booking(90, localAt(5, 12)), localAt(6, 14), NOW);
    expect(r.newTotal).toBe(90);
  });

  it("applies the difference on top of a hand-adjusted fare", () => {
    const r = repriceForNewTime(booking(90, localAt(5, 12)), localAt(5, 23), NOW);
    expect(r.newTotal).toBe(110);
  });

  it("never charges two night uplifts for one journey", () => {
    // Already at night, moving to another night hour: no further change.
    const r = repriceForNewTime(booking(120, localAt(5, 23)), localAt(6, 2), NOW);
    expect(r.difference).toBe(0);
  });
});

describe("what the difference does to a part-paid booking", () => {
  it("falls entirely on the balance the chauffeur collects", () => {
    const out = applyToBalance({ depositAmount: 50, balanceAmount: 50 }, 20);
    expect(out).toEqual({ balanceAmount: 70, refundDue: 0 });
  });

  it("reduces the balance when the new slot is cheaper", () => {
    expect(applyToBalance({ depositAmount: 50, balanceAmount: 50 }, -20).balanceAmount).toBe(30);
  });

  it("never takes the balance below zero", () => {
    const out = applyToBalance({ depositAmount: 80, balanceAmount: 20 }, -50);
    expect(out.balanceAmount).toBe(0);
    expect(out.refundDue).toBe(30);
  });

  it("leaves a fully-paid booking alone", () => {
    expect(applyToBalance({ depositAmount: null, balanceAmount: null }, 20))
      .toEqual({ balanceAmount: null, refundDue: 0 });
  });
});

/**
 * "No surge pricing, ever" is on the public pricing page, and the quote API
 * returns nightSurcharge: 0 on every transfer whatever the hour. The first
 * version of this file surcharged every booking alike, so moving a fixed
 * airport run to 23:00 added 20% the booking engine would never have
 * charged — against a promise the customer can read.
 */
describe("a fixed-price transfer never moves with the clock", () => {
  const transfer = (type: string | null) => ({
    baseFare: 100, totalAmount: 100, pickupDatetime: localAt(5, 12), bookingType: type,
  });

  it("costs the same moved into the middle of the night", () => {
    const r = repriceForNewTime(transfer("TRANSFER"), localAt(5, 23), NOW);
    expect(r.difference).toBe(0);
    expect(r.newTotal).toBe(100);
  });

  it("reports no surcharge rather than two that cancel", () => {
    const r = repriceForNewTime(transfer("TRANSFER"), localAt(5, 2), NOW);
    expect(r.newSurcharges).toEqual({ night: 0, lastMinute: 0, total: 0 });
    expect(r.oldSurcharges).toEqual({ night: 0, lastMinute: 0, total: 0 });
  });

  it("costs the same moved inside the last-minute window", () => {
    const r = repriceForNewTime(transfer("TRANSFER"), localAt(0, 14), NOW);
    expect(r.difference).toBe(0);
  });

  it("treats an unknown or missing type as not surcharged", () => {
    // A booking with no metadata must not acquire a surcharge by default.
    for (const type of [null, "", "SOMETHING_NEW"]) {
      expect(repriceForNewTime(transfer(type), localAt(5, 23), NOW).difference).toBe(0);
    }
  });

  it("still surcharges the types the booking engine surcharges", () => {
    for (const type of ["HOURLY", "DAY_HIRE", "hourly"]) {
      const r = repriceForNewTime({ ...transfer(type) }, localAt(5, 23), NOW);
      expect(r.difference, type).toBe(20);
    }
  });
});

describe("pricesByTimeOfDay", () => {
  it("is true only for hourly and day hire", () => {
    expect(pricesByTimeOfDay("HOURLY")).toBe(true);
    expect(pricesByTimeOfDay("DAY_HIRE")).toBe(true);
    expect(pricesByTimeOfDay("TRANSFER")).toBe(false);
    expect(pricesByTimeOfDay(null)).toBe(false);
    expect(pricesByTimeOfDay(undefined)).toBe(false);
  });
});

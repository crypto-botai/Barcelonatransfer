import { describe, it, expect } from "vitest";
import { isNightTime } from "@/lib/utils";

/**
 * The night window is Barcelona time, not the server's.
 *
 * The surcharge is priced from this on HOURLY and DAY_HIRE bookings, and the
 * server runs in UTC while the car is in Barcelona. Reading the hour off the
 * server clock shifted the window by the zone offset, so a 23:30 pickup was
 * charged as daytime and an 07:30 pickup was charged as night.
 *
 * Each case below is written as the UTC instant the booking actually is, with
 * the Barcelona wall-clock time it corresponds to in the name — so these still
 * mean what they say whatever timezone the test machine is in.
 */

/** Summer: Barcelona is CEST, UTC+2. */
const summer = (hhmm: string) => new Date(`2026-07-15T${hhmm}:00.000Z`);
/** Winter: Barcelona is CET, UTC+1. */
const winter = (hhmm: string) => new Date(`2026-01-15T${hhmm}:00.000Z`);

describe("the night window in summer (UTC+2)", () => {
  it("counts 23:30 Barcelona as night", () => {
    expect(isNightTime(summer("21:30"))).toBe(true);
  });

  it("counts 02:00 Barcelona as night", () => {
    expect(isNightTime(summer("00:00"))).toBe(true);
  });

  it("does not count 07:30 Barcelona as night", () => {
    expect(isNightTime(summer("05:30"))).toBe(false);
  });

  it("does not count midday Barcelona as night", () => {
    expect(isNightTime(summer("10:00"))).toBe(false);
  });
});

describe("the night window in winter (UTC+1)", () => {
  it("counts 23:30 Barcelona as night", () => {
    expect(isNightTime(winter("22:30"))).toBe(true);
  });

  it("does not count 07:30 Barcelona as night", () => {
    expect(isNightTime(winter("06:30"))).toBe(false);
  });
});

describe("the edges of the window", () => {
  /** 22:00 opens it. */
  it("includes 22:00 Barcelona", () => {
    expect(isNightTime(summer("20:00"))).toBe(true);
  });

  /** 21:59 is still the evening rate. */
  it("excludes 21:59 Barcelona", () => {
    expect(isNightTime(summer("19:59"))).toBe(false);
  });

  /** 05:59 is the last night minute. */
  it("includes 05:59 Barcelona", () => {
    expect(isNightTime(summer("03:59"))).toBe(true);
  });

  /** 06:00 closes it. */
  it("excludes 06:00 Barcelona", () => {
    expect(isNightTime(summer("04:00"))).toBe(false);
  });
});

describe("the window is not the server's clock", () => {
  /**
   * The regression itself. Both instants below read as the *other* side of
   * the window when the hour is taken from a UTC server, which is what
   * production runs on. If someone reverts to `date.getHours()`, these two
   * fail on Vercel while every other test in this file still passes locally.
   */
  it("does not charge night on a 07:30 Barcelona pickup", () => {
    // 05:30 UTC — getHours() on a UTC server returns 5, which is inside 22..6.
    expect(isNightTime(summer("05:30"))).toBe(false);
  });

  it("does charge night on a 23:30 Barcelona pickup", () => {
    // 21:30 UTC — getHours() on a UTC server returns 21, outside 22..6.
    expect(isNightTime(summer("21:30"))).toBe(true);
  });
});

describe("a custom window still works", () => {
  it("honours explicit start and end hours in Barcelona time", () => {
    // 23:00 Barcelona, window 23..5
    expect(isNightTime(summer("21:00"), 23, 5)).toBe(true);
    // 22:00 Barcelona is outside a 23..5 window
    expect(isNightTime(summer("20:00"), 23, 5)).toBe(false);
  });
});

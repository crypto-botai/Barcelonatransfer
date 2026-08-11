import { describe, it, expect } from "vitest";
import {
  pickupToUtc,
  parsePickupInput,
  pickupToParts,
  formatPickupDateTime,
  formatPickupTime,
  BOOKING_TIMEZONE,
} from "../datetime";

/**
 * The pickup time a customer chose must survive the whole pipeline.
 *
 * These assert the property that broke in production: whatever the customer
 * selected is what every later surface reads back. The old code parsed a
 * zoneless string with `new Date()`, which takes the runtime's zone — UTC on
 * Vercel — so a 10:30 pickup was stored as 10:30Z and read back as 12:30 in
 * Barcelona.
 *
 * The round trip below is the real guarantee: select → store → display. It
 * holds regardless of the machine's own zone, which is why it catches the
 * original bug even though CI does not run in UTC.
 */

/** Selected → stored → displayed, the whole journey in one step. */
function roundTrip(date: string, time: string) {
  const stored = pickupToUtc(date, time);
  if (!stored) throw new Error(`could not parse ${date} ${time}`);
  return {
    storedIso: stored.toISOString(),
    displayed: formatPickupTime(stored),
    displayedFull: formatPickupDateTime(stored),
    parts: pickupToParts(stored),
  };
}

describe("pickup datetime — the customer's choice survives", () => {
  const CASES: [string, string, string, string][] = [
    // label,                 date,         time,    expected stored instant (UTC)
    ["1. winter (CET, +01)",  "2026-01-15", "10:30", "2026-01-15T09:30:00.000Z"],
    ["2. summer (CEST, +02)", "2026-07-15", "10:30", "2026-07-15T08:30:00.000Z"],
    ["4. morning",            "2026-09-15", "07:15", "2026-09-15T05:15:00.000Z"],
    ["5. afternoon",          "2026-09-15", "14:45", "2026-09-15T12:45:00.000Z"],
    ["6. evening",            "2026-09-15", "21:00", "2026-09-15T19:00:00.000Z"],
    ["7. near midnight",      "2026-09-15", "23:55", "2026-09-15T21:55:00.000Z"],
    ["7b. just after midnight","2026-09-15","00:05", "2026-09-14T22:05:00.000Z"],
  ];

  it.each(CASES)("%s stores the right instant", (_label, date, time, expected) => {
    expect(pickupToUtc(date, time)!.toISOString()).toBe(expected);
  });

  it.each(CASES)("%s displays back exactly what was selected", (_label, date, time) => {
    const { displayed, parts } = roundTrip(date, time);
    expect(displayed).toBe(time);
    expect(parts).toEqual({ date, time });
  });

  it("never shifts the time by an hour in either direction", () => {
    // The precise shape of the reported fault: 10:30 read back as 09:30 or 11:30.
    const { displayed } = roundTrip("2026-09-15", "10:30");
    expect(displayed).not.toBe("09:30");
    expect(displayed).not.toBe("11:30");
    expect(displayed).toBe("10:30");
  });

  it("keeps the date itself intact near midnight", () => {
    // An evening pickup stored as the next day in UTC must not be shown as such.
    const { displayedFull } = roundTrip("2026-07-15", "23:30");
    expect(displayedFull).toContain("15/07/2026");
  });
});

describe("3. DST transitions", () => {
  it("holds across the spring-forward boundary", () => {
    // 29 March 2026: Madrid jumps 02:00 -> 03:00. Either side is unambiguous.
    expect(pickupToUtc("2026-03-29", "01:30")!.toISOString()).toBe("2026-03-29T00:30:00.000Z");
    expect(pickupToUtc("2026-03-29", "04:30")!.toISOString()).toBe("2026-03-29T02:30:00.000Z");
    expect(formatPickupTime(pickupToUtc("2026-03-29", "04:30")!)).toBe("04:30");
  });

  it("resolves a time inside the spring-forward gap to a real instant", () => {
    // 02:30 does not exist that morning. It must still yield a usable instant
    // rather than NaN — a driver cannot be dispatched to a time that is null.
    const gap = pickupToUtc("2026-03-29", "02:30");
    expect(gap).not.toBeNull();
    expect(Number.isNaN(gap!.getTime())).toBe(false);
    expect(gap!.toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });

  it("holds across the autumn fall-back boundary", () => {
    // 25 October 2026: Madrid repeats 02:00-03:00, falling back to CET at 03:00.
    // 01:30 is still summer time, so it is 23:30 UTC on the previous day.
    expect(pickupToUtc("2026-10-25", "01:30")!.toISOString()).toBe("2026-10-24T23:30:00.000Z");
    expect(formatPickupTime(pickupToUtc("2026-10-25", "09:00")!)).toBe("09:00");
    expect(pickupToUtc("2026-10-25", "09:00")!.toISOString()).toBe("2026-10-25T08:00:00.000Z");
  });

  it("changes offset with the season, never by a fixed amount", () => {
    // Same wall clock, different months: winter is +01, summer +02. A hard-coded
    // offset would make one of these wrong.
    const winter = pickupToUtc("2026-01-15", "12:00")!;
    const summer = pickupToUtc("2026-07-15", "12:00")!;
    expect(winter.getUTCHours()).toBe(11);
    expect(summer.getUTCHours()).toBe(10);
  });
});

describe("8/9. same-day and future bookings", () => {
  it("treats a same-day booking as today in Barcelona", () => {
    const parts = pickupToParts(new Date());
    const stored = pickupToUtc(parts.date, "23:00")!;
    expect(pickupToParts(stored).date).toBe(parts.date);
    expect(formatPickupTime(stored)).toBe("23:00");
  });

  it("survives a booking far in the future, across a DST change", () => {
    const { displayed, parts } = roundTrip("2027-08-20", "16:40");
    expect(displayed).toBe("16:40");
    expect(parts.date).toBe("2027-08-20");
  });
});

describe("input handling", () => {
  it("respects a string that already names its offset", () => {
    expect(parsePickupInput("2026-07-15T10:30:00Z")!.toISOString()).toBe("2026-07-15T10:30:00.000Z");
    expect(parsePickupInput("2026-07-15T10:30:00+02:00")!.toISOString()).toBe("2026-07-15T08:30:00.000Z");
  });

  it("reads a zoneless string as Barcelona, not as the server's zone", () => {
    expect(parsePickupInput("2026-07-15T10:30")!.toISOString()).toBe("2026-07-15T08:30:00.000Z");
    expect(parsePickupInput("2026-07-15 10:30")!.toISOString()).toBe("2026-07-15T08:30:00.000Z");
  });

  it("rejects malformed input instead of inventing a time", () => {
    for (const [d, t] of [["", "10:30"], ["2026-13-01", "10:30"], ["2026-07-15", "25:00"], ["not-a-date", "x"]]) {
      expect(pickupToUtc(d, t)).toBeNull();
    }
    expect(parsePickupInput("")).toBeNull();
    expect(parsePickupInput("tomorrow please")).toBeNull();
  });

  it("formats an unusable value as a dash rather than 'Invalid Date'", () => {
    expect(formatPickupDateTime("nonsense")).toBe("—");
    expect(formatPickupTime("nonsense")).toBe("—");
  });

  it("uses Barcelona as the business timezone", () => {
    expect(BOOKING_TIMEZONE).toBe("Europe/Madrid");
  });
});

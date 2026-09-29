import { describe, it, expect } from "vitest";
import { sortBookingsForList, byPickupUpcomingFirst } from "@/lib/booking-order";

/**
 * The example that prompted this: two transfers on 29 September, 09:00 and
 * 11:00. The 09:00 must be above the 11:00, whichever was entered first.
 */

const at = (iso: string) => ({ pickupDatetime: iso });
const NOW = Date.parse("2026-09-29T06:00:00.000Z");

describe("upcoming bookings, soonest first", () => {
  it("puts 09:00 above 11:00 on the same day", () => {
    const rows = [at("2026-09-29T11:00:00.000Z"), at("2026-09-29T09:00:00.000Z")];
    expect(sortBookingsForList(rows, NOW).map((r) => r.pickupDatetime)).toEqual([
      "2026-09-29T09:00:00.000Z",
      "2026-09-29T11:00:00.000Z",
    ]);
  });

  it("ignores the order they were entered in", () => {
    // The old list was ordered by createdAt, so this is the case that broke.
    const rows = [
      at("2026-10-05T08:00:00.000Z"),
      at("2026-09-29T09:00:00.000Z"),
      at("2026-09-30T07:00:00.000Z"),
    ];
    expect(sortBookingsForList(rows, NOW).map((r) => r.pickupDatetime)).toEqual([
      "2026-09-29T09:00:00.000Z",
      "2026-09-30T07:00:00.000Z",
      "2026-10-05T08:00:00.000Z",
    ]);
  });

  it("sorts across days and times together, not day then time", () => {
    const rows = [at("2026-09-30T06:00:00.000Z"), at("2026-09-29T23:00:00.000Z")];
    expect(sortBookingsForList(rows, NOW)[0].pickupDatetime).toBe("2026-09-29T23:00:00.000Z");
  });
});

describe("past bookings", () => {
  it("come after everything still to come", () => {
    const rows = [at("2026-09-28T09:00:00.000Z"), at("2026-10-01T09:00:00.000Z")];
    expect(sortBookingsForList(rows, NOW).map((r) => r.pickupDatetime)).toEqual([
      "2026-10-01T09:00:00.000Z",
      "2026-09-28T09:00:00.000Z",
    ]);
  });

  it("read most recent first, not oldest first", () => {
    // A ride from 2024 has no business above one from this morning.
    const rows = [at("2024-03-01T09:00:00.000Z"), at("2026-09-29T05:00:00.000Z")];
    expect(sortBookingsForList(rows, NOW).map((r) => r.pickupDatetime)).toEqual([
      "2026-09-29T05:00:00.000Z",
      "2024-03-01T09:00:00.000Z",
    ]);
  });

  it("places a booking exactly at now on the upcoming side", () => {
    const rows = [at("2026-09-28T09:00:00.000Z"), at(new Date(NOW).toISOString())];
    expect(sortBookingsForList(rows, NOW)[0].pickupDatetime).toBe(new Date(NOW).toISOString());
  });
});

describe("robustness", () => {
  it("accepts Date objects as well as strings", () => {
    const rows = [
      { pickupDatetime: new Date("2026-09-29T11:00:00.000Z") },
      { pickupDatetime: new Date("2026-09-29T09:00:00.000Z") },
    ];
    expect(sortBookingsForList(rows, NOW)[0].pickupDatetime.toISOString())
      .toBe("2026-09-29T09:00:00.000Z");
  });

  it("does not throw or scramble the list on an unreadable date", () => {
    const rows = [at("not a date"), at("2026-09-29T09:00:00.000Z"), at("2026-09-30T09:00:00.000Z")];
    const out = sortBookingsForList(rows, NOW).map((r) => r.pickupDatetime);
    expect(out.slice(0, 2)).toEqual(["2026-09-29T09:00:00.000Z", "2026-09-30T09:00:00.000Z"]);
    expect(out[2]).toBe("not a date");
  });

  it("leaves the caller's array untouched", () => {
    const rows = [at("2026-10-05T08:00:00.000Z"), at("2026-09-29T09:00:00.000Z")];
    const before = rows.map((r) => r.pickupDatetime);
    sortBookingsForList(rows, NOW);
    expect(rows.map((r) => r.pickupDatetime)).toEqual(before);
  });

  it("is a consistent comparator", () => {
    const cmp = byPickupUpcomingFirst(NOW);
    const a = at("2026-09-29T09:00:00.000Z");
    const b = at("2026-09-29T11:00:00.000Z");
    expect(cmp(a, b)).toBeLessThan(0);
    expect(cmp(b, a)).toBeGreaterThan(0);
    expect(cmp(a, a)).toBe(0);
  });
});

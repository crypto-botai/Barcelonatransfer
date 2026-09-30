import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pickupToParts, pickupToUtc } from "@/lib/datetime";

/**
 * Every clock the customer is shown is Barcelona's.
 *
 * The booking form hands its date and time to `pickupToUtc`, which reads them
 * as Barcelona wall-clock. Anything that fills those fields from the viewer's
 * own clock therefore disagrees with what the booking will mean — and this
 * form is used from abroad by design: the ads run in the UK, France, Germany
 * and Ireland.
 *
 * Two separate failures came out of that:
 *   - `toISOString()` for "today" gives the UTC date, which is yesterday from
 *     22:00 Barcelona in winter and 23:00 in summer.
 *   - "in about an hour" was computed with getHours() on the viewer's clock,
 *     so a London customer was offered a slot an hour behind the city.
 */

const ROOT = join(__dirname, "..", "..");
const FORM = readFileSync(join(ROOT, "app", "book", "BookFormClient.tsx"), "utf-8");

/** The body of a named function in the form's source. */
function fnBody(name: string): string {
  const start = FORM.indexOf(`function ${name}`);
  expect(start, `${name} is missing from BookFormClient`).toBeGreaterThan(-1);
  return FORM.slice(start, start + 900);
}

describe("the form's defaults are Barcelona time", () => {
  it("reads today from the Barcelona clock", () => {
    const body = fnBody("todayStr");
    expect(body).toContain("pickupToParts");
    expect(body).not.toContain("toISOString().split");
  });

  it("steps to tomorrow without a local-clock date", () => {
    const body = fnBody("tomorrowStr");
    expect(body).toContain("todayStr()");
    expect(body).not.toMatch(/\.setDate\(\s*d\.getDate\(\)/);
  });

  it("builds the soon slot from Barcelona, not the viewer", () => {
    const body = fnBody("soonSlot");
    expect(body).toContain("pickupToParts");
    expect(body).not.toMatch(/\.getHours\(\)|\.getMinutes\(\)/);
  });

  /** It returns a date too, because rounding up can cross midnight. */
  it("returns a date alongside the time", () => {
    expect(FORM).toMatch(/function soonSlot\(\):\s*\{\s*date:\s*string;\s*time:\s*string\s*\}/);
    expect(FORM).toContain("...soonSlot()");
  });

  /** The helper it replaced read the local clock; it must not come back. */
  it("no longer carries the local-clock rounding helper", () => {
    expect(FORM).not.toContain("roundUpToNext30");
  });
});

describe("what those defaults have to satisfy", () => {
  /**
   * The contract the form relies on: a date and time it produces, read back
   * through pickupToUtc and re-rendered, must come out as the same wall clock.
   * This is the property the local-clock versions broke.
   */
  it("round-trips a Barcelona wall clock through pickupToUtc", () => {
    for (const [date, time] of [
      ["2026-07-15", "23:50"], // summer, late evening — the UTC-date trap
      ["2026-01-15", "22:10"], // winter, late evening
      ["2026-10-25", "02:30"], // the autumn DST changeover
      ["2026-03-29", "03:30"], // the spring DST changeover
    ]) {
      const instant = pickupToUtc(date, time);
      expect(instant, `${date} ${time} did not parse`).not.toBeNull();
      expect(pickupToParts(instant!)).toEqual({ date, time });
    }
  });

  /**
   * The bug in one line: at 23:30 Barcelona on a summer evening the UTC date
   * is still the previous day, so `toISOString()` offered a date that had
   * already passed in the city the customer was flying into.
   */
  it("shows why the UTC date was wrong for a late booking", () => {
    const lateEvening = new Date("2026-07-15T21:30:00.000Z"); // 23:30 Barcelona
    expect(lateEvening.toISOString().slice(0, 10)).toBe("2026-07-15");
    expect(pickupToParts(lateEvening).date).toBe("2026-07-15");

    const afterMidnight = new Date("2026-07-15T22:30:00.000Z"); // 00:30 Barcelona, 16th
    expect(afterMidnight.toISOString().slice(0, 10)).toBe("2026-07-15"); // UTC still the 15th
    expect(pickupToParts(afterMidnight).date).toBe("2026-07-16"); // Barcelona is the 16th
  });
});

describe("pickup times are rendered in Barcelona everywhere", () => {
  /**
   * A pickup instant rendered without an explicit timeZone reads in whatever
   * zone the viewer's browser is in. One page did that for the day number
   * while the month beside it was rendered in Barcelona, so the two disagreed
   * for anyone reading from outside Spain.
   */
  const PAGES = [
    "app/dashboard/payments/page.tsx",
    "app/dashboard/page.tsx",
    "app/admin/bookings/page.tsx",
    "app/booking/success/page.tsx",
    "app/booking/pay/[checkoutId]/page.tsx",
    "components/tracking/PublicTrackClient.tsx",
  ];

  for (const page of PAGES) {
    it(`${page} never reads a pickup with a bare local-clock getter`, () => {
      const src = readFileSync(join(ROOT, page), "utf-8");
      const lines = src.split("\n");
      const offenders = lines.filter((l) =>
        /pickupDatetime/.test(l) && /\.(getDate|getHours|getMonth|getFullYear|getMinutes)\(\)/.test(l),
      );
      expect(offenders, `${page}:\n${offenders.join("\n")}`).toEqual([]);
    });

    it(`${page} names Europe/Madrid on every pickup it formats`, () => {
      const src = readFileSync(join(ROOT, page), "utf-8");
      const formatted = src.split("\n").filter((l) =>
        /pickupDatetime/.test(l) && /toLocale(Date|Time)?String/.test(l),
      );
      for (const line of formatted) {
        expect(line, `${page}: ${line.trim()}`).toContain("Europe/Madrid");
      }
    });
  }
});

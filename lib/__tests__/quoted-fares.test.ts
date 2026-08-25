import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fg from "fast-glob";
import { FIXED_ROUTES } from "@/lib/fixed-prices";
import { HOURLY_RATES } from "@/lib/pricing";
import { EXTRAS_CATALOG } from "@/types";

/**
 * Every fare a page prints has to be a fare the checkout charges.
 *
 * This has now failed three times in three different shapes. Hand-typed price
 * ladders on the destination pages. Hand-typed offers in the JSON-LD catalogue,
 * where seven of thirteen understated the real fare. And most recently two
 * commercial pages that nobody had thought to check:
 *
 *   /hotel-transfers   "from €35" on two rows against a €50 city fare
 *   /vip-transportation V-Class €70 against €75, EQE 300 €55 against €65
 *
 * Both were written when they were true. Neither had anything watching them.
 *
 * The check is deliberately "is this number real" rather than "is this number
 * derived". A literal that matches the table is harmless; a literal that does
 * not is the bug, however it got there. That keeps meta descriptions quoting a
 * known headline fare legal while still catching drift the moment a price moves.
 */

// Pages that quote transfer fares to customers.
const COMMERCIAL = fg.sync([
  "app/transfers/**/*.tsx",
  "app/hotel-transfers/**/*.tsx",
  "app/airport-transfers/**/*.tsx",
  "app/vip-transportation/**/*.tsx",
  "app/day-tours/**/*.tsx",
  "app/fleet/**/*.tsx",
  "app/hourly/**/*.tsx",
  "app/pricing/**/*.tsx",
  "app/corporate/**/*.tsx",
]);

/** Every amount the business actually charges, from all three price sources. */
const REAL: ReadonlySet<number> = new Set<number>([
  ...FIXED_ROUTES.flatMap((r) => [
    ...Object.values(r.prices),
    ...Object.values(r.vehicleOverrides ?? {}),
    ...Object.values(r.vehicleClassOverrides ?? {}),
  ]),
  ...Object.values(HOURLY_RATES),
  ...EXTRAS_CATALOG.map((e) => e.price).filter((p): p is number => typeof p === "number"),
]);

/**
 * Literal euro amounts, ignoring anything inside a template expression.
 * `€${price}` is derived and cannot drift; `€70` is a claim.
 */
function literalFares(src: string): number[] {
  const withoutDerived = src.replace(/\$\{[^}]*\}/g, "«derived»");
  const out: number[] = [];
  for (const m of withoutDerived.matchAll(/€\s?(\d{1,4})(?!\d)/g)) {
    out.push(Number(m[1]));
  }
  return out;
}

describe("every fare printed on a commercial page is a real fare", () => {
  it("finds the commercial pages", () => {
    expect(COMMERCIAL.length).toBeGreaterThan(15);
  });

  it("the price table is loaded", () => {
    expect(REAL.size).toBeGreaterThan(20);
  });

  it("no page prints a euro amount the business does not charge", () => {
    const bad: string[] = [];
    for (const f of COMMERCIAL) {
      const src = readFileSync(f, "utf-8");
      // Comments document past bugs and quote the wrong numbers on purpose.
      const prose = src
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
      for (const n of literalFares(prose)) {
        // Small amounts are extras, deposits and surcharges, not transfer fares.
        if (n < 30) continue;
        if (!REAL.has(n)) bad.push(`${f}: €${n}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("the two fares that were wrong are now derived, not corrected in place", () => {
    // Correcting the literal would have left the next price change to break it
    // again. Both call sites must read the table.
    const vip = readFileSync("app/vip-transportation/page.tsx", "utf-8");
    expect(vip).toMatch(/lookupPriceByFleetVehicle/);
    expect(vip).not.toMatch(/from:\s*"€\d+"/);

    // Comments record what the number used to be, so strip them before
    // asserting the literal is gone from the page itself.
    const strip = (src: string) =>
      src
        .split(/\r?\n/)
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
    const hotels = strip(readFileSync("app/hotel-transfers/page.tsx", "utf-8"));
    expect(hotels).not.toMatch(/"from €35"/);
    expect(hotels).toMatch(/cityToCityPrice/);
  });
});

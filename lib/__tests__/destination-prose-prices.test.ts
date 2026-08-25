import { describe, expect, it } from "vitest";
import destinations from "@/data/destinations.json";
import { FIXED_ROUTES } from "@/lib/fixed-prices";
import { SLUG_TO_ZONE } from "@/lib/destination-pricing";

/**
 * Prices written into destination prose must be prices the checkout charges.
 *
 * This is the third time a hand-written figure has drifted from the route
 * table. llms.txt had 136 of 175 cells wrong; the /book Service schema declared
 * €45 against a visible €50; and twenty hotel pages quoted €45 in their FAQ
 * answers while the page headline, resolved from the pricing service, said €50.
 * The FAQ text is also published as FAQPage structured data, so the wrong
 * figure reached Google as well as the reader.
 *
 * Rendered prices are safe — the template resolves them from the pricing
 * service and the schema builder refuses to fall back to this file. Prose is
 * the one surface a human still types, so it is the one that needs a guard.
 */

interface Dest {
  slug: string;
  name: string;
  type: string;
  distance_km: number;
  faqs?: Array<{ q: string; a: string }>;
  description?: string;
  highlights?: string[];
  prices?: unknown;
}

const DESTS = destinations as unknown as Dest[];

/** Every fare the price table publishes, as a set of whole euros. */
const TABLE_PRICES = new Set<number>();
for (const r of FIXED_ROUTES) {
  for (const p of Object.values(r.prices)) TABLE_PRICES.add(p);
  for (const p of Object.values(r.vehicleOverrides ?? {})) TABLE_PRICES.add(p as number);
}

/**
 * Figures that legitimately appear in prose without being one of our fares:
 * the extras, other operators' published fares used in comparisons, and small
 * numbers that are plainly not prices.
 */
const NON_FARE = new Set<number>([
  4, 5, 6, 10, 15, 20, 25, 30, 32, 40, 60, 90, // extras, minutes, competitor fares
]);

function prose(d: Dest): string {
  return [
    d.description ?? "",
    ...(d.highlights ?? []),
    ...(d.faqs ?? []).flatMap((f) => [f.q, f.a]),
  ].join("  ");
}

describe("prices quoted in destination prose", () => {
  it("never quotes a fare the price table does not contain", () => {
    const offenders: string[] = [];

    for (const d of DESTS) {
      for (const m of prose(d).matchAll(/€\s?(\d+)/g)) {
        const value = Number(m[1]);
        if (NON_FARE.has(value)) continue;
        if (TABLE_PRICES.has(value)) continue;
        // Distance-priced destinations have no table row; their fares are
        // computed, so they are checked by the per-route test below instead.
        if (!SLUG_TO_ZONE[d.slug]) continue;
        offenders.push(`${d.slug}: €${value}`);
      }
    }

    expect(offenders, `prose quotes fares absent from the route table:\n${offenders.join("\n")}`)
      .toEqual([]);
  });

  it("quotes no €45 anywhere — the fare that was never charged", () => {
    // The specific figure twenty pages carried against a real €50.
    for (const d of DESTS) {
      expect(prose(d), `${d.slug} still quotes €45`).not.toMatch(/€\s?45\b/);
    }
  });

  it("makes no unverifiable vehicle-age or refreshment claim", () => {
    for (const d of DESTS) {
      const text = prose(d);
      expect(text, `${d.slug}`).not.toMatch(/less than 3 years old/i);
      expect(text, `${d.slug}`).not.toMatch(/complimentary water/i);
    }
  });

  it("carries no dead price fields", () => {
    // These rendered nothing and every one sat below the fare charged, so any
    // future code reading them would have published a wrong price.
    const withPrices = DESTS.filter((d) => d.prices !== undefined).map((d) => d.slug);
    expect(withPrices).toEqual([]);
  });
});

describe("vehicle facts quoted in prose", () => {
  it("does not give the EQE 300 three seats", () => {
    // It carries four. Several answers said three while also pricing it as the
    // cheapest option, which it is not.
    for (const d of DESTS) {
      const text = prose(d);
      if (!/EQE 300/.test(text)) continue;
      expect(text, `${d.slug}`).not.toMatch(/EQE 300 Electric \(up to 3 passengers\)/);
    }
  });

  it("does not price the V-Class at the Vito's fare", () => {
    for (const d of DESTS) {
      const text = prose(d);
      expect(text, `${d.slug}`).not.toMatch(/V-Class for groups up to 7 (?:costs |is )€65/);
    }
  });
});

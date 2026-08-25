import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fg from "fast-glob";
import { VEHICLE_CATALOG } from "@/types";
import { FLEET_FACTS, amenitySentence, fleetSummary } from "@/lib/fleet-facts";

/**
 * Amenity claims have to be true of the fleet, not of one car in it.
 *
 * The 25 Aug work removed "under 3 years old" and "complimentary still water"
 * from llms.txt and llms-full.txt, and added a test to keep them out. That test
 * read the two generated files and nothing else, so the website went on making
 * both claims in nine places — including components/sections/FAQSection.tsx,
 * which renders on the homepage.
 *
 * Checked against the catalogue rather than a list of banned strings, because
 * the question is not "does this phrase appear" but "is it true":
 *
 *   vehicle age  — not recorded anywhere in the codebase, so unverifiable, and
 *                  it decays without anyone editing a file
 *   water        — listed on 1 of 7 cars (EQE 300, "Water & Mints")
 *   WiFi         — listed on 5 of 7; not the V-Class, not the Sprinter
 */

const SOURCES = [
  ...fg.sync("app/**/*.tsx", { ignore: ["**/node_modules/**"] }),
  ...fg.sync("components/**/*.tsx"),
  ...fg.sync("lib/**/*.ts", { ignore: ["lib/__tests__/**", "lib/fleet-facts.ts"] }),
];

/** Comment lines are documentation, not claims made to a reader. */
function prose(file: string): string {
  return readFileSync(file, "utf-8")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");
}

describe("the catalogue is the source for what the fleet offers", () => {
  it("water is not a fleet-wide feature, so the count must stay below the total", () => {
    expect(FLEET_FACTS.waterCount).toBeLessThan(FLEET_FACTS.total);
    expect(FLEET_FACTS.waterUniversal).toBe(false);
  });

  it("WiFi is not on every car either", () => {
    expect(FLEET_FACTS.wifiUniversal).toBe(false);
    expect(FLEET_FACTS.wifiCount).toBeGreaterThan(0);
  });

  it("no vehicle records an age, so no page may state one", () => {
    // Bounded: an unanchored /age/ matches "luggage", which is how the first
    // run of this test reported all seven cars as carrying an age claim.
    const withAge = VEHICLE_CATALOG.filter((v) =>
      JSON.stringify(v).match(/\b(years?|aged|brand[- ]new)\b/i),
    );
    expect(withAge).toEqual([]);
  });
});

describe("no page makes a claim the catalogue does not support", () => {
  it("nothing states a vehicle age", () => {
    const re = /(under|less than|no more than)\s+\w+\s+years?\s+old|\b\d\s*years?\s+old\b/i;
    const offenders = SOURCES.filter((f) => re.test(prose(f)));
    expect(offenders).toEqual([]);
  });

  it("nothing promises water across the whole fleet", () => {
    const re = /(complimentary|bottled|still)\s+water|water\s+(on board|in every)/i;
    const offenders = SOURCES.filter((f) => re.test(prose(f)));
    expect(offenders).toEqual([]);
  });

  it("nothing claims every vehicle has WiFi", () => {
    const re = /all (vehicles|cars)[^.]{0,60}wifi/i;
    const offenders = SOURCES.filter((f) => re.test(prose(f)));
    expect(offenders).toEqual([]);
  });

  it("nothing offers child seats free, since they are a paid extra", () => {
    const re = /child seats?[^.\n]{0,40}\bfree\b|free[^.\n]{0,20}child seats?/i;
    const offenders = SOURCES.filter((f) => re.test(prose(f)));
    expect(offenders).toEqual([]);
  });
});

describe("the derived sentences describe the real fleet", () => {
  it("the fleet summary names every car, not just the Mercedes", () => {
    const summary = fleetSummary();
    for (const v of VEHICLE_CATALOG) {
      expect(summary, `missing ${v.label}`).toContain(v.label);
    }
    // The regression this replaces: four Mercedes and nothing else.
    expect(summary).toMatch(/Toyota/);
    expect(summary).toMatch(/Tesla/);
  });

  it("the amenity sentence never says every car has what most cars have", () => {
    const s = amenitySentence();
    expect(s).not.toMatch(/\ball (cars|vehicles)\b/i);
    expect(s).not.toMatch(/water/i);
    if (!FLEET_FACTS.wifiUniversal) {
      expect(s).toMatch(new RegExp(`${FLEET_FACTS.wifiCount} of the ${FLEET_FACTS.total}`));
    }
  });
});

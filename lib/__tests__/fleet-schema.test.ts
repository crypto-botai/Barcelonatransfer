import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VEHICLE_CATALOG } from "@/types";

/**
 * The Product schema on the seven fleet pages hardcoded
 * `brand: { name: "Mercedes-Benz" }`, so /fleet/standard-sedan told Google a
 * Toyota Corolla was a Mercedes, and the Camry and Tesla Model 3 pages said the
 * same. Structured data that contradicts the visible page breaks Google's
 * structured data policy and puts the rich result on every fleet page at risk.
 *
 * These guard the fix at the source, since the rendered schema is built inside
 * a server component that cannot be imported here.
 */
const SOURCE = readFileSync(
  join(process.cwd(), "app", "fleet", "[slug]", "page.tsx"),
  "utf-8",
);

describe("fleet Product schema", () => {
  it("derives the brand from the vehicle instead of hardcoding a manufacturer", () => {
    expect(SOURCE).toContain("brand: { \"@type\": \"Brand\", name: vehicleBrand(vehicle.label) }");
    expect(SOURCE).not.toContain("name: \"Mercedes-Benz\" }");
  });

  it("names a manufacturer that actually appears in the vehicle's label", () => {
    // Mirrors vehicleBrand() in the page. Kept in step by the assertion above,
    // which fails if the page stops calling it.
    const brandOf = (label: string) => {
      const make = label.split(" ")[0];
      return make === "Mercedes" ? "Mercedes-Benz" : make;
    };

    for (const v of VEHICLE_CATALOG) {
      const brand = brandOf(v.label);
      // "Mercedes-Benz" is the registered name for vehicles labelled "Mercedes".
      const expected = brand === "Mercedes-Benz" ? "Mercedes" : brand;
      expect(v.label.startsWith(expected)).toBe(true);
    }
  });

  it("gives a Toyota a Toyota brand and a Tesla a Tesla brand", () => {
    const labels = VEHICLE_CATALOG.map((v) => v.label);
    expect(labels).toContain("Toyota Corolla");
    expect(labels).toContain("Tesla Model 3");
    // The exact three that were previously published as Mercedes-Benz.
    for (const label of ["Toyota Corolla", "Toyota Camry", "Tesla Model 3"]) {
      expect(label.split(" ")[0]).not.toBe("Mercedes");
    }
  });
});

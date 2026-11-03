import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { HOURLY_FLEET } from "@/lib/hourly-fleet";

/** The wedding page quotes hourly rates and seat counts. They come from the pricing code, never from the page. */
const src = fs.readFileSync("app/wedding-transfers/page.tsx", "utf8");

describe("wedding transport page", () => {
  it("reads its rates from the hourly fleet and prints no euro figure of its own", () => {
    expect(src).toContain("HOURLY_FLEET");
    expect(src.match(/€\d/g) ?? []).toEqual([]);
  });
  it("only offers cars that have an hourly rate", () => {
    for (const c of ["S_CLASS", "V_CLASS", "EQE_300", "VITO", "SPRINTER"]) expect(HOURLY_FLEET.some((v) => v.vehicle === c)).toBe(true);
  });
  it("has a title and description that fit the search result", async () => {
    const { metadata } = await import("@/app/wedding-transfers/page");
    const title = (metadata.title as { absolute: string }).absolute;
    expect(title.length).toBeLessThanOrEqual(60);
    expect((metadata.description ?? "").length).toBeLessThanOrEqual(160);
    expect(metadata.description).not.toContain("${");
  });
  it("is in the sitemap", () => {
    expect(fs.readFileSync("app/sitemap.ts", "utf8")).toContain("/wedding-transfers");
  });
});

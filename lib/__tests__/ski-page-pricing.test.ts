import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ladderFor } from "@/lib/destination-pricing";

/**
 * The Andorra ski stations must never carry a fixed fare on the page.
 *
 * lib/pricing.ts classes them as ski stations and prices them by road distance
 * rather than at the Andorra fare. Asked directly, the quote engine returns
 * €491 for Pas de la Casa and €505 for Soldeu against Andorra's fixed €350 —
 * so any single figure printed on that page is wrong for most readers. It has
 * happened before: these were once advertised at a flat €240, less than half
 * the real cost of the longer runs.
 *
 * The page therefore quotes the Andorra fare only as an explicit contrast, and
 * sends the reader to the calculator for their own resort.
 */
const SKI = readFileSync("app/transfers/andorra-ski-resorts/page.tsx", "utf-8");
const prose = SKI.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

describe("the ski resorts page quotes nothing it cannot charge", () => {
  it("prints no hard-coded euro figure at all", () => {
    // Every price on the page must come from ladderFor, never a literal.
    expect(prose).not.toMatch(/€\s?\d/);
  });

  it("declares no offers block, because there is no fixed price to offer", () => {
    expect(prose).not.toMatch(/"@type":\s*"Offer"/);
    expect(prose).not.toMatch(/priceCurrency/);
  });

  it("reads the Andorra contrast from the price table", () => {
    expect(prose).toMatch(/ladderFor\("andorra",\s*"airport"\)/);
    expect(ladderFor("andorra", "airport")?.economy).toBeGreaterThan(0);
  });

  it("points at the calculator, which is the only thing that knows the price", () => {
    expect(prose).toMatch(/tools\/transfer-cost-calculator/);
  });
});
